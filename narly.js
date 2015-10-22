/**
 * An Event represents a data point in a stream.
 */

class Event {
  constructor(type, value) {
    this.type = type
    this.value = value
  }

  copy(value) {
    return new Event(this.type, value)
  }
}

const VALUE = 0, ERROR = 1, END = 2,
      ANY = new Set([VALUE, ERROR, END]),
      DONE = new Event(END)



/**
 * A SideEffect extracts values from a stream,
 * but does not affect its flow.
 */

class SideEffect {
  constructor(type, fn) {
    this.type = type
    this.fn = fn
  }

  execute(event) {
    if(this.type === event.type
      || (this.type instanceof Set && this.type.has(event.type)))
      this.fn(event.value)
  }
}



/**
 * A Stream represents a set of operations applied
 * to a series of time-ordered data points.
 */

class Stream {
  constructor(transform = ((e, p) => e), producers = []) {
    this.transform = transform
    this.producers = new Set(producers)
    this.consumers = new Set
    this.sideeffects = new Map([[VALUE, new Map], [ERROR, new Map], [END, new Map]])
    this.ended = this.active = this.last = false
  }

  activate(that, cached) {
    if(cached && this.last instanceof Event)
      that.execute(this.last, this)

    if(!this.ended) {
      this.consumers.add(that)
      if(!this.active) {
        this.active = true
        this.producers.forEach(p => p.activate(this,
          this.last ? false : (this.last = cached)))
      }
    } else that.execute(DONE, this)
  }

  deactivate(that) {
    this.consumers.delete(that)
    if(this.consumers.size === 0) {
      this.producers.forEach(p => p.deactivate(this))
      this.active = false
    }
  }

  execute(event, producer) {
    if(event instanceof Array)
      return event.forEach(e => this.execute(e, producer))

    let result
    try {
      result = this.transform(event, producer)
    } catch(e) {
      result = new Event(ERROR, e)
    }
    
    if(result instanceof Event)
      this.emit(result)
    else if(result instanceof Array)
      result.forEach(result => this.emit(result))
  }

  emit(result) {
    if(result === DONE) {
      this.ended = true
      this.active = false
      this.producers.forEach(p => p.deactivate(this))
    } else this.last = result

    this.consumers.forEach(c => c.execute(result, this))
  }

  // Side effects

  on(type, fn, cached = false) {
    let sideEffect = new SideEffect(type, fn),
        store = this.sideeffects.get(type)

    if(store.get(fn)) store.get(fn).add(sideEffect)
    else store.set(fn, new Set([sideEffect]))
    this.activate(sideEffect, cached)

    return this
  }

  off(type, fn) {
    let store = this.sideeffects.get(type),
        set = store.get(fn), sideEffect

    if(sideEffect = set && set.values().next().value) {
      set.delete(sideEffect)
      if(!set.size) store.delete(fn)
      this.deactivate(sideEffect)
    }

    return this
  }

  // Transformations

  static extend(producers, type, op) {
    let transform
    if(typeof type === 'number')
      transform = (e, p) => e.type === type ? op(e, p) : e
    else if(type instanceof Set)
      transform = (e, p) => type.has(e.type) ? op(e, p) : e
    else
      transform = (e, p) => op(e, p)
    return new Stream(transform, producers)
  }

  initialize(fn) {
    return new InitializedStream(fn, [this])
  }

  map(fn, type = VALUE) {
    return Stream.extend([this], type, e => e.copy(fn(e.value)))
  }

  filter(fn, type = VALUE) {
    return Stream.extend([this], type, e => fn(e.value) ? e : null)
  }

  take(n, type = VALUE) {
    return Stream.extend([this], type, (e, p) => --n > 0 ? e : [e, DONE])
  }

  takeWhile(fn, type = VALUE) {
    return Stream.extend([this], type, e => fn(e.value) ? e : DONE)
  }

  last(type = VALUE) {
    var prev = null
    return Stream.extend([this], new Set([type, DONE]),
      (e, p) => e === DONE ? [prev, DONE] : (prev = e) && null)
  }

  skip(n, type = VALUE) {
    return Stream.extend([this], type, e => --n < 0 ? e : null)
  }

  skipWhile(fn, type = VALUE) {
    var done = false
    return Stream.extend([this], type,
      e => (done || (done = !fn(e.value))) ? e : null)
  }

  skipDuplicates(fn = (prev, curr) => prev === curr, type = VALUE) {
    var prev = null
    return Stream.extend([this], type,
      e => !prev || !fn(prev.value, e.value) ? prev = e : null)
  }

  diff(fn = (a, b) => [a, b], seed = undefined, type = VALUE) {
    var prev = seed === undefined ? null : new Event(type, seed)
    return Stream.extend([this], type, e => {
      if(prev) return new Event(type, fn(prev.value, (prev = e).value))
      else prev = e
    })
  }

  scan(){}
  flatten(){}
  delay(){}
  throttle(){}
  debounce(){}
  ignore(){}
  before(){}
  slidingWindow(){}
  bufferWhile(){}



  combine(that, fn, type = VALUE) {
    let a, b
    return Stream.extend([this, that], new Set([type, END]), (e, p) => {
      if(p === this && e.type === type) a = e
      if(p === that && e.type === type) b = e

      if(this.ended && that.ended) return DONE
      else if(a && b) return e.copy(fn(a.value, b.value))
    })
  }

  /* -- TO IMPLEMENT --

  zip(){}
  merge(){}
  concat(){}
  flatMap(){}
  flatMapLatest(){}
  flatMapFirst(){}
  flatMapConcat(){}
  flatMapConcurLimit(){}

  filterBy(){}
  sampledBy(){}
  skipUntilBy(){}
  takeUntilBy(){}
  bufferBy(){}
  bufferWhileBy(){}
  */
}



/**
 * An InitializedStream gains a current value on its first activation.
 */

class InitializedStream extends Stream {
  constructor(initializer, producers) {
    super(e => e, producers)
    this.initializer = initializer
  }

  activate(that, cached) {
    if(!this.last) {
      try {
        this.last = new Event(VALUE, this.initializer())
      } catch(e) {
        this.last = new Event(ERROR, e)
      }
    }
    super.activate(that, cached)
  }
}



/**
 * A Source connects a stream or property to a data source.
 */

class ConstantSource extends InitializedStream {
  constructor(event) {
    super(() => event)
    this.ended = true
  }
}

class CallbackSource extends Stream {
  constructor(fn) {
    super()
    this.fn = fn
    this.fired = false
  }

  activate(that) {
    super.activate(that)
    if(!this.fired) {
      this.fired = true
      this.fn()
    }
  }
}

class EventSource extends Stream {
  constructor(target, eventName, transform) {
    super()
    this.target = target
    this.eventName = eventName
    this.active = false
  }

  activate(that) {
    super.activate(that)
    if(!this.active)
      target.on(this.eventName, this.transform)
    this.active = true
  }

  deactivate(that) {
    super.deactivate(that)
    if(this.consumers.size === 0) {
      target.off(this.eventName)
      this.active = false
    }
  }
}



/**
 * Exposed functionality.
 */

class Narly {
  static constant(value, type = VALUE) {
    return new ConstantSource(new Event(type, value))
  }

  static never() {
    let S = new Stream
    S.execute(DONE)
    return S
  }

  static later(wait, value) {
    return new CallbackSource(function() {
      setTimeout(() => this.execute([new Event(VALUE, value), DONE]), wait)  
    })
  }

  static interval(interval, value) {
    return new CallbackSource(function() {
      setInterval(() => this.execute(new Event(VALUE, value)), interval)
    })
  }

  static sequentially(interval, values) {
    var values = values.slice()
    return new CallbackSource(function() {
      let intv = setInterval(() => {
        if(!values.length) {
          clearInterval(intv)
          this.execute(DONE)
        } else this.execute(new Event(VALUE, values.shift()))
      }, interval)      
    })
  }

  static fromPoll(interval, fn) {
    return new CallbackSource(function() {
      setInterval(() => this.execute(new Event(VALUE, fn())), interval)
    })
  }

  static fromCallback(fn) {
    return new CallbackSource(function() {
      try {
        fn(value => this.execute([new Event(VALUE, value), DONE]))
      } catch(e) {
        this.execute([new Event(ERROR, e), DONE])
      }
    })
  }

  static fromNodeCallback(fn) {
    return new CallbackSource(function() {
      fn((error, value) => {
        if(error) this.execute([new Event(ERROR, error), DONE])
        else this.execute([new Event(VALUE, value), DONE])
      })
    })
  }

  /* -- TO IMPLEMENT --

  static fromPromise(promise) {
    return new CallbackSource(function() {
      promise.then(
          value => this.execute([new Event(VALUE, value), DONE]),
          error => this.execute([new Event(ERROR, value), DONE])
        ).done()
    })
  }
  static fromEvents(){}
  static fromESObservable
  */
}