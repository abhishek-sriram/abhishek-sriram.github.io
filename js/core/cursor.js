import { prefersReducedMotion } from "./motion.js";

const HOT = "a, button, input, textarea, select, summary, label, [data-cursor], [data-magnet]";

export function initCursor() {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!fine.matches || prefersReducedMotion()) return;
  if (document.querySelector(".cursor")) return;

  const cursor = document.createElement("div");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");
  const ring = document.createElement("span");
  ring.className = "cursor-ring";
  const label = document.createElement("span");
  label.className = "cursor-label";
  cursor.append(ring, label);
  document.body.append(cursor);

  let x = 0;
  let y = 0;
  let cx = 0;
  let cy = 0;
  let raf = 0;
  let placed = false;

  const frame = () => {
    cx += (x - cx) * 0.18;
    cy += (y - cy) * 0.18;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    raf = Math.hypot(x - cx, y - cy) > 0.4 ? requestAnimationFrame(frame) : 0;
  };

  const poke = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    x = event.clientX;
    y = event.clientY;
    if (!placed) {
      cx = x;
      cy = y;
      placed = true;
      cursor.classList.add("is-on");
    }
    const node = event.target instanceof Element ? event.target : null;
    cursor.classList.toggle("is-hot", Boolean(node?.closest(HOT)));
    const name = node?.closest("[data-cursor]")?.dataset.cursor?.trim() || "";
    label.textContent = name;
    cursor.classList.toggle("has-label", Boolean(name));
    poke();
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", () => {
    cursor.classList.remove("is-on");
  });
}
