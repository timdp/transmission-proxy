'use strict'

if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic')
}

var express = require('express')
var bodyParser = require('body-parser')
var logfmt = require('logfmt')
var auth = require('http-auth')
var randomstring = require('randomstring')

var config = require('./config.json')
config.retry_after = config.retry_after || 5 * 60

var context = {config: config}
var db = require('./lib/db-pg').call(context)
var transmission = require('./lib/transmission').call(context)

var status = {startTime: new Date()}
var queueProcessingStarted = null
var retryTimeout = null

var logError = function (err) {
  status.lastError = {
    time: new Date(),
    error: err
  }
  logfmt.error(err)
}

var processQueue = function () {
  if (retryTimeout !== null) {
    clearTimeout(retryTimeout)
    retryTimeout = null
  }
  if (queueProcessingStarted !== null) {
    return
  }
  queueProcessingStarted = new Date()
  var succeeded = []
  var onSuccess = function (filename) {
    succeeded.push(filename)
  }
  db.getQueue()
    .then(function (queue) {
      return transmission.addAll(queue, onSuccess)
    })
    .fail(logError)
    .then(function () {
      return db.dequeue(succeeded)
    })
    .fail(logError)
    .fin(function () {
      var endTime = new Date()
      status.queueProcessingTime = endTime - queueProcessingStarted
      queueProcessingStarted = null
      retryTimeout = setTimeout(processQueue, config.retry_after * 1000)
    })
}

var addTorrent = function (filename) {
  status.lastAdd = {
    time: new Date(),
    filename: filename
  }
  logfmt.log({
    action: 'enqueue',
    filename: filename
  })
  db.enqueue(filename)
    .fail(logError)
    .fin(processQueue)
}

var assignSessionID = function (res) {
  var sessionID = randomstring.generate(48)
  res.set('X-Transmission-Session-Id', sessionID)
  res.set('Content-Type', 'text/html; charset=ISO-8859-1')
  res.send('<h1>409: Conflict</h1>' +
    '<p><code>X-Transmission-Session-Id: ' + sessionID + '</code></p>')
}

var manageTransmissionSession = function (req, res, next) {
  res.set('Server', 'Transmission')
  var sessionID = req.get('X-Transmission-Session-Id')
  if (typeof sessionID === 'undefined') {
    assignSessionID(res)
  } else {
    res.set('X-Transmission-Session-Id', sessionID)
    next()
  }
}

var processTransmissionRequest = function (req, res, method, args) {
  var valid = (method === 'torrent-add' &&
    args !== null && typeof args === 'object' &&
    typeof args.filename === 'string')
  if (valid) {
    addTorrent(args.filename)
  }
  res.json({success: valid})
}

var authenticate = auth.connect(auth.basic(
  {realm: 'Transmission'},
  function (username, password, callback) {
    callback(username === config.username && password === config.password)
  }))

var app = express()
app.use(logfmt.requestLogger())
app.set('views', './views')
app.set('view engine', 'jade')

app.get('/', function (req, res) {
  res.render('index')
})

app.get('/status',
  authenticate,
  function (req, res, next) {
    db.getQueue()
      .then(function (queue) {
        res.render('status', {status: status, queue: queue})
      })
      .fail(next)
  })

app.get(config.transmission.url,
  authenticate,
  manageTransmissionSession,
  function (req, res) {
    processTransmissionRequest(req, res, req.params.method, req.params)
  })

app.post(config.transmission.url,
  authenticate,
  manageTransmissionSession,
  bodyParser.json({type: '*/*'}),
  function (req, res) {
    processTransmissionRequest(req, res, req.body.method, req.body.arguments)
  })

app.listen(process.env.PORT || 8080)
