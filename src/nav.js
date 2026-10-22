/* Where can things walk? The answer is read off the rendered scene: a cell is blocked if something
   solid stands on it (water, ground-level objects like soil, or the foot of a tall object), then
   obstacles are widened by one cell so bodies don't clip corners. A* finds routes; a line-of-sight pass
   straightens them, so animals and people cut across open ground instead of following the grid. */
(function (global) {
  'use strict';

  const E = global.Engine;
  const CELL = 4;
  const GW = E.W / CELL, GH = E.H / CELL;
  const blocked = new Uint8Array(GW * GH);
  const comp = new Int16Array(GW * GH);
  let mainComp = 0;

  let extra = [];
  function solidAt(x, y) {
    for (const [a, b, c, d] of extra) if (x >= a && y >= b && x <= c && y <= d) return true;
    const i = y * E.W + x, t = E.tag[i];
    if (t === E.TAG.WATER) return true;
    if (t === E.TAG.OBJ) {
      const d = E.depth[i];
      return d === 0 || d - y <= 7;           // ground-level object, or the lowest rows of a tall one
    }
    return false;
  }

  function build() {
    const raw = new Uint8Array(GW * GH);
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
      const x0 = cx * CELL, y0 = cy * CELL;
      let b = x0 < 8 || x0 > E.W - 12 || y0 < 24 || y0 > 368;
      if (!b) for (const [dx, dy] of [[1, 1], [3, 1], [1, 3], [3, 3], [2, 2]]) if (solidAt(x0 + dx, y0 + dy)) { b = true; break; }
      raw[cy * GW + cx] = b ? 1 : 0;
    }
    blocked.fill(0);
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
      if (!raw[cy * GW + cx]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < GW && y < GH) blocked[y * GW + x] = 1;
      }
    }
    // connected components of free cells; walkers only pick targets in the biggest one
    comp.fill(0);
    let id = 0, best = 0, bestSize = 0;
    for (let s = 0; s < GW * GH; s++) {
      if (blocked[s] || comp[s]) continue;
      id++;
      let size = 0;
      const stack = [s]; comp[s] = id;
      while (stack.length) {
        const c = stack.pop(); size++;
        const cx = c % GW, cy = (c - cx) / GW;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          const n = y * GW + x;
          if (!blocked[n] && !comp[n]) { comp[n] = id; stack.push(n); }
        }
      }
      if (size > bestSize) { bestSize = size; best = id; }
    }
    mainComp = best;
  }

  const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)))];
  const centre = (cx, cy) => [cx * CELL + CELL / 2, cy * CELL + CELL / 2];
  const freeCell = (cx, cy) => cx >= 0 && cy >= 0 && cx < GW && cy < GH && !blocked[cy * GW + cx];

  /* nearest free cell in the main component, searched in growing rings */
  function nearestFree(cx, cy, maxR) {
    for (let r = 0; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (freeCell(x, y) && comp[y * GW + x] === mainComp) return [x, y];
      }
    }
    return null;
  }

  function lineClear(ax, ay, bx, by) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
      const [cx, cy] = cellOf(x, y);
      if (!freeCell(cx, cy)) return false;
    }
    return true;
  }

  function astar(sx, sy, tx, ty) {
    const start = sy * GW + sx, goal = ty * GW + tx;
    const g = new Float32Array(GW * GH).fill(1e9), from = new Int32Array(GW * GH).fill(-1);
    const open = [[0, start]];       // [f, index], kept as a binary heap
    const push = (item) => { open.push(item); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
    const pop = () => {
      const top = open[0], last = open.pop();
      if (open.length) { open[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } }
      return top;
    };
    g[start] = 0;
    const h = (c) => { const x = c % GW, y = (c - x) / GW; const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
    while (open.length) {
      const [, c] = pop();
      if (c === goal) break;
      const cx = c % GW, cy = (c - cx) / GW;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cx + dx, y = cy + dy;
        if (!freeCell(x, y)) continue;
        if (dx && dy && (!freeCell(cx + dx, cy) || !freeCell(cx, cy + dy))) continue;    // no squeezing past corners
        const n = y * GW + x, ng = g[c] + (dx && dy ? 1.414 : 1);
        if (ng < g[n]) { g[n] = ng; from[n] = c; push([ng + h(n), n]); }
      }
    }
    if (from[goal] < 0 && goal !== start) return null;
    const cells = [];
    for (let c = goal; c !== -1; c = from[c]) { cells.push(c); if (c === start) break; }
    return cells.reverse().map((c) => centre(c % GW, Math.floor(c / GW)));
  }

  /* route from a pixel position to a pixel position; the exact end point is appended so a walker steps onto
     its seat or door even though that spot may sit inside a blocked cell */
  function path(x0, y0, x1, y1) {
    const a = nearestFree(...cellOf(x0, y0), 8), b = nearestFree(...cellOf(x1, y1), 10);
    if (!a || !b) return null;
    const cells = astar(a[0], a[1], b[0], b[1]);
    if (!cells) return null;
    const pts = [[x0, y0], ...cells, [x1, y1]];
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {                  // keep the furthest point still in line of sight
      let j = pts.length - 1;
      while (j > i + 1 && !lineClear(pts[i][0], pts[i][1], pts[j][0], pts[j][1])) j--;
      out.push(pts[j]); i = j;
    }
    return out;
  }

  /* a random reachable spot within `radius` pixels (or anywhere when radius is large) */
  function randomPoint(rng, x, y, radius) {
    for (let k = 0; k < 40; k++) {
      const a = rng() * 6.283, r = Math.sqrt(rng()) * radius;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.8;
      const [cx, cy] = cellOf(px, py);
      if (freeCell(cx, cy) && comp[cy * GW + cx] === mainComp) return centre(cx, cy);
    }
    return null;
  }

  global.Nav = { setBlocks: (r) => { extra = r; }, build, path, randomPoint, free: (x, y) => { const [cx, cy] = cellOf(x, y); return freeCell(cx, cy); }, CELL };
})(window);
