import { duration, ease } from "./motion.config.js";
import { releaseIndex } from "./chrome.js";
import { prefersReducedMotion } from "./motion.js";
import { qualityTier } from "./quality.js";
import { elementFromHash, focusDestination, scrollToTarget } from "./scroll.js";

let running = false;

function coverRadius(x, y) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 2;
}

function clampPoint(x, y) {
  return {
    x: Math.min(window.innerWidth - 1, Math.max(1, x)),
    y: Math.min(window.innerHeight - 1, Math.max(1, y)),
  };
}

function pointFrom(event, link) {
  const rect = link.getBoundingClientRect();
  const center = clampPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  if (event.detail === 0 && event.clientX === 0 && event.clientY === 0) return center;
  return clampPoint(event.clientX, event.clientY);
}

function originFor(target) {
  const labelledby = target.getAttribute("aria-labelledby");
  const node = (labelledby && document.getElementById(labelledby)) || target;
  const rect = node.getBoundingClientRect();
  return clampPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

/* Ink matches the Index overlay, so an ink disc would expand invisibly. */
function veilColor(surface) {
  if (surface === "acid") return "var(--acid)";
  if (surface === "cobalt") return "var(--cobalt)";
  if (surface === "paper") return "var(--paper)";
  return "var(--paper)";
}

function veilNode() {
  let node = document.querySelector(".iris");
  if (node) return node;
  node = document.createElement("div");
  node.className = "iris";
  node.hidden = true;
  node.setAttribute("aria-hidden", "true");
  document.body.append(node);
  return node;
}

function play(link, event, href, target) {
  const gsap = window.gsap;
  const veil = veilNode();
  const from = pointFrom(event, link);
  const state = { radius: 0, x: from.x, y: from.y };
  const paint = () => {
    veil.style.clipPath = `circle(${state.radius.toFixed(2)}px at ${state.x.toFixed(2)}px ${state.y.toFixed(2)}px)`;
  };
  running = true;
  veil.style.background = veilColor(target.dataset.surface);
  veil.hidden = false;
  paint();

  const half = duration.iris / 2;
  const timeline = gsap.timeline({
    onComplete() {
      veil.hidden = true;
      veil.style.clipPath = "";
      running = false;
    },
  });
  timeline.to(state, {
    radius: coverRadius(from.x, from.y),
    duration: half,
    ease: ease.glide,
    onUpdate: paint,
  });
  timeline.add(() => {
    if (location.hash !== href) history.pushState(null, "", href);
    releaseIndex();
    scrollToTarget(target, { immediate: true });
    const next = originFor(target);
    state.x = next.x;
    state.y = next.y;
    state.radius = coverRadius(next.x, next.y);
    paint();
    focusDestination(target);
  });
  timeline.to(state, {
    radius: 0,
    duration: half,
    ease: ease.glide,
    onUpdate: paint,
  });
}

function onClick(event) {
  if (running) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (prefersReducedMotion() || qualityTier() === "low") return;
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest?.("#index-overlay a[href^='#']");
  if (!link || !window.gsap) return;
  const href = link.getAttribute("href");
  const target = elementFromHash(href);
  if (!target) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  play(link, event, href, target);
}

export function initIris() {
  document.addEventListener("click", onClick, true);
}
