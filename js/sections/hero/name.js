const REACH = 300;
const REST_WDTH = 88;
const REST_WGHT = 520;

export function initHeroName(section, { reduced }) {
  const letters = [...section.querySelectorAll(".hero-letter")];
  if (!letters.length || reduced) return;

  const state = letters.map(() => ({ wdth: REST_WDTH, wght: REST_WGHT }));
  const targets = letters.map(() => ({ wdth: REST_WDTH, wght: REST_WGHT }));
  let pointer = null;
  let mode = "rest";
  let dirty = false;
  let visible = true;
  let hidden = document.hidden;
  let raf = 0;
  let lastNow = 0;

  function aim() {
    if (mode === "track") {
      if (!pointer || !dirty) return;
      for (let i = 0; i < letters.length; i += 1) {
        const rect = letters[i].getBoundingClientRect();
        const dx = pointer.x - (rect.left + rect.width * 0.5);
        const dy = pointer.y - (rect.top + rect.height * 0.5);
        const influence = Math.max(0, 1 - Math.hypot(dx, dy) / REACH);
        const eased = influence * influence * (3 - 2 * influence);
        targets[i].wdth = 76 + eased * 24;
        targets[i].wght = 360 + eased * 420;
      }
      dirty = false;
      return;
    }
    for (let i = 0; i < letters.length; i += 1) {
      targets[i].wdth = REST_WDTH;
      targets[i].wght = REST_WGHT;
    }
  }

  function frame(now) {
    raf = 0;
    const dt = lastNow ? Math.min(34, now - lastNow) : 16;
    lastNow = now;
    aim();
    const blend = 1 - Math.exp(-dt / 70);
    let moving = false;
    for (let i = 0; i < letters.length; i += 1) {
      state[i].wdth += (targets[i].wdth - state[i].wdth) * blend;
      state[i].wght += (targets[i].wght - state[i].wght) * blend;
      if (Math.abs(targets[i].wdth - state[i].wdth) > 0.15 || Math.abs(targets[i].wght - state[i].wght) > 0.8) moving = true;
      const swell = (state[i].wght - REST_WGHT) / 480;
      const lift = (state[i].wdth - REST_WDTH) / 24;
      const pending = document.documentElement.classList.contains("is-pending");
      const flat = Math.abs(swell) < 0.01 && Math.abs(lift) < 0.01;
      letters[i].style.transform = pending || flat ? "" : `translate3d(0, ${(-lift * 4).toFixed(2)}px, 0) scale(${(1 + swell * 0.06).toFixed(4)})`;
      if (pending) moving = true;
    }
    if (moving && visible && !hidden) raf = requestAnimationFrame(frame);
  }

  function poke() {
    if (!raf && visible && !hidden) raf = requestAnimationFrame(frame);
  }

  section.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    pointer = { x: event.clientX, y: event.clientY };
    mode = "track";
    dirty = true;
    poke();
  }, { passive: true });

  section.addEventListener("pointerleave", () => {
    pointer = null;
    dirty = false;
    mode = "rest";
    poke();
  });

  document.addEventListener("visibilitychange", () => {
    hidden = document.hidden;
    if (!hidden) poke();
  });

  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) poke();
  }, { threshold: 0.05 });
  observer.observe(section);
}
