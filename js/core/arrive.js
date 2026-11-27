import { prefersReducedMotion } from "./motion.js";

export function onArrive(trigger, start, run) {
  if (prefersReducedMotion()) return;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) {
    run();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.create({
    trigger,
    start,
    once: true,
    onEnter: run,
  });
}
