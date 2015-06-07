'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

_Object$defineProperty(exports, '__esModule', {
  value: true
});

var _transmission = require('transmission');

var _transmission2 = _interopRequireDefault(_transmission);

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var TransmissionFacade = (function () {
  function TransmissionFacade(config) {
    _classCallCheck(this, TransmissionFacade);

    this._config = config;
    var transmission = new _transmission2['default'](config.transmission);
    this._addUrl = _q2['default'].nbind(transmission.addUrl, transmission);
  }

  _createClass(TransmissionFacade, [{
    key: 'add',
    value: function add(filename) {
      return this._addUrl(filename, { paused: this._config.add_paused });
    }
  }, {
    key: 'addAll',
    value: function addAll(records, notify) {
      var _this = this;

      return records.reduce(function (promise, record) {
        return promise.then(function () {
          return _this.add(record.filename);
        }).then(function () {
          return notify.call(null, null, record);
        }).then(function (err) {
          return notify.call(null, err, record);
        });
      }, (0, _q2['default'])());
    }
  }]);

  return TransmissionFacade;
})();

exports['default'] = TransmissionFacade;
module.exports = exports['default'];