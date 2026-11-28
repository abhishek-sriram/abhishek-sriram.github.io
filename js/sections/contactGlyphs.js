import { stepSpring } from "../core/spring.js";
import { prefersReducedMotion } from "../core/motion.js";
import { onPageVisibility, pageHidden, qualityTier } from "../core/quality.js";

const REACH = 160;
const PUSH = 26;
const TURN = 12;
const RIPPLE = 260;

function channel() {
  return { value: 0, velocity: 0 };
}

function splitGlyphs(node) {
  const text = node.textContent;
  const fragment = document.createDocumentFragment();
  for (const char of text) {
    const glyph = document.createElement("span");
    glyph.className = "contact-glyph";
    glyph.textContent = char;
    fragment.append(glyph);
  }
  node.replaceChildren(fragment);
}

function resting(glyph, tx, ty, tr) {
  return Math.abs(glyph.x.value - tx) < 0.08
    && Math.abs(glyph.y.value - ty) < 0.08
    && Math.abs(glyph.rot.value - tr) < 0.08
    && Math.abs(glyph.x.velocity) < 0.08
    && Math.abs(glyph.y.velocity) < 0.08
    && Math.abs(glyph.rot.velocity) < 0.08;
}

function paint(glyph) {
  const x = glyph.x.value;
  const y = glyph.y.value;
  const rot = glyph.rot.value;
  if (Math.abs(x) < 0.08 && Math.abs(y) < 0.08 && Math.abs(rot) < 0.08) {
    if (glyph.drawn) {
      glyph.el.style.transform = "";
      glyph.drawn = false;
    }
    return;
  }
  glyph.drawn = true;
  glyph.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
}

export function initContactGlyphs(section) {
  const title = section.querySelector(".contact-title");
  const email = section.querySelector(".contact-email");
  if (email) email.setAttribute("aria-label", email.textContent);
  if (title) splitGlyphs(title);
  if (email) splitGlyphs(email);

  const glyphs = [...section.querySelectorAll(".contact-title .contact-glyph, .contact-email .contact-glyph")].map((el) => ({
    el,
    x: channel(),
    y: channel(),
    rot: channel(),
    drawn: false,
    armed: false,
    kickAt: 0,
    kickVx: 0,
    kickVy: 0,
    kickVr: 0,
  }));
  if (!glyphs.length || prefersReducedMotion() || qualityTier() === "low") return;

  let pointerX = 0;
  let pointerY = 0;
  let tracking = false;
  let bounds = section.getBoundingClientRect();
  let pendingTap = null;
  let touchStart = null;
  let raf = 0;
  let last = 0;
  let wasNear = false;

  const inside = () => tracking
    && pointerX >= bounds.left - REACH
    && pointerX <= bounds.right + REACH
    && pointerY >= bounds.top - REACH
    && pointerY <= bounds.bottom + REACH;

  const poke = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  onPageVisibility((isHidden) => {
    if (!isHidden) poke();
  });

  function placeBounds() {
    bounds = section.getBoundingClientRect();
  }

  function armRipple(x, y, now) {
    for (const glyph of glyphs) {
      const rect = glyph.el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5 - glyph.x.value;
      const cy = rect.top + rect.height * 0.5 - glyph.y.value;
      const dx = cx - x;
      const dy = cy - y;
      const dist = Math.hypot(dx, dy);
      if (dist > REACH) continue;
      const fall = dist < 0.01 ? 1 : 1 - dist / REACH;
      const nx = dist < 0.01 ? 0 : dx / dist;
      const ny = dist < 0.01 ? -1 : dy / dist;
      glyph.armed = true;
      glyph.kickAt = now + dist * 1.15;
      glyph.kickVx = nx * fall * RIPPLE;
      glyph.kickVy = ny * fall * RIPPLE;
      glyph.kickVr = nx * fall * 70;
    }
  }

  function frame(now) {
    raf = 0;
    if (pageHidden()) return;
    const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016);
    last = now;

    if (pendingTap) {
      const tap = pendingTap;
      pendingTap = null;
      placeBounds();
      const local = tap.x >= bounds.left - REACH
        && tap.x <= bounds.right + REACH
        && tap.y >= bounds.top - REACH
        && tap.y <= bounds.bottom + REACH;
      if (local) armRipple(tap.x, tap.y, now);
    }

    if (inside()) placeBounds();
    const near = inside();
    const centers = near
      ? glyphs.map((glyph) => {
        const rect = glyph.el.getBoundingClientRect();
        return {
          x: rect.left + rect.width * 0.5 - glyph.x.value,
          y: rect.top + rect.height * 0.5 - glyph.y.value,
        };
      })
      : null;

    let moving = false;
    for (let i = 0; i < glyphs.length; i += 1) {
      const glyph = glyphs[i];
      if (glyph.armed && now >= glyph.kickAt) {
        glyph.x.velocity += glyph.kickVx;
        glyph.y.velocity += glyph.kickVy;
        glyph.rot.velocity += glyph.kickVr;
        glyph.armed = false;
      }
      let tx = 0;
      let ty = 0;
      let tr = 0;
      if (centers) {
        const dx = centers[i].x - pointerX;
        const dy = centers[i].y - pointerY;
        const dist = Math.hypot(dx, dy);
        if (dist < REACH && dist > 0.01) {
          const fall = 1 - dist / REACH;
          const shaped = fall * fall * (3 - 2 * fall);
          const inv = shaped / dist;
          tx = dx * inv * PUSH;
          ty = dy * inv * PUSH;
          tr = dx * inv * TURN;
        }
      }
      stepSpring(glyph.x, tx, dt);
      stepSpring(glyph.y, ty, dt);
      stepSpring(glyph.rot, tr, dt);
      paint(glyph);
      if (glyph.armed || !resting(glyph, tx, ty, tr)) moving = true;
    }

    if (moving) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    tracking = true;
    const near = inside();
    if (near || wasNear) poke();
    wasNear = near;
  }, { passive: true });

  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    touchStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }, { passive: true });

  window.addEventListener("pointerup", (event) => {
    if (!touchStart || event.pointerId !== touchStart.id) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    const start = touchStart;
    touchStart = null;
    if (dx * dx + dy * dy > 64) return;
    pendingTap = { x: start.x, y: start.y };
    poke();
  }, { passive: true });

  window.addEventListener("pointercancel", (event) => {
    if (touchStart && event.pointerId === touchStart.id) touchStart = null;
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", () => {
    tracking = false;
    if (wasNear) poke();
    wasNear = false;
  });

  window.addEventListener("scroll", () => {
    placeBounds();
    const near = inside();
    if (near || wasNear) poke();
    wasNear = near;
  }, { passive: true });

  window.addEventListener("resize", () => {
    placeBounds();
  }, { passive: true });

  const observer = new ResizeObserver(() => {
    placeBounds();
  });
  observer.observe(document.body);
  document.fonts?.ready?.then(placeBounds);
}
