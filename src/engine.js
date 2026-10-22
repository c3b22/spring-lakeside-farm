/* Pixel engine: an indexed 480x270 buffer plus the few primitives the scene needs.
   Everything is opaque palette indices; colour only appears in main.js. */
(function (global) {
  'use strict';

  const W = 640, H = 400;
  const buf = new Uint8Array(W * H);
  const tag = new Uint8Array(W * H);
  const light = new Uint8Array(W * H);    // 0 = unlit, 1-3 = warm light bank for that pixel
  const depth = new Uint16Array(W * H);   // base row of whatever stood up here last (0 = ground)
  const TAG = { NONE: 0, GROUND: 1, WATER: 2, OBJ: 3, PATH: 4 };

  function rngFor(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }

  function inb(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  function set(x, y, c) { x |= 0; y |= 0; if (inb(x, y)) buf[y * W + x] = c; }
  function get(x, y) { return inb(x, y) ? buf[y * W + x] : 0; }
  function setTag(x, y, t) { x |= 0; y |= 0; if (inb(x, y)) tag[y * W + x] = t; }
  function getTag(x, y) { return inb(x, y) ? tag[y * W + x] : 0; }

  function rect(x, y, w, h, c, t) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      set(x + i, y + j, c);
      if (t !== undefined) setTag(x + i, y + j, t);
    }
  }
  function hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) set(x, y, c); }
  function vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) set(x, y, c); }

  /* Piecewise-linear height lookup over [[x,y],...] */
  function poly(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const a = pts[i - 1], b = pts[i];
        return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      }
    }
    return pts[pts.length - 1][1];
  }

  /* Value noise, bilinear with smoothstep. */
  function hash2(ix, iy, seed) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise2(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
    const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  }

  const state = { outlineMode: 'soft', depth: 0 };

  /* Small offscreen sprite with 1px margin so outlines fit. -1 = empty. */
  class Spr {
    constructor(w, h) {
      this.w = w; this.h = h; this.sw = w + 2;
      this.d = new Int16Array((w + 2) * (h + 2)).fill(-1);
    }
    set(x, y, c) {
      x |= 0; y |= 0;
      if (x < -1 || y < -1 || x > this.w || y > this.h) return;
      this.d[(y + 1) * this.sw + x + 1] = c;
    }
    get(x, y) {
      if (x < -1 || y < -1 || x > this.w || y > this.h) return -1;
      return this.d[(y + 1) * this.sw + x + 1];
    }
    has(x, y) { return this.get(x, y) >= 0; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
    hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
    vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) this.set(x, y, c); }
    /* Volume in three tones with the light at the top-left; optional rim colour on the shadow edge. */
    shadeEllipse(cx, cy, rx, ry, ramp) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry, e = dx * dx + dy * dy;
        if (e > 1) continue;
        const t = (-dx - dy) / 1.414;
        let c = t > 0.42 ? ramp.l : t < -0.30 ? ramp.d : ramp.m;
        if (ramp.rim !== undefined && e > 0.72 && t < 0) c = ramp.rim;
        this.set(x, y, c);
      }
      return this;
    }
    shadeRect(x0, y0, w, h, ramp) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let c = ramp.m;
        if (x === 0 || y === 0) c = ramp.l;
        if (x === w - 1 || y === h - 1) c = ramp.d;
        this.set(x0 + x, y0 + y, c);
      }
      return this;
    }
    /* Selout: edges facing the light (left / top) take `lit`, the rest `dark`. */
    outline(dark, lit) {
      const mode = state.outlineMode;
      if (mode === 'none') return this;
      const pal = global.Palette && global.Palette.OUTLINE;
      const add = [];
      for (let y = -1; y <= this.h; y++) for (let x = -1; x <= this.w; x++) {
        if (this.has(x, y)) continue;
        const towardBody = this.has(x + 1, y) || this.has(x, y + 1);
        const awayBody = this.has(x - 1, y) || this.has(x, y - 1);
        if (!towardBody && !awayBody) continue;
        const isLit = towardBody && !awayBody;
        let c = isLit ? lit : dark;
        if (mode === 'soft' && pal) {
          const src = isLit ? (this.has(x + 1, y) ? this.get(x + 1, y) : this.get(x, y + 1))
                            : (this.has(x - 1, y) ? this.get(x - 1, y) : this.get(x, y - 1));
          c = (isLit ? pal.lit : pal.dark)[src];
        }
        add.push([x, y, c]);
      }
      for (const [x, y, c] of add) this.set(x, y, c);
      return this;
    }
    /* Copy another sprite's filled pixels on top of this one. */
    paste(src, x, y) {
      for (let j = -1; j <= src.h; j++) for (let i = -1; i <= src.w; i++) {
        const c = src.get(i, j);
        if (c >= 0) this.set(x + i, y + j, c);
      }
      return this;
    }
    footRow() {
      if (this._foot !== undefined) return this._foot;
      for (let j = this.h; j >= -1; j--) for (let i = -1; i <= this.w; i++) if (this.get(i, j) >= 0) return (this._foot = j);
      return (this._foot = this.h - 1);
    }
    flipX() {
      const s = new Spr(this.w, this.h);
      for (let j = -1; j <= this.h; j++) for (let i = -1; i <= this.w; i++) {
        const c = this.get(i, j);
        if (c >= 0) s.set(this.w - 1 - i, j, c);
      }
      if (this.clumps) s.clumps = this.clumps;
      return s;
    }
    blit(x, y) {
      for (let j = -1; j <= this.h; j++) for (let i = -1; i <= this.w; i++) {
        const c = this.get(i, j);
        if (c >= 0) {
          set(x + i, y + j, c); setTag(x + i, y + j, TAG.OBJ);
          if (inb(x + i, y + j)) depth[(y + j) * W + x + i] = state.depth;
        }
      }
    }
    /* Draw an animated sprite whose feet are on row `feet`: pixels where something nearer the camera
       already stands (a tree, a wall) stay in front of it. */
    blitDepth(x, y, feet) {
      for (let j = -1; j <= this.h; j++) for (let i = -1; i <= this.w; i++) {
        const c = this.get(i, j);
        if (c < 0 || !inb(x + i, y + j) || depth[(y + j) * W + x + i] > feet) continue;
        buf[(y + j) * W + x + i] = c;
      }
    }
    /* Anchor = bottom-centre, the point that touches the ground. */
    blitAt(ax, ay) { this.blit(ax - (this.w >> 1), ay - this.h + 1); }
  }

  /* Overlapping bubbles (foliage, clouds, rocks) shaded as a mass.
     Light comes from the top-left; each bubble keeps its own terminator
     so the outline of a tree reads as clumps, not one blob. */
  function blob(spr, circles, ramp, rng) {
    for (const c of circles) {
      const a1 = 0.05 + rng() * 0.09, a2 = 0.03 + rng() * 0.07;
      const p1 = rng() * 6.283, p2 = rng() * 6.283;
      const R = Math.ceil(c.r * 1.3);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
        const re = c.r * (1 + a1 * Math.sin(2 * th + p1) + a2 * Math.sin(3 * th + p2));
        if (d > re) continue;
        const t = (-dx - dy) / (1.414 * re);
        let col = ramp.m;
        if (t > 0.40) col = ramp.l;
        else if (t < -0.28) col = ramp.d;
        if (t < -0.12 && d > re - 1.5) col = ramp.rim !== undefined ? ramp.rim : ramp.d;
        spr.set(c.x + dx, c.y + dy, col);
      }
    }
  }

  function darkenStep(c, map) { return map[c] !== undefined ? map[c] : c; }

  global.Engine = {
    W, H, buf, tag, depth, light, TAG, setDepth(v) { state.depth = v; }, rngFor, bayer, set, get, setTag, getTag, rect, hline, vline,
    poly, noise2, Spr, blob, darkenStep, inb, setOutlineMode(m) { state.outlineMode = m; },
  };
})(window);
