// Keyboard + mouse input, with per-frame edge detection. The game loop calls
// endFrame() once per tick; pressed() is true only on the tick the key went down.
import { KEYS } from './config.js';

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0, mouseDY = 0, mouseDown = false, mouseClicked = false;
  let dragging = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseDown(e) {
    mouseDown = true; mouseClicked = true; dragging = true;
    if (canvas.requestPointerLock) { /* pointer lock is optional; drag-look works without it */ }
  }
  function onMouseUp() { mouseDown = false; dragging = false; }
  function onMouseMove(e) {
    if (!dragging) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);

  const has = (list) => list.some((c) => keys.has(c));
  return {
    down: (code) => keys.has(code),
    pressed: (code) => pressed.has(code),
    axisX: () => (has(KEYS.RIGHT) ? 1 : 0) - (has(KEYS.LEFT) ? 1 : 0),
    axisY: () => (has(KEYS.UP) ? 1 : 0) - (has(KEYS.DOWN) ? 1 : 0),
    get mouseDown() { return mouseDown; },
    consumeClick: () => { const c = mouseClicked; mouseClicked = false; return c; },
    lookDelta: () => { const d = { x: mouseDX, y: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    endFrame: () => { pressed.clear(); },
  };
}
