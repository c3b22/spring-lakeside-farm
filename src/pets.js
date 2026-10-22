/* Pets with real motion: a four-frame walk cycle, sitting (tail swish, blinks), grooming, sleeping with a
   breathing body, and for the dog sitting with a wagging tail and lying down. Sprites are cached by pose. */
(function (global) {
  'use strict';

  const E = global.Engine;
  const C = global.Palette.C;
  const cache = {};

  const COATS = [
    { l: C.O1, m: C.O0, d: C.R2, chest: C.CR0, eye: C.CG2, tab: true },
    { l: C.M3, m: C.M2, d: C.M1, chest: C.CR0, eye: C.Y1, tab: true },
    { l: C.M1, m: C.INK1, d: C.INK0, chest: C.INK1, eye: C.Y1, tab: false },
    { l: C.CR0, m: C.CR0, d: C.CR1, chest: C.CR0, eye: C.CG1, tab: false, calico: true },
  ];
  const finish = (sp, flip) => (flip ? sp.flipX() : sp).outline(C.INK0, C.INK1);

  function catWalk(variant, f, flip) {
    const v = COATS[variant % 4];
    const sp = new E.Spr(28, 20);
    const bob = f === 1 || f === 3 ? 1 : 0;
    const sw = [-2, 0, 2, 0][f];
    const ramp = { l: v.l, m: v.m, d: v.d };
    const paw = v.chest === C.INK1 ? C.M0 : v.chest;
    const legTop = 12 + bob;
    const leg = (x, lifted, far) => {
      const len = 19 - legTop - (lifted ? 2 : 0);
      sp.rect(x, legTop, 2, len, far ? v.d : v.m);
      if (!far) sp.vline(x, legTop, legTop + len - 1, v.l);
      sp.rect(x, legTop + len, 2, 1, paw);
    };
    leg(14 - sw, f === 3, true); leg(9 + sw, f === 1, true);
    sp.shadeEllipse(11, 10 + bob, 7.4, 3.9, ramp);
    sp.shadeEllipse(18, 10 + bob, 2.6, 3, ramp);
    leg(17 + sw, f === 1, false); leg(6 - sw, f === 3, false);
    const sway = [0, 1, 2, 1][f];
    for (let i = 0; i < 7; i++) sp.set(3 - (i >> 1) + (i > 3 ? sway - 1 : 0), 9 + bob - i, i % 3 === 2 ? v.d : v.m);           // tail, held up and swaying
    sp.shadeEllipse(22, 8 + bob, 3.8, 3.4, ramp);
    for (const [x, y] of [[20, 4], [20, 5], [21, 5], [24, 4], [24, 5], [23, 5]]) sp.set(x, y + bob, v.m);
    sp.set(21, 5 + bob, C.B1); sp.set(23, 5 + bob, C.B1);
    sp.set(23, 7 + bob, v.eye); sp.set(24, 7 + bob, v.eye); sp.set(23, 8 + bob, C.INK1); sp.set(21, 7 + bob, v.eye);
    sp.set(26, 9 + bob, C.B1); sp.hline(24, 26, 10 + bob, paw); sp.set(27, 8 + bob, C.CR1); sp.set(27, 9 + bob, C.CR1);
    sp.rect(19, 11 + bob, 2, 2, paw);
    if (v.tab) for (const x of [8, 10, 12]) sp.vline(x, 7 + bob, 9 + bob, v.d);
    if (v.calico) for (const [x, y, c] of [[8, 8, C.O0], [9, 8, C.O0], [13, 7, C.INK1], [14, 8, C.INK1], [22, 6, C.O0]]) sp.set(x, y + bob, c);
    return finish(sp, flip);
  }

  const DOG = { l: C.WD4, m: C.WD3, d: C.WD2 };

  function dogWalk(f, flip) {
    const sp = new E.Spr(34, 24);
    const bob = f === 1 || f === 3 ? 1 : 0;
    const sw = [-3, 0, 3, 0][f];
    const legTop = 14 + bob;
    const leg = (x, lifted, far) => {
      const len = 22 - legTop - (lifted ? 2 : 0);
      sp.rect(x, legTop, 3, len, far ? DOG.d : DOG.m);
      if (!far) sp.vline(x, legTop, legTop + len - 1, DOG.l);
      sp.rect(x, legTop + len, 3, 1, C.CR0);
    };
    leg(19 - sw, f === 3, true); leg(8 + sw, f === 1, true);
    sp.shadeEllipse(13, 11 + bob, 9.6, 5.2, DOG);
    sp.rect(8, 14 + bob, 10, 2, C.CR0); sp.rect(20, 12 + bob, 3, 4, C.CR0);
    sp.shadeEllipse(21, 11 + bob, 3.6, 4.2, DOG);
    leg(21 + sw, f === 1, false); leg(6 - sw, f === 3, false);
    for (let i = 0; i < 8; i++) sp.set(3 - (i >> 1) + (f % 2 ? 1 : 0) + (i > 5 ? 1 : 0), 10 + bob - i, i === 7 ? C.CR0 : DOG.m);   // tail wagging
    sp.shadeEllipse(26, 8 + bob, 4.3, 4, DOG);
    sp.shadeEllipse(30, 10 + bob, 2.6, 2, { l: C.WD4, m: C.WD4, d: C.WD3 });
    sp.set(32, 9 + bob, C.INK1); sp.set(28, 6 + bob, C.INK1); sp.set(27, 5 + bob, C.CR0);
    sp.rect(22, 5 + bob, 3, 6, C.WD1); sp.set(22, 5 + bob, C.WD0);
    sp.rect(22, 11 + bob, 2, 4, C.R2); sp.set(22, 15 + bob, C.Y0);
    if (f === 1 || f === 2) { sp.set(31, 12 + bob, C.B1); sp.set(31, 13 + bob, C.B1); }
    return finish(sp, flip);
  }

  function dogSit(f, flip) {
    const sp = new E.Spr(28, 26);
    sp.shadeEllipse(8, 18, 6.2, 5.8, DOG);
    sp.shadeEllipse(13, 12, 4.6, 8, DOG);
    sp.shadeEllipse(15, 14, 2.2, 4.6, { l: C.CR0, m: C.CR0, d: C.CR1 });
    sp.rect(14, 16, 3, 8, DOG.m); sp.vline(14, 16, 23, DOG.l); sp.rect(18, 16, 3, 8, DOG.m); sp.vline(20, 16, 23, DOG.d);
    sp.rect(14, 23, 3, 2, C.CR0); sp.rect(18, 23, 3, 2, C.CR0);
    sp.shadeEllipse(17, 6, 4.8, 4.4, DOG);
    sp.shadeEllipse(21, 8, 2.8, 2.2, { l: C.WD4, m: C.WD4, d: C.WD3 });
    sp.set(23, 7, C.INK1); sp.set(19, 4, C.INK1); sp.set(18, 3, C.CR0); sp.set(21, 4, C.INK1);
    sp.rect(12, 3, 3, 7, C.WD1); sp.set(12, 3, C.WD0); sp.rect(21, 2, 2, 4, C.WD1);
    sp.rect(14, 11, 5, 2, C.R2);
    if (f) { sp.set(22, 10, C.B1); sp.set(22, 11, C.B1); }
    for (let k = 0; k < 8; k++) sp.set(k, 25 - (f ? (k > 4 ? 1 + (k - 4) : 0) : 0), k % 3 === 2 ? DOG.d : DOG.m);    // tail swishing on the ground
    return finish(sp, flip);
  }

  function dogLie(f, flip) {
    const sp = new E.Spr(34, 18);
    const ry = f ? 4.6 : 4.1;
    sp.shadeEllipse(13, 12, 10, ry, DOG);
    sp.shadeEllipse(9, 13, 4, 3.4, DOG);
    sp.rect(2, 15, 5, 2, DOG.d);
    for (let k = 0; k < 5; k++) sp.set(k, 13 + (k > 2 ? 1 : 0), k % 2 ? DOG.d : DOG.m);
    sp.rect(22, 15, 9, 2, C.CR0); sp.hline(22, 30, 15, C.CR1);
    sp.shadeEllipse(27, 12, 4.2, 3.6, DOG);
    sp.set(29, 11, C.INK1); sp.hline(28, 29, 11, C.INK1); sp.set(31, 13, C.INK1);
    sp.rect(23, 9, 3, 6, C.WD1); sp.set(23, 9, C.WD0);
    sp.rect(22, 12, 2, 3, C.R2);
    return finish(sp, flip);
  }

  const get = (key, build) => cache[key] || (cache[key] = build());

  global.Pets = {
    cat(variant, anim, f, flip) {
      return get(['c', variant, anim, f, flip].join('|'), () => (anim === 'walk' ? catWalk(variant, f, flip) : global.Props.cat(variant, anim, flip, f)));
    },
    dog(anim, f, flip) {
      return get(['d', anim, f, flip].join('|'), () => (anim === 'walk' ? dogWalk(f, flip) : anim === 'sit' ? dogSit(f, flip) : dogLie(f, flip)));
    },
  };
})(window);
