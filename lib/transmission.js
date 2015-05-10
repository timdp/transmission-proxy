'use strict'

var Transmission = require('transmission')
var Q = require('q')

module.exports = function () {
  var config = this.config

  var transmission = new Transmission(config.transmission)
  var addUrl = Q.nbind(transmission.addUrl, transmission)

  var add = function (filename) {
    return addUrl(filename, {
      paused: config.add_paused
    })
  }

  var addAll = function (records, notify) {
    return records.reduce(function (promise, record) {
      return promise
        .then(function () {
          return add(record.filename)
        })
        .then(function () {
          notify.call(null, null, record)
        }, function (err) {
          notify.call(null, err, record)
        })
    }, Q())
  }

  return {
    add: add,
    addAll: addAll
  }
}
