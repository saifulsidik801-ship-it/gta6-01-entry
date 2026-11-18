// Drivable vehicles — arcade car physics (accel, steering, drift, damage)
// and box-built car meshes per type. Cars collide with building AABBs and
// the world edge; a wrecked car smokes and slows until repaired by time.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';

const BODY_GEO = new THREE.BoxGeometry(1, 1, 1);
const WHEEL_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);

export class Vehicle {
  constructor(scene, type, x, z, heading = 0, colorOverride = null) {
    this.type = type;
    this.spec = CONFIG.vehicles[type] || CONFIG.vehicles.sedan;
    this.scene = scene;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.smoking = false;
    this.group = new THREE.Group();
    this.group.name = `car-${type}`;
    this.buildMesh(colorOverride ?? this.spec.color);
    this.group.position.copy(this.pos);
    this.group.rotation.y = heading;
    scene.add(this.group);
  }

  buildMesh(color) {
    const paint = new THREE.MeshLambertMaterial({ color });
    const dark = new THREE.MeshLambertMaterial({ color: 0x14181d });
    const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4d8 });
    const body = new THREE.Mesh(BODY_GEO, paint);
    if (this.type === 'truck') {
      body.scale.set(2.3, 1.5, 5.6);
      body.position.y = 1.0;
      const cab = new THREE.Mesh(BODY_GEO, paint);
      cab.scale.set(2.2, 1.3, 1.6); cab.position.set(0, 2.3, 1.9);
      const shield = new THREE.Mesh(BODY_GEO, glass);
      shield.scale.set(2.0, 0.9, 0.2); shield.position.set(0, 2.3, 2.75);
      this.group.add(body, cab, shield);
    } else {
      const long = this.type === 'sports' ? 4.6 : 4.2;
      body.scale.set(2.0, 0.75, long);
      body.position.y = 0.62;
      const cabin = new THREE.Mesh(BODY_GEO, glass);
      cabin.scale.set(1.7, 0.62, long * 0.45);
      cabin.position.set(0, 1.28, -long * 0.06);
      this.group.add(body, cabin);
      if (this.type === 'taxi') {
        const sign = new THREE.Mesh(BODY_GEO, new THREE.MeshLambertMaterial({ color: 0x111111 }));
        sign.scale.set(0.9, 0.28, 0.5); sign.position.set(0, 1.75, 0);
        const signTop = new THREE.Mesh(BODY_GEO, new THREE.MeshLambertMaterial({ color: 0xf2c200, emissive: 0x664400 }));
        signTop.scale.set(0.94, 0.1, 0.54); signTop.position.set(0, 1.92, 0);
        this.group.add(sign, signTop);
      }
      if (this.type === 'police') {
        const bar = new THREE.Mesh(BODY_GEO, new THREE.MeshLambertMaterial({ color: 0xdddddd }));
        bar.scale.set(1.2, 0.22, 0.5); bar.position.set(0, 1.7, 0);
        this.lightbar = new THREE.Mesh(BODY_GEO, new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }));
        this.lightbar.scale.set(0.6, 0.24, 0.52); this.lightbar.position.set(-0.3, 1.7, 0);
        const blue = new THREE.Mesh(BODY_GEO, new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000aa }));
        blue.scale.set(0.6, 0.24, 0.52); blue.position.set(0.3, 1.7, 0);
        this.group.add(bar, this.lightbar, blue);
      }
    }
    // headlights + taillights
    const hl = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x777744 });
    const tl = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x660000 });
    for (const sx of [-0.7, 0.7]) {
      const h = new THREE.Mesh(BODY_GEO, hl); h.scale.set(0.34, 0.2, 0.12);
      h.position.set(sx, 0.62, this.type === 'truck' ? 2.85 : 2.15); this.group.add(h);
      const t = new THREE.Mesh(BODY_GEO, tl); t.scale.set(0.34, 0.2, 0.12);
      t.position.set(sx, 0.62, this.type === 'truck' ? -2.85 : -2.15); this.group.add(t);
    }
    // wheels
    this.wheels = [];
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0e10 });
    const zF = this.type === 'truck' ? 1.9 : 1.45, zB = this.type === 'truck' ? -1.9 : -1.45;
    for (const [wx, wz] of [[-1.0, zF], [1.0, zF], [-1.0, zB], [1.0, zB]]) {
      const w = new THREE.Mesh(WHEEL_GEO, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.42, wz);
      this.group.add(w); this.wheels.push(w);
    }
    this.body = body;
  }

  // input: {throttle:-1..1, steer:-1..1, brake:bool, dt}
  update(dt, input, world, effects) {
    const s = this.spec;
    const top = s.top * (this.health < 35 ? 0.55 : 1);
    if (input.throttle > 0) this.speed += s.accel * input.throttle * dt;
    else if (input.throttle < 0) this.speed += s.accel * 0.7 * input.throttle * dt;
    if (input.brake) this.speed -= Math.sign(this.speed) * s.brake * dt;
    // drag + rolling resistance
    this.speed -= this.speed * 0.55 * dt;
    if (Math.abs(this.speed) < 0.05 && !input.throttle) this.speed = 0;
    this.speed = Math.max(-top * 0.45, Math.min(top, this.speed));
    // steering scales with speed, reverses when reversing
    const steerTarget = (input.steer || 0) * s.steer;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    const spd = Math.abs(this.speed);
    if (spd > 0.1) {
      this.heading += (this.steer * spd * dt * 0.055) * Math.sign(this.speed);
    }
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const [cx, cz] = world.resolveCollision(nx, nz, 2.2);
    if ((cx !== nx || cz !== nz) && spd > 6) {
      this.damage(spd * 0.35, effects);
      this.speed *= 0.45;
      if (effects) effects.sparks(cx, 0.8, cz, 8);
    }
    this.pos.x = cx; this.pos.z = cz;
    // world bounds
    this.pos.x = Math.max(-595, Math.min(595, this.pos.x));
    this.pos.z = Math.max(-595, Math.min(560, this.pos.z));
    // drift smoke when hard steering at speed
    if (effects && Math.abs(this.steer) > 1.4 && spd > 18) {
      effects.smoke(this.pos.x - Math.sin(this.heading) * 1.6, 0.4, this.pos.z - Math.cos(this.heading) * 1.6, 1);
    }
    if (this.health < 40 && !this.smoking) this.smoking = true;
    if (this.smoking && effects && Math.random() < dt * 14) {
      effects.smoke(this.pos.x, 1.4, this.pos.z, 1);
    }
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.heading;
    // wheel spin + front steer visuals
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      w.rotation.x += this.speed * dt * 1.4;
      if (i < 2) w.rotation.y = this.steer * 0.32;
    }
    if (this.lightbar) {
      this.lightbar.material.emissive.setHex((performance.now() / 300 | 0) % 2 ? 0xff0000 : 0x330000);
    }
  }

  damage(amount, effects) {
    this.health -= amount;
    if (this.health < 0) this.health = 0;
    return this.health <= 0;
  }
  repair() { this.health = 100; this.smoking = false; }
  get wrecked() { return this.health <= 0; }
  remove() { this.scene.remove(this.group); }
}

// Parked cars dotted around the city for the player to steal.
export function spawnParkedCars(scene, world, rng, count = 26) {
  const types = ['sedan', 'sedan', 'taxi', 'coupe', 'sports', 'truck', 'sedan'];
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < 400) {
    const [x, z] = world.randomRoadPoint(rng, rng.chance(0.5) ? null : rng.pick([-500, -400, -300, -200, -100, 0, 100, 200, 300, 400, 500]));
    if (world.insideBuilding(x, z)) continue;
    // park along the road edge
    const alongRoad = Math.abs(x % 100) < 20;
    const heading = alongRoad ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const px = alongRoad ? x + 5.2 : x;
    const pz = alongRoad ? z : z + 5.2;
    cars.push(new Vehicle(scene, rng.pick(types), px, pz, heading));
  }
  return cars;
}
