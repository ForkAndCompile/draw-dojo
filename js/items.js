'use strict';
/* Every stroke and fill is remembered on its layer, so one can be picked later:
   hold the eraser on a line to delete it, hold a pen on a line to recolor it,
   hold a pen on an empty area (or tap with Fill) to fill it. */

(function () {
  const I = App.Items = {};
  let M, Mctx, R, Rctx;   // mask and replay canvases (made on first use)
  const canvases = () => {
    if (!M || M.width !== App.W || M.height !== App.H) {
      M = App.makeCanvas(); Mctx = M.getContext('2d'); R = App.makeCanvas(); Rctx = R.getContext('2d');
    }
  };
  const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

  /* ---------- recording ---------- */
  I.addStroke = function (layer, strokes, o, rect) {
    const it = { kind: 'stroke', strokes, o: { ...o }, rect, alive: true };
    layer.items.push(it);
    return it;
  };
  I.addFill = function (layer, fill, opacity) {
    const it = { kind: 'fill', canvas: fill.canvas, x: fill.x, y: fill.y, opacity, rect: fill.rect, alive: true };
    layer.items.push(it);
    return it;
  };
  I.addErase = function (layer, strokes, o, rect) {
    const it = { kind: 'erase', strokes, o: { ...o }, rect, alive: true };
    layer.items.push(it);
    return it;
  };
  I.undoable = it => ({ undo: () => { it.alive = false; }, redo: () => { it.alive = true; } });
  I.pickable = it => it.alive && !it.hidden && it.kind !== 'erase';

  /* ---------- picking ---------- */
  function segDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? App.util.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1) : 0;
    return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
  }
  const reach = it => it.o.size * (it.o.brush === 'airbrush' ? 1.2 : 0.5);

  /* The line under (x, y), else the fill under it, else null. */
  I.hit = function (layer, x, y, extraTol = 6) {
    const p = { x, y };
    let best = null, bestD = Infinity;
    for (let k = layer.items.length - 1; k >= 0; k--) {
      const it = layer.items[k];
      if (!I.pickable(it) || it.kind !== 'stroke') continue;
      const tol = reach(it) + extraTol * App.viewPx();
      if (x < it.rect.x0 - tol || x > it.rect.x1 + tol || y < it.rect.y0 - tol || y > it.rect.y1 + tol) continue;
      for (const pts of it.strokes) {
        for (let i = 0; i < pts.length; i++) {
          const d = segDist(p, pts[i], pts[Math.min(i + 1, pts.length - 1)]);
          if (d < tol && d < bestD) { best = it; bestD = d; }
        }
      }
    }
    if (best) return best;
    for (let k = layer.items.length - 1; k >= 0; k--) {
      const it = layer.items[k];
      if (!I.pickable(it) || it.kind !== 'fill') continue;
      const fx = Math.floor(x - it.x), fy = Math.floor(y - it.y);
      if (fx < 0 || fy < 0 || fx >= it.canvas.width || fy >= it.canvas.height) continue;
      if (it.canvas.getContext('2d').getImageData(fx, fy, 1, 1).data[3] > 0) return it;
    }
    return null;
  };

  /* ---------- redrawing an area ---------- */
  /* Draw the area covered by some items into the mask canvas. */
  function drawMasks(items) {
    Mctx.clearRect(0, 0, App.W, App.H);
    let rect = null;
    for (const it of items) {
      if (it.kind === 'fill') {
        Mctx.drawImage(it.canvas, it.x, it.y);
        rect = App.util.rectAdd(rect, it.rect.x0, it.rect.y0, 0); rect = App.util.rectAdd(rect, it.rect.x1, it.rect.y1, 0);
        continue;
      }
      const w = reach(it) * 2 + 4 * App.unit;
      Mctx.save();
      Mctx.strokeStyle = '#000'; Mctx.lineWidth = w; Mctx.lineCap = Mctx.lineJoin = 'round';
      for (const pts of it.strokes) {
        Mctx.beginPath(); Mctx.moveTo(pts[0].x, pts[0].y);
        for (const q of pts) { Mctx.lineTo(q.x, q.y); rect = App.util.rectAdd(rect, q.x, q.y, w); }
        if (pts.length === 1) Mctx.lineTo(pts[0].x + 0.01, pts[0].y);
        Mctx.stroke();
      }
      Mctx.restore();
    }
    return rect;
  }

  /* Draw one remembered item exactly as it was first drawn. */
  function renderItem(ctx, it) {
    if (it.kind === 'fill') {
      ctx.save(); ctx.globalCompositeOperation = 'destination-over'; ctx.globalAlpha = it.opacity;
      ctx.drawImage(it.canvas, it.x, it.y); ctx.restore();
      return;
    }
    if (it.kind === 'erase') {
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = it.o.opacity; ctx.lineCap = 'round';
      for (const pts of it.strokes) {
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[i];
          ctx.lineWidth = App.strokeWidth('eraser', it.o.size, it.o.pressure, b.p);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }
    App.tempCtx.clearRect(0, 0, App.W, App.H);
    App.drawStrokes(App.tempCtx, it.strokes, it.o);
    ctx.save(); ctx.globalAlpha = it.o.opacity * App.brushes[it.o.brush].alpha;
    ctx.drawImage(App.temp, 0, 0); ctx.restore();
  }
  I.renderItem = renderItem;

  /* Wipe the area under maskItems, run between(), then redraw everything still
     there inside that area, in the original order (so crossing lines stay whole).
     No undo step: callers wrap it in beginEdit / endEdit. Returns the area. */
  I.wipeReplay = function (layer, maskItems, between) {
    canvases();
    const rect = drawMasks(maskItems);
    if (!rect) { if (between) between(); return null; }
    const c = layer.ctx;
    c.save(); c.globalCompositeOperation = 'destination-out'; c.drawImage(M, 0, 0); c.restore();
    if (between) between();
    Rctx.clearRect(0, 0, App.W, App.H);
    for (const other of layer.items) if (other.alive && !other.hidden && overlap(other.rect, rect)) renderItem(Rctx, other);
    Rctx.save(); Rctx.globalCompositeOperation = 'destination-in'; Rctx.drawImage(M, 0, 0); Rctx.restore();
    c.drawImage(R, 0, 0);
    return rect;
  };

  /* Change one item and redraw its area. Undoable. */
  function rework(layer, it, apply, revert) {
    const tok = App.beginEdit(layer);
    const rect = I.wipeReplay(layer, [it], apply);
    App.endEdit(tok, rect, { undo: revert, redo: apply });
  }

  I.remove = (layer, it) => rework(layer, it, () => { it.alive = false; }, () => { it.alive = true; });

  I.recolor = function (layer, it, color) {
    if (it.kind === 'stroke') {
      const old = it.o.color;
      rework(layer, it, () => { it.o.color = color; }, () => { it.o.color = old; });
    } else {
      const old = it.canvas, tinted = document.createElement('canvas');
      tinted.width = old.width; tinted.height = old.height;
      const t = tinted.getContext('2d');
      t.drawImage(old, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = color; t.fillRect(0, 0, old.width, old.height);
      rework(layer, it, () => { it.canvas = tinted; }, () => { it.canvas = old; });
    }
  };

  /* Fill an area with the bucket and remember it. */
  I.fillAt = function (layer, x, y, color, opacity, look) {
    const tok = App.beginEdit(layer);
    const f = App.floodFill(layer, x, y, color, opacity, look);
    if (!f) return null;
    const it = I.addFill(layer, f, opacity);
    App.endEdit(tok, f.rect, I.undoable(it));
    return it;
  };

  /* ---------- the "hold" and "tap with Fill" actions ---------- */
  I.flash = null;   // { it, t0 } — drawn by the overlay for a moment
  const colorOf = it => (it.kind === 'stroke' ? it.o.color : null);

  I.holdAction = function (tool, layer, x, y) {
    const color = layer.guide ? App.settings.guideColor : App.settings.color;
    if (tool === 'eraser') {
      const it = I.hit(layer, x, y);
      if (!it) { App.toast('Nothing to delete here. Hold right on a line.'); return; }
      I.remove(layer, it);
      I.flash = { it, t0: performance.now(), del: true };
      App.toast(it.kind === 'fill' ? 'Fill deleted (Ctrl+Z to undo)' : 'Line deleted (Ctrl+Z to undo)');
      return;
    }
    const it = I.hit(layer, x, y, tool === 'fill' ? 2 : 6);
    if (it && it.kind === 'stroke') {
      if (colorOf(it) === color) { App.toast('That line is already this color'); return; }
      I.recolor(layer, it, color);
      I.flash = { it, t0: performance.now() };
      App.toast('Line recolored (Ctrl+Z to undo)');
      return;
    }
    if (it && it.kind === 'fill') {
      I.recolor(layer, it, color);
      App.toast('Fill recolored (Ctrl+Z to undo)');
      return;
    }
    const look = App.fillLook(tool);   // solid, or the look of the current brush
    if (I.fillAt(layer, x, y, color, look.opacity, look) && tool !== 'fill') {
      App.toast(look.brush ? `Area filled with ${App.brushes[look.brush].name} (Ctrl+Z to undo)` : look.fade ? 'Area filled with a fade (Ctrl+Z to undo)' : 'Area filled (Ctrl+Z to undo)');
    }
  };

  I.drawFlash = function (ctx, now) {
    const f = I.flash;
    if (!f) return false;
    const age = now - f.t0;
    if (age > 700 || f.it.kind !== 'stroke') { I.flash = null; return false; }
    const a = 0.8 * (1 - age / 700);
    ctx.save();
    ctx.strokeStyle = f.del ? `rgba(235,70,90,${a})` : `rgba(91,157,255,${a})`;
    ctx.lineWidth = reach(f.it) * 2 + 8 * App.viewPx(); ctx.lineCap = ctx.lineJoin = 'round';
    for (const pts of f.it.strokes) {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (const q of pts) ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    ctx.restore();
    return true;
  };
})();
