// Marisol Bay — procedural sound, no audio assets.
// One clear job: every sound is synthesized with WebAudio: engine hum,
// police siren, gunshots, pickups and a low-key coastal music loop.
export function createAudio() {
  const audio = {
    ctx: null, master: null, muted: false, musicTimer: null,
    engineOsc: null, engineGain: null, engineFilter: null,
    sirenOsc: null, sirenGain: null, sirenLfo: null,
    _musicStep: 0,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.startMusic();
      return true;
    } catch {
      return false;
    }
  };

  audio.setMuted = (m) => {
    audio.muted = m;
    if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
  };

  function noiseBuffer(duration) {
    const len = Math.floor(audio.ctx.sampleRate * duration);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  audio.blip = (freq, dur = 0.12, type = 'sine', vol = 0.25) => {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(audio.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  };

  audio.shot = () => {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const src = audio.ctx.createBufferSource();
    src.buffer = noiseBuffer(0.14);
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1800;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(filter); filter.connect(gain); gain.connect(audio.master);
    src.start(t);
    audio.blip(160, 0.08, 'square', 0.15);
  };

  audio.thud = () => audio.blip(70, 0.18, 'triangle', 0.4);

  audio.cash = () => { audio.blip(880, 0.09, 'sine', 0.2); setTimeout(() => audio.blip(1320, 0.14, 'sine', 0.2), 90); };

  audio.siren = (on) => {
    if (!audio.ctx) return;
    if (on && !audio.sirenOsc) {
      const t = audio.ctx.currentTime;
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenOsc.frequency.value = 750;
      audio.sirenLfo = audio.ctx.createOscillator();
      audio.sirenLfo.type = 'square'; audio.sirenLfo.frequency.value = 0.55;
      const lfoGain = audio.ctx.createGain(); lfoGain.gain.value = 220;
      audio.sirenLfo.connect(lfoGain); lfoGain.connect(audio.sirenOsc.frequency);
      audio.sirenGain = audio.ctx.createGain(); audio.sirenGain.gain.value = 0.05;
      audio.sirenOsc.connect(audio.sirenGain); audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start(t); audio.sirenLfo.start(t);
    } else if (!on && audio.sirenOsc) {
      try { audio.sirenOsc.stop(); audio.sirenLfo.stop(); } catch { /* ignore */ }
      audio.sirenOsc = null; audio.sirenLfo = null; audio.sirenGain = null;
    }
  };

  // Engine hum follows the driven car's speed (0..1).
  audio.engine = (amount, running) => {
    if (!audio.ctx) return;
    if (running && !audio.engineOsc) {
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineFilter = audio.ctx.createBiquadFilter();
      audio.engineFilter.type = 'lowpass'; audio.engineFilter.frequency.value = 420;
      audio.engineGain = audio.ctx.createGain(); audio.engineGain.gain.value = 0.0;
      audio.engineOsc.connect(audio.engineFilter);
      audio.engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
    }
    if (audio.engineOsc) {
      const t = audio.ctx.currentTime;
      audio.engineOsc.frequency.setTargetAtTime(50 + amount * 130, t, 0.08);
      audio.engineGain.gain.setTargetAtTime(running ? 0.05 + amount * 0.06 : 0, t, 0.1);
    }
  };

  // Simple coastal-night loop: Am – F – C – G pad, one chord per bar.
  audio.startMusic = () => {
    if (audio.musicTimer || !audio.ctx) return;
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
    audio.musicTimer = setInterval(() => {
      if (audio.muted || !audio.ctx || document.hidden) return;
      const chord = chords[audio._musicStep % chords.length];
      audio._musicStep++;
      const t = audio.ctx.currentTime;
      for (const f of chord) {
        const osc = audio.ctx.createOscillator();
        osc.type = 'triangle'; osc.frequency.value = f / 2;
        const gain = audio.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.045, t + 0.4);
        gain.gain.linearRampToValueAtTime(0.0001, t + 1.9);
        osc.connect(gain); gain.connect(audio.master);
        osc.start(t); osc.stop(t + 2);
      }
    }, 2000);
  };

  return audio;
}
