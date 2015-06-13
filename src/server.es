#!/usr/bin/env node

'use strict'

import './lib/newrelic'
import Q from 'q'
import express from 'express'
import logfmt from 'logfmt'
import timeago from 'timeago'
import fs from 'fs'
import path from 'path'
import TransmissionProxy from './transmission-proxy'

const root = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')))
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json')))
const address = process.env.OPENSHIFT_IOJS_IP ||
  process.env.OPENSHIFT_NODEJS_IP
const port = process.env.OPENSHIFT_IOJS_PORT ||
  process.env.OPENSHIFT_NODEJS_PORT ||
  process.env.PORT ||
  8080

const app = express()
const proxy = new TransmissionProxy(config)
const status = {}

app.use(logfmt.requestLogger())
app.set('views', path.join(root, 'views'))
app.set('view engine', 'jade')
app.locals.version = pkg.version
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

proxy.on('processingQueue', () => status.queueProcessingStarted = new Date())

proxy.on('processedQueue', () => {
  var now = new Date()
  status.queueProcessingTime = now - status.queueProcessingStarted
  status.queueProcessingStarted = null
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

app.listen(port, address, () => logfmt.log({action: 'start', port, address}))
