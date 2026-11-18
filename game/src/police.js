// MBPD — the wanted system. Stars 0-5, cruisers that chase and ram, foot
// cops that close in and bust you, heat that decays only when you break
// line of sight and distance. Escaping is a real mechanic, not a timer.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { Vehicle } from './vehicle.js';
import { RNG } from './random.js';

export class Police {
  constructor(scene, world, seed = 999) {
    this.scene = scene;
    this.world = world;
    this.rng = new RNG(seed);
    this.stars = 0;
    this.heat = 0;               // fractional heat; 25 heat = 1 star
    this.cruisers = [];          // Vehicle instances
    this.cops = [];              // on-foot officers {group, pos, heading, speed}
    this.hiddenTimer = 0;
    this.bustTimer = 0;
    this.busted = false;
    this.lastSeen = 0;           // seconds since a cruiser was near
    this.hold = false;           // shot mode: keep the staged fleet frozen
    this.group = new THREE.Group();
    this.group.name = 'police';
    scene.add(this.group);
  }

  get wanted() { return this.stars; }

  addHeat(n, pos) {
    if (this.stars >= 5) return;
    this.heat += n;
    const want = Math.min(5, Math.floor(this.heat / 25) + (this.heat > 0 ? 0 : 0));
    // heat maps to stars: 1 heat event = 1 star minimum once noticed
    const target = Math.max(this.stars, Math.min(5, Math.ceil(this.heat / 25)));
    if (target > this.stars) {
      this.stars = target;
      this.hiddenTimer = 0;
    }
    this.lastSeen = 0;
  }

  clearWanted() {
    this.stars = 0; this.heat = 0; this.bustTimer = 0;
    this.removeAll();
  }

  removeAll() {
    for (const c of this.cruisers) c.remove();
    this.cruisers = [];
    for (const c of this.cops) this.group.remove(c.group);
    this.cops = [];
  }

  spawnCruiserNear(pos) {
    const rng = this.rng;
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(45, 70);
    let x = pos.x + Math.sin(angle) * dist;
    let z = pos.z + Math.cos(angle) * dist;
    x = Math.max(-590, Math.min(590, x));
    z = Math.max(-590, Math.min(555, z));
    // snap onto the nearest road so cruisers arrive driving, not through walls
    const rx = this.world.nearestRoadCoord(x);
    const rz = this.world.nearestRoadCoord(z);
    if (Math.abs(x - rx) < Math.abs(z - rz)) x = rx + 3.5; else z = rz + 3.5;
    const v = new Vehicle(this.scene, 'police', x, z, Math.atan2(pos.x - x, pos.z - z));
    this.cruisers.push(v);
    return v;
  }

  spawnCopNear(pos) {
    const rng = this.rng;
    const angle = rng.range(0, Math.PI * 2);
    const x = pos.x + Math.sin(angle) * 30;
    const z = pos.z + Math.cos(angle) * 30;
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.5), navy);
    body.position.y = 1.25;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
    head.position.y = 2.05;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.56),
      new THREE.MeshLambertMaterial({ color: 0x0e1420 }));
    cap.position.y = 2.34;
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.05),
      new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0x554400 }));
    badge.position.set(0.2, 1.5, 0.26);
    g.add(body, head, cap, badge);
    g.position.set(x, 0, z);
    this.group.add(g);
    const cop = { group: g, pos: new THREE.Vector3(x, 0, z), heading: 0, speed: 4.6 };
    this.cops.push(cop);
    return cop;
  }

  update(dt, player, effects) {
    const ladder = CONFIG.wanted.ladder[this.stars];
    const pp = player.position;
    // keep the fleet at ladder strength
    while (this.cruisers.length < ladder.cruisers) this.spawnCruiserNear(pp);
    while (this.cruisers.length > ladder.cruisers) this.cruisers.pop().remove();
    while (this.cops.length < ladder.cops && player.onFoot) this.spawnCopNear(pp);
    while (this.cops.length > ladder.cops) this.group.remove(this.cops.pop().group);
    // shot mode: the staged composition stays exactly where the director put it
    if (this.hold) return;

    // distance to nearest cruiser decides whether we are "seen"
    let nearest = Infinity;
    for (const c of this.cruisers) {
      nearest = Math.min(nearest, Math.hypot(c.pos.x - pp.x, c.pos.z - pp.z));
    }
    for (const c of this.cops) {
      nearest = Math.min(nearest, Math.hypot(c.pos.x - pp.x, c.pos.z - pp.z));
    }
    if (this.stars > 0) {
      if (nearest > CONFIG.wanted.escapeRadius) {
        this.hiddenTimer += dt;
        if (this.hiddenTimer > CONFIG.wanted.decayDelay) {
          this.stars -= 1; this.heat = this.stars * 25;
          this.hiddenTimer = 0;
          if (this.stars === 0) this.removeAll();
        }
      } else {
        this.hiddenTimer = 0;
      }
    }

    // cruisers chase: steer toward the player, ram at close range
    for (const c of this.cruisers) {
      const dx = pp.x - c.pos.x, dz = pp.z - c.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const speed = ladder.speed;
      c.speed += ((dist > 26 ? speed : speed * 0.55) - c.speed) * Math.min(1, dt * 1.2);
      c.heading += THREE.MathUtils.clamp(diff, -1.6 * dt, 1.6 * dt) * Math.min(1, c.speed / 10 + 0.3);
      const nx = c.pos.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.pos.z + Math.cos(c.heading) * c.speed * dt;
      const [cx, cz] = this.world.resolveCollision(nx, nz, 2.2);
      if ((cx !== nx || cz !== nz) && Math.abs(c.speed) > 8) { c.damage(6); c.speed *= 0.5; }
      c.pos.x = cx; c.pos.z = cz;
      c.group.position.set(c.pos.x, 0, c.pos.z);
      c.group.rotation.y = c.heading;
      // ram the player's car
      if (!player.onFoot && player.vehicle && dist < 4.6 && Math.abs(c.speed) > 4) {
        player.vehicle.damage(4 * dt * 10, effects);
        player.takeDamage(2 * dt * 10);
        if (effects) effects.sparks(pp.x, 1, pp.z, 3);
        c.speed *= 0.6;
      }
    }

    // foot cops run at the player; standing next to one gets you busted
    let copClose = false;
    for (const cop of this.cops) {
      const dx = pp.x - cop.pos.x, dz = pp.z - cop.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      cop.heading = Math.atan2(dx, dz);
      cop.pos.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.pos.z += Math.cos(cop.heading) * cop.speed * dt;
      cop.group.position.set(cop.pos.x, 0, cop.pos.z);
      cop.group.rotation.y = cop.heading;
      if (dist < CONFIG.wanted.bustRadius && player.onFoot) copClose = true;
    }
    if (copClose && this.stars > 0) {
      this.bustTimer += dt;
      if (this.bustTimer > CONFIG.wanted.bustTime) this.busted = true;
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
  }
}
