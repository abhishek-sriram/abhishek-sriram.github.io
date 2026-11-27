import { shouldPlayLoad } from "../core/load.js";
import { duration } from "../core/motion.config.js";
import { prefersReducedMotion } from "../core/motion.js";
import { initHeroField } from "./hero/field.js";
import { initHeroName } from "./hero/name.js";
import { initHeroQuery } from "./hero/query.js";

function settleEase(amount) {
  return amount >= 1 ? 1 : 1 - 2 ** (-10 * amount);
}

function initHeroProof(section, { reduced }) {
  const nodes = [...section.querySelectorAll("[data-count]")];
  if (!nodes.length || reduced) return;

  function countUp(node) {
    const target = Number(node.dataset.count);
    const decimals = Number(node.dataset.decimals || 0);
    const suffix = node.dataset.suffix || "";
    const started = performance.now();
    node.textContent = `${(0).toFixed(decimals)}${suffix}`;
    function tick(now) {
      const progress = Math.min(1, (now - started) / (duration.count * 1000));
      const value = target * settleEase(progress);
      node.textContent = `${(progress >= 1 ? target : value).toFixed(decimals)}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      countUp(entry.target);
    }
  }, { threshold: 0.6 });
  nodes.forEach((node) => observer.observe(node));
}

export function initHero(index) {
  const section = document.querySelector(".hero");
  if (!section || !index?.length) return;
  const reduced = prefersReducedMotion();
  const field = initHeroField(section.querySelector(".hero-field"), index, {
    reduced,
    holdIntro: shouldPlayLoad(),
  });
  globalThis.__heroFrameMs = field.frameMs;
  initHeroName(section, { reduced });
  initHeroQuery(section, index, field, { reduced });
  initHeroProof(section, { reduced });
  return field;
}
