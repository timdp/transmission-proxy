'use strict'

var pg = require('pg')
var Q = require('q')

module.exports = function () {
  var config = this.config

  var connect = function () {
    var url = process.env.OPENSHIFT_POSTGRESQL_DB_URL ||
      process.env.DATABASE_URL ||
      config.storage.postgresql.database_url
    return Q.ninvoke(pg, 'connect', url)
  }

  var query = function (sql, params) {
    var onDone = null
    return connect()
      .spread(function (client, _onDone) {
        onDone = _onDone
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
    var sql = 'SELECT "id", "filename", "time" FROM "queue"'
    return query(sql)
  }

  var enqueue = function (filename) {
    var sql = 'INSERT INTO "queue" ("filename", "time") VALUES ($1, NOW())'
    return query(sql, [filename])
  }

  var dequeue = function (ids) {
    if (!ids.length) {
      return
    }
    var ph = ids.map(function (id, idx) {
      return '$' + (idx + 1)
    }).join(',')
    var sql = 'DELETE FROM "queue" WHERE "id" IN (' + ph + ')'
    return query(sql, ids)
  }

  return {
    getQueue: getQueue,
    enqueue: enqueue,
    dequeue: dequeue
  }
}
