// Save / load: localStorage, one key. Cash, captured turf, missions finished and
// shells found survive a reload; the city, cars and wanted level never do.
const KEY = 'marisol-bay-save-v1';

export function createSave(G) {
  return {
    save() {
      try {
        const shellsTaken = G.world.shells.map((s, i) => (s.taken ? i : -1)).filter((i) => i >= 0);
        localStorage.setItem(KEY, JSON.stringify({
          cash: Math.floor(G.state.cash),
          turf: G.state.turf,
          missionsDone: G.state.missionsDone,
          shells: shellsTaken,
          timeOfDay: G.world.timeOfDay,
        }));
      } catch { /* storage unavailable (private mode): the game still plays */ }
    },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (typeof d.cash !== 'number' || !Array.isArray(d.turf)) return null;
        return d;
      } catch { return null; }
    },
    apply(d) {
      G.state.cash = d.cash;
      G.state.turf = d.turf.slice(0, 6);
      while (G.state.turf.length < 6) G.state.turf.push(false);
      G.state.missionsDone = d.missionsDone || 0;
      for (const i of d.shells || []) {
        const sh = G.world.shells[i];
        if (sh) { sh.taken = true; sh.mesh.visible = false; }
      }
      G.state.shells = (d.shells || []).length;
      if (typeof d.timeOfDay === 'number') {
        // Missions restore after the world exists; time restores here.
      }
      G.missions.loadProgress(G.state.missionsDone);
    },
    clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
  };
}
