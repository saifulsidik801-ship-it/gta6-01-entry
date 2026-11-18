// Marisol Bay — missions, turf and side activities.
// One clear job: the counted spine — 6 story missions, turf takeovers that
// pay income, taxi fares, time trials and 30 collectibles. Owns the mission
// state machine and the beacon/marker the HUD and minimap read.
import { CONFIG, districtAt } from './config.js';
import { spawnRivals, clearEnemies } from './combat.js';
import { makeCollectibleMesh } from './world.js';
import { mulberry32, range } from './random.js';

export function createMissions(G) {
  return {
    index: G.save.missionIndex || 0,
    step: G.save.missionStep || 0,
    stepT: 0,          // time spent in the current step
    done: (G.save.missionIndex || 0) >= CONFIG.missions.length,
    taxi: null,        // active fare {x,z,tx,tz,timer,passenger}
    trial: null,       // active time trial {gates:[],gateIndex,timer}
    collectibles: [],  // meshes + taken flags
    turfIncomeT: 0,
    message: '',
    messageT: 0,
  };
}

export function currentMission(G) {
  const m = G.missions;
  if (m.done) return null;
  return CONFIG.missions[m.index];
}

export function currentStep(G) {
  const mission = currentMission(G);
  if (!mission) return null;
  return mission.steps[G.missions.step];
}

export function missionObjective(G) {
  const mission = currentMission(G);
  if (!mission) {
    if (G.missions.taxi) return `Taxi fare — drop off in ${Math.ceil(G.missions.taxi.timer)}s`;
    if (G.missions.trial) return `Time trial — gate ${G.missions.trial.gateIndex + 1}/${G.missions.trial.gates.length}`;
    return 'Free roam — take turf, run fares, find the gold coins (30)';
  }
  const step = currentStep(G);
  if (!step) return mission.name;
  return `${mission.name}: ${step.label}`;
}

export function missionMarker(G) {
  const step = currentStep(G);
  if (step) return { x: step.x, z: step.z };
  if (G.missions.taxi) return { x: G.missions.taxi.tx, z: G.missions.taxi.tz };
  if (G.missions.trial) {
    const g = G.missions.trial.gates[G.missions.trial.gateIndex];
    if (g) return { x: g.x, z: g.z };
  }
  return null;
}

function setBeaconForStep(G) {
  const marker = missionMarker(G);
  if (marker) G.world.setBeacon(marker.x, marker.z, true);
  else G.world.setBeacon(0, 0, false);
}

export function startMissionStep(G) {
  const step = currentStep(G);
  const m = G.missions;
  m.stepT = 0;
  clearEnemies(G);
  if (!step) return;
  if (step.type === 'clear') {
    spawnRivals(G, step.x, step.z, step.count || 4);
  }
  if (step.wanted) G.police.addWanted(G, step.wanted, 'Heat on the run');
  setBeaconForStep(G);
  G.hud.toast(`${currentMission(G).name} — ${step.label}`);
}

function completeMission(G) {
  const mission = currentMission(G);
  const m = G.missions;
  G.cash += mission.reward;
  G.save.cash = G.cash;
  G.save.stats.missionsDone++;
  if (!G.save.turf.includes(mission.district)) {
    G.save.turf.push(mission.district);
    G.hud.toast(`TURF TAKEN — ${districtName(mission.district)} pays $${CONFIG.districts.find((d) => d.id === mission.district).income}/min`);
  }
  G.hud.toast(`MISSION COMPLETE — ${mission.name} +$${mission.reward}`);
  G.audio.cash();
  m.index++;
  m.step = 0;
  m.done = m.index >= CONFIG.missions.length;
  G.save.missionIndex = m.index;
  G.save.missionStep = 0;
  clearEnemies(G);
  if (m.done) {
    G.hud.toast('KING OF THE BAY — every district is yours. Free roam!');
  } else {
    startMissionStep(G);
  }
  setBeaconForStep(G);
}

export function districtName(id) {
  const d = CONFIG.districts.find((x) => x.id === id);
  return d ? d.name : id;
}

function advanceStep(G) {
  const m = G.missions;
  const mission = currentMission(G);
  m.step++;
  G.save.missionStep = m.step;
  if (m.step >= mission.steps.length) completeMission(G);
  else startMissionStep(G);
}

function playerPos(G) {
  const p = G.player;
  return p.onFoot ? p.pos : (p.vehicle ? p.vehicle.pos : p.pos);
}

export function updateMissions(G, dt) {
  const m = G.missions;
  m.stepT += dt;
  if (m.messageT > 0) m.messageT -= dt;

  // --- Story step progress.
  const step = currentStep(G);
  if (step) {
    const pos = playerPos(G);
    const dx = pos.x - step.x; const dz = pos.z - step.z;
    const dist = Math.hypot(dx, dz);
    if (step.type === 'goto' || step.type === 'drive') {
      if (dist < 9) advanceStep(G);
    } else if (step.type === 'steal') {
      if (!G.player.onFoot && G.player.vehicle && dist < 12) advanceStep(G);
    } else if (step.type === 'clear') {
      const alive = G.combat.enemies.filter((e) => e.alive).length;
      if (alive === 0) advanceStep(G);
    } else if (step.type === 'turf') {
      if (dist < 8) {
        if (!m._turfT) m._turfT = 0;
        m._turfT += dt;
        if (m._turfT > 3) { m._turfT = 0; advanceStep(G); }
      } else m._turfT = 0;
    } else if (step.type === 'escape') {
      if (G.wanted === 0 && dist < 12) advanceStep(G);
    }
  }

  // --- Taxi fares: press T to take a fare while driving; also auto-offered
  // once the story is done and the player is driving.
  if (G.input.taxi && !m.taxi && G.player.vehicle) startTaxi(G);
  if (G.input.trial && !m.trial) startTimeTrial(G);
  if (!m.taxi && m.done && Math.random() < dt * 0.02 && G.player.vehicle) {
    startTaxi(G);
  }
  if (m.taxi) {
    const t = m.taxi;
    t.timer -= dt;
    const pos = playerPos(G);
    const dx = pos.x - t.tx; const dz = pos.z - t.tz;
    if (Math.hypot(dx, dz) < 9) {
      G.cash += CONFIG.taxiFare;
      G.save.cash = G.cash;
      G.save.stats.fares++;
      G.hud.toast(`Fare complete +$${CONFIG.taxiFare}`);
      G.audio.cash();
      m.taxi = null;
      setBeaconForStep(G);
    } else if (t.timer <= 0) {
      G.hud.toast('Fare cancelled — too slow');
      m.taxi = null;
      setBeaconForStep(G);
    }
  }

  // --- Time trial: drive through the gates before the timer ends.
  if (m.trial) {
    const tr = m.trial;
    tr.timer -= dt;
    const pos = playerPos(G);
    const gate = tr.gates[tr.gateIndex];
    if (gate && Math.hypot(pos.x - gate.x, pos.z - gate.z) < 10) {
      tr.gateIndex++;
      G.audio.blip(660, 0.1, 'sine', 0.2);
      if (tr.gateIndex >= tr.gates.length) {
        G.cash += CONFIG.timeTrialReward;
        G.save.cash = G.cash;
        G.hud.toast(`Time trial beaten +$${CONFIG.timeTrialReward}`);
        G.audio.cash();
        m.trial = null;
        setBeaconForStep(G);
      } else setBeaconForStep(G);
    }
    if (tr.timer <= 0) {
      G.hud.toast('Time trial failed');
      m.trial = null;
      setBeaconForStep(G);
    }
  }

  // --- Collectibles: gold coins, spin and bob; walking or driving over one takes it.
  const pos = playerPos(G);
  for (const c of m.collectibles) {
    if (c.taken) continue;
    c.mesh.rotation.y += dt * 2;
    c.mesh.position.y = 1.6 + Math.sin(performance.now() / 300 + c.phase) * 0.3;
    if (Math.hypot(pos.x - c.mesh.position.x, pos.z - c.mesh.position.z) < 3) {
      c.taken = true;
      c.mesh.visible = false;
      G.cash += 25;
      G.save.cash = G.cash;
      if (!G.save.collectibles.includes(c.id)) G.save.collectibles.push(c.id);
      G.audio.cash();
      G.hud.toast(`Gold coin +$25 (${G.save.collectibles.length}/${CONFIG.collectibleCount})`);
    }
  }

  // --- Turf income: owned districts pay every 60 s.
  m.turfIncomeT += dt;
  if (m.turfIncomeT > 60 && G.save.turf.length > 0) {
    m.turfIncomeT = 0;
    let pay = 0;
    for (const id of G.save.turf) {
      const d = CONFIG.districts.find((x) => x.id === id);
      if (d) pay += d.income;
    }
    G.cash += pay;
    G.save.cash = G.cash;
    G.hud.toast(`Turf income +$${pay}`);
  }
}

export function startTaxi(G) {
  const pos = playerPos(G);
  const tx = pos.x + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 120);
  const tz = pos.z + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 120);
  G.missions.taxi = {
    tx: Math.max(-280, Math.min(280, tx)),
    tz: Math.max(-280, Math.min(280, tz)),
    timer: 75,
  };
  G.hud.toast('Taxi fare — passenger waiting, drive to the marker');
  setBeaconForStep(G);
}

export function startTimeTrial(G) {
  const pos = playerPos(G);
  const gates = [];
  for (let i = 1; i <= 5; i++) {
    gates.push({
      x: Math.max(-280, Math.min(280, pos.x + (Math.random() - 0.5) * 320)),
      z: Math.max(-280, Math.min(280, pos.z + (Math.random() - 0.5) * 320)),
    });
  }
  G.missions.trial = { gates, gateIndex: 0, timer: 90 };
  G.hud.toast('Time trial — hit all 5 gates in 90 seconds');
  setBeaconForStep(G);
}

// Scatter the 30 gold coins (seeded so shots are reproducible).
export function spawnCollectibles(G, seed) {
  const rng = mulberry32(seed + 7);
  const m = G.missions;
  for (let i = 0; i < CONFIG.collectibleCount; i++) {
    const x = Math.round(range(rng, -280, 280) / 10) * 10;
    const z = Math.round(range(rng, -280, 280) / 10) * 10;
    const mesh = makeCollectibleMesh(x, z);
    const taken = G.save.collectibles.includes(i);
    mesh.visible = !taken;
    G.scene.add(mesh);
    m.collectibles.push({ id: i, mesh, taken, phase: rng() * 6 });
  }
}
