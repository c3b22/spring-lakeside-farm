/* 64 palette slots (60 used, 4 reserved). Scene code only ever uses the indices in C.
   PALETTES holds one full table per time of day; only 'day' is filled in for now. */
(function (global) {
  'use strict';

  const DAY = [
    '#1b1a2e', '#2d2840',                                                     // 0-1   ink
    '#1f3d3a', '#2f5e3a', '#3f7a3f', '#5f9a3c', '#8fbf45', '#c4dc6a',         // 2-7   grass
    '#12302f', '#1a4a3c', '#27694a', '#3a8a52',                               // 8-11  foliage
    '#24456b', '#2f6a8c', '#3f8fb0', '#7ac0d0', '#c8ece0',                    // 12-16 water
    '#74492f', '#9c6c3c', '#c4934d', '#dbb069', '#eed293',                    // 17-21 dirt path
    '#4a2f3a', '#6b4332', '#8a5a3a',                                          // 22-24 tilled soil
    '#3a2a2e', '#5c3b35', '#8a5a3c', '#b5834a', '#d9b070',                    // 25-29 wood
    '#5e2430', '#8f3338', '#c24a3e', '#e2734f',                               // 30-33 red roof
    '#3f4568', '#636e8d', '#909cb5', '#c0c8d6',                               // 34-37 stone
    '#5a3a8a', '#9a6ad0',                                                     // 38-39 lavender
    '#3d5fb0', '#86a8f0',                                                     // 40-41 blue flower
    '#c95a7d', '#ee8fa5', '#f9cdd3',                                          // 42-44 blossom
    '#f2c744', '#fbe98a',                                                     // 45-46 yellow
    '#e8742c', '#f4a04a',                                                     // 47-48 orange
    '#d23a3a',                                                                // 49    red accent
    '#f6f1e4', '#dcd4c0',                                                     // 50-51 cream
    '#ffb347', '#ffd98a',                                                     // 52-53 glow
    '#3f9a6a', '#6cc08a', '#a8e0a0', '#4a8a8a',                               // 54-57 crop greens
    '#1a3358',                                                                // 58    deep water
    '#4a8a5a', '#3a7255', '#2b5b4b',                                          // 59-61 grass in shade (cool)
    '#9e7b58', '#7e6049',                                                     // 62-63 dirt in shade (cool)
  ];

  const C = {
    INK0: 0, INK1: 1,
    G0: 2, G1: 3, G2: 4, G3: 5, G4: 6, G5: 7,
    F0: 8, F1: 9, F2: 10, F3: 11,
    W0: 12, W1: 13, W2: 14, W3: 15, W4: 16,
    D0: 17, D1: 18, D2: 19, D3: 20, D4: 21,
    T0: 22, T1: 23, T2: 24,
    WD0: 25, WD1: 26, WD2: 27, WD3: 28, WD4: 29,
    R0: 30, R1: 31, R2: 32, R3: 33,
    M0: 34, M1: 35, M2: 36, M3: 37,
    V0: 38, V1: 39,
    BL0: 40, BL1: 41,
    B0: 42, B1: 43, B2: 44,
    Y0: 45, Y1: 46,
    O0: 47, O1: 48,
    RED: 49,
    CR0: 50, CR1: 51,
    GL0: 52, GL1: 53,
    CG0: 54, CG1: 55, CG2: 56, CG3: 57,
    WDEEP: 58,
    GS4: 59, GS3: 60, GS2: 61, DS3: 62, DS2: 63,
  };

  /* Coloured outlines: each colour's outline is a darker step of its own ramp, so nothing is ringed in black.
     RAMPS list palette indices dark -> light. dark = two steps down (shadow side), lit = one step down. */
  const RAMPS = [
    [2, 3, 4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15, 16], [17, 18, 19, 20, 21], [22, 23, 24],
    [25, 26, 27, 28, 29], [30, 31, 32, 33], [34, 35, 36, 37], [38, 39], [40, 41], [42, 43, 44],
    [54, 55, 56, 57], [61, 60, 59], [63, 62],
  ];
  const OVERRIDE = {                      // [dark, lit] for colours whose own ramp is too short or too pale
    50: [35, 36], 51: [34, 35], 45: [47, 47], 46: [47, 45], 47: [31, 30], 48: [47, 31], 49: [31, 30],
    52: [47, 48], 53: [48, 52], 58: [0, 12], 0: [0, 0], 1: [0, 0],
  };
  const OUT_DARK = new Array(64).fill(0), OUT_LIT = new Array(64).fill(1);
  for (const r of RAMPS) r.forEach((c, i) => {
    OUT_DARK[c] = i >= 2 ? r[i - 2] : (i === 1 ? 0 : 0);
    OUT_LIT[c] = i >= 1 ? r[i - 1] : 1;
    if (i < 2) OUT_DARK[c] = r[0] === c ? (i === 0 ? 0 : r[0]) : r[0];
  });
  for (const k of Object.keys(OVERRIDE)) { OUT_DARK[k] = OVERRIDE[k][0]; OUT_LIT[k] = OVERRIDE[k][1]; }
  OUT_DARK[0] = 0; OUT_LIT[0] = 1; OUT_DARK[1] = 0; OUT_LIT[1] = 1;

  /* ---------- time of day ----------
     Every other time is the day palette graded in one pass: saturation, a colour multiply, and a tint
     pulled into the shadows. Only the lamp glow stays untouched, so it reads as light. The clock then
     blends between four keyframes, so colour drifts instead of switching. */
  const EMISSIVE = new Set([52, 53]);
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const GRADES = {
    dawn: { sat: 0.90, mul: [1.05, 0.96, 0.95], sh: [0.62, 0.44, 0.70], shAmt: 0.24 },
    dusk: { sat: 0.95, mul: [1.08, 0.84, 0.76], sh: [0.40, 0.22, 0.52], shAmt: 0.38 },
    night: { sat: 0.62, mul: [0.52, 0.60, 0.92], sh: [0.07, 0.11, 0.30], shAmt: 0.52 },
  };
  const clamp255 = (v) => Math.max(0, Math.min(255, v));
  function grade(g) {
    return DAY.map((h, i) => {
      const [r0, g0, b0] = hexRgb(h);
      if (EMISSIVE.has(i)) return [r0, g0, b0];
      const L = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
      let c = [L + (r0 - L) * g.sat, L + (g0 - L) * g.sat, L + (b0 - L) * g.sat];
      c = c.map((v, k) => v * g.mul[k]);
      const k = (1 - L / 255) * g.shAmt;
      c = c.map((v, j) => v + (g.sh[j] * 255 - v) * k);
      return c.map(clamp255);
    });
  }
  const RGB = { day: DAY.map(hexRgb), dawn: grade(GRADES.dawn), dusk: grade(GRADES.dusk), night: grade(GRADES.night) };
  const KEYS = [[0, 'night'], [300, 'night'], [375, 'dawn'], [480, 'day'], [990, 'day'], [1095, 'dusk'], [1200, 'night'], [1440, 'night']];
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function rgbAt(min) {
    let i = 1;
    while (i < KEYS.length - 1 && min > KEYS[i][0]) i++;
    const [m0, n0] = KEYS[i - 1], [m1, n1] = KEYS[i];
    const t = smooth(m0, m1, min);
    return RGB[n0].map((c, j) => c.map((v, k) => v + (RGB[n1][j][k] - v) * t));
  }
  /* how strongly the lamps light the world: 0 by day, ramping in after the lights come on at 18:30 */
  function lightAt(min) {
    if (min >= 1110) return smooth(1110, 1185, min);
    if (min < 345) return 1 - smooth(300, 345, min);
    return 0;
  }
  const isLit = (min) => min >= 1110 || min < 345;
  function firefliesAt(min) {
    if (min >= 1110) return smooth(1110, 1170, min);
    if (min < 360) return 1 - smooth(300, 360, min);
    return 0;
  }
  const peopleOut = (min) => min >= 390 && min < 1110;

  /* Four banks per palette: bank 0 as is, banks 1-3 warm and brighter. A per-pixel light level picks the
     bank, so a pool of light is three hard bands (like a palette-bank trick on old consoles). */
  const BANKS = [{ g: 0, w: 0, a: 0 }, { g: 0.55, w: 0.22, a: 5 }, { g: 1.0, w: 0.38, a: 10 }, { g: 1.55, w: 0.52, a: 16 }];
  const WARM = [1.0, 0.80, 0.48];
  const pack = (r, g, b) => ((255 << 24) | (Math.round(clamp255(b)) << 16) | (Math.round(clamp255(g)) << 8) | Math.round(clamp255(r))) >>> 0;
  function banks(rgb, s) {
    return BANKS.map(({ g, w, a }, k) => Uint32Array.from(rgb.map((c, i) => {
      if (k === 0 || s <= 0.001 || EMISSIVE.has(i)) return pack(c[0], c[1], c[2]);
      const gain = 1 + g * s;
      const f = (v, wc) => v * gain * (1 - w * s + w * s * wc) + a * s * wc;
      return pack(f(c[0], WARM[0]), f(c[1], WARM[1]), f(c[2], WARM[2]));
    })));
  }

  /* append colours (hex strings) after the scene's 64; returns {hex: index}. Call once at load, before the first frame. */
  function extend(hexes) {
    const map = {};
    for (const h of hexes) {
      let i = DAY.indexOf(h);
      if (i < 0) { i = DAY.length; DAY.push(h); }
      map[h] = i;
    }
    RGB.day = DAY.map(hexRgb); RGB.dawn = grade(GRADES.dawn); RGB.dusk = grade(GRADES.dusk); RGB.night = grade(GRADES.night);
    return map;
  }

  global.Palette = {
    C, PALETTES: { day: DAY }, size: DAY.length, used: 64, OUTLINE: { dark: OUT_DARK, lit: OUT_LIT },
    rgbAt, lightAt, isLit, firefliesAt, peopleOut, banks, EMISSIVE, extend,
  };
})(window);
