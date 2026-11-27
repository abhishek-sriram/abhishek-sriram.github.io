import { handoff } from "./motion.config.js";
import { prefersReducedMotion } from "./motion.js";

export function initHandoff() {
  if (prefersReducedMotion()) return;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  const nodes = [...document.querySelectorAll("main > section")].slice(1);
  const footer = document.querySelector("body > footer");
  if (footer) nodes.push(footer);

  nodes.forEach((section) => {
    section.classList.add("handoff");
    /* Clear the clip once the wipe finishes. A lasting clip-path breaks sticky inside the section. */
    const paint = (progress) => {
      if (progress >= 1) {
        section.style.clipPath = "";
        return;
      }
      const shown = progress * handoff;
      section.style.clipPath = `inset(0 0 calc(100% - ${shown.toFixed(2)}px) 0)`;
    };
    ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: `+=${handoff}`,
      scrub: true,
      onRefresh(self) {
        paint(self.progress);
      },
      onUpdate(self) {
        paint(self.progress);
      },
      onLeave() {
        paint(1);
      },
      onLeaveBack() {
        paint(0);
      },
    });
  });
  ScrollTrigger.update();
}
