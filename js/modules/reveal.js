function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function revealAll(nodes) {
  nodes.forEach((el) => el.classList.add('is-in'));
}

export function initReveal() {
  const nodes = Array.from(document.querySelectorAll('.reveal'));
  if (!nodes.length) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    revealAll(nodes);
    return;
  }

  const observer = new IntersectionObserver(
    (observed) => {
      for (const entry of observed) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    {
      threshold: 0.05,
      /* Fixed px margin: %-based bottom margins delay reveal on short phones. */
      rootMargin: '0px 0px -32px 0px',
    }
  );

  nodes.forEach((el) => observer.observe(el));

  /* Failsafe: never leave copy permanently hidden if IO stalls. */
  window.setTimeout(() => {
    const pending = nodes.filter((el) => !el.classList.contains('is-in'));
    if (!pending.length) return;
    revealAll(pending);
    observer.disconnect();
  }, 3000);

  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onReduce = () => {
    if (!reduceMq.matches) return;
    revealAll(nodes);
    observer.disconnect();
  };
  if (typeof reduceMq.addEventListener === 'function') {
    reduceMq.addEventListener('change', onReduce);
  } else if (typeof reduceMq.addListener === 'function') {
    reduceMq.addListener(onReduce);
  }
}
