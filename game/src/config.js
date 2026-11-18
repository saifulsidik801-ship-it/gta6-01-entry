// Marisol Bay — shared tuning and city constants.
// One clear job: every number the rest of the game agrees on lives here.
export const CONFIG = {
  title: 'MARISOL BAY',
  subtitle: 'Take the city, district by district.',
  cityHalf: 300,            // city spans -300..300 on x and z
  roadSpacing: 70,          // distance between parallel roads
  roadWidth: 14,
  blockSize: 56,            // roadSpacing - roadWidth
  maxWanted: 5,
  playerWalkSpeed: 9,
  playerRunSpeed: 14,
  playerHealth: 100,
  carTopSpeed: 46,          // sport ~ 165 km/h feel
  carAccel: 26,
  carBrake: 40,
  carTurn: 2.1,
  trafficCount: 26,
  pedestrianCount: 42,
  collectibleCount: 30,
  saveKey: 'marisol-bay-save-v1',
  // Six districts: the counted turf spine. Taking turf raises HEAT, heat
  // brings police, police chases feed the driving and combat loops.
  districts: [
    { id: 'downtown', name: 'Downtown',   cx: 0,    cz: 0,    hw: 105, hd: 105, color: 0x3f6fb5, height: [26, 78], income: 320 },
    { id: 'marina',   name: 'Marina',     cx: 210,  cz: 35,   hw: 90,  hd: 105, color: 0x2f9e8f, height: [10, 30], income: 240 },
    { id: 'beach',    name: 'South Beach',cx: 0,    cz: -210, hw: 300, hd: 90,  color: 0xe0a458, height: [8, 22],  income: 180 },
    { id: 'hills',    name: 'Palm Hills', cx: -35,  cz: 210,  hw: 265, hd: 90,  color: 0x7fae5a, height: [10, 26], income: 200 },
    { id: 'port',     name: 'Portside',   cx: -210, cz: -35,  hw: 90,  hd: 105, color: 0x8a7a5c, height: [12, 34], income: 260 },
    { id: 'oldtown',  name: 'Old Town',   cx: 210,  cz: -210, hw: 90,  hd: 90,  color: 0xb5763f, height: [12, 30], income: 220 },
  ],
  // Palette for the sun-soaked coastal look.
  palette: {
    skyDay: 0x87bfe8, skyDusk: 0xf2a35e, skyNight: 0x0e1a33,
    sunDay: 0xfff2d8, sunDusk: 0xff9a4d, sunNight: 0x8fa8d8,
    road: 0x4b4f57, sidewalk: 0x9aa0a8, sand: 0xe8cf9e, sea: 0x1e6f8e,
    grass: 0x5d8a4a, building: [0xc9b8a3, 0xb5c4cc, 0xd8c9a8, 0xa8b8c9, 0xc9a89a, 0x9fb3a4],
  },
  // Story missions: one counted spine, 6 missions + finale.
  missions: [
    { id: 'm1', name: 'First Fare', district: 'beach', reward: 150,
      brief: 'Rico needs a driver. Pick up the fare at South Beach and drop them at the Marina.',
      steps: [
        { type: 'goto', label: 'Pick up the fare at South Beach', x: -40, z: -235 },
        { type: 'drive', label: 'Drop the fare at the Marina', x: 235, z: 60 },
      ] },
    { id: 'm2', name: 'Hot Wheels', district: 'port', reward: 220,
      brief: 'The Portside crew keeps a sport car locked down. Steal it and bring it to the garage in Old Town.',
      steps: [
        { type: 'steal', label: 'Steal the sport car at Portside', x: -235, z: -70 },
        { type: 'drive', label: 'Deliver the car to the Old Town garage', x: 235, z: -235 },
      ] },
    { id: 'm3', name: 'Turf War: Beach', district: 'beach', reward: 300,
      brief: 'Rival runners hold South Beach. Clear them out and plant the flag.',
      steps: [
        { type: 'clear', label: 'Clear the rival runners at South Beach', x: 35, z: -235, count: 4 },
        { type: 'turf', label: 'Plant the flag — take South Beach', x: 35, z: -235 },
      ] },
    { id: 'm4', name: 'Heat Run', district: 'downtown', reward: 380,
      brief: 'A courier run straight through Downtown with the police already watching. Lose the heat, then deliver.',
      steps: [
        { type: 'drive', label: 'Reach the Downtown drop-off', x: 35, z: 35, wanted: 3 },
        { type: 'escape', label: 'Lose the police, then reach the Marina', x: 245, z: 35 },
      ] },
    { id: 'm5', name: 'Turf War: Hills', district: 'hills', reward: 420,
      brief: 'Palm Hills pays well and the crew there is armed. Take the hill, block by block.',
      steps: [
        { type: 'clear', label: 'Clear the hill crew at Palm Hills', x: -70, z: 245, count: 5 },
        { type: 'turf', label: 'Plant the flag — take Palm Hills', x: -70, z: 245 },
      ] },
    { id: 'm6', name: 'King of the Bay', district: 'downtown', reward: 600,
      brief: 'The last rival boss holds the Downtown tower. Take the tower and the whole bay is yours.',
      steps: [
        { type: 'clear', label: 'Fight through the tower guards', x: 0, z: 0, count: 6 },
        { type: 'turf', label: 'Plant the flag on Downtown', x: 0, z: 0 },
      ] },
  ],
  taxiFare: 60,
  timeTrialReward: 120,
};

// District lookup: which district owns a point, or null outside the city.
export function districtAt(x, z) {
  for (const d of CONFIG.districts) {
    if (Math.abs(x - d.cx) <= d.hw && Math.abs(z - d.cz) <= d.hd) return d;
  }
  return null;
}

// Snap a coordinate to the nearest road centre line. Roads are drawn at
// -300 + 70k (…-90, -20, 50, 120…), so the snap must use that origin —
// snapping to plain multiples of 70 lands 20 units off the asphalt.
export function nearestRoadCoord(v) {
  return Math.round((v + CONFIG.cityHalf) / CONFIG.roadSpacing) * CONFIG.roadSpacing - CONFIG.cityHalf;
}

// A road centre line from an index 0..8 (used when spawning traffic).
export function roadCoord(i) {
  return -CONFIG.cityHalf + i * CONFIG.roadSpacing;
}

// Is this point on a road (drivable asphalt)?
export function isOnRoad(x, z) {
  const rx = Math.abs(x - nearestRoadCoord(x));
  const rz = Math.abs(z - nearestRoadCoord(z));
  return rx <= CONFIG.roadWidth / 2 + 1 || rz <= CONFIG.roadWidth / 2 + 1;
}
