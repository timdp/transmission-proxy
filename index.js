'use strict';

if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic');
}

var Transmission = require('transmission');
var q = require('q');
var express = require('express');
var logfmt = require('logfmt');
var auth = require('http-auth');
var pg = require('pg');
var randomstring = require('randomstring');

var config = require('./config.json');

var lastError = null;
var queueProcessingStarted = null;
var queueProcessingTime = -1;
var retryTimeout = null;

var transmission = new Transmission(config.transmission);
var boundAddUrl = q.nbind(transmission.addUrl, transmission);

var logError = function(err) {
  lastError = {
    time: new Date(),
    error: err
  };
  logfmt.error(err);
};

var connectToDatabase = function() {
  var url = process.env.DATABASE_URL || config.database_url;
  logfmt.log({
    action: 'connect',
    database_url: url
  });
  return q.ninvoke(pg, 'connect', url);
};

var query = function(sql, params) {
  logfmt.log({
    action: 'query',
    query: sql,
    params: params
  });
  var onDone = null;
  return connectToDatabase()
    .spread(function(client, done) {
      onDone = done;
      var args = [sql];
      if (params && params.length) {
        args.push(params);
      }
      return q.npost(client, 'query', args);
    })
    .then(function(res) {
      onDone();
      return res.rows;
    });
};

var retrieveQueue = function() {
  var sql = 'SELECT filename FROM queue';
  return query(sql)
    .then(function(rows) {
      return rows.map(function(row) {
        return row.filename;
      });
    });
};

var addToQueue = function(filename) {
  var sql = 'INSERT INTO queue (filename) VALUES ($1)';
  return query(sql, [filename]);
};

var removeFromQueue = function(filenames) {
  if (!filenames.length) {
    return;
  }
  var ph = filenames.map(function(filename, idx) {
    return '$' + (idx + 1);
  }).join(',');
  var sql = 'DELETE FROM queue WHERE filename IN (' + ph + ')';
  return query(sql, filenames);
};

var addToTransmission = function(filename) {
  logfmt.log({
    action: 'add',
    filename: filename
  });
  return boundAddUrl(filename, {
    paused: config.add_paused
  });
};

var getAddToTransmissionPromise = function(filename) {
  return function() {
    return addToTransmission(filename)
      .fail(function(err) {
        throw new Error('Failed to add "' + filename + '": ' + err);
      });
  };
};

var processQueue = function() {
  if (retryTimeout !== null) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  if (queueProcessingStarted !== null) {
    return;
  }
  queueProcessingStarted = new Date();
  var succeeded = [];
  retrieveQueue()
  .then(function(queue) {
    return queue.reduce(function(promise, filename) {
      return promise
        .then(getAddToTransmissionPromise(filename))
        .then(function() {
          logfmt.log({
            result: 'added',
            filename: filename
          });
          succeeded.push(filename);
        });
    }, q());
  })
  .fail(logError)
  .then(function() {
    return removeFromQueue(succeeded);
  })
  .fail(logError)
  .fin(function() {
    var endTime = new Date();
    queueProcessingTime = endTime - queueProcessingStarted;
    var time = (config.retry_after || 5 * 60) * 1000;
    retryTimeout = setTimeout(processQueue, time);
    queueProcessingStarted = null;
  });
};

var processAddTorrent = function(body) {
  if (typeof body.arguments === 'object' &&
      typeof body.arguments.filename === 'string') {
    var filename = body.arguments.filename;
    logfmt.log({
      action: 'enqueue',
      filename: filename
    });
    addToQueue(filename)
      .fail(logError)
      .fin(processQueue);
  }
};

var assignSessionID = function(res) {
  var sessionID = randomstring.generate(48);
  res.set('X-Transmission-Session-Id', sessionID);
  res.set('Content-Type', 'text/html; charset=ISO-8859-1');
  res.send('<h1>409: Conflict</h1>' +
    '<p><code>X-Transmission-Session-Id: ' + sessionID + '</code></p>');
};

var authenticate = auth.connect(auth.basic({
    realm: 'Transmission'
  },
  function(username, password, callback) {
    callback(username === config.username && password === config.password);
  }));

var app = express();

app.use(logfmt.requestLogger());

app.use(function(req, res, next) {
  req.rawBody = '';
  req.on('data', function(data) {
    req.rawBody += data;
  });
  req.on('end', function() {
    if (req.rawBody.length === 0) {
      req.body = {};
      next();
    } else {
      try {
        req.body = JSON.parse(req.rawBody);
      } catch (e) {
        req.body = {};
      } finally {
        next();
      }
    }
  });
});

app.all('/', function(req, res) {
  res.send('It works!');
});

app.get('/status', function(req, res, next) {
  retrieveQueue()
  .then(function(queue) {
      var lines = [];
      lines.push('Last processing time: ' + (queueProcessingTime < 0 ? 'none' :
        (queueProcessingTime / 1000).toFixed(2) + ' seconds'));
      lines.push('Last error: ' + (lastError === null ? 'none' :
        '[' + lastError.time + '] ' + lastError.error));
      lines.push('Pending torrents: ' + queue.length);
      queue.forEach(function(filename) {
        lines.push('- ' + filename);
      });
      res.set('Content-Type', 'text/plain');
      res.send(lines.join('\n'));
  })
  .fail(next);
});

app.all(config.transmission.url, authenticate, function(req, res) {
  res.set('Server', 'Transmission');
  var sessionID = req.get('X-Transmission-Session-Id');
  if (typeof sessionID === 'undefined') {
    assignSessionID(res);
  } else {
    res.set('X-Transmission-Session-Id', sessionID);
    if (typeof req.body === 'object' && req.body.method === 'torrent-add') {
      processAddTorrent(req.body);
      res.json({
        success: true
      });
    } else {
      res.json({
        success: false
      });
    }
  }
});

app.listen(process.env.PORT || 8080);
