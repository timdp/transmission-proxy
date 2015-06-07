#!/bin/env node

'use strict'

if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic')
}

import Q from 'q'
import express from 'express'
import logfmt from 'logfmt'
import timeago from 'timeago'
import fs from 'fs'
import path from 'path'
import TransmissionProxy from './'

const ROOT = path.resolve(__dirname, '..')
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json')))
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json')))
const ADDRESS = process.env.OPENSHIFT_IOJS_IP ||
  process.env.OPENSHIFT_NODEJS_IP
const PORT = process.env.OPENSHIFT_IOJS_PORT ||
  process.env.OPENSHIFT_NODEJS_PORT ||
  process.env.PORT ||
  8080

let status = {}
let queueProcessingStarted = null

let app = express()
let proxy = new TransmissionProxy(CONFIG)

app.use(logfmt.requestLogger())
app.set('views', path.join(ROOT, 'views'))
app.set('view engine', 'jade')
app.locals.version = PACKAGE.version
app.locals.timeago = timeago

app.get('/', (req, res) => res.render('index'))

app.get('/ping', (req, res) => res.set('Content-Type', 'text/plain').send('OK'))

app.get('/status', proxy.authenticate, (req, res, next) => {
  Q.invoke(proxy, 'getQueue')
    .then(queue => res.render('status', {status: status, queue: queue}))
    .fail(next)
})

proxy.on('addingTorrent', data => {
  status.lastAdd = {
    time: new Date(),
    filename: data.filename
  }
  logfmt.log({
    action: 'enqueue',
    filename: data.filename
  })
})

proxy.on('addedTorrent', data => {
  logfmt.log({
    action: 'added',
    filename: data.filename
  })
})

proxy.on('processingQueue', () => queueProcessingStarted = new Date())

proxy.on('processedQueue', () => {
  var now = new Date()
  status.queueProcessingTime = now - queueProcessingStarted
  queueProcessingStarted = null
})

proxy.on('error', (data) => {
  status.lastError = {
    time: new Date(),
    error: data.error
  }
  logfmt.error(data.error)
})

app.use(proxy.router)

status.startTime = new Date()

app.listen(PORT, ADDRESS, () => {
  logfmt.log({
    action: 'start',
    port: PORT,
    address: ADDRESS
  })
})
