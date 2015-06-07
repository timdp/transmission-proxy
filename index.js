'use strict'

var Q = require('q')
var Router = require('express').Router
var bodyParser = require('body-parser')
var auth = require('http-auth')
var randomstring = require('randomstring')
var defaults = require('defaults')
var EventEmitter = require('events').EventEmitter
var path = require('path')
var util = require('util')

var DEFAULT_CONFIG = {
  username: 'admin',
  password: 'admin',
  transmission: {
    host: 'localhost',
    port: 9091,
    username: 'admin',
    password: 'admin',
    url: '/transmission/rpc'
  },
  storage: {
    type: 'memory'
  },
  add_paused: false,
  retry_after: 5 * 60
}

var TransmissionProxy = function (config) {
  EventEmitter.call(this)
  this._router = Router()
  this._processingQueue = false
  this._retryTimeout = null
  this._config = defaults(config, DEFAULT_CONFIG)
  this._initLibs()
  this._initAuth()
  this._configureRoutes()
}
util.inherits(TransmissionProxy, EventEmitter)

TransmissionProxy.prototype.getRouter = function () {
  return this._router
}

TransmissionProxy.prototype.getAuthenticationMiddleware = function () {
  return this._authenticate
}

TransmissionProxy.prototype.addTorrent = function (filename) {
  this.emit('addingTorrent', {filename: filename})
  Q.invoke(this._storage, 'enqueue', filename)
    .fail(this._handleError.bind(this))
    .fin(this.processQueue.bind(this))
}

TransmissionProxy.prototype.getQueue = function () {
  return this._storage.getQueue()
}

TransmissionProxy.prototype.processQueue = function () {
  if (this._retryTimeout !== null) {
    clearTimeout(this._retryTimeout)
    this._retryTimeout = null
  }
  if (this._processingQueue) {
    return
  }
  this._processingQueue = true
  this.emit('processingQueue')
  var succeeded = []
  var notify = function (err, record) {
    if (err) {
      this._handleError(
        new Error('Failed to add "' + record.filename + '": ' + err))
    } else {
      this.emit('addedTorrent', {
        filename: record.filename
      })
      succeeded.push(record.id)
    }
  }.bind(this)
  Q.invoke(this, 'getQueue')
    .then(function (queue) {
      return this._transmission.addAll(queue, notify)
    }.bind(this))
    .fail(this._handleError.bind(this))
    .then(function () {
      return Q.invoke(this._storage, 'dequeue', succeeded)
    }.bind(this))
    .fail(this._handleError.bind(this))
    .fin(function () {
      this.emit('processedQueue')
      this._processingQueue = false
      this._retryTimeout = setTimeout(this.processQueue.bind(this),
        this._config.retry_after * 1000)
    }.bind(this))
}

TransmissionProxy.prototype._initLibs = function () {
  var context = {config: this._config}
  var stor = path.join(__dirname, 'lib', 'storage', this._config.storage.type)
  this._storage = require(stor).call(context)
  var tran = path.join(__dirname, 'lib', 'transmission')
  this._transmission = require(tran).call(context)
}

TransmissionProxy.prototype._initAuth = function () {
  this._authenticate = auth.connect(auth.basic(
    {realm: 'Transmission'},
    function (username, password, callback) {
      callback(username === this._config.username &&
        password === this._config.password)
    }.bind(this)))
}

TransmissionProxy.prototype._configureRoutes = function () {
  this._router.get(this._config.transmission.url,
    this._authenticate,
    this._manageSession.bind(this),
    function (req, res) {
      this._processRequest(req, res, req.params.method, req.params)
    }.bind(this))
  this._router.post(this._config.transmission.url,
    this._authenticate,
    this._manageSession.bind(this),
    bodyParser.json({type: '*/*'}),
    function (req, res) {
      this._processRequest(req, res, req.body.method, req.body.arguments)
    }.bind(this))
}

TransmissionProxy.prototype._assignSessionID = function (res) {
  var sessionID = randomstring.generate(48)
  res.status(409)
    .set('X-Transmission-Session-Id', sessionID)
    .set('Content-Type', 'text/html; charset=ISO-8859-1')
    .send('<h1>409: Conflict</h1>' +
      '<p><code>X-Transmission-Session-Id: ' + sessionID + '</code></p>')
}

TransmissionProxy.prototype._manageSession = function (req, res, next) {
  res.set('Server', 'Transmission')
  var sessionID = req.get('X-Transmission-Session-Id')
  if (typeof sessionID === 'undefined') {
    this._assignSessionID(res)
  } else {
    res.set('X-Transmission-Session-Id', sessionID)
    next()
  }
}

TransmissionProxy.prototype._processRequest = function (req, res, method, args) {
  var valid = (method === 'torrent-add' &&
    args !== null && typeof args === 'object' &&
    typeof args.filename === 'string')
  if (valid) {
    this.addTorrent(args.filename)
  }
  res.json({success: valid})
}

TransmissionProxy.prototype._handleError = function (err) {
  this.emit('error', {
    error: err
  })
}

module.exports = TransmissionProxy
