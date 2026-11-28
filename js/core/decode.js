import { decodeCooldown, delay, duration } from "./motion.config.js";
import { prefersReducedMotion } from "./motion.js";
import { pageHidden, qualityTier } from "./quality.js";

const TARGET = ".label, .project-tag";
const SKIP = ".system-status, .brief-kind, .hero-kicker";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjklmnpqrstuvwxyz";
const DIGIT = "0123456789";
const MARK = "#*+?/\\";

const playedAt = new WeakMap();
const frames = new WeakMap();
const cast = new WeakMap();

function poolFor(char) {
  if (char >= "0" && char <= "9") return DIGIT;
  if (char >= "A" && char <= "Z") return UPPER;
  if (char >= "a" && char <= "z") return LOWER;
  return MARK;
}

function pick(real, current) {
  const pool = poolFor(real);
  let next = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && (next === real || next === current)) {
    next = pool[(pool.indexOf(next) + 1) % pool.length];
  }
  return next;
}

function showGlyph(item, value) {
  item.glyph.dataset.glyph = value;
}

function expose(el) {
  if (el.hasAttribute("aria-label")) return;
  const text = el.textContent.replace(/\s+/g, " ").trim();
  if (text) el.setAttribute("aria-label", text);
}

function wrap(el) {
  const nodes = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest(".decode-char")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);

  const chars = [];
  for (const textNode of nodes) {
    const fragment = document.createDocumentFragment();
    for (const char of textNode.textContent) {
      if (/\s/.test(char)) {
        fragment.append(char);
        continue;
      }
      const holder = document.createElement("span");
      holder.className = "decode-char";
      const real = document.createElement("span");
      real.className = "decode-real";
      real.textContent = char;
      const glyph = document.createElement("span");
      glyph.className = "decode-glyph";
      glyph.setAttribute("aria-hidden", "true");
      holder.append(real, glyph);
      fragment.append(holder);
      chars.push({ holder, glyph, value: char });
    }
    textNode.replaceWith(fragment);
  }
  return chars;
}

function play(el) {
  const chars = cast.get(el);
  if (!chars?.length) return;
  const now = performance.now();
  if (now - (playedAt.get(el) || 0) < decodeCooldown * 1000) return;
  playedAt.set(el, now);
  cancelAnimationFrame(frames.get(el) || 0);

  const total = duration.decode * 1000;
  const tick = delay.decode * 1000;
  const started = performance.now();
  let lastSwap = 0;
  const lockedHeight = el.offsetHeight;
  el.style.minHeight = `${lockedHeight}px`;
  el.style.maxHeight = `${lockedHeight}px`;
  el.style.overflow = "hidden";
  for (const item of chars) {
    item.holder.classList.add("is-cycling");
    showGlyph(item, pick(item.value, item.value));
  }

  const frame = (time) => {
    if (pageHidden()) {
      const resume = () => {
        if (pageHidden()) return;
        document.removeEventListener("visibilitychange", resume);
        started += performance.now() - time;
        frames.set(el, requestAnimationFrame(frame));
      };
      document.addEventListener("visibilitychange", resume);
      frames.set(el, 0);
      return;
    }
    const elapsed = time - started;
    const swap = elapsed - lastSwap >= tick;
    if (swap) lastSwap = elapsed;
    let live = false;
    for (let index = 0; index < chars.length; index += 1) {
      const item = chars[index];
      const resolveAt = ((index + 1) / chars.length) * total;
      if (elapsed >= resolveAt) {
        item.holder.classList.remove("is-cycling");
        continue;
      }
      live = true;
      if (swap) showGlyph(item, pick(item.value, item.glyph.dataset.glyph || ""));
    }
    if (live) frames.set(el, requestAnimationFrame(frame));
    else {
      frames.delete(el);
      el.style.removeProperty("min-height");
      el.style.removeProperty("max-height");
      el.style.removeProperty("overflow");
    }
  };
  frames.set(el, requestAnimationFrame(frame));
}

function arm(el, observer, quiet) {
  if (el.dataset.decode) return;
  if (el.closest("[aria-hidden='true']")) return;
  const text = el.textContent.replace(/\s+/g, " ").trim();
  if (!text) return;
  el.dataset.decode = "1";
  expose(el);
  if (quiet) return;
  const chars = wrap(el);
  if (!chars.length) return;
  cast.set(el, chars);
  observer.observe(el);
  if (el.matches(".project-tag")) {
    el.addEventListener("pointerenter", () => play(el));
  }
}

export function initDecode() {
  const quiet = prefersReducedMotion() || qualityTier() === "low";
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      play(entry.target);
    }
  }, { threshold: 0.55 });

  const scan = (root) => {
    const found = [];
    if (root instanceof Element && root.matches(TARGET) && !root.matches(SKIP)) found.push(root);
    if (root instanceof Element || root === document) {
      root.querySelectorAll(TARGET).forEach((el) => {
        if (!el.matches(SKIP)) found.push(el);
      });
    }
    for (const el of found) arm(el, observer, quiet);
  };

  scan(document);
  const added = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) scan(node);
      }
    }
  });
  added.observe(document.body, { childList: true, subtree: true });
}
