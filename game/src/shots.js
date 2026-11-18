// Marisol Bay — deterministic screenshot scenes.
// One clear job: the ?shot= scenes. Each one stages a real, playable game
// state (no fake pixels — the same systems the player uses) so the four
// screenshots are true renders of live play.
import { CONFIG } from './config.js';
import { createVehicle } from './vehicle.js';
import { spawnRivals } from './combat.js';
import { startMissionStep } from './missions.js';

// Scene presets. Cover first: a police chase at dusk, wanted stars,
// minimap and mission objective all on the HUD at once.
export const SHOTS = {
  chase: {
    timeOfDay: 0.68, wanted: 3, inCar: 'sport', mission: 3,
    label: 'Police chase at dusk — wanted 3, Downtown',
  },
  foot: {
    timeOfDay: 0.42, wanted: 0, inCar: null, mission: 0,
    label: 'On foot in Downtown — traffic and pedestrians',
  },
  drive: {
    timeOfDay: 0.5, wanted: 0, inCar: 'sport', mission: 1,
    label: 'Driving a stolen sport car down the coast road',
  },
  mission: {
    timeOfDay: 0.95, wanted: 2, inCar: null, mission: 2,
    label: 'Turf takeover at night — South Beach',
  },
};

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const name = q.get('shot');
  const seed = Number(q.get('seed') || 1);
  if (!name || !SHOTS[name]) return { name: null, seed };
  return { name, seed, ...SHOTS[name] };
}

// Stage the game for a screenshot: place the player, set the time, wanted
// level and mission, and spawn the chase or the turf fight.
export function applyShot(G, shot) {
  const p = G.player;
  p.health = CONFIG.playerHealth; // clean shot: full health, no hurt flash
  p.dead = false;
  // The Downtown intersection (-20,-20): two drawn roads cross here, open
  // on all four sides, so no building wall fills the frame.
  const IX = -20, IZ = -20;
  G.timeOfDay = shot.timeOfDay;
  G.wanted = shot.wanted;
  G.missions.index = shot.mission;
  G.missions.step = 0;
  G.missions.done = false;
  G.save.missionIndex = shot.mission;
  G.save.missionStep = 0;
  startMissionStep(G);
  if (shot.inCar) {
    // Put the player in a car at the intersection, facing down the street.
    const car = createVehicle(G.scene, shot.inCar, IX, IZ, 0, undefined);
    car.driver = 'player';
    car.parked = false;
    G.parkedCars.push(car);
    p.onFoot = false;
    p.vehicle = car;
    p.mesh.visible = false;
    p.pos.set(IX, 0, IZ);
    car.speed = shot.name === 'chase' ? 30 : 24;
  } else {
    // On foot: Downtown intersection for 'foot', beach turf line for 'mission'.
    const x = shot.name === 'mission' ? 35 : IX;
    const z = shot.name === 'mission' ? -235 : IZ;
    p.pos.set(x, 0, z);
    p.angle = shot.name === 'mission' ? Math.PI : 0;
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.angle;
  }
  // Chase: three police cars closing in far ahead — the ~2 s of game time
  // before the capture closes ~160 units, so from +200 they land 15–45
  // units ahead of the player, lights flashing, driving into the shot.
  if (shot.name === 'chase') {
    const car = p.vehicle;
    for (let i = 0; i < 3; i++) {
      const cop = createVehicle(G.scene, 'police',
        car.pos.x + (i - 1) * 5, car.pos.z + 200 + i * 15, Math.PI, undefined);
      cop.driver = 'police';
      cop.parked = false;
      cop.speed = 10;
      G.police.copCars.push(cop);
      G.copCars.push(cop);
    }
    G.audio.siren(true);
  }
  // Mission: rivals hold the beach; muzzle smoke in the air.
  if (shot.name === 'mission') {
    spawnRivals(G, 35, -235, 4);
    G.effects.smoke(35, 1, -228, 10);
  }
  // Foot: pedestrians crossing right in front of the camera, and traffic
  // rolling down the street toward the player.
  if (shot.name === 'foot') {
    for (let i = 0; i < 3; i++) {
      const ped = G.peds[(i * 7) % G.peds.length];
      ped.pos.set(IX - 6 + i * 6, 0, IZ + 14 + (i % 2) * 4);
      ped.mesh.position.copy(ped.pos);
    }
    for (let i = 0; i < 3; i++) {
      const car = G.traffic[i];
      car.pos.set(i % 2 === 0 ? IX - 3 : IX + 3, 0, IZ + 58 + i * 14);
      car.angle = Math.PI;
      car.mesh.rotation.y = Math.PI;
      car.speed = 10;
      car.cruise = 12;
    }
  }
  G.cameraYaw = p.onFoot ? p.angle : (p.vehicle ? p.vehicle.angle : 0);
  G.cameraRig.yaw = G.cameraYaw;
  // Snap the camera into place immediately (no slow lerp from the title).
  const camDist = p.onFoot ? 9 : 14;
  G.cameraRig.pos.set(
    p.pos.x - Math.sin(G.cameraYaw) * camDist,
    p.onFoot ? 5 : 8,
    p.pos.z - Math.cos(G.cameraYaw) * camDist,
  );
}
