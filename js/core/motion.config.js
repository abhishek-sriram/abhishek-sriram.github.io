/** Seconds, unless a value is marked otherwise. Settle is a GSAP ease name, not a CSS timing function. */

export const ease = {
  snap: "cubic-bezier(.2,.9,.1,1)",
  glide: "cubic-bezier(.65,0,.35,1)",
  settle: "expo.out",
  none: "none",
};

export const snap = ease.snap;
export const glide = ease.glide;
export const settle = ease.settle;

export const duration = {
  surface: 0.5,
  reveal: 0.7,
  ui: 0.22,
  stagger: 0.06,
  letter: 0.72,
  queryIn: 0.6,
  count: 0.9,
  fieldIntro: 1.8,
  fieldLine: 0.6,
  systemWipe: 0.55,
  stepper: 0.9,
  crumb: 0.7,
  trace: 0.5,
  traceFade: 0.3,
  traceStamp: 0.35,
  latency: 1.05,
  privacyOut: 0.5,
  privacyIn: 0.55,
  case: 0.9,
  results: 0.46,
  mark: 2.2,
  placeholder: 2.6,
  magnet: 0.4,
  check: 0.55,
  loadNav: 0.55,
  loadRail: 0.45,
  ruler: 0.9,
  row: 0.65,
  slit: 0.6,
  track: 0.85,
  axis: 0.7,
  titleWipe: 0.8,
  hairline: 0.7,
  skew: 0.45,
  rail: 0.34,
  row: 0.5,
  token: 0.16,
  credential: 0.78,
  index: 0.18,
};

export const delay = {
  letter: 0.04,
  hero: 0.18,
  query: 0.7,
  rail: 0.46,
  railTick: 0.04,
  row: 0.045,
  group: 0.055,
  key: 0.04,
  fieldLine: 0.1,
  placeholder: 2.6,
};

/** Pixels. The incoming surface wipes across this overlap. */
export const handoff = 120;

/** Degrees. Fast scroll skews the largest display headings up to this. */
export const skewMax = 3;

/** Lenis velocity is pixels per frame. Below the deadzone, headings stay square. */
export const velocity = {
  deadzone: 8,
  ceil: 64,
};

/** Extra yaw on the hero field at full scroll speed. */
export const fieldBoost = 1.35;
