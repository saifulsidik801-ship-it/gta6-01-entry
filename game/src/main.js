// MARISOL BAY — boot + game loop. Builds every system, owns the shared game
// object G and the mode machine (menu / playing / paused / busted / wasted),
// advances the clock and pays turf income. Nothing else lives here.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, SIDE, TIME_OF_DAY } from './config.js';
import { createInput } from './input.js';
import { buildWorld, setTimeOfDay } from './world.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicle.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createCameraRig } from './camera.js';
import { createSave } from './save.js';
import { applyShot } from './shots.js';

window.__ERRORS__ = [];
window.addEventListener('error', (e) => window.__ERRORS__.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__ERRORS__.push('rejection: ' + String(e.reason)));

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd9e8);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(120, 80, 120);

const G = {
  scene, camera, renderer,
  state: { mode: 'menu', cash: 100, wanted: 0, turf: [false, false, false, false, false, false], missionsDone: 0, shells: 0, speedKmh: 0 },
  clockT: TIME_OF_DAY.DAY,
  incomeT: 0,
};
G.input = createInput(renderer.domElement);
G.world = buildWorld(G);
G.effects = createEffects(G);
G.audio = createAudio();
G.player = createPlayer(G);
G.vehicles = createVehicles(G);
G.vehicles.spawnParked(16);
G.traffic = createTraffic(G, 14);
G.pedestrians = createPedestrians(G, 24);
G.police = createPolice(G);
G.combat = createCombat(G);
G.missions = createMissions(G);
G.hud = createHud(G);
G.cameraRig = createCameraRig(G);
G.save = createSave(G);
G.__GAME__ = G;
window.__GAME__ = G;

G.setMode = (mode) => {
  G.state.mode = mode;
  if (mode === 'menu') { G.cameraRig.mode = 'menu'; G.hud.show('menu'); }
  else if (mode === 'playing') {
    G.cameraRig.mode = G.player.inCar ? 'car' : 'foot';
    G.hud.hideAll();
  }
  else if (mode === 'paused') G.hud.show('pause');
  else if (mode === 'busted') G.hud.show('busted');
  else if (mode === 'wasted') G.hud.show('wasted');
  if (mode !== 'playing') G.audio.engine(0, false);
};
G.startGame = () => {
  G.audio.unlock();
  G.audio.setMuted(false);
  G.setMode('playing');
  const d = G.missions.def;
  G.hud.toast(d ? d.title + ': ' + d.brief : 'Marisol Bay is yours — free roam.');
};

// Restore a save, or start mission 1 from the pier.
const saved = G.save.load();
if (saved) { G.save.apply(saved); G.hud.toast('Welcome back, Milo — $' + Math.floor(G.state.cash) + ' in your pocket.'); }
else G.missions.startStep();
setTimeOfDay(G, saved && typeof saved.timeOfDay === 'number' ? saved.timeOfDay : TIME_OF_DAY.DAY);
G.clockT = G.world.timeOfDay;

if (shotName) {
  G.audio.setMuted(true);
  applyShot(G, shotName);
} else {
  G.setMode('menu');
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const s = G.state;
  if (s.mode === 'playing') {
    // Global keys.
    if (G.input.pressed('Escape') || G.input.pressed('KeyP')) { G.setMode('paused'); }
    else if (G.input.pressed('KeyE')) G.player.tryEnterExit();
    else if (G.input.pressed('KeyQ')) G.missions.toggleTaxi();
    else if (G.input.pressed('KeyT')) G.missions.startTrial();
    else if (G.input.pressed('KeyM')) {
      G.audio.setMuted(!G.audio.muted);
      const b = document.getElementById('mute-btn');
      if (b) b.textContent = G.audio.muted ? '🔇 Sound: off' : '🔊 Sound: on';
    }
    // Clock: a full day takes 6 minutes of play; lighting follows it.
    G.clockT = (G.clockT + dt / 360) % 1;
    setTimeOfDay(G, G.clockT);
    // Turf income.
    G.incomeT += dt;
    if (G.incomeT > SIDE.INCOME_TICK_S) {
      G.incomeT = 0;
      const taken = s.turf.filter(Boolean).length;
      if (taken > 0) s.cash += taken * SIDE.TURF_INCOME;
    }
    G.player.update(dt);
    G.vehicles.update(dt);
    G.traffic.update(dt);
    G.pedestrians.update(dt);
    G.police.update(dt);
    G.combat.update(dt);
    G.missions.update(dt);
    G.effects.update(dt);
    G.audio.update(dt, s.wanted);
    if (!G.player.inCar) G.audio.engine(0, false);
    G.hud.update();
  } else if (s.mode === 'menu') {
    G.effects.update(dt);
  }
  G.cameraRig.update(dt);
  renderer.render(scene, camera);
  G.input.endFrame();
}
frame();
