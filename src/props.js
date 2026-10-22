/* Trees and farm facilities. Every function returns an outlined Spr; scene.js places them
   and y-sorts them with the buildings. Palette indices only. */
(function (global) {
  'use strict';

  const E = global.Engine;
  const C = global.Palette.C;
  const rnd = (s) => E.rngFor(s);

  function ellipse(sp, cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) sp.set(cx + x, cy + y, c);
    }
  }

  /* ---------- trees ---------- */
  /* Foliage as many small clumps painted back to front. Each clump is lit from the top-left and
     rimmed dark at the bottom-right, so overlaps leave dark seams and the mass reads as tiers of
     leaves instead of one smooth blob. Returns the clump list so shadows can follow the same shape. */
  function foliage(sp, env, count, rmin, rmax, ramp, spark, rng, seed) {
    const pts = [];
    for (let tries = 0; tries < count * 60 && pts.length < count; tries++) {
      const a = rng() * 6.283, rr = Math.sqrt(rng());
      const x = env.cx + Math.cos(a) * env.rx * rr, y = env.cy + Math.sin(a) * env.ry * rr;
      let ok = true;
      for (const p of pts) if (Math.hypot(p.x - x, p.y - y) < rmin * 0.95) { ok = false; break; }
      if (ok) pts.push({ x: Math.round(x), y: Math.round(y), r: rmin + rng() * (rmax - rmin) });
    }
    pts.sort((a, b) => a.y - b.y);
    for (const c of pts) {
      const a1 = 0.06 + rng() * 0.10, a2 = 0.04 + rng() * 0.08, p1 = rng() * 6.283, p2 = rng() * 6.283;
      const R = Math.ceil(c.r * 1.3);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
        const re = c.r * (1 + a1 * Math.sin(2 * th + p1) + a2 * Math.sin(3 * th + p2));
        if (d > re) continue;
        const t = (-dx - dy) / (1.414 * re);
        let col = ramp.m;
        if (t > 0.42) col = ramp.l;
        else if (t < -0.22) col = ramp.d;
        if (t > 0.78 && d > re - 2.4) col = spark;                       // sun catching the upper-left lip
        if (t < -0.05 && d > re - 1.3) col = ramp.rim;                   // dark seam on the lower-right edge
        sp.set(c.x + dx, c.y + dy, col);
      }
    }
    // leaves: little lit and shaded flecks, clustered by noise rather than sprinkled evenly
    for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
      const c = sp.get(x, y);
      if (c !== ramp.m) continue;
      const n = E.noise2(x / 2.2, y / 2.2, seed);
      if (n > 0.80) sp.set(x, y, ramp.l); else if (n < 0.16) sp.set(x, y, ramp.d);
    }
    return pts;
  }

  function trunk(sp, cx, y0, y1, w0, w1) {
    for (let y = y0; y <= y1; y++) {
      const w = Math.round(w0 + (w1 - w0) * (y - y0) / Math.max(1, y1 - y0));
      const x0 = cx - (w >> 1);
      const shade = y - y0 < 6;                                           // under the canopy the bark is in shadow
      sp.set(x0, y, shade ? C.WD2 : C.WD3);
      for (let i = 1; i < w - 1; i++) sp.set(x0 + i, y, shade ? C.WD1 : C.WD2);
      sp.set(x0 + w - 1, y, shade ? C.WD0 : C.WD1);
      if (!shade && (y * 7 + cx) % 5 === 0) sp.set(x0 + (w >> 1), y, C.WD1);   // bark grain
    }
    const half = (w1 >> 1);
    sp.set(cx - half - 1, y1, C.WD2); sp.set(cx + half + 1, y1, C.WD1);
    sp.set(cx - half - 2, y1, C.WD1); sp.set(cx - half - 1, y1 - 1, C.WD3); sp.set(cx + half + 1, y1 - 1, C.WD1);
  }

  function crown(k, seed, ramp, spark, trunkRatio) {
    const rng = rnd(seed);
    const w = Math.round(64 * k), h = Math.round(66 * k);
    const sp = new E.Spr(w, h);
    trunk(sp, w >> 1, Math.round(h * trunkRatio), h - 1, Math.max(3, Math.round(4 * k)), Math.max(4, Math.round(6 * k)));
    sp.clumps = foliage(sp, { cx: w * 0.5, cy: h * 0.38, rx: w * 0.40, ry: h * 0.27 }, Math.round(26 * k) + 6, 4.2 * k + 1.6, 7.2 * k + 2.4, ramp, spark, rng, seed);
    return sp;
  }

  function finish(sp, dark, lit) { const cl = sp.clumps; sp.outline(dark, lit); sp.clumps = cl; return sp; }

  function oak(k, seed) {
    return finish(crown(k, seed, { l: C.G3, m: C.G2, d: C.G1, rim: C.G0 }, C.G4, 0.55), C.INK0, C.G1);
  }
  function apple(k, seed) {
    const rng = rnd(seed + 5);
    const sp = crown(k, seed, { l: C.G3, m: C.G2, d: C.G1, rim: C.G0 }, C.G4, 0.55);
    for (let i = 0; i < 10; i++) {
      const x = Math.round((12 + rng() * 40) * k), y = Math.round((10 + rng() * 32) * k);
      const c = sp.get(x, y);
      if (c === C.G2 || c === C.G3 || c === C.G4) { sp.set(x, y, C.RED); sp.set(x + 1, y, C.RED); sp.set(x, y + 1, C.R1); sp.set(x, y - 1, C.Y1); }
    }
    return finish(sp, C.INK0, C.G1);
  }
  function birch(k, seed) {
    const rng = rnd(seed);
    const w = Math.round(48 * k), h = Math.round(66 * k);
    const sp = new E.Spr(w, h);
    const cx = w >> 1;
    for (let y = Math.round(h * 0.42); y < h; y++) {
      sp.set(cx - 1, y, C.CR0); sp.set(cx, y, C.CR0); sp.set(cx + 1, y, C.CR1);
      if (rng() < 0.30) { sp.set(cx - 1, y, C.INK1); sp.set(cx, y, C.INK1); }
    }
    sp.clumps = foliage(sp, { cx: w * 0.5, cy: h * 0.34, rx: w * 0.40, ry: h * 0.26 }, Math.round(20 * k) + 5, 3.6 * k + 1.6, 6.2 * k + 2.2,
      { l: C.G5, m: C.G4, d: C.G3, rim: C.G2 }, C.Y1, rng, seed);
    return finish(sp, C.INK0, C.G2);
  }
  function pine(h, seed, ramp, noTrunk) {
    const R = ramp || { l: C.F3, m: C.F2, d: C.F1 };
    const rng = rnd(seed);
    const hw = Math.max(5, Math.round(h * 0.26));
    const sp = new E.Spr(hw * 2 + 1, h);
    const trunkH = h > 30 ? 5 : 3, fh = h - trunkH;
    const n = Math.max(3, Math.round(fh / 9)), tierH = fh / n;
    const maxHW = (t) => hw * (0.42 + 0.58 * (t + 1) / n);
    for (let r = 0; r < fh; r++) {
      const t = Math.min(n - 1, Math.floor(r / tierH)), rr = r - t * tierH;
      const start = t === 0 ? 0 : maxHW(t - 1) * 0.55;
      const half = Math.round(start + (maxHW(t) - start) * (rr / Math.max(1, tierH - 1)));
      for (let dx = -half; dx <= half; dx++) {
        const u = (dx + (rng() - 0.5) * 1.6) / Math.max(1, half);
        let c = R.m;
        if (rr >= tierH - 1.6) c = u < -0.6 ? R.m : R.d;
        else if (u < -0.32) c = R.l;
        else if (u > 0.3) c = R.d;
        else if (rr < 1) c = R.l;
        if (rng() < 0.06) c = u < 0 ? R.l : R.d;
        sp.set(hw + dx, r, c);
      }
    }
    if (!noTrunk) for (let r = fh; r < h; r++) { sp.set(hw - 1, r, C.WD3); sp.set(hw, r, C.WD2); sp.set(hw + 1, r, C.WD1); }
    sp.outline(C.INK0, C.F0);
    sp.clumps = [{ x: hw, y: Math.round(h * 0.28), r: hw * 0.55 }, { x: hw, y: Math.round(h * 0.52), r: hw * 0.8 }, { x: hw, y: Math.round(h * 0.76), r: hw }];
    return sp;
  }

  function bush(w, seed) {
    const rng = rnd(seed);
    const sp = new E.Spr(w, 13);
    sp.clumps = foliage(sp, { cx: w * 0.5, cy: 8, rx: w * 0.5 - 2, ry: 3.2 }, Math.max(3, Math.round(w / 4.5)), 3.2, 5.2, { l: C.G4, m: C.G3, d: C.G2, rim: C.G1 }, C.G5, rng, seed);
    for (let x = -1; x <= w; x++) sp.set(x, 13, -1);
    return finish(sp, C.INK0, C.G2);
  }

  /* ---------- yard and farm facilities ---------- */
  function well() {
    const sp = new E.Spr(26, 30);
    for (let y = 16; y < 30; y++) for (let x = 2; x < 24; x++) {
      const row = (y - 16) >> 2;
      let c = x < 8 ? C.M2 : x < 18 ? C.M1 : C.M0;
      if ((y - 16) % 4 === 3) c = C.M0;
      else if (((x + (row % 2) * 4) % 8) === 0) c = C.M0;
      sp.set(x, y, c);
    }
    sp.hline(1, 24, 16, C.M3); sp.hline(1, 24, 17, C.M2);
    ellipse(sp, 12, 18, 8, 2, C.W1); ellipse(sp, 11, 18, 5, 1, C.W0);
    for (const px of [2, 21]) { sp.vline(px, 5, 17, C.WD3); sp.vline(px + 1, 5, 17, C.WD1); }
    for (let y = 0; y < 7; y++) {
      const cut = Math.max(0, 3 - y);
      for (let x = cut; x < 26 - cut; x++) sp.set(x, y, y === 0 ? C.R3 : y === 6 ? C.R1 : ((x + y) % 5 === 0 ? C.R1 : C.R2));
    }
    sp.vline(12, 7, 14, C.CR1); sp.rect(11, 14, 3, 3, C.WD2); sp.hline(11, 13, 14, C.WD4);
    return sp.outline(C.INK0, C.INK1);
  }

  function woodpile() {
    const sp = new E.Spr(24, 17);
    const row = (n, y, x0) => {
      for (let i = 0; i < n; i++) {
        const cx = x0 + i * 5, cy = y;
        ellipse(sp, cx, cy, 2, 2, C.WD3); sp.set(cx, cy, C.WD4); sp.set(cx - 1, cy + 1, C.WD2); sp.set(cx + 1, cy - 1, C.WD2);
      }
    };
    sp.rect(0, 14, 24, 3, C.WD1);
    row(4, 12, 4); row(3, 7, 6); row(2, 2, 9);
    sp.hline(0, 23, 16, C.WD0);
    return sp.outline(C.INK0, C.INK1);
  }

  function stump() {
    const sp = new E.Spr(22, 14);
    ellipse(sp, 6, 8, 5, 3, C.WD3); ellipse(sp, 6, 6, 5, 3, C.WD4); ellipse(sp, 6, 6, 3, 2, C.WD3); sp.set(6, 6, C.WD2);
    sp.rect(2, 8, 9, 4, C.WD2); sp.vline(2, 8, 11, C.WD3); sp.vline(10, 8, 11, C.WD1);
    return sp.outline(C.INK0, C.INK1);
  }

  function mailbox() {
    const sp = new E.Spr(10, 20);
    sp.vline(4, 8, 19, C.WD2); sp.vline(5, 8, 19, C.WD1);
    sp.rect(0, 2, 10, 6, C.R2); sp.hline(0, 9, 2, C.R3); sp.hline(0, 9, 7, C.R1);
    sp.rect(7, 3, 2, 3, C.R1); sp.rect(1, 3, 1, 4, C.CR0);
    sp.vline(9, 0, 2, C.CR0); sp.rect(8, 0, 2, 2, C.RED);
    return sp.outline(C.INK0, C.INK1);
  }

  function signpost() {
    const sp = new E.Spr(26, 26);
    sp.rect(11, 3, 3, 23, C.WD2); sp.vline(11, 3, 25, C.WD3); sp.vline(13, 3, 25, C.WD1);
    sp.rect(1, 4, 14, 6, C.WD3); sp.hline(1, 14, 4, C.WD4); sp.hline(1, 14, 9, C.WD1);
    sp.set(0, 6, C.WD3); sp.set(0, 7, C.WD3); sp.set(-1, 6, C.WD3);
    for (const x of [4, 7, 10]) sp.set(x, 7, C.WD0);
    sp.rect(11, 12, 14, 6, C.WD3); sp.hline(11, 24, 12, C.WD4); sp.hline(11, 24, 17, C.WD1);
    sp.set(25, 14, C.WD3); sp.set(25, 15, C.WD3);
    for (const x of [14, 17, 20]) sp.set(x, 15, C.WD0);
    return sp.outline(C.INK0, C.INK1);
  }

  function lamppost(lit) {
    const sp = new E.Spr(10, 30);
    sp.rect(4, 8, 2, 20, C.INK1); sp.set(4, 9, C.M2);
    sp.rect(2, 27, 6, 3, C.M1); sp.hline(2, 7, 27, C.M2);
    sp.rect(1, 0, 8, 9, C.INK1);
    sp.rect(2, 1, 6, 7, lit ? C.GL1 : C.CR1);
    sp.rect(2, 1, 6, 2, lit ? C.GL0 : C.BL1);
    sp.vline(5, 1, 7, C.INK1);
    sp.hline(0, 9, 0, C.M2);
    return sp.outline(C.INK0, C.INK1);
  }

  function barrel() {
    const sp = new E.Spr(11, 13);
    ellipse(sp, 5, 7, 5, 6, C.WD2);
    sp.rect(0, 3, 11, 8, C.WD2);
    sp.vline(0, 3, 10, C.WD3); sp.vline(1, 3, 10, C.WD3); sp.vline(10, 3, 10, C.WD1); sp.vline(9, 3, 10, C.WD1);
    sp.hline(0, 10, 4, C.M2); sp.hline(0, 10, 9, C.M1);
    ellipse(sp, 5, 2, 4, 2, C.WD4); ellipse(sp, 5, 2, 3, 1, C.WD3);
    return sp.outline(C.INK0, C.INK1);
  }

  function crate(n) {
    const sp = new E.Spr(13, 13);
    sp.rect(0, 0, 13, 4, C.WD4); sp.rect(0, 4, 13, 9, C.WD3);
    sp.hline(0, 12, 3, C.WD2);
    sp.vline(0, 4, 12, C.WD4); sp.vline(12, 4, 12, C.WD1);
    for (let k = 0; k < 8; k++) { sp.set(2 + k, 5 + k, C.WD1); sp.set(10 - k, 5 + k, C.WD1); }
    sp.hline(0, 12, 12, C.WD1);
    if (n) { sp.set(3, 1, C.Y0); sp.set(6, 1, C.RED); sp.set(9, 1, C.Y0); }
    return sp.outline(C.INK0, C.INK1);
  }

  function hive() {
    const sp = new E.Spr(13, 17);
    sp.rect(1, 12, 2, 5, C.WD2); sp.rect(10, 12, 2, 5, C.WD2); sp.hline(0, 12, 12, C.WD3);
    for (let r = 0; r < 3; r++) {
      const y = 4 + r * 3;
      sp.rect(1, y, 11, 3, r % 2 ? C.Y0 : C.CR0); sp.hline(1, 11, y, r % 2 ? C.Y1 : C.CR0);
      sp.vline(11, y, y + 2, r % 2 ? C.O0 : C.CR1);
    }
    sp.rect(0, 1, 13, 3, C.R2); sp.hline(0, 12, 1, C.R3); sp.hline(0, 12, 3, C.R1);
    sp.rect(5, 10, 4, 2, C.WD0);
    sp.set(10, 13, C.INK1); sp.set(2, 8, C.INK1);
    return sp.outline(C.INK0, C.INK1);
  }

  function scarecrow() {
    const sp = new E.Spr(22, 34);
    sp.rect(10, 12, 2, 22, C.WD2); sp.vline(10, 12, 33, C.WD3); sp.vline(11, 12, 33, C.WD1);
    sp.rect(2, 16, 18, 2, C.WD2); sp.hline(2, 19, 16, C.WD3);
    sp.rect(6, 16, 10, 10, C.R2); sp.rect(6, 16, 3, 10, C.R3); sp.rect(13, 16, 3, 10, C.R1);
    sp.rect(8, 20, 3, 3, C.BL1); sp.set(9, 21, C.CR0);                                   // patch
    for (const [x, y] of [[0, 17], [1, 19], [2, 18], [19, 18], [20, 20], [21, 17], [8, 26], [10, 27], [12, 26]]) sp.set(x, y, C.Y0);
    sp.set(1, 17, C.Y1); sp.set(20, 18, C.Y1);
    ellipse(sp, 11, 9, 4, 4, C.CR0); sp.rect(12, 6, 3, 6, C.CR1);
    sp.set(9, 8, C.INK1); sp.set(13, 8, C.INK1); sp.hline(9, 13, 11, C.INK1);
    sp.rect(5, 4, 13, 2, C.Y0); sp.rect(8, 0, 7, 5, C.Y1); sp.hline(8, 14, 4, C.O1); sp.hline(5, 17, 5, C.D3);
    return sp.outline(C.INK0, C.INK1);
  }

  function bench(w) {
    const sp = new E.Spr(w, 13);
    sp.rect(0, 0, w, 3, C.WD3); sp.hline(0, w - 1, 0, C.WD4);
    sp.rect(0, 6, w, 3, C.WD3); sp.hline(0, w - 1, 6, C.WD4); sp.hline(0, w - 1, 8, C.WD1);
    for (const x of [1, w - 3]) { sp.rect(x, 3, 2, 3, C.WD1); sp.rect(x, 9, 2, 4, C.WD2); }
    return sp.outline(C.INK0, C.INK1);
  }

  /* A picnic table that reads as one: back bench, a planked top with a checked cloth, plates, a cup and a
     loaf, the thick front edge, A-frame legs with a brace, and the front bench across the legs. */
  function picnic() {
    const W = 44, H = 32;
    const sp = new E.Spr(W, H);
    sp.rect(4, 0, 36, 3, C.WD3); sp.hline(4, 39, 0, C.WD4); sp.rect(4, 3, 36, 2, C.WD2); sp.hline(4, 39, 4, C.WD1);
    for (const lx of [8, 33]) sp.rect(lx, 5, 3, 7, C.WD1);
    for (let y = 7; y < 18; y++) for (let x = 2; x < 42; x++) {
      let c = ((y - 7) % 3 === 2) ? C.WD1 : ((y - 7) % 3 === 0 ? C.WD4 : C.WD3);
      if (x < 4) c = C.WD4; else if (x > 38) c = C.WD2;
      sp.set(x, y, c);
    }
    for (let y = 8; y < 17; y++) for (let x = 8; x < 36; x++) sp.set(x, y, (((x >> 1) + (y >> 1)) % 2 === 0) ? C.R2 : C.CR0);   // checked cloth
    sp.hline(8, 35, 16, C.R1); sp.vline(8, 8, 16, C.R3);
    ellipse(sp, 15, 12, 3, 2, C.CR0); ellipse(sp, 15, 12, 1, 1, C.CR1);                          // plates
    ellipse(sp, 28, 12, 3, 2, C.CR0); ellipse(sp, 28, 12, 1, 1, C.CR1);
    sp.rect(21, 9, 3, 3, C.Y0); sp.hline(21, 23, 9, C.Y1); sp.set(24, 10, C.Y1);                   // cup
    ellipse(sp, 22, 14, 3, 1, C.O1); sp.hline(20, 24, 13, C.Y1);                                 // loaf
    sp.rect(2, 18, 40, 3, C.WD2); sp.hline(2, 41, 18, C.WD3); sp.hline(2, 41, 20, C.WD1);          // thick front edge
    for (const lx of [6, 34]) {                                                                   // A-frame legs
      for (let k = 0; k < 8; k++) { sp.set(lx + (k >> 2), 21 + k, C.WD2); sp.set(lx + 3 - (k >> 2), 21 + k, C.WD1); }
    }
    sp.hline(9, 34, 25, C.WD1);
    sp.rect(3, 23, 38, 3, C.WD4); sp.rect(3, 26, 38, 2, C.WD2); sp.hline(3, 40, 27, C.WD1);        // front bench
    for (const lx of [6, 34]) sp.rect(lx, 28, 3, 4, C.WD1);
    return sp.outline(C.INK0, C.INK1);
  }

  function wheelbarrow() {
    const sp = new E.Spr(26, 14);
    sp.rect(5, 2, 15, 7, C.WD3); sp.hline(5, 19, 2, C.WD4); sp.hline(5, 19, 8, C.WD1);
    sp.rect(6, 3, 13, 2, C.T1);
    for (let k = 0; k < 8; k++) sp.set(18 + k, 7 - (k >> 1), C.WD2);
    ellipse(sp, 5, 10, 3, 3, C.M0); ellipse(sp, 5, 10, 1, 1, C.M2);
    sp.rect(15, 9, 2, 4, C.WD1);
    return sp.outline(C.INK0, C.INK1);
  }

  /* A proper stack: courses of straw that follow the slope, binding ropes, ragged tufts on the
     silhouette and a pitchfork left standing in it. */
  function haystack() {
    const W = 34, H = 32;
    const sp = new E.Spr(W, H);
    const rng = rnd(77);
    const cx = 16;
    const half = (y) => Math.round(2 + Math.pow(y / (H - 1), 0.78) * 13.5);
    for (let y = 0; y < H; y++) {
      const hw = half(y);
      for (let x = cx - hw; x <= cx + hw; x++) {
        const u = (x - cx) / Math.max(1, hw);
        let c = u < -0.38 ? C.Y1 : u < 0.30 ? C.Y0 : C.O1;
        if (u > 0.70) c = C.O0;
        const course = Math.floor(y / 4);
        const strand = (x + y * 2 + (course % 2) * 3) % 8;
        if (strand === 0) c = u < 0.1 ? C.Y0 : C.D4;
        else if (strand === 4 && u < 0.5) c = C.Y1;
        if (y % 4 === 3 && u > -0.2) c = u > 0.45 ? C.O0 : C.D4;
        sp.set(x, y, c);
      }
    }
    for (const ry of [11, 21]) {
      for (let x = cx - half(ry); x <= cx + half(ry); x++) sp.set(x, ry, x < cx ? C.WD3 : C.WD1);
      sp.set(cx - 2, ry + 1, C.WD2); sp.set(cx - 1, ry + 1, C.WD3); sp.set(cx - 2, ry + 2, C.WD1);
    }
    for (let i = 0; i < 22; i++) {
      const y = 3 + Math.floor(rng() * (H - 6)), side = rng() < 0.5 ? -1 : 1;
      const x = cx + side * (half(y) + 1);
      const len = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < len; k++) sp.set(x + side * k, y - (k >> 1) + (rng() < 0.3 ? 1 : 0), k === len - 1 ? C.Y1 : C.Y0);
    }
    sp.set(cx, 0, C.Y1); sp.set(cx - 1, 1, C.Y1); sp.set(cx + 1, 1, C.Y0);
    for (let k = 0; k < 22; k++) sp.set(26 + (k >> 2), 8 + k, k < 21 ? C.WD3 : C.WD1);
    for (const [x, y, c] of [[25, 6, C.M2], [26, 6, C.M2], [27, 6, C.M2], [28, 6, C.M2], [25, 4, C.M3], [27, 4, C.M3], [25, 5, C.M2], [27, 5, C.M2], [29, 7, C.M1]]) sp.set(x, y, c);
    sp.hline(0, W - 1, H - 1, C.D2); sp.hline(2, W - 3, H - 2, C.D3);
    return sp.outline(C.INK0, C.INK1);
  }

  /* ---------- waterside: dock, boat, tent, campfire ---------- */
  /* A pier that reads as one: a long deck with plank seams and nail heads, a front beam with bolts,
     posts standing in the water, a wider T-head with a rope railing, cleats, a lantern pole, a life ring,
     a ladder, and the fisher's stool and bucket. Deck body at rows o+5..o+14, head at rows o..o+19. */
  function dock(len, lit) {
    const o = 7, headW = 24, bodyLen = len - headW;
    const sp = new E.Spr(len, 38);
    const post = (px, top) => {
      for (let y = top; y < top + 9; y++) { sp.set(px, y, C.WD3); sp.set(px + 1, y, C.WD2); sp.set(px + 2, y, C.WD1); }
      sp.set(px - 1, top + 8, C.W4); sp.set(px + 3, top + 8, C.W3); sp.set(px, top + 9, C.W3); sp.set(px + 1, top + 9, C.W4); sp.set(px + 2, top + 9, C.W3);
    };
    for (let px = 3; px < bodyLen - 6; px += 16) post(px, o + 19);
    for (const px of [bodyLen + 3, len - 7]) post(px, o + 24);
    const deck = (x0, x1, y0, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = Math.floor((x - x0) / 5), px = (x - x0) % 5;
        let c = (k % 3 === 1) ? C.WD2 : C.WD3;
        if (k % 7 === 4) c = C.WD4;
        if (px === 4) c = C.WD1;
        if (y === y0) c = (px === 4) ? C.WD2 : C.WD4;
        if (y === y1) c = C.WD2;
        sp.set(x, y, c);
      }
      for (let x = x0 + 2; x <= x1; x += 5) { sp.set(x, y0 + 2, C.WD0); sp.set(x, y1 - 2, C.WD0); }
    };
    const beam = (x0, x1, y) => {
      for (let x = x0; x <= x1; x++) { sp.set(x, y, C.WD3); sp.set(x, y + 1, C.WD2); sp.set(x, y + 2, C.WD2); sp.set(x, y + 3, C.WD1); }
      for (let x = x0 + 5; x < x1; x += 10) { sp.set(x, y + 1, C.M2); sp.set(x, y + 2, C.M0); }
    };
    deck(0, bodyLen - 1, o + 5, o + 14); beam(0, bodyLen - 1, o + 15);
    deck(bodyLen, len - 1, o, o + 19); beam(bodyLen, len - 1, o + 20);
    for (const cx of [10, bodyLen - 14]) {                                           // mooring cleats with a coil of rope
      sp.rect(cx, o + 11, 6, 3, C.WD1); sp.set(cx + 1, o + 11, C.WD3); sp.set(cx + 4, o + 11, C.WD3);
      ellipse(sp, cx + 8, o + 11, 2, 1, C.CR1); sp.set(cx + 8, o + 11, C.CR0);
    }
    for (const cx of [bodyLen + 2, len - 4]) {                                       // railing posts and a rope between them
      for (let y = o - 7; y < o + 1; y++) { sp.set(cx, y, C.WD3); sp.set(cx + 1, y, C.WD2); sp.set(cx + 2, y, C.WD1); }
      sp.hline(cx - 1, cx + 3, o - 8, C.WD4);
    }
    for (let x = bodyLen + 5; x < len - 5; x++) sp.set(x, o - 5 + (Math.abs(x - (bodyLen + len) / 2) < 5 ? 1 : 0), C.CR1);
    ellipse(sp, len - 6, o - 3, 3, 3, C.R2); ellipse(sp, len - 6, o - 3, 1, 1, C.CR0); sp.set(len - 6, o - 6, C.CR0); sp.set(len - 6, o, C.CR0);   // life ring
    sp.rect(bodyLen + 3, o + 3, 6, 5, C.WD2); sp.hline(bodyLen + 3, bodyLen + 8, o + 3, C.WD4);                                              // stool
    sp.vline(bodyLen + 3, o + 8, o + 10, C.WD1); sp.vline(bodyLen + 8, o + 8, o + 10, C.WD1);
    sp.rect(bodyLen + 12, o + 9, 5, 5, C.M2); sp.hline(bodyLen + 12, bodyLen + 16, o + 9, C.M3); sp.hline(bodyLen + 12, bodyLen + 16, o + 13, C.M0);
    sp.set(bodyLen + 13, o + 8, C.O1); sp.set(bodyLen + 14, o + 7, C.O0); sp.set(bodyLen + 15, o + 8, C.O1);                               // fish tail
    for (let y = o + 24; y < o + 33; y++) { sp.set(bodyLen + 8, y, C.WD3); sp.set(bodyLen + 12, y, C.WD2); }                                // ladder into the water
    for (let y = o + 25; y < o + 33; y += 3) sp.hline(bodyLen + 8, bodyLen + 12, y, C.WD4);
    sp.vline(len - 12, o - 14, o - 1, C.WD1); sp.vline(len - 11, o - 14, o - 1, C.WD2);                                                      // lantern pole
    sp.rect(len - 14, o - 19, 6, 6, C.INK1); sp.rect(len - 13, o - 18, 4, 4, lit ? C.GL1 : C.CR1); sp.set(len - 12, o - 17, lit ? C.GL0 : C.BL1);
    sp.hline(len - 15, len - 8, o - 20, C.M2);
    return sp.outline(C.INK0, C.INK1);
  }

  /* A rowboat in the same 3/4 view as everything else: the painted hull side as a crescent, the near
     gunwale on top of it, and just above that the far gunwale with the floor and thwarts visible
     between them. The sheer rises toward bow and stern; two oars rest over the side into the water. */
  function boat() {
    const W = 42, H = 22;
    const sp = new E.Spr(W, H);
    const u = (x) => (x - 20.5) / 20.5;
    const g = (x) => 5 + Math.round(3 * (1 - u(x) * u(x)));                                 // near gunwale: ends high, middle low
    const depth = (x) => Math.round(8 * Math.pow(Math.max(0, 1 - u(x) * u(x)), 0.55));       // hull depth below it
    for (let x = 0; x < W; x++) {
      const uu = u(x);
      if (Math.abs(uu) > 1) continue;
      const gy = g(x), d = depth(x);
      const far = gy - 4 + Math.round(2 * uu * uu);                                          // far gunwale; the band narrows at the ends
      for (let y = far + 1; y < gy; y++) sp.set(x, y, (y - far) % 2 === 0 ? C.WD0 : C.WD1);  // floor seen between the gunwales
      sp.set(x, far, uu < 0.2 ? C.WD4 : C.WD3);
      sp.set(x, gy, uu < 0.35 ? C.WD4 : C.WD3);                                              // near gunwale
      sp.set(x, gy + 1, uu < 0.5 ? C.CR0 : C.CR1);                                           // white stripe
      for (let y = gy + 2; y <= gy + d; y++) {
        const r = y - (gy + 2), last = y === gy + d;
        let c = uu < -0.3 ? C.R3 : uu < 0.4 ? C.R2 : C.R1;
        if (r === 3 && d > 5) c = uu < 0.4 ? C.R1 : C.R0;                                    // plank seam
        if (last || r >= d - 2 && d > 3) c = uu < 0.1 ? C.R1 : C.R0;                         // keel shade
        sp.set(x, y, c);
      }
    }
    for (const sx of [11, 19, 27]) {                                                          // thwarts
      const gy = g(sx), far = gy - 4 + Math.round(2 * u(sx) * u(sx));
      for (let y = far + 1; y < gy; y++) { sp.set(sx, y, C.WD3); sp.set(sx + 1, y, C.WD2); }
      sp.set(sx, far + 1, C.WD4); sp.set(sx + 1, far + 1, C.WD3);
    }
    sp.set(1, g(1) - 2, C.CR0); sp.set(0, g(0) - 1, C.CR0); sp.set(1, g(1) - 1, C.R3);       // stem post at the bow
    sp.set(2, g(2) + 2, C.M2);                                                                // bow ring for the mooring line
    for (const [ox, dir] of [[14, -1], [26, 1]]) {                                            // oars resting over the side
      const gy = g(ox);
      sp.set(ox, gy - 1, C.M2);
      for (let k = 0; k < 12; k++) sp.set(ox + dir * Math.floor(k / 2), gy - 1 + k, k < 2 ? C.WD3 : C.WD4);
      sp.rect(ox + dir * 6 - (dir < 0 ? 2 : 0), gy + 11, 3, 3, C.WD3); sp.set(ox + dir * 6 - (dir < 0 ? 2 : 0), gy + 11, C.WD4);
    }
    sp.outline(C.INK0, C.INK1);
    for (let x = 3; x < W - 3; x++) {                                                         // ripples where the hull meets the water
      const y = g(x) + depth(x) + 2;
      if (x % 3 === 0) sp.set(x, y, C.W4); else if (x % 5 === 1) sp.set(x, y, C.W3);
    }
    return sp;
  }

  function tent() {
    const sp = new E.Spr(46, 34);
    for (let y = 0; y < 30; y++) {
      const hw = Math.min(21, 1 + Math.round(y * 0.72));
      for (let x = 23 - hw; x <= 23 + hw; x++) {
        const u = (x - 23) / Math.max(1, hw);
        let c = u < 0 ? C.CR0 : C.CR1;
        if (Math.abs(u) > 0.84) c = u < 0 ? C.R3 : C.R2;
        if (y < 2) c = C.CR0;
        sp.set(x, y, c);
      }
    }
    for (let y = 8; y < 30; y++) {                                                       // door flap
      const hw = Math.round((y - 8) * 0.34) + 1;
      for (let x = 23 - hw; x <= 23 + hw; x++) sp.set(x, y, y < 12 ? C.WD1 : C.WD0);
    }
    sp.vline(23, 12, 29, C.WD1);
    sp.vline(23, -1, 1, C.WD3);
    sp.hline(0, 45, 30, C.D1); sp.hline(1, 44, 31, C.D2);
    for (const x of [-1, 46]) { sp.set(x, 31, C.WD2); sp.set(x, 32, C.WD1); }
    return sp.outline(C.INK0, C.INK1);
  }

  function campfire() {
    const sp = new E.Spr(22, 20);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.283;
      const x = 11 + Math.round(Math.cos(a) * 8), y = 14 + Math.round(Math.sin(a) * 4);
      sp.rect(x - 1, y - 1, 3, 3, i % 2 ? C.M2 : C.M1); sp.set(x - 1, y - 1, C.M3);
    }
    for (let k = 0; k < 8; k++) { sp.set(6 + k, 15 - (k >> 2), C.WD2); sp.set(15 - k, 15 - (k >> 2), C.WD1); }
    const flame = [[0, 0, C.RED], [-1, 1, C.O0], [0, 1, C.O1], [1, 1, C.O0], [-1, 2, C.O1], [0, 2, C.Y0], [1, 2, C.O1], [0, -1, C.Y1], [0, 3, C.Y1], [-2, 3, C.O0], [2, 3, C.O0]];
    for (const [dx, dy, c] of flame) sp.set(11 + dx, 8 + dy + 2, c);
    sp.set(11, 8, C.O1); sp.set(11, 7, C.Y1);
    return sp.outline(C.INK0, C.INK1);
  }

  function logSeat(w) {
    const sp = new E.Spr(w, 7);
    sp.rect(2, 0, w - 4, 6, C.WD2); sp.hline(2, w - 3, 0, C.WD4); sp.hline(2, w - 3, 5, C.WD1);
    ellipse(sp, 2, 3, 2, 3, C.WD4); ellipse(sp, 2, 3, 1, 1, C.WD3);
    ellipse(sp, w - 3, 3, 2, 3, C.WD3);
    return sp.outline(C.INK0, C.INK1);
  }

  function pumpkin(seed) {
    const rng = rnd(seed);
    const sp = new E.Spr(11, 10);
    E.blob(sp, [{ x: 5, y: 6, r: 4.2 }], { l: C.O1, m: C.O0, d: C.R2, rim: C.R1 }, rng);
    sp.vline(5, 1, 3, C.CG0); sp.set(6, 1, C.CG1);
    sp.vline(5, 3, 9, C.R2);
    sp.set(8, 2, C.CG1); sp.set(9, 3, C.CG0); sp.set(1, 3, C.CG1); sp.set(0, 4, C.CG0);
    return sp;
  }

  /* ---------- animals (side view, facing right; flip for left) ---------- */
  function mirror(sp, flip) { return (flip ? sp.flipX() : sp).outline(C.INK0, C.INK1); }

  function chicken(variant, flip) {
    const sp = new E.Spr(12, 11);
    const lit = variant ? C.WD4 : C.CR0, mid = variant ? C.WD3 : C.CR0, sh = variant ? C.WD2 : C.CR1;
    ellipse(sp, 5, 6, 4, 3, mid); ellipse(sp, 4, 5, 3, 2, lit);
    sp.hline(2, 8, 8, sh); sp.set(8, 7, sh); sp.set(1, 7, sh);
    for (const [x, y] of [[0, 3], [1, 3], [1, 4], [0, 4], [2, 4], [0, 2]]) sp.set(x, y, variant ? C.WD2 : C.CR1);
    sp.set(2, 6, sh); sp.set(3, 6, sh); sp.set(4, 7, sh);
    ellipse(sp, 9, 3, 2, 2, lit);
    sp.set(8, 0, C.RED); sp.set(9, -1, C.RED); sp.set(9, 0, C.RED);
    sp.set(11, 3, C.O1); sp.set(10, 4, C.RED); sp.set(10, 3, C.INK1);
    sp.vline(5, 9, 10, C.O0); sp.vline(7, 9, 10, C.O0); sp.set(4, 10, C.O0); sp.set(8, 10, C.O0);
    return mirror(sp, flip);
  }

  /* Cow: far legs behind, rounded body with hard-edged patches, udder, near legs with hooves, neck and a head
     with pink muzzle, horns, ear, eye glint and a bell. variant 0 = black and white, 1 = brown and white. */
  function cow(variant, flip) {
    const sp = new E.Spr(40, 27);
    const hol = variant === 0;
    const base = hol ? { l: C.CR0, m: C.CR0, d: C.CR1, rim: C.M3 } : { l: C.WD4, m: C.WD3, d: C.WD2, rim: C.WD1 };
    const patch = hol ? { l: C.M1, m: C.INK1, d: C.INK0 } : { l: C.CR0, m: C.CR0, d: C.CR1 };
    const tone = (y, x) => (y <= 5 ? 'l' : y >= 14 || x >= 27 ? 'd' : 'm');
    const body = (x, y) => {
      if (x < 5 || x > 29 || y < 4 || y > 16) return false;
      const dx = Math.min(x - 5, 29 - x), dy = Math.min(y - 4, 16 - y);
      return !(dx < 3 && dy < 3 && (3 - dx) * (3 - dx) + (3 - dy) * (3 - dy) > 9);
    };
    for (const lx of [12, 22]) { sp.rect(lx, 14, 3, 9, base.d); sp.rect(lx, 23, 3, 2, C.WD0); }                      // far legs
    for (let y = 4; y <= 16; y++) for (let x = 5; x <= 29; x++) {
      if (!body(x, y)) continue;
      const tn = tone(y, x);
      let c = base[tn];
      if (E.noise2(x / 3.3, y / 3.0, hol ? 5 : 9) > 0.60) c = patch[tn];
      sp.set(x, y, c);
    }
    sp.hline(7, 27, 4, base.l);
    sp.shadeEllipse(16, 17, 3.2, 2.2, { l: C.B2, m: C.B1, d: C.B0 });                                                 // udder
    for (const tx of [14, 16, 18]) sp.set(tx, 19, C.B0);
    for (const [lx, sh] of [[8, 0], [25, 0]]) {                                                                         // near legs
      sp.shadeRect(lx, 15, 3, 8, { l: base.l, m: base.m, d: base.d });
      sp.hline(lx, lx + 2, 19, base.d);                                                                                // knee
      sp.rect(lx, 23, 3, 2, C.WD0); sp.set(lx, 23, C.WD1);
    }
    sp.shadeRect(26, 6, 5, 9, { l: base.l, m: base.m, d: base.d });                                                    // neck
    sp.rect(26, 12, 5, 1, C.R2); sp.rect(28, 13, 2, 2, C.Y0); sp.set(28, 13, C.Y1);                                    // collar and bell
    sp.shadeEllipse(33, 9, 4.8, 5, { l: base.l, m: base.m, d: base.d });                                               // head
    if (E.noise2(7, 3, variant) > 0.2) { sp.rect(31, 4, 4, 2, patch.m); sp.set(31, 4, patch.l); }                      // forehead patch
    sp.shadeEllipse(36, 12, 3, 3.2, { l: C.B2, m: C.B1, d: C.B0 });                                                    // muzzle
    sp.set(37, 12, C.B0); sp.set(37, 13, C.B0); sp.hline(34, 37, 15, C.B0);
    sp.set(32, 8, C.INK1); sp.set(33, 8, C.INK1); sp.set(32, 7, C.CR0);                                                // eye with a glint
    sp.rect(28, 5, 4, 3, base.d); sp.set(29, 6, C.B1); sp.set(28, 5, base.m);                                           // ear
    for (const [x, y] of [[31, 3], [31, 2], [32, 1], [36, 3], [36, 2], [37, 1]]) sp.set(x, y, C.CR0);                  // horns
    sp.set(32, 1, C.CR1); sp.set(37, 1, C.CR1);
    for (const [x, y] of [[4, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [3, 11], [4, 12]]) sp.set(x, y, base.d);    // tail
    sp.shadeEllipse(4, 14, 1.6, 2.4, { l: patch.l, m: patch.m, d: patch.d });
    return mirror(sp, flip);
  }

  /* Sheep: a woolly body built from clumps (lit top-left, soft warm shadow underneath), a small
     dark face set low in front of it, a wool fringe over the forehead, ears, thin dark legs. */
  function sheep(flip) {
    const sp = new E.Spr(24, 17);
    const wool = { l: C.CR0, m: C.CR0, d: C.CR1, rim: C.WD4 };
    E.blob(sp, [
      { x: 6, y: 8, r: 4.2 }, { x: 10, y: 6, r: 4.6 }, { x: 14, y: 7, r: 4.4 },
      { x: 8, y: 10, r: 4 }, { x: 12, y: 10, r: 4 }, { x: 4, y: 10, r: 2.8 }, { x: 15, y: 10, r: 3 },
    ], wool, rnd(14));
    for (const [x, y] of [[8, 3], [11, 2], [13, 3]]) { sp.set(x, y, C.CR0); sp.set(x + 1, y, C.CR0); sp.set(x, y + 1, C.CR0); }   // top tufts
    sp.hline(6, 15, 13, C.CR1); sp.hline(7, 14, 14, C.WD4);                                                                  // belly shade
    ellipse(sp, 19, 9, 2, 3, C.WD2); ellipse(sp, 18, 8, 2, 3, C.WD1);                                                      // face
    sp.rect(19, 10, 3, 2, C.WD3); sp.set(21, 10, C.B0); sp.set(20, 11, C.WD1);                                              // muzzle, nose
    sp.set(18, 8, C.CR0); sp.set(18, 9, C.INK1);                                                                            // eye with a glint
    sp.rect(16, 5, 4, 3, C.CR0); sp.set(17, 4, C.CR0); sp.set(18, 4, C.CR0); sp.hline(16, 19, 7, C.CR1);                    // fringe over the forehead
    sp.rect(15, 7, 2, 2, C.WD1); sp.set(14, 8, C.WD0);                                                                       // ear
    for (const lx of [6, 9, 13, 16]) { sp.rect(lx, 13, 2, 3, C.WD1); sp.set(lx, 16, C.WD0); sp.set(lx + 1, 16, C.WD0); }
    return mirror(sp, flip);
  }

  /* Pig: shaded body with a lighter back and a darker belly, floppy ear, disc snout with nostrils, curly tail,
     short legs with dark hooves (far pair behind), a splash of mud. */
  function pig(flip) {
    const sp = new E.Spr(30, 18);
    for (const lx of [9, 19]) { sp.rect(lx, 11, 3, 5, C.B0); sp.rect(lx, 16, 3, 1, C.WD1); }
    sp.shadeEllipse(12, 8, 10.5, 6.4, { l: C.B2, m: C.B1, d: C.B0 });
    sp.hline(5, 18, 13, C.B0);
    sp.shadeEllipse(23, 8, 5.2, 5.4, { l: C.B2, m: C.B1, d: C.B0 });
    sp.shadeEllipse(27, 10, 2.2, 3, { l: C.B2, m: C.B2, d: C.B1 });
    sp.set(27, 9, C.B0); sp.set(27, 11, C.B0); sp.set(28, 10, C.B0);
    sp.set(24, 6, C.INK1); sp.set(24, 5, C.CR0);
    for (const [x, y] of [[20, 2], [21, 2], [22, 3], [19, 3], [20, 4], [21, 4]]) sp.set(x, y, C.B0);
    sp.set(20, 3, C.B1);
    for (const [x, y] of [[1, 4], [0, 3], [0, 2], [1, 1], [2, 2], [2, 3]]) sp.set(x, y, C.B0);
    for (const lx of [5, 16]) { sp.shadeRect(lx, 11, 3, 5, { l: C.B1, m: C.B1, d: C.B0 }); sp.rect(lx, 16, 3, 1, C.WD0); sp.set(lx, 16, C.WD1); }
    for (const [x, y] of [[9, 7], [10, 7], [10, 8], [11, 6], [8, 9]]) sp.set(x, y, C.T1);
    return mirror(sp, flip);
  }

  function dog(flip) {
    const sp = new E.Spr(24, 16);
    sp.rect(5, 6, 12, 5, C.WD3); sp.hline(5, 16, 6, C.WD4); sp.hline(5, 16, 10, C.WD2);
    sp.rect(5, 9, 5, 2, C.CR0); sp.rect(13, 7, 3, 3, C.WD1);                                    // white belly, a dark patch
    sp.rect(15, 3, 6, 6, C.WD3); sp.hline(15, 20, 3, C.WD4);                                    // head
    sp.rect(19, 6, 4, 3, C.WD4); sp.set(22, 6, C.INK1); sp.set(22, 7, C.INK1); sp.hline(20, 21, 9, C.B1);   // snout, nose, tongue
    sp.set(18, 5, C.INK1);                                                                       // eye
    sp.rect(14, 3, 3, 5, C.WD1); sp.set(14, 3, C.WD0);                                           // floppy ear
    sp.rect(14, 8, 2, 2, C.R2);                                                                  // collar
    for (const [x, y] of [[4, 6], [3, 5], [3, 4], [2, 3], [2, 2], [1, 1]]) sp.set(x, y, C.WD3);   // tail up
    sp.set(1, 0, C.CR0); sp.set(2, 1, C.CR0);
    for (const lx of [6, 8, 14, 16]) { sp.rect(lx, 11, 2, 4, lx < 10 ? C.WD2 : C.WD3); sp.hline(lx, lx + 1, 15, C.CR0); }
    return mirror(sp, flip);
  }

  /* Cats: four coats, three poses. Volume from shaded ellipses, with real faces (ears with pink insides,
     eyes with slit pupils, nose, whiskers), white socks and chest, tabby stripes or calico patches. */
  const CAT_COATS = [
    { l: C.O1, m: C.O0, d: C.R2, chest: C.CR0, eye: C.CG2, tab: true },
    { l: C.M3, m: C.M2, d: C.M1, chest: C.CR0, eye: C.Y1, tab: true },
    { l: C.M1, m: C.INK1, d: C.INK0, chest: C.INK1, eye: C.Y1, tab: false },
    { l: C.CR0, m: C.CR0, d: C.CR1, chest: C.CR0, eye: C.CG1, tab: false, calico: true },
  ];
  function catFace(sp, v, hx, hy, closed) {
    sp.shadeEllipse(hx, hy, 4.2, 3.7, { l: v.l, m: v.m, d: v.d });
    for (const [x, y] of [[hx - 4, hy - 3], [hx - 3, hy - 3], [hx - 3, hy - 4], [hx + 3, hy - 3], [hx + 2, hy - 3], [hx + 2, hy - 4]]) sp.set(x, y, v.m);   // ears
    sp.set(hx - 3, hy - 3, C.B1); sp.set(hx + 2, hy - 3, C.B1);
    if (closed) { sp.hline(hx - 2, hx - 1, hy, C.INK1); sp.hline(hx + 1, hx + 2, hy, C.INK1); }
    else { for (const ex of [hx - 2, hx + 1]) { sp.set(ex, hy - 1, v.eye); sp.set(ex + 1, hy - 1, v.eye); sp.set(ex, hy, C.INK1); sp.set(ex + 1, hy, v.eye); } }
    sp.set(hx, hy + 1, C.B1); sp.hline(hx - 1, hx + 1, hy + 2, v.chest === C.INK1 ? C.M0 : v.chest);
    sp.set(hx - 5, hy + 1, C.CR1); sp.set(hx - 6, hy + 1, C.CR1); sp.set(hx + 4, hy + 1, C.CR1); sp.set(hx + 5, hy + 1, C.CR1);    // whiskers
    if (v.tab) { sp.vline(hx - 1, hy - 3, hy - 2, v.d); sp.vline(hx, hy - 3, hy - 2, v.d); sp.vline(hx + 1, hy - 3, hy - 2, v.d); }
    if (v.calico) { sp.set(hx + 1, hy - 2, C.O0); sp.set(hx + 2, hy - 1, C.O0); sp.set(hx - 3, hy - 2, C.INK1); }
  }
  function cat(variant, pose, flip, f) {
    f = f || 0;
    const v = CAT_COATS[variant % 4];
    const sp = new E.Spr(22, 23);
    if (pose === 'loaf') {
      sp.shadeEllipse(8, 11, 7.5, 4.6, { l: v.l, m: v.m, d: v.d });
      catFace(sp, v, 15, 8, false);
      sp.rect(11, 14, 3, 2, v.chest); sp.rect(14, 14, 3, 2, v.chest);                                    // tucked paws
      for (let k = 0; k < 8; k++) sp.set(1 + k, 15 + (k > 5 ? -1 : 0), k % 2 ? v.d : v.m);              // tail along the ground
      if (v.tab) for (const x of [3, 5, 7, 9]) sp.vline(x, 8, 9, v.d);
      if (v.calico) for (const [x, y, c] of [[4, 10, C.O0], [5, 10, C.O0], [8, 9, C.INK1], [9, 9, C.INK1], [7, 12, C.O1]]) sp.set(x, y, c);
    } else if (pose === 'sleep') {
      sp.shadeEllipse(9, 11, 8, f ? 5 : 4.2, { l: v.l, m: v.m, d: v.d });                                // breathing
      catFace(sp, v, 13, 10, true);
      for (let k = 0; k < 9; k++) sp.set(2 + k, 15 - (k > 6 ? 1 : 0), k % 2 ? v.d : v.m);              // tail wrapped round
      if (v.tab) for (const x of [4, 6, 8]) sp.vline(x, 8, 10, v.d);
      if (v.calico) for (const [x, y, c] of [[5, 9, C.O0], [6, 9, C.O0], [9, 8, C.INK1], [10, 9, C.INK1]]) sp.set(x, y, c);
    } else if (pose === 'groom') {
      // seated, head bent down to lick a raised front paw
      sp.shadeEllipse(6, 15, 5.6, 5, { l: v.l, m: v.m, d: v.d });
      sp.shadeEllipse(9, 11, 3.8, 5.8, { l: v.l, m: v.m, d: v.d });
      sp.shadeEllipse(12, 12, 1.9, 3, { l: v.chest, m: v.chest, d: v.chest });
      sp.rect(11, 15, 2, 4, v.m); sp.rect(11, 18, 2, 2, v.chest); sp.hline(10, 13, 20, v.chest);
      sp.rect(15, 9, 2, 6, v.m); sp.vline(15, 9, 14, v.l); sp.rect(15, 8, 2, 2, v.chest);
      sp.shadeEllipse(14, 8, 4.2, 3.6, { l: v.l, m: v.m, d: v.d });
      for (const [x, y] of [[10, 4], [10, 5], [11, 5], [17, 4], [17, 5], [16, 5]]) sp.set(x, y, v.m);
      sp.set(11, 5, C.B1); sp.set(16, 5, C.B1);
      sp.hline(12, 13, 8, C.INK1); sp.hline(15, 16, 8, C.INK1);
      sp.set(17, 9, C.B1); if (f) { sp.set(16, 10, C.B1); sp.set(17, 10, C.B1); }
      for (let k = 0; k < 15; k++) sp.set(1 + k, 21 - (k > 12 ? 1 : 0) - (k > 13 ? 1 : 0), k % 3 === 2 ? v.d : v.m);
      sp.set(0, 20, v.m);
      if (v.tab) for (const [x, y] of [[3, 12], [3, 15], [4, 17], [7, 8], [7, 11]]) sp.hline(x, x + 1, y, v.d);
      if (v.calico) for (const [x, y, c] of [[3, 13, C.O0], [4, 14, C.O0], [13, 6, C.INK1], [8, 9, C.INK1]]) sp.set(x, y, c);
    } else {
      // seated, seen from the side with the head turned toward us: big haunch, upright back, legs straight,
      // tail laid round the front paws with the tip lifted
      sp.shadeEllipse(6, 15, 5.6, 5, { l: v.l, m: v.m, d: v.d });                                        // haunch
      sp.shadeEllipse(9, 10, 3.8, 6.6, { l: v.l, m: v.m, d: v.d });                                      // back and flank
      sp.shadeEllipse(12, 11, 1.9, 3.4, { l: v.chest, m: v.chest, d: v.chest });                          // chest
      sp.rect(11, 14, 2, 5, v.m); sp.vline(11, 14, 18, v.l); sp.rect(14, 14, 2, 5, v.m); sp.vline(15, 14, 18, v.d);   // front legs
      sp.rect(11, 18, 2, 2, v.chest); sp.rect(14, 18, 2, 2, v.chest); sp.hline(10, 16, 20, v.chest);                    // socks
      sp.shadeEllipse(13, 5, 4.4, 3.8, { l: v.l, m: v.m, d: v.d });                                      // head
      for (const [x, y] of [[9, 1], [9, 2], [10, 2], [10, 1], [15, 1], [15, 2], [14, 2], [14, 1]]) sp.set(x, y, v.m);   // upright ears
      sp.set(10, 1, C.B1); sp.set(14, 1, C.B1); sp.set(9, 0, v.m); sp.set(16, 0, v.m);
      if (f === 3) { sp.hline(11, 12, 5, C.INK1); sp.hline(14, 15, 5, C.INK1); }                                              // blink
      else { sp.set(11, 5, v.eye); sp.set(12, 5, v.eye); sp.set(11, 6, C.INK1); sp.set(15, 5, v.eye); sp.set(15, 6, C.INK1); }   // eyes with slit pupils
      sp.set(16, 7, C.B1); sp.hline(14, 16, 8, v.chest === C.INK1 ? C.M0 : v.chest);
      sp.hline(17, 19, 7, C.CR1); sp.hline(17, 19, 8, C.CR1); sp.hline(8, 10, 7, C.CR1);                                      // whiskers
      for (let k = 0; k < 15; k++) sp.set(1 + k, 21 - (k > 12 ? 1 : 0) - (k > 13 ? 1 : 0), k % 3 === 2 ? v.d : v.m);          // tail
      sp.set(0, 20, v.m); sp.set(16, 19, v.d);
      if (f === 1) { sp.set(16, 19, v.m); sp.set(17, 18, v.d); }                                         // tail tip swishes
      else if (f === 2) { sp.set(16, 20, v.m); sp.set(17, 19, v.m); sp.set(18, 18, v.d); }
      if (v.tab) {
        for (const x of [11, 13, 15]) sp.vline(x, 2, 3, v.d);                                            // forehead
        for (const [x, y] of [[3, 12], [3, 15], [4, 17], [7, 7], [7, 10], [6, 13]]) sp.hline(x, x + 1, y, v.d);
      }
      if (v.calico) for (const [x, y, c] of [[3, 13, C.O0], [4, 14, C.O0], [12, 3, C.INK1], [7, 8, C.INK1], [8, 8, C.INK1], [6, 17, C.O1], [14, 3, C.O0]]) sp.set(x, y, c);
    }
    return mirror(sp, flip);
  }

  /* A farm wagon heaped with hay. */
  function wagon() {
    const sp = new E.Spr(44, 28);
    for (let x = 6; x < 36; x++) for (let y = 3; y < 10; y++) {                                    // heaped hay
      const top = 3 + Math.round(3 * Math.abs((x - 21) / 15) * 1.2);
      if (y >= top) sp.set(x, y, (x + y * 2) % 7 === 0 ? C.D4 : y < top + 2 ? C.Y1 : C.Y0);
    }
    sp.rect(4, 10, 34, 8, C.WD3); sp.hline(4, 37, 10, C.WD4); sp.hline(4, 37, 17, C.WD1);
    for (let x = 8; x < 36; x += 6) sp.vline(x, 11, 16, C.WD1);
    sp.rect(4, 10, 2, 8, C.WD4); sp.rect(36, 10, 2, 8, C.WD2);
    for (const cx of [11, 30]) {                                                                   // wheels
      ellipse(sp, cx, 20, 6, 6, C.WD2); ellipse(sp, cx, 20, 5, 5, C.WD3); ellipse(sp, cx, 20, 1, 1, C.M2);
      for (let k = -4; k <= 4; k++) { sp.set(cx + k, 20, C.WD1); sp.set(cx, 20 + k, C.WD1); sp.set(cx + (k >> 1) * 1, 20 + k, C.WD1); }
      for (let a = 0; a < 6.283; a += 0.4) sp.set(cx + Math.round(Math.cos(a) * 6), 20 + Math.round(Math.sin(a) * 6), C.M1);
    }
    for (let k = 0; k < 8; k++) sp.set(3 - (k >> 1), 14 + (k >> 1), C.WD2);                       // shaft
    sp.rect(0, 18, 3, 2, C.WD1);
    return sp.outline(C.INK0, C.INK1);
  }

  function sunflower(seed) {
    const rng = rnd(seed);
    const sp = new E.Spr(11, 20);
    sp.vline(5, 9, 19, C.CG0); sp.vline(6, 9, 19, C.CG1);
    sp.set(3, 14, C.CG2); sp.set(2, 13, C.CG1); sp.set(4, 13, C.CG1); sp.set(8, 12, C.CG2); sp.set(9, 11, C.CG1); sp.set(7, 11, C.CG1);
    ellipse(sp, 5, 5, 4, 4, C.Y0);
    for (let a = 0; a < 6.283; a += 0.55) sp.set(5 + Math.round(Math.cos(a) * 4.4), 5 + Math.round(Math.sin(a) * 4.4), a < 3.3 ? C.Y1 : C.O1);
    ellipse(sp, 5, 5, 2, 2, C.WD1); sp.set(4, 4, C.WD2); sp.set(6, 6, C.WD0);
    if (rng() < 0.5) sp.set(2, 12, C.CG2);
    return sp.outline(C.INK0, C.INK1);
  }

  /* A round bale on its side: the circular end face shows rings of straw, with a net of twine. */
  function roundBale() {
    const sp = new E.Spr(18, 15);
    sp.shadeEllipse(9, 7, 8, 6.6, { l: C.Y1, m: C.Y0, d: C.O1 });
    for (const [r, c] of [[5.6, C.O1], [3.6, C.D4], [1.8, C.Y1]]) {
      for (let a = 0; a < 6.283; a += 0.12) sp.set(Math.round(9 + Math.cos(a) * r), Math.round(7 + Math.sin(a) * r * 0.85), c);
    }
    sp.set(9, 7, C.D3);
    for (let a = 0; a < 6.283; a += 0.9) { sp.set(Math.round(9 + Math.cos(a) * 7), Math.round(7 + Math.sin(a) * 5.8), C.WD3); }
    sp.hline(2, 15, 13, C.D3);
    return sp.outline(C.INK0, C.INK1);
  }
  function milkCan() {
    const sp = new E.Spr(9, 14);
    sp.shadeRect(1, 5, 7, 8, { l: C.M3, m: C.M2, d: C.M1 });
    sp.rect(2, 3, 5, 2, C.M2); sp.hline(2, 6, 3, C.M3);
    sp.rect(1, 1, 7, 2, C.M2); sp.hline(1, 7, 1, C.M3); sp.set(7, 2, C.M1);
    sp.hline(1, 7, 8, C.M1); sp.hline(1, 7, 11, C.M1);
    sp.set(0, 6, C.M2); sp.set(0, 7, C.M2); sp.set(8, 6, C.M1); sp.set(8, 7, C.M1);
    sp.rect(3, 9, 3, 2, C.R2);
    return sp.outline(C.INK0, C.INK1);
  }
  function birdhouse() {
    const sp = new E.Spr(14, 26);
    sp.shadeRect(6, 9, 3, 17, { l: C.WD3, m: C.WD2, d: C.WD1 });
    sp.shadeRect(2, 3, 11, 8, { l: C.WD4, m: C.WD3, d: C.WD2 });
    for (let y = 0; y < 4; y++) for (let x = 1 + y * 0; x < 14 - y * 0; x++) { const cut = Math.max(0, 3 - y); if (x >= 1 + cut && x <= 13 - cut) sp.set(x, y, y === 0 ? C.R3 : y === 3 ? C.R1 : C.R2); }
    ellipse(sp, 7, 7, 1, 1, C.INK1); sp.hline(5, 9, 10, C.WD4);
    return sp.outline(C.INK0, C.INK1);
  }

  global.Props = {
    oak, apple, birch, pine, bush, well, woodpile, stump, mailbox, signpost, lamppost, barrel, crate, hive,
    scarecrow, bench, picnic, wheelbarrow, haystack, dock, boat, tent, campfire, logSeat, pumpkin,
    chicken, cow, sheep, pig, dog, cat, wagon, sunflower, roundBale, milkCan, birdhouse,
    foliage,
  };
})(window);
