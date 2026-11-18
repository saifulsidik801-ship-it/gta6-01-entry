// MARISOL BAY — the city itself. A 1200x1200 grid city painted onto one
// canvas ground texture (roads, sidewalks, beach, water), plus procedural
// buildings, palms, marina docks, port containers, hills and streetlights.
// Exports collision boxes and the road graph traffic/police/peds drive on.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, districtAt } from './config.js';
import { RNG } from './random.js';

const W = CONFIG.world;
const ROADS = [];
for (let i = 0; i <= 10; i++) ROADS.push(W.firstRoad + i * W.roadStep);

function isRoadCoord(v) {
  for (const r of ROADS) if (Math.abs(v - r) <= W.roadHalf) return true;
  return false;
}

export class World {
  constructor(scene, seed = 1337) {
    this.scene = scene;
    this.rng = new RNG(seed);
    this.buildings = [];   // {minX,maxX,minZ,maxZ,h} collision boxes
    this.lights = [];      // streetlight positions for night glow
    this.spawns = { parked: [], peds: [] };
    this.group = new THREE.Group();
    this.group.name = 'world';
    scene.add(this.group);
    this.buildGround();
    this.buildBuildings();
    this.buildBeachProps();
    this.buildMarinaAndPort();
    this.buildHills();
    this.buildStreetlights();
  }

  // ---- ground: one 1024 canvas texture for the whole map ----
  buildGround() {
    const S = 1024, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const toPx = (v) => ((v + W.half) / W.size) * S;
    // base grass
    g.fillStyle = '#6d9a58'; g.fillRect(0, 0, S, S);
    // district tint washes
    for (const d of CONFIG.districts) {
      const hex = '#' + d.color.toString(16).padStart(6, '0');
      g.fillStyle = hex; g.globalAlpha = 0.10;
      g.beginPath(); g.arc(toPx(d.center[0]), toPx(d.center[1]), 150, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // sand + water (south edge)
    g.fillStyle = '#e3cd8f'; g.fillRect(0, toPx(W.beachZ), S, toPx(W.waterZ) - toPx(W.beachZ));
    g.fillStyle = '#2f7fb8'; g.fillRect(0, toPx(W.waterZ), S, S - toPx(W.waterZ));
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 0; x < S; x += 90) g.fillRect(x, toPx(W.waterZ) + 6, 46, 2);
    // sidewalks: lighter slabs around every block
    g.fillStyle = '#b4b9c0';
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
      const x0 = ROADS[i] + W.roadHalf, z0 = ROADS[j] + W.roadHalf;
      g.fillRect(toPx(x0), toPx(z0), toPx(ROADS[i + 1] - W.roadHalf) - toPx(x0), toPx(ROADS[j + 1] - W.roadHalf) - toPx(z0));
    }
    // roads
    g.fillStyle = '#565c66';
    for (const r of ROADS) {
      g.fillRect(toPx(r - W.roadHalf), 0, toPx(r + W.roadHalf) - toPx(r - W.roadHalf), S);
      g.fillRect(0, toPx(r - W.roadHalf), S, toPx(r + W.roadHalf) - toPx(r - W.roadHalf));
    }
    // centre dashes
    g.fillStyle = '#e8c93a';
    for (const r of ROADS) {
      for (let v = -W.half; v < W.half; v += 28) {
        g.fillRect(toPx(r) - 0.5, toPx(v), 1, 6);
        g.fillRect(toPx(v), toPx(r) - 0.5, 6, 1);
      }
    }
    // crosswalks at intersections
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (const rx of ROADS) for (const rz of ROADS) {
      for (let k = -3; k <= 3; k++) {
        g.fillRect(toPx(rx + k * 3.2) - 1, toPx(rz - W.roadHalf), 2, 5);
        g.fillRect(toPx(rx + k * 3.2) - 1, toPx(rz + W.roadHalf) - 5, 2, 5);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(W.size + 160, W.size + 160),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 40); // shift so water shows at the south edge
    ground.name = 'ground';
    this.group.add(ground);
    // water plane slightly above ground for shimmer (south only)
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(W.size + 160, 140),
      new THREE.MeshLambertMaterial({ color: 0x2f7fb8, transparent: true, opacity: 0.85 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.25, W.waterZ + 55);
    water.name = 'water';
    this.group.add(water);
  }

  // ---- buildings: shared unit-box geometry, a few window materials ----
  buildBuildings() {
    const rng = this.rng;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mats = [0x8d99ae, 0xb08968, 0x6d6875, 0x7d8ca3, 0xa26769, 0x5f7a6a].map((col) => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#' + col.toString(16).padStart(6, '0'); g.fillRect(0, 0, 64, 128);
      g.fillStyle = 'rgba(255,236,170,0.9)';
      for (let y = 10; y < 120; y += 16) for (let x = 8; x < 60; x += 14) {
        if (rng.chance(0.55)) g.fillRect(x, y, 8, 10);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshLambertMaterial({ map: tex });
    });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
      const bx0 = ROADS[i] + W.roadHalf + W.blockInset;
      const bz0 = ROADS[j] + W.roadHalf + W.blockInset;
      const bx1 = ROADS[i + 1] - W.roadHalf - W.blockInset;
      const bz1 = ROADS[j + 1] - W.roadHalf - W.blockInset;
      const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
      const d = districtAt(cx, cz);
      // boardwalk blocks stay open (beach promenade), marina blocks get docks
      if (d.id === 'boardwalk' && cz > W.beachZ - 60) continue;
      const downtown = d.id === 'downtown';
      const n = downtown ? rng.int(2, 4) : rng.int(1, 2);
      for (let k = 0; k < n; k++) {
        const w = rng.range(16, downtown ? 30 : 24);
        const dep = rng.range(14, downtown ? 26 : 20);
        const h = downtown ? rng.range(28, 78) : rng.range(10, 30);
        const x = rng.range(bx0 + w / 2, bx1 - w / 2);
        const z = rng.range(bz0 + dep / 2, bz1 - dep / 2);
        const mesh = new THREE.Mesh(geo, mats[rng.int(0, mats.length - 1)]);
        mesh.scale.set(w, h, dep);
        mesh.position.set(x, 0, z);
        mesh.name = 'building';
        this.group.add(mesh);
        const roof = new THREE.Mesh(geo, roofMat);
        roof.scale.set(w + 0.6, 0.8, dep + 0.6);
        roof.position.set(x, h, z);
        this.group.add(roof);
        this.buildings.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dep / 2, maxZ: z + dep / 2, h });
        // rooftop AC box on tall towers
        if (h > 45) {
          const ac = new THREE.Mesh(geo, roofMat);
          ac.scale.set(4, 2.5, 4); ac.position.set(x + w / 4, h + 0.8, z);
          this.group.add(ac);
        }
      }
    }
  }

  buildBeachProps() {
    const rng = this.rng;
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 6);
    const leafGeo = new THREE.ConeGeometry(3.2, 4.5, 7);
    for (let x = -560; x <= 560; x += 28) {
      if (rng.chance(0.25)) continue;
      const z = W.beachZ + rng.range(6, 26);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 3.5, z); trunk.rotation.z = rng.range(-0.12, 0.12);
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(x, 8.6, z);
      this.group.add(trunk, leaves);
    }
    // beach umbrellas
    const umMat = new THREE.MeshLambertMaterial({ color: 0xe04a7a });
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 3, 5);
    const topGeo = new THREE.ConeGeometry(2.6, 1.4, 8);
    for (let k = 0; k < 14; k++) {
      const x = rng.range(-540, 540), z = rng.range(W.beachZ + 8, W.beachZ + 42);
      const pole = new THREE.Mesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0xdddddd }));
      pole.position.set(x, 1.5, z);
      const top = new THREE.Mesh(topGeo, umMat);
      top.position.set(x, 3.4, z);
      this.group.add(pole, top);
    }
  }

  buildMarinaAndPort() {
    const rng = this.rng;
    // marina docks (east, z ~ 350): wooden piers + moored boats
    const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6b46 });
    const boatCols = [0xffffff, 0xd21f3c, 0x2e6fd8, 0xf2c200];
    for (let k = 0; k < 4; k++) {
      const z = 300 + k * 36;
      const dock = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 6), dockMat);
      dock.position.set(520, 0.5, z);
      this.group.add(dock);
      for (let b = 0; b < 3; b++) {
        const hull = new THREE.Mesh(
          new THREE.BoxGeometry(9, 2.2, 3.4),
          new THREE.MeshLambertMaterial({ color: boatCols[(k + b) % boatCols.length] }),
        );
        hull.position.set(505 + b * 12, 1.1, z + 7);
        this.group.add(hull);
      }
    }
    // port containers (north-west of Portside): stacked boxes
    const contCols = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98];
    for (let k = 0; k < 26; k++) {
      const x = rng.range(180, 460), z = rng.range(-470, -330);
      const col = contCols[k % contCols.length];
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(12, 2.6, 2.6),
        new THREE.MeshLambertMaterial({ color: col }),
      );
      box.position.set(x, 1.3 + (k % 3) * 2.6, z);
      box.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
      this.group.add(box);
      this.buildings.push({ minX: x - 6, maxX: x + 6, minZ: z - 1.5, maxZ: z + 1.5, h: 3 });
    }
  }

  buildHills() {
    // Coral Hills (west): low cones the player can walk up visually
    const rng = this.rng;
    const hillMat = new THREE.MeshLambertMaterial({ color: 0x6b8e5a });
    for (let k = 0; k < 7; k++) {
      const x = rng.range(-560, -380), z = rng.range(-480, -120);
      const r = rng.range(28, 55), h = rng.range(14, 30);
      const hill = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), hillMat);
      hill.position.set(x, h / 2 - 0.5, z);
      this.group.add(hill);
    }
  }

  buildStreetlights() {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x22262b });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 });
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 7, 6);
    const lampGeo = new THREE.SphereGeometry(0.55, 8, 6);
    for (const rx of ROADS) for (const rz of ROADS) {
      const x = rx + W.roadHalf + 2.5, z = rz + W.roadHalf + 2.5;
      if (Math.abs(x) > W.half - 20 || z > W.beachZ) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 3.5, z);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x, 7.1, z);
      lamp.name = 'streetlamp';
      this.group.add(pole, lamp);
      this.lights.push([x, z]);
    }
  }

  // ---- queries used by traffic / police / peds / player ----
  isRoad(x, z) { return isRoadCoord(x) || isRoadCoord(z); }
  nearestRoadCoord(v) {
    let best = ROADS[0], bd = Infinity;
    for (const r of ROADS) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
    return best;
  }
  // Circle (x,z,r) vs building AABBs. Returns the pushed-out position.
  resolveCollision(x, z, r) {
    for (const b of this.buildings) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-6) { x = b.maxX + r; continue; }
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r; z = cz + (dz / d) * r;
      }
    }
    return [x, z];
  }
  insideBuilding(x, z) {
    for (const b of this.buildings) {
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
    }
    return false;
  }
  // A random point on a road (for spawning traffic / parked cars).
  randomRoadPoint(rng, onX = null) {
    const road = onX === null ? rng.pick(ROADS) : onX;
    const along = rng.range(-480, 460);
    const lane = rng.chance(0.5) ? 3.5 : -3.5;
    return onX === null ? [road + lane, along] : [along, road + lane];
  }
}
