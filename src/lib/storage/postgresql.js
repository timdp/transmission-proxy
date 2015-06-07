'use strict'

import pg from 'pg'
import Q from 'q'

class PostgresqlStorage {
  constructor (config) {
    this._config = config
  }
  getQueue () {
    return this._query('SELECT "id", "filename", "time" FROM "queue"')
  }
  enqueue (filename) {
    return this._query(
      'INSERT INTO "queue" ("filename", "time") VALUES ($1, NOW())',
      [filename])
  }
  dequeue (ids) {
    if (!ids.length) {
      return
    }
    const ph = ids.map((id, idx) => '$' + (idx + 1)).join(',')
    return this._query(`DELETE FROM "queue" WHERE "id" IN (${ph})`, ids)
  }
  _query (sql, params) {
    let onDone = null
    return this._connect()
      .spread((client, _onDone) => {
        onDone = _onDone
        let args = [sql]
        if (params && params.length) {
          args.push(params)
        }
        return Q.npost(client, 'query', args)
      })
      .then(res => {
        onDone()
        return res.rows
      })
  }
  _connect () {
    const url = process.env.OPENSHIFT_POSTGRESQL_DB_URL ||
      process.env.DATABASE_URL ||
      this._config.storage.postgresql.database_url
    return Q.ninvoke(pg, 'connect', url)
  }
}

export default PostgresqlStorage
