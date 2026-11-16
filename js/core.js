'use strict';

/* ---------- piccoli attrezzi condivisi ---------- */

const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('clawd.' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem('clawd.' + key, JSON.stringify(value)); } catch (_) { /* modalità privata */ }
  },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- palette: chiaro e scuro, sfumate tra loro ---------- */

const PALETTES = {
  light: {
    bg: '#F4EFE6', ink: '#3D3929', soft: '#A39B8B', faint: '#D9D0C0',
    hillFar: '#EBE3D4', hillNear: '#E0D5C2', cloud: '#FFFDF8',
    clawd: '#D97757', eye: '#2A1F18',
    bug: '#5E8C4E', bugEye: '#F4EFE6', wing: '#A9C9DC',
    red: '#C6452F', panel: '#FBF8F2', spark: '#E3A008',
    sun: '#F2C14E', moon: '#F4EFE6', accent: '#3B7EA1',
  },
  dark: {
    bg: '#1C1B1A', ink: '#EDE8DF', soft: '#7F796E', faint: '#3A3835',
    hillFar: '#242321', hillNear: '#2D2B28', cloud: '#2B2A27',
    clawd: '#E58A68', eye: '#1C1410',
    bug: '#8CC97A', bugEye: '#1C1B1A', wing: '#5C7C8C',
    red: '#FF7A66', panel: '#262523', spark: '#FFCB4D',
    sun: '#F2C14E', moon: '#F1ECD9', accent: '#6FB7DD',
  },
};

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const PAL_RGB = {};
for (const name of Object.keys(PALETTES)) {
  PAL_RGB[name] = {};
  for (const key of Object.keys(PALETTES[name])) PAL_RGB[name][key] = hexToRgb(PALETTES[name][key]);
}

/** t = 0 → chiaro, t = 1 → scuro */
function mixPalette(t) {
  const out = {};
  for (const key of Object.keys(PAL_RGB.light)) {
    const a = PAL_RGB.light[key], b = PAL_RGB.dark[key];
    out[key] = `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }
  return out;
}

/* ---------- pixel art ---------- */
/* ogni carattere è un pixel: '.' = trasparente, il resto è una chiave colore */

const SPR = {
  idle: [
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooeooooeo..',
    '..oooeooooeo..',
    'oooooooooooooo',
    'oooooooooooooo',
    '..oooooooooo..',
    '..oooooooooo..',
    '..o.o....o.o..',
    '..o.o....o.o..',
  ],
  blink: [
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooeooooeo..',
    'oooooooooooooo',
    'oooooooooooooo',
    '..oooooooooo..',
    '..oooooooooo..',
    '..o.o....o.o..',
    '..o.o....o.o..',
  ],
  run1: [
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooeooooeo..',
    '..oooeooooeo..',
    'oooooooooooooo',
    'oooooooooooooo',
    '..oooooooooo..',
    '..oooooooooo..',
    '..o.o....o.o..',
    '..o......o....',
  ],
  run2: [
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooeooooeo..',
    '..oooeooooeo..',
    'oooooooooooooo',
    'oooooooooooooo',
    '..oooooooooo..',
    '..oooooooooo..',
    '..o.o....o.o..',
    '....o......o..',
  ],
  jump: [
    '..oooooooooo..',
    '..oooooooooo..',
    'oooooeooooeooo',
    'oooooeooooeooo',
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooooooooo..',
    '..o.o....o.o..',
    '..............',
  ],
  dead: [
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooooooooo..',
    '..ooeeoooeeo..',
    'oooooooooooooo',
    'oooooooooooooo',
    '..oooooooooo..',
    '..oooooooooo..',
    '..o.o....o.o..',
    '..o.o....o.o..',
  ],
  duck1: [
    '..oooooooooooo..',
    '..ooooeoooooeo..',
    'oooooooooooooooo',
    '..oooooooooooo..',
    '..o.o......o.o..',
    '..o........o....',
  ],
  duck2: [
    '..oooooooooooo..',
    '..ooooeoooooeo..',
    'oooooooooooooooo',
    '..oooooooooooo..',
    '..o.o......o.o..',
    '....o........o..',
  ],

  bug: [
    'a.......a',
    '.a.....a.',
    '..bbbbb..',
    '.bbwbwbb.',
    'bbbbbbbbb',
    '.bbbbbbb.',
    '.a..a..a.',
  ],
  fly1: [
    '.ww.....ww.',
    '..www.www..',
    '.bbbbbbbbb.',
    'bwbbbbbbbbb',
    '.bbbbbbbbb.',
    '...........',
    '...........',
  ],
  fly2: [
    '...........',
    '...........',
    '.bbbbbbbbb.',
    'bwbbbbbbbbb',
    '.bbbbbbbbb.',
    '..www.www..',
    '.ww.....ww.',
  ],
  spark: [
    '....s....',
    '.s..s..s.',
    '..s.s.s..',
    '...sss...',
    'sssssssss',
    '...sss...',
    '..s.s.s..',
    '.s..s..s.',
    '....s....',
  ],

  hatParty: ['..q..', '..p..', '.ppp.', '.qqq.', 'ppppp'],
  hatCrown: ['y.y.y', 'yyyyy', 'yryry', 'yyyyy'],
  hatCowboy: ['..bbbbb..', '..bbbbb..', '..kkkkk..', 'bbbbbbbbb'],
  hatTop: ['.kkkkk.', '.kkkkk.', '.kkkkk.', '.rrrrr.', 'kkkkkkk'],
  hatPropA: ['yyy.yyy', '...k...', '.bbbbb.', 'bbbbbbb'],
  hatPropB: ['..yyy..', '...k...', '.bbbbb.', 'bbbbbbb'],
};

/**
 * Disegna uno sprite a pixel. Le righe vengono fuse in strisce orizzontali
 * e leggermente sovrapposte, così non compaiono fessure a scale non intere.
 */
function drawSprite(ctx, rows, x, y, px, colors) {
  const eps = 0.35;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let c = 0;
    while (c < row.length) {
      const ch = row[c];
      let end = c + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') {
        ctx.fillStyle = colors[ch];
        ctx.fillRect(x + c * px, y + r * px, (end - c) * px + eps, px + eps);
      }
      c = end;
    }
  }
}
