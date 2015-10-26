/**
 * An Event represents a data point in a stream.
 */

class Event {
  constructor(type, value, current = false) {
    this.type = type
    this.value = value
    this.current = current
  }

  copy(value) {
    return new Event(this.type, value, this.current)
  }

  cached() {
    return new Event(this.type, this.value, true)
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
    if(this.type === event.type)
      this.fn(event.value)
  }
}



/**
 * A Stream represents a set of operations applied
 * to a series of time-ordered data points.
 */

class Stream {
  constructor(producers = [], transform = (e, p) => e) {
    this.transform = transform
    this.producers = new Set(producers)
    this.consumers = new Set
    this.sideeffects = new Map([[VALUE, new Map], [ERROR, new Map], [END, new Map]])
    this.ended = this.active = this.current = false
  }

  activate(that) {
    if(!this.ended) {
      this.consumers.add(that)
      if(!this.active) {
        this.active = true
        this.producers.forEach(p => p.activate(this))
      }
    } else that.execute(DONE, this)
  }

  deactivate(that) {
    this.consumers.delete(that)
    if(this.consumers.size === 0) {
      this.producers.forEach(p => p.deactivate(this))
      this.active = this.current = false
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
    } else this.current = result.cached()

    this.consumers.forEach(c => c.execute(result, this))
  }

  // Side effects

  on(type, fn, emitLast) {
    let sideEffect = new SideEffect(type, fn),
        store = this.sideeffects.get(type)

    if(store.get(fn)) store.get(fn).add(sideEffect)
    else store.set(fn, new Set([sideEffect]))

    this.activate(sideEffect)
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

  // Type juggling

  toProperty(fn) {
    return new Property([this], e => e.current ? null : e, () => {
      try {
        return new Event(VALUE, fn(), true)
      } catch(e) {
        return new Event(ERROR, e, true)
      }
    })
  }

  toStream() {
    return new Stream([this], e => e.current ? null : e)
  }

  extend(op, type = new Set([VALUE]), producers = []) {
    return new this.constructor([this].concat(producers), function(e, p) {
      return type.has(e.type) ? op.call(this, e, p) : e
    })
  }

  // Transformations

  map(fn, type) {
    return this.extend(e => e.copy(fn(e.value)), type)
  }

  filter(fn, type) {
    return this.extend(e => fn(e.value) ? e : null, type)
  }

  take(n, type) {
    return this.extend(e => --n > 0 ? e : [e, DONE], type)
  }

  takeWhile(fn, type) {
    return this.extend(e => fn(e.value) ? e : DONE, type)
  }

  last(type = new Set([VALUE])) {
    var prev = null
    return this.extend(e => {
      if(e === DONE) return [prev, DONE]
      else prev = e
    }, new Set([...type, END]))
  }

  skip(n, type) {
    return this.extend(e => --n < 0 ? e : null, type)
  }

  skipWhile(fn, type) {
    var done = false
    return this.extend(e => done || (done = !fn(e.value)) ? e : null, type)
  }

  skipDuplicates(fn = (prev, curr) => prev === curr, type) {
    var prev = null
    return this.extend(e => fn(prev, prev = e.value) ? null : e, type)
  }

  diff(fn = (a, b) => [a, b], seed, type) {
    var prev = seed
    return this.extend(e => {
      if(prev !== undefined)
        return e.copy(fn(prev, prev = e.value))
      else prev = e.value
    }, type)
  }

  scan(fn, seed, type) {
    var prev = seed
    return this.extend(e => {
      if(prev !== undefined)
        return e.copy(prev = fn(prev, e.value))
    }, type)
  }

  flatten(fn = v => v, type) {
    return this.extend(e => e.value.map(v => e.copy(fn(v))), type)
  }
}



/**
 * A Property forwards its current value on new activations.
 */

class Property extends Stream {
  constructor(producers, transform, initializer) {
    super(producers, transform)
    this.initializer = initializer
  }

  activate(that) {
    if(!this.current && this.initializer)
      this.current = this.initializer()

    if(this.current)
      that.execute(this.current)

    super.activate(that)
  }
}



/**
 * A Source connects a stream or property to a data source.
 */

class ConstantSource extends Property {
  constructor(event) {
    super(undefined, undefined, () => event)
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
    this.listening = false
  }

  activate(that) {
    super.activate(that)
    if(!this.listening) {
      target.on(this.eventName, this.transform)
      this.listening = true
    }
  }

  deactivate(that) {
    super.deactivate(that)
    if(!this.active) {
      target.off(this.eventName)
      this.listening = false
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
    return new ConstantSource(null)
  }

  static later(wait, value, type = VALUE) {
    return new CallbackSource(function() {
      setTimeout(() => this.execute([new Event(type, value), DONE]), wait)  
    })
  }

  static interval(intv, value, type = VALUE) {
    return new CallbackSource(function() {
      setInterval(() => this.execute(new Event(type, value)), intv)
    })
  }

  static sequentially(intv, values, type = VALUE) {
    if(!values.length) return Narly.never()
    var events = values.slice().map(v => new Event(type, v))
    return new CallbackSource(function() {
      var interval = setInterval(() => {
        if(events.length === 1) {
          clearInterval(intv)
          this.execute([events.shift(), DONE])
        } else this.execute(events.shift())
      }, intv)      
    })
  }

  static fromPoll(interval, fn, type = VALUE) {
    return new CallbackSource(function() {
      setInterval(() => this.execute(new Event(type, fn())), interval)
    })
  }

  static fromCallback(fn) {
    return new CallbackSource(function() {
      fn(value => this.execute([new Event(VALUE, value), DONE]))
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
}