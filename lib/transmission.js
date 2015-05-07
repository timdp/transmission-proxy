'use strict'

var Transmission = require('transmission')
var Q = require('q')
var logfmt = require('logfmt')

module.exports = function () {
  var config = this.config

  var transmission = new Transmission(config.transmission)
  var addUrl = Q.nbind(transmission.addUrl, transmission)

  var add = function (filename) {
    logfmt.log({
      action: 'add',
      filename: filename
    })
    return addUrl(filename, {
      paused: config.add_paused
    })
  }

  var addAll = function (filenames, onSuccess) {
    return filenames.reduce(function (promise, filename) {
      return promise
        .then(function () {
          return add(filename)
            .fail(function (err) {
              throw new Error('Failed to add "' + filename + '": ' + err)
            })
        })
        .then(function () {
          logfmt.log({
            result: 'added',
            filename: filename
          })
          if (typeof onSuccess === 'function') {
            onSuccess.call(null, filename)
          }
        })
    }, Q())
  }

  return {
    add: add,
    addAll: addAll
  }
}
