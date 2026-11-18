// MARISOL BAY — traffic.js
// One job: the city's background traffic. A dozen AI cars cruise the
// road grid on fixed lanes, slow for each other, and honk when the
// player blocks them. They are not the player's cars — they belong to
// the city — but they make the streets feel alive in every screenshot.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp } from './random.js';
import { buildCarMesh } from './vehicle.js';

export function createTraffic(G) {
  const T = { cars: [] };
  const types = ['sedan', 'taxi', 'van', 'sedan', 'truck', 'sedan'];
  const colors = [0x3fa7ff, 0xffc21c, 0x9aa5b1, 0xff8fa3, 0x7dff6a, 0xc3aed6, 0xf4a261, 0xffffff];
  for (let i = 0; i < 14; i++) {
    const road = G.world.roads[Math.floor(G.rng() * G.world.roads.length)];
    const horizontal = G.rng() < 0.5;
    const along = (G.rng() * 2 - 1) * (CFG.citySize / 2 - 20);
    const type = types[i % types.length];
    const mesh = buildCarMesh(type, colors[i % colors.length]);
    const x = horizontal ? along : road + (G.rng() < 0.5 ? 3.5 : -3.5);
    const z = horizontal ? road + (G.rng() < 0.5 ? 3.5 : -3.5) : along;
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    T.cars.push({
      mesh, pos: mesh.position, type,
      angle: horizontal ? (z > road ? Math.PI / 2 : -Math.PI / 2) : (x > road ? Math.PI : 0),
      speed: 0, cruise: 9 + G.rng() * 6, road, horizontal, lane: (G.rng() < 0.5 ? 3.5 : -3.5),
      honkAt: 0,
    });
  }
  return T;
}

export function updateTraffic(G, dt) {
  const T = G.traffic;
  const half = CFG.citySize / 2;
  for (const c of T.cars) {
    // slow down for the car ahead on the same lane
    let target = c.cruise;
    for (const o of T.cars) {
      if (o === c || o.horizontal !== c.horizontal || Math.abs(o.road - c.road) > 1) continue;
      const ahead = c.horizontal
        ? (c.angle > 0 ? o.pos.x - c.pos.x : c.pos.x - o.pos.x)
        : (c.angle === 0 ? o.pos.z - c.pos.z : c.pos.z - o.pos.z);
      if (ahead > 0 && ahead < 12) target = 0;
    }
    // stop for the player standing in the road, and honk about it
    const p = G.player.pos;
    const pd = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
    if (G.player.onFoot && pd < 9) {
      target = 0;
      if (G.time - c.honkAt > 3) { c.honkAt = G.time; G.audio.horn(); }
    }
    c.speed += clamp(target - c.speed, -14 * dt, 8 * dt);
    c.pos.x += Math.sin(c.angle) * c.speed * dt;
    c.pos.z += Math.cos(c.angle) * c.speed * dt;
    // wrap around the city edge so traffic never runs out
    if (c.pos.x > half + 10) c.pos.x = -half - 10;
    if (c.pos.x < -half - 10) c.pos.x = half + 10;
    if (c.pos.z > half + 10) c.pos.z = -half - 10;
    if (c.pos.z < -half - 10) c.pos.z = half + 10;
    c.mesh.position.copy(c.pos);
    c.mesh.rotation.y = c.angle;
    for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2;
  }
}
