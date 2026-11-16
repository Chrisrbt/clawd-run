'use strict';

const Game = (() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const FONT = 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace';
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  const H = 300, GY = 252, PX = 4;
  const START_SPEED = 330, ACCEL = 5.2;
  const GRAVITY = 2300, JUMP_V = 760;
  const HATS = ['none', 'party', 'crown', 'cowboy', 'tophat', 'prop'];
  const GLYPHS = ['{ }', '</>', '//', ';', '=>', '[ ]', '&&', '!=', '#'];
  const CONFETTI = ['#D97757', '#E3A008', '#5E8C4E', '#3B7EA1', '#E0527A', '#9B6BD6'];

  const DEATH = {
    any: [
      "You're absolutely right! Quello era un ostacolo.",
      'Funzionava sulla mia macchina.',
      'Non è un bug, è una feature non documentata.',
      'git blame dice che è colpa tua.',
      'Ctrl+Z non funziona nella vita reale.',
      'Context window: piena di rimpianti.',
      'Lasciami ragionare passo passo… ahia.',
      'Segmentation fault (core dumped).',
      'Ho finito i token. E anche le gambe.',
      'Stack overflow. Letteralmente.',
    ],
    bug: ['Un bug in produzione. Di venerdì sera.', 'Era segnato come "won\'t fix".', 'Bug riprodotto con successo.'],
    fly: ['Bug volante: nessun test lo copriva.', 'Quello non era nei requisiti.'],
    win: ['Errore non gestito. Come sempre.', 'Hai provato a spegnere e riaccendere?', 'Uncaught Exception: Clawd.'],
    sign: ['Ostacolo non trovato. Ah no, trovato.', 'undefined is not a function.', 'Il cartello diceva tutto.'],
  };

  const MILESTONES = {
    250: 'Riscaldamento completato',
    500: 'Marcia Haiku: veloce',
    1500: 'Marcia Sonnet: più veloce',
    2500: 'Marcia Opus: buona fortuna',
    5000: 'Ok, adesso stai esagerando',
  };

  /* ---------- eventi verso l'esterno (UI ed easter egg) ---------- */
  const listeners = {};
  const on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  const emit = (evt, ...args) => { (listeners[evt] || []).forEach((fn) => fn(...args)); };

  /* ---------- stato ---------- */
  let W = 900, scale = 1, dpr = 1;
  let state = 'title'; // title | playing | paused | over
  let themeTarget = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
  let themeT = themeTarget;
  let pal = mixPalette(themeT);

  let time = 0, scroll = 0;
  let speed = 0, dist = 0, bonus = 0, score = 0;
  let hi = Store.get('hi', 0);
  let newRecord = false;
  let overT = 0, overMsg = '';
  let idleT = 0, sleeping = false, zT = 0;
  let jumpHeld = false, jumpBuffer = 0;
  let shield = false, slowT = 0, opusT = 0;
  let combo = 0, comboT = 0;
  let hudFlash = 0, shake = 0, squish = 0, flash = 0;
  let matrix = false;
  let glitch = null, banner = null, bubble = null;
  let nextObstacle = 0, nextSparks = 0, nextPower = 0;

  const obstacles = [], pickups = [], particles = [], meteors = [];
  const player = {
    x: 64, y: 0, vy: 0, ground: true, duck: false, wantDuck: false,
    anim: 0, airT: 0, invuln: 0, hat: Store.get('hat', 'none'),
  };

  const clouds = Array.from({ length: 6 }, (_, i) => ({
    x: i * 190 + rand(0, 90), y: rand(26, 120), s: rand(0.7, 1.3),
  }));
  const stars = Array.from({ length: 70 }, () => ({
    x: Math.random(), y: rand(8, 170), r: Math.random() < 0.2 ? 2 : 1, ph: rand(0, 6.28),
  }));
  const rain = Array.from({ length: 80 }, () => ({ y: rand(0, H), v: rand(60, 170), seed: rand(0, 100) }));

  const sunPos = () => ({ x: W - 150, y: 64 });

  /* ---------- layout ---------- */
  function resize() {
    const cssW = stage.clientWidth || 900;
    scale = clamp(cssW / 900, 0.5, 1.25);
    W = Math.round(cssW / scale);
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.height = Math.round(H * scale) + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(H * scale * dpr);
  }

  /* ---------- disegno: utilità ---------- */
  function text(str, x, y, size, color, align, weight) {
    ctx.font = `${weight || 700} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function hash(n, s) {
    const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453;
    return v - Math.floor(v);
  }

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  /* ---------- particelle ---------- */
  function burst(x, y, color, n, spd) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y, vx: rand(-spd, spd), vy: rand(-spd, spd * 0.3), g: 520,
        life: rand(0.3, 0.75), t: 0, size: rand(2, 5), color,
      });
    }
  }

  function floatText(str, x, y, color) {
    particles.push({ x, y, vx: 0, vy: -46, g: 0, life: 0.8, t: 0, text: str, color });
  }

  function dust() {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: player.x + rand(10, 46), y: GY - 2, vx: rand(-60, 20), vy: rand(-50, -10), g: 200,
        life: rand(0.2, 0.4), t: 0, size: rand(2, 4), color: 'soft',
      });
    }
  }

  function confetti() {
    for (let i = 0; i < 110; i++) {
      particles.push({
        x: rand(0, W), y: rand(-80, 0), vx: rand(-40, 40), vy: rand(40, 160), g: 120,
        life: rand(1.6, 3), t: 0, size: rand(3, 6), color: pick(CONFETTI),
      });
    }
  }

  /* ---------- messaggi sopra il gioco ---------- */
  const say = (str, sec) => { bubble = { text: str, t: sec || 2.4 }; };
  const showBanner = (str, sec) => { banner = { text: str, t: 0, dur: sec || 2.6 }; };

  /* ---------- flusso di gioco ---------- */
  function start() {
    obstacles.length = 0; pickups.length = 0; particles.length = 0; meteors.length = 0;
    speed = START_SPEED; dist = 0; bonus = 0; score = 0; newRecord = false;
    shield = false; slowT = 0; combo = 0; comboT = 0;
    Object.assign(player, { y: 0, vy: 0, ground: true, duck: false, invuln: 0, airT: 0 });
    nextObstacle = 220; nextSparks = 420; nextPower = rand(14, 22);
    sleeping = false; idleT = 0; glitch = null; banner = null;
    state = 'playing';
    AudioSys.setSlow(false);
    AudioSys.setIntensity(0);
    AudioSys.setBoost(opusT > 0);
    AudioSys.setMode('game');
    emit('start');
  }

  function die(o) {
    state = 'over';
    overT = 0; shake = 0.3; flash = 0.14;
    if (score > hi) { hi = score; newRecord = true; Store.set('hi', hi); }
    overMsg = Math.random() < 0.45 && DEATH[o.kind] ? pick(DEATH[o.kind]) : pick(DEATH.any);
    opusT = 0; slowT = 0; bubble = null;
    AudioSys.sfx.hit();
    AudioSys.setSlow(false);
    AudioSys.setBoost(false);
    AudioSys.setMode('over');
    burst(player.x + 28, GY - player.y - 20, 'clawd', 14, 190);
    emit('over', score, o.kind);
  }

  function togglePause() {
    if (state === 'playing') { state = 'paused'; AudioSys.suspend(); emit('pause', true); }
    else if (state === 'paused') { state = 'playing'; AudioSys.resume(); emit('pause', false); }
  }

  function wake() {
    idleT = 0;
    if (sleeping) { sleeping = false; say('Eh? Ero sveglissimo.'); }
  }

  function pressJump() {
    AudioSys.unlock();
    if (state === 'title') { start(); return; }
    if (state === 'over') { if (overT > 0.6) start(); return; }
    if (state === 'paused') { togglePause(); return; }
    jumpHeld = true;
    jumpBuffer = 0.12;
  }

  function releaseJump() { jumpHeld = false; }
  function setDuck(v) { player.wantDuck = v; }

  /* ---------- generazione del mondo ---------- */
  const rectOf = (o) => ({
    x: o.x + o.inset[0], y: o.y + o.inset[1],
    w: o.w - o.inset[0] - o.inset[2], h: o.h - o.inset[1] - o.inset[3],
  });

  // Nessun token appoggiato dentro un ostacolo: sarebbe un'esca sleale.
  function liftPickup(p) {
    for (const o of obstacles) {
      if (p.x + p.w > o.x - 30 && p.x < o.x + o.w + 30 && p.y + p.h > o.y - 34 && p.y < o.y + o.h + 30) {
        p.y = o.kind === 'fly' ? Math.min(p.y, o.y - 70) : o.y - 62;
        p.base = p.y;
      }
    }
  }

  function spawnObstacle() {
    const r = Math.random();
    let o;
    if (score > 250 && r < 0.22) {
      const level = pick(score > 500 ? [8, 28, 28, 72] : [8, 28]);
      o = { kind: 'fly', w: 33, h: 21, y: GY - level - 21, vx: rand(40, 100), inset: [3, 5, 3, 4] };
    } else if (r < 0.52) {
      let n = 1;
      if (score > 120 && Math.random() < 0.5) n++;
      if (score > 600 && Math.random() < 0.35) n++;
      o = { kind: 'bug', n, w: n * 27 + (n - 1) * 3, h: 21, y: GY - 21, vx: 0, inset: [3, 6, 3, 0] };
    } else if (r < 0.84) {
      const size = pick(score > 300 ? [[34, 44], [40, 62], [64, 38], [30, 30]] : [[34, 44], [30, 30], [52, 34]]);
      o = { kind: 'win', w: size[0], h: size[1], y: GY - size[1], vx: 0, seed: rand(0, 999), inset: [2, 2, 2, 0] };
    } else {
      const label = pick(['404', 'NaN', 'null', '500', 'TODO']);
      o = { kind: 'sign', label, w: 16 + label.length * 9, h: 42, y: GY - 42, vx: 0, inset: [1, 1, 1, 0] };
    }
    o.x = W + 30;
    obstacles.push(o);
    pickups.forEach(liftPickup);
    nextObstacle = o.w + speed * 0.7 + 100 + Math.random() * speed * 0.75;
  }

  function spawnSparks() {
    const n = 3 + Math.floor(Math.random() * 3);
    const arc = Math.random() < 0.45;
    const baseH = rand(24, 86);
    for (let i = 0; i < n; i++) {
      const lift = arc ? Math.sin((i / (n - 1)) * Math.PI) * 56 + 26 : baseH;
      const p = { kind: 'spark', x: W + 40 + i * 34, y: GY - lift - 18, w: 18, h: 18, ph: i * 0.6 };
      p.base = p.y;
      liftPickup(p);
      pickups.push(p);
    }
    nextSparks = rand(520, 1150);
  }

  function spawnPower() {
    const kind = !shield && Math.random() < 0.55 ? 'shield' : 'think';
    const p = { kind, x: W + 40, y: GY - rand(74, 104) - 26, w: 26, h: 26, ph: 0 };
    p.base = p.y;
    liftPickup(p);
    pickups.push(p);
    nextPower = rand(16, 28);
  }

  function smash(o) {
    obstacles.splice(obstacles.indexOf(o), 1);
    burst(o.x + o.w / 2, o.y + o.h / 2, o.kind === 'win' || o.kind === 'sign' ? 'ink' : 'bug', 12, 200);
  }

  /* ---------- fisica del giocatore ---------- */
  function playerBox() {
    return player.duck
      ? { x: player.x + 8, y: GY - player.y - 22, w: 48, h: 20 }
      : { x: player.x + 8, y: GY - player.y - 38, w: 40, h: 36 };
  }

  function stepPlayer(g, dt) {
    jumpBuffer -= dt;
    player.duck = player.wantDuck && player.ground && state === 'playing';
    if (jumpBuffer > 0 && player.ground) {
      player.vy = JUMP_V; player.ground = false; player.duck = false; player.airT = 0; jumpBuffer = 0;
      AudioSys.sfx.jump();
      dust();
    }
    if (!player.ground) {
      player.airT += g;
      player.vy -= GRAVITY * (player.wantDuck ? 2.6 : 1) * g;
      if (!jumpHeld && player.vy > 280 && player.airT > 0.09) player.vy = 280;
      player.y += player.vy * g;
      if (player.y <= 0) {
        player.y = 0; player.vy = 0; player.ground = true; player.airT = 0;
        dust();
        AudioSys.sfx.land();
      }
    }
  }

  /* ---------- aggiornamento ---------- */
  function update(dt) {
    if (themeT !== themeTarget) {
      const d = dt / 0.6;
      themeT = themeTarget > themeT ? Math.min(themeTarget, themeT + d) : Math.max(themeTarget, themeT - d);
      pal = mixPalette(themeT);
    }
    if (state === 'paused') return;

    time += dt;
    hudFlash = Math.max(0, hudFlash - dt);
    shake = Math.max(0, shake - dt);
    flash = Math.max(0, flash - dt);
    squish = Math.max(0, squish - dt);
    if (banner && (banner.t += dt) > banner.dur) banner = null;
    if (bubble && (bubble.t -= dt) <= 0) bubble = null;
    if (glitch && (glitch.t -= dt) <= 0) glitch = null;

    const ts = slowT > 0 ? 0.55 : 1;
    const g = dt * ts;
    const bgSpeed = state === 'playing' ? speed * ts : state === 'title' ? 34 : 0;
    scroll += bgSpeed * dt;

    for (const c of clouds) {
      c.x -= (7 + bgSpeed * 0.07) * c.s * dt;
      if (c.x < -140) { c.x = W + rand(20, 160); c.y = rand(26, 120); }
      if (c.x > W + 400) c.x = W + rand(20, 160);
    }
    for (const r of rain) { r.y += r.v * dt; if (r.y > H + 20) r.y = -rand(10, 120); }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt - (p.text ? 0 : bgSpeed * 0.15 * dt);
      p.y += p.vy * dt;
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.y > GY - 6) {
        burst(m.x, GY - 4, 'spark', 22, 240);
        shake = 0.25; flash = 0.1;
        AudioSys.sfx.smash();
        meteors.splice(i, 1);
      }
    }

    if (state === 'title') {
      idleT += dt;
      if (!sleeping && idleT > 18) { sleeping = true; emit('sleep'); }
      if (sleeping && (zT -= dt) <= 0) {
        zT = 0.9;
        particles.push({ x: player.x + 50, y: GY - 46, vx: 14, vy: -22, g: 0, life: 1.8, t: 0, text: 'z', color: 'soft' });
      }
      stepPlayer(dt, dt);
    } else if (state === 'playing') {
      updatePlay(dt, g);
    } else if (state === 'over') {
      overT += dt;
    }
  }

  function updatePlay(dt, g) {
    if (slowT > 0) { slowT -= dt; if (slowT <= 0) AudioSys.setSlow(false); }
    if (opusT > 0) {
      opusT -= dt;
      if (opusT <= 0) { AudioSys.setBoost(false); say('Crediti Opus esauriti.'); player.invuln = 1.2; }
    }
    player.invuln = Math.max(0, player.invuln - dt);
    comboT -= dt;
    if (comboT <= 0) combo = 0;

    const maxSpeed = Math.min(860, W * 1.05);
    speed = Math.min(maxSpeed, speed + ACCEL * g);
    dist += speed * g;
    AudioSys.setIntensity((speed - START_SPEED) / (860 - START_SPEED));

    stepPlayer(g, dt);
    if (player.ground) player.anim += (g * speed) / 26;

    if ((nextObstacle -= speed * g) <= 0) spawnObstacle();
    if ((nextSparks -= speed * g) <= 0) spawnSparks();
    if ((nextPower -= dt) <= 0) spawnPower();

    const pb = playerBox();

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= (speed + o.vx) * g;
      if (o.x + o.w < -40) { obstacles.splice(i, 1); continue; }
      if (!overlap(pb, rectOf(o))) continue;
      if (opusT > 0) {
        smash(o); bonus += 15;
        floatText('+15', o.x, o.y - 6, 'spark');
        AudioSys.sfx.smash();
      } else if (player.invuln > 0) {
        continue;
      } else if (shield) {
        shield = false; player.invuln = 1.2;
        smash(o);
        AudioSys.sfx.shieldBreak();
        say('catch (e) { /* fiuu */ }', 1.8);
      } else {
        die(o);
        return;
      }
    }

    const grab = { x: pb.x - 6, y: pb.y - 6, w: pb.w + 12, h: pb.h + 12 };
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.x -= speed * g;
      p.y = p.base + Math.sin(time * 5 + p.ph) * 3;
      if (p.x + p.w < -30) { pickups.splice(i, 1); continue; }
      if (!overlap(grab, p)) continue;
      pickups.splice(i, 1);
      if (p.kind === 'spark') {
        const gain = opusT > 0 ? 40 : 20;
        bonus += gain; combo++; comboT = 0.9;
        AudioSys.sfx.spark(combo);
        burst(p.x + 9, p.y + 9, 'spark', 7, 130);
        floatText('+' + gain, p.x, p.y - 4, 'spark');
      } else if (p.kind === 'shield') {
        shield = true;
        AudioSys.sfx.power();
        say('try {', 1.6);
        burst(p.x + 13, p.y + 13, 'accent', 12, 160);
      } else {
        slowT = 5;
        AudioSys.sfx.power();
        AudioSys.setSlow(true);
        showBanner('Extended thinking…', 2.2);
        burst(p.x + 13, p.y + 13, 'accent', 12, 160);
      }
    }

    const prev = score;
    score = Math.floor(dist / 12) + bonus;
    if (score !== prev) {
      if (Math.floor(score / 100) > Math.floor(prev / 100)) { hudFlash = 0.7; AudioSys.sfx.milestone(); }
      for (const key of Object.keys(MILESTONES)) {
        if (prev < +key && score >= +key) showBanner(MILESTONES[key]);
      }
      emit('score', score, prev);
    }
  }

  /* ---------- disegno: mondo ---------- */
  function drawSky() {
    if (themeT > 0.01) {
      for (const s of stars) {
        ctx.globalAlpha = themeT * (0.35 + 0.65 * Math.abs(Math.sin(time * 1.3 + s.ph)));
        ctx.fillStyle = pal.ink;
        ctx.fillRect(Math.round(s.x * W), s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
    }

    const c = sunPos();
    if (themeT < 0.99) {
      const y = c.y + themeT * 240;
      ctx.fillStyle = pal.sun;
      ctx.beginPath(); ctx.arc(c.x, y, 17, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = time * 0.35 + (i * Math.PI) / 4;
        ctx.fillRect(c.x + Math.cos(a) * 26 - 2, y + Math.sin(a) * 26 - 2, 4, 4);
      }
    }
    if (themeT > 0.01) {
      const y = c.y + (1 - themeT) * 240;
      ctx.fillStyle = pal.moon;
      ctx.beginPath(); ctx.arc(c.x, y, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.bg;
      ctx.beginPath(); ctx.arc(c.x + 8, y - 5, 14, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = pal.cloud;
    for (const cl of clouds) {
      const w = 64 * cl.s;
      roundRect(cl.x, cl.y, w, 14 * cl.s, 7 * cl.s); ctx.fill();
      roundRect(cl.x + w * 0.2, cl.y - 9 * cl.s, w * 0.45, 16 * cl.s, 8 * cl.s); ctx.fill();
      roundRect(cl.x + w * 0.5, cl.y - 5 * cl.s, w * 0.35, 12 * cl.s, 6 * cl.s); ctx.fill();
    }

    for (const m of meteors) {
      ctx.strokeStyle = pal.spark; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 0.12, m.y - m.vy * 0.12); ctx.stroke();
      ctx.fillStyle = pal.red;
      ctx.fillRect(m.x - 4, m.y - 4, 8, 8);
    }
  }

  function drawHills() {
    const layers = [
      { color: pal.hillFar, par: 0.08, base: 64, a: 38, f1: 0.004, f2: 0.011, b: 20 },
      { color: pal.hillNear, par: 0.2, base: 22, a: 24, f1: 0.007, f2: 0.019, b: 12 },
    ];
    for (const l of layers) {
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.moveTo(0, GY);
      for (let x = 0; x <= W + 8; x += 8) {
        const wx = x + scroll * l.par;
        ctx.lineTo(x, GY - l.base - l.a * Math.sin(wx * l.f1) - l.b * Math.sin(wx * l.f2 + 1.3));
      }
      ctx.lineTo(W + 8, GY);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMatrix() {
    const chars = '01{}<>/;=*+';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.bug;
    const cols = Math.min(rain.length, Math.ceil(W / 16));
    for (let c = 0; c < cols; c++) {
      const r = rain[c];
      for (let k = 0; k < 7; k++) {
        const y = r.y - k * 14;
        if (y < -10 || y > GY - 4) continue;
        ctx.globalAlpha = 0.3 * (1 - k / 7);
        const idx = Math.floor(hash(c * 13 + k, r.seed + Math.floor(time * 6 + k)) * chars.length);
        ctx.fillText(chars[idx], c * 16 + 4, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = pal.ink;
    ctx.fillRect(0, GY, W, 2);
    const cell = 26;
    const first = Math.floor(scroll / cell);
    const count = Math.ceil(W / cell) + 2;
    for (let k = first; k < first + count; k++) {
      const x = k * cell - scroll;
      const r = hash(k, 1);
      if (r < 0.4) {
        ctx.fillStyle = pal.faint;
        ctx.fillRect(x + hash(k, 2) * 10, GY + 10 + Math.floor(hash(k, 3) * 4) * 8, 4 + r * 30, 2);
      } else if (r > 0.962) {
        text(GLYPHS[Math.floor(hash(k, 4) * GLYPHS.length)], x, GY + 30, 11, pal.soft);
      }
    }
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.kind === 'bug') {
        const colors = { a: pal.ink, b: pal.bug, w: pal.bugEye };
        for (let i = 0; i < o.n; i++) {
          const hop = Math.sin(time * 9 + i * 2 + o.x * 0.02) > 0.5 ? -2 : 0;
          drawSprite(ctx, SPR.bug, o.x + i * 30, o.y + hop, 3, colors);
        }
      } else if (o.kind === 'fly') {
        const frame = Math.floor(time * 10) % 2 ? SPR.fly1 : SPR.fly2;
        drawSprite(ctx, frame, o.x, o.y, 3, { b: pal.bug, w: pal.wing });
        ctx.fillStyle = pal.bugEye;
        ctx.fillRect(o.x + 3, o.y + 9, 3, 3);
      } else if (o.kind === 'win') {
        ctx.fillStyle = pal.panel;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = pal.ink;
        ctx.fillRect(o.x, o.y, o.w, 2);
        ctx.fillRect(o.x, o.y, 2, o.h);
        ctx.fillRect(o.x + o.w - 2, o.y, 2, o.h);
        ctx.fillRect(o.x, o.y + 9, o.w, 2);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i === 0 ? pal.red : pal.soft;
          ctx.fillRect(o.x + 5 + i * 5, o.y + 4, 3, 3);
        }
        for (let i = 0, y = o.y + 16; y < o.y + o.h - 5; i++, y += 7) {
          ctx.fillStyle = i % 3 === 0 ? pal.red : pal.soft;
          ctx.fillRect(o.x + 6, y, (o.w - 12) * (0.35 + 0.65 * hash(i, o.seed)), 3);
        }
      } else {
        ctx.fillStyle = pal.ink;
        ctx.fillRect(o.x + o.w / 2 - 2, o.y + 22, 4, o.h - 22);
        roundRect(o.x, o.y, o.w, 24, 4); ctx.fill();
        text(o.label, o.x + o.w / 2, o.y + 17, 13, pal.bg, 'center');
      }
    }
  }

  function drawPickups() {
    for (const p of pickups) {
      if (p.kind === 'spark') {
        drawSprite(ctx, SPR.spark, p.x, p.y, 2, { s: pal.spark });
      } else {
        ctx.fillStyle = pal.panel;
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x + 13, p.y + 13, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        text(p.kind === 'shield' ? '{}' : '…', p.x + 13, p.y + 17, 12, pal.accent, 'center');
      }
    }
  }

  /* ---------- disegno: Clawd ---------- */
  function clawdSprite() {
    if (state === 'over') return SPR.dead;
    if (sleeping) return SPR.blink;
    if (!player.ground) return SPR.jump;
    if (player.duck) return Math.floor(player.anim) % 2 ? SPR.duck1 : SPR.duck2;
    if (state === 'title') return time % 3.7 < 0.13 ? SPR.blink : SPR.idle;
    return Math.floor(player.anim) % 2 ? SPR.run1 : SPR.run2;
  }

  const HAT_DEF = {
    party: { rows: () => SPR.hatParty, colors: { p: '#E0527A', q: '#FFD166' } },
    crown: { rows: () => SPR.hatCrown, colors: { y: '#F2B632', r: '#D9534F' } },
    cowboy: { rows: () => SPR.hatCowboy, colors: { b: '#9A6B3A', k: '#5C3A1A' } },
    tophat: { rows: () => SPR.hatTop, colors: { k: '#4A443D', r: '#D9534F' } },
    prop: { rows: () => (Math.floor(time * 12) % 2 ? SPR.hatPropA : SPR.hatPropB), colors: { y: '#FFD166', k: '#4A443D', b: '#3B7EA1' } },
  };

  function drawClawd() {
    const rows = clawdSprite();
    const w = rows[0].length * PX, h = rows.length * PX;
    const x = player.x - (w - 56) / 2;
    const top = GY - player.y - h;
    const opus = opusT > 0;

    if (player.invuln > 0 && !opus && Math.floor(time * 16) % 2) return;

    if (opus) {
      for (let i = 4; i >= 1; i--) {
        ctx.globalAlpha = 0.34 - i * 0.07;
        drawSprite(ctx, rows, x - i * 13, top, PX, { o: `hsl(${(time * 300 - i * 40) % 360} 85% 62%)`, e: pal.eye });
      }
      ctx.globalAlpha = 1;
    }

    const body = opus ? `hsl(${(time * 300) % 360} 85% 62%)` : pal.clawd;
    drawSprite(ctx, rows, x, top, PX, { o: body, e: pal.eye });

    const hat = HAT_DEF[player.hat];
    if (hat) {
      const hr = hat.rows();
      drawSprite(ctx, hr, x + w / 2 - (hr[0].length * 3) / 2 + 2, top - hr.length * 3, 3, hat.colors);
    }

    if (shield) {
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -time * 30;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, top + h / 2, w / 2 + 9, h / 2 + 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (bubble) {
      ctx.font = `700 12px ${FONT}`;
      const tw = ctx.measureText(bubble.text).width;
      const bx = clamp(player.x + 50, 6, W - tw - 22);
      const by = Math.max(8, top - 36);
      ctx.globalAlpha = Math.min(1, bubble.t * 4);
      ctx.fillStyle = pal.panel;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1.5;
      roundRect(bx, by, tw + 16, 24, 6); ctx.fill(); ctx.stroke();
      text(bubble.text, bx + 8, by + 16, 12, pal.ink);
      ctx.globalAlpha = 1;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = Math.min(1, a * 2);
      const color = pal[p.color] || p.color;
      if (p.text) text(p.text, p.x, p.y, 12, color);
      else { ctx.fillStyle = color; ctx.fillRect(p.x, p.y, p.size, p.size); }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- disegno: interfaccia ---------- */
  const pad = (n) => String(Math.max(0, n)).padStart(5, '0');

  function drawHud() {
    if (state === 'title') {
      if (hi > 0) text('RECORD ' + pad(hi), W - 16, 28, 13, pal.soft, 'right');
      return;
    }
    if (glitch) {
      text(glitch.text, W - 16 + rand(-2, 2), 28 + rand(-1, 1), 15, pal.red, 'right');
    } else {
      const blink = hudFlash > 0 && Math.floor(hudFlash * 10) % 2 === 0;
      if (!blink) text(pad(score), W - 16, 28, 18, pal.ink, 'right');
      text('RECORD ' + pad(Math.max(hi, score)), W - 86, 27, 12, pal.soft, 'right');
    }

    let y = 26;
    if (opusT > 0) {
      text('* OPUS MODE', 16, y, 13, `hsl(${(time * 300) % 360} 80% 55%)`);
      ctx.fillRect(16, y + 5, 96 * (opusT / 9), 3);
      y += 22;
    }
    if (slowT > 0) {
      text('… thinking', 16, y, 13, pal.accent);
      ctx.fillRect(16, y + 5, 86 * (slowT / 5), 3);
      y += 22;
    }
    if (shield) text('{ } scudo', 16, y, 13, pal.accent);
  }

  function drawBanner() {
    if (!banner) return;
    const a = Math.min(1, banner.t * 5, (banner.dur - banner.t) * 4);
    ctx.font = `700 12px ${FONT}`;
    const tw = ctx.measureText(banner.text).width;
    const y = 44 - (1 - a) * 12;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = pal.ink;
    roundRect(W / 2 - tw / 2 - 14, y, tw + 28, 26, 13); ctx.fill();
    text(banner.text, W / 2, y + 17, 12, pal.bg, 'center');
    ctx.globalAlpha = 1;
  }

  function bigTitle(str, y, size) {
    text(str, W / 2 + 3, y + 3, size, pal.clawd, 'center', 800);
    text(str, W / 2, y, size, pal.ink, 'center', 800);
  }

  function drawOverlay() {
    const cx = W / 2;
    const small = W < 760;
    if (state === 'title') {
      bigTitle('CLAWD RUN', 100, small ? 38 : 48);
      text('Niente internet? Meglio. Si corre.', cx, 128, 13, pal.soft, 'center', 500);
      if (Math.floor(time * 1.7) % 2 === 0) {
        text(isTouch ? 'TOCCA PER INIZIARE' : 'PREMI SPAZIO PER INIZIARE', cx, 164, 13, pal.ink, 'center');
      }
    } else if (state === 'over') {
      bigTitle('GAME OVER', 92, small ? 30 : 36);
      text(overMsg, cx, 120, small ? 11 : 13, pal.soft, 'center', 500);
      if (newRecord) text('NUOVO RECORD: ' + score + ' TOKEN', cx, 148, 14, pal.clawd, 'center');
      else text(score + ' token  ·  record ' + hi, cx, 148, 13, pal.ink, 'center');
      if (overT > 0.6 && Math.floor(time * 1.7) % 2 === 0) {
        text(isTouch ? 'TOCCA PER RIPROVARE' : 'SPAZIO PER RIPROVARE', cx, 178, 12, pal.ink, 'center');
      }
    } else if (state === 'paused') {
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      bigTitle('PAUSA', 130, 36);
      text('Clawd riprende fiato. Premi P o salta per continuare.', cx, 160, small ? 11 : 13, pal.soft, 'center', 500);
    }
  }

  function draw() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake > 0) ctx.translate(rand(-4, 4) * (shake / 0.3), rand(-3, 3) * (shake / 0.3));
    if (squish > 0) {
      const k = 1 - 0.16 * Math.sin(Math.PI * (1 - squish / 1.4));
      ctx.translate(0, GY); ctx.scale(1, k); ctx.translate(0, -GY);
    }
    drawSky();
    drawHills();
    if (matrix) drawMatrix();
    drawGround();
    drawPickups();
    drawObstacles();
    drawClawd();
    drawParticles();
    ctx.restore();

    drawHud();
    drawBanner();
    drawOverlay();

    if (flash > 0) {
      ctx.globalAlpha = (flash / 0.14) * 0.5;
      ctx.fillStyle = pal.ink;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- input ---------- */
  function onKeyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    const c = e.code;
    if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') {
      e.preventDefault();
      if (!e.repeat) pressJump();
    } else if (c === 'ArrowDown' || c === 'KeyS') {
      e.preventDefault();
      setDuck(true);
    } else if ((c === 'KeyP' || c === 'Escape') && !e.repeat) {
      togglePause();
    }
    wake();
  }

  function onKeyUp(e) {
    const c = e.code;
    if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') releaseJump();
    else if (c === 'ArrowDown' || c === 'KeyS') setDuck(false);
  }

  function onPointerDown(e) {
    if (e.button > 0) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    wake();
    const sun = sunPos();
    if ((x - sun.x) ** 2 + (y - sun.y) ** 2 < 36 * 36) { AudioSys.unlock(); emit('sunClick'); return; }
    if (state === 'title' && x > player.x - 8 && x < player.x + 64 && y > GY - 70 && y < GY + 8) {
      AudioSys.unlock();
      if (player.ground) { player.vy = 320; player.ground = false; player.airT = 0; }
      emit('clawdClick');
      return;
    }
    pressJump();
  }

  /* ---------- avvio ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', releaseJump);
  window.addEventListener('pointercancel', releaseJump);
  window.addEventListener('resize', resize);
  window.addEventListener('blur', () => { jumpHeld = false; player.wantDuck = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(); });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);

  resize();
  requestAnimationFrame(frame);

  /* ---------- API pubblica ---------- */
  return {
    on, say, pressJump, releaseJump, setDuck, togglePause,
    banner: showBanner,
    get state() { return state; },
    get score() { return score; },
    setTheme(name) { themeTarget = name === 'dark' ? 1 : 0; },
    opus(sec) {
      opusT = sec || 9;
      if (state === 'playing') AudioSys.setBoost(true);
      confetti();
    },
    party() { confetti(); player.hat = 'party'; Store.set('hat', 'party'); },
    toggleMatrix() { matrix = !matrix; return matrix; },
    meteor() { meteors.push({ x: W + 40, y: -30, vx: -560, vy: 250 }); },
    nextHat() {
      player.hat = HATS[(HATS.indexOf(player.hat) + 1) % HATS.length];
      Store.set('hat', player.hat);
      return player.hat;
    },
    glitchHud(str, sec) { glitch = { text: str, t: sec || 2 }; },
    squish() { squish = 1.4; },
  };
})();
