// Effects — pooled particles for smoke, sparks, muzzle flashes and
// explosions, plus skid marks. One shared pool, no per-frame allocation.
import * as THREE from '../vendor/three.module.min.js';

const POOL = 240;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    const geo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      this.particles.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, max: 1, grow: 0, grav: 0 });
    }
    this.cursor = 0;
    this.skids = [];
  }

  spawn(x, y, z, color, n, speed, life, grow = 0, grav = 0, up = 0.5) {
    for (let k = 0; k < n; k++) {
      const p = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % POOL;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 0.95;
      p.mesh.scale.setScalar(1);
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.sin(a) * s; p.vz = Math.cos(a) * s;
      p.vy = up * speed * (0.4 + Math.random() * 0.8);
      p.life = p.max = life * (0.6 + Math.random() * 0.7);
      p.grow = grow; p.grav = grav;
    }
  }

  smoke(x, y, z, n = 1) { this.spawn(x, y, z, 0x9a9a9a, n, 0.7, 1.4, 1.6, 0.4, 0.9); }
  sparks(x, y, z, n = 6) { this.spawn(x, y, z, 0xffc233, n, 6, 0.45, 0, -9, 0.7); }
  muzzle(x, y, z) { this.spawn(x, y, z, 0xffe27a, 4, 2, 0.12, 0, 0, 0.2); }
  explosion(x, y, z) {
    this.spawn(x, y, z, 0xff7a1a, 26, 8, 0.8, 1.2, -4, 1);
    this.spawn(x, y, z, 0x555555, 14, 3, 1.8, 2.2, 0.8, 1);
    this.spawn(x, y, z, 0xffd700, 10, 10, 0.3, 0, -6, 0.6);
  }

  skid(x, z, heading) {
    if (this.skids.length > 60) {
      const old = this.skids.shift();
      this.scene.remove(old);
    }
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 2.2),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -heading;
    m.position.set(x, 0.06, z);
    this.scene.add(m);
    this.skids.push(m);
  }

  update(dt) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; p.mesh.material.opacity = 0; continue; }
      p.vy -= p.grav * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.15) p.mesh.position.y = 0.15;
      p.mesh.material.opacity = 0.95 * (p.life / p.max);
      if (p.grow) p.mesh.scale.addScalar(p.grow * dt);
    }
  }
}
