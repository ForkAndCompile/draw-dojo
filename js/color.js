'use strict';
/* Color picker: a saturation/brightness square, a hue bar and a hex box. */

(function () {
  const $ = id => document.getElementById(id);
  const hsv = { h: 0, s: 0, v: 0.11 };
  let sv, hue, svCtx, hueCtx;

  /* ---------- conversions ---------- */
  function hsvToHex(h, s, v) {
    const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  }
  function hexToHsv(hex) {
    const { r, g, b } = App.hexToRgb(hex);
    const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
    let h = 0;
    if (d) {
      if (max === R) h = 60 * (((G - B) / d) % 6);
      else if (max === G) h = 60 * ((B - R) / d + 2);
      else h = 60 * ((R - G) / d + 4);
    }
    return { h: (h + 360) % 360, s: max ? d / max : 0, v: max };
  }
  App.hsvToHex = hsvToHex;

  /* ---------- drawing ---------- */
  function fitCanvas(c) {
    const dpr = window.devicePixelRatio || 1, r = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
  }
  function drawSV() {
    const w = sv.width, h = sv.height, c = svCtx;
    c.fillStyle = hsvToHex(hsv.h, 1, 1); c.fillRect(0, 0, w, h);
    let g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const x = hsv.s * w, y = (1 - hsv.v) * h, r = 6 * (window.devicePixelRatio || 1);
    c.lineWidth = 2; c.strokeStyle = hsv.v > 0.6 && hsv.s < 0.4 ? '#000' : '#fff';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  }
  function drawHue() {
    const w = hue.width, h = hue.height, c = hueCtx;
    const g = c.createLinearGradient(0, 0, 0, h);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, hsvToHex(i * 60 % 360, 1, 1));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const y = hsv.h / 360 * h;
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1;
    c.fillRect(0, y - 2, w, 4); c.strokeRect(0.5, y - 2.5, w - 1, 5);
  }
  function redraw() { drawSV(); drawHue(); }

  /* ---------- interaction ---------- */
  function drag(el, onPos) {
    const handle = e => {
      const r = el.getBoundingClientRect();
      onPos(App.util.clamp((e.clientX - r.left) / r.width, 0, 1), App.util.clamp((e.clientY - r.top) / r.height, 0, 1));
    };
    el.addEventListener('pointerdown', e => {
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      handle(e);
      const mv = ev => handle(ev);
      const upFn = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', upFn); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', upFn);
    });
  }
  function apply() { App.setColor(hsvToHex(hsv.h, hsv.s, hsv.v), true); redraw(); }

  App.ColorPicker = {
    init() {
      sv = $('svBox'); hue = $('hueBar');
      svCtx = sv.getContext('2d'); hueCtx = hue.getContext('2d');
      fitCanvas(sv); fitCanvas(hue); redraw();
      drag(sv, (x, y) => { hsv.s = x; hsv.v = 1 - y; apply(); });
      drag(hue, (x, y) => { hsv.h = Math.min(359.9, y * 360); apply(); });
      const hex = $('hexInput');
      const commit = () => {
        let v = hex.value.trim(); if (!v.startsWith('#')) v = '#' + v;
        if (/^#[0-9a-f]{6}$/i.test(v)) App.setColor(v); else hex.value = App.settings.color.toUpperCase();
      };
      hex.addEventListener('change', commit);
      hex.addEventListener('keydown', e => { if (e.key === 'Enter') { commit(); hex.blur(); } e.stopPropagation(); });
      window.addEventListener('resize', () => { fitCanvas(sv); fitCanvas(hue); redraw(); });
    },
    /* Called by App.setColor. fromPicker keeps the hue when the color is gray. */
    sync(hex, fromPicker) {
      if (!fromPicker) {
        const n = hexToHsv(hex);
        if (n.s < 0.01 || n.v < 0.01) { hsv.s = n.s; hsv.v = n.v; } else Object.assign(hsv, n);
        if (sv) redraw();
      }
      $('hexInput').value = hex.toUpperCase();
      $('curSwatch').style.background = hex;
    }
  };
})();
