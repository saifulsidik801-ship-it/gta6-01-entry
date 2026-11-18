// Audio — 100% procedural WebAudio. No audio assets: engine hum follows
// speed, a two-tone siren follows wanted level, gunshots are noise bursts,
// and a lazy bassline + hats loop plays as the Bay's radio. Starts on the
// first user gesture; shot mode stays silent (no gesture in headless).
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.muted = false;
    this.volume = 0.5;
    this.step = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    // engine: sawtooth through a lowpass, pitch follows speed
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filt).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
    // siren: square wave alternating 660/880 Hz
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    this.startMusic();
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }
  setVolume(v) {
    this.volume = v;
    if (this.master && !this.muted) this.master.gain.value = v;
  }

  // per-frame: engine pitch from speed, siren on/off from wanted
  update(speed, wanted, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.05 + Math.min(0.12, Math.abs(speed) / 400) : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 2.4, t, 0.08);
    if (wanted > 0) {
      this.sirenGain.gain.setTargetAtTime(0.045, t, 0.2);
      this.sirenOsc.frequency.setTargetAtTime((Math.floor(t * 2.4) % 2 ? 880 : 660), t, 0.05);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.2);
    }
  }

  blip(freq = 660, dur = 0.08, type = 'sine', vol = 0.12) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  noiseBurst(dur = 0.16, vol = 0.3, lowpass = 1200) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = lowpass;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(filt).connect(g).connect(this.master);
    src.start();
  }

  shot() { this.noiseBurst(0.14, 0.35, 2600); this.blip(180, 0.06, 'square', 0.1); }
  enemyShot() { this.noiseBurst(0.1, 0.12, 1800); }
  hit() { this.blip(120, 0.15, 'sawtooth', 0.18); }
  pickup() { this.blip(880, 0.08); setTimeout(() => this.blip(1320, 0.1), 70); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.16), i * 110)); }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'triangle', 0.2), i * 160)); }

  // Lazy bassline: A minor walk, 8th notes at 96 BPM, plus a hat tick.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const f = bass[this.step % bass.length];
      this.step++;
      if (f) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.11, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);
        o.connect(g).connect(this.master);
        o.start(); o.stop(this.ctx.currentTime + 0.3);
      }
      if (this.step % 2 === 0) this.noiseBurst(0.03, 0.03, 6000);
    }, 312);
  }
}
