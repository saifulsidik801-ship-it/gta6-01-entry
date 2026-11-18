// MARISOL BAY — vehicle.js
// One job: cars. Building a car mesh from boxes, arcade driving
// physics (accelerate, steer, brake, skid), entering and exiting,
// stealing parked cars, and the parked-car spawner that fills the city.
import * as THREE from 'three';
import { VEHICLES, CFG } from './config.js';
import { clamp, angleDiff } from './random.js';
import { hitsBuilding } from './world.js';

export function buildCarMesh(type, colorHex) {
  const def = VEHICLES[type] || VEHICLES.sedan;
  const color = colorHex !== undefined ? colorHex : def.color;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const len = type === 'truck' ? 6.4 : type === 'van' ? 5.6 : 4.6;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, len), bodyMat);
  body.position.y = 0.75; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.75, len * (type === 'truck' ? 0.32 : 0.5)),
    type === 'taxi' ? new THREE.MeshLambertMaterial({ color: 0xffe9a8 }) : darkMat);
  cabin.position.set(0, 1.5, type === 'truck' ? len * 0.28 : -len * 0.08); cabin.castShadow = true; g.add(cabin);
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0xffc21c }));
    sign.position.set(0, 2.05, -len * 0.08); g.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.28, 0.6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    bar.position.set(0, 2.0, -len * 0.08); g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.28, 0.6), new THREE.MeshBasicMaterial({ color: 0x2f7bff }));
    bar2.position.set(0, 2.0, len * 0.12); g.add(bar2);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, len * 0.32], [1.0, len * 0.32], [-1.0, -len * 0.32], [1.0, -len * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w); wheels.push(w);
  }
  // headlights so night driving reads in screenshots
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const wx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), lightMat);
    h.position.set(wx, 0.8, len / 2 + 0.03); g.add(h);
  }
  g.userData = { wheels, len };
  return g;
}

export function makeCar(G, type, x, z, angle, colorHex) {
  const def = VEHICLES[type] || VEHICLES.sedan;
  const mesh = buildCarMesh(type, colorHex);
  mesh.position.set(x, 0, z); mesh.rotation.y = angle;
  G.scene.add(mesh);
  const car = {
    type, def, mesh, pos: mesh.position, angle, speed: 0,
    steer: 0, parked: true, driver: null, id: G.cars.length,
    siren: type === 'police', ai: false, targetSpeed: 0,
  };
  G.cars.push(car);
  return car;
}

// Parked, stealable cars dotted along the roads. The player starts on
// foot next to one, so the first steal is thirty seconds in.
export function spawnParkedCars(G) {
  const rng = G.rng;
  const types = ['sedan', 'sedan', 'taxi', 'sport', 'van', 'truck', 'sedan', 'taxi'];
  const half = CFG.citySize / 2;
  for (let i = 0; i < 16; i++) {
    const road = G.world.roads[Math.floor(rng() * G.world.roads.length)];
    const along = (rng() * 2 - 1) * (half - 24);
    const horizontal = rng() < 0.5;
    const x = horizontal ? along : road + 5.5;
    const z = horizontal ? road + 5.5 : along;
    const type = types[i % types.length];
    makeCar(G, type, x, z, horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2));
  }
}

// Arcade driving: W/S throttle, A/D steer, Space handbrake, Shift boost.
// Collisions are simple: buildings and the city edge stop the car.
export function updateCar(G, car, dt, throttle, steerInput) {
  const def = car.def;
  const accel = throttle * def.accel;
  car.speed += accel * dt;
  car.speed -= car.speed * (throttle === 0 ? 1.4 : 0.25) * dt; // drag + rolling resistance
  car.speed = clamp(car.speed, -def.top * 0.45, def.top);
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
  const steerTarget = steerInput * 0.55 * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.angle += car.steer * (car.speed / def.top) * 2.4 * dt * (car.speed >= 0 ? 1 : -1) * -1;
  // Forward is the car's local +Z after rotation.y, i.e. (sin a, cos a).
  const nx = car.pos.x + Math.sin(car.angle) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.angle) * car.speed * dt;
  const half = CFG.citySize / 2 + 8;
  let blocked = false;
  if (Math.abs(nx) > half || Math.abs(nz) > half + 40) blocked = true;
  if (!blocked && hitsBuilding(G.world, nx, nz, 1.4)) blocked = true;
  if (blocked) {
    if (Math.abs(car.speed) > 12) { G.effects.sparks(car.pos.x, 1, car.pos.z, 8); G.audio.crash(); }
    car.speed *= -0.25;
  } else {
    car.pos.x = nx; car.pos.z = nz;
  }
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.angle;
  // skid smoke + wheel spin
  const skidding = Math.abs(car.steer) > 0.4 && Math.abs(car.speed) > 14;
  if (skidding && Math.random() < 0.6) G.effects.smoke(car.pos.x, 0.3, car.pos.z, 2);
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
  return skidding;
}

export function nearestCar(G, x, z, maxDist) {
  let best = null, bd = maxDist || 5;
  for (const c of G.cars) {
    const d = Math.hypot(c.pos.x - x, c.pos.z - z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
