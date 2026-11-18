// Marisol Bay — wanted level and the police.
// One clear job: stars 0–5, crimes that raise them, police cars that chase
// and ram, foot cops who arrest, and the slow cool-down when the player hides.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createVehicle, driveVehicle } from './vehicle.js';
import { buildPedMesh } from './pedestrians.js';
import { damagePlayer } from './player.js';

const WANTED_DECAY = 0.02;   // stars lost per second while hidden
const MAX_COP_CARS = 5;

export function createPolice(G) {
  const police = {
    copCars: [],
    footCops: [],
    bustT: 0,
    hiddenT: 0,
    addWanted(G, stars, reason) {
      const before = G.wanted;
      G.wanted = Math.min(CONFIG.maxWanted, G.wanted + stars);
      if (G.wanted > before) {
        G.hud.toast(`WANTED +${stars} — ${reason}`);
        G.audio.siren(true);
        police.hiddenT = 0;
      }
    },
    lowerWanted(G, stars) {
      G.wanted = Math.max(0, G.wanted - stars);
      if (G.wanted === 0) G.audio.siren(false);
    },
  };
  return police;
}

function spawnCopCar(G) {
  const p = G.player;
  const px = p.onFoot ? p.pos.x : p.vehicle.pos.x;
  const pz = p.onFoot ? p.pos.z : p.vehicle.pos.z;
  const a = Math.random() * Math.PI * 2;
  const x = px + Math.cos(a) * 90;
  const z = pz + Math.sin(a) * 90;
  const car = createVehicle(G.scene, 'police', x, z, Math.atan2(px - x, pz - z), undefined);
  car.driver = 'police';
  car.parked = false;
  car.speed = 20;
  car.cruise = 30 + G.wanted * 3;
  G.police.copCars.push(car);
  G.copCars.push(car);
  return car;
}

function spawnFootCop(G) {
  const p = G.player;
  const a = Math.random() * Math.PI * 2;
  const mesh = buildPedMesh(0x1a2a4a);
  // A dark cap marks the uniform.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44),
    new THREE.MeshLambertMaterial({ color: 0x0a1428 }));
  cap.position.y = 2.1;
  mesh.add(cap);
  const x = p.pos.x + Math.cos(a) * 26;
  const z = p.pos.z + Math.sin(a) * 26;
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const cop = { mesh, pos: mesh.position, angle: 0, speed: 6.5, phase: 0, arrestT: 0 };
  G.police.footCops.push(cop);
  return cop;
}

export function updatePolice(G, dt) {
  const police = G.police;
  const p = G.player;
  const px = p.onFoot ? p.pos.x : (p.vehicle ? p.vehicle.pos.x : 0);
  const pz = p.onFoot ? p.pos.z : (p.vehicle ? p.vehicle.pos.z : 0);
  const playerSpeed = p.onFoot ? p.speed : (p.vehicle ? Math.abs(p.vehicle.speed) : 0);

  // --- Spawn pressure follows the wanted level.
  const wantCars = G.wanted === 0 ? 0 : Math.min(MAX_COP_CARS, 1 + Math.floor(G.wanted / 2));
  while (police.copCars.length < wantCars) spawnCopCar(G);
  if (G.wanted >= 2 && p.onFoot && police.footCops.length < Math.min(4, G.wanted - 1)) {
    spawnFootCop(G);
  }

  // --- Police cars chase and ram.
  for (let i = police.copCars.length - 1; i >= 0; i--) {
    const car = police.copCars[i];
    const dx = px - car.pos.x; const dz = pz - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (G.wanted === 0 && dist > 120) {
      // Heat gone and far away: the unit gives up and drives off.
      G.scene.remove(car.mesh);
      police.copCars.splice(i, 1);
      const gi = G.copCars.indexOf(car);
      if (gi >= 0) G.copCars.splice(gi, 1);
      continue;
    }
    const wantAngle = Math.atan2(dx, dz);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 1.6));
    const throttle = dist > 8 ? 1 : 0.4;
    driveVehicle(G, car, { throttle, steer, brake: false }, dt);
    // Ram the player's car: damage + slow it.
    if (p.vehicle && dist < 4.5) {
      p.vehicle.speed *= 0.92;
      if (Math.abs(p.vehicle.speed) > 10 && Math.random() < dt * 2) {
        G.effects.sparks(car.pos.x, 1, car.pos.z, 6);
        G.audio.thud();
      }
    }
    // Ram the player on foot: arrest clock.
    if (p.onFoot && dist < 3.2) {
      police.bustT += dt;
      if (police.bustT > 2.5) {
        bustPlayer(G);
        return;
      }
    }
  }

  // --- Foot cops run the player down and arrest on contact.
  for (let i = police.footCops.length - 1; i >= 0; i--) {
    const cop = police.footCops[i];
    const dx = px - cop.pos.x; const dz = pz - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    if (G.wanted === 0) {
      G.scene.remove(cop.mesh);
      police.footCops.splice(i, 1);
      continue;
    }
    cop.angle = Math.atan2(dx, dz);
    cop.pos.x += Math.sin(cop.angle) * cop.speed * dt;
    cop.pos.z += Math.cos(cop.angle) * cop.speed * dt;
    cop.phase += dt * 8;
    cop.mesh.rotation.y = cop.angle;
    cop.mesh.userData.legL.rotation.x = Math.sin(cop.phase) * 0.6;
    cop.mesh.userData.legR.rotation.x = -Math.sin(cop.phase) * 0.6;
    if (p.onFoot && dist < 2.2) {
      cop.arrestT += dt;
      if (cop.arrestT > 1.5) { bustPlayer(G); return; }
    } else {
      cop.arrestT = 0;
    }
  }

  // --- Cool-down: hidden (far from every cop, slow, no new crime) loses heat.
  let nearestCop = Infinity;
  for (const car of police.copCars) nearestCop = Math.min(nearestCop, Math.hypot(car.pos.x - px, car.pos.z - pz));
  for (const cop of police.footCops) nearestCop = Math.min(nearestCop, Math.hypot(cop.pos.x - px, cop.pos.z - pz));
  if (G.wanted > 0 && nearestCop > 70 && playerSpeed < 6) {
    police.hiddenT += dt;
    if (police.hiddenT > 6) {
      G.wanted = Math.max(0, G.wanted - WANTED_DECAY * dt * 10);
      if (G.wanted < 1) police.lowerWanted(G, 1);
    }
  } else {
    police.hiddenT = 0;
  }
  if (G.wanted > 0) G.audio.siren(true);
}

export function bustPlayer(G) {
  const p = G.player;
  if (p.vehicle) {
    p.vehicle.driver = null;
    p.vehicle.speed = 0;
    p.vehicle = null;
    p.onFoot = true;
    p.mesh.visible = true;
    p.mesh.position.copy(p.pos);
  }
  G.save.cash = Math.max(0, G.save.cash - 100);
  G.cash = G.save.cash;
  G.wanted = 0;
  G.police.bustT = 0;
  G.audio.siren(false);
  G.audio.engine(0, false);
  G.hud.toast('BUSTED — $100 bail paid');
  G.mode = 'busted';
}
