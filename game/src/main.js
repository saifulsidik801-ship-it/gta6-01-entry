// MARISOL BAY — boot + game loop. Builds the city and every system, runs
// the menu -> playing -> paused -> busted/wasted state machine, and keeps
// the HUD honest: every number it shows comes from live state.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, districtAt } from './config.js';
import { RNG } from './random.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Vehicle, spawnParkedCars } from './vehicle.js';
import { TrafficSystem } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Effects } from './effects.js';
import { AudioSystem } from './audio.js';
import { SaveSystem } from './save.js';
import { HUD } from './hud.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { Garage } from './garage.js';
import { setupShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') ? parseInt(params.get('shot'), 10) : 0;
const SEED = params.get('seed') ? parseInt(params.get('seed'), 10) : 7;
const rng = new RNG(SEED);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x87b5d6, 220, 900);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
const hemi = new THREE.HemisphereLight(0xbdd7ee, 0x3d5a3a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
sun.position.set(180, 260, 120);
scene.add(sun);
const moon = new THREE.DirectionalLight(0x8fa8ff, 0.0);
moon.position.set(-140, 220, -80);
scene.add(moon);

// ---- time of day: day / dusk / night lighting presets ----
let tod = 'day';
function setTimeOfDay(which) {
  tod = which;
  if (which === 'day') {
    scene.background.set(0x87b5d6); scene.fog.color.set(0x87b5d6);
    sun.intensity = 1.6; sun.color.set(0xfff2d0); sun.position.set(180, 260, 120);
    hemi.intensity = 0.9; moon.intensity = 0;
  } else if (which === 'dusk') {
    scene.background.set(0xef8a52); scene.fog.color.set(0xef8a52);
    sun.intensity = 1.9; sun.color.set(0xffb060); sun.position.set(-220, 200, 150);
    hemi.intensity = 1.5; hemi.color.set(0xe8a87c);
    moon.intensity = 0.12;
  } else {
    scene.background.set(0x0d1526); scene.fog.color.set(0x0d1526);
    sun.intensity = 0.12; sun.color.set(0x8fa8ff); sun.position.set(-140, 220, -80);
    hemi.intensity = 0.9; hemi.color.set(0x2a3a5f);
    moon.intensity = 1.4;
  }
  return tod;
}
const TOD_LABEL = { day: 'DAY · 13:40', dusk: 'DUSK · 19:05', night: 'NIGHT · 23:20' };

// ---- build the world and all systems ----
const world = new World(scene, SEED);
const player = new Player(scene, 0, 40);
const parked = spawnParkedCars(scene, world, new RNG(SEED + 11), 26);
const traffic = new TrafficSystem(scene, world, SEED + 22);
traffic.spawn(18);
const peds = new Pedestrians(scene, world, SEED + 33);
peds.spawn(26);
const police = new Police(scene, world, SEED + 44);
const combat = new Combat(scene, world);
const missions = new Missions(scene, world, SEED + 55);
const effects = new Effects(scene);
const audio = new AudioSystem();
const save = new SaveSystem();
const hud = new HUD(document);
const cam = new CameraRig(camera);
const input = new Input(document);
const garage = new Garage(save, scene, world);

// restore save into the live session
missions.cash = save.data.cash;
missions.owned = { ...save.data.owned };
missions.done = [...save.data.done];
for (const p of missions.packages.slice(0, save.data.packagesTaken)) { p.taken = true; p.mesh.visible = false; }

let state = 'menu'; // menu | playing | paused | busted | wasted
let missionsDoneSeen = missions.done.length;
let saveTimer = 0;
let frames = 0;
let shotTimer = 0;
window.__gameReady = false;
window.__shotReady = false;

// ---- DOM screens ----
const $ = (id) => document.getElementById(id);
function showScreen(name) {
  for (const s of ['menu', 'pause', 'busted', 'wasted']) $(`screen-${s}`).classList.toggle('hidden', s !== name);
  $('hud').classList.toggle('hidden', name === 'menu');
}
function startGame() {
  audio.init(); audio.resume();
  showScreen(null);
  state = 'playing';
  hud.banner('MARISOL BAY — take the city, district by district');
  cam.snapBehind(player, false);
}
function toMenu() {
  state = 'menu';
  showScreen('menu');
  $('menu-continue').classList.toggle('hidden', missions.done.length === 0 && missions.cash <= 150);
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  showScreen('pause');
  renderMissionList();
  garage.renderList(document);
  persist();
}
function resumeGame() {
  if (state !== 'paused') return;
  audio.resume();
  showScreen(null);
  state = 'playing';
}
function endRun(kind) {
  state = kind; // 'busted' | 'wasted'
  showScreen(kind);
  const fine = Math.floor(missions.cash * 0.1);
  missions.cash -= fine;
  if (kind === 'busted') { police.clearWanted(); $( 'busted-text').textContent = `The MBPD took you in. Bail: $${fine}. Turf held.`; }
  else $( 'wasted-text').textContent = `Milo got dropped. Hospital bill: $${fine}. Turf held.`;
  audio.busted();
  persist();
}
function respawn() {
  player.heal(100);
  player.ammo = CONFIG.player.pistolAmmo;
  if (player.vehicle) { player.exitVehicle(); }
  player.pos.set(-260, 0, 240);
  player.heading = 0;
  player.group.position.copy(player.pos);
  police.clearWanted();
  combat.clearEnemies();
  showScreen(null);
  state = 'playing';
  cam.snapBehind(player, false);
  hud.banner('Back on the streets — Rico patched you up');
}
function persist() {
  save.save({
    cash: Math.floor(missions.cash),
    owned: missions.owned,
    done: missions.done,
    packagesTaken: missions.packages.filter((p) => p.taken).length,
    bestTurf: Math.max(save.data.bestTurf, missions.ownedCount),
    missionsCompleted: missions.done.length,
    totalEarned: save.data.totalEarned,
  });
}
function renderMissionList() {
  const list = $('mission-list');
  if (!list) return;
  list.innerHTML = '';
  for (const m of missions.availableMissions()) {
    const row = document.createElement('div');
    row.className = 'mission-row';
    row.innerHTML = `<b>${m.title}</b> — ${m.district} · $${m.pay}<br><span>${m.blurb}</span>`;
    row.addEventListener('click', () => {
      missions.startMission(m);
      missions.spawnCrewForStep(combat);
      resumeGame();
      hud.banner(`${m.title} — ${missions.currentObjective()}`);
      audio.pickup();
    });
    list.appendChild(row);
  }
  if (!missions.availableMissions().length) {
    list.innerHTML = '<div class="mission-row">No missions open — drive, earn, and come back.</div>';
  }
  $('turf-count').textContent = `Turf owned: ${missions.ownedCount}/6 · Packages left: ${missions.packagesLeft}`;
}

// menu buttons
$('btn-start').addEventListener('click', startGame);
$('btn-continue').addEventListener('click', startGame);
$('btn-garage').addEventListener('click', () => { garage.renderList(document); $('garage-panel').classList.toggle('hidden'); });
$('btn-options').addEventListener('click', () => { $('options-panel').classList.toggle('hidden'); });
$('btn-resume').addEventListener('click', resumeGame);
$('btn-quit').addEventListener('click', toMenu);
$('btn-respawn').addEventListener('click', respawn);
$('btn-respawn2').addEventListener('click', respawn);
$('btn-callcar').addEventListener('click', () => {
  const v = garage.callCar(player.position, player.heading);
  parked.push(v);
  resumeGame();
  hud.toast(`${CONFIG.vehicles[v.type].name} delivered nearby`);
});
$('opt-volume').addEventListener('input', (e) => { audio.setVolume(parseFloat(e.target.value)); save.data.options.volume = parseFloat(e.target.value); });
$('opt-mute').addEventListener('change', (e) => { audio.setMuted(e.target.checked); });
$('opt-quality').addEventListener('change', (e) => {
  renderer.setPixelRatio(e.target.value === 'low' ? 1 : Math.min(window.devicePixelRatio, 2));
});

// ---- interaction helpers ----
function nearestParked(maxD = 4.5) {
  let best = null, bd = Infinity;
  for (const v of parked) {
    if (v.wrecked) continue;
    const d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z);
    if (d < bd) { bd = d; best = v; }
  }
  return bd < maxD ? best : null;
}
function tryEnterCar() {
  const car = nearestParked();
  if (!car) return false;
  const nearCop = police.cops.some((c) => Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 30)
    || police.cruisers.some((c) => Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 30);
  player.enterVehicle(car);
  cam.snapBehind(player, true);
  police.addHeat(CONFIG.wanted.heatPerCarjack);
  if (nearCop) police.addHeat(CONFIG.wanted.heatPerCarjack);
  hud.toast(`Jacked the ${car.spec.name}`);
  audio.blip(440, 0.1, 'square', 0.12);
  return true;
}

// ---- shot mode: stage the scene, hide the menu, auto-play ----
if (SHOT) {
  document.body.classList.add('shot');
  showScreen(null);
  state = 'playing';
  setupShot(SHOT, {
    scene, world, player, parked, traffic, peds, police, combat, missions,
    hud, camera: cam, rng, seed: SEED, setTimeOfDay,
  });
} else {
  setTimeOfDay('day');
  showScreen('menu');
}

// ---- main loop ----
const clock = new THREE.Clock();
let lastHud = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (state === 'playing') {
    // pause keys
    if (input.consume('KeyP') || input.consume('Escape')) { pauseGame(); }
    // enter / exit car
    if (input.consume('KeyE')) {
      if (player.onFoot) tryEnterCar();
      else { player.exitVehicle(); cam.snapBehind(player, false); }
    }
    // punch / shoot
    if (input.consume('KeyF') && player.onFoot) {
      const hit = combat.punch(player, peds, police, effects);
      if (hit) {
        if (hit.kind === 'ped') police.addHeat(CONFIG.wanted.heatPerPedHit);
        if (hit.kind === 'enemy') {
          const step = missions.active && missions.active.steps[missions.active.idx];
          if (step && step.type === 'turf') {
            step.got = combat.enemies.filter((e) => !e.alive).length;
            step.label = `${step.label.split('(')[0]}(${step.got}/${step.count})`;
            if (step.got >= step.count) { missions.completeStep(); hud.toast('Crew dropped — turf is yours'); }
          }
        }
        peds.scare(player.pos, 20);
        cam.addShake(0.15);
      }
    }
    if (player.onFoot && (input.mouseDown || input.keys.Space) && player.armed) {
      const r = combat.shoot(player, camera, peds, police, traffic, effects, audio);
      if (r && r.kind !== 'miss') {
        if (r.kind === 'ped') police.addHeat(CONFIG.wanted.heatPerPedHit);
        if (r.kind === 'cop') peds.scare(player.pos, 24);
        if (r.kind === 'enemy') {
          const step = missions.active && missions.active.steps[missions.active.idx];
          if (step && step.type === 'turf') {
            step.got = combat.enemies.filter((e) => !e.alive).length;
            step.label = `${step.label.split('(')[0]}(${step.got}/${step.count})`;
            if (step.got >= step.count) { missions.completeStep(); hud.toast('Crew dropped — turf is yours'); }
          }
        }
        police.addHeat(CONFIG.wanted.heatPerShot);
        peds.scare(player.pos, 26);
        cam.addShake(0.25);
      }
    }

    // --- update the world ---
    if (player.onFoot) {
      const f = input.foot();
      player.update(dt, { ...f, dt }, world);
      // pick up packages on foot
      const got = missions.collectPackageAt(player.pos);
      if (got) { hud.toast(`Hidden package +$${CONFIG.economy.packageValue}`); audio.pickup(); }
    } else {
      const d = input.drive();
      const v = player.vehicle;
      const prevSpeed = v.speed;
      v.update(dt, { ...d, dt }, world, effects);
      if (Math.abs(v.speed) > 12 && Math.abs(prevSpeed - v.speed) > 9) cam.addShake(0.3);
      // hit peds / traffic with the car
      const hitPed = peds.hitAt(v.pos, 2.6);
      if (hitPed && Math.abs(v.speed) > 5) {
        police.addHeat(CONFIG.wanted.heatPerPedHit);
        peds.scare(v.pos, 26);
        cam.addShake(0.3);
      }
      const crashed = traffic.crashAt(v.pos, 5);
      if (crashed && Math.abs(v.speed) > 10) {
        v.damage(12, effects);
        effects.sparks(v.pos.x, 1, v.pos.z, 10);
        cam.addShake(0.5);
        audio.noiseBurst(0.2, 0.25, 900);
      }
      if (v.wrecked) {
        effects.explosion(v.pos.x, 1, v.pos.z);
        player.takeDamage(25);
        player.exitVehicle();
        parked.splice(parked.indexOf(v), 1);
        v.remove();
        cam.addShake(1);
        hud.banner('Your ride is wrecked');
      }
      const got = missions.collectPackageAt(v.pos, 3);
      if (got) { hud.toast(`Hidden package +$${CONFIG.economy.packageValue}`); audio.pickup(); }
    }

    traffic.update(dt, player.position);
    peds.update(dt);
    police.update(dt, player, effects);
    combat.update(dt, player, effects, audio);
    effects.update(dt);
    audio.update(player.onFoot ? 0 : (player.vehicle ? player.vehicle.speed : 0), police.stars, !player.onFoot);

    // missions
    const ev = missions.update(dt, {
      playerPos: player.position,
      inVehicle: !player.onFoot,
      wanted: police.stars,
      collectAt: (pos, r) => missions.collectCrates(pos, r),
    });
    if (ev === 'step') { hud.toast('Objective complete'); audio.pickup(); }
    if (ev === 'failed') { hud.banner('Mission failed — the window closed'); audio.busted(); }
    if (missions.done.length > missionsDoneSeen) {
      missionsDoneSeen = missions.done.length;
      hud.banner(`MISSION COMPLETE — $${missions.done.length ? CONFIG.missions.find((m) => m.id === missions.done[missions.done.length - 1]).pay : 0} banked`);
      audio.missionDone();
      persist();
    }

    // busted / wasted
    if (police.busted) { police.busted = false; endRun('busted'); }
    if (player.dead) endRun('wasted');

    // camera + HUD
    const target = { pos: player.position, heading: player.onFoot ? player.heading : player.vehicle.heading };
    cam.update(dt, target, !player.onFoot, player.onFoot ? 0 : player.vehicle.speed);
    if (t - lastHud > 0.1) {
      lastHud = t;
      const marker = missions.active ? missions.active.steps[missions.active.idx].pos : null;
      hud.update({
        stars: police.stars,
        cash: missions.cash,
        turf: missions.ownedCount,
        owned: missions.ownedCount,
        ownedDistricts: Object.keys(missions.owned),
        health: player.health,
        ammo: player.ammo,
        armed: player.armed,
        speed: player.onFoot ? player.speed : player.vehicle.speed,
        objective: missions.currentObjective(),
        district: districtAt(player.position.x, player.position.z).name,
        todLabel: TOD_LABEL[tod],
        marker,
        police: [...police.cruisers.map((c) => c.pos), ...police.cops.map((c) => c.pos)],
        playerX: player.position.x,
        playerZ: player.position.z,
        heading: player.onFoot ? player.heading : player.vehicle.heading,
      });
    }

    // autosave
    saveTimer += dt;
    if (saveTimer > 30) { saveTimer = 0; persist(); }
  }

  renderer.render(scene, camera);
  frames++;
  if (!window.__gameReady && frames >= 2) window.__gameReady = true;
  if (SHOT && !window.__shotReady) {
    shotTimer += dt;
    if (shotTimer > 1.6 && frames > 10) window.__shotReady = true;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
