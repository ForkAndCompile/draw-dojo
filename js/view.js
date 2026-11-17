'use strict';
/* View: zoom, pan, rotate and flip the paper. This only changes how you see
   the drawing, never the drawing itself (a flipped view saves unflipped).
   Mouse wheel = zoom at the cursor. Space+drag or middle button = pan.
   Two fingers on a touch screen = pan, zoom and rotate. */

(function () {
  const V = App.view = { zoom: 1, rot: 0, flip: false, px: 0, py: 0 };
  const $ = id => document.getElementById(id);
  const ZMIN = 0.2, ZMAX = 8, RAD = Math.PI / 180;
  let spaceDown = false, pan = null, gesture = null;
  const touches = new Map();

  App.applyView = function () {
    App.paper.style.transform =
      `translate(${V.px}px, ${V.py}px) rotate(${V.rot}deg) scale(${V.flip ? -V.zoom : V.zoom}, ${V.zoom})`;
    $('zoomVal').textContent = Math.round(V.zoom * 100) + '%';
    $('zoomVal').title = `Zoom ${Math.round(V.zoom * 100)}%, turned ${Math.round(V.rot)}°. Click to fit the page again.`;
    $('btnFlip').classList.toggle('on', V.flip);
    App.requestOverlay && App.requestOverlay();
  };

  /* Middle of the paper on screen (its layout position plus the pan). */
  function center() {
    const w = $('canvasWrap').getBoundingClientRect(), p = App.paper;
    return { x: w.left + p.offsetLeft + p.offsetWidth / 2 + V.px, y: w.top + p.offsetTop + p.offsetHeight / 2 + V.py };
  }

  /* Screen -> document coordinates (undoes pan, rotation, zoom and flip). */
  App.toDoc = function (e) {
    const p = App.paper, bw = p.offsetWidth, bh = p.offsetHeight;
    if (!bw || !bh) return { x: 0, y: 0 };
    const c = center(), dx = e.clientX - c.x, dy = e.clientY - c.y;
    const a = -V.rot * RAD, cos = Math.cos(a), sin = Math.sin(a);
    let ux = (dx * cos - dy * sin) / V.zoom;
    const uy = (dx * sin + dy * cos) / V.zoom;
    if (V.flip) ux = -ux;
    return { x: (ux + bw / 2) * App.W / bw, y: (uy + bh / 2) * App.H / bh };
  };

  /* Document -> screen coordinates. */
  App.docToClient = function (pt) {
    const p = App.paper, bw = p.offsetWidth, bh = p.offsetHeight, c = center();
    let ux = (pt.x * bw / App.W - bw / 2) * V.zoom;
    const uy = (pt.y * bh / App.H - bh / 2) * V.zoom;
    if (V.flip) ux = -ux;
    const a = V.rot * RAD;
    return { x: c.x + ux * Math.cos(a) - uy * Math.sin(a), y: c.y + ux * Math.sin(a) + uy * Math.cos(a) };
  };

  /* Change the view but keep the point under (cx, cy) where it is. */
  function keepPoint(change, cx, cy) {
    if (cx == null) { const r = $('canvasWrap').getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    const before = App.toDoc({ clientX: cx, clientY: cy });
    change();
    App.applyView();
    const after = App.docToClient(before);
    V.px += cx - after.x; V.py += cy - after.y;
    App.applyView();
  }

  App.zoomBy = (f, cx, cy) => keepPoint(() => { V.zoom = App.util.clamp(V.zoom * f, ZMIN, ZMAX); }, cx, cy);
  App.rotateBy = deg => keepPoint(() => { V.rot = ((V.rot + deg + 540) % 360) - 180; });
  App.resetView = () => { V.zoom = 1; V.rot = 0; V.px = 0; V.py = 0; App.applyView(); };
  App.toggleFlip = function () {
    keepPoint(() => { V.flip = !V.flip; });
    App.toast(V.flip ? 'View flipped. Mistakes jump out when you see your drawing mirrored!' : 'View back to normal');
  };
  App.isPanKey = () => spaceDown;

  /* ---------- mouse, keyboard and touch ---------- */
  function startPan(e) {
    pan = { x: e.clientX, y: e.clientY, px: V.px, py: V.py, id: e.pointerId };
    try { $('canvasWrap').setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    $('canvasWrap').classList.add('panning');
    e.preventDefault(); e.stopPropagation();
  }

  function startGesture() {
    const [a, b] = [...touches.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    gesture = { mid, dist: Math.hypot(b.x - a.x, b.y - a.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x),
                view: { ...V }, doc: App.toDoc({ clientX: mid.x, clientY: mid.y }) };
  }
  function moveGesture() {
    const [a, b] = [...touches.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const g = gesture;
    V.zoom = App.util.clamp(g.view.zoom * Math.hypot(b.x - a.x, b.y - a.y) / g.dist, ZMIN, ZMAX);
    V.rot = g.view.rot + (Math.atan2(b.y - a.y, b.x - a.x) - g.ang) / RAD;
    V.px = g.view.px; V.py = g.view.py;
    App.applyView();
    const now = App.docToClient(g.doc);
    V.px += mid.x - now.x; V.py += mid.y - now.y;
    App.applyView();
  }

  App.initView = function () {
    const wrap = $('canvasWrap');
    wrap.addEventListener('pointerdown', e => {
      if (e.pointerType === 'pen') App.penSeen = true;
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) { App.cancelStroke(); startGesture(); }
        if (touches.size >= 2 || App.penSeen) { e.stopPropagation(); return; }   // palm rejection once a pen is used
      }
      if (e.button === 1 || (spaceDown && e.button === 0)) startPan(e);
    }, true);
    wrap.addEventListener('pointermove', e => {
      if (touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (gesture && touches.size >= 2) { moveGesture(); e.stopPropagation(); return; }
      }
      if (pan && e.pointerId === pan.id) {
        V.px = pan.px + e.clientX - pan.x; V.py = pan.py + e.clientY - pan.y;
        App.applyView(); e.stopPropagation();
      }
    }, true);
    const end = e => {
      touches.delete(e.pointerId);
      if (touches.size < 2) gesture = null;
      if (pan && e.pointerId === pan.id) { pan = null; wrap.classList.remove('panning'); e.stopPropagation(); }
    };
    wrap.addEventListener('pointerup', end, true);
    wrap.addEventListener('pointercancel', end, true);
    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.shiftKey) { V.px -= e.deltaY; App.applyView(); return; }
      App.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
    }, { passive: false });

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
        e.preventDefault();
        if (!spaceDown) { spaceDown = true; wrap.classList.add('can-pan'); }
      }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'Space') { spaceDown = false; wrap.classList.remove('can-pan'); }
    });
    window.addEventListener('blur', () => { spaceDown = false; wrap.classList.remove('can-pan'); });

    $('zoomOut').onclick = () => App.zoomBy(1 / 1.25);
    $('zoomIn').onclick = () => App.zoomBy(1.25);
    $('zoomVal').onclick = App.resetView;
    $('rotL').onclick = () => App.rotateBy(-15);
    $('rotR').onclick = () => App.rotateBy(15);
    $('btnFlip').onclick = App.toggleFlip;
    App.applyView();
  };
})();
