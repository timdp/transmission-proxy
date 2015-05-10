'use strict'

var pg = require('pg')
var Q = require('q')
var logfmt = require('logfmt')

module.exports = function () {
  var config = this.config

  var connect = function () {
    var url = process.env.OPENSHIFT_POSTGRESQL_DB_URL ||
      process.env.DATABASE_URL ||
      config.database_url
    logfmt.log({
      action: 'connect',
      database_url: url
    })
    return Q.ninvoke(pg, 'connect', url)
  }

  var query = function (sql, params) {
    logfmt.log({
      action: 'query',
      query: sql,
      params: params
    })
    var onDone = null
    return connect()
      .spread(function (client, done) {
        onDone = done
        var args = [sql]
        if (params && params.length) {
          args.push(params)
        }
        return Q.npost(client, 'query', args)
      })
      .then(function (res) {
        onDone()
        return res.rows
      })
  }

  var getQueue = function () {
    var sql = 'SELECT filename FROM queue'
    return query(sql)
      .then(function (rows) {
        return rows.map(function (row) {
          return row.filename
        })
      })
  }

  var enqueue = function (filename) {
    var sql = 'INSERT INTO queue (filename) VALUES ($1)'
    return query(sql, [filename])
  }

  var dequeue = function (filenames) {
    if (!filenames.length) {
      return
    }
    var ph = filenames.map(function (filename, idx) {
      return '$' + (idx + 1)
    }).join(',')
    var sql = 'DELETE FROM queue WHERE filename IN (' + ph + ')'
    return query(sql, filenames)
  }

  return {
    getQueue: getQueue,
    enqueue: enqueue,
    dequeue: dequeue
  }
}
