'use strict'

import Transmission from 'transmission'
import Q from 'q'

class TransmissionFacade {
  constructor (config) {
    this._config = config
    const transmission = new Transmission(config.transmission)
    this._addUrl = Q.nbind(transmission.addUrl, transmission)
  }
  add (filename) {
    return this._addUrl(filename, {paused: this._config.add_paused})
  }
  addAll (records, notify) {
    return records.reduce((promise, record) => {
      return promise.then(() => this.add(record.filename))
        .then(() => notify.call(null, null, record))
        .then(err => notify.call(null, err, record))
    }, Q())
  }
}

export default TransmissionFacade
