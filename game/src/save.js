// Save — localStorage persistence for cash, turf, completed missions,
// best stats and options. One key, one JSON blob, versioned so a future
// build can migrate instead of crashing on a stale save.
const KEY = 'marisol-bay-save-v1';

export class SaveSystem {
  constructor() { this.data = this.load(); }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return this.fresh();
      const d = JSON.parse(raw);
      if (d.version !== 1) return this.fresh();
      return { ...this.fresh(), ...d };
    } catch {
      return this.fresh();
    }
  }

  fresh() {
    return {
      version: 1,
      cash: 150,
      owned: {},
      done: [],
      packagesTaken: 0,
      bestTurf: 0,
      totalEarned: 0,
      missionsCompleted: 0,
      options: { volume: 0.5, muted: false, quality: 'high' },
      garage: { owned: ['sedan'], selected: 'sedan', upgrades: {} },
      savedAt: 0,
    };
  }

  save(patch) {
    this.data = { ...this.data, ...patch, savedAt: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; }
    catch { return false; }
  }

  clear() {
    try { localStorage.removeItem(KEY); } catch { /* private mode */ }
    this.data = this.fresh();
  }
}
