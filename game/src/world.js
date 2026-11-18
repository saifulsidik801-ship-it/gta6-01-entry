// MARISOL BAY — world.js
// One job: build the city. A seeded grid of roads and bright blocks,
// a sand beach and turquoise water on the south edge, a marina with
// boats on the east, hills to the north, palms and lamps everywhere,
// six glowing district markers, and the sky/sun rig that carries the
// day → dusk → night lighting. Everything static is built once here.
import * as THREE from 'three';
import { CFG, DISTRICTS, PALETTE, COLLECTIBLE_COUNT } from './config.js';
import { makeRng, range, pick } from './random.js';

export function buildWorld(G) {
  const rng = makeRng(G.seed);
  const scene = G.scene;
  const W = { buildings: [], palms: [], lamps: [], markers: {}, collectibles: [], roads: [], sun: null, hemi: null, skyMesh: null };

  // --- ground, beach, water -------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.citySize * 2.4, CFG.citySize * 2.4),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.citySize * 2.4, 46),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.05, CFG.citySize / 2 + 20); sand.receiveShadow = true; scene.add(sand);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.citySize * 2.4, 220),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, CFG.citySize / 2 + 150); scene.add(water);
  W.water = water;

  // --- roads ----------------------------------------------------------------
  const half = CFG.citySize / 2;
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.line });
  const coords = [];
  for (let c = -half + CFG.roadGap / 2; c <= half; c += CFG.roadGap) coords.push(c);
  for (const c of coords) {
    for (const [w, l, x, z] of [[CFG.citySize, CFG.roadWidth, 0, c], [CFG.roadWidth, CFG.citySize, c, 0]]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.06, z); r.receiveShadow = true; scene.add(r);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w + 6, l + 6), walkMat);
      s.rotation.x = -Math.PI / 2; s.position.set(x, 0.04, z); scene.add(s);
    }
    W.roads.push(c);
  }
  // centre dashes along both axes (done properly, one loop per axis)
  for (const c of coords) {
    for (let d = -half + 8; d < half - 8; d += 14) {
      for (const [x, z] of [[d, c], [c, d]]) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 4.5), lineMat);
        dash.rotation.x = -Math.PI / 2; dash.position.set(x, 0.09, z); scene.add(dash);
      }
    }
  }

  // --- buildings: bright boxes with lit windows, one per block --------------
  const winMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5b6470 });
  for (let gx = 0; gx < coords.length - 1; gx++) {
    for (let gz = 0; gz < coords.length - 1; gz++) {
      const bx = (coords[gx] + coords[gx + 1]) / 2;
      const bz = (coords[gz] + coords[gz + 1]) / 2;
      if (bz > half - 40) continue; // beach stays open
      if (rng() < 0.14) { // pocket park: grass + palms instead of a tower
        const park = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: 0x7ec850 }));
        park.rotation.x = -Math.PI / 2; park.position.set(bx, 0.07, bz); scene.add(park);
        plantPalm(G, scene, W, bx - 8, bz - 6, rng);
        plantPalm(G, scene, W, bx + 9, bz + 7, rng);
        continue;
      }
      const w = range(rng, 16, 26), d = range(rng, 16, 26);
      const h = range(rng, 8, 42) * (Math.abs(bx) < 80 && Math.abs(bz) < 80 ? 1.6 : 1); // downtown towers
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color: pick(rng, PALETTE.buildings) }));
      b.position.set(bx, h / 2, bz); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.8, d + 1), roofMat);
      roof.position.set(bx, h + 0.4, bz); scene.add(roof);
      // window strips so the towers read as buildings, not plain boxes
      const floors = Math.max(1, Math.floor(h / 6));
      for (let f = 0; f < floors; f++) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.9), winMat);
        strip.position.set(bx, 3 + f * 6, bz + d / 2 + 0.06); scene.add(strip);
      }
      W.buildings.push({ x: bx, z: bz, hw: w / 2, hd: d / 2, h });
    }
  }

  // --- palms along the beach and avenues ------------------------------------
  for (let x = -half + 10; x < half; x += 26) {
    plantPalm(G, scene, W, x, half - 34, rng);
    if (rng() < 0.6) plantPalm(G, scene, W, x + 12, -half + 30, rng);
  }
  for (const c of coords) for (let d = -half + 20; d < half - 20; d += 78) {
    if (rng() < 0.5) plantPalm(G, scene, W, c + CFG.roadWidth / 2 + 3, d, rng);
  }

  // --- street lamps ----------------------------------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2b3440 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });
  for (const c of coords) for (let d = -half + 10; d < half - 10; d += 52) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
    pole.position.set(c + CFG.roadWidth / 2 + 2.5, 3.5, d); scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), bulbMat);
    bulb.position.set(c + CFG.roadWidth / 2 + 2.5, 7.2, d); scene.add(bulb);
    W.lamps.push(bulb);
  }

  // --- marina boats, east edge ----------------------------------------------
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const hull2 = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
  for (let i = 0; i < 7; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 11), i % 2 ? hull2 : hullMat);
    hull.position.y = 0.8; boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 4), new THREE.MeshLambertMaterial({ color: 0x2ec8d8 }));
    cabin.position.set(0, 2.2, -1); boat.add(cabin);
    boat.position.set(half + 26 + (i % 3) * 12, 0, -120 + i * 34);
    boat.rotation.y = (rng() - 0.5) * 0.3;
    scene.add(boat);
  }

  // --- northern hills ---------------------------------------------------------
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x6a9e5f });
  for (let i = 0; i < 9; i++) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(range(rng, 26, 48), range(rng, 18, 34), 8), hillMat);
    hill.position.set(-half + 30 + i * 48 + range(rng, -10, 10), 0, -half - 26 - range(rng, 0, 30));
    scene.add(hill);
  }

  // --- district markers: tall glowing beacons, one per district --------------
  for (const d of DISTRICTS) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 34, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    beam.position.y = 17; g.add(beam);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.7, 20),
      new THREE.MeshLambertMaterial({ color: d.color }));
    base.position.y = 0.35; g.add(base);
    g.position.set(d.cx, 0, d.cz);
    scene.add(g);
    W.markers[d.id] = g;
  }

  // --- collectibles: 30 glowing golden orbs scattered through the city -------
  const orbGeo = new THREE.SphereGeometry(0.75, 12, 10);
  for (let i = 0; i < COLLECTIBLE_COUNT; i++) {
    const orb = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    const x = range(rng, -half + 20, half - 20);
    const z = range(rng, -half + 20, half - 20);
    orb.position.set(x, 1.6, z);
    scene.add(orb);
    W.collectibles.push({ mesh: orb, x, z, taken: false });
  }

  // --- beach props: umbrellas, a pier, billboards, bus stops, traffic lights
  const umbrellaMat = new THREE.MeshLambertMaterial({ color: 0xff5d7e });
  const umbrellaMat2 = new THREE.MeshLambertMaterial({ color: 0x2ec8d8 });
  for (let i = 0; i < 8; i++) {
    const ux = -half + 40 + i * 48;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    pole.position.set(ux, 1.6, half + 18); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.4, 8), i % 2 ? umbrellaMat : umbrellaMat2);
    top.position.set(ux, 3.6, half + 18); scene.add(top);
  }
  // pier: wooden boards reaching into the water
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7b4f });
  for (let i = 0; i < 14; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 5), pierMat);
    plank.position.set(-60, 0.6, half + 44 + i * 5.2); scene.add(plank);
  }
  const pierEnd = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 10), pierMat);
  pierEnd.position.set(-60, 0.6, half + 118); scene.add(pierEnd);

  // billboards with painted canvas faces — the city's own ads, no real brands
  const billboards = [
    { x: -80, z: -132, text: 'MARISOL BAY', sub: 'sun • salt • speed', bg: '#ff5d7e' },
    { x: 76, z: 128, text: 'TURF WAR', sub: 'six districts. one king.', bg: '#2ec8d8' },
    { x: 128, z: -80, text: 'MILO KADE', sub: 'driver for hire', bg: '#ffd23e' },
  ];
  for (const b of billboards) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const cx = cv.getContext('2d');
    cx.fillStyle = b.bg; cx.fillRect(0, 0, 512, 256);
    cx.fillStyle = '#ffffff'; cx.font = 'bold 64px Arial'; cx.textAlign = 'center';
    cx.fillText(b.text, 256, 110);
    cx.font = '32px Arial'; cx.fillText(b.sub, 256, 170);
    const tex = new THREE.CanvasTexture(cv);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(22, 11),
      new THREE.MeshBasicMaterial({ map: tex }));
    board.position.set(b.x, 14, b.z); board.rotation.y = Math.PI / 4; scene.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 12, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x2b3440 }));
    post.position.set(b.x, 6, b.z); scene.add(post);
  }

  // bus stops: a shelter and a bench at six intersections
  const shelterMat = new THREE.MeshLambertMaterial({ color: 0x2ec8d8 });
  for (const [bx, bz] of [[-28, -28], [76, -80], [-80, 76], [128, 24], [24, 128], [-132, 0]]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 3), shelterMat);
    roof.position.set(bx + 10, 3.1, bz + 10); scene.add(roof);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.5, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x8a6d3b }));
    bench.position.set(bx + 10, 0.9, bz + 10); scene.add(bench);
  }

  // traffic lights at six intersections: pole + red/amber/green
  const lightCols = [0xff3b30, 0xffc21c, 0x2fbf5a];
  for (const [lx, lz] of [[-28, -28], [24, 76], [76, -28], [-80, 24], [128, 128], [24, -80]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.5, 6), poleMat);
    pole.position.set(lx + 8.5, 3.25, lz + 8.5); scene.add(pole);
    lightCols.forEach((c, i) => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6),
        new THREE.MeshBasicMaterial({ color: c }));
      lamp.position.set(lx + 8.5, 6.4 - i * 1.1, lz + 8.5); scene.add(lamp);
    });
  }

  // --- sky, sun, hemisphere ---------------------------------------------------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 16, 12),
    new THREE.MeshBasicMaterial({ color: PALETTE.skyDay, side: THREE.BackSide, fog: false }));
  scene.add(sky); W.skyMesh = sky;
  W.sun = new THREE.DirectionalLight(PALETTE.sunDay, 1.6);
  W.sun.position.set(120, 180, 60);
  W.sun.castShadow = true;
  W.sun.shadow.mapSize.set(1024, 1024);
  W.sun.shadow.camera.left = -260; W.sun.shadow.camera.right = 260;
  W.sun.shadow.camera.top = 260; W.sun.shadow.camera.bottom = -260;
  W.sun.shadow.camera.far = 700;
  scene.add(W.sun);
  W.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9);
  scene.add(W.hemi);
  scene.fog = new THREE.Fog(0x9fc8e8, 220, 720);

  // Time of day: 0 = dawn, 0.35 = noon, 0.62 = dusk, 0.8 = night.
  W.setTimeOfDay = (t) => {
    const day = new THREE.Color(PALETTE.skyDay), dusk = new THREE.Color(PALETTE.skyDusk), night = new THREE.Color(PALETTE.skyNight);
    let skyCol, sunCol, sunI, hemiI;
    if (t < 0.5) { const k = t / 0.5; skyCol = day.clone().lerp(dusk, k * k); sunCol = 0xfff2c8; sunI = 2.3 - k * 0.4; hemiI = 1.5; }
    else if (t < 0.72) { const k = (t - 0.5) / 0.22; skyCol = dusk.clone().lerp(night, k); sunCol = 0xffb347; sunI = 1.5 - k * 0.7; hemiI = 1.25 - k * 0.55; }
    else { skyCol = night; sunCol = 0x8fa8d8; sunI = 0.8; hemiI = 0.6; }
    W.skyMesh.material.color.copy(skyCol);
    scene.fog.color.copy(skyCol);
    W.sun.color.setHex(sunCol); W.sun.intensity = sunI; W.hemi.intensity = hemiI;
    const ang = Math.PI * (0.15 + t * 0.85);
    W.sun.position.set(Math.cos(ang) * 200, Math.max(30, Math.sin(ang) * 220), 80);
    G.renderer.setClearColor(skyCol);
  };
  return W;
}

function plantPalm(G, scene, W, x, z, rng) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 6.5, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6d3b }));
  trunk.position.set(x, 3.25, z); trunk.castShadow = true; scene.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fbf5a });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.4, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(x + Math.cos(a) * 1.6, 6.9, z + Math.sin(a) * 1.6);
    leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
    scene.add(leaf);
  }
  W.palms.push({ x, z });
}

// Is this ground point inside a building footprint? Used by movement code.
export function hitsBuilding(W, x, z, pad) {
  for (const b of W.buildings) {
    if (Math.abs(x - b.x) < b.hw + (pad || 0.6) && Math.abs(z - b.z) < b.hd + (pad || 0.6)) return b;
  }
  return null;
}

export function nearestRoadCoord(W, v) {
  let best = W.roads[0], bd = 1e9;
  for (const c of W.roads) { const d = Math.abs(c - v); if (d < bd) { bd = d; best = c; } }
  return best;
}
