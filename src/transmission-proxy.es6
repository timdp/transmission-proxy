'use strict'

import System from 'es6-micro-loader'
import Q from 'q'
import {Router} from 'express'
import bodyParser from 'body-parser'
import auth from 'http-auth'
import randomstring from 'randomstring'
import defaults from 'defaults'
import {EventEmitter} from 'events'
import path from 'path'
import TransmissionFacade from './lib/transmission-facade'

const defaultConfig = {
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

class TransmissionProxy extends EventEmitter {
  constructor (config) {
    super()
    this._router = Router()
    this._processingQueue = false
    this._retryTimeout = null
    this._config = defaults(config, defaultConfig)
    this._transmission = new TransmissionFacade(this._config)
    this._initStorage()
    this._initAuth()
    this._configureRoutes()
  }
  get router () {
    return this._router
  }
  get authenticate () {
    return this._authenticate
  }
  addTorrent (filename) {
    this.emit('addingTorrent', {filename})
    return this._storage
      .then(storage => Q.invoke(storage, 'enqueue', filename))
      .catch(err => this._handleError(err))
      .then(() => this.processQueue())
  }
  getQueue () {
    return this._storage.then(storage => storage.getQueue())
  }
  processQueue () {
    if (this._retryTimeout !== null) {
      clearTimeout(this._retryTimeout)
      this._retryTimeout = null
    }
    if (this._processingQueue) {
      return
    }
    this._processingQueue = true
    this.emit('processingQueue')
    const succeeded = []
    const notify = (err, record) => {
      if (err) {
        this._handleError(new Error(`Failed to add "${record.filename}": ${err}`))
      } else {
        this.emit('addedTorrent', {filename: record.filename})
        succeeded.push(record.id)
      }
    }
    Q.invoke(this, 'getQueue')
      .then(queue => this._transmission.addAll(queue, notify))
      .catch(err => this._handleError(err))
      .then(() => this._storage)
      .then(storage => Q.invoke(storage, 'dequeue', succeeded))
      .catch(err => this._handleError(err))
      .then(() => {
        this.emit('processedQueue')
        this._processingQueue = false
        this._retryTimeout = setTimeout(() => this.processQueue(),
          this._config.retry_after * 1000)
      })
  }
  _initStorage () {
    const type = this._config.storage.type
    const modPath = path.resolve(__dirname, 'lib', 'storage', type)
    this.emit('loadingStorage', {type})
    this._storage = System.import(modPath)
      .then(S => new S(this._config))
      .then(storage => {
        this.emit('loadedStorage', {type, storage})
        return storage
      })
  }
  _initAuth () {
    this._authenticate = auth.connect(auth.basic(
      {realm: 'Transmission'},
      (username, password, callback) => {
        callback(username === this._config.username &&
          password === this._config.password)
      }))
  }
  _configureRoutes () {
    this._router.get(this._config.transmission.url,
      this._authenticate,
      (req, res, next) => this._manageSession(req, res, next),
      (req, res) => {
        this._processRequest(req, res, req.params.method, req.params)
      })
    this._router.post(this._config.transmission.url,
      this._authenticate,
      (req, res, next) => this._manageSession(req, res, next),
      bodyParser.json({type: '*/*'}),
      (req, res) => {
        this._processRequest(req, res, req.body.method, req.body.arguments)
      })
  }
  _assignSessionID (res) {
    let sessionID = randomstring.generate(48)
    res.status(409)
      .set('X-Transmission-Session-Id', sessionID)
      .set('Content-Type', 'text/html; charset=ISO-8859-1')
      .send('<h1>409: Conflict</h1>' +
        `<p><code>X-Transmission-Session-Id: ${sessionID}</code></p>`)
  }
  _manageSession (req, res, next) {
    res.set('Server', 'Transmission')
    let sessionID = req.get('X-Transmission-Session-Id')
    if (typeof sessionID === 'undefined') {
      this._assignSessionID(res)
    } else {
      res.set('X-Transmission-Session-Id', sessionID)
      next()
    }
  }
  _processRequest (req, res, method, args) {
    let valid = (method === 'torrent-add' &&
      args !== null && typeof args === 'object' &&
      typeof args.filename === 'string')
    if (valid) {
      this.addTorrent(args.filename)
    }
    res.json({success: valid})
  }
  _handleError (error) {
    this.emit('error', {error})
  }
}

export default TransmissionProxy
