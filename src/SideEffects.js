'use strict'

/**
 * A SideEffect extracts data from an Observable.
 */

class SideEffect {
  constructor(fn) {
    this.fn = fn
  }

  val(v) {}
  err(e) {}
  end() {}
}

export class OnVal extends SideEffect {
  val(v) {
    this.fn(v)
  }
}

export class OnErr extends SideEffect {
  err(e) {
    this.fn(e)
  }
}

export class OnEnd extends SideEffect {
  end() {
    this.fn()
  }
}

export class OnAny extends SideEffect {
  val(v) {
    this.fn('value', v)
  }
  
  err(e) {
    this.fn('error', e)
  }
  
  end() {
    this.fn('end')
  }
}