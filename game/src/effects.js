// Marisol Bay — particle effects.
// One clear job: one pooled THREE.Points cloud for skid smoke, muzzle
// flashes, sparks and explosions. No textures, no assets.
import * as THREE from 'three';

const MAX = 600;

export function createEffects(scene) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.55, vertexColors: true, transparent: true, opacity: 0.9,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX; i++) {
    parts.push({ alive: false, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
    positions[i * 3 + 1] = -99;
  }
  let cursor = 0;
  const effects = { points, parts, positions, colors };

  function spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX;
    p.alive = true; p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.max = life;
    const i = parts.indexOf(p);
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
    geo.attributes.color.needsUpdate = true;
  }

  effects.smoke = (x, y, z, n = 6) => {
    for (let i = 0; i < n; i++) {
      spawn(x + (Math.random() - 0.5), y + Math.random() * 0.4, z + (Math.random() - 0.5),
        (Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5,
        0.7 + Math.random() * 0.6, 0.55, 0.55, 0.58);
    }
  };
  effects.sparks = (x, y, z, n = 10) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      spawn(x, y, z, Math.cos(a) * 6, 1 + Math.random() * 4, Math.sin(a) * 6,
        0.25 + Math.random() * 0.3, 1.0, 0.75, 0.2);
    }
  };
  effects.muzzle = (x, y, z, dirX, dirZ) => {
    for (let i = 0; i < 5; i++) {
      spawn(x, y, z, dirX * 8 + (Math.random() - 0.5) * 2, Math.random(), dirZ * 8 + (Math.random() - 0.5) * 2,
        0.12 + Math.random() * 0.1, 1.0, 0.85, 0.3);
    }
  };
  effects.explosion = (x, y, z) => {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 7;
      spawn(x, y + 0.5, z, Math.cos(a) * (2 + Math.random() * 6), up, Math.sin(a) * (2 + Math.random() * 6),
        0.6 + Math.random() * 0.7, 1.0, 0.45 + Math.random() * 0.3, 0.1);
    }
    effects.smoke(x, y + 1, z, 14);
  };

  effects.update = (dt) => {
    for (let i = 0; i < MAX; i++) {
      const p = parts[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; positions[i * 3 + 1] = -99; continue; }
      p.vy -= 2.5 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
      positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
      const fade = p.life / p.max;
      colors[i * 3] *= 0.985 + fade * 0.01; // slight fade; colour set at spawn
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  return effects;
}
