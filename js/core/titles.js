import { onArrive } from "./arrive.js";
import { delay, duration, ease, titleAxis, tracking } from "./motion.config.js";
import { prefersReducedMotion } from "./motion.js";
import { qualityTier } from "./quality.js";

const PLAN = [
  ["hero-title", "rise"],
  ["systems-title", "together"],
  ["experience-title", "words"],
  ["projects-title", "letters"],
  ["toolkit-title", "axes"],
  ["about-title", "track"],
  ["credentials-title", "weight"],
  ["contact-title", "wipe"],
];

function verify(plan) {
  const sections = [...document.querySelectorAll("main > section")];
  const placed = plan
    .map(([id, kind]) => {
      const section = document.getElementById(id)?.closest("section");
      return { id, kind, index: sections.indexOf(section) };
    })
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  for (let i = 1; i < placed.length; i += 1) {
    const adjacent = placed[i].index === placed[i - 1].index + 1;
    if (adjacent && placed[i].kind === placed[i - 1].kind) {
      throw new Error(`Adjacent sections share a title entrance (${placed[i - 1].id}, ${placed[i].id})`);
    }
  }
}

function units(title, letters) {
  const text = title.textContent;
  title.replaceChildren();
  const source = letters ? [...text] : text.match(/\S+\s*/g) || [];
  return source.map((chunk) => {
    const span = document.createElement("span");
    span.className = "title-part";
    span.textContent = chunk;
    title.append(span);
    return span;
  });
}

function writeAxis(nodes, wdth, wght) {
  for (const node of nodes) {
    node.style.setProperty("--wdth", String(wdth));
    node.style.setProperty("--wght", String(wght));
  }
}

function release(nodes, title, kind) {
  for (const node of nodes) {
    node.style.removeProperty("--wdth");
    node.style.removeProperty("--wght");
  }
  if (kind === "track") title.style.removeProperty("letter-spacing");
  if (kind === "wipe") title.style.removeProperty("clip-path");
}

function reserve(title, parts, kind) {
  const nodes = [title, ...parts];
  const samples = [
    [titleAxis.wdthFrom, titleAxis.wghtFrom],
    [titleAxis.wdthTo, titleAxis.wghtTo],
    [titleAxis.wdthTo, titleAxis.wghtFrom],
    [titleAxis.wdthFrom, titleAxis.wghtTo],
  ];
  const spacings = kind === "track" ? [tracking.from, tracking.to] : [""];
  let height = 0;
  for (const spacing of spacings) {
    if (spacing) title.style.letterSpacing = spacing;
    for (const [wdth, wght] of samples) {
      writeAxis(nodes, wdth, wght);
      height = Math.max(height, title.offsetHeight);
    }
  }
  title.style.minHeight = `${Math.ceil(height)}px`;
  writeAxis(nodes, titleAxis.wdthFrom, titleAxis.wghtFrom);
  if (kind === "track") title.style.letterSpacing = tracking.from;
}

function play(title, parts, kind) {
  const gsap = window.gsap;
  const nodes = parts.length ? parts : [title];
  const done = () => release(parts.length ? [title, ...parts] : [title], title, kind);
  const axis = {
    "--wdth": titleAxis.wdthTo,
    "--wght": titleAxis.wghtTo,
    autoRound: false,
    overwrite: true,
  };

  if (kind === "words" || kind === "letters") {
    gsap.to(nodes, {
      ...axis,
      duration: duration.titleIn,
      stagger: kind === "letters" ? delay.titleLetter : delay.titleWord,
      ease: kind === "letters" ? ease.glide : ease.settle,
      onComplete: done,
    });
    return;
  }
  if (kind === "axes" || kind === "weight") {
    const lead = kind === "axes" ? "--wdth" : "--wght";
    const follow = kind === "axes" ? "--wght" : "--wdth";
    const leadTo = kind === "axes" ? titleAxis.wdthTo : titleAxis.wghtTo;
    const followTo = kind === "axes" ? titleAxis.wghtTo : titleAxis.wdthTo;
    const timeline = gsap.timeline({ onComplete: done });
    timeline.to(title, { [lead]: leadTo, duration: duration.titleIn, ease: ease.glide, autoRound: false }, 0);
    timeline.to(
      title,
      { [follow]: followTo, duration: duration.titleIn, ease: ease.settle, autoRound: false },
      duration.titleIn * titleAxis.follow,
    );
    return;
  }
  if (kind === "track") {
    gsap.to(title, {
      ...axis,
      letterSpacing: tracking.to,
      duration: duration.track,
      ease: ease.glide,
      onComplete: done,
    });
    return;
  }
  if (kind === "wipe") {
    gsap.to(title, {
      ...axis,
      clipPath: "inset(0 0% 0 0)",
      duration: duration.titleWipe,
      ease: ease.snap,
      onComplete: done,
    });
    return;
  }
  gsap.to(title, {
    ...axis,
    duration: duration.titleIn,
    ease: ease.settle,
    onComplete: done,
  });
}

function arm(title, kind) {
  const section = title.closest("section");
  if (!section) return;
  const parts = kind === "words" || kind === "letters" ? units(title, kind === "letters") : [];
  let settled = false;
  const measure = () => {
    if (settled) return;
    reserve(title, parts, kind);
    if (kind === "wipe") title.style.clipPath = "inset(0 100% 0 0)";
  };
  measure();
  document.fonts?.ready?.then(measure);
  onArrive(section, "top 78%", () => {
    settled = true;
    play(title, parts, kind);
  });
}

export function initTitles() {
  verify(PLAN);
  const quiet = prefersReducedMotion() || qualityTier() === "low" || !window.gsap;
  for (const [id, kind] of PLAN) {
    const title = document.getElementById(id);
    if (!title) continue;
    title.dataset.entrance = kind;
    if (kind !== "rise" && kind !== "track" && kind !== "wipe") title.classList.add("title-live");
    if (quiet || kind === "rise") continue;
    arm(title, kind);
  }
}
