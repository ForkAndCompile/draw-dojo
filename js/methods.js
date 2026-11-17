'use strict';
/* Lesson content, part 1: helpers, subjects, and face methods.
   A method = { name, sub, desc, frame(W,H) -> anchors, steps: [...] }
   A step   = { text, tip, expect, hint(g, A), onShape(res, A), snap(res, A), mirror } */

const M = App.Methods = { list: {}, subjects: [] };

/* ---------- hint drawing ---------- */
M.makeG = function (ctx, u) {
  const NOW = 'rgba(255, 128, 0, 0.9)', REF = 'rgba(111, 168, 220, 0.55)', PAST = 'rgba(111, 168, 220, 0.38)';
  let style = NOW, past = false;
  const setStyle = small => {
    const s = past ? PAST : style;
    ctx.strokeStyle = s; ctx.fillStyle = s;
    ctx.lineWidth = (s === NOW ? 2 : 1.3) * u;
    ctx.setLineDash(small ? [] : s === NOW ? [9 * u, 6 * u] : [4 * u, 5 * u]);
  };
  const SMALL = 14 * u;   // small circles look better solid than dashed
  const g = {
    u,
    now() { style = NOW; return g; },
    ref() { style = REF; return g; },
    past(on) { past = on; return g; },   // earlier steps: everything faint blue
    line(x1, y1, x2, y2) { setStyle(); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); return g; },
    circle(x, y, r) { setStyle(r < SMALL); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); return g; },
    ellipse(x, y, rx, ry, rot = 0) { setStyle(Math.max(Math.abs(rx), Math.abs(ry)) < SMALL); ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2); ctx.stroke(); return g; },
    rect(x, y, w, h) { setStyle(); ctx.strokeRect(x, y, w, h); return g; },
    poly(pts, close) {
      setStyle(); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      if (close) ctx.closePath(); ctx.stroke(); return g;
    },
    curve(pts) {   // smooth line through points
      setStyle(); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 3) {   // a bend that passes through the middle point
        const [a, b, c] = pts;
        ctx.quadraticCurveTo(2 * b[0] - (a[0] + c[0]) / 2, 2 * b[1] - (a[1] + c[1]) / 2, c[0], c[1]);
        ctx.stroke(); return g;
      }
      for (let i = 1; i < pts.length - 1; i++) {
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      }
      const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]); ctx.stroke(); return g;
    },
    dot(x, y, color = 'rgba(230, 50, 60, .95)', r = 5) {
      if (past) return g;
      ctx.save(); ctx.setLineDash([]); ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r * u, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return g;
    },
    text(s, x, y, align = 'left') {
      if (past) return g;
      ctx.save(); ctx.setLineDash([]); ctx.font = `${12 * u}px Segoe UI, sans-serif`;
      ctx.fillStyle = style === NOW ? 'rgba(200, 95, 0, .95)' : 'rgba(80, 130, 190, .8)';
      ctx.textAlign = align; ctx.fillText(s, x, y); ctx.restore(); return g;
    },
    rays(vp, n, len) {   // perspective fan around a vanishing point
      g.ref();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.line(vp.x, vp.y, vp.x + Math.cos(a) * len, vp.y + Math.sin(a) * len);
      }
      return g.now();
    }
  };
  return g;
};

/* ---------- snapping helpers ---------- */
const SH = App.Shapes;
const angleBetween = (dx1, dy1, dx2, dy2) => {
  const a = Math.abs(Math.atan2(dx1 * dy2 - dy1 * dx2, dx1 * dx2 + dy1 * dy2));
  return Math.min(a, Math.PI - a);   // direction doesn't matter
};
const deg = d => d * Math.PI / 180;

M.snap = {
  /* Snap a line onto the target segment a-b if it is close and similar in angle.
     exact: use the target's length; otherwise keep the user's length. */
  line(res, a, b, name, tol, exact) {
    if (!res || res.type !== 'line') return null;
    const { A, B } = res.geom;
    const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty);
    if (angleBetween(B.x - A.x, B.y - A.y, tx, ty) > deg(14)) return null;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const perp = Math.abs((mx - a.x) * ty - (my - a.y) * tx) / tl;
    if (perp > tol) return null;
    const proj = p => { const t = ((p.x - a.x) * tx + (p.y - a.y) * ty) / (tl * tl); return { x: a.x + tx * t, y: a.y + ty * t }; };
    let A2 = proj(A), B2 = proj(B);
    if (exact) {
      const sameDir = (B.x - A.x) * tx + (B.y - A.y) * ty >= 0;
      A2 = sameDir ? a : b; B2 = sameDir ? b : a;
    }
    return { ...SH.makeLine(res.pts, A2, B2, res.score), snapped: name };
  },
  /* Try a list of [a, b, name] targets, return the first that fits. */
  lines(res, list, tol, exact) {
    for (const [a, b, name] of list) { const r = M.snap.line(res, a, b, name, tol, exact); if (r) return r; }
    return null;
  },
  vertical(res, tolDeg = 8) {
    if (!res || res.type !== 'line') return null;
    const { A, B } = res.geom;
    if (angleBetween(B.x - A.x, B.y - A.y, 0, 1) > deg(tolDeg)) return null;
    const x = (A.x + B.x) / 2;
    return { ...SH.makeLine(res.pts, { x, y: A.y }, { x, y: B.y }, res.score), snapped: 'vertical' };
  },
  horizontal(res, tolDeg = 8, full) {
    if (!res || res.type !== 'line') return null;
    const { A, B } = res.geom;
    if (angleBetween(B.x - A.x, B.y - A.y, 1, 0) > deg(tolDeg)) return null;
    const y = (A.y + B.y) / 2;
    let x1 = A.x, x2 = B.x;
    if (full) { x1 = A.x < B.x ? 0 : App.W; x2 = A.x < B.x ? App.W : 0; }
    return { ...SH.makeLine(res.pts, { x: x1, y }, { x: x2, y }, res.score), snapped: full ? 'the horizon' : 'level' };
  },
  /* Point a line at the nearest matching vanishing point. */
  vp(res, vps, tolDeg = 8) {
    if (!res || res.type !== 'line') return null;
    const { A, B } = res.geom;
    let best = null;
    for (const v of vps) {
      const dA = Math.hypot(v.x - A.x, v.y - A.y), dB = Math.hypot(v.x - B.x, v.y - B.y);
      const far = dA > dB ? A : B, near = dA > dB ? B : A;
      const ux = near.x - far.x, uy = near.y - far.y, ul = Math.hypot(ux, uy);
      const vx = v.x - far.x, vy = v.y - far.y, vl = Math.hypot(vx, vy);
      if (!ul || !vl) continue;
      const ang = Math.acos(App.util.clamp((ux * vx + uy * vy) / (ul * vl), -1, 1));
      if (ang < deg(tolDeg) && (!best || ang < best.ang)) {
        const len = Math.min(ul, vl);
        const near2 = { x: far.x + vx / vl * len, y: far.y + vy / vl * len };
        best = { ang, A2: far === A ? A : near2, B2: far === A ? near2 : B, name: v.name || 'the vanishing point' };
      }
    }
    if (!best) return null;
    return { ...SH.makeLine(res.pts, best.A2, best.B2, res.score), snapped: best.name };
  },
  /* First helper that returns something wins. */
  any(...fns) { for (const f of fns) { const r = f(); if (r) return r; } return null; }
};

/* ---------- subjects ---------- */
M.subjects = [
  { id: 'faces', em: '☺', name: 'Faces & heads', desc: 'Build a face from a circle or a box, step by step.', methods: ['face-circle', 'face-box'] },
  { id: 'bodies', em: '♙', name: 'Bodies & poses', desc: 'Proportions, the line of action and a simple mannequin.', methods: ['body-mannequin', 'body-gesture'] },
  { id: 'landscape', em: '⛰', name: 'Landscapes', desc: 'Horizon, composition and depth.', methods: ['land-thirds', 'land-depth'] },
  { id: 'buildings', em: '⌂', name: 'Buildings & rooms', desc: 'Perspective with vanishing points.', methods: ['persp-1', 'persp-2'] },
  { id: 'objects', em: '◍', name: 'Objects', desc: 'Sphere, cylinder and box: the forms everything is made of.', methods: ['forms'] },
  { id: 'hands', em: '✋', name: 'Hands', desc: 'Mitten method. Coming soon.', soon: true },
  { id: 'animals', em: '🐾', name: 'Animals', desc: 'Bean and circle construction. Coming soon.', soon: true }
];

M.levels = [
  { id: 'beginner', name: 'Beginner', desc: 'Lots of help', assist: 0.75, stab: 0.55, mode: 'always' },
  { id: 'some', name: 'Some practice', desc: 'Medium help', assist: 0.45, stab: 0.35, mode: 'always' },
  { id: 'confident', name: 'Confident', desc: 'Help only when I hold the pen', assist: 0.2, stab: 0.2, mode: 'hold' }
];

/* ---------- Faces: circle method ---------- */
M.list['face-circle'] = {
  name: 'Circle method', sub: 'Faces · front view',
  desc: 'The classic construction: a ball for the skull, then the face hangs below it in three equal parts.',
  frame: (W, H) => ({ cx: W / 2, cy: H * 0.33, r: Math.min(W, H) * 0.15 }),
  steps: [
    { text: 'Draw a big <b>circle</b> for the top of the head (the skull).',
      tip: 'Draw it in one go, from the shoulder, not the wrist. Assist cleans it up.',
      expect: 'ellipse',
      hint: (g, A) => g.circle(A.cx, A.cy, A.r),
      onShape: (res, A) => { const e = res.geom.e; A.cx = e.cx; A.cy = e.cy; A.r = (e.a + e.b) / 2; return true; } },
    { text: 'Draw the <b>center line</b>: straight down through the middle of the circle, and keep going below it.',
      tip: 'It goes as far below the circle as the circle is tall. That is where the chin will be.',
      expect: 'line',
      hint: (g, A) => { g.ref().circle(A.cx, A.cy, A.r); g.now().line(A.cx, A.cy - A.r, A.cx, A.cy + 2 * A.r); },
      snap: (res, A) => M.snap.line(res, { x: A.cx, y: A.cy - A.r }, { x: A.cx, y: A.cy + 2 * A.r }, 'the center', A.r * 0.3),
      onShape: () => true },
    { text: 'Draw the <b>brow line</b> straight across the middle of the circle.',
      tip: 'The eyebrows sit on this line.',
      expect: 'line',
      hint: (g, A) => g.line(A.cx - A.r, A.cy, A.cx + A.r, A.cy).text('brow', A.cx + A.r + 8 * g.u, A.cy + 4 * g.u),
      snap: (res, A) => M.snap.line(res, { x: A.cx - A.r, y: A.cy }, { x: A.cx + A.r, y: A.cy }, 'the brow line', A.r * 0.25),
      onShape: () => true },
    { text: 'Draw the <b>nose line</b> across the bottom of the circle.',
      tip: 'The bottom of the nose sits here. Brow to nose is one "face third".',
      expect: 'line',
      hint: (g, A) => g.line(A.cx - A.r * 0.7, A.cy + A.r, A.cx + A.r * 0.7, A.cy + A.r).text('nose', A.cx + A.r * 0.7 + 8 * g.u, A.cy + A.r + 4 * g.u),
      snap: (res, A) => M.snap.line(res, { x: A.cx - A.r * 0.7, y: A.cy + A.r }, { x: A.cx + A.r * 0.7, y: A.cy + A.r }, 'the nose line', A.r * 0.25),
      onShape: () => true },
    { text: 'Draw the <b>jaw</b> from the side of the head down to the <b>chin</b> (the red dot).',
      tip: 'Mirror is on: draw one side and you get both. Nose to chin = brow to nose.',
      mirror: true, expect: 'any',
      hint: (g, A) => {
        const { cx, cy, r } = A;
        g.dot(cx, cy + 2 * r);
        g.curve([[cx - r * 0.93, cy + r * 0.3], [cx - r * 0.85, cy + r * 1.25], [cx - r * 0.45, cy + r * 1.8], [cx, cy + 2 * r]]);
        g.curve([[cx + r * 0.93, cy + r * 0.3], [cx + r * 0.85, cy + r * 1.25], [cx + r * 0.45, cy + r * 1.8], [cx, cy + 2 * r]]);
      } },
    { text: 'Draw the <b>eyes</b>: they sit halfway between the top of the head and the chin.',
      tip: 'The gap between the eyes is about one eye wide. Mirror is on, so draw just one.',
      mirror: true, expect: 'any',
      hint: (g, A) => {
        const { cx, cy, r } = A, y = cy + r * 0.5, w = r * 0.38;
        g.ref().line(cx - r, y, cx + r, y);
        for (const s of [-1, 1]) {
          const x0 = cx + s * w * 0.5, x1 = cx + s * w * 1.5;
          g.now().curve([[x0, y], [(x0 + x1) / 2, y - w * 0.42], [x1, y]]).curve([[x0, y], [(x0 + x1) / 2, y + w * 0.3], [x1, y]]);
        }
        g.text('eye line', cx + r + 8 * g.u, y + 4 * g.u);
      } },
    { text: 'Add the <b>nose</b> on the nose line and the <b>mouth</b> one third of the way down to the chin.',
      tip: 'The nose is about one eye wide. The corners of the mouth line up with the middle of the eyes.',
      mirror: true, expect: 'any',
      hint: (g, A) => {
        const { cx, cy, r } = A, w = r * 0.38, my = cy + r * 1.36;
        g.curve([[cx - w * 0.55, cy + r * 0.92], [cx, cy + r * 1.05], [cx + w * 0.55, cy + r * 0.92]]);
        g.curve([[cx - w, my], [cx, my + w * 0.15], [cx + w, my]]);
        g.ref().line(cx - w, cy + r * 0.5, cx - w, my).line(cx + w, cy + r * 0.5, cx + w, my);
      } },
    { text: 'Draw the <b>ears</b> on the sides, between the brow line and the nose line.',
      tip: 'Ears are much bigger than most beginners think!',
      mirror: true, expect: 'any',
      hint: (g, A) => {
        const { cx, cy, r } = A;
        for (const s of [-1, 1]) g.curve([[cx + s * r * 0.95, cy], [cx + s * r * 1.18, cy - r * 0.05], [cx + s * r * 1.15, cy + r * 0.6], [cx + s * r * 0.92, cy + r]]);
      } },
    { text: '<b>Done!</b> Press <b>Finish</b>: you get a new "Ink" layer. Draw your clean lines over the guides, then press <b>G</b> to hide the guides.',
      tip: 'Try it again a few times. The 5th face is always much better than the 1st.',
      expect: 'none', finish: true }
  ]
};

/* ---------- Faces: box / planes method ---------- */
function boxFrame(W, H) {
  const hh = H * 0.72, ww = hh * 0.72;
  return { x0: W / 2 - ww / 2, y0: H * 0.12, w: ww, h: hh, cx: W / 2 };
}
const third = A => A.h / 3.5;    // skull top + three equal face parts
M.list['face-box'] = {
  name: 'Box method', sub: 'Faces · planes',
  desc: 'Think of the head as a box first. Great for getting proportions and later turning the head.',
  frame: boxFrame,
  steps: [
    { text: 'Draw a tall <b>box</b> for the head with four straight lines.',
      tip: 'A head is about three quarters as wide as it is tall. Lines snap to the box edges.',
      expect: 'line',
      hint: (g, A) => g.rect(A.x0, A.y0, A.w, A.h),
      snap: (res, A) => M.snap.lines(res, [
        [{ x: A.x0, y: A.y0 }, { x: A.x0 + A.w, y: A.y0 }, 'the top'], [{ x: A.x0, y: A.y0 + A.h }, { x: A.x0 + A.w, y: A.y0 + A.h }, 'the bottom'],
        [{ x: A.x0, y: A.y0 }, { x: A.x0, y: A.y0 + A.h }, 'the side'], [{ x: A.x0 + A.w, y: A.y0 }, { x: A.x0 + A.w, y: A.y0 + A.h }, 'the side']
      ], A.w * 0.08, true) },
    { text: 'Draw the <b>center line</b> straight down the middle.',
      expect: 'line',
      hint: (g, A) => { g.ref().rect(A.x0, A.y0, A.w, A.h); g.now().line(A.cx, A.y0, A.cx, A.y0 + A.h); },
      snap: (res, A) => M.snap.line(res, { x: A.cx, y: A.y0 }, { x: A.cx, y: A.y0 + A.h }, 'the center', A.w * 0.1, true),
      onShape: () => true },
    { text: 'Split the face into <b>three equal parts</b>: hairline, brow line and nose line.',
      tip: 'Hairline to brow, brow to nose, nose to chin: all the same height. The skull top sits above the hairline.',
      expect: 'line',
      hint: (g, A) => {
        g.ref().rect(A.x0, A.y0, A.w, A.h);
        ['hairline', 'brow', 'nose'].forEach((n, i) => {
          const y = A.y0 + third(A) * (0.5 + i);
          g.now().line(A.x0, y, A.x0 + A.w, y).text(n, A.x0 + A.w + 8 * g.u, y + 4 * g.u);
        });
      },
      snap: (res, A) => M.snap.lines(res, [0, 1, 2].map(i => {
        const y = A.y0 + third(A) * (0.5 + i);
        return [{ x: A.x0, y }, { x: A.x0 + A.w, y }, ['the hairline', 'the brow line', 'the nose line'][i]];
      }), third(A) * 0.3, true) },
    { text: 'Shape the <b>jaw</b>: angled lines from below the cheekbones in to the chin.',
      tip: 'Mirror is on: draw one side.',
      mirror: true, expect: 'any',
      hint: (g, A) => {
        const yN = A.y0 + third(A) * 2.5, yC = A.y0 + A.h;
        g.ref().rect(A.x0, A.y0, A.w, A.h);
        g.now().poly([[A.x0 + A.w * 0.04, yN - third(A) * 0.3], [A.x0 + A.w * 0.18, yC - third(A) * 0.35], [A.cx - A.w * 0.17, yC]]);
        g.poly([[A.x0 + A.w * 0.96, yN - third(A) * 0.3], [A.x0 + A.w * 0.82, yC - third(A) * 0.35], [A.cx + A.w * 0.17, yC]]);
      } },
    { text: 'Draw the <b>eye sockets</b> as two boxes just under the brow line.',
      tip: 'The head is about five eyes wide: eye, gap, eye, gap, eye.',
      mirror: true, expect: 'any',
      hint: (g, A) => {
        const e = A.w / 5, y = A.y0 + third(A) * 1.5;
        g.rect(A.x0 + e, y + e * 0.1, e, e * 0.55).rect(A.x0 + 3 * e, y + e * 0.1, e, e * 0.55);
      } },
    { text: 'Add the <b>nose</b> as a wedge from brow to nose line, and the <b>mouth</b> a third of the way down to the chin.',
      expect: 'any', mirror: true,
      hint: (g, A) => {
        const yB = A.y0 + third(A) * 1.5, yN = yB + third(A), e = A.w / 5;
        g.poly([[A.cx - e * 0.2, yB + e * 0.3], [A.cx - e * 0.55, yN], [A.cx + e * 0.55, yN], [A.cx + e * 0.2, yB + e * 0.3]]);
        const my = yN + third(A) / 3;
        g.line(A.cx - e * 0.9, my, A.cx + e * 0.9, my);
      } },
    { text: '<b>Done!</b> Press <b>Finish</b> to get an "Ink" layer, then round off the corners of the box into a face.',
      tip: 'Next time, try tilting the box: the lines stay in the same places on the box.',
      expect: 'none', finish: true }
  ]
};
