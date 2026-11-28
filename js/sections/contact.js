import { stepSpring } from "../core/spring.js";
import { prefersReducedMotion } from "../core/motion.js";
import { qualityTier, whileVisible } from "../core/quality.js";
import { initContactGlyphs } from "./contactGlyphs.js";

/* Must run inside the click gesture. An awaited Clipboard rejection expires it. */
function copyFromField(text) {
  const previous = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.left = "0";
  field.style.opacity = "0";
  document.body.append(field);
  field.focus();
  field.select();
  field.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  field.remove();
  if (previous instanceof HTMLElement) previous.focus();
  return ok;
}

function confirmCopy(button, status, message, copied) {
  status.textContent = "";
  if (copied) {
    button.classList.remove("is-copied");
    void button.offsetWidth;
    button.classList.add("is-copied");
  } else {
    button.classList.remove("is-copied");
  }
  requestAnimationFrame(() => {
    status.textContent = message;
  });
}

function startBengaluruClock(clock) {
  const display = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const tick = () => {
    const now = new Date();
    clock.textContent = display.format(now);
    const parts = Object.fromEntries(stamp.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    clock.dateTime = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+05:30`;
  };
  let timer = 0;
  whileVisible(
    () => {
      if (timer) return;
      tick();
      timer = window.setInterval(tick, 1000);
    },
    () => {
      if (!timer) return;
      window.clearInterval(timer);
      timer = 0;
    },
  );
}

function armCopyPress(button) {
  if (prefersReducedMotion() || qualityTier() === "low") return;
  const press = { value: 1, velocity: 0 };
  let target = 1;
  let frame = 0;
  let last = 0;
  let held = false;

  const tick = (now) => {
    const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016);
    last = now;
    stepSpring(press, target, dt);
    const settled = Math.abs(press.value - target) < 0.0008 && Math.abs(press.velocity) < 0.02;
    if (settled) {
      frame = 0;
      last = 0;
      if (target === 1) {
        press.value = 1;
        press.velocity = 0;
        button.style.transform = "";
      } else {
        button.style.transform = `scale(${press.value.toFixed(4)})`;
      }
      return;
    }
    button.style.transform = `scale(${press.value.toFixed(4)})`;
    frame = requestAnimationFrame(tick);
  };

  const poke = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  const depress = () => {
    held = true;
    target = 0.92;
    press.velocity -= 1.2;
    poke();
  };

  const release = () => {
    if (!held) return;
    held = false;
    target = 1;
    press.velocity += 0.35;
    poke();
  };

  button.addEventListener("pointerdown", depress);
  button.addEventListener("keydown", (event) => {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    depress();
  });
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  button.addEventListener("keyup", (event) => {
    if (event.key === "Enter" || event.key === " ") release();
  });
  button.addEventListener("blur", release);
}

export function initContact() {
  const clock = document.querySelector(".contact-clock");
  if (clock) startBengaluruClock(clock);
  const section = document.querySelector(".contact");
  if (section) initContactGlyphs(section);

  const button = document.querySelector("[data-copy-email]");
  const status = document.getElementById("copyStatus");
  if (!button || !status) return;

  armCopyPress(button);
  button.addEventListener("click", () => {
    const email = button.getAttribute("data-copy-email") || "";
    if (copyFromField(email)) {
      confirmCopy(button, status, "Copied", true);
      return;
    }
    if (!navigator.clipboard?.writeText) {
      confirmCopy(button, status, "Copy failed", false);
      return;
    }
    navigator.clipboard.writeText(email).then(
      () => confirmCopy(button, status, "Copied", true),
      () => confirmCopy(button, status, "Copy failed", false),
    );
  });
}
