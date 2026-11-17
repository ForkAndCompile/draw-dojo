'use strict';
/* Move tool: pick lines (and fills / pictures) and move, resize or turn them.
   - Press on a line and drag: it moves right away.
   - Draw a loop around several lines: they are all picked.
   - Then drag inside the box to move, a corner to resize, the round handle to turn.
   - Enter or a tap outside finishes. Esc puts everything back. Delete removes it. */

(function () {
  const Mv = App.Move = {};
  const st = App.settings, I = App.Items;
  let sel = null, lasso = null;

  /* ---------- transform helpers ---------- */
  const T = () => sel.t;
  function map(p) {   // apply the current move / resize / turn / flip to a point
    const { dx, dy, s, a, fx } = T(), c = sel.c;
    const x = (p.x - c.x) * s * fx, y = (p.y - c.y) * s, cos = Math.cos(a), sin = Math.sin(a);
    return { x: c.x + x * cos - y * sin + dx, y: c.y + x * sin + y * cos + dy, p: p.p };
  }
  function applyCtx(ctx) {
    const { dx, dy, s, a, fx } = T(), c = sel.c;
    ctx.translate(c.x + dx, c.y + dy); ctx.rotate(a); ctx.scale(s * fx, s); ctx.translate(-c.x, -c.y);
  }
  function corners() {
    const b = sel.box;
    return [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }].map(map);
  }
  function rotHandle(u) {
    const top = map({ x: sel.c.x, y: sel.box.y0 }), a = T().a;
    return { x: top.x + Math.sin(a) * 34 * u, y: top.y - Math.cos(a) * 34 * u };
  }
  function union(r, q) { return !r ? { ...q } : { x0: Math.min(r.x0, q.x0), y0: Math.min(r.y0, q.y0), x1: Math.max(r.x1, q.x1), y1: Math.max(r.y1, q.y1) }; }
  const boxOf = pts => pts.reduce((r, p) => App.util.rectAdd(r, p.x, p.y, 0), null);

  /* ---------- picking ---------- */
  function inside(p, poly) {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) ins = !ins;
    }
    return ins;
  }
  function inLasso(it, poly) {
    let pts = [];
    if (it.kind === 'fill') {
      const r = it.rect;
      for (let i = 1; i < 5; i++) for (let j = 1; j < 5; j++) pts.push({ x: r.x0 + (r.x1 - r.x0) * i / 5, y: r.y0 + (r.y1 - r.y0) * j / 5 });
    } else {
      const all = it.strokes.flat(), step = Math.max(1, Math.floor(all.length / 24));
      for (let i = 0; i < all.length; i += step) pts.push(all[i]);
    }
    return pts.filter(p => inside(p, poly)).length >= pts.length * 0.6;
  }

  function select(layer, items) {
    const tok = App.beginEdit(layer);   // snapshot of the layer before anything moves
    sel = { layer, items, tok, t: { dx: 0, dy: 0, s: 1, a: 0, fx: 1 }, order: layer.items.slice() };
    let box = null;
    for (const it of items) box = union(box, it.rect);
    sel.box = box; sel.c = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
    items.forEach(it => { it.hidden = true; });
    I.wipeReplay(layer, items);   // take them off the layer; they float on the preview canvas
    preview();
    App.setHint(`<b>${items.length === 1 ? '1 thing' : items.length + ' things'} picked</b> · drag to move, corners to resize, round handle to turn · Ctrl+D duplicate · Enter to finish`);
    refresh();
  }

  /* ---------- live preview while moving ---------- */
  function preview() {
    const c = App.strokeCtx;
    c.clearRect(0, 0, App.W, App.H);
    if (!sel) return;
    App.strokeCanvas.style.opacity = sel.layer.opacity;
    for (const it of sel.items) {
      if (it.kind === 'fill') {
        c.save(); c.globalCompositeOperation = 'destination-over'; c.globalAlpha = it.opacity; applyCtx(c);
        c.drawImage(it.canvas, it.x, it.y); c.restore();
      } else {
        I.renderItem(c, { ...it, strokes: it.strokes.map(pts => pts.map(map)), o: { ...it.o, size: it.o.size * T().s } });
      }
    }
    App.requestOverlay();
  }

  /* Make the move permanent: change the items, draw them back on top. */
  function bake(it) {
    if (it.kind === 'fill') {
      const r = it.rect, pts = [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }].map(map);
      const b = boxOf(pts), x = Math.floor(b.x0), y = Math.floor(b.y0);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(b.x1) - x); c.height = Math.max(1, Math.ceil(b.y1) - y);
      const ctx = c.getContext('2d'); ctx.translate(-x, -y); applyCtx(ctx); ctx.drawImage(it.canvas, it.x, it.y);
      return { canvas: c, x, y, under: false, rect: { x0: x, y0: y, x1: x + c.width, y1: y + c.height } };
    }
    const strokes = it.strokes.map(pts => pts.map(map)), size = it.o.size * T().s;
    const pad = size * 1.3 + 4;
    let rect = null;
    for (const pts of strokes) for (const p of pts) rect = App.util.rectAdd(rect, p.x, p.y, pad);
    return { strokes, o: { ...it.o, size }, rect };
  }
  const geom = it => (it.kind === 'fill' ? { canvas: it.canvas, x: it.x, y: it.y, rect: it.rect, under: it.under } : { strokes: it.strokes, o: it.o, rect: it.rect });
  const fillsFirst = items => items.filter(i => i.kind === 'fill').concat(items.filter(i => i.kind !== 'fill'));

  Mv.commit = function () {
    if (!sel) return;
    const s = sel; sel = null;
    setTimeout(refresh);
    App.strokeCtx.clearRect(0, 0, App.W, App.H);
    s.items.forEach(it => { it.hidden = false; });
    if (isIdentityOf(s)) { restoreSnap(s); return; }
    sel = s;   // map() needs the transform
    const before = s.items.map(geom), after = s.items.map(bake);
    sel = null;
    let area = null;
    s.items.forEach((it, k) => { Object.assign(it, after[k]); area = union(area, before[k].rect); area = union(area, after[k].rect); });
    // moved things end up on top
    const group = fillsFirst(s.items);
    const newOrder = s.order.filter(it => !s.items.includes(it)).concat(group);
    s.layer.items = newOrder.slice();
    for (const it of group) I.renderItem(s.layer.ctx, it);
    App.endEdit(s.tok, area, {
      undo: () => { s.items.forEach((it, k) => Object.assign(it, before[k])); s.layer.items = s.order.slice(); },
      redo: () => { s.items.forEach((it, k) => Object.assign(it, after[k])); s.layer.items = newOrder.slice(); }
    });
    App.requestOverlay();
  };
  const isIdentityOf = s => { const t = s.t; return !t.dx && !t.dy && t.s === 1 && !t.a && t.fx === 1; };
  function restoreSnap(s) {
    const c = s.layer.ctx;
    c.save(); c.globalCompositeOperation = 'copy'; c.drawImage(App.snap, 0, 0); c.restore();
    App.requestOverlay();
  }

  Mv.cancel = function () {
    if (!sel) return;
    const s = sel; sel = null;
    setTimeout(refresh);
    s.items.forEach(it => { it.hidden = false; });
    App.strokeCtx.clearRect(0, 0, App.W, App.H);
    restoreSnap(s);
  };

  function removeSelected() {
    const s = sel; sel = null;
    setTimeout(refresh);
    App.strokeCtx.clearRect(0, 0, App.W, App.H);
    s.items.forEach(it => { it.hidden = false; it.alive = false; });
    let area = null; s.items.forEach(it => { area = union(area, it.rect); });
    App.endEdit(s.tok, area, { undo: () => s.items.forEach(it => { it.alive = true; }), redo: () => s.items.forEach(it => { it.alive = false; }) });
    App.toast('Removed (Ctrl+Z to undo)');
  }

  Mv.hasSelection = () => !!sel;

  /* ---------- pen input (called by input.js) ---------- */
  Mv.press = function (raw, e) {
    if (st.tool !== 'move') return null;
    const u = App.viewPx(), hs = 12 * u;
    if (sel) {
      const start = { ...raw }, t0 = { ...T() }, cen = { x: sel.c.x + t0.dx, y: sel.c.y + t0.dy };
      const rh = rotHandle(u);
      if (Math.hypot(raw.x - rh.x, raw.y - rh.y) < hs * 1.4) {
        const a0 = Math.atan2(start.y - cen.y, start.x - cen.x);
        return { move(p) {
          let a = t0.a + Math.atan2(p.y - cen.y, p.x - cen.x) - a0;
          const snapA = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
          if (Math.abs(a - snapA) < 0.05) a = snapA;   // clicks into place at 0, 45, 90...
          T().a = a; preview();
        }, up() {} };
      }
      if (corners().some(q => Math.hypot(raw.x - q.x, raw.y - q.y) < hs * 1.4)) {
        const d0 = Math.hypot(start.x - cen.x, start.y - cen.y) || 1;
        return { move(p) { T().s = Math.max(0.05, t0.s * Math.hypot(p.x - cen.x, p.y - cen.y) / d0); preview(); }, up() {} };
      }
      if (inside(raw, corners())) {
        if (e && e.altKey) Mv.duplicate(true);   // Alt+drag: drag out a copy
        return dragger(raw);
      }
      Mv.commit();   // pressed outside: finish, then start a new pick below
    }
    const layer = App.active;
    if (!layer.visible) { App.toast('This layer is hidden'); return { move() {}, up() {} }; }
    // Pressing right ON a line grabs it at once. Anywhere else (empty paper, or on top of a
    // filled shape like a sky or a building) starts the lasso, so big fills never get in the way.
    const hit = I.hit(layer, raw.x, raw.y, 3);
    if (hit && hit.kind === 'stroke') { select(layer, [hit]); return dragger(raw); }
    lasso = [raw];
    return {
      move(p) { lasso.push(p); },
      up() {
        const poly = lasso; lasso = null;
        if (poly.length < 3 || App.Shapes.pathLength(poly) < 30 * u) {
          // just a tap: pick the filled shape or picture under the pen, if there is one
          if (hit) { select(layer, [hit]); return; }
          App.toast('Press on a line to move it, draw a loop around things to pick them, or tap a filled shape.');
          return;
        }
        const items = layer.items.filter(it => I.pickable(it) && inLasso(it, poly));
        if (!items.length) { App.toast('Nothing inside that loop on this layer.'); return; }
        select(layer, items);
      }
    };
  };
  function dragger(raw) {
    const start = { ...raw }, t0 = { ...T() };
    return { move(p) { T().dx = t0.dx + p.x - start.x; T().dy = t0.dy + p.y - start.y; preview(); }, up() {} };
  }

  Mv.key = function (e) {
    if (!sel) return false;
    const k = e.key, u = App.viewPx() * (e.shiftKey ? 10 : 1);
    if (k === 'Enter') { Mv.commit(); return true; }
    if (k === 'Escape') { Mv.cancel(); return true; }
    if (k === 'Delete' || k === 'Backspace') { removeSelected(); return true; }
    const nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (nudge) { T().dx += nudge[0] * u; T().dy += nudge[1] * u; preview(); return true; }
    return false;
  };

  Mv.drawOverlay = function (c, u) {
    if (lasso && lasso.length > 1) {
      c.save(); c.strokeStyle = 'rgba(91,157,255,.95)'; c.lineWidth = 1.5 * u; c.setLineDash([6 * u, 5 * u]);
      c.beginPath(); lasso.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.stroke(); c.restore();
    }
    if (!sel) return;
    const q = corners(), rh = rotHandle(u), hs = 12 * u, top = map({ x: sel.c.x, y: sel.box.y0 });
    c.save();
    c.strokeStyle = 'rgba(91,157,255,.95)'; c.lineWidth = 1.5 * u; c.setLineDash([7 * u, 5 * u]);
    c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.stroke();
    c.setLineDash([]);
    c.beginPath(); c.moveTo(top.x, top.y); c.lineTo(rh.x, rh.y); c.stroke();
    c.fillStyle = '#fff';
    for (const p of q) { c.fillRect(p.x - hs / 2, p.y - hs / 2, hs, hs); c.strokeRect(p.x - hs / 2, p.y - hs / 2, hs, hs); }
    c.beginPath(); c.arc(rh.x, rh.y, hs * 0.6, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
  };

  /* ---------- duplicate, copy, paste, flip ---------- */
  let clip = null, pasteN = 0, bar = null;
  const shifted = (r, dx, dy) => ({ x0: r.x0 + dx, y0: r.y0 + dy, x1: r.x1 + dx, y1: r.y1 + dy });
  /* A copy of an item, moved by (dx, dy). Fill pictures are never changed in place, so copies can share them. */
  function cloneItem(it, dx = 0, dy = 0) {
    if (it.kind === 'fill') return { kind: 'fill', canvas: it.canvas, x: it.x + dx, y: it.y + dy, opacity: it.opacity, under: false, rect: shifted(it.rect, dx, dy), alive: true };
    return { kind: it.kind, o: { ...it.o }, rect: shifted(it.rect, dx, dy), alive: true,
             strokes: it.strokes.map(pts => pts.map(p => ({ x: p.x + dx, y: p.y + dy, p: p.p }))) };
  }
  /* The picked things as they look right now (moved, resized, turned, flipped). */
  const current = () => sel.items.map(it => cloneItem({ ...it, ...bake(it) }));

  /* Put copies on a layer (one undo step) and pick them, ready to drag. */
  function placeCopies(layer, items) {
    items = fillsFirst(items);
    const tok = App.beginEdit(layer);
    let area = null;
    for (const it of items) { I.renderItem(layer.ctx, it); layer.items.push(it); area = union(area, it.rect); }
    App.endEdit(tok, area, { undo: () => items.forEach(i => { i.alive = false; }), redo: () => items.forEach(i => { i.alive = true; }) });
    select(layer, items);
  }
  Mv.duplicate = function (inPlace) {
    if (!sel) return false;
    const copies = current(), layer = sel.layer, off = inPlace ? 0 : 24 * App.viewPx();
    Mv.commit();
    placeCopies(layer, copies.map(c => cloneItem(c, off, off)));
    if (!inPlace) App.toast('Duplicated! Drag the copy where you want it. Ctrl+D again for more.');
    return true;
  };
  Mv.copy = function () {
    if (!sel) return false;
    clip = current(); pasteN = 0; refresh();
    App.toast(`Copied ${clip.length === 1 ? '1 thing' : clip.length + ' things'}. Paste with Ctrl+V, on any layer.`);
    return true;
  };
  Mv.paste = function () {
    if (!clip) return false;
    Mv.commit();
    if (st.tool !== 'move') App.setTool('move');
    if (!App.active.visible) { App.toast('This layer is hidden'); return true; }
    pasteN++;
    const off = 24 * App.viewPx() * pasteN;   // each paste lands a little further, so copies don't hide each other
    placeCopies(App.active, clip.map(c => cloneItem(c, off, off)));
    return true;
  };
  Mv.flip = function () { if (!sel) return false; T().fx = -T().fx; preview(); return true; };
  Mv.shortcut = k => (k === 'd' ? Mv.duplicate() : k === 'c' ? Mv.copy() : k === 'v' ? Mv.paste() : false);

  /* The bar at the top of the page while the Move tool is in use. */
  function refresh() {
    if (!bar) return;
    bar.hidden = !(st.tool === 'move' || sel);
    bar.querySelector('.sel-info').textContent = sel ? (sel.items.length === 1 ? '1 picked' : sel.items.length + ' picked') : 'Press a line, or draw a loop around lines';
    for (const b of bar.querySelectorAll('button')) b.disabled = b.dataset.act === 'paste' ? !clip : !sel;
  }

  Mv.init = function () {
    bar = document.createElement('div');
    bar.id = 'selBar'; bar.className = 'sel-bar'; bar.hidden = true;
    bar.innerHTML = '<span class="sel-info"></span>' +
      '<button data-act="dup" title="Duplicate (Ctrl+D). Tip: hold Alt and drag the selection to drag out a copy">⧉ Duplicate</button>' +
      '<button data-act="copy" title="Copy (Ctrl+C)">Copy</button>' +
      '<button data-act="paste" title="Paste (Ctrl+V). Works on any layer">Paste</button>' +
      '<button data-act="flip" title="Flip left-right">⇋ Flip</button>' +
      '<button data-act="del" title="Delete (Del)">Delete</button>' +
      '<button data-act="done" class="primary" title="Finish (Enter)">Done</button>';
    document.getElementById('stage').appendChild(bar);
    bar.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      ({ dup: () => Mv.duplicate(), copy: Mv.copy, paste: Mv.paste, flip: Mv.flip, del: () => { if (sel) removeSelected(); }, done: Mv.commit })[b.dataset.act]();
    });
    const setTool = App.setTool;
    App.setTool = t => { setTool(t); refresh(); };
    refresh();
  };
})();
