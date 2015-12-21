'use strict'

import {VAL, ERR} from './Constants'
import * as Sources from './Sources'

/**
 * Provides specialized Stream and Property constructors.
 */

export function value(data) {
  return new Sources.Constant(VAL, data)
}

export function error(data) {
  return new Sources.Constant(ERR, data)
}

export function never() {
  return new Sources.Constant
}

export function later(delay, data) {
  return new Sources.Callback(function() {
    setTimeout(() => this.val(data).end(), delay)
  })
}

export function interval(delay, data) {
  return new Sources.Timed(function() {
    this.val(data)
  }, delay)
}

export function poll(delay, fn) {
  return new Sources.Timed(function() {
    this.val(fn())
  }, delay)
}

export function sequentially(delay, data) {
  if(!(data = data.slice()).length) return never()
  else return new Sources.Timed(function() {
    this.val(data.shift())
    if(data.length === 0)
      this.end()
  }, delay)
}

export function fromCallback(fn) {
  return new Sources.Callback(function() {
    fn(data => this.val(data).end())
  })
}

export function fromNodeCallback(fn) {
  return new Sources.Callback(function() {
    fn((e, v) => {
      if(e) this.err(e).end()
      else this.val(v).end()
    })
  })
}

export function fromEvents(target, name) {
  return new Sources.Events(target, name)
}