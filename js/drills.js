'use strict';
/* Practice drills: short exercises with a score for every try.
   Assist is turned off while you practice (that's the point!). Scores are
   remembered, so you can see yourself improve, and when you're good at
   something the app suggests using less Assist ("training wheels"). */

(function () {
  const $ = id => document.getElementById(id);
  const st = App.settings, U = App.util;
  const D = App.Drills = {};
  let run = null;   // the drill in progress

  /* ---------- the drills ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const region = () => ({ x0: App.W * 0.07, x1: App.W * 0.64, y0: App.H * 0.1, y1: App.H * 0.9 });
  const minWH = () => Math.min(App.W, App.H);
  const sample = (fn, n = 200) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));

  /* How close a stroke follows a target path: closeness x how much of it you covered. */
  function traceScore(pts, target, size) {
    let sum = 0;
    for (const p of pts) { let m = Infinity; for (const q of target) m = Math.min(m, (p.x - q.x) ** 2 + (p.y - q.y) ** 2); sum += Math.sqrt(m); }
    const mean = sum / pts.length, tol = size * 0.06;
    let covered = 0;
    for (const q of target) if (pts.some(p => Math.abs(p.x - q.x) < tol && Math.abs(p.y - q.y) < tol)) covered++;
    return U.clamp(1 - mean / (size * 0.06), 0, 1) * (covered / target.length);
  }
  const ratioOf = e => Math.min(e.a, e.b) / Math.max(e.a, e.b);

  const DRILLS = [
    { id: 'circles', em: '○', name: 'Circles', rounds: 10,
      text: 'Draw a <b>circle</b> in one stroke, anywhere on the left part of the page. Move from your shoulder, not your wrist.',
      make: () => null,
      score: res => (res.type === 'circle' ? res.score : res.type === 'ellipse' ? res.score * (0.55 + 0.45 * ratioOf(res.geom.e)) : 0.15) },
    { id: 'lines', em: '╱', name: 'Straight lines', rounds: 10,
      text: 'Connect the <b>two red dots</b> with one straight line. Aim at the end dot, then draw in one confident move.',
      make: () => {
        const r = region(), len = rnd(0.3, 0.55) * minWH(), a = rnd(0, Math.PI);
        const cx = rnd(r.x0 + len / 2, r.x1 - len / 2), cy = rnd(r.y0 + len / 2, r.y1 - len / 2);
        return { A: { x: cx - Math.cos(a) * len / 2, y: cy - Math.sin(a) * len / 2 }, B: { x: cx + Math.cos(a) * len / 2, y: cy + Math.sin(a) * len / 2 } };
      },
      score: (res, pts, t) => {
        const L = U.dist(t.A, t.B), a = pts[0], b = pts[pts.length - 1];
        const err = Math.min(U.dist(a, t.A) + U.dist(b, t.B), U.dist(a, t.B) + U.dist(b, t.A)) / 2;
        const straight = res.type === 'line' ? res.score : 0.3;
        return 0.55 * straight + 0.45 * U.clamp(1 - err / (0.08 * L), 0, 1);
      } },
    { id: 'ovals', em: '⬭', name: 'Ovals', rounds: 8,
      text: 'Trace over the <b>blue oval</b> in one smooth stroke. Try to go all the way around.',
      make: () => {
        const r = region(), a = rnd(0.12, 0.2) * minWH(), b = a * rnd(0.35, 0.8);
        const e = { cx: rnd(r.x0 + a, r.x1 - a), cy: rnd(r.y0 + a, r.y1 - a), a, b, angle: rnd(0, Math.PI) };
        return { e, path: sample(t => App.Shapes.ellipsePoint(e, t * Math.PI * 2)) };
      },
      score: (res, pts, t) => traceScore(pts, t.path, t.e.a * 2) },
    { id: 'curves', em: '∿', name: 'Smooth curves', rounds: 8,
      text: 'Trace the <b>blue curve</b> from one end to the other, in one smooth stroke.',
      make: () => {
        const r = region(), w = r.x1 - r.x0, h = r.y1 - r.y0;
        const P = [{ x: r.x0 + w * rnd(0, 0.2), y: r.y0 + h * rnd(0.2, 0.8) }, { x: r.x0 + w * rnd(0.2, 0.45), y: r.y0 + h * rnd(0, 1) },
                   { x: r.x0 + w * rnd(0.55, 0.8), y: r.y0 + h * rnd(0, 1) }, { x: r.x0 + w * rnd(0.8, 1), y: r.y0 + h * rnd(0.2, 0.8) }];
        const bez = t => { const m = 1 - t; return { x: m * m * m * P[0].x + 3 * m * m * t * P[1].x + 3 * m * t * t * P[2].x + t * t * t * P[3].x, y: m * m * m * P[0].y + 3 * m * m * t * P[1].y + 3 * m * t * t * P[2].y + t * t * t * P[3].y }; };
        const path = sample(bez);
        return { P, path, len: App.Shapes.pathLength(path) };
      },
      score: (res, pts, t) => traceScore(pts, t.path, t.len * 0.5) },
    { id: 'squares', em: '□', name: 'Boxes', rounds: 8,
      text: 'Draw a <b>square</b> in one stroke: four straight sides, sharp corners, all sides the same length.',
      make: () => null,
      score: res => {
        if (res.type === 'square') return res.score;
        if (res.type === 'rectangle') {
          const v = res.geom.verts, s1 = U.dist(v[0], v[1]), s2 = U.dist(v[1], v[2]);
          return res.score * (0.5 + 0.5 * Math.min(s1, s2) / Math.max(s1, s2));
        }
        return res.sides === 4 ? res.score * 0.5 : 0.15;
      } }
  ];

  /* ---------- remembered scores ---------- */
  const KEY = 'drawassist.progress';
  function loadProgress() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function saveResult(id, avg, best) {
    const all = loadProgress();
    (all[id] = all[id] || []).push({ t: Date.now(), avg, best });
    all[id] = all[id].slice(-30);
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* storage blocked */ }
    return all[id];
  }
  const pct = v => Math.round(v * 100) + '%';

  /* ---------- picker ---------- */
  D.openPicker = function () {
    $('learnTitle').textContent = 'Practice';
    const body = $('learnBody'); body.innerHTML = '';
    const lead = document.createElement('p'); lead.className = 'lead';
    lead.textContent = 'Short drills with a score for every try. Assist is off while you practice. A few minutes a day makes a big difference.';
    const cards = document.createElement('div'); cards.className = 'cards';
    const prog = loadProgress();
    for (const d of DRILLS) {
      const hist = prog[d.id] || [], b = document.createElement('button');
      b.className = 'card';
      const last = hist[hist.length - 1];
      b.innerHTML = `<span class="em">${d.em}</span><b>${d.name}</b><small>${d.rounds} tries</small>` +
        (last ? `<span class="best">Last time ${pct(last.avg)} · best ${pct(Math.max(...hist.map(h => h.best)))}</span>` : '<span class="best">Not tried yet</span>');
      if (hist.length > 1) {
        const sp = document.createElement('div'); sp.className = 'spark'; sp.title = 'Your average score, each time you practiced';
        hist.slice(-14).forEach(h => { const i = document.createElement('i'); i.style.height = Math.max(6, h.avg * 100) + '%'; sp.appendChild(i); });
        b.appendChild(sp);
      }
      b.onclick = () => { $('learnModal').hidden = true; D.start(d.id); };
      cards.appendChild(b);
    }
    body.append(lead, cards);
    $('learnModal').hidden = false;
  };

  /* ---------- running a drill ---------- */
  D.start = function (id) {
    const drill = DRILLS.find(d => d.id === id);
    if (App.Lesson.active) App.Lesson.stop();
    App.Move.commit();
    if (run) D.stop();
    const prevActive = App.active;
    const layer = App.addLayer('Practice', { silent: true, index: App.layers.length });
    layer.temp = true;
    run = { drill, layer, prevActive, scores: [], round: 0, target: null, busy: false,
            saved: { assist: st.assist, mode: st.assistMode, mirror: st.mirror } };
    st.assist = 0; st.assistMode = 'always';
    if (st.mirror) App.setMirror(false, null, true);
    App.syncControls();
    App.setActive(layer);
    if (!App.isPaintTool(st.tool)) App.setTool('pen');
    $('dpTitle').textContent = drill.name;
    $('dpRestart').textContent = 'Start over';
    $('dpSkip').textContent = 'Skip ▶';
    $('drillPanel').hidden = false;
    App.toast('Assist is off while you practice');
    nextRound();
  };

  function clearPractice() {
    const L = run.layer;
    L.ctx.clearRect(0, 0, App.W, App.H); L.items = [];
    App.emit('pixels', L);
  }
  function bars() {
    const box = $('dpScores'); box.innerHTML = '';
    for (let i = 0; i < run.drill.rounds; i++) {
      const el = document.createElement('i'), s = run.scores[i];
      if (s == null) el.className = 'empty'; else { el.style.height = Math.max(4, s * 100) + '%'; el.title = pct(s); }
      box.appendChild(el);
    }
  }
  function nextRound() {
    clearPractice();
    run.target = run.drill.make();
    $('dpCount').textContent = `${run.scores.length + 1} / ${run.drill.rounds}`;
    $('dpText').innerHTML = run.drill.text;
    bars();
    App.requestOverlay();
  }

  function onStroke(ev) {
    if (!run || ev.layer !== run.layer || run.busy || run.done || !ev.res) return;
    const s = U.clamp(run.drill.score(ev.res, ev.final, run.target), 0, 1);
    run.scores.push(s);
    bars();
    const words = s >= 0.9 ? 'Excellent!' : s >= 0.8 ? 'Very good!' : s >= 0.65 ? 'Good.' : 'Keep going, it gets easier.';
    $('dpStatus').textContent = `${pct(s)}. ${words}`;
    run.busy = true;
    setTimeout(() => {
      if (!run) return;
      run.busy = false;
      if (run.scores.length >= run.drill.rounds) finish(); else nextRound();
    }, 900);
  }

  function finish() {
    const sc = run.scores, avg = sc.reduce((a, b) => a + b, 0) / sc.length, best = Math.max(...sc);
    const hist = saveResult(run.drill.id, avg, best), prev = hist[hist.length - 2];
    run.done = true; run.target = null;
    let msg = `<b>Done!</b> Average <b>${pct(avg)}</b>, best ${pct(best)}.`;
    if (prev) msg += avg > prev.avg + 0.01 ? ` Up from ${pct(prev.avg)} last time!` : ` Last time: ${pct(prev.avg)}.`;
    // training wheels: good scores -> suggest less help
    if (avg >= 0.85 && run.saved.assist > 0.25) {
      const lower = Math.max(0.1, Math.round((run.saved.assist - 0.2) * 20) / 20);
      run.suggest = lower;
      msg += `<small>You're doing great. Try drawing with less help: Assist ${pct(lower)} instead of ${pct(run.saved.assist)}.</small>`;
      $('dpRestart').textContent = `Use ${pct(lower)}`;
    } else {
      $('dpRestart').textContent = 'Again';
    }
    $('dpText').innerHTML = msg;
    $('dpCount').textContent = '';
    $('dpStatus').textContent = '';
    $('dpSkip').textContent = 'Done';
    App.requestOverlay();
  }

  D.stop = function () {
    if (!run) return;
    const r = run; run = null;
    const i = App.layers.indexOf(r.layer);
    if (i >= 0) App.layers.splice(i, 1);
    const H = App.history;   // forget undo steps that belonged to the practice page
    H.undo = H.undo.filter(e => e.layer !== r.layer); H.redo = H.redo.filter(e => e.layer !== r.layer);
    H.bytes = H.undo.reduce((a, e) => a + H.size(e), 0);
    st.assist = r.suggest != null && r.accepted ? r.suggest : r.saved.assist;
    st.assistMode = r.saved.mode;
    App.syncControls();
    App.setActive(App.layers.includes(r.prevActive) ? r.prevActive : App.layers[0]);
    $('drillPanel').hidden = true;
    App.emit('history');
    App.requestOverlay();
  };

  D.drawTarget = function (c, u) {
    if (!run || !run.target) return;
    const t = run.target;
    c.save();
    c.strokeStyle = 'rgba(70, 140, 220, 0.75)'; c.lineWidth = 2.5 * u; c.setLineDash([10 * u, 7 * u]);
    if (t.A) {
      c.fillStyle = 'rgba(230, 50, 60, .95)';
      for (const p of [t.A, t.B]) { c.beginPath(); c.arc(p.x, p.y, 7 * u, 0, Math.PI * 2); c.fill(); }
    } else if (t.e) {
      c.beginPath(); c.ellipse(t.e.cx, t.e.cy, t.e.a, t.e.b, t.e.angle, 0, Math.PI * 2); c.stroke();
    } else if (t.P) {
      const P = t.P;
      c.beginPath(); c.moveTo(P[0].x, P[0].y); c.bezierCurveTo(P[1].x, P[1].y, P[2].x, P[2].y, P[3].x, P[3].y); c.stroke();
      c.setLineDash([]); c.fillStyle = 'rgba(70, 140, 220, 0.9)';
      c.beginPath(); c.arc(P[0].x, P[0].y, 6 * u, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  };

  D.init = function () {
    $('btnPractice').onclick = D.openPicker;
    $('dpExit').onclick = D.stop;
    $('dpSkip').onclick = () => {
      if (!run) return;
      if (run.done) { D.stop(); return; }
      nextRound();
    };
    $('dpRestart').onclick = () => {
      if (!run) return;
      if (run.done && run.suggest != null && $('dpRestart').textContent.startsWith('Use')) {
        run.accepted = true; D.stop(); App.toast('Assist lowered. Nice progress!'); return;
      }
      const id = run.drill.id; D.stop(); D.start(id);
    };
    App.on('stroke', onStroke);
  };
})();
