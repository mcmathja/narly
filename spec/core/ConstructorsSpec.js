var Narly = require("../../dist/narly")

describe('Constructors:', function() {
  describe('value', function() {
    var data = 1, P = Narly.value(data)

    it('should create an ended property', function() {
      expect(P instanceof Narly.Property).toBe(true)
      expect(P.ended).toBe(true)
    })

    it('should have set current value', function() {
      expect(P.current.type).toBe(Narly.VAL)
      expect(P.current.data).toBe(data)
    })
  })

  describe('error', function() {
    var data = 1, P = Narly.error(data)

    it('should create an ended property', function() {
      expect(P instanceof Narly.Property).toBe(true)
      expect(P.ended).toBe(true)
    })

    it('should have set current error', function() {
      expect(P.current.type).toBe(Narly.ERR)
      expect(P.current.data).toBe(data)
    })
  })

  describe('never', function() {
    var S = Narly.never()

    it('should create an ended stream', function() {
      expect(S instanceof Narly.Stream)
      expect(S.ended).toBe(true)
    })
  })

  describe('later', function() {
    var S, wait = 300, data = 1

    beforeEach(function() { S = Narly.later(wait, data) })

    it('should create an in progress stream', function() {
      expect(S instanceof Narly.Stream)
      expect(S.ended).toBe(false)
    })

    it('should eventually emit a value, then end', function(done) {
      S.onValue(function(val) {
        expect(val).toBe(data)
      })

      S.onEnd(function() {
        done()
      })
    })
  })

  describe('interval', function() {
    var S, intv = 300, data = 1, n = 3

    beforeEach(function() { S = Narly.interval(intv, data) })

    it('should create an in progress stream', function() {
      expect(S instanceof Narly.Stream)
      expect(S.ended).toBe(false)
    })

    it('should emit continuously at an interval', function(done) {
      var asyncTest = function(val) {
        expect(val).toBe(data)
        if(--n === 0) {
          S.offValue(asyncTest)
          done()
        }
      }

      S.onValue(asyncTest)
    })
  })

  describe('sequentially', function() {
    var S, intv = 300, data = [1, 2, 3]

    beforeEach(function() { S = Narly.sequentially(intv, data) })

    it('should create an in progress stream', function() {
      expect(S instanceof Narly.Stream)
      expect(S.ended).toBe(false)
    })

    it('should emit data in order at a given interval, then end', function(done) {
      var res = []

      S.onValue(function(val) {
        res.push(val)
      })

      S.onEnd(function() {
        expect(res.length).toBe(data.length)
        data.forEach(function(d, i) {
          expect(d).toBe(res[i])
        })
        done()
      })
    })
  })

  describe('poll', function() {
    var S, intv = 300, n = 0, fn = function() { return n * 2 }

    beforeEach(function() { S = Narly.poll(intv, fn) })

    it('should create an in progress stream', function() {
      expect(S instanceof Narly.Stream)
      expect(S.ended).toBe(false)
    })

    it('should poll for a value at an interval', function(done) {
      S.onValue(function(val) {
        expect(val).toBe(fn())
        if(++n >= 3) done()
      })
    })
  })

  describe('fromCallback', function() {
    var S, wait = 300, data = 1

    beforeEach(function() {
      S = Narly.fromCallback(function(fn) {
        setTimeout(function() { fn(data) }, wait)
      })
    })

    it('should create an in progress stream', function() {
      expect(S instanceof Narly.Stream)
      expect(S.ended).toBe(false)
    })

    it('should emit a value, then end', function(done) {
      S.onValue(function(val) {
        expect(val).toBe(data)
      })

      S.onEnd(function() {
        done()
      })
    })
  })

  describe('fromNodeCallback', function() {
    var wait = 300, data = 1

    it('should create an in progress stream', function() {
      var S = Narly.fromNodeCallback(function(fn) {})
      expect(S instanceof Narly.Stream)
      expect(S.ended).toBe(false)
    })

    it('should emit a value, then end', function(done) {
      var S = Narly.fromNodeCallback(function(fn) {
        setTimeout(function() { fn(null, data) }, wait)
      })

      S.onValue(function(val) {
        expect(val).toBe(data)
      })

      S.onEnd(function() {
        done()
      })
    })

    it('should emit an error, then end', function(done) {
      var S = Narly.fromNodeCallback(function(fn) {
        setTimeout(function() { fn(data, null) }, wait)
      })

      S.onError(function(err) {
        expect(err).toBe(data)
      })

      S.onEnd(function() {
        done()
      })
    })
  })

  describe('fromEvents', function() {

    // Stubbed EventEmitter
    function eeStub() { this.listeners = {} }

    eeStub.prototype.on = function(name, fn) {
      if(this.listeners[name])
        this.listerners[name].push(fn)
      else
        this.listeners[name] = [fn]
    }

    eeStub.prototype.off = function(name, fn) {
      this.listeners[name].splice(this.listeners[name].indexOf(fn), 1)
      if(this.listeners[name].length === 0)
        delete this.listeners[name]
    }

    eeStub.prototype.emit = function(name, event) {
      if(this.listeners[name])
        this.listeners[name].forEach(function(fn) { fn(event) })
    }

    // Tests
    var name = 'test', ee, S

    beforeEach(function() {
      ee = new eeStub
      S = Narly.fromEvents(ee, name)
    })

    it('should create an in progress stream', function() {
      expect(S instanceof Narly.Stream)
      expect(S.ended).toBe(false)
    })

    it('should attach a handler to the event emitter when activated', function() {
      S.onAny(function() {})
      expect(ee.listeners[name].length).toBe(1)
    })

    it('should forward values from the event emitter', function(done) {
      var data = 1

      S.onValue(function(val) {
        expect(val).toBe(data)
        done()
      })

      ee.emit(name, data)
    })
  })
})