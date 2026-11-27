import { clamp } from "../../core/clamp.js";
import { delay, duration, fieldBoost } from "../../core/motion.config.js";
import { settleUnit } from "../../core/settle.js";
import { scrollPace } from "../../core/velocity.js";

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  let uniform = rand();
  if (uniform < 1e-7) uniform = 1e-7;
  return Math.sqrt(-2 * Math.log(uniform)) * Math.cos(Math.PI * 2 * rand());
}

function parseHex(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hex = raw.startsWith("#") ? raw : fallback;
  const bits = Number.parseInt(hex.slice(1), 16);
  return [(bits >> 16) & 255, (bits >> 8) & 255, bits & 255];
}

const CLUSTERS = [
  { tag: "rag", label: "RAG", x: -0.86, y: 0.42, z: 0.18 },
  { tag: "agents", label: "agents", x: -0.2, y: -0.52, z: 0.4 },
  { tag: "multimodal", label: "multimodal", x: 0.34, y: 0.56, z: -0.16 },
  { tag: "mlops", label: "MLOps", x: 0.9, y: 0.04, z: 0.26 },
  { tag: "research", label: "research", x: 0.42, y: -0.48, z: -0.38 },
  { tag: "ml", label: "classical ML", x: -0.62, y: -0.02, z: -0.5 },
];

const LINK_CELL = 48;
const CURSOR_REACH = 120;
const LINK_REACH = 42;
const CAMERA = 3.15;
const FOCAL = 2.25;
const INTRO_MS = duration.fieldIntro * 1000;
const LINE_MS = duration.fieldLine * 1000;

const noopField = {
  retrieve() {},
  reset() {},
  frameMs() {
    return { n: 0, median: 0, p95: 0, max: 0, count: 0 };
  },
};

export function initHeroField(canvas, index, { reduced, holdIntro = false }) {
  if (!canvas) return noopField;
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return noopField;
  const section = canvas.closest(".hero") || canvas.parentElement;
  const paper = parseHex("--paper", "#F2F4F7");
  const acid = parseHex("--acid", "#D9FF43");
  const acidCss = `rgb(${acid[0]},${acid[1]},${acid[2]})`;
  const paperCss = `rgb(${paper[0]},${paper[1]},${paper[2]})`;
  const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "ui-monospace, monospace";
  const labelFont = `450 12px ${mono}`;
  const fillCache = new Map();

  let homeX = new Float32Array(0);
  let homeY = new Float32Array(0);
  let homeZ = new Float32Array(0);
  let scatterX = new Float32Array(0);
  let scatterY = new Float32Array(0);
  let scatterZ = new Float32Array(0);
  let clusterOf = new Uint8Array(0);
  let screenX = new Float32Array(0);
  let screenY = new Float32Array(0);
  let camZ = new Float32Array(0);
  let repelX = new Float32Array(0);
  let repelY = new Float32Array(0);
  let dim = new Float32Array(0);
  let tone = new Float32Array(0);
  let order = [];
  let count = 0;
  let gridHead = new Int32Array(256);
  let gridNext = new Int32Array(0);
  let near = new Uint16Array(0);

  const blockNodes = section
    ? [...section.querySelectorAll(".hero-kicker, .hero-name, .hero-support, .hero-query, .hero-links, .hero-proof")]
    : [];
  const blocks = blockNodes.map(() => ({ left: 0, top: 0, right: 0, bottom: 0 }));
  const activeTags = new Set();
  let linePlan = [];
  let signal = 0;
  let signalTarget = 0;
  let retrievalMs = 0;
  let introMs = reduced ? INTRO_MS : 0;
  let introHeld = Boolean(holdIntro) && !reduced;
  let baseYaw = 0.42;
  let tiltYaw = 0;
  let tiltPitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let cursorX = 0;
  let cursorY = 0;
  let cursorHot = false;
  let cssW = 0;
  let cssH = 0;
  let needsResize = true;
  let running = false;
  let raf = 0;
  let lastNow = 0;
  let onScreen = true;
  let hidden = document.hidden;
  const samples = [];

  const mobile = window.matchMedia("(max-width: 719px)");

  function pointBudget() {
    return mobile.matches ? 350 : 900;
  }

  function fillFor(toneValue, alpha) {
    const toneStep = clamp(Math.round(toneValue * 8), 0, 8);
    const alphaStep = clamp(Math.round(alpha * 16), 0, 16);
    const key = toneStep * 17 + alphaStep;
    let style = fillCache.get(key);
    if (style) return style;
    const mix = toneStep / 8;
    const channel = (from, to) => Math.round(from + (to - from) * mix);
    style = `rgba(${channel(paper[0], acid[0])},${channel(paper[1], acid[1])},${channel(paper[2], acid[2])},${(alphaStep / 16).toFixed(3)})`;
    fillCache.set(key, style);
    return style;
  }

  function allocate(weights, total) {
    const raw = weights.map((weight) => weight * total);
    const counts = raw.map((value) => Math.floor(value));
    let left = total - counts.reduce((sum, value) => sum + value, 0);
    const rank = raw
      .map((value, index) => ({ index, fraction: value - counts[index] }))
      .sort((a, b) => b.fraction - a.fraction);
    for (let i = 0; i < left; i += 1) counts[rank[i % rank.length].index] += 1;
    return counts;
  }

  function buildPoints(total) {
    const counts = CLUSTERS.map((cluster) => index.filter((item) => item.tags.includes(cluster.tag)).length);
    const weightSum = counts.reduce((sum, value) => sum + value, 0);
    const weights = weightSum ? counts.map((value) => value / weightSum) : CLUSTERS.map(() => 1 / CLUSTERS.length);
    const shares = allocate(weights, total);
    const rand = mulberry32(0x51a11);
    homeX = new Float32Array(total);
    homeY = new Float32Array(total);
    homeZ = new Float32Array(total);
    scatterX = new Float32Array(total);
    scatterY = new Float32Array(total);
    scatterZ = new Float32Array(total);
    clusterOf = new Uint8Array(total);
    screenX = new Float32Array(total);
    screenY = new Float32Array(total);
    camZ = new Float32Array(total);
    repelX = new Float32Array(total);
    repelY = new Float32Array(total);
    dim = new Float32Array(total);
    tone = new Float32Array(total);
    gridNext = new Int32Array(total);
    near = new Uint16Array(total);
    order = new Array(total);
    let cursor = 0;
    for (let c = 0; c < CLUSTERS.length; c += 1) {
      const cluster = CLUSTERS[c];
      for (let n = 0; n < shares[c]; n += 1) {
        const i = cursor++;
        order[i] = i;
        clusterOf[i] = c;
        homeX[i] = clamp(cluster.x + gaussian(rand) * 0.16, cluster.x - 0.34, cluster.x + 0.34);
        homeY[i] = clamp(cluster.y + gaussian(rand) * 0.13, cluster.y - 0.28, cluster.y + 0.28);
        homeZ[i] = clamp(cluster.z + gaussian(rand) * 0.15, cluster.z - 0.32, cluster.z + 0.32);
        scatterX[i] = (rand() - 0.5) * 2.8;
        scatterY[i] = (rand() - 0.5) * 2.2;
        scatterZ[i] = (rand() - 0.5) * 2.2;
        const querying = signalTarget === 1;
        const matched = activeTags.has(cluster.tag);
        dim[i] = querying && !matched ? 1 : 0;
        tone[i] = querying && matched ? 1 : 0;
      }
    }
    count = cursor;
  }

  function applySize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(mobile.matches ? 1.5 : 2, window.devicePixelRatio || 1);
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const bufferW = Math.round(width * dpr);
    const bufferH = Math.round(height * dpr);
    cssW = width;
    cssH = height;
    if (canvas.width !== bufferW || canvas.height !== bufferH) {
      canvas.width = bufferW;
      canvas.height = bufferH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(x, y, z, yawCos, yawSin, pitchCos, pitchSin, originX, originY, spreadX, spreadY) {
    const x1 = x * yawCos + z * yawSin;
    const z1 = -x * yawSin + z * yawCos;
    const y2 = y * pitchCos - z1 * pitchSin;
    const z2 = y * pitchSin + z1 * pitchCos;
    const persp = FOCAL / (CAMERA - z2);
    return {
      x: originX + x1 * persp * spreadX,
      y: originY + y2 * persp * spreadY,
      z: z2,
      persp,
    };
  }

  function planLines() {
    const chosen = CLUSTERS.filter((cluster) => activeTags.has(cluster.tag));
    const staggerCap = delay.fieldLine * 1000;
    const stagger = chosen.length > 1 ? Math.min(staggerCap, (LINE_MS * 0.4) / (chosen.length - 1)) : 0;
    const lineDuration = Math.max(LINE_MS * 0.53, LINE_MS - stagger * Math.max(0, chosen.length - 1));
    linePlan = chosen.map((cluster, index) => ({ cluster, delay: index * stagger, duration: lineDuration }));
  }

  function drawFrame(dt) {
    if (needsResize) {
      applySize();
      needsResize = false;
    }
    if (cssW < 2 || cssH < 2 || !count) return;

    const canvasRect = canvas.getBoundingClientRect();
    for (let b = 0; b < blockNodes.length; b += 1) {
      const rect = blockNodes[b].getBoundingClientRect();
      blocks[b].left = rect.left - canvasRect.left - 8;
      blocks[b].top = rect.top - canvasRect.top - 20;
      blocks[b].right = rect.right - canvasRect.left + 8;
      blocks[b].bottom = rect.bottom - canvasRect.top + 6;
    }

    const introP = reduced ? 1 : settleUnit(Math.min(1, introMs / INTRO_MS));
    const blend = reduced ? 1 : 1 - Math.exp(-dt / 170);
    const repelBlend = reduced ? 1 : 1 - Math.exp(-dt / 90);
    const yaw = baseYaw + tiltYaw;
    const yawCos = Math.cos(yaw);
    const yawSin = Math.sin(yaw);
    const pitchCos = Math.cos(tiltPitch);
    const pitchSin = Math.sin(tiltPitch);
    const originX = cssW * 0.5;
    const originY = cssH * 0.45;
    const spreadX = cssW * 0.36;
    const spreadY = cssH * 0.3;
    const querying = signalTarget === 1;
    const insertReach = (CURSOR_REACH + LINK_REACH) ** 2;
    const cursorReach = CURSOR_REACH ** 2;
    const linkReach = LINK_REACH ** 2;
    let nearCount = 0;

    for (let i = 0; i < count; i += 1) {
      const cluster = CLUSTERS[clusterOf[i]];
      const matched = activeTags.has(cluster.tag);
      const dimTo = querying && !matched ? 1 : 0;
      const toneTo = querying && matched ? 1 : 0;
      dim[i] += (dimTo - dim[i]) * blend;
      tone[i] += (toneTo - tone[i]) * blend;
      const x = scatterX[i] + (homeX[i] - scatterX[i]) * introP;
      const y = scatterY[i] + (homeY[i] - scatterY[i]) * introP;
      const z0 = scatterZ[i] + (homeZ[i] - scatterZ[i]) * introP - dim[i] * 0.95;
      const x1 = x * yawCos + z0 * yawSin;
      const z1 = -x * yawSin + z0 * yawCos;
      const y2 = y * pitchCos - z1 * pitchSin;
      const z2 = y * pitchSin + z1 * pitchCos;
      const persp = FOCAL / (CAMERA - z2);
      const placedX = originX + x1 * persp * spreadX;
      const placedY = originY + y2 * persp * spreadY;
      let pushX = 0;
      let pushY = 0;
      if (cursorHot) {
        const dx = placedX - cursorX;
        const dy = placedY - cursorY;
        const distSq = dx * dx + dy * dy;
        if (distSq < insertReach) near[nearCount++] = i;
        if (distSq < cursorReach && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const push = (1 - dist / CURSOR_REACH) * 22;
          pushX = (dx / dist) * push;
          pushY = (dy / dist) * push;
        }
      }
      repelX[i] += (pushX - repelX[i]) * repelBlend;
      repelY[i] += (pushY - repelY[i]) * repelBlend;
      screenX[i] = placedX + repelX[i];
      screenY[i] = placedY + repelY[i];
      camZ[i] = z2;
    }

    ctx.clearRect(0, 0, cssW, cssH);

    if (cursorHot && nearCount > 1) {
      const cols = Math.max(1, Math.ceil(cssW / LINK_CELL));
      const rows = Math.max(1, Math.ceil(cssH / LINK_CELL));
      const cells = cols * rows;
      if (gridHead.length < cells) gridHead = new Int32Array(cells);
      gridHead.fill(-1, 0, cells);
      for (let n = 0; n < nearCount; n += 1) {
        const i = near[n];
        const col = clamp((screenX[i] / LINK_CELL) | 0, 0, cols - 1);
        const row = clamp((screenY[i] / LINK_CELL) | 0, 0, rows - 1);
        const cell = row * cols + col;
        gridNext[i] = gridHead[cell];
        gridHead[cell] = i;
      }
      ctx.beginPath();
      let strokes = 0;
      for (let n = 0; n < nearCount && strokes < 160; n += 1) {
        const i = near[n];
        const dx = screenX[i] - cursorX;
        const dy = screenY[i] - cursorY;
        if (dx * dx + dy * dy > cursorReach) continue;
        const col = (screenX[i] / LINK_CELL) | 0;
        const row = (screenY[i] / LINK_CELL) | 0;
        let links = 0;
        for (let oy = -1; oy <= 1 && links < 3; oy += 1) {
          for (let ox = -1; ox <= 1 && links < 3; ox += 1) {
            const gx = col + ox;
            const gy = row + oy;
            if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
            let j = gridHead[gy * cols + gx];
            while (j !== -1 && links < 3 && strokes < 160) {
              if (j !== i) {
                const ex = screenX[i] - screenX[j];
                const ey = screenY[i] - screenY[j];
                const distSq = ex * ex + ey * ey;
                if (distSq < linkReach && distSq > 1) {
                  const jdx = screenX[j] - cursorX;
                  const jdy = screenY[j] - cursorY;
                  const jInside = jdx * jdx + jdy * jdy <= cursorReach;
                  if (i < j || !jInside) {
                    ctx.moveTo(screenX[i], screenY[i]);
                    ctx.lineTo(screenX[j], screenY[j]);
                    links += 1;
                    strokes += 1;
                  }
                }
              }
              j = gridNext[j];
            }
          }
        }
      }
      if (strokes) {
        ctx.strokeStyle = paperCss;
        ctx.globalAlpha = 0.38;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (signal > 0.02 && linePlan.length) {
      ctx.lineWidth = 1.15;
      ctx.strokeStyle = acidCss;
      for (let i = 0; i < linePlan.length; i += 1) {
        const line = linePlan[i];
        const raw = reduced ? 1 : clamp((retrievalMs - line.delay) / line.duration, 0, 1);
        const progress = settleUnit(raw) * signal;
        if (progress <= 0.01) continue;
        const cluster = line.cluster;
        const end = project(cluster.x, cluster.y, cluster.z, yawCos, yawSin, pitchCos, pitchSin, originX, originY, spreadX, spreadY);
        ctx.globalAlpha = Math.min(1, progress);
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + (end.x - originX) * settleUnit(raw), originY + (end.y - originY) * settleUnit(raw));
        ctx.stroke();
      }
    }

    order.sort((a, b) => camZ[a] - camZ[b]);
    for (let n = 0; n < count; n += 1) {
      const i = order[n];
      const depthNorm = clamp((FOCAL / (CAMERA - camZ[i]) - 0.5) / 0.7, 0, 1);
      const radius = (0.7 + depthNorm * 1.85) * (1 - dim[i] * 0.45) * (1 + tone[i] * 0.28);
      const alpha = (0.26 + depthNorm * 0.7) * (1 - dim[i] * 0.8);
      if (alpha < 0.04 || radius < 0.3) continue;
      ctx.globalAlpha = 1;
      ctx.fillStyle = fillFor(tone[i], alpha);
      ctx.beginPath();
      ctx.arc(screenX[i], screenY[i], radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (signal > 0.02) {
      ctx.globalAlpha = signal;
      ctx.fillStyle = acidCss;
      ctx.beginPath();
      ctx.arc(originX, originY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    const labelFade = reduced ? 1 : clamp((introP - 0.22) / 0.4, 0, 1);
    if (labelFade > 0.02) {
      ctx.font = labelFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      for (let c = 0; c < CLUSTERS.length; c += 1) {
        const cluster = CLUSTERS[c];
        const matched = querying && activeTags.has(cluster.tag);
        const point = project(cluster.x, cluster.y, cluster.z, yawCos, yawSin, pitchCos, pitchSin, originX, originY, spreadX, spreadY);
        if (point.x < 8 || point.y < 8 || point.x > cssW - 8 || point.y > cssH - 8) continue;
        let blocked = false;
        for (let b = 0; b < blocks.length; b += 1) {
          const block = blocks[b];
          if (point.x >= block.left && point.x <= block.right && point.y >= block.top && point.y <= block.bottom) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        ctx.fillStyle = matched ? acidCss : paperCss;
        ctx.globalAlpha = labelFade * (matched ? 0.95 : 0.78 * (1 - signal * 0.62));
        ctx.fillText(cluster.label, point.x, point.y - 14);
      }
    }

    ctx.globalAlpha = 1;
  }

  function record(cost) {
    samples.push(cost);
    if (samples.length > 180) samples.shift();
  }

  function frame(now) {
    const started = performance.now();
    const dt = lastNow ? Math.min(34, now - lastNow) : 16;
    lastNow = now;
    if (!reduced) {
      if (!introHeld && introMs < INTRO_MS) introMs = Math.min(INTRO_MS, introMs + dt);
      baseYaw += dt * 0.00018 * (1 + scrollPace() * fieldBoost);
      const tiltBlend = 1 - Math.exp(-dt / 140);
      tiltYaw += (targetYaw - tiltYaw) * tiltBlend;
      tiltPitch += (targetPitch - tiltPitch) * tiltBlend;
      if (signalTarget === 1) retrievalMs += dt;
      signal += (signalTarget - signal) * (1 - Math.exp(-dt / 150));
    }
    drawFrame(dt);
    record(performance.now() - started);
    if (running) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    lastNow = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function syncLoop() {
    if (reduced) return;
    if (hidden || !onScreen) stop();
    else start();
  }

  function paintStatic() {
    applySize();
    if (cssW < 2) {
      requestAnimationFrame(paintStatic);
      return;
    }
    introMs = INTRO_MS;
    signal = signalTarget;
    drawFrame(16);
  }

  function retrieve(tags) {
    activeTags.clear();
    for (const tag of tags) {
      if (CLUSTERS.some((cluster) => cluster.tag === tag)) activeTags.add(tag);
    }
    signalTarget = 1;
    retrievalMs = reduced ? LINE_MS : 0;
    planLines();
    if (reduced) paintStatic();
    else start();
  }

  function reset() {
    activeTags.clear();
    linePlan = [];
    signalTarget = 0;
    retrievalMs = 0;
    if (reduced) {
      signal = 0;
      paintStatic();
    } else start();
  }

  function frameMs() {
    if (!samples.length) return { n: 0, median: 0, p95: 0, max: 0, count: 0 };
    const ordered = [...samples].sort((a, b) => a - b);
    const last = ordered.length - 1;
    return {
      n: ordered.length,
      median: ordered[ordered.length >> 1],
      p95: ordered[Math.min(last, Math.ceil(ordered.length * 0.95) - 1)],
      max: ordered[last],
      count,
    };
  }

  buildPoints(pointBudget());
  const resizeObserver = new ResizeObserver(() => {
    needsResize = true;
    if (reduced) paintStatic();
    else start();
  });
  resizeObserver.observe(canvas);

  if (section) {
    section.addEventListener("pointermove", (event) => {
      if (reduced) return;
      const rect = canvas.getBoundingClientRect();
      cursorX = event.clientX - rect.left;
      cursorY = event.clientY - rect.top;
      const nx = rect.width ? cursorX / rect.width - 0.5 : 0;
      const ny = rect.height ? cursorY / rect.height - 0.5 : 0;
      targetYaw = nx * 0.42;
      targetPitch = ny * 0.3;
      cursorHot = event.pointerType !== "touch";
    }, { passive: true });
    section.addEventListener("pointerleave", () => {
      cursorHot = false;
      targetYaw = 0;
      targetPitch = 0;
    });
  }

  document.addEventListener("visibilitychange", () => {
    hidden = document.hidden;
    syncLoop();
  });

  const intersection = new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    syncLoop();
  }, { threshold: 0.01 });
  intersection.observe(section || canvas);

  mobile.addEventListener("change", () => {
    buildPoints(pointBudget());
    needsResize = true;
    if (reduced) paintStatic();
  });

  if (reduced) paintStatic();
  else start();

  document.fonts?.ready.then(() => {
    if (reduced) paintStatic();
  });

  function releaseIntro() {
    introHeld = false;
  }

  return { retrieve, reset, frameMs, releaseIntro };
}
