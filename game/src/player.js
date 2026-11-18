// Marisol Bay — Milo Kade on foot.
// One clear job: the on-foot character — walk/run, face movement, enter and
// exit cars, take damage, and play the walk-cycle animation.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { collideCircle } from './world.js';
import { nearestCar, driveVehicle } from './vehicle.js';

export function buildPlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2f6fb5 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  // Legs.
  const legGeo = new THREE.BoxGeometry(0.26, 0.85, 0.26);
  const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.16, 0.43, 0);
  const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.16, 0.43, 0);
  // Torso.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirt);
  torso.position.y = 1.28;
  // Arms.
  const armGeo = new THREE.BoxGeometry(0.2, 0.75, 0.2);
  const armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.48, 1.3, 0);
  const armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.48, 1.3, 0);
  // Head + hair + cap.
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.95;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), hair);
  cap.position.y = 2.18;
  group.add(legL, legR, torso, armL, armR, head, cap);
  group.userData = { legL, legR, armL, armR, torso };
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = buildPlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh, pos: mesh.position,
    angle: 0, speed: 0,
    health: CONFIG.playerHealth,
    onFoot: true, vehicle: null,
    walkPhase: 0, hurtT: 0, dead: false,
  };
}

// On-foot step. `camYaw` is the camera heading the player moves relative to.
export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (fwd === 0 && strafe === 0) {
    p.speed = 0;
  } else {
    const target = input.run ? CONFIG.playerRunSpeed : CONFIG.playerWalkSpeed;
    p.speed = target;
    const yaw = G.cameraYaw;
    const mx = Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
    const mz = Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;
    const len = Math.hypot(mx, mz) || 1;
    p.pos.x += (mx / len) * p.speed * dt;
    p.pos.z += (mz / len) * p.speed * dt;
    p.angle = Math.atan2(mx, mz);
    p.walkPhase += dt * p.speed * 1.6;
    collideCircle(G.world, p.pos, 0.7);
  }
  p.mesh.rotation.y = p.angle;
  const u = p.mesh.userData;
  const swing = p.speed > 0 ? Math.sin(p.walkPhase) * 0.55 : 0;
  u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8; u.armR.rotation.x = swing * 0.8;
  u.torso.position.y = 1.28 + (p.speed > 0 ? Math.abs(Math.sin(p.walkPhase)) * 0.06 : 0);
  if (p.hurtT > 0) p.hurtT -= dt;
}

// Try to enter the nearest car (E). Stealing a parked car is a crime.
export function tryEnterCar(G) {
  const p = G.player;
  if (!p.onFoot) return false;
  const car = nearestCar(G.parkedCars, p.pos.x, p.pos.z, 4.5);
  if (!car) return false;
  p.onFoot = false;
  p.vehicle = car;
  car.driver = 'player';
  car.parked = false;
  p.mesh.visible = false;
  G.audio.blip(220, 0.1, 'square', 0.15);
  if (!car.wasStolen) {
    car.wasStolen = true;
    G.save.stats.carsStolen++;
    G.police.addWanted(G, 1, 'Car stolen');
  }
  return true;
}

// Step out of the car (E) next to it.
export function exitCar(G) {
  const p = G.player;
  if (p.onFoot || !p.vehicle) return false;
  const car = p.vehicle;
  car.driver = null;
  car.speed = 0;
  p.vehicle = null;
  p.onFoot = true;
  p.mesh.visible = true;
  const side = Math.cos(car.angle);
  const sideX = Math.sin(car.angle + Math.PI / 2);
  const sideZ = Math.cos(car.angle + Math.PI / 2);
  p.pos.set(car.pos.x + sideX * 2.6, 0, car.pos.z + sideZ * 2.6);
  p.angle = car.angle;
  p.mesh.rotation.y = p.angle;
  collideCircle(G.world, p.pos, 0.7);
  return true;
}

// Driving step for the player's car.
export function updatePlayerDriving(G, dt) {
  const p = G.player;
  const car = p.vehicle;
  if (!car) return;
  const input = G.input;
  const ctrl = {
    throttle: (input.forward ? 1 : 0) - (input.back ? 0.6 : 0),
    steer: (input.left ? 1 : 0) - (input.right ? 1 : 0),
    brake: input.back,
  };
  const before = car.speed;
  driveVehicle(G, car, ctrl, dt);
  // Skid smoke + sound when cornering hard at speed.
  if (Math.abs(ctrl.steer) > 0.5 && Math.abs(car.speed) > 18 && Math.random() < 0.4) {
    G.effects.smoke(car.pos.x - Math.sin(car.angle) * 1.5, 0.3, car.pos.z - Math.cos(car.angle) * 1.5, 2);
  }
  G.audio.engine(Math.abs(car.speed) / car.spec.top, true);
  // Hitting a pedestrian at speed is a crime; hitting a cop is a bigger one.
  for (const ped of G.peds) {
    if (ped.down) continue;
    const dx = ped.pos.x - car.pos.x; const dz = ped.pos.z - car.pos.z;
    if (dx * dx + dz * dz < 3.2 * 3.2 && Math.abs(car.speed) > 6) {
      ped.down = true; ped.mesh.rotation.z = Math.PI / 2; ped.mesh.position.y = 0.4;
      G.police.addWanted(G, 1, 'Pedestrian hit');
      G.effects.sparks(ped.pos.x, 1, ped.pos.z, 8);
      G.audio.thud();
    }
  }
  return before;
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.dead || p.hurtT > 0) return;
  p.health -= amount;
  p.hurtT = 0.6;
  G.hud.flashDamage();
  G.audio.thud();
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    G.mode = 'wasted';
    G.audio.siren(false);
    G.audio.engine(0, false);
  }
}
