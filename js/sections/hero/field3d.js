import { Camera, Geometry, Mesh, Program, Renderer, Transform, Vec3 } from "../../../vendor/ogl.mjs";
import { clamp } from "../../core/clamp.js";
import { duration } from "../../core/motion.config.js";
import { noteFrame } from "../../core/quality.js";
import { settleUnit } from "../../core/settle.js";
import { topicClusters as CLUSTERS } from "./clusters.js";

const labelWidths = new Map();
let labelsReady = false;

function labelWidth(ctx, text) {
  const ready = document.fonts?.check?.("12px 'Martian Mono'") || false;
  if (ready !== labelsReady) {
    labelsReady = ready;
    labelWidths.clear();
  }
  const known = labelWidths.get(text);
  if (known) return known;
  const width = ctx.measureText(text).width;
  labelWidths.set(text, width);
  return width;
}

const FIELD = {
  driftMin: 0.014,
  driftMax: 0.03,
  driftSlow: 0.16,
  driftFast: 0.3,
  recede: 1.28,
  pointerRadius: 0.55,
  pointerInner: 0.18,
  swirl: 1.05,
  pull: 0.62,
  zPull: 0.3,
  basePx: 1.55,
  refDist: 5.2,
  softStart: 0.22,
  softEnd: 1.5,
  spreadXy: 1.08,
  spreadZ: 1.62,
  fov: 26,
  baseDist: 5.2,
  nearDist: 3.3,
  scrollDolly: 1.55,
  restYaw: 0.42,
  restPitch: -0.1,
  maxLinks: 200,
  linkCell: 48,
  cursorReach: 120,
  linkReach: 42,
};

const INTRO_MS = duration.fieldIntro * 1000;
const DOLLY_MS = duration.fieldDolly * 1000;
const RING_MS = duration.fieldRing * 1000;
const FOV_SPAN = 2 * Math.tan((FIELD.fov * 0.5 * Math.PI) / 180);

function glsl(value) {
  return value.toFixed(5);
}

/* cubic-bezier(.65, 0, .35, 1) — glide in motion.config. */
function glideUnit(amount) {
  if (amount <= 0) return 0;
  if (amount >= 1) return 1;
  let t = amount;
  for (let i = 0; i < 5; i += 1) {
    const inv = 1 - t;
    const xEst = 3 * inv * inv * t * 0.65 + 3 * inv * t * t * 0.35 + t * t * t;
    const dx = 3 * inv * inv * 0.65 + 6 * inv * t * (0.35 - 0.65) + 3 * t * t * 0.65;
    if (Math.abs(dx) < 1e-5) break;
    t = Math.min(1, Math.max(0, t - (xEst - amount) / dx));
  }
  const inv = 1 - t;
  return 3 * inv * t * t + t * t * t;
}

function fract(value) {
  return value - Math.floor(value);
}

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

function parseChannels(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hex = raw.startsWith("#") ? raw : fallback;
  const bits = Number.parseInt(hex.slice(1), 16);
  return [(bits >> 16) & 255, (bits >> 8) & 255, bits & 255];
}

function unitColor(channels) {
  return [channels[0] / 255, channels[1] / 255, channels[2] / 255];
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

const pointVertex = `
precision highp float;
attribute vec2 position;
attribute vec3 aHome;
attribute vec3 aScatter;
attribute vec3 aTarget;
attribute float aSeed;
attribute float aDelay;
attribute float aMatch;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float uTime;
uniform float uIntro;
uniform float uRetrieve;
uniform vec3 uPointer;
uniform float uPointerAmt;
uniform float uFocus;
uniform float uBasePx;
uniform float uDpr;
uniform float uFovSpan;
uniform float uViewHeight;
varying mediump vec2 vUv;
varying mediump float vHalf;
varying mediump float vAlpha;
varying mediump float vTone;
void main() {
  vec3 rest = mix(aScatter, aHome, uIntro);
  float span = max(0.001, 1.0 - aDelay);
  float raw = clamp((uRetrieve - aDelay) / span, 0.0, 1.0);
  float shaped = raw * raw * (3.0 - 2.0 * raw);
  float travel = shaped * aMatch;
  vec2 leg = aTarget.xy - rest.xy;
  float legLen = length(leg);
  vec2 perp = legLen > 0.0001 ? vec2(-leg.y, leg.x) / legLen : vec2(1.0, 0.0);
  float mag = (fract(aSeed * 13.17) - 0.5) * 0.62;
  vec3 bend = vec3(perp * mag, (fract(aSeed * 9.71) - 0.5) * 0.4);
  vec3 ctrl = (rest + aTarget) * 0.5 + bend;
  vec3 pos = mix(mix(rest, ctrl, travel), mix(ctrl, aTarget, travel), travel);
  float driftAmp = mix(${glsl(FIELD.driftMin)}, ${glsl(FIELD.driftMax)}, fract(aSeed * 17.13));
  driftAmp *= mix(1.0, 0.1, travel);
  float ang = uTime * mix(${glsl(FIELD.driftSlow)}, ${glsl(FIELD.driftFast)}, fract(aSeed * 4.17)) + aSeed * 6.2831853;
  float tilt = aSeed * 6.2831853;
  pos.x += cos(ang) * driftAmp;
  pos.y += sin(ang) * cos(tilt) * driftAmp;
  pos.z += sin(ang) * sin(tilt) * driftAmp;
  float recede = uRetrieve * (1.0 - aMatch);
  pos.z -= recede * ${glsl(FIELD.recede)};
  vec2 rel = pos.xy - uPointer.xy;
  float dist = length(rel);
  float fall = 1.0 - smoothstep(${glsl(FIELD.pointerRadius * FIELD.pointerInner)}, ${glsl(FIELD.pointerRadius)}, dist);
  float pull = fall * uPointerAmt;
  float sang = pull * ${glsl(FIELD.swirl)};
  float cs = cos(sang);
  float sn = sin(sang);
  vec2 spun = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs);
  spun *= mix(1.0, ${glsl(FIELD.pull)}, pull);
  pos.xy = mix(pos.xy, uPointer.xy + spun, pull);
  pos.z = mix(pos.z, uPointer.z, pull * ${glsl(FIELD.zPull)});
  vec4 viewPos = modelViewMatrix * vec4(pos, 1.0);
  float depth = max(0.25, -viewPos.z);
  float radiusPx = clamp(uBasePx * (${glsl(FIELD.refDist)} / depth) * uDpr, 1.05 * uDpr, 7.0 * uDpr);
  float behind = smoothstep(${glsl(FIELD.softStart)}, ${glsl(FIELD.softEnd)}, depth - uFocus);
  float edgePx = 1.0 + behind * 3.5;
  vHalf = (0.5 * edgePx) / radiusPx;
  float pad = 1.0 + vHalf + 0.8 / radiusPx;
  vUv = position * pad;
  float fade = mix(0.9, 0.3, behind);
  vAlpha = fade * mix(1.0, 0.24, recede);
  vTone = smoothstep(0.12, 0.62, travel);
  float worldPerPx = (depth * uFovSpan) / max(uViewHeight, 1.0);
  viewPos.xy += position * radiusPx * pad * worldPerPx;
  gl_Position = projectionMatrix * viewPos;
}
`;

const pointFragment = `
precision mediump float;
varying mediump vec2 vUv;
varying mediump float vHalf;
varying mediump float vAlpha;
varying mediump float vTone;
uniform vec3 uPaper;
uniform vec3 uAcid;
void main() {
  float dist = length(vUv);
  float cover = 1.0 - smoothstep(1.0 - vHalf, 1.0 + vHalf, dist);
  if (cover < 0.004) discard;
  gl_FragColor = vec4(mix(uPaper, uAcid, vTone), cover * vAlpha);
}
`;

const linkVertex = `
precision highp float;
attribute vec3 position;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const linkFragment = `
precision mediump float;
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  gl_FragColor = vec4(uColor, uAlpha);
}
`;

const ringVertex = `
precision highp float;
attribute vec2 position;
uniform vec2 uCenter;
uniform float uRadius;
uniform vec2 uView;
varying mediump vec2 vOffset;
void main() {
  float reach = uRadius + 2.0;
  vec2 px = uCenter + position * reach;
  vOffset = position * reach;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
}
`;

const ringFragment = `
precision highp float;
varying mediump vec2 vOffset;
uniform float uRadius;
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  float band = abs(length(vOffset) - uRadius);
  float cover = 1.0 - smoothstep(0.0, 1.0, band);
  if (cover < 0.004) discard;
  gl_FragColor = vec4(uColor, cover * uAlpha);
}
`;

const quad = new Float32Array([
  -1, -1, 1, -1, -1, 1,
  -1, 1, 1, -1, 1, 1,
]);

export function initHeroField3d(canvas, index, { reduced = false, holdIntro = false, tier = "high", count = 4000, dprCap = 2, links = true } = {}) {
  if (!canvas || !index?.length || !count) return null;
  const section = canvas.closest(".hero") || canvas.parentElement;
  if (!section) return null;

  const paper = parseChannels("--paper", "#F2F4F7");
  const acid = parseChannels("--acid", "#D9FF43");
  const paperCss = `rgb(${paper[0]},${paper[1]},${paper[2]})`;
  const acidCss = `rgb(${acid[0]},${acid[1]},${acid[2]})`;
  const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "ui-monospace, monospace";
  const labelFont = `450 12px ${mono}`;
  const knownTags = new Set(CLUSTERS.map((cluster) => cluster.tag));

  const labels = document.createElement("canvas");
  labels.className = "hero-field-labels";
  labels.setAttribute("aria-hidden", "true");
  labels.width = 300;
  labels.height = 200;
  canvas.insertAdjacentElement("afterend", labels);
  const labelCtx = labels.getContext("2d");

  const rect = section.getBoundingClientRect();
  let cssW = Math.max(1, rect.width);
  let cssH = Math.max(1, rect.height);
  let rawDpr = window.devicePixelRatio || 1;
  let cap = dprCap;
  let linksOn = links !== false;
  let draws = 0;
  const initialDpr = Math.min(cap, rawDpr);

  const renderer = new Renderer({
    canvas,
    width: cssW,
    height: cssH,
    dpr: initialDpr,
    alpha: true,
    antialias: false,
    depth: true,
    stencil: false,
    premultipliedAlpha: false,
  });
  const gl = renderer.gl;
  if (!gl) {
    labels.remove();
    return null;
  }
  gl.clearColor(0, 0, 0, 0);
  canvas.style.width = "";
  canvas.style.height = "";

  const scene = new Transform();
  const camera = new Camera(gl, { fov: FIELD.fov, aspect: cssW / cssH, near: 0.08, far: 48 });
  const focusTarget = new Vec3();
  const pointer = [0, 0, 0];
  const ringCenter = [cssW * 0.5, cssH * 0.45];
  const viewSize = [cssW, cssH];
  const matchedCenter = [0, 0, 0];
  const scratch = new Float32Array(3);
  const linkData = new Float32Array(FIELD.maxLinks * 6);
  const labelPoint = { x: 0, y: 0, w: 0 };

  const pointUniforms = {
    uTime: { value: 0 },
    uIntro: { value: reduced ? 1 : 0 },
    uRetrieve: { value: 0 },
    uPointer: { value: pointer },
    uPointerAmt: { value: 0 },
    uFocus: { value: FIELD.baseDist },
    uBasePx: { value: FIELD.basePx },
    uDpr: { value: initialDpr },
    uFovSpan: { value: FOV_SPAN },
    uViewHeight: { value: Math.max(1, cssH * initialDpr) },
    uPaper: { value: unitColor(paper) },
    uAcid: { value: unitColor(acid) },
  };
  const linkUniforms = {
    uColor: { value: unitColor(paper) },
    uAlpha: { value: 0.38 },
  };
  const ringUniforms = {
    uCenter: { value: ringCenter },
    uRadius: { value: 8 },
    uView: { value: viewSize },
    uColor: { value: unitColor(acid) },
    uAlpha: { value: 0 },
  };

  let home = new Float32Array(0);
  let scatter = new Float32Array(0);
  let target = new Float32Array(0);
  let seeds = new Float32Array(0);
  let delays = new Float32Array(0);
  let match = new Float32Array(0);
  let clusterOf = new Uint8Array(0);
  let screenX = new Float32Array(0);
  let screenY = new Float32Array(0);
  let world = new Float32Array(0);
  let gridHead = new Int32Array(256);
  let gridNext = new Int32Array(0);
  let near = new Uint16Array(0);
  let placed = [];
  let pointCount = 0;

  let pointsGeometry = null;
  let linksGeometry = null;
  let ringGeometry = null;
  let pointsProgram = null;
  let linksProgram = null;
  let ringProgram = null;
  let pointsMesh = null;
  let linksMesh = null;
  let ringMesh = null;
  let matchAttr = null;
  let linkAttr = null;

  const activeTags = new Set();
  let introMs = reduced ? INTRO_MS : 0;
  let introHeld = Boolean(holdIntro) && !reduced;
  let introP = reduced ? 1 : 0;
  let clock = 0;
  let retrieveFrom = 0;
  let retrieveTo = 0;
  let retrieveNow = 0;
  let cameraFrom = 0;
  let cameraTo = 0;
  let cameraNow = 0;
  let aimElapsed = DOLLY_MS;
  let yaw = FIELD.restYaw;
  let pitch = FIELD.restPitch;
  let targetYaw = FIELD.restYaw;
  let targetPitch = FIELD.restPitch;
  let scrollDolly = 0;
  let eyeDist = FIELD.baseDist;
  let pointerAmt = 0;
  let pointerTarget = 0;
  let cursorX = cssW * 0.5;
  let cursorY = cssH * 0.45;
  let cursorHot = false;
  let touchId = null;
  let dragX = 0;
  let dragY = 0;
  let ringT = 1;
  let linksDirty = false;
  let needsResize = true;
  let running = false;
  let raf = 0;
  let lastNow = 0;
  let onScreen = true;
  let hidden = document.hidden;
  let disposed = false;
  let fault = null;
  const samples = [];
  const cpuSamples = [];
  const abort = new AbortController();
  const signal = abort.signal;

  const blockNodes = [...section.querySelectorAll(".hero-kicker, .hero-name, .hero-support, .hero-query, .hero-links, .hero-proof")];
  const blocks = blockNodes.map(() => ({ left: 0, top: 0, right: 0, bottom: 0 }));

  function buildPoints(total) {
    const counts = CLUSTERS.map((cluster) => index.filter((item) => item.tags.includes(cluster.tag)).length);
    const weightSum = counts.reduce((sum, value) => sum + value, 0);
    const weights = weightSum ? counts.map((value) => value / weightSum) : CLUSTERS.map(() => 1 / CLUSTERS.length);
    const shares = allocate(weights, total);
    const rand = mulberry32(0x51a11);
    home = new Float32Array(total * 3);
    scatter = new Float32Array(total * 3);
    target = new Float32Array(total * 3);
    seeds = new Float32Array(total);
    delays = new Float32Array(total);
    match = new Float32Array(total);
    clusterOf = new Uint8Array(total);
    screenX = new Float32Array(total);
    screenY = new Float32Array(total);
    world = new Float32Array(total * 3);
    gridNext = new Int32Array(total);
    near = new Uint16Array(total);
    placed = CLUSTERS.map((cluster) => ({
      tag: cluster.tag,
      label: cluster.label,
      x: cluster.x * FIELD.spreadXy,
      y: cluster.y * FIELD.spreadXy,
      z: cluster.z * FIELD.spreadZ,
    }));
    let cursor = 0;
    for (let c = 0; c < CLUSTERS.length; c += 1) {
      const cluster = CLUSTERS[c];
      const place = placed[c];
      for (let n = 0; n < shares[c]; n += 1) {
        const i = cursor++;
        clusterOf[i] = c;
        home[i * 3] = clamp(cluster.x + gaussian(rand) * 0.16, cluster.x - 0.34, cluster.x + 0.34) * FIELD.spreadXy;
        home[i * 3 + 1] = clamp(cluster.y + gaussian(rand) * 0.13, cluster.y - 0.28, cluster.y + 0.28) * FIELD.spreadXy;
        home[i * 3 + 2] = clamp(cluster.z + gaussian(rand) * 0.15, cluster.z - 0.32, cluster.z + 0.32) * FIELD.spreadZ;
        scatter[i * 3] = (rand() - 0.5) * 2.8;
        scatter[i * 3 + 1] = (rand() - 0.5) * 2.2;
        scatter[i * 3 + 2] = (rand() - 0.5) * 2.2;
        target[i * 3] = place.x;
        target[i * 3 + 1] = place.y;
        target[i * 3 + 2] = place.z;
        seeds[i] = rand();
        delays[i] = rand() * 0.42;
      }
    }
    pointCount = cursor;
  }

  function fieldPoint(i, out) {
    const i3 = i * 3;
    const intro = introP;
    let x = scatter[i3] + (home[i3] - scatter[i3]) * intro;
    let y = scatter[i3 + 1] + (home[i3 + 1] - scatter[i3 + 1]) * intro;
    let z = scatter[i3 + 2] + (home[i3 + 2] - scatter[i3 + 2]) * intro;
    const tx = target[i3];
    const ty = target[i3 + 1];
    const tz = target[i3 + 2];
    const seed = seeds[i];
    const delay = delays[i];
    const matched = match[i];
    const span = Math.max(0.001, 1 - delay);
    let raw = (retrieveNow - delay) / span;
    if (raw < 0) raw = 0;
    else if (raw > 1) raw = 1;
    const shaped = raw * raw * (3 - 2 * raw);
    const travel = shaped * matched;
    const legX = tx - x;
    const legY = ty - y;
    const legLen = Math.hypot(legX, legY);
    const perpX = legLen > 0.0001 ? -legY / legLen : 1;
    const perpY = legLen > 0.0001 ? legX / legLen : 0;
    const mag = (fract(seed * 13.17) - 0.5) * 0.62;
    const bendZ = (fract(seed * 9.71) - 0.5) * 0.4;
    const cx = (x + tx) * 0.5 + perpX * mag;
    const cy = (y + ty) * 0.5 + perpY * mag;
    const cz = (z + tz) * 0.5 + bendZ;
    const ax = x + (cx - x) * travel;
    const ay = y + (cy - y) * travel;
    const az = z + (cz - z) * travel;
    const bx = cx + (tx - cx) * travel;
    const by = cy + (ty - cy) * travel;
    const bz = cz + (tz - cz) * travel;
    x = ax + (bx - ax) * travel;
    y = ay + (by - ay) * travel;
    z = az + (bz - az) * travel;
    const driftAmp = (FIELD.driftMin + (FIELD.driftMax - FIELD.driftMin) * fract(seed * 17.13)) * (1 - travel * 0.9);
    const ang = clock * (FIELD.driftSlow + (FIELD.driftFast - FIELD.driftSlow) * fract(seed * 4.17)) + seed * 6.2831853;
    const tilt = seed * 6.2831853;
    const sa = Math.sin(ang);
    x += Math.cos(ang) * driftAmp;
    y += sa * Math.cos(tilt) * driftAmp;
    z += sa * Math.sin(tilt) * driftAmp;
    z -= retrieveNow * (1 - matched) * FIELD.recede;
    const relX = x - pointer[0];
    const relY = y - pointer[1];
    const dist = Math.hypot(relX, relY);
    const edge0 = FIELD.pointerRadius * FIELD.pointerInner;
    const edge1 = FIELD.pointerRadius;
    let fall = 0;
    if (dist <= edge0) fall = 1;
    else if (dist < edge1) {
      const t = (dist - edge0) / (edge1 - edge0);
      fall = 1 - t * t * (3 - 2 * t);
    }
    const pull = fall * pointerAmt;
    const sang = pull * FIELD.swirl;
    const cs = Math.cos(sang);
    const sn = Math.sin(sang);
    const shrink = 1 + (FIELD.pull - 1) * pull;
    const spunX = (relX * cs - relY * sn) * shrink;
    const spunY = (relX * sn + relY * cs) * shrink;
    out[0] = x + (pointer[0] + spunX - x) * pull;
    out[1] = y + (pointer[1] + spunY - y) * pull;
    out[2] = z + (pointer[2] - z) * pull * FIELD.zPull;
  }

  function resetRendererState() {
    const state = renderer.state;
    state.currentProgram = null;
    state.boundBuffer = null;
    state.framebuffer = null;
    state.viewport.width = null;
    state.viewport.height = null;
    state.blendFunc = { src: gl.ONE, dst: gl.ZERO };
    state.blendEquation = { modeRGB: gl.FUNC_ADD };
    state.depthMask = true;
    state.depthFunc = gl.LEQUAL;
    state.cullFace = false;
    state.uniformLocations = new Map();
    state[gl.BLEND] = undefined;
    state[gl.DEPTH_TEST] = undefined;
    state[gl.CULL_FACE] = undefined;
    renderer.currentGeometry = null;
    gl.clearColor(0, 0, 0, 0);
  }

  function detachMesh(mesh) {
    if (mesh) mesh.setParent(null);
  }

  function releaseBuffers() {
    detachMesh(pointsMesh);
    detachMesh(linksMesh);
    detachMesh(ringMesh);
    const lost = !gl || gl.isContextLost();
    if (!lost) {
      pointsGeometry?.remove();
      linksGeometry?.remove();
      ringGeometry?.remove();
      pointsProgram?.remove();
      linksProgram?.remove();
      ringProgram?.remove();
    }
    pointsGeometry = null;
    linksGeometry = null;
    ringGeometry = null;
    pointsProgram = null;
    linksProgram = null;
    ringProgram = null;
    pointsMesh = null;
    linksMesh = null;
    ringMesh = null;
    matchAttr = null;
    linkAttr = null;
  }

  function releaseContext() {
    if (!gl || gl.isContextLost()) {
      canvas.dataset.gl = "lost";
      return;
    }
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    canvas.dataset.gl = gl.isContextLost() ? "lost" : "live";
  }

  function createGpu() {
    pointsGeometry = new Geometry(gl, {
      position: { size: 2, data: quad },
      aHome: { size: 3, data: home, instanced: 1 },
      aScatter: { size: 3, data: scatter, instanced: 1 },
      aTarget: { size: 3, data: target, instanced: 1 },
      aSeed: { size: 1, data: seeds, instanced: 1 },
      aDelay: { size: 1, data: delays, instanced: 1 },
      aMatch: { size: 1, data: match, instanced: 1, usage: gl.DYNAMIC_DRAW },
    });
    matchAttr = pointsGeometry.attributes.aMatch;
    pointsProgram = new Program(gl, {
      vertex: pointVertex,
      fragment: pointFragment,
      uniforms: pointUniforms,
      transparent: true,
      cullFace: false,
      depthTest: true,
      depthWrite: true,
    });
    pointsMesh = new Mesh(gl, {
      geometry: pointsGeometry,
      program: pointsProgram,
      frustumCulled: false,
      renderOrder: 0,
    });
    pointsMesh.setParent(scene);

    linksGeometry = new Geometry(gl, {
      position: { size: 3, data: linkData, usage: gl.DYNAMIC_DRAW },
    });
    linksGeometry.setDrawRange(0, 0);
    linkAttr = linksGeometry.attributes.position;
    linksProgram = new Program(gl, {
      vertex: linkVertex,
      fragment: linkFragment,
      uniforms: linkUniforms,
      transparent: true,
      cullFace: false,
      depthTest: false,
      depthWrite: false,
    });
    linksMesh = new Mesh(gl, {
      geometry: linksGeometry,
      program: linksProgram,
      mode: gl.LINES,
      frustumCulled: false,
      renderOrder: 1,
    });
    linksMesh.visible = false;
    linksMesh.setParent(scene);

    ringGeometry = new Geometry(gl, {
      position: { size: 2, data: quad },
    });
    ringProgram = new Program(gl, {
      vertex: ringVertex,
      fragment: ringFragment,
      uniforms: ringUniforms,
      transparent: true,
      cullFace: false,
      depthTest: false,
      depthWrite: false,
    });
    ringMesh = new Mesh(gl, {
      geometry: ringGeometry,
      program: ringProgram,
      frustumCulled: false,
      renderOrder: 2,
    });
    ringMesh.visible = false;
    ringMesh.setParent(scene);
  }

  function applySize() {
    const box = section.getBoundingClientRect();
    const width = Math.max(1, box.width);
    const height = Math.max(1, box.height);
    const raw = Math.min(cap, window.devicePixelRatio || 1);
    const bufferW = Math.max(1, Math.round(width * raw));
    const bufferH = Math.max(1, Math.round(height * raw));
    const dpr = bufferW / width;
    cssW = width;
    cssH = height;
    renderer.dpr = dpr;
    renderer.setSize(width, height);
    canvas.style.width = "";
    canvas.style.height = "";
    if (labels.width !== bufferW) labels.width = bufferW;
    if (labels.height !== bufferH) labels.height = bufferH;
    camera.aspect = width / height;
    camera.perspective({ fov: FIELD.fov, aspect: camera.aspect, near: 0.08, far: 48 });
    pointUniforms.uDpr.value = dpr;
    pointUniforms.uViewHeight.value = bufferH;
    pointUniforms.uFovSpan.value = FOV_SPAN;
    needsResize = false;
  }

  function project(x, y, z) {
    const m = camera.projectionViewMatrix;
    const clipX = m[0] * x + m[4] * y + m[8] * z + m[12];
    const clipY = m[1] * x + m[5] * y + m[9] * z + m[13];
    const clipW = m[3] * x + m[7] * y + m[11] * z + m[15];
    const inv = clipW === 0 ? 1 : 1 / clipW;
    labelPoint.x = (clipX * inv * 0.5 + 0.5) * cssW;
    labelPoint.y = (1 - (clipY * inv * 0.5 + 0.5)) * cssH;
    labelPoint.w = clipW;
  }

  function placeCamera() {
    const fx = matchedCenter[0] * cameraNow;
    const fy = matchedCenter[1] * cameraNow;
    const fz = matchedCenter[2] * cameraNow;
    eyeDist = FIELD.baseDist + (FIELD.nearDist - FIELD.baseDist) * cameraNow + scrollDolly;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    camera.position.set(
      fx + Math.sin(yaw) * cp * eyeDist,
      fy + sp * eyeDist,
      fz + Math.cos(yaw) * cp * eyeDist,
    );
    focusTarget.set(fx, fy, fz);
    camera.lookAt(focusTarget);
    camera.updateMatrixWorld();
    project(0, 0, 0);
    if (labelPoint.w > 0) {
      ringCenter[0] = labelPoint.x;
      ringCenter[1] = labelPoint.y;
    }
  }

  function placePointer() {
    if (pointerAmt <= 0.001 && pointerTarget <= 0) return;
    const m = camera.worldMatrix;
    const ndcX = (cursorX / cssW) * 2 - 1;
    const ndcY = 1 - (cursorY / cssH) * 2;
    const tan = Math.tan((FIELD.fov * 0.5 * Math.PI) / 180);
    const aspect = cssW / cssH;
    const lx = ndcX * aspect * tan;
    const ly = ndcY * tan;
    const dx = -m[8] + m[0] * lx + m[4] * ly;
    const dy = -m[9] + m[1] * lx + m[5] * ly;
    const dz = -m[10] + m[2] * lx + m[6] * ly;
    if (Math.abs(dz) < 1e-4) return;
    const planeZ = matchedCenter[2] * cameraNow;
    const t = (planeZ - m[14]) / dz;
    if (t <= 0) return;
    pointer[0] = m[12] + dx * t;
    pointer[1] = m[13] + dy * t;
    pointer[2] = planeZ;
  }

  function heroLeave() {
    const box = section.getBoundingClientRect();
    const dropped = -box.top;
    if (dropped <= 0) return 0;
    return clamp(dropped / Math.max(box.height, 1), 0, 1);
  }

  function step(dt) {
    clock += dt * 0.001;
    if (!introHeld && introMs < INTRO_MS) introMs = Math.min(INTRO_MS, introMs + dt);
    introP = settleUnit(Math.min(1, introMs / INTRO_MS));
    aimElapsed = Math.min(DOLLY_MS, aimElapsed + dt);
    const eased = glideUnit(aimElapsed / DOLLY_MS);
    retrieveNow = retrieveFrom + (retrieveTo - retrieveFrom) * eased;
    cameraNow = cameraFrom + (cameraTo - cameraFrom) * eased;
    const follow = 1 - Math.exp(-dt / 160);
    yaw += (targetYaw - yaw) * follow;
    pitch += (targetPitch - pitch) * follow;
    const dollied = heroLeave() * FIELD.scrollDolly;
    scrollDolly += (dollied - scrollDolly) * (1 - Math.exp(-dt / 240));
    const amtRate = pointerTarget > pointerAmt ? 140 : 220;
    pointerAmt += (pointerTarget - pointerAmt) * (1 - Math.exp(-dt / amtRate));
    if (ringT < 1) ringT = Math.min(1, ringT + dt / RING_MS);
  }

  function hideLinks() {
    linksDirty = false;
    if (linksMesh) linksMesh.visible = false;
    if (linksGeometry) linksGeometry.setDrawRange(0, 0);
  }

  function rebuildLinks() {
    if (!linksOn || !linkAttr || !linksMesh || !cursorHot) {
      hideLinks();
      return;
    }
    const m = camera.projectionViewMatrix;
    const insertReach = (FIELD.cursorReach + FIELD.linkReach) ** 2;
    const cursorReach = FIELD.cursorReach ** 2;
    const linkReach = FIELD.linkReach ** 2;
    let nearCount = 0;
    for (let i = 0; i < pointCount; i += 1) {
      fieldPoint(i, scratch);
      const x = scratch[0];
      const y = scratch[1];
      const z = scratch[2];
      world[i * 3] = x;
      world[i * 3 + 1] = y;
      world[i * 3 + 2] = z;
      const clipX = m[0] * x + m[4] * y + m[8] * z + m[12];
      const clipY = m[1] * x + m[5] * y + m[9] * z + m[13];
      const clipW = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (clipW <= 0.05) {
        screenX[i] = -99999;
        screenY[i] = -99999;
        continue;
      }
      const inv = 1 / clipW;
      const sx = (clipX * inv * 0.5 + 0.5) * cssW;
      const sy = (1 - (clipY * inv * 0.5 + 0.5)) * cssH;
      screenX[i] = sx;
      screenY[i] = sy;
      const dx = sx - cursorX;
      const dy = sy - cursorY;
      if (dx * dx + dy * dy < insertReach) near[nearCount++] = i;
    }
    const cols = Math.max(1, Math.ceil(cssW / FIELD.linkCell));
    const rows = Math.max(1, Math.ceil(cssH / FIELD.linkCell));
    const cells = cols * rows;
    if (gridHead.length < cells) gridHead = new Int32Array(cells);
    gridHead.fill(-1, 0, cells);
    for (let n = 0; n < nearCount; n += 1) {
      const i = near[n];
      const col = clamp((screenX[i] / FIELD.linkCell) | 0, 0, cols - 1);
      const row = clamp((screenY[i] / FIELD.linkCell) | 0, 0, rows - 1);
      const cell = row * cols + col;
      gridNext[i] = gridHead[cell];
      gridHead[cell] = i;
    }
    let segments = 0;
    for (let n = 0; n < nearCount && segments < FIELD.maxLinks; n += 1) {
      const i = near[n];
      const dx = screenX[i] - cursorX;
      const dy = screenY[i] - cursorY;
      if (dx * dx + dy * dy > cursorReach) continue;
      const col = (screenX[i] / FIELD.linkCell) | 0;
      const row = (screenY[i] / FIELD.linkCell) | 0;
      let links = 0;
      for (let oy = -1; oy <= 1 && links < 3; oy += 1) {
        for (let ox = -1; ox <= 1 && links < 3; ox += 1) {
          const gx = col + ox;
          const gy = row + oy;
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          let j = gridHead[gy * cols + gx];
          while (j !== -1 && links < 3 && segments < FIELD.maxLinks) {
            if (j !== i) {
              const ex = screenX[i] - screenX[j];
              const ey = screenY[i] - screenY[j];
              const distSq = ex * ex + ey * ey;
              if (distSq < linkReach && distSq > 1) {
                const jdx = screenX[j] - cursorX;
                const jdy = screenY[j] - cursorY;
                const jInside = jdx * jdx + jdy * jdy <= cursorReach;
                if (i < j || !jInside) {
                  const o = segments * 6;
                  linkData[o] = world[i * 3];
                  linkData[o + 1] = world[i * 3 + 1];
                  linkData[o + 2] = world[i * 3 + 2];
                  linkData[o + 3] = world[j * 3];
                  linkData[o + 4] = world[j * 3 + 1];
                  linkData[o + 5] = world[j * 3 + 2];
                  links += 1;
                  segments += 1;
                }
              }
            }
            j = gridNext[j];
          }
        }
      }
    }
    linksGeometry.setDrawRange(0, segments * 2);
    linkAttr.needsUpdate = true;
    linksMesh.visible = segments > 0;
  }

  function drawLabels() {
    if (!labelCtx) return;
    const dpr = renderer.dpr || 1;
    labelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    labelCtx.clearRect(0, 0, cssW, cssH);
    const labelFade = reduced ? 1 : clamp((introP - 0.22) / 0.4, 0, 1);
    if (labelFade <= 0.02) return;
    const canvasRect = canvas.getBoundingClientRect();
    for (let b = 0; b < blockNodes.length; b += 1) {
      const box = blockNodes[b].getBoundingClientRect();
      blocks[b].left = box.left - canvasRect.left - 12;
      blocks[b].top = box.top - canvasRect.top - 8;
      blocks[b].right = box.right - canvasRect.left + 12;
      blocks[b].bottom = box.bottom - canvasRect.top + 10;
    }
    labelCtx.font = labelFont;
    labelCtx.textAlign = "center";
    labelCtx.textBaseline = "bottom";
    for (let c = 0; c < placed.length; c += 1) {
      const cluster = placed[c];
      project(cluster.x, cluster.y, cluster.z);
      if (labelPoint.w <= 0) continue;
      const x = labelPoint.x;
      const y = labelPoint.y;
      if (x < 8 || y < 8 || x > cssW - 8 || y > cssH - 8) continue;
      const width = labelWidth(labelCtx, cluster.label);
      const textLeft = x - width / 2;
      const textRight = x + width / 2;
      const textTop = y - 28;
      const textBottom = y - 10;
      let blocked = false;
      for (let b = 0; b < blocks.length; b += 1) {
        const block = blocks[b];
        if (textRight >= block.left && textLeft <= block.right && textBottom >= block.top && textTop <= block.bottom) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const acidAmount = activeTags.has(cluster.tag) ? retrieveNow : 0;
      labelCtx.fillStyle = acidAmount > 0.45 ? acidCss : paperCss;
      labelCtx.globalAlpha = labelFade * (acidAmount > 0.45 ? 0.95 : 0.78 * (1 - retrieveNow * 0.62));
      labelCtx.fillText(cluster.label, x, y - 14);
    }
    labelCtx.globalAlpha = 1;
  }

  function draw() {
    if (disposed || !gl || gl.isContextLost()) return;
    draws += 1;
    if (needsResize) applySize();
    if (cssW < 2 || cssH < 2) return;
    placeCamera();
    placePointer();
    if (linksDirty) {
      rebuildLinks();
      linksDirty = false;
    }
    pointUniforms.uTime.value = clock;
    pointUniforms.uIntro.value = introP;
    pointUniforms.uRetrieve.value = retrieveNow;
    pointUniforms.uPointerAmt.value = pointerAmt;
    pointUniforms.uFocus.value = eyeDist;
    const span = Math.min(cssW, cssH);
    const alpha = ringT >= 1 ? 0 : (1 - ringT) * (1 - ringT);
    ringUniforms.uRadius.value = 8 + Math.min(ringT, 1) * span * 0.42;
    ringUniforms.uAlpha.value = alpha;
    viewSize[0] = cssW;
    viewSize[1] = cssH;
    if (ringMesh) ringMesh.visible = alpha > 0.015;
    renderer.render({ scene, camera });
    drawLabels();
  }

  function record(interval, cpu) {
    samples.push(interval);
    cpuSamples.push(cpu);
    if (samples.length > 240) {
      samples.shift();
      cpuSamples.shift();
    }
  }

  function frame(now) {
    const started = performance.now();
    const hadStamp = lastNow > 0;
    const raw = hadStamp ? now - lastNow : 16.7;
    const dt = Math.min(34, raw);
    lastNow = now;
    try {
      const nextRaw = window.devicePixelRatio || 1;
      if (nextRaw !== rawDpr) {
        rawDpr = nextRaw;
        needsResize = true;
      }
      if (!reduced) step(dt);
      draw();
      record(raw, performance.now() - started);
      if (hadStamp) noteFrame(raw);
    } catch (error) {
      fault = String(error && error.stack || error);
    }
    if (running && !disposed) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced || disposed) return;
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
    if (reduced || disposed) return;
    if (hidden || !onScreen) stop();
    else start();
  }

  function updateMatch() {
    for (let i = 0; i < pointCount; i += 1) {
      match[i] = activeTags.has(placed[clusterOf[i]].tag) ? 1 : 0;
    }
    if (matchAttr) matchAttr.needsUpdate = true;
  }

  function updateFocus() {
    let n = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let c = 0; c < placed.length; c += 1) {
      const cluster = placed[c];
      if (!activeTags.has(cluster.tag)) continue;
      x += cluster.x;
      y += cluster.y;
      z += cluster.z;
      n += 1;
    }
    matchedCenter[0] = n ? x / n : 0;
    matchedCenter[1] = n ? y / n : 0;
    matchedCenter[2] = n ? z / n : 0;
    return n > 0;
  }

  function retrieve(tags) {
    activeTags.clear();
    for (const tag of tags) {
      if (knownTags.has(tag)) activeTags.add(tag);
    }
    updateMatch();
    const hasMatch = updateFocus();
    hideLinks();
    if (reduced) {
      retrieveNow = 1;
      retrieveTo = 1;
      cameraNow = hasMatch ? 1 : 0;
      cameraTo = cameraNow;
      ringT = 1;
      draw();
      return;
    }
    retrieveFrom = 0;
    retrieveTo = 1;
    retrieveNow = 0;
    cameraFrom = 0;
    cameraTo = hasMatch ? 1 : 0;
    cameraNow = 0;
    aimElapsed = 0;
    ringT = 0;
    syncLoop();
  }

  function reset() {
    hideLinks();
    if (reduced) {
      activeTags.clear();
      updateMatch();
      updateFocus();
      retrieveNow = 0;
      retrieveTo = 0;
      cameraNow = 0;
      cameraTo = 0;
      ringT = 1;
      draw();
      return;
    }
    retrieveFrom = retrieveNow;
    retrieveTo = 0;
    cameraFrom = cameraNow;
    cameraTo = 0;
    aimElapsed = 0;
    syncLoop();
  }

  function summarise(values) {
    if (!values.length) return { median: 0, p95: 0, max: 0 };
    const ordered = values.slice().sort((a, b) => a - b);
    const last = ordered.length - 1;
    return {
      median: ordered[ordered.length >> 1],
      p95: ordered[Math.min(last, Math.ceil(ordered.length * 0.95) - 1)],
      max: ordered[last],
    };
  }

  function frameMs() {
    const interval = summarise(samples);
    const cpu = summarise(cpuSamples);
    return {
      n: samples.length,
      median: interval.median,
      p95: interval.p95,
      max: interval.max,
      count: pointCount,
      tier,
      mode: "webgl",
      dpr: renderer.dpr || initialDpr,
      dprCap: cap,
      links: linksOn,
      draws,
      cpuMedian: cpu.median,
      cpuP95: cpu.p95,
      fault,
    };
  }

  function configure(next) {
    if (disposed) return;
    linksOn = next.links !== false;
    const nextCap = Number(next.dprCap) || cap;
    const capChanged = nextCap !== cap;
    cap = nextCap;
    if (!linksOn) hideLinks();
    if (next.count && next.count !== pointCount) {
      releaseBuffers();
      resetRendererState();
      buildPoints(next.count);
      createGpu();
      needsResize = true;
    } else if (capChanged) needsResize = true;
    if (reduced) draw();
  }

  function releaseIntro() {
    introHeld = false;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    abort.abort();
    resizeObserver.disconnect();
    intersection.disconnect();
    releaseBuffers();
    releaseContext();
    labels.remove();
  }

  buildPoints(count);
  createGpu();

  function onPointerMove(event) {
    if (reduced || disposed) return;
    const box = canvas.getBoundingClientRect();
    cursorX = event.clientX - box.left;
    cursorY = event.clientY - box.top;
    if (event.pointerType === "touch") {
      if (touchId !== event.pointerId) return;
      const dx = event.clientX - dragX;
      const dy = event.clientY - dragY;
      dragX = event.clientX;
      dragY = event.clientY;
      targetYaw = clamp(targetYaw + dx * 0.005, FIELD.restYaw - 1.05, FIELD.restYaw + 1.05);
      targetPitch = clamp(targetPitch + dy * 0.0035, -0.48, 0.42);
      return;
    }
    const nx = cssW ? cursorX / cssW - 0.5 : 0;
    const ny = cssH ? cursorY / cssH - 0.5 : 0;
    targetYaw = FIELD.restYaw + nx * 0.55;
    targetPitch = clamp(FIELD.restPitch + ny * 0.28, -0.48, 0.42);
    cursorHot = true;
    pointerTarget = 1;
    if (linksOn) linksDirty = true;
  }

  section.addEventListener("pointerdown", (event) => {
    if (reduced || event.pointerType !== "touch") return;
    if (event.target instanceof Element && event.target.closest("a, button, input, textarea, select, label")) return;
    touchId = event.pointerId;
    dragX = event.clientX;
    dragY = event.clientY;
    pointerTarget = 1;
  }, { signal, passive: true });

  section.addEventListener("pointermove", onPointerMove, { signal, passive: true });

  section.addEventListener("pointerup", (event) => {
    if (touchId !== event.pointerId) return;
    touchId = null;
    pointerTarget = 0;
  }, { signal, passive: true });

  section.addEventListener("pointercancel", (event) => {
    if (touchId !== event.pointerId) return;
    touchId = null;
    pointerTarget = 0;
  }, { signal, passive: true });

  section.addEventListener("pointerleave", (event) => {
    cursorHot = false;
    pointerTarget = 0;
    hideLinks();
    if (event.pointerType === "touch") return;
    targetYaw = FIELD.restYaw;
    targetPitch = FIELD.restPitch;
  }, { signal });

  document.addEventListener("visibilitychange", () => {
    hidden = document.hidden;
    syncLoop();
  }, { signal });

  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) dispose();
  }, { signal });

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stop();
  }, { signal });

  canvas.addEventListener("webglcontextrestored", () => {
    if (disposed) return;
    releaseBuffers();
    resetRendererState();
    createGpu();
    needsResize = true;
    if (reduced) draw();
    else syncLoop();
  }, { signal });

  const resizeObserver = new ResizeObserver(() => {
    needsResize = true;
    if (reduced) draw();
    else syncLoop();
  });
  resizeObserver.observe(section);

  const intersection = new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    syncLoop();
  }, { threshold: 0.01 });
  intersection.observe(section);

  document.fonts?.ready.then(() => {
    if (!disposed && reduced) draw();
  });

  if (reduced) draw();
  else syncLoop();

  return { retrieve, reset, frameMs, releaseIntro, dispose, configure };
}
