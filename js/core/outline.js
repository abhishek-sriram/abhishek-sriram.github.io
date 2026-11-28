import { prefersReducedMotion } from "./motion.js";
import { qualityTier } from "./quality.js";
import { getLenis } from "./scroll.js";

const HEADS = ".contact-title";

function supported() {
  return CSS.supports("-webkit-background-clip", "text") || CSS.supports("background-clip", "text");
}

function paint(nodes) {
  const mid = window.innerHeight * 0.5;
  const span = Math.max(1, mid);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) continue;
    const center = rect.top + rect.height * 0.5;
    const fill = 1 - Math.min(1, Math.abs(center - mid) / span);
    node.style.setProperty("--fill", fill.toFixed(3));
  }
}

export function initOutline() {
  if (prefersReducedMotion() || qualityTier() === "low" || !supported()) return;
  const nodes = [...document.querySelectorAll(HEADS)];
  if (!nodes.length) return;
  for (const node of nodes) node.classList.add("is-outline");

  const draw = () => paint(nodes);
  draw();
  const lenis = getLenis();
  if (lenis) lenis.on("scroll", draw);
  else window.addEventListener("scroll", draw, { passive: true });
  window.addEventListener("resize", draw, { passive: true });
  document.fonts?.ready?.then(draw);
}
