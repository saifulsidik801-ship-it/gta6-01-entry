// MARISOL BAY — player.js
// One job: Milo Kade on foot. WASD movement with a run key, simple
// animated limbs, entering/exiting cars with E, punching with F, and
// the health/busted/wasted states that the police module drives.
import * as THREE from 'three';
import { clamp } from './random.js';
import { hitsBuilding } from './world.js';
import { CFG } from './config.js';

export function createPlayer(G) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff5d7e }); // bright coral tee, readable at distance
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), shirt);
  body.position.y = 1.25; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.5), skin);
  head.position.y = 2.05; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.55), new THREE.MeshLambertMaterial({ color: 0xffd23e }));
  cap.position.y = 2.36; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), pants);
  legL.position.set(-0.22, 0.45, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), shirt);
  armL.position.set(-0.58, 1.3, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.58; g.add(armR);
  // a simple pistol in the right hand when armed
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.55), new THREE.MeshLambertMaterial({ color: 0x14181d }));
  gun.position.set(0.58, 0.95, 0.3); gun.visible = false; g.add(gun);
  g.position.set(0, 0, 24);
  G.scene.add(g);
  const P = {
    mesh: g, pos: g.position, angle: Math.PI, speed: 0, health: CFG.startHealth,
    onFoot: true, car: null, armed: false, ammo: 24, punchCooldown: 0,
    walkPhase: 0, legL, legR, armL, armR, gun, busted: false, wasted: false,
    respawnTimer: 0,
  };
  return P;
}

export function updatePlayer(G, dt) {
  const P = G.player, input = G.input;
  P.punchCooldown = Math.max(0, P.punchCooldown - dt);
  if (P.busted || P.wasted) {
    P.respawnTimer -= dt;
    if (P.respawnTimer <= 0) respawnPlayer(G);
    return;
  }
  if (!P.onFoot) return; // driving is handled by vehicle.js
  const ax = input.axis();
  const running = input.keys.ShiftLeft || input.keys.ShiftRight;
  const speed = running ? 9 : 5.2;
  // Movement is camera-relative so WASD always feels right.
  const camYaw = G.cameraRig.yaw;
  let mx = 0, mz = 0;
  if (ax.y !== 0 || ax.x !== 0) {
    const fwd = { x: -Math.sin(camYaw), z: -Math.cos(camYaw) };
    const right = { x: -fwd.z, z: fwd.x };
    mx = fwd.x * ax.y + right.x * ax.x;
    mz = fwd.z * ax.y + right.z * ax.x;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    P.angle = Math.atan2(mx, mz);
    P.speed = speed;
    P.walkPhase += dt * (running ? 13 : 9);
  } else {
    P.speed = 0;
  }
  const nx = P.pos.x + mx * P.speed * dt;
  const nz = P.pos.z + mz * P.speed * dt;
  const half = CFG.citySize / 2 + 30;
  if (!hitsBuilding(G.world, nx, P.pos.z, 0.7)) P.pos.x = clamp(nx, -half, half);
  if (!hitsBuilding(G.world, P.pos.x, nz, 0.7)) P.pos.z = clamp(nz, -half - 10, half + 44);
  // beach splash
  if (P.pos.z > CFG.citySize / 2 + 22 && Math.abs(P.speed) > 0.5 && Math.random() < 0.25) {
    G.effects.splash(P.pos.x, 0.3, P.pos.z);
  }
  P.mesh.position.copy(P.pos);
  P.mesh.rotation.y = P.angle;
  const swing = P.speed > 0 ? Math.sin(P.walkPhase) * 0.55 : 0;
  P.legL.rotation.x = swing; P.legR.rotation.x = -swing;
  P.armL.rotation.x = -swing * 0.8; P.armR.rotation.x = swing * 0.8;
  P.gun.visible = P.armed;

  // Q: toggle pistol. F: punch. (E enter/exit lives in main.js so one
  // held press can never enter and exit the car on the same frame.)
  if (input.pressed('KeyQ')) { P.armed = !P.armed; G.audio.blip(P.armed ? 700 : 400, 0.08, 'square', 0.15); }
  if (input.keys.KeyF && P.punchCooldown <= 0) {
    P.punchCooldown = 0.45;
    G.combat.punch(G);
  }
}

export function enterCar(G, car) {
  const P = G.player;
  P.onFoot = false; P.car = car; car.parked = false; car.driver = P;
  P.mesh.visible = false;
  G.audio.horn();
  G.hud.flash(`Got the ${car.def.name} — drive!`);
  if (car.type === 'police') { G.wanted = Math.max(G.wanted, 2); G.hud.flash('You stole a patrol car! Heat +2'); }
  else if (G.missionIndex === 0 && G.missions.current && G.missions.current.stage === 0) G.missions.advance(G);
}

export function exitCar(G) {
  const P = G.player;
  if (!P.car) return;
  const car = P.car;
  car.parked = true; car.driver = null;
  const side = { x: car.pos.x + Math.cos(car.angle) * 2.2, z: car.pos.z - Math.sin(car.angle) * 2.2 };
  P.pos.set(side.x, 0, side.z);
  P.onFoot = true; P.car = null; P.mesh.visible = true;
  P.mesh.position.copy(P.pos);
}

export function damagePlayer(G, amount, cause) {
  const P = G.player;
  if (P.busted || P.wasted) return;
  P.health -= amount;
  G.hud.damageFlash();
  if (P.health <= 0) {
    P.health = 0;
    if (cause === 'busted') { P.busted = true; P.respawnTimer = 2.5; G.audio.busted(); G.hud.flash('BUSTED — the cops took $200'); G.cash = Math.max(0, G.cash - 200); }
    else { P.wasted = true; P.respawnTimer = 2.5; G.audio.busted(); G.hud.flash('WASTED — Milo is back on his feet'); G.cash = Math.max(0, G.cash - 100); }
    if (P.car) { P.car.parked = true; P.car.driver = null; P.car = null; }
    P.mesh.visible = true; P.onFoot = true;
  }
}

function respawnPlayer(G) {
  const P = G.player;
  P.busted = false; P.wasted = false;
  P.health = CFG.startHealth;
  G.wanted = 0;
  P.pos.set(0, 0, 24); P.mesh.position.copy(P.pos);
  P.mesh.visible = true; P.onFoot = true; P.car = null;
  G.hud.flash('Back on the streets of Marisol Bay');
}
