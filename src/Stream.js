'use strict'

import Observable from './Observable'

/**
 * A Stream discards events after performing any transformations.
 */

export default class Stream extends Observable {
  extend(transformers, producers) {
    return new Stream(transformers, [this].concat(producers || []))
  }
}