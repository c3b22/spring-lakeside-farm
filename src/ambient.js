/* Phase 4: the world moves a little even when nobody is looking at it.
   under(): things painted into the scene before the characters: cloud shadows, wind through leaves and grass, glints on the pond.
   over():  things in the air: chimney smoke and drifting petals.
   All hard-edged, indexed colours only: no alpha, no blur. */
(function (global) {
  'use strict';

  const E = global.Engine;
  const C = global.Palette.C;
  const hash01 = (n) => { let h = Math.imul(n | 0, 374761393) + 668265263; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  let ctx = null, ready = false;
  const opts = { clouds: true, wind: true };           // cloud shadows; leaves/grass/pond glints/smoke/petals
  let leaves = [], grass = [], glints = [], crops = [], ground = new Uint32Array(0);
  const CHIMNEY = [137, 58];

  /* pick the pixels that will move, from the freshly drawn static scene */
  function scan() {
    leaves = []; grass = []; glints = []; crops = [];
    const W = E.W, H = E.H;
    for (let y = 0; y < H - 20; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, tag = E.tag[i], c = E.buf[i], h = hash01(i * 7 + 3);
      if (tag === E.TAG.OBJ && E.depth[i] > 0 && (c === C.F1 || c === C.F2 || c === C.F3) && h < 0.07) leaves.push([i, c, h * 6.283 * 14]);
      else if (tag === E.TAG.OBJ && E.depth[i] === 0 && ((y < 40 && x < 326 && (c === C.Y1 || c === C.O1)) || (y > 346 && x > 40 && x < 320 && (c === C.CG3 || c === C.CG2))) && h < 0.4) crops.push([i, c, h * 6.283 * 9]);
      else if (tag === E.TAG.GROUND && (c === C.G3 || c === C.G4) && h < 0.05) grass.push([i, c, h * 6.283 * 20]);
      else if (tag === E.TAG.WATER && (c === C.W2 || c === C.W3) && h < 0.012) glints.push([i, c, h * 6.283 * 80]);
    }
    ground = [];
    for (let y = 0; y < H - 20; y++) for (let x = 0; x < W; x++) { const tg = E.tag[y * W + x]; if (tg === E.TAG.GROUND || tg === E.TAG.PATH) ground.push(y * W + x); }
    ground = Uint32Array.from(ground);
  }

  /* cloud cover: two wrapped fractal-noise fields, stretched along the wind, slid past each other at different speeds.
     Thresholding the sum gives billowy, ragged-edged streaks that slowly change shape. */
  const TW = 512, TH = 256;
  function makeField(seed) {
    const f = new Float32Array(TW * TH);
    const oct = [[8, 8, 1], [16, 16, 0.55], [32, 32, 0.3]];
    for (const [nx, ny, amp] of oct) {
      const lat = new Float32Array(nx * ny);
      for (let i = 0; i < lat.length; i++) lat[i] = hash01(seed * 977 + nx * 131 + i);
      for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
        const u = x * nx / TW, v = y * ny / TH, x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = lat[(y0 % ny) * nx + (x0 % nx)], b = lat[(y0 % ny) * nx + ((x0 + 1) % nx)], c = lat[((y0 + 1) % ny) * nx + (x0 % nx)], d = lat[((y0 + 1) % ny) * nx + ((x0 + 1) % nx)];
        f[y * TW + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    // flatten the histogram so a threshold means a coverage fraction
    const idx = Uint32Array.from({ length: f.length }, (_, i) => i).sort((p, q) => f[p] - f[q]);
    const out = new Uint8Array(f.length);
    for (let r = 0; r < idx.length; r++) out[idx[r]] = Math.floor(r * 256 / idx.length);
    return out;
  }
  let fieldA = null, fieldB = null, lut = null;
  function setup(context) {
    ctx = context; ready = false;
    fieldA = makeField(1); fieldB = makeField(2);
    lut = new Uint8Array(256);
    const pal = global.Palette.PALETTES.day.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    for (let c = 0; c < 256; c++) {
      lut[c] = c;
      if (c >= pal.length || global.Palette.EMISSIVE.has(c)) continue;
      const OVER = { 57: 56, 56: 55, 55: 54, 54: 9, 46: 45, 45: 47, 48: 47, 47: 32 };      // crops: one step down their own ramp (no hue wandering)
      const m = OVER[c] !== undefined ? OVER[c] : ctx.shade(c);
      if (m !== undefined) { lut[c] = m; continue; }
      const want = [pal[c][0] * 0.70, pal[c][1] * 0.76, pal[c][2] * 0.9 + 10];
      let best = c, bd = 1e9;
      for (let j = 0; j < pal.length; j++) {
        if (global.Palette.EMISSIVE.has(j)) continue;
        // brightness matters, but keeping the hue matters more (a dark yellow should not turn blue-grey)
        const d = (pal[j][0] - want[0]) ** 2 + (pal[j][1] - want[1]) ** 2 + (pal[j][2] - want[2]) ** 2
          + 6 * (((pal[j][0] - pal[j][1]) - (want[0] - want[1])) ** 2 + ((pal[j][1] - pal[j][2]) - (want[1] - want[2])) ** 2);
        if (d < bd) { bd = d; best = j; }
      }
      lut[c] = best;
    }
  }

  function under(t, env) {
    if (!ready) { scan(); ready = true; }
    const W = E.W, buf = E.buf;
    if (!opts.wind) return;
    // wind: leaves flicker between neighbouring tones in a wave that travels across the farm
    for (const [i, c, ph] of leaves) {
      const x = i % W, y = (i / W) | 0, v = Math.sin(t * 1.4 - x * 0.045 + y * 0.02 + ph * 0.05);
      if (v > 0.6) buf[i] = c === C.F3 ? C.F2 : c === C.F2 ? C.F3 : C.F2;
    }
    // a gust runs through the wheat: ripe ears flash pale, young blades darken
    for (const [i, c, ph] of crops) {
      const x = i % W, y = (i / W) | 0, v = Math.sin(t * 2.0 - x * 0.07 + y * 0.03 + ph * 0.03);
      if (v > 0.62) buf[i] = c === C.Y1 ? C.CR0 : c === C.O1 ? C.Y1 : c === C.CG3 ? C.CG1 : C.CG1;
    }
    for (const [i, c, ph] of grass) {
      const x = i % W, y = (i / W) | 0, v = Math.sin(t * 0.7 - x * 0.03 + y * 0.012);
      if (v > 0.93) buf[i] = c === C.G3 ? C.G4 : C.G5;
    }
    for (const [i, c, ph] of glints) {
      const v = Math.sin(t * 1.1 + ph);
      if (v > 0.9) buf[i] = C.W4;
    }
  }

  /* chimney smoke and petals */
  const PETALS = Array.from({ length: 16 }, (_, i) => ({ x: hash01(i * 3 + 1) * 640, y: 30 + hash01(i * 5 + 2) * 330, vx: 6 + hash01(i + 9) * 5, vy: 3 + hash01(i + 19) * 4, ph: hash01(i + 29) * 6.283 }));
  function over(t, env) {
    const m = env.min, W = E.W, buf = E.buf;
    // cloud shadows by day, over everything (ground, trees, buildings, animals, people): coverage grows after sunrise and thins away before dusk
    const k = smooth(360, 450, m) * (1 - smooth(1050, 1140, m));
    if (opts.clouds && k > 0.05) {
      const thr = 300 + (1 - k) * 210;                         // sum of two 0..255 fields; 300 is about a third of the ground in shade
      // sub-pixel scrolling: the fields are sampled with bilinear weights, so the edges glide instead of stepping a pixel at a time
      const pa = t * 2.6, qa = t * 0.5 + 40, pb = t * 1.7 + 211, qb = 90 - t * 0.35;
      const ax = Math.floor(pa), ay = Math.floor(qa), bx = Math.floor(pb), by = Math.floor(qb);
      const fax = pa - ax, fay = qa - ay, fbx = pb - bx, fby = qb - by;
      const a00 = (1 - fax) * (1 - fay), a10 = fax * (1 - fay), a01 = (1 - fax) * fay, a11 = fax * fay;
      const b00 = (1 - fbx) * (1 - fby), b10 = fbx * (1 - fby), b01 = (1 - fbx) * fby, b11 = fbx * fby;
      const FA = fieldA, FB = fieldB;
      for (let y = 0; y < E.H; y++) {
        const ra = ((y + ay) & 255) * TW, ra1 = ((y + ay + 1) & 255) * TW, rb = ((y + by) & 255) * TW, rb1 = ((y + by + 1) & 255) * TW, row = y * W;
        for (let x = 0; x < W; x++) {
          const xa = (x + ax) & 511, xa1 = (x + ax + 1) & 511, xb = (x + bx) & 511, xb1 = (x + bx + 1) & 511;
          const v = FA[ra + xa] * a00 + FA[ra + xa1] * a10 + FA[ra1 + xa] * a01 + FA[ra1 + xa1] * a11
                  + FB[rb + xb] * b00 + FB[rb + xb1] * b10 + FB[rb1 + xb] * b01 + FB[rb1 + xb1] * b11;
          if (v > thr) buf[row + x] = lut[buf[row + x]];
        }
      }
    }

    if (!opts.wind) return;
    // smoke: puffs rise, drift east, swell, then thin out; hard two-tone circles
    const N = 7;
    for (let i = 0; i < N; i++) {
      const u = (t * 0.1 + i / N) % 1;
      const x = CHIMNEY[0] + u * 16 + Math.sin(u * 5 + i * 2) * 1.6, y = CHIMNEY[1] - u * 30;
      const r = u < 0.15 ? 1.4 : u < 0.55 ? 2.6 : u < 0.8 ? 3.2 : 2.2;
      const light = m >= 1110 || m < 345;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const tone = (-dx - dy) / 4;
        E.set(Math.round(x + dx), Math.round(y + dy), tone > 0.2 ? C.CR1 : u > 0.6 ? C.M3 : C.M2);
      }
      if (light && u < 0.4) E.set(Math.round(x), Math.round(y + 2), C.GL0);          // the glow of the stove on the first puffs
    }
    // petals blowing across, slightly different speeds
    for (const p of PETALS) {
      const x = (p.x + t * p.vx + Math.sin(t * 0.9 + p.ph) * 7) % 660 - 10, y = (p.y + t * p.vy + Math.cos(t * 0.7 + p.ph) * 3);
      const yy = 24 + ((y - 24) % 340 + 340) % 340;
      const f = Math.floor(t * 2 + p.ph * 3) % 2;
      E.set(Math.round(x), Math.round(yy), f ? C.B2 : C.CR0);
      E.set(Math.round(x) + 1, Math.round(yy) + (f ? 0 : 1), C.B1);
    }
  }

  global.Ambient = { setup, under, over, setOption: (k, v) => { if (k in opts) opts[k] = !!v; }, rescan: () => { ready = false; } };
})(window);
