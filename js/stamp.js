'use strict';
/* Shapes tool: drag on the page to stamp a line, circle, oval, square, rectangle,
   triangle, star or arrow. The border is drawn with your current brush, the inside
   with the current color (solid, like the brush, or fading). Shapes stay editable:
   hold to recolor or delete, Move to move or resize. */

(function () {
  const $ = id => document.getElementById(id);
  const st = App.settings;
  const SH = App.Stamp = {};
  const SQUARE = { circle: 1, square: 1, star: 1 };   // these keep equal width and height

  /* Corners of the shape (or an ellipse) for a drag from a to b. */
  function geometry(kind, a, b) {
    let dx = b.x - a.x, dy = b.y - a.y;
    if (kind === 'line' || kind === 'arrow') {
      const L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
      if (Math.abs(ang - snap) < 0.07) { dx = Math.cos(snap) * L; dy = Math.sin(snap) * L; }   // clicks to level / upright / 45°
      const e = { x: a.x + dx, y: a.y + dy };
      if (kind === 'line') return { poly: [a, e], closed: false };
      const ux = dx / (L || 1), uy = dy / (L || 1), nx = -uy, ny = ux;
      const sw = Math.max(L * 0.07, 3 * App.unit), hl = Math.min(L * 0.38, sw * 5), hw = sw * 2.6;
      const P = (t, s) => ({ x: a.x + ux * t + nx * s, y: a.y + uy * t + ny * s });
      return { poly: [P(0, -sw), P(L - hl, -sw), P(L - hl, -hw), P(L, 0), P(L - hl, hw), P(L - hl, sw), P(0, sw)], closed: true };
    }
    if (SQUARE[kind]) { const s = Math.max(Math.abs(dx), Math.abs(dy)); dx = (Math.sign(dx) || 1) * s; dy = (Math.sign(dy) || 1) * s; }
    const x0 = Math.min(a.x, a.x + dx), x1 = Math.max(a.x, a.x + dx), y0 = Math.min(a.y, a.y + dy), y1 = Math.max(a.y, a.y + dy);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
    if (kind === 'circle' || kind === 'oval') return { ellipse: { cx, cy, rx, ry }, closed: true };
    if (kind === 'square' || kind === 'rect') return { poly: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], closed: true };
    if (kind === 'triangle') return { poly: [{ x: cx, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], closed: true };
    const star = [];   // 5-point star
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 0.4 : 1, t = -Math.PI / 2 + k * Math.PI / 5;
      star.push({ x: cx + Math.cos(t) * rx * r, y: cy + 0.05 * ry + Math.sin(t) * ry * r });
    }
    return { poly: star, closed: true };
  }

  /* The border as evenly spaced points, ready for any brush. */
  function outline(g) {
    const pts = [], gap = 3 * App.unit, P = 0.8;
    if (g.ellipse) {
      const { cx, cy, rx, ry } = g.ellipse, n = Math.max(48, Math.round(2 * Math.PI * Math.max(rx, ry) / gap));
      for (let i = 0; i <= n; i++) { const t = i / n * Math.PI * 2; pts.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry, p: P }); }
      return pts;
    }
    const V = g.closed ? [...g.poly, g.poly[0]] : g.poly;
    for (let k = 0; k < V.length - 1; k++) {
      const a = V[k], b = V[k + 1], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / gap));
      for (let i = 0; i < n; i++) pts.push({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n, p: P });
    }
    pts.push({ ...V[V.length - 1], p: P });
    return pts;
  }

  /* The inside, as its own small canvas (so it can be moved and recolored later). */
  function fillCanvas(pts, color, look, tap) {
    let r = null;
    for (const p of pts) r = App.util.rectAdd(r, p.x, p.y, 1);
    const x = Math.floor(r.x0), y = Math.floor(r.y0), w = Math.max(1, Math.ceil(r.x1) - x), h = Math.max(1, Math.ceil(r.y1) - y);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x - x, p.y - y) : ctx.moveTo(p.x - x, p.y - y)));
    ctx.closePath(); ctx.fill();
    if (look.brush) App.texturize(c, x, y, look.brush);
    if (look.fade) App.fadeFill(c, x, y, tap);
    return { canvas: c, x, y, rect: { x0: x, y0: y, x1: x + w, y1: y + h } };
  }

  function opts(layer) {
    return { brush: App.lastPaintTool(), color: layer.guide ? st.guideColor : st.color,
             size: st.size * App.unit, opacity: st.opacity, pressure: true };
  }
  const wantsFill = g => g.closed && st.shapeMode !== 'outline';
  const wantsLine = g => !g.closed || st.shapeMode !== 'fill';

  function preview(a, b) {
    const c = App.strokeCtx, layer = App.active;
    c.clearRect(0, 0, App.W, App.H);
    const g = geometry(st.shape, a, b), pts = outline(g), o = opts(layer);
    App.strokeCanvas.style.opacity = layer.opacity;
    if (wantsFill(g)) {
      const look = App.fillLook('fill'), f = fillCanvas(pts, o.color, look, a);
      c.save(); c.globalAlpha = look.opacity; c.drawImage(f.canvas, f.x, f.y); c.restore();
    }
    if (wantsLine(g)) {
      App.tempCtx.clearRect(0, 0, App.W, App.H);
      App.drawStrokes(App.tempCtx, [pts], o);
      c.save(); c.globalAlpha = o.opacity * App.brushes[o.brush].alpha; c.drawImage(App.temp, 0, 0); c.restore();
    }
  }

  function commit(a, b) {
    App.strokeCtx.clearRect(0, 0, App.W, App.H);
    const layer = App.active, g = geometry(st.shape, a, b), pts = outline(g);
    let r = null;
    for (const p of pts) r = App.util.rectAdd(r, p.x, p.y, 0);
    if (!r || Math.hypot(r.x1 - r.x0, r.y1 - r.y0) < 6 * App.viewPx()) { App.toast('Drag on the page to draw the shape'); return; }
    const o = opts(layer), items = [], tok = App.beginEdit(layer);
    let rect = null;
    if (wantsFill(g)) {
      const look = App.fillLook('fill'), f = fillCanvas(pts, o.color, look, a);
      App.paintFill(layer, f.canvas, f.x, f.y, look.opacity);
      items.push(App.Items.addFill(layer, f, look.opacity));
      rect = f.rect;
    }
    if (wantsLine(g)) {
      const sr = App.commitStroke(layer, [pts], o);
      items.push(App.Items.addStroke(layer, [pts], o, sr));
      rect = rect ? { x0: Math.min(rect.x0, sr.x0), y0: Math.min(rect.y0, sr.y0), x1: Math.max(rect.x1, sr.x1), y1: Math.max(rect.y1, sr.y1) } : sr;
    }
    App.endEdit(tok, rect, { undo: () => items.forEach(i => { i.alive = false; }), redo: () => items.forEach(i => { i.alive = true; }) });
    App.emit('stroke', { res: null, layer, applied: false, final: pts, shape: st.shape });
  }

  /* Called by input.js when the pen goes down. */
  SH.press = function (raw) {
    if (st.tool !== 'shape') return null;
    if (!App.active.visible) { App.toast('This layer is hidden'); return { move() {}, up() {} }; }
    const a = { x: raw.x, y: raw.y };
    let b = a;
    return { move(p) { b = p; preview(a, b); }, up(p) { commit(a, p || b); } };
  };

  function refresh() {
    document.querySelectorAll('.shape-btn').forEach(x => x.classList.toggle('on', st.tool === 'shape' && x.dataset.shape === st.shape));
    document.querySelectorAll('#shapeMode button').forEach(x => x.classList.toggle('on', x.dataset.mode === st.shapeMode));
    document.querySelectorAll('#fillStyle button').forEach(x => x.classList.toggle('on', x.dataset.style === st.fillStyle));
  }

  SH.init = function () {
    const setTool = App.setTool;
    App.setTool = t => { setTool(t); refresh(); };
    document.querySelectorAll('.shape-btn').forEach(x => x.onclick = () => {
      st.shape = x.dataset.shape; App.setTool('shape');
      App.setHint(`<b>Shapes</b> · drag on the page · the border uses your <b>${App.brushes[App.lastPaintTool()].name}</b>`);
    });
    document.querySelectorAll('#shapeMode button').forEach(x => x.onclick = () => { st.shapeMode = x.dataset.mode; refresh(); });
    document.querySelectorAll('#fillStyle button').forEach(x => x.onclick = () => {
      st.fillStyle = x.dataset.style; refresh();
      App.toast({ solid: 'Fills are one flat color', brush: 'Fills look like your current brush', fade: 'Fills fade out: strongest where you tap' }[st.fillStyle]);
    });
    refresh();
  };
})();
