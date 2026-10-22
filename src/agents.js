/* Everything that moves around the farm on its own: the animals, who wander anywhere the navigation grid allows,
   and the three villagers, who follow a daily routine (work, meals, beer, bed) with pathfinding between places.
   Time arrives as minutes since midnight in `env.min`. */
(function (global) {
  'use strict';

  const E = global.Engine;
  const C = global.Palette.C;
  const hash01 = (n) => { let h = Math.imul(n | 0, 374761393) + 668265263; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  let ctx = null;
  let lastT = null, lastMin = null;
  const wanderers = [], villagers = [];
  /* what is switched on (Wallpaper Engine properties / ?people=0&livestock=0&pets=0) */
  const show = { people: true, livestock: true, pets: true };
  const groupOf = (a) => (a.kind === 'cat' || a.kind === 'dog' ? 'pets' : 'livestock');
  const isOn = (a) => show[groupOf(a)];
  let needSnap = false;
  function setVisible(group, on) {
    if (!(group in show) || show[group] === !!on) return;
    show[group] = !!on;
    if (group === 'people' && on) needSnap = true;
  }

  /* ---------- places ---------- */
  const DOOR = [118, 148], TENT = [614, 303];
  const STUMP = [67, 170];                         // where the woodcutter stands to chop
  const WELL = [170, 189];                         // in front of the well
  const TROUGH = [480, 103];                       // beside the pen's water trough
  const DOCK = [487, 291];                         // the fisher's seat on the dock (hip anchor)
  const GARDEN = [[150, 252, true], [150, 270, false], [150, 288, true], [150, 304, false], [250, 254, true], [250, 264, false]];   // gaps between the plots
  const DOCK_IN = [421, 299];                      // where the dock meets the shore; the deck lane runs east along y=299
  const inDock = (x, y) => x >= 424 && x <= 506 && y >= 278 && y <= 312;
  const SEATS = {                                  // hip anchors, all four on the back bench of the picnic table
    wood: { x: 382, y: 335, flip: false, depth: 336, view: 'down', entry: 321 },      // back bench, facing us
    water: { x: 414, y: 335, flip: false, depth: 336, view: 'down', entry: 321 },
    fish: { x: 398, y: 352, flip: false, depth: 420, view: 'up', entry: 366 },       // front bench, back to us
  };
  const BENCH_BACK = 321;                          // walk to the strip behind the bench, then step onto it

  /* ---------- the day ---------- */
  function modeAt(min) {
    if (min < 390 || min >= 1260) return 'sleep';                           // inside from 21:00 to 06:30
    if (min >= 1110) return 'beer';                                          // 18:30-21:00
    if ((min >= 470 && min < 510) || (min >= 750 && min < 780) || (min >= 1070 && min < 1110)) return 'meal';   // 8:00, 12:30, 18:00 (walk over ~10 min early)
    return 'work';
  }

  /* ---------- wanderers ---------- */
  const SPECS = [
    { kind: 'cow', variant: 0, x: 500, y: 148, speed: 9, R: 140, idle: [8, 20], stride: 3 },
    { kind: 'pig', variant: 0, x: 548, y: 130, speed: 11, R: 130, idle: [6, 14], stride: 3 },
    { kind: 'sheep', variant: 0, x: 474, y: 108, speed: 10, R: 130, idle: [8, 18], stride: 2.6 },
    { kind: 'sheep', variant: 0, x: 578, y: 112, speed: 10, R: 130, idle: [8, 18], stride: 2.6 },
    ...[[466, 148, 0], [588, 148, 1], [230, 128, 0], [258, 130, 1], [278, 148, 0], [214, 150, 1]].map(([x, y, v]) => ({ kind: 'chicken', variant: v, x, y, speed: 14, R: 70, idle: [2, 6], stride: 2 })),
    { kind: 'cat', variant: 1, x: 190, y: 188, speed: 17, R: 120, idle: [6, 18], stride: 2.4 },
    { kind: 'cat', variant: 3, x: 212, y: 170, speed: 17, R: 120, idle: [6, 18], stride: 2.4 },
    { kind: 'cat', variant: 0, x: 318, y: 152, speed: 17, R: 120, idle: [6, 18], stride: 2.4 },
    { kind: 'cat', variant: 2, x: 348, y: 130, fixed: true, feet: 146, idle: [10, 26] },                // black cat lives on the crates
    { kind: 'dog', variant: 0, x: 142, y: 160, speed: 26, R: 170, idle: [5, 14], stride: 3 },
  ];

  function makeWanderer(spec, i) {
    return Object.assign({ i, rng: E.rngFor(1000 + i * 7), x: spec.x, y: spec.y, state: 'idle', timer: 1 + hash01(i) * 6, path: null, pi: 0,
      flip: hash01(i + 5) < 0.5, anim: 'stand', f: 0, t: hash01(i + 9) * 10, dist: 0, hold: 0 }, spec);
  }
  const between = (r, [a, b]) => a + (b - a) * r();

  function pickIdle(a) {
    const r = a.rng();
    if (a.kind === 'cat') a.anim = r < 0.45 ? 'sit' : r < 0.65 ? 'groom' : 'sleep';
    else if (a.kind === 'dog') a.anim = r < 0.5 ? 'sit' : 'lie';
    else if (a.kind === 'chicken') a.anim = r < 0.65 ? 'peck' : 'stand';
    else if (a.kind === 'pig') a.anim = 'stand';
    else a.anim = r < 0.6 ? 'graze' : 'stand';
    a.timer = between(a.rng, a.idle);
  }

  function idleFrame(a) {
    const t = a.t;
    if (a.kind === 'cat') return a.anim === 'sit' ? (Math.floor(t * 6) % 11 === 0 ? 3 : Math.floor(t * 1.3) % 3) : a.anim === 'groom' ? Math.floor(t * 3) % 2 : Math.floor(t * 0.9) % 2;
    if (a.kind === 'dog') return a.anim === 'sit' ? Math.floor(t * 4) % 2 : Math.floor(t * 0.8) % 2;
    if (a.kind === 'chicken') return a.anim === 'peck' ? Math.floor(t * 3.2) % 2 : (Math.floor(t * 1.4) % 5 === 0 ? 1 : 0);
    return Math.floor(t * (a.anim === 'graze' ? 1.6 : 0.9)) % 2;
  }

  function startWalk(a) {
    const far = a.rng() < 0.12;
    const p = global.Nav.randomPoint(a.rng, a.x, a.y, far ? 600 : a.R);
    const path = p && global.Nav.path(a.x, a.y, p[0], p[1]);
    if (!path || path.length < 2) { a.timer = 1.5; return; }
    a.path = path; a.pi = 1; a.state = 'walk'; a.dist = 0;
  }

  function updateWanderer(a, dt, env) {
    a.t += dt;
    if (a.fixed) { if ((a.timer -= dt) <= 0) pickIdle(a); a.f = idleFrame(a); if (env.sleep) { a.anim = 'sleep'; a.f = Math.floor(a.t * 0.9) % 2; } return; }
    if (a.hold > 0) { a.hold -= dt; if (a.state === 'walk') { a.state = 'idle'; a.timer = 2; a.path = null; pickIdle(a); } a.f = idleFrame(a); return; }
    if (env.sleep) {
      a.state = 'idle'; a.path = null;
      a.anim = a.kind === 'cat' ? 'sleep' : a.kind === 'dog' ? 'lie' : 'stand'; a.f = idleFrame(a); return;
    }
    if (a.state === 'walk') {
      let step = a.speed * (a.run > 0 ? 2.4 : 1) * dt;
      if (a.run > 0) a.run -= dt;
      while (step > 0 && a.pi < a.path.length) {
        const [tx, ty] = a.path[a.pi], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
        if (d <= step) { a.x = tx; a.y = ty; step -= d; a.pi++; }
        else { a.x += dx / d * step; a.y += dy / d * step; a.dist += step; if (Math.abs(dx) > 0.3) a.flip = dx < 0; step = 0; }
        if (d <= step || d === 0) a.dist += Math.min(d, step);
      }
      a.anim = 'walk'; a.f = Math.floor(a.dist / a.stride) % 4;
      if (a.pi >= a.path.length) {
        a.state = 'idle'; a.path = null;
        if (a.peckAfter) { a.peckAfter = false; a.anim = 'peck'; a.timer = 3.2; } else pickIdle(a);
      }
    } else {
      a.timer -= dt;
      if (a.timer <= 0) startWalk(a);
      a.f = idleFrame(a);
    }
  }

  function spriteFor(a) {
    if (a.kind === 'cat') return global.Pets.cat(a.variant, a.anim, a.f, a.flip);
    if (a.kind === 'dog') return global.Pets.dog(a.anim, a.f, a.flip);
    return global.Animals.get(a.kind, a.variant, a.anim, a.f, a.flip);
  }
  function drawWanderer(a) {
    const sp = spriteFor(a), foot = sp.footRow();
    if (!a.fixed) ctx.shadow(Math.round(a.x) + 1, Math.round(a.y), Math.max(3, sp.w >> 2));
    sp.blitDepth(Math.round(a.x - (sp.w >> 1)), Math.round(a.y - foot), a.feet || Math.round(a.y) + 1);
  }

  /* ---------- villagers ---------- */
  const W = (x, y, direct) => ({ type: 'walk', to: [x, y], direct });
  const A = (pose, dur, extra) => Object.assign({ type: 'act', pose, dur }, extra);
  const S = (p) => ({ type: 'show', at: p });
  const H = () => ({ type: 'hide' });
  const F = (fn) => ({ type: 'call', fn });

  function waterTrip(v) {
    v.queue.unshift(W(WELL[0], WELL[1]), A('draw', 3.2), F((u) => { u.carry = true; }), W(TROUGH[0], TROUGH[1]), A('pour', 3.4, { at: "trough", flip: false }), F((u) => { u.carry = false; }));
  }
  function petTrip(v, dur) {
    const pool = wanderers.filter((a) => !a.fixed && isOn(a));
    if (!pool.length) { waterTrip(v); return; }
    const a = pool[Math.floor(v.rng() * pool.length)];
    const side = a.x > 120 ? -1 : 1;
    v.queue.unshift(F(() => { a.hold = 16; }), W(a.x + side * 16, a.y), F((u) => { u.flip = side > 0; }), A('pet', dur || 3.6, { target: a }), F(() => { a.hold = 0; }));
  }
  function woodRoutine(v) {
    const steps = [W(STUMP[0], STUMP[1]), A('chop', 22 + v.rng() * 14, { spot: 'stump' })];
    steps.push(F(v.rng() < 0.55 ? (u) => petTrip(u) : waterTrip));
    return steps;
  }
  function gardenRoutine(v) {
    const steps = [];
    for (let k = 0; k < 3; k++) {
      let s; do { s = GARDEN[Math.floor(v.rng() * GARDEN.length)]; } while (s === v.last);
      v.last = s; steps.push(W(s[0], s[1]), A('water', 6 + v.rng() * 3, { flip: s[2] }));
    }
    steps.push(W(WELL[0], WELL[1]), A('draw', 3.2));
    return steps;
  }
  function fishRoutine() { return [W(DOCK[0], DOCK[1]), A('fish', 1e9)]; }

  const VILLAGERS = [
    { id: 'wood', outfit: 'woodcutter', home: 'house', routine: woodRoutine, order: 0 },
    { id: 'water', outfit: 'gardener', home: 'house', routine: gardenRoutine, order: 1 },
    { id: 'fish', outfit: 'fisher', home: 'tent', routine: fishRoutine, order: 2 },
  ];
  const homeOf = (v) => (v.home === 'tent' ? TENT : DOOR);
  function makeVillager(spec, i) {
    return Object.assign({ rng: E.rngFor(77 + i * 13), x: 0, y: 0, flip: false, visible: false, mode: null, queue: [], cur: null, carry: false, dir: 'down', dist: 0, wi: i * 2, seed: i * 1.7 }, spec);
  }

  function enterMode(v, mode) {
    const seated = v.cur && v.cur.type === 'act' && v.cur.pose === 'sit';
    const wasSeat = seated ? v.cur.seat : null;
    if (seated && (mode === 'meal' || mode === 'beer')) { v.mode = mode; return; }     // meal runs into beer: nobody gets up
    v.mode = mode; v.queue = []; v.cur = null; v.carry = false;
    if (seated) v.queue.push(W(v.x, wasSeat.entry, true));
    if (mode === 'sleep') { if (v.visible) v.queue.push(W(homeOf(v)[0], homeOf(v)[1]), H()); return; }
    if (!v.visible) v.queue.push(S(homeOf(v)));
    if (mode !== 'work') { const s = SEATS[v.id]; v.queue.push(W(s.x, s.entry), W(s.x, s.y, true), F((u) => { u.flip = s.flip; }), A('sit', 1e9, { seat: s })); }
  }

  function snap(v, min) {
    const mode = modeAt(min);
    v.mode = mode; v.queue = []; v.cur = null; v.carry = false;
    if (mode === 'sleep') { v.visible = false; return; }
    v.visible = true;
    if (mode === 'work') {
      const p = v.id === 'wood' ? STUMP : v.id === 'water' ? GARDEN[0] : DOCK;
      v.x = p[0]; v.y = p[1];
    } else {
      const s = SEATS[v.id]; v.x = s.x; v.y = s.y; v.flip = s.flip;
      v.cur = A('sit', 1e9, { seat: s }); v.cur.t = 0;
    }
  }

  function startStep(v, c) {
    if (c.type === 'walk') {
      const Nv = global.Nav, toD = inDock(c.to[0], c.to[1]), fromD = inDock(v.x, v.y);
      if (c.direct || (toD && fromD) || Math.hypot(c.to[0] - v.x, c.to[1] - v.y) < 4) c.path = [[v.x, v.y], c.to];
      else if (toD && !fromD) c.path = [...(Nv.path(v.x, v.y, DOCK_IN[0], DOCK_IN[1]) || [[v.x, v.y], DOCK_IN]), [430, 299], [484, 299], c.to];
      else if (fromD && !toD) c.path = [[v.x, v.y], [484, 299], [430, 299], ...(Nv.path(DOCK_IN[0], DOCK_IN[1], c.to[0], c.to[1]) || [DOCK_IN, c.to])];
      else c.path = Nv.path(v.x, v.y, c.to[0], c.to[1]) || [[v.x, v.y], c.to];
      c.pi = 1;
    } else if (c.type === 'show') { v.visible = true; v.x = c.at[0]; v.y = c.at[1]; }
    else if (c.type === 'hide') v.visible = false;
    else if (c.type === 'call') c.fn(v);
  }

  function updateVillager(v, dt, min) {
    const mode = modeAt(min);
    if (mode !== v.mode) enterMode(v, mode);
    for (let guard = 0; guard < 6; guard++) {
      if (!v.cur) {
        if (!v.queue.length) { if (v.mode === 'work') v.queue.push(...v.routine(v)); else return; }
        v.cur = v.queue.shift(); v.cur.t = 0; startStep(v, v.cur);
      }
      const c = v.cur;
      if (c.type === 'walk') {
        let step = (v.carry ? 17 : 22) * dt;
        while (step > 0 && c.pi < c.path.length) {
          const [tx, ty] = c.path[c.pi], dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
          if (d <= step) { v.x = tx; v.y = ty; step -= d; c.pi++; }
          else { v.x += dx / d * step; v.y += dy / d * step; v.dist += step; if (Math.abs(dy) > Math.abs(dx) * 1.2) v.dir = dy > 0 ? 'down' : 'up'; else { v.dir = 'side'; v.flip = dx < 0; } step = 0; }
        }
        if (c.pi >= c.path.length) v.cur = null; else return;
      } else if (c.type === 'act') {
        c.t += dt;
        if (c.t >= c.dur) v.cur = null; else return;
      } else v.cur = null;
    }
  }

  /* ---------- drawing the villagers ---------- */
  const HEART = [[0, 0], [1, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]];
  function bubble(x, y, t) {
    for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 14; xx++) {
      const edge = xx === 0 || xx === 13 || yy === 0 || yy === 7;
      const cut = (xx === 0 || xx === 13) && (yy === 0 || yy === 7);
      if (cut) continue;
      E.set(x + xx, y + yy, edge ? C.INK1 : C.CR0);
    }
    E.set(x + 3, y + 8, C.INK1); E.set(x + 4, y + 8, C.CR0); E.set(x + 3, y + 9, C.INK1);
    const n = 1 + Math.floor(t * 3) % 3;
    for (let k = 0; k < n; k++) { E.set(x + 3 + k * 3, y + 4, C.INK1); E.set(x + 4 + k * 3, y + 4, C.INK1); }
  }
  const mug = (x, y, foam) => { E.rect(x, y, 4, 5, C.Y0); E.hline(x, x + 3, y, foam ? C.CR0 : C.Y1); E.vline(x + 4, y + 1, y + 3, C.M2); E.set(x + 1, y + 1, C.Y1); };

  function drawVillager(v, t, min) {
    if (!v.visible) return;
    const Ch = global.Chars, c = v.cur, name = v.outfit;
    const act = c && c.type === 'act' ? c : null;
    let view = 'side', pose = 'walk', f = 1, flip = v.flip, carry = false, depth = inDock(v.x, v.y) ? 400 : Math.round(v.y) + 1, kind = 'stand';
    if (act) {
      pose = act.pose; flip = act.flip !== undefined ? act.flip : v.flip;
      if (pose === 'chop') { const cp = act.t % 2.6; f = cp < 0.9 ? 0 : cp < 1.2 ? 1 : cp < 1.5 ? 2 : 3; flip = false; }
      else if (pose === 'water') f = Math.floor(act.t * 1.2) % 2;
      else if (pose === 'draw') { f = Math.floor(act.t * 2.2) % 2; flip = false; }
      else if (pose === 'pour') { f = act.t > 0.8 ? 1 : 0; flip = false; }
      else if (pose === 'pet') f = Math.floor(act.t * 2.5) % 2;
      else if (pose === 'fish') { f = Math.floor(act.t * 1.6) % 2; kind = 'dock'; flip = false; depth = 400; }
      else if (pose === 'sit') {
        kind = 'seat'; view = act.seat.view; depth = act.seat.depth;
        const slot = Math.floor(t / 2.6), r = hash01(slot * 7 + v.order * 31), talker = hash01(slot * 3 + 11) * 3 >> 0 === v.order;
        // a relaxed posture that changes every ten seconds or so (upright, leaning on the table, leaning back),
        // with eating / drinking / talking now and then on top
        const pr = hash01(Math.floor(t / 10 + v.order * 1.7) * 5 + v.order * 13), posture = pr < 0.34 ? 0 : pr < 0.67 ? 4 : 5;
        const mode = modeAt(min);
        f = talker ? 3 : mode === 'meal' ? (r < 0.4 ? 1 : posture) : (r < 0.4 ? 2 : posture);
      }
    } else {
      const moving = c && c.type === 'walk';
      if (v.carry) { carry = true; if (moving) f = Math.floor(v.dist / 3.2) % 4; }
      else { view = v.dir; if (moving) f = Math.floor(v.dist / 3.2) % 4; }
    }
    const sp = Ch.get(name, view, pose, f, view === 'side' && flip, carry);
    let x0, y0;
    if (kind === 'seat') { x0 = Math.round(act.seat.x) - 16; y0 = Math.round(act.seat.y) - 25; }
    else if (kind === 'dock') { x0 = Math.round(v.x) - 15; y0 = Math.round(v.y) - 32; }
    else { x0 = Math.round(v.x) - (view === 'side' && flip ? 16 : 15); y0 = Math.round(v.y) - 36; }
    if (kind === 'stand') ctx.shadow(Math.round(v.x), Math.round(v.y), 6);
    sp.blitDepth(x0, y0, depth);

    if (!act) return;
    if (pose === 'chop') {
      const cp = act.t % 2.6;
      const logWhole = cp < 1.28 || cp >= 2.1;
      const lg = (x, y, w, h) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) E.set(x + xx, y + yy, xx === 0 ? C.WD3 : xx === w - 1 ? C.WD1 : C.WD2); E.hline(x, x + w - 1, y, C.WD4); E.set(x + 1, y + 1, C.D4); };
      if (logWhole) lg(79, 155, 5, 9);
      else if (cp < 1.9) { const k = (cp - 1.28) / 0.6; lg(Math.round(79 - 6 * k), Math.round(155 + 9 * k * k), 2, 9); lg(Math.round(82 + 6 * k), Math.round(155 + 9 * k * k), 2, 9); }
      if (cp >= 1.28 && cp < 1.7) { const k = (cp - 1.28) / 0.42; for (let i = 0; i < 6; i++) E.set(Math.round(81 + (i - 2.5) * 5 * k), Math.round(160 - (5 + (i % 3) * 3) * k * (1 - k * 0.7)), i % 2 ? C.Y1 : C.WD4); }
    } else if (pose === 'water' && f) {
      const tx = flip ? x0 + 3 : x0 + 28, ty = y0 + 26;
      for (let i = 0; i < 6; i++) { const dy = (act.t * 22 + i * 4) % 13; E.set(Math.round(tx + (flip ? -1 : 1) * ((i % 3) * 0.6 + dy * 0.12)), Math.round(ty + dy), i % 2 ? C.W3 : C.W4); }
    } else if (pose === 'pet' && act.target) {
      for (let k = 0; k < 2; k++) { const u = ((act.t * 0.7 + k * 0.5) % 1); const hx = Math.round(act.target.x - 2 + (k ? 5 : -4)), hy2 = Math.round(act.target.y - 22 - u * 10); for (const [dx, dy] of HEART) E.set(hx + dx, hy2 + dy, C.B1); }
    } else if (pose === 'fish') {
      const tipX = x0 + 30, tipY = y0 + 9 - f, bx = 513, by = 301 + Math.round(Math.sin(t * 2.1) * 0.6);
      const L = Math.max(Math.abs(bx - tipX), Math.abs(by - tipY));
      for (let i = 0; i <= L; i++) E.set(Math.round(tipX + (bx - tipX) * i / L), Math.round(tipY + (by - tipY) * i / L + Math.sin(i * 0.4) * (1 - i / L) * 0.8), C.CR1);
      E.set(bx, by, C.RED); E.set(bx + 1, by, C.CR0); E.set(bx, by + 1, C.CR0);
      ctx.ring(bx, by + 2, ((t * 0.9) % 1) * 5 + 1, C.W3);
    } else if (pose === 'sit' && f === 3) {
      bubble(Math.round(act.seat.x) - 6, y0 - 12, t);
    }
  }

  /* what is on the table */
  function drawTable(t, min) {
    const mode = modeAt(min);
    if (mode === 'beer') {
      for (const [x, y, k] of [[408, 341, 0], [414, 342, 1], [381, 343, 2], [377, 340, 3]]) mug(x, y, Math.floor(t * 0.5 + k) % 4 !== 0);
      // a lantern in the middle of the table: warm light pool that flickers
      const fl = Math.sin(t * 9) * 0.5 + Math.sin(t * 14 + 1) * 0.5;
      E.rect(386, 337, 5, 6, C.WD1); E.hline(386, 390, 337, C.M2); E.hline(386, 390, 342, C.M2); E.rect(387, 338, 3, 4, C.GL0); E.set(388, 338 - (fl > 0.3 ? 1 : 0), C.GL1); E.set(388, 339, C.GL1);
      ctx.light(396, 342, 30 + fl * 2, 14 + fl);
    } else if (mode === 'meal') {
      for (const x of [388, 402]) { E.hline(x, x + 4, 339, C.O1); E.hline(x + 1, x + 3, 338, C.Y1); E.set(x + 2, 337, C.RED); }
      E.set(396, 338, C.RED); E.set(397, 338, C.RED);
    }
  }

  /* ---------- public ---------- */
  function setup(context) {
    ctx = context;
    wanderers.length = 0; villagers.length = 0;
    SPECS.forEach((s, i) => wanderers.push(makeWanderer(s, i)));
    VILLAGERS.forEach((s, i) => villagers.push(makeVillager(s, i)));
    lastT = null; lastMin = null;
  }

  /* ---------- the mouse ----------
     Chickens, cats and pigs shy away from a moving pointer, the dog trots over to a pointer that rests,
     a click on an animal pets it (hearts), a click on open ground scatters grain that hens come to peck. */
  const mouse = { x: 0, y: 0, inside: false, moved: -99, rest: 0, dogCd: 0 };
  const hearts = [], grain = [];
  let mouseOn = true;
  function pointer(x, y, inside) {
    if (!mouseOn) return;
    if (Math.hypot(x - mouse.x, y - mouse.y) > 1.5) { mouse.moved = lastT === null ? 0 : lastT; mouse.rest = 0; }
    mouse.x = x; mouse.y = y; mouse.inside = inside !== false;
  }
  function click(x, y) {
    if (lastT === null || !mouseOn) return;
    let best = null, bd = 18;
    for (const a of wanderers) { if (!isOn(a)) continue; const d = Math.hypot(a.x - x, a.y - 8 - y); if (d < bd) { bd = d; best = a; } }
    if (best) {
      best.hold = 2.8; best.state = 'idle'; best.path = null; pickIdle(best);
      hearts.push({ x: best.x, y: best.y, t0: lastT });
      return;
    }
    const spots = [];
    for (let i = 0; i < 7; i++) spots.push([x + (hash01(i * 7 + Math.floor(lastT * 10)) - 0.5) * 12, y + (hash01(i * 13 + 5) - 0.5) * 8]);
    grain.push({ spots, t0: lastT, x, y });
    for (const a of wanderers) {
      if (a.kind !== 'chicken' || !isOn(a) || a.hold > 0 || Math.hypot(a.x - x, a.y - y) > 110) continue;
      const p = global.Nav.randomPoint(a.rng, x, y, 9);
      const path = p && global.Nav.path(a.x, a.y, p[0], p[1]);
      if (path && path.length > 1) { a.path = path; a.pi = 1; a.state = 'walk'; a.dist = 0; a.run = 1.5; a.peckAfter = true; }
    }
  }
  function flee(a) {
    const dx = a.x - mouse.x, dy = a.y - 6 - mouse.y, d = Math.hypot(dx, dy) || 1;
    const p = global.Nav.randomPoint(a.rng, a.x + dx / d * 50, a.y + dy / d * 30, 16);
    const path = p && global.Nav.path(a.x, a.y, p[0], p[1]);
    if (path && path.length > 1) { a.path = path; a.pi = 1; a.state = 'walk'; a.dist = 0; a.run = 2.2; a.peckAfter = false; }
    a.fleeCd = 1.2;
  }
  function reactToMouse(t, dt, env) {
    if (!mouse.inside || env.sleep) return;
    mouse.rest = t - mouse.moved;
    mouse.dogCd -= dt;
    for (const a of wanderers) {
      if (a.fixed || a.hold > 0 || !isOn(a)) continue;
      a.fleeCd = (a.fleeCd || 0) - dt;
      if ((a.kind === 'chicken' || a.kind === 'cat' || a.kind === 'pig') && a.fleeCd <= 0 && mouse.rest < 2.5 && Math.hypot(a.x - mouse.x, a.y - 6 - mouse.y) < 26) flee(a);
      if (a.kind === 'dog' && mouse.dogCd <= 0 && mouse.rest > 1.2 && mouse.rest < 25 && a.state === 'idle' && global.Nav.free(mouse.x, mouse.y)) {
        const path = global.Nav.path(a.x, a.y, mouse.x + (a.x < mouse.x ? -12 : 12), mouse.y);
        if (path && path.length > 1) { a.path = path; a.pi = 1; a.state = 'walk'; a.dist = 0; a.run = 3; }
        mouse.dogCd = 9;
      }
    }
  }
  function drawMouseEffects(t) {
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i], u = (t - h.t0) / 1.4;
      if (u >= 1) { hearts.splice(i, 1); continue; }
      const x = Math.round(h.x - 2), y = Math.round(h.y - 14 - u * 12);
      for (const [dx, dy] of HEART) E.set(x + dx, y + dy, C.B1);
    }
    for (let i = grain.length - 1; i >= 0; i--) {
      const g = grain[i], age = t - g.t0;
      if (age > 6) { grain.splice(i, 1); continue; }
      for (let k = 0; k < g.spots.length; k++) {
        const [sx, sy] = g.spots[k], fall = Math.min(1, age / 0.5), y = Math.round(sy - 14 * (1 - fall * fall));
        E.set(Math.round(sx), y, k % 2 ? C.Y1 : C.Y0);
      }
    }
  }

  function frame(t, env) {
    const min = env.min;
    const dt = lastT === null ? 0 : Math.max(0, Math.min(0.1, t - lastT));
    lastT = t;
    if (lastMin === null || Math.abs((((min - lastMin) + 720) % 1440) - 720) > 25) villagers.forEach((v) => snap(v, min));
    if (needSnap) { villagers.forEach((v) => snap(v, min)); needSnap = false; }
    lastMin = min;
    reactToMouse(t, dt, env);
    wanderers.forEach((a) => { if (isOn(a)) updateWanderer(a, dt, env); });
    if (show.people) { villagers.forEach((v) => updateVillager(v, dt, min)); drawTable(t, min); }
    const drawables = [...wanderers.filter(isOn).map((a) => [a.y, () => drawWanderer(a)]), ...(show.people ? villagers.map((v) => [v.y, () => drawVillager(v, t, min)]) : [])];
    drawables.sort((a, b) => a[0] - b[0]);
    for (const [, fn] of drawables) fn();
    drawMouseEffects(t);
  }

  global.Agents = { setup, frame, modeAt, pointer, click, setVisible, show, setMouse: (on) => { mouseOn = !!on; if (!on) mouse.inside = false; }, debug: () => ({ wanderers, villagers }) };
})(window);
