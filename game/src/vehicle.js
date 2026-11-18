// Marisol Bay — vehicles.
// One clear job: build car meshes (sedan, taxi, sport, truck, van, police)
// and drive them with simple arcade physics: accelerate, steer, brake,
// collide with buildings and other cars.
import * as THREE from 'three';
import { CONFIG, roadCoord } from './config.js';
import { collideCircle } from './world.js';

const CAR_COLORS = [0xc94f4f, 0x3f6fb5, 0xe8e8e8, 0x2f2f38, 0x7fae5a, 0xe0a458, 0x8a5fb5, 0x4fb5a8];

export const CAR_TYPES = {
  sedan:  { w: 2.0, l: 4.4, h: 0.75, top: 34, accel: 22, color: null },
  taxi:   { w: 2.0, l: 4.4, h: 0.75, top: 32, accel: 21, color: 0xf2c200, sign: true },
  sport:  { w: 2.1, l: 4.6, h: 0.6,  top: 46, accel: 30, color: 0xc22f2f, spoiler: true },
  truck:  { w: 2.4, l: 6.4, h: 1.5,  top: 26, accel: 15, color: 0x8a7a5c },
  van:    { w: 2.2, l: 5.2, h: 1.3,  top: 28, accel: 17, color: 0xb5c4cc },
  police: { w: 2.0, l: 4.5, h: 0.75, top: 40, accel: 27, color: 0x1a1a22, police: true },
};

export function buildCarMesh(type, colorHex) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const group = new THREE.Group();
  const bodyColor = colorHex ?? spec.color ?? CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.l), bodyMat);
  body.position.y = 0.55 + spec.h / 2 - 0.35;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.82, 0.62, spec.l * 0.48), darkMat);
  cabin.position.set(0, body.position.y + spec.h / 2 + 0.28, -spec.l * 0.06);
  group.add(cabin);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelPos = [
    [-spec.w / 2, 0.38, spec.l * 0.32], [spec.w / 2, 0.38, spec.l * 0.32],
    [-spec.w / 2, 0.38, -spec.l * 0.32], [spec.w / 2, 0.38, -spec.l * 0.32],
  ];
  const wheels = [];
  for (const [wx, wy, wz] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, wy, wz);
    group.add(w); wheels.push(w);
  }
  // Headlights + taillights (emissive so they read at night).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), headMat);
    head.position.set(sx * spec.w / 1.2, body.position.y, spec.l / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailMat);
    tail.position.set(sx * spec.w / 1.2, body.position.y + 0.1, -spec.l / 2 - 0.02);
    group.add(tail);
  }
  if (spec.sign) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(0, body.position.y + spec.h / 2 + 0.68, 0);
    group.add(sign);
  }
  if (spec.spoiler) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.95, 0.08, 0.5), bodyMat);
    sp.position.set(0, body.position.y + 0.55, -spec.l / 2 + 0.15);
    group.add(sp);
  }
  let lightBar = null;
  if (spec.police) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.4;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.4;
    lightBar.add(red); lightBar.add(blue);
    lightBar.position.set(0, body.position.y + spec.h / 2 + 0.66, 0);
    group.add(lightBar);
    group.userData.lightBar = lightBar;
  }
  group.userData.wheels = wheels;
  group.userData.type = type;
  return group;
}

// A drivable / AI car: mesh + arcade state.
export function createVehicle(scene, type, x, z, angle, colorHex) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const mesh = buildCarMesh(type, colorHex);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  scene.add(mesh);
  return {
    mesh, type, spec,
    pos: mesh.position,
    angle, speed: 0,
    steer: 0, parked: true, isPolice: type === 'police',
    driver: null, // 'player' | 'traffic' | 'police' | null
    flashT: 0,
  };
}

// Arcade drive step. `ctrl` = {throttle -1..1, steer -1..1, brake bool}.
// Returns true when the car hit a building this frame.
export function driveVehicle(G, car, ctrl, dt) {
  const spec = car.spec;
  const target = ctrl.throttle * spec.top;
  const accel = ctrl.throttle !== 0 ? spec.accel : 18;
  if (car.speed < target) car.speed = Math.min(target, car.speed + accel * dt);
  else if (car.speed > target) car.speed = Math.max(target, car.speed - (ctrl.brake ? CONFIG.carBrake : 14) * dt);
  if (Math.abs(car.speed) < 0.15 && ctrl.throttle === 0) car.speed = 0;
  const spd = Math.abs(car.speed);
  const steerAmount = ctrl.steer * CONFIG.carTurn * Math.min(1, spd / 10) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount * dt * (spd > 0.5 ? 1 : 0);
  const fx = Math.sin(car.angle);
  const fz = Math.cos(car.angle);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  car.mesh.rotation.y = car.angle;
  // Spin the wheels with speed.
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
  // Flash the police light bar.
  if (car.isPolice) {
    car.flashT += dt * 6;
    const bar = car.mesh.userData.lightBar;
    if (bar) bar.visible = Math.sin(car.flashT) > 0;
  }
  const hit = collideCircle(G.world, car.pos, 2.4);
  if (hit && spd > 8) {
    car.speed *= 0.45;
    G.effects.sparks(car.pos.x, 0.8, car.pos.z, 8);
    G.audio.thud();
  }
  return hit;
}

// Parked cars the player can steal, scattered along roads.
export function spawnParkedCars(G, rng, count) {
  const parked = [];
  const types = ['sedan', 'taxi', 'sport', 'van', 'truck', 'sedan', 'sedan'];
  for (let i = 0; i < count; i++) {
    const road = roadCoord(Math.floor(rng() * 9));
    const along = roadCoord(Math.floor(rng() * 9)) + (rng() - 0.5) * 40;
    const vertical = rng() < 0.5;
    const x = vertical ? road + (rng() < 0.5 ? -5 : 5) : along;
    const z = vertical ? along : road + (rng() < 0.5 ? -5 : 5);
    if (Math.abs(x) < 12 && Math.abs(z) < 12) continue; // keep the spawn plaza clear
    const type = types[Math.floor(rng() * types.length)];
    const car = createVehicle(G.scene, type, x, z, vertical ? 0 : Math.PI / 2, undefined);
    car.parked = true;
    parked.push(car);
  }
  return parked;
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null; let bestD = maxDist;
  for (const car of cars) {
    const dx = car.pos.x - x; const dz = car.pos.z - z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
