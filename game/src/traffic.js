// Marisol Bay — traffic.
// One clear job: cars that drive the road grid like citizens — lane offset,
// turns at intersections, slowing for the car ahead — so the streets feel
// alive from the kerb and from behind the wheel.
import { CONFIG, nearestRoadCoord, roadCoord } from './config.js';
import { createVehicle, driveVehicle } from './vehicle.js';
import { mulberry32 } from './random.js';

export function createTraffic(scene, rng, count) {
  const cars = [];
  const types = ['sedan', 'taxi', 'van', 'sedan', 'truck', 'sedan'];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const road = roadCoord(Math.floor(rng() * 9));
    const along = roadCoord(Math.floor(rng() * 9));
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = dir > 0 ? 3.2 : -3.2;
    const x = vertical ? road + lane : along;
    const z = vertical ? along : road + lane;
    const angle = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = createVehicle(scene, types[Math.floor(rng() * types.length)], x, z, angle, undefined);
    car.driver = 'traffic';
    car.parked = false;
    car.speed = 8 + rng() * 8;
    car.cruise = car.speed;
    car.turnT = rng() * 3;
    cars.push(car);
  }
  return cars;
}

function carAhead(G, car, dist) {
  const fx = Math.sin(car.angle); const fz = Math.cos(car.angle);
  let nearest = null; let best = dist;
  const all = [...G.traffic, ...G.parkedCars, ...G.copCars];
  for (const other of all) {
    if (other === car) continue;
    const dx = other.pos.x - car.pos.x; const dz = other.pos.z - car.pos.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < best && side < 3) { best = along; nearest = other; }
  }
  // The player on foot in front of a car makes it brake too.
  if (G.player.onFoot) {
    const dx = G.player.pos.x - car.pos.x; const dz = G.player.pos.z - car.pos.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < best && side < 2.5) { best = along; nearest = 'player'; }
  }
  return nearest ? best : null;
}

export function updateTraffic(G, dt) {
  for (const car of G.traffic) {
    car.turnT = Math.max(0, (car.turnT || 0) - dt);
    // Slow for the car (or person) ahead.
    const ahead = carAhead(G, car, 16);
    const target = ahead !== null ? Math.max(0, car.cruise * (ahead / 16)) : car.cruise;
    const ctrl = {
      throttle: target > car.speed ? Math.min(1, target / car.spec.top + 0.05) : 0,
      steer: 0,
      brake: target < car.speed - 2,
    };
    driveVehicle(G, car, ctrl, dt);
    // At an intersection, sometimes turn onto the cross street.
    const nearX = Math.abs(car.pos.x - nearestRoadCoord(car.pos.x)) < 1.2;
    const nearZ = Math.abs(car.pos.z - nearestRoadCoord(car.pos.z)) < 1.2;
    if (nearX && nearZ && car.turnT <= 0 && Math.random() < dt * 0.25) {
      const turn = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.angle += turn;
      car.mesh.rotation.y = car.angle;
      car.turnT = 3;
      // Re-centre on the new road with the right lane offset.
      const fx = Math.sin(car.angle); const fz = Math.cos(car.angle);
      car.pos.x = nearestRoadCoord(car.pos.x) + fz * 3.2;
      car.pos.z = nearestRoadCoord(car.pos.z) + fx * 3.2;
    }
    // Wrap around the city edge so traffic never runs out.
    if (car.pos.x > 310) car.pos.x = -310;
    if (car.pos.x < -310) car.pos.x = 310;
    if (car.pos.z > 310) car.pos.z = -310;
    if (car.pos.z < -310) car.pos.z = 310;
  }
}
