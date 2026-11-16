'use strict';

/* Tutto l'audio è sintetizzato al volo con la Web Audio API:
   nessun file da scaricare, quindi funziona anche offline. */

const AudioSys = (() => {
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Due brani originali: uno solare per il tema chiaro, uno notturno per quello scuro.
  // Ogni battuta ha 8 crome; 0 = pausa. I numeri sono note MIDI.
  const SONGS = {
    light: {
      lead: 'square', leadVol: 0.075,
      bass: [48, 43, 45, 41],
      mel: [
        [76, 79, 84, 79, 76, 79, 84, 0],
        [74, 79, 83, 79, 74, 79, 83, 0],
        [72, 76, 81, 76, 72, 76, 81, 83],
        [84, 81, 77, 81, 79, 0, 76, 0],
        [76, 0, 79, 76, 84, 0, 83, 81],
        [79, 0, 83, 79, 86, 0, 84, 83],
        [81, 0, 84, 81, 88, 0, 86, 84],
        [81, 84, 89, 84, 83, 86, 91, 0],
      ],
    },
    dark: {
      lead: 'triangle', leadVol: 0.17,
      bass: [45, 41, 48, 43],
      mel: [
        [69, 72, 76, 72, 69, 72, 76, 0],
        [69, 72, 77, 72, 69, 72, 77, 0],
        [67, 72, 76, 72, 67, 72, 76, 79],
        [79, 74, 71, 74, 79, 0, 74, 0],
        [76, 0, 81, 76, 84, 0, 83, 81],
        [77, 0, 81, 77, 84, 0, 81, 77],
        [76, 0, 79, 76, 84, 0, 79, 76],
        [74, 79, 83, 86, 76, 80, 83, 0],
      ],
    },
  };

  let ctx = null, master, musicBus, musicFilter, sfxBus, noiseBuf;
  let musicOn = Store.get('music', true);
  let sfxOn = Store.get('sfx', true);
  let timer = null, step = 0, nextT = 0;
  let mode = 'title';      // title | game | over
  let song = 'light';
  let slow = false, boost = false, intensity = 0, paused = false;
  let overTimer = null;

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);

    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? 0.55 : 0;
    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 18000;
    musicBus.connect(musicFilter);
    musicFilter.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxOn ? 0.8 : 0;
    sfxBus.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  /** Da chiamare dentro un gesto dell'utente: i browser bloccano l'audio prima. */
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended' && !paused) ctx.resume();
    if (!timer) {
      nextT = ctx.currentTime + 0.08;
      timer = setInterval(tick, 25);
    }
  }

  function voice(bus, type, freq, t, dur, vol, slideTo) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  function noise(bus, t, dur, vol, filterType, freq) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  const bpm = () => {
    if (mode !== 'game') return 96;
    return (118 + 44 * intensity) * (slow ? 0.62 : 1) * (boost ? 1.1 : 1);
  };

  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    if (nextT < ctx.currentTime - 0.2) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.12) {
      if (mode !== 'over') schedule(step, nextT);
      nextT += 60 / bpm() / 4;
      step = (step + 1) % 128;
    }
  }

  function schedule(s, t) {
    const sg = SONGS[song];
    const bar = (s >> 4) % 8;
    const i = s & 15;
    const d = 60 / bpm() / 4;
    const game = mode === 'game';

    if (i % 2 === 0) {
      const n = sg.mel[bar][i >> 1];
      if (n) voice(musicBus, sg.lead, mtof(n + (boost ? 12 : 0)), t, d * (game ? 1.7 : 2.8), sg.leadVol * (game ? 1 : 0.75));
    }

    const root = sg.bass[bar % 4] + 12;
    if (game) {
      if (i % 2 === 0) voice(musicBus, 'triangle', mtof(root + (i % 4 === 2 ? 7 : 0)), t, d * 1.8, 0.2);
      if (i === 0 || i === 8 || (i === 11 && bar % 2 === 1)) {
        voice(musicBus, 'sine', 150, t, 0.13, 0.5, 42);
      }
      if (i === 4 || i === 12) noise(musicBus, t, 0.1, 0.16, 'bandpass', 1900);
      if (i % 2 === 0) noise(musicBus, t, 0.03, i % 4 === 2 ? 0.07 : 0.04, 'highpass', 7500);
      else if (intensity > 0.5) noise(musicBus, t, 0.02, 0.025, 'highpass', 8500);
    } else if (i % 8 === 0) {
      voice(musicBus, 'triangle', mtof(root), t, d * 7, 0.14);
    }
  }

  function setMode(m) {
    mode = m;
    clearTimeout(overTimer);
    if (m === 'over') overTimer = setTimeout(() => { if (mode === 'over') { mode = 'title'; step = 0; } }, 1600);
    if (m === 'game') step = 0;
  }

  function setSlow(on) {
    slow = on;
    if (ctx) musicFilter.frequency.setTargetAtTime(on ? 850 : 18000, ctx.currentTime, 0.08);
  }

  function setMusic(on) {
    musicOn = on;
    Store.set('music', on);
    if (ctx) musicBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.03);
  }

  function setSfx(on) {
    sfxOn = on;
    Store.set('sfx', on);
    if (ctx) sfxBus.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.02);
  }

  function suspend() { paused = true; if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { paused = false; if (ctx && ctx.state === 'suspended') ctx.resume(); }

  const ready = () => ctx && sfxOn && ctx.state === 'running';

  const sfx = {
    jump() { if (ready()) voice(sfxBus, 'square', 330, ctx.currentTime, 0.13, 0.1, 660); },
    land() { if (ready()) voice(sfxBus, 'triangle', 150, ctx.currentTime, 0.07, 0.14, 70); },
    spark(combo) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const base = 880 * Math.pow(2, Math.min(combo, 9) / 12);
      voice(sfxBus, 'square', base, t, 0.07, 0.08);
      voice(sfxBus, 'square', base * 1.5, t + 0.06, 0.11, 0.08);
    },
    hit() {
      if (!ready()) return;
      const t = ctx.currentTime;
      noise(sfxBus, t, 0.28, 0.4, 'lowpass', 1800);
      voice(sfxBus, 'sawtooth', 220, t, 0.42, 0.2, 50);
      [392, 330, 262, 196].forEach((f, i) => voice(sfxBus, 'square', f, t + 0.45 + i * 0.16, 0.2, 0.09));
    },
    milestone() {
      if (!ready()) return;
      const t = ctx.currentTime;
      voice(sfxBus, 'square', 784, t, 0.08, 0.08);
      voice(sfxBus, 'square', 1047, t + 0.09, 0.16, 0.08);
    },
    power() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => voice(sfxBus, 'square', f, t + i * 0.06, 0.12, 0.09));
    },
    shieldBreak() {
      if (!ready()) return;
      const t = ctx.currentTime;
      noise(sfxBus, t, 0.2, 0.3, 'highpass', 3000);
      voice(sfxBus, 'triangle', 700, t, 0.25, 0.2, 140);
    },
    smash() {
      if (!ready()) return;
      const t = ctx.currentTime;
      noise(sfxBus, t, 0.12, 0.25, 'bandpass', 1200);
      voice(sfxBus, 'square', 520, t, 0.1, 0.07, 1040);
    },
    secret() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [659, 784, 988, 1319].forEach((f, i) => voice(sfxBus, 'triangle', f, t + i * 0.08, 0.22, 0.2));
    },
    toggle() { if (ready()) voice(sfxBus, 'square', 620, ctx.currentTime, 0.05, 0.06); },
  };

  return {
    unlock, suspend, resume, sfx,
    setMode, setSlow, setMusic, setSfx,
    setSong(name) { song = name === 'dark' ? 'dark' : 'light'; },
    setBoost(on) { boost = on; },
    setIntensity(v) { intensity = clamp(v, 0, 1); },
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
  };
})();
