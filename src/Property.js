'use strict'

import {VAL, ERR, END} from './Constants'
import Observable from './Observable'

/**
 * A Property retains a current event and reemits it upon activation. 
 */

export default class Property extends Observable {
  constructor(transformers, producers, initializer) {
    super(transformers, producers)
    this.initializer = initializer
    this.current = { type: undefined, data: undefined }
  }

  activate(that) {
    if(this.current.type === undefined && this.initializer) {
      this.current.type = VAL
      this.current.data = this.initializer()
    }

    if(this.current.type !== undefined) {
      switch(this.current.type) {
        case VAL: that.val(this.current.data, this, true); break
        case ERR: that.val(this.current.data, this, true); break
      }
    }

    super.activate(that)
  }

  emitVal(d, c) {
    this.current.type = VAL, this.current.data = d
    super.emitVal(d, c)
  }

  emitErr(d, c) {
    this.current.type = ERR, this.current.data = d
    super.emitErr(d, c)
  }

  extend(transformers, producers) {
    return new Property(transformers, [this].concat(producers || []))
  }
}