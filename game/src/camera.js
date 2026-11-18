// Third-person follow camera: behind Milo on foot, behind the car while driving,
// slow orbit over the city on the menu. Drag the mouse to look around; in a car
// the camera settles behind the car's heading.
import * as THREE from '../vendor/three.module.min.js';
import { clamp, angleLerp } from './random.js';

export function createCameraRig(G) {
  const rig = {
    mode: 'menu', // 'menu' | 'foot' | 'car' | 'fixed'
    yaw: 0, pitch: 0.32,
    fixedPos: new THREE.Vector3(0, 30, 60),
    fixedTarget: new THREE.Vector3(0, 0, 0),
    orbitT: 0,
    setFixed(x, y, z, tx, ty, tz) {
      this.mode = 'fixed';
      this.fixedPos.set(x, y, z);
      this.fixedTarget.set(tx, ty, tz);
    },
    update(dt) {
      const cam = G.camera;
      if (this.mode === 'fixed') {
        cam.position.lerp(this.fixedPos, Math.min(1, dt * 4));
        cam.lookAt(this.fixedTarget);
        return;
      }
      if (this.mode === 'menu') {
        this.orbitT += dt * 0.045;
        const r = 190;
        cam.position.set(Math.cos(this.orbitT) * r, 85, Math.sin(this.orbitT) * r);
        cam.lookAt(20, 0, 0);
        return;
      }
      // Mouse drag orbits the view.
      const look = G.input.lookDelta();
      this.yaw -= look.x * 0.0032;
      this.pitch = clamp(this.pitch + look.y * 0.0022, -0.15, 0.9);
      const inCar = G.player.inCar && G.player.car;
      if (inCar) {
        // Settle behind the car's heading (unless the player is dragging).
        if (Math.abs(look.x) < 2) this.yaw = angleLerp(this.yaw, G.player.car.yaw, dt * 1.6);
      }
      const target = inCar ? G.player.car.group.position : G.player.group.position;
      const dist = inCar ? 11 : 7.5;
      const height = inCar ? 4.6 : 3.4;
      // Camera yaw: 0 looks along +Z; the player faces yaw measured the same way.
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      const px = target.x - sy * dist * Math.cos(this.pitch);
      const pz = target.z - cy * dist * Math.cos(this.pitch);
      const py = target.y + height + Math.sin(this.pitch) * dist * 0.5;
      cam.position.x += (px - cam.position.x) * Math.min(1, dt * 7);
      cam.position.y += (py - cam.position.y) * Math.min(1, dt * 7);
      cam.position.z += (pz - cam.position.z) * Math.min(1, dt * 7);
      cam.lookAt(target.x, target.y + 1.6, target.z);
    },
  };
  return rig;
}
