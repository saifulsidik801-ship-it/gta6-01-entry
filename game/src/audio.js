// Procedural WebAudio only — no audio assets. Engine hum follows speed, a
// two-tone siren runs while wanted, and a tiny bassline loop plays as music.
// Everything is guarded: no AudioContext exists until the player first interacts.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHigh = false;
  let musicGain = null, musicTimer = 0, musicStep = 0, muted = false;

  // A simple bassline loop in A minor; step = eighth note at 112 BPM.
  const BASS = [55, 0, 55, 65.41, 55, 0, 82.41, 73.42, 55, 0, 55, 65.41, 98, 82.41, 73.42, 65.41];
  const LEAD = [220, 0, 261.63, 0, 329.63, 0, 261.63, 220, 196, 0, 220, 261.63, 329.63, 392, 329.63, 261.63];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      return true;
    } catch { ctx = null; return false; }
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  function noise(dur, vol, low) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1200;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    get muted() { return muted; },
    engine(speed01, on) {
      if (!ctx) return;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, ctx.currentTime, 0.08);
    },
    siren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
    },
    shoot() { noise(0.14, 0.5, 2600); tone(180, 0.09, 'square', 0.22, 60); },
    punch() { noise(0.08, 0.3, 700); },
    pickup() { tone(880, 0.12, 'sine', 0.3); tone(1320, 0.16, 'sine', 0.25); },
    blip() { tone(660, 0.07, 'sine', 0.2); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.3), i * 110)); },
    busted() { tone(392, 0.4, 'sawtooth', 0.25, 196); },
    update(dt, wanted) {
      if (!ctx) return;
      // Siren wail: alternate tone every 0.45 s while wanted.
      sirenTimer += dt;
      if (sirenTimer > 0.45) {
        sirenTimer = 0; sirenHigh = !sirenHigh;
        if (wanted > 0) sirenOsc.frequency.setTargetAtTime(sirenHigh ? 920 : 700, ctx.currentTime, 0.05);
      }
      // Music: one bass + lead note per eighth note.
      musicTimer += dt;
      const stepDur = 60 / 112 / 2;
      if (musicTimer >= stepDur) {
        musicTimer -= stepDur;
        const i = musicStep % 16; musicStep++;
        const b = BASS[i];
        if (b) tone(b, stepDur * 0.95, 'triangle', 0.5);
        const l = LEAD[i];
        if (l && musicStep % 32 > 15) tone(l, stepDur * 0.9, 'sine', 0.12);
      }
    },
  };
}
