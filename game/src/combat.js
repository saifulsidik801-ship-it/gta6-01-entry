// Combat — Milo's fists and pistol, and the crews who shoot back. Melee is
// a short arc in front of the player; shooting raycasts from the camera
// through the crosshair at peds, cops and cars. Getting shot hurts, and
// every loud crime feeds the wanted system.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';

export class Combat {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.raycaster = new THREE.Raycaster();
    this.enemies = []; // mission shooters {group, pos, health, fireTimer, alive}
  }

  // Melee: hit the nearest ped/cop/enemy inside the arc.
  punch(player, peds, police, effects) {
    if (!player.punch()) return null;
    const origin = player.pos;
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    const tryHit = (pos) => {
      const dx = pos.x - origin.x, dz = pos.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > CONFIG.player.punchRange || d < 0.01) return false;
      const dot = (dx * fx + dz * fz) / d;
      return dot > Math.cos(CONFIG.player.punchArc);
    };
    for (const p of peds.peds) {
      if (!p.down && tryHit(p.pos)) { peds.hitAt(p.pos, 2.4); return { kind: 'ped', pos: p.pos }; }
    }
    for (const c of police.cops) {
      if (tryHit(c.pos)) {
        this.scene.remove(c.group);
        police.cops.splice(police.cops.indexOf(c), 1);
        police.addHeat(CONFIG.wanted.heatPerCopDown);
        if (effects) effects.sparks(c.pos.x, 1.4, c.pos.z, 10);
        return { kind: 'cop', pos: c.pos };
      }
    }
    for (const e of this.enemies) {
      if (e.alive && tryHit(e.pos)) { this.damageEnemy(e, CONFIG.player.punchDamage, effects); return { kind: 'enemy', pos: e.pos }; }
    }
    return null;
  }

  // Hitscan pistol shot from the camera through screen centre.
  shoot(player, camera, peds, police, traffic, effects, audio) {
    if (!player.armed || player.ammo <= 0 || player.shootTimer > 0) return null;
    player.shootTimer = CONFIG.player.fireCooldown;
    player.ammo -= 1;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    this.raycaster.far = CONFIG.player.pistolRange;
    const targets = [];
    for (const p of peds.peds) if (!p.down) targets.push({ obj: p.group, kind: 'ped', ref: p });
    for (const c of police.cops) targets.push({ obj: c.group, kind: 'cop', ref: c });
    for (const e of this.enemies) if (e.alive) targets.push({ obj: e.group, kind: 'enemy', ref: e });
    for (const car of traffic.cars) targets.push({ obj: car.vehicle.group, kind: 'car', ref: car });
    for (const c of police.cruisers) targets.push({ obj: c.group, kind: 'cruiser', ref: c });
    const hits = this.raycaster.intersectObjects(targets.map((t) => t.obj), true);
    let result = { kind: 'miss' };
    if (hits.length > 0) {
      const hit = hits[0];
      let node = hit.object;
      while (node.parent && node.parent !== this.scene) node = node.parent;
      const t = targets.find((x) => x.obj === node);
      if (t) {
        if (t.kind === 'ped') { peds.hitAt(t.ref.pos, 2.4); result = { kind: 'ped', pos: t.ref.pos }; }
        else if (t.kind === 'cop') {
          this.scene.remove(t.ref.group);
          police.cops.splice(police.cops.indexOf(t.ref), 1);
          police.addHeat(CONFIG.wanted.heatPerCopDown);
          result = { kind: 'cop', pos: t.ref.pos };
        } else if (t.kind === 'enemy') {
          this.damageEnemy(t.ref, CONFIG.player.punchDamage + 9, effects);
          result = { kind: 'enemy', pos: t.ref.pos };
        } else if (t.kind === 'car' || t.kind === 'cruiser') {
          const v = t.kind === 'car' ? t.ref.vehicle : t.ref;
          v.damage(18);
          result = { kind: t.kind, pos: v.pos };
        }
        if (effects) effects.sparks(hit.point.x, hit.point.y, hit.point.z, 8);
      }
    }
    if (effects) {
      const m = new THREE.Vector3();
      camera.getWorldPosition(m);
      effects.muzzle(m.x, m.y - 0.3, m.z);
    }
    if (audio) audio.shot();
    return result;
  }

  damageEnemy(e, dmg, effects) {
    e.health -= dmg;
    if (effects) effects.sparks(e.pos.x, 1.4, e.pos.z, 6);
    if (e.health <= 0) {
      e.alive = false;
      e.group.visible = false;
    }
  }

  // Spawn a hostile crew member (mission turf wars) at x,z.
  spawnEnemy(x, z, health = 70) {
    const g = new THREE.Group();
    const red = new THREE.MeshLambertMaterial({ color: 0x8e1f2f });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.5), red);
    body.position.y = 1.25;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
    head.position.y = 2.05;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.5, 0.9, 0.3);
    g.add(body, head, gun);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const e = { group: g, pos: new THREE.Vector3(x, 0, z), health, fireTimer: 1.5, alive: true };
    this.enemies.push(e);
    return e;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.group);
    this.enemies = [];
  }

  // Enemies shoot at the player on a timer; accuracy falls with distance.
  update(dt, player, effects, audio) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const pp = player.position;
      const d = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z);
      e.fireTimer -= dt;
      if (d < 55 && e.fireTimer <= 0) {
        e.fireTimer = 1.1 + Math.random() * 0.9;
        // face the player, then fire
        e.group.rotation.y = Math.atan2(pp.x - e.pos.x, pp.z - e.pos.z);
        const hitChance = Math.max(0.12, 0.55 - d / 90);
        if (Math.random() < hitChance) {
          player.takeDamage(7);
          if (effects) effects.sparks(pp.x, 1.4, pp.z, 5);
          if (audio) audio.hit();
        } else if (effects) {
          effects.sparks(e.pos.x + Math.sin(e.group.rotation.y) * 2, 1.2, e.pos.z + Math.cos(e.group.rotation.y) * 2, 3);
        }
        if (audio) audio.enemyShot();
      }
    }
  }
}
