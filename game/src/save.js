// MARISOL BAY — save.js
// One job: persist Milo's progress (cash, turf, missions, collectibles,
// best times) to localStorage and load it back. The game never depends
// on a save existing; a missing or corrupt save just starts fresh.
const KEY = 'marisol-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function writeSave(G) {
  try {
    const data = {
      cash: Math.round(G.cash),
      health: Math.round(G.player.health),
      wanted: G.wanted,
      turf: G.turf.slice(),
      missionIndex: G.missionIndex,
      missionsDone: G.missionsDone.slice(),
      collected: G.collected.slice(),
      taxiFares: G.stats.taxiFares,
      trialsWon: G.stats.trialsWon,
      carsOwned: G.carsOwned.slice(),
      playSeconds: Math.round(G.stats.playSeconds),
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function applySave(G, data) {
  if (!data) return false;
  G.cash = typeof data.cash === 'number' ? data.cash : G.cash;
  if (typeof data.health === 'number') G.player.health = data.health;
  if (Array.isArray(data.turf) && data.turf.length === 6) G.turf = data.turf.map(Boolean);
  if (typeof data.missionIndex === 'number') G.missionIndex = data.missionIndex;
  if (Array.isArray(data.missionsDone)) G.missionsDone = data.missionsDone.map(Boolean);
  if (Array.isArray(data.collected)) G.collected = data.collected.map(Boolean);
  if (typeof data.taxiFares === 'number') G.stats.taxiFares = data.taxiFares;
  if (typeof data.trialsWon === 'number') G.stats.trialsWon = data.trialsWon;
  if (Array.isArray(data.carsOwned)) G.carsOwned = data.carsOwned.slice();
  if (typeof data.playSeconds === 'number') G.stats.playSeconds = data.playSeconds;
  return true;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (err) { /* fresh start anyway */ }
}
