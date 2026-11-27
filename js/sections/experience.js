import { onArrive } from "../core/arrive.js";
import { clamp } from "../core/clamp.js";
import { duration, ease } from "../core/motion.config.js";
import { prefersReducedMotion } from "../core/motion.js";
import { settleUnit } from "../core/settle.js";

const DESKTOP = "(min-width: 720px)";

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function monthIndex(year, month) {
  return year * 12 + month;
}

function parseMonthLabel(value) {
  const match = /^([A-Za-z]+)\s+(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  return monthIndex(Number(match[2]), month);
}

function parseDatetime(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  return monthIndex(Number(match[1]), Number(match[2]) - 1);
}

/* "Present" is the open end of the current role, so the ruler stops at this month. */
function entryDates(article) {
  const time = article.querySelector("time");
  const [left, right = ""] = time.textContent.trim().split(/\s+[-\u2010-\u2015]\s+/);
  let start = parseMonthLabel(left);
  if (start === null) start = parseDatetime(time.getAttribute("datetime"));
  let end = /present/i.test(right) ? null : parseMonthLabel(right);
  if (end === null) {
    const now = new Date();
    end = monthIndex(now.getFullYear(), now.getMonth());
  }
  if (start === null) return null;
  if (end < start) end = start;
  return { start, end, article };
}

function fill(node, article) {
  node.querySelector(".experience-org").textContent = article.querySelector(".role-org").textContent;
  node.querySelector(".experience-role").textContent = article.querySelector(".role-title").textContent;
  const when = node.querySelector(".experience-when");
  when.replaceChildren(article.querySelector("time").cloneNode(true));
  const current = article.querySelector(".role-current");
  if (current) {
    when.append(document.createTextNode(" "));
    when.append(current.cloneNode(true));
  }
  node.querySelector(".experience-place").textContent = article.querySelector(".role-place").textContent;
}

function centerDistance(rect, mid) {
  if (mid < rect.top) return rect.top - mid;
  if (mid > rect.bottom) return mid - rect.bottom;
  return 0;
}

function readAmount(distance, range) {
  const t = Math.min(1, distance / range);
  const eased = t * t * (3 - 2 * t);
  return 0.62 + (1 - eased) * 0.38;
}

function buildRuler(track, earliest, latest) {
  const total = latest - earliest;
  const ticks = [];
  for (let month = earliest; month <= latest; month += 1) {
    const tick = document.createElement("span");
    tick.className = "month-tick";
    tick.dataset.month = String(month);
    const at = total === 0 ? 0 : (latest - month) / total;
    tick.style.setProperty("--at", at.toFixed(4));
    ticks.push(tick);
  }

  const seen = new Set();
  const years = [];
  for (let month = latest; month >= earliest; month -= 1) {
    const year = Math.floor(month / 12);
    if (seen.has(year)) continue;
    seen.add(year);
    const label = document.createElement("span");
    label.className = "month-year";
    label.textContent = String(year);
    const at = total === 0 ? 0 : (latest - month) / total;
    label.style.setProperty("--at", at.toFixed(4));
    years.push(label);
    ticks.find((tick) => Number(tick.dataset.month) === month)?.classList.add("is-year");
  }

  const span = document.createElement("div");
  span.className = "month-span";
  const marker = document.createElement("div");
  marker.className = "month-marker";
  span.append(marker);
  track.replaceChildren(...ticks, ...years, span);
  return { span, marker, ticks, total, earliest, latest };
}

function initCounts(section) {
  const nodes = [...section.querySelectorAll("[data-count]")];
  if (!nodes.length) return;

  function countUp(node) {
    const target = Number(node.dataset.count);
    const decimals = Number(node.dataset.decimals || 0);
    const suffix = node.dataset.suffix || "";
    const finalText = node.textContent;
    const started = performance.now();
    node.textContent = `${(0).toFixed(decimals)}${suffix}`;

    function tick(now) {
      const progress = Math.min(1, (now - started) / (duration.count * 1000));
      if (prefersReducedMotion() || progress >= 1) {
        node.textContent = finalText;
        return;
      }
      node.textContent = `${(target * settleUnit(progress)).toFixed(decimals)}${suffix}`;
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      countUp(entry.target);
    }
  }, { threshold: 0.55 });
  nodes.forEach((node) => observer.observe(node));
}

function mountExperience(section) {
  const entries = [...section.querySelectorAll(".experience-entry")];
  const articles = entries.map((entry) => entry.querySelector("article"));
  const mask = section.querySelector(".experience-mask");
  const slides = [...mask.querySelectorAll(".experience-slide")];
  const probe = mask.querySelector(".experience-probe");
  const ruler = section.querySelector(".month-ruler");
  const track = ruler.querySelector(".month-ruler-track");
  const dates = articles.map(entryDates).filter(Boolean);
  if (!articles.length || dates.length !== articles.length) return { destroy() {} };

  let earliest = dates[0].start;
  let latest = dates[0].end;
  for (const date of dates) {
    earliest = Math.min(earliest, date.start);
    latest = Math.max(latest, date.end);
  }

  const rulerBits = buildRuler(track, earliest, latest);
  let slot = 0;
  let shown = 0;
  let fittedWidth = -1;
  let fittedHeight = -1;

  function fitMask() {
    const width = mask.clientWidth;
    if (!width || (fittedHeight > 0 && Math.abs(width - fittedWidth) < 1)) return;
    let max = 0;
    for (const article of articles) {
      fill(probe, article);
      max = Math.max(max, probe.offsetHeight);
    }
    const next = Math.ceil(max) + 4;
    fittedWidth = width;
    if (next === fittedHeight) return;
    fittedHeight = next;
    mask.style.minHeight = `${next}px`;
  }

  function placeSpan(date) {
    const { total, latest: endMonth, span, ticks } = rulerBits;
    const top = total === 0 ? 0 : (endMonth - date.end) / total;
    const bottom = total === 0 ? 0 : (endMonth - date.start) / total;
    span.style.setProperty("--span-a", top.toFixed(4));
    span.style.setProperty("--span-b", Math.max(bottom - top, 0.012).toFixed(4));
    for (const tick of ticks) {
      const month = Number(tick.dataset.month);
      tick.classList.toggle("is-live", month >= date.start && month <= date.end);
    }
  }

  function swap(index) {
    const incoming = slides[1 - slot];
    const outgoing = slides[slot];
    fill(incoming, articles[index]);
    incoming.classList.remove("is-on", "is-leaving");
    incoming.classList.add("is-below");
    void incoming.offsetWidth;
    outgoing.classList.remove("is-on", "is-below");
    outgoing.classList.add("is-leaving");
    incoming.classList.remove("is-below");
    incoming.classList.add("is-on");
    slot = 1 - slot;
    shown = index;
  }

  function render(first) {
    const mid = window.innerHeight * 0.5;
    const range = window.innerHeight * 0.45;
    const rects = entries.map((entry) => entry.getBoundingClientRect());
    let index = 0;
    let best = Infinity;
    rects.forEach((rect, i) => {
      const distance = centerDistance(rect, mid);
      entries[i].style.setProperty("--read", readAmount(distance, range).toFixed(3));
      const center = rect.top + rect.height * 0.5;
      const score = distance === 0 ? Math.abs(center - mid) * 0.001 : distance;
      if (score < best) {
        best = score;
        index = i;
      }
    });

    if (first || index !== shown) {
      if (first) {
        fill(slides[slot], articles[index]);
        shown = index;
      } else {
        swap(index);
      }
      placeSpan(dates[index]);
    }

    const rect = rects[index];
    const progress = rect.height ? clamp((mid - rect.top) / rect.height, 0, 1) : 0;
    rulerBits.marker.style.setProperty("--mark", progress.toFixed(4));
  }

  fitMask();
  render(true);
  requestAnimationFrame(() => ruler.classList.add("is-set"));

  const onResize = () => {
    fittedWidth = -1;
    fitMask();
    render(false);
  };
  window.addEventListener("resize", onResize);
  document.fonts?.ready?.then(() => {
    fittedWidth = -1;
    fitMask();
  });

  let trigger = null;
  let scrollHandler = null;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    trigger = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onUpdate: () => render(false),
    });
  } else {
    let scheduled = false;
    scrollHandler = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        render(false);
      });
    };
    window.addEventListener("scroll", scrollHandler, { passive: true });
  }

  return {
    destroy() {
      trigger?.kill();
      if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
      window.removeEventListener("resize", onResize);
      ruler.classList.remove("is-set");
      entries.forEach((entry) => entry.style.removeProperty("--read"));
    },
  };
}

function initMeasure(section) {
  const gsap = window.gsap;
  if (!gsap) return;
  const desktop = window.matchMedia(DESKTOP).matches;
  const target = desktop ? section.querySelector(".month-ruler") : section.querySelector(".experience-intro");
  if (!target) return;
  gsap.set(target, { scaleY: 0, transformOrigin: "top left" });
  onArrive(section, "top 78%", () => {
    gsap.to(target, {
      scaleY: 1,
      duration: duration.ruler,
      ease: ease.settle,
      overwrite: true,
      onComplete() {
        gsap.set(target, { clearProps: "transform" });
      },
    });
  });
}

export function initExperience() {
  const section = document.querySelector(".experience");
  if (!section) return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktop = window.matchMedia(DESKTOP);
  let composition = null;
  let countsArmed = false;
  let measured = false;

  function sync() {
    if (!countsArmed && !motion.matches) {
      countsArmed = true;
      initCounts(section);
    }
    if (!measured && !motion.matches) {
      measured = true;
      initMeasure(section);
    }
    const on = desktop.matches && !motion.matches;
    if (on && !composition) composition = mountExperience(section);
    else if (!on && composition) {
      composition.destroy();
      composition = null;
    }
  }

  sync();
  desktop.addEventListener("change", sync);
  motion.addEventListener("change", () => {
    if (motion.matches) {
      section.querySelector(".month-ruler")?.style.removeProperty("transform");
      section.querySelector(".experience-intro")?.style.removeProperty("transform");
    }
    sync();
  });
}
