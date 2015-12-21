'use strict'

import {VAL, ERR, END, ANY} from './Constants'
import * as SideEffects from './SideEffects'

/**
 * An Observable receives and emits events, optionally with transformations.
 */

export default class Observable {
  constructor(transformers, producers) {
    let tforms = transformers || {}
    this.val = tforms.val || this.emitVal
    this.err = tforms.err || this.emitErr
    this.end = tforms.end || this.emitEnd
    this.producers = producers || []
    this.consumers = []
    this.sideEffects = { [VAL]: [], [ERR]: [], [END]: [], [ANY]: [] }
    this.ended = this.active = false
  }

  // Emitters

  emitVal(d, c) {
    for(let i = 0, l = this.consumers.length; i < l; ++i)
      this.consumers[i].val(d, this)
    return this
  }

  emitErr(d, c) {
    for(let i = 0, l = this.consumers.length; i < l; ++i)
      this.consumers[i].err(d, this)
    return this
  }

  emitEnd() {
    this.ended = true
    this.active = false
    for(let i = 0, l = this.producers.length; i < l; ++i)
      this.producers[i].deactivate(this)
    for(let i = 0, l = this.consumers.length; i < l; ++i)
      this.consumers[i].end(this)
    return this
  }

  // Activation / Deactivation

  activate(that) {
    if(!this.ended) {
      this.consumers.push(that)
      if(!this.active) {
        this.active = true
        for(let i = 0, l = this.producers.length; i < l; ++i)
          this.producers[i].activate(this)
      }
    } else that.end()
  }

  deactivate(that) {
    this.consumers.splice(this.consumers.indexOf(that), 1)
    if(this.consumers.length === 0) {
      for(let i = 0, l = this.producers.length; i < l; ++i)
          this.producers[i].deactivate(this)
      this.active = false
    }
  }

  // Subscription

  on(type, fn) {
    let se
    switch(type) {
      case VAL: se = new SideEffects.OnVal(fn); break
      case ERR: se = new SideEffects.OnErr(fn); break
      case END: se = new SideEffects.OnEnd(fn); break
      case ANY: se = new SideEffects.OnAny(fn); break
      default: throw new Error('Invalid SideEffect type.')
    }

    this.sideEffects[type].push(se)
    this.activate(se, true)
    return this
  }

  off(type, fn) {
    let idx = this.sideEffects[type].map(c => c.fn).indexOf(fn)

    if(idx > -1) {
      let se = this.sideEffects[type].splice(idx, 1)
      this.deactivate(se)
    }
    return this
  }

  // Fluent interface for applying transformations.

  map(fn) {
    return this.extend({
      val: function(d, p, c) {
        this.emitVal(fn(d), c)
      }
    })
  }

  filter(fn) {
    return this.extend({
      val: function(d, p, c) {
        if(fn(d)) this.emitVal(d, c)
      }
    })
  }

  take(n) {
    return this.extend({
      val: function(d, p, c) {
        if(--n > 0) this.emitVal(d, c)
        else this.emitVal(d, c).emitEnd()
      }
    })
  }

  takeWhile(fn) {
    return this.extend({
      val: function(d, p, c) {
        if(fn(d)) this.emitVal(d, c)
        else this.emitEnd()
      }
    })
  }

  last() {
    let data, curr
    return this.extend({
      val: function(d, p, c) {
        data = d
        curr = c
      },
      end: function(p) {
        if(curr !== undefined)
          this.emitVal(data, curr).emitEnd()
      }
    })
  }

  skip(n) {
    return this.extend({
      val: function(d, p, c) {
        if(--n > 0) this.emitVal(d, c)
      }
    })
  }

  skipWhile(n) {
    let done = false
    return this.extend({
      val: function(d, p, c) {
        if(done || (done = !fn(d)))
          this.emitVal(d, c)
      }
    })
  }

  skipDuplicates() {
    let data
    return this.extend({
      val: function(d, p, c) {
        if(d !== data) {
          data = d
          this.emitVal(d, c)
        }
      }
    })
  }

  diff(fn, seed) {
    let data = seed
    return this.extend({
      val: function(d, p, c) {
        if(data !== undefined)
          this.emitVal(fn(data, data = d), c)
        else data = d
      }
    })
  }

  scan(fn, seed) {
    let data = seed
    return this.extend({
      val: function(d, p, c) {
        if(data !== undefined)
          this.emitVal(data = fn(data, d), c)
      }
    })
  }

  flatten(fn) {
    return this.extend({
      val: function(d, p, c) {
        for(let i = 0, l = d.length; i < l; ++i)
          this.emitVal(d[i], c)
      }
    })
  }

  onValue(fn) {
    return this.on(VAL, fn)
  }

  onError(fn) {
    return this.on(ERR, fn)
  }

  onEnd(fn) {
    return this.on(END, fn)
  }

  onAny(fn) {
    return this.on(ANY, fn)
  }

  offValue(fn) {
    return this.off(VAL, fn)
  }

  offError(fn) {
    return this.off(ERR, fn)
  }

  offEnd(fn) {
    return this.off(END, fn)
  }

  offAny(fn) {
    return this.off(ANY, fn)
  }
}