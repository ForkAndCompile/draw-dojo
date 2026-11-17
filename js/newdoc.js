'use strict';
/* New drawing: pick a format (wide, tall, square, A4, phone, comic page, or your own size).
   Brushes keep the same size on screen whatever the format. */

(function () {
  const $ = id => document.getElementById(id);
  const P = App.Project;
  const LONG = 2048;   // pixels on the long side for the ready-made formats

  const FORMATS = [
    { name: 'Fit my screen', sub: 'wide, fills the window', short: 'screen-size' },
    { name: 'Landscape 16:9', sub: 'wallpapers, video', r: [16, 9], short: 'landscape' },
    { name: 'Portrait 9:16', sub: 'phone, Shorts, Reels', r: [9, 16], short: 'portrait' },
    { name: 'Square 1:1', sub: 'Instagram, avatars', r: [1, 1], short: 'square' },
    { name: 'Portrait 4:5', sub: 'Instagram post', r: [4, 5], short: '4:5' },
    { name: 'A4 portrait', sub: 'printing, sketchbook', r: [210, 297], short: 'A4' },
    { name: 'A4 landscape', sub: 'printing', r: [297, 210], short: 'A4 landscape' },
    { name: 'Comic page 2:3', sub: 'comics, manga', r: [2, 3], short: 'comic page' }
  ];

  function screenSize() {   // same as the first drawing when the app starts
    const wrap = $('canvasWrap'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(400, wrap.clientWidth - 32), cssH = Math.max(300, wrap.clientHeight - 32);
    const k = Math.min(dpr * 1.5, 3600 / Math.max(cssW, cssH));
    return [Math.round(cssW * k), Math.round(cssH * k)];
  }
  function sizeOf(f) {
    if (!f.r) return screenSize();
    const [a, b] = f.r;
    return a >= b ? [LONG, Math.round(LONG * b / a)] : [Math.round(LONG * a / b), LONG];
  }

  P.createDocument = function (W, H, label) {
    if (App.Lesson.active) App.Lesson.stop();
    App.Drills.stop(); App.Move.cancel(); App.Ref.remove();
    App.resizeDocument(W, H, 1);
    App.unit = App.W / (App.paper.offsetWidth || App.W);   // brushes look the same size on screen
    App.addLayer('Sketch', { silent: true });
    App.addLayer('Guides', { guide: true, silent: true });
    App.setActive(App.layers[0]);
    App.resetView();
    $('learnModal').hidden = true;
    App.toast(`New ${label} drawing, ${W} × ${H}`);
  };

  /* File > New drawing: show the formats. Picking one replaces the current drawing. */
  P.newDrawing = function () {
    $('learnTitle').textContent = 'New drawing';
    const body = $('learnBody'); body.innerHTML = '';
    const lead = document.createElement('p'); lead.className = 'lead';
    lead.textContent = 'Pick a format. It replaces the drawing you have now, so use File > Save project first if you want to keep it.';
    const cards = document.createElement('div'); cards.className = 'cards';
    for (const f of FORMATS) {
      const [W, H] = sizeOf(f), s = 50 / Math.max(W, H);
      const b = document.createElement('button'); b.className = 'card fmt-card';
      b.innerHTML = `<span class="fmt-box"><span class="fmt" style="width:${Math.round(W * s)}px;height:${Math.round(H * s)}px"></span></span>` +
                    `<b>${f.name}</b><small>${f.sub} · ${W} × ${H}</small>`;
      b.onclick = () => P.createDocument(W, H, f.short);
      cards.appendChild(b);
    }
    const custom = document.createElement('div'); custom.className = 'custom-size';
    custom.innerHTML = '<span>Your own size</span><input type="number" id="cwIn" min="200" max="4096" value="2000">' +
      '<span>×</span><input type="number" id="chIn" min="200" max="4096" value="1500"><span>pixels</span><button id="cGo" class="primary">Create</button>';
    body.append(lead, cards, custom);
    $('cGo').onclick = () => {
      const W = App.util.clamp(Math.round(+$('cwIn').value || 0), 200, 4096), H = App.util.clamp(Math.round(+$('chIn').value || 0), 200, 4096);
      P.createDocument(W, H, 'custom');
    };
    $('learnModal').hidden = false;
  };
})();
