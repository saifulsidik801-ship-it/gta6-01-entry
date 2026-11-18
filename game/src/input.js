// MARISOL BAY — input.js
// One job: read the keyboard and mouse into one plain object the
// player, camera and menus all read from. No game logic lives here.
export function createInput() {
  const keys = {};
  // Edge-triggered presses: a keydown sets the flag, and the first
  // consumer to ask for it clears it. Polling `keys` once per frame can
  // miss a tap entirely when the frame rate is low; a press flag never
  // gets lost between frames, which is what menus and car entry need.
  const pressedFlags = {};
  const input = {
    keys,
    mouseDX: 0, mouseDY: 0, mouseDown: false,
    wheel: 0,
    pressed(code) { const v = !!pressedFlags[code]; pressedFlags[code] = false; return v; },
    // True while any of the listed keys is held.
    any(...names) { return names.some((n) => keys[n]); },
    axis() {
      let x = 0, y = 0;
      if (keys.KeyW || keys.ArrowUp) y += 1;
      if (keys.KeyS || keys.ArrowDown) y -= 1;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      return { x, y };
    },
  };
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (!e.repeat) pressedFlags[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; });
  window.addEventListener('mousemove', (e) => {
    if (input.mouseDown) { input.mouseDX += e.movementX || 0; input.mouseDY += e.movementY || 0; }
  });
  window.addEventListener('mousedown', (e) => { if (e.button === 0) input.mouseDown = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) input.mouseDown = false; });
  window.addEventListener('wheel', (e) => { input.wheel += e.deltaY; }, { passive: true });
  // Called once per frame by main.js after every consumer has read it.
  input.consumeMouse = () => { input.mouseDX = 0; input.mouseDY = 0; input.wheel = 0; };
  return input;
}
