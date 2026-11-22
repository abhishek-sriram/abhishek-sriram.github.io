import { systems } from '../data/systems.js';

const COL_W = 148;
const ROW_H = 112;
const NODE_W = 112;
const NODE_H = 52;
const PAD_X = 24;
const PAD_Y = 28;
const CORNER = 10;
const MOBILE_MQ = '(max-width: 719px)';
const HINT_KEY = 'systems-hint-dismissed';
const ANNOTATION_FADE_MS = 180;
const LAYER_LABELS = {
  flow: 'Flow',
  failure: 'Failure',
  privacy: 'Privacy',
  metrics: 'Metrics',
};

const state = {
  systemId: null,
  nodeId: null,
  layers: new Set(['flow']),
  hoverId: null,
  tracing: false,
  traceTimer: null,
  annotationTimer: null,
  reducedMotion: false,
  hintDismissed: false,
  privacyWasOn: false,
};

let els = {};
let mqMobile = null;
let mqReduce = null;
let trailLayer = null;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isMobile() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function getSystem(id) {
  return systems.find((s) => s.id === id) || systems[0];
}

function getNode(system, id) {
  return system.nodes.find((n) => n.id === id) || null;
}

function nodeCenter(node) {
  return {
    x: PAD_X + node.col * COL_W + NODE_W / 2,
    y: PAD_Y + node.row * ROW_H + NODE_H / 2,
  };
}

function nodeOrigin(node) {
  return {
    x: PAD_X + node.col * COL_W,
    y: PAD_Y + node.row * ROW_H,
  };
}

function viewBoxFor(system) {
  const maxCol = Math.max(...system.nodes.map((n) => n.col), 0);
  const maxRow = Math.max(...system.nodes.map((n) => n.row), 0);
  const w = PAD_X * 2 + (maxCol + 1) * COL_W;
  const h = PAD_Y * 2 + (maxRow + 1) * ROW_H;
  return { w, h };
}

function usedLayers(system) {
  const set = new Set(['flow']);
  system.nodes.forEach((n) => (n.layers || []).forEach((l) => set.add(l)));
  system.edges.forEach((e) => (e.layers || []).forEach((l) => set.add(l)));
  return [...set].filter((l) => l in LAYER_LABELS);
}

function adjacency(system) {
  const map = new Map();
  system.nodes.forEach((n) => map.set(n.id, new Set()));
  system.edges.forEach((e) => {
    map.get(e.from)?.add(e.to);
    map.get(e.to)?.add(e.from);
  });
  return map;
}

function connectedIds(system, nodeId) {
  const ids = new Set([nodeId]);
  system.edges.forEach((e) => {
    if (e.from === nodeId) ids.add(e.to);
    if (e.to === nodeId) ids.add(e.from);
  });
  return ids;
}

function upstreamDownstream(system, nodeId) {
  const up = new Set();
  const down = new Set();
  system.edges.forEach((e) => {
    if (e.to === nodeId) up.add(e.from);
    if (e.from === nodeId) down.add(e.to);
  });
  return { up, down };
}

function edgeKey(from, to) {
  return `${from}->${to}`;
}

function edgePath(system, edge) {
  const a = getNode(system, edge.from);
  const b = getNode(system, edge.to);
  if (!a || !b) return '';
  const ca = nodeCenter(a);
  const cb = nodeCenter(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const reverse = system.edges.some(
    (e) => e.from === edge.to && e.to === edge.from
  );
  const lane = reverse && edge.from > edge.to ? -10 : reverse ? 10 : 0;

  const halfW = NODE_W / 2;
  const halfH = NODE_H / 2;

  let x1;
  let y1;
  let x2;
  let y2;

  if (Math.abs(dx) >= Math.abs(dy)) {
    x1 = ca.x + Math.sign(dx || 1) * halfW;
    y1 = ca.y + lane;
    x2 = cb.x - Math.sign(dx || 1) * halfW;
    y2 = cb.y + lane;
    if (Math.abs(dy) > 4) {
      const midX = x1 + (x2 - x1) * 0.5;
      return `M${x1} ${y1} L${midX} ${y1} L${midX} ${y2} L${x2} ${y2}`;
    }
    return `M${x1} ${y1} L${x2} ${y2}`;
  }

  x1 = ca.x + lane;
  y1 = ca.y + Math.sign(dy || 1) * halfH;
  x2 = cb.x + lane;
  y2 = cb.y - Math.sign(dy || 1) * halfH;
  if (Math.abs(dx) > 4) {
    const midY = y1 + (y2 - y1) * 0.5;
    return `M${x1} ${y1} L${x1} ${midY} L${x2} ${midY} L${x2} ${y2}`;
  }
  return `M${x1} ${y1} L${x2} ${y2}`;
}

function flowOrder(system) {
  const flowEdges = system.edges.filter((e) =>
    (e.layers || ['flow']).includes('flow')
  );
  const outs = new Map(system.nodes.map((n) => [n.id, []]));
  flowEdges.forEach((e) => outs.get(e.from)?.push(e));

  const starts = system.nodes
    .filter((n) => n.kind === 'input')
    .sort((a, b) => a.col - b.col || a.row - b.row)
    .map((n) => n.id);

  if (!starts.length) {
    starts.push(
      [...system.nodes].sort((a, b) => a.col - b.col || a.row - b.row)[0]?.id
    );
  }

  const order = [];
  const edges = [];
  const seenNode = new Set();
  const seenEdge = new Set();
  const queue = starts.filter(Boolean);

  while (queue.length) {
    const id = queue.shift();
    if (!seenNode.has(id)) {
      seenNode.add(id);
      order.push(id);
    }
    const next = outs.get(id) || [];
    next.forEach((e) => {
      const key = edgeKey(e.from, e.to);
      if (seenEdge.has(key)) return;
      seenEdge.add(key);
      edges.push(e);
      if (!seenNode.has(e.to)) queue.push(e.to);
    });
  }

  system.nodes.forEach((n) => {
    if (!seenNode.has(n.id)) order.push(n.id);
  });
  flowEdges.forEach((e) => {
    const key = edgeKey(e.from, e.to);
    if (!seenEdge.has(key)) edges.push(e);
  });

  return { nodes: order, edges };
}

function edgesDrawOrder(system) {
  const { edges } = flowOrder(system);
  const seen = new Set(edges.map((e) => edgeKey(e.from, e.to)));
  const rest = system.edges.filter((e) => !seen.has(edgeKey(e.from, e.to)));
  return [...edges, ...rest];
}

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw.startsWith('systems')) return null;
  const parts = raw.split('/').filter(Boolean);
  return {
    systemId: parts[1] || null,
    nodeId: parts[2] || null,
  };
}

function writeHash(systemId, nodeId) {
  const next = nodeId ? `#systems/${systemId}/${nodeId}` : `#systems/${systemId}`;
  if (window.location.hash === next) return;
  history.replaceState(null, '', next);
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v != null) el.setAttribute(k, String(v));
  });
  return el;
}

function readHintDismissed() {
  try {
    return sessionStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHintDismissed() {
  try {
    sessionStorage.setItem(HINT_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

function ensureChrome() {
  if (!els.hint) {
    const hint = document.createElement('p');
    hint.className = 'systems-hint';
    hint.id = 'systemsHint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'Click a component';
    els.figure?.appendChild(hint);
    els.hint = hint;
  }

  if (!els.stepCounter && els.traceBtn) {
    const wrap = document.createElement('div');
    wrap.className = 'systems-trace-meta';
    const counter = document.createElement('p');
    counter.className = 'systems-step-counter';
    counter.id = 'systemsStepCounter';
    counter.setAttribute('aria-hidden', 'true');
    counter.hidden = true;
    els.traceBtn.replaceWith(wrap);
    wrap.appendChild(els.traceBtn);
    wrap.appendChild(counter);
    els.stepCounter = counter;
    els.traceMeta = wrap;
  }

  if (!els.tabIndicator && els.tabs) {
    const indicator = document.createElement('span');
    indicator.className = 'systems-tab-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    els.tabs.appendChild(indicator);
    els.tabIndicator = indicator;
  }
}

function updateHint() {
  if (!els.hint) return;
  const show = !state.hintDismissed && !state.nodeId && !isMobile();
  els.hint.hidden = !show;
}

function dismissHint() {
  if (state.hintDismissed) return;
  state.hintDismissed = true;
  writeHintDismissed();
  updateHint();
}

function updateStepCounter(step, total) {
  if (!els.stepCounter) return;
  if (step == null || total == null) {
    els.stepCounter.hidden = true;
    els.stepCounter.textContent = '';
    return;
  }
  els.stepCounter.hidden = false;
  els.stepCounter.textContent = `Step ${step} of ${total}`;
}

function updateTabIndicator() {
  const indicator = els.tabIndicator;
  const tab = els.tabs?.querySelector('.systems-tab[aria-selected="true"]');
  if (!indicator || !tab) {
    if (indicator) {
      indicator.style.width = '0px';
    }
    return;
  }
  indicator.style.width = `${tab.offsetWidth}px`;
  indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
}

function clearTrail() {
  trailLayer?.querySelectorAll('.systems-trail-ghost').forEach((n) => n.remove());
}

function clearTrace() {
  if (state.traceTimer) {
    clearTimeout(state.traceTimer);
    state.traceTimer = null;
  }
  state.tracing = false;
  const traveler = els.svg?.querySelector('.systems-traveler');
  if (traveler) traveler.setAttribute('visibility', 'hidden');
  els.svg?.querySelectorAll('.is-trace').forEach((n) => n.classList.remove('is-trace'));
  els.svg?.querySelectorAll('.fx-stamp.is-stamping').forEach((n) => {
    n.classList.remove('is-stamping');
  });
  clearTrail();
  updateStepCounter(null);
  if (els.traceBtn) {
    els.traceBtn.setAttribute('aria-pressed', 'false');
    els.traceBtn.textContent = 'Trace a request';
  }
}

function renderTabs() {
  const list = els.tabs;
  const indicator = els.tabIndicator;
  list.innerHTML = '';
  if (indicator) list.appendChild(indicator);

  systems.forEach((system, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'systems-tab';
    btn.setAttribute('role', 'tab');
    btn.id = `systems-tab-${system.id}`;
    btn.dataset.systemId = system.id;
    btn.setAttribute('aria-selected', system.id === state.systemId ? 'true' : 'false');
    btn.setAttribute('tabindex', system.id === state.systemId ? '0' : '-1');
    btn.setAttribute('aria-controls', 'systemsCanvas');

    const label = document.createElement('span');
    label.className = 'systems-tab-label';
    label.textContent = system.title;
    btn.appendChild(label);

    const status = document.createElement('span');
    status.className = 'tag systems-tab-status';
    status.textContent = system.status;
    btn.appendChild(status);

    btn.addEventListener('click', () => selectSystem(system.id));
    btn.addEventListener('keydown', (e) => onTabKey(e, i));
    list.appendChild(btn);
  });

  requestAnimationFrame(() => updateTabIndicator());
}

function onTabKey(e, index) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  e.preventDefault();
  let next = index;
  if (e.key === 'ArrowRight') next = (index + 1) % systems.length;
  if (e.key === 'ArrowLeft') next = (index - 1 + systems.length) % systems.length;
  if (e.key === 'Home') next = 0;
  if (e.key === 'End') next = systems.length - 1;
  const id = systems[next].id;
  selectSystem(id);
  const tab = els.tabs.querySelector(`[data-system-id="${id}"]`);
  tab?.focus();
}

function renderMeta(system) {
  const meta = els.meta;
  meta.hidden = false;
  meta.innerHTML = '';

  if (system.note) {
    const note = document.createElement('p');
    note.className = 'systems-note';
    const badge = document.createElement('span');
    badge.className = 'tag';
    badge.textContent = 'note';
    note.appendChild(badge);
    note.appendChild(document.createTextNode(` ${system.note}`));
    meta.appendChild(note);
  }

  const summary = document.createElement('p');
  summary.className = 'systems-summary';
  summary.textContent = system.summary;
  meta.appendChild(summary);

  if (system.links?.length) {
    const links = document.createElement('p');
    links.className = 'systems-links';
    system.links.forEach((link, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'systems-links-sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = ' / ';
        links.appendChild(sep);
      }
      const a = document.createElement('a');
      a.href = link.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'link-arrow';
      a.textContent = link.label;
      links.appendChild(a);
    });
    meta.appendChild(links);
  }
}

function renderLayers(system) {
  const wrap = els.layers;
  wrap.innerHTML = '';
  const available = usedLayers(system);

  available.forEach((layer) => {
    if (layer === 'flow') return;
    const label = document.createElement('label');
    label.className = 'systems-layer';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = layer;
    input.checked = state.layers.has(layer);
    input.addEventListener('change', () => {
      if (input.checked) state.layers.add(layer);
      else state.layers.delete(layer);
      state.layers.add('flow');
      applyLayerStyles(getSystem(state.systemId), { animatePrivacy: true });
    });
    const text = document.createElement('span');
    text.textContent = LAYER_LABELS[layer] || layer;
    label.appendChild(input);
    label.appendChild(text);
    wrap.appendChild(label);
  });

  wrap.hidden = available.filter((l) => l !== 'flow').length === 0;
}

function privacyPerimeter(boundary) {
  if (typeof boundary.getTotalLength === 'function') {
    try {
      const len = boundary.getTotalLength();
      if (len > 0) return len;
    } catch {
      /* fall through */
    }
  }
  const w = Number(boundary.getAttribute('width')) || 0;
  const h = Number(boundary.getAttribute('height')) || 0;
  return 2 * (w + h);
}

function drawPrivacyBoundary(boundary, draw) {
  if (!boundary) return;
  const reduced = state.reducedMotion || prefersReducedMotion();
  const len = privacyPerimeter(boundary);

  if (!draw) {
    boundary.setAttribute('visibility', 'hidden');
    boundary.classList.remove('is-drawing');
    boundary.style.strokeDasharray = '';
    boundary.style.strokeDashoffset = '';
    boundary.style.transition = '';
    return;
  }

  boundary.setAttribute('visibility', 'visible');

  if (reduced || !len) {
    boundary.classList.remove('is-drawing');
    boundary.style.strokeDasharray = '6 4';
    boundary.style.strokeDashoffset = '';
    boundary.style.transition = '';
    return;
  }

  boundary.classList.add('is-drawing');
  boundary.style.strokeDasharray = `${len}`;
  boundary.style.strokeDashoffset = `${len}`;
  boundary.style.transition = 'none';
  void boundary.getBoundingClientRect();
  boundary.style.transition = '';

  const finish = (ev) => {
    if (ev && ev.propertyName && ev.propertyName !== 'stroke-dashoffset') return;
    boundary.removeEventListener('transitionend', finish);
    if (!state.layers.has('privacy')) {
      drawPrivacyBoundary(boundary, false);
      return;
    }
    showPrivacyBoundaryStatic(boundary);
  };
  boundary.addEventListener('transitionend', finish);

  requestAnimationFrame(() => {
    boundary.style.strokeDashoffset = '0';
  });
}

function showPrivacyBoundaryStatic(boundary) {
  if (!boundary) return;
  boundary.setAttribute('visibility', 'visible');
  boundary.classList.remove('is-drawing');
  boundary.style.strokeDasharray = '6 4';
  boundary.style.strokeDashoffset = '';
  boundary.style.transition = '';
}

function applyLayerStyles(system, opts = {}) {
  if (!els.svg) return;
  const privacyOn = state.layers.has('privacy');
  const metricsOn = state.layers.has('metrics');
  const failureOn = state.layers.has('failure');

  els.svg.querySelectorAll('[data-node-id]').forEach((g) => {
    const id = g.getAttribute('data-node-id');
    const node = getNode(system, id);
    const layers = node?.layers || ['flow'];
    let dim = false;
    if (privacyOn) dim = !layers.includes('privacy');
    if (metricsOn && !dim) dim = !layers.includes('metrics');
    if (failureOn && !dim) dim = !layers.includes('failure');
    g.classList.toggle('is-dimmed', dim);
    g.classList.toggle('is-metrics', metricsOn && layers.includes('metrics'));
  });

  els.svg.querySelectorAll('[data-edge-key]').forEach((path) => {
    const key = path.getAttribute('data-edge-key');
    const edge = system.edges.find((e) => edgeKey(e.from, e.to) === key);
    const layers = edge?.layers || ['flow'];
    let dim = false;
    if (privacyOn) dim = !layers.includes('privacy');
    if (failureOn && !dim) dim = !layers.includes('failure');
    path.classList.toggle('is-dimmed', dim);
  });

  const boundary = els.svg.querySelector('.systems-privacy-boundary');
  if (boundary) {
    if (!privacyOn) {
      drawPrivacyBoundary(boundary, false);
    } else if (opts.animatePrivacy || !state.privacyWasOn) {
      drawPrivacyBoundary(boundary, true);
    } else {
      showPrivacyBoundaryStatic(boundary);
    }
  }
  state.privacyWasOn = privacyOn;
}

function privacyBounds(system) {
  const nodes = system.nodes.filter((n) => (n.layers || []).includes('privacy'));
  if (!nodes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    const o = nodeOrigin(n);
    minX = Math.min(minX, o.x);
    minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + NODE_W);
    maxY = Math.max(maxY, o.y + NODE_H);
  });
  const pad = 12;
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

function cornerMarks() {
  const g = svgEl('g', {
    class: 'systems-node-corners',
    'aria-hidden': 'true',
  });
  const marks = [
    `M0 ${CORNER} V0 H${CORNER}`,
    `M${NODE_W - CORNER} 0 H${NODE_W} V${CORNER}`,
    `M${NODE_W} ${NODE_H - CORNER} V${NODE_H} H${NODE_W - CORNER}`,
    `M${CORNER} ${NODE_H} H0 V${NODE_H - CORNER}`,
  ];
  marks.forEach((d) => {
    g.appendChild(svgEl('path', { class: 'systems-node-corner', d }));
  });
  return g;
}

function drawEdgesIn(system) {
  if (!els.svg) return;
  const order = edgesDrawOrder(system);
  const reduced = state.reducedMotion || prefersReducedMotion();

  order.forEach((edge, i) => {
    const path = els.svg.querySelector(
      `.systems-edge[data-edge-key="${edgeKey(edge.from, edge.to)}"]`
    );
    if (!path) return;
    let len = 0;
    try {
      len = path.getTotalLength();
    } catch {
      return;
    }
    path.classList.add('is-drawing');
    path.style.strokeDasharray = `${len}`;
    if (reduced) {
      path.style.strokeDashoffset = '0';
      path.classList.remove('is-drawing');
      return;
    }
    path.style.strokeDashoffset = `${len}`;
    path.style.transition = 'none';
    void path.getBoundingClientRect();
    path.style.transition = `stroke-dashoffset 400ms var(--ease-out) ${i * 50}ms`;
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = '0';
    });
    const done = (ev) => {
      if (ev && ev.propertyName && ev.propertyName !== 'stroke-dashoffset') return;
      path.classList.remove('is-drawing');
      path.style.transition = '';
      path.removeEventListener('transitionend', done);
    };
    path.addEventListener('transitionend', done);
  });
}

function renderSvg(system) {
  const svg = els.svg;
  svg.innerHTML = '';
  trailLayer = null;
  const { w, h } = viewBoxFor(system);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));

  const defs = svgEl('defs');
  const marker = svgEl('marker', {
    id: 'systemsArrow',
    viewBox: '0 0 10 10',
    refX: '9',
    refY: '5',
    markerWidth: '6',
    markerHeight: '6',
    orient: 'auto-start-reverse',
  });
  marker.appendChild(
    svgEl('path', {
      d: 'M0 0 L10 5 L0 10 z',
      class: 'systems-arrow-head',
    })
  );
  const markerSignal = svgEl('marker', {
    id: 'systemsArrowSignal',
    viewBox: '0 0 10 10',
    refX: '9',
    refY: '5',
    markerWidth: '6',
    markerHeight: '6',
    orient: 'auto-start-reverse',
  });
  markerSignal.appendChild(
    svgEl('path', {
      d: 'M0 0 L10 5 L0 10 z',
      class: 'systems-arrow-head-signal',
    })
  );
  defs.appendChild(marker);
  defs.appendChild(markerSignal);
  svg.appendChild(defs);

  const bounds = privacyBounds(system);
  if (bounds) {
    svg.appendChild(
      svgEl('rect', {
        class: 'systems-privacy-boundary',
        x: bounds.x,
        y: bounds.y,
        width: bounds.w,
        height: bounds.h,
        visibility: 'hidden',
      })
    );
  }

  const edgeLayer = svgEl('g', { class: 'systems-edges' });
  system.edges.forEach((edge) => {
    const d = edgePath(system, edge);
    const path = svgEl('path', {
      d,
      class: 'systems-edge',
      'data-edge-key': edgeKey(edge.from, edge.to),
      'data-from': edge.from,
      'data-to': edge.to,
      'marker-end': 'url(#systemsArrow)',
      fill: 'none',
    });
    edgeLayer.appendChild(path);

    if (edge.label) {
      const a = getNode(system, edge.from);
      const b = getNode(system, edge.to);
      if (a && b) {
        const ca = nodeCenter(a);
        const cb = nodeCenter(b);
        const text = svgEl('text', {
          class: 'systems-edge-label',
          x: (ca.x + cb.x) / 2,
          y: (ca.y + cb.y) / 2 - 6,
          'text-anchor': 'middle',
        });
        text.textContent = edge.label;
        edgeLayer.appendChild(text);
      }
    }
  });
  svg.appendChild(edgeLayer);

  trailLayer = svgEl('g', {
    class: 'systems-trail',
    'aria-hidden': 'true',
  });
  svg.appendChild(trailLayer);

  const nodeLayer = svgEl('g', { class: 'systems-nodes' });
  system.nodes.forEach((node) => {
    const o = nodeOrigin(node);
    const g = svgEl('g', {
      class: 'systems-node',
      'data-node-id': node.id,
      'data-kind': node.kind,
      role: 'button',
      tabindex: '0',
      transform: `translate(${o.x} ${o.y})`,
    });
    g.setAttribute('aria-label', `${node.label}, ${node.kind}`);
    g.setAttribute('aria-pressed', node.id === state.nodeId ? 'true' : 'false');

    const tag = svgEl('text', {
      class: 'systems-node-selected-tag',
      x: NODE_W / 2,
      y: -6,
      'text-anchor': 'middle',
      'aria-hidden': 'true',
    });
    tag.textContent = 'SELECTED';
    g.appendChild(tag);

    const body = svgEl('g', { class: 'systems-node-body fx-stamp' });
    body.appendChild(
      svgEl('rect', {
        class: 'systems-node-rect',
        x: 0,
        y: 0,
        width: NODE_W,
        height: NODE_H,
      })
    );

    const kind = svgEl('text', {
      class: 'systems-node-kind',
      x: 8,
      y: 16,
    });
    kind.textContent = node.kind;
    body.appendChild(kind);

    const label = svgEl('text', {
      class: 'systems-node-label',
      x: 8,
      y: 36,
    });
    label.textContent = node.label;
    body.appendChild(label);
    body.appendChild(cornerMarks());
    g.appendChild(body);

    g.addEventListener('click', () => selectNode(node.id));
    g.addEventListener('keydown', (e) => onNodeKey(e, system, node.id));
    /* Hover highlight only on fine pointers — avoids sticky :hover after tap. */
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      g.addEventListener('mouseenter', () => setHover(node.id));
      g.addEventListener('mouseleave', () => setHover(null));
    }
    g.addEventListener('focus', () => setHover(node.id));
    g.addEventListener('blur', () => {
      if (state.hoverId === node.id) setHover(null);
    });

    nodeLayer.appendChild(g);
  });
  svg.appendChild(nodeLayer);

  const traveler = svgEl('g', {
    class: 'systems-traveler',
    visibility: 'hidden',
    'aria-hidden': 'true',
  });
  traveler.appendChild(svgEl('circle', { r: 3.5, cx: 0, cy: 0 }));
  svg.appendChild(traveler);

  state.privacyWasOn = false;
  applySelectionStyles(system);
  applyLayerStyles(system);
  requestAnimationFrame(() => drawEdgesIn(system));
}

function setHover(nodeId) {
  state.hoverId = nodeId;
  const system = getSystem(state.systemId);
  applySelectionStyles(system);
}

function applySelectionStyles(system) {
  const selected = state.nodeId;
  const hover = state.hoverId;
  const focusId = hover || selected;
  const linked = focusId ? connectedIds(system, focusId) : new Set();
  const { up, down } = focusId
    ? upstreamDownstream(system, focusId)
    : { up: new Set(), down: new Set() };

  els.svg?.classList.toggle('has-selection', Boolean(selected));

  els.svg?.querySelectorAll('[data-node-id]').forEach((g) => {
    const id = g.getAttribute('data-node-id');
    const isSelected = id === selected;
    const isHover = id === hover;
    const isLinked = linked.has(id);
    g.classList.toggle('is-selected', isSelected);
    g.classList.toggle('is-hover', isHover);
    g.classList.toggle('is-linked', Boolean(focusId) && isLinked && !isSelected);
    g.classList.toggle('is-upstream', up.has(id));
    g.classList.toggle('is-downstream', down.has(id));
    g.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });

  els.svg?.querySelectorAll('.systems-edge').forEach((path) => {
    const from = path.getAttribute('data-from');
    const to = path.getAttribute('data-to');
    const onSelected =
      selected && (from === selected || to === selected);
    const onHover =
      focusId && (from === focusId || to === focusId);
    path.classList.toggle('is-selected', Boolean(onSelected));
    path.classList.toggle('is-hot', Boolean(onHover));
    path.setAttribute(
      'marker-end',
      onSelected || onHover ? 'url(#systemsArrowSignal)' : 'url(#systemsArrow)'
    );
  });
}

function onNodeKey(e, system, nodeId) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    selectNode(nodeId);
    return;
  }

  const arrows = {
    ArrowLeft: true,
    ArrowRight: true,
    ArrowUp: true,
    ArrowDown: true,
  };
  if (!arrows[e.key]) return;
  e.preventDefault();

  const adj = adjacency(system);
  const neighbors = [...(adj.get(nodeId) || [])];
  if (!neighbors.length) return;

  const current = getNode(system, nodeId);
  const scored = neighbors
    .map((id) => {
      const n = getNode(system, id);
      return {
        id,
        dx: n.col - current.col,
        dy: n.row - current.row,
      };
    })
    .filter((n) => {
      if (e.key === 'ArrowLeft') return n.dx < 0 || (n.dx === 0 && n.dy !== 0);
      if (e.key === 'ArrowRight') return n.dx > 0 || (n.dx === 0 && n.dy !== 0);
      if (e.key === 'ArrowUp') return n.dy < 0 || (n.dy === 0 && n.dx !== 0);
      if (e.key === 'ArrowDown') return n.dy > 0 || (n.dy === 0 && n.dx !== 0);
      return true;
    });

  const pool = scored.length ? scored : neighbors.map((id) => {
    const n = getNode(system, id);
    return { id, dx: n.col - current.col, dy: n.row - current.row };
  });

  pool.sort((a, b) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      return Math.abs(a.dx) - Math.abs(b.dx) || Math.abs(a.dy) - Math.abs(b.dy);
    }
    return Math.abs(a.dy) - Math.abs(b.dy) || Math.abs(a.dx) - Math.abs(b.dx);
  });

  const nextId = pool[0]?.id;
  if (!nextId) return;
  selectNode(nextId);
  const g = els.svg.querySelector(`[data-node-id="${nextId}"]`);
  g?.focus();
}

/** Build What/Why/Trade-off/Metric rows; unpublished Why/Trade-off stay visible. */
function annotationRows(node) {
  const rows = [
    { key: 'What', value: node.what, required: false },
    { key: 'Why', value: node.why, required: true },
    { key: 'Trade-off', value: node.tradeoff, required: true },
    { key: 'Metric', value: node.metric, required: false },
  ];
  return rows
    .map((row) => {
      if (row.value != null && row.value !== '') {
        return { key: row.key, value: row.value };
      }
      if (row.required) {
        return { key: row.key, value: 'Not published' };
      }
      return null;
    })
    .filter(Boolean);
}

function paintAnnotation(panel, node) {
  panel.innerHTML = '';
  panel.classList.remove('is-ready', 'is-fading');

  if (!node) {
    const empty = document.createElement('p');
    empty.className = 'systems-annotation-empty';
    empty.textContent = 'Select a component to inspect it.';
    panel.appendChild(empty);
    return;
  }

  const head = document.createElement('div');
  head.className = 'systems-annotation-head';

  const title = document.createElement('h3');
  title.className = 'systems-annotation-title';
  title.textContent = node.label;
  head.appendChild(title);

  const kind = document.createElement('span');
  kind.className = 'tag';
  kind.textContent = node.kind;
  head.appendChild(kind);
  panel.appendChild(head);

  annotationRows(node).forEach((row, i) => {
    const dl = document.createElement('div');
    dl.className = 'systems-annotation-row';
    dl.style.setProperty('--i', String(i));
    const dt = document.createElement('p');
    dt.className = 'systems-annotation-key';
    if (row.key === 'Trade-off') {
      dt.classList.add('fx-marker');
    }
    dt.textContent = row.key;
    const dd = document.createElement('p');
    dd.className = 'systems-annotation-value';
    dd.textContent = row.value;
    dl.appendChild(dt);
    dl.appendChild(dd);
    panel.appendChild(dl);
  });
}

function renderAnnotation(system, node) {
  const panel = els.annotation;
  if (!panel) return;

  if (state.annotationTimer) {
    clearTimeout(state.annotationTimer);
    state.annotationTimer = null;
  }

  const reduced = state.reducedMotion || prefersReducedMotion();
  const reveal = () => {
    if (reduced) {
      panel.classList.remove('is-fading');
      panel.querySelectorAll('.fx-marker').forEach((el) => el.classList.add('is-in'));
      return;
    }
    panel.classList.add('is-ready');
    requestAnimationFrame(() => {
      panel.classList.remove('is-fading');
      panel.querySelectorAll('.fx-marker').forEach((el) => el.classList.add('is-in'));
    });
  };

  const swap = () => {
    paintAnnotation(panel, node);
    if (!reduced) panel.classList.add('is-fading');
    void panel.offsetWidth;
    reveal();
  };

  if (reduced || !panel.childElementCount) {
    paintAnnotation(panel, node);
    reveal();
    return;
  }

  panel.classList.add('is-fading');
  state.annotationTimer = setTimeout(() => {
    state.annotationTimer = null;
    swap();
  }, ANNOTATION_FADE_MS);
}

function renderCaption(system) {
  els.caption.textContent = `Fig. 1 - ${system.title}, simplified`;
}

function renderStepper(system) {
  const list = els.stepper;
  list.innerHTML = '';
  const { nodes } = flowOrder(system);

  nodes.forEach((id) => {
    const node = getNode(system, id);
    if (!node) return;
    const li = document.createElement('li');
    li.className = 'systems-step';
    li.dataset.nodeId = node.id;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'systems-step-toggle';
    btn.setAttribute('aria-expanded', node.id === state.nodeId ? 'true' : 'false');

    const kind = document.createElement('span');
    kind.className = 'tag';
    kind.textContent = node.kind;
    btn.appendChild(kind);

    const label = document.createElement('span');
    label.className = 'systems-step-label';
    label.textContent = node.label;
    btn.appendChild(label);

    const body = document.createElement('div');
    body.className = 'systems-step-body';
    body.hidden = node.id !== state.nodeId;

    annotationRows(node).forEach((row) => {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      if (row.key === 'Trade-off') {
        strong.className = 'fx-marker is-in';
      }
      strong.textContent = `${row.key}. `;
      p.appendChild(strong);
      p.appendChild(document.createTextNode(row.value));
      body.appendChild(p);
    });

    btn.addEventListener('click', () => {
      selectNode(node.id);
    });

    li.classList.toggle('is-selected', node.id === state.nodeId);
    li.appendChild(btn);
    li.appendChild(body);
    list.appendChild(li);
  });
}

function updateMode() {
  const mobile = isMobile();
  // CSS media queries own visibility; keep hidden/aria in sync for a11y.
  if (mobile) {
    els.svg.setAttribute('hidden', '');
    els.svg.setAttribute('aria-hidden', 'true');
    els.stepper.removeAttribute('hidden');
    els.stepper.removeAttribute('aria-hidden');
  } else {
    els.svg.removeAttribute('hidden');
    els.svg.removeAttribute('aria-hidden');
    els.stepper.setAttribute('hidden', '');
    els.stepper.setAttribute('aria-hidden', 'true');
  }
  els.toolbar.classList.toggle('is-mobile', mobile);
  updateHint();
  if (mobile) clearTrace();
  requestAnimationFrame(() => updateTabIndicator());
}

function selectSystem(systemId, nodeId) {
  clearTrace();
  const system = getSystem(systemId);
  state.systemId = system.id;
  state.layers = new Set(['flow']);
  state.privacyWasOn = false;

  const available = usedLayers(system);
  available.forEach((l) => {
    if (l !== 'flow') state.layers.delete(l);
  });

  renderTabs();
  renderMeta(system);
  renderLayers(system);
  renderCaption(system);
  renderSvg(system);
  renderStepper(system);
  updateMode();

  const target = nodeId && getNode(system, nodeId) ? nodeId : null;
  if (target) {
    selectNode(target, { skipHash: false, fromSystem: true });
  } else {
    state.nodeId = null;
    renderAnnotation(system, null);
    applySelectionStyles(system);
    renderStepper(system);
    writeHash(system.id, null);
    updateHint();
  }
}

function selectNode(nodeId, opts = {}) {
  const system = getSystem(state.systemId);
  const node = nodeId ? getNode(system, nodeId) : null;
  state.nodeId = node?.id || null;

  if (state.nodeId) dismissHint();
  else updateHint();

  renderAnnotation(system, node);
  applySelectionStyles(system);
  renderStepper(system);

  if (!opts.skipHash) writeHash(system.id, state.nodeId);
}

function setTravelerAt(x, y) {
  const traveler = els.svg?.querySelector('.systems-traveler');
  if (!traveler) return null;
  traveler.setAttribute('visibility', 'visible');
  traveler.setAttribute('transform', `translate(${x} ${y})`);
  return traveler;
}

function spawnTrailGhost(x, y) {
  if (!trailLayer || state.reducedMotion) return;
  const ghost = svgEl('circle', {
    class: 'systems-trail-ghost',
    r: 2.5,
    cx: 0,
    cy: 0,
    transform: `translate(${x} ${y})`,
  });
  trailLayer.appendChild(ghost);
  requestAnimationFrame(() => ghost.classList.add('is-fading'));
  setTimeout(() => ghost.remove(), 300);
  while (trailLayer.childElementCount > 12) {
    trailLayer.firstElementChild?.remove();
  }
}

function stampNode(id) {
  const body = els.svg?.querySelector(
    `[data-node-id="${id}"] .systems-node-body`
  );
  if (!body || state.reducedMotion || prefersReducedMotion()) return;
  body.classList.remove('is-stamping');
  void body.getBoundingClientRect();
  body.classList.add('is-stamping');
  const onEnd = () => {
    body.classList.remove('is-stamping');
    body.removeEventListener('animationend', onEnd);
  };
  body.addEventListener('animationend', onEnd);
}

function animateAlong(path, duration) {
  return new Promise((resolve) => {
    const traveler = els.svg?.querySelector('.systems-traveler');
    if (!traveler) {
      resolve();
      return;
    }
    traveler.setAttribute('visibility', 'visible');
    const len = path.getTotalLength();
    const start = performance.now();
    let lastGhost = 0;

    function frame(now) {
      if (!state.tracing) {
        resolve();
        return;
      }
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2);
      const pt = path.getPointAtLength(len * eased);
      traveler.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
      if (now - lastGhost > 36) {
        spawnTrailGhost(pt.x, pt.y);
        lastGhost = now;
      }
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }

    requestAnimationFrame(frame);
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    state.traceTimer = setTimeout(resolve, ms);
  });
}

function highlightTraceNode(id) {
  els.svg?.querySelectorAll('[data-node-id]').forEach((g) => {
    g.classList.toggle('is-trace', g.getAttribute('data-node-id') === id);
  });
  els.stepper?.querySelectorAll('.systems-step').forEach((li) => {
    li.classList.toggle('is-trace', li.dataset.nodeId === id);
  });
}

async function runTrace() {
  const system = getSystem(state.systemId);
  if (state.tracing) {
    clearTrace();
    return;
  }

  state.tracing = true;
  els.traceBtn.setAttribute('aria-pressed', 'true');
  els.traceBtn.textContent = 'Stop trace';

  const { nodes, edges } = flowOrder(system);
  const total = nodes.length;
  const reduced = prefersReducedMotion() || isMobile() || state.reducedMotion;

  if (reduced) {
    for (let i = 0; i < nodes.length; i += 1) {
      if (!state.tracing) break;
      const id = nodes[i];
      updateStepCounter(i + 1, total);
      highlightTraceNode(id);
      selectNode(id);
      await wait(450);
    }
    clearTrace();
    return;
  }

  if (nodes[0]) {
    const n = getNode(system, nodes[0]);
    const c = nodeCenter(n);
    setTravelerAt(c.x, c.y);
    updateStepCounter(1, total);
    highlightTraceNode(nodes[0]);
    stampNode(nodes[0]);
    selectNode(nodes[0]);
    await wait(280);
  }

  for (const edge of edges) {
    if (!state.tracing) break;
    const path = els.svg.querySelector(
      `.systems-edge[data-edge-key="${edgeKey(edge.from, edge.to)}"]`
    );
    if (!path) continue;
    path.classList.add('is-trace');
    await animateAlong(path, 520);
    const stepIndex = nodes.indexOf(edge.to);
    updateStepCounter(stepIndex >= 0 ? stepIndex + 1 : null, total);
    highlightTraceNode(edge.to);
    stampNode(edge.to);
    selectNode(edge.to);
    await wait(320);
    path.classList.remove('is-trace');
  }

  clearTrace();
}

function syncFromHash() {
  const parsed = parseHash();
  if (!parsed) {
    if (!state.systemId) selectSystem(systems[0].id);
    return;
  }
  const system = getSystem(parsed.systemId || systems[0].id);
  if (system.id !== state.systemId) {
    selectSystem(system.id, parsed.nodeId);
  } else if (parsed.nodeId && parsed.nodeId !== state.nodeId) {
    selectNode(parsed.nodeId);
  } else if (!parsed.nodeId && state.nodeId) {
    selectNode(null);
  }
}

function bind() {
  els.traceBtn.addEventListener('click', () => {
    runTrace().catch(() => clearTrace());
  });

  window.addEventListener('hashchange', () => {
    const parsed = parseHash();
    if (!parsed) return;
    syncFromHash();
  });

  window.addEventListener('resize', () => {
    updateTabIndicator();
  });

  mqMobile = window.matchMedia(MOBILE_MQ);
  mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMq = () => {
    state.reducedMotion = mqReduce.matches;
    updateMode();
    const system = getSystem(state.systemId);
    if (system) renderStepper(system);
  };
  mqMobile.addEventListener('change', onMq);
  mqReduce.addEventListener('change', onMq);
}

export function initSystems() {
  const root = document.getElementById('systems');
  if (!root || !systems.length) return;

  els = {
    root,
    figure: root.querySelector('.systems-figure'),
    tabs: document.getElementById('systemsTabs'),
    meta: document.getElementById('systemsMeta'),
    toolbar: document.getElementById('systemsToolbar'),
    layers: document.getElementById('systemsLayers'),
    traceBtn: document.getElementById('systemsTrace'),
    canvas: document.getElementById('systemsCanvas'),
    svg: document.getElementById('systemsSvg'),
    stepper: document.getElementById('systemsStepper'),
    caption: document.getElementById('systemsFigCaption'),
    annotation: document.getElementById('systemsAnnotation'),
  };

  if (!els.tabs || !els.svg || !els.annotation) return;

  state.hintDismissed = readHintDismissed();
  ensureChrome();
  bind();
  state.reducedMotion = prefersReducedMotion();

  const parsed = parseHash();
  if (parsed?.systemId) {
    selectSystem(parsed.systemId, parsed.nodeId);
  } else {
    selectSystem(systems[0].id);
  }
}
