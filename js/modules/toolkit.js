import { toolkitLayers } from '../data/toolkit.js';

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

  return `<span class="toolkit-used-in" id="${escapeHtml(noteIdFor(tool.name))}"><span class="toolkit-used-label">used in</span><span class="toolkit-used-sep" aria-hidden="true"> · </span>${links}</span>`;
}

function renderTool(tool) {
  const hasNote = Boolean(tool.usedIn?.length);
  const attrs = hasNote
    ? ` tabindex="0" aria-describedby="${escapeHtml(noteIdFor(tool.name))}"`
    : '';
  const noteClass = hasNote ? ' toolkit-tool--noted' : '';

  return `<li class="toolkit-tool${noteClass}"${attrs}><span class="toolkit-tool-name">${escapeHtml(tool.name)}</span>${renderUsedIn(tool)}</li>`;
}

function renderLayer(layer, index, total) {
  const arrow =
    index < total - 1
      ? `<span class="toolkit-arrow" aria-hidden="true">→</span>`
      : '';

  return `
    <div class="toolkit-layer" data-layer="${escapeHtml(layer.id)}">
      <div class="toolkit-layer-head">
        <h3 class="toolkit-layer-name">${escapeHtml(layer.name)}</h3>
        ${arrow}
      </div>
      <ul class="toolkit-tools">
        ${layer.tools.map(renderTool).join('')}
      </ul>
    </div>
  `;
}

export function initToolkit() {
  const root = document.getElementById('toolkitPipeline');
  if (!root) return;

  const total = toolkitLayers.length;
  root.innerHTML = `
    <div class="toolkit-rail" aria-hidden="true"></div>
    ${toolkitLayers.map((layer, index) => renderLayer(layer, index, total)).join('')}
  `;
}
