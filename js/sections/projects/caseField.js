import { clamp } from "../../core/clamp.js";
import { prefersReducedMotion } from "../../core/motion.js";
import { onPageVisibility, pageHidden } from "../../core/quality.js";
import { svgElement } from "../../core/svg.js";
import { paintMotifLayer } from "./plate.js";

const driftAmp = [4, 7, 10];
const pointerAmp = [5, 11, 18];

export function createCaseField() {
  const root = document.createElement("div");
  root.className = "case-field";
  root.setAttribute("aria-hidden", "true");

  const layers = [0, 1, 2].map((depth) => {
    const layer = document.createElement("div");
    layer.className = "case-field-layer";
    layer.dataset.depth = String(depth);
    const motif = svgElement("svg", { class: "project-motif" });
    layer.append(motif);
    root.append(layer);
    return { layer, motif, depth };
  });

  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let running = false;

  function place(now) {
    const t = now / 1000;
    layers.forEach(({ layer, depth }) => {
      const driftX = Math.sin(t * 0.22 + depth * 1.7) * driftAmp[depth];
      const driftY = Math.cos(t * 0.17 + depth * 0.9) * driftAmp[depth] * 0.55;
      const parX = pointerX * pointerAmp[depth];
      const parY = pointerY * pointerAmp[depth] * 0.6;
      layer.style.transform = `translate3d(${(driftX + parX).toFixed(2)}px, ${(driftY + parY).toFixed(2)}px, var(--layer-z))`;
    });
  }

  function tick(now) {
    if (!running || prefersReducedMotion() || pageHidden()) {
      frame = 0;
      return;
    }
    place(now);
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    layers.forEach(({ layer }) => {
      layer.style.transform = "";
    });
  }

  onPageVisibility((isHidden) => {
    if (isHidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      return;
    }
    if (running && !frame) frame = requestAnimationFrame(tick);
  });

  return {
    root,
    paint(title) {
      layers.forEach(({ motif, depth }) => paintMotifLayer(motif, title, depth));
    },
    start() {
      pointerX = 0;
      pointerY = 0;
      running = true;
      if (prefersReducedMotion() || pageHidden()) {
        if (prefersReducedMotion()) stop();
        return;
      }
      if (!frame) frame = requestAnimationFrame(tick);
    },
    stop,
    aim(clientX, clientY) {
      if (prefersReducedMotion()) return;
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      pointerX = clamp((clientX / width) * 2 - 1, -1, 1);
      pointerY = clamp((clientY / height) * 2 - 1, -1, 1);
    },
  };
}
