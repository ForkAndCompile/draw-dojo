'use strict';
/* Lesson content, part 3: hands, animals, eye close-up, head turned to the side. */

(function () {
  const M = App.Methods, snap = M.snap;
  const sub = id => M.subjects.find(s => s.id === id);
  Object.assign(sub('hands'), { desc: 'The mitten method and a simple bone-and-joint hand.', methods: ['hand-mitten', 'hand-skeleton'], soon: false });
  Object.assign(sub('animals'), { desc: 'A cute cat face and a four-legged animal from circles.', methods: ['animal-cat', 'animal-dog'], soon: false });
  sub('faces').methods.push('face-34', 'face-eye');
  sub('faces').desc = 'Front view, turned head, the box method and eyes.';
  const done = (tip) => ({ text: '<b>Done!</b> Press <b>Finish</b> for an "Ink" layer and draw your clean lines over the guides.', tip, expect: 'none', finish: true });

  /* ---------- Hands: mitten ---------- */
  const handFrame = (W, H) => { const u = H * 0.22; return { cx: W / 2, wrist: H * 0.9, top: H * 0.9 - u, u }; };
  // fingers (index..pinky): x offset of the base, length as a fraction of the palm
  const FINGERS = [[-0.375, 0.85], [-0.125, 0.95], [0.125, 0.88], [0.375, 0.68]];
  M.list['hand-mitten'] = {
    name: 'Mitten method', sub: 'Hands · open palm',
    desc: 'Draw the hand as a simple mitten first, then split it into fingers. Hands look hard because of the details; the mitten skips them.',
    frame: handFrame,
    steps: [
      { text: 'Draw the <b>palm</b>: a box that is about as tall as it is wide.',
        tip: 'Hold still at the end, or use the shape helper: it cleans up boxes too.',
        expect: 'any',
        hint: (g, A) => g.poly([[A.cx - A.u * 0.5, A.top], [A.cx + A.u * 0.5, A.top], [A.cx + A.u * 0.42, A.wrist], [A.cx - A.u * 0.42, A.wrist]], true) },
      { text: 'Draw the <b>mitten</b>: all four fingers as one shape on top of the palm.',
        tip: 'The middle finger is about as long as the palm. The pinky side is lower.',
        expect: 'any',
        hint: (g, A) => {
          const { cx, top, u } = A;
          g.ref().rect(cx - u * 0.5, top, u, A.wrist - top);
          g.now().curve([[cx - u * 0.5, top], [cx - u * 0.52, top - u * 0.7], [cx - u * 0.15, top - u * 0.98], [cx + u * 0.3, top - u * 0.85], [cx + u * 0.5, top - u * 0.6], [cx + u * 0.5, top]]);
        } },
      { text: 'Draw the <b>knuckle lines</b>: two gentle arcs across the mitten where the fingers bend.',
        tip: 'They curve like a smile, highest at the middle finger.',
        expect: 'any',
        hint: (g, A) => {
          const { cx, top, u } = A;
          for (const f of [0.42, 0.7]) g.curve([[cx - u * 0.5, top - u * f * 0.9], [cx - u * 0.1, top - u * f], [cx + u * 0.5, top - u * f * 0.7]]);
        } },
      { text: 'Split the mitten into <b>four fingers</b>. Round off each fingertip.',
        tip: 'Fingers are about the same width. Leave tiny gaps between them.',
        expect: 'any',
        hint: (g, A) => {
          const { cx, top, u } = A;
          FINGERS.forEach(([dx, len]) => {
            const x = cx + dx * u, w = u * 0.11, tip = top - len * u;
            g.poly([[x - w, top], [x - w, tip + w]]).poly([[x + w, top], [x + w, tip + w]]);
            g.curve([[x - w, tip + w], [x, tip - w * 0.2], [x + w, tip + w]]);
          });
        } },
      { text: 'Draw the <b>thumb</b>. It starts low, near the wrist, and only reaches the first knuckle line.',
        tip: 'The thumb has a big fleshy pad where it joins the palm.',
        expect: 'any',
        hint: (g, A) => {
          const { cx, top, u, wrist } = A;
          g.curve([[cx - u * 0.45, wrist - u * 0.1], [cx - u * 0.82, top + u * 0.15], [cx - u * 0.82, top - u * 0.3], [cx - u * 0.62, top - u * 0.38], [cx - u * 0.5, top - u * 0.05]]);
          g.ref().curve([[cx - u * 0.45, wrist - u * 0.15], [cx - u * 0.1, top + u * 0.55], [cx - u * 0.35, top + u * 0.1]]);
        } },
      done('Tip: look at your own hand while you draw. Everyone has a free model!')
    ]
  };

  /* ---------- Hands: bones and joints ---------- */
  function fingerJoints(A, i) {
    const [dx, len] = FINGERS[i], ang = -Math.PI / 2 + (i - 1.5) * 0.09;
    const parts = [0.47, 0.3, 0.23];
    let x = A.cx + dx * A.u, y = A.top;
    const pts = [[x, y]];
    for (const f of parts) { x += Math.cos(ang) * len * A.u * f; y += Math.sin(ang) * len * A.u * f; pts.push([x, y]); }
    return pts;
  }
  const thumbJoints = A => [[A.cx - A.u * 0.35, A.wrist - A.u * 0.05], [A.cx - A.u * 0.62, A.top + A.u * 0.35], [A.cx - A.u * 0.8, A.top - A.u * 0.02], [A.cx - A.u * 0.88, A.top - A.u * 0.32]];
  M.list['hand-skeleton'] = {
    name: 'Bones and joints', sub: 'Hands · stick hand',
    desc: 'Lines for the bones and circles for the joints. Once this looks right, the flesh goes on easily.',
    frame: handFrame,
    steps: [
      { text: 'Draw the <b>palm</b>: a box, a little narrower at the wrist.',
        expect: 'any',
        hint: (g, A) => g.poly([[A.cx - A.u * 0.5, A.top], [A.cx + A.u * 0.5, A.top], [A.cx + A.u * 0.4, A.wrist], [A.cx - A.u * 0.4, A.wrist]], true) },
      { text: 'Draw a <b>line for each finger</b>, from the knuckles at the top of the palm.',
        tip: 'Each finger has three parts. They get shorter toward the tip.',
        expect: 'any',
        hint: (g, A) => { for (let i = 0; i < 4; i++) { const p = fingerJoints(A, i); g.line(p[0][0], p[0][1], p[3][0], p[3][1]); } },
        snap: res => snap.vertical(res, 6) },
      { text: 'Draw the <b>thumb</b> line. It starts near the wrist and sticks out to the side.',
        expect: 'any',
        hint: (g, A) => g.poly(thumbJoints(A)) },
      { text: 'Put a small <b>circle on every joint</b>.',
        tip: 'Joints line up in gentle arcs across the hand.',
        expect: 'any',
        hint: (g, A) => {
          for (let i = 0; i < 4; i++) fingerJoints(A, i).forEach(([x, y], k) => { if (k < 3) g.circle(x, y, A.u * 0.05); });
          thumbJoints(A).slice(1, 3).forEach(([x, y]) => g.circle(x, y, A.u * 0.06));
        } },
      { text: '<b>Add the flesh</b>: draw a tube around each finger bone, a little thinner at the tips.',
        expect: 'any',
        hint: (g, A) => {
          for (let i = 0; i < 4; i++) {
            const p = fingerJoints(A, i), w = A.u * 0.1;
            g.poly([[p[0][0] - w, p[0][1]], [p[3][0] - w * 0.8, p[3][1]]]).poly([[p[0][0] + w, p[0][1]], [p[3][0] + w * 0.8, p[3][1]]]);
          }
        } },
      done('Try bending a finger: move the lines, keep the same joints.')
    ]
  };

  /* ---------- Animals: cat face ---------- */
  M.list['animal-cat'] = {
    name: 'Cat face', sub: 'Animals · circles',
    desc: 'A friendly cat built from a circle, two triangles and a few ovals.',
    frame: (W, H) => ({ cx: W / 2, cy: H * 0.52, r: Math.min(W, H) * 0.24 }),
    steps: [
      { text: 'Draw a big <b>circle</b> for the head.', expect: 'ellipse',
        hint: (g, A) => g.circle(A.cx, A.cy, A.r),
        onShape: (res, A) => { const e = res.geom.e; A.cx = e.cx; A.cy = e.cy; A.r = (e.a + e.b) / 2; return true; } },
      { text: 'Draw a <b>center line</b> down the middle and an <b>eye line</b> across, just below the middle.',
        expect: 'line',
        hint: (g, A) => g.line(A.cx, A.cy - A.r, A.cx, A.cy + A.r).line(A.cx - A.r, A.cy + A.r * 0.1, A.cx + A.r, A.cy + A.r * 0.1),
        snap: (res, A) => M.snap.lines(res, [
          [{ x: A.cx, y: A.cy - A.r }, { x: A.cx, y: A.cy + A.r }, 'the center'],
          [{ x: A.cx - A.r, y: A.cy + A.r * 0.1 }, { x: A.cx + A.r, y: A.cy + A.r * 0.1 }, 'the eye line']], A.r * 0.25, true) },
      { text: 'Draw the <b>ears</b>: two triangles on top, wide at the bottom.',
        tip: 'Mirror is on: draw one ear and get both. The shape helper straightens triangles.',
        mirror: true, expect: 'any',
        hint: (g, A) => { for (const s of [-1, 1]) g.poly([[A.cx + s * A.r * 0.95, A.cy - A.r * 0.3], [A.cx + s * A.r * 0.78, A.cy - A.r * 1.35], [A.cx + s * A.r * 0.18, A.cy - A.r * 0.92]]); } },
      { text: 'Draw the <b>eyes</b>: two big ovals sitting on the eye line.',
        tip: 'Cats have big eyes, about one eye apart.',
        mirror: true, expect: 'ellipse',
        hint: (g, A) => { for (const s of [-1, 1]) g.ellipse(A.cx + s * A.r * 0.42, A.cy + A.r * 0.05, A.r * 0.2, A.r * 0.24); },
        onShape: () => true },
      { text: 'Draw the <b>muzzle</b>: two small circles side by side under the eyes, and a little triangle <b>nose</b> on top.',
        mirror: true, expect: 'any',
        hint: (g, A) => {
          for (const s of [-1, 1]) g.circle(A.cx + s * A.r * 0.17, A.cy + A.r * 0.58, A.r * 0.18);
          g.poly([[A.cx - A.r * 0.1, A.cy + A.r * 0.36], [A.cx + A.r * 0.1, A.cy + A.r * 0.36], [A.cx, A.cy + A.r * 0.46]], true);
        } },
      { text: 'Add puffy <b>cheeks</b> and three <b>whiskers</b> on each side.',
        mirror: true, expect: 'any',
        hint: (g, A) => {
          for (const s of [-1, 1]) {
            g.curve([[A.cx + s * A.r * 0.96, A.cy + A.r * 0.15], [A.cx + s * A.r * 1.12, A.cy + A.r * 0.5], [A.cx + s * A.r * 0.62, A.cy + A.r * 0.86]]);
            for (const k of [-1, 0, 1]) g.line(A.cx + s * A.r * 0.4, A.cy + A.r * (0.6 + k * 0.08), A.cx + s * A.r * 1.3, A.cy + A.r * (0.5 + k * 0.18));
          }
        } },
      done('Change the ear and eye shapes to get a fox, a dog or a bear from the same circle.')
    ]
  };

  /* ---------- Animals: four legs ---------- */
  M.list['animal-dog'] = {
    name: 'Four-legged animal', sub: 'Animals · circles and a bean',
    desc: 'Dogs, horses and cats share one plan: a chest circle, a hip circle, a spine, and legs that bend in set places.',
    frame: (W, H) => { const u = Math.min(H * 0.15, W * 0.09); return { u, chest: { x: W * 0.4, y: H * 0.46 }, hip: { x: W * 0.4 + u * 2.6, y: H * 0.48 }, ground: H * 0.46 + u * 2.7 }; },
    steps: [
      { text: 'Draw a big <b>circle for the chest</b> (the rib cage).', expect: 'ellipse',
        hint: (g, A) => g.circle(A.chest.x, A.chest.y, A.u),
        onShape: (res, A) => { const e = res.geom.e, dx = e.cx - A.chest.x, dy = e.cy - A.chest.y; A.chest = { x: e.cx, y: e.cy }; A.hip = { x: A.hip.x + dx, y: A.hip.y + dy }; A.ground += dy; A.u = (e.a + e.b) / 2; return true; } },
      { text: 'Draw a smaller <b>circle for the hips</b>, behind the chest.',
        tip: 'Leave a gap of about one circle between them.',
        expect: 'ellipse',
        hint: (g, A) => { g.ref().circle(A.chest.x, A.chest.y, A.u); g.now().circle(A.hip.x, A.hip.y, A.u * 0.8); },
        onShape: () => true },
      { text: 'Join them: a line over the top for the <b>back</b> and one underneath for the <b>belly</b>.',
        tip: 'The belly tucks up toward the hips.',
        expect: 'any',
        hint: (g, A) => {
          g.curve([[A.chest.x, A.chest.y - A.u], [(A.chest.x + A.hip.x) / 2, A.chest.y - A.u * 0.95], [A.hip.x, A.hip.y - A.u * 0.8]]);
          g.curve([[A.chest.x + A.u * 0.2, A.chest.y + A.u * 0.98], [(A.chest.x + A.hip.x) / 2, A.chest.y + A.u * 0.7], [A.hip.x - A.u * 0.2, A.hip.y + A.u * 0.6]]);
        } },
      { text: 'Draw the <b>head</b>: a circle in front of the chest and higher up, with a box for the <b>muzzle</b>. Join it to the chest with the <b>neck</b>.',
        expect: 'any',
        hint: (g, A) => {
          const hx = A.chest.x - A.u * 1.45, hy = A.chest.y - A.u * 1.35, r = A.u * 0.55;
          g.circle(hx, hy, r).poly([[hx - r * 0.5, hy - r * 0.15], [hx - r * 1.8, hy + r * 0.05], [hx - r * 1.75, hy + r * 0.65], [hx - r * 0.4, hy + r * 0.7]]);
          g.line(hx + r * 0.6, hy - r * 0.6, A.chest.x - A.u * 0.1, A.chest.y - A.u * 0.98).line(hx + r * 0.2, hy + r * 0.9, A.chest.x - A.u * 0.85, A.chest.y + A.u * 0.2);
        } },
      { text: 'Draw the <b>legs</b> with a dot at each joint. The <b>back legs bend backwards</b> at the "heel", high up off the ground.',
        tip: 'Front legs hang under the chest, back legs under the hips.',
        expect: 'any',
        hint: (g, A) => {
          const G = A.ground, u = A.u;
          const front = [[A.chest.x, A.chest.y + u * 0.4], [A.chest.x + u * 0.05, A.chest.y + u * 1.35], [A.chest.x, G - u * 0.15], [A.chest.x - u * 0.25, G]];
          const back = [[A.hip.x, A.hip.y], [A.hip.x - u * 0.45, A.hip.y + u * 0.95], [A.hip.x + u * 0.25, G - u * 0.65], [A.hip.x + u * 0.15, G - u * 0.1], [A.hip.x - u * 0.15, G]];
          for (const leg of [front, back]) { g.poly(leg); leg.slice(1, -1).forEach(([x, y]) => g.circle(x, y, u * 0.09)); }
        } },
      { text: 'Add the <b>ears</b> and a <b>tail</b> that continues the line of the back.',
        expect: 'any',
        hint: (g, A) => {
          const hx = A.chest.x - A.u * 1.45, hy = A.chest.y - A.u * 1.35, r = A.u * 0.55;
          g.poly([[hx - r * 0.1, hy - r * 0.8], [hx + r * 0.25, hy - r * 1.7], [hx + r * 0.65, hy - r * 0.55]]);
          g.curve([[A.hip.x + A.u * 0.6, A.hip.y - A.u * 0.55], [A.hip.x + A.u * 1.4, A.hip.y - A.u * 0.9], [A.hip.x + A.u * 1.8, A.hip.y - A.u * 1.7]]);
        } },
      done('Make it a horse with longer legs and neck, or a cat with a smaller chest and longer tail.')
    ]
  };

  /* ---------- Faces: head turned to the side (3/4 view) ---------- */
  M.list['face-34'] = {
    name: 'Head turned (3/4)', sub: 'Faces · turned to the side',
    desc: 'The same ball-and-jaw idea, but the head turns. The center line curves around the ball.',
    frame: (W, H) => ({ cx: W * 0.47, cy: H * 0.33, r: Math.min(W, H) * 0.15 }),
    steps: [
      { text: 'Draw a big <b>circle</b> for the skull.', expect: 'ellipse',
        hint: (g, A) => g.circle(A.cx, A.cy, A.r),
        onShape: (res, A) => { const e = res.geom.e; A.cx = e.cx; A.cy = e.cy; A.r = (e.a + e.b) / 2; return true; } },
      { text: 'Draw an <b>oval on the side</b> of the ball. This is the flat side of the head, where the ear goes.',
        tip: 'The head is turning to your left, so the side shows on the right.',
        expect: 'ellipse',
        hint: (g, A) => g.ellipse(A.cx + A.r * 0.42, A.cy + A.r * 0.05, A.r * 0.38, A.r * 0.62),
        onShape: () => true },
      { text: 'Draw the <b>center line</b>. It curves around the ball, and keeps going down to the chin.',
        tip: 'Think of a line drawn on a real ball: it bends as the ball turns.',
        expect: 'any',
        hint: (g, A) => g.curve([[A.cx - A.r * 0.15, A.cy - A.r], [A.cx - A.r * 0.5, A.cy - A.r * 0.3], [A.cx - A.r * 0.52, A.cy + A.r * 0.5], [A.cx - A.r * 0.38, A.cy + A.r * 2]]) },
      { text: 'Draw the <b>brow line</b> around the ball. It goes through the middle of the side oval.',
        expect: 'any',
        hint: (g, A) => g.curve([[A.cx - A.r * 0.96, A.cy - A.r * 0.15], [A.cx - A.r * 0.5, A.cy + A.r * 0.05], [A.cx + A.r * 0.42, A.cy + A.r * 0.05]]) },
      { text: 'Draw the <b>jaw</b>: from under the side oval down to the chin, then the front of the face.',
        expect: 'any',
        hint: (g, A) => {
          g.dot(A.cx - A.r * 0.38, A.cy + A.r * 2);
          g.poly([[A.cx + A.r * 0.55, A.cy + A.r * 0.62], [A.cx + A.r * 0.22, A.cy + A.r * 1.55], [A.cx - A.r * 0.38, A.cy + A.r * 2]]);
          g.curve([[A.cx - A.r * 0.93, A.cy + A.r * 0.3], [A.cx - A.r * 0.82, A.cy + A.r * 1.3], [A.cx - A.r * 0.38, A.cy + A.r * 2]]);
        } },
      { text: 'Add the <b>features</b>: the far eye is narrower, and the nose sticks out past the center line.',
        tip: 'Eyes halfway down the head, nose on the bottom of the circle, the ear inside the side oval.',
        expect: 'any',
        hint: (g, A) => {
          const y = A.cy + A.r * 0.5;
          g.ellipse(A.cx - A.r * 0.78, y, A.r * 0.13, A.r * 0.08).ellipse(A.cx - A.r * 0.15, y, A.r * 0.2, A.r * 0.09);
          g.poly([[A.cx - A.r * 0.5, A.cy + A.r * 0.15], [A.cx - A.r * 0.75, A.cy + A.r], [A.cx - A.r * 0.45, A.cy + A.r * 1.02]]);
          g.ellipse(A.cx + A.r * 0.5, A.cy + A.r * 0.5, A.r * 0.16, A.r * 0.3);
        } },
      done('Try turning the head the other way: put the side oval on the left.')
    ]
  };

  /* ---------- Faces: eye close-up ---------- */
  M.list['face-eye'] = {
    name: 'The eye', sub: 'Faces · close-up',
    desc: 'An eye is a ball behind two lids. Draw the lids, then the round parts, then the details.',
    frame: (W, H) => ({ cx: W / 2, cy: H * 0.55, w: Math.min(W * 0.45, H * 0.85) }),
    steps: [
      { text: 'Draw the <b>eye shape</b>: the top lid curves more than the bottom one.',
        tip: 'The inner corner (near the nose) is lower and pointier.',
        expect: 'any',
        hint: (g, A) => {
          const { cx, cy, w } = A;
          g.curve([[cx - w / 2, cy + w * 0.03], [cx - w * 0.15, cy - w * 0.26], [cx + w * 0.2, cy - w * 0.25], [cx + w / 2, cy - w * 0.02]]);
          g.curve([[cx - w / 2, cy + w * 0.03], [cx - w * 0.05, cy + w * 0.18], [cx + w / 2, cy - w * 0.02]]);
        } },
      { text: 'Draw the <b>iris</b>: a circle, partly hidden under the top lid.',
        tip: 'Draw the whole circle, then erase the part above the lid later.',
        expect: 'ellipse',
        hint: (g, A) => g.circle(A.cx, A.cy - A.w * 0.03, A.w * 0.19),
        onShape: () => true },
      { text: 'Draw the <b>pupil</b> in the middle and a small <b>highlight</b> circle.',
        tip: 'Leave the highlight white. It makes the eye look alive.',
        expect: 'ellipse',
        hint: (g, A) => g.circle(A.cx, A.cy - A.w * 0.03, A.w * 0.075).circle(A.cx + A.w * 0.07, A.cy - A.w * 0.1, A.w * 0.03),
        onShape: () => true },
      { text: 'Draw the <b>crease</b> above the eye. It follows the top lid.', expect: 'any',
        hint: (g, A) => g.curve([[A.cx - A.w * 0.45, A.cy - A.w * 0.12], [A.cx, A.cy - A.w * 0.36], [A.cx + A.w * 0.48, A.cy - A.w * 0.12]]) },
      { text: 'Add the <b>lashes</b> on the top lid and the <b>eyebrow</b> higher up.',
        tip: 'Lashes curve outward and get longer toward the outer corner.',
        expect: 'any',
        hint: (g, A) => {
          g.curve([[A.cx - A.w * 0.55, A.cy - A.w * 0.42], [A.cx - A.w * 0.05, A.cy - A.w * 0.62], [A.cx + A.w * 0.55, A.cy - A.w * 0.45]]);
          for (let k = 0; k < 5; k++) { const t = 0.15 + k * 0.17, x = A.cx - A.w / 2 + A.w * t, y = A.cy - A.w * 0.22 * Math.sin(Math.PI * t) - A.w * 0.02; g.line(x, y, x + A.w * (0.02 + 0.03 * t), y - A.w * (0.05 + 0.04 * t)); }
        } },
      done('Draw the other eye with Mirror (R) on, or try the eye from the side: a triangle shape.')
    ]
  };
})();
