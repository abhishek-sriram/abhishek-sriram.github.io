function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setRuleProgress(rule, progress) {
  const clamped = Math.min(1, Math.max(0, progress));
  rule.style.transform = `scaleY(${clamped})`;
}

function markCentered(items) {
  if (!items.length) return;
  const mid = window.innerHeight * 0.5;
  let best = null;
  let bestDist = Infinity;

  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      item.classList.remove('is-marked');
      return;
    }
    const center = rect.top + rect.height * 0.5;
    const dist = Math.abs(center - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  });

  items.forEach((item) => {
    if (item === best) item.classList.add('is-marked');
    else item.classList.remove('is-marked');
  });
}

function markAll(items) {
  items.forEach((item) => item.classList.add('is-marked'));
}

export function initExperience() {
  const section = document.getElementById('experience');
  const rule = section?.querySelector('.field-log-rule');
  const items = section ? Array.from(section.querySelectorAll('.field-log-item')) : [];
  if (!section || !rule) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    rule.classList.add('is-static');
    setRuleProgress(rule, 1);
    markAll(items);
    return;
  }

  const thresholds = Array.from({ length: 101 }, (_, i) => i / 100);

  const ruleObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          const top = entry.boundingClientRect.top;
          const progress = top < 0 ? 1 : 0;
          setRuleProgress(rule, progress);
          continue;
        }
        setRuleProgress(rule, entry.intersectionRatio);
      }
    },
    {
      threshold: thresholds,
      rootMargin: '0px 0px -32px 0px',
    }
  );

  ruleObserver.observe(section);

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      markCentered(items);
      ticking = false;
    });
  };

  markCentered(items);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onReduceChange = () => {
    if (!reduceMq.matches) return;
    ruleObserver.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    rule.classList.add('is-static');
    setRuleProgress(rule, 1);
    markAll(items);
  };

  if (typeof reduceMq.addEventListener === 'function') {
    reduceMq.addEventListener('change', onReduceChange);
  } else if (typeof reduceMq.addListener === 'function') {
    reduceMq.addListener(onReduceChange);
  }
}
