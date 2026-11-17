'use strict';
/* Fill bucket.
   - Sees what you see: every visible layer (guides too) counts as a wall.
   - Closes small gaps in lines, so a not-quite-closed circle still fills.
   - Paints behind the lines on the active layer, so lines stay crisp. */

(function () {
  /* Box "max" filter: thickens walls by r pixels in every direction. */
  function dilate(src, W, H, r) {
    const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const row = y * W; let cnt = 0;
      for (let x = 0; x < Math.min(r, W); x++) cnt += src[row + x];
      for (let x = 0; x < W; x++) {
        if (x + r < W) cnt += src[row + x + r];
        if (x - r - 1 >= 0) cnt -= src[row + x - r - 1];
        tmp[row + x] = cnt > 0 ? 1 : 0;
      }
    }
    for (let x = 0; x < W; x++) {
      let cnt = 0;
      for (let y = 0; y < Math.min(r, H); y++) cnt += tmp[y * W + x];
      for (let y = 0; y < H; y++) {
        if (y + r < H) cnt += tmp[(y + r) * W + x];
        if (y - r - 1 >= 0) cnt -= tmp[(y - r - 1) * W + x];
        out[y * W + x] = cnt > 0 ? 1 : 0;
      }
    }
    return out;
  }

  /* Scanline flood fill over pixels where blocked[i] == 0. */
  function scanFill(blocked, W, H, x, y) {
    const mask = new Uint8Array(W * H);
    const stack = [x, y];
    const b = { x0: x, x1: x, y0: y, y1: y };
    while (stack.length) {
      const sy = stack.pop(); let sx = stack.pop();
      let i = sy * W + sx;
      if (mask[i] || blocked[i]) continue;
      while (sx > 0 && !mask[i - 1] && !blocked[i - 1]) { sx--; i--; }
      let up = false, down = false;
      while (sx < W && !mask[i] && !blocked[i]) {
        mask[i] = 1;
        if (sx < b.x0) b.x0 = sx; if (sx > b.x1) b.x1 = sx;
        if (sy < b.y0) b.y0 = sy; if (sy > b.y1) b.y1 = sy;
        if (sy > 0) { const u = !mask[i - W] && !blocked[i - W]; if (u && !up) stack.push(sx, sy - 1); up = u; }
        if (sy < H - 1) { const d = !mask[i + W] && !blocked[i + W]; if (d && !down) stack.push(sx, sy + 1); down = d; }
        sx++; i++;
      }
    }
    return { mask, b };
  }

  /* Grow the filled area outward one pixel per step, but not through walls
     (except the very last step, which tucks the fill under line edges). */
  function grow(mask, wall, W, H, b, steps) {
    let front = [];
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const i = y * W + x;
        if (mask[i] && ((x > 0 && !mask[i - 1]) || (x < W - 1 && !mask[i + 1]) || (y > 0 && !mask[i - W]) || (y < H - 1 && !mask[i + W]))) front.push(i);
      }
    }
    for (let s = 0; s < steps; s++) {
      const last = s === steps - 1, next = [];
      for (const i of front) {
        const x = i % W, y = (i - x) / W;
        const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
        for (const n of nb) {
          if (n < 0 || mask[n] || (wall[n] && !last)) continue;
          mask[n] = 1; next.push(n);
          const nx = n % W, ny = (n - nx) / W;
          if (nx < b.x0) b.x0 = nx; if (nx > b.x1) b.x1 = nx;
          if (ny < b.y0) b.y0 = ny; if (ny > b.y1) b.y1 = ny;
        }
      }
      front = next;
    }
  }

  App.fillGaps = [4, 10, 18];   // gap sizes (screen px) to try closing, smallest first

  /* look: optional { brush, fade } (see App.fillLook): the fill takes a brush's look or fades out. */
  App.floodFill = function (layer, x, y, color, opacity, look, tolerance = 40) {
    x = Math.floor(x); y = Math.floor(y);
    const W = App.W, H = App.H;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= W || y >= H) return null;
    const px = new Uint32Array(App.composite(true).getContext('2d').getImageData(0, 0, W, H).data.buffer);
    const seed = y * W + x, t = px[seed];
    const tr = t & 255, tg = (t >> 8) & 255, tb = (t >> 16) & 255, lim = tolerance * 3;
    const wall = new Uint8Array(W * H);
    for (let i = 0; i < wall.length; i++) {
      const v = px[i];
      wall[i] = Math.abs((v & 255) - tr) + Math.abs(((v >> 8) & 255) - tg) + Math.abs(((v >> 16) & 255) - tb) > lim ? 1 : 0;
    }
    // Try closing bigger and bigger gaps. If the fill runs out to the edge of the
    // page with a small gap but stays inside with a bigger one, the shape had a gap.
    let res = null, steps = 1;
    const touchesEdge = r => r.b.x0 === 0 || r.b.y0 === 0 || r.b.x1 === W - 1 || r.b.y1 === H - 1;
    for (const g of App.fillGaps.map(v => Math.round(v * App.unit))) {
      const thick = dilate(wall, W, H, g);
      if (thick[seed]) break;   // clicked too close to a line for this gap size
      const r = scanFill(thick, W, H, x, y);
      if (!res) { res = r; steps = g + 2; }
      if (!touchesEdge(r)) { res = r; steps = g + 2; break; }
    }
    if (!res) res = scanFill(wall, W, H, x, y);
    grow(res.mask, wall, W, H, res.b, steps);

    const { mask, b } = res, bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    const out = new ImageData(bw, bh), od = new Uint32Array(out.data.buffer);
    const { r, g, b: bl } = App.hexToRgb(color);
    const val = ((255 << 24) | (bl << 16) | (g << 8) | r) >>> 0;
    for (let yy = b.y0; yy <= b.y1; yy++) {
      const row = yy * W, orow = (yy - b.y0) * bw - b.x0;
      for (let xx = b.x0; xx <= b.x1; xx++) if (mask[row + xx]) od[orow + xx] = val;
    }
    const canvas = document.createElement('canvas'); canvas.width = bw; canvas.height = bh;
    canvas.getContext('2d').putImageData(out, 0, 0);
    if (look && look.brush) App.texturize(canvas, b.x0, b.y0, look.brush);
    if (look && look.fade) App.fadeFill(canvas, b.x0, b.y0, { x, y });
    App.paintFill(layer, canvas, b.x0, b.y0, opacity);
    return { rect: { x0: b.x0, y0: b.y0, x1: b.x1 + 1, y1: b.y1 + 1 }, canvas, x: b.x0, y: b.y0 };
  };

  /* Give a filled shape the look of a brush: pencil grain or soft airbrush edges.
     (A marker's see-through look comes from the opacity the caller passes.)
     x, y: where the canvas sits on the page, so pencil grain lines up with pencil strokes. */
  App.texturize = function (canvas, x, y, brush) {
    const B = App.brushes[brush];
    if (!B) return;
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    c.save();
    if (B.kind === 'pencil') {
      const pat = c.createPattern(App.grainTexture(B.grain), 'repeat');
      pat.setTransform(new DOMMatrix().translate(-x, -y));
      c.globalCompositeOperation = 'destination-in';
      c.fillStyle = pat; c.fillRect(0, 0, w, h);
      c.globalAlpha = 0.8; c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    } else if (B.kind === 'stamp') {
      const shape = document.createElement('canvas'); shape.width = w; shape.height = h;
      shape.getContext('2d').drawImage(canvas, 0, 0);
      c.clearRect(0, 0, w, h);
      c.filter = `blur(${Math.max(3, App.sizeOf(brush) * App.unit * 0.5)}px)`;
      c.drawImage(shape, 0, 0);
      c.filter = 'none';
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(shape, 0, 0);
    }
    c.restore();
  };

  /* Which brush look fills should use right now (null = solid), and their opacity. */
  App.fillLook = function (tool) {
    const st = App.settings;
    const brush = st.fillStyle === 'brush' ? (App.isPaintTool(tool) ? tool : App.lastPaintTool()) : null;
    return { brush, fade: st.fillStyle === 'fade', opacity: st.opacity * (brush ? App.brushes[brush].alpha : 1) };
  };

  /* Fade: full color on the side (top or bottom) nearest to where you tapped,
     fading to nothing on the other side. Great for skies, fog and glowing floors. */
  App.fadeFill = function (canvas, x, y, tap) {
    const c = canvas.getContext('2d'), h = canvas.height;
    const fromTop = !tap || tap.y - y < h / 2;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(fromTop ? 0 : 1, 'rgba(0,0,0,1)');
    g.addColorStop(fromTop ? 1 : 0, 'rgba(0,0,0,0)');
    c.save(); c.globalCompositeOperation = 'destination-in'; c.fillStyle = g; c.fillRect(0, 0, canvas.width, h); c.restore();
  };

  /* Fills go behind what is already on the layer. */
  App.paintFill = function (layer, canvas, x, y, opacity) {
    const c = layer.ctx;
    c.save();
    c.globalCompositeOperation = 'destination-over';
    c.globalAlpha = opacity;
    c.drawImage(canvas, x, y);
    c.restore();
  };
})();
