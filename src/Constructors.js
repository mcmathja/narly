'use strict'

import Stream from './Stream'
import Property from './Property'

/**
 * Provides specialized Stream and Property constructors.
 */

export function constant(data) {
  return new Property(undefined, undefined, () => data).end()
}

export function never() {
  return (new Stream).end()
}

export function later(wait, data) {
  let S = new Stream
  setTimeout(() => { S.val(data).end() }, wait)
  return S
}

export function interval(intv, data) {
  let S = new Stream
  setInterval(() => { S.val(data) }, intv)
  return S
}

export function sequentially(intv, data) {
  if(!data.length) return Narly.never()
  let events = data.slice(), S = new Stream
  var interval = setInterval(() => {
    if(events.length === 1) {
      clearInterval(interval)
      S.val(events.shift()).end()
    } else S.val(events.shift())
  }, intv)
  return S
}

export function fromPoll(intv, fn) {
  let S = new Stream
  setInterval(() => S.val(fn()), intv)
  return S
}

export function fromCallback(fn) {
  let S = new Stream
  fn(data => S.val(data).end())
  return S
}

export function fromNodeCallback(fn) {
  let S = new Stream
  fn((e, v) => {
    if(error) S.err(e).end()
    else S.val(v).end()
  })
  return S
}

export function fromEvents(target, name) {
  let S = new Stream
  if(target.addEventListener)
    target.addEventListener(name, e => S.val(e))
  else if(target.on)
    target.on(name, e => S.val(e))
  return S
}