import { duration, velocity } from "./motion.config.js";
import { prefersReducedMotion } from "./motion.js";
import { qualityTier } from "./quality.js";
import { getLenis } from "./scroll.js";

export function initMarquee() {
  if (prefersReducedMotion() || qualityTier() === "low") return;
  const gsap = window.gsap;
  const lenis = getLenis();
  const band = document.querySelector(".signal-band");
  const track = band?.querySelector(".signal-track");
  const run = track?.querySelector(".signal-run");
  if (!gsap || !lenis || !band || !track || !run) return;

  let sample = 0;
  let speed = 0;
  let offset = 0;
  let loop = 0;
  let paused = false;
  let last = performance.now();

  function measure() {
    const width = run.getBoundingClientRect().width;
    if (width < 1) return;
    loop = width;
    let guard = 0;
    while (track.scrollWidth < window.innerWidth + width && guard < 8) {
      track.append(run.cloneNode(true));
      guard += 1;
    }
  }

  measure();
  document.fonts?.ready?.then(measure);
  window.addEventListener("resize", measure, { passive: true });

  lenis.on("scroll", (event) => {
    sample = event.velocity || 0;
  });

  band.addEventListener("pointerenter", () => {
    paused = true;
  });
  band.addEventListener("pointerleave", () => {
    paused = false;
  });

  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(48, now - last);
    last = now;
    const blend = 1 - Math.exp(-dt / (duration.marquee * 1000));
    const raw = paused || Math.abs(sample) < velocity.deadzone ? 0 : sample * velocity.marquee;
    speed += (raw - speed) * blend;
    sample *= 1 - blend;
    if (!loop) return;
    if (Math.abs(speed) < 0.02 && Math.abs(raw) < 0.02) {
      speed = 0;
      return;
    }
    offset = ((offset + speed) % loop + loop) % loop;
    track.style.transform = `translate3d(${(-offset).toFixed(2)}px,0,0)`;
  });
}
