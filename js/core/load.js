import { delay, duration, ease } from "./motion.config.js";
import { prefersReducedMotion } from "./motion.js";

const SEEN = "index-directed";

function deepLink() {
  const hash = location.hash;
  return Boolean(hash && hash !== "#" && hash !== "#hero");
}

export function shouldPlayLoad() {
  if (prefersReducedMotion() || deepLink()) return false;
  try {
    return localStorage.getItem(SEEN) !== "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN, "1");
  } catch {
    /* Private mode can refuse storage. The sequence still played. */
  }
}

export function initLoad(hero) {
  const root = document.documentElement;
  const release = () => hero?.releaseIntro?.();
  const painted = performance.getEntriesByType("paint").length > 0;
  if (!shouldPlayLoad() || painted) {
    root.classList.remove("is-pending");
    if (painted) release();
    return;
  }
  const gsap = window.gsap;
  if (!gsap) {
    root.classList.remove("is-pending");
    release();
    return;
  }

  const chrome = [...document.querySelectorAll(".wordmark, .mast-meta")];
  const letters = [...document.querySelectorAll(".hero-letter")];
  const query = document.querySelector(".hero-query");
  const marks = [...document.querySelectorAll(".rail-mark")];

  if (chrome.length) gsap.set(chrome, { yPercent: -120 });
  if (letters.length) gsap.set(letters, { yPercent: 112 });
  if (query) gsap.set(query, { autoAlpha: 0, y: 12 });
  if (marks.length) gsap.set(marks, { scaleY: 0, transformOrigin: "center center" });
  root.classList.remove("is-pending");

  const timeline = gsap.timeline({
    onComplete() {
      gsap.set([...chrome, ...letters, query, ...marks].filter(Boolean), {
        clearProps: "transform,opacity,visibility",
      });
      markSeen();
    },
  });

  if (chrome.length) {
    timeline.to(chrome, { yPercent: 0, duration: duration.loadNav, ease: ease.snap }, 0);
  }
  if (letters.length) {
    timeline.to(
      letters,
      { yPercent: 0, duration: duration.letter, stagger: delay.letter, ease: ease.snap },
      delay.hero,
    );
  }
  timeline.call(release, null, delay.hero);
  marks.forEach((mark, index) => {
    const active = Boolean(mark.closest(".is-active"));
    timeline.to(
      mark,
      { scaleY: active ? 2.8 : 1, duration: duration.loadRail, ease: ease.glide },
      delay.rail + index * delay.railTick,
    );
  });
  if (query) {
    timeline.to(query, { autoAlpha: 1, y: 0, duration: duration.queryIn, ease: ease.glide }, delay.query);
  }
}
