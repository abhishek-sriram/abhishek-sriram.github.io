import { toolkitLayers } from '../data/toolkit.js';

const REDUCE = '(prefers-reduced-motion: reduce)';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function noteIdFor(name) {
  return `toolkit-note-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function renderUsedIn(tool) {
  if (!tool.usedIn?.length) return '';

  const links = tool.usedIn
    .map(
      (item) =>
        `<a class="toolkit-used-link" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
    )
    .join('<span class="toolkit-used-sep" aria-hidden="true"> · </span>');

  return `<span class="toolkit-used-in" id="${escapeHtml(noteIdFor(tool.name))}" role="note"><span class="toolkit-used-label">used in</span><span class="toolkit-used-sep" aria-hidden="true"> · </span>${links}</span>`;
}

function renderTool(tool) {
  const hasNote = Boolean(tool.usedIn?.length);
  const attrs = hasNote
    ? ` tabindex="0" aria-describedby="${escapeHtml(noteIdFor(tool.name))}"`
    : '';
  const noteClass = hasNote ? ' toolkit-tool--noted' : '';

  return `<li class="toolkit-tool${noteClass}"${attrs}><span class="toolkit-tool-name fx-marker fx-marker--hover">${escapeHtml(tool.name)}</span>${renderUsedIn(tool)}</li>`;
}

function renderPipe(index, total) {
  if (index >= total - 1) return '';
  return `<span class="toolkit-pipe" aria-hidden="true" style="--i:${index}">
      <svg class="toolkit-pipe-svg" viewBox="0 0 48 10" preserveAspectRatio="none" focusable="false">
        <line class="toolkit-pipe-line" x1="0" y1="5" x2="40" y2="5" pathLength="1" />
        <polyline class="toolkit-pipe-head" points="36,1.5 42,5 36,8.5" pathLength="1" fill="none" />
      </svg>
    </span>`;
}

function renderLayer(layer, index, total) {
  return `
    <div class="toolkit-layer" data-layer="${escapeHtml(layer.id)}" style="--i:${index}">
      <div class="toolkit-layer-head">
        <h3 class="toolkit-layer-name">${escapeHtml(layer.name)}</h3>
        ${renderPipe(index, total)}
      </div>
      <ul class="toolkit-tools">
        ${layer.tools.map(renderTool).join('')}
      </ul>
    </div>
  `;
}

function armPipeline(root) {
  const mark = () => root.classList.add('is-in');
  if (window.matchMedia(REDUCE).matches || !('IntersectionObserver' in window)) {
    mark();
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        mark();
        io.unobserve(root);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -32px 0px' }
  );
  io.observe(root);
  window.setTimeout(() => {
    if (!root.classList.contains('is-in')) {
      mark();
      io.disconnect();
    }
  }, 3000);

  const mq = window.matchMedia(REDUCE);
  const onReduce = () => {
    if (!mq.matches) return;
    mark();
    io.disconnect();
  };
  if (mq.addEventListener) mq.addEventListener('change', onReduce);
  else mq.addListener(onReduce);
}

export function initToolkit() {
  const root = document.getElementById('toolkitPipeline');
  if (!root) return;

  const total = toolkitLayers.length;
  root.innerHTML = toolkitLayers
    .map((layer, index) => renderLayer(layer, index, total))
    .join('');

  armPipeline(root);
}
