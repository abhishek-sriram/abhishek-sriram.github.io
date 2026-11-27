export const svgNamespace = "http://www.w3.org/2000/svg";

export function svgElement(name, attributes) {
  const element = document.createElementNS(svgNamespace, name);
  if (!attributes) return element;
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}
