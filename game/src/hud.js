// HUD — every number on screen is recomputed from live state each frame:
// wanted stars, cash, turf, health, ammo, speed, mission objective, and a
// 2D minimap that draws roads, districts, the player arrow and blips for
// the mission marker, police and traffic. Also toasts and banners.
import { CONFIG } from './config.js';

export class HUD {
  constructor(doc) {
    this.doc = doc;
    this.el = {};
    for (const id of ['stars', 'cash', 'turf', 'health', 'health-fill', 'health-num', 'ammo', 'speed',
      'objective', 'district', 'banner', 'toast', 'minimap', 'wanted-label', 'clock']) {
      this.el[id] = doc.getElementById(id);
    }
    this.map = this.el.minimap.getContext('2d');
    this.bannerTimer = 0;
    this.toastTimer = 0;
    this.lastCash = -1;
  }

  stars(n) {
    this.el.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    this.el.stars.classList.toggle('hot', n > 0);
    this.el['wanted-label'].textContent = n === 0 ? 'CLEAN' : n >= 4 ? 'MOST WANTED' : 'WANTED';
  }

  update(s) {
    // s: {stars, cash, turf, owned, health, ammo, speed, objective, district, tod, time}
    this.stars(s.stars);
    if (s.cash !== this.lastCash) {
      this.el.cash.textContent = '$' + Math.floor(s.cash).toLocaleString('en-US');
      this.lastCash = s.cash;
    }
    this.el.turf.textContent = `TURF ${s.owned}/6`;
    this.el['health-fill'].style.width = Math.max(0, s.health) + '%';
    this.el['health-fill'].style.background = s.health > 50 ? '#37d67a' : s.health > 25 ? '#f2c200' : '#e23b3b';
    this.el['health-num'].textContent = Math.ceil(s.health);
    this.el.ammo.textContent = s.armed === false ? '—' : `◉ ${s.ammo}`;
    this.el.speed.textContent = Math.abs(Math.round(s.speed * 2.4)) + ' mph';
    this.el.objective.textContent = s.objective || '';
    this.el.district.textContent = s.district || 'Marisol Bay';
    this.el.clock.textContent = s.todLabel || '';
    if (this.bannerTimer > 0) { this.bannerTimer -= 1 / 60; if (this.bannerTimer <= 0) this.el.banner.classList.add('hidden'); }
    if (this.toastTimer > 0) { this.toastTimer -= 1 / 60; if (this.toastTimer <= 0) this.el.toast.classList.add('hidden'); }
    this.drawMinimap(s);
  }

  banner(text, ms = 2600) {
    // In shot mode the banner would sit over the staged frame — skip it.
    if (document.body.classList.contains('shot')) return;
    this.el.banner.textContent = text;
    this.el.banner.classList.remove('hidden');
    this.bannerTimer = ms / 1000;
  }

  toast(text, ms = 2200) {
    if (document.body.classList.contains('shot')) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    this.toastTimer = ms / 1000;
  }

  drawMinimap(s) {
    const ctx = this.map, W = 180, H = 180;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10,16,22,0.85)';
    ctx.fillRect(0, 0, W, H);
    const toMap = (x, z) => [((x + 600) / 1200) * W, ((z + 600) / 1200) * H];
    // districts
    for (const d of CONFIG.districts) {
      const [mx, mz] = toMap(d.center[0], d.center[1]);
      ctx.fillStyle = '#' + d.color.toString(16).padStart(6, '0');
      ctx.globalAlpha = s.ownedDistricts && s.ownedDistricts.includes(d.id) ? 0.85 : 0.28;
      ctx.beginPath(); ctx.arc(mx, mz, 13, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // roads
    ctx.strokeStyle = 'rgba(220,225,235,0.5)';
    ctx.lineWidth = 1.4;
    for (let r = -500; r <= 500; r += 100) {
      const [x1, y1] = toMap(r, -600); const [x2, y2] = toMap(r, 600);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [a1, b1] = toMap(-600, r); const [a2, b2] = toMap(600, r);
      ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke();
    }
    // beach + water
    ctx.fillStyle = '#e3cd8f'; ctx.fillRect(0, toMap(0, 470)[1], W, 10);
    ctx.fillStyle = '#2f7fb8'; ctx.fillRect(0, toMap(0, 560)[1], W, H - toMap(0, 560)[1]);
    // mission marker
    if (s.marker) {
      const [mx, mz] = toMap(s.marker.x, s.marker.z);
      const pulse = 5 + Math.sin(performance.now() / 200) * 2;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(mx, mz, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, mz, pulse + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // police blips
    ctx.fillStyle = '#3a86ff';
    for (const p of s.police || []) {
      const [mx, mz] = toMap(p.x, p.z);
      ctx.beginPath(); ctx.arc(mx, mz, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    const [px, py] = toMap(s.playerX, s.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(s.heading), Math.cos(s.heading)) * -1 + Math.PI);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
}
