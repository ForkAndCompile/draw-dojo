'use strict';
/* Pen input and the stroke pipeline:
   pen -> stabilizer -> live preview -> (lift) recognize -> correct -> layer. */

(function () {
  const st = App.settings, U = App.util;
  let drawing = false, tool = null, layer = null, tok = null, rect = null;
  let pts = [], stab = null, prev = null, prevM = null;
  let smudger = null, smudgerM = null;
  let holdAnchor = null, heldAt = null, holdTimer = 0, held = false, heldRes = null;
  let smart = null, smartTimer = 0, consumed = false;
  let ctl = null;   // a controller that took over the current press ({ move, up })
  const SMART_MS = 650;
  let previewDirty = false, overlayDirty = true;
  let cursor = null;
  const ghost = { res: null, t0: 0 };

  App.requestOverlay = () => { overlayDirty = true; };
  App.mirrorAxis = () => (st.mirrorX == null ? App.W / 2 : st.mirrorX);
  const mirror = p => ({ x: 2 * App.mirrorAxis() - p.x, y: p.y, p: p.p });

  function pressureOf(e) {
    if (e.pointerType === 'pen') return U.clamp(e.pressure || 0, 0, 1);
    return 1;
  }
  function brushOpts(t) {
    return {
      brush: t,
      color: layer && layer.guide ? st.guideColor : st.color,
      size: st.size * App.unit,
      opacity: st.opacity,
      pressure: st.pressure
    };
  }

  /* ---------- pointer events ---------- */
  function down(e) {
    if (drawing || ctl || (e.button !== 0 && e.button !== 5)) return;
    const raw = { ...App.toDoc(e), p: pressureOf(e), t: e.timeStamp };
    // other parts can take over a press: moving the reference photo, the Move tool
    ctl = (App.Ref && App.Ref.press(raw)) || (App.Move && App.Move.press(raw, e)) || (App.Stamp && App.Stamp.press(raw)) || null;
    if (ctl) { try { App.overlay.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } overlayDirty = true; return; }
    if (App.Move) App.Move.commit();   // drawing with another tool finishes a selection
    if (st.tool === 'picker') { App.setColor(App.pickColor(raw.x, raw.y)); return; }
    layer = App.active;
    if (!layer.visible) { App.toast('This layer is hidden. Click the eye in Layers to show it.'); return; }
    if (st.tool === 'fill') { App.Items.holdAction('fill', layer, raw.x, raw.y); return; }
    tool = e.button === 5 ? 'eraser' : st.tool;   // pen's eraser end
    try { App.overlay.setPointerCapture(e.pointerId); } catch (err) { /* not capturable; still works */ }
    drawing = true; held = false; heldRes = null;
    stab = new App.Stabilizer(App.isPaintTool(tool) ? st.stab : st.stab * 0.5);
    const p = stab.push(raw);
    pts = [p]; prev = p; prevM = mirror(p); rect = null;
    tok = App.beginEdit(layer);
    holdAnchor = raw; armHold();
    // press-and-hold without moving = pick the line under the pen
    if (st.smartHold && (App.isPaintTool(tool) || tool === 'eraser')) {
      smart = { at: raw, t0: performance.now() };
      clearTimeout(smartTimer); smartTimer = setTimeout(onSmartHold, SMART_MS);
    }
    if (tool === 'smudge') {
      smudger = new App.Smudger(layer, p, st.size * App.unit / 2);
      if (st.mirror) smudgerM = new App.Smudger(layer, prevM, st.size * App.unit / 2);
    }
    liveTool(p, p, prevM, prevM);
    previewDirty = true;
    App.emit('strokeStart');
  }

  function move(e) {
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    const last = evs[evs.length - 1];
    cursor = App.toDoc(last); cursor.p = pressureOf(last);
    overlayDirty = true;
    App.emit('pressure', drawing ? cursor.p : 0);
    if (ctl) { ctl.move(cursor, e); return; }
    if (!drawing) return;
    for (const ev of evs) {
      const raw = { ...App.toDoc(ev), p: pressureOf(ev), t: ev.timeStamp };
      addPoint(raw);
    }
  }

  function onSmartHold() {
    if (!drawing || !smart) return;
    const at = smart.at;
    smart = null;
    if (tool === 'eraser') {   // undo the dot the eraser made when it touched down
      layer.ctx.save(); layer.ctx.globalCompositeOperation = 'copy';
      layer.ctx.drawImage(App.snap, 0, 0); layer.ctx.restore();
    }
    drawing = false; consumed = true;
    clearTimeout(holdTimer);
    App.strokeCtx.clearRect(0, 0, App.W, App.H);
    App.Items.holdAction(tool, layer, at.x, at.y);
    overlayDirty = true;
  }

  /* Stop the current stroke without keeping it (e.g. a second finger starts a pinch). */
  App.cancelStroke = function () {
    if (!drawing) return;
    drawing = false; held = false; smart = null; consumed = true;
    clearTimeout(holdTimer); clearTimeout(smartTimer);
    if (!App.isPaintTool(tool)) {
      layer.ctx.save(); layer.ctx.globalCompositeOperation = 'copy';
      layer.ctx.drawImage(App.snap, 0, 0); layer.ctx.restore();
    }
    App.strokeCtx.clearRect(0, 0, App.W, App.H);
  };

  function addPoint(raw) {
    if (smart && U.dist(raw, smart.at) > 4 * App.viewPx()) { smart = null; clearTimeout(smartTimer); }
    const p = stab.push(raw);
    if (U.dist(p, prev) < 0.4 * App.unit) return;
    pts.push(p);
    const pm = mirror(p);
    liveTool(prev, p, prevM, pm);
    prev = p; prevM = pm;
    rect = U.rectAdd(rect, p.x, p.y, st.size * App.unit + 4);
    if (st.mirror) rect = U.rectAdd(rect, pm.x, pm.y, st.size * App.unit + 4);
    // hold-to-fix: restart the timer whenever the pen really moves
    if (held && U.dist(raw, heldAt) > 10 * App.viewPx()) { held = false; heldRes = null; App.requestOverlay(); }
    if (U.dist(raw, holdAnchor) > 4 * App.viewPx()) { holdAnchor = raw; armHold(); }
    previewDirty = true;
  }

  function liveTool(a, b, am, bm) {
    const size = st.size * App.unit;
    if (tool === 'eraser') {
      const w = App.strokeWidth('eraser', size, st.pressure, b.p);
      App.eraseSegment(layer.ctx, a, b, w, st.opacity);
      if (st.mirror) App.eraseSegment(layer.ctx, am, bm, w, st.opacity);
      rect = U.rectAdd(rect, b.x, b.y, size); if (st.mirror) rect = U.rectAdd(rect, bm.x, bm.y, size);
    } else if (tool === 'blur') {
      App.walk(a, b, size * 0.3, q => App.blurStamp(layer, q.x, q.y, size / 2, st.opacity));
      if (st.mirror) App.walk(am, bm, size * 0.3, q => App.blurStamp(layer, q.x, q.y, size / 2, st.opacity));
      rect = U.rectAdd(rect, b.x, b.y, size); if (st.mirror) rect = U.rectAdd(rect, bm.x, bm.y, size);
    } else if (tool === 'smudge') {
      const k = 0.85 * st.opacity * (st.pressure ? 0.4 + 0.6 * b.p : 1);
      App.walk(a, b, Math.max(1, size * 0.12), q => smudger.stamp(q, k));
      if (st.mirror && smudgerM) App.walk(am, bm, Math.max(1, size * 0.12), q => smudgerM.stamp(q, k));
      rect = U.rectAdd(rect, b.x, b.y, size); if (st.mirror) rect = U.rectAdd(rect, bm.x, bm.y, size);
    }
  }

  function armHold() {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(onHold, 450);
  }
  function onHold() {
    if (!drawing || !App.isPaintTool(tool) || st.assistMode !== 'hold' || pts.length < 6) return;
    const res = analyze(pts);
    if (res.type === 'free') return;
    held = true; heldRes = res; heldAt = holdAnchor; previewDirty = true; overlayDirty = true;
    App.setScore(`<b>${S_label(res)}</b> — let go to keep the clean shape, or keep drawing.`);
  }

  function up(e) {
    if (ctl) { const c = ctl; ctl = null; c.up(App.toDoc(e), e); overlayDirty = true; return; }
    if (consumed) { consumed = false; App.emit('pressure', 0); return; }
    if (!drawing) return;
    drawing = false;
    smart = null;
    clearTimeout(holdTimer); clearTimeout(smartTimer);
    if (App.isPaintTool(tool)) {
      if (!held) for (const p of stab.catchUp({ ...App.toDoc(e), p: prev.p, t: e.timeStamp })) addPoint(p);
      commitPaint();
    } else if (tool === 'eraser') {
      // remember the eraser stroke too, so redrawing an area later keeps it erased
      const it = App.Items.addErase(layer, st.mirror ? [pts, pts.map(mirror)] : [pts],
        { brush: 'eraser', size: st.size * App.unit, opacity: st.opacity, pressure: st.pressure }, rect);
      App.endEdit(tok, rect, App.Items.undoable(it));
    } else {
      App.endEdit(tok, rect);
    }
    smudger = smudgerM = null;
    App.strokeCtx.clearRect(0, 0, App.W, App.H);
    App.emit('pressure', 0);
  }

  /* ---------- recognition + correction ---------- */
  function analyze(points) {
    let res = App.Shapes.analyze(points);
    if (App.Lesson && App.Lesson.snap) res = App.Lesson.snap(res) || res;
    if (!res.snapped) res = App.Shapes.levelLine(res, st.assist);
    return res;
  }
  const S_label = res => `${Math.round(U.clamp(res.score, 0, 1) * 100)}% ${App.Shapes.label(res)}`;

  function commitPaint() {
    const t = st.assist;
    // the airbrush is for soft shading: the shape helper leaves it alone
    let res = held ? heldRes : (pts.length >= 3 && tool !== 'airbrush' ? analyze(pts) : null);
    const apply = st.assistMode === 'always' || held;
    let final = pts;
    if (res && apply && t > 0) final = App.Shapes.correct(res, t);
    const strokes = [final];
    if (st.mirror) strokes.push(final.map(mirror));
    const o = brushOpts(tool);
    const r = App.commitStroke(layer, strokes, o);
    const item = App.Items.addStroke(layer, strokes, o, r);
    App.endEdit(tok, r, App.Items.undoable(item));

    if (res && res.type !== 'free') {
      if (st.ghost) { ghost.res = res; ghost.t0 = performance.now(); }
      let msg = `<b>${S_label(res)}</b>`;
      if (res.snapped) msg += ` · snapped to ${res.snapped}`;
      else if (res.leveled && apply) msg += ' · leveled';
      if (!apply) msg += ' · hold the pen still at the end of a line to clean it up';
      else if (t === 0) msg += ' · Assist is off, so your line was kept as drawn';
      if (st.ghost) App.setScore(msg);
    } else if (res) {
      App.setScore('Freehand line, kept as you drew it.');
    }
    App.emit('stroke', { res, layer, applied: apply && t > 0, final });
  }

  /* ---------- drawing loop: live stroke + overlay ---------- */
  function frame(now) {
    if (previewDirty && App.Move.hasSelection()) previewDirty = false;   // the Move tool owns the preview now
    if (previewDirty) {
      previewDirty = false;
      const c = App.strokeCtx;
      c.clearRect(0, 0, App.W, App.H);
      if (drawing && App.isPaintTool(tool)) {
        const show = held && heldRes ? App.Shapes.correct(heldRes, st.assist) : pts;
        const o = brushOpts(tool);
        App.drawStrokes(c, st.mirror ? [show, show.map(mirror)] : [show], o);
        App.strokeCanvas.style.opacity = layer.opacity * st.opacity * App.brushes[tool].alpha;
      }
    }
    const ghostAge = ghost.res ? now - ghost.t0 : Infinity;
    if (overlayDirty || ghostAge < 2200 || smart || App.Items.flash) {
      overlayDirty = false;
      drawOverlay(ghostAge);
      if (ghostAge >= 2200) ghost.res = null;
    }
    requestAnimationFrame(frame);
  }

  function drawOverlay(ghostAge) {
    const c = App.overlayCtx, u = App.viewPx();
    c.clearRect(0, 0, App.W, App.H);
    const guide = App.guideLayer();
    if (App.Lesson && App.Lesson.drawHints && (!guide || guide.visible)) App.Lesson.drawHints(c);
    if (App.Drills) App.Drills.drawTarget(c, u);
    if (App.Ref) App.Ref.drawOverlay(c, u);
    if (App.Move) App.Move.drawOverlay(c, u);

    if (st.mirror) {
      const x = App.mirrorAxis();
      c.save(); c.strokeStyle = 'rgba(140,90,220,.55)'; c.lineWidth = 1.2 * u; c.setLineDash([8 * u, 6 * u]);
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, App.H); c.stroke(); c.restore();
    }
    if (ghost.res && ghostAge < 2200) {
      const a = ghostAge < 900 ? 0.75 : 0.75 * (1 - (ghostAge - 900) / 1300);
      c.save();
      c.strokeStyle = `rgba(235, 70, 90, ${a})`; c.lineWidth = 1.6 * u; c.setLineDash([7 * u, 5 * u]);
      App.Shapes.geomPath(c, ghost.res.geom); App.haloStroke(c, 0.6 * a);
      if (st.mirror) { c.translate(2 * App.mirrorAxis(), 0); c.scale(-1, 1); App.Shapes.geomPath(c, ghost.res.geom); App.haloStroke(c, 0.6 * a); }
      c.restore();
    }
    App.Items.drawFlash(c, performance.now());
    if (cursor) drawCursor(c, u);
    // hold-to-pick progress ring
    if (smart && drawing) {
      const k = (performance.now() - smart.t0 - 150) / (SMART_MS - 150);
      if (k > 0) {
        const r = Math.max(10 * u, st.size * App.unit / 2 + 8 * u);
        c.save(); c.lineWidth = 3 * u; c.strokeStyle = tool === 'eraser' ? 'rgba(235,70,90,.85)' : 'rgba(91,157,255,.9)';
        c.beginPath(); c.arc(smart.at.x, smart.at.y, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, k) * Math.PI * 2); App.haloStroke(c, 0.6); c.restore();
      }
    }
  }

  /* The pointer. Every mark is drawn twice, a wide dark line with a thin white
     line on top, so it shows on any color: white paper, neon, a night sky. */
  function drawCursor(c, u) {
    const t = drawing ? tool : st.tool, x = cursor.x, y = cursor.y;
    const both = (path, w = 1.3) => {
      c.lineWidth = (w + 2.4) * u; c.strokeStyle = 'rgba(0, 0, 0, .7)'; path(); c.stroke();
      c.lineWidth = w * u; c.strokeStyle = '#fff'; path(); c.stroke();
    };
    c.save();
    c.lineCap = 'round'; c.setLineDash([]);
    if (t === 'fill' || t === 'picker' || t === 'move' || t === 'shape') {
      const r = 10 * u, gap = 3 * u;   // crosshair with an open middle, so you see the exact spot
      both(() => {
        c.beginPath();
        c.moveTo(x - r, y); c.lineTo(x - gap, y); c.moveTo(x + gap, y); c.lineTo(x + r, y);
        c.moveTo(x, y - r); c.lineTo(x, y - gap); c.moveTo(x, y + gap); c.lineTo(x, y + r);
      });
      if (t === 'picker') both(() => { c.beginPath(); c.arc(x, y, r * 1.35, 0, Math.PI * 2); });
    } else {
      const r = Math.max(3 * u, st.size * App.unit / 2);
      both(() => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }, 1.2);
      // a small dot in the middle: exactly where the line starts
      c.fillStyle = 'rgba(0, 0, 0, .7)'; c.beginPath(); c.arc(x, y, 2.3 * u, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 1.2 * u, 0, Math.PI * 2); c.fill();
      if (held) { c.strokeStyle = 'rgba(80,200,140,.95)'; c.lineWidth = 2.5 * u; c.beginPath(); c.arc(x, y, r + 5 * u, 0, Math.PI * 2); App.haloStroke(c, 0.6); }
    }
    c.restore();
  }

  App.initInput = function () {
    const o = App.overlay;
    o.addEventListener('pointerdown', down);
    o.addEventListener('pointermove', move);
    o.addEventListener('pointerup', up);
    o.addEventListener('pointercancel', up);
    o.addEventListener('pointerleave', () => { if (!drawing) { cursor = null; overlayDirty = true; } });
    o.addEventListener('contextmenu', e => e.preventDefault());
    requestAnimationFrame(frame);
  };
})();
