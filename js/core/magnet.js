import { duration, ease } from "./motion.config.js";
import { prefersReducedMotion } from "./motion.js";

export function attachMagnet(element, strength = 0.35) {
  if (!element) return;
  const pull = Number.isFinite(strength) ? strength : 0.35;
  const snap = ease.snap;

  element.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") return;
    element.style.transition = "none";
  });

  element.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const rect = element.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    element.style.transform = `translate3d(${dx * pull}px, ${dy * pull}px, 0)`;
  });

  element.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") return;
    element.style.transition = `transform ${duration.magnet}s ${snap}`;
    element.style.transform = "translate3d(0, 0, 0)";
  });
}

export function initMagnet(root = document) {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!fine.matches || prefersReducedMotion()) return;
  root.querySelectorAll("[data-magnet]").forEach((element) => {
    const raw = element.getAttribute("data-magnet");
    const strength = raw === "" || raw == null ? 0.35 : Number(raw);
    attachMagnet(element, strength);
  });
}
