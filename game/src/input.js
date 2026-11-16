// SABLE YARD — keyboard + mouse + pointer lock. Keeps the live key set and
// the mouse-look deltas; the game loop consumes them once per step.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.firing = false;
    this.locked = false;
    this.onKey = null; // (code, down) — single-press actions live in main.js
    this.onMouseDown = null;
    this.onMouseUp = null;
    this._bind();
  }
  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.onKey) this.onKey(e.code, true);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (this.onKey) this.onKey(e.code, false);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.firing = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.firing = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX || 0;
      this.lookDY += e.movementY || 0;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) {
        this.canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) {
        this.firing = true;
        if (this.onMouseDown) this.onMouseDown(0);
      } else if (e.button === 2) {
        if (this.onMouseDown) this.onMouseDown(2);
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.firing = false;
        if (this.onMouseUp) this.onMouseUp(0);
      } else if (e.button === 2) {
        if (this.onMouseUp) this.onMouseUp(2);
      }
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // Mouse-look deltas since the last call, then cleared.
  consumeLook() {
    const dx = this.lookDX;
    const dy = this.lookDY;
    this.lookDX = 0;
    this.lookDY = 0;
    return { dx, dy };
  }
  has(code) {
    return this.keys.has(code);
  }
}
