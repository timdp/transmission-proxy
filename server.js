'use strict'

if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic')
}

var Q = require('q')
var express = require('express')
var logfmt = require('logfmt')
var timeago = require('timeago')
var path = require('path')
var TransmissionProxy = require('./')

var pkg = require(path.join(__dirname, 'package.json'))
var config = require(path.join(__dirname, 'config.json'))
var addr = process.env.OPENSHIFT_IOJS_IP ||
  process.env.OPENSHIFT_NODEJS_IP
var port = process.env.OPENSHIFT_IOJS_PORT ||
  process.env.OPENSHIFT_NODEJS_PORT ||
  process.env.PORT ||
  8080

var status = {}
var queueProcessingStarted = null

var app = express()
var proxy = new TransmissionProxy(config)
var authenticate = proxy.getAuthenticationMiddleware()

app.use(logfmt.requestLogger())
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')
app.locals.version = pkg.version
app.locals.timeago = timeago

app.get('/', function (req, res) {
  res.render('index')
})

app.get('/ping', function (req, res) {
  res.set('Content-Type', 'text/plain')
    .send('OK')
})

app.get('/status', authenticate, function (req, res, next) {
  Q.invoke(proxy, 'getQueue')
    .then(function (queue) {
      res.render('status', {
        status: status,
        queue: queue
      })
    })
    .fail(next)
})

proxy.on('addingTorrent', function (data) {
  status.lastAdd = {
    time: new Date(),
    filename: data.filename
  }
  logfmt.log({
    action: 'enqueue',
    filename: data.filename
  })
})

proxy.on('addedTorrent', function (data) {
  logfmt.log({
    action: 'added',
    filename: data.filename
  })
})

proxy.on('processingQueue', function () {
  queueProcessingStarted = new Date()
})

proxy.on('processedQueue', function () {
  var now = new Date()
  status.queueProcessingTime = now - queueProcessingStarted
  queueProcessingStarted = null
})

proxy.on('error', function (data) {
  status.lastError = {
    time: new Date(),
    error: data.error
  }
  logfmt.error(data.error)
})

app.use(proxy.getRouter())

status.startTime = new Date()

app.listen(port, addr, function () {
  logfmt.log({
    action: 'start',
    port: port,
    address: addr
  })
})
