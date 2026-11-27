import { clamp } from "../core/clamp.js";
import { duration, ease } from "../core/motion.config.js";
import { prefersReducedMotion } from "../core/motion.js";
import { getLenis } from "../core/scroll.js";
import { svgElement } from "../core/svg.js";

const mobileQuery = window.matchMedia("(max-width: 719px)");

const componentFacts = [
  ["what", "What"],
  ["why", "Why"],
  ["tradeoff", "Trade-off"],
  ["metric", "Metric"],
];

function twoDigit(value) {
  return String(value).padStart(2, "0");
}

function stepLabel(index, total) {
  return `${twoDigit(index + 1)} / ${twoDigit(total)}`;
}

function appendComponentFacts(list, node) {
  componentFacts.forEach(([keyName, label]) => {
    if (!node[keyName]) return;
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = node[keyName];
    list.append(term, detail);
  });
}

function settleAt(amount) {
  const gsap = window.gsap;
  if (!gsap?.parseEase) return amount;
  return gsap.parseEase(ease.settle)(amount);
}

export function initSystems(systems) {
  const section = document.getElementById("systems");
  const workbench = section?.querySelector(".workbench");
  if (!section || !workbench || !systems?.length) return;

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const published = systems.find((system) => system.status === "published") || null;
  const switchList = workbench.querySelector(".system-switch");
  const systemColumn = workbench.querySelector(".system-column");
  const diagramColumn = workbench.querySelector(".diagram-column");
  const diagram = workbench.querySelector(".diagram");
  const svg = workbench.querySelector(".diagram-draw");
  const nodesRoot = workbench.querySelector(".diagram-nodes");
  const stepper = workbench.querySelector(".stepper");
  const status = workbench.querySelector(".system-status");
  const note = workbench.querySelector(".system-note");
  const summary = workbench.querySelector(".system-summary");
  const links = workbench.querySelector(".system-links");
  const connections = workbench.querySelector(".system-connections");
  const count = workbench.querySelector(".brief-count");
  const kind = workbench.querySelector(".brief-kind");
  const title = workbench.querySelector(".brief-title");
  const briefFields = workbench.querySelector(".brief-fields");
  const layers = workbench.querySelector(".layer-switch");
  const controls = workbench.querySelector(".workbench-controls");
  const traceButton = workbench.querySelector(".trace-request");
  const traceLive = workbench.querySelector(".systems-live");

  const nodeButtons = new Map();
  const outlinePaths = new Map();
  const edgePaths = new Map();
  const edgeLabels = new Map();
  const charSpans = new Map();
  const stampMarks = new Map();
  const stamped = new Set();
  let travelPaths = [];

  let current = null;
  let selectedId = null;
  let activeLayers = new Set();
  let mode = "story";
  let storyLive = false;
  let storyTween = null;
  let wipeTween = null;
  let traceTween = null;
  let briefKey = "";
  let traceDot = null;
  let layoutFrame = 0;
  let holdExplore = false;
  let linedSystem = null;

  systems.forEach((system) => {
    if (!document.getElementById(system.id)) {
      const anchor = document.createElement("span");
      anchor.id = system.id;
      anchor.className = "system-anchor";
      anchor.setAttribute("aria-hidden", "true");
      section.append(anchor);
    }
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.system = system.id;
    button.textContent = system.title;
    item.append(button);
    switchList.append(item);
  });

  function reduced() {
    return prefersReducedMotion();
  }

  function storyWanted() {
    return Boolean(published) && !mobileQuery.matches && !reduced() && !parseHash(location.hash) && Boolean(gsap && ScrollTrigger);
  }

  function parseHash(hash) {
    if (!hash || hash === "#") return null;
    let raw;
    try {
      raw = decodeURIComponent(hash.slice(1));
    } catch {
      return null;
    }
    const ids = new Set(systems.map((system) => system.id));
    if (raw.startsWith("systems/")) {
      const [, systemId, nodeId] = raw.split("/");
      if (!ids.has(systemId)) return null;
      return { systemId, nodeId: nodeId || null };
    }
    if (ids.has(raw)) return { systemId: raw, nodeId: null };
    return null;
  }

  function scrollToY(y, immediate) {
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(y, { immediate, force: true });
      return;
    }
    window.scrollTo({ top: y, behavior: immediate ? "auto" : "smooth" });
  }

  function nodeById(id) {
    return current?.nodes.find((node) => node.id === id) || null;
  }

  function layerOn(item) {
    if (!item?.layers?.length) return true;
    return item.layers.some((layer) => activeLayers.has(layer));
  }

  function visibleNodes() {
    return (current?.nodes || []).filter(layerOn);
  }

  function visibleEdges() {
    const ids = new Set(visibleNodes().map((node) => node.id));
    return (current?.edges || []).filter(
      (edge) => layerOn(edge) && ids.has(edge.from) && ids.has(edge.to),
    );
  }

  function labelFor(id) {
    return current?.nodes.find((node) => node.id === id)?.label || id;
  }

  function setMode(next) {
    mode = next;
    workbench.dataset.mode = next;
    const open = next === "explore";
    systemColumn.toggleAttribute("inert", !open);
    controls.toggleAttribute("inert", !open);
    traceButton.disabled = !open;
  }

  function hashFor(system, nodeId) {
    return `#systems/${system.id}/${nodeId}`;
  }

  function writeHash(system, nodeId) {
    const next = hashFor(system, nodeId);
    if (location.hash === next) return;
    history.pushState(null, "", next);
  }

  function fillBrief(node, index, total) {
    const key = `${current?.id || ""}:${node?.id || ""}:${index}:${total}`;
    if (key === briefKey) return;
    briefKey = key;
    count.textContent = node && total ? stepLabel(index, total) : "";
    kind.textContent = node?.kind || "";
    title.textContent = node?.label || "";
    briefFields.replaceChildren();
    if (!node) return;
    appendComponentFacts(briefFields, node);
  }

  function fieldList(node) {
    const list = document.createElement("dl");
    appendComponentFacts(list, node);
    return list;
  }

  function clearDraw() {
    svg.replaceChildren();
    nodesRoot.replaceChildren();
    stepper.replaceChildren();
    nodeButtons.clear();
    outlinePaths.clear();
    edgePaths.clear();
    edgeLabels.clear();
    charSpans.clear();
    stampMarks.clear();
    traceDot = null;
    travelPaths = [];
  }

  function makePath(className) {
    const path = svgElement("path");
    path.setAttribute("class", className);
    path.setAttribute("pathLength", "1");
    path.setAttribute("stroke-dasharray", "1");
    path.setAttribute("stroke-dashoffset", "1");
    return path;
  }

  function mount(system) {
    cancelTrace();
    clearDraw();
    current = system;
    const cols = Math.max(...system.nodes.map((node) => node.col)) + 1;
    const rows = Math.max(...system.nodes.map((node) => node.row)) + 1;
    nodesRoot.style.setProperty("--cols", String(cols));
    nodesRoot.style.setProperty("--rows", String(rows));
    diagram.setAttribute("aria-label", `${system.title} architecture`);
    stepper.setAttribute("aria-label", `${system.title} components`);
    const drawLine = mobileQuery.matches && !reduced() && gsap && linedSystem !== system.id;
    linedSystem = system.id;
    stepper.style.setProperty("--line", drawLine ? "0" : "1");

    const edgeGroup = svgElement("g");
    const outlineGroup = svgElement("g");
    const labelGroup = svgElement("g");
    const stampGroup = svgElement("g");
    const crumbGroup = svgElement("g");
    crumbGroup.setAttribute("class", "trace-crumbs");
    traceDot = svgElement("circle");
    traceDot.setAttribute("class", "trace-dot");
    traceDot.setAttribute("r", "3.5");
    traceDot.setAttribute("opacity", "0");

    system.nodes.forEach((node) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "node";
      button.dataset.id = node.id;
      button.style.gridColumn = String(node.col + 1);
      button.style.gridRow = String(node.row + 1);
      button.setAttribute("aria-label", `${node.label}, ${node.kind}`);
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-controls", "component-brief");
      const name = document.createElement("span");
      name.className = "node-name";
      name.setAttribute("aria-hidden", "true");
      const chars = [];
      for (const character of node.label) {
        const span = document.createElement("span");
        span.className = "node-char";
        span.textContent = character;
        span.style.opacity = "0";
        name.append(span);
        chars.push(span);
      }
      button.append(name);
      nodesRoot.append(button);
      nodeButtons.set(node.id, button);
      charSpans.set(node.id, chars);

      const outline = makePath("node-outline");
      outline.dataset.node = node.id;
      outlineGroup.append(outline);
      outlinePaths.set(node.id, outline);

      const mark = svgElement("rect");
      mark.setAttribute("class", "stamp-mark");
      mark.setAttribute("width", "6");
      mark.setAttribute("height", "6");
      mark.setAttribute("opacity", "0");
      stampGroup.append(mark);
      stampMarks.set(node.id, mark);
    });

    system.edges.forEach((edge, index) => {
      const path = makePath("edge-line");
      path.dataset.from = edge.from;
      path.dataset.to = edge.to;
      path.dataset.index = String(index);
      edgeGroup.append(path);
      edgePaths.set(index, path);
      if (!edge.label) return;
      const text = svgElement("text");
      text.setAttribute("class", "edge-label");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("opacity", "0");
      text.textContent = edge.label;
      labelGroup.append(text);
      edgeLabels.set(index, text);
    });

    svg.append(edgeGroup, outlineGroup, labelGroup, stampGroup, crumbGroup, traceDot);

    const shown = system.nodes.filter(layerOn);
    shown.forEach((node, index) => {
      const item = document.createElement("li");
      item.className = "step";
      item.dataset.step = node.id;
      if (stamped.has(node.id)) item.classList.add("is-stamped");
      const mark = document.createElement("span");
      mark.className = "step-mark";
      mark.setAttribute("aria-hidden", "true");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "step-toggle";
      const panelId = `step-panel-${system.id}-${node.id}`;
      button.id = `step-trigger-${system.id}-${node.id}`;
      button.setAttribute("aria-controls", panelId);
      const open = node.id === selectedId;
      button.setAttribute("aria-expanded", open ? "true" : "false");
      const indexText = document.createElement("span");
      indexText.className = "step-index";
      indexText.textContent = twoDigit(index + 1);
      const name = document.createElement("span");
      name.className = "step-name";
      name.textContent = node.label;
      button.append(indexText, name);
      const panel = document.createElement("div");
      panel.className = "step-panel";
      panel.id = panelId;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-labelledby", button.id);
      panel.hidden = !open;
      if (open) item.classList.add("is-open");
      const kindLabel = document.createElement("p");
      kindLabel.className = "label";
      kindLabel.textContent = node.kind;
      panel.append(kindLabel, fieldList(node));
      item.append(mark, button, panel);
      stepper.append(item);
    });

    if (drawLine) {
      requestAnimationFrame(() => {
        gsap.to(stepper, { "--line": 1, duration: duration.stepper, ease: ease.settle });
      });
    }

    status.textContent = system.status;
    if (system.note) {
      note.hidden = false;
      note.textContent = system.note;
    } else {
      note.hidden = true;
      note.textContent = "";
    }
    summary.textContent = system.summary;
    links.replaceChildren();
    system.links.forEach((link) => {
      const item = document.createElement("li");
      const anchor = document.createElement("a");
      anchor.href = link.href;
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.dataset.cursor = "Open";
      anchor.textContent = link.label;
      item.append(anchor);
      links.append(item);
    });
    connections.replaceChildren();
    connections.setAttribute("aria-label", "Connections");
    system.edges.forEach((edge) => {
      const item = document.createElement("li");
      const from = labelFor(edge.from);
      const to = labelFor(edge.to);
      item.textContent = edge.label ? `${from} to ${to} (${edge.label})` : `${from} to ${to}`;
      connections.append(item);
    });
    switchList.querySelectorAll("button").forEach((button) => {
      const on = button.dataset.system === system.id;
      if (on) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    layers.replaceChildren();
    system.layers.forEach((layer) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.layer = layer;
      button.textContent = layer;
      button.setAttribute("aria-pressed", activeLayers.has(layer) ? "true" : "false");
      layers.append(button);
    });
    applyVisibility();
  }

  function applyVisibility() {
    if (!current) return;
    current.nodes.forEach((node) => {
      const button = nodeButtons.get(node.id);
      if (!button) return;
      button.hidden = !layerOn(node);
    });
    const shown = new Set(visibleNodes().map((node) => node.id));
    edgePaths.forEach((path, index) => {
      const edge = current.edges[index];
      const show = layerOn(edge) && shown.has(edge.from) && shown.has(edge.to);
      path.style.display = show ? "" : "none";
      const label = edgeLabels.get(index);
      if (label) label.style.display = show ? "" : "none";
    });
  }

  function boxOf(button) {
    const bounds = svg.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    return {
      x: rect.left - bounds.left,
      y: rect.top - bounds.top,
      w: rect.width,
      h: rect.height,
      cx: rect.left - bounds.left + rect.width / 2,
      cy: rect.top - bounds.top + rect.height / 2,
    };
  }

  function rectPath(box) {
    const x = box.x + 0.5;
    const y = box.y + 0.5;
    const w = Math.max(0, box.w - 1);
    const h = Math.max(0, box.h - 1);
    return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  }

  function routeEdge(a, b, lane) {
    const shift = lane * 14;
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const sx = dx >= 0 ? a.x + a.w : a.x;
      const ex = dx >= 0 ? b.x : b.x + b.w;
      const sy = a.cy + shift;
      const ey = b.cy + shift;
      if (Math.abs(sy - ey) < 1.5) return `M${sx} ${sy}H${ex}`;
      const mid = sx + (ex - sx) * 0.5;
      return `M${sx} ${sy}H${mid}V${ey}H${ex}`;
    }
    const sy = dy >= 0 ? a.y + a.h : a.y;
    const ey = dy >= 0 ? b.y : b.y + b.h;
    const sx = a.cx + shift;
    const ex = b.cx + shift;
    if (Math.abs(sx - ex) < 1.5) return `M${sx} ${sy}V${ey}`;
    const mid = sy + (ey - sy) * 0.5;
    return `M${sx} ${sy}V${mid}H${ex}V${ey}`;
  }

  function laneFor(edges) {
    const pairs = new Map();
    edges.forEach((edge) => {
      const key = [edge.from, edge.to].sort().join("~");
      if (!pairs.has(key)) pairs.set(key, []);
      pairs.get(key).push(edge);
    });
    const lanes = new Map();
    pairs.forEach((list) => {
      if (list.length < 2) return;
      list.forEach((edge, index) => lanes.set(edge, index - (list.length - 1) / 2));
    });
    const byTarget = new Map();
    edges.forEach((edge) => {
      if (lanes.has(edge)) return;
      if (!byTarget.has(edge.to)) byTarget.set(edge.to, []);
      byTarget.get(edge.to).push(edge);
    });
    byTarget.forEach((list) => {
      list.forEach((edge, index) => lanes.set(edge, index - (list.length - 1) / 2));
    });
    return lanes;
  }

  function layoutGeometry() {
    if (!svg || mobileQuery.matches) return;
    const bounds = svg.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return;
    svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
    const boxes = new Map();
    nodeButtons.forEach((button, id) => {
      if (button.hidden) return;
      boxes.set(id, boxOf(button));
    });
    outlinePaths.forEach((path, id) => {
      const box = boxes.get(id);
      path.setAttribute("d", box ? rectPath(box) : "");
      const mark = stampMarks.get(id);
      if (!mark || !box) return;
      mark.setAttribute("x", String(box.x + box.w - 14));
      mark.setAttribute("y", String(box.y + 7));
      mark.setAttribute("opacity", stamped.has(id) ? "1" : "0");
    });
    const edges = visibleEdges();
    const lanes = laneFor(edges);
    edgePaths.forEach((path, index) => {
      const edge = current.edges[index];
      const from = boxes.get(edge.from);
      const to = boxes.get(edge.to);
      if (!from || !to || path.style.display === "none") {
        path.setAttribute("d", "");
        return;
      }
      path.setAttribute("d", routeEdge(from, to, lanes.get(edge) || 0));
      const label = edgeLabels.get(index);
      if (!label || !path.getTotalLength) return;
      const length = path.getTotalLength();
      if (!length) return;
      const point = path.getPointAtLength(length / 2);
      label.setAttribute("x", String(point.x));
      label.setAttribute("y", String(point.y - 8));
    });
  }

  function paintOffset(path, progress) {
    path.style.strokeDashoffset = String(1 - clamp(progress, 0, 1));
  }

  function paintChars(id, progress) {
    const chars = charSpans.get(id) || [];
    const shown = Math.ceil(clamp(progress, 0, 1) * chars.length);
    chars.forEach((span, index) => {
      span.style.opacity = index < shown ? "1" : "0";
    });
  }

  function storyPosition(progress, steps) {
    if (progress >= 1) return { active: steps - 1, local: 1 };
    const scaled = progress * steps;
    const active = Math.floor(scaled);
    return { active, local: scaled - active };
  }

  function sourceSettle(index, active, local) {
    if (index >= active) return 0;
    if (index < active - 1) return 1;
    return settleAt(clamp(local / 0.22, 0, 1));
  }

  function settledLook(index, active, local) {
    if (index === active) return { hot: true, opacity: 1 };
    if (index === active - 1 && sourceSettle(index, active, local) < 1) {
      return { hot: true, opacity: 1 - sourceSettle(index, active, local) * 0.62 };
    }
    if (index < active) return { hot: false, opacity: 0.38 };
    return { hot: false, opacity: 1 };
  }

  function applyStory(progress) {
    if (!published || !current || current.id !== published.id) return;
    const nodes = published.nodes;
    const steps = nodes.length;
    const { active, local } = storyPosition(progress, steps);
    const activeNode = nodes[active];
    selectedId = activeNode.id;
    nodes.forEach((node, index) => {
      const button = nodeButtons.get(node.id);
      const outline = outlinePaths.get(node.id);
      if (!button || !outline) return;
      const pending = index > active;
      button.setAttribute("aria-hidden", pending ? "true" : "false");
      button.setAttribute("aria-disabled", "true");
      button.tabIndex = -1;
      button.setAttribute("aria-pressed", "false");
      button.classList.toggle("is-active", index === active);
      button.classList.toggle("is-settled", index < active);
      const drawn = index < active ? 1 : index > active ? 0 : clamp(local / 0.34, 0, 1);
      const typed = index < active ? 1 : index > active ? 0 : clamp((local - 0.34) / 0.34, 0, 1);
      paintOffset(outline, drawn);
      paintChars(node.id, typed);
      const look = settledLook(index, active, local);
      outline.style.stroke = look.hot ? "var(--acid)" : "#fff";
      outline.style.opacity = String(look.opacity);
      button.style.color = look.hot ? "var(--acid)" : `rgb(255 255 255 / ${Math.round(look.opacity * 72)}%)`;
    });
    published.edges.forEach((edge, index) => {
      const path = edgePaths.get(index);
      if (!path) return;
      const source = nodes.findIndex((node) => node.id === edge.from);
      const drawn = source < active ? 1 : source > active ? 0 : clamp((local - 0.68) / 0.32, 0, 1);
      const look = settledLook(source, active, local);
      paintOffset(path, drawn);
      path.style.stroke = look.hot ? "var(--acid)" : "#fff";
      path.style.opacity = String(source === active ? 1 : look.opacity);
      const label = edgeLabels.get(index);
      if (label) label.setAttribute("opacity", drawn > 0.92 ? "0.75" : "0");
    });
    const shown = visibleNodes();
    fillBrief(activeNode, shown.findIndex((node) => node.id === activeNode.id), shown.length);
  }

  function showDrawn() {
    if (!current) return;
    const shown = visibleNodes();
    const selected = shown.some((node) => node.id === selectedId) ? selectedId : shown[0]?.id || null;
    selectedId = selected;
    const hotEdges = new Set();
    visibleEdges().forEach((edge) => {
      if (edge.from === selected || edge.to === selected) hotEdges.add(edge);
    });
    nodeButtons.forEach((button, id) => {
      const on = id === selected;
      const chars = charSpans.get(id) || [];
      chars.forEach((span) => {
        span.style.opacity = button.hidden ? "0" : "1";
      });
      button.classList.toggle("is-active", on);
      button.classList.toggle("is-settled", !on && !button.hidden);
      button.style.color = on ? "var(--acid)" : "rgb(255 255 255 / 62%)";
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.setAttribute("aria-disabled", mode === "explore" ? "false" : "true");
      button.removeAttribute("aria-hidden");
      button.tabIndex = mode === "explore" && on ? 0 : -1;
      const outline = outlinePaths.get(id);
      if (!outline) return;
      paintOffset(outline, button.hidden ? 0 : 1);
      outline.style.stroke = on ? "var(--acid)" : "#fff";
      outline.style.opacity = on ? "1" : "0.38";
    });
    edgePaths.forEach((path, index) => {
      const edge = current.edges[index];
      const hidden = path.style.display === "none";
      const hot = hotEdges.has(edge) && !hidden;
      paintOffset(path, hidden ? 0 : 1);
      path.style.stroke = hot ? "var(--acid)" : "#fff";
      path.style.opacity = hidden ? "0" : hot ? "1" : "0.38";
      const label = edgeLabels.get(index);
      if (label) label.setAttribute("opacity", hidden ? "0" : "0.75");
    });
    const node = nodeById(selected);
    const index = shown.findIndex((item) => item.id === selected);
    fillBrief(node, index, shown.length);
    stampMarks.forEach((mark, id) => {
      mark.setAttribute("opacity", stamped.has(id) ? "1" : "0");
    });
  }

  function syncView() {
    layoutGeometry();
    if (mode === "story" && storyLive) {
      applyStory(storyTween?.scrollTrigger?.progress || 0);
      return;
    }
    if (mode === "explore") showDrawn();
  }

  function scheduleLayout() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(syncView);
  }

  function selectSystem(system, nodeId, { wipe = false, paint = "explore" } = {}) {
    if (!system) return;
    activeLayers = new Set(system.layers);
    const match = system.nodes.some((node) => node.id === nodeId);
    selectedId = match ? nodeId : system.nodes[0]?.id || null;
    briefKey = "";
    const draw = () => {
      mount(system);
      layoutGeometry();
      if (paint === "story" && mode === "story") applyStory(storyTween?.scrollTrigger?.progress || 0);
      else showDrawn();
    };
    wipeTween?.kill();
    const canWipe = wipe && !reduced() && gsap && current && current.id !== system.id;
    if (!canWipe) {
      diagramColumn.style.clipPath = "none";
      draw();
      return;
    }
    diagramColumn.style.clipPath = "inset(0 100% 0 0)";
    draw();
    wipeTween = gsap.to(diagramColumn, {
      clipPath: "inset(0 0% 0 0)",
      duration: duration.systemWipe,
      ease: ease.settle,
      onComplete: () => {
        diagramColumn.style.clipPath = "none";
      },
    });
  }

  function choose(id, { hash = false, focus = false } = {}) {
    if (mode !== "explore" || !nodeById(id)) return;
    selectedId = id;
    showDrawn();
    if (hash) writeHash(current, id);
    if (focus) nodeButtons.get(id)?.focus({ preventScroll: true });
  }

  function nearestNode(key) {
    const nodes = visibleNodes();
    const origin = nodes.find((node) => node.id === selectedId) || nodes[0];
    if (!origin) return null;
    if (key === "Home") return nodes[0];
    if (key === "End") return nodes[nodes.length - 1];
    const pool = nodes.filter((node) => {
      if (node.id === origin.id) return false;
      if (key === "ArrowRight") return node.col > origin.col;
      if (key === "ArrowLeft") return node.col < origin.col;
      if (key === "ArrowDown") return node.row > origin.row;
      if (key === "ArrowUp") return node.row < origin.row;
      return false;
    });
    if (!pool.length) return null;
    const ranked = pool.slice();
    ranked.sort((a, b) => {
      const score = (node) => {
        if (key === "ArrowRight") return Math.abs(node.row - origin.row) * 8 + (node.col - origin.col);
        if (key === "ArrowLeft") return Math.abs(node.row - origin.row) * 8 + (origin.col - node.col);
        if (key === "ArrowDown") return Math.abs(node.col - origin.col) * 8 + (node.row - origin.row);
        return Math.abs(node.col - origin.col) * 8 + (origin.row - node.row);
      };
      return score(a) - score(b);
    });
    return ranked[0] || null;
  }

  function unlockExplore() {
    storyLive = false;
    setMode("explore");
    showDrawn();
  }

  function resumeStory(progress) {
    storyLive = true;
    setMode("story");
    if (current?.id !== published.id) {
      selectSystem(published, published.nodes[0].id, { wipe: false, paint: "story" });
    }
    applyStory(progress);
  }

  function createStory() {
    if (!gsap || !ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    storyLive = true;
    setMode("story");
    storyTween = gsap.to(
      { progress: 0 },
      {
        progress: 1,
        ease: ease.none,
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          pin: false,
          scrub: true,
          onEnter(self) {
            if (holdExplore) return;
            storyLive = true;
            setMode("story");
            applyStory(self.progress);
          },
          onEnterBack(self) {
            if (holdExplore) return;
            resumeStory(self.progress);
          },
          onLeave() {
            if (holdExplore) return;
            unlockExplore();
          },
          onLeaveBack() {
            if (holdExplore) return;
            storyLive = true;
            setMode("story");
            applyStory(0);
          },
          onUpdate(self) {
            if (holdExplore || !storyLive) return;
            applyStory(self.progress);
          },
        },
      },
    );
  }

  function stopStoryPin() {
    storyLive = false;
    if (!storyTween) return;
    storyTween.scrollTrigger?.kill(true);
    storyTween.kill();
    storyTween = null;
    ScrollTrigger?.refresh();
  }

  function cancelTrace() {
    traceTween?.kill();
    traceTween = null;
    travelPaths.forEach((path) => path.remove());
    travelPaths = [];
    svg.querySelectorAll(".trace-crumb").forEach((crumb) => crumb.remove());
    if (traceDot) traceDot.setAttribute("opacity", "0");
    traceButton.disabled = mode !== "explore";
    diagram.removeAttribute("aria-busy");
  }

  function dropCrumb(x, y) {
    const crumb = svgElement("circle");
    crumb.setAttribute("class", "trace-crumb");
    crumb.setAttribute("cx", String(x));
    crumb.setAttribute("cy", String(y));
    crumb.setAttribute("r", "2.25");
    svg.querySelector(".trace-crumbs")?.append(crumb);
    gsap?.to(crumb, {
      opacity: 0,
      duration: duration.crumb,
      ease: ease.settle,
      onComplete: () => crumb.remove(),
    });
  }

  function moveDot(x, y) {
    traceDot.setAttribute("cx", String(x));
    traceDot.setAttribute("cy", String(y));
    traceDot.setAttribute("opacity", "1");
  }

  function placeDot(id) {
    const button = nodeButtons.get(id);
    if (!button || button.hidden) return;
    const box = boxOf(button);
    moveDot(box.cx, box.cy);
  }

  function travelPath(fromId, toId) {
    for (const path of edgePaths.values()) {
      if (path.style.display === "none" || !path.getAttribute("d")) continue;
      if (path.dataset.from === fromId && path.dataset.to === toId) return { path, reverse: false };
      if (path.dataset.from === toId && path.dataset.to === fromId) return { path, reverse: true };
    }
    const from = nodeButtons.get(fromId);
    const to = nodeButtons.get(toId);
    if (!from || !to) return null;
    const path = svgElement("path");
    path.setAttribute("d", routeEdge(boxOf(from), boxOf(to), 0));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "none");
    svg.append(path);
    travelPaths.push(path);
    return { path, reverse: false };
  }

  function stamp(id) {
    stamped.add(id);
    nodeButtons.get(id)?.classList.add("is-stamped");
    stepper.querySelector(`[data-step="${id}"]`)?.classList.add("is-stamped");
    stampMarks.get(id)?.setAttribute("opacity", "1");
    const node = nodeById(id);
    if (node) traceLive.textContent = `Tracing ${node.label}`;
  }

  function traceRequest() {
    if (mode !== "explore" || !current) return;
    cancelTrace();
    stamped.clear();
    nodeButtons.forEach((button) => button.classList.remove("is-stamped"));
    stepper.querySelectorAll(".step").forEach((step) => step.classList.remove("is-stamped"));
    stampMarks.forEach((mark) => mark.setAttribute("opacity", "0"));
    const ids = visibleNodes().map((node) => node.id);
    if (!ids.length) return;
    diagram.setAttribute("aria-busy", "true");
    traceButton.disabled = true;
    if (reduced() || !gsap) {
      ids.forEach(stamp);
      traceButton.disabled = false;
      diagram.removeAttribute("aria-busy");
      return;
    }
    const timeline = gsap.timeline({
      onComplete: () => {
        traceButton.disabled = mode !== "explore";
        diagram.removeAttribute("aria-busy");
        if (traceDot) gsap.to(traceDot, { opacity: 0, duration: duration.traceFade, ease: ease.settle });
      },
    });
    traceTween = timeline;
    if (mobileQuery.matches) {
      ids.forEach((id, index) => timeline.call(() => stamp(id), null, index * duration.traceStamp));
      return;
    }
    ids.forEach((id, index) => {
      if (index === 0) {
        timeline.call(() => {
          placeDot(id);
          stamp(id);
        });
        return;
      }
      const state = { p: 0, crumb: 0 };
      timeline.to(state, {
        p: 1,
        duration: duration.trace,
        ease: ease.none,
        onStart: () => {
          state.travel = travelPath(ids[index - 1], id);
          state.crumb = 0;
        },
        onUpdate: () => {
          const travel = state.travel;
          if (!travel?.path?.getTotalLength) {
            placeDot(id);
            return;
          }
          const length = travel.path.getTotalLength();
          if (!length) return;
          const distance = (travel.reverse ? 1 - state.p : state.p) * length;
          const point = travel.path.getPointAtLength(distance);
          moveDot(point.x, point.y);
          if (state.p - state.crumb >= 0.14) {
            state.crumb = state.p;
            dropCrumb(point.x, point.y);
          }
        },
        onComplete: () => stamp(id),
      });
    });
  }

  function alignExplore(immediate) {
    const trigger = storyTween?.scrollTrigger;
    if (trigger) {
      const above = window.scrollY + 2 < trigger.start;
      scrollToY(trigger.end + 1, immediate || above);
      return;
    }
    scrollToY(section.offsetTop, immediate);
  }

  function openDeep(parsed, immediate) {
    const system = systems.find((item) => item.id === parsed.systemId);
    if (!system) return;
    holdExplore = true;
    storyLive = false;
    setMode("explore");
    const node = system.nodes.find((item) => item.id === parsed.nodeId) || system.nodes[0];
    selectSystem(system, node?.id, { wipe: false, paint: "explore" });
    alignExplore(immediate);
    const focusTarget = nodeButtons.get(node?.id) || stepper.querySelector(`[data-step="${node?.id}"] .step-toggle`);
    focusTarget?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.ScrollTrigger?.update();
        const trigger = storyTween?.scrollTrigger;
        const inside = Boolean(trigger && trigger.isActive && trigger.progress < 0.999);
        holdExplore = false;
        if (inside) {
          storyLive = true;
          setMode("story");
          applyStory(trigger.progress);
          return;
        }
        storyLive = false;
        setMode("explore");
        showDrawn();
        focusTarget?.focus({ preventScroll: true });
      });
    });
  }

  switchList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-system]");
    if (!button || mode !== "explore") return;
    const system = systems.find((item) => item.id === button.dataset.system);
    if (!system || system.id === current?.id) return;
    const node = system.nodes[0];
    writeHash(system, node.id);
    selectSystem(system, node.id, { wipe: true, paint: "explore" });
  });

  layers.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-layer]");
    if (!button || mode !== "explore" || !current) return;
    const layer = button.dataset.layer;
    if (activeLayers.has(layer)) activeLayers.delete(layer);
    else activeLayers.add(layer);
    button.setAttribute("aria-pressed", activeLayers.has(layer) ? "true" : "false");
    const shown = visibleNodes();
    if (!shown.some((node) => node.id === selectedId)) selectedId = shown[0]?.id || null;
    briefKey = "";
    mount(current);
    layoutGeometry();
    showDrawn();
  });

  nodesRoot.addEventListener("click", (event) => {
    const button = event.target.closest(".node");
    if (!button) return;
    choose(button.dataset.id, { hash: true });
  });

  diagram.addEventListener("keydown", (event) => {
    if (mode !== "explore") return;
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const next = nearestNode(event.key);
    if (!next) return;
    event.preventDefault();
    choose(next.id, { hash: true, focus: true });
  });

  stepper.addEventListener("click", (event) => {
    const button = event.target.closest(".step-toggle");
    if (!button) return;
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", expanded ? "false" : "true");
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    if (panel) panel.hidden = expanded;
    button.closest(".step")?.classList.toggle("is-open", !expanded);
    const step = button.closest(".step");
    if (!expanded && step?.dataset.step) choose(step.dataset.step, { hash: true });
  });

  stepper.addEventListener("keydown", (event) => {
    const buttons = [...stepper.querySelectorAll(".step-toggle")];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowDown") next = Math.min(buttons.length - 1, index + 1);
    else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next].focus();
  });

  traceButton.addEventListener("click", traceRequest);

  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.("a[href^='#']");
      if (!link) return;
      const href = link.getAttribute("href");
      const parsed = parseHash(href || "");
      if (!parsed) return;
      event.preventDefault();
      event.stopPropagation();
      if (location.hash !== href) history.pushState(null, "", href);
      openDeep(parsed, false);
    },
    true,
  );

  window.addEventListener("popstate", () => {
    const parsed = parseHash(location.hash);
    if (!parsed) return;
    openDeep(parsed, true);
  });

  mobileQuery.addEventListener("change", () => {
    if (mobileQuery.matches) {
      stopStoryPin();
      setMode("explore");
    }
    briefKey = "";
    if (current) {
      mount(current);
      scheduleLayout();
    }
  });

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  motion.addEventListener("change", () => {
    if (motion.matches) {
      stopStoryPin();
      setMode("explore");
      showDrawn();
    }
  });

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => scheduleLayout());
    observer.observe(diagram);
  }
  document.fonts?.ready?.then(() => scheduleLayout());

  const opening = parseHash(location.hash);
  if (opening || !storyWanted()) {
    setMode("explore");
    const target = systems.find((item) => item.id === opening?.systemId) || published || systems[0];
    const node = target.nodes.find((item) => item.id === opening?.nodeId) || target.nodes[0];
    selectSystem(target, node?.id, { paint: "explore" });
    if (opening) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          alignExplore(true);
          const focusTarget = nodeButtons.get(node?.id) || stepper.querySelector(`[data-step="${node?.id}"] .step-toggle`);
          focusTarget?.focus({ preventScroll: true });
        });
      });
    }
  } else {
    setMode("story");
    selectSystem(published, published.nodes[0].id, { paint: "story" });
    createStory();
    applyStory(0);
  }
}
