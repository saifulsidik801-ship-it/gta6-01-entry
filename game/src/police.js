// MARISOL BAY — police.js
// One job: the wanted system. Stars 0–5, police cars that ram and
// foot cops that chase, both scaling with the wanted level; heat
// decays when Milo stays out of sight, and getting caught costs cash.
// Taking turf is what raises the heat in the first place.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, angleDiff } from './random.js';
import { makeCar, updateCar } from './vehicle.js';
import { damagePlayer } from './player.js';

export function createPolice(G) {
  return { cars: [], cops: [], sirenAt: 0, heatTimer: 0, hiddenTimer: 0 };
}

export function addWanted(G, stars, reason) {
  const before = G.wanted;
  G.wanted = clamp(G.wanted + stars, 0, CFG.maxWanted);
  if (G.wanted > before) {
    G.hud.flash(`WANTED ${'★'.repeat(G.wanted)} — ${reason || 'the law is coming'}`);
    G.audio.siren();
    spawnPolice(G);
  }
  G.police.hiddenTimer = 0;
}

export function spawnPolice(G) {
  const P = G.police;
  const wantCars = Math.min(G.wanted, 4);
  const wantCops = G.wanted >= 2 ? Math.min(4, G.wanted) : 0;
  while (P.cars.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    const car = makeCar(G, 'police',
      G.player.pos.x + Math.sin(a) * 55, G.player.pos.z + Math.cos(a) * 55, a);
    car.parked = false; car.ai = true;
    P.cars.push(car);
  }
  while (P.cops.length < wantCops) {
    const cop = makeFootCop(G);
    P.cops.push(cop);
  }
}

function makeFootCop(G) {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), navy);
  body.position.y = 1.25; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.5), skin);
  head.position.y = 2.05; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.55), new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
  cap.position.y = 2.38; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), navy);
  legL.position.set(-0.22, 0.45, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
  const a = Math.random() * Math.PI * 2;
  g.position.set(G.player.pos.x + Math.sin(a) * 30, 0, G.player.pos.z + Math.cos(a) * 30);
  G.scene.add(g);
  return { mesh: g, pos: g.position, angle: 0, speed: 0, health: 50, legL, legR, phase: 0, hitAt: 0 };
}

export function updatePolice(G, dt) {
  const P = G.police;
  // sirens wail on a timer while wanted
  if (G.wanted > 0 && G.time - P.sirenAt > 4) { P.sirenAt = G.time; G.audio.siren(); }
  // heat decay: stay out of trouble and the stars fall away
  if (G.wanted > 0) {
    P.heatTimer += dt;
    const nearCop = P.cars.some((c) => Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < 25)
      || P.cops.some((c) => Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < 15);
    if (!nearCop) {
      P.hiddenTimer += dt;
      if (P.hiddenTimer > 14) { G.wanted -= 1; P.hiddenTimer = 0; G.hud.flash(`Heat cooling… wanted level ${G.wanted}`); }
    } else P.hiddenTimer = 0;
  }
  // police cars ram the player's car (or the player on foot)
  const target = G.player.car || null;
  for (const car of P.cars) {
    const dx = G.player.pos.x - car.pos.x, dz = G.player.pos.z - car.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantAngle = Math.atan2(dx, dz);
    car.angle += angleDiff(car.angle, wantAngle) * Math.min(1, dt * 2.2);
    const throttle = dist > 6 ? 1 : 0.2;
    updateCar(G, car, dt, throttle, 0);
    if (dist < 4.5) {
      if (target) {
        target.speed *= 0.6;
        G.effects.sparks(car.pos.x, 1, car.pos.z, 6);
        if (Math.abs(target.speed) > 10) G.audio.crash();
      } else if (G.player.onFoot) {
        damagePlayer(G, 12, 'busted');
        G.hud.flash('The cops grabbed you!');
      }
    }
  }
  // foot cops chase Milo on foot and try to grab him
  for (const cop of P.cops) {
    const dx = G.player.pos.x - cop.pos.x, dz = G.player.pos.z - cop.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    cop.angle = Math.atan2(dx, dz);
    const speed = G.wanted >= 4 ? 7.5 : 6;
    cop.pos.x += Math.sin(cop.angle) * speed * dt;
    cop.pos.z += Math.cos(cop.angle) * speed * dt;
    cop.mesh.position.copy(cop.pos);
    cop.mesh.rotation.y = cop.angle;
    cop.phase += dt * 11;
    cop.legL.rotation.x = Math.sin(cop.phase) * 0.6;
    cop.legR.rotation.x = -Math.sin(cop.phase) * 0.6;
    if (dist < 1.6 && G.player.onFoot && G.time - cop.hitAt > 1) {
      cop.hitAt = G.time;
      damagePlayer(G, 8, 'busted');
    }
    // a cop that falls too far behind despawns; a fresh one spawns later
    if (dist > 120) { cop.dead = true; }
  }
  // sweep the dead
  for (let i = P.cops.length - 1; i >= 0; i--) {
    if (P.cops[i].dead) { G.scene.remove(P.cops[i].mesh); P.cops.splice(i, 1); }
  }
  // no wanted level, no police: clear the streets
  if (G.wanted === 0) {
    for (const car of P.cars) { car.ai = false; car.parked = true; }
    P.cars.length = 0;
    for (const cop of P.cops) G.scene.remove(cop.mesh);
    P.cops.length = 0;
  }
}
