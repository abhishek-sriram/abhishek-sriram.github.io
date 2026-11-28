import { prefersReducedMotion } from "./motion.js";
import { qualityTier } from "./quality.js";

const TILE = 128;

function paintTile() {
  const tile = document.createElement("canvas");
  tile.width = TILE;
  tile.height = TILE;
  const context = tile.getContext("2d");
  if (!context) return "";
  const image = context.createImageData(TILE, TILE);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const tone = (Math.random() * 255) | 0;
    data[i] = tone;
    data[i + 1] = tone;
    data[i + 2] = tone;
    data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return tile.toDataURL("image/png");
}

export function initGrain() {
  if (prefersReducedMotion() || qualityTier() === "low") return;
  const url = paintTile();
  if (!url) return;

  const root = document.documentElement;
  root.style.setProperty("--grain-tile", `url("${url}")`);
  root.classList.add("has-grain");

}
