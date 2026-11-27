import { onArrive } from "../core/arrive.js";
import { duration, ease } from "../core/motion.config.js";
import { prefersReducedMotion } from "../core/motion.js";

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
  tick();
  setInterval(tick, 1000);
}

function initTitle(section) {
  const title = section.querySelector(".contact-title");
  const gsap = window.gsap;
  if (!title || !gsap || prefersReducedMotion()) return;
  gsap.set(title, { clipPath: "inset(0 100% 0 0)" });
  onArrive(section, "top 78%", () => {
    gsap.to(title, {
      clipPath: "inset(0 0% 0 0)",
      duration: duration.titleWipe,
      ease: ease.snap,
      overwrite: true,
      onComplete() {
        title.style.clipPath = "";
      },
    });
  });
}

export function initContact() {
  const section = document.getElementById("contact");
  if (section) initTitle(section);
  const button = document.querySelector("[data-copy-email]");
  const status = document.getElementById("copyStatus");
  const clock = document.querySelector(".contact-clock");
  if (clock) startBengaluruClock(clock);
  if (!button || !status) return;

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
