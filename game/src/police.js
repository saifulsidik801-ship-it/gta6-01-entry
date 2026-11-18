// Wanted 0–5 and the police who answer it. Heat comes from stealing, shooting
// and turf work; hiding out of sight cools it down. Foot cops move in to bust
// you; police cars chase and ram. Getting busted costs 10% of your cash.
import * as THREE from '../vendor/three.module.min.js';
import { WANTED } from './config.js';
import { makePedestrian } from './player.js';
import { makeRng, clamp, angleLerp } from './random.js';
import { collideCircle } from './world.js';

export function createPolice(G) {
  const rng = makeRng(31337);
  const police = {
    footCops: [], copCars: [], bustTimer: 0, hideTimer: 0, lightTimer: 0,
    addHeat(n) {
      const s = G.state;
      const before = s.wanted;
      s.wanted = clamp(s.wanted + n, 0, 5);
      if (s.wanted > before) {
        this.hideTimer = 0;
        if (s.wanted >= 3) G.hud.toast('Wanted level ' + s.wanted + ' — the whole city is looking for you.');
      }
    },
    wantedCars() { return G.state.wanted >= 2 ? Math.min(G.state.wanted - 1, WANTED.MAX_COP_CARS) : 0; },
    wantedFoot() { return Math.min(G.state.wanted * 2, WANTED.MAX_FOOT_COPS); },

    spawnFootCop(x, z) {
      const g = makePedestrian(0x1a2a6b, 0x14161a);
      g.position.set(x, 0, z);
      G.scene.add(g);
      // A navy cap marks the cop.
      const cop = { g, x, z, phase: rng.rand(0, 6), attackT: 0 };
      this.footCops.push(cop);
      return cop;
    },
    spawnCopCar(x, z) {
      const car = G.vehicles.spawn('sedan', x, z, 0, 'police');
      // Navy paint: the body is the box at y 0.62.
      car.group.traverse((mm) => {
        if (mm.isMesh && mm.position.y === 0.62) mm.material = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
      });
      // Light bar: red + blue beacons on the roof.
      const bar = new THREE.Group();
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.5 }));
      red.position.x = -0.35; bar.add(red);
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1.5 }));
      blue.position.x = 0.35; bar.add(blue);
      bar.position.set(-0.2, 1.62, 0);
      car.group.add(bar);
      car.lightBar = { red, blue };
      this.copCars.push(car);
      return car;
    },
    despawnAll() {
      for (const c of this.footCops) G.scene.remove(c.g);
      for (const c of this.copCars) {
        const i = G.vehicles.list.indexOf(c);
        if (i >= 0) G.vehicles.list.splice(i, 1);
        G.scene.remove(c.group);
      }
      this.footCops = []; this.copCars = [];
    },
    update(dt) {
      const s = G.state;
      if (s.mode !== 'playing') { G.audio.siren(false); return; }
      G.audio.siren(s.wanted > 0);
      // Flash the light bars.
      this.lightTimer += dt;
      const flash = Math.floor(this.lightTimer * 4) % 2 === 0;
      for (const c of this.copCars) {
        if (!c.lightBar) continue;
        c.lightBar.red.material.emissiveIntensity = flash ? 2.2 : 0.2;
        c.lightBar.blue.material.emissiveIntensity = flash ? 0.2 : 2.2;
      }
      // Keep the force at the wanted level's size.
      while (this.copCars.length < this.wantedCars()) {
        const a = rng.rand(0, Math.PI * 2), r = rng.rand(55, 90);
        const x = G.player.x + Math.cos(a) * r, z = G.player.z + Math.sin(a) * r;
        const road = { x: Math.round(x / 40) * 40, z: Math.round(z / 40) * 40 };
        this.spawnCopCar(road.x, road.z);
      }
      while (this.footCops.length < this.wantedFoot()) {
        const a = rng.rand(0, Math.PI * 2), r = rng.rand(30, 55);
        this.spawnFootCop(G.player.x + Math.cos(a) * r, G.player.z + Math.sin(a) * r);
      }
      while (this.copCars.length > this.wantedCars()) {
        const c = this.copCars.pop();
        const i = G.vehicles.list.indexOf(c);
        if (i >= 0) G.vehicles.list.splice(i, 1);
        G.scene.remove(c.group);
      }
      while (this.footCops.length > this.wantedFoot()) {
        const c = this.footCops.pop();
        G.scene.remove(c.g);
      }
      const tx = G.player.x, tz = G.player.z;
      // Cop cars: pursue and ram. They are slower in tight turns, so a good driver can lose them.
      for (const c of this.copCars) {
        const px = c.group.position.x, pz = c.group.position.z;
        const dx = tx - px, dz = tz - pz, d = Math.hypot(dx, dz) || 1;
        if (d > 170) { // lost the trail: reposition near the player
          c.group.position.set(Math.round(tx / 40) * 40 + rng.rand(-20, 20), 0, Math.round(tz / 40) * 40);
          continue;
        }
        const targetYaw = Math.atan2(dx, dz);
        c.yaw = angleLerp(c.yaw, targetYaw, dt * 2.4);
        c.group.rotation.y = c.yaw;
        const targetSpeed = Math.min(WANTED.COP_CAR_SPEED, 12 + d * 0.35);
        c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 1.2);
        const nx = px + Math.sin(c.yaw) * c.speed * dt, nz = pz + Math.cos(c.yaw) * c.speed * dt;
        const hit = collideCircle(G.world, nx, nz, 1.7);
        if (hit.pushed) c.speed *= 0.5;
        c.group.position.x = hit.x; c.group.position.z = hit.z;
        for (const w of c.group.userData.wheels) w.rotation.x += c.speed * dt * 1.4;
        // Ram the player's car.
        const driven = G.vehicles.driven;
        if (driven && d < 4.2) {
          if (Math.abs(driven.speed) > 4 || Math.abs(c.speed) > 10) {
            G.vehicles.damage(driven, 6);
            c.speed *= 0.6;
            G.effects.sparks(driven.group.position);
            G.audio.punch();
          }
        }
        // Run the player down on foot.
        if (!G.player.inCar && d < 2.2) G.player.takeDamage(14 * dt);
      }
      // Foot cops: run at the player; close in for the bust.
      let nearestCop = 999;
      for (const cop of this.footCops) {
        const dx = tx - cop.x, dz = tz - cop.z, d = Math.hypot(dx, dz) || 1;
        nearestCop = Math.min(nearestCop, d);
        const sp = WANTED.COP_FOOT_SPEED;
        const nx = cop.x + (dx / d) * sp * dt, nz = cop.z + (dz / d) * sp * dt;
        const hit = collideCircle(G.world, nx, nz, 0.5);
        cop.x = hit.x; cop.z = hit.z;
        cop.g.position.set(cop.x, 0, cop.z);
        cop.g.rotation.y = Math.atan2(dx, dz);
        cop.phase += dt * sp * 2.4;
        const sw = Math.sin(cop.phase);
        cop.g.userData.legL.rotation.x = sw * 0.6; cop.g.userData.legR.rotation.x = -sw * 0.6;
        if (d < 1.6 && !G.player.inCar) {
          cop.attackT -= dt;
          if (cop.attackT <= 0) { cop.attackT = 0.8; G.player.takeDamage(6); }
        }
        if (d < 1.6 && !G.player.inCar) this.bustTimer += dt; else if (d < 6) this.bustTimer += dt * 0.2;
      }
      if (this.bustTimer > 1.6 && !G.player.inCar) this.bust();
      // Cooling down: no cop close for a while drops one star.
      if (s.wanted > 0) {
        if (nearestCop > 45 && this.copCars.every((c) => Math.hypot(c.group.position.x - tx, c.group.position.z - tz) > 45)) {
          this.hideTimer += dt;
          if (this.hideTimer > WANTED.DECAY_HIDE_S) { s.wanted--; this.hideTimer = 0; G.hud.toast('You lost them — wanted level ' + s.wanted + '.'); }
        } else this.hideTimer = 0;
      }
    },
    bust() {
      const s = G.state;
      this.bustTimer = 0;
      const lost = Math.floor(s.cash * WANTED.BUST_CASH_LOSS);
      s.cash -= lost;
      s.wanted = 0;
      this.despawnAll();
      G.audio.busted();
      G.hud.toast('BUSTED! You lost $' + lost + ' in fines.');
      G.player.reset(-100, -160);
      G.setMode('busted');
      setTimeout(() => { if (G.state.mode === 'busted') G.setMode('playing'); }, 1800);
    },
  };
  return police;
}
