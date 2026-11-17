'use strict';
/* Lesson content, part 2: bodies, landscapes, buildings, objects. */

(function () {
  const M = App.Methods, snap = M.snap;

  /* ---------- Bodies ---------- */
  const bodyFrame = (W, H) => ({ cx: W / 2, y0: H * 0.05, h: H * 0.9 / 8 });
  const Y = (A, heads) => A.y0 + A.h * heads;

  M.list['body-mannequin'] = {
    name: 'Mannequin', sub: 'Bodies · standing figure',
    desc: 'Simple shapes for the head, rib cage and pelvis, joined at the joints. A standing adult is about 8 heads tall.',
    frame: bodyFrame,
    steps: [
      { text: 'A standing adult is about <b>8 heads tall</b>. The ticks on the left show the 8 head heights.',
        tip: 'Press Next when you have looked at the ticks. You can draw them too if you like.',
        expect: 'none',
        hint: (g, A) => {
          const x = A.cx - A.h * 2.4;
          g.ref().line(x, Y(A, 0), x, Y(A, 8));
          for (let i = 0; i <= 8; i++) { g.line(x - 8 * g.u, Y(A, i), x + 8 * g.u, Y(A, i)); if (i < 8) g.text(String(i + 1), x - 22 * g.u, Y(A, i + 0.6)); }
          g.now();
        } },
      { text: 'Draw the <b>line of action</b>: one long, gentle curve from the top of the head to the feet.',
        tip: 'It gives the pose its energy. A slight C or S curve is enough.',
        expect: 'curve',
        hint: (g, A) => g.curve([[A.cx, Y(A, 0)], [A.cx + A.h * 0.35, Y(A, 3)], [A.cx - A.h * 0.1, Y(A, 6)], [A.cx + A.h * 0.2, Y(A, 8)]]),
        onShape: () => true },
      { text: 'Draw the <b>head</b>: an egg shape that fills the first head height.',
        expect: 'ellipse',
        hint: (g, A) => g.ellipse(A.cx, Y(A, 0.5), A.h * 0.38, A.h * 0.5),
        onShape: () => true },
      { text: 'Draw the <b>rib cage</b>: a big egg or bean, from the shoulders down to about head 3.',
        expect: 'ellipse',
        hint: (g, A) => g.ellipse(A.cx, Y(A, 2.15), A.h * 0.72, A.h * 0.9),
        onShape: () => true },
      { text: 'Draw the <b>pelvis</b>: a bowl or box shape around head 4 (the hips).',
        expect: 'any',
        hint: (g, A) => g.poly([[A.cx - A.h * 0.75, Y(A, 3.55)], [A.cx + A.h * 0.75, Y(A, 3.55)], [A.cx + A.h * 0.5, Y(A, 4.35)], [A.cx - A.h * 0.5, Y(A, 4.35)]], true) },
      { text: 'Draw the <b>shoulder line</b> (about 2 heads wide) and the <b>hip line</b>, with a small circle at each joint.',
        expect: 'any',
        hint: (g, A) => {
          g.line(A.cx - A.h, Y(A, 1.55), A.cx + A.h, Y(A, 1.55)).line(A.cx - A.h * 0.55, Y(A, 4.05), A.cx + A.h * 0.55, Y(A, 4.05));
          for (const s of [-1, 1]) g.circle(A.cx + s * A.h, Y(A, 1.55), A.h * 0.16).circle(A.cx + s * A.h * 0.55, Y(A, 4.05), A.h * 0.16);
        },
        snap: (res, A) => snap.horizontal(res, 10) },
      { text: 'Draw the <b>arms</b>: elbow at the waist, wrist at the hips, fingertips at mid-thigh.',
        tip: 'Mirror is on: draw one arm and you get both.',
        mirror: true, expect: 'any',
        hint: (g, A) => {
          for (const s of [-1, 1]) {
            const p = [[A.cx + s * A.h, Y(A, 1.55)], [A.cx + s * A.h * 1.12, Y(A, 2.95)], [A.cx + s * A.h * 1.2, Y(A, 4.1)], [A.cx + s * A.h * 1.22, Y(A, 4.8)]];
            g.poly(p); g.circle(p[1][0], p[1][1], A.h * 0.12).circle(p[2][0], p[2][1], A.h * 0.1);
          }
        } },
      { text: 'Draw the <b>legs</b>: knee at head 6, ankle near the bottom. Legs are about half the body.',
        mirror: true, expect: 'any',
        hint: (g, A) => {
          for (const s of [-1, 1]) {
            const p = [[A.cx + s * A.h * 0.5, Y(A, 4.1)], [A.cx + s * A.h * 0.55, Y(A, 6)], [A.cx + s * A.h * 0.5, Y(A, 7.75)], [A.cx + s * A.h * 0.85, Y(A, 8)]];
            g.poly(p); g.circle(p[1][0], p[1][1], A.h * 0.14);
          }
        } },
      { text: '<b>Done!</b> Press <b>Finish</b> for an "Ink" layer, then wrap each limb in a cylinder to give it volume.',
        tip: 'Try moving the line of action to make new poses with the same shapes.',
        expect: 'none', finish: true }
    ]
  };

  M.list['body-gesture'] = {
    name: 'Gesture + stick figure', sub: 'Bodies · quick poses',
    desc: 'Fast drawings that catch movement. Do many of them, quickly. Perfect proportions don\'t matter here.',
    frame: bodyFrame,
    steps: [
      { text: 'Draw a fast, curved <b>line of action</b> for a moving pose.',
        tip: 'Exaggerate it! A stiff straight line makes a stiff pose.',
        expect: 'curve',
        hint: (g, A) => g.curve([[A.cx - A.h * 0.6, Y(A, 0.4)], [A.cx + A.h * 0.6, Y(A, 3.5)], [A.cx + A.h * 1.3, Y(A, 7.8)]]),
        onShape: () => true },
      { text: 'Put a small <b>oval for the head</b> at the top end of the line.',
        expect: 'ellipse',
        hint: (g, A) => g.ellipse(A.cx - A.h * 0.6, Y(A, 0.4), A.h * 0.36, A.h * 0.46),
        onShape: () => true },
      { text: 'Draw the <b>shoulder line</b> and the <b>hip line</b>, tilted in opposite directions.',
        tip: 'When the hips go up on one side, the shoulders usually go down on that side.',
        expect: 'line',
        hint: (g, A) => {
          g.line(A.cx - A.h * 0.75, Y(A, 1.45), A.cx + A.h * 1.05, Y(A, 1.85));
          g.line(A.cx - A.h * 0.05, Y(A, 4.15), A.cx + A.h * 1.25, Y(A, 3.75));
        } },
      { text: 'Add <b>stick arms and legs</b>. Bend them at the elbows and knees.',
        expect: 'any',
        hint: (g, A) => {
          g.poly([[A.cx - A.h * 0.75, Y(A, 1.45)], [A.cx - A.h * 1.5, Y(A, 2.6)], [A.cx - A.h * 2.2, Y(A, 2.2)]]);
          g.poly([[A.cx + A.h * 1.05, Y(A, 1.85)], [A.cx + A.h * 1.6, Y(A, 3.1)], [A.cx + A.h * 1.5, Y(A, 4.2)]]);
          g.poly([[A.cx + A.h * 0.1, Y(A, 4.1)], [A.cx - A.h * 0.3, Y(A, 6)], [A.cx - A.h * 0.2, Y(A, 7.9)]]);
          g.poly([[A.cx + A.h * 1.15, Y(A, 3.8)], [A.cx + A.h * 2.1, Y(A, 5.6)], [A.cx + A.h * 1.4, Y(A, 7.4)]]);
        } },
      { text: '<b>Done!</b> Now do 10 more, about 30 seconds each. Speed matters more than neatness here.',
        tip: 'Use Clear (on the guide layer) between poses.',
        expect: 'none', finish: true }
    ]
  };

  /* ---------- Landscapes ---------- */
  const landFrame = (W, H) => ({ W, H, hy: H * 2 / 3, vp: { x: W * 0.62, y: H * 2 / 3 } });
  const thirds = (g, A) => {
    g.ref();
    for (const f of [1 / 3, 2 / 3]) { g.line(0, A.H * f, A.W, A.H * f); g.line(A.W * f, 0, A.W * f, A.H); }
    g.now();
  };
  const horizonStep = {
    text: 'Draw the <b>horizon line</b> straight across, on one of the two thirds lines, not in the middle.',
    tip: 'Low horizon = big sky. High horizon = more land. Your line snaps level.',
    expect: 'line',
    hint: (g, A) => { thirds(g, A); g.line(0, A.H / 3, A.W, A.H / 3).line(0, A.H * 2 / 3, A.W, A.H * 2 / 3); },
    snap: res => snap.horizontal(res, 12, true),
    onShape: (res, A) => {
      if (!res.snapped) return false;
      A.hy = res.geom.A.y; A.vp = { x: A.W * 0.62, y: A.hy };
      return true;
    }
  };

  M.list['land-thirds'] = {
    name: 'Horizon and thirds', sub: 'Landscapes · composition',
    desc: 'Place the horizon and your main subject on the thirds lines, then build the picture from back to front.',
    frame: landFrame,
    steps: [
      horizonStep,
      { text: 'Put your <b>main subject</b> (a tree, a house, a peak) near one of the red dots.',
        tip: 'Where the thirds lines cross is where the eye looks first.',
        expect: 'any',
        hint: (g, A) => { thirds(g, A); for (const x of [1 / 3, 2 / 3]) for (const y of [1 / 3, 2 / 3]) g.dot(A.W * x, A.H * y); } },
      { text: 'Draw the <b>far background</b>: a soft line of hills or mountains just above the horizon.',
        tip: 'Keep it simple and light. Far things have little detail.',
        expect: 'any',
        hint: (g, A) => g.curve([[0, A.hy - A.H * 0.06], [A.W * 0.2, A.hy - A.H * 0.14], [A.W * 0.45, A.hy - A.H * 0.05], [A.W * 0.7, A.hy - A.H * 0.18], [A.W, A.hy - A.H * 0.07]]) },
      { text: 'Draw the <b>middle ground</b>: bigger shapes that overlap the background, like a hill or a line of trees.',
        expect: 'any',
        hint: (g, A) => g.curve([[0, A.hy + A.H * 0.06], [A.W * 0.3, A.hy - A.H * 0.04], [A.W * 0.6, A.hy + A.H * 0.1], [A.W, A.hy + A.H * 0.02]]) },
      { text: 'Draw the <b>foreground</b>: the biggest shapes, at the bottom. Most detail and the darkest darks go here.',
        expect: 'any',
        hint: (g, A) => g.curve([[0, A.H * 0.86], [A.W * 0.25, A.H * 0.8], [A.W * 0.55, A.H * 0.93], [A.W * 0.8, A.H * 0.84], [A.W, A.H * 0.9]]) },
      { text: '<b>Done!</b> Depth trick: far things are lighter, bluer and less detailed; near things are darker, warmer and sharper.',
        tip: 'Press Finish for an "Ink" layer and try coloring back to front.',
        expect: 'none', finish: true }
    ]
  };

  M.list['land-depth'] = {
    name: 'Depth: road to the horizon', sub: 'Landscapes · perspective',
    desc: 'A road, river or fence that shrinks toward one point on the horizon makes a flat picture feel deep.',
    frame: landFrame,
    steps: [
      horizonStep,
      { text: 'The red dot is your <b>vanishing point</b>. Draw the two edges of a <b>road</b> from the bottom of the page to the dot.',
        tip: 'Lines that aim at the dot snap to it.',
        expect: 'line',
        hint: (g, A) => { g.dot(A.vp.x, A.vp.y); g.line(A.W * 0.15, A.H, A.vp.x, A.vp.y).line(A.W * 0.85, A.H, A.vp.x, A.vp.y); },
        snap: (res, A) => snap.vp(res, [A.vp], 9) },
      { text: 'Draw <b>trees or posts</b> along the road. Each one is <b>smaller</b> the closer it is to the horizon.',
        tip: 'Their tops follow a line to the same dot. Vertical lines snap straight.',
        expect: 'line',
        hint: (g, A) => {
          g.dot(A.vp.x, A.vp.y);
          const top0 = { x: A.W * 0.08, y: A.hy - A.H * 0.45 }, bot0 = { x: A.W * 0.08, y: A.H * 0.95 };
          g.ref().line(top0.x, top0.y, A.vp.x, A.vp.y).line(bot0.x, bot0.y, A.vp.x, A.vp.y).now();
          for (const f of [0, 0.35, 0.58, 0.73, 0.83]) {
            const x = top0.x + (A.vp.x - top0.x) * f;
            g.line(x, top0.y + (A.vp.y - top0.y) * f, x, bot0.y + (A.vp.y - bot0.y) * f);
          }
        },
        snap: (res, A) => snap.any(() => snap.vp(res, [A.vp], 7), () => snap.vertical(res, 8)) },
      { text: 'Add <b>overlap</b>: a hill or bush in front of something else. Overlapping is the simplest depth trick there is.',
        expect: 'any',
        hint: (g, A) => g.curve([[A.W * 0.55, A.H * 0.92], [A.W * 0.7, A.hy + A.H * 0.05], [A.W * 0.92, A.H * 0.9]]) },
      { text: '<b>Done!</b> Far = lighter, bluer and less detail. Near = darker and sharper.',
        tip: 'Press Finish for an "Ink" layer.',
        expect: 'none', finish: true }
    ]
  };

  /* ---------- Buildings ---------- */
  const p1Frame = (W, H) => ({ W, H, hy: H * 0.42, vp: { x: W / 2, y: H * 0.42 } });
  const horizonP = Object.assign({}, horizonStep, {
    text: 'Draw the <b>horizon line</b> straight across. It is your eye level.',
    tip: 'Everything above it you see from below, everything below it you see from above.',
    hint: (g, A) => g.line(0, A.hy, A.W, A.hy),
    onShape: (res, A) => {
      if (!res.snapped) return false;
      A.hy = res.geom.A.y; A.vp = { x: A.W / 2, y: A.hy };
      if (A.vps) A.vps = [{ x: A.W * 0.04, y: A.hy, name: 'the left point' }, { x: A.W * 0.96, y: A.hy, name: 'the right point' }];
      return true;
    }
  });
  const box1 = A => { const w = A.W * 0.2, h = A.H * 0.22; return { x: A.W * 0.16, y: A.hy + A.H * 0.12, w, h }; };

  M.list['persp-1'] = {
    name: '1-point perspective', sub: 'Buildings · looking straight down a street',
    desc: 'All the lines that go away from you meet at one point on the horizon. Fronts stay flat.',
    frame: p1Frame,
    steps: [
      horizonP,
      { text: 'The red dot is the <b>vanishing point</b>. Every line going away from you meets here.',
        tip: 'Press Next.',
        expect: 'none',
        hint: (g, A) => { g.rays(A.vp, 24, Math.max(A.W, A.H)); g.dot(A.vp.x, A.vp.y); } },
      { text: 'Draw the <b>front of a box</b>: a flat rectangle, with only straight up-down and side-to-side lines.',
        tip: 'Lines snap straight.',
        expect: 'line',
        hint: (g, A) => { const b = box1(A); g.dot(A.vp.x, A.vp.y); g.rect(b.x, b.y, b.w, b.h); },
        snap: res => snap.any(() => snap.vertical(res, 8), () => snap.horizontal(res, 8)) },
      { text: 'From the corners of the rectangle, draw <b>depth lines toward the dot</b>. Stop when the box looks deep enough.',
        tip: 'Lines that aim at the dot snap to it.',
        expect: 'line',
        hint: (g, A) => {
          const b = box1(A); g.dot(A.vp.x, A.vp.y);
          for (const [x, y] of [[b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y]]) g.line(x, y, A.vp.x, A.vp.y);
        },
        snap: (res, A) => snap.vp(res, [A.vp], 8) },
      { text: 'Close the box with a <b>back edge</b>: one up-down line and one side-to-side line.',
        expect: 'line',
        hint: (g, A) => {
          const b = box1(A), f = 0.35, P = (x, y) => [x + (A.vp.x - x) * f, y + (A.vp.y - y) * f];
          const tr = P(b.x + b.w, b.y), br = P(b.x + b.w, b.y + b.h), tl = P(b.x, b.y);
          g.poly([tl, tr, br]);
        },
        snap: res => snap.any(() => snap.vertical(res, 8), () => snap.horizontal(res, 8)) },
      { text: '<b>Now build a street!</b> Tall boxes on both sides, windows and doors too. Depth lines still snap to the dot.',
        tip: 'Press Finish for an "Ink" layer when your guides are ready.',
        expect: 'line', finish: true,
        hint: (g, A) => g.dot(A.vp.x, A.vp.y),
        snap: (res, A) => snap.any(() => snap.vp(res, [A.vp], 6), () => snap.vertical(res, 6), () => snap.horizontal(res, 6)) }
    ]
  };

  const p2Frame = (W, H) => { const hy = H * 0.45; return { W, H, hy, vp: { x: W / 2, y: hy }, vps: [{ x: W * 0.04, y: hy, name: 'the left point' }, { x: W * 0.96, y: hy, name: 'the right point' }] }; };
  const corner = A => ({ x: A.W * 0.46, top: A.hy - A.H * 0.25, bot: A.hy + A.H * 0.22 });

  M.list['persp-2'] = {
    name: '2-point perspective', sub: 'Buildings · seen from the corner',
    desc: 'A building seen from its corner: one vanishing point on each side of the horizon. Verticals stay vertical.',
    frame: p2Frame,
    steps: [
      horizonP,
      { text: 'The two red dots are your <b>vanishing points</b>, far left and far right on the horizon.',
        tip: 'Press Next.',
        expect: 'none',
        hint: (g, A) => { for (const v of A.vps) { g.rays(v, 30, A.W * 1.2); g.dot(v.x, v.y); } } },
      { text: 'Draw the <b>nearest corner</b> of the building: one vertical line crossing the horizon.',
        tip: 'Vertical lines snap straight.',
        expect: 'line',
        hint: (g, A) => { const c = corner(A); A.vps.forEach(v => g.dot(v.x, v.y)); g.line(c.x, c.top, c.x, c.bot); },
        snap: res => snap.vertical(res, 10),
        onShape: (res, A) => {
          if (res.snapped !== 'vertical') return false;
          const { A: a, B: b } = res.geom;
          A.corner = { x: a.x, top: Math.min(a.y, b.y), bot: Math.max(a.y, b.y) };
          return true;
        } },
      { text: 'From the top and bottom of the corner, draw lines to the <b>left dot</b> and to the <b>right dot</b>.',
        tip: 'Lines that aim at a dot snap to it.',
        expect: 'line',
        hint: (g, A) => {
          const c = A.corner || corner(A);
          A.vps.forEach(v => { g.dot(v.x, v.y); g.line(c.x, c.top, v.x, v.y).line(c.x, c.bot, v.x, v.y); });
        },
        snap: (res, A) => snap.vp(res, A.vps, 7) },
      { text: 'Draw a <b>vertical line on each side</b> to end the two walls.',
        expect: 'line',
        hint: (g, A) => {
          const c = A.corner || corner(A);
          for (const [v, f] of [[A.vps[0], 0.45], [A.vps[1], 0.4]]) {
            const x = c.x + (v.x - c.x) * f;
            g.line(x, c.top + (v.y - c.top) * f, x, c.bot + (v.y - c.bot) * f);
          }
        },
        snap: (res, A) => snap.any(() => snap.vertical(res, 10), () => snap.vp(res, A.vps, 6)) },
      { text: '<b>Add a roof, windows and doors.</b> Lines on the left wall go to the left dot, on the right wall to the right dot.',
        tip: 'Press Finish for an "Ink" layer when your guides are ready.',
        expect: 'line', finish: true,
        hint: (g, A) => A.vps.forEach(v => g.dot(v.x, v.y)),
        snap: (res, A) => snap.any(() => snap.vp(res, A.vps, 6), () => snap.vertical(res, 6)) }
    ]
  };

  /* ---------- Objects ---------- */
  M.list['forms'] = {
    name: 'Basic forms', sub: 'Objects · sphere, cylinder, box',
    desc: 'Almost everything is made of three forms. A head is a sphere, an arm is a cylinder, a house is a box.',
    frame: (W, H) => ({ W, H, r: Math.min(W, H) * 0.13, sx: W * 0.2, sy: H * 0.42 }),
    steps: [
      { text: 'Draw a <b>circle</b> for a sphere.',
        expect: 'ellipse',
        hint: (g, A) => g.circle(A.sx, A.sy, A.r),
        onShape: (res, A) => { const e = res.geom.e; A.sx = e.cx; A.sy = e.cy; A.r = (e.a + e.b) / 2; return true; } },
      { text: 'Light comes from the top left. Draw the <b>shadow edge</b> as a curve, and an oval <b>cast shadow</b> on the ground.',
        tip: 'Shade everything on the bottom-right side of the curve.',
        expect: 'any',
        hint: (g, A) => {
          g.dot(A.sx - A.r * 1.6, A.sy - A.r * 1.6, 'rgba(255,200,0,.95)', 8);
          g.curve([[A.sx + A.r * 0.55, A.sy - A.r * 0.83], [A.sx + A.r * 0.15, A.sy + A.r * 0.1], [A.sx - A.r * 0.75, A.sy + A.r * 0.66]]);
          g.ellipse(A.sx + A.r * 0.35, A.sy + A.r * 1.12, A.r * 1.05, A.r * 0.22);
        } },
      { text: 'Draw a <b>cylinder</b>: an oval on top, two straight sides, and a curved bottom.',
        tip: 'The bottom curve is a bit rounder than the top oval because you see it more from above.',
        expect: 'any',
        hint: (g, A) => {
          const x = A.W * 0.5, y = A.sy - A.r * 0.9, w = A.r * 0.8, h = A.r * 2;
          g.ellipse(x, y, w, w * 0.3).line(x - w, y, x - w, y + h).line(x + w, y, x + w, y + h);
          g.curve([[x - w, y + h], [x, y + h + w * 0.42], [x + w, y + h]]);
        },
        snap: res => snap.vertical(res, 8) },
      { text: 'Draw a <b>box</b>: a vertical front corner, then edges going away to the left and right.',
        tip: 'Imagine two vanishing points far off the page.',
        expect: 'any',
        hint: (g, A) => {
          const x = A.W * 0.8, t = A.sy - A.r * 0.6, b = A.sy + A.r * 0.9, d = A.r;
          g.line(x, t, x, b);
          g.poly([[x - d * 1.1, t - d * 0.3], [x, t], [x + d * 0.9, t - d * 0.28]]);
          g.poly([[x - d * 1.1, b - d * 0.38], [x, b], [x + d * 0.9, b - d * 0.36]]);
          g.line(x - d * 1.1, t - d * 0.3, x - d * 1.1, b - d * 0.38).line(x + d * 0.9, t - d * 0.28, x + d * 0.9, b - d * 0.36);
          g.poly([[x - d * 1.1, t - d * 0.3], [x - d * 0.15, t - d * 0.6], [x + d * 0.9, t - d * 0.28]]);
        },
        snap: res => snap.vertical(res, 8) },
      { text: '<b>Done!</b> Look around the room and find spheres, cylinders and boxes in everything.',
        tip: 'Press Finish for an "Ink" layer.',
        expect: 'none', finish: true }
    ]
  };
})();
