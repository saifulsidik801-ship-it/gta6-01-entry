// MARISOL BAY — pedestrians.js
// One job: the people on the sidewalks. They stroll the blocks in
// bright clothes, scatter when a gun goes off, and occasionally flag
// a taxi — a waving pedestrian is a fare waiting to happen.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp } from './random.js';
import { hitsBuilding } from './world.js';

const SHIRTS = [0xff6b6b, 0xffd166, 0x6bcBff, 0x95d5b2, 0xf4978e, 0xc3aed6, 0xffb703, 0xffffff, 0x8ecae6];

export function createPedestrians(G) {
  const P = { list: [] };
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[i % SHIRTS.length] });
    const skin = new THREE.MeshLambertMaterial({ color: [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf2c9a0][i % 4] });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), shirt);
    body.position.y = 1.15; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.44), skin);
    head.position.y = 1.85; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), new THREE.MeshLambertMaterial({ color: 0x2b3a55 }));
    legL.position.set(-0.18, 0.35, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);
    const x = (G.rng() * 2 - 1) * (CFG.citySize / 2 - 20);
    const z = (G.rng() * 2 - 1) * (CFG.citySize / 2 - 20);
    g.position.set(x, 0, z);
    G.scene.add(g);
    P.list.push({
      mesh: g, pos: g.position, angle: G.rng() * Math.PI * 2,
      speed: 1.4 + G.rng() * 1.2, legL, legR, phase: G.rng() * 6,
      flee: 0, waving: false, waitTimer: 2 + G.rng() * 8,
    });
  }
  return P;
}

export function updatePedestrians(G, dt) {
  const half = CFG.citySize / 2;
  for (const p of G.pedestrians.list) {
    p.waitTimer -= dt;
    if (p.waitTimer <= 0) {
      // pick a new direction along a sidewalk, or wave for a taxi
      p.angle = Math.floor(G.rng() * 4) * Math.PI / 2 + (G.rng() < 0.5 ? 0 : Math.PI / 4);
      p.waitTimer = 3 + G.rng() * 7;
      p.waving = G.player.car && G.player.car.type === 'taxi' && G.rng() < 0.25 && !G.taxi.active;
    }
    const speed = p.flee > 0 ? 6 : p.speed;
    p.flee = Math.max(0, p.flee - dt);
    const nx = p.pos.x + Math.sin(p.angle) * speed * dt;
    const nz = p.pos.z + Math.cos(p.angle) * speed * dt;
    if (!hitsBuilding(G.world, nx, nz, 0.8) && Math.abs(nx) < half && Math.abs(nz) < half) {
      p.pos.x = nx; p.pos.z = nz;
    } else {
      p.angle += Math.PI / 2; // turn the corner instead of walking into a wall
    }
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.angle;
    p.phase += dt * (p.flee > 0 ? 14 : 8);
    const swing = Math.sin(p.phase) * 0.5;
    p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
    // waving pedestrian: a hopeful head-tilt toward the taxi
    p.mesh.children[1].rotation.z = p.waving ? 0.45 : 0;
  }
}

// Everyone within earshot runs from a gunshot.
export function scatterPedestrians(G, x, z, radius) {
  for (const p of G.pedestrians.list) {
    const d = Math.hypot(p.pos.x - x, p.pos.z - z);
    if (d < radius) {
      p.flee = 2.5;
      p.angle = Math.atan2(p.pos.x - x, p.pos.z - z);
      p.waving = false;
    }
  }
}
