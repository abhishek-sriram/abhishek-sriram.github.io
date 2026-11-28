import { duration, skewMax, velocity } from "./motion.config.js";
import { prefersReducedMotion } from "./motion.js";
import { getLenis } from "./scroll.js";

const HEADINGS = ".contact-title";

let pace = 0;

export function scrollPace() {
  return pace;
}

export function initVelocity() {
  if (prefersReducedMotion()) return;
  const gsap = window.gsap;
  const lenis = getLenis();
  if (!gsap || !lenis) return;

  const nodes = [...document.querySelectorAll(HEADINGS)];
  if (!nodes.length) return;

  let sample = 0;
  let skew = 0;
  let hot = false;
  let last = performance.now();

  lenis.on("scroll", (event) => {
    sample = event.velocity || 0;
  });

  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(48, now - last);
    last = now;
    const blend = 1 - Math.exp(-dt / (duration.skew * 1000));
    const speed = Math.abs(sample);
    const span = Math.max(1, velocity.ceil - velocity.deadzone);
    const amount = speed <= velocity.deadzone ? 0 : Math.min(1, (speed - velocity.deadzone) / span);
    const next = (sample < 0 ? -1 : sample > 0 ? 1 : 0) * amount * skewMax;
    skew += (next - skew) * blend;
    pace += (amount - pace) * blend;
    sample *= 1 - blend;

    if (Math.abs(skew) < 0.02 && Math.abs(next) < 0.02 && pace < 0.02) {
      if (hot) {
        for (const node of nodes) node.style.transform = "";
        hot = false;
      }
      skew = 0;
      pace = 0;
      return;
    }
    hot = true;
    const value = `skewX(${skew.toFixed(2)}deg)`;
    for (const node of nodes) node.style.transform = value;
  });
}
