// MARISOL BAY — missions.js
// One job: the story. Six turf missions plus the finale, each a short
// chain of stages (go here, do this, hold the marker), plus the side
// loop: taxi fares, time trials and 30 golden collectibles. Taking a
// district pays income every minute and raises the heat — the turf
// spine the whole game hangs on.
import * as THREE from 'three';
import { MISSIONS, DISTRICTS, TAXI_FARE, TIME_TRIAL_REWARD, COLLECTIBLE_COUNT } from './config.js';
import { clamp } from './random.js';
import { addWanted } from './police.js';

export function createMissions(G) {
  const M = {
    current: null,      // { def, stage, timer, crew, marker, holdT }
    markerMesh: null,
    taxi: { active: false, px: 0, pz: 0, dx: 0, dz: 0, timer: 0, marker: null },
    trial: { active: false, gates: [], gateIndex: 0, timer: 0 },
  };

  // A tall golden beacon the player can see across the whole city.
  function makeMarker(x, z, color) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 40, 10, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
    beam.position.y = 20; g.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.4, 8, 24),
      new THREE.MeshBasicMaterial({ color }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.4; g.add(ring);
    g.position.set(x, 0, z);
    G.scene.add(g);
    return g;
  }

  M.start = (index) => {
    const def = MISSIONS[index];
    if (!def) return;
    if (M.markerMesh) { G.scene.remove(M.markerMesh); M.markerMesh = null; }
    const d = DISTRICTS[def.district];
    M.current = { def, stage: 0, timer: 0, crew: [], holdT: 0, district: d };
    M.markerMesh = makeMarker(d.cx, d.cz, d.color);
    G.missionIndex = index;
    G.hud.setObjective(`${def.name}: ${def.brief}`);
    G.hud.flash(`MISSION — ${def.name}`);
    G.audio.missionWin();
  };

  M.advance = () => {
    const m = M.current;
    if (!m) return;
    m.stage += 1;
    const d = m.district;
    if (m.def.id === 0) {
      // First Wheels: stage 1 = reach the Harbor Lights marker on foot or by car.
      G.hud.setObjective('Reach the Harbor Lights marker');
    } else if (m.def.id === 1) {
      m.timer = 75; // Marina Run: 75 seconds to cross the city
      G.hud.setObjective(`Drive to Old Marina — ${Math.ceil(m.timer)}s left`);
    } else if ([2, 3, 5, 6].includes(m.def.id)) {
      // Turf fights: a crew spawns to defend the district.
      const count = m.def.id === 6 ? 8 : 3 + m.def.id;
      m.crew = G.combat.spawnCrew(G, d.cx, d.cz, count, d.id);
      G.hud.setObjective(`Clear the ${d.boss} (${m.crew.length} left)`);
      addWanted(G, 1, 'turf war in progress');
    } else if (m.def.id === 4) {
      M.startTrial();
      G.hud.setObjective('Beach time trial: hit all 5 gates');
    }
  };

  M.complete = () => {
    const m = M.current;
    if (!m) return;
    G.cash += m.def.reward;
    G.audio.cash(); G.audio.missionWin();
    G.effects.cash(G.player.pos.x, 2, G.player.pos.z);
    if (m.def.id < 6) {
      G.turf[m.def.district] = true;
      G.missionsDone[m.def.id] = true;
      addWanted(G, 1, 'turf taken — the city noticed');
      G.hud.flash(`TURF TAKEN — ${m.district.name} pays $${m.district.income}/min. +$${m.def.reward}`);
    } else {
      G.missionsDone[6] = true;
      G.hud.flash(`KING OF THE BAY — Marisol Bay is yours. +$${m.def.reward}`);
    }
    if (M.markerMesh) { G.scene.remove(M.markerMesh); M.markerMesh = null; }
    M.current = null;
    G.hud.setObjective('Free roam — press M for the next mission');
    G.missionIndex = Math.min(m.def.id + 1, 6);
  };

  // --- side activities -------------------------------------------------------
  M.offerTaxi = () => {
    const t = M.taxi;
    if (t.active) return;
    const px = (G.rng() * 2 - 1) * 160, pz = (G.rng() * 2 - 1) * 160;
    const dx = (G.rng() * 2 - 1) * 160, dz = (G.rng() * 2 - 1) * 160;
    t.active = true; t.px = px; t.pz = pz; t.dx = dx; t.dz = dz; t.timer = 90; t.pickedUp = false;
    if (t.marker) G.scene.remove(t.marker);
    t.marker = makeMarker(px, pz, 0xffc21c);
    G.hud.setObjective(`Taxi fare: pick up the passenger (90s) — $${TAXI_FARE}`);
    G.hud.flash('Taxi fare available — drive a taxi to the yellow marker');
  };

  M.startTrial = () => {
    const tr = M.trial;
    tr.active = true; tr.gateIndex = 0; tr.timer = 60; tr.gates = [];
    const bx = DISTRICTS[4].cx, bz = DISTRICTS[4].cz;
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.35, 8, 24),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0x7dff6a : 0xffd23e }));
      ring.position.set(bx - 40 + i * 22, 2.2, bz + (i % 2 ? 14 : -14));
      G.scene.add(ring);
      tr.gates.push(ring);
    }
    G.hud.setObjective(`Time trial: gate 1/5 — ${Math.ceil(tr.timer)}s`);
  };

  M.update = (dt) => {
    // M key starts the next story mission; T starts a taxi fare.
    if (G.input.pressed('KeyM')) { if (!M.current) M.start(G.missionIndex); }
    if (G.input.pressed('KeyT')) M.offerTaxi();

    const m = M.current;
    if (m) {
      const d = m.district;
      const dist = Math.hypot(G.player.pos.x - d.cx, G.player.pos.z - d.cz);
      if (m.def.id === 0 && m.stage >= 1 && dist < 8) { M.complete(); return; }
      if (m.def.id === 1 && m.stage >= 1) {
        m.timer -= dt;
        G.hud.setObjective(`Drive to Old Marina — ${Math.max(0, Math.ceil(m.timer))}s left`);
        if (dist < 8) { M.complete(); return; }
        if (m.timer <= 0) { G.hud.flash('Too slow — the package moved on. Press M to retry'); M.current = null; if (M.markerMesh) { G.scene.remove(M.markerMesh); M.markerMesh = null; } }
      }
      if ([2, 3, 5, 6].includes(m.def.id) && m.stage >= 1) {
        const left = m.crew.filter((e) => e.alive).length;
        G.hud.setObjective(`Clear the ${d.boss} (${left} left)`);
        if (left === 0) {
          // hold the marker for 5 seconds to claim the turf
          if (dist < 9) {
            m.holdT += dt;
            G.hud.setObjective(`Hold the turf… ${Math.ceil(5 - m.holdT)}s`);
            if (m.holdT >= 5) { M.complete(); return; }
          } else m.holdT = 0;
        }
      }
      if (m.def.id === 4 && m.stage >= 1 && !M.trial.active) { M.complete(); return; }
    }

    // taxi fare state machine
    const t = M.taxi;
    if (t.active) {
      t.timer -= dt;
      const tx = t.pickedUp ? t.dx : t.px, tz = t.pickedUp ? t.dz : t.pz;
      const dist = Math.hypot(G.player.pos.x - tx, G.player.pos.z - tz);
      if (!t.pickedUp) G.hud.setObjective(`Taxi: pick up the passenger — ${Math.max(0, Math.ceil(t.timer))}s`);
      else G.hud.setObjective(`Taxi: drop off the passenger — ${Math.max(0, Math.ceil(t.timer))}s`);
      if (dist < 7) {
        if (!t.pickedUp) {
          t.pickedUp = true;
          if (t.marker) { G.scene.remove(t.marker); t.marker = makeMarker(t.dx, t.dz, 0x7dff6a); }
          G.audio.pickup(); G.hud.flash('Passenger aboard — drive!');
        } else {
          t.active = false;
          if (t.marker) { G.scene.remove(t.marker); t.marker = null; }
          G.cash += TAXI_FARE; G.stats.taxiFares += 1;
          G.audio.cash(); G.hud.flash(`Fare complete — +$${TAXI_FARE}`);
          G.hud.setObjective(M.current ? G.hud.objective : 'Free roam — press M for the next mission');
        }
      }
      if (t.timer <= 0 && t.active) {
        t.active = false;
        if (t.marker) { G.scene.remove(t.marker); t.marker = null; }
        G.hud.flash('Fare expired — the passenger walked away');
      }
    }

    // time trial gates
    const tr = M.trial;
    if (tr.active) {
      tr.timer -= dt;
      const gate = tr.gates[tr.gateIndex];
      if (gate) {
        const dist = Math.hypot(G.player.pos.x - gate.position.x, G.player.pos.z - gate.position.z);
        if (dist < 5) {
          G.audio.pickup();
          G.scene.remove(gate);
          tr.gateIndex += 1;
          if (tr.gateIndex >= tr.gates.length) {
            tr.active = false;
            G.cash += TIME_TRIAL_REWARD; G.stats.trialsWon += 1;
            G.audio.cash();
            G.hud.flash(`Time trial won — +$${TIME_TRIAL_REWARD}`);
            if (M.current && M.current.def.id === 4) { M.complete(); return; }
          } else {
            tr.gates[tr.gateIndex].material.color.setHex(0x7dff6a);
            G.hud.setObjective(`Time trial: gate ${tr.gateIndex + 1}/5 — ${Math.max(0, Math.ceil(tr.timer))}s`);
          }
        }
      }
      if (tr.timer <= 0 && tr.active) {
        tr.active = false;
        for (const g2 of tr.gates) G.scene.remove(g2);
        G.hud.flash('Time trial failed — press T to try a taxi instead');
      }
    }

    // collectibles: golden orbs, walk through to grab
    for (let i = 0; i < G.world.collectibles.length; i++) {
      const c = G.world.collectibles[i];
      if (c.taken || G.collected[i]) continue;
      const d = Math.hypot(G.player.pos.x - c.x, G.player.pos.z - c.z);
      if (d < 2.2) {
        c.taken = true; G.collected[i] = true; c.mesh.visible = false;
        G.cash += 50; G.audio.pickup();
        G.effects.cash(c.x, 2, c.z);
        const got = G.collected.filter(Boolean).length;
        G.hud.flash(`Golden shell ${got}/${COLLECTIBLE_COUNT} — +$50`);
        if (got === COLLECTIBLE_COUNT) { G.cash += 1000; G.hud.flash('ALL SHELLS — beachcomber bonus +$1000'); }
      } else {
        c.mesh.position.y = 1.4 + Math.sin(G.time * 2 + i) * 0.3; // bobbing, easy to spot
        c.mesh.rotation.y += dt;
      }
    }
  };
  return M;
}
