// Pedestrians: civilians who walk the sidewalks, bob along, and run away from
// gunfire and speeding cars. They make the city feel inhabited; they never fight.
import { makePedestrian } from './player.js';
import { makeRng, clamp } from './random.js';
import { collideCircle } from './world.js';

const SHIRTS = [0xe8e8e8, 0xf2a541, 0x7ec850, 0xe05d8a, 0x4f8ef7, 0xd8d3c8, 0x8a6fd6];
const PANTS = [0x2c2f36, 0x3a3f47, 0x5b4636, 0x1e3a5f];

export function createPedestrians(G, count) {
  const rng = makeRng(99);
  const walkers = [];
  for (let i = 0; i < count; i++) {
    const shirt = rng.pick(SHIRTS), pants = rng.pick(PANTS);
    const g = makePedestrian(shirt, pants);
    const x = rng.rand(-190, 240), z = rng.rand(-240, 240);
    g.position.set(x, 0, z);
    G.scene.add(g);
    walkers.push({ g, x, z, tx: x, tz: z, speed: rng.rand(1.2, 2.2), phase: rng.rand(0, 6), flee: 0, fx: 0, fz: 0 });
  }
  function retarget(w) {
    // Next stroll: a nearby sidewalk point (near a road edge).
    const near = rng.chance(0.6);
    const bx = near ? Math.round(w.x / 40) * 40 : rng.randi(-5, 5) * 40;
    const bz = near ? Math.round(w.z / 40) * 40 : rng.randi(-5, 5) * 40;
    w.tx = bx + rng.rand(-12, 12);
    w.tz = bz + rng.rand(-12, 12);
  }
  return {
    walkers,
    scare(x, z, radius) {
      for (const w of walkers) {
        const d = Math.hypot(w.x - x, w.z - z);
        if (d < radius) {
          w.flee = 2.5;
          w.fx = (w.x - x) / (d || 1); w.fz = (w.z - z) / (d || 1);
        }
      }
    },
    update(dt) {
      if (G.state.mode !== 'playing') return;
      const px = G.player.x, pz = G.player.z;
      for (const w of walkers) {
        // Drift back near the player when left far behind.
        if (Math.hypot(w.x - px, w.z - pz) > 190) {
          w.x = px + rng.rand(-90, 90); w.z = pz + rng.rand(-90, 90);
          retarget(w);
        }
        let tx = w.tx, tz = w.tz, sp = w.speed;
        if (w.flee > 0) {
          w.flee -= dt;
          tx = w.x + w.fx * 20; tz = w.z + w.fz * 20; sp = 5.5;
        } else if (Math.hypot(tx - w.x, tz - w.z) < 2) retarget(w);
        const dx = tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz) || 1;
        const nx = w.x + (dx / d) * sp * dt, nz = w.z + (dz / d) * sp * dt;
        const hit = collideCircle(G.world, nx, nz, 0.5);
        w.x = hit.x; w.z = hit.z;
        w.g.position.set(w.x, 0, w.z);
        w.g.rotation.y = Math.atan2(dx, dz);
        w.phase += dt * sp * 3.2;
        const s = Math.sin(w.phase);
        const u = w.g.userData;
        u.legL.rotation.x = s * 0.5; u.legR.rotation.x = -s * 0.5;
        u.armL.rotation.x = -s * 0.4; u.armR.rotation.x = s * 0.4;
        // A speeding car nearby scares them off the road.
        const car = G.vehicles.driven;
        if (car && Math.abs(car.speed) > 10) {
          const cd = Math.hypot(car.group.position.x - w.x, car.group.position.z - w.z);
          if (cd < 10) this.scare(car.group.position.x, car.group.position.z, 12);
        }
      }
    },
  };
}
