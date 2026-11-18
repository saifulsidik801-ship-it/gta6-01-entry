// Marisol Bay — the city itself.
// One clear job: build Marisol Bay from the seed: roads, blocks, buildings,
// beach and sea, marina, streetlights, trees, sky and sun. Also owns the
// collision boxes (colliders) and the day/dusk/night lighting.
//
// Performance note: repeated pieces (road dashes, sidewalks, buildings,
// roofs, window strips, palms, streetlights) are InstancedMesh — one draw
// call each — so the city stays smooth in desktop Chrome and in software GL.
import * as THREE from 'three';
import { CONFIG, districtAt, nearestRoadCoord } from './config.js';
import { mulberry32, pick, range } from './random.js';

const dummy = new THREE.Object3D();

// Fill an InstancedMesh from a list of {x,y,z, sx,sy,sz, ry} transforms.
function fillInstances(mesh, list, colorList) {
  list.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
    dummy.scale.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colorList) mesh.setColorAt(i, new THREE.Color(colorList[i]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function buildWorld(scene, seed) {
  const rng = mulberry32(seed);
  const world = {
    colliders: [],        // {x0,z0,x1,z1}
    buildings: [],
    streetlights: [],
    collectibles: [],     // meshes, filled by missions.js pickup logic
    sea: null, sun: null, hemi: null, skyMesh: null,
    beacon: null, beaconLight: null,
  };

  // --- Ground: one big slab, grass green inland, sand on the south beach.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 760),
    new THREE.MeshLambertMaterial({ color: CONFIG.palette.grass }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  scene.add(ground);

  // South beach sand strip + the sea beyond it.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 70),
    new THREE.MeshLambertMaterial({ color: CONFIG.palette.sand }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, -295);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 120),
    new THREE.MeshLambertMaterial({ color: CONFIG.palette.sea, transparent: true, opacity: 0.92 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.15, -390);
  scene.add(sea);
  world.sea = sea;

  // --- Roads: a grid of dark asphalt strips with pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: CONFIG.palette.road });
  const half = CONFIG.cityHalf;
  for (let c = -half; c <= half; c += CONFIG.roadSpacing) {
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.roadWidth, half * 2 + 40), roadMat);
    roadX.rotation.x = -Math.PI / 2; roadX.position.set(c, 0.02, 0);
    scene.add(roadX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 40, CONFIG.roadWidth), roadMat);
    roadZ.rotation.x = -Math.PI / 2; roadZ.position.set(0, 0.02, c);
    scene.add(roadZ);
  }
  // Centre dashes: two instanced meshes instead of ~1500 separate planes.
  const dashAList = [];
  const dashBList = [];
  for (let c = -half; c <= half; c += CONFIG.roadSpacing) {
    for (let d = -half; d <= half; d += 14) {
      if (Math.abs(d - nearestRoadCoord(d)) < 4) continue; // skip intersections
      dashAList.push({ x: c, y: 0.04, z: d, rx: -Math.PI / 2 });
      dashBList.push({ x: d, y: 0.04, z: c, rx: -Math.PI / 2 });
    }
  }
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  scene.add(fillInstances(
    new THREE.InstancedMesh(new THREE.PlaneGeometry(0.7, 4), dashMat, dashAList.length), dashAList));
  scene.add(fillInstances(
    new THREE.InstancedMesh(new THREE.PlaneGeometry(4, 0.7), dashMat, dashBList.length), dashBList));

  // --- Sidewalks: one instanced mesh of pale block frames.
  const walkList = [];
  for (let bx = -half; bx < half; bx += CONFIG.roadSpacing) {
    for (let bz = -half; bz < half; bz += CONFIG.roadSpacing) {
      const cx = bx + CONFIG.roadSpacing / 2;
      const cz = bz + CONFIG.roadSpacing / 2;
      if (cz < -245) continue; // beach: sand, not sidewalk
      walkList.push({ x: cx, y: 0.01, z: cz, rx: -Math.PI / 2 });
    }
  }
  scene.add(fillInstances(
    new THREE.InstancedMesh(
      new THREE.PlaneGeometry(CONFIG.blockSize + 4, CONFIG.blockSize + 4),
      new THREE.MeshLambertMaterial({ color: CONFIG.palette.sidewalk }),
      walkList.length),
    walkList));

  // --- Buildings: one or two boxes per block, height by district.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const buildingList = [];
  const buildingColors = [];
  const roofList = [];
  const windowList = [];
  for (let bx = -half; bx < half; bx += CONFIG.roadSpacing) {
    for (let bz = -half; bz < half; bz += CONFIG.roadSpacing) {
      const cx = bx + CONFIG.roadSpacing / 2;
      const cz = bz + CONFIG.roadSpacing / 2;
      if (cz < -245) continue;                    // beach stays open
      if (cx > 150 && cz > -40 && cz < 140) continue; // marina docks stay open
      const d = districtAt(cx, cz) || { height: [10, 26], color: 0x999999 };
      const count = rng() < 0.45 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const w = range(rng, 16, 26);
        const dep = range(rng, 16, 26);
        const h = range(rng, d.height[0], d.height[1]);
        const ox = count === 1 ? 0 : (i === 0 ? -11 : 11);
        const oz = count === 1 ? 0 : (i === 0 ? -11 : 11);
        buildingList.push({ x: cx + ox, y: h / 2, z: cz + oz, sx: w, sy: h, sz: dep });
        buildingColors.push(pick(rng, CONFIG.palette.building));
        roofList.push({ x: cx + ox, y: h + 0.6, z: cz + oz, sx: w * 0.7, sy: 1.2, sz: dep * 0.7 });
        // Lit window strip near the top, facing +z.
        if (rng() < 0.7) {
          windowList.push({ x: cx + ox, y: h * 0.72, z: cz + oz + dep / 2 + 0.06, sx: w * 0.8, sy: 1.1, sz: 1 });
        }
        world.colliders.push({
          x0: cx + ox - w / 2, x1: cx + ox + w / 2,
          z0: cz + oz - dep / 2, z1: cz + oz + dep / 2,
        });
      }
    }
  }
  const buildingsMesh = fillInstances(
    new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), buildingList.length),
    buildingList, buildingColors);
  scene.add(buildingsMesh);
  world.buildings.push(buildingsMesh);
  scene.add(fillInstances(
    new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x5a5f66 }), roofList.length),
    roofList));
  scene.add(fillInstances(
    new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), windowList.length),
    windowList));

  // --- Marina docks + boats on the east edge.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3e });
  for (let i = 0; i < 4; i++) {
    const dock = new THREE.Mesh(boxGeo, dockMat);
    dock.scale.set(26, 0.8, 5);
    dock.position.set(265, 0.4, -20 + i * 30);
    scene.add(dock);
    const hull = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8e8e8, 0x3f6fb5, 0xc94f4f]) }));
    hull.scale.set(14, 2.2, 4);
    hull.position.set(258, 1.0, -8 + i * 30);
    scene.add(hull);
  }

  // --- Palm trees along the beach and in the hills.
  const trunkList = [];
  const leafList = [];
  for (let i = 0; i < 90; i++) {
    const x = range(rng, -290, 290);
    const z = rng() < 0.6 ? range(rng, -280, -250) : range(rng, 150, 290);
    if (Math.abs(x - nearestRoadCoord(x)) < 10 || Math.abs(z - nearestRoadCoord(z)) < 10) continue;
    trunkList.push({ x, y: 3, z });
    leafList.push({ x, y: 8, z });
    world.colliders.push({ x0: x - 0.6, x1: x + 0.6, z0: z - 0.6, z1: z + 0.6 });
  }
  scene.add(fillInstances(
    new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x7a5c3e }), trunkList.length),
    trunkList));
  scene.add(fillInstances(
    new THREE.InstancedMesh(new THREE.ConeGeometry(3.2, 4.5, 7),
      new THREE.MeshLambertMaterial({ color: 0x3f7a3a }), leafList.length),
    leafList));

  // --- Streetlights along the roads (pole + glowing head, instanced).
  const poleList = [];
  const lampList = [];
  for (let c = -half; c <= half; c += CONFIG.roadSpacing) {
    for (let d = -half + 35; d <= half; d += CONFIG.roadSpacing) {
      poleList.push({ x: c + 8, y: 3.5, z: d });
      lampList.push({ x: c + 8, y: 7.1, z: d });
    }
  }
  scene.add(fillInstances(
    new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a3f45 }), poleList.length),
    poleList));
  const lampMesh = fillInstances(
    new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), lampList.length),
    lampList);
  scene.add(lampMesh);
  world.streetlights.push(lampMesh);

  // --- Sky dome, sun and hemisphere light.
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const skyMat = new THREE.MeshBasicMaterial({
    color: CONFIG.palette.skyDay, side: THREE.BackSide, fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  world.skyMesh = sky;
  const sun = new THREE.DirectionalLight(CONFIG.palette.sunDay, 1.6);
  sun.position.set(200, 300, 100);
  scene.add(sun);
  world.sun = sun;
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a6a4a, 1.05);
  scene.add(hemi);
  world.hemi = hemi;
  // Fill light from the opposite side so faces turned away from the sun
  // still read their colour instead of going flat grey.
  const fill = new THREE.DirectionalLight(0xffe0b8, 0.55);
  fill.position.set(0, 200, -300);
  scene.add(fill);
  world.fill = fill;
  scene.fog = new THREE.Fog(0x9fc3e8, 220, 780);

  // --- Mission beacon: a glowing column + point light, moved by missions.js.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffc93c, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 60, 12, 1, true), beaconMat);
  beacon.position.set(0, 30, 0);
  beacon.visible = false;
  scene.add(beacon);
  const beaconLight = new THREE.PointLight(0xffc93c, 0, 90);
  beaconLight.position.set(0, 8, 0);
  scene.add(beaconLight);
  world.beacon = beacon;
  world.beaconLight = beaconLight;

  world.setBeacon = (x, z, visible) => {
    beacon.visible = visible;
    beacon.position.set(x, 30, z);
    beaconLight.position.set(x, 8, z);
    beaconLight.intensity = visible ? 60 : 0;
  };

  return world;
}

// Push a circle (x,z,r) out of every building collider it overlaps.
// Returns true when a push happened.
export function collideCircle(world, pos, r) {
  let hit = false;
  for (const c of world.colliders) {
    const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * r;
        pos.z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pl = pos.x - c.x0 + r, pr = c.x1 - pos.x + r;
        const pt = pos.z - c.z0 + r, pb = c.z1 - pos.z + r;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.x0 - r;
        else if (m === pr) pos.x = c.x1 + r;
        else if (m === pt) pos.z = c.z0 - r;
        else pos.z = c.z1 + r;
      }
    }
  }
  // City bounds: soft wall at the edge.
  const b = CONFIG.cityHalf + 30;
  pos.x = Math.max(-b, Math.min(b, pos.x));
  pos.z = Math.max(-b - 60, Math.min(b, pos.z));
  return hit;
}

// Time of day: t in [0,1] — 0.0 dawn, 0.5 noon, 0.72 dusk, 0.95 night.
export function applyTimeOfDay(world, t) {
  const pal = CONFIG.palette;
  const sky = new THREE.Color(pal.skyDay);
  const sunCol = new THREE.Color(pal.sunDay);
  let sunI = 1.9, hemiI = 1.25, fillI = 0.7;
  if (t > 0.62 && t <= 0.85) {
    const k = (t - 0.62) / 0.23; // day -> dusk
    sky.lerp(new THREE.Color(pal.skyDusk), k);
    sunCol.lerp(new THREE.Color(pal.sunDusk), k);
    sunI = 1.9 - k * 0.5; hemiI = 1.25 - k * 0.3; fillI = 0.7 - k * 0.15;
  } else if (t > 0.85) {
    const k = Math.min(1, (t - 0.85) / 0.12); // dusk -> night
    sky.copy(new THREE.Color(pal.skyDusk)).lerp(new THREE.Color(pal.skyNight), k);
    sunCol.copy(new THREE.Color(pal.sunDusk)).lerp(new THREE.Color(pal.sunNight), k);
    sunI = 1.4 - k * 0.7; hemiI = 0.95 - k * 0.3; fillI = 0.55 - k * 0.2;
  }
  world.skyMesh.material.color.copy(sky);
  world.sun.color.copy(sunCol);
  world.sun.intensity = sunI;
  world.hemi.intensity = hemiI;
  if (world.fill) world.fill.intensity = fillI;
  world.sun.position.set(Math.cos(t * Math.PI * 2) * 300, 120 + Math.sin(t * Math.PI) * 220, 180);
  if (world.sea) world.sea.material.color.setHex(t > 0.85 ? 0x0e2a44 : pal.sea);
}

// Shared fog colour follows the sky so the horizon never looks wrong.
export function syncFog(scene, world, t) {
  const sky = world.skyMesh.material.color;
  if (scene.fog) scene.fog.color.copy(sky);
  scene.background = sky;
}

export function makeCollectibleMesh(x, z) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd23c }),
  );
  mesh.position.set(x, 1.6, z);
  return mesh;
}
