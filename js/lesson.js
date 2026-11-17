'use strict';
/* Learn dialog (subject -> method -> level) and the step-by-step lesson runner. */

(function () {
  const M = App.Methods, st = App.settings;
  const $ = id => document.getElementById(id);
  let level = 'beginner';
  try { level = localStorage.getItem('drawassist.level') || 'beginner'; } catch (e) { /* storage blocked */ }

  const L = App.Lesson = { active: null, method: null, i: 0, A: null, animating: false };

  /* ---------- picker ---------- */
  L.openPicker = function () { showSubjects(); $('learnModal').hidden = false; };
  L.closePicker = function () { $('learnModal').hidden = true; };

  function levelRow() {
    const row = document.createElement('div'); row.className = 'levels';
    M.levels.forEach(lv => {
      const b = document.createElement('button');
      b.className = lv.id === level ? 'on' : '';
      b.innerHTML = `${lv.name}<small>${lv.desc} · Assist ${Math.round(lv.assist * 100)}%</small>`;
      b.onclick = () => {
        level = lv.id;
        try { localStorage.setItem('drawassist.level', level); } catch (e) { /* ignore */ }
        row.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      };
      row.appendChild(b);
    });
    return row;
  }
  function card(em, title, sub, onclick, soon) {
    const b = document.createElement('button');
    b.className = 'card' + (soon ? ' soon' : '');
    b.innerHTML = `${em ? `<span class="em">${em}</span>` : ''}<b>${title}</b><small>${sub}</small>`;
    if (!soon) b.onclick = onclick;
    return b;
  }
  function showSubjects() {
    $('learnTitle').textContent = 'What do you want to draw?';
    const body = $('learnBody'); body.innerHTML = '';
    const lead = document.createElement('p'); lead.className = 'lead';
    lead.textContent = 'Pick a subject, then a method. Orange helper lines show where to draw; your sketch lines go on a light-blue Sketch lines layer.';
    const lab = document.createElement('div'); lab.className = 'sub'; lab.textContent = 'How much help do you want?';
    const cards = document.createElement('div'); cards.className = 'cards';
    M.subjects.filter(s => !s.advanced).forEach(s => cards.appendChild(card(s.em, s.name, s.desc, () => showMethods(s), s.soon)));
    const advLab = document.createElement('div'); advLab.className = 'sub adv-title'; advLab.textContent = 'Styles and scenes · advanced';
    const adv = document.createElement('div'); adv.className = 'cards';
    M.subjects.filter(s => s.advanced).forEach(s => adv.appendChild(card(s.em, s.name, s.desc, () => showMethods(s), s.soon)));
    body.append(lead, lab, levelRow(), cards, advLab, adv);
  }
  function showMethods(s) {
    $('learnTitle').textContent = s.name;
    const body = $('learnBody'); body.innerHTML = '';
    const back = document.createElement('button'); back.className = 'back-link'; back.textContent = '◀ All subjects';
    back.onclick = showSubjects;
    const lead = document.createElement('p'); lead.className = 'lead'; lead.textContent = 'Which method do you want to learn?';
    const cards = document.createElement('div'); cards.className = 'cards';
    s.methods.forEach(id => {
      const m = M.list[id];
      cards.appendChild(card('', m.name, `${m.sub}<br><br>${m.desc}<br><br>${m.steps.length} steps`, () => { L.closePicker(); L.start(id); }));
    });
    body.append(back, lead, cards);
  }

  /* ---------- runner ---------- */
  L.start = function (id) {
    if (App.Drills) App.Drills.stop();
    const m = M.list[id];
    const lv = M.levels.find(x => x.id === level) || M.levels[0];
    st.assist = lv.assist; st.stab = lv.stab; st.assistMode = lv.mode;
    if (st.size > 12) st.size = 4;
    App.syncControls();

    if (!App.guideLayer()) App.addLayer('Guides', { guide: true });
    App.setGuidesVisible(true);
    const sk = App.sketchLayer(true);   // construction lines go here, in light blue
    sk.visible = true;
    if (sk.items.some(i => i.alive)) {
      App.clearLayer(sk);
      App.toast('Sketch lines from last time were cleared for the lesson (Ctrl+Z brings them back)');
    }
    App.setActive(sk);
    if (!App.isPaintTool(st.tool)) App.setTool('pen');

    L.method = m; L.active = id;
    L.A = m.frame(App.W, App.H);
    $('lpTitle').textContent = `${m.name} · ${m.sub.split('·')[0].trim()}`;
    $('lessonPanel').hidden = false;
    go(0);
  };

  L.stop = function () {
    L.active = null; L.method = null;
    $('lessonPanel').hidden = true;
    if (st.mirror) App.setMirror(false, null, true);
    App.requestOverlay();
  };

  function step() { return L.method && L.method.steps[L.i]; }

  function go(i) {
    const m = L.method;
    L.i = App.util.clamp(i, 0, m.steps.length - 1);
    const s = step();
    $('lpCount').textContent = `${L.i + 1} / ${m.steps.length}`;
    $('lpText').innerHTML = s.text + (s.tip ? `<small>${s.tip}</small>` : '');
    extras(s);
    $('lpStatus').textContent = '';
    $('lpBack').disabled = L.i === 0;
    $('lpNext').textContent = s.finish ? 'Finish ✓' : 'Next ▶';
    $('lpNext').classList.toggle('pulse', s.expect === 'none' && !s.finish);
    const axis = L.A.cx != null ? L.A.cx : null;
    if (!!s.mirror !== st.mirror || (s.mirror && st.mirrorX !== axis)) App.setMirror(!!s.mirror, s.mirror ? axis : null, true);
    if (s.mirror) $('lpStatus').textContent = 'Mirror is on for this step.';
    App.requestOverlay();
  }

  function finish() {
    const m = L.method;
    L.stop();
    if (m && m.noInk) { App.toast(m.doneToast || 'Lesson done! Try it again with your own ideas.'); return; }
    const ink = App.addLayer('Ink');
    App.setActive(ink);
    App.toast('New "Ink" layer ready. Draw over your guides, then press G to hide them.');
  }

  /* Palette chips and the 'Set up for me' button for the current step. */
  function extras(s) {
    const pal = $('lpPalette'); pal.innerHTML = '';
    const colors = s.palette || L.method.palette;
    if (colors) {
      const lab = document.createElement('span'); lab.textContent = 'Colors'; pal.appendChild(lab);
      colors.forEach(c => { const b = document.createElement('button'); b.className = 'sw'; b.style.background = c; b.title = c; b.onclick = () => App.setColor(c); pal.appendChild(b); });
    }
    const use = $('lpUse');
    use.hidden = !s.use;
    if (s.use) {
      const u = s.use, parts = [];
      if (u.shape) parts.push('Shapes: ' + u.shape); else if (u.tool) parts.push((App.brushes[u.tool] && App.brushes[u.tool].name) || u.tool);
      if (u.size) parts.push('size ' + u.size);
      if (u.fill) parts.push(u.fill + ' fill');
      if (u.layer) parts.push('layer "' + u.layer + '"' + (u.blend === 'screen' ? ' (glow)' : u.blend === 'multiply' ? ' (shade)' : ''));
      if (u.guide) parts.push('layer "Sketch lines" (light blue, hide it at the end)');
      use.innerHTML = (u.color ? `<i style="background:${u.color}"></i>` : '') + 'Set up for me: ' + parts.join(' · ');
      use.onclick = () => applyUse(u);
    }
  }
  function applyUse(u) {
    if (u.layer) {
      let Ly = App.layers.find(l => l.name === u.layer && !l.guide && !l.temp);
      if (!Ly) {
        const g = App.guideLayer(), top = g ? App.layers.indexOf(g) : App.layers.length;
        const above = u.above ? App.layers.findIndex(l => l.name === u.above) : -1;
        Ly = App.addLayer(u.layer, { index: u.bottom ? 0 : above >= 0 ? above + 1 : top });
      }
      if (u.blend) Ly.blend = u.blend;
      if (u.opacity != null) Ly.opacity = u.opacity;
      App.setActive(Ly);
    } else if (u.guide) {
      const sk = App.sketchLayer(true);
      sk.visible = true;
      App.setActive(sk);
    }
    if (u.fill) App.settings.fillStyle = u.fill;
    if (u.shape) { App.settings.shape = u.shape; if (u.shapeMode) App.settings.shapeMode = u.shapeMode; }
    if (u.assist != null) App.settings.assist = u.assist;
    App.setTool(u.shape ? 'shape' : (u.tool || App.settings.tool));
    if (u.size) App.settings.size = u.size;
    if (u.color) App.setColor(u.color);
    App.syncLayers(); App.syncControls();
    App.toast('Ready! ' + (u.say || 'Now draw.'));
  }

  const fits = (expect, type) => expect === 'any' ||
    (expect === 'ellipse' && (type === 'circle' || type === 'ellipse')) ||
    (expect === 'line' && type === 'line') ||
    (expect === 'curve' && (type === 'curve' || type === 'arc'));
  const NAMES = { ellipse: 'circle or oval', line: 'straight line', curve: 'smooth curve' };

  function onStroke(ev) {
    const s = step();
    if (!s || !ev.layer || ev.layer.temp) return;
    const res = ev.res, status = $('lpStatus');
    if (s.expect === 'none') return;
    if (res && res.type !== 'free' && fits(s.expect, res.type)) {
      const ok = s.onShape ? s.onShape(res, L.A) : true;
      if (ok !== false) {
        const sc = res.score != null ? ` ${Math.round(App.util.clamp(res.score, 0, 1) * 100)}% ${App.Shapes.label(res)}.` : '';
        status.textContent = `Nice!${sc}${res.snapped ? ' Snapped to ' + res.snapped + '.' : ''} ${s.finish ? 'Keep going, or press Finish.' : 'Press Next when you are ready.'}`;
        $('lpNext').classList.add('pulse');
        App.requestOverlay();
        return;
      }
    }
    if (s.expect === 'any') { status.textContent = 'Good. Add more, or press Next.'; $('lpNext').classList.add('pulse'); return; }
    const got = res && res.type !== 'free' ? `a ${App.Shapes.label(res).replace('smooth ', '')} ${res.type === 'circle' || res.type === 'ellipse' ? 'shape' : 'line'}` : 'a freehand line';
    status.textContent = `That looked like ${got}. Try one ${NAMES[s.expect]} (or Undo with Ctrl+Z).`;
  }

  /* Hooks used by the stroke pipeline (input.js). */
  L.snap = function (res) {
    const s = step();
    if (!s || !s.snap || !App.active || App.active.temp) return null;   // snapping works on any layer
    return s.snap(res, L.A);
  };
  L.drawHints = function (ctx) {
    const s = step();
    if (!s) return;
    ctx.save();
    const g = M.makeG(ctx, App.viewPx());
    // earlier steps stay visible as faint blue guides, so you never lose your place
    g.past(true);
    for (let k = 0; k < L.i; k++) { const p = L.method.steps[k]; if (p.hint && !p.hintOnce) {   // hintOnce: instructions, not construction lines
      ctx.save(); p.hint(g, L.A); ctx.restore(); } }
    g.past(false).now();
    if (s.hint) s.hint(g, L.A);
    ctx.restore();
  };

  L.init = function () {
    $('btnLearn').onclick = L.openPicker;
    $('learnClose').onclick = L.closePicker;
    $('learnModal').addEventListener('pointerdown', e => { if (e.target.id === 'learnModal') L.closePicker(); });
    $('lpExit').onclick = L.stop;
    // Hints = the Guides layer: helper lines only, your own lines always stay
    $('lpHints').onclick = () => { const g = App.guideLayer(); if (g) App.setGuidesVisible(!g.visible); };
    App.on('layers', () => { const g = App.guideLayer(); $('lpHints').classList.toggle('on', !g || g.visible); });
    $('lpBack').onclick = () => go(L.i - 1);
    $('lpNext').onclick = () => (step().finish ? finish() : go(L.i + 1));
    $('lpRedo').onclick = () => {
      const sk = App.sketchLayer(false); if (sk) App.clearLayer(sk);
      L.A = L.method.frame(App.W, App.H); go(0);
    };
    App.on('stroke', onStroke);
  };
})();
