// Marisol Bay — boot and main loop.
// One clear job: assemble every system into one game object G, run the
// frame loop, and own the title / pause / busted / wasted screens.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32 } from './random.js';
import { createInput } from './input.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { buildWorld, applyTimeOfDay, syncFog } from './world.js';
import { createPlayer, updatePlayerOnFoot, updatePlayerDriving, tryEnterCar, exitCar } from './player.js';
import { createCameraRig, updateCamera, titleCamera } from './camera.js';
import { createVehicle, spawnParkedCars } from './vehicle.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, updatePolice } from './police.js';
import { createCombat, shoot, melee, updateEnemies } from './combat.js';
import { createMissions, updateMissions, startMissionStep, spawnCollectibles, currentMission } from './missions.js';
import { createHud, updateHud } from './hud.js';
import { parseShot, applyShot } from './shots.js';

window.__marisol = { ready: false, errors: [], frames: 0, mode: 'boot' };
window.__G = null; // debug handle: the live game object, for in-browser checks
window.addEventListener('error', (e) => {
  window.__marisol.errors.push(String(e.message || e.error || 'unknown error'));
});

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 20261118);
const rng = mulberry32(seed);
const shot = parseShot();

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);

const save = loadSave();
const G = {
  renderer, scene, camera,
  rng, seed,
  save,
  cash: save.cash,
  wanted: 0,
  timeOfDay: 0.45,
  mode: shot.name ? 'playing' : 'title',
  cameraYaw: 0,
  traffic: [], peds: [], parkedCars: [], copCars: [],
  shot,
};
G.input = createInput(canvas);
G.audio = createAudio();
G.audio.setMuted(!!save.muted);
G.effects = createEffects(scene);
G.world = buildWorld(scene, seed);
G.player = createPlayer(scene, 8, 30);
G.cameraRig = createCameraRig(camera);
G.traffic = createTraffic(scene, rng, CONFIG.trafficCount);
G.peds = createPedestrians(scene, rng, CONFIG.pedestrianCount);
G.parkedCars = spawnParkedCars(G, rng, 14);
G.police = createPolice(G);
G.combat = createCombat();
G.missions = createMissions(G);
G.hud = createHud();
window.__G = G;
spawnCollectibles(G, seed);
applyTimeOfDay(G.world, G.timeOfDay);
syncFog(scene, G.world, G.timeOfDay);
G.hud.root.style.display = shot.name ? 'block' : 'none';

// --- Screens ---------------------------------------------------------------
const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  busted: document.getElementById('screen-busted'),
  wasted: document.getElementById('screen-wasted'),
};
function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    if (el) el.style.display = key === name ? 'flex' : 'none';
  }
  G.hud.root.style.display = (name === null && G.mode === 'playing') ? 'block' : 'none';
  window.__marisol.mode = G.mode;
}

function startGame(fresh) {
  if (fresh) {
    clearSave();
    const s = loadSave();
    Object.assign(G.save, s);
    G.cash = s.cash;
    G.player.health = CONFIG.playerHealth;
    G.player.dead = false;
    G.wanted = 0;
    G.missions.index = 0; G.missions.step = 0; G.missions.done = false;
  }
  G.audio.ensure();
  G.mode = 'playing';
  G.player.dead = false;
  showScreen(null);
  startMissionStep(G);
  G.hud.toast(fresh
    ? 'Welcome to Marisol Bay. Rico is waiting — follow the gold marker.'
    : `Welcome back, Milo. ${currentMission(G) ? currentMission(G).name : 'Free roam'}.`);
}

function respawn() {
  const p = G.player;
  if (p.vehicle) { p.vehicle.driver = null; p.vehicle.speed = 0; p.vehicle = null; }
  p.onFoot = true;
  p.mesh.visible = true;
  p.health = CONFIG.playerHealth;
  p.dead = false;
  p.pos.set(8, 0, 30);
  p.mesh.position.copy(p.pos);
  G.wanted = 0;
  G.audio.siren(false);
  G.mode = 'playing';
  showScreen(null);
  G.hud.toast('Back on your feet. The bay is still yours to take.');
}

document.getElementById('btn-start')?.addEventListener('click', () => startGame(false));
document.getElementById('btn-new')?.addEventListener('click', () => startGame(true));
document.getElementById('btn-resume')?.addEventListener('click', () => {
  G.mode = 'playing'; showScreen(null);
});
document.getElementById('btn-quit')?.addEventListener('click', () => {
  writeSave(G.save);
  G.mode = 'title'; showScreen('title');
});
document.getElementById('btn-respawn')?.addEventListener('click', respawn);
document.getElementById('btn-respawn2')?.addEventListener('click', respawn);
document.getElementById('btn-mute')?.addEventListener('click', (e) => {
  G.audio.ensure();
  G.audio.setMuted(!G.audio.muted);
  G.save.muted = G.audio.muted;
  e.target.textContent = G.audio.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
});

// --- Screenshot scenes -----------------------------------------------------
if (shot.name) {
  applyShot(G, shot);
  applyTimeOfDay(G.world, G.timeOfDay);
  syncFog(scene, G.world, G.timeOfDay);
  showScreen(null);
}

// --- Main loop -------------------------------------------------------------
const clock = new THREE.Clock();
let saveT = 0;
let frames = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  frames++;
  window.__marisol.frames = frames;
  const input = G.input;

  if (input.muteToggle) {
    G.audio.setMuted(!G.audio.muted);
    G.save.muted = G.audio.muted;
  }

  if (G.mode === 'title') {
    titleCamera(G, frames * dt);
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    G.effects.update(dt);
    G.audio.engine(0, false);
  } else if (G.mode === 'playing') {
    // Pause?
    if (input.pause) {
      G.mode = 'paused';
      showScreen('pause');
      writeSave(G.save);
      G.audio.engine(0, false);
      G.audio.siren(false);
    } else {
      // Day advances slowly (frozen in screenshot scenes).
      if (!shot.name) {
        G.timeOfDay = (G.timeOfDay + dt * 0.0016) % 1;
        applyTimeOfDay(G.world, G.timeOfDay);
        syncFog(scene, G.world, G.timeOfDay);
      }
      // Enter / exit car.
      if (input.enter) {
        if (G.player.onFoot) tryEnterCar(G);
        else exitCar(G);
      }
      // Screenshot scenes drive themselves: the car keeps rolling so the
      // speedometer, skid smoke and chase all read as live play.
      if (shot.name && G.player.vehicle) input.forward = true;
      // Combat.
      if (input.shootPressed) shoot(G);
      if (input.melee) melee(G);
      // Player.
      if (G.player.onFoot) updatePlayerOnFoot(G, dt);
      else updatePlayerDriving(G, dt);
      updateCamera(G, dt);
      updateTraffic(G, dt);
      updatePedestrians(G, dt);
      updatePolice(G, dt);
      updateEnemies(G, dt);
      updateMissions(G, dt);
      G.effects.update(dt);
      updateHud(G);
      // Autosave.
      saveT += dt;
      if (saveT > 10) { saveT = 0; writeSave(G.save); }
    }
  } else if (G.mode === 'paused') {
    if (input.pause) { G.mode = 'playing'; showScreen(null); }
  } else if (G.mode === 'busted') {
    showScreen('busted');
  } else if (G.mode === 'wasted') {
    showScreen('wasted');
  }

  // Keep the HUD honest even on the end screens.
  if (G.mode === 'busted' || G.mode === 'wasted') updateHud(G);

  renderer.render(scene, camera);
  input.endFrame();

  // Screenshot scenes are ready once the world has settled.
  if (shot.name && frames === 40) {
    window.__marisol.ready = true;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

showScreen(shot.name ? null : 'title');
animate();
