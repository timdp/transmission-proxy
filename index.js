'use strict'

if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic')
}

var pkg = require('./package.json')

var express = require('express')
var bodyParser = require('body-parser')
var logfmt = require('logfmt')
var auth = require('http-auth')
var randomstring = require('randomstring')
var timeago = require('timeago')

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
  var notify = function (err, record) {
    if (err) {
      logfmt.error(new Error('Failed to add "' + record.filename + '": ' + err))
    } else {
      logfmt.log({
        result: 'added',
        filename: record.filename
      })
      succeeded.push(record.id)
    }
  }
  db.getQueue()
    .then(function (queue) {
      return transmission.addAll(queue, notify)
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
app.locals.version = pkg.version
app.locals.timeago = timeago

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

var port = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080
var addr = process.env.OPENSHIFT_NODEJS_IP
app.listen(port, addr, function () {
  logfmt.log({
    action: 'start',
    port: port,
    address: addr
  })
})
