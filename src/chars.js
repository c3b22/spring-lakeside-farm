/* The three villagers, drawn in code from the approved character sheet (charsheet.html).
   Every sprite is built once in RGB, the colours are appended to the palette (so day/night grading and lamp light
   apply to people like everything else), then stored as indexed sprites.
   Chars.get(name, view, pose, f, flip, carry): view 'down' | 'up' | 'side' (side faces right; flip for left). */
(function (global) {
  'use strict';

  const E = global.Engine;
  const W = 32, H = 40;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const OUT = '#2a2140';
  const outlineOf = (c, lit) => mix(c, OUT, lit ? 0.5 : 0.72);

  class Spr {
    constructor() { this.p = new Array(W * H).fill(null); }
    set(x, y, c) { x = Math.round(x); y = Math.round(y); if (c && x >= 0 && y >= 0 && x < W && y < H) this.p[y * W + x] = c; }
    get(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? null : this.p[y * W + x]; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
    hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
    vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) this.set(x, y, c); }
    line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) this.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); }
    /* thick stroke: 3 wide, lit on the left / top, dark on the right / bottom */
    limb(x0, y0, x1, y1, r, thick = 3) {
      const steep = Math.abs(y1 - y0) >= Math.abs(x1 - x0);
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
        for (let k = 0; k < thick; k++) {
          const c = k === 0 ? r[0] : k === thick - 1 ? r[2] : r[1];
          steep ? this.set(x + k, y, c) : this.set(x, y + k, c);
        }
      }
    }
    /* ellipse shaded from the top-left light */
    ell(cx, cy, rx, ry, r) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
        if (d > 1) continue;
        const l = -0.6 * dx - 0.8 * dy;      // light from the top-left
        this.set(x, y, l > 0.45 && d > 0.15 ? r[0] : l > -0.35 ? r[1] : r[2]);
      }
    }
    shadeRect(x, y, w, h, r) {
      this.rect(x, y, w, h, r[1]);
      this.vline(x, y, y + h - 1, r[0]); this.hline(x, x + w - 1, y, r[0]);
      this.vline(x + w - 1, y + 1, y + h - 1, r[2]); this.hline(x + 1, x + w - 1, y + h - 1, r[2]);
    }
    /* coloured outline: every empty pixel touching a filled one takes a dark version of its neighbour */
    outline() {
      const add = [];
      for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
        if (this.get(x, y)) continue;
        const n = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => [this.get(x + dx, y + dy), dx, dy]).filter((v) => v[0]);
        if (!n.length) continue;
        const [c, dx, dy] = n[0];
        add.push([x, y, outlineOf(c, dx > 0 || dy > 0)]);     // lit side = the neighbour is below / right of us
      }
      for (const [x, y, c] of add) this.set(x, y, c);
      return this;
    }
    flip() { const s = new Spr(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) s.p[y * W + W - 1 - x] = this.p[y * W + x]; return s; }
  }

  /* ---------- palettes: [light, base, shade], light = warm, shade = cool ---------- */
  const R = {
    skinFair: ['#ffdcb8', '#f0b48a', '#c98068'], skinTan: ['#f7c89a', '#da9468', '#a8645a'], skinRuddy: ['#f4b690', '#d98562', '#a35a58'],
    brown: ['#9a6a45', '#6a432f', '#432a35'], blond: ['#fbe08a', '#e0ac4c', '#a8683c'], auburn: ['#e8774a', '#b44a30', '#702b3a'], grey: ['#f1eef2', '#c3bdd0', '#7f7a9c'],
    red: ['#f06a55', '#c04343', '#7e2c42'], green: ['#8fd070', '#55a35c', '#2f6a56'], plaid: ['#3d7a52', '#2f6a56', '#244f50'],
    cream: ['#fffaf0', '#f2e6d0', '#c8b6b8'], blue: ['#7fa8e8', '#4f78c4', '#33488c'], yellow: ['#ffe27a', '#f0b83a', '#bd7a34'],
    navy: ['#5c78b8', '#3d4f8c', '#2c3366'], wood: ['#c89564', '#946440', '#5e3c3a'], leather: ['#7a5240', '#54362f', '#2f2030'],
    teal: ['#7fd4b8', '#46a89a', '#2c6a78'], violet: ['#b894e0', '#8466c0', '#58448c'], pink: ['#ffa6b8', '#e8708c', '#a8466e'],
    steel: ['#e8eef8', '#a9b8d4', '#6a789c'], straw: ['#ffe58a', '#f0c04e', '#b88438'], boot: ['#8a5a3c', '#5e3b2b', '#3a2230'], gum: ['#4f9a6a', '#2f6a56', '#1f4048'],
  };
  const CHARS = {
    woodcutter: { name: 'Woodcutter (bearded, red wool cap, green plaid)', skin: R.skinRuddy, hair: R.brown, shirt: R.green, pants: R.wood, boots: R.leather, hat: 'cap', hatc: R.red, beard: R.brown, plaid: true, suspenders: R.red, build: 1 },
    gardener: { name: 'Gardener (straw hat, blue overalls, rolled sleeves)', skin: R.skinTan, hair: R.blond, shirt: R.cream, pants: R.blue, boots: R.boot, hat: 'straw', overalls: true, build: 0 },
    fisher: { name: 'Fisher (old, white beard, navy cap, yellow slicker)', skin: R.skinRuddy, hair: R.grey, shirt: R.yellow, pants: R.navy, boots: R.gum, hat: 'flatcap', hatc: R.navy, beard: R.grey, slicker: true, build: 1 },
  };

  /* ---------- drawing ---------- */
  const HIP = 28, FLOOR = 37;
  function head(S, o, dx, dy, mood) {
    const cx = 14 + dx, cy = 10 + dy;
    S.ell(cx - 1, cy + 0.5, 6.5, 6.6, o.skin);                            // skull
    S.ell(cx + 2.5, cy + 2.5, 3.4, 3.8, o.skin);                           // jaw / face front
    S.rect(cx - 2, cy + 6, 4, 2, o.skin[2]);                               // neck
    S.set(cx + 6, cy + 2, o.skin[1]); S.set(cx + 6, cy + 3, o.skin[1]);    // nose
    S.set(cx + 7, cy + 3, o.skin[0]);
    S.rect(cx - 6, cy + 1, 2, 3, o.skin[2]); S.set(cx - 6, cy + 2, o.skin[1]);   // ear
    // eye: white + dark pupil, brow above, blush below
    S.set(cx + 3, cy + 1, '#fffaf0'); S.set(cx + 4, cy + 1, '#2a2140'); S.set(cx + 4, cy, '#2a2140');
    S.set(cx + 2, cy - 1, o.hair[2]); S.set(cx + 3, cy - 1, o.hair[2]); S.set(cx + 4, cy - 1, o.hair[1]);
    S.set(cx + 3, cy + 4, mix(o.skin[1], '#ff7f9c', o.fem ? 0.8 : 0.55));
    if (o.fem) { S.set(cx + 5, cy, '#2a2140'); S.set(cx + 5, cy - 1, '#2a2140'); S.set(cx + 5, cy + 1, '#2a2140'); }
    // mouth
    if (mood === 'open') { S.rect(cx + 4, cy + 5, 2, 2, '#7e2c42'); S.set(cx + 4, cy + 5, '#fffaf0'); }
    else if (mood === 'smile') { S.set(cx + 4, cy + 5, '#a8466e'); S.set(cx + 5, cy + 5, '#a8466e'); S.set(cx + 6, cy + 4, '#a8466e'); }
    else if (o.fem) { S.set(cx + 4, cy + 5, '#e0405f'); S.set(cx + 5, cy + 5, '#e0405f'); S.set(cx + 5, cy + 6, '#b02c50'); }
    else { S.set(cx + 4, cy + 5, '#a8466e'); S.set(cx + 5, cy + 5, '#a8466e'); }
    // hair: back and fringe
    const hr = o.hair;
    for (let y = cy - 7; y <= cy + 2; y++) for (let x = cx - 8; x <= cx + 4; x++) {
      if (!S.get(x, y) && !(y < cy - 4)) continue;
      const dxn = (x - (cx - 1)) / 6.8, dyn = (y - (cy + 0.5)) / 6.9;
      const d = dxn * dxn + dyn * dyn;
      if (d > 1.05) continue;
      const back = x < cx - 1 && y < cy + 2;                               // behind the ear
      const top = y < cy - 3 + Math.round((x - cx) * 0.25);               // crown plus fringe sloping down the front
      if (top || back) S.set(x, y, (x + y) % 5 === 0 ? hr[0] : y < cy - 4 ? hr[1] : hr[2] === undefined ? hr[1] : (x < cx - 3 ? hr[2] : hr[1]));
    }
    if (o.long) { for (let y = cy + 1; y <= cy + 13; y++) { S.set(cx - 6, y, hr[1]); S.set(cx - 5, y, hr[1]); S.set(cx - 4, y, y > cy + 8 ? hr[2] : hr[1]); } S.vline(cx - 6, cy + 1, cy + 12, hr[0]); S.set(cx - 5, cy + 13, hr[2]); S.set(cx - 6, cy + 13, hr[2]); S.set(cx - 5, cy + 14, hr[1]); }
    if (o.beard) { const b = o.beard; for (let y = cy + 4; y <= cy + 9; y++) for (let x = cx - 1; x <= cx + 6; x++) { const dxn = (x - (cx + 3)) / 4.9, dyn = (y - (cy + 3)) / 6.2; if (dxn * dxn + dyn * dyn <= 1 && y >= cy + 4 && !(y < cy + 5 && x > cx + 4 && x < cx + 7)) S.set(x, y, x < cx + 1 || y > cy + 7 ? b[2] : (x + y) % 4 === 0 ? b[0] : b[1]); }
      S.set(cx + 4, cy + 5, '#a8466e'); S.set(cx + 5, cy + 5, '#a8466e'); if (o.hat !== 'cap') S.rect(cx + 3, cy + 3, 5, 1, b[0]); }
    // hats
    const hc = o.hatc;
    if (o.hat === 'cap') {                                                   // wool cap with turned-up brim
      S.ell(cx - 1, cy - 4, 7.2, 4.4, hc); S.rect(cx - 7, cy - 2, 14, 3, hc[2]); S.hline(cx - 7, cx + 6, cy - 2, hc[1]); S.hline(cx - 6, cx + 5, cy - 1, hc[0]);
      S.set(cx - 1, cy - 9, hc[0]); S.set(cx, cy - 9, hc[0]); S.rect(cx - 2, cy - 8, 4, 2, hc[0]);                // bobble
    } else if (o.hat === 'straw') {                                          // wide brim, banded crown
      S.ell(cx, cy - 6, 5.4, 3.6, R.straw); S.hline(cx - 5, cx + 5, cy - 4, R.red[1]); S.hline(cx - 5, cx + 5, cy - 3, R.red[2]);
      S.rect(cx - 10, cy - 3, 21, 2, R.straw[1]); S.hline(cx - 10, cx + 10, cy - 3, R.straw[0]); S.hline(cx - 9, cx + 10, cy - 2, R.straw[2]);
      S.set(cx + 10, cy - 2, R.straw[0]);
    } else if (o.hat === 'flatcap') {
      S.ell(cx, cy - 4, 7.4, 3.8, hc); S.hline(cx - 6, cx + 10, cy - 2, hc[2]); S.hline(cx + 3, cx + 10, cy - 3, hc[1]); S.set(cx + 1, cy - 6, hc[0]); S.set(cx + 2, cy - 6, hc[0]);
    } else if (o.hat === 'beret') {
      S.ell(cx, cy - 5, 7.6, 3.4, hc); S.rect(cx - 7, cy - 4, 5, 3, hc[1]); S.set(cx + 1, cy - 9, hc[0]); S.set(cx + 1, cy - 8, hc[1]); S.hline(cx - 6, cx + 6, cy - 2, hc[2]);
      S.set(cx + 6, cy - 3, hc[2]);
    }
  }

  function torso(S, o, dx, dy, lean, hh) {
    const x0 = 11 + dx + lean, y0 = 17 + dy, h = hh || 11 - dy;
    if (o.skirt) {
      S.shadeRect(x0, y0, 8, 7, o.shirt);
      const sk = o.skirt; for (let y = y0 + 7; y < y0 + 11; y++) { const g = y - (y0 + 7), xx = x0 - 1 - Math.floor(g / 2), ww = 10 + Math.floor(g / 2) * 2; S.rect(xx, y, ww, 1, sk[1]); S.set(xx, y, sk[0]); S.set(xx + ww - 1, y, sk[2]); if (g === 3) S.hline(xx, xx + ww - 1, y, sk[2]); else if ((y * 3 + g) % 4 === 1) S.set(xx + 4, y, sk[2]); }
      S.rect(x0 + 1, y0 + 4, 6, 6, o.apron[1]); S.vline(x0 + 1, y0 + 4, y0 + 9, o.apron[0]); S.vline(x0 + 6, y0 + 4, y0 + 9, o.apron[2]); S.hline(x0 + 1, x0 + 6, y0 + 4, o.apron[0]);
      S.set(x0 + 3, y0 + 6, '#f06a55'); S.set(x0 + 5, y0 + 7, '#ffe27a'); S.set(x0 + 2, y0 + 8, '#4f78c4'); S.set(x0 + 4, y0 + 9, '#e8708c');   // paint daubs
      S.hline(x0 + 1, x0 + 6, y0 + 3, o.apron[2]);
      return;
    }
    const wide = o.build ? 1 : 0;
    S.shadeRect(x0 - wide + (o.fem ? 1 : 0), y0, 8 + wide * 2 - (o.fem ? 2 : 0), h, o.shirt);
    if (o.plaid) { for (let y = y0 + 2; y < y0 + h - 1; y += 3) S.hline(x0 - wide + 1, x0 + 6 + wide, y, o.shirt[2]); for (let x = x0 - wide + 2; x < x0 + 7 + wide; x += 3) S.vline(x, y0 + 1, y0 + h - 2, mix(o.shirt[1], o.shirt[2], 0.55)); }
    if (o.suspenders) { S.vline(x0 + 1, y0, y0 + h - 1, o.suspenders[1]); S.vline(x0 + 5, y0, y0 + h - 1, o.suspenders[2]); }
    if (o.overalls) {
      S.rect(x0, y0 + 5, 8, h - 5, o.pants[1]); S.vline(x0, y0 + 5, y0 + h - 1, o.pants[0]); S.vline(x0 + 7, y0 + 5, y0 + h - 1, o.pants[2]); S.hline(x0, x0 + 7, y0 + h - 1, o.pants[2]);
      S.rect(x0 + 1, y0 + 1, 2, 5, o.pants[1]); S.set(x0 + 1, y0 + 5, '#f0b83a'); S.set(x0 + 2, y0 + 5, '#f0b83a');       // strap + button
      S.rect(x0 + 3, y0 + 6, 3, 3, o.pants[2]); S.hline(x0 + 3, x0 + 5, y0 + 6, o.pants[0]);                              // bib pocket
    }
    if (o.slicker) { S.vline(x0 + 5, y0, y0 + h - 1, o.shirt[2]); S.set(x0 + 5, y0 + 3, '#fffaf0'); S.set(x0 + 5, y0 + 7, '#fffaf0'); S.hline(x0 - wide, x0 + 7 + wide, y0 + h - 1, o.shirt[2]); S.hline(x0 - wide + 1, x0 + 3, y0 + 2, o.shirt[0]); }
    // belt
    if (!o.overalls && !o.slicker) S.hline(x0 - wide, x0 + 7 + wide, y0 + h - 1, '#54362f');
  }

  /* crouching: thighs forward, knees bent, shins down to the boots */
  function crouch(S, o) {
    const pr = o.pants, boot = o.boots, far = [pr[1], pr[2], pr[2]];
    S.shadeRect(12, 31, 7, 3, far); S.shadeRect(17, 32, 3, 5, far); S.shadeRect(16, 35, 5, 3, boot); S.rect(20, 36, 2, 2, boot[1]);
    S.shadeRect(10, 30, 9, 4, pr); S.shadeRect(18, 31, 4, 6, pr); S.shadeRect(17, 35, 6, 3, boot); S.rect(22, 36, 2, 2, boot[1]); S.hline(17, 22, 37, boot[2]);
  }
  function legs(S, o, pose, f, dy) {
    const hip = HIP + (dy > 0 ? 0 : 0);
    const boot = o.boots, pr = o.pants;
    const leg = (xoff, lift, r) => {
      const end = FLOOR - 3 - lift;
      for (let y = hip; y < end; y++) { const xx = 13 + Math.round(xoff * (y - hip) / (end - hip)); S.set(xx, y, r[0]); S.set(xx + 1, y, r[1]); S.set(xx + 2, y, r[2]); }
      const fx = 13 + xoff;
      S.shadeRect(fx - 1, end, 5, 3, boot); S.rect(fx + 4, end + 1, 2, 2, boot[1]); S.hline(fx - 1, fx + 5, end + 2, boot[2]); S.set(fx + 5, end + 1, boot[0]);
    };
    const far = [pr[1], pr[2], pr[2]];
    if (pose === 'walk') { const st = [[3, -3, 0, 0], [1, -1, 0, 1], [-3, 3, 0, 0], [-1, 1, 1, 0]][f]; leg(st[1], st[3], far); leg(st[0], st[2], pr); }
    else if (pose === 'pet') { leg(-2, 0, far); leg(2, 0, pr); }
    else { leg(-1, 0, far); leg(1, 0, pr); }
  }

  const hand = (S, o, x, y) => { S.rect(x, y, 3, 3, o.skin[1]); S.set(x, y, o.skin[0]); S.set(x + 2, y + 2, o.skin[2]); S.set(x + 2, y, o.skin[1]); };
  const sleeveR = (o) => (o.slicker ? o.shirt : o.shirt);
  const arm = (S, o, x0, y0, x1, y1, bare) => { S.limb(x0, y0, x1, y1, bare ? o.skin : sleeveR(o)); hand(S, o, x1 - 1, y1 - (y1 > y0 ? 0 : 1)); };

  /* ---------- props ---------- */
  function axe(S, G, T) {
    let dx = T[0] - G[0], dy = T[1] - G[1]; const n = Math.hypot(dx, dy); dx /= n; dy /= n;
    S.line(G[0] - dx * 2, G[1] - dy * 2, T[0], T[1], R.wood[1]); S.line(G[0] - dx * 2 + 1, G[1] - dy * 2, T[0] + 1, T[1], R.wood[0]);
    for (let k = -2; k <= 4; k++) for (let m = 0; m < 3; m++) { const px = T[0] - dy * k - dx * m, py = T[1] + dx * k - dy * m; S.set(px, py, k >= 3 ? R.steel[0] : m === 0 ? R.steel[1] : R.steel[2]); }
  }
  function can(S, x, y, tilt) {
    S.shadeRect(x, y, 8, 6, R.steel); S.hline(x, x + 7, y + 2, R.steel[2]); S.line(x + 1, y - 1, x + 5, y - 3, R.steel[1]);
    for (let k = 0; k < 6; k++) S.set(x + 8 + (k >> 1), y + 3 - (tilt ? -k : k), R.steel[1]); S.set(x + 11, y + (tilt ? 9 : 0), R.steel[0]);
  }
  function bucket(S, x, y, tilt) {
    S.shadeRect(x, y, 7, 6, R.wood); S.hline(x, x + 6, y + 1, R.steel[1]); S.hline(x, x + 6, y + 4, R.steel[1]); S.hline(x + 1, x + 5, y, tilt ? R.wood[0] : R.water || '#7fc4ec');
    if (!tilt) { S.line(x, y, x + 3, y - 3, R.steel[1]); S.line(x + 6, y, x + 3, y - 3, R.steel[1]); }
    else { S.set(x + 7, y, R.wood[0]); S.set(x + 7, y + 1, R.wood[1]); }
  }
  function mug(S, x, y) { S.rect(x, y, 5, 6, R.straw[1]); S.hline(x, x + 4, y, '#fffaf0'); S.vline(x, y + 1, y + 5, R.straw[0]); S.vline(x + 4, y + 1, y + 5, R.straw[2]); S.vline(x + 5, y + 1, y + 4, R.steel[1]); S.set(x + 6, y + 2, R.steel[1]); S.set(x + 6, y + 3, R.steel[1]); }

  /* ---------- poses ---------- */
  function person(name, pose, f, carry) {
    const o = CHARS[name], S = new Spr();
    let dy = 0, dx = 0, lean = 0, mood = 'smile';
    const seated = pose === 'sit' || pose === 'fish';
    if (pose === 'walk') dy = f % 2 ? -1 : 0;
    if (pose === 'idle') dy = f ? 1 : 0;
    if (pose === 'chop') { lean = [0, 1, 2, 0][f]; dy = [0, 0, 2, 0][f]; mood = f === 2 ? 'open' : 'closed'; }
    if (pose === 'pet') { dy = 6; lean = 2; }
    if (pose === 'draw') { dy = 0; lean = f ? 0 : 2; }
    if (seated) dy = 4;
    if (pose === 'sit' && f === 3) mood = 'open';
    if (pose === 'sit' && f === 1) mood = 'closed';

    // legs first (planted), then torso and head over them
    if (seated) {
      const pr = o.skirt || o.pants;
      S.shadeRect(11, HIP + 3, 10, 4, o.skirt || pr);                    // thigh
      S.shadeRect(19, HIP + 6, 4, 6, o.skirt ? R.skinFair : pr);          // shin
      S.shadeRect(19, FLOOR - 2, 7, 3, o.boots); S.hline(19, 25, FLOOR, o.boots[2]);
      if (o.skirt) { S.rect(10, HIP + 2, 9, 5, o.skirt[1]); S.hline(10, 18, HIP + 6, o.skirt[2]); S.set(10, HIP + 2, o.skirt[0]); }
    } else if (pose === 'pet') crouch(S, o);
    else legs(S, o, pose === 'draw' || pose === 'pour' || pose === 'water' || pose === 'chop' ? 'idle' : pose, f, dy);
    if (o.skirt && !seated) {
      for (let y = HIP - 1; y <= 33; y++) { const g = Math.floor((y - HIP + 1) / 2); const xx = 11 - g - (pose === 'walk' && y > 30 ? [1, 0, -1, 0][f] : 0), ww = 8 + g * 2; S.rect(xx, y, ww, 1, o.skirt[1]); S.set(xx, y, o.skirt[0]); S.set(xx + ww - 1, y, o.skirt[2]); if (y === 33) S.hline(xx, xx + ww - 1, y, o.skirt[2]); else if ((y + g) % 3 === 0) S.set(xx + 3, y, o.skirt[2]); }
    }
    // far arm (behind the torso)
    const shoulder = [14 + lean, 19 + dy];
    if (pose === 'walk') { const sw = [-3, 0, 3, 0][f]; S.limb(shoulder[0], shoulder[1], shoulder[0] + sw, shoulder[1] + 7, [sleeveR(o)[1], sleeveR(o)[2], sleeveR(o)[2]]); }
    torso(S, o, dx, dy, lean, pose === 'pet' ? 8 : 0);
    head(S, o, lean + dx, dy, mood);

    // near arm and props
    const sx = shoulder[0], sy = shoulder[1] + 1;
    if (pose === 'idle') arm(S, o, sx, sy, sx, sy + 7);
    else if (pose === 'walk') { const sw = carry ? 1 : [3, 0, -3, 0][f]; arm(S, o, sx, sy, sx + sw, sy + 7); if (carry) bucket(S, sx - 3, sy + 8, 0); }
    else if (pose === 'draw') { const up = f ? 1 : 0; S.limb(sx, sy, sx + 4, sy + 6 - up * 3, [sleeveR(o)[1], sleeveR(o)[2], sleeveR(o)[2]]); arm(S, o, sx + 1, sy, sx + 7, sy + 3 + up * 3); S.line(sx + 8, sy + 3 + up * 3, 30, 2, '#e8d9b8'); }
    else if (pose === 'pour') { arm(S, o, sx, sy, sx + 4, sy + 3); bucket(S, sx + 5, sy + 1 + f, !!f); if (f) for (let k = 0; k < 7; k++) S.set(sx + 13 + (k >> 2), sy + 4 + k, k % 2 ? '#bfe4f8' : '#7fc4ec'); }
    else if (pose === 'pet') { arm(S, o, sx + 1, sy, sx + 5, sy + 6 + (f ? 1 : 0)); }
    else if (pose === 'chop') {
      const G = [[17, 21], [18, 20], [18, 22], [18, 22]][f], T = [[15, 5], [26, 13], [28, 27], [22, 31]][f];
      arm(S, o, sx, sy, G[0] - 1, G[1] - 1); axe(S, G, T); hand(S, o, G[0] - 1, G[1] - 1);
    } else if (pose === 'water') {
      arm(S, o, sx, sy, sx + 4, sy + 5); can(S, 20, 21 + f, f);
    } else if (pose === 'paint') {
      const h = [[21, 22], [22, 20], [21, 19], [22, 21]][f];
      arm(S, o, sx, sy, h[0] - 1, h[1] + 1); S.line(h[0] + 1, h[1], h[0] + 4, h[1] - 2, R.wood[1]); S.set(h[0] + 5, h[1] - 3, f % 2 ? '#f06a55' : '#4f78c4');
      S.shadeRect(6, 26 + dy, 5, 4, R.wood); S.set(7, 27 + dy, '#f06a55'); S.set(9, 28 + dy, '#ffe27a'); S.set(8, 29 + dy, '#4f78c4');       // palette on the other hand
    } else if (pose === 'fish') {
      arm(S, o, sx, sy, sx + 5, sy + 5); S.line(sx + 5, sy + 4, 30, 8 - f, R.wood[0]); S.set(30, 9 - f, R.wood[1]);
    } else if (pose === 'sit') {
      if (f === 0) arm(S, o, sx, sy, sx + 6, sy + 6);
      else if (f === 1) { arm(S, o, sx, sy, sx + 5, sy + 1); S.set(sx + 8, sy + 2, '#e8774a'); S.rect(sx + 7, sy + 3, 3, 2, '#c04343'); }
      else if (f === 2) { arm(S, o, sx, sy, sx + 5, sy + 1); mug(S, sx + 6, sy - 1); }
      else { arm(S, o, sx, sy, sx + 6, sy - 3); }
    }
    return S.outline();
  }

  /* ---------- front / back views (Stardew-style three-quarter top-down) ---------- */
  const DARK = '#2a2140';
  function fb(name, dir, f, sit) {
    const o = CHARS[name], S = new Spr(), back = dir === 'up';
    const lift = [[0, 2], [0, 0], [2, 0], [0, 0]][f];                  // [left foot, right foot] raised
    const bob = sit ? 0 : f % 2 ? -1 : 0;
    const cx = 16, hip = 26 + bob;
    const sk = o.skin, pr = o.skirt ? o.skirt : o.pants, boot = o.boots;
    const hairR = o.hair;
    // legs
    const leg = (x, l, shade) => {
      const bottom = 33 - l;
      for (let y = hip; y < bottom; y++) { S.rect(x, y, 4, 1, o.skirt ? sk[1] : pr[1]); S.set(x, y, o.skirt ? sk[0] : pr[0]); S.set(x + 3, y, o.skirt ? sk[2] : pr[2]); }
      S.shadeRect(x - 1, bottom, 5, 4, boot); S.hline(x - 1, x + 3, bottom + 3, boot[2]); S.set(x, bottom, boot[0]);
    };
    if (!sit) { leg(cx - 4, lift[0], 0); leg(cx, lift[1], 1); }
    // arms hang beside the torso; the one opposite the lifted foot swings forward
    const swing = [[1, -1], [0, 0], [-1, 1], [0, 0]][f];
    const sleeve = o.slicker || o.shirt === R.cream ? o.shirt : o.shirt;
    const aw = o.fem ? 2 : 3;
    const armL = (x, len) => { S.shadeRect(x, 16 + bob, aw, len, sleeve); S.rect(x, 16 + bob + len, aw, 2, sk[1]); S.set(x, 16 + bob + len, sk[0]); S.set(x + aw - 1, 17 + bob + len, sk[2]); };
    if (sit && back) {
      const sh = (x, len) => S.shadeRect(x, 16, 3, len, sleeve);
      const hd = (x, y) => { S.rect(x, y, 3, 3, sk[1]); S.set(x, y, sk[0]); S.set(x + 2, y + 2, sk[2]); };
      if (f < 4) sh(cx - 8, 7);
      if (f === 0) sh(cx + 5, 7);
      else if (f === 1) { S.limb(cx + 6, 17, cx + 8, 13, sleeve); hd(cx + 8, 10); }
      else if (f === 2) { S.limb(cx + 6, 17, cx + 8, 13, sleeve); hd(cx + 8, 10); S.rect(cx + 9, 5, 5, 6, R.straw[1]); S.hline(cx + 9, cx + 13, 5, '#fffaf0'); S.vline(cx + 9, 6, 10, R.straw[0]); S.vline(cx + 13, 6, 10, R.straw[2]); S.vline(cx + 14, 6, 9, R.steel[1]); }
      else if (f === 4) { S.limb(cx - 6, 17, cx - 2, 23, sleeve); S.limb(cx + 5, 17, cx + 1, 23, sleeve); }
      else if (f === 5) { S.limb(cx - 7, 17, cx - 11, 11, sleeve); S.limb(cx + 6, 17, cx + 10, 11, sleeve); hd(cx + 9, 8); hd(cx - 12, 8); }
      else { S.limb(cx + 6, 17, cx + 10, 10, sleeve); hd(cx + 9, 7); }
    } else if (sit) {
      const rest = (x) => { S.shadeRect(x, 16, 3, 8, sleeve); S.rect(x, 24, 3, 2, sk[1]); S.set(x, 24, sk[0]); };
      if (f === 4) { S.limb(cx - 6, 17, cx - 2, 23, sleeve); S.limb(cx + 5, 17, cx + 1, 23, sleeve); S.rect(cx - 2, 23, 4, 3, sk[1]); S.set(cx - 2, 23, sk[0]); }
      else if (f === 5) { rest(cx - 8); S.limb(cx + 6, 17, cx + 10, 11, sleeve); S.limb(cx + 10, 11, cx + 5, 5, sleeve); }
      else rest(cx - 8);
      if (f === 4 || f === 5) { /* posture only */ }
      else if (f === 0) rest(cx + 5);
      else if (f === 1 || f === 2) S.limb(cx + 6, 17, cx + 3, 13, [sleeve[0], sleeve[1], sleeve[2]]);
      else S.limb(cx + 6, 17, cx + 9, 11, [sleeve[0], sleeve[1], sleeve[2]]);
    } else if (o.fem) { armL(cx - 6, 7 + swing[0]); armL(cx + 4, 7 + swing[1]); } else { armL(cx - 8, 8 + swing[0]); armL(cx + 5, 8 + swing[1]); }
    // torso
    const tw = o.fem ? 8 : 10, tx = cx - tw / 2, ty = 15 + bob;
    S.shadeRect(tx, ty, tw, 11, o.shirt);
    if (!back) {
      if (o.plaid) { for (let y = ty + 2; y < ty + 10; y += 3) S.hline(tx + 1, tx + 8, y, o.shirt[2]); for (let x = tx + 2; x < tx + 9; x += 3) S.vline(x, ty + 1, ty + 9, mix(o.shirt[1], o.shirt[2], 0.55)); }
      if (o.suspenders) { S.vline(tx + 2, ty, ty + 10, o.suspenders[1]); S.vline(tx + 7, ty, ty + 10, o.suspenders[2]); }
      if (o.overalls) { S.rect(tx, ty + 5, 10, 6, o.pants[1]); S.vline(tx, ty + 5, ty + 10, o.pants[0]); S.vline(tx + 9, ty + 5, ty + 10, o.pants[2]); S.rect(tx + 1, ty, 2, 5, o.pants[1]); S.rect(tx + 7, ty, 2, 5, o.pants[2]); S.set(tx + 1, ty + 5, '#f0b83a'); S.set(tx + 8, ty + 5, '#f0b83a'); S.rect(tx + 3, ty + 6, 4, 3, o.pants[2]); S.hline(tx + 3, tx + 6, ty + 6, o.pants[0]); }
      if (o.slicker) { S.vline(cx - 1, ty, ty + 10, o.shirt[2]); for (const y of [ty + 3, ty + 6, ty + 9]) { S.set(cx - 2, y, '#fffaf0'); S.set(cx, y, '#fffaf0'); } S.hline(tx + 1, tx + 3, ty + 1, o.shirt[0]); }
      if (o.apron) { const r = tx + tw - 2; S.rect(tx + 1, ty + 3, tw - 2, 8, o.apron[1]); S.vline(tx + 1, ty + 3, ty + 10, o.apron[0]); S.vline(r, ty + 3, ty + 10, o.apron[2]); S.hline(tx + 1, r, ty + 3, o.apron[0]); S.set(tx + 2, ty + 6, '#f06a55'); S.set(r - 1, ty + 7, '#ffe27a'); S.set(tx + 2, ty + 9, '#4f78c4'); S.set(r - 2, ty + 9, '#e8708c'); S.hline(tx + 2, r - 1, ty, '#fffaf0'); S.set(tx + 3, ty + 1, o.shirt[2]); S.set(r - 2, ty + 1, o.shirt[2]); if (o.fem) { S.hline(tx + 1, r, ty + 6, o.apron[2]); S.set(cx - 1, ty + 7, o.apron[0]); S.set(cx, ty + 7, o.apron[0]); } }
      if (!o.overalls && !o.slicker && !o.apron) S.hline(tx, tx + tw - 1, ty + 10, '#54362f');
      if (o.apron) S.hline(tx, tx + tw - 1, ty + 10, o.apron[2]);
    } else {
      S.hline(tx, tx + tw - 1, ty + 10, o.skirt ? o.shirt[2] : '#54362f');
      if (o.overalls) { S.rect(tx, ty + 6, 10, 5, o.pants[1]); S.vline(tx, ty + 6, ty + 10, o.pants[0]); S.vline(tx + 9, ty + 6, ty + 10, o.pants[2]); S.hline(tx + 1, tx + 8, ty + 6, o.pants[0]); S.vline(tx + 2, ty, ty + 6, o.pants[1]); S.vline(tx + 7, ty, ty + 6, o.pants[2]); }
      if (o.suspenders) { S.vline(tx + 2, ty, ty + 10, o.suspenders[1]); S.vline(tx + 7, ty, ty + 10, o.suspenders[2]); }
      if (o.apron) { S.hline(tx + 1, tx + tw - 2, ty + 4, o.apron[2]); S.set(tx + 1, ty + 5, o.apron[1]); S.set(tx + tw - 2, ty + 5, o.apron[1]); S.hline(cx - 2, cx + 1, ty + 6, o.apron[0]); S.set(cx - 2, ty + 7, o.apron[0]); S.set(cx + 1, ty + 7, o.apron[0]); S.set(cx - 1, ty + 8, o.apron[1]); S.set(cx, ty + 8, o.apron[1]); }
      if (o.plaid) for (let y = ty + 2; y < ty + 10; y += 3) S.hline(tx + 1, tx + 8, y, o.shirt[2]);
    }
    if (o.skirt) {
      for (let y = ty + 8; y < ty + 16; y++) { const g = y - (ty + 8), xx = tx - 1 - (g >> 1), ww = tw + 2 + (g >> 1) * 2; S.rect(xx, y, ww, 1, o.skirt[1]); S.set(xx, y, o.skirt[0]); S.set(xx + ww - 1, y, o.skirt[2]); if (g === 7) S.hline(xx, xx + ww - 1, y, o.skirt[2]); else if ((g + y) % 3 === 0) S.set(xx + 4, y, o.skirt[2]); }
    }
    // head
    const hb = sit ? (f === 4 ? 2 : f === 5 ? -1 : 0) : bob, cy = 9 + hb, hx = cx - 0.5;
    S.ell(hx, cy, 7, 6.4, sk);
    S.rect(cx - 8, cy + 1, 1, 3, sk[2]); S.rect(cx + 7, cy + 1, 1, 3, sk[2]);          // ears
    if (!back) {
      for (const ex of [cx - 4, cx + 2]) { S.set(ex, cy + 1, '#fffaf0'); S.set(ex + 1, cy + 1, DARK); S.set(ex, cy + 2, DARK); S.set(ex + 1, cy + 2, DARK); S.set(ex, cy, hairR[2]); S.set(ex + 1, cy, hairR[2]); }
      S.set(cx - 6, cy + 3, mix(sk[1], '#ff7f9c', o.fem ? 0.8 : 0.55)); S.set(cx + 5, cy + 3, mix(sk[1], '#ff7f9c', o.fem ? 0.8 : 0.55));
      if (o.fem) { S.set(cx - 5, cy + 1, DARK); S.set(cx - 5, cy, DARK); S.set(cx + 4, cy + 1, DARK); S.set(cx + 4, cy, DARK); S.set(cx - 1, cy + 4, '#e0405f'); S.set(cx, cy + 4, '#e0405f'); S.set(cx - 1, cy + 5, '#b02c50'); S.set(cx, cy + 5, '#b02c50'); }
      else { S.set(cx - 1, cy + 4, '#a8466e'); S.set(cx, cy + 4, '#a8466e'); }
      S.set(cx - 1, cy + 3, sk[2]);
    }
    // hair
    const hair = (x, y) => S.set(x, y, ((x - y) % 11 + 11) % 11 === 0 ? hairR[0] : (x < cx - 3 ? hairR[1] : x > cx + 2 ? hairR[2] : hairR[1]));
    for (let y = cy - 7; y <= cy + 4; y++) for (let x = cx - 9; x <= cx + 8; x++) {
      const dxn = (x - hx) / (o.fem ? 8.3 : 7.2), dyn = (y - cy) / (o.fem ? 7.4 : 6.8);
      if (dxn * dxn + dyn * dyn > 1.04) continue;
      const fringe = y < cy - 2 + (Math.abs(x - hx) > 4 ? 3 : (Math.abs(x - cx) % 2));
      const side = Math.abs(x - hx) > (o.fem ? 4.6 : 5.4) && y < cy + (o.fem ? 6 : 4);
      if (back ? true : (fringe || side)) { if (back && y > cy + 3) continue; hair(x, y); }
    }
    if (o.long) {
      for (let y = cy + 1; y < (back ? 21 : 24) + bob; y++) { for (const x of back ? [cx - 6, cx - 5, cx - 4, cx - 3, cx - 2, cx - 1, cx, cx + 1, cx + 2, cx + 3, cx + 4, cx + 5] : [cx - 8, cx - 7, cx - 6, cx + 5, cx + 6, cx + 7]) hair(x, y); }
      if (!back) { S.set(cx - 7, 24 + bob, hairR[2]); S.set(cx + 6, 24 + bob, hairR[2]); S.set(cx - 6, 25 + bob, hairR[2]); S.set(cx + 5, 25 + bob, hairR[2]); }
      if (back) { S.hline(cx - 6, cx + 5, 21 + bob, hairR[2]); S.hline(cx - 5, cx + 4, 22 + bob, hairR[2]); S.hline(cx - 3, cx + 2, 23 + bob, hairR[2]); }
    }
    if (!back && o.beard) { const b = o.beard; for (let y = cy + 3; y <= cy + 8; y++) for (let x = cx - 6; x <= cx + 5; x++) { const dxn = (x - (cx - 0.5)) / 6.4, dyn = (y - (cy + 2)) / 6; if (dxn * dxn + dyn * dyn <= 1 && !(y === cy + 3 && Math.abs(x - cx + 0.5) < 2) && !(y < cy + 5 && (x < cx - 4 || x > cx + 3))) S.set(x, y, y > cy + 6 ? b[2] : (x + y) % 3 === 0 ? b[0] : b[1]); } S.hline(cx - 2, cx + 1, cy + 4, o.hat === 'flatcap' ? b[0] : b[1]); S.set(cx - 1, cy + 5, '#a8466e'); S.set(cx, cy + 5, '#a8466e'); }
    if (sit && !back) {
      const hnd = (x, y) => { S.rect(x, y, 3, 3, sk[1]); S.set(x, y, sk[0]); S.set(x + 2, y + 2, sk[2]); };
      if (f === 1) { hnd(cx + 1, cy + 3); S.rect(cx + 1, cy + 1, 3, 2, '#e8a85a'); S.set(cx + 1, cy + 1, '#ffd98a'); S.set(cx + 3, cy + 2, '#b06a3a'); }
      if (f === 2) { hnd(cx + 2, cy + 6); S.rect(cx - 2, cy + 2, 6, 7, R.straw[1]); S.hline(cx - 2, cx + 3, cy + 2, '#fffaf0'); S.vline(cx - 2, cy + 3, cy + 8, R.straw[0]); S.vline(cx + 3, cy + 3, cy + 8, R.straw[2]); S.vline(cx + 4, cy + 3, cy + 6, R.steel[1]); S.set(cx + 5, cy + 4, R.steel[1]); S.set(cx + 5, cy + 5, R.steel[1]); S.hline(cx - 2, cx + 3, cy + 8, R.straw[2]); }
      if (f === 3) { hnd(cx + 8, cy - 1); S.rect(cx - 1, cy + 4, 3, 2, '#7e2c42'); S.set(cx - 1, cy + 4, '#fffaf0'); }
    }
    // hats
    const hc = o.hatc;
    if (o.hat === 'cap') { S.ell(hx, cy - 4, 7.6, 4.6, hc); S.rect(cx - 8, cy - 2, 16, 3, hc[2]); S.hline(cx - 8, cx + 7, cy - 2, hc[1]); S.hline(cx - 7, cx + 6, cy - 1, hc[0]); S.rect(cx - 2, cy - 10, 4, 3, hc[0]); S.hline(cx - 2, cx + 1, cy - 8, hc[1]); }
    else if (o.hat === 'straw') { S.ell(hx, cy - 6, 5.6, 3.6, R.straw); S.hline(cx - 6, cx + 5, cy - 4, R.red[1]); S.hline(cx - 6, cx + 5, cy - 3, R.red[2]); S.rect(cx - 11, cy - 3, 22, 2, R.straw[1]); S.hline(cx - 11, cx + 10, cy - 3, R.straw[0]); S.hline(cx - 10, cx + 10, cy - 2, R.straw[2]); if (!back) S.hline(cx - 7, cx + 6, cy - 1, sk[2]); }
    else if (o.hat === 'flatcap') { S.ell(hx, cy - 4, 7.8, 4, hc); S.hline(cx - 7, cx + 6, cy - 2, hc[2]); S.set(cx - 3, cy - 7, hc[0]); S.set(cx - 2, cy - 7, hc[0]); if (!back) { S.rect(cx - 6, cy - 2, 12, 2, hc[1]); S.hline(cx - 6, cx + 5, cy - 1, hc[2]); S.hline(cx - 5, cx + 4, cy - 2, hc[0]); } }
    else if (o.hat === 'beret') { S.ell(hx + 1, cy - 5, 7.8, 3.6, hc); S.rect(cx - 7, cy - 4, 4, 3, hc[1]); S.set(cx + 1, cy - 10, hc[0]); S.set(cx + 1, cy - 9, hc[1]); S.hline(cx - 6, cx + 8, cy - 2, hc[2]); S.hline(cx - 5, cx + 4, cy - 6, hc[0]); if (!back) { S.set(cx + 5, cy - 6, '#ffe27a'); S.set(cx + 6, cy - 6, '#fffaf0'); S.set(cx + 5, cy - 5, '#fffaf0'); S.set(cx + 6, cy - 5, '#ffe27a'); } }
    return S.outline();
  }


  /* ---------- build every frame up front so the palette can be extended once ---------- */
  const hexCache = {};
  const key = (n, v, p, f, c) => [n, v, p, f, c ? 1 : 0].join('|');
  const NAMES = Object.keys(CHARS);
  for (const n of NAMES) {
    for (let f = 0; f < 4; f++) {
      hexCache[key(n, 'down', 'walk', f)] = fb(n, 'down', f);
      hexCache[key(n, 'up', 'walk', f)] = fb(n, 'up', f);
      hexCache[key(n, 'down', 'sit', f)] = fb(n, 'down', f, true);
      hexCache[key(n, 'up', 'sit', f)] = fb(n, 'up', f, true);
      hexCache[key(n, 'side', 'walk', f)] = person(n, 'walk', f);
      hexCache[key(n, 'side', 'walk', f, true)] = person(n, 'walk', f, true);
      hexCache[key(n, 'side', 'chop', f)] = person(n, 'chop', f);
    }
    for (let f = 0; f < 2; f++) for (const p of ['idle', 'draw', 'pour', 'water', 'fish', 'pet']) hexCache[key(n, 'side', p, f)] = person(n, p, f);
  }
  for (const n of NAMES) for (const f of [4, 5]) { hexCache[key(n, 'down', 'sit', f)] = fb(n, 'down', f, true); hexCache[key(n, 'up', 'sit', f)] = fb(n, 'up', f, true); }
  const colours = new Set();
  for (const k of Object.keys(hexCache)) for (const c of hexCache[k].p) if (c) colours.add(c);
  const index = global.Palette.extend([...colours]);
  const cache = {};
  for (const k of Object.keys(hexCache)) {
    const src = hexCache[k], sp = new E.Spr(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = src.p[y * W + x]; if (c) sp.set(x, y, index[c]); }
    cache[k] = sp;
  }
  const flipped = {};
  function get(name, view, pose, f, flip, carry) {
    const k = key(name, view, pose, f, carry);
    const sp = cache[k];
    if (!sp) throw new Error('missing sprite ' + k);
    if (!flip) return sp;
    return flipped[k] || (flipped[k] = sp.flipX());
  }

  global.Chars = { get, W, H };
})(window);
