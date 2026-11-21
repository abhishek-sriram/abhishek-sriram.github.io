const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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

  return paths[paths.length - 1].getPointAtLength(lengths[lengths.length - 1]);
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
}

export function initHero() {
  fillDateline();
  runDiagram();
}
