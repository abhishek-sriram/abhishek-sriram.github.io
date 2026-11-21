function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function initCredentials() {
  const section = document.getElementById('credentials');
  if (!section) return;

  const entries = section.querySelectorAll('.cred-entry');
  if (!entries.length) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    entries.forEach((el) => el.classList.add('is-in'));
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
      threshold: 0.12,
      rootMargin: '0px 0px -8% 0px',
    }
  );

  entries.forEach((el) => observer.observe(el));
}
