'use strict';

if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic');
}

var Transmission = require('transmission');
var q = require('q');
var express = require('express');
var logfmt = require('logfmt');
var auth = require('http-auth');
var randomstring = require('randomstring');

var config = require('./config.json');

var queue = [];
var processingQueue = false;
var retryTimeout = null;

var transmission = new Transmission(config.transmission);
var boundAddUrl = q.nbind(transmission.addUrl, transmission);

var addURL = function(filename) {
  logfmt.log({
    action: 'add',
    filename: filename
  });
  return boundAddUrl(filename, {
    paused: config.add_paused
  });
};

var processQueue = function() {
  if (retryTimeout !== null) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  if (processingQueue) {
    return;
  }
  processingQueue = true;
  var succeeded = {};
  queue.reduce(function(prev, filename) {
    return prev.then(function() {
      return addURL(filename)
        .then(function() {
          logfmt.log({
            result: 'added',
            filename: filename
          });
          succeeded[filename] = true;
        })
        .fail(function(err) {
          throw new Error('Failed to add "' + filename + '": ' + err);
        });
    });
  }, q())
    .fail(function(err) {
      logfmt.error(err);
    })
    .fin(function() {
      queue = queue.filter(function(filename) {
        return !succeeded[filename];
      });
      logfmt.log({
        remaining: queue.length
      });
      if (queue.length) {
        retryTimeout = setTimeout(processQueue,
          (config.retry_after || 5 * 60) * 1000);
      }
      processingQueue = false;
    });
};

var processAddTorrent = function(body) {
  if (typeof body.arguments === 'object' &&
      typeof body.arguments.filename === 'string') {
    logfmt.log({
      action: 'enqueue',
      filename: body.arguments.filename
    });
    queue.push(body.arguments.filename);
    processQueue();
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
