// Particles: one THREE.Points pool for skid smoke, muzzle sparks, hits and
// explosions. Colours fade to black (additive blending) so dead particles vanish.
import * as THREE from '../vendor/three.module.min.js';

const MAX = 700;

export function createEffects(G) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.7, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  G.scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX; i++) parts.push({ alive: false, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1, grav: 0 });
  let cursor = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b, grav) {
    const p = parts[cursor]; cursor = (cursor + 1) % MAX;
    p.alive = true; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.max = life; p.r = r; p.g = g; p.b = b; p.grav = grav || 0;
  }
  function burst(p, color, n, speed, life, up) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawn(p.x, p.y, p.z,
        Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + (up || 0), Math.sin(a) * Math.cos(e) * s,
        life * (0.6 + Math.random() * 0.7), c.r, c.g, c.b, -4);
    }
  }
  return {
    burst,
    smoke(p) { // grey-ish puff, slow rise
      for (let i = 0; i < 3; i++) {
        spawn(p.x + (Math.random() - 0.5), p.y + 0.2, p.z + (Math.random() - 0.5),
          (Math.random() - 0.5) * 0.6, 0.8 + Math.random(), (Math.random() - 0.5) * 0.6,
          0.9, 0.45, 0.45, 0.48, 1.5);
      }
    },
    sparks(p) { burst(p, 0xffd23a, 10, 7, 0.4, 2); },
    blood(p) { burst(p, 0xc0392b, 8, 4, 0.5, 1); },
    explosion(p) {
      burst(p, 0xff7a1a, 26, 11, 0.9, 3);
      burst(p, 0xffe08a, 14, 6, 0.6, 2);
    },
    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = parts[i];
        if (!p.alive) { pos[i * 3 + 1] = -99; continue; }
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; pos[i * 3 + 1] = -99; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
        p.vy += p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
        const f = p.life / p.max;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        col[i * 3] = p.r * f; col[i * 3 + 1] = p.g * f; col[i * 3 + 2] = p.b * f;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
