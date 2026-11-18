// Deterministic screenshot scenes, driven by ?shot=<name>&seed=1. Each scene
// stages a real game state — a driven car, real police, real gang members, the
// live HUD — and never a faked backdrop, so the screenshots are truth-checked
// renders of the game's own code.
import { setTimeOfDay } from './world.js';

export function applyShot(G, name) {
  G.hud.hideAll();
  G.audio.setMuted(true);
  const placeCar = (type, x, z, yaw, speed) => {
    const car = G.vehicles.spawn(type, x, z, yaw, 'parked');
    G.vehicles.enterCar(car);
    car.speed = speed || 0;
    return car;
  };
  if (name === 'chase') {
    // COVER: dusk police chase, wanted 4, cop cars closing in on both flanks.
    setTimeOfDay(G, 0.86);
    const car = placeCar('sport', -40, 40, 0, 24);
    G.state.wanted = 4;
    G.police.spawnCopCar(-48, 24);
    G.police.spawnCopCar(-32, 32);
    G.police.spawnCopCar(-32, 66);
    for (const c of G.police.copCars) { c.speed = 20; c.yaw = 0; }
    G.cameraRig.yaw = car.yaw;
    G.missions.current = 0; G.missions.step = 2;
    G.missions.startStep();
    G.state.cash = 1240;
    G.hud.toast('Downtown Heat: lose the cops, then hit the plaza.');
  } else if (name === 'foot') {
    // On foot downtown at midday, traffic and pedestrians around Milo.
    setTimeOfDay(G, 0.32);
    G.player.reset(36, 108);
    G.player.yaw = Math.PI;
    G.player.group.rotation.y = Math.PI;
    G.cameraRig.yaw = Math.PI;
    G.state.wanted = 0;
    G.state.cash = 350;
    G.hud.toast('On foot in Downtown — steal a car with E, or take a taxi job with Q.');
  } else if (name === 'drive') {
    // Driving the coast road in a taxi, beach and marina to the west.
    setTimeOfDay(G, 0.32);
    const car = placeCar('taxi', -160, 20, 0, 18);
    G.cameraRig.yaw = car.yaw;
    G.state.wanted = 0;
    G.state.cash = 620;
    G.hud.toast('Coast road, Marina — fares pay best out here.');
  } else if (name === 'mission') {
    // Night turf takeover: Downtown Heat, gang fight under the beacon.
    setTimeOfDay(G, 0.98);
    G.missions.current = 3; G.missions.step = 1; G.missions.kills = 0;
    G.combat.spawnGang(4, 40, 120);
    G.missions.spawned = true;
    G.player.reset(28, 96);
    G.player.yaw = Math.atan2(40 - 28, 120 - 96);
    G.player.group.rotation.y = G.player.yaw;
    G.state.wanted = 2;
    G.state.cash = 980;
    G.state.turf = [true, true, true, false, false, false];
    G.cameraRig.setFixed(74, 16, 78, 40, 2, 120);
    G.hud.toast('Mission 4/6: Downtown Heat — defeat the Vulture crew (0/4).');
  } else {
    setTimeOfDay(G, 0.32);
  }
  // The main loop advances G.clockT and re-applies the time of day every frame,
  // so a shot's lighting only survives if the clock starts from the shot's time.
  G.clockT = G.world.timeOfDay;
  G.state.mode = 'playing';
  G.cameraRig.mode = name === 'mission' ? 'fixed' : (G.player.inCar ? 'car' : 'foot');
  G.hud.update();
  // Let one frame render, then signal the screenshot script.
  setTimeout(() => { window.__SHOT_READY__ = true; }, 900);
}
