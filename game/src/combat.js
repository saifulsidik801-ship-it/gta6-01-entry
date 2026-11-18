// Combat: Milo's pistol and fists, and the Vulture gang members who fight back
// during turf missions. Hits are hitscan from the camera; kills pay cash and
// raise heat, which is exactly why turf work always ends in a police chase.
import * as THREE from '../vendor/three.module.min.js';
import { PLAYER, WANTED } from './config.js';
import { makePedestrian } from './player.js';
import { makeRng, clamp } from './random.js';
import { collideCircle } from './world.js';

export function createCombat(G) {
  const rng = makeRng(2024);
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
  tracer.frustumCulled = false;
  G.scene.add(tracer);
  let tracerT = 0;

  const combat = {
    enemies: [], ammo: PLAYER.MAG, reloading: 0, shotCd: 0,

    spawnGang(n, x, z) {
      for (let i = 0; i < n; i++) {
        const g = makePedestrian(0x8e1f1f, 0x1e1e26);
        const ex = x + rng.rand(-8, 8), ez = z + rng.rand(-8, 8);
        g.position.set(ex, 0, ez);
        G.scene.add(g);
        this.enemies.push({ g, x: ex, z: ez, hp: 30, attackT: rng.rand(0, 0.5), phase: rng.rand(0, 6), speed: rng.rand(4.4, 5.4) });
      }
      G.hud.toast('Vultures incoming — ' + n + ' of them.');
    },
    clearGang() {
      for (const e of this.enemies) G.scene.remove(e.g);
      this.enemies = [];
    },
    shoot() {
      if (this.reloading > 0 || this.shotCd > 0 || G.state.mode !== 'playing') return;
      this.shotCd = PLAYER.SHOT_CD;
      if (this.ammo <= 0) { this.startReload(); return; }
      this.ammo--;
      G.audio.shoot();
      // Ray from the camera through the screen centre.
      const cam = G.camera;
      const origin = new THREE.Vector3();
      cam.getWorldPosition(origin);
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      const end = origin.clone().addScaledVector(dir, PLAYER.RANGE);
      tracerGeo.attributes.position.setXYZ(0, origin.x, origin.y, origin.z);
      tracerGeo.attributes.position.setXYZ(1, end.x, end.y, end.z);
      tracerGeo.attributes.position.needsUpdate = true;
      tracer.material.opacity = 0.9; tracerT = 0.06;
      // Muzzle flash at the player's hand / car bonnet.
      const muzzle = G.player.inCar ? G.player.car.group.position : G.player.group.position;
      G.effects.burst({ x: muzzle.x, y: 1.4, z: muzzle.z }, 0xffd23a, 5, 5, 0.15, 1);
      G.pedestrians.scare(G.player.x, G.player.z, 26);
      // Nearest thing the ray passes close to: gang, then any car.
      let bestT = PLAYER.RANGE, bestEnemy = null, bestCar = null;
      const testPoint = (px, py, pz, radius) => {
        const vx = px - origin.x, vy = py - origin.y, vz = pz - origin.z;
        const t = vx * dir.x + vy * dir.y + vz * dir.z;
        if (t < 0 || t > bestT) return false;
        const cx = origin.x + dir.x * t, cy = origin.y + dir.y * t, cz = origin.z + dir.z * t;
        return Math.hypot(px - cx, py - cy, pz - cz) < radius;
      };
      for (const e of this.enemies) {
        if (testPoint(e.x, 1.2, e.z, 1.4)) { bestT = Math.hypot(e.x - origin.x, e.z - origin.z); bestEnemy = e; }
      }
      if (!bestEnemy) {
        for (const c of G.vehicles.list) {
          if (c.driver === 'player') continue;
          const p = c.group.position;
          if (testPoint(p.x, 0.9, p.z, 1.9)) { bestT = Math.hypot(p.x - origin.x, p.z - origin.z); bestCar = c; }
        }
      }
      if (bestEnemy) this.damageEnemy(bestEnemy, PLAYER.PISTOL_DMG);
      else if (bestCar) {
        G.vehicles.damage(bestCar, PLAYER.PISTOL_DMG);
        G.effects.sparks(bestCar.group.position);
        G.police.addHeat(1);
      }
    },
    punch() {
      if (this.shotCd > 0 || G.state.mode !== 'playing') return;
      this.shotCd = PLAYER.PUNCH_CD;
      G.player.punchTimer = PLAYER.PUNCH_CD;
      G.audio.punch();
      for (const e of [...this.enemies]) {
        const d = Math.hypot(e.x - G.player.x, e.z - G.player.z);
        if (d < PLAYER.PUNCH_RANGE) this.damageEnemy(e, PLAYER.PUNCH_DMG);
      }
      for (const c of G.vehicles.list) {
        if (c.driver === 'player') continue;
        const d = Math.hypot(c.group.position.x - G.player.x, c.group.position.z - G.player.z);
        if (d < 2.4) G.vehicles.damage(c, PLAYER.PUNCH_DMG);
      }
    },
    damageEnemy(e, n) {
      e.hp -= n;
      G.effects.blood({ x: e.x, y: 1.3, z: e.z });
      if (e.hp <= 0) {
        G.scene.remove(e.g);
        this.enemies.splice(this.enemies.indexOf(e), 1);
        G.state.cash += 25;
        G.police.addHeat(1);
        G.hud.toast('Vulture down. +$25');
        G.missions.onGangKill();
      }
    },
    startReload() {
      if (this.reloading > 0 || this.ammo === PLAYER.MAG) return;
      this.reloading = PLAYER.RELOAD;
      G.hud.toast('Reloading…');
    },
    update(dt) {
      if (tracerT > 0) { tracerT -= dt; if (tracerT <= 0) tracer.material.opacity = 0; }
      if (this.shotCd > 0) this.shotCd -= dt;
      if (this.reloading > 0) {
        this.reloading -= dt;
        if (this.reloading <= 0) { this.ammo = PLAYER.MAG; G.hud.toast('Reloaded.'); }
      }
      if (G.state.mode !== 'playing') return;
      // Click: punch up close, otherwise shoot. R reloads.
      if (G.input.consumeClick()) {
        const near = this.enemies.some((e) => Math.hypot(e.x - G.player.x, e.z - G.player.z) < PLAYER.PUNCH_RANGE);
        if (near && !G.player.inCar) this.punch(); else this.shoot();
      }
      if (G.input.pressed('KeyR')) this.startReload();
      // Gang AI: close in and swing at Milo (or his car).
      const px = G.player.x, pz = G.player.z;
      for (const e of [...this.enemies]) {
        const dx = px - e.x, dz = pz - e.z, d = Math.hypot(dx, dz) || 1;
        if (d > 70) continue; // too far to care
        const sp = e.speed;
        const nx = e.x + (dx / d) * sp * dt, nz = e.z + (dz / d) * sp * dt;
        const hit = collideCircle(G.world, nx, nz, 0.5);
        e.x = hit.x; e.z = hit.z;
        e.g.position.set(e.x, 0, e.z);
        e.g.rotation.y = Math.atan2(dx, dz);
        e.phase += dt * sp * 2.6;
        const s = Math.sin(e.phase);
        e.g.userData.legL.rotation.x = s * 0.6; e.g.userData.legR.rotation.x = -s * 0.6;
        if (d < 1.9) {
          e.attackT -= dt;
          if (e.attackT <= 0) {
            e.attackT = 0.85;
            e.g.userData.armR.rotation.x = -1.6;
            if (G.player.inCar && G.player.car) G.vehicles.damage(G.player.car, 5);
            else G.player.takeDamage(8);
            G.audio.punch();
          }
        }
      }
    },
  };
  return combat;
}
