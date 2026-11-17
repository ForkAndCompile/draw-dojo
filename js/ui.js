'use strict';
/* UI: buttons, sliders, colors, layers list, shortcuts, saving. */

(function () {
  const st = App.settings;
  const $ = id => document.getElementById(id);
  let recent = [];
  /* Size slider is logarithmic: fine control for small brushes, still reaches 300. */
  App.sliderToSize = v => Math.max(1, Math.round(Math.pow(300, v / 100)));
  App.sizeToSlider = s => Math.round(100 * Math.log(Math.max(1, s)) / Math.log(300));

  /* ---------- messages ---------- */
  let toastTimer = 0;
  App.toast = function (msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  };
  App.setScore = html => { $('score').innerHTML = html; };
  App.setHint = html => { $('hint').innerHTML = html; };

  /* ---------- tools ---------- */
  const TOOL_NAMES = { pen: 'Pen', pencil: 'Pencil', marker: 'Marker', airbrush: 'Airbrush', eraser: 'Eraser',
                       blur: 'Blur', smudge: 'Smudge', fill: 'Fill', picker: 'Eyedropper', move: 'Move', shape: 'Shapes' };
  let lastPaintTool = 'pen';
  const sizes = { blur: 30, smudge: 24 };   // every brush remembers its own size
  App.lastPaintTool = () => lastPaintTool;
  /* Size (screen px) a tool would use: the current size for the current tool, else its remembered size. */
  App.sizeOf = t => (t === st.tool ? st.size : sizes[t] != null ? sizes[t] : (App.brushes[t] ? App.brushes[t].size : st.size));
  App.setTool = function (t) {
    if (t !== 'move' && App.Move) App.Move.commit();   // switching tools finishes a move
    if (st.tool) sizes[st.tool] = st.size;
    st.tool = t;
    const s = sizes[t] != null ? sizes[t] : (App.brushes[t] && App.brushes[t].size);
    if (s) { st.size = s; App.syncControls(); }
    if (App.isPaintTool(t)) lastPaintTool = t;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    updateHint();
    App.requestOverlay();
  };
  function updateHint() {
    const L = App.active;
    let h = `<b>${(App.brushes[st.tool] && App.brushes[st.tool].name) || TOOL_NAMES[st.tool] || st.tool}</b> on <b>${L ? L.name : ''}</b>`;
    if (L && L.guide) h += ' · guide lines are light blue and can be hidden with G';
    App.setHint(h);
  }

  /* ---------- color ---------- */
  App.setColor = function (hex, fromPicker) {
    hex = hex.toLowerCase();
    st.color = hex;
    App.ColorPicker.sync(hex, fromPicker);
    document.querySelectorAll('.sw').forEach(s => s.classList.toggle('on', s.dataset.c === hex));
    if (st.tool === 'picker') App.setTool(lastPaintTool);
  };
  function swatch(c, parent) {
    const b = document.createElement('button');
    b.className = 'sw'; b.style.background = c; b.dataset.c = c; b.title = c.toUpperCase();
    b.onclick = () => App.setColor(c);
    parent.appendChild(b);
  }
  function rememberColor() {
    if (recent[0] === st.color) return;
    recent = [st.color, ...recent.filter(c => c !== st.color)].slice(0, 8);
    const r = $('recent'); r.innerHTML = '';
    recent.forEach(c => swatch(c, r));
    App.setColor(st.color);
  }

  /* ---------- sliders ---------- */
  function bindRange(id, valId, fmt, set) {
    const el = $(id);
    const upd = () => { const v = +el.value; set(v); if (valId) $(valId).textContent = fmt(v); };
    el.addEventListener('input', upd); upd();
  }
  function assistWord(v) {
    if (v === 0) return 'Off';
    if (v === 100) return 'Perfect';
    return v + '%';
  }
  App.syncControls = function () {
    $('assist').value = Math.round(st.assist * 100); $('assistVal').textContent = assistWord(Math.round(st.assist * 100));
    $('stab').value = Math.round(st.stab * 100); $('stabVal').textContent = Math.round(st.stab * 100) + '%';
    $('size').value = App.sizeToSlider(st.size); $('sizeVal').textContent = st.size;
    document.querySelectorAll('#assistMode button').forEach(b => b.classList.toggle('on', b.dataset.mode === st.assistMode));
    $('btnMirror').classList.toggle('on', st.mirror);
    const g = App.guideLayer(); $('btnGuides').classList.toggle('on', !!(g && g.visible));
  };
  App.setMirror = function (on, axisX = null, quiet = false) {
    st.mirror = on; st.mirrorX = axisX;
    App.syncControls(); App.requestOverlay();
    if (!quiet) App.toast(on ? 'Mirror on: whatever you draw on one side appears on the other' : 'Mirror off');
  };
  App.setGuidesVisible = function (on) {
    const g = App.guideLayer(); if (!g) return;
    g.visible = on; App.syncLayers(); App.syncControls(); App.requestOverlay();
  };

  /* ---------- layers panel ---------- */
  function renderLayers() {
    const list = $('layerList'); list.innerHTML = '';
    [...App.layers].reverse().forEach(L => {
      const row = document.createElement('div');
      row.className = 'layer' + (L === App.active ? ' on' : '') + (L.guide ? ' guide' : '');
      const eye = document.createElement('button');
      eye.className = 'eye' + (L.visible ? '' : ' off'); eye.textContent = '👁'; eye.title = 'Show / hide';
      eye.onclick = ev => { ev.stopPropagation(); L.visible = !L.visible; App.syncLayers(); App.syncControls(); App.requestOverlay(); };
      const th = document.createElement('canvas'); th.className = 'thumb'; th.width = 88; th.height = 60;
      L.thumb = th; drawThumb(L);
      const name = document.createElement('span'); name.className = 'name';
      name.textContent = L.name + (L.guide ? ' (guide)' : '') + (L.blend === 'screen' ? ' · glow' : L.blend === 'multiply' ? ' · shade' : '');
      row.title = 'Click to draw on this layer, double-click to rename';
      row.append(eye, th, name);
      row.onclick = () => App.setActive(L);
      row.ondblclick = () => { const n = prompt('Layer name', L.name); if (n) { L.name = n.trim() || L.name; renderLayers(); } };
      list.appendChild(row);
    });
    const A = App.active;
    if (A) { $('layerOp').value = Math.round(A.opacity * 100); $('layerOpVal').textContent = Math.round(A.opacity * 100) + '%'; }
    document.querySelectorAll('#layerBlend button').forEach(b => b.classList.toggle('on', b.dataset.blend === ((A && A.blend) || 'normal')));
    $('layerDel').disabled = App.layers.length <= 1;
    updateHint();
  }
  function drawThumb(L) {
    const t = L.thumb; if (!t) return;
    const c = t.getContext('2d');
    c.clearRect(0, 0, t.width, t.height);
    const s = Math.min(t.width / App.W, t.height / App.H), w = App.W * s, h = App.H * s;
    c.drawImage(L.canvas, (t.width - w) / 2, (t.height - h) / 2, w, h);
  }
  let thumbTimer = 0;
  App.on('pixels', L => { clearTimeout(thumbTimer); thumbTimer = setTimeout(() => App.layers.forEach(drawThumb), 250); });
  App.on('layers', renderLayers);
  App.on('history', () => { $('btnUndo').disabled = !App.history.undo.length; $('btnRedo').disabled = !App.history.redo.length; });
  App.on('pressure', p => { $('pbarFill').style.width = Math.round(p * 100) + '%'; });
  App.on('stroke', rememberColor);

  /* ---------- save ---------- */
  App.save = function () {
    const c = App.composite(false);
    c.toBlob(blob => {
      const a = document.createElement('a');
      const d = new Date(), pad = n => String(n).padStart(2, '0');
      a.download = `drawing-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png`;
      a.href = URL.createObjectURL(blob);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      App.toast('Saved as PNG (guide lines are left out)');
    }, 'image/png');
  };

  /* ---------- brush buttons with a live preview of each brush ---------- */
  function buildBrushes() {
    const grid = $('brushList');
    for (const [id, B] of Object.entries(App.brushes)) {
      const b = document.createElement('button');
      b.className = 'tool-btn brush'; b.dataset.tool = id; b.title = B.name;
      const c = document.createElement('canvas'); c.width = 152; c.height = 52;
      b.append(c, B.name);
      grid.appendChild(b);
      const ctx = c.getContext('2d'), pts = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        pts.push({ x: 14 + t * 124, y: 26 + Math.sin(t * Math.PI * 2) * 11, p: Math.sin(t * Math.PI) * 0.9 + 0.1 });
      }
      const size = Math.min(B.size, 18) * 1.6;
      if (B.kind === 'erase') {
        ctx.fillStyle = '#3a3a3e'; ctx.fillRect(0, 0, 152, 52);
        ctx.globalCompositeOperation = 'destination-out';
        App.drawStrokes(ctx, [pts], { brush: 'pen', color: '#000', size, pressure: true });
      } else {
        const tmp = document.createElement('canvas'); tmp.width = 152; tmp.height = 52;
        App.drawStrokes(tmp.getContext('2d'), [pts], { brush: id, color: '#1d1d1f', size, pressure: true });
        ctx.globalAlpha = B.alpha; ctx.drawImage(tmp, 0, 0);
      }
    }
  }

  /* ---------- wiring ---------- */
  function wire() {
    buildBrushes();
    document.querySelectorAll('.tool-btn').forEach(b => b.addEventListener('click', () => App.setTool(b.dataset.tool)));
    $('btnUndo').onclick = () => App.history.doUndo();
    $('btnRedo').onclick = () => App.history.doRedo();
    $('btnClear').onclick = () => { App.clearLayer(App.active); App.toast(`Cleared "${App.active.name}". Ctrl+Z brings it back.`); };
    $('btnSave').onclick = App.save;
    $('btnMirror').onclick = () => App.setMirror(!st.mirror);
    $('btnGuides').onclick = () => { const g = App.guideLayer(); if (g) App.setGuidesVisible(!g.visible); };

    bindRange('assist', 'assistVal', assistWord, v => { st.assist = v / 100; });
    bindRange('size', 'sizeVal', v => App.sliderToSize(v), v => { st.size = App.sliderToSize(v); App.requestOverlay(); });
    bindRange('opacity', 'opacityVal', v => v + '%', v => { st.opacity = v / 100; });
    bindRange('stab', 'stabVal', v => v + '%', v => { st.stab = v / 100; });
    document.querySelectorAll('#layerBlend button').forEach(b => b.onclick = () => {
      App.active.blend = b.dataset.blend; App.syncLayers();
      if (b.dataset.blend === 'screen') App.toast('Glow: this layer brightens what is under it. Paint neon and light here.');
      if (b.dataset.blend === 'multiply') App.toast('Shade: this layer darkens what is under it. Paint shadows here.');
    });
    bindRange('layerOp', 'layerOpVal', v => v + '%', v => { if (App.active) { App.active.opacity = v / 100; App.syncLayers(); } });
    $('pressure').onchange = e => { st.pressure = e.target.checked; };
    $('fixLines').onchange = e => { st.fix.line = e.target.checked; };
    $('fixOvals').onchange = e => { st.fix.ellipse = e.target.checked; };
    $('fixCurves').onchange = e => { st.fix.curve = e.target.checked; };
    $('fixShapes').onchange = e => { st.fix.shapes = e.target.checked; };
    $('showGhost').onchange = e => { st.ghost = e.target.checked; };
    $('smartHold').onchange = e => { st.smartHold = e.target.checked; };
    document.querySelectorAll('#assistMode button').forEach(b => b.onclick = () => {
      st.assistMode = b.dataset.mode; App.syncControls();
      App.toast(st.assistMode === 'hold' ? 'Hold the pen still at the end of a line to clean it up' : 'Every stroke gets cleaned up when you lift the pen');
    });

    App.ColorPicker.init();

    $('layerAdd').onclick = () => { const L = App.addLayer(); App.setActive(L); };
    $('layerDel').onclick = () => {
      if (App.active.guide && !confirm('Delete the guide layer?')) return;
      if (App.deleteLayer(App.active)) App.toast('Layer deleted. Ctrl+Z brings it back.');
    };
    $('layerUp').onclick = () => App.moveLayer(App.active, 1);
    $('layerDown').onclick = () => App.moveLayer(App.active, -1);

    window.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? App.history.doRedo() : App.history.doUndo(); return; }
    if (ctrl && k === 'y') { e.preventDefault(); App.history.doRedo(); return; }
    if (ctrl && k === 's') { e.preventDefault(); App.save(); return; }
    if (ctrl && (k === 'c' || k === 'v' || k === 'd') && App.Move.shortcut(k)) { e.preventDefault(); return; }
    if (ctrl || e.altKey) return;
    // view: + / - zoom, 0 fit, , and . turn the page, H flips the view
    if (k === '+' || k === '=') { App.zoomBy(1.25); return; }
    if (k === '-' || k === '_') { App.zoomBy(1 / 1.25); return; }
    if (k === '0') { App.resetView(); return; }
    if (k === ',') { App.rotateBy(-15); return; }
    if (k === '.') { App.rotateBy(15); return; }
    if (k === 'h') { App.toggleFlip(); return; }
    if (App.Move && App.Move.key(e)) { e.preventDefault(); return; }
    const map = { b: 'pen', p: 'pencil', m: 'marker', a: 'airbrush', e: 'eraser', i: 'picker', f: 'fill', v: 'move' };
    if (map[k]) { App.setTool(map[k]); return; }
    if (k === '[' || k === ']') {
      st.size = App.util.clamp(Math.round(st.size * (k === ']' ? 1.2 : 1 / 1.2) + (k === ']' ? 1 : -1) * 0.5), 1, 300);
      App.syncControls(); App.requestOverlay(); return;
    }
    if (k === 'g') { const g = App.guideLayer(); if (g) App.setGuidesVisible(!g.visible); return; }
    if (k === 'r') { App.setMirror(!st.mirror); return; }
    if (k === 'escape' && App.Lesson) App.Lesson.closePicker();
  }

  /* ---------- start ---------- */
  window.addEventListener('DOMContentLoaded', () => {
    App.initDocument();
    App.initInput();
    App.initView();
    wire();
    if (App.Lesson) App.Lesson.init();
    App.Ref.init();
    App.Move.init();
    App.Drills.init();
    App.Stamp.init();
    App.makeFloating(document.getElementById('lessonPanel'), 'lesson');
    App.makeFloating(document.getElementById('drillPanel'), 'practice');
    App.Project.init();   // brings back the last drawing (autosave)
    App.setTool('pen');
    App.setColor(st.color);
    App.syncControls();
    App.emit('history');
  });
})();
