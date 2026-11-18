// Pedestrians — sidewalk walkers with somewhere to be. They stroll between
// intersections, cross at crosswalks, and run screaming from gunfire and
// speeding cars. Knocking one down is a crime: the wanted system notices.
import * as THREE from '../vendor/three.module.min.js';
import { RNG } from './random.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xe67e22];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x4a235a];

export class Pedestrians {
  constructor(scene, world, seed = 777) {
    this.scene = scene;
    this.world = world;
    this.rng = new RNG(seed);
    this.peds = []; // {group, legL, legR, pos, heading, speed, target, flee, down, downTimer}
    this.group = new THREE.Group();
    this.group.name = 'pedestrians';
    scene.add(this.group);
  }

  spawn(count = 26) {
    for (let k = 0; k < count; k++) this.addPed();
  }

  addPed(x = null, z = null) {
    const rng = this.rng;
    if (x === null) {
      // on a sidewalk: near a road, offset past the road edge
      const roads = [-500, -400, -300, -200, -100, 0, 100, 200, 300, 400, 500];
      const road = rng.pick(roads);
      const along = rng.range(-480, 480);
      if (rng.chance(0.5)) { x = road + rng.pick([-11, 11]); z = along; }
      else { x = along; z = road + rng.pick([-11, 11]); }
    }
    const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
    const pants = new THREE.MeshLambertMaterial({ color: rng.pick(PANTS) });
    const skin = new THREE.MeshLambertMaterial({ color: rng.pick([0xc98d64, 0x8d5524, 0xe8b98a, 0x6b4423]) });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.42), shirt);
    body.position.y = 1.2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
    head.position.y = 1.9;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), pants);
    legL.position.set(-0.18, 0.38, 0);
    const legR = legL.clone(); legR.position.x = 0.18;
    g.add(body, head, legL, legR);
    g.position.set(x, 0, z);
    this.group.add(g);
    const ped = {
      group: g, legL, legR,
      pos: new THREE.Vector3(x, 0, z),
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2),
      target: this.pickTarget(x, z),
      flee: 0, down: false, downTimer: 0, phase: rng.range(0, 6),
    };
    this.peds.push(ped);
    return ped;
  }

  pickTarget(x, z) {
    const rng = this.rng;
    // walk to a nearby intersection corner, then pick again
    const rx = this.world.nearestRoadCoord(x);
    const rz = this.world.nearestRoadCoord(z);
    const corner = rng.pick([
      [rx + 11, rz + 11], [rx - 11, rz + 11], [rx + 11, rz - 11], [rx - 11, rz - 11],
      [rx + 11, z + rng.range(-60, 60)], [x + rng.range(-60, 60), rz + 11],
    ]);
    return new THREE.Vector3(corner[0], 0, corner[1]);
  }

  scare(pos, radius = 26) {
    for (const p of this.peds) {
      if (p.down) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < radius) { p.flee = 4; }
    }
  }

  // returns the ped hit, if any, within radius of pos
  hitAt(pos, radius = 2.2) {
    for (const p of this.peds) {
      if (p.down) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < radius) {
        p.down = true; p.downTimer = 6;
        p.group.rotation.z = Math.PI / 2;
        p.group.position.y = 0.3;
        return p;
      }
    }
    return null;
  }

  update(dt) {
    for (const p of this.peds) {
      if (p.down) {
        p.downTimer -= dt;
        if (p.downTimer <= 0) {
          // gets up, brushes off, walks away shaken
          p.down = false;
          p.group.rotation.z = 0;
          p.group.position.y = 0;
          p.flee = 3;
        }
        continue;
      }
      p.flee = Math.max(0, p.flee - dt);
      const speed = p.flee > 0 ? p.speed * 3.2 : p.speed;
      const dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) { p.target = this.pickTarget(p.pos.x, p.pos.z); continue; }
      const want = Math.atan2(dx, dz);
      let diff = want - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.heading += diff * Math.min(1, dt * 6);
      p.pos.x += Math.sin(p.heading) * speed * dt;
      p.pos.z += Math.cos(p.heading) * speed * dt;
      p.pos.x = Math.max(-595, Math.min(595, p.pos.x));
      p.pos.z = Math.max(-595, Math.min(560, p.pos.z));
      p.phase += dt * speed * 3.4;
      const s = Math.sin(p.phase) * 0.4;
      p.legL.rotation.x = s; p.legR.rotation.x = -s;
      p.group.position.set(p.pos.x, 0, p.pos.z);
      p.group.rotation.y = p.heading;
    }
  }
}
