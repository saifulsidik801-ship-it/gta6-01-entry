// Camera — third-person follow rig with speed-based FOV, smoothed position,
// look-ahead on the player's heading, and a trauma-based shake for crashes
// and gunfire. One rig serves on-foot, driving and cinematic shot angles.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 8, -14);
    this.look = new THREE.Vector3(0, 1, 0);
    this.shake = 0;
    this.mode = 'follow';
    this.fixed = null; // {pos, look} for shot mode
  }

  addShake(n) { this.shake = Math.min(1, this.shake + n); }

  setFixed(pos, look) {
    this.mode = 'fixed';
    this.fixed = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look) };
  }

  update(dt, target, driving, speed) {
    if (this.mode === 'fixed' && this.fixed) {
      this.camera.position.copy(this.fixed.pos);
      this.camera.lookAt(this.fixed.look);
      return;
    }
    const cfg = CONFIG.camera;
    const dist = driving ? cfg.driveDist : cfg.footDist;
    const height = driving ? cfg.driveHeight : cfg.footHeight;
    const behind = target.heading + Math.PI;
    // camera sits behind the heading; when reversing, keep it behind the car
    const bx = target.pos.x + Math.sin(behind) * dist;
    const bz = target.pos.z + Math.cos(behind) * dist;
    const k = 1 - Math.exp(-dt * (driving ? 5 : 8));
    this.pos.x += (bx - this.pos.x) * k;
    this.pos.y += (height - this.pos.y) * k;
    this.pos.z += (bz - this.pos.z) * k;
    // look slightly ahead of the target
    const lx = target.pos.x + Math.sin(target.heading) * (driving ? 6 : 2.5);
    const lz = target.pos.z + Math.cos(target.heading) * (driving ? 6 : 2.5);
    this.look.x += (lx - this.look.x) * (1 - Math.exp(-dt * 10));
    this.look.y += (1.6 - this.look.y) * (1 - Math.exp(-dt * 10));
    this.look.z += (lz - this.look.z) * (1 - Math.exp(-dt * 10));
    // shake decay
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sh = this.shake * this.shake * 0.55;
    const ox = (Math.random() - 0.5) * sh;
    const oy = (Math.random() - 0.5) * sh;
    this.camera.position.set(this.pos.x + ox, this.pos.y + oy, this.pos.z);
    this.camera.lookAt(this.look);
    // FOV widens with speed while driving
    const targetFov = driving ? cfg.cruiseFov + Math.min(14, Math.abs(speed) * 0.28) : cfg.cruiseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }

  snapBehind(target, driving) {
    const cfg = CONFIG.camera;
    const dist = driving ? cfg.driveDist : cfg.footDist;
    const height = driving ? cfg.driveHeight : cfg.footHeight;
    const behind = target.heading + Math.PI;
    this.pos.set(
      target.pos.x + Math.sin(behind) * dist,
      height,
      target.pos.z + Math.cos(behind) * dist,
    );
    this.look.set(target.pos.x, 1.6, target.pos.z);
  }
}
