function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function revealAll(entries) {
  entries.forEach((el) => el.classList.add('is-in'));
}

export function initCredentials() {
  const section = document.getElementById('credentials');
  if (!section) return;

  const entries = Array.from(section.querySelectorAll('.cred-entry'));
  if (!entries.length) return;

  entries.forEach((el, i) => {
    el.style.setProperty('--i', String(i));
  });

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    revealAll(entries);
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
      threshold: 0.08,
      rootMargin: '0px 0px -32px 0px',
    }
  );

  entries.forEach((el) => observer.observe(el));

  window.setTimeout(() => {
    const pending = entries.filter((el) => !el.classList.contains('is-in'));
    if (!pending.length) return;
    revealAll(pending);
    observer.disconnect();
  }, 4000);

  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onReduce = () => {
    if (!reduceMq.matches) return;
    revealAll(entries);
    observer.disconnect();
  };
  if (typeof reduceMq.addEventListener === 'function') {
    reduceMq.addEventListener('change', onReduce);
  } else if (typeof reduceMq.addListener === 'function') {
    reduceMq.addListener(onReduce);
  }
}
