// MARISOL BAY — effects.js
// One job: particles — skid smoke, crash sparks, muzzle flashes, dust
// and the little cash sparkle when turf income lands. One shared pool
// of small bright meshes, recycled every frame, so nothing allocates
// while the chase is running.
import * as THREE from 'three';

export function createEffects(scene) {
  const MAX = 420;
  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const mats = {};
  const pool = [];
  for (let i = 0; i < MAX; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    m.visible = false; scene.add(m); pool.push({ mesh: m, life: 0, max: 1, vel: new THREE.Vector3(), grav: 0, grow: 0 });
  }
  let cursor = 0;
  const E = { pool, MAX };
  function spawn(x, y, z, color, count, speed, life, grav, size, grow) {
    for (let n = 0; n < count; n++) {
      const p = pool[cursor]; cursor = (cursor + 1) % MAX;
      p.mesh.visible = true;
      p.mesh.position.set(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, z + (Math.random() - 0.5) * 0.4);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(size || 1);
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      p.vel.set(Math.cos(a) * Math.cos(b), Math.abs(Math.sin(b)) + 0.4, Math.sin(a) * Math.cos(b)).multiplyScalar(speed * (0.5 + Math.random()));
      p.life = 0; p.max = life * (0.6 + Math.random() * 0.8); p.grav = grav; p.grow = grow || 0;
    }
  }
  E.smoke = (x, y, z, n) => spawn(x, y, z, 0xd8d8d8, n || 6, 1.6, 0.9, 1.5, 1.6, 2.2);
  E.sparks = (x, y, z, n) => spawn(x, y, z, 0xffc21c, n || 10, 7, 0.5, -6, 0.8, 0);
  E.muzzle = (x, y, z) => spawn(x, y, z, 0xffe066, 8, 4, 0.12, 0, 1.4, 0);
  E.dust = (x, y, z, n) => spawn(x, y, z, 0xe8d9a0, n || 4, 1.2, 0.7, 0.5, 1.2, 1.5);
  E.cash = (x, y, z) => spawn(x, y, z, 0x7dff6a, 12, 3, 0.8, 2, 1, 0);
  E.splash = (x, y, z) => spawn(x, y, z, 0x2ec8d8, 10, 4, 0.6, -8, 1, 0);
  E.update = (dt) => {
    for (const p of pool) {
      if (!p.mesh.visible) continue;
      p.life += dt;
      if (p.life >= p.max) { p.mesh.visible = false; continue; }
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = 1 - p.life / p.max;
      if (p.grow) p.mesh.scale.addScalar(p.grow * dt);
    }
  };
  return E;
}
