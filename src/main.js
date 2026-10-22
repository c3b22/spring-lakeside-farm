/* Draws the static scene (lit or unlit), then every frame copies it, lets Scene.animate paint the moving things,
   and turns palette indices into pixels using the palette for the current time and a light bank per pixel.
   The canvas stays 640x400; CSS does the integer 3x.
   Preview controls:  ?time=HH:MM | dawn | day | dusk | night   ?speed=N (simulated minutes per second)
                      T cycles the time of day, G toggles the bounds guides. */
(function (global) {
  'use strict';

  const E = global.Engine;
  const P = global.Palette;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const img = ctx.createImageData(E.W, E.H);
  const px32 = new Uint32Array(img.data.buffer);
  let FPS = 30;
  const q = location.search;
  const param = (k) => { const m = new RegExp('[?&]' + k + '=([^&]*)').exec(q); return m ? decodeURIComponent(m[1]) : null; };

  /* ---------- clock ---------- */
  const PRESET = { dawn: 375, day: 720, dusk: 1140, night: 1320 };
  const realMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
  let lock = null;
  const tp = param('time');
  if (tp) {
    if (PRESET[tp] !== undefined) lock = PRESET[tp];
    else { const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(tp); if (m) lock = (+m[1]) * 60 + (+(m[2] || 0)); }
  }
  let speed = +(param('speed') || 0);
  let startMin = lock !== null ? lock : realMinutes(), t0 = 0;
  function minutesNow(ms) {
    if (speed > 0) return (startMin + ((ms - t0) / 1000) * speed) % 1440;
    return lock !== null ? lock : realMinutes();
  }
  const MODES = [null, 375, 720, 1140, 1320];          // T cycles: clock, dawn, day, dusk, night
  addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') {
      const i = MODES.indexOf(lock);
      lock = MODES[(i + 1) % MODES.length];
    }
  });

  /* ---------- static scene, redrawn only when the lamps switch on or off ---------- */
  const om = /[?&]outline=(none|soft|ink)/.exec(q);
  if (om) E.setOutlineMode(om[1]);
  let litNow = null, base = null, baseLight = null;
  function ensureScene(lit) {
    if (litNow === lit) return;
    litNow = lit;
    global.Scene.render({ lit });
    base = new Uint8Array(E.buf);
    baseLight = new Uint8Array(E.light);
  }

  /* ---------- present ---------- */
  let bankSet = null;
  function present() {
    const buf = E.buf, light = E.light;
    for (let i = 0; i < buf.length; i++) px32[i] = bankSet[light[i]][buf[i]];
    ctx.putImageData(img, 0, 0);
  }

  /* ---------- background-bounds guides (preview only; hidden inside Wallpaper Engine) ---------- */
  const inWallpaperEngine = typeof global.wallpaperRegisterAudioListener === 'function';
  let guides = !inWallpaperEngine && !/guides=0/.test(q);
  const overlay = document.getElementById('guides');
  const taskbar = overlay.querySelector('.tb');
  let clockText = '';
  function layoutGuides() {
    const r = canvas.getBoundingClientRect();
    const s = r.width / E.W;
    overlay.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;display:${guides ? 'block' : 'none'}`;
    taskbar.style.height = (global.Scene.LAYOUT.taskbarH * s) + 'px';
    document.body.classList.toggle('guides', guides);
    overlay.classList.toggle('grid', /grid=1/.test(q));
    overlay.style.setProperty('--tile', 16 * s + 'px');
    overlay.querySelector('.tag').textContent = `WALLPAPER ${E.W}×${E.H} → ${Math.round(r.width)}×${Math.round(r.height)} (${s}×)   ${clockText}   [G guides · T time · ?grid=1 ?debug=1]`;
  }
  /* 'fill' covers the whole screen (the edges are trimmed a little, the bottom 20 rows are spare anyway);
     'fit' keeps pixels perfectly square at a whole-number scale and leaves green borders. */
  let scaleMode = param('scale') === 'fit' ? 'fit' : 'fill';
  function fit() {
    let s = Math.max(1, Math.floor(Math.min(innerWidth / E.W, innerHeight / E.H)));
    if (scaleMode === 'fill') {
      s = Math.max(innerWidth / E.W, innerHeight / E.H);
      if (Math.abs(s - Math.round(s)) < 0.1) s = Math.round(s);          // a whole number when it is nearly one: crisp pixels
    }
    canvas.style.width = E.W * s + 'px';
    canvas.style.height = E.H * s + 'px';
    layoutGuides();
  }
  function debugBoxes() {
    if (!/debug=1/.test(q)) return;
    const L = global.Scene.LAYOUT;
    const r = canvas.getBoundingClientRect(), s = r.width / E.W;
    for (const b of [L.house, L.coop, L.barn, L.pen, ...L.plots, L.garden]) {
      const d = document.createElement('div');
      d.className = 'box';
      d.style.cssText = `left:${b.x * s}px;top:${b.y * s}px;width:${b.w * s}px;height:${b.h * s}px`;
      overlay.appendChild(d);
    }
  }
  addEventListener('keydown', (e) => { if (e.key === 'g' || e.key === 'G') { guides = !guides; layoutGuides(); } });
  addEventListener('resize', fit);

  /* ---------- what to show: ?people=0&livestock=0&pets=0 in a browser, project properties in Wallpaper Engine ---------- */
  for (const g of ['people', 'livestock', 'pets']) { const v = param(g); if (v !== null) global.Agents.setVisible(g, v !== '0' && v !== 'false'); }
  let timeMode = 'clock', timeSpeed = 0;
  global.wallpaperPropertyListener = {
    applyUserProperties(props) {
      const map = { showpeople: 'people', showlivestock: 'livestock', showpets: 'pets' };
      for (const k of Object.keys(map)) if (props[k]) global.Agents.setVisible(map[k], !!props[k].value);
      if (props.showclouds) global.Ambient.setOption('clouds', props.showclouds.value);
      if (props.showwind) global.Ambient.setOption('wind', props.showwind.value);
      if (props.mouseinteraction) global.Agents.setMouse(props.mouseinteraction.value);
      if (props.scalemode) { scaleMode = props.scalemode.value === 'fit' ? 'fit' : 'fill'; fit(); }
      if (props.fps) FPS = Math.max(10, Math.min(60, +props.fps.value || 30));
      if (props.timemode || props.timespeed) {
        if (props.timemode) timeMode = String(props.timemode.value);
        if (props.timespeed) timeSpeed = +props.timespeed.value || 0;
        lock = PRESET[timeMode] !== undefined ? PRESET[timeMode] : null;
        speed = timeSpeed > 0 ? timeSpeed : 0;
        startMin = lock !== null ? lock : realMinutes();
        t0 = performance.now();
      }
    },
  };

  /* ---------- mouse: animals react (see agents.js) ---------- */
  const toWorld = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * E.W, (e.clientY - r.top) / r.height * E.H]; };
  addEventListener('mousemove', (e) => { const [x, y] = toWorld(e); global.Agents.pointer(x, y, x >= 0 && y >= 0 && x < E.W && y < E.H); });
  addEventListener('mouseleave', () => global.Agents.pointer(-99, -99, false));
  addEventListener('mousedown', (e) => { const [x, y] = toWorld(e); if (x >= 0 && y >= 0 && x < E.W && y < E.H) global.Agents.click(x, y); });

  /* ---------- loop ---------- */
  let last = -1e9, lastClock = '';
  function frame(ts) {
    requestAnimationFrame(frame);
    if (ts - last < 1000 / FPS) return;
    last = ts;
    const min = minutesNow(ts);
    ensureScene(P.isLit(min));
    bankSet = P.banks(P.rgbAt(min), P.lightAt(min));
    E.buf.set(base); E.light.set(baseLight);
    const env = {
      min, fire: min >= 1050 || min < 390, flies: P.firefliesAt(min),
      sleep: min >= 1230 || min < 330, light: P.lightAt(min),
    };
    if (!/static=1/.test(q)) global.Scene.animate(ts / 1000, env);
    present();
    const text = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}${lock !== null ? ' (locked)' : ''}`;
    if (text !== lastClock) { lastClock = text; clockText = text; layoutGuides(); }
  }
  ensureScene(P.isLit(minutesNow(0)));
  fit();
  debugBoxes();
  requestAnimationFrame(frame);

  /* test hook for palette audits */
  global.__audit = function () {
    const seen = new Set();
    for (let i = 0; i < base.length; i++) seen.add(base[i]);
    return { distinct: seen.size, max: Math.max(...seen) };
  };
})(window);
