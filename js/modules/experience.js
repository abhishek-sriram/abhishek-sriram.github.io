function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setRuleProgress(rule, progress) {
  const clamped = Math.min(1, Math.max(0, progress));
  rule.style.transform = `scaleY(${clamped})`;
}

export function initExperience() {
  const section = document.getElementById('experience');
  const rule = section?.querySelector('.field-log-rule');
  if (!section || !rule) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    rule.classList.add('is-static');
    setRuleProgress(rule, 1);
    return;
  }

  const thresholds = Array.from({ length: 101 }, (_, i) => i / 100);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          const top = entry.boundingClientRect.top;
          setRuleProgress(rule, top < 0 ? 1 : 0);
          continue;
        }

        const visible = entry.intersectionRatio;
        setRuleProgress(rule, visible);
      }
    },
    {
      threshold: thresholds,
      rootMargin: '0px 0px -10% 0px',
    }
  );

  observer.observe(section);

  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onReduceChange = () => {
    if (reduceMq.matches) {
      observer.disconnect();
      rule.classList.add('is-static');
      setRuleProgress(rule, 1);
    }
  };

  if (typeof reduceMq.addEventListener === 'function') {
    reduceMq.addEventListener('change', onReduceChange);
  } else if (typeof reduceMq.addListener === 'function') {
    reduceMq.addListener(onReduceChange);
  }
}
