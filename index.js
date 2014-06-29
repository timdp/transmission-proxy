'use strict';

if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic');
}

var Transmission = require('transmission');
var express = require('express');
var logfmt = require('logfmt');
var auth = require('http-auth');
var randomstring = require('randomstring');

var config = require('./config.json');

var transmission = new Transmission(config.transmission);

var processAddTorrent = function(req, res) {
  var reply = function(err) {
    res.json({
      success: (err === null)
    });
  }
  if (typeof req.body.arguments === 'object' &&
      typeof req.body.arguments.filename === 'string') {
    transmission.addUrl(req.body.arguments.filename, {
      paused: config.add_paused
    }, config.ignore_result ? function() {} : reply);
  } else if (!config.ignore_result) {
    reply('Invalid argument');
  }
  if (config.ignore_result) {
    reply(null);
  }
}

var assignSessionID = function(req, res) {
  var sessionID = randomstring.generate(48);
  res.set('X-Transmission-Session-Id', sessionID);
  res.set('Content-Type', 'text/html; charset=ISO-8859-1');
  res.send(new Buffer('<h1>409: Conflict</h1>' +
    '<p><code>X-Transmission-Session-Id: ' + sessionID + '</code></p>'));
};

var authenticate = auth.connect(auth.basic({
  realm: 'Transmission'
}, function(username, password, callback) {
  callback(username === config.username && password === config.password);
}));

var app = express();

app.use(logfmt.requestLogger());

app.use(function(req, res, next) {
  req.rawBody = '';
  req.on('data', function(data) {
    req.rawBody += data;
  })
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
  })
});

app.all('/', function(req, res) {
  res.send('It works!');
});

app.all(config.transmission.url, authenticate, function(req, res) {
  res.set('Server', 'Transmission');
  var sessionID = req.get('X-Transmission-Session-Id');
  if (typeof sessionID === 'undefined') {
    assignSessionID(req, res);
  } else {
    res.set('X-Transmission-Session-Id', sessionID);
    if (typeof req.body === 'object' && req.body.method === 'torrent-add') {
      processAddTorrent(req, res);
    } else {
      res.json({
        success: false
      });
    }
  }
});

app.listen(process.env.PORT || 8080);