'use strict';
/* Advanced lessons, part 2: anime / manga and comics. */

(function () {
  const M = App.Methods, snap = M.snap;
  M.subjects.push(
    { id: 'anime', em: '✦', name: 'Anime & manga', advanced: true, desc: 'The anime face, big expressive eyes and cute chibi characters.', methods: ['anime-face', 'anime-eye', 'chibi'] },
    { id: 'comics', em: '💬', name: 'Comics', advanced: true, desc: 'Panels, speech balloons and inking like a comic artist.', methods: ['comic-page', 'comic-ink'] }
  );
  const done = (tip) => ({ text: '<b>Done!</b> Press <b>Finish</b> for an "Ink" layer and draw your clean lines over the guides.', tip, expect: 'none', finish: true });
  const anchorCircle = (res, A) => { const e = res.geom.e; A.cx = e.cx; A.cy = e.cy; A.r = (e.a + e.b) / 2; return true; };

  /* ---------- Anime face (front) ---------- */
  M.list['anime-face'] = {
    name: 'Anime face', sub: 'Anime & manga · front view',
    desc: 'Like the circle method, but with anime proportions: eyes low and big, a short pointed chin, tiny nose and mouth.',
    palette: ['#1d1d1f', '#f6d7c3', '#e8a598', '#5b3a6e', '#3a6fd6', '#ffffff'],
    frame: (W, H) => ({ cx: W / 2, cy: H * 0.36, r: Math.min(W, H) * 0.17 }),
    steps: [
      { text: 'Draw a big <b>circle</b> for the skull.', expect: 'ellipse', use: { guide: true, tool: 'pen', size: 3 },
        hint: (g, A) => g.circle(A.cx, A.cy, A.r), onShape: anchorCircle },
      { text: 'Draw the <b>center line</b> and the <b>eye line</b>. In anime the eyes sit <b>low</b>, below the middle of the circle.',
        tip: 'That low eye line is the biggest difference from realistic faces.',
        expect: 'line',
        hint: (g, A) => g.line(A.cx, A.cy - A.r, A.cx, A.cy + 1.75 * A.r).line(A.cx - A.r, A.cy + 0.4 * A.r, A.cx + A.r, A.cy + 0.4 * A.r).text('eye line', A.cx + A.r + 8 * g.u, A.cy + 0.4 * A.r),
        snap: (res, A) => snap.lines(res, [
          [{ x: A.cx, y: A.cy - A.r }, { x: A.cx, y: A.cy + 1.75 * A.r }, 'the center'],
          [{ x: A.cx - A.r, y: A.cy + 0.4 * A.r }, { x: A.cx + A.r, y: A.cy + 0.4 * A.r }, 'the eye line']], A.r * 0.25, true) },
      { text: 'Draw the <b>cheeks and chin</b>: down from the sides, curving in to a small pointed chin.',
        tip: 'Mirror is on. Anime chins are short: not far below the circle.',
        mirror: true, expect: 'any',
        hint: (g, A) => { const { cx, cy, r } = A; g.dot(cx, cy + 1.75 * r);
          for (const s of [-1, 1]) g.curve([[cx + s * 0.96 * r, cy + 0.3 * r], [cx + s * 0.88 * r, cy + 0.95 * r], [cx + s * 0.45 * r, cy + 1.45 * r], [cx, cy + 1.75 * r]]); } },
      { text: 'Draw the <b>eyes</b>: big, a thick curved top lash line, and a tall oval iris touching it.',
        tip: 'The gap between the eyes is about one eye wide. The bottom lash is just a short light line.',
        mirror: true, expect: 'any',
        hint: (g, A) => { const { cx, cy, r } = A, y = cy + 0.4 * r;
          for (const s of [-1, 1]) {
            const ex = cx + s * 0.47 * r, w = 0.25 * r;
            g.curve([[ex - s * w, y - 0.05 * r], [ex, y - 0.3 * r], [ex + s * w * 1.1, y - 0.12 * r]]);
            g.ellipse(ex, y + 0.02 * r, 0.14 * r, 0.21 * r);
            g.line(ex - w * 0.4 * s, y + 0.24 * r, ex + w * 0.9 * s, y + 0.18 * r);
          } } },
      { text: 'Add a tiny <b>nose</b> (just a small mark) and a small <b>mouth</b>.',
        expect: 'any',
        hint: (g, A) => { const { cx, cy, r } = A; g.line(cx + 0.03 * r, cy + 0.95 * r, cx - 0.02 * r, cy + 1.05 * r); g.curve([[cx - 0.14 * r, cy + 1.3 * r], [cx, cy + 1.36 * r], [cx + 0.14 * r, cy + 1.3 * r]]); } },
      { text: 'Draw the <b>hair</b> as big pointed clumps. It sits <b>above</b> the skull, not on it. Bangs fall over the forehead.',
        tip: 'Think of hair as a few big shapes first, never single strands.',
        expect: 'any',
        hint: (g, A) => { const { cx, cy, r } = A;
          g.curve([[cx - 1.1 * r, cy + 0.9 * r], [cx - 1.2 * r, cy - 0.4 * r], [cx, cy - 1.25 * r], [cx + 1.2 * r, cy - 0.4 * r], [cx + 1.1 * r, cy + 0.9 * r]]);
          g.poly([[cx - 0.95 * r, cy - 0.1 * r], [cx - 0.75 * r, cy + 0.25 * r], [cx - 0.55 * r, cy - 0.05 * r], [cx - 0.3 * r, cy + 0.3 * r], [cx - 0.05 * r, cy], [cx + 0.2 * r, cy + 0.32 * r], [cx + 0.45 * r, cy - 0.02 * r], [cx + 0.7 * r, cy + 0.25 * r], [cx + 0.95 * r, cy - 0.1 * r]]); } },
      done('Ink with the Brush pen: thick lines outside, thin lines inside.')
    ]
  };

  /* ---------- Anime eye ---------- */
  M.list['anime-eye'] = {
    name: 'Anime eye', sub: 'Anime & manga · close-up',
    desc: 'The bold lash line, a tall iris, two highlights. The eye is where anime characters get their feeling.',
    palette: ['#1d1d1f', '#3a6fd6', '#8fc4ff', '#5b3a6e', '#ffffff'],
    frame: (W, H) => ({ cx: W / 2, cy: H * 0.55, w: Math.min(W * 0.4, H * 0.75) }),
    steps: [
      { text: 'Draw the <b>top lash line</b>: one thick curve with a little flick at the outer end.',
        tip: 'Press harder in the middle for a thicker line. Try the Brush pen.',
        use: { guide: true, tool: 'brushpen', size: 16 }, expect: 'any',
        hint: (g, A) => g.curve([[A.cx - A.w / 2, A.cy], [A.cx - A.w * 0.1, A.cy - A.w * 0.3], [A.cx + A.w * 0.42, A.cy - A.w * 0.2], [A.cx + A.w * 0.58, A.cy - A.w * 0.3]]) },
      { text: 'Draw the <b>iris</b>: a tall oval, its top hidden under the lash line.', expect: 'ellipse',
        hint: (g, A) => g.ellipse(A.cx + A.w * 0.03, A.cy + A.w * 0.03, A.w * 0.19, A.w * 0.27), onShape: () => true },
      { text: 'Add the <b>pupil</b> and two <b>highlights</b>: a big one at the top, a small one at the bottom.',
        tip: 'Leave the highlights white. Both highlights are on the same side for every eye in the picture.',
        expect: 'any',
        hint: (g, A) => g.ellipse(A.cx + A.w * 0.03, A.cy + A.w * 0.05, A.w * 0.07, A.w * 0.12).circle(A.cx - A.w * 0.06, A.cy - A.w * 0.08, A.w * 0.06).circle(A.cx + A.w * 0.1, A.cy + A.w * 0.17, A.w * 0.03) },
      { text: 'Add the <b>bottom lash</b> (short and light), the <b>crease</b> above and the thin <b>eyebrow</b>.', expect: 'any',
        hint: (g, A) => { g.line(A.cx - A.w * 0.05, A.cy + A.w * 0.32, A.cx + A.w * 0.4, A.cy + A.w * 0.22);
          g.curve([[A.cx - A.w * 0.4, A.cy - A.w * 0.3], [A.cx, A.cy - A.w * 0.42], [A.cx + A.w * 0.45, A.cy - A.w * 0.32]]);
          g.curve([[A.cx - A.w * 0.5, A.cy - A.w * 0.55], [A.cx, A.cy - A.w * 0.68], [A.cx + A.w * 0.5, A.cy - A.w * 0.6]]); } },
      { text: '<b>Color the iris</b>: on a color layer under your lines, fill the iris, then a darker fade at the top.',
        use: { layer: 'Color', bottom: true, tool: 'fill', fill: 'fade', color: '#3a6fd6', say: 'Tap inside the iris, near the bottom.' },
        expect: 'none' },
      done('Try different shapes: round eyes look young and kind, narrow eyes look cool or serious.')
    ]
  };

  /* ---------- Chibi ---------- */
  M.list['chibi'] = {
    name: 'Chibi character', sub: 'Anime & manga · cute and small',
    desc: 'A big head on a tiny body: only about two and a half heads tall. Very forgiving and fun.',
    frame: (W, H) => ({ cx: W / 2, top: H * 0.08, u: H * 0.34 }),
    steps: [
      { text: 'Draw a <b>big round head</b>.', expect: 'ellipse', use: { guide: true, tool: 'pen', size: 3 },
        hint: (g, A) => g.ellipse(A.cx, A.top + A.u * 0.5, A.u * 0.55, A.u * 0.5),
        onShape: (res, A) => { const e = res.geom.e; A.cx = e.cx; A.u = Math.max(e.a, e.b) * 2 * 0.95; A.top = e.cy - A.u * 0.5; return true; } },
      { text: 'Draw a small <b>bean body</b> under it. The body is only about as tall as the head.', expect: 'any',
        hint: (g, A) => g.ellipse(A.cx, A.top + A.u * 1.35, A.u * 0.3, A.u * 0.42) },
      { text: 'Short stubby <b>arms and legs</b>. No elbows or knees needed.', mirror: true, expect: 'any',
        hint: (g, A) => { for (const s of [-1, 1]) {
          g.ellipse(A.cx + s * A.u * 0.38, A.top + A.u * 1.3, A.u * 0.09, A.u * 0.22, s * 0.5);
          g.ellipse(A.cx + s * A.u * 0.14, A.top + A.u * 1.82, A.u * 0.1, A.u * 0.17); } } },
      { text: 'Face: the eyes are <b>huge and low</b>, on the bottom half of the head. Tiny mouth between them.',
        mirror: true, expect: 'any',
        hint: (g, A) => { const y = A.top + A.u * 0.65;
          for (const s of [-1, 1]) g.ellipse(A.cx + s * A.u * 0.2, y, A.u * 0.08, A.u * 0.11);
          g.curve([[A.cx - A.u * 0.04, y + A.u * 0.15], [A.cx, y + A.u * 0.18], [A.cx + A.u * 0.04, y + A.u * 0.15]]); } },
      { text: 'Add <b>hair</b> as one big puffy shape, and simple <b>clothes</b>.', expect: 'any',
        hint: (g, A) => g.curve([[A.cx - A.u * 0.62, A.top + A.u * 0.75], [A.cx - A.u * 0.6, A.top - A.u * 0.05], [A.cx + A.u * 0.6, A.top - A.u * 0.05], [A.cx + A.u * 0.62, A.top + A.u * 0.75]]) },
      done('Make a whole family: change only the hair and clothes.')
    ]
  };

  /* ---------- Comics: a page ---------- */
  const panels = A => {
    const m = A.W * 0.04, gut = A.W * 0.025, w = A.W - 2 * m, h = (A.H - 2 * m - 2 * gut) / 3;
    return [
      { x: m, y: m, w, h },
      { x: m, y: m + h + gut, w: w * 0.55 - gut / 2, h },
      { x: m + w * 0.55 + gut / 2, y: m + h + gut, w: w * 0.45 - gut / 2, h },
      { x: m, y: m + 2 * (h + gut), w, h }
    ];
  };
  M.list['comic-page'] = {
    name: 'A comic page', sub: 'Comics · panels and balloons',
    desc: 'Panels tell the story in order: a wide shot to show where we are, then closer shots, then the big moment.',
    frame: (W, H) => ({ W, H }),
    steps: [
      { text: 'Draw the <b>panel borders</b>: four boxes with gaps (gutters) between them.',
        tip: 'Use the Shapes tool: Rectangle, Outline. Gutters should all be the same width.',
        use: { layer: 'Panels', shape: 'rect', shapeMode: 'outline', tool: 'pen', size: 5, color: '#1d1d1f' }, expect: 'none',
        hint: (g, A) => panels(A).forEach(p => g.rect(p.x, p.y, p.w, p.h)) },
      { text: 'Panel 1, the <b>wide shot</b>: show the place. A horizon line, a few buildings, the hero small.', expect: 'any',
        use: { guide: true, tool: 'pen', size: 3 },
        hint: (g, A) => { const p = panels(A)[0]; g.line(p.x, p.y + p.h * 0.7, p.x + p.w, p.y + p.h * 0.7).circle(p.x + p.w * 0.6, p.y + p.h * 0.5, p.h * 0.05); } },
      { text: 'Panel 2, the <b>medium shot</b>: the hero from the waist up.', expect: 'any',
        hint: (g, A) => { const p = panels(A)[1]; g.circle(p.x + p.w * 0.45, p.y + p.h * 0.35, p.h * 0.16).poly([[p.x + p.w * 0.25, p.y + p.h], [p.x + p.w * 0.3, p.y + p.h * 0.6], [p.x + p.w * 0.6, p.y + p.h * 0.6], [p.x + p.w * 0.65, p.y + p.h]]); } },
      { text: 'Panel 3, the <b>close-up</b>: just the face, big. Close-ups show feelings.', expect: 'any',
        hint: (g, A) => { const p = panels(A)[2]; g.circle(p.x + p.w * 0.5, p.y + p.h * 0.5, p.h * 0.38); } },
      { text: 'Add a <b>speech balloon</b>: an oval with a little pointed tail toward whoever is talking. Leave room for the words!',
        tip: 'People read balloons top-left first, so the first speaker goes on the left.',
        use: { layer: 'Balloons', shape: 'oval', shapeMode: 'outline', tool: 'pen', size: 4, color: '#1d1d1f' }, expect: 'none',
        hint: (g, A) => { const p = panels(A)[1]; g.ellipse(p.x + p.w * 0.25, p.y + p.h * 0.2, p.w * 0.18, p.h * 0.13).poly([[p.x + p.w * 0.28, p.y + p.h * 0.32], [p.x + p.w * 0.36, p.y + p.h * 0.45], [p.x + p.w * 0.33, p.y + p.h * 0.31]]); } },
      { text: 'Panel 4, the <b>big moment</b>: a sound effect in big bold letters on a spiky burst.',
        tip: 'Try the Star shape for the burst.',
        use: { layer: 'Balloons', shape: 'star', shapeMode: 'outline', tool: 'brushpen', size: 8, color: '#1d1d1f' }, expect: 'none',
        hint: (g, A) => { const p = panels(A)[3]; g.text('BOOM!', p.x + p.w * 0.4, p.y + p.h * 0.55); } },
      done('Read your page out loud: does the eye go panel 1, 2, 3, 4?')
    ]
  };

  /* ---------- Comics: inking and shading ---------- */
  M.list['comic-ink'] = {
    name: 'Inking and shading', sub: 'Comics · lines that look finished',
    desc: 'Line weight, hatching, cross-hatching and solid blacks: the four tools of black-and-white comics.',
    frame: (W, H) => { const r = Math.min(W, H) * 0.16; return { r, a: { x: W * 0.28, y: H * 0.45 }, b: { x: W * 0.68, y: H * 0.45 } }; },
    steps: [
      { text: '<b>Line weight.</b> Draw a circle: thicker on the bottom-right (the shadow side), thinner on the lit top-left.',
        tip: 'Press harder on the shadow side. Light comes from the top left.',
        use: { layer: 'Ink', tool: 'brushpen', size: 10, color: '#1d1d1f', assist: 0.6 }, expect: 'none',
        hint: (g, A) => { g.circle(A.a.x, A.a.y, A.r); g.dot(A.a.x - A.r * 1.4, A.a.y - A.r * 1.4, 'rgba(255,200,0,.95)', 8); } },
      { text: '<b>Hatching.</b> Parallel lines on the shadow side of the ball. Closer lines = darker.',
        tip: 'Fine liner, quick flicks, all the same direction.',
        use: { layer: 'Ink', tool: 'fineliner', size: 2, color: '#1d1d1f', assist: 0.6 }, expect: 'none',
        hint: (g, A) => { for (let k = 0; k < 6; k++) { const t = 0.15 + k * 0.12; g.line(A.a.x + A.r * (t + 0.1), A.a.y + A.r * 0.9 - A.r * t, A.a.x + A.r * (t + 0.45), A.a.y + A.r * 0.5 - A.r * t * 0.6); } } },
      { text: '<b>Cross-hatching.</b> A second set of lines at an angle over the darkest part.', expect: 'none',
        hint: (g, A) => { for (let k = 0; k < 4; k++) { const t = k * 0.12; g.line(A.a.x + A.r * (0.3 + t), A.a.y + A.r * 0.4, A.a.x + A.r * (0.5 + t), A.a.y + A.r * 0.85); } } },
      { text: '<b>Solid blacks.</b> Draw a box next to the ball, then fill its darkest side solid black.',
        tip: 'Big black shapes make a page look bold and finished. Use Fill, Solid.',
        use: { layer: 'Ink', tool: 'fill', fill: 'solid', color: '#1d1d1f', say: 'Draw the box first with the pen, then tap the dark side.' }, expect: 'none',
        hint: (g, A) => { const { x, y } = A.b, r = A.r;
          g.poly([[x - r, y - r * 0.4], [x, y - r * 0.8], [x + r, y - r * 0.4], [x, y], [x - r, y - r * 0.4]]).poly([[x - r, y - r * 0.4], [x - r, y + r * 0.8], [x, y + r * 1.2], [x, y]]).poly([[x, y + r * 1.2], [x + r, y + r * 0.8], [x + r, y - r * 0.4]]); } },
      { text: '<b>Speed lines.</b> Straight lines behind something fast, all going the same way.', expect: 'none',
        use: { layer: 'Ink', tool: 'fineliner', size: 2, assist: 1 },
        hint: (g, A) => { for (let k = 0; k < 6; k++) g.line(A.a.x - A.r * 2.2, A.a.y - A.r * 0.6 + k * A.r * 0.25, A.a.x - A.r * 1.2, A.a.y - A.r * 0.6 + k * A.r * 0.25); } },
      { text: '<b>Done!</b> These four tricks work on anything: faces, buildings, cyberpunk machines.', expect: 'none', finish: true }
    ],
    noInk: true
  };
})();
