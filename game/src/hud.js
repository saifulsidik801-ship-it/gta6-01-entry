// HUD + minimap + menus. Every number here is read live from the game state —
// cash, health, ammo, speed, wanted stars, turf, clock — never a staged value.
// The minimap is a real 2D canvas: districts, roads, the player, cops, gang and
// the mission marker, all drawn from live positions every frame.
import { DISTRICTS, SIDE, WORLD } from './config.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'), cash: $('cash'), stars: $('stars'), hpFill: $('hp-fill'), hpText: $('hp-text'),
    ammo: $('ammo'), speed: $('speed'), turf: $('turf'), clock: $('clock'),
    objective: $('objective'), toast: $('toast'), minimap: $('minimap'),
    menu: $('menu'), pause: $('pause'), busted: $('busted'), wasted: $('wasted'),
    flash: $('damage-flash'), district: $('district'),
  };
  const mm = els.minimap.getContext('2d');
  let toastTimer = null;
  const hud = {
    toast(msg) {
      els.toast.textContent = msg;
      els.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200);
    },
    flashDamage() {
      els.flash.style.opacity = '0.45';
      setTimeout(() => { els.flash.style.opacity = '0'; }, 130);
    },
    show(name) {
      for (const k of ['menu', 'pause', 'busted', 'wasted']) els[k].classList.toggle('hidden', k !== name);
      els.hud.classList.toggle('hidden', name === 'menu');
    },
    hideAll() { for (const k of ['menu', 'pause', 'busted', 'wasted']) els[k].classList.add('hidden'); els.hud.classList.remove('hidden'); },
    update() {
      const s = G.state;
      els.cash.textContent = '$' + Math.floor(s.cash).toLocaleString('en-US');
      els.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
      els.stars.style.color = s.wanted > 0 ? '#ffd23a' : '#5a6270';
      const hp = Math.max(0, Math.round(G.player.hp));
      els.hpFill.style.width = hp + '%';
      els.hpFill.style.background = hp > 50 ? '#37c978' : hp > 25 ? '#f2a541' : '#e05d5d';
      els.hpText.textContent = hp;
      els.ammo.textContent = G.combat.ammo + ' / ' + 12 + (G.combat.reloading > 0 ? ' …' : '');
      const car = G.vehicles.driven;
      els.speed.textContent = car ? Math.round(Math.abs(car.speed) * 3.6) + ' km/h · ' + car.cfg.name : 'on foot';
      const taken = s.turf.filter(Boolean).length;
      els.turf.textContent = 'TURF ' + taken + '/6';
      const t = G.world.timeOfDay;
      const hh = Math.floor(t * 24), mmn = Math.floor((t * 24 - hh) * 60);
      const tod = t > 0.92 || t < 0.08 ? 'NIGHT' : t > 0.78 ? 'DUSK' : 'DAY';
      els.clock.textContent = String(hh).padStart(2, '0') + ':' + String(mmn).padStart(2, '0') + ' ' + tod;
      els.objective.textContent = G.missions.objective();
      const here = DISTRICTS.find((dd) => G.player.x >= dd.x0 && G.player.x < dd.x1 && G.player.z >= dd.z0 && G.player.z < dd.z1);
      els.district.textContent = here ? here.name.toUpperCase() : 'MARISOL BAY';
      els.district.style.color = here ? '#' + here.color.toString(16).padStart(6, '0') : '#fff';
      this.drawMinimap();
    },
    drawMinimap() {
      const S = 180, scale = S / WORLD.SIZE;
      const toX = (x) => (x + WORLD.HALF) * scale;
      const toY = (z) => (z + WORLD.HALF) * scale;
      mm.clearRect(0, 0, S, S);
      mm.fillStyle = '#10141a'; mm.fillRect(0, 0, S, S);
      // Sea + sand on the west edge.
      mm.fillStyle = '#1f7fa8'; mm.fillRect(0, 0, (WORLD.WATER_X + 30 + WORLD.HALF) * scale + 14, S);
      mm.fillStyle = '#e8d29a'; mm.fillRect(toX(WORLD.SAND_X0), 0, (WORLD.SAND_X1 - WORLD.SAND_X0) * scale, S);
      // Districts.
      for (const d of DISTRICTS) {
        mm.fillStyle = '#' + d.color.toString(16).padStart(6, '0') + '55';
        mm.fillRect(toX(d.x0), toY(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
        mm.strokeStyle = '#' + d.color.toString(16).padStart(6, '0');
        mm.lineWidth = G.state.turf[d.id] ? 2.5 : 1;
        mm.strokeRect(toX(d.x0), toY(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
        if (G.state.turf[d.id]) {
          mm.fillStyle = '#fff'; mm.font = 'bold 11px sans-serif'; mm.textAlign = 'center';
          mm.fillText('✓', toX(d.cx), toY(d.cz) + 4);
        }
      }
      // Roads.
      mm.strokeStyle = '#5a6270'; mm.lineWidth = 1;
      for (let v = -240; v <= 240; v += 40) {
        mm.beginPath(); mm.moveTo(toX(v), 0); mm.lineTo(toX(v), S); mm.stroke();
        mm.beginPath(); mm.moveTo(0, toY(v)); mm.lineTo(S, toY(v)); mm.stroke();
      }
      // Cars (grey), gang (red), cops (blue).
      const dot = (x, z, c, r) => { mm.fillStyle = c; mm.beginPath(); mm.arc(toX(x), toY(z), r, 0, 7); mm.fill(); };
      for (const c of G.vehicles.list) {
        if (c.driver === 'police') dot(c.group.position.x, c.group.position.z, '#3a86ff', 3);
        else if (c.driver === 'player') continue;
        else dot(c.group.position.x, c.group.position.z, '#9aa5ad', 2);
      }
      for (const e of G.combat.enemies) dot(e.x, e.z, '#ff4040', 2.5);
      for (const c of G.police.footCops) dot(c.x, c.z, '#3a86ff', 2.5);
      // Mission marker: pulsing yellow diamond.
      const mp = G.missions.markerPos();
      if (mp) {
        const pulse = 4 + Math.sin(performance.now() / 200) * 1.5;
        mm.fillStyle = '#ffd23a';
        mm.beginPath();
        mm.moveTo(toX(mp.x), toY(mp.z) - pulse - 3);
        mm.lineTo(toX(mp.x) + pulse + 3, toY(mp.z));
        mm.lineTo(toX(mp.x), toY(mp.z) + pulse + 3);
        mm.lineTo(toX(mp.x) - pulse - 3, toY(mp.z));
        mm.closePath(); mm.fill();
      }
      // Player: white triangle pointing along the facing yaw.
      const px = toX(G.player.x), pz = toY(G.player.z);
      const yaw = G.player.inCar && G.player.car ? G.player.car.yaw : G.player.yaw;
      mm.save();
      mm.translate(px, pz); mm.rotate(Math.PI - yaw);
      mm.fillStyle = '#fff';
      mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 5); mm.lineTo(-5, 5); mm.closePath(); mm.fill();
      mm.restore();
      mm.strokeStyle = 'rgba(255,255,255,0.35)'; mm.lineWidth = 1;
      mm.strokeRect(0.5, 0.5, S - 1, S - 1);
    },
  };
  // Buttons.
  $('start-btn').addEventListener('click', () => G.startGame());
  $('resume-btn').addEventListener('click', () => G.setMode('playing'));
  $('restart-btn').addEventListener('click', () => {
    G.player.reset(-100, -160);
    G.player.hp = 100;
    G.setMode('playing');
  });
  $('mute-btn').addEventListener('click', (e) => {
    G.audio.setMuted(!G.audio.muted);
    e.target.textContent = G.audio.muted ? '🔇 Sound: off' : '🔊 Sound: on';
  });
  return hud;
}
