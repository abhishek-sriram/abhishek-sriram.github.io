const REDUCE = '(prefers-reduced-motion: reduce)';
const MARGIN = '0px 0px -32px 0px';
const THRESHOLDS = [0, 0.05, 0.12, 0.2, 0.4, 0.55, 0.6];

/** @type {Map<Element, { min: number, onHit: (el: Element) => void, once: boolean }>} */
const watchers = new Map();
/** @type {IntersectionObserver | null} */
let sharedIo = null;

function reduced() {
  return window.matchMedia(REDUCE).matches;
}

function watchReduce(fn) {
  const mq = window.matchMedia(REDUCE);
  const on = () => mq.matches && fn();
  if (mq.addEventListener) mq.addEventListener('change', on);
  else mq.addListener(on);
}

function markIn(el) {
  el.classList.add('is-in');
}

function ensureSharedIo() {
  if (sharedIo || !('IntersectionObserver' in window)) return sharedIo;
  sharedIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const spec = watchers.get(entry.target);
        if (!spec) return;
        if (!entry.isIntersecting || entry.intersectionRatio < spec.min) return;
        spec.onHit(entry.target);
        if (spec.once) {
          watchers.delete(entry.target);
          sharedIo.unobserve(entry.target);
        }
      });
    },
    { threshold: THRESHOLDS, rootMargin: MARGIN }
  );
  return sharedIo;
}

function observeOnce(el, onHit, minRatio) {
  if (reduced() || !('IntersectionObserver' in window)) {
    onHit(el);
    return;
  }
  const io = ensureSharedIo();
  watchers.set(el, { min: minRatio, onHit, once: true });
  io.observe(el);
}

function observeSelector(selector, minRatio, onHit) {
  const nodes = Array.from(document.querySelectorAll(selector));
  if (!nodes.length) return [];
  nodes.forEach((el) => observeOnce(el, onHit, minRatio));
  return nodes;
}

function revealAllWatched() {
  const pending = Array.from(watchers.entries());
  pending.forEach(([el, spec]) => {
    spec.onHit(el);
    watchers.delete(el);
    if (sharedIo) sharedIo.unobserve(el);
  });
}

function initFxReveal() {
  const nodes = observeSelector('.fx-reveal', 0.05, markIn);
  nodes.forEach((el) => {
    el.addEventListener('focusin', () => {
      markIn(el);
      watchers.delete(el);
      if (sharedIo) sharedIo.unobserve(el);
    });
  });
}

function figureOf(text) {
  const match = text.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (!match) return null;
  const raw = match[0];
  const value = Number(raw.replace(/,/g, ''));
  const dec = (raw.split('.')[1] || '').length;
  const grouped = raw.includes(',');
  const format = (n) => {
    const bits = n.toFixed(dec).split('.');
    if (grouped) bits[0] = bits[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return bits.join('.');
  };
  return { value, format, head: text.slice(0, match.index), tail: text.slice(match.index + raw.length) };
}

function runCount(item) {
  const start = performance.now();
  const { figure, finalText, visual } = item;
  const frame = (now) => {
    if (item.done) return;
    const t = Math.min(1, (now - start) / 900);
    if (t === 1) {
      item.done = true;
      visual.textContent = finalText;
      return;
    }
    visual.textContent =
      figure.head + figure.format(figure.value * (1 - Math.pow(1 - t, 3))) + figure.tail;
    item.raf = requestAnimationFrame(frame);
  };
  item.raf = requestAnimationFrame(frame);
}

function armCount(el) {
  const finalText = (el.textContent || '').trim();
  const figure = figureOf(finalText);
  if (!figure) return null;
  const make = (className, text, hidden) => {
    const node = document.createElement('span');
    node.className = className;
    node.textContent = text;
    if (hidden) node.setAttribute('aria-hidden', 'true');
    return node;
  };
  const visual = make('fx-count-value', figure.head + figure.format(0) + figure.tail, true);
  el.setAttribute('aria-label', finalText);
  el.replaceChildren(make('fx-count-sr', finalText), make('fx-count-ghost', finalText, true), visual);
  return { el, visual, finalText, figure };
}

function initFxCount() {
  if (reduced() || !('IntersectionObserver' in window)) return;
  const items = Array.from(document.querySelectorAll('.fx-count')).map(armCount).filter(Boolean);
  if (!items.length) return;
  const byEl = new Map(items.map((item) => [item.el, item]));
  const finalize = () => {
    items.forEach((item) => {
      if (item.raf) cancelAnimationFrame(item.raf);
      item.started = true;
      item.done = true;
      item.visual.textContent = item.finalText;
    });
  };
  items.forEach((item) => {
    observeOnce(
      item.el,
      (el) => {
        const armed = byEl.get(el);
        if (!armed || armed.started) return;
        if (reduced()) {
          finalize();
          return;
        }
        armed.started = true;
        runCount(armed);
      },
      0.4
    );
  });
  watchReduce(finalize);
}

function initPageTurn() {
  const nums = Array.from(document.querySelectorAll('.kicker-num[data-n]'));
  if (!nums.length) return;
  const settle = (el) => {
    el.textContent = `\u00a7 ${el.dataset.n}`;
    el.classList.remove('is-ticking');
    el.classList.add('is-settled');
  };
  if (reduced() || !('IntersectionObserver' in window)) {
    nums.forEach(settle);
    return;
  }
  let prev = '00';
  nums.forEach((el) => {
    observeOnce(
      el,
      (target) => {
        if (target.dataset.turned) return;
        target.dataset.turned = '1';
        const cur = target.dataset.n;
        target.textContent = `\u00a7 ${prev}`;
        target.classList.add('is-ticking');
        window.setTimeout(() => {
          target.textContent = `\u00a7 ${cur}`;
          target.classList.remove('is-ticking');
          target.classList.add('is-settled');
          prev = cur;
        }, 160);
      },
      0.55
    );
  });
  watchReduce(() => {
    nums.forEach(settle);
    revealAllWatched();
  });
}

function initReadProgress() {
  const bar = document.createElement('div');
  bar.className = 'fx-read-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  if (reduced()) {
    bar.hidden = true;
    return;
  }
  let tick = 0;
  const paint = () => {
    tick = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleY(${max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0})`;
  };
  const onScroll = () => {
    if (!tick) tick = requestAnimationFrame(paint);
  };
  paint();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  watchReduce(() => {
    bar.hidden = true;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  });
}

function armGroup(rootSel, childSel) {
  const root = document.querySelector(rootSel);
  if (!root) return;
  const kids = Array.from(root.querySelectorAll(childSel));
  if (!kids.length) return;
  const hit = () => kids.forEach(markIn);
  if (reduced() || !('IntersectionObserver' in window)) {
    hit();
    return;
  }
  observeOnce(root, hit, 0.12);
  watchReduce(() => {
    hit();
    revealAllWatched();
  });
}

export function initEffects() {
  initFxReveal();
  observeSelector('.fx-marker:not(.fx-marker--hover)', 0.6, markIn);
  initFxCount();
  observeSelector('.about-dropcap', 0.2, markIn);
  armGroup('.about-sidenotes', '.about-sidenote');
  armGroup('.about-optimise-list', '.about-optimise-item');
  initPageTurn();
  initReadProgress();
  watchReduce(revealAllWatched);
}
