'use strict'

import clone from 'clone'

class InMemoryStorage {
  constructor () {
    this._queue = []
    this._counter = 0
  }
  getQueue () {
    return clone(this._queue)
  }
  enqueue (filename) {
    this._queue.push({
      id: ++this._counter,
      filename: filename,
      time: new Date()
    })
  }
  dequeue (ids) {
    for (let id of ids) {
      let j = 0
      while (j < this._queue.length && this._queue[j].id !== id) {
        ++j
      }
      if (j < this._queue.length) {
        this._queue.splice(j, 1)
      }
    }
  }
}

export default InMemoryStorage
