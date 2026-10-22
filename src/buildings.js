/* Buildings, Stardew style: a front wall under a wide roof slope seen from above, never a side wall,
   because the ground is drawn straight down and a side wall would contradict it.
   Depth instead comes from layers: eave shadow on the wall, a plinth wider than the wall,
   recessed doors and windows, and an annex with a lower roof that sits two pixels further back. */
(function (global) {
  'use strict';

  const E = global.Engine;
  const C = global.Palette.C;
  const hh = (a, b) => { let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  /* One front-view block: wall, roof, doors, windows. Coordinates in cfg are local to the block. */
  function block(cfg, lit) {
    const w = cfg.w, base = cfg.h, skirt = cfg.skirt || 0;
    const sp = new E.Spr(w, base + skirt);
    const roofY = cfg.roofY || 0, roofH = cfg.roofH;
    const wy0 = roofY + roofH - 2;
    const fh = 4;                                        // stone plinth rows
    const L = (y) => Math.round(cfg.inset * (1 - (y - roofY) / (roofH - 1)));
    const wl = cfg.wall, rr = cfg.roof;

    // wall (or the dark inside of a porch), the eave dropping a dithered shadow on it
    for (let y = wy0; y < base; y++) for (let x = cfg.ov; x < w - cfg.ov; x++) {
      const wy = y - wy0;
      let c;
      if (y >= base - fh) {
        c = ((x + (y % 2) * 3) % 8 === 0) ? C.M0 : (y === base - fh ? C.M2 : C.M1);
      } else if (cfg.porch) {
        c = wy < 5 ? C.WD0 : ((y + x) % 7 === 0 ? C.WD0 : C.WD1);
        if (y >= base - fh - 3) c = (y === base - fh - 3) ? C.WD4 : (y % 2 ? C.WD3 : C.WD2);   // floor boards
      } else {
        if (cfg.style === 'siding') {
          const b = wy % 4; c = b === 0 ? wl.l : b === 3 ? wl.d : wl.m;
          if (b > 0 && b < 3 && (x + Math.floor(wy / 4) * 7) % 19 === 0) c = wl.d;            // staggered butt joints
          if (b === 1 && hh(x >> 3, wy >> 2) > 0.9) c = wl.l;                                   // a board that caught more sun
        } else {
          const col = (x - cfg.ov) % 6; c = col === 0 ? wl.d : col === 1 ? wl.l : wl.m;
          const ph = hh(Math.floor((x - cfg.ov) / 6), w);
          if (c === wl.m && ph < 0.2) c = wl.l; else if (c === wl.m && ph > 0.84) c = wl.d;    // planks of different age
          if (c === wl.m && hh(x, y) > 0.985) c = wl.d;                                         // knots
        }
        if (wy < 2) c = wl.d;
        else if (wy === 2 && (x + y) % 2 === 0) c = wl.d;
        else if (wy === 3 && x % 3 === 0) c = wl.d;
        else if (x < cfg.ov + 2) c = wl.l;
        else if (x >= w - cfg.ov - 3) c = wl.d;
        if (y >= base - fh - 5 && E.noise2(x / 4, y / 2.5, 5 + w) > 0.52) c = c === wl.l ? wl.m : wl.d;   // dirt splashed up from the ground
      }
      sp.set(x, y, c);
    }
    for (let y = base - fh; y < base; y++) { sp.set(cfg.ov - 1, y, C.M2); sp.set(w - cfg.ov, y, C.M0); }   // plinth juts out
    if (cfg.trim) {
      for (let y = wy0 + 2; y < base - fh; y++) {
        for (let k = 0; k < 3; k++) { sp.set(cfg.ov + k, y, k === 0 ? cfg.trim.l : cfg.trim.d); sp.set(w - cfg.ov - 1 - k, y, cfg.trim.d); }
      }
    }

    // roof: a wide trapezoid, bright ridge on top, fascia board along the lower edge
    for (let y = roofY; y < roofY + roofH; y++) {
      const l = L(y), r = w - 1 - l, within = (y - roofY) % 5, band = Math.floor((y - roofY) / 5);
      for (let x = l; x <= r; x++) {
        let c = rr.m;
        if (within === 0) c = rr.l;
        else if (within === 4) c = rr.d;
        else if (((x + (band % 2) * 5) % 10) === 0) c = rr.d;
        if (x <= l + 1 && within !== 4) c = rr.l;
        if (x >= r - 1) c = rr.d;
        if (c === rr.m) {
          const v = hh(Math.floor((x + (band % 2) * 5) / 10), band * 7 + w);
          if (v < 0.17) c = rr.l; else if (v > 0.87) c = rr.d;                                  // individual shingles
          else if (y - roofY > roofH * 0.5 && E.noise2(x / 2.6, band, w) > 0.80) c = rr.d;      // rain streaks lower down
        }
        if (y - roofY < 2) c = rr.l;
        if (cfg.fascia && y >= roofY + roofH - 2) c = y === roofY + roofH - 2 ? cfg.fascia.l : cfg.fascia.d;
        sp.set(x, y, c);
      }
    }

    if (cfg.porch) {                                                                       // posts, rail, bench, plant
      const top = wy0 + 1, floor = base - fh - 4;
      for (const px of [cfg.ov, w - cfg.ov - 3]) {
        sp.vline(px, top, floor + 3, C.WD3); sp.vline(px + 1, top, floor + 3, C.WD3); sp.vline(px + 2, top, floor + 3, C.WD1);
      }
      const ry = floor - 9;
      sp.hline(cfg.ov, w - cfg.ov - 1, ry, C.CR0); sp.hline(cfg.ov, w - cfg.ov - 1, ry + 1, C.CR1);
      sp.hline(cfg.ov, w - cfg.ov - 1, floor, C.CR0); sp.hline(cfg.ov, w - cfg.ov - 1, floor + 1, C.CR1);
      for (let x = cfg.ov + 4; x < w - cfg.ov - 3; x += 4) { sp.vline(x, ry + 2, floor - 1, C.CR1); sp.set(x - 1, ry + 2, C.CR0); }
      const bx = cfg.ov + 6;
      sp.rect(bx, floor - 14, 12, 3, C.WD3); sp.hline(bx, bx + 11, floor - 14, C.WD4);
      sp.vline(bx + 1, floor - 11, floor - 9, C.WD1); sp.vline(bx + 10, floor - 11, floor - 9, C.WD1);
      sp.rect(bx + 2, floor - 17, 4, 3, C.B1); sp.set(bx + 2, floor - 17, C.B2);
      const px2 = w - cfg.ov - 9;
      sp.rect(px2, floor - 6, 5, 5, C.R2); sp.hline(px2, px2 + 4, floor - 6, C.R3); sp.hline(px2, px2 + 4, floor - 2, C.R1);
      sp.set(px2 + 2, floor - 10, C.CG1); sp.set(px2 + 1, floor - 9, C.CG2); sp.set(px2 + 3, floor - 9, C.CG1); sp.set(px2 + 2, floor - 8, C.CG0); sp.set(px2 + 2, floor - 7, C.CG0);
      sp.set(px2 + 2, floor - 11, C.B2);
    }

    if (cfg.bay) {                                                                         // open hay bay
      const t = cfg.bay;
      sp.rect(t.x - 1, t.y - 1, t.w + 2, t.h + 1, C.WD3);
      sp.rect(t.x, t.y, t.w, t.h, C.WD0);
      for (let r = 0; r < t.h - 3; r++) {
        const half = Math.min(t.w >> 1, 2 + r), cx = t.x + (t.w * 0.62 | 0);
        for (let x = cx - half; x <= cx + half; x++) {
          if (x < t.x || x >= t.x + t.w) continue;
          sp.set(x, t.y + t.h - 1 - r, r % 3 === 0 ? C.Y1 : (x + r) % 4 === 0 ? C.O1 : C.Y0);
        }
      }
      sp.hline(t.x, t.x + t.w - 1, t.y + t.h - 1, C.D3);
      sp.vline(t.x + 3, t.y, t.y + t.h - 1, C.WD3); sp.vline(t.x + 4, t.y, t.y + t.h - 1, C.WD1);
    }
    if (cfg.hatch) {
      const t = cfg.hatch;
      sp.rect(t.x, t.y, t.w, t.h, C.CR0);
      sp.rect(t.x + 1, t.y + 1, t.w - 2, t.h - 2, lit ? C.GL0 : C.WD0);
      sp.hline(t.x + 1, t.x + t.w - 2, t.y + t.h - 2, lit ? C.GL1 : C.Y0);
      sp.hline(t.x + 1, t.x + t.w - 2, t.y + t.h - 3, lit ? C.GL1 : C.Y1);
      sp.hline(t.x - 1, t.x + t.w, t.y + t.h, C.WD4);
    }

    for (const win of cfg.windows || []) {
      sp.rect(win.x, win.y, win.w, win.h, C.CR0);
      sp.rect(win.x + 1, win.y + 1, win.w - 2, win.h - 2, lit ? C.GL1 : C.BL1);
      if (lit) sp.rect(win.x + 1, win.y + 1, win.w - 2, 3, C.GL0);
      else for (let k = 0; k < Math.min(win.w, win.h) - 5; k++) sp.set(win.x + 2 + k, win.y + win.h - 3 - k, C.W4);
      sp.hline(win.x + 1, win.x + win.w - 2, win.y + 1, lit ? C.GL0 : C.BL0);
      sp.vline(win.x + 1, win.y + 1, win.y + win.h - 2, lit ? C.GL0 : C.BL0);
      sp.vline(win.x + (win.w >> 1), win.y + 1, win.y + win.h - 2, C.CR0);
      sp.hline(win.x + 1, win.x + win.w - 2, win.y + (win.h >> 1), C.CR0);
      sp.hline(win.x - 1, win.x + win.w, win.y + win.h, C.WD4);
      sp.hline(win.x - 1, win.x + win.w, win.y + win.h + 1, C.WD1);
      sp.hline(win.x, win.x + win.w - 1, win.y + win.h + 2, wl.d);
      if (!cfg.shutters) { sp.vline(win.x + win.w + 1, win.y + 1, win.y + win.h + 2, wl.d); sp.vline(win.x - 1, win.y + 1, win.y + win.h, wl.l); }
      if (cfg.shutters) {
        for (const sx of [win.x - 4, win.x + win.w + 1]) {
          sp.rect(sx, win.y, 3, win.h, C.CG1);
          sp.vline(sx, win.y, win.y + win.h - 1, C.CG2);
          for (let sy = win.y + 2; sy < win.y + win.h; sy += 3) sp.hline(sx, sx + 2, sy, C.CG0);
        }
      }
      if (cfg.boxes) {
        sp.rect(win.x - 1, win.y + win.h + 3, win.w + 2, 3, C.WD1);
        sp.hline(win.x - 1, win.x + win.w, win.y + win.h + 3, C.WD2);
        const dots = [C.B1, C.Y0, C.B2, C.BL1, C.B1, C.Y0, C.B2, C.V1];
        for (let k = 0; k < win.w; k += 2) sp.set(win.x + k, win.y + win.h + 2, dots[(k >> 1) % dots.length]);
      }
    }

    const d = cfg.door;
    if (d && d.kind === 'barn') {
      sp.rect(d.x, d.y, d.w, d.h, C.WD0);
      const lw = (d.w - 2) >> 1;
      for (let leaf = 0; leaf < 2; leaf++) {
        const lx = d.x + 1 + leaf * lw;
        sp.rect(lx, d.y + 1, lw, d.h - 1, C.R1);
        sp.hline(lx, lx + lw - 1, d.y + 1, C.CR0); sp.hline(lx, lx + lw - 1, d.y + d.h - 1, C.CR0);
        sp.vline(lx, d.y + 1, d.y + d.h - 1, C.CR0); sp.vline(lx + lw - 1, d.y + 1, d.y + d.h - 1, C.CR0);
        for (let t = 0; t < d.h - 3; t++) {
          const xx = Math.round(1 + t * (lw - 3) / (d.h - 4));
          sp.set(lx + 1 + xx, d.y + 2 + t, C.CR0); sp.set(lx + lw - 2 - xx, d.y + 2 + t, C.CR1);
        }
      }
      sp.vline(d.x + (d.w >> 1), d.y + 1, d.y + d.h - 1, C.WD0);
      sp.hline(d.x - 1, d.x + d.w, d.y - 1, C.CR0);
    } else if (d) {
      sp.rect(d.x - 2, d.y - 2, d.w + 4, d.h + 2, C.CR0);
      sp.rect(d.x - 1, d.y - 1, d.w + 2, d.h + 1, C.WD0);
      for (let y = d.y; y < d.y + d.h; y++) for (let x = d.x; x < d.x + d.w; x++) sp.set(x, y, ((x - d.x) % 4 === 3) ? C.WD1 : C.WD2);
      sp.hline(d.x, d.x + d.w - 1, d.y, C.WD0); sp.hline(d.x, d.x + d.w - 1, d.y + 1, C.WD0);
      sp.vline(d.x, d.y, d.y + d.h - 1, C.WD0);
      sp.set(d.x + d.w - 3, d.y + (d.h >> 1), C.GL0); sp.set(d.x + d.w - 3, d.y + (d.h >> 1) + 1, C.GL1);
    }

    if (cfg.awning) {
      const a = cfg.awning;
      for (const px of [a.x + 1, a.x + a.w - 3]) {
        sp.vline(px, a.y + a.h, base - fh - 1, C.WD3); sp.vline(px + 1, a.y + a.h, base - fh - 1, C.WD1);
      }
      for (let r = 0; r < a.h; r++) {
        const cut = Math.max(0, 3 - r);
        for (let x = a.x + cut; x < a.x + a.w - cut; x++) {
          let c = rr.m;
          if (r === 0) c = rr.l;
          else if (r === a.h - 1) c = cfg.fascia.d;
          else if (r === a.h - 2) c = cfg.fascia.l;
          else if (((x + (r % 2) * 3) % 6) === 0) c = rr.d;
          sp.set(x, a.y + r, c);
        }
      }
      sp.hline(a.x + 2, a.x + a.w - 3, a.y + a.h, C.WD0);
    }
    if (cfg.lamp) {
      const m = cfg.lamp;
      sp.vline(m.x, m.y - 2, m.y - 1, C.INK1);
      sp.rect(m.x - 1, m.y, 3, 3, lit ? C.GL1 : C.CR1);
      sp.set(m.x, m.y + 1, lit ? C.GL0 : C.BL1);
    }

    if (d && cfg.ramp) {
      for (let k = 0; k < skirt; k++) sp.hline(d.x + 1, d.x + d.w - 2, base + k, k === 0 ? C.WD4 : k === 1 ? C.WD3 : C.WD1);
      for (let y = base - fh; y < base; y++) for (let x = d.x; x <= d.x + d.w - 1; x++) sp.set(x, y, C.WD2);
    } else if (d) {
      for (let y = base - fh; y < base; y++) for (let x = d.x - 1; x <= d.x + d.w; x++) sp.set(x, y, y === base - fh ? C.D4 : C.D3);
      for (let k = 0; k < skirt; k++) sp.hline(d.x - 3, d.x + d.w + 2, base + k, k === 0 ? C.D4 : k === skirt - 1 ? C.D1 : C.D3);
    }

    if (cfg.nest) {
      const n = cfg.nest;
      sp.rect(n.x, n.y, n.w, n.h, C.WD2);
      sp.vline(n.x, n.y, n.y + n.h - 1, C.WD3); sp.vline(n.x + n.w - 1, n.y, n.y + n.h - 1, C.WD1);
      sp.rect(n.x - 1, n.y - 3, n.w + 2, 3, C.WD3); sp.hline(n.x - 1, n.x + n.w, n.y - 3, C.WD4); sp.hline(n.x - 1, n.x + n.w, n.y - 1, C.WD1);
      sp.rect(n.x + 3, n.y + 4, n.w - 6, 5, C.WD0);
      sp.hline(n.x + 3, n.x + n.w - 4, n.y + 8, C.Y0); sp.hline(n.x + 4, n.x + n.w - 5, n.y + 7, C.Y1);
    }
    if (cfg.chimney) {
      const c = cfg.chimney;
      for (let y = c.top; y < c.bottom; y++) for (let x = c.x; x < c.x + c.w; x++) {
        let col = C.M1;
        if (x === c.x) col = C.M2; else if (x >= c.x + c.w - 2) col = C.M0;
        if (((y + (x > c.x + (c.w >> 1) ? 2 : 0)) % 4) === 3) col = C.M0;
        sp.set(x, y, col);
      }
      sp.hline(c.x - 1, c.x + c.w, c.top, C.M3); sp.hline(c.x - 1, c.x + c.w, c.top + 1, C.M2); sp.hline(c.x - 1, c.x + c.w, c.top + 2, C.M0);
    }
    return sp.outline(C.INK0, C.INK1);
  }

  /* Main block plus an optional annex tucked behind its right edge. */
  function building(cfg, lit) {
    const main = block(cfg, lit);
    if (!cfg.annex) return main;
    const a = cfg.annex, ac = a.cfg;
    const ax = cfg.w - cfg.ov - ac.ov - 1;                 // annex wall starts exactly where the main wall ends
    const ay = cfg.h - ac.h - (a.lift === undefined ? 2 : a.lift);
    const out = new E.Spr(ax + ac.w, cfg.h + (cfg.skirt || 0));
    out.paste(block(ac, lit), ax, ay);
    out.paste(main, 0, 0);
    return out;
  }

  /* Tall brick silo with a slate dome: the vertical accent that gives the barn some height. */
  function silo() {
    const W = 26, H = 64, top = 13;
    const sp = new E.Spr(W, H);
    const cx = (W - 1) / 2, a = W / 2;
    for (let y = top; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x - cx) / a, row = Math.floor((y - top) / 4);
      let c = u < -0.45 ? C.R3 : u < 0.25 ? C.R2 : C.R1;
      if ((y - top) % 4 === 3) c = u < -0.45 ? C.R2 : C.R1;
      else if (((x + (row % 2) * 4) % 8) === 0) c = u < -0.45 ? C.R2 : u < 0.25 ? C.R1 : C.R0;
      const hv = hh(Math.floor(x / 3) + row * 7, row);
      if (hv < 0.10 && c === C.R2) c = C.R1; else if (hv > 0.92 && c === C.R2) c = C.R3;
      if (y > H - 16 && y < H - 4 && c === C.R2 && E.noise2(x / 3, y / 2, 3) > 0.55) c = C.R1;      // soot and damp low down
      if (y >= H - 4) c = ((x + (y % 2) * 3) % 8 === 0) ? C.M0 : (y === H - 4 ? C.M2 : C.M1);
      sp.set(x, y, c);
    }
    for (const by of [top + 7, top + 22, top + 37]) {
      for (let x = 0; x < W; x++) { sp.set(x, by, x < 8 ? C.M3 : C.M2); sp.set(x, by + 1, x < 8 ? C.M2 : C.M0); }
    }
    for (let y = 0; y < top; y++) {
      const dy = top - y, hw = Math.floor(Math.sqrt(a * a - dy * dy));
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const u = (x - cx) / a;
        let c = u < -0.35 ? C.M2 : u < 0.3 ? C.M1 : C.M0;
        if (y < 2) c = C.M3;
        sp.set(x, y, c);
      }
    }
    sp.hline(0, W - 1, top, C.M3); sp.hline(0, W - 1, top + 1, C.M0);
    sp.rect(9, H - 14, 8, 10, C.WD0); sp.rect(10, H - 13, 6, 9, C.WD2); sp.vline(13, H - 13, H - 5, C.WD1);
    return sp.outline(C.INK0, C.INK1);
  }

  /* Total widths match LAYOUT: house 100, coop 70, barn 112. Door centres match the path spurs. */
  const HOUSE = {
    w: 76, h: 80, skirt: 3, roofY: 8, roofH: 36, inset: 7, ov: 4, style: 'siding',
    roof: { l: C.R3, m: C.R2, d: C.R1 }, fascia: { l: C.WD4, d: C.WD1 },
    wall: { l: C.WD4, m: C.WD3, d: C.WD2 }, trim: { l: C.CR0, d: C.CR1 },
    windows: [{ x: 11, y: 51, w: 12, h: 13 }, { x: 53, y: 51, w: 12, h: 13 }], boxes: true, shutters: true,
    door: { x: 31, y: 54, w: 14, h: 22, kind: 'single' },
    awning: { x: 24, y: 46, w: 28, h: 8 },
    lamp: { x: 46, y: 56 },
    chimney: { x: 52, w: 10, top: 0, bottom: 24 },
    annex: {
      overlap: 4, lift: 2,
      cfg: {
        w: 28, h: 62, roofY: 0, roofH: 20, inset: 3, ov: 2, style: 'siding', porch: true,
        roof: { l: C.R3, m: C.R2, d: C.R1 }, fascia: { l: C.WD4, d: C.WD1 },
        wall: { l: C.WD4, m: C.WD3, d: C.WD2 },
      },
    },
  };
  const COOP = {
    w: 48, h: 50, skirt: 3, roofY: 0, roofH: 20, inset: 5, ov: 4, style: 'planks',
    roof: { l: C.WD4, m: C.WD3, d: C.WD2 }, fascia: { l: C.WD2, d: C.WD0 },
    wall: { l: C.WD3, m: C.WD2, d: C.WD1 },
    windows: [{ x: 8, y: 30, w: 9, h: 9 }],
    door: { x: 19, y: 30, w: 10, h: 16, kind: 'single' }, ramp: true,
    annex: {
      overlap: 3, lift: 2,
      cfg: {
        w: 25, h: 36, skirt: 0, roofY: 0, roofH: 13, inset: 3, ov: 3, style: 'planks',
        roof: { l: C.WD4, m: C.WD3, d: C.WD2 }, fascia: { l: C.WD2, d: C.WD0 },
        wall: { l: C.WD3, m: C.WD2, d: C.WD1 },
        nest: { x: 6, y: 18, w: 11, h: 11 },
      },
    },
  };
  const BARN = {
    w: 84, h: 88, skirt: 2, roofY: 0, roofH: 36, inset: 9, ov: 5, style: 'planks',
    roof: { l: C.M2, m: C.M1, d: C.M0 }, fascia: { l: C.CR0, d: C.CR1 },
    wall: { l: C.R3, m: C.R2, d: C.R1 }, trim: { l: C.CR0, d: C.CR1 },
    hatch: { x: 35, y: 46, w: 14, h: 9 },
    door: { x: 29, y: 56, w: 26, h: 28, kind: 'barn' },
    annex: {
      overlap: 4, lift: 2,
      cfg: {
        w: 32, h: 66, skirt: 0, roofY: 0, roofH: 20, inset: 4, ov: 3, style: 'planks',
        roof: { l: C.M2, m: C.M1, d: C.M0 }, fascia: { l: C.CR0, d: C.CR1 },
        wall: { l: C.R3, m: C.R2, d: C.R1 }, trim: { l: C.CR0, d: C.CR1 },
        bay: { x: 8, y: 28, w: 20, h: 32 },
      },
    },
  };

  global.Buildings = { gable: building, silo, HOUSE, COOP, BARN };
})(window);
