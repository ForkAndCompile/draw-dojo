'use strict';
/* Advanced lessons, part 1: neon cityscapes (the "visdev" city-at-night style).
   The trick of this style: paint in LAYERS from far to near. Far = light and
   hazy, near = dark and sharp. Then add lights, fog, glow and rain on top. */

(function () {
  const M = App.Methods, snap = M.snap;
  M.subjects.push({ id: 'city', em: '🌆', name: 'Neon cityscapes', advanced: true,
    desc: 'Glowing skylines, rainy neon streets and sci-fi cities, painted in layers.',
    methods: ['city-sunset', 'city-rain', 'city-mega'] });

  /* A row of buildings as one stepped outline. Same seed = same skyline every time. */
  function skyline(A, seed, base, minH, maxH, minW, maxW) {
    let r = seed;
    const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const pts = [[0, base]];
    for (let x = 0; x < A.W;) {
      const w = A.W * (minW + rnd() * (maxW - minW)), h = A.H * (minH + rnd() * (maxH - minH));
      pts.push([x, base - h], [Math.min(A.W, x + w), base - h]);
      x += w;
    }
    pts.push([A.W, base]);
    return pts;
  }
  const rectAll = (layer, color, from, extra) => Object.assign({ layer, shape: 'rect', shapeMode: 'fill', fill: from ? 'fade' : 'solid', color }, extra);
  const finishStep = (text, tip) => ({ text, tip, expect: 'none', finish: true });
  /* Little helper hint: a dot where to start dragging and an arrow showing the direction. */
  function dragHint(g, A, fromBottom) {
    const y0 = fromBottom ? A.H * 0.97 : A.H * 0.03, y1 = fromBottom ? A.H * 0.03 : A.H * 0.97;
    g.dot(A.W * 0.03, y0);
    g.line(A.W * 0.03, y0, A.W * 0.97, y1);
    g.text(fromBottom ? 'start here, drag to the top corner' : 'start here, drag to the bottom corner', A.W * 0.05, y0 + (fromBottom ? -10 : 20) * g.u);
  }

  /* ---------- 1. Layered skyline at sunset ---------- */
  M.list['city-sunset'] = {
    name: 'Layered skyline at sunset', sub: 'Neon cityscapes · beginner friendly',
    desc: 'Pink sky, three rows of flat building shapes, fog, tiny lit windows and a glow. No drawing skills needed, just shapes and layers.',
    palette: ['#ff4f8b', '#ff9ab8', '#d77fd8', '#9a63d8', '#5d3fa6', '#2a1f5c', '#ffd27a', '#fff3d6'],
    noInk: true, doneToast: 'Beautiful! Press G to hide the guides, then Save. Try a blue night version next.',
    frame: (W, H) => ({ W, H }),
    steps: [
      { text: '<b>Sky, part 1.</b> Drag a rectangle over the <b>whole page</b>, starting at the <b>bottom</b>. The pink fades out toward the top.',
        tip: 'A fade fill is strongest where you start dragging.',
        use: rectAll('Sky', '#ff4f8b', true, { bottom: true, say: 'Drag from a bottom corner to the opposite top corner.' }),
        expect: 'none', hintOnce: true, hint: (g, A) => dragHint(g, A, true) },
      { text: '<b>Sky, part 2.</b> Now the same with <b>purple</b>, starting at the <b>top</b>.',
        use: rectAll('Sky', '#6a3fb0', true, { say: 'Drag from a top corner to the opposite bottom corner.' }),
        expect: 'none', hintOnce: true, hint: (g, A) => dragHint(g, A, false) },
      { text: '<b>Far buildings.</b> Stamp tall rectangles side by side along the guide line. Mix tall and short, wide and thin.',
        tip: 'Far things are light and blend into the sky. That is what makes it look deep.',
        use: rectAll('Far city', '#d77fd8', false, { say: 'Drag rectangles up from the bottom.' }),
        expect: 'none', hint: (g, A) => g.poly(skyline(A, 7, A.H * 0.82, 0.25, 0.5, 0.05, 0.12)) },
      { text: '<b>Middle buildings.</b> A second row, a bit darker and a bit taller.',
        use: rectAll('Middle city', '#9a63d8', false), expect: 'none',
        hint: (g, A) => g.poly(skyline(A, 31, A.H * 0.9, 0.2, 0.55, 0.07, 0.15)) },
      { text: '<b>Fog.</b> On a layer between the rows, drag a pink fade over the bottom half, starting at the bottom. The far city fades into haze.',
        tip: 'Fog between layers is the secret of these pictures.',
        use: rectAll('Fog', '#ff9ab8', true, { above: 'Far city', opacity: 0.7, say: 'Drag from the bottom edge up to the middle.' }),
        expect: 'none', hintOnce: true, hint: (g, A) => { g.dot(A.W * 0.03, A.H * 0.97); g.line(A.W * 0.03, A.H * 0.97, A.W * 0.97, A.H * 0.5); } },
      { text: '<b>Near buildings.</b> The darkest row, big shapes at the bottom and the sides. They frame the picture.',
        use: rectAll('Near city', '#2a1f5c', false), expect: 'none',
        hint: (g, A) => { g.poly([[0, A.H], [0, A.H * 0.35], [A.W * 0.12, A.H * 0.35], [A.W * 0.12, A.H * 0.55], [A.W * 0.2, A.H * 0.55], [A.W * 0.2, A.H]]);
                          g.poly([[A.W, A.H], [A.W, A.H * 0.42], [A.W * 0.85, A.H * 0.42], [A.W * 0.85, A.H * 0.6], [A.W * 0.78, A.H * 0.6], [A.W * 0.78, A.H]]);
                          g.line(0, A.H * 0.96, A.W, A.H * 0.96); } },
      { text: '<b>Lit windows.</b> Tap tiny dots and dashes in rows on the buildings. Leave lots of dark gaps.',
        tip: 'Fewer, brighter lights look better than many. More lights on the near buildings.',
        use: { layer: 'Windows', blend: 'screen', tool: 'fineliner', size: 3, color: '#ffd27a', say: 'Tap little dots on the buildings.' },
        expect: 'none' },
      { text: '<b>Glow.</b> Spray soft pink light along the horizon and around the brightest spots.',
        tip: 'Glow layers brighten what is under them. Big soft brush, light touch.',
        use: { layer: 'Glow', blend: 'screen', opacity: 0.9, tool: 'airbrush', size: 160, color: '#ff4f8b', say: 'Spray gently along the skyline.' },
        expect: 'none', hint: (g, A) => g.ellipse(A.W / 2, A.H * 0.62, A.W * 0.45, A.H * 0.12) },
      finishStep('<b>Done!</b> Press <b>G</b> to hide the guides and Save your picture.', 'Next time: change the colors. Blue sky + yellow windows = night city.')
    ]
  };

  /* ---------- 2. Rainy neon night ---------- */
  const horizonStep = {
    text: 'On the guide layer, draw the <b>horizon line</b> straight across, a bit below the middle.',
    tip: 'It snaps straight. The red dot will be your vanishing point.',
    use: { guide: true, tool: 'pen', size: 3, say: 'Draw one line across the page.' },
    expect: 'line',
    hint: (g, A) => g.line(0, A.hy, A.W, A.hy),
    snap: res => snap.horizontal(res, 12, true),
    onShape: (res, A) => { if (!res.snapped) return false; A.hy = res.geom.A.y; A.vp = { x: A.W / 2, y: A.hy }; return true; }
  };
  const streetStep = {
    text: 'Draw the two <b>edges of the street</b>, from the bottom corners to the red dot.',
    use: { guide: true, tool: 'pen', size: 3 },
    expect: 'line',
    hint: (g, A) => { g.dot(A.vp.x, A.vp.y); g.line(A.W * 0.1, A.H, A.vp.x, A.vp.y).line(A.W * 0.9, A.H, A.vp.x, A.vp.y); },
    snap: (res, A) => snap.vp(res, [A.vp], 9)
  };
  /* Buildings on both sides, getting shorter toward the vanishing point. */
  function sideBuildings(g, A) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const f = k / 5, x = A.vp.x + side * A.W * (0.5 - f * 0.4), w = A.W * (0.09 - f * 0.012);
        const top = A.vp.y - A.H * (0.6 - f * 0.45);
        g.rect(side < 0 ? x : x - w, top, w, A.vp.y - top + A.H * 0.02 * (5 - k));
      }
    }
  }
  const rainStep = {
    text: '<b>Rain.</b> Many thin straight lines, all slanted the same way. Vary how long they are.',
    tip: 'Assist is set to 100% here, so every line comes out straight.',
    use: { layer: 'Rain', opacity: 0.45, tool: 'fineliner', size: 1, color: '#e8f1ff', assist: 1, say: 'Quick short strokes, all the same angle.' },
    expect: 'none',
    hint: (g, A) => { for (let i = 0; i < 9; i++) { const x = A.W * (0.08 + i * 0.11), y = A.H * (0.15 + (i % 3) * 0.22); g.line(x, y, x - A.W * 0.02, y + A.H * 0.1); } }
  };
  const figureStep = {
    text: 'A small <b>figure</b> from behind, standing in the street. An umbrella is just half a circle.',
    tip: 'A tiny person makes the city feel huge. Keep it dark and simple.',
    use: { layer: 'Figure', tool: 'pen', size: 6, color: '#05070f', say: 'Draw and fill a little dark shape.' },
    expect: 'none',
    hint: (g, A) => {
      const x = A.W / 2, b = A.H * 0.86, h = A.H * 0.13;
      g.circle(x, b - h * 0.86, h * 0.1).poly([[x - h * 0.13, b - h * 0.74], [x + h * 0.13, b - h * 0.74], [x + h * 0.16, b - h * 0.3], [x + h * 0.08, b], [x - h * 0.08, b], [x - h * 0.16, b - h * 0.3]], true);
      g.curve([[x - h * 0.45, b - h * 0.95], [x, b - h * 1.35], [x + h * 0.45, b - h * 0.95]]).line(x - h * 0.45, b - h * 0.95, x + h * 0.45, b - h * 0.95).line(x, b - h * 0.95, x, b - h * 0.6);
    }
  };

  M.list['city-rain'] = {
    name: 'Rainy neon night', sub: 'Neon cityscapes · street scene',
    desc: 'A street going into the distance, tall dark buildings, glowing signs, wet reflections and rain.',
    palette: ['#0b1026', '#1b2a4a', '#2f5d7c', '#3fd0e0', '#ff3d8b', '#b26bff', '#ffd166', '#e8f1ff'],
    noInk: true, doneToast: 'Moody! Press G to hide the guides and Save.',
    frame: (W, H) => ({ W, H, hy: H * 0.6, vp: { x: W / 2, y: H * 0.6 } }),
    steps: [
      { text: '<b>Night sky.</b> Cover the whole page with a dark navy rectangle.',
        use: rectAll('Sky', '#0b1026', false, { bottom: true, say: 'Drag from one corner of the page to the other.' }),
        expect: 'none', hintOnce: true, hint: (g, A) => dragHint(g, A, true) },
      { text: '<b>City haze.</b> A teal fade from the bottom, so the sky glows near the ground.',
        use: rectAll('Sky', '#2f5d7c', true, { say: 'Drag from a bottom corner to the opposite top corner.' }),
        expect: 'none', hintOnce: true, hint: (g, A) => dragHint(g, A, true) },
      horizonStep,
      streetStep,
      { text: '<b>Buildings.</b> Tall dark rectangles on both sides. The closer to the red dot, the smaller they get.',
        use: rectAll('Buildings', '#1b2a4a', false, { say: 'Stamp rectangles along the guides.' }),
        expect: 'none', hint: (g, A) => { g.dot(A.vp.x, A.vp.y); sideBuildings(g, A); } },
      { text: '<b>Fog.</b> A teal fade from the street upward, over the bottom of the buildings.',
        use: rectAll('Fog', '#2f5d7c', true, { above: 'Buildings', opacity: 0.6, say: 'Drag from the bottom edge up to the horizon.' }),
        expect: 'none', hintOnce: true, hint: (g, A) => { g.dot(A.W * 0.03, A.H * 0.97); g.line(A.W * 0.03, A.H * 0.97, A.W * 0.97, A.vp.y - A.H * 0.1); } },
      { text: '<b>Windows and neon signs.</b> Tiny window dots, and a few signs as thin upright rectangles in pink and cyan.',
        tip: 'Signs hang on the side walls. Pick the colors from the palette above.',
        use: rectAll('Lights', '#ff3d8b', false, { blend: 'screen', say: 'Stamp small tall rectangles on the walls.' }),
        expect: 'none', hint: (g, A) => { for (const [x, y] of [[0.22, 0.25], [0.3, 0.4], [0.7, 0.3], [0.8, 0.18]]) g.rect(A.W * x, A.H * y, A.W * 0.015, A.H * 0.12); } },
      { text: '<b>Wet street.</b> Under every bright light, draw a streak straight down on the street, in the same color.',
        tip: 'Reflections go straight down, never sideways. That alone makes the street look wet.',
        use: { layer: 'Reflections', blend: 'screen', opacity: 0.55, tool: 'marker', size: 10, color: '#ff3d8b', assist: 1, say: 'Straight down strokes on the street.' },
        expect: 'none', hint: (g, A) => { for (const x of [0.225, 0.305, 0.705, 0.805]) g.line(A.W * x, A.vp.y + A.H * 0.05, A.W * x, A.H * 0.95); } },
      rainStep,
      figureStep,
      { text: '<b>Glow.</b> Soft pink and cyan glow around the signs and along the horizon.',
        use: { layer: 'Glow', blend: 'screen', opacity: 0.9, tool: 'airbrush', size: 120, color: '#3fd0e0', say: 'Spray softly around the lights.' },
        expect: 'none' },
      finishStep('<b>Done!</b> Press <b>G</b> to hide the guides and Save.', 'Try the same street in purple and yellow.')
    ]
  };

  /* ---------- 3. Sci-fi megastructure ---------- */
  M.list['city-mega'] = {
    name: 'Sci-fi megastructure', sub: 'Neon cityscapes · epic scale',
    desc: 'A giant tower in the fog, street lamps shrinking into the distance and flying ships. Scale is everything.',
    palette: ['#0d1b24', '#173543', '#2c6372', '#5fb7c4', '#8ff3ff', '#ffb000', '#e9fbff'],
    noInk: true, doneToast: 'Epic! Press G to hide the guides and Save.',
    frame: (W, H) => ({ W, H, hy: H * 0.66, vp: { x: W / 2, y: H * 0.66 } }),
    steps: [
      { text: '<b>Sky.</b> Fill the page with dark teal, then a lighter teal fade from the bottom.',
        tip: 'Two rectangles: first a solid one, then a fade one (switch Fills to Fade).',
        use: rectAll('Sky', '#173543', false, { bottom: true }), expect: 'none', hintOnce: true, hint: (g, A) => dragHint(g, A, true) },
      horizonStep,
      streetStep,
      { text: '<b>The megastructure.</b> One huge tall shape in the middle, going off the top of the page. Add a few blocks sticking out.',
        tip: 'Huge things are lighter because there is so much air in front of them.',
        use: rectAll('Tower', '#2c6372', false, { say: 'Stamp a few tall rectangles stacked together.' }), expect: 'none',
        hint: (g, A) => {
          const x = A.W / 2, w = A.W * 0.16;
          g.rect(x - w / 2, 0, w, A.vp.y).rect(x - w * 0.8, A.H * 0.2, w * 0.3, A.H * 0.12).rect(x + w * 0.5, A.H * 0.35, w * 0.35, A.H * 0.08);
        } },
      { text: '<b>Street lamps.</b> Upright lines along both edges of the street, shorter and closer together near the red dot.',
        tip: 'Vertical lines snap upright. Lamp heads are short sideways lines.',
        use: { layer: 'Lamps', tool: 'pen', size: 5, color: '#0d1b24', assist: 0.8 }, expect: 'line',
        hint: (g, A) => {
          g.dot(A.vp.x, A.vp.y);
          for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
            const f = 1 - k * 0.18, bx = A.vp.x + side * A.W * 0.42 * f, by = A.vp.y + (A.H - A.vp.y) * f, h = A.H * 0.4 * f;
            g.line(bx, by, bx, by - h).line(bx, by - h, bx - side * A.W * 0.04 * f, by - h);
          }
        },
        snap: res => snap.vertical(res, 8) },
      { text: '<b>Lights.</b> Glowing dots on the lamp heads and a few bright window strips on the tower.',
        use: { layer: 'Lights', blend: 'screen', tool: 'marker', size: 8, color: '#8ff3ff' }, expect: 'none' },
      { text: '<b>Flying ships.</b> A few small flat ovals in the sky, each with one bright light.',
        use: { layer: 'Ships', shape: 'oval', shapeMode: 'fill', fill: 'solid', color: '#0d1b24' }, expect: 'none',
        hint: (g, A) => { for (const [x, y, s] of [[0.25, 0.25, 1], [0.72, 0.18, 0.7], [0.62, 0.38, 0.5]]) g.ellipse(A.W * x, A.H * y, A.W * 0.035 * s, A.H * 0.012 * s); } },
      { text: '<b>Fog.</b> A light fade over the bottom of the tower and the far lamps.',
        use: rectAll('Fog', '#5fb7c4', true, { above: 'Tower', opacity: 0.55 }), expect: 'none' },
      figureStep,
      rainStep,
      finishStep('<b>Done!</b> Press <b>G</b> to hide the guides and Save.', 'Try a warm orange sky with the same shapes.')
    ]
  };
})();
