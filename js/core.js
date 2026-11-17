'use strict';
/* Core: shared state, the document, layers and undo history. */

const App = window.App = {
  W: 0, H: 0,          // document size in device pixels
  unit: 1,             // document pixels per screen pixel (at fit)
  layers: [],          // bottom -> top
  active: null,
  settings: {
    tool: 'pen',
    color: '#1d1d1f',
    size: 6,
    opacity: 1,
    stab: 0.4,
    pressure: true,
    assist: 0.5,
    assistMode: 'always',      // 'always' | 'hold'
    fix: { line: true, ellipse: true, curve: true, shapes: true },
    ghost: true,
    smartHold: true,           // hold the pen still on a line to delete / recolor / fill
    fillStyle: 'solid',        // fills: 'solid' or 'brush' (the look of the current brush)
    shape: 'circle',           // which shape the Shapes tool stamps
    shapeMode: 'outline',      // 'outline' | 'fill' | 'both'
    mirror: false,
    mirrorX: null,             // null = middle of the page
    guideColor: '#6fa8dc'
  },
  _handlers: {}
};

/* ---------- tiny helpers ---------- */
App.util = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  rectAdd(r, x, y, pad) {
    if (!r) return { x0: x - pad, y0: y - pad, x1: x + pad, y1: y + pad };
    r.x0 = Math.min(r.x0, x - pad); r.y0 = Math.min(r.y0, y - pad);
    r.x1 = Math.max(r.x1, x + pad); r.y1 = Math.max(r.y1, y + pad);
    return r;
  },
  rectClamp(r) {
    const x = Math.max(0, Math.floor(r.x0)), y = Math.max(0, Math.floor(r.y0));
    const x1 = Math.min(App.W, Math.ceil(r.x1)), y1 = Math.min(App.H, Math.ceil(r.y1));
    if (x1 <= x || y1 <= y) return null;
    return { x, y, w: x1 - x, h: y1 - y };
  }
};

App.on = function (evt, fn) { (this._handlers[evt] ||= []).push(fn); };
App.emit = function (evt, data) { (this._handlers[evt] || []).forEach(fn => fn(data)); };

/* ---------- document ---------- */
App.initDocument = function () {
  const wrap = document.getElementById('canvasWrap');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(400, wrap.clientWidth - 32);
  const cssH = Math.max(300, wrap.clientHeight - 32);
  // 1.5x more pixels than the screen, so lines stay sharp when you zoom in
  let k = dpr * 1.5;
  k = Math.min(k, 3600 / Math.max(cssW, cssH));
  App.W = Math.round(cssW * k);
  App.H = Math.round(cssH * k);
  App.unit = k;          // document pixels per screen pixel (brush sizes use this)
  App.paper = document.getElementById('paper');

  App.strokeCanvas = App.makeCanvas();          // live stroke preview
  App.strokeCtx = App.strokeCanvas.getContext('2d');
  App.overlay = App.makeCanvas();               // ghosts, hints, cursor
  App.overlay.classList.add('input');
  App.overlayCtx = App.overlay.getContext('2d');
  App.snap = App.makeCanvas();                  // undo snapshot (never shown)
  App.snapCtx = App.snap.getContext('2d');
  App.temp = App.makeCanvas();                  // scratch for rendering strokes
  App.tempCtx = App.temp.getContext('2d');

  App.addLayer('Sketch', { silent: true });
  App.addLayer('Guides', { guide: true, silent: true });
  App.setActive(App.layers[0]);
  App.fitPaper();
  window.addEventListener('resize', App.fitPaper);
};

App.makeCanvas = function () {
  const c = document.createElement('canvas');
  c.width = App.W; c.height = App.H;
  return c;
};

App.fitPaper = function () {
  const wrap = document.getElementById('canvasWrap');
  const s = Math.min((wrap.clientWidth - 24) / App.W, (wrap.clientHeight - 24) / App.H);
  App.paper.style.width = Math.round(App.W * s) + 'px';
  App.paper.style.height = Math.round(App.H * s) + 'px';
  if (App.applyView) App.applyView();
};

/* Start over with a document of a given size (used when opening a project). */
App.resizeDocument = function (W, H, unit) {
  App.W = W; App.H = H; App.unit = unit || App.unit;
  for (const c of [App.strokeCanvas, App.overlay, App.snap, App.temp]) { c.width = W; c.height = H; }
  App.layers = []; App.active = null;
  App.history.undo = []; App.history.redo = []; App.history.bytes = 0;
  App.fitPaper();
  App.emit('history');
};

/* Document pixels per screen pixel right now (changes with zoom). */
App.viewPx = function () {
  const w = App.paper && App.paper.offsetWidth;
  return (w ? App.W / w : App.unit) / ((App.view && App.view.zoom) || 1);
};

/* Screen -> document coordinates */
App.toDoc = function (e) {
  const r = App.overlay.getBoundingClientRect();
  if (!r.width || !r.height) return { x: 0, y: 0 };
  return { x: (e.clientX - r.left) * App.W / r.width, y: (e.clientY - r.top) * App.H / r.height };
};

/* ---------- layers ---------- */
let layerUid = 0;
App.addLayer = function (name, opts = {}) {
  const canvas = App.makeCanvas();
  const L = {
    id: ++layerUid, name: name || 'Layer ' + layerUid, canvas,
    ctx: canvas.getContext('2d'), visible: true, opacity: 1, guide: !!opts.guide, blend: 'normal',
    items: []   // what was drawn (strokes and fills), so a line can be picked later
  };
  let index = opts.index;
  if (index == null) {
    // new normal layers go just above the active one (below guides by default)
    index = App.active ? App.layers.indexOf(App.active) + 1 : App.layers.length;
    if (L.guide) index = App.layers.length;
  }
  App.layers.splice(index, 0, L);
  if (!opts.silent) App.history.push({ type: 'add', layer: L, index });
  App.syncLayers();
  return L;
};

App.deleteLayer = function (L) {
  if (App.layers.length <= 1) return false;
  const index = App.layers.indexOf(L);
  App.layers.splice(index, 1);
  App.history.push({ type: 'del', layer: L, index });
  if (App.active === L) App.active = App.layers[Math.max(0, index - 1)];
  App.syncLayers();
  return true;
};

App.moveLayer = function (L, dir) {
  const from = App.layers.indexOf(L), to = from + dir;
  if (to < 0 || to >= App.layers.length) return;
  App.layers.splice(from, 1); App.layers.splice(to, 0, L);
  App.history.push({ type: 'move', layer: L, from, to });
  App.syncLayers();
};

App.setActive = function (L) {
  if (App.Move && App.Move.hasSelection()) App.Move.commit();
  App.active = L; App.syncLayers();
};

App.guideLayer = function () { return App.layers.find(l => l.guide); };

/* Put the layer canvases into the page in order, with the live stroke
   canvas right above the active layer so it previews in the right place. */
App.syncLayers = function () {
  const p = App.paper;
  if (!p) return;
  while (p.firstChild) p.removeChild(p.firstChild);
  if (App.Ref && App.Ref.traceCanvas()) p.appendChild(App.Ref.traceCanvas());   // photo to trace, under everything
  for (const L of App.layers) {
    L.canvas.style.opacity = L.visible ? L.opacity : 0;
    L.canvas.style.mixBlendMode = L.blend && L.blend !== 'normal' ? L.blend : '';
    p.appendChild(L.canvas);
    if (L === App.active) { App.strokeCanvas.style.mixBlendMode = L.canvas.style.mixBlendMode; p.appendChild(App.strokeCanvas); }
  }
  p.appendChild(App.overlay);
  App.emit('layers');
};

/* Flattened picture: white paper + visible layers. */
App.composite = function (includeGuides, includeRef) {
  const c = App.makeCanvas(), ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  if (includeRef && App.Ref && App.Ref.traceCanvas()) ctx.drawImage(App.Ref.traceCanvas(), 0, 0);
  for (const L of App.layers) {
    if (!L.visible || (L.guide && !includeGuides)) continue;
    ctx.globalAlpha = L.opacity;
    ctx.globalCompositeOperation = L.blend && L.blend !== 'normal' ? L.blend : 'source-over';
    ctx.drawImage(L.canvas, 0, 0);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  return c;
};

/* ---------- undo history ---------- */
App.history = {
  undo: [], redo: [], bytes: 0,
  LIMIT_STEPS: 80, LIMIT_BYTES: 400e6,
  size(e) { return e.before ? e.before.data.length * 2 : 0; },
  push(e) {
    this.undo.push(e); this.bytes += this.size(e);
    this.redo.length = 0;
    while (this.undo.length > this.LIMIT_STEPS || this.bytes > this.LIMIT_BYTES) {
      this.bytes -= this.size(this.undo.shift());
    }
    App.emit('history');
  },
  apply(e, back) {
    if (e.type === 'px') {
      e.layer.ctx.putImageData(back ? e.before : e.after, e.rect.x, e.rect.y);
      if (e.extra) (back ? e.extra.undo : e.extra.redo)();
      App.emit('pixels', e.layer);
    } else if (e.type === 'add' || e.type === 'del') {
      const remove = (e.type === 'add') === back;
      if (remove) {
        App.layers.splice(App.layers.indexOf(e.layer), 1);
        if (App.active === e.layer) App.active = App.layers[Math.max(0, e.index - 1)];
      } else {
        App.layers.splice(e.index, 0, e.layer);
      }
      App.syncLayers();
    } else if (e.type === 'move') {
      const [a, b] = back ? [e.to, e.from] : [e.from, e.to];
      App.layers.splice(a, 1); App.layers.splice(b, 0, e.layer);
      App.syncLayers();
    }
  },
  doUndo() {
    if (App.Move && App.Move.hasSelection()) App.Move.commit();
    const e = this.undo.pop(); if (!e) return;
    this.bytes -= this.size(e);
    this.apply(e, true); this.redo.push(e); App.emit('history');
  },
  doRedo() {
    if (App.Move && App.Move.hasSelection()) App.Move.commit();
    const e = this.redo.pop(); if (!e) return;
    this.apply(e, false); this.undo.push(e); this.bytes += this.size(e); App.emit('history');
  }
};

/* Pixel edits: call beginEdit before changing a layer, endEdit with the
   changed rectangle afterwards. Only that rectangle is stored. */
App.beginEdit = function (layer) {
  if (App.Move && App.Move.hasSelection()) App.Move.commit();   // finish moving first
  App.snapCtx.globalCompositeOperation = 'copy';
  App.snapCtx.drawImage(layer.canvas, 0, 0);
  App.snapCtx.globalCompositeOperation = 'source-over';
  return { layer };
};

/* extra: optional { undo(), redo() } run after the pixels are restored. */
App.endEdit = function (tok, rect, extra) {
  const r = rect && App.util.rectClamp(rect);
  if (!r) return;
  const before = App.snapCtx.getImageData(r.x, r.y, r.w, r.h);
  const after = tok.layer.ctx.getImageData(r.x, r.y, r.w, r.h);
  App.history.push({ type: 'px', layer: tok.layer, rect: r, before, after, extra });
  App.emit('pixels', tok.layer);
};

App.clearLayer = function (L) {
  const tok = App.beginEdit(L), items = L.items;
  L.ctx.clearRect(0, 0, App.W, App.H);
  L.items = [];
  App.endEdit(tok, { x0: 0, y0: 0, x1: App.W, y1: App.H }, { undo: () => { L.items = items; }, redo: () => { L.items = []; } });
};
