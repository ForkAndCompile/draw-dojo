'use strict';
/* Reference photo.
   Side window: a small movable window to copy from (the best way to learn).
   Trace: the photo sits faintly under the drawing. It is never saved in the
   PNG, never stops the fill bucket, but the eyedropper can pick its colors.
   "Move photo": drag the photo to move it, drag its corner to resize it. */

(function () {
  const $ = id => document.getElementById(id);
  const R = App.Ref = {};
  let img = null, blob = null, url = null, mode = 'window', tf = null, winOpen = true;
  let opTrace = 0.35, opWin = 1;   // how strong the photo shows in each mode
  let canvas = null, adjusting = false;

  R.traceCanvas = () => (img && mode === 'trace' ? canvas : null);

  function fit() {
    const s = Math.min(App.W / img.width, App.H / img.height);
    return { s, x: (App.W - img.width * s) / 2, y: (App.H - img.height * s) / 2 };
  }
  const bounds = () => ({ x0: tf.x, y0: tf.y, x1: tf.x + img.width * tf.s, y1: tf.y + img.height * tf.s });

  function render() {
    if (!canvas || canvas.width !== App.W || canvas.height !== App.H) canvas = App.makeCanvas();
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, App.W, App.H);
    if (img) c.drawImage(img, tf.x, tf.y, img.width * tf.s, img.height * tf.s);
    canvas.style.opacity = opTrace;
  }
  const curOp = () => (mode === 'trace' ? opTrace : opWin);
  function showOpacity() {
    const v = Math.round(curOp() * 100);
    $('refOp').value = v; $('refOpVal').textContent = v + '%';
    $('refOpLabel').textContent = mode === 'trace' ? 'Photo opacity' : 'Window opacity';
    $('refWin').style.opacity = opWin;
  }

  function update() {
    $('refEmpty').hidden = !!img;
    $('refOn').hidden = !img;
    document.querySelectorAll('#refMode button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    $('refAdjust').style.display = mode === 'trace' ? '' : 'none';
    showOpacity();
    if (mode !== 'trace') adjusting = false;
    $('refAdjust').classList.toggle('on', adjusting);
    $('refWin').hidden = !(img && mode === 'window' && winOpen);
    if (img) render();
    App.syncLayers();
    App.requestOverlay();
  }

  async function setImage(b, settings) {
    const im = await App.Project.loadImage(b);
    if (url) URL.revokeObjectURL(url);
    img = im; blob = b; url = URL.createObjectURL(b);
    $('refWinImg').src = url;
    mode = (settings && settings.mode) || 'window';
    opTrace = (settings && settings.opacity) || 0.35;
    opWin = (settings && settings.opWin) || 1;
    tf = (settings && settings.tf) || fit();
    winOpen = true;
    update();
  }

  R.remove = function () {
    img = null; blob = null; adjusting = false;
    if (url) { URL.revokeObjectURL(url); url = null; }
    update();
  };

  /* For saving: the photo and how it is placed. */
  R.serialize = () => (img ? { img: blob, mode, opacity: opTrace, opWin, tf: { ...tf } } : null);
  R.restore = async function (d) {
    if (!d || !d.img) { R.remove(); return; }
    const b = d.img instanceof Blob ? d.img : await (await fetch(d.img)).blob();
    await setImage(b, d);
  };

  /* ---------- "Move photo": the photo takes over the pen ---------- */
  R.press = function (raw) {
    if (!adjusting || !img || mode !== 'trace') return null;
    const b = bounds(), hs = 14 * App.viewPx();
    const start = { ...raw }, t0 = { ...tf };
    if (Math.hypot(raw.x - b.x1, raw.y - b.y1) < hs * 1.5) {   // corner handle: resize, top-left stays put
      const w0 = b.x1 - b.x0;
      return {
        move(p) { tf.s = Math.max(0.02, t0.s * Math.max(20, w0 + (p.x - start.x)) / w0); render(); },
        up() { App.Project.autosaveNow(); }
      };
    }
    return {
      move(p) { tf.x = t0.x + p.x - start.x; tf.y = t0.y + p.y - start.y; render(); },
      up() { App.Project.autosaveNow(); }
    };
  };

  R.drawOverlay = function (c, u) {
    if (!adjusting || !img || mode !== 'trace') return;
    const b = bounds(), hs = 14 * u;
    c.save();
    c.strokeStyle = 'rgba(91,157,255,.95)'; c.lineWidth = 2 * u; c.setLineDash([8 * u, 6 * u]);
    c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    c.setLineDash([]); c.fillStyle = '#fff';
    c.fillRect(b.x1 - hs / 2, b.y1 - hs / 2, hs, hs); c.strokeRect(b.x1 - hs / 2, b.y1 - hs / 2, hs, hs);
    c.restore();
  };

  /* ---------- side window: drag it by its title bar ---------- */
  function dragWindow() {
    const win = $('refWin'), head = $('refWinHead');
    head.addEventListener('pointerdown', e => {
      if (e.target.tagName === 'BUTTON') return;
      const r = win.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
      try { head.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const mv = ev => {
        win.style.left = App.util.clamp(r.left + ev.clientX - sx, 0, innerWidth - 60) + 'px';
        win.style.top = App.util.clamp(r.top + ev.clientY - sy, 0, innerHeight - 40) + 'px';
      };
      const upFn = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', upFn); };
      head.addEventListener('pointermove', mv); head.addEventListener('pointerup', upFn);
    });
    // resize from the corner grip (the window body lets the pen through, so you can trace under it)
    const grip = $('refWinGrip');
    grip.addEventListener('pointerdown', e => {
      const r = win.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const mv = ev => {
        win.style.width = Math.max(140, r.width + ev.clientX - sx) + 'px';
        win.style.height = Math.max(110, r.height + ev.clientY - sy) + 'px';
      };
      const upFn = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', upFn); };
      grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', upFn);
      e.stopPropagation();
    });
  }

  R.init = function () {
    $('refLoad').onclick = () => $('refInput').click();
    $('refInput').onchange = async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { await setImage(f); App.Project.autosaveNow(); App.toast('Photo loaded. Copy it from the side window, or choose Trace.'); }
      catch (err) { App.toast('Could not open that picture'); }
    };
    document.querySelectorAll('#refMode button').forEach(b => b.onclick = () => {
      mode = b.dataset.mode; winOpen = true; update(); App.Project.autosaveNow();
    });
    $('refOp').addEventListener('input', e => {
      const v = e.target.value / 100;
      if (mode === 'trace') { opTrace = v; if (canvas) canvas.style.opacity = v; } else opWin = v;
      showOpacity();
    });
    $('refOp').addEventListener('change', () => App.Project.autosaveNow());
    $('refAdjust').onclick = () => {
      adjusting = !adjusting; update();
      if (adjusting) App.toast('Drag the photo to move it, drag its corner to resize it. Press Move photo again when done.');
    };
    $('refRemove').onclick = () => { R.remove(); App.Project.autosaveNow(); };
    $('refWinClose').onclick = () => { winOpen = false; update(); };
    dragWindow();
    update();
  };
})();
