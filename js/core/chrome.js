import { duration, ease } from "./motion.config.js";
import { prefersReducedMotion } from "./motion.js";
import { getLenis } from "./scroll.js";

const opener = () => document.querySelector(".index-open");
const overlay = () => document.getElementById("index-overlay");

function parked() {
  return [
    document.querySelector(".skip"),
    document.getElementById("main"),
    document.querySelector(".footer"),
    document.querySelector(".rail"),
  ].filter(Boolean);
}

function setParked(on) {
  for (const el of parked()) el.inert = on;
}

function lines() {
  return [...document.querySelectorAll(".index-overlay .index-line a")];
}

function focusable() {
  return [...document.querySelectorAll(".mast a, .mast button, .index-overlay a")].filter((el) => {
    if (el.closest("[hidden]")) return false;
    if (el.inert) return false;
    return true;
  });
}

let lockedY = 0;

function lockScroll() {
  const engine = getLenis();
  if (engine) {
    engine.stop();
    return;
  }
  lockedY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${lockedY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
}

function unlockScroll() {
  const engine = getLenis();
  if (engine) {
    engine.start();
    return;
  }
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  window.scrollTo(0, lockedY);
}

function reveal(items) {
  const gsap = window.gsap;
  if (!gsap || prefersReducedMotion()) return;
  gsap.killTweensOf(items);
  gsap.fromTo(
    items,
    { yPercent: 110, opacity: 0 },
    {
      yPercent: 0,
      opacity: 1,
      duration: duration.reveal,
      stagger: duration.stagger,
      ease: ease.settle,
      overwrite: true,
    },
  );
}

function openIndex() {
  const panel = overlay();
  const button = opener();
  if (!panel || !button) return;
  const items = lines();
  const gsap = window.gsap;
  if (gsap && !prefersReducedMotion()) {
    gsap.set(items, { yPercent: 110, opacity: 0 });
  } else if (gsap) {
    gsap.set(items, { yPercent: 0, opacity: 1 });
  }
  panel.hidden = false;
  panel.scrollTop = 0;
  button.setAttribute("aria-expanded", "true");
  setParked(true);
  lockScroll();
  reveal(items);
  items[0]?.focus();
}

function closeIndex(restore) {
  const panel = overlay();
  const button = opener();
  if (!panel || panel.hidden) return;
  window.gsap?.killTweensOf(lines());
  if (restore || panel.contains(document.activeElement)) button?.focus({ preventScroll: true });
  panel.hidden = true;
  button?.setAttribute("aria-expanded", "false");
  setParked(false);
  unlockScroll();
}

function onKeydown(event) {
  const panel = overlay();
  if (!panel || panel.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeIndex(true);
    return;
  }
  if (event.key !== "Tab") return;
  const nodes = focusable();
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement;
  if (!nodes.includes(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function startClock() {
  const clock = document.querySelector(".clock");
  if (!clock) return;
  const display = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const tick = () => {
    const now = new Date();
    clock.textContent = display.format(now);
    const parts = Object.fromEntries(stamp.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    clock.dateTime = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+05:30`;
  };
  tick();
  setInterval(tick, 1000);
}

export function initChrome() {
  const button = opener();
  const panel = overlay();
  if (!button || !panel) return;
  startClock();
  button.addEventListener("click", () => {
    if (panel.hidden) openIndex();
    else closeIndex(true);
  });
  panel.addEventListener("click", (event) => {
    if (event.target === panel) closeIndex(true);
  });
  const hashClick = (event) => {
    if (panel.hidden || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    return Boolean(event.target.closest?.("a[href^='#']"));
  };
  document.addEventListener("click", (event) => {
    if (!hashClick(event)) return;
    setParked(false);
    getLenis()?.start();
  }, true);
  document.addEventListener("click", (event) => {
    if (!hashClick(event)) return;
    closeIndex(false);
  });
  document.addEventListener("keydown", onKeydown);
}
