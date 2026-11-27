import { delay, duration } from "../../core/motion.config.js";

const STOP = new Set(["a", "an", "the", "of", "and", "or", "for", "to", "in", "on", "at", "by"]);

function normalise(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(text) {
  return normalise(text).split(" ").filter((token) => token.length >= 2 && !STOP.has(token)).slice(0, 12);
}

function overlaps(word, token) {
  if (word === token) return true;
  if (token.length >= 4 && word.startsWith(token)) return true;
  if (word.length >= 4 && token.startsWith(word) && word.length / token.length >= 0.6) return true;
  return false;
}

function rank(index, queryTokens) {
  const ranked = [];
  index.forEach((item, order) => {
    const tags = item.tags.map((tag) => tag.toLowerCase());
    const titleTokens = tokens(item.title);
    let tagHits = 0;
    let titleHits = 0;
    for (const token of queryTokens) {
      if (tags.some((tag) => overlaps(tag, token))) tagHits += 1;
      if (titleTokens.some((word) => overlaps(word, token))) titleHits += 1;
    }
    const score = tagHits * 3 + titleHits;
    if (score > 0) ranked.push({ item, order, score, tagHits, titleHits, queryCount: queryTokens.length });
  });
  ranked.sort((a, b) => b.score - a.score || a.order - b.order);
  return ranked.slice(0, 3);
}

export function initHeroQuery(section, index, field, { reduced }) {
  const form = section.querySelector(".hero-query");
  const input = section.querySelector("#hero-query-input");
  const results = section.querySelector("#hero-results");
  const resetButton = section.querySelector(".hero-reset");
  if (!form || !input || !results || !field) return;

  const phrases = [...form.querySelectorAll("[data-query]")].map((chip) => chip.dataset.query).filter(Boolean);
  let phrase = 0;
  let active = false;
  let marked = null;
  let markTimer = 0;
  let closeTimer = 0;

  function setReset(on) {
    if (!resetButton) return;
    resetButton.hidden = !on;
  }

  function mark(target) {
    if (marked && marked !== target) marked.classList.remove("is-hero-match");
    marked = target;
    target.classList.add("is-hero-match");
    window.clearTimeout(markTimer);
    markTimer = window.setTimeout(() => {
      target.classList.remove("is-hero-match");
      if (marked === target) marked = null;
    }, duration.mark * 1000);
  }

  function chipButton(phraseText) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hero-chip";
    button.textContent = phraseText;
    button.addEventListener("click", () => {
      input.value = phraseText;
      run(phraseText);
    });
    return button;
  }

  function openPanel(node) {
    window.clearTimeout(closeTimer);
    results.replaceChildren(node);
    results.classList.add("is-open");
  }

  function renderHits(hits) {
    const list = document.createElement("ol");
    list.className = "hero-result-list";
    for (const hit of hits) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = hit.item.href;
      if (/^https?:/.test(hit.item.href)) {
        link.target = "_blank";
        link.rel = "noopener";
        link.dataset.cursor = "Open";
      }
      const type = document.createElement("span");
      type.className = "hero-result-type";
      type.textContent = hit.item.type;
      const title = document.createElement("span");
      title.className = "hero-result-title";
      title.textContent = hit.item.title;
      const score = document.createElement("span");
      score.className = "hero-result-score";
      score.textContent = `tag match ${hit.tagHits} of ${hit.queryCount}`;
      link.append(type, title);
      if (hit.item.org) {
        const org = document.createElement("span");
        org.className = "hero-result-org";
        org.textContent = hit.item.org;
        link.append(org);
      }
      link.append(score);
      item.append(link);
      list.append(item);
    }
    openPanel(list);
  }

  function renderEmpty(shown) {
    const box = document.createElement("div");
    box.className = "hero-empty";
    const message = document.createElement("p");
    message.textContent = `No match for “${shown}”.`;
    const offer = document.createElement("div");
    offer.className = "hero-chips";
    for (const phraseText of phrases) offer.append(chipButton(phraseText));
    box.append(message, offer);
    openPanel(box);
  }

  function renderPrompt() {
    const box = document.createElement("div");
    box.className = "hero-empty";
    const message = document.createElement("p");
    message.textContent = "Enter a query, or try one of these.";
    const offer = document.createElement("div");
    offer.className = "hero-chips";
    for (const phraseText of phrases) offer.append(chipButton(phraseText));
    box.append(message, offer);
    openPanel(box);
  }

  function restore(focusInput) {
    active = false;
    field.reset();
    setReset(false);
    input.value = "";
    results.classList.remove("is-open");
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      if (!results.classList.contains("is-open")) results.replaceChildren();
    }, reduced ? 0 : duration.results * 1000);
    const focused = document.activeElement;
    if (focusInput || (focused instanceof Element && results.contains(focused))) input.focus();
  }

  function run(raw) {
    const shown = raw.trim().replace(/\s+/g, " ").slice(0, 80);
    const queryTokens = tokens(shown);
    if (!queryTokens.length) {
      active = true;
      field.reset();
      setReset(true);
      renderPrompt();
      return;
    }
    const hits = rank(index, queryTokens);
    active = true;
    setReset(true);
    const tags = [];
    for (const hit of hits) tags.push(...hit.item.tags);
    field.retrieve(tags);
    if (hits.length) renderHits(hits);
    else renderEmpty(shown);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(input.value);
  });

  form.querySelectorAll("[data-query]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const value = chip.dataset.query || "";
      input.value = value;
      run(value);
    });
  });

  resetButton?.addEventListener("click", () => restore(true));

  results.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href^='#']");
    if (!link || !results.contains(link)) return;
    const href = link.getAttribute("href");
    if (!href || href === "#") return;
    const target = document.querySelector(href);
    if (target) mark(target);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !active || event.defaultPrevented) return;
    const overlay = document.getElementById("index-overlay");
    if (overlay && !overlay.hidden) return;
    const node = event.target;
    if (node instanceof Element && node !== document.body && !section.contains(node)) return;
    event.preventDefault();
    restore(false);
  });

  if (!reduced && phrases.length > 1) {
    window.setInterval(() => {
      if (document.hidden) return;
      if (document.activeElement === input || input.value.trim()) return;
      phrase = (phrase + 1) % phrases.length;
      input.placeholder = phrases[phrase];
    }, delay.placeholder * 1000);
  }
}
