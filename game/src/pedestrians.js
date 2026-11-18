// Marisol Bay — pedestrians.
// One clear job: people on the sidewalks — walking, turning at corners,
// waiting at kerbs, and running away when a car or a gunshot comes close.
import * as THREE from 'three';
import { CONFIG, nearestRoadCoord, roadCoord } from './config.js';
import { mulberry32, pick, range } from './random.js';

const SHIRTS = [0xd84f4f, 0x4f7fd8, 0x53b06a, 0xd8b84f, 0x8a5fb5, 0xe8e8e8, 0x4fb5a8, 0xd87f4f];

export function buildPedMesh(shirtColor) {
  const group = new THREE.Group();
  const skinTones = [0xc98d64, 0x8a5a3b, 0xe8b98a];
  const skin = new THREE.MeshLambertMaterial({ color: skinTones[Math.floor(Math.random() * skinTones.length)] });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const legGeo = new THREE.BoxGeometry(0.24, 0.8, 0.24);
  const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.15, 0.4, 0);
  const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.15, 0.4, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.36), shirt);
  torso.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 1.85;
  group.add(legL, legR, torso, head);
  group.userData = { legL, legR };
  return group;
}

export function createPedestrians(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildPedMesh(SHIRTS[Math.floor(rng() * SHIRTS.length)]);
    const road = roadCoord(Math.floor(rng() * 9));
    const along = range(rng, -280, 280);
    const vertical = rng() < 0.5;
    const x = vertical ? road + (rng() < 0.5 ? -9 : 9) : along;
    const z = vertical ? along : road + (rng() < 0.5 ? -9 : 9);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh, pos: mesh.position,
      angle: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 1.4,
      phase: rng() * 6,
      down: false, fleeing: false, waitT: rng() * 4,
    });
  }
  return peds;
}

export function updatePedestrians(G, dt) {
  const player = G.player;
  const px = player.onFoot ? player.pos.x : (player.vehicle ? player.vehicle.pos.x : 0);
  const pz = player.onFoot ? player.pos.z : (player.vehicle ? player.vehicle.pos.z : 0);
  const playerSpeed = player.onFoot ? player.speed : (player.vehicle ? Math.abs(player.vehicle.speed) : 0);
  for (const ped of G.peds) {
    if (ped.down) continue;
    const dx = ped.pos.x - px; const dz = ped.pos.z - pz;
    const d = Math.hypot(dx, dz);
    // Flee fast cars, gunfire and the player running at them.
    ped.fleeing = d < 14 && (playerSpeed > 12 || G.combat.shotsFiredRecently > 0);
    if (ped.fleeing) {
      ped.angle = Math.atan2(dx, dz);
      ped.pos.x += Math.sin(ped.angle) * 5.5 * dt;
      ped.pos.z += Math.cos(ped.angle) * 5.5 * dt;
    } else {
      if (ped.waitT > 0) {
        ped.waitT -= dt;
      } else {
        ped.pos.x += Math.sin(ped.angle) * ped.speed * dt;
        ped.pos.z += Math.cos(ped.angle) * ped.speed * dt;
        // Turn at intersections or at the city edge.
        const nearX = Math.abs(ped.pos.x - nearestRoadCoord(ped.pos.x)) < 1.5;
        const nearZ = Math.abs(ped.pos.z - nearestRoadCoord(ped.pos.z)) < 1.5;
        if ((nearX && nearZ && Math.random() < dt * 0.3) || Math.abs(ped.pos.x) > 295 || Math.abs(ped.pos.z) > 295) {
          ped.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
          ped.waitT = Math.random() * 2;
        }
      }
    }
    ped.phase += dt * (ped.fleeing ? 9 : 5);
    ped.mesh.rotation.y = ped.angle;
    const swing = Math.sin(ped.phase) * 0.5;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    // Keep pedestrians out of buildings.
    const bx = Math.max(-295, Math.min(295, ped.pos.x));
    const bz = Math.max(-295, Math.min(295, ped.pos.z));
    ped.pos.x = bx; ped.pos.z = bz;
  }
}
