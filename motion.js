/* Progressive enhancements only: the main training app works without animations. */
(() => {
  'use strict';
  const html = document.documentElement;
  const splash = document.getElementById('paceSplash');
  const bar = document.getElementById('splashMeterFill');
  const percentText = document.getElementById('splashPercent');
  const skip = document.getElementById('skipIntro');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const born = performance.now();
  let dismissed = false;
  let readySignaled = false;
  let currentPct = 0;
  let observer;

  // Never claim to be measuring network activity. The percent is a short intro transition.
  function progress(value) {
    currentPct = Math.max(currentPct, Math.min(100, Math.round(value)));
    if (bar) bar.style.width = `${currentPct}%`;
    if (percentText) percentText.textContent = `${String(currentPct).padStart(2, '0')}%`;
  }
  progress(5);
  const tick = window.setInterval(() => {
    if (!dismissed) progress(currentPct + Math.max(1, Math.round(((readySignaled ? 95 : 87)-currentPct) * (readySignaled ? .16 : .075))));
  }, 80);

  const elements = '.page-header,.dashboard-hero,.stat-card,.panel,.week-strip,.week-focus,.session-row,.agenda-item,.nutri-hero,.blueprint-item,.food-row,.analysis-card,.pace-card,.run-entry,.info-bar,.meal-blueprint,.toolbar,.empty-state,.mini-calendar';
  function animateLine(chart) {
    if (reduceMotion || chart.dataset.traced === 'true') return;
    const line = chart.querySelector('polyline');
    if (!line || typeof line.getTotalLength !== 'function') return;
    const length = line.getTotalLength();
    if (!Number.isFinite(length) || !length) return;
    chart.dataset.traced = 'true';
    line.style.strokeDasharray = String(length);
    line.style.strokeDashoffset = String(length);
    requestAnimationFrame(() => requestAnimationFrame(() => { line.style.strokeDashoffset = '0'; }));
  }
  function reveal(element) {
    if (!element.isConnected) return;
    element.classList.add('revealed');
    if (observer) observer.unobserve(element);
    const chart = element.querySelector('svg[aria-label^="Pace per kilometer"]');
    if (chart) animateLine(chart);
  }
  if (!reduceMotion && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      for (const item of entries) if (item.isIntersecting) reveal(item.target);
    }, { threshold:.08, rootMargin:'0px 0px -20px 0px' });
  }
  function observe(root) {
    if (!root || reduceMotion || !observer) return;
    const list = [...root.querySelectorAll(elements)];
    list.forEach((el,index) => {
      el.classList.add('reveal-prepare');
      el.style.setProperty('--enter-delay', `${(index%6)*54}ms`);
      if (!html.classList.contains('is-booting')) observer.observe(el);
    });
  }
  window.PACE_MOTION = { onRender: observe };
  observe(document.getElementById('view')); // initial page was rendered by app.js before this script.

  function release() {
    if (dismissed) return;
    dismissed = true;
    window.clearInterval(tick);
    progress(100);
    html.classList.remove('is-booting');
    html.classList.add('is-ready');
    // Clear the entrance transform after it finishes so the mobile menu stays above its overlay.
    window.setTimeout(() => document.querySelector('.app-shell')?.classList.add('app-entered'), reduceMotion ? 0 : 850);
    if (splash) {
      splash.classList.add('is-leaving');
      splash.setAttribute('aria-hidden','true');
      window.setTimeout(() => { splash.hidden = true; splash.style.display = 'none'; }, reduceMotion ? 20 : 660);
    }
    const view = document.getElementById('view');
    if (observer && view) view.querySelectorAll('.reveal-prepare:not(.revealed)').forEach(el => observer.observe(el));
  }
  function loaded() {
    if (dismissed || readySignaled) return;
    readySignaled = true;
    window.setTimeout(release, reduceMotion ? 0 : Math.max(0, 1230-(performance.now()-born)));
  }
  if (skip) skip.addEventListener('click',release);
  if (document.readyState === 'complete') loaded();
  else window.addEventListener('load',loaded,{once:true});
  window.setTimeout(loaded, 3000); // never block the application on a stalled optional resource.
  // Reveal anything still offscreen after a delay as an observer-safety fallback.
  window.setTimeout(() => document.querySelectorAll('#view .reveal-prepare:not(.revealed)').forEach(reveal), 8000);
})();
