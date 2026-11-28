import { duration, ease } from "../core/motion.config.js";
import { prefersReducedMotion } from "../core/motion.js";

function pair(value) {
  const [x, y] = String(value || "").split(",").map(Number);
  return { x, y };
}

function moveDot(dot, x, y) {
  dot.setAttribute("cx", x);
  dot.setAttribute("cy", y);
}

function playRetrieval(svg) {
  const gsap = window.gsap;
  svg.querySelectorAll(".retrieval-dot").forEach((dot) => {
    const start = pair(dot.dataset.start);
    const end = pair(dot.dataset.end);
    if (!gsap) {
      moveDot(dot, end.x, end.y);
      return;
    }
    gsap.killTweensOf(dot);
    gsap.fromTo(dot, { attr: { cx: start.x, cy: start.y } }, {
      attr: { cx: end.x, cy: end.y },
      duration: duration.reveal,
      ease: ease.settle,
      overwrite: true,
    });
  });
}

const travel = new WeakMap();

function playLatency(svg) {
  const path = svg.querySelector(".latency-line");
  const pulse = svg.querySelector(".latency-pulse");
  const gsap = window.gsap;
  if (!path || !pulse) return;
  const length = path.getTotalLength();
  const place = (distance) => {
    const point = path.getPointAtLength(Math.max(0, Math.min(length, distance)));
    moveDot(pulse, point.x, point.y);
  };
  if (!gsap || !length) {
    place(length);
    return;
  }
  travel.get(pulse)?.kill();
  const proxy = { distance: 0 };
  const tween = gsap.fromTo(proxy, { distance: 0 }, {
    distance: length,
    duration: duration.latency,
    ease: ease.none,
    onUpdate: () => place(proxy.distance),
  });
  travel.set(pulse, tween);
}

function playSpark(svg) {
  const path = svg.querySelector(".observability-line");
  const gsap = window.gsap;
  if (!path) return;
  const length = path.getTotalLength();
  if (!gsap || !length) {
    path.style.strokeDashoffset = "0";
    return;
  }
  gsap.killTweensOf(path);
  path.style.strokeDasharray = `${length}`;
  gsap.fromTo(path, { strokeDashoffset: length }, {
    strokeDashoffset: 0,
    duration: duration.reveal,
    ease: ease.settle,
    overwrite: true,
  });
}

const drift = new WeakMap();

function playPrivacy(svg) {
  const gsap = window.gsap;
  svg.querySelectorAll(".privacy-dot").forEach((dot) => {
    const start = pair(dot.dataset.start);
    const mid = pair(dot.dataset.mid);
    const end = pair(dot.dataset.end);
    if (!gsap) {
      moveDot(dot, end.x, end.y);
      return;
    }
    drift.get(dot)?.kill();
    const timeline = gsap.timeline()
      .set(dot, { attr: { cx: start.x, cy: start.y } })
      .to(dot, { attr: { cx: mid.x, cy: mid.y }, duration: duration.privacyOut, ease: ease.settle })
      .to(dot, { attr: { cx: end.x, cy: end.y }, duration: duration.privacyIn, ease: ease.settle });
    drift.set(dot, timeline);
  });
}

function play(item) {
  const svg = item.querySelector(".principle-mark");
  if (!svg) return;
  const kind = item.dataset.principle;
  if (kind === "retrieval") playRetrieval(svg);
  else if (kind === "latency") playLatency(svg);
  else if (kind === "observability") playSpark(svg);
  else if (kind === "privacy") playPrivacy(svg);
}

function armPrinciples(section, reduced) {
  const items = [...section.querySelectorAll(".principle")];
  items.forEach((item) => {
    item.querySelectorAll(".retrieval-dot, .privacy-dot").forEach((dot) => {
      dot.dataset.end = `${dot.cx.baseVal.value},${dot.cy.baseVal.value}`;
    });
  });
  if (reduced) return;

  items.forEach((item) => {
    item.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      play(item);
    });
  });
}

export function initAbout() {
  const section = document.getElementById("about");
  if (!section) return;
  armPrinciples(section, prefersReducedMotion());
}
