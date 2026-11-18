// MARISOL BAY — audio.js
// One job: every sound in the game, synthesized live with WebAudio.
// No audio files exist; the engine hum, sirens, gunshots, punches,
// pickup chimes and the bassline are all oscillators and noise.
// Audio starts only after the first user gesture (browser rule).
export function createAudio() {
  const A = {
    ctx: null, master: null, musicGain: null, engineOsc: null, engineGain: null,
    enabled: true, musicOn: true, step: 0, musicTimer: null, started: false,
  };

  A.ensure = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = A.ctx.createGain(); A.master.gain.value = 0.5; A.master.connect(A.ctx.destination);
      A.musicGain = A.ctx.createGain(); A.musicGain.gain.value = 0.16; A.musicGain.connect(A.master);
      // Engine hum: a sawtooth whose pitch follows the car's speed.
      A.engineOsc = A.ctx.createOscillator(); A.engineOsc.type = 'sawtooth'; A.engineOsc.frequency.value = 55;
      const lp = A.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      A.engineGain = A.ctx.createGain(); A.engineGain.gain.value = 0;
      A.engineOsc.connect(lp); lp.connect(A.engineGain); A.engineGain.connect(A.master);
      A.engineOsc.start();
      A.started = true;
      A.startMusic();
    } catch (err) { A.ctx = null; }
  };

  A.setEngine = (speed01, driving) => {
    if (!A.ctx || !A.engineGain) return;
    const target = driving ? 0.05 + speed01 * 0.11 : 0;
    A.engineGain.gain.setTargetAtTime(A.enabled ? target : 0, A.ctx.currentTime, 0.08);
    A.engineOsc.frequency.setTargetAtTime(50 + speed01 * 160, A.ctx.currentTime, 0.05);
  };

  A.blip = (freq, dur, type, vol, slideTo) => {
    if (!A.ctx || !A.enabled) return;
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator(); const g = A.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
  };

  A.noise = (dur, vol, filterFreq) => {
    if (!A.ctx || !A.enabled) return;
    const t = A.ctx.currentTime;
    const len = Math.floor(A.ctx.sampleRate * dur);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource(); src.buffer = buf;
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1800;
    const g = A.ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(A.master); src.start(t);
  };

  A.shot = () => { A.noise(0.14, 0.5, 2600); A.blip(180, 0.08, 'square', 0.25, 60); };
  A.punch = () => { A.noise(0.1, 0.35, 500); A.blip(90, 0.1, 'sine', 0.4, 45); };
  A.pickup = () => { A.blip(660, 0.09, 'sine', 0.25); setTimeout(() => A.blip(990, 0.14, 'sine', 0.25), 90); };
  A.cash = () => { A.blip(880, 0.08, 'sine', 0.22); setTimeout(() => A.blip(1174, 0.12, 'sine', 0.22), 80); setTimeout(() => A.blip(1568, 0.16, 'sine', 0.2), 160); };
  A.siren = () => { A.blip(720, 0.32, 'triangle', 0.12, 980); setTimeout(() => A.blip(980, 0.32, 'triangle', 0.12, 720), 330); };
  A.crash = () => { A.noise(0.3, 0.45, 900); A.blip(70, 0.25, 'sine', 0.4, 35); };
  A.horn = () => { A.blip(370, 0.18, 'square', 0.12); A.blip(466, 0.18, 'square', 0.1); };
  A.busted = () => { A.blip(220, 0.5, 'sawtooth', 0.2, 110); setTimeout(() => A.blip(165, 0.7, 'sawtooth', 0.2, 82), 400); };
  A.missionWin = () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.blip(f, 0.22, 'sine', 0.25), i * 120)); };

  // A lazy sunset bassline: Am – F – C – G roots with a soft pluck on top.
  // It loops on a timer and stays quiet enough to sit under the sirens.
  const BASS = [55, 43.65, 65.41, 49];
  const PLUCK = [220, 261.6, 329.6, 392, 440, 329.6, 261.6, 196];
  A.startMusic = () => {
    if (!A.ctx || A.musicTimer) return;
    A.musicTimer = setInterval(() => {
      if (!A.ctx || !A.musicOn || !A.enabled) return;
      const bar = A.step % 4;
      A.blip(BASS[bar], 0.9, 'triangle', 0.5);
      if (A.step % 2 === 0) A.blip(PLUCK[(A.step * 3) % PLUCK.length], 0.25, 'sine', 0.16);
      A.step++;
    }, 500);
  };
  A.toggleMusic = () => { A.musicOn = !A.musicOn; return A.musicOn; };
  A.toggleSound = () => { A.enabled = !A.enabled; if (A.master) A.master.gain.value = A.enabled ? 0.5 : 0; return A.enabled; };
  return A;
}
