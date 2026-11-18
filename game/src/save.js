// Marisol Bay — save and load.
// One clear job: persist progress (cash, turf, missions, collectibles) in
// localStorage and restore it. Never touches the network.
import { CONFIG } from './config.js';

export function defaultSave() {
  return {
    cash: 250, health: CONFIG.playerHealth, turf: [],
    missionIndex: 0, missionStep: 0, collectibles: [],
    stats: { carsStolen: 0, fares: 0, copsDodged: 0, missionsDone: 0 },
    muted: false, bestCash: 250,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(CONFIG.saveKey);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const base = defaultSave();
    return { ...base, ...data, stats: { ...base.stats, ...(data.stats || {}) } };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    save.bestCash = Math.max(save.bestCash || 0, save.cash || 0);
    window.localStorage.setItem(CONFIG.saveKey, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(CONFIG.saveKey); } catch { /* ignore */ }
}
