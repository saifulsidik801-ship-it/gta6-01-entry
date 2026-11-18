// MARISOL BAY — shots.js
// One job: the four deterministic screenshot scenes, reached with
// ?shot=chase|foot|drive|mission&seed=N. Each scene puts the real game
// into a real playable state — police chase, street life, a stolen
// car at speed, a turf mission at night — then hides the menus so the
// pixels are the game itself. Nothing here fakes a state the game
// cannot reach by playing.
//
// Staging rule: every scene stands ON a road centreline (roads run at
// x/z = -184, -132, -80, -28, 24, 76, 128, 180) facing down the avenue,
// with the camera snapped behind the player — never inside a block,
// never staring at a building wall.
import { DISTRICTS } from './config.js';
import { spawnPolice } from './police.js';

// Avenue x = 24 runs the full city north–south. Put the camera behind
// the subject in one jump so it never lerps through a building.
function snapCamera(G, x, y, z, yaw) {
  G.cameraRig.yaw = yaw;
  G.cameraRig.smooth.set(x, y, z);
}

export function applyShot(G, params) {
  const shot = params.get('shot');
  if (!shot) return false;
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  G.seed = seed * 7919 + 13;
  G.shotMode = shot;
  G.mode = 'playing';
  G.hud.showStart(false); G.hud.showMenu(false); G.hud.showPause(false);
  const P = G.player;
  if (shot === 'chase') {
    // COVER: late-afternoon police chase down the 24 avenue, 4 stars,
    // patrol cars in the mirrors, Downtown ahead, warm bright sky.
    G.timeOfDay = 0.32;
    G.world.setTimeOfDay(G.timeOfDay);
    const car = G.cars.find((c) => c.type === 'sport') || G.cars[0];
    car.pos.set(24, 0, -160); car.angle = 0; car.speed = 26;
    enterShotCar(G, car);
    const chaseYaw = Math.PI + 0.55;
    snapCamera(G, 24 + Math.sin(chaseYaw) * 12, 5, -160 + Math.cos(chaseYaw) * 12, chaseYaw);
    G.wanted = 3;
    G.police.sirenAt = 0;
    spawnPolice(G);
    // line the patrol cars up behind Milo on the same avenue
    G.police.cars.forEach((pc, i) => {
      pc.pos.set(24 + (i % 2 ? 3.5 : -3.5), 0, -178 - i * 12);
      pc.angle = 0; pc.speed = 24;
    });
    G.missions.start(3);
    G.missions.advance(G);
    G.cash = 4860;
    G.hud.setObjective('MISSION 4/7 — Downtown Siege: clear the Tower syndicate');
  } else if (shot === 'foot') {
    // Bright midday street: Milo on foot on the 24 avenue, traffic and
    // pedestrians around him, palms and towers down the street.
    G.timeOfDay = 0.3;
    G.world.setTimeOfDay(G.timeOfDay);
    P.pos.set(24, 0, -40); P.angle = Math.PI;
    P.mesh.position.copy(P.pos); P.mesh.rotation.y = P.angle;
    snapCamera(G, 24, 5, -28, 0);
    // a few pedestrians right beside him so the street feels alive
    G.pedestrians.list.slice(0, 4).forEach((p, i) => {
      p.pos.set(20 + i * 3, 0, -48 - i * 4);
      p.mesh.position.copy(p.pos);
    });
    G.cash = 2450;
    G.turf[0] = true; G.turf[1] = true;
    G.missions.start(2);
    G.hud.setObjective('MISSION 3/7 — Palm Row Heat: clear the Row dealers');
  } else if (shot === 'drive') {
    // Stolen sportscar tearing down the 24 avenue in daylight.
    G.timeOfDay = 0.22;
    G.world.setTimeOfDay(G.timeOfDay);
    const car = G.cars.find((c) => c.type === 'sport') || G.cars[0];
    car.pos.set(24, 0, -120); car.angle = 0; car.speed = 30;
    enterShotCar(G, car);
    snapCamera(G, 24, 5, -132, Math.PI);
    G.cash = 3120;
    G.hud.setObjective('Stolen Sport — outrun the morning traffic');
  } else if (shot === 'mission') {
    // Early-night turf takeover at Hillcrest: golden marker, crew to
    // clear, 3 stars, palms and the beach horizon behind.
    G.timeOfDay = 0.74;
    G.world.setTimeOfDay(G.timeOfDay);
    P.pos.set(128, 0, 146); P.angle = Math.PI * 0.65; // facing the Hillcrest crew
    P.mesh.position.copy(P.pos); P.mesh.rotation.y = P.angle;
    P.armed = true; P.ammo = 48;
    snapCamera(G, 119, 5, 151, Math.PI * 1.65);
    G.wanted = 2;
    G.turf[0] = true; G.turf[1] = true; G.turf[2] = true; G.turf[3] = true; G.turf[4] = true;
    G.missions.start(5);
    G.missions.advance(G);
    G.hud.setObjective('MISSION 6/7 — Hillcrest Fall: clear the Hill enforcers (5 left)');
  }
  // let the world settle a few frames so the shot is not mid-spawn
  for (let i = 0; i < 5; i++) G.tick(1 / 60, true);
  return true;
}

function enterShotCar(G, car) {
  const P = G.player;
  P.onFoot = false; P.car = car; car.parked = false; car.driver = P;
  P.mesh.visible = false;
  P.pos.copy(car.pos);
}
