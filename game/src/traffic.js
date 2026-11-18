// Traffic — civilian cars that drive the road grid in lanes, slow for the
// player, turn at intersections, and honk (visually: brake lights) when cut
// off. Built on the same Vehicle mesh so the city reads as one fleet.
import * as THREE from '../vendor/three.module.min.js';
import { Vehicle } from './vehicle.js';
import { RNG } from './random.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'coupe', 'truck', 'sedan'];

export class TrafficSystem {
  constructor(scene, world, seed = 4242) {
    this.scene = scene;
    this.world = world;
    this.rng = new RNG(seed);
    this.cars = []; // {vehicle, axis:'x'|'z', road, dir:1|-1, lane, speed, targetSpeed}
  }

  spawn(count = 18) {
    for (let k = 0; k < count; k++) this.addCar();
  }

  addCar() {
    const rng = this.rng;
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const roads = [-500, -400, -300, -200, -100, 0, 100, 200, 300, 400, 500];
    const road = rng.pick(roads);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = dir > 0 ? 3.5 : -3.5;
    const along = rng.range(-480, 480);
    const x = axis === 'x' ? road + lane : along;
    const z = axis === 'x' ? along : road + lane;
    const heading = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const type = rng.pick(TRAFFIC_TYPES);
    const v = new Vehicle(this.scene, type, x, z, heading);
    const speed = rng.range(9, 15);
    this.cars.push({ vehicle: v, axis, road, dir, lane, speed, targetSpeed: speed });
  }

  // car directly ahead on the same lane, within `ahead` units
  carAhead(car) {
    const p = car.vehicle.pos;
    let best = Infinity;
    for (const o of this.cars) {
      if (o === car || o.axis !== car.axis || o.road !== car.road || o.dir !== car.dir) continue;
      const along = car.axis === 'x' ? o.vehicle.pos.z - p.z : o.vehicle.pos.x - p.x;
      const lateral = car.axis === 'x' ? Math.abs(o.vehicle.pos.x - p.x) : Math.abs(o.vehicle.pos.z - p.z);
      if (along * car.dir > 0 && along * car.dir < best && lateral < 4) best = along * car.dir;
    }
    return best;
  }

  update(dt, playerPos) {
    const rng = this.rng;
    for (const car of this.cars) {
      const v = car.vehicle;
      // slow for the car ahead and for the player crossing
      let target = car.targetSpeed;
      const ahead = this.carAhead(car);
      if (ahead < 16) target = Math.min(target, Math.max(0, (ahead - 8) * 0.6));
      if (playerPos) {
        const dx = playerPos.x - v.pos.x, dz = playerPos.z - v.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 14) {
          // is the player in front of this car?
          const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
          if (dx * fx + dz * fz > 0) target = 0;
        }
      }
      v.speed += (target - v.speed) * Math.min(1, dt * 1.5);
      const step = v.speed * car.dir * dt;
      if (car.axis === 'x') v.pos.z += step; else v.pos.x += step;
      // turn at an intersection sometimes
      const along = car.axis === 'x' ? v.pos.z : v.pos.x;
      const nearRoad = Math.abs(along % 100) < 1.2 && Math.abs(along) < 500;
      if (nearRoad && rng.chance(dt * 0.25)) {
        const newRoad = Math.round(along / 100) * 100;
        if (rng.chance(0.5)) {
          // turn onto the crossing road
          const newAxis = car.axis === 'x' ? 'z' : 'x';
          const newDir = rng.chance(0.5) ? 1 : -1;
          const newLane = newDir > 0 ? 3.5 : -3.5;
          if (newAxis === 'x') { v.pos.x = newRoad + newLane; v.pos.z = newRoad; }
          else { v.pos.z = newRoad + newLane; v.pos.x = newRoad; }
          car.axis = newAxis; car.road = newRoad; car.dir = newDir; car.lane = newLane;
          v.heading = newAxis === 'x' ? (newDir > 0 ? 0 : Math.PI) : (newDir > 0 ? Math.PI / 2 : -Math.PI / 2);
        }
      }
      // wrap at the city edge instead of despawning
      if (car.axis === 'x' && (v.pos.z > 520 || v.pos.z < -520)) v.pos.z = -v.pos.z;
      if (car.axis === 'z' && (v.pos.x > 520 || v.pos.x < -520)) v.pos.x = -v.pos.x;
      v.group.position.set(v.pos.x, 0, v.pos.z);
      v.group.rotation.y = v.heading;
    }
  }

  // A traffic car the player just rammed: it stops, its driver bails.
  crashAt(pos, radius = 6) {
    for (const car of this.cars) {
      const d = Math.hypot(car.vehicle.pos.x - pos.x, car.vehicle.pos.z - pos.z);
      if (d < radius) {
        car.targetSpeed = 0;
        car.vehicle.damage(30);
        return car;
      }
    }
    return null;
  }
}
