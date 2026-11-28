import { prefersReducedMotion } from "./motion.js";
import { pageHidden } from "./quality.js";

const HOT = "a, button, input, textarea, select, summary, label, [data-cursor], [data-magnet]";
const CONTROL = "a, button, input, textarea, select, summary, label";
const PULL = 0.72;
const FOLLOW = 0.18;
const SNAP = 0.42;

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
  ring.append(label);
  cursor.append(ring);
  document.body.append(cursor);

  let x = 0;
  let y = 0;
  let cx = 0;
  let cy = 0;
  let raf = 0;
  let placed = false;
  let hotOn = false;
  let captionOn = "";
  let snapEl = null;

  const frame = () => {
    if (pageHidden()) {
      raf = 0;
      return;
    }
    let aimX = x;
    let aimY = y;
    let gain = FOLLOW;
    if (snapEl?.isConnected) {
      const rect = snapEl.getBoundingClientRect();
      aimX = x + (rect.left + rect.width * 0.5 - x) * PULL;
      aimY = y + (rect.top + rect.height * 0.5 - y) * PULL;
      gain = SNAP;
    }
    cx += (aimX - cx) * gain;
    cy += (aimY - cy) * gain;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    raf = Math.hypot(aimX - cx, aimY - cy) > 0.4 ? requestAnimationFrame(frame) : 0;
  };

  const poke = () => {
    if (pageHidden() || raf) return;
    raf = requestAnimationFrame(frame);
  };

  const setHot = (hot) => {
    if (hot === hotOn) return;
    hotOn = hot;
    cursor.classList.toggle("is-hot", hot);
  };

  const setCaption = (caption) => {
    if (caption === captionOn) return;
    captionOn = caption;
    label.textContent = caption;
    cursor.classList.toggle("has-label", caption.length > 0);
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
    snapEl = node?.closest("button") ?? null;
    setHot(Boolean(node?.closest(HOT)));
    const named = node?.closest("[data-cursor]")?.getAttribute("data-cursor")?.trim() || "";
    const caption = named || (node?.closest(".hero") && !node.closest(CONTROL) ? "Drag" : "");
    setCaption(caption);
    poke();
  }, { passive: true });

  const press = (event) => {
    if (event.pointerType === "touch") return;
    cursor.classList.add("is-down");
  };

  const release = () => {
    cursor.classList.remove("is-down");
  };

  window.addEventListener("pointerdown", press);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);

  document.documentElement.addEventListener("pointerleave", () => {
    cursor.classList.remove("is-on", "is-down");
    snapEl = null;
  });
}
