// Marisol Bay — HUD and minimap.
// One clear job: every number on screen is read from live game state —
// wanted stars, cash, health, turf, speed, mission objective — plus the
// top-down minimap canvas and toast messages.
import { CONFIG, districtAt } from './config.js';
import { missionObjective, missionMarker, currentMission } from './missions.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = {
    root: el('hud'),
    stars: el('hud-stars'),
    cash: el('hud-cash'),
    turf: el('hud-turf'),
    health: el('hud-health-fill'),
    healthWrap: el('hud-health'),
    objective: el('hud-objective'),
    speed: el('hud-speed'),
    toastBox: el('hud-toasts'),
    vignette: el('hud-vignette'),
    crosshair: el('hud-crosshair'),
    interact: el('hud-interact'),
    minimap: el('minimap'),
    district: el('hud-district'),
    time: el('hud-time'),
    _ctx: null,
    _toastT: 0,
  };
  if (hud.minimap) hud._ctx = hud.minimap.getContext('2d');
  hud.toast = (text) => {
    if (!hud.toastBox) return;
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = text;
    hud.toastBox.appendChild(div);
    while (hud.toastBox.children.length > 3) hud.toastBox.removeChild(hud.toastBox.firstChild);
    setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 5200);
  };
  hud.flashDamage = () => {
    if (!hud.vignette) return;
    hud.vignette.style.opacity = '0.85';
    setTimeout(() => { hud.vignette.style.opacity = '0'; }, 220);
  };
  return hud;
}

function starString(wanted) {
  const full = '★'.repeat(Math.max(0, Math.min(5, Math.round(wanted))));
  const empty = '☆'.repeat(5 - full.length);
  return full + empty;
}

function clockString(t) {
  // t in [0,1]: 0.0 = 06:00, 0.5 = 18:00... map to a 24h clock starting 06:00.
  const hours = (6 + t * 24) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function updateHud(G) {
  const hud = G.hud;
  if (!hud.root) return;
  const p = G.player;
  hud.stars.textContent = starString(G.wanted);
  hud.stars.className = G.wanted > 0 ? 'stars hot' : 'stars';
  hud.cash.textContent = `$${Math.floor(G.cash).toLocaleString('en-US')}`;
  const owned = G.save.turf.length;
  hud.turf.textContent = `TURF ${owned}/6`;
  hud.turf.className = owned >= 6 ? 'turf done' : 'turf';
  const hp = Math.max(0, Math.round(p.health));
  hud.health.style.width = `${hp}%`;
  hud.healthWrap.style.display = p.onFoot ? 'block' : 'none';
  hud.objective.textContent = missionObjective(G);
  const speed = p.vehicle ? Math.abs(p.vehicle.speed) * 3.6 : 0;
  hud.speed.textContent = p.vehicle ? `${Math.round(speed)} km/h` : '';
  hud.speed.style.display = p.vehicle ? 'block' : 'none';
  const pos = p.onFoot ? p.pos : (p.vehicle ? p.vehicle.pos : p.pos);
  const d = districtAt(pos.x, pos.z);
  hud.district.textContent = d ? d.name : 'Marisol Bay';
  hud.time.textContent = clockString(G.timeOfDay);
  hud.crosshair.style.display = (G.mode === 'playing' && p.onFoot) ? 'block' : 'none';
  // "Press E" prompt when a stealable car is near.
  let nearCar = false;
  if (p.onFoot && G.mode === 'playing') {
    for (const car of G.parkedCars) {
      const dx = car.pos.x - p.pos.x; const dz = car.pos.z - p.pos.z;
      if (dx * dx + dz * dz < 20) { nearCar = true; break; }
    }
  }
  hud.interact.style.display = nearCar ? 'block' : 'none';
  hud.interact.textContent = nearCar ? 'Press E — steal car' : '';
  drawMinimap(G);
}

function drawMinimap(G) {
  const hud = G.hud;
  const ctx = hud._ctx;
  if (!ctx) return;
  const S = 180; // canvas pixels
  const half = CONFIG.cityHalf + 40;
  const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(10, 18, 28, 0.85)';
  ctx.fillRect(0, 0, S, S);
  // Beach + sea at the south edge.
  ctx.fillStyle = '#e8cf9e';
  ctx.fillRect(0, S - 14, S, 8);
  ctx.fillStyle = '#1e6f8e';
  ctx.fillRect(0, S - 6, S, 6);
  // Roads.
  ctx.strokeStyle = 'rgba(220, 225, 235, 0.55)';
  ctx.lineWidth = 2;
  for (let c = -CONFIG.cityHalf; c <= CONFIG.cityHalf; c += CONFIG.roadSpacing) {
    const [ax] = toMap(c, 0);
    ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, S); ctx.stroke();
    const [, bz] = toMap(0, c);
    ctx.beginPath(); ctx.moveTo(0, bz); ctx.lineTo(S, bz); ctx.stroke();
  }
  // Owned turf districts (green) vs unowned (outline).
  for (const d of CONFIG.districts) {
    const [x, y] = toMap(d.cx - d.hw, d.cz - d.hd);
    const w = (d.hw * 2 / (half * 2)) * S;
    const h = (d.hd * 2 / (half * 2)) * S;
    if (G.save.turf.includes(d.id)) {
      ctx.fillStyle = 'rgba(80, 200, 90, 0.45)';
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.strokeStyle = 'rgba(255, 201, 60, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }
  }
  // Mission marker (gold diamond, pulsing by time).
  const marker = missionMarker(G);
  if (marker) {
    const [mx, my] = toMap(marker.x, marker.z);
    const r = 5 + Math.sin(performance.now() / 200) * 1.5;
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.moveTo(mx, my - r); ctx.lineTo(mx + r, my); ctx.lineTo(mx, my + r); ctx.lineTo(mx - r, my);
    ctx.closePath(); ctx.fill();
  }
  // Police (red/blue dots).
  for (const car of G.police.copCars) {
    const [cx, cy] = toMap(car.pos.x, car.pos.z);
    ctx.fillStyle = '#ff4040';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const cop of G.police.footCops) {
    const [cx, cy] = toMap(cop.pos.x, cop.pos.z);
    ctx.fillStyle = '#ff8080';
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
  }
  // Enemies (orange dots).
  for (const e of G.combat.enemies) {
    if (!e.alive) continue;
    const [ex, ey] = toMap(e.pos.x, e.pos.z);
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player (white arrow, rotated by heading).
  const p = G.player;
  const pp = p.onFoot ? p.pos : (p.vehicle ? p.vehicle.pos : p.pos);
  const heading = p.onFoot ? p.angle : (p.vehicle ? p.vehicle.angle : p.angle);
  const [px, py] = toMap(pp.x, pp.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-heading); // arrow drawn pointing down (+z on the map)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 6); ctx.lineTo(4.5, -5); ctx.lineTo(-4.5, -5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // North tick.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('N', S - 12, 12);
}
