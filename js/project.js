'use strict';
/* Saving and opening:
   - Autosave: the drawing (layers, lines, reference photo) is kept in this
     browser and comes back when you open the app again.
   - Project files (.drawdojo) keep everything, to move or back up a drawing.
   - Open a picture: it becomes a new layer you can move with the Move tool. */

(function () {
  const $ = id => document.getElementById(id);
  const P = App.Project = {};
  const DB = 'drawassist', STORE = 'docs', KEY = 'autosave';

  /* ---------- browser storage (IndexedDB) ---------- */
  function openDb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function idb(mode, fn) {
    const d = await openDb();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), req = fn(t.objectStore(STORE));
      t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error);
    });
  }

  /* ---------- helpers ---------- */
  const toBlob = c => new Promise(res => c.toBlob(res, 'image/png'));
  const toDataURL = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  P.loadImage = src => new Promise((res, rej) => {
    const img = new Image(), url = typeof src === 'string' ? src : URL.createObjectURL(src);
    img.onload = () => { res(img); if (url !== src) URL.revokeObjectURL(url); };
    img.onerror = rej; img.src = url;
  });
  async function canvasFrom(src) {
    const img = await P.loadImage(src), c = document.createElement('canvas');
    c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
    return c;
  }
  /* Replace every Blob inside an object (deeply) using fn. */
  async function mapBlobs(v, fn) {
    if (v instanceof Blob) return fn(v);
    if (Array.isArray(v)) return Promise.all(v.map(x => mapBlobs(x, fn)));
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) o[k] = await mapBlobs(v[k], fn);
      return o;
    }
    return v;
  }
  const r1 = v => Math.round(v * 10) / 10;

  /* ---------- drawing <-> plain data ---------- */
  async function packItem(it) {
    const base = { kind: it.kind, rect: it.rect };
    if (it.kind === 'fill') return { ...base, x: it.x, y: it.y, opacity: it.opacity, under: it.under !== false, img: await toBlob(it.canvas) };
    return { ...base, o: it.o, strokes: it.strokes.map(pts => pts.flatMap(p => [r1(p.x), r1(p.y), Math.round(p.p * 100) / 100])) };
  }
  async function unpackItem(d) {
    if (d.kind === 'fill') return { kind: 'fill', x: d.x, y: d.y, opacity: d.opacity, rect: d.rect, under: d.under !== false, canvas: await canvasFrom(d.img), alive: true };
    const strokes = d.strokes.map(a => { const pts = []; for (let i = 0; i < a.length; i += 3) pts.push({ x: a[i], y: a[i + 1], p: a[i + 2] }); return pts; });
    return { kind: d.kind, o: d.o, rect: d.rect, strokes, alive: true };
  }

  async function snapshot() {
    const layers = [];
    for (const L of App.layers) {
      if (L.temp) continue;   // e.g. the practice layer
      const items = [];
      for (const it of L.items) if (it.alive) items.push(await packItem(it));
      layers.push({ name: L.name, visible: L.visible, opacity: L.opacity, blend: L.blend, guide: L.guide, blue: !!L.blue, img: await toBlob(L.canvas), items });
    }
    return { app: 'drawassist', version: 1, W: App.W, H: App.H, unit: App.unit,
             active: Math.max(0, App.layers.filter(l => !l.temp).indexOf(App.active)),
             layers, ref: App.Ref.serialize(), saved: Date.now() };
  }

  async function restore(data) {
    if (!data || !data.layers || !data.layers.length) throw new Error('Not a Draw Dojo project');
    if (App.Lesson.active) App.Lesson.stop();
    App.Drills.stop(); App.Move.cancel();
    restoring = true;
    try {
      App.resizeDocument(data.W, data.H, data.unit);
      for (const l of data.layers) {
        const L = App.addLayer(l.name, { guide: l.guide, silent: true, index: App.layers.length });
        L.visible = l.visible; L.opacity = l.opacity; L.blend = l.blend || 'normal'; L.blue = !!l.blue;
        if (l.img) L.ctx.drawImage(await P.loadImage(l.img), 0, 0);
        L.items = await Promise.all((l.items || []).map(unpackItem));
      }
      // Older drawings had your lines on the Guides layer: turn it into a normal
      // light-blue Sketch lines layer, and add a fresh Guides layer for the helper lines.
      const old = App.layers.find(l => l.guide);
      if (old && old.items.some(i => i.alive)) {
        old.guide = false; old.blue = true; old.name = 'Sketch lines';
        App.addLayer('Guides', { guide: true, silent: true });
      }
      App.setActive(App.layers[data.active] || App.layers[0]);
      await App.Ref.restore(data.ref);
      App.resetView();
      App.syncControls();
      App.layers.forEach(L => App.emit('pixels', L));
    } finally { restoring = false; }
  }

  /* ---------- autosave ---------- */
  let timer = 0, saving = false, restoring = false;
  const note = t => { $('autosaveNote').textContent = t; };
  function schedule() {
    if (restoring) return;
    clearTimeout(timer); timer = setTimeout(autosave, 2500);
  }
  async function autosave() {
    if (saving) { schedule(); return; }
    saving = true;
    try {
      const data = await snapshot();
      await idb('readwrite', s => s.put(data, KEY));
      note('Saved automatically in this browser at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.');
    } catch (e) {
      note('Autosave is not available here. Use "Save project" to keep your work.');
    }
    saving = false;
  }
  P.autosaveNow = autosave;

  /* ---------- File menu actions ---------- */
  P.newDrawing = function () {
    if (!confirm('Start a new drawing?\n\nThe current drawing will be replaced. Use "Save project" first if you want to keep it.')) return;
    if (App.Lesson.active) App.Lesson.stop();
    App.Drills.stop(); App.Move.cancel(); App.Ref.remove();
    App.resizeDocument(App.W, App.H, App.unit);
    App.addLayer('Drawing', { silent: true });
    App.addLayer('Guides', { guide: true, silent: true });
    App.setActive(App.layers[0]);
    App.resetView();
    App.toast('New drawing');
    schedule();
  };

  P.saveProject = async function () {
    const data = await mapBlobs(await snapshot(), toDataURL);
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'), d = new Date(), pad = n => String(n).padStart(2, '0');
    a.download = `drawing-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.drawdojo`;
    a.href = URL.createObjectURL(blob); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    App.toast('Project saved. Open it later with File > Open.');
  };

  async function openFile(file) {
    try {
      if (/\.(drawdojo|drawassist|json)$/i.test(file.name)) {
        await restore(JSON.parse(await file.text()));
        App.toast('Project opened');
      } else {
        await P.importPicture(file);
      }
      schedule();
    } catch (e) {
      App.toast('Could not open that file: ' + e.message);
    }
  }

  /* A picture becomes a new layer, fitted to the page. The Move tool can move it. */
  P.importPicture = async function (file) {
    const img = await P.loadImage(file);
    const s = Math.min(App.W * 0.9 / img.width, App.H * 0.9 / img.height);
    const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const x = Math.round((App.W - w) / 2), y = Math.round((App.H - h) / 2);
    const L = App.addLayer(file.name.replace(/\.[^.]+$/, '') || 'Picture');
    App.setActive(L);
    const tok = App.beginEdit(L);
    L.ctx.drawImage(c, x, y);
    const it = App.Items.addFill(L, { canvas: c, x, y, rect: { x0: x, y0: y, x1: x + w, y1: y + h } }, 1, false);
    App.endEdit(tok, it.rect, App.Items.undoable(it));
    App.toast('Picture added as a new layer. Use Move (V) to place it.');
  };

  /* ---------- wiring ---------- */
  P.init = async function () {
    const pop = $('filePop');
    $('btnFile').onclick = e => {
      e.stopPropagation();
      const b = $('btnFile').getBoundingClientRect(), t = $('topbar').getBoundingClientRect();
      pop.style.left = (b.left - t.left) + 'px';
      pop.hidden = !pop.hidden;
    };
    document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== $('btnFile')) pop.hidden = true; });
    $('fNew').onclick = () => { pop.hidden = true; P.newDrawing(); };
    $('fOpen').onclick = () => { pop.hidden = true; $('fileInput').click(); };
    $('fSaveProj').onclick = () => { pop.hidden = true; P.saveProject(); };
    $('fileInput').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) openFile(f); };
    // drop a file onto the page to open it
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) openFile(f); });

    App.on('pixels', schedule); App.on('layers', schedule);
    try {
      const data = await idb('readonly', s => s.get(KEY));
      if (data && data.layers && data.layers.length) {
        await restore(data);
        App.toast('Welcome back! Your last drawing is here.');
      }
    } catch (e) { /* nothing saved yet, or storage blocked */ }
  };
})();
