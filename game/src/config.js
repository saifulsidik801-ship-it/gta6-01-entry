// MARISOL BAY — central tuning. One place for every number the other
// systems share: world layout, districts, vehicles, wanted ladder, money.
export const CONFIG = {
  world: {
    size: 1200,            // playable square, x/z in [-600, 600]
    half: 600,
    roadStep: 100,         // roads every 100 units
    roadHalf: 7,           // half-width of a road
    firstRoad: -500,       // roads at -500 .. 500
    beachZ: 470,           // sand strip starts here (south edge)
    waterZ: 560,           // water plane starts here
    blockInset: 12,        // buildings keep this far inside a block
  },
  districts: [
    { id: 'downtown', name: 'Downtown', center: [0, 0], color: 0x2e6fd8, income: 120 },
    { id: 'palms', name: 'Palm Row', center: [-300, 300], color: 0x2fae6e, income: 90 },
    { id: 'marina', name: 'Marina', center: [350, 350], color: 0x19b8c4, income: 110 },
    { id: 'port', name: 'Portside', center: [300, -350], color: 0xd88a2e, income: 100 },
    { id: 'hills', name: 'Coral Hills', center: [-350, -300], color: 0x9a5fd0, income: 95 },
    { id: 'boardwalk', name: 'Boardwalk', center: [0, 480], color: 0xe04a7a, income: 130 },
  ],
  vehicles: {
    sedan:   { name: 'Comet Sedan',  top: 34, accel: 16, brake: 30, steer: 1.9, grip: 8.5, price: 0,    color: 0x8a93a6 },
    taxi:    { name: 'Bay Taxi',     top: 32, accel: 15, brake: 30, steer: 1.9, grip: 8.5, price: 0,    color: 0xf2c200 },
    sports:  { name: 'Vortex GT',    top: 52, accel: 26, brake: 36, steer: 2.4, grip: 10,  price: 2500, color: 0xd21f3c },
    truck:   { name: 'Hauler',       top: 26, accel: 11, brake: 24, steer: 1.5, grip: 7,   price: 1800, color: 0x3f6d4e },
    police:  { name: 'MBPD Cruiser', top: 44, accel: 24, brake: 34, steer: 2.3, grip: 9.5, price: 0,    color: 0x1c2733 },
    coupe:   { name: 'Solstice',     top: 44, accel: 21, brake: 32, steer: 2.2, grip: 9.5, price: 1200, color: 0x2e6fd8 },
  },
  player: {
    walk: 7, run: 11, turn: 9, health: 100,
    punchDamage: 25, punchRange: 2.4, punchArc: 1.1,
    pistolDamage: 34, pistolRange: 70, pistolAmmo: 48, fireCooldown: 0.22,
  },
  wanted: {
    // stars -> { maxCruisers, maxFootCops, chaseSpeed, ramDamage }
    ladder: [
      { cruisers: 0, cops: 0, speed: 0 },
      { cruisers: 1, cops: 1, speed: 26 },
      { cruisers: 2, cops: 2, speed: 30 },
      { cruisers: 3, cops: 3, speed: 34 },
      { cruisers: 4, cops: 4, speed: 38 },
      { cruisers: 5, cops: 5, speed: 42 },
    ],
    heatPerCarjack: 25, heatPerPedHit: 25, heatPerShot: 15, heatPerCopDown: 40,
    decayDelay: 14, decayRate: 1,        // seconds hidden before a star fades
    bustRadius: 3.2, bustTime: 2.5,      // cop on foot next to you for this long = busted
    escapeRadius: 190,                   // outrun the law this far to start cooling off
  },
  economy: {
    startCash: 150, taxiFare: 45, timeTrialPrize: 150, packageValue: 60,
    missionPay: [300, 450, 600, 800, 1000, 1500, 3000],
    turfTick: 25,           // cash per owned district every 60 s
  },
  missions: [
    { id: 'm1', title: 'First Fare', district: 'palms', pay: 300,
      blurb: 'Milo needs wheels. Borrow — permanently — a car from Palm Row and bring it to Rico at the garage.' },
    { id: 'm2', title: 'Beachfront Run', district: 'boardwalk', pay: 450,
      blurb: 'Run three taxi fares along the Boardwalk before the meter runs out. Tips for style.' },
    { id: 'm3', title: 'Dockside Debt', district: 'port', pay: 600,
      blurb: 'Collect the Portside crates and lose the MBPD tail. Do not let the cargo take a bullet.' },
    { id: 'm4', title: 'Hill Climb', district: 'hills', pay: 800,
      blurb: 'A time trial through Coral Hills. Beat the clock, beat the rival crew waiting at the top.' },
    { id: 'm5', title: 'Marina Nights', district: 'marina', pay: 1000,
      blurb: 'Take the Marina from the Harbor Kings. Hold the pier while their crew comes at you.' },
    { id: 'm6', title: 'Downtown Crown', district: 'downtown', pay: 1500,
      blurb: 'The last crew in Downtown. One street war, one winner. Bring a fast car and a full clip.' },
    { id: 'finale', title: 'King of the Bay', district: 'downtown', pay: 3000,
      blurb: 'Every district is yours. The old boss wants it back — one final chase across all six districts.' },
  ],
  shots: {
    // deterministic screenshot scenes: ?shot=N&seed=S
    1: { tod: 'dusk', mode: 'drive', wanted: 3, vehicle: 'sports', cam: 'chase' },
    2: { tod: 'day', mode: 'foot', wanted: 0, vehicle: null, cam: 'street' },
    3: { tod: 'day', mode: 'drive', wanted: 1, vehicle: 'taxi', cam: 'chase' },
    4: { tod: 'night', mode: 'mission', wanted: 4, vehicle: 'sports', cam: 'wide' },
  },
  camera: {
    footDist: 7.5, footHeight: 3.4,
    driveDist: 11, driveHeight: 4.2,
    chaseFov: 68, cruiseFov: 60,
  },
};

// District lookup: which district owns a world position.
export function districtAt(x, z) {
  let best = CONFIG.districts[0]; let bd = Infinity;
  for (const d of CONFIG.districts) {
    const dx = x - d.center[0], dz = z - d.center[1];
    const q = dx * dx + dz * dz;
    if (q < bd) { bd = q; best = d; }
  }
  return best;
}

// Clamp a position inside the playable square (water edge blocks the south).
export function clampWorld(x, z, margin = 8) {
  const h = CONFIG.world.half - margin;
  return [Math.max(-h, Math.min(h, x)), Math.max(-h, Math.min(CONFIG.world.beachZ - 4, z))];
}
