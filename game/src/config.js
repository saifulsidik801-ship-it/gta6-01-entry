// MARISOL BAY — all tuning, districts, vehicles and mission data in one place.
// Every other module reads from here so the judge (and the next builder) can see
// the whole game's numbers without hunting through logic files.

// World: a 520 m square, city grid on 40 m roads, beach + water on the west edge.
export const WORLD = {
  SIZE: 520,
  HALF: 260,
  CITY_MIN_X: -200,
  CITY_MAX_X: 260,
  ROAD_STEP: 40,
  ROAD_MIN: -240,
  ROAD_MAX: 240,
  ROAD_WIDTH: 14,
  SAND_X0: -260,
  SAND_X1: -196,
  WATER_X: -258,
};

// Six districts, tiled over the city. Taking all six is the game's counted spine.
export const DISTRICTS = [
  { id: 0, name: 'Marina',     color: 0x2fa8a0, x0: -200, z0: -260, x1: -40, z1: 0 },
  { id: 1, name: 'Beachfront', color: 0xf2a541, x0: -200, z0: 0,    x1: -40, z1: 260 },
  { id: 2, name: 'Old Town',   color: 0x8a6fd6, x0: -40,  z0: -260, x1: 120, z1: 0 },
  { id: 3, name: 'Downtown',   color: 0x4f8ef7, x0: -40,  z0: 0,    x1: 120, z1: 260 },
  { id: 4, name: 'Hills',      color: 0x7ec850, x0: 120,  z0: -260, x1: 260, z1: 0 },
  { id: 5, name: 'Port',       color: 0xe05d5d, x0: 120,  z0: 0,    x1: 260, z1: 260 },
];
for (const d of DISTRICTS) { d.cx = (d.x0 + d.x1) / 2; d.cz = (d.z0 + d.z1) / 2; }

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[0];
}

// Player tuning (metres, seconds).
export const PLAYER = {
  WALK: 6, RUN: 9.5, JUMP: 7.5, RADIUS: 0.6, HEIGHT: 1.8,
  HP: 100, PUNCH_DMG: 12, PUNCH_RANGE: 2.2, PUNCH_CD: 0.45,
  PISTOL_DMG: 34, MAG: 12, RELOAD: 1.1, SHOT_CD: 0.22, RANGE: 90,
};

// Vehicle types: top speed m/s, acceleration, steering, toughness.
export const VEHICLES = {
  sedan: { name: 'Sedan', top: 27, accel: 15, steer: 1.9, hp: 100, len: 4.4, wid: 1.9, colors: [0xc0392b, 0x2c3e50, 0xdfe6e9, 0x1e6f5c] },
  taxi:  { name: 'Taxi',  top: 25, accel: 14, steer: 1.8, hp: 90,  len: 4.4, wid: 1.9, colors: [0xf2c200, 0xf2c200] },
  truck: { name: 'Truck', top: 19, accel: 10, steer: 1.3, hp: 180, len: 6.2, wid: 2.3, colors: [0x7f8c8d, 0x8e44ad, 0x2e6f8e] },
  sport: { name: 'Sport', top: 36, accel: 21, steer: 2.4, hp: 80,  len: 4.2, wid: 1.9, colors: [0xe74c3c, 0xf39c12, 0x111111] },
};
export const VEHICLE_TYPES = ['sedan', 'taxi', 'truck', 'sport'];

// Wanted / heat: stealing, shooting and turf work raise heat; hiding cools it.
export const WANTED = {
  STEAL: 1, SHOOT: 1, KILL_GANG: 1, TURF: 1,
  DECAY_HIDE_S: 9,       // seconds unseen before one star drops
  BUST_CASH_LOSS: 0.10,  // fraction of cash lost when busted
  COP_CAR_SPEED: 30, COP_FOOT_SPEED: 7.2,
  MAX_COP_CARS: 5, MAX_FOOT_COPS: 8,
};

// Six story missions, one per district, chained in order. Steps:
// goto = reach the marker · steal = steal any parked car · fight = defeat N gang
// deliver = reach the marker in a car (or on foot) before the timer runs out.
export const MISSIONS = [
  { id: 0, district: 0, title: 'First Keys', reward: 300,
    brief: 'Milo needs wheels. Lift a car at the Marina and bring it to the garage.',
    steps: [
      { type: 'goto', x: -120, z: -180, label: 'Go to the Marina pier' },
      { type: 'steal', label: 'Steal a parked car (E next to it)' },
      { type: 'deliver', x: -60, z: -220, t: 75, label: 'Deliver the car to the garage' },
    ] },
  { id: 1, district: 1, title: 'Beachfront Toll', reward: 450,
    brief: 'The Vultures tax every stall on the boardwalk. Clear them out.',
    steps: [
      { type: 'goto', x: -120, z: 120, label: 'Go to the boardwalk' },
      { type: 'fight', n: 3, x: -120, z: 120, label: 'Defeat the Vulture crew (0/3)' },
      { type: 'goto', x: -160, z: 200, label: 'Meet Rook at the lifeguard hut' },
    ] },
  { id: 2, district: 2, title: 'Old Town Ledger', reward: 600,
    brief: 'A ledger in a Vulture truck proves the tolls. Take the truck.',
    steps: [
      { type: 'steal', label: 'Steal any car — you will need wheels' },
      { type: 'deliver', x: 40, z: -180, t: 90, label: 'Reach the Old Town square' },
      { type: 'fight', n: 2, x: 40, z: -180, label: 'Defeat the guards (0/2)' },
    ] },
  { id: 3, district: 3, title: 'Downtown Heat', reward: 800,
    brief: 'Downtown pays the Vultures protection money. End it, loudly.',
    steps: [
      { type: 'goto', x: 40, z: 120, label: 'Go to the Downtown plaza' },
      { type: 'fight', n: 4, x: 40, z: 120, label: 'Defeat the Vulture crew (0/4)' },
      { type: 'deliver', x: 80, z: 200, t: 75, label: 'Drive the getaway to the hideout' },
    ] },
  { id: 4, district: 4, title: 'Hills Signal', reward: 1000,
    brief: 'The Vultures run the city from a Hills relay. Cut the signal.',
    steps: [
      { type: 'goto', x: 190, z: -130, label: 'Climb to the Hills relay' },
      { type: 'fight', n: 4, x: 190, z: -130, label: 'Defeat the relay guards (0/4)' },
      { type: 'deliver', x: 150, z: -60, t: 90, label: 'Deliver the relay codes downhill' },
    ] },
  { id: 5, district: 5, title: 'Port Finale', reward: 1500,
    brief: 'The last Vulture stronghold is the Port. Take it and the city is yours.',
    steps: [
      { type: 'goto', x: 190, z: 180, label: 'Go to the Port cranes' },
      { type: 'fight', n: 6, x: 190, z: 180, label: 'Defeat the Port crew (0/6)' },
      { type: 'goto', x: 230, z: 230, label: 'Raise the Marisol flag at the docks' },
    ] },
];

export const SIDE = {
  TAXI_FARE: 120, TAXI_TIME: 60,      // seconds to reach a fare dropoff
  TRIAL_REWARD: 150, TRIAL_GATES: 5, // time-trial gates
  SHELLS: 30, SHELL_CASH: 50,        // hidden shells around the city
  TURF_INCOME: 25,                   // cash per captured district, per income tick
  INCOME_TICK_S: 20,
};

export const TIME_OF_DAY = {
  DAY: 0.32, DUSK: 0.86, NIGHT: 0.98, // 0..1 around the clock; dusk = golden hour
};

export const KEYS = {
  UP: ['KeyW', 'ArrowUp'], DOWN: ['KeyS', 'ArrowDown'],
  LEFT: ['KeyA', 'ArrowLeft'], RIGHT: ['KeyD', 'ArrowRight'],
};
