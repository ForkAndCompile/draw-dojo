'use strict';
/* Floating panels (lesson, practice): drag them by their title bar, shrink them
   with the – button, and they stay where you put them next time. */

(function () {
  const KEY = 'drawassist.panels';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = all => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* storage blocked */ } };

  /* Keep the whole panel on screen (its title bar at least, if the window is tiny). */
  function place(panel, left, top) {
    const w = panel.offsetWidth || 300, h = panel.querySelector('.lp-head').offsetHeight + 16;
    left = App.util.clamp(left, 4, Math.max(4, innerWidth - w - 4));
    top = App.util.clamp(top, 4, Math.max(4, innerHeight - h));
    panel.style.left = left + 'px'; panel.style.top = top + 'px'; panel.style.right = 'auto';
  }

  App.makeFloating = function (panel, name) {
    const head = panel.querySelector('.lp-head');
    const all = load(), mine = all[name] || {};
    // the – button: shrink to just the title bar, or open again
    const min = document.createElement('button');
    min.className = 'lp-min'; min.textContent = '–'; min.title = 'Make small / open again';
    head.insertBefore(min, head.querySelector('button'));
    const setMini = on => {
      panel.classList.toggle('panel-mini', on); min.textContent = on ? '+' : '–';
      const a = load(); a[name] = { ...(a[name] || {}), mini: on }; save(a);
    };
    min.onclick = () => setMini(!panel.classList.contains('panel-mini'));
    if (mine.mini) setMini(true);
    if (mine.left != null) requestAnimationFrame(() => place(panel, mine.left, mine.top));

    head.title = 'Drag to move this panel';
    head.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      try { head.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      panel.classList.add('dragging');
      const mv = ev => place(panel, ev.clientX - dx, ev.clientY - dy);
      const up = () => {
        head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up);
        panel.classList.remove('dragging');
        const a = load(); a[name] = { ...(a[name] || {}), left: parseFloat(panel.style.left), top: parseFloat(panel.style.top) }; save(a);
      };
      head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up);
      e.preventDefault();
    });
    // if the window gets smaller, pull the panel back on screen
    window.addEventListener('resize', () => { if (panel.style.left) place(panel, parseFloat(panel.style.left), parseFloat(panel.style.top)); });
  };
})();
