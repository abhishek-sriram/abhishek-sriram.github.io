import { duration, ease, glide, handoff, settle, snap } from "./motion.config.js";

export { duration, ease, glide, handoff, settle, snap };

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function applyMotionConfig() {
  const root = document.documentElement;
  root.style.setProperty("--duration-surface", `${duration.surface}s`);
  root.style.setProperty("--duration-reveal", `${duration.reveal}s`);
  root.style.setProperty("--duration-ui", `${duration.ui}s`);
  root.style.setProperty("--duration-check", `${duration.check}s`);
  root.style.setProperty("--duration-rail", `${duration.rail}s`);
  root.style.setProperty("--duration-row", `${duration.row}s`);
  root.style.setProperty("--duration-token", `${duration.token}s`);
  root.style.setProperty("--duration-credential", `${duration.credential}s`);
  root.style.setProperty("--duration-index", `${duration.index}s`);
  root.style.setProperty("--ease-snap", ease.snap);
  root.style.setProperty("--ease-glide", ease.glide);
  root.style.setProperty("--handoff", `${handoff}px`);
}
