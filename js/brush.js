'use strict';
/* Brushes: stabilizer, stroke rendering, eraser, blur, smudge, fill, eyedropper. */

/* kind: line (solid ink), pencil (grainy dabs), stamp (soft airbrush), erase.
   minW: width at zero pressure (fraction of size). gamma: pressure curve.
   dab: how dark each pencil dab is. grain: paper texture for pencils. */
App.brushes = {
  pen:        { name: 'Ink pen',     kind: 'line',   minW: 0.15, alpha: 1, size: 6 },
  fineliner:  { name: 'Fine liner',  kind: 'line',   minW: 0.85, alpha: 1, size: 3 },
  brushpen:   { name: 'Brush pen',   kind: 'line',   minW: 0.03, gamma: 1.6, taper: true, alpha: 1, size: 12 },
  pencil:     { name: 'Pencil HB',   kind: 'pencil', minW: 0.5, dab: 0.22, grain: 'fine', alpha: 0.9, size: 4 },
  softpencil: { name: 'Soft pencil', kind: 'pencil', minW: 0.35, dab: 0.35, grain: 'coarse', alpha: 1, size: 9 },
  marker:     { name: 'Marker',      kind: 'line',   constW: true, alpha: 0.65, size: 18 },
  airbrush:   { name: 'Airbrush',    kind: 'stamp',  alpha: 1, size: 40 },
  eraser:     { name: 'Eraser',      kind: 'erase',  minW: 0.4, size: 24 }
};

App.isPaintTool = t => !!App.brushes[t] && App.brushes[t].kind !== 'erase';

/* ---------- stabilizer ----------
   Exponential smoothing: the drawn point follows the pen like it is on a
   short elastic string. strength 0 = raw, 0.95 = very smooth (and laggy). */
App.Stabilizer = class {
  constructor(strength) { this.k = 1 - App.util.clamp(strength, 0, 0.95); this.s = null; }
  push(p) {
    if (!this.s) { this.s = { ...p }; return { ...p }; }
    const k = this.k, s = this.s;
    s.x += (p.x - s.x) * k; s.y += (p.y - s.y) * k;
    s.p += (p.p - s.p) * Math.min(1, k * 1.5);
    s.t = p.t;
    return { x: s.x, y: s.y, p: s.p, t: s.t };
  }
  /* Points that pull the line the rest of the way to where the pen lifted. */
  catchUp(p) {
    const out = [];
    if (!this.s) return out;
    const d = Math.hypot(p.x - this.s.x, p.y - this.s.y);
    const n = Math.min(30, Math.ceil(d / 3));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      out.push({ x: this.s.x + (p.x - this.s.x) * t, y: this.s.y + (p.y - this.s.y) * t, p: this.s.p, t: p.t });
    }
    return out;
  }
};

/* ---------- textures & sprites ---------- */
const texCache = {}, spriteCache = {}, dotCache = {};
/* Paper grain: an alpha mask. Pencil only sticks to the "high" bits of the paper. */
function grainTexture(kind) {
  if (texCache[kind]) return texCache[kind];
  const N = 128, cell = kind === 'coarse' ? 2 : 1;
  const small = document.createElement('canvas'); small.width = small.height = N / cell;
  const sx = small.getContext('2d'), img = sx.createImageData(N / cell, N / cell), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = Math.random();
    const a = kind === 'coarse' ? Math.pow(n, 0.55) : 0.15 + 0.85 * Math.pow(n, 0.8);
    d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = Math.round(255 * a);
  }
  sx.putImageData(img, 0, 0);
  const c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true;
  x.drawImage(small, 0, 0, N, N);
  return (texCache[kind] = c);
}
App.grainTexture = kind => grainTexture(kind);
function hardDot(color) {
  if (dotCache[color]) return dotCache[color];
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'), { r, g, b } = hexToRgb(color);
  const grd = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, color); grd.addColorStop(0.75, color); grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grd; x.fillRect(0, 0, 32, 32);
  return (dotCache[color] = c);
}
function softSprite(color) {
  if (spriteCache[color]) return spriteCache[color];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  // gradient to transparent of the same color (avoids a dark fringe)
  const rgb = hexToRgb(color);
  g.addColorStop(0, color);
  g.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`);
  g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (spriteCache[color] = c);
}
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
App.hexToRgb = hexToRgb;

/* ---------- stroke rendering ----------
   Draws a whole stroke at full strength. Opacity is applied when the
   stroke is composited onto the layer, so overlaps don't get darker. */
App.strokeWidth = function (brush, size, usePressure, p) {
  const B = App.brushes[brush];
  if (B.constW || !usePressure) return size;
  return size * (B.minW + (1 - B.minW) * Math.pow(p, B.gamma || 1));
};

/* Draw strokes at full strength into a canvas that holds only these strokes
   (the live preview canvas or the scratch canvas). */
App.drawStrokes = function (ctx, strokes, o) {
  const B = App.brushes[o.brush];
  for (const pts of strokes) {
    if (!pts.length) continue;
    if (B.kind === 'stamp') drawStamps(ctx, pts, o);
    else if (B.kind === 'pencil') drawPencil(ctx, pts, o, B);
    else drawInk(ctx, pts, o, B);
  }
  if (B.kind === 'pencil') {   // press the graphite into the paper grain
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = ctx.createPattern(grainTexture(B.grain), 'repeat');
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
};
App.drawStroke = (ctx, pts, o) => App.drawStrokes(ctx, [pts], o);

/* 0..1 along the stroke: thin at both ends, full in the middle. */
function taperFactors(pts, size) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[cum.length - 1], T = Math.min(size * 3, L / 3);
  return cum.map(c => { const t = T ? Math.min(1, Math.min(c, L - c) / T) : 1; return 0.15 + 0.85 * t * (2 - t); });
}

function drawPencil(ctx, pts, o, B) {
  const dot = hardDot(o.color);
  ctx.save();
  const stamp = (x, y, p) => {
    const pp = o.pressure ? p : 0.7;
    const w = Math.max(1, o.size * (B.minW + (1 - B.minW) * pp));
    ctx.globalAlpha = Math.min(1, B.dab * (0.3 + 0.9 * pp));
    ctx.drawImage(dot, x - w / 2, y - w / 2, w, w);
  };
  const step = Math.max(0.5, o.size * 0.15);
  stamp(pts[0].x, pts[0].y, pts[0].p);
  let carry = step;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.y - a.y);
    let t = carry;
    while (t <= len) {
      const f = t / len;
      stamp(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.p + (b.p - a.p) * f);
      t += step;
    }
    carry = t - len;
  }
  ctx.restore();
}

function drawInk(ctx, pts, o, B) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = o.color; ctx.fillStyle = o.color;
  const taper = B.taper ? taperFactors(pts, o.size) : null;
  const W = i => App.strokeWidth(o.brush, o.size, o.pressure, pts[i].p) * (taper ? taper[i] : 1);
  const n = pts.length;
  if (n === 1) {
    ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, W(0) / 2, 0, Math.PI * 2); ctx.fill();
  } else if (B.constW) {
    // constant width: one path, so joints are clean
    ctx.lineWidth = o.size;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n - 1; i++) {
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
    ctx.stroke();
  } else {
    let mx = pts[0].x, my = pts[0].y;
    for (let i = 1; i < n; i++) {
      const last = i === n - 1;
      const ex = last ? pts[i].x : (pts[i].x + pts[i + 1].x) / 2;
      const ey = last ? pts[i].y : (pts[i].y + pts[i + 1].y) / 2;
      ctx.lineWidth = Math.max(0.5, W(i));
      ctx.beginPath(); ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, ex, ey);
      ctx.stroke();
      mx = ex; my = ey;
    }
  }
  ctx.restore();
};

function drawStamps(ctx, pts, o) {
  const sprite = softSprite(o.color);
  ctx.save();
  let carry = 0;
  const stamp = (x, y, p) => {
    const r = o.size * (o.pressure ? 0.5 + 0.7 * p : 1);
    ctx.globalAlpha = 0.1 * (o.pressure ? 0.3 + 0.7 * p : 1);
    ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  };
  if (pts.length === 1) stamp(pts[0].x, pts[0].y, pts[0].p);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const step = Math.max(1, o.size * 0.15);
    let t = carry;
    while (t <= len) {
      const f = len ? t / len : 0;
      stamp(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.p + (b.p - a.p) * f);
      t += step;
    }
    carry = t - len;
  }
  ctx.restore();
}

/* Composite a finished stroke onto a layer. Returns the changed rectangle. */
App.commitStroke = function (layer, strokes, o) {
  const t = App.tempCtx;
  t.clearRect(0, 0, App.W, App.H);
  App.drawStrokes(t, strokes, o);
  let rect = null;
  const pad = o.size * 1.3 + 4;
  for (const pts of strokes) for (const p of pts) rect = App.util.rectAdd(rect, p.x, p.y, pad);
  layer.ctx.save();
  layer.ctx.globalAlpha = o.opacity * App.brushes[o.brush].alpha;
  layer.ctx.drawImage(App.temp, 0, 0);
  layer.ctx.restore();
  return rect;
};

/* ---------- live tools that change the layer while you drag ---------- */
App.eraseSegment = function (ctx, a, b, w, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round'; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.restore();
};

const fx = document.createElement('canvas');
const fxCtx = fx.getContext('2d');
function fxSize(s) { if (fx.width < s || fx.height < s) { fx.width = fx.height = Math.ceil(s); } }

App.blurStamp = function (layer, x, y, r, strength) {
  const b = Math.max(1, r * 0.22 * strength + 0.5);
  const pad = Math.ceil(b * 3), s = Math.ceil(r * 2 + pad * 2);
  fxSize(s);
  const sx = Math.round(x - r - pad), sy = Math.round(y - r - pad);
  fxCtx.clearRect(0, 0, fx.width, fx.height);
  fxCtx.filter = `blur(${b}px)`;
  fxCtx.drawImage(layer.canvas, sx, sy, s, s, 0, 0, s, s);
  fxCtx.filter = 'none';
  const c = layer.ctx;
  c.save();
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  c.clearRect(sx, sy, s, s);
  c.drawImage(fx, 0, 0, s, s, sx, sy, s, s);
  c.restore();
};

App.Smudger = class {
  constructor(layer, p, r) {
    this.layer = layer; this.r = Math.max(2, r);
    this.buf = document.createElement('canvas');
    this.buf.width = this.buf.height = Math.ceil(this.r * 2);
    this.bctx = this.buf.getContext('2d');
    this.pick(p);
  }
  pick(p) {
    const r = this.r;
    this.bctx.globalCompositeOperation = 'copy';
    this.bctx.drawImage(this.layer.canvas, p.x - r, p.y - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
    this.bctx.globalCompositeOperation = 'source-over';
  }
  stamp(p, strength) {
    const r = this.r, c = this.layer.ctx;
    c.save();
    c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.clip();
    c.globalAlpha = strength;
    c.drawImage(this.buf, p.x - r, p.y - r);
    c.restore();
    this.pick(p);
  }
};

/* Walk from a to b in small steps, calling fn at each stamp position. */
App.walk = function (a, b, step, fn) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(len / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    fn({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t });
  }
};

/* ---------- eyedropper ---------- */
App.pickColor = function (x, y) {
  const c = App.composite(false, true).getContext('2d');   // you can pick colors from the reference photo too
  const d = c.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
};
