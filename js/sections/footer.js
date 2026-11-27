import { onArrive } from "../core/arrive.js";
import { duration, ease } from "../core/motion.config.js";
import { prefersReducedMotion } from "../core/motion.js";

export function initFooter() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
  const footer = document.querySelector(".footer");
  const rule = footer?.querySelector(".footer-rule");
  const gsap = window.gsap;
  if (!footer || !rule || !gsap || prefersReducedMotion()) return;
  gsap.set(rule, { scaleX: 0, transformOrigin: "left center" });
  onArrive(footer, "top 92%", () => {
    gsap.to(rule, {
      scaleX: 1,
      duration: duration.hairline,
      ease: ease.glide,
      overwrite: true,
    });
  });
}
