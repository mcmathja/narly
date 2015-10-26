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
  constructor(producers = [], execute = (e, p) => e) {
    this.execute = execute
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

  emit(result) {
    if(result === DONE) {
      this.ended = true
      this.active = false
      this.producers.forEach(p => p.deactivate(this))
    } else this.current = result

    this.consumers.forEach(c => c.execute(result, this))
    return this
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

  // Transformations

  toProperty(fn) {
    return new Property([this], e => e.current ? null : e, () => {
      try {
        return new Event(VALUE, fn(), true)
      } catch(e) {
        return new Event(ERROR, e, true)
      }
    })
  }

  extend(op, type = new Set([VALUE]), producers = []) {
    return new Stream([this].concat(producers), function(e, p) {
      return type.has(e.type) ? op.call(this, e, p) : this.emit(e)
    })
  }

  map(fn, type) {
    return this.extend(function(e) {
      this.emit(e.copy(fn(e.value)))
    }, type)
  }

  filter(fn, type) {
    return this.extend(function(e) {
      if(fn(e.value)) this.emit(e)
    }, type)
  }

  take(n, type) {
    return this.extend(function(e) {
      if(--n > 0) this.emit(e).emit(DONE)
    }, type)
  }

  takeWhile(fn, type) {
    return this.extend(function(e) {
      if(fn(e.value)) this.emit(e)
      else this.emit(DONE)
    }, type)
  }

  last(type = new Set([VALUE])) {
    var prev = null
    return this.extend(function(e) {
      if(e === DONE) this.emit(prev).emit(DONE)
      else prev = e
    }, new Set([...type, END]))
  }

  skip(n, type) {
    return this.extend(function(e) {
      if(--n < 0) this.emit(e)
    }, type)
  }

  skipWhile(fn, type) {
    var done = false
    return this.extend(function(e) {
      if(done || (done = !fn(e.value))) this.emit(e)
    }, type)
  }

  skipDuplicates(fn = (prev, curr) => prev === curr, type) {
    var prev = null
    return this.extend(function(e) {
      if(!fn(prev, prev = e.value)) this.emit(e)
    }, type)
  }

  diff(fn = (a, b) => [a, b], seed, type) {
    var prev = seed
    return this.extend(function(e) {
      if(prev !== undefined)
        this.emit(e.copy(fn(prev, prev = e.value)))
      else prev = e.value
    }, type)
  }

  scan(fn, seed, type) {
    var prev = seed
    return this.extend(function(e) {
      if(prev !== undefined)
        this.emit(e.copy(prev = fn(prev, e.value)))
    }, type)
  }

  flatten(fn = v => v, type) {
    return this.extend(function(e) {
      e.value.forEach(v => this.emit(e.copy(fn(v))))
    }, type)
  }

  delay(wait) {
    var ops = [], timeout, fn = function() {
      var op = ops.shift()
      if(ops.length) {
        var waitLeft = Math.max(wait - (new Date - ops[0].added), 0)
        timeout = setTimeout(fn.bind(this), waitLeft)
      } else timeout = null
      this.emit(op.event)
    }

    return this.extend(function(e) {
      ops.push({ event: e, added: new Date })
      if(!timeout) timeout = setTimeout(fn.bind(this), wait)
    }, ANY)
  }

  throttle(wait) {
    var timeout, prev, done, fn = function() {
      if(prev || done) {
        if(!done) timeout = setTimeout(fn.bind(this), wait)
        if(prev) this.emit(prev)
        if(done) this.emit(DONE)
      } else timeout = null
    }

    return this.extend(function(e) {
      if(!prev && e === DONE) {
        clearTimeout(timeout)
        this.emit(e)
      } else if(!timeout) {
        timeout = setTimeout(fn.bind(this), wait)
        this.emit(e)
      }

      if(e === DONE) done = true
      else prev = e
    }, ANY)
  }
}



/**
 * A Property forwards its current value on new activations.
 */

class Property extends Stream {
  constructor(producers, execute, initializer) {
    super(producers, execute)
    this.initializer = initializer
  }

  activate(that) {
    if(!this.current && this.initializer)
      this.current = this.initializer()

    if(this.current)
      that.execute(this.current.cached(), this)

    super.activate(that)
  }

  // Transformations

  toStream() {
    return new Stream([this], e => e.current ? null : e)
  }

  extend(op, type = new Set([VALUE]), producers = []) {
    return new Property([this].concat(producers), function(e, p) {
      return type.has(e.type) ? op.call(this, e, p) : e
    })
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
    this.transform = transform
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
      setTimeout(() => {
        this.emit(new Event(type, value)).emit(DONE)
      }, wait)
    })
  }

  static interval(intv, value, type = VALUE) {
    return new CallbackSource(function() {
      setInterval(() => {
        this.emit(new Event(type, value))
      }, intv)
    })
  }

  static sequentially(intv, values, type = VALUE) {
    if(!values.length) return Narly.never()
    var events = values.slice().map(v => new Event(type, v))
    return new CallbackSource(function() {
      var interval = setInterval(() => {
        if(events.length === 1) {
          clearInterval(intv)
          this.emit(events.shift()).emit(DONE)
        } else this.emit(events.shift())
      }, intv)      
    })
  }

  static fromPoll(interval, fn, type = VALUE) {
    return new CallbackSource(function() {
      setInterval(() => this.emit(new Event(type, fn())), interval)
    })
  }

  static fromCallback(fn) {
    return new CallbackSource(function() {
      fn(value => {
        this.emit(new Event(VALUE, value)).emit(DONE)
      })
    })
  }

  static fromNodeCallback(fn) {
    return new CallbackSource(function() {
      fn((error, value) => {
        if(error) this.emit(new Event(ERROR, error))
        else this.emit(new Event(VALUE, value))
        this.emit(DONE)
      })
    })
  }
}