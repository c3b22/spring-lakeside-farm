/* Animated things: the three farm workers and the fish. Sprites are built once per pose/frame and cached;
   scene.js decides where and when they appear. Skin tones come from the dirt ramp, since the palette has no skin. */
(function (global) {
  'use strict';

  const E = global.Engine;
  const C = global.Palette.C;

  const SKIN = { l: C.D4, m: C.D3, d: C.D2 };
  const OUTFITS = {
    waterer: {
      hat: 'straw', hair: C.WD2, hairL: C.WD3, shirt: { l: C.CR0, m: C.CR0, d: C.CR1 }, pants: { l: C.BL1, m: C.BL0, d: C.INK1 }, overalls: true,
    },
    woodcutter: {
      hat: 'cap', hatc: { l: C.R3, m: C.R2, d: C.R1 }, hair: C.WD1, hairL: C.WD2, shirt: { l: C.CG2, m: C.CG1, d: C.CG0 }, plaid: true,
      pants: { l: C.WD3, m: C.WD2, d: C.WD1 }, patch: C.BL0,
    },
    fisher: {
      hat: 'beanie', hatc: { l: C.O1, m: C.O0, d: C.R2 }, hair: C.Y0, hairL: C.Y1, shirt: { l: C.Y1, m: C.Y0, d: C.O0 }, scarf: true,
      pants: { l: C.BL1, m: C.BL0, d: C.INK1 },
    },
  };

  function ellipse(sp, cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) sp.set(cx + x, cy + y, c);
    }
  }
  function line(sp, x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) sp.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
  }

  const cache = {};

  /* pose: 'water' (f 0 level, 1 pouring), 'chop' (f 0 raised, 1 swinging, 2 striking), 'fish' (f 0/1 rod bob).
     Drawn facing right, 30x32; the body centre is x=11 and the feet touch y=31. */
  /* Drawing through a view lets the upper body lean and crouch while the legs stay planted. */
  function view(S, dx, dy) {
    return {
      set: (x, y, c) => S.set(x + dx, y + dy, c), get: (x, y) => S.get(x + dx, y + dy),
      rect: (x, y, w, h, c) => S.rect(x + dx, y + dy, w, h, c),
      hline: (x0, x1, y, c) => S.hline(x0 + dx, x1 + dx, y + dy, c),
      vline: (x, y0, y1, c) => S.vline(x + dx, y0 + dy, y1 + dy, c),
      shadeRect: (x, y, w, h, r) => S.shadeRect(x + dx, y + dy, w, h, r),
      shadeEllipse: (cx, cy, rx, ry, r) => S.shadeEllipse(cx + dx, cy + dy, rx, ry, r),
    };
  }

  function person(name, pose, f, flip, carry) {
    const key = [name, pose, f, flip, carry ? 1 : 0].join('|');
    if (cache[key]) return cache[key];
    const o = OUTFITS[name];
    const S = new E.Spr(34, 42);                     // 6 rows of headroom for a raised axe
    const OFF = 6;
    const sit = pose === 'fish' || pose === 'sit';
    const lean = pose === 'chop' ? [[0, 0], [1, 0], [2, 2], [0, 0]][f]
      : pose === 'walk' ? [0, f % 2 ? 0 : 1]
      : pose === 'pet' ? [2, 5]
      : pose === 'draw' ? [f ? 1 : 0, 0]
      : pose === 'sit' ? [f === 1 || f === 2 ? 1 : 0, 0] : [0, 0];
    const L = view(S, 0, OFF);
    const U = view(S, lean[0], OFF + lean[1] + (sit ? 5 : 0));
    const boot = { l: C.WD3, m: C.WD2, d: C.WD1 };
    // legs and boots (the stance widens when the axe comes down)
    if (pose === 'walk') {
      // side view stride: far leg darker, each leg a slanted 3px strip from hip to foot, toe pointing forward
      const hip = 21 + lean[1];
      const st = [[3, -3, 0, 0], [1, -1, 0, 1], [-3, 3, 0, 0], [-1, 1, 1, 0]][f];
      const far = { l: o.pants.m, m: o.pants.d, d: o.pants.d };
      const leg = (off, lift, pc) => {
        const end = 29 - lift;
        for (let y = hip; y < end; y++) {
          const xx = 10 + Math.round(off * (y - hip) / (end - hip));
          L.set(xx, y, pc.l); L.set(xx + 1, y, pc.m); L.set(xx + 2, y, pc.d);
        }
        const fx = 10 + off;
        L.shadeRect(fx - 1, end, 5, 3, boot); L.rect(fx + 4, end + 1, 2, 2, boot.m); L.hline(fx - 1, fx + 5, end + 2, C.INK1);
      };
      leg(st[1], st[3], far);
      leg(st[0], st[2], o.pants);
    } else if (!sit) {
      const hip = 21 + lean[1];
      let bx = 8, fx = 11, lb = 0, lf = 0;
      if (pose === 'walk') { const w = [[-2, 2, 0, 0], [0, 0, 0, 1], [2, -2, 0, 0], [0, 0, 1, 0]][f]; bx += w[0]; fx += w[1]; lb = w[2]; lf = w[3]; }
      if (pose === 'pet') { bx = 7; fx = 12; }
      const kneel = pose === 'pet';
      L.shadeRect(fx, hip, 3, 29 - hip - lf, { l: o.pants.m, m: o.pants.d, d: o.pants.d });
      L.shadeRect(bx, hip, 3, 29 - hip - lb, o.pants);
      if (!kneel) { L.hline(bx, bx + 2, 25, o.pants.d); L.hline(fx, fx + 2, 25, o.pants.d); }
      if (o.patch && !kneel) { L.rect(bx, 24, 3, 2, o.patch); L.set(bx + 1, 24, C.CR0); }
      L.shadeRect(bx - 1, 29 - lb, 5, 3, boot); L.rect(bx + 4, 30 - lb, 3, 2, boot.m); L.hline(bx - 1, bx + 6, 31 - lb, C.INK1);
      L.shadeRect(fx, 29 - lf, 4, 3, boot); L.set(fx + 2, 29 - lf, C.WD4);
    } else {
      L.shadeRect(9, 26, 10, 3, o.skirt || o.pants); L.hline(13, 17, 27, (o.skirt || o.pants).d);
      L.shadeRect(18, 26, 3, 5, o.pants);
      L.shadeRect(18, 30, 5, 3, boot); L.hline(18, 22, 32, C.INK1);
    }
    if (o.skirt && !sit) {
      const hip = 21 + lean[1];
      for (let y = hip - 1; y <= 25; y++) {
        const g = Math.floor((y - hip + 1) / 3);
        const x0 = 8 - g - (pose === 'walk' && y > 23 ? (f === 0 ? 1 : f === 2 ? -1 : 0) : 0), x1 = 13 + g;
        L.hline(x0, x1, y, o.skirt.m); L.set(x0, y, o.skirt.l); L.set(x1, y, o.skirt.d);
        if (y === 25) L.hline(x0, x1, y, o.skirt.d);
        else if ((y + g) % 3 === 0) L.set(x0 + 3, y, o.skirt.d);
      }
    }
    // torso
    const ty = 12;
    U.shadeRect(8, ty, 6, 9, o.shirt);
    if (o.plaid) { for (let y = ty + 1; y < ty + 8; y += 3) U.hline(9, 12, y, C.CG0); for (let x = 10; x < 13; x += 3) U.vline(x, ty + 1, ty + 7, C.CG0); }
    if (o.overalls) {
      U.rect(9, ty + 4, 5, 5, o.pants.m); U.vline(9, ty + 4, ty + 8, o.pants.l);
      U.vline(9, ty, ty + 4, o.pants.m); U.vline(12, ty, ty + 4, o.pants.d);
      U.set(9, ty + 4, C.Y0); U.set(12, ty + 4, C.Y0); U.rect(10, ty + 6, 2, 2, o.pants.d);
    } else {
      U.vline(12, ty + 1, ty + 7, o.shirt.d); U.set(12, ty + 2, C.INK1); U.set(12, ty + 5, C.INK1);
      U.rect(9, ty + 4, 2, 2, o.shirt.d); U.hline(9, 10, ty + 4, o.shirt.l);
    }
    if (o.apron) {
      U.rect(9, ty + 3, 5, 6, C.CG1); U.vline(9, ty + 3, ty + 8, C.CG2); U.vline(13, ty + 3, ty + 8, C.CG0); U.hline(9, 13, ty + 3, C.CG2);
      U.set(10, ty + 5, C.RED); U.set(12, ty + 6, C.Y0); U.set(11, ty + 7, C.BL1); U.set(10, ty + 8, C.B1);
    }
    if (o.scarf) { U.hline(9, 13, ty, C.R2); U.hline(10, 13, ty + 1, C.R1); U.set(10, ty + 2, C.R2); U.set(10, ty + 3, C.R1); }
    else U.hline(10, 13, ty, C.CR0);
    U.hline(8, 13, ty + 8, C.WD1); U.set(12, ty + 8, C.GL0);
    // head
    const hy = 8;
    U.rect(10, ty - 2, 3, 2, skin(2));
    U.shadeEllipse(11, hy, 3.5, 4.2, { l: C.D4, m: C.D3, d: C.D2 });
    U.set(9, hy + 1, C.D2); U.set(9, hy, C.D3);
    U.set(12, hy, C.CR0); U.set(13, hy, C.INK1); U.hline(12, 13, hy - 1, o.hair);
    U.set(14, hy + 1, C.D2); U.set(14, hy + 2, C.D3); U.set(13, hy + 3, (pose === 'chop' && f === 2) || (pose === 'sit' && f === 3) ? C.INK1 : C.R1); U.set(12, hy + 2, C.B1);
    U.rect(8, hy - 3, 3, 6, o.hair); U.vline(8, hy - 3, hy, o.hairL); U.hline(9, 12, hy - 3, o.hair);
    if (o.long) { U.rect(7, hy - 2, 3, 11, o.hair); U.vline(7, hy - 2, hy + 8, o.hairL); U.set(8, hy + 8, o.hairL); }
    if (o.hat === 'beret') {
      U.shadeRect(8, hy - 6, 8, 3, o.hatc); U.set(15, hy - 4, o.hatc.d); U.set(11, hy - 7, o.hatc.l); U.hline(8, 12, hy - 3, o.hatc.d);
    } else if (o.hat === 'straw') {
      U.hline(5, 17, hy - 3, C.Y1); U.hline(5, 17, hy - 2, C.Y0); U.hline(6, 16, hy - 1, C.D2);
      U.shadeRect(8, hy - 7, 7, 4, { l: C.Y1, m: C.Y0, d: C.O1 }); U.hline(8, 14, hy - 4, C.R2);
    } else if (o.hat === 'cap') {
      U.shadeRect(8, hy - 6, 6, 3, o.hatc); U.hline(13, 17, hy - 3, o.hatc.d); U.hline(14, 17, hy - 2, C.D2); U.set(11, hy - 6, o.hatc.l);
    } else {
      U.shadeRect(8, hy - 7, 7, 5, o.hatc); U.hline(8, 14, hy - 3, o.hatc.d); U.set(11, hy - 8, o.hatc.l); U.hline(9, 13, hy - 5, o.hatc.d);
    }

    const hand = (x, y) => { U.rect(x, y, 2, 2, C.D3); U.set(x, y, C.D4); U.set(x + 2, y, C.D2); };
    if (pose === 'water') {
      U.shadeRect(11, ty + 1, 4, 3, o.shirt); U.vline(14, ty + 1, ty + 3, C.CR1); hand(15, ty + 2);
      const cy = ty + (f ? 2 : 1);
      U.shadeRect(17, cy, 8, 6, { l: C.M3, m: C.M2, d: C.M1 }); U.hline(17, 24, cy + 2, C.M1);
      for (const [x, y] of [[18, cy - 1], [19, cy - 2], [20, cy - 2], [21, cy - 1]]) U.set(x, y, C.M2);
      if (!f) for (let k = 0; k < 5; k++) U.set(25 + (k >> 1), cy + 2 - k, C.M2);
      else for (let k = 0; k < 5; k++) U.set(25 + (k >> 1), cy + 3 + k, C.M2);
      U.set(27, f ? cy + 8 : cy - 2, C.M3);
    } else if (pose === 'chop') {
      // both hands on a straight handle; the head is a bar across its end, blade edge leading the swing
      const G = [[13, ty + 4], [14, ty + 3], [14, ty + 5], [14, ty + 5]][f];
      const T = [[11, ty - 11], [22, ty - 4], [24, ty + 10], [18, ty + 14]][f];
      let dx = T[0] - G[0], dy = T[1] - G[1];
      const n = Math.hypot(dx, dy); dx /= n; dy /= n;
      line(U, 10, ty + 2, G[0] - 1, G[1] + 1, o.shirt.d); line(U, 10, ty + 3, G[0] - 1, G[1] + 2, o.shirt.d);
      const b0 = [Math.round(G[0] - dx * 2), Math.round(G[1] - dy * 2)];
      line(U, b0[0], b0[1], T[0], T[1], C.WD3);
      if (Math.abs(dy) > Math.abs(dx)) line(U, b0[0] + 1, b0[1], T[0] + 1, T[1], C.WD2); else line(U, b0[0], b0[1] + 1, T[0], T[1] + 1, C.WD2);
      for (let k = -2; k <= 4; k++) for (let m = 0; m < 3; m++) {
        const px = Math.round(T[0] - dy * k - dx * m), py = Math.round(T[1] + dx * k - dy * m);
        U.set(px, py, k >= 3 ? C.M3 : m === 0 ? C.M2 : C.M1);
      }
      line(U, 11, ty + 1, G[0], G[1], o.shirt.m); line(U, 11, ty + 2, G[0], G[1] + 1, o.shirt.l);
      hand(G[0] - 1, G[1] - 1); hand(b0[0] - 1, b0[1]);
    } else if (pose === 'fish') {
      U.shadeRect(11, ty + 1, 3, 3, o.shirt); hand(14, ty + 3);
      line(U, 16, ty + 3, 28, ty - 6 + (f ? -1 : 0), C.WD4); line(U, 16, ty + 4, 28, ty - 5 + (f ? -1 : 0), C.WD2);
      U.set(16, ty + 5, C.M2); U.set(17, ty + 5, C.M1);
    } else {
      const arm = (x0, y0, x1, y1) => { line(U, x0, y0, x1, y1, o.shirt.m); line(U, x0 + 1, y0, x1 + 1, y1, o.shirt.d); };
      const bucket = (x, y, tilt) => {
        U.shadeRect(x, y, 6, 5, { l: C.WD3, m: C.WD2, d: C.WD1 }); U.hline(x, x + 5, y + 1, C.M2); U.hline(x, x + 5, y + 3, C.M2);
        U.hline(x, x + 5, y, C.WD4);
        if (tilt) { U.set(x + 6, y + 1, C.WD3); U.set(x + 6, y, C.W3); } else { U.hline(x + 1, x + 4, y, C.W3); U.set(x + 2, y - 1, C.M2); U.set(x + 3, y - 2, C.M2); U.set(x + 4, y - 1, C.M2); }
      };
      if (pose === 'paint') {
        const h = [[18, ty + 2], [19, ty], [18, ty - 1], [19, ty + 1]][f];
        arm(12, ty + 1, h[0] - 1, h[1] + 1); hand(h[0] - 1, h[1]);
        line(U, h[0] + 1, h[1], h[0] + 3, h[1] - 1, C.WD3); U.set(h[0] + 4, h[1] - 1, f % 2 ? C.RED : C.BL1);
      } else if (pose === 'walk') {
        const sw = [2, 0, -2, 0][f];
        if (carry) { arm(11, ty + 1, 13, ty + 7); hand(13, ty + 7); bucket(12, ty + 9, false); }
        else { arm(10 + (sw > 0 ? 1 : 0), ty + 1, 10 + sw, ty + 7); hand(10 + sw, ty + 7); }
      } else if (pose === 'pet') {
        arm(12, ty + 1, 16, ty + 8 + (f ? 1 : 0)); hand(16, ty + 9 + (f ? 1 : 0));
      } else if (pose === 'draw') {
        const up = f ? 1 : 0;
        arm(12, ty + 1, 16, ty + 3 + up * 2); hand(16, ty + 3 + up * 2);
        arm(11, ty + 1, 14, ty + 6 - up * 2); hand(14, ty + 6 - up * 2);
        line(U, 17, ty + 3 + up * 2, 26, ty - 6, C.CR1);
      } else if (pose === 'pour') {
        arm(12, ty + 1, 15, ty + 3); hand(15, ty + 3);
        bucket(16, ty + 2 + (f ? 1 : 0), !!f);
      } else if (pose === 'sit') {
        if (f === 0) { arm(12, ty + 1, 17, ty + 6); hand(17, ty + 6); }
        else if (f === 1) { arm(12, ty + 1, 15, ty + 1); hand(14, hy + 2); U.set(16, hy + 3, C.O1); U.set(16, hy + 2, C.R2); }
        else if (f === 2) { arm(12, ty + 1, 15, ty + 1); hand(14, hy + 2); U.rect(16, hy + 1, 4, 5, C.Y0); U.hline(16, 19, hy + 1, C.CR0); U.vline(20, hy + 2, hy + 4, C.M2); U.set(17, hy + 3, C.Y1); }
        else { arm(12, ty + 1, 17, ty - 2); hand(17, ty - 4); }
      }
    }
    S.outline(C.INK0, C.INK1);
    return (cache[key] = flip ? S.flipX() : S);
  }
  const skin = (n) => (n === 0 ? C.D4 : n === 1 ? C.D3 : C.D2);

  /* A fish leaping, seen from the side: 'up' while rising, 'flat' at the top, 'down' while falling. */
  function fishSide(dir) {
    const key = 'fish|' + dir;
    if (cache[key]) return cache[key];
    const sp = new E.Spr(11, 8);
    const body = [[2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [3, 2], [4, 2], [5, 2], [6, 2], [3, 4], [4, 4], [5, 4], [6, 4]];
    const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    for (const [x, y] of body) sp.set(x + (x > 4 ? 0 : 0), y + Math.round(dy * (x - 4) * 0.35), x < 4 ? C.M2 : C.M3);
    for (const [x, y] of [[3, 4], [4, 4], [5, 4], [6, 4]]) sp.set(x, y + Math.round(dy * (x - 4) * 0.35), C.CR0);
    sp.set(7, 3 + dy, C.INK1);
    sp.set(0, 2 - dy, C.O1); sp.set(1, 3, C.O1); sp.set(0, 4 + dy, C.O1); sp.set(1, 2, C.O0);
    return (cache[key] = sp.outline(C.INK0, C.INK1));
  }

  global.Actors = { person, fishSide };
})(window);
