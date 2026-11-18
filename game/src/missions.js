// Missions + turf — the counted spine. Six story missions, one per district,
// plus a finale when all six are owned; side work (taxi fares, time trials,
// hidden packages) pays between missions. Turf income ticks per owned
// district. Every objective is a real world position the HUD can point at.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, districtAt } from './config.js';
import { RNG } from './random.js';

export class Missions {
  constructor(scene, world, seed = 31337) {
    this.scene = scene;
    this.world = world;
    this.rng = new RNG(seed);
    this.owned = {};            // district id -> true
    this.done = [];             // mission ids completed
    this.active = null;         // active mission runtime state
    this.fares = [];            // taxi side jobs {pickup, dropoff, state, timer}
    this.packages = [];         // hidden collectibles {pos, taken, mesh}
    this.crates = [];           // m3 Portside crates {pos, taken, mesh}
    this.trial = null;          // active time trial {gates, idx, timer}
    this.cash = CONFIG.economy.startCash;
    this.turfTimer = 0;
    this.marker = null;         // glowing beacon mesh for the current objective
    this.buildPackages();
  }

  get ownedCount() { return Object.keys(this.owned).length; }

  buildPackages() {
    const rng = this.rng;
    const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0x664400 });
    let placed = 0, guard = 0;
    while (placed < 30 && guard++ < 600) {
      const x = rng.range(-520, 520), z = rng.range(-520, 500);
      if (this.world.insideBuilding(x, z)) continue;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.9, z);
      mesh.rotation.y = rng.range(0, Math.PI);
      this.scene.add(mesh);
      this.packages.push({ pos: new THREE.Vector3(x, 0, z), taken: false, mesh });
      placed++;
    }
  }

  // Portside crates for the m3 collect step: three glowing crates near the step.
  spawnCrates(step) {
    this.clearCrates();
    const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const mat = new THREE.MeshLambertMaterial({ color: 0xd4ac0d, emissive: 0x554400 });
    for (let k = 0; k < step.count; k++) {
      const a = (k / step.count) * Math.PI * 2;
      const x = step.pos.x + Math.sin(a) * 16;
      const z = step.pos.z + Math.cos(a) * 16;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.8, z);
      this.scene.add(mesh);
      this.crates.push({ pos: new THREE.Vector3(x, 0, z), taken: false, mesh });
    }
  }
  clearCrates() {
    for (const c of this.crates) this.scene.remove(c.mesh);
    this.crates = [];
  }
  // Returns how many crates the player just collected near pos.
  collectCrates(pos, radius = 6) {
    let n = 0;
    for (const c of this.crates) {
      if (c.taken) continue;
      if (Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) < radius) {
        c.taken = true; c.mesh.visible = false; n++;
      }
    }
    return n;
  }

  // --- mission flow ---
  availableMissions() {
    return CONFIG.missions.filter((m) => {
      if (this.done.includes(m.id)) return false;
      if (m.id === 'finale') return this.ownedCount >= 6;
      return !this.active || this.active.def.id !== m.id;
    });
  }

  startMission(def) {
    const d = districtAt(def.district === 'downtown' ? 0 : 0, 0); // district centre below
    const centre = CONFIG.districts.find((x) => x.id === def.district).center;
    const rng = this.rng;
    const steps = this.buildSteps(def, centre, rng);
    this.active = { def, steps, idx: 0, timer: def.id === 'm2' ? 150 : 0, kills: 0 };
    if (steps[0].type === 'collect') this.spawnCrates(steps[0]);
    this.showMarker(steps[0].pos);
    return this.active;
  }

  buildSteps(def, centre, rng) {
    const [cx, cz] = centre;
    const near = (dx, dz) => new THREE.Vector3(cx + dx, 0, cz + dz);
    switch (def.id) {
      case 'm1': return [
        { type: 'steal', label: 'Steal a car in Palm Row', pos: near(-40, 20), radius: 4 },
        { type: 'goto', label: 'Bring it to Rico at the garage', pos: new THREE.Vector3(-260, 0, 240), radius: 8 },
      ];
      case 'm2': return [
        { type: 'fare', label: 'Taxi fare 1/3 — pick up the rider', pos: near(30, -20), radius: 6 },
        { type: 'fare', label: 'Taxi fare 2/3 — pick up the rider', pos: near(-60, 60), radius: 6 },
        { type: 'fare', label: 'Taxi fare 3/3 — pick up the rider', pos: near(70, 40), radius: 6 },
      ];
      case 'm3': return [
        { type: 'collect', label: 'Collect the Portside crates (0/3)', pos: near(0, 0), radius: 6, count: 3, got: 0 },
        { type: 'escape', label: 'Lose the MBPD tail — break line of sight', pos: near(0, 0), radius: 120 },
      ];
      case 'm4': return [
        { type: 'trial', label: 'Time trial — hit all 5 gates', pos: near(-80, -60), radius: 8, count: 5, got: 0 },
      ];
      case 'm5': return [
        { type: 'turf', label: 'Hold the Marina pier — drop the Harbor Kings (0/4)', pos: near(10, 10), radius: 26, count: 4, got: 0 },
      ];
      case 'm6': return [
        { type: 'turf', label: 'Street war — drop the Downtown crew (0/5)', pos: near(20, -30), radius: 30, count: 5, got: 0 },
      ];
      default: return [ // finale
        { type: 'chase', label: 'Chase the old boss across the Bay', pos: new THREE.Vector3(200, 0, 200), radius: 10 },
        { type: 'goto', label: 'Bring the boss car back to Downtown', pos: new THREE.Vector3(0, 0, 0), radius: 10 },
      ];
    }
  }

  showMarker(pos) {
    this.hideMarker();
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 26, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.marker = new THREE.Mesh(geo, mat);
    this.marker.position.set(pos.x, 13, pos.z);
    this.scene.add(this.marker);
  }
  hideMarker() { if (this.marker) { this.scene.remove(this.marker); this.marker = null; } }

  currentObjective() {
    if (!this.active) return this.ownedCount >= 6 && !this.done.includes('finale')
      ? 'All districts owned — start the finale from the pause menu'
      : 'Open the pause menu and pick a mission';
    const s = this.active.steps[this.active.idx];
    return s ? s.label : '';
  }

  // Called when the player picks up a package / completes a fare / etc.
  collectPackageAt(pos, radius = 2.5) {
    for (const p of this.packages) {
      if (p.taken) continue;
      if (Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < radius) {
        p.taken = true;
        p.mesh.visible = false;
        this.cash += CONFIG.economy.packageValue;
        return p;
      }
    }
    return null;
  }
  get packagesLeft() { return this.packages.filter((p) => !p.taken).length; }

  completeStep() {
    const m = this.active;
    m.idx++;
    if (m.idx >= m.steps.length) { this.completeMission(); return true; }
    if (m.steps[m.idx].type === 'collect') this.spawnCrates(m.steps[m.idx]);
    this.showMarker(m.steps[m.idx].pos);
    return false;
  }

  completeMission() {
    const m = this.active;
    this.done.push(m.def.id);
    this.owned[m.def.district] = true;
    this.cash += m.def.pay;
    this.clearCrates();
    this.hideMarker();
    this.active = null;
  }

  failMission() { this.clearCrates(); this.hideMarker(); this.active = null; }

  // Per-frame: advance the active step, pay turf income, tick fares.
  update(dt, ctx) {
    // turf income
    this.turfTimer += dt;
    if (this.turfTimer > 60) {
      this.turfTimer = 0;
      this.cash += this.ownedCount * CONFIG.economy.turfTick;
    }
    if (this.marker) this.marker.rotation.y += dt * 0.8;
    for (const p of this.packages) if (!p.taken) p.mesh.rotation.y += dt;
    const m = this.active;
    if (!m) return null;
    const step = m.steps[m.idx];
    const pp = ctx.playerPos;
    const d = Math.hypot(step.pos.x - pp.x, step.pos.z - pp.z);
    if (m.timer > 0) { m.timer -= dt; if (m.timer <= 0) { this.failMission(); return 'failed'; } }
    switch (step.type) {
      case 'goto':
      case 'chase':
        if (d < step.radius) { this.completeStep(); return 'step'; }
        break;
      case 'steal':
        if (ctx.inVehicle) { this.completeStep(); return 'step'; }
        break;
      case 'fare':
        if (d < step.radius && ctx.inVehicle) { this.completeStep(); return 'step'; }
        break;
      case 'collect': {
        const got = ctx.collectAt ? ctx.collectAt(step.pos, step.radius) : 0;
        if (got > 0) {
          step.got += got;
          step.label = `Collect the Portside crates (${step.got}/${step.count})`;
          if (step.got >= step.count) { this.completeStep(); return 'step'; }
        }
        break;
      }
      case 'trial':
        if (d < step.radius) {
          step.got++;
          step.label = `Time trial — hit all 5 gates (${step.got}/5)`;
          // move the gate to the next point
          const c = CONFIG.districts.find((x) => x.id === m.def.district).center;
          step.pos.set(c[0] + (this.rng.range(-120, 120)), 0, c[1] + this.rng.range(-120, 120));
          this.showMarker(step.pos);
          if (step.got >= step.count) { this.completeStep(); return 'step'; }
        }
        break;
      case 'turf':
      case 'escape':
        if (step.type === 'escape' && ctx.wanted === 0) { this.completeStep(); return 'step'; }
        break;
    }
    return null;
  }

  // Mission crews spawn hostiles near the objective when a turf step starts.
  spawnCrewForStep(combat) {
    const m = this.active;
    if (!m) return 0;
    const step = m.steps[m.idx];
    if (step.type !== 'turf') return 0;
    combat.clearEnemies();
    let n = 0;
    for (let k = 0; k < step.count; k++) {
      const a = (k / step.count) * Math.PI * 2;
      combat.spawnEnemy(step.pos.x + Math.sin(a) * 14, step.pos.z + Math.cos(a) * 14);
      n++;
    }
    return n;
  }
}
