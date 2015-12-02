'use strict'

import Stream from './src/Stream'
import Property from './src/Property'
import * as Constructors from './src/Constructors'

/**
 * Provides the top-level library API.
 */
var Narly = {
  Stream: Stream,
  Property: Property
}

Object.assign(Narly, Constructors)

module.exports = Narly