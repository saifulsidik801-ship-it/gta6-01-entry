// Cars: building them, parking them, driving them, wrecking them. The driven
// car uses simple arcade physics — accelerate, brake, steer, skid — and the
// same mesh factory serves parked cars, traffic and police.
import * as THREE from '../vendor/three.module.min.js';
import { VEHICLES, WANTED } from './config.js';
import { makeRng, clamp } from './random.js';
import { collideCircle } from './world.js';

function makeWheel() {
  const w = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10),
    new THREE.MeshLambertMaterial({ color: 0x14161a }),
  );
  w.rotation.z = Math.PI / 2;
  return w;
}

export function createCarMesh(type, color) {
  const cfg = VEHICLES[type];
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(cfg.len, 0.72, cfg.wid), paint);
  body.position.y = 0.62; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cfg.len * 0.5, 0.6, cfg.wid * 0.86), glass);
  cabin.position.set(-cfg.len * 0.06, 1.22, 0); g.add(cabin);
  if (type === 'truck') {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(cfg.len * 0.42, 1.1, cfg.wid * 0.94),
      new THREE.MeshLambertMaterial({ color: 0x9aa5ad }));
    cargo.position.set(-cfg.len * 0.28, 1.2, 0); g.add(cargo);
    cabin.position.set(cfg.len * 0.28, 1.22, 0);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xf2c200, emissive: 0xaa8800, emissiveIntensity: 0.7 }));
    sign.position.set(-0.2, 1.66, 0); g.add(sign);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xffe9a8, emissiveIntensity: 0.9 });
  for (const z of [-cfg.wid / 2 + 0.25, cfg.wid / 2 - 0.25]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.3), headMat);
    h.position.set(cfg.len / 2, 0.66, z); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xc0392b, emissive: 0x7a1010, emissiveIntensity: 0.6 }));
    t.position.set(-cfg.len / 2, 0.66, z); g.add(t);
  }
  const wheels = [];
  for (const [wx, wz] of [[cfg.len * 0.32, cfg.wid / 2], [cfg.len * 0.32, -cfg.wid / 2], [-cfg.len * 0.32, cfg.wid / 2], [-cfg.len * 0.32, -cfg.wid / 2]]) {
    const w = makeWheel();
    w.position.set(wx, 0.36, wz); g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

export function createVehicles(G) {
  const rng = makeRng(777);
  const list = [];
  const vehicles = {
    list,
    get driven() { return list.find((c) => c.driver === 'player') || null; },

    spawn(type, x, z, yaw, driver) {
      const cfg = VEHICLES[type];
      const color = rng.pick(cfg.colors);
      const group = createCarMesh(type, color);
      group.position.set(x, 0, z);
      group.rotation.y = yaw || 0;
      G.scene.add(group);
      const car = { group, type, cfg, color, speed: 0, steer: 0, hp: cfg.hp, driver: driver || 'parked', wrecked: false, smokeT: 0, bumpCd: 0, boostT: 0, yaw: yaw || 0 };
      list.push(car);
      return car;
    },

    spawnParked(n) {
      const types = ['sedan', 'sedan', 'taxi', 'truck', 'sport'];
      let placed = 0, guard = 0;
      while (placed < n && guard++ < 400) {
        // Park along a road edge, facing along the road.
        const alongRoad = rng.chance(0.5);
        const road = rng.randi(-6, 6) * 40;
        const along = rng.randi(-6, 6) * 40 + rng.rand(-14, 14);
        const side = rng.pick([-1, 1]) * 5.5;
        const x = alongRoad ? along : road + side;
        const z = alongRoad ? road + side : along;
        if (x < -195 || Math.abs(x) > 252 || Math.abs(z) > 252) continue;
        if (G.world.colliders.some((c) => x > c.x0 - 3 && x < c.x1 + 3 && z > c.z0 - 3 && z < c.z1 + 3)) continue;
        if (list.some((c) => Math.hypot(c.group.position.x - x, c.group.position.z - z) < 7)) continue;
        this.spawn(rng.pick(types), x, z, alongRoad ? 0 : Math.PI / 2, 'parked');
        placed++;
      }
    },

    enterCar(car) {
      const wasParked = car.driver === 'parked';
      const wasTraffic = car.driver === 'ai';
      car.driver = 'player';
      G.player.inCar = true; G.player.car = car;
      G.player.group.visible = false;
      G.cameraRig.mode = 'car';
      if (wasParked || wasTraffic) {
        G.police.addHeat(WANTED.STEAL);
        G.hud.toast(wasTraffic ? 'Carjacked! The heat is on.' : 'Car stolen — keep it moving.');
        G.audio.blip();
      }
      G.missions.onEnterCar(car);
    },

    exitCar() {
      const car = G.player.car;
      if (!car) return;
      car.driver = 'parked'; car.speed = 0;
      const p = G.player;
      const side = { x: car.group.position.x + Math.cos(car.yaw + Math.PI / 2) * 2.4, z: car.group.position.z - Math.sin(car.yaw + Math.PI / 2) * 2.4 };
      const hit = collideCircle(G.world, side.x, side.z, 0.6);
      p.group.position.set(hit.x, 0, hit.z);
      p.group.visible = true;
      p.inCar = false; p.car = null;
      G.cameraRig.mode = 'foot';
    },

    damage(car, n) {
      if (car.wrecked) return;
      car.hp -= n;
      if (car.hp <= 0) {
        car.wrecked = true; car.speed = 0;
        G.effects.explosion(car.group.position);
        G.audio.shoot();
        if (car.driver === 'player') {
          G.player.takeDamage(25);
          G.hud.toast('Your car is wrecked!');
          this.exitCar();
        }
        car.driver = 'wrecked';
      }
    },

    update(dt) {
      const car = this.driven;
      if (car) this.updateDriven(car, dt);
      // Wrecked cars smoulder.
      for (const c of list) {
        if (c.wrecked) {
          c.smokeT -= dt;
          if (c.smokeT <= 0) { c.smokeT = 0.25; G.effects.smoke(c.group.position); }
        } else if (c.hp < 40 && c.driver === 'player') {
          c.smokeT -= dt;
          if (c.smokeT <= 0) { c.smokeT = 0.4; G.effects.smoke(c.group.position); }
        }
      }
    },

    updateDriven(car, dt) {
      const input = G.input;
      const cfg = car.cfg;
      const fwd = input.axisY(); // W = +1, S = -1
      const steerIn = input.axisX();
      if (fwd > 0) car.speed += cfg.accel * dt;
      else if (fwd < 0) car.speed -= (car.speed > 0.5 ? cfg.accel * 1.6 : cfg.accel * 0.7) * dt;
      else car.speed -= Math.sign(car.speed) * 6 * dt;
      if (Math.abs(car.speed) < 0.15 && fwd === 0) car.speed = 0;
      car.speed = clamp(car.speed, -cfg.top * 0.45, cfg.top);
      const steerTarget = steerIn * cfg.steer * clamp(Math.abs(car.speed) / 8, 0, 1);
      car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
      car.yaw -= car.steer * dt * Math.sign(car.speed || 1) * (car.speed < 0 ? -1 : 1) * 0.9;
      car.group.rotation.y = car.yaw;
      const nx = car.group.position.x + Math.sin(car.yaw) * car.speed * dt;
      const nz = car.group.position.z + Math.cos(car.yaw) * car.speed * dt;
      if (car.bumpCd > 0) car.bumpCd -= dt;
      const hit = collideCircle(G.world, nx, nz, 1.7);
      if (hit.pushed) {
        // A wall stops the car going through, it does not eat all speed every
        // frame: one hard impact (with a cooldown) then the car slides along.
        if (Math.abs(car.speed) > 6 && car.bumpCd <= 0) {
          G.effects.sparks(car.group.position);
          this.damage(car, Math.abs(car.speed) * 0.9);
          G.audio.punch();
          car.speed *= 0.45;
          car.bumpCd = 0.6;
        } else car.speed *= 0.985;
      }
      car.group.position.x = hit.x; car.group.position.z = hit.z;
      // Bump into other cars: separate, one impact penalty per cooldown, and
      // a startled AI driver speeds away instead of blocking the road forever.
      for (const o of list) {
        if (o === car || o.wrecked) continue;
        const d = Math.hypot(o.group.position.x - car.group.position.x, o.group.position.z - car.group.position.z);
        if (d < 3.4 && d > 0.01) {
          const push = (3.4 - d) / 2;
          const ux = (car.group.position.x - o.group.position.x) / d, uz = (car.group.position.z - o.group.position.z) / d;
          car.group.position.x += ux * push; car.group.position.z += uz * push;
          if (o.driver === 'ai') { o.group.position.x -= ux * push; o.group.position.z -= uz * push; o.boostT = 2; }
          if (car.bumpCd <= 0 && Math.abs(car.speed) > 8) {
            this.damage(car, 4);
            G.effects.sparks(car.group.position);
            car.speed *= 0.7;
            car.bumpCd = 0.6;
          }
        }
      }
      // The player's position IS the car's while driving: police, missions, the
      // minimap and pedestrians all track G.player, so keep them in sync.
      G.player.group.position.set(car.group.position.x, 0, car.group.position.z);
      // Wheels spin; skid smoke on hard turns at speed.
      for (const w of car.group.userData.wheels) w.rotation.x += car.speed * dt * 1.4;
      if (Math.abs(car.steer) > 1.2 && Math.abs(car.speed) > 12) {
        G.effects.smoke({ x: car.group.position.x, y: 0.3, z: car.group.position.z });
      }
      G.audio.engine(clamp(Math.abs(car.speed) / cfg.top, 0, 1), true);
      G.state.speedKmh = Math.round(Math.abs(car.speed) * 3.6);
    },
  };
  return vehicles;
}
