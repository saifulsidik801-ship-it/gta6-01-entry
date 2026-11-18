// Missions: the six-district turf spine plus side work (taxi fares, time trials,
// hidden shells). One counted spine — every mission captures one district, and
// capturing a district is what the HUD's turf counter and the income tick pay for.
import { MISSIONS, SIDE, DISTRICTS } from './config.js';
import { makeRng } from './random.js';

export function createMissions(G) {
  const rng = makeRng(555);
  const m = {
    current: 0, step: 0, kills: 0, timer: 0, spawned: false,
    taxi: null, trial: null,

    get def() { return MISSIONS[this.current] || null; },
    get stepDef() { const d = this.def; return d ? d.steps[this.step] : null; },
    get done() { return this.current >= MISSIONS.length; },

    stepTarget() {
      const s = this.stepDef;
      if (!s) return null;
      if (s.type === 'fight' || s.type === 'goto' || s.type === 'deliver') return { x: s.x, z: s.z };
      return null;
    },
    markerPos() {
      const t = this.stepTarget();
      if (t) return t;
      if (this.taxi) return this.taxi.picked ? { x: this.taxi.dx, z: this.taxi.dz } : { x: this.taxi.px, z: this.taxi.pz };
      if (this.trial) { const g = this.trial.gates[this.trial.idx]; return g ? { x: g.x, z: g.z } : null; }
      return null;
    },
    objective() {
      if (this.done) return 'Marisol Bay is yours — free roam. Q: taxi job · T: time trial · find ' + SIDE.SHELLS + ' shells.';
      const d = this.def, s = this.stepDef;
      let label = s.label;
      if (s.type === 'fight') label = s.label.replace(/\(\d+\/\d+\)/, '(' + this.kills + '/' + s.n + ')');
      if (s.type === 'deliver') label += ' — ' + Math.ceil(this.timer) + 's';
      return 'Mission ' + (this.current + 1) + '/6: ' + d.title + ' — ' + label;
    },

    startStep() {
      const s = this.stepDef;
      this.kills = 0; this.spawned = false;
      if (!s) return;
      if (s.type === 'deliver') this.timer = s.t;
      if (s.type === 'steal' && G.player.inCar) { G.hud.toast('Already rolling — nice.'); this.advance(); return; }
      if (s.type === 'fight') { G.combat.spawnGang(s.n, s.x, s.z); this.spawned = true; }
      G.hud.toast(this.def.title + ': ' + s.label);
    },
    advance() {
      this.step++;
      if (this.step >= this.def.steps.length) this.completeMission();
      else this.startStep();
    },
    completeMission() {
      const d = this.def;
      G.state.cash += d.reward;
      G.state.turf[d.district] = true;
      G.state.missionsDone++;
      G.police.addHeat(1);
      G.audio.mission();
      G.hud.toast('TURF TAKEN: ' + DISTRICTS[d.district].name + ' is yours! +$' + d.reward);
      G.save.save();
      this.current++;
      this.step = 0;
      if (this.done) {
        G.state.cash += 500;
        G.hud.toast('MARISOL BAY IS YOURS! Bonus +$500. The city answers to Milo now.');
        G.audio.mission();
      } else {
        G.hud.toast('Next: ' + MISSIONS[this.current].title + ' — ' + MISSIONS[this.current].brief);
        this.startStep();
      }
    },
    failStep(reason) {
      G.hud.toast('Too slow — ' + reason + ' Try the step again.');
      const s = this.stepDef;
      if (s && s.type === 'deliver') this.timer = s.t;
      if (s && s.type === 'fight') { G.combat.clearGang(); this.kills = 0; this.spawned = false; }
      this.startStep();
    },

    onEnterCar(car) {
      const s = this.stepDef;
      if (s && s.type === 'steal') { G.hud.toast('Got wheels.'); this.advance(); }
    },
    onGangKill() {
      const s = this.stepDef;
      if (s && s.type === 'fight') {
        this.kills++;
        if (this.kills >= s.n) this.advance();
      }
    },

    toggleTaxi() {
      if (this.taxi) { this.taxi = null; G.hud.toast('Taxi job off.'); return; }
      if (!G.player.inCar) { G.hud.toast('Get in a car first — then press Q for a fare.'); return; }
      const px = Math.round(G.player.x / 40) * 40 + (rng.chance(0.5) ? 40 : -40);
      const pz = Math.round(G.player.z / 40) * 40;
      const dx = Math.round(rng.rand(-200, 200) / 40) * 40;
      const dz = Math.round(rng.rand(-200, 200) / 40) * 40;
      this.taxi = { px, pz, dx, dz, t: SIDE.TAXI_TIME, picked: false };
      G.hud.toast('Taxi fare: pick up the rider at the marker.');
    },
    startTrial() {
      if (this.trial) return;
      if (!G.player.inCar) { G.hud.toast('Get in a car first — then press T for a time trial.'); return; }
      const gates = [];
      let gx = Math.round(G.player.x / 40) * 40, gz = Math.round(G.player.z / 40) * 40;
      for (let i = 0; i < SIDE.TRIAL_GATES; i++) {
        if (rng.chance(0.5)) gx += rng.pick([-80, 80]); else gz += rng.pick([-80, 80]);
        gx = Math.max(-240, Math.min(240, gx)); gz = Math.max(-240, Math.min(240, gz));
        gates.push({ x: gx, z: gz });
      }
      this.trial = { gates, idx: 0, t: 75 };
      G.hud.toast('Time trial: hit all ' + SIDE.TRIAL_GATES + ' gates in 75s! +$' + SIDE.TRIAL_REWARD);
    },

    update(dt) {
      if (G.state.mode !== 'playing') return;
      // Mission step progress.
      const s = this.stepDef;
      if (s) {
        const px = G.player.x, pz = G.player.z;
        if (s.type === 'goto') {
          if (Math.hypot(px - s.x, pz - s.z) < 5) { G.audio.pickup(); this.advance(); }
        } else if (s.type === 'deliver') {
          this.timer -= dt;
          if (Math.hypot(px - s.x, pz - s.z) < 5) { G.audio.pickup(); this.advance(); }
          else if (this.timer <= 0) this.failStep('the delivery timed out.');
        }
      }
      // Taxi fare.
      if (this.taxi) {
        const t = this.taxi;
        t.t -= dt;
        const tx = t.picked ? t.dx : t.px, tz = t.picked ? t.dz : t.pz;
        if (Math.hypot(G.player.x - tx, G.player.z - tz) < 5) {
          if (!t.picked) { t.picked = true; t.t = SIDE.TAXI_TIME; G.hud.toast('Rider aboard — drive to the dropoff!'); G.audio.pickup(); }
          else {
            G.state.cash += SIDE.TAXI_FARE;
            G.hud.toast('Fare complete! +$' + SIDE.TAXI_FARE);
            G.audio.mission(); this.taxi = null;
          }
        } else if (t.t <= 0) { G.hud.toast('Fare lost — the rider gave up.'); this.taxi = null; }
      }
      // Time trial gates.
      if (this.trial) {
        const tr = this.trial;
        tr.t -= dt;
        const g = tr.gates[tr.idx];
        if (g && Math.hypot(G.player.x - g.x, G.player.z - g.z) < 6) {
          tr.idx++;
          G.audio.pickup();
          if (tr.idx >= tr.gates.length) {
            G.state.cash += SIDE.TRIAL_REWARD;
            G.hud.toast('Time trial beaten! +$' + SIDE.TRIAL_REWARD);
            G.audio.mission(); this.trial = null;
          } else G.hud.toast('Gate ' + tr.idx + '/' + tr.gates.length);
        } else if (tr.t <= 0) { G.hud.toast('Time trial failed.'); this.trial = null; }
      }
      // Shells.
      for (const sh of G.world.shells) {
        if (sh.taken) continue;
        if (Math.hypot(G.player.x - sh.x, G.player.z - sh.z) < 1.8) {
          sh.taken = true; sh.mesh.visible = false;
          G.state.shells++;
          G.state.cash += SIDE.SHELL_CASH;
          G.audio.pickup();
          if (G.state.shells % 10 === 0) G.hud.toast('Shells ' + G.state.shells + '/' + SIDE.SHELLS + ' — +$' + SIDE.SHELL_CASH + ' each.');
        }
      }
      // Beacon follows the current marker.
      const mp = this.markerPos();
      if (mp) {
        G.world.beacon.visible = true;
        G.world.beacon.position.set(mp.x, 0, mp.z);
        G.world.beacon.rotation.y += dt * 0.8;
        const pulse = 1 + Math.sin(performance.now() / 300) * 0.12;
        G.world.beacon.scale.set(pulse, 1, pulse);
      } else G.world.beacon.visible = false;
    },
    // Restore progress from a save: re-mark districts, jump to the next mission.
    loadProgress(doneCount) {
      this.current = Math.min(doneCount, MISSIONS.length - 1);
      if (doneCount >= MISSIONS.length) this.current = MISSIONS.length;
      this.step = 0;
      if (!this.done) this.startStep();
    },
  };
  return m;
}
