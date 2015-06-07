'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _getIterator = require('babel-runtime/core-js/get-iterator')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

_Object$defineProperty(exports, '__esModule', {
  value: true
});

var _clone = require('clone');

var _clone2 = _interopRequireDefault(_clone);

var InMemoryStorage = (function () {
  function InMemoryStorage() {
    _classCallCheck(this, InMemoryStorage);

    this._queue = [];
    this._counter = 0;
  }

  _createClass(InMemoryStorage, [{
    key: 'getQueue',
    value: function getQueue() {
      return (0, _clone2['default'])(this._queue);
    }
  }, {
    key: 'enqueue',
    value: function enqueue(filename) {
      this._queue.push({
        id: ++this._counter,
        filename: filename,
        time: new Date()
      });
    }
  }, {
    key: 'dequeue',
    value: function dequeue(ids) {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = _getIterator(ids), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var id = _step.value;

          var j = 0;
          while (j < this._queue.length && this._queue[j].id !== id) {
            ++j;
          }
          if (j < this._queue.length) {
            this._queue.splice(j, 1);
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator['return']) {
            _iterator['return']();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }
  }]);

  return InMemoryStorage;
})();

exports['default'] = InMemoryStorage;
module.exports = exports['default'];