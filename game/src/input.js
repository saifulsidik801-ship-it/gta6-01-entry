// Marisol Bay — keyboard and mouse input.
// One clear job: turn DOM events into a plain state object the game reads.
export function createInput(canvas) {
  const input = {
    forward: false, back: false, left: false, right: false,
    run: false, jump: false, enter: false, melee: false,
    shoot: false, shootPressed: false, pause: false,
    orbitX: 0, orbitY: 0, // accumulated mouse-drag orbit deltas
    anyKey: false, taxi: false, trial: false,
  };
  const keyMap = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'jump',
    KeyE: 'enter',
    KeyF: 'melee',
  };
  let enterLatch = false;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.anyKey = true;
    const field = keyMap[e.code];
    if (field) { input[field] = true; e.preventDefault(); }
    if (e.code === 'KeyE' && !enterLatch) { enterLatch = true; input.enter = true; }
    if (e.code === 'Escape' || e.code === 'KeyP') input.pause = true;
    if (e.code === 'KeyT') input.taxi = true;
    if (e.code === 'KeyY') input.trial = true;
    if (e.code === 'KeyM') input.muteToggle = true;
  });
  window.addEventListener('keyup', (e) => {
    const field = keyMap[e.code];
    if (field) input[field] = false;
    if (e.code === 'KeyE') enterLatch = false;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.shoot = true; input.shootPressed = true; }
    input.dragging = true; input.lastX = e.clientX; input.lastY = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.shoot = false;
    input.dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.orbitX += e.clientX - (input.lastX ?? e.clientX);
    input.orbitY += e.clientY - (input.lastY ?? e.clientY);
    input.lastX = e.clientX; input.lastY = e.clientY;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // Called once per frame by main.js: clears edge-triggered flags.
  input.endFrame = () => {
    input.enter = false; input.shootPressed = false; input.pause = false;
    input.melee = false; input.orbitX = 0; input.orbitY = 0;
    input.muteToggle = false; input.anyKey = false;
    input.taxi = false; input.trial = false;
  };
  return input;
}
