/* The farm animals with motion: every animal has a stand pose, a graze/peck pose where it lowers its head,
   and a four-frame walk cycle (legs swing, body bobs, tail or head moves). Drawn facing right; flipped for left.
   Shading uses the same three-tone volume helpers as the rest of the art. */
(function (global) {
  'use strict';

  const E = global.Engine;
  const C = global.Palette.C;
  const cache = {};
  const finish = (sp, flip) => (flip ? sp.flipX() : sp).outline(C.INK0, C.INK1);
  const ellipse = (sp, cx, cy, rx, ry, c) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) sp.set(cx + x, cy + y, c); };

  /* ---------- chicken: stand | peck | walk ---------- */
  function chicken(variant, anim, f, flip) {
    const sp = new E.Spr(16, 13);
    const lit = variant ? C.WD4 : C.CR0, mid = variant ? C.WD3 : C.CR0, sh = variant ? C.WD2 : C.CR1;
    const walk = anim === 'walk', peck = anim === 'peck';
    const bob = walk && (f === 1 || f === 3) ? 1 : 0;
    const sw = walk ? [-1, 0, 1, 0][f] : 0;
    const hx = peck ? (f ? 13 : 11) : 10 + (walk ? [0, 1, 0, -1][f] : 0);
    const hy = peck ? (f ? 9 : 6) + bob : 3 + bob + (anim === 'stand' && f ? 1 : 0);
    const tailUp = peck ? 1 : 0;
    for (const lx of [6 + sw, 8 - sw]) { sp.vline(lx, 10, 11, C.O0); sp.set(lx + 1, 11, C.O0); }
    ellipse(sp, 6, 6 + bob, 4, 3, mid); ellipse(sp, 5, 5 + bob, 3, 2, lit);
    sp.hline(3, 9, 8 + bob, sh); sp.set(9, 7 + bob, sh); sp.set(2, 7 + bob, sh);
    for (const [x, y] of [[0, 3], [1, 3], [1, 4], [0, 4], [2, 4], [0, 2]]) sp.set(x, y + bob - tailUp, variant ? C.WD2 : C.CR1);
    sp.set(3, 6 + bob, sh); sp.set(4, 6 + bob, sh); sp.set(5, 7 + bob, sh);
    // neck from the shoulder to the head
    const nx0 = 8, ny0 = 5 + bob, steps = Math.max(Math.abs(hx - nx0), Math.abs(hy - ny0), 1);
    for (let i = 0; i <= steps; i++) { const x = Math.round(nx0 + (hx - nx0) * i / steps), y = Math.round(ny0 + (hy - ny0) * i / steps); sp.set(x, y, lit); sp.set(x, y + 1, mid); }
    ellipse(sp, hx, hy, 2, 2, lit);
    sp.set(hx - 1, hy - 3, C.RED); sp.set(hx, hy - 3, C.RED); sp.set(hx, hy - 2, C.RED);
    sp.set(hx + 2, hy, C.O1); sp.set(hx + 1, hy + 2, C.RED); sp.set(hx + 1, hy - 0, C.INK1);
    return finish(sp, flip);
  }

  /* ---------- cow: stand | graze | walk ---------- */
  function cow(variant, anim, f, flip) {
    const sp = new E.Spr(48, 28);
    const hol = variant === 0;
    const base = hol ? { l: C.CR0, m: C.CR0, d: C.CR1 } : { l: C.WD4, m: C.WD3, d: C.WD2 };
    const patch = hol ? { l: C.M1, m: C.INK1, d: C.INK0 } : { l: C.CR0, m: C.CR0, d: C.CR1 };
    const walk = anim === 'walk', graze = anim === 'graze';
    const bob = walk && (f === 1 || f === 3) ? 1 : 0;
    const sw = walk ? [-2, 0, 2, 0][f] : 0;
    const hx = graze ? 3 : 0, hy = graze ? 9 + (f ? 1 : 0) : 0, chew = anim === 'stand' && f ? 1 : 0;
    const body = (x, y) => {
      const yy = y - bob;
      if (x < 5 || x > 29 || yy < 4 || yy > 16) return false;
      const dx = Math.min(x - 5, 29 - x), dy = Math.min(yy - 4, 16 - yy);
      return !(dx < 3 && dy < 3 && (3 - dx) * (3 - dx) + (3 - dy) * (3 - dy) > 9);
    };
    const leg = (lx, lift, far) => {
      const len = lift ? 6 : 8;
      sp.shadeRect(lx, 15, 3, len, far ? { l: base.d, m: base.d, d: base.d } : base);
      if (!far) sp.hline(lx, lx + 2, 19, base.d);
      sp.rect(lx, 15 + len, 3, 2, C.WD0); sp.set(lx, 15 + len, C.WD1);
    };
    leg(12 + sw, walk && f === 3, true); leg(22 - sw, walk && f === 1, true);
    for (let y = 4 + bob; y <= 16 + bob; y++) for (let x = 5; x <= 29; x++) {
      if (!body(x, y)) continue;
      const yy = y - bob, tn = yy <= 5 ? 'l' : yy >= 14 || x >= 27 ? 'd' : 'm';
      let c = base[tn];
      if (E.noise2(x / 3.3, yy / 3.0, hol ? 5 : 9) > 0.60) c = patch[tn];
      sp.set(x, y, c);
    }
    sp.hline(7, 27, 4 + bob, base.l);
    sp.shadeEllipse(16, 17 + bob, 3.2, 2.2, { l: C.B2, m: C.B1, d: C.B0 });
    for (const tx of [14, 16, 18]) sp.set(tx, 19 + bob, C.B0);
    leg(8 - sw, walk && f === 1, false); leg(25 + sw, walk && f === 3, false);
    // neck: straight, or stretched down to the grass
    if (graze) for (let i = 0; i <= 4; i++) sp.shadeEllipse(28 + i * 1.5, 10 + i * (hy - 2) / 4, 3.6, 3.8, base);
    else sp.shadeRect(26, 6 + bob, 5, 9, base);
    sp.rect(26, 12 + bob, 5, 1, C.R2); sp.rect(28 + (graze ? 1 : 0), 13 + bob, 2, 2, C.Y0); sp.set(28 + (graze ? 1 : 0), 13 + bob, C.Y1);
    const H = (x, y, c) => sp.set(x + hx, y + hy + bob, c);
    sp.shadeEllipse(33 + hx, 9 + hy + bob, 4.8, 5, base);
    if (E.noise2(7, 3, variant) > 0.2) { for (let y = 4; y < 6; y++) for (let x = 31; x < 35; x++) H(x, y, patch.m); H(31, 4, patch.l); }
    sp.shadeEllipse(36 + hx, 12 + hy + chew + bob, 3, 3.2, { l: C.B2, m: C.B1, d: C.B0 });
    H(37, 12 + chew, C.B0); H(37, 13 + chew, C.B0); for (let x = 34; x <= 37; x++) H(x, 15 + chew, C.B0);
    H(32, 8, C.INK1); H(33, 8, C.INK1); H(32, 7, C.CR0);
    for (let y = 5; y < 8; y++) for (let x = 28; x < 32; x++) H(x, y, base.d); H(29, 6, C.B1); H(28, 5, base.m);
    for (const [x, y] of [[31, 3], [31, 2], [32, 1], [36, 3], [36, 2], [37, 1]]) H(x, y, C.CR0); H(32, 1, C.CR1); H(37, 1, C.CR1);
    const tw = anim === 'stand' && f ? 1 : 0;                                              // tail swish
    for (const [x, y] of [[4, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [3, 11], [4, 12]]) sp.set(x - (y > 8 ? tw : 0), y + bob, base.d);
    sp.shadeEllipse(4 - tw, 14 + bob, 1.6, 2.4, { l: patch.l, m: patch.m, d: patch.d });
    return finish(sp, flip);
  }

  /* ---------- pig: stand (snuffling) | walk ---------- */
  function pig(anim, f, flip) {
    const sp = new E.Spr(32, 20);
    const walk = anim === 'walk';
    const bob = walk && (f === 1 || f === 3) ? 1 : 0;
    const sw = walk ? [-2, 0, 2, 0][f] : 0;
    const hy = (anim === 'stand' && f) ? 1 : 0;
    for (const [lx, lift] of [[9 + sw, walk && f === 3], [19 - sw, walk && f === 1]]) { sp.rect(lx, 11, 3, lift ? 3 : 5, C.B0); sp.rect(lx, lift ? 14 : 16, 3, 1, C.WD1); }
    sp.shadeEllipse(12, 8 + bob, 10.5, 6.4, { l: C.B2, m: C.B1, d: C.B0 });
    sp.hline(5, 18, 13 + bob, C.B0);
    sp.shadeEllipse(23, 8 + hy + bob, 5.2, 5.4, { l: C.B2, m: C.B1, d: C.B0 });
    sp.shadeEllipse(27, 10 + hy + bob, 2.2, 3, { l: C.B2, m: C.B2, d: C.B1 });
    sp.set(27, 9 + hy + bob, C.B0); sp.set(27, 11 + hy + bob, C.B0); sp.set(28, 10 + hy + bob, C.B0);
    sp.set(24, 6 + hy + bob, C.INK1); sp.set(24, 5 + hy + bob, C.CR0);
    for (const [x, y] of [[20, 2], [21, 2], [22, 3], [19, 3], [20, 4], [21, 4]]) sp.set(x, y + hy + bob, C.B0);
    sp.set(20, 3 + hy + bob, C.B1);
    const tw = anim === 'stand' && f ? 1 : 0;
    for (const [x, y] of [[1, 4], [0, 3], [0, 2], [1, 1], [2, 2], [2, 3]]) sp.set(x - tw, y + bob, C.B0);
    for (const [lx, lift] of [[5 - sw, walk && f === 1], [16 + sw, walk && f === 3]]) { const len = lift ? 3 : 5; sp.shadeRect(lx, 11, 3, len, { l: C.B1, m: C.B1, d: C.B0 }); sp.rect(lx, 11 + len, 3, 1, C.WD0); sp.set(lx, 11 + len, C.WD1); }
    for (const [x, y] of [[9, 7], [10, 7], [10, 8], [11, 6], [8, 9]]) sp.set(x, y + bob, C.T1);
    return finish(sp, flip);
  }

  /* ---------- sheep: stand | graze | walk ---------- */
  function sheep(anim, f, flip) {
    const sp = new E.Spr(28, 18);
    const walk = anim === 'walk', graze = anim === 'graze';
    const bob = walk && (f === 1 || f === 3) ? 1 : 0;
    const sw = walk ? [-1, 0, 1, 0][f] : 0;
    const legX = [5 - sw, 8 + sw, 13 - sw, 16 + sw];
    legX.forEach((lx, k) => { const lift = walk && ((k === 0 || k === 3) ? f === 1 : f === 3); sp.rect(lx, 11, 2, lift ? 3 : 4, C.WD1); sp.set(lx, lift ? 13 : 14, C.WD0); sp.set(lx + 1, lift ? 13 : 14, C.WD0); });
    E.blob(sp, [
      { x: 6, y: 8 + bob, r: 4.2 }, { x: 10, y: 6 + bob, r: 4.6 }, { x: 14, y: 7 + bob, r: 4.4 },
      { x: 8, y: 10 + bob, r: 4 }, { x: 12, y: 10 + bob, r: 4 }, { x: 4, y: 10 + bob, r: 2.8 }, { x: 15, y: 10 + bob, r: 3 },
    ], { l: C.CR0, m: C.CR0, d: C.CR1, rim: C.WD4 }, E.rngFor(14));
    for (const [x, y] of [[8, 3], [11, 2], [13, 3]]) { sp.set(x, y + bob, C.CR0); sp.set(x + 1, y + bob, C.CR0); sp.set(x, y + 1 + bob, C.CR0); }
    sp.hline(6, 15, 13 + bob, C.CR1);
    const hx = graze ? 3 : 0, hy = graze ? 6 + (f ? 1 : 0) : 0;
    if (graze) for (let i = 0; i <= 3; i++) sp.shadeEllipse(15 + i, 8 + i * 1.6, 2.2, 2.6, { l: C.CR0, m: C.CR0, d: C.CR1 });
    const H = (x, y, c) => sp.set(x + hx, y + hy + bob, c);
    sp.shadeEllipse(19 + hx, 9 + hy + bob, 2, 3, { l: C.WD2, m: C.WD2, d: C.WD1 }); sp.shadeEllipse(18 + hx, 8 + hy + bob, 2, 3, { l: C.WD2, m: C.WD1, d: C.WD1 });
    for (let y = 10; y < 12; y++) for (let x = 19; x < 22; x++) H(x, y, C.WD3); H(21, 10, C.B0); H(20, 11, C.WD1);
    H(18, 8, C.CR0); H(18, 9, C.INK1);
    for (let y = 5; y < 8; y++) for (let x = 16; x < 20; x++) H(x, y, C.CR0); H(17, 4, C.CR0); H(18, 4, C.CR0); for (let x = 16; x < 20; x++) H(x, 7, C.CR1);
    for (let y = 7; y < 9; y++) for (let x = 15; x < 17; x++) H(x, y, C.WD1); H(14, 8, C.WD0);
    return finish(sp, flip);
  }

  const get = (key, build) => cache[key] || (cache[key] = build());
  global.Animals = {
    get(kind, variant, anim, f, flip) {
      const key = [kind, variant, anim, f, flip].join('|');
      if (kind === 'chicken') return get(key, () => chicken(variant, anim, f, flip));
      if (kind === 'cow') return get(key, () => cow(variant, anim, f, flip));
      if (kind === 'pig') return get(key, () => pig(anim, f, flip));
      return get(key, () => sheep(anim, f, flip));
    },
    idleKinds: { chicken: ['peck', 'stand'], cow: ['graze', 'stand'], pig: ['stand'], sheep: ['graze', 'stand'] },
  };
})(window);
