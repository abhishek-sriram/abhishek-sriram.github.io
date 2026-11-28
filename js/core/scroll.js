import { prefersReducedMotion } from "./motion.js";

let lenis = null;

export function getLenis() {
  return lenis;
}

function anchorOffset() {
  const mast = document.querySelector(".mast");
  const height = mast ? mast.getBoundingClientRect().height : 0;
  return -Math.ceil(height + 12);
}

export function focusDestination(target) {
  const labelledby = target.getAttribute("aria-labelledby");
  const node = (labelledby && document.getElementById(labelledby)) || target;
  if (!node.matches("a, button, input, textarea, select") && !node.hasAttribute("tabindex")) {
    node.setAttribute("tabindex", "-1");
  }
  node.focus({ preventScroll: true });
}

export function scrollToTarget(target, { immediate = false } = {}) {
  if (lenis) {
    lenis.scrollTo(target, { offset: anchorOffset(), immediate, force: true });
    if (immediate) window.ScrollTrigger?.update();
    return;
  }
  if (immediate) {
    const top = window.scrollY + target.getBoundingClientRect().top + anchorOffset();
    window.scrollTo(0, top);
    return;
  }
  target.scrollIntoView({ block: "start" });
}

/* #systems/<system>/<node> is a workbench deep link, not a CSS id. */
export function elementFromHash(hash) {
  if (!hash || hash === "#") return null;
  let id = hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    return null;
  }
  if (!/^[A-Za-z][\w:-]*$/.test(id)) return null;
  return document.getElementById(id);
}

function onAnchorClick(event) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest?.("a[href^='#']");
  if (!link) return;
  const href = link.getAttribute("href");
  if (!href || href === "#") return;
  const target = elementFromHash(href);
  if (!target) return;
  event.preventDefault();
  if (location.hash !== href) history.pushState(null, "", href);
  scrollToTarget(target);
  focusDestination(target);
}

let primed = false;

function activate(section) {
  const surface = section.dataset.surface;
  if (!surface) return;
  const root = document.documentElement;
  const changed = root.dataset.surface !== surface;
  if (!primed || changed) {
    if (!primed) root.classList.add("surface-immediate");
    root.dataset.surface = surface;
    document.body.dataset.surface = surface;
    if (!primed) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => root.classList.remove("surface-immediate"));
      });
    }
  }
  primed = true;
  const id = section.id;
  document.querySelectorAll("[data-rail]").forEach((tick) => {
    const on = Boolean(id) && tick.dataset.rail === id;
    tick.classList.toggle("is-active", on);
    if (on) tick.setAttribute("aria-current", "true");
    else tick.removeAttribute("aria-current");
  });
}

function setupLenis(gsap, ScrollTrigger) {
  lenis = new window.Lenis({ lerp: 0.1 });
  if (ScrollTrigger) lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
}

function surfaceSections() {
  return [...document.querySelectorAll("section[data-surface], footer[data-surface]")];
}

function setupSurfaces(gsap, ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  surfaceSections().forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: "top center",
      end: "bottom center",
      onToggle(self) {
        if (self.isActive) activate(section);
      },
    });
  });
  ScrollTrigger.refresh();
  const mid = window.innerHeight / 2;
  const current = surfaceSections().find((section) => {
    const rect = section.getBoundingClientRect();
    return rect.top <= mid && rect.bottom > mid;
  });
  if (current) activate(current);
  document.fonts?.ready?.then(() => ScrollTrigger.refresh());
}

export function initScroll() {
  const reduced = prefersReducedMotion();
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  if (!reduced && window.Lenis && gsap) setupLenis(gsap, ScrollTrigger);
  if (gsap && ScrollTrigger) setupSurfaces(gsap, ScrollTrigger);

  document.addEventListener("click", onAnchorClick);
  window.addEventListener("popstate", () => {
    const target = elementFromHash(location.hash);
    if (target) scrollToTarget(target);
  });

  const opening = elementFromHash(location.hash);
  if (opening) requestAnimationFrame(() => scrollToTarget(opening));
}
