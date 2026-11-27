import { onArrive } from "../core/arrive.js";
import { delay, duration, ease } from "../core/motion.config.js";
import { prefersReducedMotion } from "../core/motion.js";
import { layers, tools, uses } from "../data/toolkit.js";

const fineQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
const MAX_SCALE = 1.25;
const FALLOFF = 150;
const REACH = 72;

const glideEase = unitBezier(...bezierStops(ease.glide));

function bezierStops(timing) {
  const values = timing.match(/[\d.]+/g).map(Number);
  return values.length === 4 ? values : [0.65, 0, 0.35, 1];
}

/* GSAP eases are functions. `glide` is the CSS timing function. */
function unitBezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;

  function solveX(x) {
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24; i += 1) {
      const estimate = sampleX(t);
      if (Math.abs(estimate - x) < 1e-6) return t;
      if (estimate < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  }

  return (progress) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    return sampleY(solveX(progress));
  };
}

function members(mode, groupId) {
  const key = mode === "layer" ? "layer" : "use";
  const list = tools.filter((tool) => tool[key] === groupId);
  if (mode === "use") list.sort((a, b) => a.useIndex - b.useIndex);
  return list;
}

export function initToolkit() {
  const section = document.getElementById("toolkit");
  const board = document.getElementById("toolkit-board");
  const switcher = section?.querySelector(".toolkit-switch");
  const live = section?.querySelector(".toolkit-live");
  if (!section || !board || !switcher) return;

  const gsap = window.gsap;
  const Flip = window.Flip;
  if (gsap && Flip) gsap.registerPlugin(Flip);
  section.style.setProperty("--duration-slit", `${duration.slit}s`);
  section.style.setProperty("--delay-group", `${delay.group}s`);

  const tokenById = new Map(tools.map((tool) => [tool.id, createToken(tool)]));
  let mode = "layer";
  let flipping = false;
  let flipTween = null;
  let magnifyFrame = 0;
  let lockTimer = 0;
  let lockedWidth = -1;

  function tokenList() {
    return tools.map((tool) => tokenById.get(tool.id));
  }

  function clearMagnification(force) {
    if (flipping && !force) return;
    for (const token of tokenList()) {
      token.style.transform = "";
      token.style.zIndex = "";
    }
  }

  function paint(next) {
    const groups = next === "layer" ? layers : uses;
    const fragment = document.createDocumentFragment();
    let index = 0;
    for (const group of groups) {
      const items = members(next, group.id);
      if (!items.length) continue;
      const block = document.createElement("div");
      block.className = "toolkit-group";
      block.dataset.group = group.id;
      block.style.setProperty("--i", String(index));
      index += 1;
      const heading = document.createElement("h3");
      heading.className = "toolkit-group-heading";
      const name = document.createElement("button");
      name.type = "button";
      name.className = "toolkit-group-name";
      name.textContent = group.name;
      heading.append(name);
      const list = document.createElement("ul");
      list.className = "toolkit-tokens";
      for (const tool of items) list.append(tokenById.get(tool.id));
      block.append(heading, list);
      fragment.append(block);
    }
    board.replaceChildren(fragment);
  }

  function syncSwitch() {
    section.dataset.mode = mode;
    for (const button of switcher.querySelectorAll("[data-mode]")) {
      const on = button.dataset.mode === mode;
      button.setAttribute("aria-checked", on ? "true" : "false");
      button.tabIndex = on ? 0 : -1;
    }
  }

  function rememberFocus() {
    const active = document.activeElement;
    if (!active || !board.contains(active)) return null;
    return active.closest(".toolkit-group")?.dataset.group || null;
  }

  function restoreFocus(groupId) {
    if (!groupId) return;
    const button = board.querySelector(`[data-group="${CSS.escape(groupId)}"] .toolkit-group-name`);
    if (button && document.activeElement !== button) button.focus({ preventScroll: true });
  }

  function lockBoard() {
    if (flipping) return;
    const focus = rememberFocus();
    const held = mode;
    const previous = board.style.minHeight;
    board.style.minHeight = "0px";
    paint("layer");
    const layerHeight = board.getBoundingClientRect().height;
    paint("use");
    const useHeight = board.getBoundingClientRect().height;
    mode = held;
    paint(mode);
    syncSwitch();
    const nextHeight = `${Math.ceil(Math.max(layerHeight, useHeight))}px`;
    board.style.minHeight = nextHeight;
    restoreFocus(focus);
    if (previous !== nextHeight) window.ScrollTrigger?.refresh();
  }

  function scheduleLock() {
    window.clearTimeout(lockTimer);
    lockTimer = window.setTimeout(lockBoard, 120);
  }

  function stopFlip() {
    const tween = flipTween;
    flipTween = null;
    flipping = false;
    if (!tween) return;
    tween.eventCallback("onComplete", null);
    tween.eventCallback("onInterrupt", null);
    tween.progress(1);
    tween.kill();
  }

  function regroup(next, fromUser) {
    if (next !== "layer" && next !== "use") return;
    if (next === mode) return;
    cancelAnimationFrame(magnifyFrame);
    magnifyFrame = 0;
    stopFlip();
    clearMagnification(true);

    const instant = prefersReducedMotion() || !gsap || !Flip;
    if (instant) {
      mode = next;
      paint(mode);
      syncSwitch();
      if (fromUser && live) live.textContent = next === "layer" ? "By layer" : "By use";
      return;
    }

    flipping = true;
    const state = Flip.getState(tokenList());
    mode = next;
    paint(mode);
    syncSwitch();
    if (fromUser && live) live.textContent = next === "layer" ? "By layer" : "By use";

    flipTween = Flip.from(state, {
      duration: duration.reveal,
      ease: glideEase,
      absolute: false,
      scale: false,
      prune: true,
      onComplete: endFlip,
      onInterrupt: endFlip,
    });
  }

  function endFlip() {
    flipTween = null;
    flipping = false;
    gsap.set(tokenList(), { clearProps: "transform" });
    for (const token of tokenList()) token.style.zIndex = "";
    if (queueMagnify.point) applyMagnify(queueMagnify.point);
  }

  function applyMagnify(point) {
    if (!point || flipping || prefersReducedMotion() || !fineQuery.matches || point.pointerType === "touch") {
      clearMagnification(false);
      return;
    }
    if (!point.overTokens) {
      clearMagnification(false);
      return;
    }
    const tokens = tokenList();
    let nearest = Infinity;
    const distances = tokens.map((token) => {
      const rect = token.getBoundingClientRect();
      const distance = Math.hypot(rect.left + rect.width / 2 - point.x, rect.top + rect.height / 2 - point.y);
      if (distance < nearest) nearest = distance;
      return distance;
    });
    if (nearest > REACH) {
      clearMagnification(false);
      return;
    }
    tokens.forEach((token, index) => {
      const influence = Math.min(Math.max((distances[index] - nearest) / FALLOFF, 0), 1);
      const scale = 1 + (MAX_SCALE - 1) * Math.cos((influence * Math.PI) / 2);
      if (scale < 1.012) {
        token.style.transform = "";
        token.style.zIndex = "";
        return;
      }
      token.style.transform = `scale(${scale.toFixed(4)})`;
      token.style.zIndex = String(Math.round(scale * 100));
    });
  }

  function queueMagnify(event) {
    if (!fineQuery.matches || prefersReducedMotion() || flipping || event.pointerType === "touch") return;
    const point = {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
      overTokens: Boolean(event.target.closest?.(".toolkit-tokens")),
    };
    if (magnifyFrame) {
      queueMagnify.point = point;
      return;
    }
    queueMagnify.point = point;
    magnifyFrame = requestAnimationFrame(() => {
      magnifyFrame = 0;
      applyMagnify(queueMagnify.point);
    });
  }

  switcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mode]");
    if (!button || !switcher.contains(button)) return;
    regroup(button.dataset.mode, true);
  });

  switcher.addEventListener("keydown", (event) => {
    const buttons = [...switcher.querySelectorAll("[data-mode]")];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % buttons.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next].focus();
    regroup(buttons[next].dataset.mode, true);
  });

  board.addEventListener("keydown", (event) => {
    const names = [...board.querySelectorAll(".toolkit-group-name")];
    const index = names.indexOf(document.activeElement);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowDown") next = Math.min(names.length - 1, index + 1);
    else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = names.length - 1;
    else return;
    event.preventDefault();
    names[next].focus();
  });

  board.addEventListener("pointermove", queueMagnify);
  board.addEventListener("pointerleave", () => {
    cancelAnimationFrame(magnifyFrame);
    magnifyFrame = 0;
    queueMagnify.point = null;
    clearMagnification(false);
  });

  fineQuery.addEventListener("change", () => {
    cancelAnimationFrame(magnifyFrame);
    magnifyFrame = 0;
    clearMagnification(true);
  });

  paint(mode);
  syncSwitch();
  lockBoard();
  onArrive(section, "top 78%", () => {
    section.classList.add("is-in");
  });

  const widthWatch = new ResizeObserver((entries) => {
    const width = Math.round(entries[0].contentRect.width);
    if (width === lockedWidth) return;
    lockedWidth = width;
    scheduleLock();
  });
  widthWatch.observe(board);
  document.fonts?.ready?.then(() => {
    lockedWidth = -1;
    scheduleLock();
  });
}

function createToken(tool) {
  const item = document.createElement("li");
  item.className = "toolkit-token";
  item.dataset.tool = tool.id;
  const mark = document.createElement("span");
  mark.className = "toolkit-mark";
  mark.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "toolkit-name";
  name.textContent = tool.name;
  item.append(mark, name);
  return item;
}
