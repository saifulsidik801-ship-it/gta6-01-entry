// Input — keyboard + on-screen touch controls. WASD/arrows move and drive,
// Shift runs, E enters/exits cars, F punches, Space brakes (or shoots when
// on foot and armed — click also shoots), M toggles the map zoom, P/Esc
// pauses. Touch buttons feed the same state object the loop reads.
export class Input {
  constructor(doc) {
    this.keys = {};
    this.touch = { x: 0, z: 0, run: false, brake: false, steer: 0, throttle: 0 };
    this.pressed = new Set(); // edge-triggered keys, consumed by the loop
    this.mouseDown = false;
    this.doc = doc;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    const canvas = doc.getElementById('game');
    canvas.addEventListener('mousedown', () => { this.mouseDown = true; });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    this.bindTouch(doc);
  }

  bindTouch(doc) {
    const hold = (id, on, off) => {
      const el = doc.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
      el.addEventListener('pointerup', () => off());
      el.addEventListener('pointerleave', () => off());
    };
    hold('t-up', () => { this.touch.z = 1; this.touch.throttle = 1; }, () => { this.touch.z = 0; this.touch.throttle = 0; });
    hold('t-down', () => { this.touch.z = -1; this.touch.throttle = -1; }, () => { this.touch.z = 0; this.touch.throttle = 0; });
    hold('t-left', () => { this.touch.x = -1; this.touch.steer = -1; }, () => { this.touch.x = 0; this.touch.steer = 0; });
    hold('t-right', () => { this.touch.x = 1; this.touch.steer = 1; }, () => { this.touch.x = 0; this.touch.steer = 0; });
    hold('t-run', () => { this.touch.run = true; }, () => { this.touch.run = false; });
    hold('t-brake', () => { this.touch.brake = true; }, () => { this.touch.brake = false; });
    hold('t-act', () => { this.pressed.add('KeyE'); }, () => {});
    hold('t-punch', () => { this.pressed.add('KeyF'); }, () => {});
  }

  consume(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }

  get down() { return this.keys; }

  // Combined keyboard + touch state for on-foot movement.
  foot() {
    const k = this.keys, t = this.touch;
    const z = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + t.z;
    const x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + t.x;
    return {
      x: Math.max(-1, Math.min(1, x)),
      z: Math.max(-1, Math.min(1, z)),
      run: !!(k.ShiftLeft || k.ShiftRight || t.run),
    };
  }

  // Combined state for driving.
  drive() {
    const k = this.keys, t = this.touch;
    const throttle = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + t.throttle;
    const steer = (k.KeyA || k.ArrowLeft ? -1 : 0) + (k.KeyD || k.ArrowRight ? 1 : 0) + t.steer;
    return {
      throttle: Math.max(-1, Math.min(1, throttle)),
      steer: Math.max(-1, Math.min(1, steer)),
      brake: !!(k.Space || t.brake),
    };
  }

  get shootHeld() { return this.mouseDown || !!this.keys.Space; }
}
