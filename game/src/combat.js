// Marisol Bay — combat.
// One clear job: melee swings and ranged shots. Mouse click fires a ray from
// the camera; hits on rivals and cops deal damage, raise heat, and feed the
// turf loop. F swings a melee arc. Enemies here are the rival runners the
// missions spawn.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildPedMesh } from './pedestrians.js';
import { damagePlayer } from './player.js';

export function createCombat() {
  return {
    enemies: [],           // rival runners with health
    shotsFiredRecently: 0, // decays; pedestrians flee while > 0
    cooldown: 0,
    meleeCooldown: 0,
    raycaster: new THREE.Raycaster(),
  };
}

// Spawn rival runners at a spot (used by 'clear' mission steps).
export function spawnRivals(G, x, z, count) {
  const made = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildPedMesh(0x8a2f2f);
    const ox = (Math.random() - 0.5) * 18;
    const oz = (Math.random() - 0.5) * 18;
    mesh.position.set(x + ox, 0, z + oz);
    G.scene.add(mesh);
    const enemy = {
      mesh, pos: mesh.position, health: 60,
      angle: Math.random() * Math.PI * 2, speed: 3.2,
      phase: Math.random() * 6, shootT: 1 + Math.random() * 2,
      alive: true,
    };
    G.combat.enemies.push(enemy);
    made.push(enemy);
  }
  return made;
}

export function clearEnemies(G) {
  for (const e of G.combat.enemies) G.scene.remove(e.mesh);
  G.combat.enemies = [];
}

// A shot from the camera centre. Returns the enemy hit, if any.
export function shoot(G) {
  const combat = G.combat;
  if (combat.cooldown > 0 || G.mode !== 'playing') return null;
  combat.cooldown = 0.28;
  combat.shotsFiredRecently = 1.2;
  const p = G.player;
  const origin = p.onFoot
    ? new THREE.Vector3(p.pos.x, 1.6, p.pos.z)
    : new THREE.Vector3(p.vehicle.pos.x, 1.6, p.vehicle.pos.z);
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  combat.raycaster.set(origin, dir);
  combat.raycaster.far = 90;
  G.audio.shot();
  const fromX = origin.x + dir.x * 1.2;
  const fromZ = origin.z + dir.z * 1.2;
  G.effects.muzzle(fromX, 1.6, fromZ, dir.x, dir.z);
  // Hit test against enemies first, then foot cops, then buildings (range cap).
  const targets = [];
  for (const e of combat.enemies) if (e.alive) targets.push({ mesh: e.mesh, enemy: e, cop: null });
  for (const c of G.police.footCops) targets.push({ mesh: c.mesh, enemy: null, cop: c });
  const meshes = targets.map((t) => t.mesh);
  const hits = combat.raycaster.intersectObjects(meshes, true);
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj && !targets.some((t) => t.mesh === obj)) obj = obj.parent;
    const t = targets.find((tt) => tt.mesh === obj);
    if (t && t.enemy) {
      t.enemy.health -= 34;
      G.effects.sparks(hits[0].point.x, hits[0].point.y, hits[0].point.z, 8);
      if (t.enemy.health <= 0) {
        t.enemy.alive = false;
        t.enemy.mesh.rotation.z = Math.PI / 2;
        t.enemy.mesh.position.y = 0.4;
        G.effects.explosion(t.enemy.pos.x, 0.5, t.enemy.pos.z);
        G.police.addWanted(G, 1, 'Rival taken down');
      }
      return t.enemy;
    }
    if (t && t.cop) {
      G.police.addWanted(G, 2, 'Cop shot');
      G.effects.sparks(hits[0].point.x, hits[0].point.y, hits[0].point.z, 8);
      const idx = G.police.footCops.indexOf(t.cop);
      if (idx >= 0) { G.scene.remove(t.cop.mesh); G.police.footCops.splice(idx, 1); }
      return t.cop;
    }
  }
  return null;
}

// Melee swing (F): hits anything within 2.2 m in front of the player.
export function melee(G) {
  const combat = G.combat;
  if (combat.meleeCooldown > 0 || G.mode !== 'playing' || !G.player.onFoot) return false;
  combat.meleeCooldown = 0.5;
  const p = G.player;
  const fx = Math.sin(p.angle); const fz = Math.cos(p.angle);
  let hitAny = false;
  const tryHit = (pos, onHit) => {
    const dx = pos.x - p.pos.x; const dz = pos.z - p.pos.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < 2.4 && side < 1.2) { onHit(); hitAny = true; }
  };
  for (const e of combat.enemies) {
    if (!e.alive) continue;
    tryHit(e.pos, () => {
      e.health -= 40;
      G.effects.sparks(e.pos.x, 1.2, e.pos.z, 6);
      if (e.health <= 0) {
        e.alive = false;
        e.mesh.rotation.z = Math.PI / 2;
        e.mesh.position.y = 0.4;
        G.police.addWanted(G, 1, 'Rival taken down');
      }
    });
  }
  for (const cop of [...G.police.footCops]) {
    tryHit(cop.pos, () => {
      G.police.addWanted(G, 1, 'Cop attacked');
      const idx = G.police.footCops.indexOf(cop);
      if (idx >= 0) { G.scene.remove(cop.mesh); G.police.footCops.splice(idx, 1); }
    });
  }
  if (hitAny) G.audio.thud();
  return hitAny;
}

// Enemies advance on the player and shoot back when close.
export function updateEnemies(G, dt) {
  const combat = G.combat;
  combat.cooldown = Math.max(0, combat.cooldown - dt);
  combat.meleeCooldown = Math.max(0, combat.meleeCooldown - dt);
  combat.shotsFiredRecently = Math.max(0, combat.shotsFiredRecently - dt);
  const p = G.player;
  const px = p.onFoot ? p.pos.x : (p.vehicle ? p.vehicle.pos.x : 0);
  const pz = p.onFoot ? p.pos.z : (p.vehicle ? p.vehicle.pos.z : 0);
  for (const e of combat.enemies) {
    if (!e.alive) continue;
    const dx = px - e.pos.x; const dz = pz - e.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 60) continue; // dormant until the player is near
    e.angle = Math.atan2(dx, dz);
    e.mesh.rotation.y = e.angle;
    if (dist > 14) {
      e.pos.x += Math.sin(e.angle) * e.speed * dt;
      e.pos.z += Math.cos(e.angle) * e.speed * dt;
      e.phase += dt * 7;
      e.mesh.userData.legL.rotation.x = Math.sin(e.phase) * 0.55;
      e.mesh.userData.legR.rotation.x = -Math.sin(e.phase) * 0.55;
    } else {
      // Shoot back: telegraphed, dodgeable, 8 damage a hit.
      e.shootT -= dt;
      if (e.shootT <= 0) {
        e.shootT = 1.4 + Math.random();
        G.effects.muzzle(e.pos.x, 1.5, e.pos.z, dx / dist, dz / dist);
        G.audio.shot();
        if (Math.random() < 0.55 && p.onFoot) {
          // Player hit (only on foot — cars shield the player).
          damagePlayer(G, 8);
        }
      }
    }
  }
}
