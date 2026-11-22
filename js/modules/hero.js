const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const LINE_STAGGER = 90;
const MARKER_AFTER = 400;
const PULSE_GAP = 120;
const PROOF_CAP_MS = 900;

function fillDateline() {
  const stamp = document.querySelector('[data-hero-date]');
  if (!stamp) return;

  const now = new Date();
  const label = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  stamp.textContent = label;

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  stamp.setAttribute('datetime', `${y}-${m}`);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function afterPaint(fn) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}

function preparePath(path) {
  const length = path.getTotalLength();
  path.style.strokeDasharray = String(length);
  path.style.strokeDashoffset = String(length);
  return length;
}

function animatePathDraw(path, duration) {
  return new Promise((resolve) => {
    const length = preparePath(path);
    const start = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2);
      path.style.strokeDashoffset = String(length * (1 - eased));
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        path.style.strokeDashoffset = '0';
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

function sampleCombinedPath(paths, progress) {
  const lengths = paths.map((p) => p.getTotalLength());
  const total = lengths.reduce((a, b) => a + b, 0);
  let dist = total * progress;

  for (let i = 0; i < paths.length; i += 1) {
    if (dist <= lengths[i] || i === paths.length - 1) {
      return paths[i].getPointAtLength(Math.min(dist, lengths[i]));
    }
    dist -= lengths[i];
  }

  return paths[paths.length - 1].getPointAtLength(lengths[paths.length - 1]);
}

function animateTraveler(dot, paths, duration) {
  return new Promise((resolve) => {
    const start = performance.now();
    dot.setAttribute('visibility', 'visible');

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2);
      const pt = sampleCombinedPath(paths, eased);
      dot.setAttribute('cx', String(pt.x));
      dot.setAttribute('cy', String(pt.y));

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

function setStaticDiagram(paths, dot) {
  paths.forEach((path) => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = String(length);
    path.style.strokeDashoffset = '0';
  });

  if (dot && paths.length) {
    const last = paths[paths.length - 1];
    const end = last.getPointAtLength(last.getTotalLength());
    dot.setAttribute('cx', String(end.x));
    dot.setAttribute('cy', String(end.y));
    dot.setAttribute('visibility', 'visible');
  }
}

function pulseNodes() {
  const nodes = Array.from(document.querySelectorAll('.hero-node'));
  if (!nodes.length || prefersReducedMotion()) return;

  nodes.forEach((node, i) => {
    window.setTimeout(() => {
      node.classList.remove('is-pulse');
      void node.offsetWidth;
      node.classList.add('is-pulse');
      const ring = node.querySelector('.hero-node-ring');
      if (!ring) return;
      const done = () => {
        node.classList.remove('is-pulse');
        ring.removeEventListener('animationend', done);
      };
      ring.addEventListener('animationend', done);
    }, i * PULSE_GAP);
  });
}

function initNodeTips() {
  const fig = document.querySelector('.hero-fig');
  const tip = document.getElementById('heroNodeTip');
  const nodes = Array.from(document.querySelectorAll('.hero-node'));
  if (!fig || !tip || !nodes.length) return;

  const svg = document.getElementById('heroDiagram');

  function place(node) {
    const text = node.getAttribute('data-tip');
    if (!text || !svg) return;

    const box = node.querySelector('.hero-node-box');
    if (!box) return;

    tip.textContent = text;
    tip.hidden = false;

    const figRect = fig.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let left = boxRect.left - figRect.left + (boxRect.width - tipRect.width) / 2;
    let top = boxRect.bottom - figRect.top + 8;

    left = Math.max(0, Math.min(left, figRect.width - tipRect.width));
    if (top + tipRect.height > figRect.height) {
      top = boxRect.top - figRect.top - tipRect.height - 8;
    }

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function hide() {
    tip.hidden = true;
    tip.textContent = '';
  }

  nodes.forEach((node) => {
    node.addEventListener('pointerenter', () => place(node));
    node.addEventListener('pointerleave', hide);
    node.addEventListener('focus', () => place(node));
    node.addEventListener('blur', hide);
  });
}

async function runDiagram() {
  const main = document.getElementById('heroPathMain');
  const tap = document.getElementById('heroPathTap');
  const dot = document.getElementById('heroTraveler');
  if (!main || !tap || !dot) return;

  const paths = [main, tap];

  if (prefersReducedMotion()) {
    setStaticDiagram(paths, dot);
    return;
  }

  paths.forEach(preparePath);
  dot.setAttribute('visibility', 'hidden');

  await animatePathDraw(main, 700);
  await animatePathDraw(tap, 350);
  await animateTraveler(dot, paths, 1100);
  pulseNodes();
}

function initTitleReveal() {
  const title = document.getElementById('heroTitle');
  const marker = document.getElementById('heroSignal');
  if (!title) return;

  const lines = title.querySelectorAll('.hero-title-line');
  const lastIndex = Math.max(0, lines.length - 1);

  if (prefersReducedMotion()) {
    title.classList.add('is-in');
    if (marker) marker.classList.add('is-in');
    return;
  }

  /* Hold the marker so effects.js does not sweep it before the line lands. */
  if (marker) {
    marker.classList.remove('fx-marker', 'is-in');
  }

  afterPaint(() => {
    title.classList.add('is-armed');
    void title.offsetWidth;
    title.classList.add('is-in');

    if (!marker) return;
    const delay = lastIndex * LINE_STAGGER + MARKER_AFTER;
    window.setTimeout(() => {
      marker.classList.add('fx-marker');
      void marker.offsetWidth;
      marker.classList.add('is-in');
    }, delay);
  });
}

function initProofCaptions() {
  const items = Array.from(document.querySelectorAll('.hero-proof-item'));
  if (!items.length) return;

  const reveal = (item) => {
    if (item.classList.contains('is-proven')) return;
    const delay = prefersReducedMotion() ? 0 : PROOF_CAP_MS;
    window.setTimeout(() => item.classList.add('is-proven'), delay);
  };

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach(reveal);
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8px 0px' });

  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    if (rect.top < vh && rect.bottom > 0) {
      reveal(item);
      return;
    }
    io.observe(item);
  });
}

export function initHero() {
  fillDateline();
  initTitleReveal();
  initNodeTips();
  initProofCaptions();
  runDiagram();
}
