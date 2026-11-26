// input.js — the keyboard, kept as one flat state object the flight model
// reads each frame. Flight keys never scroll the page.

const FLIGHT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
]);

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set(); // keys that went down since the last frame
    window.addEventListener('keydown', (event) => {
      if (FLIGHT_KEYS.has(event.code)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.down.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.down.delete(event.code);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  held(code) {
    return this.down.has(code);
  }

  // True once per physical press; consumed by the caller.
  tapped(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  endFrame() {
    this.pressed.clear();
  }
}
