// Milo Kade on foot: third-person movement, run, jump, and getting in and out
// of cars. Driving itself lives in vehicle.js; this module only moves the body.
import * as THREE from '../vendor/three.module.min.js';
import { PLAYER } from './config.js';
import { collideCircle } from './world.js';
import { clamp, angleLerp } from './random.js';

function makeHumanoid(shirt, pants, skin) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), mat(shirt));
  torso.position.y = 1.12; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), mat(skin));
  head.position.y = 1.68; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36), mat(0x1e3a5f));
  cap.position.y = 1.88; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.26), mat(pants));
  legL.position.set(-0.16, 0.36, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.22), mat(shirt));
  armL.position.set(-0.42, 1.12, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  g.userData = { legL, legR, armL, armR, torso };
  return g;
}

export function createPlayer(G) {
  const group = makeHumanoid(0x1e8a7a, 0x2c2f36, 0xd9a066);
  group.position.set(-100, 0, -160);
  G.scene.add(group);
  const player = {
    group, yaw: 0, vy: 0, grounded: true, hp: PLAYER.HP, inCar: false, car: null,
    walkPhase: 0, speed: 0, punchTimer: 0,
    get x() { return group.position.x; },
    get z() { return group.position.z; },
    reset(x, z) {
      group.position.set(x, 0, z); this.yaw = 0; this.hp = PLAYER.HP;
      this.inCar = false; this.car = null; group.visible = true;
    },
    takeDamage(n) {
      this.hp = Math.max(0, this.hp - n);
      G.hud.flashDamage();
      if (this.hp <= 0) G.setMode('wasted');
    },
    heal(n) { this.hp = Math.min(PLAYER.HP, this.hp + n); },
  };

  player.update = (dt) => {
    if (player.inCar || G.state.mode !== 'playing') return;
    const input = G.input;
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? PLAYER.RUN : PLAYER.WALK;
    const mx = input.axisX(), mz = input.axisY();
    // Movement is relative to the camera yaw, so W always runs away from the camera.
    // Camera forward is (sin yaw, cos yaw); screen-right is (-cos yaw, sin yaw).
    const camYaw = G.cameraRig.yaw;
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    let dx = mz * sin - mx * cos, dz = mz * cos + mx * sin;
    const len = Math.hypot(dx, dz);
    if (len > 0.01) {
      dx /= len; dz /= len;
      const targetYaw = Math.atan2(dx, dz);
      player.yaw = angleLerp(player.yaw, targetYaw, dt * 12);
      group.rotation.y = player.yaw;
      let nx = group.position.x + dx * speed * dt;
      let nz = group.position.z + dz * speed * dt;
      const hit = collideCircle(G.world, nx, nz, PLAYER.RADIUS);
      group.position.x = hit.x; group.position.z = hit.z;
      player.speed = speed;
      player.walkPhase += dt * speed * 1.6;
    } else {
      player.speed = 0;
      player.walkPhase += dt * 2;
    }
    // Jump.
    if (input.pressed('Space') && player.grounded) { player.vy = PLAYER.JUMP; player.grounded = false; }
    if (!player.grounded) {
      player.vy -= 22 * dt;
      group.position.y += player.vy * dt;
      if (group.position.y <= 0) { group.position.y = 0; player.vy = 0; player.grounded = true; }
    }
    // Walk-cycle swing, eased out when idle.
    const amp = clamp(player.speed / PLAYER.RUN, 0, 1) * 0.55;
    const s = Math.sin(player.walkPhase);
    const u = group.userData;
    u.legL.rotation.x = s * amp; u.legR.rotation.x = -s * amp;
    u.armL.rotation.x = -s * amp * 0.8; u.armR.rotation.x = s * amp * 0.8;
    if (player.punchTimer > 0) {
      player.punchTimer -= dt;
      u.armR.rotation.x = -1.9 * clamp(player.punchTimer / PLAYER.PUNCH_CD, 0, 1);
    }
    // Slow health regen when calm.
    if (G.state.wanted === 0 && player.hp < PLAYER.HP) player.hp = Math.min(PLAYER.HP, player.hp + 2 * dt);
  };

  // Nearest car the player could get into (parked, traffic or abandoned).
  player.nearestCar = (maxD) => {
    let best = null, bd = maxD || 3.5;
    for (const car of G.vehicles.list) {
      if (car.driver === 'player' || car.wrecked) continue;
      const d = Math.hypot(car.group.position.x - group.position.x, car.group.position.z - group.position.z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  };

  player.tryEnterExit = () => {
    if (player.inCar) { G.vehicles.exitCar(); return; }
    const car = player.nearestCar(3.5);
    if (car) G.vehicles.enterCar(car);
  };
  return player;
}

// A generic humanoid (pedestrians, gang, cops) — same build, different shirt.
export function makePedestrian(shirt, pants) {
  return makeHumanoid(shirt, pants, 0xd9a066);
}
