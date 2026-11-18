// MARISOL BAY — the city itself: ground with painted road markings, a 40 m road
// grid, district-tinted buildings with lit windows, beach + marina + port,
// palms, streetlights, and the collision boxes everything else walks and drives
// against. All placement is seeded, so the city is identical every run.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, DISTRICTS, districtAt } from './config.js';
import { makeRng, clamp } from './random.js';

function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#23272e'; g.fillRect(0, 0, 1024, 1024); // asphalt
  const toPx = (v) => ((v + WORLD.HALF) / WORLD.SIZE) * 1024;
  const roadPx = (WORLD.ROAD_WIDTH / WORLD.SIZE) * 1024;
  // Sidewalk blocks between roads.
  g.fillStyle = '#3a3f47';
  for (let x = WORLD.ROAD_MIN + WORLD.ROAD_STEP; x <= WORLD.ROAD_MAX; x += WORLD.ROAD_STEP) {
    for (let z = WORLD.ROAD_MIN + WORLD.ROAD_STEP; z <= WORLD.ROAD_MAX; z += WORLD.ROAD_STEP) {
      g.fillRect(toPx(x - 13), toPx(z - 13), (26 / WORLD.SIZE) * 1024, (26 / WORLD.SIZE) * 1024);
    }
  }
  // Centre dashes on every road.
  g.fillStyle = '#d8d23a';
  for (let v = WORLD.ROAD_MIN; v <= WORLD.ROAD_MAX; v += WORLD.ROAD_STEP) {
    for (let u = WORLD.ROAD_MIN; u < WORLD.ROAD_MAX; u += 16) {
      g.fillRect(toPx(u), toPx(v) - 2, (8 / WORLD.SIZE) * 1024, 4);
      g.fillRect(toPx(v) - 2, toPx(u), 4, (8 / WORLD.SIZE) * 1024);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function windowsTexture(seed) {
  const rng = makeRng(seed);
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rng.chance(0.45);
      g.fillStyle = lit ? '#ffd76a' : '#20242c';
      g.fillRect(x, y, 7, 8);
    }
  }
  return new THREE.CanvasTexture(c);
}

function makePalm(mat) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 4.4, 6), mat);
  trunk.position.y = 2.2; group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e9e4f });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), leafMat);
    const a = (i / 5) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.9, 4.6, Math.sin(a) * 0.9);
    leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
    group.add(leaf);
  }
  return group;
}

export function buildWorld(G) {
  const scene = G.scene;
  const rng = makeRng(1337);
  const world = { colliders: [], lights: [], shells: [], beacon: null, timeOfDay: 0.32 };
  G.world = world;

  scene.fog = new THREE.Fog(0xbfd9e8, 120, 520);

  // Ground: city asphalt with painted markings, sand strip, sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.SIZE, WORLD.SIZE),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.SAND_X1 - WORLD.SAND_X0, WORLD.SIZE),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((WORLD.SAND_X0 + WORLD.SAND_X1) / 2, 0.05, 0);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(60, WORLD.SIZE + 80),
    new THREE.MeshLambertMaterial({ color: 0x1f7fa8, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(WORLD.WATER_X - 28, -0.4, 0);
  scene.add(sea);

  // Sun + sky light.
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.5);
  sun.position.set(120, 180, 60); scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a3230, 0.9); scene.add(hemi);
  world.sun = sun; world.hemi = hemi;

  // Buildings, parks and lots, one per block.
  const winTex = [windowsTexture(11), windowsTexture(23)];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const baseColors = [0xd8d3c8, 0xc9b8a3, 0xb8c4cc, 0xd9c1b8, 0xa8b8a0, 0xc4b49a];
  for (let bx = -180; bx <= 240; bx += WORLD.ROAD_STEP) {
    for (let bz = -240; bz <= 240; bz += WORLD.ROAD_STEP) {
      if (bx < WORLD.CITY_MIN_X + 20) continue; // beach strip stays open
      const d = districtAt(bx, bz);
      const roll = rng.next();
      if (roll < 0.16) {
        // Park: grass + palms.
        const grass = new THREE.Mesh(new THREE.PlaneGeometry(26, 26),
          new THREE.MeshLambertMaterial({ color: 0x4f9e4a }));
        grass.rotation.x = -Math.PI / 2; grass.position.set(bx, 0.08, bz); scene.add(grass);
        for (let i = 0; i < 3; i++) {
          const palm = makePalm(trunkMat);
          palm.position.set(bx + rng.rand(-9, 9), 0, bz + rng.rand(-9, 9));
          scene.add(palm);
        }
        continue;
      }
      if (roll < 0.3) continue; // open lot / parking
      const w = rng.rand(12, 22), dep = rng.rand(12, 22);
      const tall = d.id === 3 ? rng.rand(20, 44) : rng.rand(6, 22);
      const tint = new THREE.Color(rng.pick(baseColors)).lerp(new THREE.Color(d.color), 0.22);
      const mat = new THREE.MeshLambertMaterial({ color: tint, map: winTex[rng.randi(0, 1)] });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, tall, dep);
      b.position.set(bx, tall / 2, bz);
      scene.add(b);
      // Rooftop rim so towers read at dusk.
      const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, dep + 0.6),
        new THREE.MeshLambertMaterial({ color: 0x2c2f36 }));
      rim.position.set(bx, tall + 0.2, bz); scene.add(rim);
      world.colliders.push({ x0: bx - w / 2, z0: bz - dep / 2, x1: bx + w / 2, z1: bz + dep / 2 });
    }
  }

  // Beach palms, pier, marina boats, port cranes.
  for (let z = -240; z <= 240; z += 36) {
    const palm = makePalm(trunkMat);
    palm.position.set(-208 + rng.rand(-6, 6), 0, z + rng.rand(-6, 6));
    scene.add(palm);
  }
  const pier = new THREE.Mesh(new THREE.BoxGeometry(46, 0.8, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a6b48 }));
  pier.position.set(-232, 0.4, -180); scene.add(pier);
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  for (let i = 0; i < 5; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.4, 3), boatMat);
    hull.position.y = 0.2; boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.4),
      new THREE.MeshLambertMaterial({ color: 0x2c6f8e }));
    cabin.position.set(-1, 1.6, 0); boat.add(cabin);
    boat.position.set(-268 - i * 2, -0.2, -140 + i * 52);
    boat.rotation.y = rng.rand(-0.2, 0.2);
    scene.add(boat);
  }
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xe8a13a });
  for (const [cx, cz] of [[200, 140], [230, 220]]) {
    const crane = new THREE.Group();
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(2, 34, 2), craneMat);
    leg1.position.set(-6, 17, 0); crane.add(leg1);
    const leg2 = leg1.clone(); leg2.position.x = 6; crane.add(leg2);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 2), craneMat);
    arm.position.set(4, 33, 0); crane.add(arm);
    crane.position.set(cx, 0, cz); scene.add(crane);
    world.colliders.push({ x0: cx - 8, z0: cz - 2, x1: cx + 8, z1: cz + 2 });
  }

  // Streetlights along the roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd76a, emissiveIntensity: 0 });
  for (let v = -240; v <= 240; v += 80) {
    for (let u = -240; u <= 240; u += 80) {
      for (const [lx, lz] of [[v + 8, u], [v, u + 8]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
        pole.position.set(lx, 3, lz); scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
        bulb.position.set(lx, 6.1, lz); scene.add(bulb);
        world.lights.push(bulbMat);
      }
    }
  }

  // Mission beacon (moved by missions.js): a light pillar + ring on the ground.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30; beacon.add(pillar);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; beacon.add(ring);
  beacon.visible = false; scene.add(beacon);
  world.beacon = beacon;

  // Hidden shells (collectibles) on sidewalks near roads.
  const shellMat = new THREE.MeshLambertMaterial({ color: 0xff9ff3, emissive: 0xd63384, emissiveIntensity: 0.9 });
  for (let i = 0; i < 30; i++) {
    const x = rng.randi(-5, 5) * 40 + rng.rand(-6, 6);
    const z = rng.randi(-5, 5) * 40 + rng.rand(-6, 6);
    if (x < -195 || Math.abs(x) > 250 || Math.abs(z) > 250) { i--; continue; }
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), shellMat);
    m.position.set(x, 0.7, z); scene.add(m);
    world.shells.push({ mesh: m, x, z, taken: false });
  }
  return world;
}

// Push a circle (player / car) out of building colliders and the sea. Returns true if pushed.
export function collideCircle(world, x, z, r) {
  let pushed = false;
  for (const c of world.colliders) {
    const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1);
    const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: shove out along the smallest penetration axis.
        const pl = x - (c.x0 - r), pr = (c.x1 + r) - x, pt = z - (c.z0 - r), pb = (c.z1 + r) - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
        else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
      }
      pushed = true;
    }
  }
  if (x < WORLD.SAND_X0 + 2) { x = WORLD.SAND_X0 + 2; pushed = true; }
  if (x > WORLD.HALF - 2) { x = WORLD.HALF - 2; pushed = true; }
  if (z < -WORLD.HALF + 2) { z = -WORLD.HALF + 2; pushed = true; }
  if (z > WORLD.HALF - 2) { z = WORLD.HALF - 2; pushed = true; }
  return { x, z, pushed };
}

export function districtOf(x, z) { return districtAt(x, z); }

// t: 0..1 around the clock. 0.32 = day, 0.86 = dusk, 0.98 = night.
export function setTimeOfDay(G, t) {
  const w = G.world;
  w.timeOfDay = t;
  const day = 1 - clamp(Math.abs(t - 0.32) / 0.22, 0, 1);
  const dusk = 1 - clamp(Math.abs(t - 0.86) / 0.1, 0, 1);
  const night = t > 0.92 || t < 0.08 ? 1 : 0;
  const sky = new THREE.Color(0xbfd9e8).lerp(new THREE.Color(0xff9a4d), dusk * 0.8);
  if (night) sky.set(0x0e1626);
  G.scene.background = sky;
  G.scene.fog.color.copy(sky);
  const sunH = Math.sin((0.5 - Math.abs(t - 0.5)) * Math.PI) * 0.9 + 0.1;
  w.sun.position.set(120 * (1 - dusk), 40 + 160 * sunH * (1 - night * 0.85), 60);
  w.sun.color.setHex(dusk > 0.4 ? 0xffb36b : 0xfff2d0);
  w.sun.intensity = night ? 0.12 : 0.7 + 0.9 * day + 0.5 * dusk;
  w.hemi.intensity = night ? 0.25 : 0.55 + 0.4 * day;
  for (const m of w.lights) m.emissiveIntensity = (dusk > 0.3 || night) ? 1.6 : 0;
}
