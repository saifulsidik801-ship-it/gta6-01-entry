// Traffic AI: cars that drive the road grid, follow intersections as waypoints,
// brake for the car ahead, and respawn near the player when they drift too far.
import { makeRng, angleLerp } from './random.js';
import { WORLD } from './config.js';

const ROADS = [];
for (let v = -240; v <= 240; v += 40) ROADS.push(v);

export function createTraffic(G, count) {
  const rng = makeRng(4242);
  const cars = [];
  const pickRoadPoint = (near) => {
    if (near) {
      const cx = Math.round(G.player.x / 40) * 40, cz = Math.round(G.player.z / 40) * 40;
      const alongRoad = rng.chance(0.5);
      const road = (alongRoad ? cz : cx) + rng.randi(-2, 2) * 40;
      const along = (alongRoad ? cx : cz) + rng.randi(-2, 2) * 40;
      return { x: alongRoad ? along : road, z: alongRoad ? road : along };
    }
    const alongRoad = rng.chance(0.5);
    return { x: alongRoad ? rng.pick(ROADS) : rng.pick(ROADS), z: alongRoad ? rng.pick(ROADS) : rng.pick(ROADS) };
  };
  for (let i = 0; i < count; i++) {
    const p = pickRoadPoint(false);
    const car = G.vehicles.spawn(rng.pick(['sedan', 'sedan', 'taxi', 'truck']), p.x, p.z, 0, 'ai');
    const next = pickRoadPoint(false);
    cars.push({ car, tx: next.x, tz: next.z, speed: rng.rand(8, 13), wait: 0 });
  }

  function retarget(t) {
    const p = pickRoadPoint(false);
    // Next waypoint: a nearby intersection, so cars turn instead of cutting blocks.
    const cx = Math.round(t.car.group.position.x / 40) * 40;
    const cz = Math.round(t.car.group.position.z / 40) * 40;
    if (rng.chance(0.5)) { t.tx = cx + rng.pick([-40, 40]); t.tz = cz; }
    else { t.tx = cx; t.tz = cz + rng.pick([-40, 40]); }
    t.tx = Math.max(-240, Math.min(240, t.tx));
    t.tz = Math.max(-240, Math.min(240, t.tz));
  }

  return {
    cars,
    update(dt) {
      if (G.state.mode !== 'playing') return;
      for (const t of cars) {
        const c = t.car;
        if (c.wrecked) continue;
        const px = c.group.position.x, pz = c.group.position.z;
        // Too far from the action: respawn on a road near the player.
        if (Math.hypot(px - G.player.x, pz - G.player.z) > 200) {
          const p = pickRoadPoint(true);
          c.group.position.set(p.x, 0, p.z);
          retarget(t);
          continue;
        }
        const dx = t.tx - px, dz = t.tz - pz;
        const dist = Math.hypot(dx, dz);
        if (dist < 4) { retarget(t); continue; }
        const targetYaw = Math.atan2(dx, dz);
        c.yaw = angleLerp(c.yaw, targetYaw, dt * 2.2);
        c.group.rotation.y = c.yaw;
        // Brake for the car ahead (driven car, another AI car, or a cop).
        // A startled boost (set when the player rams this car) makes it speed away.
        if (c.boostT > 0) c.boostT -= dt;
        let blocked = false;
        for (const o of G.vehicles.list) {
          if (o === c || o.wrecked) continue;
          const ox = o.group.position.x - px, oz = o.group.position.z - pz;
          const ahead = ox * Math.sin(c.yaw) + oz * Math.cos(c.yaw);
          const side = Math.abs(ox * Math.cos(c.yaw) - oz * Math.sin(c.yaw));
          if (ahead > 0 && ahead < 9 && side < 2.6) { blocked = true; break; }
        }
        const targetSpeed = blocked ? 0 : t.speed + (c.boostT > 0 ? 6 : 0);
        c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 1.5);
        c.group.position.x += Math.sin(c.yaw) * c.speed * dt;
        c.group.position.z += Math.cos(c.yaw) * c.speed * dt;
        for (const w of c.group.userData.wheels) w.rotation.x += c.speed * dt * 1.4;
        // Keep traffic inside the city (never onto the sand).
        if (c.group.position.x < WORLD.CITY_MIN_X) { c.group.position.x = WORLD.CITY_MIN_X; retarget(t); }
      }
    },
  };
}
