const REACH = 300;
const REST_WDTH = 88;
const REST_WGHT = 520;

export function initHeroName(section, { reduced }) {
  const letters = [...section.querySelectorAll(".hero-letter")];
  if (!letters.length || reduced) return;

  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const state = letters.map(() => ({ wdth: REST_WDTH, wght: REST_WGHT }));
  const targets = letters.map(() => ({ wdth: REST_WDTH, wght: REST_WGHT }));
  let pointer = null;
  let mode = fine.matches ? "rest" : "wave";
  let dirty = false;
  let visible = true;
  let hidden = document.hidden;
  let raf = 0;
  let lastNow = 0;

  function write(index, wdth, wght) {
    const letter = letters[index];
    letter.style.setProperty("--wdth", wdth.toFixed(2));
    letter.style.setProperty("--wght", wght.toFixed(1));
  }

  function aim(now) {
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
    if (mode === "wave") {
      const time = now * 0.001;
      for (let i = 0; i < letters.length; i += 1) {
        const wave = Math.sin(time * 0.85 + i * 0.38);
        targets[i].wdth = 86 + wave * 6;
        targets[i].wght = 480 + wave * 110;
      }
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
    aim(now);
    const blend = 1 - Math.exp(-dt / 70);
    let moving = mode === "wave";
    for (let i = 0; i < letters.length; i += 1) {
      state[i].wdth += (targets[i].wdth - state[i].wdth) * blend;
      state[i].wght += (targets[i].wght - state[i].wght) * blend;
      if (Math.abs(targets[i].wdth - state[i].wdth) > 0.15 || Math.abs(targets[i].wght - state[i].wght) > 0.8) moving = true;
      write(i, state[i].wdth, state[i].wght);
    }
    if (moving && visible && !hidden) raf = requestAnimationFrame(frame);
  }

  function poke() {
    if (!raf && visible && !hidden) raf = requestAnimationFrame(frame);
  }

  section.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") {
      pointer = null;
      mode = "wave";
      poke();
      return;
    }
    pointer = { x: event.clientX, y: event.clientY };
    mode = "track";
    dirty = true;
    poke();
  }, { passive: true });

  section.addEventListener("pointerleave", () => {
    pointer = null;
    dirty = false;
    mode = fine.matches ? "rest" : "wave";
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

  if (mode === "wave") poke();
}
