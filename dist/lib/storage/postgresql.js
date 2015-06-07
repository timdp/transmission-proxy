'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

_Object$defineProperty(exports, '__esModule', {
  value: true
});

var _pg = require('pg');

var _pg2 = _interopRequireDefault(_pg);

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var PostgresqlStorage = (function () {
  function PostgresqlStorage(config) {
    _classCallCheck(this, PostgresqlStorage);

    this._config = config;
  }

  _createClass(PostgresqlStorage, [{
    key: 'getQueue',
    value: function getQueue() {
      return this._query('SELECT "id", "filename", "time" FROM "queue"');
    }
  }, {
    key: 'enqueue',
    value: function enqueue(filename) {
      return this._query('INSERT INTO "queue" ("filename", "time") VALUES ($1, NOW())', [filename]);
    }
  }, {
    key: 'dequeue',
    value: function dequeue(ids) {
      if (!ids.length) {
        return;
      }
      var ph = ids.map(function (id, idx) {
        return '$' + (idx + 1);
      }).join(',');
      return this._query('DELETE FROM "queue" WHERE "id" IN (' + ph + ')', ids);
    }
  }, {
    key: '_query',
    value: function _query(sql, params) {
      var onDone = null;
      return this._connect().spread(function (client, _onDone) {
        onDone = _onDone;
        var args = [sql];
        if (params && params.length) {
          args.push(params);
        }
        return _q2['default'].npost(client, 'query', args);
      }).then(function (res) {
        onDone();
        return res.rows;
      });
    }
  }, {
    key: '_connect',
    value: function _connect() {
      var url = process.env.OPENSHIFT_POSTGRESQL_DB_URL || process.env.DATABASE_URL || this._config.storage.postgresql.database_url;
      return _q2['default'].ninvoke(_pg2['default'], 'connect', url);
    }
  }]);

  return PostgresqlStorage;
})();

exports['default'] = PostgresqlStorage;
module.exports = exports['default'];