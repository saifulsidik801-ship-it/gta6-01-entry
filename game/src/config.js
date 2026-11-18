// MARISOL BAY — config.js
// One job: every tunable number, name and table for the whole game.
// Nothing here draws or moves anything; it only describes the city,
// the cars, the districts and the story spine so the other modules
// can stay small and honest about what they do.
export const CFG = {
  title: 'MARISOL BAY',
  subtitle: 'take the city, district by district',
  hero: 'Milo Kade',
  citySize: 420,            // playable square, metres
  roadGap: 52,              // distance between road centrelines
  roadWidth: 14,
  blockSize: 38,
  startCash: 500,
  startHealth: 100,
  maxWanted: 5,
  dayLength: 480,           // seconds for a full day cycle
  gravity: 30,
};

// Six districts. Taking a district raises HEAT, heat brings police,
// police chases feed the driving loop, turf income buys better cars.
// That is the whole game in one sentence, and every system serves it.
export const DISTRICTS = [
  { id: 0, name: 'Harbor Lights',  cx: -140, cz: -140, color: 0xffb84d, income: 120, boss: 'Dockside crew' },
  { id: 1, name: 'Old Marina',     cx:  140, cz: -140, color: 0x4dd2ff, income: 140, boss: 'Marina runners' },
  { id: 2, name: 'Palm Row',       cx: -140, cz:    0, color: 0x7dff6a, income: 100, boss: 'Row dealers' },
  { id: 3, name: 'Downtown',       cx:  140, cz:    0, color: 0xff5d7e, income: 220, boss: 'Tower syndicate' },
  { id: 4, name: 'Sunset Beach',   cx: -140, cz:  140, color: 0xffd23e, income: 160, boss: 'Boardwalk gang' },
  { id: 5, name: 'Hillcrest',      cx:  140, cz:  140, color: 0xb98cff, income: 200, boss: 'Hill enforcers' },
];

// Vehicle types the player can steal or buy. Police cars are not for sale.
export const VEHICLES = {
  sedan:  { name: 'Sedan',    top: 26, accel: 14, grip: 0.9,  color: 0x3fa7ff, price: 0 },
  taxi:   { name: 'Taxi',     top: 24, accel: 13, grip: 0.9,  color: 0xffc21c, price: 0 },
  sport:  { name: 'Sport',    top: 38, accel: 22, grip: 1.1,  color: 0xff3b30, price: 2500 },
  truck:  { name: 'Truck',    top: 20, accel: 9,  grip: 0.7,  color: 0x8a6d3b, price: 1800 },
  van:    { name: 'Van',      top: 22, accel: 11, grip: 0.8,  color: 0x9aa5b1, price: 1200 },
  police: { name: 'Patrol',   top: 34, accel: 20, grip: 1.05, color: 0x1c2733, price: 0 },
};

// The counted story spine: six turf missions, one per district, then a finale.
export const MISSIONS = [
  { id: 0, name: 'First Wheels',   district: 0, brief: 'Steal a car and reach the Harbor Lights marker.', reward: 400 },
  { id: 1, name: 'Marina Run',     district: 1, brief: 'Drive the package to Old Marina before the timer ends.', reward: 600 },
  { id: 2, name: 'Palm Row Heat',  district: 2, brief: 'Clear the Row dealers, then hold the turf marker.', reward: 700 },
  { id: 3, name: 'Downtown Siege', district: 3, brief: 'Take Downtown: defeat the Tower syndicate crew.', reward: 1200 },
  { id: 4, name: 'Beach Blitz',    district: 4, brief: 'Win the Sunset Beach time trial, then claim the boardwalk.', reward: 900 },
  { id: 5, name: 'Hillcrest Fall', district: 5, brief: 'Storm Hillcrest and take the last district.', reward: 1500 },
  { id: 6, name: 'King of the Bay', district: 3, brief: 'FINALE: hold Downtown against every crew at once.', reward: 5000 },
];

export const COLLECTIBLE_COUNT = 30;
export const TAXI_FARE = 150;
export const TIME_TRIAL_REWARD = 350;

// Bright, sun-soaked palette. The cover screenshot must read at thumbnail
// scale, so nothing in the city is allowed to be murky or near-black.
export const PALETTE = {
  skyDay: 0x7ec8f2, skyDusk: 0xff9a52, skyNight: 0x1d2b4a,
  sunDay: 0xfff2c8, sunDusk: 0xffb347, sunNight: 0x8fa8d8,
  ground: 0xa8b89a, sand: 0xffe9a8, water: 0x2ec8d8,
  road: 0x7d8494, sidewalk: 0xe6e9ec, line: 0xffe066,
  buildings: [0xff6b6b, 0xffd166, 0x6bcBff, 0x95d5b2, 0xf4978e, 0xc3aed6, 0xffb703, 0x8ecae6, 0xf4a261, 0x90be6d],
};
