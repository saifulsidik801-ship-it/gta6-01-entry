// MARISOL BAY — combat.js
// One job: fighting. A melee punch with reach and knockback, a pistol
// with real ammo and a reload, enemy gang members who guard turf,
// and the damage numbers the HUD shows. Shooting in public raises
// the wanted level — the police module owns what happens next.
import * as THREE from 'three';
import { clamp } from './random.js';
import { scatterPedestrians } from './pedestrians.js';
import { addWanted } from './police.js';
import { damagePlayer } from './player.js';

export function createCombat(G) {
  return {
    enemies: [],
    shootCooldown: 0,
    // Spawn a gang crew guarding a turf marker.
    spawnCrew(G2, x, z, count, district) {
      const list = [];
      for (let i = 0; i < count; i++) {
        const g = new THREE.Group();
        const jacket = new THREE.MeshLambertMaterial({ color: [0x7b2fbe, 0x2f6fbe, 0xbe2f4e][district % 3] });
        const skin = new THREE.MeshLambertMaterial({ color: 0xd9a06b });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.5), jacket);
        body.position.y = 1.25; body.castShadow = true; g.add(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.5), skin);
        head.position.y = 2.05; g.add(head);
        const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), new THREE.MeshLambertMaterial({ color: 0x222222 }));
        legL.position.set(-0.22, 0.45, 0); g.add(legL);
        const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
        const gx = x + (G2.rng() * 2 - 1) * 10, gz = z + (G2.rng() * 2 - 1) * 10;
        g.position.set(gx, 0, gz);
        G2.scene.add(g);
        const e = { mesh: g, pos: g.position, angle: 0, health: 60, legL, legR, phase: G2.rng() * 6, hitAt: 0, alive: true };
        list.push(e);
        G2.combat.enemies.push(e);
      }
      return list;
    },
    punch(G2) {
      const P = G2.player;
      G2.audio.punch();
      let hitAny = false;
      const reach = 2.4;
      for (const e of G2.combat.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
        if (d < reach) {
          hitAny = true;
          e.health -= 25;
          e.pos.x += Math.sin(P.angle) * 1.2; e.pos.z += Math.cos(P.angle) * 1.2;
          G2.effects.sparks(e.pos.x, 1.4, e.pos.z, 5);
          if (e.health <= 0) killEnemy(G2, e);
        }
      }
      // punching a pedestrian is a crime too
      for (const p of G2.pedestrians.list) {
        if (Math.hypot(p.pos.x - P.pos.x, p.pos.z - P.pos.z) < reach) {
          p.flee = 3; p.angle = Math.atan2(p.pos.x - P.pos.x, p.pos.z - P.pos.z);
          addWanted(G2, 1, 'assault in broad daylight');
          break;
        }
      }
      if (!hitAny) G2.hud.flash('Swing and a miss — get closer');
    },
    shoot(G2) {
      const P = G2.player;
      if (!P.armed || P.ammo <= 0) { if (P.ammo <= 0) G2.hud.flash('Out of ammo — press R to reload ($50)'); return; }
      if (G2.combat.shootCooldown > 0) return;
      G2.combat.shootCooldown = 0.28;
      P.ammo -= 1;
      G2.audio.shot();
      const mx = P.pos.x + Math.sin(P.angle) * 1.2, mz = P.pos.z + Math.cos(P.angle) * 1.2;
      G2.effects.muzzle(mx, 1.5, mz);
      scatterPedestrians(G2, P.pos.x, P.pos.z, 30);
      // hitscan: the nearest enemy in front of Milo, within 30 m
      let best = null, bd = 30;
      for (const e of G2.combat.enemies) {
        if (!e.alive) continue;
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
        const d = Math.hypot(dx, dz);
        const dot = (dx * Math.sin(P.angle) + dz * Math.cos(P.angle)) / (d || 1);
        if (d < bd && dot > 0.86) { bd = d; best = e; }
      }
      if (best) {
        best.health -= 34;
        G2.effects.sparks(best.pos.x, 1.4, best.pos.z, 8);
        if (best.health <= 0) killEnemy(G2, best);
      }
      if (G2.wanted < 2) addWanted(G2, 1, 'shots fired');
    },
    update(G2, dt) {
      G2.combat.shootCooldown = Math.max(0, G2.combat.shootCooldown - dt);
      // enemies walk at Milo and swing when close
      for (const e of G2.combat.enemies) {
        if (!e.alive) continue;
        const P = G2.player;
        const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d < 26) {
          e.angle = Math.atan2(dx, dz);
          if (d > 1.8) { e.pos.x += Math.sin(e.angle) * 4.2 * dt; e.pos.z += Math.cos(e.angle) * 4.2 * dt; }
          e.mesh.position.copy(e.pos);
          e.mesh.rotation.y = e.angle;
          e.phase += dt * 10;
          e.legL.rotation.x = Math.sin(e.phase) * 0.55; e.legR.rotation.x = -Math.sin(e.phase) * 0.55;
          if (d < 2 && G2.time - e.hitAt > 0.9) {
            e.hitAt = G2.time;
            G2.audio.punch();
            if (P.onFoot) damagePlayer(G2, 9, 'fight');
          }
        }
      }
    },
  };
}

function killEnemy(G, e) {
  e.alive = false;
  G.effects.sparks(e.pos.x, 1.2, e.pos.z, 14);
  G.scene.remove(e.mesh);
  G.cash += 25;
  G.hud.flash('Crew down — +$25');
  const i = G.combat.enemies.indexOf(e);
  if (i >= 0) G.combat.enemies.splice(i, 1);
}
