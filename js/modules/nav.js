export function initNav() {
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  const themeToggle = document.getElementById('themeToggle');
  const progress = document.getElementById('navProgress');
  const scrollTopBtn = document.getElementById('scrollTop');
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const mobileQuery = window.matchMedia('(max-width: 1100px)');

  let menuOpen = false;
  let lastFocused = null;
  let ticking = false;

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

  function menuLinks() {
    if (!navMenu) return [];
    return Array.from(navMenu.querySelectorAll('a'));
  }

  function menuFocusables() {
    if (!nav) return [];
    return Array.from(
      nav.querySelectorAll('a[href], button:not([disabled])')
    );
  }

  function syncMenuA11y(open) {
    if (!navToggle || !navMenu) return;
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    navMenu.setAttribute('aria-hidden', open || !mobileQuery.matches ? 'false' : 'true');

    if (mobileQuery.matches) {
      if (open) {
        navMenu.removeAttribute('inert');
      } else {
        navMenu.setAttribute('inert', '');
      }
    } else {
      navMenu.removeAttribute('inert');
      navMenu.setAttribute('aria-hidden', 'false');
    }
  }

  function closeMenu({ restoreFocus = false } = {}) {
    if (!nav || !navToggle || !navMenu) return;
    if (!menuOpen) return;

    menuOpen = false;
    nav.removeAttribute('data-open');
    syncMenuA11y(false);

    if (restoreFocus) {
      navToggle.focus();
    } else if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  function openMenu() {
    if (!nav || !navToggle || !navMenu) return;
    if (menuOpen) return;

    menuOpen = true;
    lastFocused = document.activeElement;
    nav.setAttribute('data-open', 'true');
    syncMenuA11y(true);

    const links = menuLinks();
    if (links[0]) {
      requestAnimationFrame(() => links[0].focus());
    }
  }

  function trapFocus(event) {
    if (!menuOpen || !mobileQuery.matches || !nav) return;
    if (event.key !== 'Tab') return;

    const focusable = menuFocusables();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (navToggle && navMenu && nav) {
    syncMenuA11y(false);

    navToggle.addEventListener('click', () => {
      if (menuOpen) {
        closeMenu({ restoreFocus: true });
      } else {
        openMenu();
      }
    });

    menuLinks().forEach((link) => {
      link.addEventListener('click', () => {
        closeMenu();
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuOpen) {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
        return;
      }
      trapFocus(event);
    });

    document.addEventListener('click', (event) => {
      if (!menuOpen) return;
      if (!nav.contains(event.target)) {
        closeMenu();
      }
    });

    mobileQuery.addEventListener('change', () => {
      if (!mobileQuery.matches) {
        closeMenu();
      }
      syncMenuA11y(menuOpen);
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
              a.setAttribute('aria-current', 'location');
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

  function updateChrome() {
    ticking = false;
    const y = window.scrollY || 0;

    if (nav) {
      if (y > 40) {
        nav.setAttribute('data-scrolled', 'true');
      } else {
        nav.removeAttribute('data-scrolled');
      }
    }

    if (scrollTopBtn) {
      const show = y > window.innerHeight * 0.6;
      scrollTopBtn.classList.toggle('is-visible', show);
      scrollTopBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
      scrollTopBtn.tabIndex = show ? 0 : -1;
    }

    if (!progress || reduceMotion.matches) {
      if (progress) progress.hidden = true;
      return;
    }

    progress.hidden = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? y / max : 0;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateChrome);
  }

  function syncProgressVisibility() {
    if (!progress) return;
    if (reduceMotion.matches) {
      progress.hidden = true;
      progress.style.transform = 'scaleX(0)';
      updateChrome();
      return;
    }
    updateChrome();
  }

  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      const top = document.getElementById('top') || document.body;
      if (reduceMotion.matches) {
        window.scrollTo(0, 0);
        return;
      }
      top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  syncProgressVisibility();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  reduceMotion.addEventListener('change', syncProgressVisibility);
}
