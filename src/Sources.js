'use strict'

import Stream from './Stream'
import Property from './Property'

/**
 * A Constant source is an ended property with optional current data.
 */

export class Constant extends Property {
  constructor(type, data) {
    super()
    this.current.type = type
    this.current.data = data
    this.ended = true
  }
}

/**
 * A Callback source is a Stream that executes a callback once
 * on its first activation.
 */

export class Callback extends Stream {
  constructor(callback) {
    super()
    this.callback = callback
    this.fired = false
  }

  activate(that) {
    super.activate(that)
    if(!this.fired) {
      this.fired = true
      this.callback()
    }
  }
}

/**
 * A Timed source is a Stream that executes a callback
 * at a regular interval while active.
 */

export class Timed extends Stream {
  constructor(callback, delay) {
    super()
    this.callback = callback
    this.delay = delay
  }

  activate(that) {
    super.activate(that)
    if(!this.interval && !this.ended)
      this.interval = setInterval(() => this.callback(), this.delay)
  }

  deactivate(that) {
    super.deactivate(that)
    if(!this.active)
      this.interval = clearInterval(this.interval)
  }

  emitEnd() {
    super.emitEnd()
    this.interval = clearInterval(this.interval)
  }
}

/**
 * An Events source is a Stream that sends a value whenever a provided
 * EventEmitter-like object emits a particular type of event.
 */

export class Events extends Stream {
  constructor(target, name) {
    super()
    this.target = target
    this.name = name
    this.listening = false
    this.execute = (data) => { this.val(data) }
    this.add = target.on
      || target.addListener
      || target.addEventListener
    this.rem = target.off
      || target.removeListener
      || target.removeEventListener
  }

  activate(that) {
    super.activate(that)
    if(this.active && !this.listening) {
      this.listening = true
      this.add.call(this.target, this.name, this.execute)
    }
  }

  deactivate(that) {
    super.deactivate(that)
    if(!this.active && this.listening) {
      this.listening = false
      this.rem.call(this.target, this.name, this.execute)
    }
  }
}