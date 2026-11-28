/* `deviceMemory` is Chromium-only. A missing value is not treated as a weak device. */

const SLOW_MS = 20;
const SLOW_FOR = 2000;
const FAST_MS = 14;
const FAST_FOR = 10000;
const WINDOW_MS = 1000;
const GAP_MS = 80;

const POINT_COUNT = { high: 4000, medium: 1800, low: 600 };
const DPR_CAP = { high: 2, medium: 1.5, low: 1 };

const LADDER = [
  { tier: "high", points: "high", dpr: "high", links: true, renderer: "webgl" },
  { tier: "medium", points: "medium", dpr: "high", links: true, renderer: "webgl" },
  { tier: "medium", points: "medium", dpr: "medium", links: true, renderer: "webgl" },
  { tier: "medium", points: "medium", dpr: "medium", links: false, renderer: "webgl" },
  { tier: "low", points: "low", dpr: "low", links: false, renderer: "2d" },
];

const TIER_STEP = { high: 0, medium: 2, low: LADDER.length - 1 };

function pointerKind() {
  if (window.matchMedia("(pointer: coarse)").matches) return "coarse";
  if (window.matchMedia("(pointer: fine)").matches) return "fine";
  return "none";
}

function deviceTier() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = navigator.connection?.saveData === true;
  const cores = Number(navigator.hardwareConcurrency) || 0;
  const memory = Number(navigator.deviceMemory) || 0;
  const pointer = pointerKind();

  if (reduced || saveData) return "low";
  if ((cores > 0 && cores <= 2) || (memory > 0 && memory <= 2)) return "low";
  if (pointer === "coarse" || (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4)) return "medium";
  return "high";
}

function forcedTier() {
  try {
    const value = new URLSearchParams(window.location.search).get("q");
    if (value === "low" || value === "medium" || value === "high") return value;
  } catch {
    return "";
  }
  return "";
}

const forced = forcedTier();
const tierName = forced || deviceTier();
let ceiling = TIER_STEP[tierName];
let step = ceiling;
const locked = Boolean(forced);

const samples = [];
let slowSince = 0;
let fastSince = 0;
const listeners = new Set();
let publishQueued = false;

function profileFrom(index) {
  const rung = LADDER[index];
  return {
    tier: rung.tier,
    renderer: rung.renderer,
    links: rung.links,
    count: POINT_COUNT[rung.points],
    dprCap: DPR_CAP[rung.dpr],
    step: index,
    ceiling,
    locked,
    forced,
  };
}

function bindVisibility() {
  if (bindVisibility.done || typeof document === "undefined") return;
  bindVisibility.done = true;
  bindVisibility.hidden = document.hidden;
  if (bindVisibility.hidden && window.gsap?.ticker?.sleep) window.gsap.ticker.sleep();
  document.addEventListener("visibilitychange", () => {
    bindVisibility.hidden = document.hidden;
    const ticker = window.gsap?.ticker;
    if (ticker?.sleep && ticker?.wake) {
      if (bindVisibility.hidden) ticker.sleep();
      else ticker.wake();
    }
    for (const listener of bindVisibility.listeners) listener(bindVisibility.hidden);
  });
}

bindVisibility.done = false;
bindVisibility.hidden = false;
bindVisibility.listeners = new Set();

export function qualityTier() {
  bindVisibility();
  return tierName;
}

export function qualityProfile() {
  bindVisibility();
  return profileFrom(step);
}

function publish() {
  if (publishQueued) return;
  publishQueued = true;
  queueMicrotask(() => {
    publishQueued = false;
    const next = profileFrom(step);
    for (const listener of listeners) listener(next);
  });
}

export function onQualityChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function resetPace() {
  samples.length = 0;
  slowSince = 0;
  fastSince = 0;
}

export function noteFrame(dt, now = performance.now()) {
  if (locked) return;
  if (!(dt > 0) || dt > GAP_MS) {
    resetPace();
    return;
  }
  samples.push({ now, dt });
  const cutoff = now - WINDOW_MS;
  while (samples.length && samples[0].now < cutoff) samples.shift();
  const span = samples[samples.length - 1].now - samples[0].now;
  if (span < 480 || samples.length < 8) return;
  let sum = 0;
  for (const sample of samples) sum += sample.dt;
  const avg = sum / samples.length;
  if (avg > SLOW_MS) {
    fastSince = 0;
    if (!slowSince) slowSince = now;
    else if (now - slowSince >= SLOW_FOR && step < LADDER.length - 1) {
      step += 1;
      resetPace();
      publish();
    }
    return;
  }
  slowSince = 0;
  if (avg >= FAST_MS || step <= ceiling) {
    fastSince = 0;
    return;
  }
  if (!fastSince) fastSince = now;
  else if (now - fastSince >= FAST_FOR) {
    step -= 1;
    resetPace();
    publish();
  }
}

export function lockCanvasFallback() {
  if (locked) return false;
  const floor = LADDER.length - 1;
  if (ceiling === floor && step === floor) return false;
  ceiling = floor;
  step = floor;
  resetPace();
  publish();
  return true;
}

export function pageHidden() {
  bindVisibility();
  return bindVisibility.hidden;
}

export function onPageVisibility(listener) {
  bindVisibility();
  bindVisibility.listeners.add(listener);
  return () => bindVisibility.listeners.delete(listener);
}

export function whileVisible(start, stop) {
  const apply = (isHidden) => {
    if (isHidden) stop();
    else start();
  };
  const unlisten = onPageVisibility(apply);
  apply(pageHidden());
  return unlisten;
}
