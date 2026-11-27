import { svgElement } from "../../core/svg.js";

function titleSeed(title) {
  let hash = 2166136261;
  for (let index = 0; index < title.length; index += 1) {
    hash ^= title.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unitStream(seed) {
  let value = seed || 1;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function placeNodes(random, count) {
  const nodes = [];
  for (let index = 0; index < count; index += 1) {
    let x = 26 + random() * 268;
    let y = 20 + random() * 140;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const crowded = nodes.some((node) => {
        const dx = node.x - x;
        const dy = node.y - y;
        return dx * dx + dy * dy < 36 * 36;
      });
      if (!crowded) break;
      x = 26 + random() * 268;
      y = 20 + random() * 140;
    }
    nodes.push({ x, y });
  }
  return nodes;
}

export function paintMotif(svg, title) {
  const random = unitStream(titleSeed(title));
  const count = 5 + Math.floor(random() * 4);
  const nodes = placeNodes(random, count);
  const seen = new Set();
  const edges = [];

  const link = (from, to) => {
    if (from === to) return;
    const key = from < to ? `${from}-${to}` : `${to}-${from}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push([from, to]);
  };

  for (let index = 0; index < count - 1; index += 1) link(index, index + 1);
  const chords = 1 + Math.floor(random() * 3);
  for (let index = 0; index < chords; index += 1) {
    link(Math.floor(random() * count), Math.floor(random() * count));
  }

  svg.replaceChildren();
  svg.setAttribute("viewBox", "0 0 320 180");
  edges.forEach(([from, to]) => {
    const a = nodes[from];
    const b = nodes[to];
    svg.append(
      svgElement("line", {
        x1: a.x.toFixed(1),
        y1: a.y.toFixed(1),
        x2: b.x.toFixed(1),
        y2: b.y.toFixed(1),
      }),
    );
  });
  nodes.forEach((node, index) => {
    svg.append(
      svgElement("circle", {
        cx: node.x.toFixed(1),
        cy: node.y.toFixed(1),
        r: index === 0 ? 5.5 : 3.25,
      }),
    );
  });
}

export function createPlate() {
  const root = document.createElement("div");
  root.className = "project-plate";
  root.setAttribute("aria-hidden", "true");

  const motif = svgElement("svg", { class: "project-motif" });
  const result = document.createElement("p");
  result.className = "project-plate-result";
  const tags = document.createElement("p");
  tags.className = "project-plate-tags";
  root.append(motif, result, tags);

  return {
    root,
    paint(project) {
      paintMotif(motif, project.title);
      result.textContent = project.result;
      tags.replaceChildren(
        ...project.tags.map((tag) => {
          const tagSpan = document.createElement("span");
          tagSpan.textContent = tag;
          return tagSpan;
        }),
      );
    },
  };
}
