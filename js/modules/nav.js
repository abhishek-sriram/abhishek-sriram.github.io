export function initNav() {
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  const themeToggle = document.getElementById('themeToggle');
  const progress = document.getElementById('navProgress');
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function isDark() {
    const theme = root.dataset.theme;
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return darkQuery.matches;
  }

  function syncThemeUi() {
    const dark = isDark();
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
      themeToggle.setAttribute(
        'aria-label',
        dark ? 'Switch to light theme' : 'Switch to dark theme'
      );
    }
  }

  function setTheme(next) {
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch (e) {}
    syncThemeUi();
  }

  if (themeToggle) {
    syncThemeUi();
    themeToggle.addEventListener('click', () => {
      setTheme(isDark() ? 'light' : 'dark');
    });
  }

  darkQuery.addEventListener('change', () => {
    if (!root.dataset.theme) syncThemeUi();
  });

  function closeMenu() {
    if (!nav || !navToggle || !navMenu) return;
    if (nav.getAttribute('data-open') !== 'true') return;
    nav.removeAttribute('data-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    if (!nav || !navToggle) return;
    nav.setAttribute('data-open', 'true');
    navToggle.setAttribute('aria-expanded', 'true');
  }

  if (navToggle && navMenu && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.getAttribute('data-open') === 'true';
      if (open) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    navMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        closeMenu();
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (nav.getAttribute('data-open') !== 'true') return;
      closeMenu();
      navToggle.focus();
    });
  }

  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
  const sections = [];
  navAnchors.forEach((link) => {
    const id = link.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) sections.push(el);
  });

  if (sections.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navAnchors.forEach((a) => {
            if (a.getAttribute('href') === `#${id}`) {
              a.setAttribute('aria-current', 'true');
            } else {
              a.removeAttribute('aria-current');
            }
          });
        });
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );
    sections.forEach((s) => spy.observe(s));
  }

  let ticking = false;

  function updateProgress() {
    ticking = false;
    if (!progress || reduceMotion.matches) {
      if (progress) progress.hidden = true;
      return;
    }
    progress.hidden = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateProgress);
  }

  function syncProgressVisibility() {
    if (!progress) return;
    if (reduceMotion.matches) {
      progress.hidden = true;
      progress.style.transform = 'scaleX(0)';
      return;
    }
    updateProgress();
  }

  syncProgressVisibility();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  reduceMotion.addEventListener('change', syncProgressVisibility);
}
