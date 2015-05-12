'use strict'

var clone = require('clone')
var Q = require('q')

module.exports = function () {
  var queue = []
  var counter = 0

  var getQueue = function () {
    return Q(clone(queue))
  }

  var enqueue = function (filename) {
    queue.push({
      id: ++counter,
      filename: filename,
      time: new Date()
    })
    return Q()
  }

  var dequeue = function (ids) {
    for (var i = 0; i < ids.length; ++i) {
      var id = ids[i]
      var j = 0
      while (j < queue.length && queue[j].id !== id) {
        ++j
      }
      if (j < queue.length) {
        queue.splice(j, 1)
      }
    }
    return Q()
  }

  return {
    getQueue: getQueue,
    enqueue: enqueue,
    dequeue: dequeue
  }
}
