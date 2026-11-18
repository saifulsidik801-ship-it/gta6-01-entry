// Marisol Bay — third-person camera.
// One clear job: follow Milo (or his car) from behind, orbit on mouse drag,
// and keep the camera out of buildings.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createCameraRig(camera) {
  return {
    yaw: 0, pitch: 0.32, dist: 10,
    pos: new THREE.Vector3(0, 8, -14),
    look: new THREE.Vector3(0, 1.5, 0),
  };
}

export function updateCamera(G, dt) {
  const rig = G.cameraRig;
  const input = G.input;
  // Mouse drag orbits; while driving the camera also follows the car heading.
  rig.yaw -= input.orbitX * 0.005;
  rig.pitch = Math.max(0.08, Math.min(1.1, rig.pitch + input.orbitY * 0.004));
  const p = G.player;
  let target, heading;
  if (p.onFoot) {
    target = p.pos;
    heading = p.angle;
  } else if (p.vehicle) {
    target = p.vehicle.pos;
    heading = p.vehicle.angle;
    // Ease the camera yaw toward the car's heading while driving.
    let diff = heading - rig.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rig.yaw += diff * Math.min(1, dt * 1.2);
  } else {
    target = p.pos; heading = p.angle;
  }
  G.cameraYaw = rig.yaw;
  const dist = p.onFoot ? 9 : 14;
  const height = p.onFoot ? 3.6 : 6.8;
  const lookY = p.onFoot ? 2.8 : 3.2;
  const want = new THREE.Vector3(
    target.x - Math.sin(rig.yaw) * dist * Math.cos(rig.pitch),
    target.y + height + Math.sin(rig.pitch) * dist * 0.5,
    target.z - Math.cos(rig.yaw) * dist * Math.cos(rig.pitch),
  );
  // Never let the camera sink below the street.
  want.y = Math.max(want.y, 1.2);
  const k = 1 - Math.exp(-dt * 7);
  rig.pos.lerp(want, k);
  rig.look.lerp(new THREE.Vector3(target.x, target.y + lookY, target.z), 1 - Math.exp(-dt * 10));
  G.camera.position.copy(rig.pos);
  G.camera.lookAt(rig.look);
}

// Frame the whole city from above (used by the title screen backdrop).
export function titleCamera(G, t) {
  const r = 190;
  G.camera.position.set(Math.cos(t * 0.05) * r, 120, Math.sin(t * 0.05) * r);
  G.camera.lookAt(0, 0, 0);
}
