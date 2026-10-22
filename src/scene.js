/* v2 phase 1: top-down farm ground. Meadow, golden paths, pond, forest border.
   Buildings, plots and animals arrive in later phases; LAYOUT already reserves their space. */
(function (global) {
  'use strict';

  const E = global.Engine;
  const C = global.Palette.C;
  const W = E.W, H = E.H;

  const rnd = (seed) => E.rngFor(seed);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const n2 = (x, y, s) => E.noise2(x, y, s);

  /* Footprints (px) the later phases will fill. Kept here so the layout has one source of truth. */
  const TASKBAR_H = 20;   // 60 physical px of Windows taskbar at 3x; nothing important below this line
  const LAYOUT = {
    house: { x: 80, y: 60, w: 97, h: 80 },
    coop: { x: 220, y: 66, w: 65, h: 50 },
    silo: { x: 306, y: 76, w: 26, h: 64 },
    barn: { x: 336, y: 52, w: 107, h: 88 },
    pen: { x: 456, y: 62, w: 140, h: 92 },
    plots: [
      { x: 64, y: 244, w: 80, h: 72, kind: 'cabbage' }, { x: 160, y: 244, w: 80, h: 72, kind: 'corn' },
      { x: 256, y: 244, w: 80, h: 72, kind: 'lavender' }, { x: 474, y: 224, w: 80, h: 36, kind: 'pumpkin' },
    ],
    garden: { x: 48, y: 232, w: 306, h: 96 },
    pond: { cx: 510, cy: 304 },
    taskbarY: 400 - TASKBAR_H,
    taskbarH: TASKBAR_H,
  };

  /* Shadows get their own cool colours instead of borrowing a darker grass: otherwise a shadow
     and a patch of shaded meadow look the same and the ground turns blotchy. */
  const SHADOW = {
    [C.G5]: C.GS4, [C.G4]: C.GS4, [C.G3]: C.GS3, [C.G2]: C.GS2, [C.G1]: C.G0,
    [C.GS4]: C.GS3, [C.GS3]: C.GS2, [C.GS2]: C.G0,
    [C.D4]: C.DS3, [C.D3]: C.DS3, [C.D2]: C.DS2, [C.D1]: C.D0, [C.DS3]: C.DS2, [C.DS2]: C.D0,
  };
  const DARKEN = {
    [C.G5]: C.G4, [C.G4]: C.G3, [C.G3]: C.G2, [C.G2]: C.G1, [C.G1]: C.G0,
    [C.D4]: C.D3, [C.D3]: C.D2, [C.D2]: C.D1, [C.D1]: C.D0,
  };

  /* ---------- meadow ---------- */
  function drawMeadow() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // light sits top-left: patches of sunlit grass gather there, shaded patches near the far corner
      const d = Math.hypot((x - 190) / 400, (y - 120) / 320);
      const n = 0.7 * n2(x / 60, y / 40, 5) + 0.3 * n2(x / 19, y / 13, 6) + (0.55 - d) * 0.45;
      let c = C.G3;
      if (n > 0.62) c = C.G4;
      E.set(x, y, c);
      E.setTag(x, y, E.TAG.GROUND);
    }
  }


  /* ---------- golden paths ----------
     Hand-placed control points [x, y, half-width], smoothed with a spline, then stamped with a
     wandering centre and width so no edge is straight; a pass of erosion tatters the rim. */
  const pathMask = new Uint8Array(W * H);

  function spline(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 1.2));
      for (let s = 0; s < n; s++) {
        const t = s / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function stampPath(pts, seed) {
    const s = spline(pts);
    let run = 0;
    for (let i = 0; i < s.length; i++) {
      if (i) run += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
      const jx = (n2(run / 16, seed, 21) - 0.5) * 3.2, jy = (n2(run / 16, seed + 9, 22) - 0.5) * 3.2;
      const r = s[i][2] * (0.80 + 0.40 * n2(run / 9, seed + 3, 23));
      const cx = s[i][0] + jx, cy = s[i][1] + jy, R = Math.ceil(r);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = Math.round(cx + dx), y = Math.round(cy + dy);
        if (x >= 0 && y >= 0 && x < W && y < H) pathMask[y * W + x] = 1;
      }
    }
  }

  function stampEllipse(cx, cy, rx, ry, seed) {
    for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
      const e = 1 + (n2((cx + x) / 5, (cy + y) / 5, seed) - 0.5) * 0.35;
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= e) pathMask[(cy + y) * W + cx + x] = 1;
    }
  }

  const ROADS = [
    [[0, 206, 11], [60, 201, 12], [130, 208, 13], [200, 203, 10], [270, 199, 12], [350, 205, 13], [430, 201, 11], [510, 207, 12], [580, 201, 11], [640, 204, 11]],
    // lane along the building fronts
    [[118, 146, 8], [132, 153, 8], [170, 157, 7], [215, 154, 6], [250, 157, 7], [300, 153, 7], [340, 150, 8], [378, 147, 10], [414, 152, 7], [460, 158, 6], [505, 157, 7]],
    [[244, 121, 5], [244, 134, 5], [242, 146, 6], [246, 156, 7]],                         // coop
    [[196, 158, 6], [194, 176, 7], [199, 194, 9], [203, 204, 11]],                        // lane to road, west
    [[444, 155, 6], [449, 176, 7], [445, 194, 9], [441, 203, 11]],                        // lane to road, east
    [[152, 208, 8], [152, 224, 7], [152, 240, 6], [152, 270, 6], [152, 300, 6], [152, 322, 6]],   // garden gate and centre path
    [[430, 203, 6], [428, 226, 5], [430, 252, 5], [432, 276, 5], [436, 290, 4]],         // down to the dock
    [[560, 206, 5], [568, 232, 5], [582, 262, 5], [596, 286, 5], [606, 298, 4]],        // down to the camp
  ];

  function drawPaths() {
    ROADS.forEach((pts, i) => stampPath(pts, 40 + i * 7));
    for (const [cx, cy, rx, ry] of [[118, 146, 14, 5], [244, 122, 10, 4], [378, 146, 16, 5], [512, 158, 14, 5]]) stampEllipse(cx, cy, rx, ry, 3);
    const p = (x, y) => x >= 0 && y >= 0 && x < W && y < H && pathMask[y * W + x] === 1;
    const rng = rnd(17);
    // erode the rim so it frays instead of running clean
    const frayed = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!p(x, y)) continue;
      if ((!p(x - 1, y) || !p(x + 1, y) || !p(x, y - 1) || !p(x, y + 1)) && rng() < 0.26) frayed.push(y * W + x);
    }
    for (const i of frayed) pathMask[i] = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!p(x, y)) continue;
      let c = C.D3;
      const n = n2(x / 12, y / 8, 13);
      if (n > 0.74) c = C.D2;
      else if (n < 0.14) c = C.D4;
      const r = rng();
      if (r < 0.010) c = C.D1; else if (r < 0.022) c = C.D4; else if (r < 0.026) c = C.M2;   // pebbles
      const edge = !p(x - 1, y) || !p(x + 1, y) || !p(x, y - 1) || !p(x, y + 1);
      if (!p(x, y - 1) || !p(x - 1, y)) c = C.D4;          // lit rim, top/left
      if (!p(x, y + 1) || !p(x + 1, y)) c = C.D1;          // shaded rim, bottom/right
      if (edge && rng() < 0.10) c = C.G3;                  // grass creeping onto the track
      E.set(x, y, c); E.setTag(x, y, E.TAG.PATH);
    }
    // grass lip: one dark row just under a path edge reads as thickness
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) {
      if (p(x, y) && !p(x, y + 1) && E.getTag(x, y + 1) === E.TAG.GROUND) E.set(x, y + 1, DARKEN[E.get(x, y + 1)] || E.get(x, y + 1));
    }
  }

  /* ---------- pond ---------- */
  const POND_LOBES = [[508, 314, 70, 44], [470, 338, 34, 18], [548, 288, 26, 16]];
  const pondMask = new Uint8Array(W * H);
  const dist = new Float32Array(W * H);

  function inLobe(x, y) {
    for (const [cx, cy, rx, ry] of POND_LOBES) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      const a = Math.atan2(ny, nx);
      const e = 1 + 0.07 * Math.sin(2 * a + 0.7) + 0.05 * Math.sin(3 * a + 2.1) + 0.035 * Math.sin(5 * a + 0.3);
      if (Math.hypot(nx, ny) < e) return true;
    }
    return false;
  }
  const isPond = (x, y) => x >= 0 && y >= 0 && x < W && y < H && pondMask[y * W + x] === 1;

  function distanceTransform() {
    const BIG = 999;
    for (let i = 0; i < W * H; i++) dist[i] = pondMask[i] ? BIG : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : dist[y * W + x];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.4, at(x + 1, y - 1) + 1.4);
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.4, at(x - 1, y + 1) + 1.4);
    }
  }

  function drawPond() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inLobe(x, y)) pondMask[y * W + x] = 1;
    distanceTransform();
    const rng = rnd(66);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isPond(x, y)) continue;
      const d = dist[y * W + x];
      const deep = n2(x / 16, y / 11, 23);
      let c = C.W2;
      if (d < 3) c = C.W3;
      else if (d < 5 && E.bayer(x, y) < 0.5) c = C.W3;
      else if (d > 9 && deep > 0.46) c = (d - 9) / 6 > E.bayer(x + 1, y + 2) * 0.9 ? C.W1 : C.W2;
      if (d > 17 && deep > 0.55) c = C.W0;
      E.set(x, y, c); E.setTag(x, y, E.TAG.WATER);
    }
    // sparkle dashes
    for (let i = 0; i < 18; i++) {
      const x = 446 + Math.floor(rng() * 110), y = 268 + Math.floor(rng() * 80), len = 2 + Math.floor(rng() * 3);
      let ok = true;
      for (let k = 0; k < len; k++) if (!isPond(x + k, y) || dist[y * W + x + k] < 6) ok = false;
      if (ok) for (let k = 0; k < len; k++) E.set(x + k, y, C.W4);
    }
    // shore: two lighter rows on the lit side, shaded rows on the far side
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const ring = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (isPond(x, y)) continue;
      let k = 99;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (isPond(x + dx, y + dy)) k = Math.min(k, Math.max(Math.abs(dx), Math.abs(dy)));
      if (k <= 3) ring.push([x, y, k]);
    }
    for (const [x, y, k] of ring) {
      if (E.getTag(x, y) === E.TAG.PATH) continue;
      const below = isPond(x, y - 1) || isPond(x, y - 2) || isPond(x - 1, y) ;   // pond lies up/left of this pixel
      let c;
      if (k <= 1) c = below ? C.D1 : C.D3;
      else if (k === 2) c = below ? C.D2 : C.D4;
      else c = DARKEN[E.get(x, y)] || E.get(x, y);
      E.set(x, y, c); E.setTag(x, y, E.TAG.OBJ);
    }
  }

  function lilyPad(x, y, flower) {
    const px = [[-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-2, -1], [-1, -1], [0, -1], [1, -1]];
    for (const [dx, dy] of px) {
      if (!isPond(x + dx, y + dy)) continue;
      E.set(x + dx, y + dy, dy < 0 || (dx < 0 && dy === 0) ? C.CG1 : dy > 0 ? C.G2 : C.CG0);
    }
    if (isPond(x + 3, y)) E.set(x + 3, y, C.W2);
    if (flower && isPond(x, y - 1)) { E.set(x, y - 1, C.B2); E.set(x - 1, y - 1, C.B1); }
  }

  function ripple(cx, cy) {
    for (let a = 0; a < 6.283; a += 0.32) {
      if (((a * 10) | 0) % 3 === 0) continue;
      const x = Math.round(cx + Math.cos(a) * 7), y = Math.round(cy + Math.sin(a) * 3.4);
      if (isPond(x, y) && dist[y * W + x] > 4) E.set(x, y, C.W3);
    }
  }

  function reeds() {
    const rng = rnd(88);
    const spots = [];
    for (let x = 448; x < 568; x += 7 + Math.floor(rng() * 9)) {
      for (let y = H - 1; y > 0; y--) if (isPond(x, y)) { spots.push([x, y + 4]); break; }
    }
    for (const [x, y] of spots) {
      if (rng() < 0.4) continue;
      const hh = 7 + Math.floor(rng() * 6);
      for (let k = 0; k < hh; k++) {
        if (E.getTag(x, y - k) === E.TAG.PATH) break;
        E.set(x, y - k, k > hh - 4 ? C.CG1 : C.CG0); E.setTag(x, y - k, E.TAG.OBJ);
      }
      E.set(x + 1, y - hh + 1, C.WD2); E.set(x + 1, y - hh + 2, C.WD1); E.set(x + 1, y - hh, C.WD2);
      E.set(x - 1, y - Math.floor(hh * 0.6), C.CG1); E.set(x - 1, y - Math.floor(hh * 0.6) - 1, C.CG2);
    }
  }

  function rock(w, seed) {
    const rng = rnd(seed);
    const sp = new E.Spr(w, 10);
    E.blob(sp, [{ x: Math.round(w * 0.38), y: 6, r: 4.8 }, { x: Math.round(w * 0.7), y: 7, r: 3.8 }],
      { l: C.M3, m: C.M2, d: C.M1, rim: C.M0 }, rng);
    for (let x = -1; x <= w; x++) sp.set(x, 10, -1);
    sp.outline(C.INK0, C.INK1);
    return sp;
  }

  /* ---------- forest border ---------- */
  /* ---------- small details ---------- */
  function tuft(x, y, v) {
    const base = E.get(x, y);
    const dark = DARKEN[base] || base;
    const tip = base === C.G2 ? C.G3 : base === C.G3 ? C.G4 : C.G5;
    const pts = v === 0
      ? [[0, 0, dark], [-1, -1, dark], [1, -1, dark], [-1, -2, tip], [2, -2, tip], [0, -2, base]]
      : [[0, 0, dark], [0, -1, dark], [1, -2, tip], [-1, -1, base], [2, -1, dark]];
    for (const [dx, dy, c] of pts) if (E.getTag(x + dx, y + dy) === E.TAG.GROUND) E.set(x + dx, y + dy, c);
  }

  function drawTufts() {
    const rng = rnd(31);
    for (let gy = 4; gy < H - 4; gy += 20) for (let gx = 4; gx < W - 4; gx += 26) {
      if (rng() < 0.55) continue;
      const x = gx + Math.floor(rng() * 16), y = gy + Math.floor(rng() * 12);
      if (E.getTag(x, y) === E.TAG.GROUND) tuft(x, y, rng() < 0.5 ? 0 : 1);
    }
  }

  function flowerSpot(cx, cy, col, count, spread, seed) {
    const rng = rnd(seed);
    for (let i = 0; i < count; i++) {
      const x = cx + Math.round((rng() - 0.5) * spread * 2);
      const y = cy + Math.round((rng() - 0.5) * spread * 0.9);
      if (E.getTag(x, y) !== E.TAG.GROUND) continue;
      E.set(x, y + 1, C.G1); E.set(x, y + 2, C.G1);
      E.set(x - 1, y, col); E.set(x + 1, y, col); E.set(x, y - 1, col);
      E.set(x, y, col === C.Y0 ? C.CR0 : C.Y0);
    }
  }

  /* ---------- buildings (drawn in buildings.js) ---------- */
  const { gable, silo, HOUSE, COOP, BARN } = global.Buildings;
  const Props = global.Props;

  function darkenRect(x0, y0, x1, y1) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const t = E.getTag(x, y);
      if (t !== E.TAG.GROUND && t !== E.TAG.PATH) continue;
      const c = E.get(x, y); E.set(x, y, SHADOW[c] || DARKEN[c] || c);
    }
  }
  /* Shadow of a tree, built from the same clumps as its crown: each clump is thrown right and down
     in proportion to its height and flattened. Where clumps overlap the shadow is darker, and
     isolated gaps stay lit so light spills through the leaves. */
  function canopyShadow(spr, x, y) {
    const X0 = x - (spr.w >> 1), cover = new Map();
    for (const c of spr.clumps) {
      const hgt = spr.h - 1 - c.y;
      const gx = X0 + c.x + hgt * 0.30, gy = y + 1 + hgt * 0.10;
      const rx = c.r * 0.95, ry = Math.max(2, c.r * 0.42);
      for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
        const key = Math.round(gy + dy) * W + Math.round(gx + dx);
        cover.set(key, (cover.get(key) || 0) + 1);
      }
    }
    for (const [key, n] of cover) {
      const px = key % W, py = (key - px) / W;
      if (n < 3 && n2(px / 2.4, py / 2.4, 91) > 0.80) continue;          // a gap in the leaves
      darkenRect(px, py, px + 1, py + 1);
      if (n >= 3) darkenRect(px, py, px + 1, py + 1);
    }
  }

  function buildingShadow(r) {
    darkenRect(r.x + r.w, r.y + r.h - 9, r.x + r.w + 4, r.y + r.h + 3);
    darkenRect(r.x + 4, r.y + r.h, r.x + r.w + 7, r.y + r.h + 4);
    darkenRect(r.x + 3, r.y + r.h, r.x + r.w + 4, r.y + r.h + 2);
    darkenRect(r.x + r.w, r.y + r.h - 6, r.x + r.w + 2, r.y + r.h + 2);
  }
  function shadowEllipse(cx, cy, rx, ry) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) darkenRect(cx + x, cy + y, cx + x + 1, cy + y + 1);
    }
  }

  /* ---------- fences ---------- */
  function fenceH(x, y, len, seed) {
    const sp = new E.Spr(len, 13);
    for (const ry of [3, 8]) {
      sp.hline(0, len - 1, ry, C.WD4); sp.hline(0, len - 1, ry + 1, C.WD3); sp.hline(0, len - 1, ry + 2, C.WD1);
    }
    const rng = rnd(seed);
    for (let px = 1; px < len; px += 16) {
      const top = rng() < 0.3 ? 0 : 1;
      for (let yy = top; yy < 13; yy++) { sp.set(px, yy, C.WD4); sp.set(px + 1, yy, C.WD3); sp.set(px + 2, yy, C.WD1); }
      sp.set(px + 1, top, C.WD4);
    }
    return { sp: sp.outline(C.INK0, C.WD0), x, y: y - 12, base: y };
  }
  /* A run made of segments of different lengths, each nudged a pixel or two, so it never reads as ruled. */
  function fenceRun(x, y, len, seed) {
    const out = [];
    let px = x, i = 0;
    while (px < x + len - 1) {
      const seg = Math.min(x + len - px, 28 + Math.floor(n2(px / 9, seed, 62) * 24));
      const dy = Math.round((n2(px / 31 + seed, 7, 63) - 0.5) * 3.2);
      out.push(fenceH(px, y + dy, seg, seed + i));
      px += seg; i++;
    }
    return out;
  }
  function fenceV(x, y, len) {
    const out = [];
    for (let py = y; py < y + len; py += 14) {
      const sp = new E.Spr(4, 13);
      for (let yy = 0; yy < 13; yy++) { sp.set(0, yy, C.WD4); sp.set(1, yy, C.WD3); sp.set(2, yy, C.WD3); sp.set(3, yy, C.WD1); }
      sp.hline(0, 3, 0, C.WD4); sp.hline(0, 3, 1, C.WD4);
      const jx = Math.round((n2(py / 17, x, 64) - 0.5) * 2.6);
      out.push({ sp: sp.outline(C.INK0, C.WD0), x: x - 2 + jx, y: py, base: py + 12 });
      if (py + 14 < y + len) {
        const rail = new E.Spr(2, 4);
        rail.rect(0, 0, 1, 4, C.WD3); rail.rect(1, 0, 1, 4, C.WD1);
        out.push({ sp: rail.outline(C.INK0, C.WD0), x: x - 1 + jx, y: py + 10, base: py + 13 });
      }
    }
    return out;
  }

  /* ---------- props ---------- */
  function hayBale() {
    const sp = new E.Spr(16, 12);
    sp.rect(0, 4, 16, 8, C.Y0); sp.rect(0, 0, 16, 4, C.Y1);
    for (let x = 1; x < 16; x += 3) { sp.set(x, 1, C.O1); sp.set(x + 1, 6, C.D4); sp.set(x, 9, C.D3); }
    sp.vline(5, 0, 11, C.WD1); sp.vline(10, 0, 11, C.WD1);
    sp.hline(0, 15, 11, C.D3);
    return sp.outline(C.INK0, C.INK1);
  }
  function stool() {
    const sp = new E.Spr(12, 10);
    sp.shadeEllipse(5.5, 2, 5.5, 2, { l: C.WD4, m: C.WD3, d: C.WD2 }); sp.hline(2, 9, 1, C.WD4);
    sp.rect(1, 3, 10, 2, C.WD2); sp.hline(1, 10, 4, C.WD1);
    sp.rect(2, 5, 2, 5, C.WD2); sp.rect(8, 5, 2, 5, C.WD1); sp.vline(2, 5, 9, C.WD3); sp.hline(2, 9, 9, C.WD0);
    return sp.outline(C.INK0, C.INK1);
  }

  /* A water trough you can believe in: dark inner rim, shaded water with a sky glint and ripple, a few floating
     straws, planked sides with iron bands and rivets, end boards, two legs, moss and a wet line at the base. */
  function trough() {
    const w = 30, sp = new E.Spr(w, 15);
    sp.rect(0, 0, w, 7, C.WD0);                                                            // inside of the rim
    for (let y = 1; y < 6; y++) for (let x = 1; x < w - 1; x++) sp.set(x, y, y === 1 ? C.W3 : y < 4 ? C.W2 : C.W1);
    sp.hline(4, 11, 2, C.W4); sp.hline(17, 21, 3, C.W3); sp.hline(8, 14, 4, C.W3); sp.set(22, 1, C.W4);       // glint and ripples
    for (const [x, y] of [[6, 3], [7, 3], [19, 2], [20, 2], [12, 4]]) sp.set(x, y, C.Y1);                    // straw adrift
    sp.hline(0, w - 1, 0, C.WD4); sp.hline(0, w - 1, 6, C.WD1);
    for (let y = 7; y < 13; y++) for (let x = 0; x < w; x++) {
      let c = (y - 7) % 3 === 2 ? C.WD1 : C.WD2;
      if ((y - 7) % 3 === 0) c = C.WD3;
      if ((x + ((y - 7) >> 1) * 7) % 11 === 0) c = C.WD1;                                  // plank ends
      sp.set(x, y, c);
    }
    sp.vline(0, 7, 12, C.WD4); sp.vline(1, 7, 12, C.WD3); sp.vline(w - 1, 7, 12, C.WD1); sp.vline(w - 2, 7, 12, C.WD2);
    for (const bx of [6, 23]) { sp.vline(bx, 7, 12, C.M2); sp.vline(bx + 1, 7, 12, C.M1); sp.set(bx, 8, C.M3); sp.set(bx, 11, C.M3); }
    for (const lx of [3, 24]) { sp.rect(lx, 13, 3, 2, C.WD2); sp.set(lx, 13, C.WD3); sp.set(lx + 2, 14, C.WD0); }
    for (const [x, y] of [[9, 12], [10, 12], [11, 11], [18, 12], [19, 12]]) sp.set(x, y, C.CG0);                // moss
    for (const [x, y] of [[10, 12], [19, 12]]) sp.set(x, y - 0, C.CG1);
    sp.hline(2, w - 3, 12, C.WD0);                                                         // wet shadow at the base
    return sp.outline(C.INK0, C.INK1);
  }

  /* ---------- crop plots ---------- */
  function cabbage(seed, alt) {
    const sp = new E.Spr(12, 11);
    const rng = rnd(seed);
    E.blob(sp, [{ x: 6, y: 6, r: 5.1 }], { l: C.CG2, m: alt ? C.CG3 : C.CG1, d: C.CG0, rim: C.CG0 }, rng);
    sp.set(5, 4, C.CG2); sp.set(6, 3, C.CG2); sp.set(7, 4, C.CG2);
    sp.set(5, 6, C.CR1); sp.set(6, 6, C.CG2); sp.set(5, 7, C.CG2);
    sp.set(0, 9, -1); sp.set(11, 9, -1);
    return sp;
  }
  function corn(seed) {
    const rng = rnd(seed);
    const sp = new E.Spr(12, 20);
    const top = 2 + Math.floor(rng() * 3);
    for (let y = top + 2; y < 20; y++) { sp.set(5, y, C.CG1); sp.set(6, y, C.CG0); }
    for (const ly of [8, 13]) {
      sp.set(4, ly - 1, C.CG2); sp.set(3, ly - 2, C.CG2); sp.set(2, ly - 2, C.CG1); sp.set(4, ly, C.CG1);
      sp.set(7, ly + 1, C.CG1); sp.set(8, ly, C.CG1); sp.set(9, ly, C.CG0); sp.set(7, ly + 2, C.CG0);
    }
    sp.set(7, 10, C.Y1); sp.set(8, 10, C.Y0); sp.set(7, 11, C.Y0); sp.set(8, 11, C.O0); sp.set(7, 12, C.O0);
    sp.set(5, top + 1, C.Y1); sp.set(6, top, C.Y1); sp.set(7, top + 1, C.O1); sp.set(6, top + 1, C.Y0);
    return sp;
  }
  function lavender(seed) {
    const rng = rnd(seed);
    const alt = rng() < 0.22, hi = alt ? C.BL1 : C.V1, lo = alt ? C.BL0 : C.V0;
    const sp = new E.Spr(12, 14);
    for (const sx of [3, 6, 9]) {
      const hh = 6 + Math.floor(rng() * 4);
      for (let y = 13 - hh; y < 14; y++) sp.set(sx, y, y > 10 ? C.CG0 : C.CG1);
      for (let k = 0; k < 4; k++) { sp.set(sx, 13 - hh - 1 + k, k < 2 ? hi : lo); if (k === 1 || k === 2) sp.set(sx + 1, 13 - hh + k - 1, lo); }
      sp.set(sx - 1, 13 - hh + 1, hi);
    }
    sp.set(2, 12, C.CG2); sp.set(10, 12, C.CG2); sp.set(4, 13, C.CG2);
    return sp;
  }

  function plotSoil(p, seed) {
    const inside = (x, y) => {
      const lx = x - p.x, ly = y - p.y;
      if (lx < 0 || ly < 0 || lx >= p.w || ly >= p.h) return false;
      const dx = Math.min(lx, p.w - 1 - lx), dy = Math.min(ly, p.h - 1 - ly);
      if (dx + dy < 4) return false;
      if ((dx < 1 || dy < 1) && n2(lx / 4 + seed, ly / 4, 71) > 0.72) return false;
      return true;
    };
    for (let y = p.y - 1; y <= p.y + p.h; y++) for (let x = p.x - 1; x <= p.x + p.w; x++) {
      if (!inside(x, y)) continue;
      const yy = (y - p.y) % 12;
      let c = yy === 0 ? C.T2 : yy >= 8 && yy <= 9 ? C.T0 : C.T1;
      if (c === C.T1 && n2(x / 11, y / 7, 91 + seed) > 0.68) c = C.T0;                 // damp patches
      else if (c === C.T1 && n2(x * 1.7, y * 1.7, 95 + seed) > 0.80) c = C.T2;       // dry clods
      else if (c === C.T0 && n2(x / 5, y / 4, 97 + seed) > 0.80) c = C.T1;
      if (!inside(x - 1, y) || !inside(x, y - 1)) c = C.T2;
      if (!inside(x + 1, y) || !inside(x, y + 1)) c = C.T0;
      E.set(x, y, c); E.setTag(x, y, E.TAG.OBJ);
    }
    for (let i = 0; i < 5; i++) {                                                       // a few stones turned up by the hoe
      const sx = p.x + 4 + Math.floor(n2(i * 7.3, seed, 99) * (p.w - 8)), sy = p.y + 4 + Math.floor(n2(seed, i * 5.1, 98) * (p.h - 8));
      if (E.get(sx, sy) === C.T1 || E.get(sx, sy) === C.T0) { E.set(sx, sy, C.M2); E.set(sx + 1, sy, C.M1); E.set(sx, sy - 1, C.M3); }
    }
    const pc = { cabbage: C.CG1, corn: C.Y0, lavender: C.V1, pumpkin: C.O0 }[p.kind] || C.CR1;      // seed-packet stake at the row end
    const kx = p.x + 3, ky = p.y + 2;
    for (let k = 0; k < 7; k++) { E.set(kx + 1, ky + 4 + k, C.WD2); E.setTag(kx + 1, ky + 4 + k, E.TAG.OBJ); }
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { E.set(kx + i - 1, ky + j, (i === 0 || i === 3 || j === 0) ? C.CR1 : (j === 1 ? C.CR0 : pc)); E.setTag(kx + i - 1, ky + j, E.TAG.OBJ); }
    // grass lip outside the lower/right edge
    for (let y = p.y - 1; y <= p.y + p.h + 1; y++) for (let x = p.x - 1; x <= p.x + p.w + 1; x++) {
      if (inside(x, y) || E.getTag(x, y) !== E.TAG.GROUND) continue;
      if (inside(x, y - 1) || inside(x - 1, y)) E.set(x, y, DARKEN[E.get(x, y)] || E.get(x, y));
    }
  }

  function plotPlants(p, kind, seed) {
    const rng = rnd(seed);
    const rows = Math.floor(p.h / 12);
    for (let r = 0; r < rows; r++) for (let c = 0; c < 6; c++) {
      if (rng() < 0.05) continue;                                     // the odd missing seedling
      const bx = p.x + 7 + c * 13 + Math.round((rng() - 0.5) * 1.2);
      const by = p.y + r * 12 + 9;
      let spr, ox, oy;
      if (kind === 'cabbage') { spr = cabbage(seed * 100 + r * 8 + c, rng() < 0.2); ox = 6; oy = 10; }
      else if (kind === 'corn') { spr = corn(seed * 100 + r * 8 + c); ox = 6; oy = 19; }
      else if (kind === 'pumpkin') { spr = Props.pumpkin(seed * 100 + r * 8 + c); ox = 5; oy = 9; }
      else { spr = lavender(seed * 100 + r * 8 + c); ox = 6; oy = 13; }
      for (let k = 1; k <= 7; k++) {
        const sx = bx - 2 + k;
        const t0 = E.get(sx, by); if (t0 === C.T1 || t0 === C.T2) E.set(sx, by, C.T0);
        if (k > 2 && E.get(sx + 1, by + 1) === C.T1) E.set(sx + 1, by + 1, C.T0);
      }
      spr.blit(bx - ox, by - oy);
    }
  }

  function penFloor(r) {
    const rng = rnd(55);
    for (let y = r.y + 4; y < r.y + r.h - 2; y++) for (let x = r.x + 4; x < r.x + r.w - 4; x++) {
      const n = n2(x / 8, y / 6, 77);
      let c = n > 0.72 ? C.D3 : n < 0.22 ? C.D1 : C.D2;
      if (rng() < 0.012) c = C.D4;
      E.set(x, y, c); E.setTag(x, y, E.TAG.PATH);
    }
    for (let i = 0; i < 26; i++) {
      const x = r.x + 8 + Math.floor(rng() * (r.w - 18)), y = r.y + 8 + Math.floor(rng() * (r.h - 16));
      E.set(x, y, C.Y1); E.set(x + 1, y - 1, C.Y0); E.set(x + 2, y, C.Y1);
    }
  }


  /* ---------- trees keep off roads ---------- */
  function placeTrees() {
    const free = (x, y) => {
      for (let dy = -5; dy <= 2; dy++) for (let dx = -7; dx <= 7; dx++) if (E.getTag(x + dx, y + dy) !== E.TAG.GROUND) return false;
      return true;
    };
    const tries = [[0, 0], [0, -16], [0, 16], [-18, 0], [18, 0], [0, -30], [0, 30], [-30, 0], [30, 0], [-18, -18], [18, -18], [-18, 18], [18, 18], [-34, -10], [34, -10]];
    const out = [];
    for (const [kind, x, y, k, sd] of TREES) {
      for (const [dx, dy] of tries) {
        const px = x + dx, py = y + dy;
        if (px < 4 || px > W - 4 || py < 20 || py > H - 6) continue;
        if (free(px, py)) { out.push([kind, px, py, k, sd]); break; }
      }
    }
    return out;
  }

  /* ---------- fields at the screen edge ----------
     Crop rows end on the row grid, so an edge is a tidy staircase rather than a scatter of stray pixels,
     and a lip finishes it. The two ends of the screen get different crops, widths and outlines. */
  const snap = (v, g) => g * Math.round(v / g);
  const SUNFLOWER_SPOTS = [];
  (function () {
    const rng = rnd(777);
    for (const [row, by] of [[0, 20], [1, 31]]) for (let x = 348 + (row ? 7 : 0); x < 632; x += 14 + Math.floor(rng() * 4)) SUNFLOWER_SPOTS.push([x, by + Math.floor(rng() * 3), Math.floor(rng() * 1000)]);
  })();

  /* kind: 'gold' ripe wheat | 'green' young wheat | 'soil' bare furrows for the sunflowers */
  function drawCropField(x0, x1, y0, y1, seed, openTop, kind) {
    const g = kind === 'soil' ? 6 : 4;
    const rng = rnd(seed);
    const edge = (x) => snap(5 * Math.sin(x / 41 + seed) + 3 * Math.sin(x / 17 + seed * 2), g);
    const xl = (y) => snap(4 * Math.sin(y / 9 + seed), 3);
    const inside = (x, y) => x >= x0 + xl(y) && x < x1 + xl(y * 1.3 + 5) && (openTop ? y >= y0 + edge(x) && y < y1 : y < y1 + edge(x) && y >= y0);
    for (let y = y0 - 8; y < y1 + 8; y++) for (let x = x0 - 6; x < x1 + 6; x++) {
      if (y < 0 || y >= H || x < 0 || x >= W || !inside(x, y)) continue;
      const row = (((y - y0) % g) + g) % g;
      let c;
      if (kind === 'soil') c = row < 2 ? C.T0 : C.T1;
      else c = row === g - 1 ? C.D1 : (n2(x / 7, y / 5, seed + 5) > 0.72 ? C.D3 : C.D2);
      if (!openTop && !inside(x, y + 1)) c = kind === 'soil' ? C.T0 : C.D0;
      if (openTop && !inside(x, y - 1)) c = C.D4;
      E.set(x, y, c); E.setTag(x, y, E.TAG.OBJ);
    }
    if (kind === 'soil') return;
    const gold = kind === 'gold';
    /* Each stalk is built by hand: a dark foot, a ripening shaft, a drooping ear with awns (gold), or a tuft of blades
       with a pale heart (young green). Patches follow noise, so some of the field stands tall and some is thin and short,
       and rare cornflowers / poppies grow between the rows. */
    const stalk = (rx, ry) => {
      const patch = n2(rx / 23, ry / 9, seed + 11);                          // 0..1: thin and short vs thick and tall
      if (patch < 0.16 && rng() < 0.7) return;
      const lean = rng() < 0.45 ? 0 : (rng() < 0.5 ? 1 : -1);
      if (gold) {
        const h = 4 + (patch > 0.6 ? 1 : 0) + (rng() < 0.3 ? 1 : 0) + (rng() < 0.12 ? 2 : 0) - (patch < 0.3 ? 1 : 0);
        for (let k = 0; k < h; k++) {
          const x = rx + (k >= h - 2 ? lean : 0);
          E.set(x, ry - k, k < 1 ? C.D3 : k < h - 2 ? (k % 2 ? C.Y0 : C.D4) : C.Y0);
        }
        const ex = rx + lean, ey = ry - h;
        E.set(ex, ey, C.O1); E.set(ex, ey - 1, C.Y1); E.set(ex + (lean >= 0 ? 1 : -1), ey - 1, C.O1); E.set(ex, ey - 2, C.Y1);   // the ear, drooping to one side
        if (rng() < 0.6) E.set(ex - 1, ey - 3, C.Y1);
        if (rng() < 0.6) E.set(ex + 1, ey - 3, C.Y1);                                                                            // awns
        if (rng() < 0.5) { const side = rng() < 0.5 ? -1 : 1; E.set(rx + side, ry - 1, C.D3); E.set(rx + side * 2, ry - 2, C.Y0); }   // a dry leaf
      } else {
        const h = 3 + (patch > 0.55 ? 1 : 0) + (rng() < 0.25 ? 1 : 0);
        E.set(rx, ry, C.CG0);
        for (let k = 1; k < h; k++) E.set(rx, ry - k, k === h - 1 ? C.CG3 : C.CG1);
        E.set(rx - 1, ry - 1 - (rng() < 0.4 ? 1 : 0), C.CG1); E.set(rx + 1, ry - 2, C.CG2); E.set(rx - 1, ry - 2, C.CG0);
        if (rng() < 0.35) E.set(rx + lean, ry - h - 1, C.CG3);
      }
    };
    for (let ry = y0 + g - 1; ry < y1 + 8; ry += g) for (let rx = x0 + 5; rx < x1 - 1; rx += 3) {
      if (!inside(rx, ry) || !inside(rx, ry - 4) || !inside(rx - 1, ry) || !inside(rx + 1, ry)) continue;
      if (rng() < 0.02) { // a wildflower instead of a stalk
        const poppy = rng() < 0.55;
        for (let k = 0; k < 4; k++) E.set(rx, ry - k, C.CG1);
        if (poppy) { E.set(rx, ry - 5, C.RED); E.set(rx - 1, ry - 4, C.RED); E.set(rx + 1, ry - 4, C.RED); E.set(rx, ry - 4, C.INK1); }
        else { E.set(rx, ry - 5, C.BL1); E.set(rx - 1, ry - 4, C.BL1); E.set(rx + 1, ry - 4, C.BL1); E.set(rx, ry - 4, C.CR0); }
        continue;
      }
      stalk(rx, ry);
      if (rng() < 0.3) stalk(rx + 1 + (rng() < 0.5 ? 1 : 0), ry - (rng() < 0.5 ? 1 : 0));                                            // a second stalk in the same clump
    }
    // darker pockets between the rows, where the stalks shade the earth
    for (let ry = y0 + g - 2; ry < y1 + 8; ry += g) for (let rx = x0 + 6; rx < x1 - 2; rx += 5 + Math.floor(rng() * 6)) {
      if (inside(rx, ry) && E.get(rx, ry) === (gold ? C.D2 : C.D2)) E.set(rx, ry, C.D1);
    }
  }
  function drawFields() {
    drawCropField(0, 322, 0, 34, 41, false, 'gold');          // ripe wheat, top left
    drawCropField(338, 640, 0, 36, 43, false, 'soil');        // furrows for the sunflowers
    drawCropField(46, 312, 352, 400, 47, true, 'green');      // young wheat at the bottom: different crop, width and outline
  }

  /* ---------- garden yard: packed earth around the plots so they sit in a worked place ---------- */
  function drawYard(g) {
    const rng = rnd(91);
    const inside = (x, y) => {
      const dx = Math.min(x - g.x, g.x + g.w - 1 - x), dy = Math.min(y - g.y, g.y + g.h - 1 - y);
      if (dx < 0 || dy < 0) return false;
      return dx + (n2(y / 7, 5, 81) - 0.5) * 6 > 2 && dy + (n2(x / 7, 6, 82) - 0.5) * 6 > 2;
    };
    for (let y = g.y - 3; y < g.y + g.h + 3; y++) for (let x = g.x - 3; x < g.x + g.w + 3; x++) {
      if (!inside(x, y)) continue;
      const n = n2(x / 9, y / 7, 83);
      let c = n > 0.72 ? C.D3 : n < 0.24 ? C.D1 : C.D2;
      const r = rng();
      if (r < 0.012) c = C.D4; else if (r < 0.022) c = C.D1;
      E.set(x, y, c); E.setTag(x, y, E.TAG.PATH);
    }
    for (let i = 0; i < 46; i++) {                                    // weeds that survived the hoe
      const x = g.x + 4 + Math.floor(rng() * (g.w - 8)), y = g.y + 4 + Math.floor(rng() * (g.h - 8));
      if (E.getTag(x, y) === E.TAG.PATH && E.get(x, y) !== C.T1) { E.set(x, y, C.G2); E.set(x, y - 1, C.G3); if (rng() < 0.4) E.set(x + 1, y, C.G2); }
    }
  }

  function darkenWater(x0, y0, x1, y1) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (isPond(x, y)) E.set(x, y, C.W0);
  }
  /* A shadow on the water that follows the object, with a ragged rim instead of a box. */
  function waterShadow(cx, cy, rx, ry) {
    for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
      const e = 1 + (n2((cx + x) / 3, (cy + y) / 3, 55) - 0.5) * 0.4;
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= e && isPond(cx + x, cy + y)) E.set(cx + x, cy + y, C.W0);
    }
  }

  const TREES = [
    ['oak', 44, 128, 1.0, 1], ['oak', 36, 190, 0.8, 2], ['oak', 200, 136, 0.62, 3],
    ['pine', 580, 104, 46, 5], ['pine', 602, 154, 40, 6], ['birch', 574, 188, 0.6, 7], ['pine', 596, 206, 36, 8],
    ['oak', 270, 184, 0.6, 9], ['birch', 304, 186, 0.6, 10],
    ['apple', 378, 262, 0.7, 11], ['apple', 410, 268, 0.7, 12], ['apple', 374, 304, 0.8, 13], ['apple', 402, 312, 0.8, 14],
    ['oak', 32, 262, 0.8, 16], ['oak', 34, 318, 0.8, 17], ['birch', 462, 244, 0.7, 22],
    // along the top, a loose line of trees on the far side of the field
    ['oak', 20, 46, 1.0, 101], ['birch', 160, 38, 0.8, 104], ['pine', 262, 36, 44, 106],
    ['oak', 526, 40, 1.0, 109], ['pine', 586, 34, 48, 110], ['oak', 624, 46, 0.9, 111],
    // left and right edges
    ['oak', 10, 120, 1.0, 112], ['pine', 14, 222, 40, 114], ['pine', 626, 130, 44, 120], ['oak', 626, 200, 0.9, 121], ['pine', 628, 252, 40, 122],
    // small ones along the bottom, only their tops show above the taskbar
    ['oak', 40, 384, 0.55, 130], ['oak', 110, 380, 0.5, 131], ['birch', 184, 382, 0.5, 132], ['oak', 300, 384, 0.55, 133],
    ['pine', 384, 388, 32, 134], ['oak', 604, 382, 0.55, 136],
  ];
  const BUSHES = [[76, 142, 20, 3], [184, 142, 20, 4], [212, 120, 14, 5], [292, 120, 14, 6], [340, 143, 18, 8], [60, 326, 16, 10], [220, 328, 18, 11], [346, 330, 16, 12],
    [330, 362, 18, 54], [596, 356, 16, 55], [8, 262, 14, 56], [632, 300, 14, 57]];

  /* ---------- compose ---------- */
  function render(opts) {
    opts = opts || {};
    const lit = !!opts.lit;
    const Lo = LAYOUT;
    E.buf.fill(0); E.tag.fill(0); pathMask.fill(0); pondMask.fill(0);
    drawMeadow();
    drawPaths();
    drawYard(Lo.garden);
    drawPond();
    lilyPad(512, 304, true); lilyPad(538, 328, false); lilyPad(476, 346, false); lilyPad(552, 292, false); lilyPad(520, 338, true); lilyPad(560, 316, false);
    for (const [x, y] of [[512, 304], [538, 328], [476, 346], [552, 292], [520, 338], [560, 316], [490, 322]]) ripple(x, y);
    reeds();
    for (const [x, y, w, s] of [[430, 332, 14, 2], [580, 358, 12, 6], [436, 272, 11, 9]]) rock(w, s).blitAt(x, y);
    drawTufts();
    for (const [x, y, c, n, sp, s] of [
      [70, 152, C.B1, 4, 10, 31], [190, 168, C.Y0, 4, 10, 32], [300, 170, C.BL1, 4, 12, 33], [332, 166, C.CR0, 4, 10, 34],
      [180, 332, C.Y0, 6, 16, 35], [262, 334, C.B1, 5, 14, 36], [122, 332, C.BL1, 6, 14, 37], [452, 232, C.CR0, 4, 8, 38], [566, 238, C.Y0, 4, 8, 39],
      [100, 176, C.CR0, 4, 12, 40], [236, 172, C.V1, 4, 10, 41], [190, 52, C.CR0, 5, 10, 42], [510, 52, C.Y0, 4, 9, 43], [630, 50, C.B1, 4, 7, 44], [86, 50, C.BL1, 4, 8, 45], [330, 52, C.Y0, 3, 6, 46],
    ]) flowerSpot(x, y, c, n, sp, s);

    drawFields();
    penFloor(Lo.pen);
    Lo.plots.forEach((p, i) => plotSoil(p, i * 7 + 1));
    Lo.plots.forEach((p, i) => plotPlants(p, p.kind, i + 3));
    darkenWater(432, 304, 500, 310);                                  // the dock's shadow on the water
    waterShadow(478, 327, 25, 8);                                     // and the boat's

    for (const b of [Lo.house, Lo.coop, Lo.barn, Lo.silo]) buildingShadow(b);
    const trees = placeTrees();
    const treeSpr = trees.map(([kind, , , k, s]) => (kind === 'pine' ? Props.pine(k, s) : Props[kind](k, s)));
    trees.forEach(([, x, y], i) => canopyShadow(treeSpr[i], x, y));

    // everything that stands up, painted by the y it stands on
    const list = [];
    const add = (base, fn) => list.push([base, fn]);
    add(Lo.house.y + Lo.house.h, () => gable(HOUSE, lit).blit(Lo.house.x, Lo.house.y));
    add(Lo.coop.y + Lo.coop.h, () => gable(COOP, lit).blit(Lo.coop.x, Lo.coop.y));
    add(Lo.barn.y + Lo.barn.h, () => gable(BARN, lit).blit(Lo.barn.x, Lo.barn.y));
    add(Lo.silo.y + Lo.silo.h, () => silo().blit(Lo.silo.x, Lo.silo.y));
    trees.forEach(([, x, y], i) => add(y, () => treeSpr[i].blitAt(x, y)));
    for (const [x, y, w, s] of BUSHES) add(y, () => { shadowEllipse(x + 3, y, (w >> 1) + 1, 1); Props.bush(w, s).blitAt(x, y); });
    add(140, () => hayBale().blitAt(300, 140));
    add(100, () => trough().blitAt(500, 100));

    // a prop is never planted on a tree: slide it aside, or drop it if there is no room
    const clashes = (x, y) => trees.some(([, tx, ty]) => Math.abs(tx - x) < 17 && Math.abs(ty - y) < 12);
    const put = (fn, x0, y) => {
      let x = x0;
      for (const dx of [0, -22, 22, -38, 38]) { if (!clashes(x0 + dx, y)) { x = x0 + dx; break; } if (dx === 38) return; }
      add(y, () => { const sp = fn(); shadowEllipse(x + 2, y, Math.max(2, sp.w >> 1), 1); sp.blitAt(x, y); });
    };
    put(Props.woodpile, 38, 168); put(Props.stump, 86, 172); put(Props.mailbox, 98, 186);
    put(Props.well, 168, 180); put(Props.signpost, 214, 218);
    for (const x of [132, 262, 400, 520]) put(() => Props.lamppost(lit), x, 220);
    put(() => Props.crate(1), 348, 154); put(() => Props.crate(0), 348, 142);
    put(Props.barrel, 362, 156); put(Props.barrel, 404, 154); put(Props.barrel, 418, 156);
    put(Props.haystack, 456, 178); put(trough, 536, 174);
    for (const [x, y] of [[292, 342], [309, 344], [326, 342]]) put(Props.hive, x, y);
    put(Props.scarecrow, 248, 296);
    put(Props.barrel, 346, 272); put(() => Props.crate(1), 346, 294);
    for (const [x, y, sd] of SUNFLOWER_SPOTS) put(() => Props.sunflower(sd), x, y);
    // the strip under the top fields: bales, crates, cans by the gate, a birdhouse, scarecrows, stones
    put(Props.roundBale, 52, 54); put(Props.roundBale, 74, 56); put(Props.roundBale, 268, 52); put(Props.roundBale, 586, 54); put(Props.roundBale, 608, 52);
    put(() => Props.crate(1), 112, 54); put(() => Props.crate(0), 127, 55);
    put(Props.milkCan, 142, 55); put(Props.milkCan, 152, 57); put(Props.milkCan, 197, 56);
    put(Props.signpost, 178, 58); put(Props.birdhouse, 218, 56);
    put(() => rock(12, 3), 300, 54); put(() => rock(10, 5), 488, 54);
    put(Props.barrel, 530, 56); put(Props.barrel, 543, 57);
    put(Props.scarecrow, 96, 31); put(Props.scarecrow, 470, 31); put(Props.scarecrow, 214, 382);
    put(() => Props.bush(14, 71), 240, 50); put(() => Props.bush(16, 72), 462, 50);
    put(Props.haystack, 548, 383); put(Props.haystack, 586, 385); put(Props.wagon, 456, 384);
    put(() => Props.lamppost(lit), 440, 352); put(Props.wheelbarrow, 88, 336); put(() => Props.bench(22), 190, 336); put(Props.picnic, 398, 358);
    add(311, () => Props.dock(78, lit).blit(426, 280));
    add(330, () => {
      Props.boat().blit(458, 313);
      for (let y = 306; y < 318; y++) E.set(476, y, y % 3 === 2 ? C.CR0 : C.CR1);   // mooring line from the dock to the boat
    });
    put(Props.tent, 614, 300); put(Props.campfire, 612, 336);
    put(() => Props.logSeat(16), 590, 344); put(() => Props.logSeat(14), 632, 346);

    // the animals themselves are agents (agents.js); only their hay and trough stand here
    put(hayBale, 586, 134); put(trough, 560, 98);

    // straw dropped around the stack
    const strawRng = rnd(303);
    for (let i = 0; i < 18; i++) {
      const sx = 456 + Math.round((strawRng() - 0.5) * 46), sy = 178 + Math.round((strawRng() - 0.5) * 8);
      if (E.getTag(sx, sy) === E.TAG.GROUND || E.getTag(sx, sy) === E.TAG.PATH) { E.set(sx, sy, strawRng() < 0.5 ? C.Y0 : C.Y1); E.set(sx + 1, sy - 1, C.Y0); }
    }

    const garden = Lo.garden;
    const gx0 = garden.x, gx1 = garden.x + garden.w, gy0 = garden.y + 6, gy1 = garden.y + garden.h;
    const P = Lo.pen;
    const fences = [
      ...fenceRun(gx0, gy0, 92, 4), ...fenceRun(164, gy0, gx1 - 164, 5), ...fenceRun(gx0, gy1, garden.w, 6),
      ...fenceV(gx0, gy0, gy1 - gy0), ...fenceV(gx1, gy0, gy1 - gy0),
      ...fenceRun(P.x, P.y + 12, P.w, 1), ...fenceRun(P.x, P.y + P.h, 36, 2), ...fenceRun(P.x + 60, P.y + P.h, P.w - 60, 3),
      ...fenceV(P.x, P.y + 12, P.h - 12), ...fenceV(P.x + P.w, P.y + 12, P.h - 12),
      ...fenceRun(30, 351, 120, 7), ...fenceRun(176, 351, 150, 8), ...fenceV(30, 351, 30), ...fenceV(326, 351, 30),
      ...fenceRun(0, 41, 148, 9), ...fenceRun(176, 41, 152, 10), ...fenceRun(334, 41, 146, 11), ...fenceRun(504, 41, 136, 12), ...fenceV(330, 0, 42),
    ];
    for (const r of fences) { darkenRect(r.x + 1, r.base + 1, r.x + r.sp.w + 2, r.base + 3); add(r.base, () => r.sp.blit(r.x, r.y)); }

    list.sort((a, b) => a[0] - b[0]);
    for (const [base, fn] of list) { E.setDepth(base); fn(); }
    E.setDepth(0);
    if (lit) bakeLights(); else E.light.fill(0);
    // the back bench of the picnic table sits behind whoever sits on it; the table top still hides their legs
    for (let y = 326; y <= 334; y++) for (let x = 374; x <= 422; x++) if (E.depth[y * W + x] === 358) E.depth[y * W + x] = 330;
    if (global.Ambient) global.Ambient.rescan();
    global.Nav.setBlocks([[424, 278, 506, 314], [372, 336, 424, 360]]);   // dock deck and table: walkers use waypoints there
    global.Nav.build();
  }

  /* ---------- animation: three workers and the fish ---------- */
  const FISH = [
    { cx: 520, cy: 324, rx: 38, ry: 18, w: 0.33, ph: 0.0 },
    { cx: 538, cy: 306, rx: 24, ry: 11, w: -0.46, ph: 2.1 },
    { cx: 486, cy: 340, rx: 20, ry: 9, w: 0.40, ph: 4.0 },
    { cx: 548, cy: 330, rx: 18, ry: 10, w: -0.30, ph: 1.0 },
  ];
  const ring = (cx, cy, r, c) => {
    for (let a = 0; a < 6.283; a += 0.28) {
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.45);
      if (isPond(x, y)) E.set(x, y, c);
    }
  };

  const hash01 = (n) => { let h = Math.imul(n | 0, 374761393) + 668265263; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  /* ---------- light ----------
     A pool of light is three hard bands (levels 3, 2, 1) in the per-pixel light map; the palette turns the
     level into a warmer, brighter bank. Edges wobble with noise so a pool is never a perfect ellipse. */
  function lightPool(cx, cy, rx, ry) {
    const x0 = Math.max(0, Math.floor(cx - rx * 1.2)), x1 = Math.min(W - 1, Math.ceil(cx + rx * 1.2));
    const y0 = Math.max(0, Math.floor(cy - ry * 1.2)), y1 = Math.min(H - 1, Math.ceil(cy + ry * 1.2));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry) + (n2(x / 5, y / 5, 7) - 0.5) * 0.16;
      const lvl = d < 0.36 ? 3 : d < 0.66 ? 2 : d < 1 ? 1 : 0;
      if (lvl > E.light[y * W + x]) E.light[y * W + x] = lvl;
    }
  }
  const LIGHTS = [
    [97, 148, 20, 9], [139, 148, 20, 9], [126, 144, 18, 9],     // house windows and the porch lantern
    [230, 124, 14, 7], [378, 148, 20, 8],                       // coop window, barn loft
    [132, 224, 30, 15], [262, 222, 30, 15], [400, 224, 30, 15], [520, 222, 30, 15], [440, 356, 30, 15],   // lamp posts along the road
  ];
  function bakeLights() {
    E.light.fill(0);
    for (const [x, y, rx, ry] of LIGHTS) lightPool(x, y, rx, ry);
  }

  const FIRE = { x: 611, y: 329 };
  function drawFire(t) {
    const fl = Math.sin(t * 11) * 0.5 + Math.sin(t * 17 + 1.3) * 0.5;
    for (let h = 0; h < 10; h++) {
      const w = Math.max(1, 5 - Math.floor(h * 0.55));
      const sway = Math.round(Math.sin(t * 9 + h * 0.6) * h * 0.14);
      for (let dx = -(w >> 1); dx <= (w >> 1); dx++) E.set(FIRE.x + dx + sway, FIRE.y - h, h < 4 ? C.GL0 : C.GL1);
    }
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.9 + i * 0.27) % 1;
      E.set(Math.round(FIRE.x + Math.sin(t * 3 + i * 2) * 4 * k), Math.round(FIRE.y - 8 - k * 14), k < 0.7 ? C.GL1 : C.GL0);
    }
    const rf = 1 + 0.07 * fl;
    lightPool(FIRE.x, FIRE.y + 5, 36 * rf, 18 * rf);
  }

  const FLIES = Array.from({ length: 24 }, (_, i) => ({
    x: 30 + hash01(i * 3 + 1) * 580, y: 50 + hash01(i * 5 + 2) * 300,
    ax: 6 + hash01(i + 11) * 20, ay: 4 + hash01(i + 23) * 10, w: 0.25 + hash01(i + 31) * 0.5, ph: hash01(i + 41) * 6.283,
  }));
  function drawFlies(t, amt) {
    const n = Math.round(FLIES.length * amt);
    for (let i = 0; i < n; i++) {
      const f = FLIES[i];
      const x = Math.round(f.x + f.ax * Math.sin(f.w * t + f.ph)), y = Math.round(f.y + f.ay * Math.sin(f.w * 1.3 * t + f.ph * 2));
      const pulse = 0.5 + 0.5 * Math.sin(t * (1.4 + f.w * 2) + f.ph * 3);
      if (pulse < 0.25) continue;
      E.set(x, y, C.GL1);
      if (pulse > 0.62) { E.set(x - 1, y, C.GL0); E.set(x + 1, y, C.GL0); E.set(x, y - 1, C.GL0); E.set(x, y + 1, C.GL0); }
    }
  }

  let agentsReady = false, ambientReady = false;
  function animate(t, env) {
    env = env || { people: true, fire: false, flies: 0, sleep: false, light: 0 };
    const A = global.Actors;
    if (!ambientReady) {
      global.Ambient.setup({ shade: (c) => SHADOW[c] || DARKEN[c], darken: (x, y) => { const tg = E.getTag(x, y); if (tg !== E.TAG.GROUND && tg !== E.TAG.PATH) return; const c = E.get(x, y); E.set(x, y, SHADOW[c] || DARKEN[c] || c); } });
      ambientReady = true;
    }
    global.Ambient.under(t, env);
    // fish shadows nosing round the pond; the tail flicks
    FISH.forEach((f, i) => {
      const a = f.w * t + f.ph, px = f.cx + f.rx * Math.cos(a), py = f.cy + f.ry * Math.sin(a);
      let dx = -f.rx * Math.sin(a) * f.w, dy = f.ry * Math.cos(a) * f.w;
      const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      const wig = Math.sin(t * 8 + i) * 1.1;
      const seg = [[0, 0, 0], [-2, 0, 0], [-4, 0, 0.4], [-6, 0, wig], [-7.5, 0, wig * 1.7]];
      for (const [d, , off] of seg) {
        const x = Math.round(px + dx * d - dy * off), y = Math.round(py + dy * d + dx * off);
        if (!isPond(x, y) || dist[y * W + x] < 5) continue;
        const under = E.get(x, y);
        const c = (under === C.W0 || under === C.WDEEP) ? C.WDEEP : C.W0;
        E.set(x, y, c);
        if (d > -4 && d < 0.5) { const sx = Math.round(x - dy), sy = Math.round(y + dx); if (isPond(sx, sy)) E.set(sx, sy, c); }
      }
    });
    // a fish jumps every so often, with rings where it leaves and re-enters the water
    const cyc = 10.5, n = Math.floor((t + 2) / cyc), ph = (t + 2) - n * cyc;
    if (ph < 2.0) {
      const r = rnd(n * 97 + 5);
      const jx = 498 + Math.floor(r() * 56), jy = 318 + Math.floor(r() * 18);
      if (isPond(jx, jy) && isPond(jx + 11, jy)) {
        const u = Math.min(1, ph / 0.9);
        if (ph < 0.9) {
          const fx = jx + 11 * u, fy = jy - 4 * 14 * u * (1 - u) * 1;
          A.fishSide(u < 0.4 ? 'up' : u < 0.62 ? 'flat' : 'down').blit(Math.round(fx - 5), Math.round(fy - 4));
        }
        if (ph < 1.6) ring(jx, jy, 1 + ph * 5, C.W4);
        if (ph > 0.8) ring(jx + 11, jy, 1 + (ph - 0.8) * 5, C.W4);
      }
    }
    if (!agentsReady) {
      global.Agents.setup({ shadow: (x, y, rx) => shadowEllipse(x, y, rx, 1), ring, light: lightPool });
      agentsReady = true;
    }
    global.Agents.frame(t, env);
    global.Ambient.over(t, env);
    if (env.fire) drawFire(t);
    if (env.flies > 0) drawFlies(t, env.flies);
  }

  global.Scene = { render, animate, LAYOUT };
})(window);
