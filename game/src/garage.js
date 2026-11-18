// Garage — Rico's shop. Spend turf income on cars and upgrades: a faster
// engine, thicker armor, better grip. Owned cars can be called to the
// player's position; the selected car is what missions hand you at start.
import { CONFIG } from './config.js';
import { Vehicle } from './vehicle.js';

export const UPGRADES = {
  engine: { name: 'Turbo Engine', costs: [600, 1200, 2200], desc: '+18% top speed per level' },
  armor: { name: 'Plated Armor', costs: [500, 1000, 1800], desc: '+40 max health per level' },
  grip: { name: 'Race Tires', costs: [400, 900, 1600], desc: '+12% grip and steering per level' },
};

export class Garage {
  constructor(save, scene, world) {
    this.save = save;
    this.scene = scene;
    this.world = world;
    this.spawned = null; // currently called-in Vehicle
  }

  owned() { return this.save.data.garage.owned; }
  upgradesFor(type) { return this.save.data.garage.upgrades[type] || {}; }

  level(type, key) { return (this.upgradesFor(type)[key] || 0); }

  buyVehicle(type) {
    const spec = CONFIG.vehicles[type];
    if (!spec || spec.price <= 0) return { ok: false, reason: 'Not for sale' };
    if (this.owned().includes(type)) return { ok: false, reason: 'Already owned' };
    if (this.save.data.cash < spec.price) return { ok: false, reason: 'Not enough cash' };
    this.save.data.cash -= spec.price;
    this.save.data.garage.owned.push(type);
    this.save.save({ cash: this.save.data.cash, garage: this.save.data.garage });
    return { ok: true };
  }

  buyUpgrade(type, key) {
    const up = UPGRADES[key];
    const lvl = this.level(type, key);
    if (lvl >= up.costs.length) return { ok: false, reason: 'Maxed out' };
    const cost = up.costs[lvl];
    if (this.save.data.cash < cost) return { ok: false, reason: 'Not enough cash' };
    this.save.data.cash -= cost;
    const ups = this.save.data.garage.upgrades;
    ups[type] = { ...(ups[type] || {}), [key]: lvl + 1 };
    this.save.save({ cash: this.save.data.cash, garage: this.save.data.garage });
    return { ok: true };
  }

  // Apply owned upgrades to a live vehicle spec (multiplicative, capped).
  tunedSpec(type) {
    const base = CONFIG.vehicles[type];
    const lvl = (k) => this.level(type, k);
    return {
      ...base,
      top: base.top * (1 + 0.18 * lvl('engine')),
      steer: base.steer * (1 + 0.12 * lvl('grip')),
      grip: base.grip * (1 + 0.12 * lvl('grip')),
    };
  }

  // Call the selected car to the player: it appears on the nearest road.
  callCar(playerPos, heading) {
    const type = this.save.data.garage.selected || 'sedan';
    if (this.spawned) this.spawned.remove();
    const spec = this.tunedSpec(type);
    const x = playerPos.x + Math.sin(heading) * 10;
    const z = playerPos.z + Math.cos(heading) * 10;
    const v = new Vehicle(this.scene, type, x, z, heading);
    v.spec = spec;
    v.health = 100 + 40 * this.level(type, 'armor');
    this.spawned = v;
    return v;
  }

  renderList(doc) {
    // Fill the garage panel (menu + pause) with buy buttons. Called on open.
    const lists = doc.querySelectorAll('#garage-list, #garage-list-2');
    lists.forEach((list) => {
      list.innerHTML = '';
      for (const [type, spec] of Object.entries(CONFIG.vehicles)) {
        if (type === 'police') continue;
        const owned = this.owned().includes(type);
        const row = doc.createElement('div');
        row.className = 'garage-row';
        const eng = this.level(type, 'engine'), arm = this.level(type, 'armor'), grp = this.level(type, 'grip');
        row.innerHTML = `<b>${spec.name}</b> — top ${Math.round(this.tunedSpec(type).top * 2.4)} mph` +
          ` · ENG ${eng} ARM ${arm} GRIP ${grp}` +
          (owned ? ` <span class="owned">OWNED</span>` : spec.price ? ` <button data-buy="${type}">BUY $${spec.price}</button>` : ' <span class="owned">STREET</span>');
        list.appendChild(row);
      }
      list.querySelectorAll('[data-buy]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const r = this.buyVehicle(btn.dataset.buy);
          if (r.ok) this.renderList(doc);
          else btn.textContent = r.reason;
        });
      });
    });
  }
}
