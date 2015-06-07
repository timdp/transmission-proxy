#!/bin/env node


'use strict';

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _logfmt = require('logfmt');

var _logfmt2 = _interopRequireDefault(_logfmt);

var _timeago = require('timeago');

var _timeago2 = _interopRequireDefault(_timeago);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _ = require('./');

var _2 = _interopRequireDefault(_);

if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic');
}

var ROOT = _path2['default'].resolve(__dirname, '..');
var PACKAGE = JSON.parse(_fs2['default'].readFileSync(_path2['default'].join(ROOT, 'package.json')));
var CONFIG = JSON.parse(_fs2['default'].readFileSync(_path2['default'].join(ROOT, 'config.json')));
var ADDRESS = process.env.OPENSHIFT_IOJS_IP || process.env.OPENSHIFT_NODEJS_IP;
var PORT = process.env.OPENSHIFT_IOJS_PORT || process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080;

var status = {};
var queueProcessingStarted = null;

var app = (0, _express2['default'])();
var proxy = new _2['default'](CONFIG);

app.use(_logfmt2['default'].requestLogger());
app.set('views', _path2['default'].join(ROOT, 'views'));
app.set('view engine', 'jade');
app.locals.version = PACKAGE.version;
app.locals.timeago = _timeago2['default'];

app.get('/', function (req, res) {
  return res.render('index');
});

app.get('/ping', function (req, res) {
  return res.set('Content-Type', 'text/plain').send('OK');
});

app.get('/status', proxy.authenticate, function (req, res, next) {
  _q2['default'].invoke(proxy, 'getQueue').then(function (queue) {
    return res.render('status', { status: status, queue: queue });
  }).fail(next);
});

proxy.on('addingTorrent', function (data) {
  status.lastAdd = {
    time: new Date(),
    filename: data.filename
  };
  _logfmt2['default'].log({
    action: 'enqueue',
    filename: data.filename
  });
});

proxy.on('addedTorrent', function (data) {
  _logfmt2['default'].log({
    action: 'added',
    filename: data.filename
  });
});

proxy.on('processingQueue', function () {
  return queueProcessingStarted = new Date();
});

proxy.on('processedQueue', function () {
  var now = new Date();
  status.queueProcessingTime = now - queueProcessingStarted;
  queueProcessingStarted = null;
});

proxy.on('error', function (data) {
  status.lastError = {
    time: new Date(),
    error: data.error
  };
  _logfmt2['default'].error(data.error);
});

app.use(proxy.router);

status.startTime = new Date();

app.listen(PORT, ADDRESS, function () {
  _logfmt2['default'].log({
    action: 'start',
    port: PORT,
    address: ADDRESS
  });
});