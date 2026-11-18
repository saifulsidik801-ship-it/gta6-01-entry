// MARISOL BAY — hud.js
// One job: everything drawn on top of the 3D view. Cash, health, ammo,
// wanted stars, turf chips, the mission objective line, the speedo,
// the live minimap (real positions, recomputed every frame), the start
// screen, the pause menu and the damage flash. Every number here is
// read from the live game state — nothing is staged.
import { DISTRICTS, CFG } from './config.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const H = {
    objective: 'Free roam — press M for the next mission',
    flashTimer: 0,
  };
  H.setObjective = (t) => { H.objective = t; const el = $('objective'); if (el) el.textContent = t; };
  H.flash = (t) => {
    const el = $('toast'); if (!el) return;
    el.textContent = t; el.style.opacity = '1'; H.flashTimer = 3.2;
  };
  H.damageFlash = () => { const el = $('damage'); if (el) { el.style.opacity = '0.55'; setTimeout(() => { el.style.opacity = '0'; }, 160); } };
  H.showMenu = (show) => { const el = $('menu'); if (el) el.style.display = show ? 'flex' : 'none'; };
  H.showPause = (show) => { const el = $('pause'); if (el) el.style.display = show ? 'flex' : 'none'; };
  H.showStart = (show) => { const el = $('start'); if (el) el.style.display = show ? 'flex' : 'none'; };

  // Build the turf chips once; their colours update every frame.
  const turfEl = $('turf');
  if (turfEl) {
    turfEl.innerHTML = DISTRICTS.map((d, i) =>
      `<span id="turf-${i}" style="background:#222a; border:1px solid #${d.color.toString(16).padStart(6, '0')}; color:#fff; padding:2px 7px; border-radius:10px; font-size:11px; margin-right:4px;">${d.name}</span>`).join('');
  }

  H.update = (dt) => {
    if (H.flashTimer > 0) { H.flashTimer -= dt; if (H.flashTimer <= 0) { const el = $('toast'); if (el) el.style.opacity = '0'; } }
    const cash = $('cash'); if (cash) cash.textContent = `$${Math.round(G.cash).toLocaleString('en-US')}`;
    const hp = $('health'); if (hp) { hp.textContent = `♥ ${Math.max(0, Math.round(G.player.health))}`; hp.style.color = G.player.health < 30 ? '#ff5d5d' : '#7dff6a'; }
    const ammo = $('ammo'); if (ammo) ammo.textContent = G.player.armed ? `🔫 ${G.player.ammo}` : '👊 FISTS';
    const stars = $('stars'); if (stars) { stars.textContent = '★'.repeat(G.wanted) + '☆'.repeat(CFG.maxWanted - G.wanted); stars.style.color = G.wanted > 0 ? '#ffd23e' : '#ffffff88'; }
    const turfCount = $('turfcount'); if (turfCount) turfCount.textContent = `TURF ${G.turf.filter(Boolean).length}/6`;
    for (let i = 0; i < 6; i++) {
      const chip = $(`turf-${i}`);
      if (chip) chip.style.background = G.turf[i] ? `#${DISTRICTS[i].color.toString(16).padStart(6, '0')}` : '#222a';
    }
    const speed = $('speed');
    if (speed) {
      speed.textContent = G.player.car ? `${Math.round(Math.abs(G.player.car.speed) * 3.6)} km/h · ${G.player.car.def.name}` : (G.player.onFoot ? 'ON FOOT' : '');
    }
    const clockEl = $('clock');
    if (clockEl) {
      const h = Math.floor(6 + G.timeOfDay * 24) % 24;
      const m = Math.floor((G.timeOfDay * 24 * 60) % 60);
      clockEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${G.timeOfDay < 0.5 ? 'DAY' : G.timeOfDay < 0.72 ? 'DUSK' : 'NIGHT'}`;
    }
    const mis = $('mission-label');
    if (mis) mis.textContent = G.missionsDone.filter(Boolean).length >= 7 ? '🏆 KING OF THE BAY'
      : (G.missionIndex < 7 ? `MISSION ${G.missionIndex + 1}/7` : 'FREE ROAM');
    H.drawMinimap();
  };

  // Minimap: roads, district beacons, cars, cops, mission marker, Milo.
  H.drawMinimap = () => {
    const cv = $('minimap');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const S = cv.width, half = CFG.citySize / 2;
    const px = (x) => ((x + half) / CFG.citySize) * S;
    const pz = (z) => ((z + half) / CFG.citySize) * S;
    ctx.fillStyle = '#101820'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(0, pz(half + 8), S, S - pz(half + 8)); // beach strip
    ctx.fillStyle = '#2ec8d8'; ctx.fillRect(0, pz(half + 40), S, 4);
    ctx.strokeStyle = '#5a6470'; ctx.lineWidth = 4;
    for (const c of G.world.roads) {
      ctx.beginPath(); ctx.moveTo(px(-half), pz(c)); ctx.lineTo(px(half), pz(c)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(c), pz(-half)); ctx.lineTo(px(c), pz(half)); ctx.stroke();
    }
    for (const d of DISTRICTS) {
      ctx.fillStyle = `#${d.color.toString(16).padStart(6, '0')}`;
      ctx.globalAlpha = G.turf[d.id] ? 1 : 0.45;
      ctx.beginPath(); ctx.arc(px(d.cx), pz(d.cz), 7, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#ffd23e';
    for (const c of G.world.collectibles) if (!c.taken) ctx.fillRect(px(c.x) - 1, pz(c.z) - 1, 2, 2);
    ctx.fillStyle = '#ffffff';
    for (const c of G.traffic.cars) ctx.fillRect(px(c.pos.x) - 1.5, pz(c.pos.z) - 1.5, 3, 3);
    ctx.fillStyle = '#ff3b30';
    for (const c of G.police.cars) { ctx.beginPath(); ctx.arc(px(c.pos.x), pz(c.pos.z), 3, 0, Math.PI * 2); ctx.fill(); }
    for (const c of G.police.cops) ctx.fillRect(px(c.pos.x) - 2, pz(c.pos.z) - 2, 4, 4);
    if (G.missions.current) {
      const d = G.missions.current.district;
      ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px(d.cx), pz(d.cz), 10 + Math.sin(G.time * 4) * 3, 0, Math.PI * 2); ctx.stroke();
    }
    // Milo: a white arrow that turns with him
    const p = G.player.pos;
    ctx.save();
    ctx.translate(px(p.x), pz(p.z)); ctx.rotate(Math.atan2(Math.sin(G.player.angle), Math.cos(G.player.angle)));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  return H;
}
