// Screenshot scenes — deterministic setups behind ?shot=N&seed=S. Each one
// stages a real gameplay state (never a fake backdrop): the same systems,
// the same HUD, the same lighting the player gets. The loop keeps running
// after setup, so pixels in the shot are live play, not a diorama.
import { CONFIG } from './config.js';
import { Vehicle } from './vehicle.js';

function placeCruiserAt(ctx, x, z, heading) {
  const c = new Vehicle(ctx.scene, 'police', x, z, heading);
  c.speed = 0;
  ctx.police.cruisers.push(c);
  return c;
}

export function setupShot(n, ctx) {
  const shot = CONFIG.shots[n] || CONFIG.shots[1];
  ctx.setTimeOfDay(shot.tod);
  const R = ctx.rng;
  // reset wanted/police, then stage what the shot needs — and FREEZE the
  // fleet so the staged composition cannot drive out of frame before the
  // screenshot lands (the loop keeps rendering; positions stay directed).
  ctx.police.clearWanted();
  ctx.police.hold = true;
  ctx.combat.clearEnemies();
  ctx.missions.hideMarker();

  if (n === 1) {
    // COVER — police chase at dusk: Vortex GT rolling toward a cruiser
    // roadblock, one cruiser on the tail, Downtown mission live on the HUD.
    // Fixed camera frames the whole stretch so nothing drives out of shot.
    const car = new Vehicle(ctx.scene, 'sports', 3.5, 60, 0);
    car.speed = 14;
    ctx.parked.push(car);
    ctx.player.enterVehicle(car);
    ctx.police.stars = 3; ctx.police.heat = 75;
    placeCruiserAt(ctx, -3.5, 52, Math.PI);   // tail, left lane, closing in
    placeCruiserAt(ctx, -3.5, 88, Math.PI);   // roadblock ahead
    placeCruiserAt(ctx, 3.5, 102, Math.PI);   // roadblock ahead, right lane
    ctx.missions.startMission(CONFIG.missions[5]);
    ctx.missions.spawnCrewForStep(ctx.combat);
    ctx.camera.setFixed([14, 7, 42], [0, 5, 78]);
  } else if (n === 2) {
    // On foot in Downtown at midday: traffic rolling past, peds on the walk,
    // first mission live so the objective line reads as gameplay.
    ctx.player.pos.set(6, 0, 24);
    ctx.player.heading = Math.PI;
    ctx.player.group.position.copy(ctx.player.pos);
    ctx.player.group.rotation.y = ctx.player.heading;
    ctx.missions.startMission(CONFIG.missions[0]);
    // two traffic cars passing right by the player + peds on the sidewalk
    const t1 = new Vehicle(ctx.scene, 'sedan', 3.5, -60, 0); t1.speed = 12;
    const t2 = new Vehicle(ctx.scene, 'taxi', -3.5, 90, Math.PI); t2.speed = 11;
    ctx.traffic.cars.push(
      { vehicle: t1, axis: 'x', road: 0, dir: 1, lane: 3.5, speed: 12, targetSpeed: 12 },
      { vehicle: t2, axis: 'x', road: 0, dir: -1, lane: -3.5, speed: 11, targetSpeed: 11 },
    );
    ctx.peds.addPed(11, 30); ctx.peds.addPed(-11, 10); ctx.peds.addPed(11, -24);
    ctx.camera.snapBehind(ctx.player, false);
  } else if (n === 3) {
    // Driving a stolen Bay Taxi at speed, one star on the tail — the cruiser
    // waits ahead in the same lane so it stays in frame as the taxi closes.
    const car = new Vehicle(ctx.scene, 'taxi', -3.5, -120, Math.PI);
    car.speed = 26;
    ctx.parked.push(car);
    ctx.player.enterVehicle(car);
    ctx.police.stars = 1; ctx.police.heat = 25;
    placeCruiserAt(ctx, -3.5, -185, Math.PI);
    for (let k = 0; k < 3; k++) ctx.traffic.addCar();
    ctx.camera.snapBehind(ctx.player, true);
  } else {
    // Night turf war at the Marina: 4 stars, Harbor Kings on the pier,
    // cruisers holding the street behind — none of them can ram the shot.
    ctx.setTimeOfDay('night');
    ctx.player.pos.set(340, 0, 330);
    ctx.player.heading = 0.59; // face the pier (360,360): beacon + crew in frame
    ctx.player.group.position.copy(ctx.player.pos);
    ctx.player.group.rotation.y = ctx.player.heading;
    ctx.police.stars = 4; ctx.police.heat = 100;
    placeCruiserAt(ctx, 303.5, 280, 0);
    ctx.missions.startMission(CONFIG.missions[4]);
    ctx.missions.spawnCrewForStep(ctx.combat);
    ctx.camera.snapBehind(ctx.player, false);
  }
  // deterministic extras: a few parked cars near the action
  for (let k = 0; k < 3; k++) {
    const [x, z] = ctx.world.randomRoadPoint(R, null);
    if (Math.abs(x - ctx.player.position.x) < 30 && Math.abs(z - ctx.player.position.z) < 30) continue;
    ctx.parked.push(new Vehicle(ctx.scene, 'sedan', x, z, 0));
  }
  return shot;
}
