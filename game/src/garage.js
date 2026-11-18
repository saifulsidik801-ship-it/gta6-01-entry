// MARISOL BAY — garage.js
// One job: Milo's garage — the shop where turf income turns into metal.
// Buy a Sport, a Truck or a Van (it spawns beside Milo, ready to steal
// into), repair the body, or bribe the heat away. Cash is the only
// currency; the shop never sells anything the player cannot afford,
// and it never touches the save except through the normal save flow.
import { VEHICLES } from './config.js';
import { makeCar } from './vehicle.js';

const STOCK = [
  { type: 'sport', blurb: 'Top speed 137 km/h — outrun anything with a siren' },
  { type: 'truck', blurb: 'Slow, heavy, unstoppable — rams through roadblocks' },
  { type: 'van', blurb: 'Roomy and steady — the working driver’s pick' },
];

export function createGarage(G) {
  const GR = { open: false };
  const $ = (id) => document.getElementById(id);

  function refresh() {
    const cashEl = $('shop-cash');
    if (cashEl) cashEl.textContent = `$${Math.round(G.cash).toLocaleString('en-US')}`;
    for (const item of STOCK) {
      const btn = $(`btn-buy-${item.type}`);
      if (!btn) continue;
      const def = VEHICLES[item.type];
      const owned = G.carsOwned.includes(item.type);
      btn.textContent = owned ? `🚗 ${def.name} — DRIVE IT (owned)` : `🚗 ${def.name} — $${def.price.toLocaleString('en-US')}`;
      btn.disabled = !owned && G.cash < def.price;
      btn.style.opacity = btn.disabled ? '0.55' : '1';
    }
    const repair = $('btn-repair');
    if (repair) { repair.disabled = G.player.health >= 100 && !G.player.car; repair.textContent = '🔧 Full repair + heal — $150'; }
    const bribe = $('btn-bribe');
    if (bribe) { bribe.disabled = G.wanted === 0 || G.cash < 500; bribe.textContent = '🤫 Bribe the heat away — $500'; }
  }

  function spawnNear(type) {
    const P = G.player;
    const x = P.pos.x + Math.sin(P.angle + 1.2) * 5;
    const z = P.pos.z + Math.cos(P.angle + 1.2) * 5;
    const car = makeCar(G, type, x, z, P.angle);
    car.parked = true;
    return car;
  }

  GR.buy = (type) => {
    const def = VEHICLES[type];
    if (!def) return;
    if (G.carsOwned.includes(type)) {
      spawnNear(type);
      G.hud.flash(`Your ${def.name} is parked right beside you`);
      G.audio.horn();
      return;
    }
    if (G.cash < def.price) { G.hud.flash(`Not enough cash for the ${def.name} — $${def.price}`); return; }
    G.cash -= def.price;
    G.carsOwned.push(type);
    spawnNear(type);
    G.audio.cash();
    G.hud.flash(`Bought the ${def.name} for $${def.price} — it is yours now`);
    refresh();
  };

  GR.repair = () => {
    if (G.cash < 150) { G.hud.flash('Repair costs $150'); return; }
    G.cash -= 150;
    G.player.health = 100;
    if (G.player.car) G.player.car.speed = 0;
    G.audio.pickup();
    G.hud.flash('Patched up — full health');
    refresh();
  };

  GR.bribe = () => {
    if (G.wanted === 0 || G.cash < 500) return;
    G.cash -= 500;
    G.wanted = 0;
    G.audio.cash();
    G.hud.flash('The heat is gone — somebody got paid');
    refresh();
  };

  GR.toggle = () => {
    if (GR.open) {
      GR.open = false;
      const el = $('shop'); if (el) el.style.display = 'none';
      if (G.mode === 'paused') { G.mode = 'playing'; G.hud.showPause(false); }
    } else {
      if (G.mode !== 'playing') return;
      GR.open = true;
      refresh();
      const el = $('shop'); if (el) el.style.display = 'flex';
      G.mode = 'paused'; // the city waits while Milo shops
    }
  };

  // Wire the buttons once; the shop is pure DOM over the live game.
  for (const item of STOCK) {
    const btn = $(`btn-buy-${item.type}`);
    if (btn) btn.addEventListener('click', () => GR.buy(item.type));
  }
  const repair = $('btn-repair');
  if (repair) repair.addEventListener('click', () => GR.repair());
  const bribe = $('btn-bribe');
  if (bribe) bribe.addEventListener('click', () => GR.bribe());
  const close = $('btn-shop-close');
  if (close) close.addEventListener('click', () => GR.toggle());
  GR.refresh = refresh;
  return GR;
}
