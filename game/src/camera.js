// MARISOL BAY — camera.js
// One job: the third-person chase camera. It orbits behind Milo on
// foot, swings wide and low behind a car at speed, and never clips
// through the ground. Drag with the mouse to look around; the wheel
// zooms the follow distance.
import * as THREE from 'three';
import { clamp, angleDiff } from './random.js';

export function createCamera(camera) {
  const C = { yaw: Math.PI, pitch: 0.32, dist: 9, target: new THREE.Vector3(), smooth: new THREE.Vector3(0, 2, 0) };
  C.update = (G, dt) => {
    const input = G.input;
    C.yaw -= input.mouseDX * 0.004;
    C.pitch = clamp(C.pitch + input.mouseDY * 0.003, 0.05, 1.1);
    C.dist = clamp(C.dist + input.wheel * 0.01, 5, 16);
    const focus = G.player.onFoot ? G.player.pos : (G.player.car ? G.player.car.pos : G.player.pos);
    const driving = !!G.player.car;
    // The cover chase is shot from a three-quarter rear angle so the
    // patrol cars behind Milo stay in frame instead of behind the lens.
    const shotOffset = G.shotMode === 'chase' ? 0.55 : 0;
    const wantYaw = driving ? G.player.car.angle + Math.PI + shotOffset : C.yaw;
    // On foot the camera follows the drag; in a car it eases back behind the car.
    C.yaw += angleDiff(C.yaw, driving ? wantYaw : C.yaw) * Math.min(1, dt * (driving ? 3.5 : 8));
    const speedBoost = driving ? Math.min(6, Math.abs(G.player.car.speed) * 0.12) : 0;
    const dist = C.dist + speedBoost;
    const cx = focus.x + Math.sin(C.yaw) * Math.cos(C.pitch) * dist;
    const cz = focus.z + Math.cos(C.yaw) * Math.cos(C.pitch) * dist;
    const cy = focus.y + 2.2 + Math.sin(C.pitch) * dist;
    C.target.set(cx, Math.max(cy, 1.6), cz);
    C.smooth.lerp(C.target, Math.min(1, dt * 10));
    camera.position.copy(C.smooth);
    camera.lookAt(focus.x, focus.y + (driving ? 1.6 : 1.8), focus.z);
  };
  return C;
}
