// MARISOL BAY — main.js (part 1: boot + state)
// One job: boot the game and own the frame loop. It builds the shared
// state object G, wires every module together, and steps the world.
// The modules do the work; this file only decides the order.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { buildWorld } from './world.js';
import { createPlayer, updatePlayer, enterCar, exitCar } from './player.js';
import { spawnParkedCars, updateCar, nearestCar } from './vehicle.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, updatePolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createGarage } from './garage.js';
import { createHud } from './hud.js';
import { createCamera } from './camera.js';
import { loadSave, writeSave, applySave, clearSave } from './save.js';
import { applyShot } from './shots.js';

export function boot() {
  const params = new URLSearchParams(location.search);
  const seed = parseInt(params.get('seed') || '20261118', 10) || 20261118;

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7ec8f2);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

  // The shared state every module reads and writes. Nothing else is global.
  const G = {
    renderer, scene, camera,
    seed, rng: makeRng(seed),
    time: 0, timeOfDay: 0.28, // late morning: bright and readable
    mode: 'menu', // menu | playing | paused
    shotMode: null,
    cash: CFG.startCash, wanted: 0,
    turf: [false, false, false, false, false, false],
    missionIndex: 0, missionsDone: [false, false, false, false, false, false, false],
    collected: new Array(30).fill(false),
    carsOwned: ['sedan'],
    cars: [],
    stats: { taxiFares: 0, trialsWon: 0, playSeconds: 0 },
    incomeTimer: 0,
    input: createInput(),
    audio: createAudio(),
    saveData: null,
  };
  window.__MARISOL__ = G; // screenshots + debugging read the live state here
  G.world = buildWorld(G);
  G.effects = createEffects(scene);
  G.player = createPlayer(G);
  G.cameraRig = createCamera(camera);
  spawnParkedCars(G);
  G.traffic = createTraffic(G);
  G.pedestrians = createPedestrians(G);
  G.police = createPolice(G);
  G.combat = createCombat(G);
  G.missions = createMissions(G);
  G.garage = createGarage(G);
  G.hud = createHud(G);
  G.world.setTimeOfDay(G.timeOfDay);

  // Restore a previous session if one exists.
  const saved = loadSave();
  if (saved) { applySave(G, saved); G.saveData = saved; }

  wireMenus(G);
  // Screenshot scenes drive the loop directly, so tick must exist now.
  G.tick = (dt, silent) => tick(G, dt, silent);
  const shot = applyShot(G, params);
  if (!shot) G.hud.showStart(true);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  // First gesture unlocks audio (browser rule) and starts the game clock.
  const unlock = () => { G.audio.ensure(); };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  return G;
}

function wireMenus(G) {
  const $ = (id) => document.getElementById(id);
  const startBtn = $('btn-start');
  if (startBtn) startBtn.addEventListener('click', () => {
    G.audio.ensure();
    G.mode = 'playing';
    G.hud.showStart(false);
    if (!G.missions.current && G.missionIndex === 0) G.missions.start(0);
    G.hud.flash('Welcome to Marisol Bay — steal a car (E), press M for missions');
  });
  const continueBtn = $('btn-continue');
  if (continueBtn) continueBtn.addEventListener('click', () => {
    G.audio.ensure();
    G.mode = 'playing';
    G.hud.showStart(false);
    G.hud.flash('Welcome back, Milo');
  });
  const resumeBtn = $('btn-resume');
  if (resumeBtn) resumeBtn.addEventListener('click', () => { G.mode = 'playing'; G.hud.showPause(false); });
  const saveBtn = $('btn-save');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    const ok = writeSave(G);
    G.hud.flash(ok ? 'Progress saved' : 'Save failed — storage blocked');
  });
  const quitBtn = $('btn-quit');
  if (quitBtn) quitBtn.addEventListener('click', () => {
    writeSave(G);
    G.mode = 'menu'; G.hud.showPause(false); G.hud.showStart(true);
  });
  const newBtn = $('btn-new');
  if (newBtn) newBtn.addEventListener('click', () => {
    clearSave();
    location.href = location.pathname; // fresh run, no save
  });
  const soundBtn = $('btn-sound');
  if (soundBtn) soundBtn.addEventListener('click', () => {
    const on = G.audio.toggleSound();
    soundBtn.textContent = on ? '🔊 Sound: ON' : '🔇 Sound: OFF';
  });
  const musicBtn = $('btn-music');
  if (musicBtn) musicBtn.addEventListener('click', () => {
    const on = G.audio.toggleMusic();
    musicBtn.textContent = on ? '🎵 Music: ON' : '🎵 Music: OFF';
  });
  const helpBtn = $('btn-help');
  if (helpBtn) helpBtn.addEventListener('click', () => {
    const el = $('help');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  });
  if (G.saveData) {
    const note = $('save-note');
    if (note) note.textContent = `Save found: $${G.saveData.cash || 0}, turf ${((G.saveData.turf || []).filter(Boolean)).length}/6, mission ${((G.saveData.missionIndex || 0) + 1)}/7`;
    if (continueBtn) continueBtn.style.display = 'inline-block';
  }
}

// MARISOL BAY — main.js (part 2: the frame loop)
// One tick, in order: read input, move Milo or his car, move the city
// (traffic, pedestrians, police, enemies), run the missions, pay turf
// income, update the camera, HUD, effects and the sun, then render.
// The loop never throws: a bad frame is skipped, never fatal.
function tick(G, dt, silent) {
  G.time += dt;
  G.stats.playSeconds += dt;
  // day cycle: a full day every 8 minutes of play
  G.timeOfDay = (G.timeOfDay + dt / CFG.dayLength) % 1;
  if (!silent) G.world.setTimeOfDay(G.timeOfDay);

  const P = G.player;
  const input = G.input;
  if (input.pressed('Escape')) {
    if (G.mode === 'playing') { G.mode = 'paused'; G.hud.showPause(true); }
    else if (G.mode === 'paused') { G.mode = 'playing'; G.hud.showPause(false); }
  }
  if (input.pressed('KeyB') && (G.mode === 'playing' || G.garage.open)) G.garage.toggle();
  if (input.pressed('KeyR') && P.armed && P.ammo < 48 && G.cash >= 50) {
    G.cash -= 50; P.ammo = 48; G.audio.pickup(); G.hud.flash('Reloaded — $50');
  }

  // E is handled here, once per press, for both directions: on foot it
  // steals the nearest car, in a car it steps out. One shared edge flag
  // means a held press can never enter and exit on the same frame.
  if (input.pressed('KeyE')) {
    if (P.onFoot) {
      const car = nearestCar(G, P.pos.x, P.pos.z, 5.5);
      if (car) enterCar(G, car);
    } else exitCar(G);
  }

  updatePlayer(G, dt);
  if (P.car) {
    const ax = input.axis();
    // Screenshot scenes keep the car rolling so the chase reads at speed.
    // In the chase the player eases off slightly so the patrol cars can
    // keep up and stay in frame behind him.
    const autoDrive = G.shotMode === 'chase' || G.shotMode === 'drive';
    const throttle = autoDrive ? (G.shotMode === 'chase' ? 0.65 : 1) : ax.y;
    const steer = -ax.x;
    const skidding = updateCar(G, P.car, dt, throttle, steer);
    if (input.keys.Space) P.car.speed *= Math.max(0, 1 - dt * 2.5); // handbrake
    G.audio.setEngine(Math.abs(P.car.speed) / P.car.def.top, true);
  } else {
    G.audio.setEngine(0, false);
  }
  if (input.mouseDown && P.armed && P.onFoot) G.combat.shoot(G);
  if (input.keys.Space && P.onFoot && P.armed) G.combat.shoot(G);

  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updatePolice(G, dt);
  G.combat.update(G, dt);
  G.missions.update(dt);
  G.effects.update(dt);

  // Turf income: every owned district pays once a minute.
  G.incomeTimer += dt;
  if (G.incomeTimer >= 60) {
    G.incomeTimer = 0;
    const owned = G.turf.map((t, i) => (t ? DISTRICTS[i].income : 0)).reduce((a, b) => a + b, 0);
    if (owned > 0) {
      G.cash += owned;
      G.audio.cash();
      G.hud.flash(`Turf income +$${owned}`);
      G.effects.cash(P.pos.x, 2, P.pos.z);
    }
  }

  G.cameraRig.update(G, dt);
  G.hud.update(dt);
  input.consumeMouse();
}

function frame(G) {
  const loop = (t) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - (G._last || t)) / 1000 || 0.016);
    G._last = t;
    if (G.mode === 'playing') tick(G, dt, false);
    else if (G.mode === 'menu' || G.mode === 'paused') {
      // menus still orbit the city slowly so the backdrop is alive
      G.time += dt * 0.2;
      G.cameraRig.update(G, dt);
      G.input.consumeMouse();
      // B closes the garage even while the world is paused for shopping
      if (G.garage.open && G.input.pressed('KeyB')) G.garage.toggle();
    }
    G.renderer.render(G.scene, G.camera);
  };
  requestAnimationFrame(loop);
}

// Boot as soon as the DOM is ready.
import { DISTRICTS } from './config.js';
const G = boot();
frame(G);
