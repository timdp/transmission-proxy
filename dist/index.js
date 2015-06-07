'use strict';

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _get = require('babel-runtime/helpers/get')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

_Object$defineProperty(exports, '__esModule', {
  value: true
});

var _es6MicroLoader = require('es6-micro-loader');

var _es6MicroLoader2 = _interopRequireDefault(_es6MicroLoader);

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var _express = require('express');

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _httpAuth = require('http-auth');

var _httpAuth2 = _interopRequireDefault(_httpAuth);

var _randomstring = require('randomstring');

var _randomstring2 = _interopRequireDefault(_randomstring);

var _defaults = require('defaults');

var _defaults2 = _interopRequireDefault(_defaults);

var _events = require('events');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _libTransmissionFacade = require('./lib/transmission-facade');

var _libTransmissionFacade2 = _interopRequireDefault(_libTransmissionFacade);

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
};

var TransmissionProxy = (function (_EventEmitter) {
  function TransmissionProxy(config) {
    _classCallCheck(this, TransmissionProxy);

    _get(Object.getPrototypeOf(TransmissionProxy.prototype), 'constructor', this).call(this);
    this._router = (0, _express.Router)();
    this._processingQueue = false;
    this._retryTimeout = null;
    this._config = (0, _defaults2['default'])(config, DEFAULT_CONFIG);
    this._transmission = new _libTransmissionFacade2['default'](this._config);
    this._initStorage();
    this._initAuth();
    this._configureRoutes();
  }

  _inherits(TransmissionProxy, _EventEmitter);

  _createClass(TransmissionProxy, [{
    key: 'addTorrent',
    value: function addTorrent(filename) {
      var _this = this;

      this.emit('addingTorrent', { filename: filename });
      return this._storage.then(function (storage) {
        return _q2['default'].invoke(storage, 'enqueue', filename);
      })['catch'](function (err) {
        return _this._handleError(err);
      }).then(function () {
        return _this.processQueue();
      });
    }
  }, {
    key: 'getQueue',
    value: function getQueue() {
      return this._storage.then(function (storage) {
        return storage.getQueue();
      });
    }
  }, {
    key: 'processQueue',
    value: function processQueue() {
      var _this2 = this;

      if (this._retryTimeout !== null) {
        clearTimeout(this._retryTimeout);
        this._retryTimeout = null;
      }
      if (this._processingQueue) {
        return;
      }
      this._processingQueue = true;
      this.emit('processingQueue');
      var succeeded = [];
      var notify = function notify(err, record) {
        if (err) {
          _this2._handleError(new Error('Failed to add "' + record.filename + '": ' + err));
        } else {
          _this2.emit('addedTorrent', { filename: record.filename });
          succeeded.push(record.id);
        }
      };
      _q2['default'].invoke(this, 'getQueue').then(function (queue) {
        return _this2._transmission.addAll(queue, notify);
      })['catch'](function (err) {
        return _this2._handleError(err);
      }).then(function () {
        return _this2._storage;
      }).then(function (storage) {
        return _q2['default'].invoke(storage, 'dequeue', succeeded);
      })['catch'](function (err) {
        return _this2._handleError(err);
      }).then(function () {
        _this2.emit('processedQueue');
        _this2._processingQueue = false;
        _this2._retryTimeout = setTimeout(function () {
          return _this2.processQueue();
        }, _this2._config.retry_after * 1000);
      });
    }
  }, {
    key: '_initStorage',
    value: function _initStorage() {
      var _this3 = this;

      var type = this._config.storage.type;
      var modPath = _path2['default'].resolve(__dirname, 'lib', 'storage', type);
      this.emit('loadingStorage', { type: type });
      this._storage = _es6MicroLoader2['default']['import'](modPath).then(function (S) {
        return new S(_this3._config);
      }).then(function (storage) {
        _this3.emit('loadedStorage', { type: type, storage: storage });
        return storage;
      });
    }
  }, {
    key: '_initAuth',
    value: function _initAuth() {
      var _this4 = this;

      this._authenticate = _httpAuth2['default'].connect(_httpAuth2['default'].basic({ realm: 'Transmission' }, function (username, password, callback) {
        callback(username === _this4._config.username && password === _this4._config.password);
      }));
    }
  }, {
    key: '_configureRoutes',
    value: function _configureRoutes() {
      var _this5 = this;

      this._router.get(this._config.transmission.url, this._authenticate, function (req, res, next) {
        return _this5._manageSession(req, res, next);
      }, function (req, res) {
        _this5._processRequest(req, res, req.params.method, req.params);
      });
      this._router.post(this._config.transmission.url, this._authenticate, function (req, res, next) {
        return _this5._manageSession(req, res, next);
      }, _bodyParser2['default'].json({ type: '*/*' }), function (req, res) {
        _this5._processRequest(req, res, req.body.method, req.body.arguments);
      });
    }
  }, {
    key: '_assignSessionID',
    value: function _assignSessionID(res) {
      var sessionID = _randomstring2['default'].generate(48);
      res.status(409).set('X-Transmission-Session-Id', sessionID).set('Content-Type', 'text/html; charset=ISO-8859-1').send('<h1>409: Conflict</h1>' + ('<p><code>X-Transmission-Session-Id: ' + sessionID + '</code></p>'));
    }
  }, {
    key: '_manageSession',
    value: function _manageSession(req, res, next) {
      res.set('Server', 'Transmission');
      var sessionID = req.get('X-Transmission-Session-Id');
      if (typeof sessionID === 'undefined') {
        this._assignSessionID(res);
      } else {
        res.set('X-Transmission-Session-Id', sessionID);
        next();
      }
    }
  }, {
    key: '_processRequest',
    value: function _processRequest(req, res, method, args) {
      var valid = method === 'torrent-add' && args !== null && typeof args === 'object' && typeof args.filename === 'string';
      if (valid) {
        this.addTorrent(args.filename);
      }
      res.json({ success: valid });
    }
  }, {
    key: '_handleError',
    value: function _handleError(error) {
      this.emit('error', { error: error });
    }
  }, {
    key: 'router',
    get: function () {
      return this._router;
    }
  }, {
    key: 'authenticate',
    get: function () {
      return this._authenticate;
    }
  }]);

  return TransmissionProxy;
})(_events.EventEmitter);

exports['default'] = TransmissionProxy;
module.exports = exports['default'];