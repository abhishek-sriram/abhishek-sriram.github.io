import { onArrive } from "../core/arrive.js";
import { delay, duration, ease } from "../core/motion.config.js";
import { prefersReducedMotion } from "../core/motion.js";

function mirror(row) {
  const face = row.querySelector(".credential-face");
  if (!face || row.querySelector(".credential-invert")) return;
  const invert = face.cloneNode(true);
  invert.classList.remove("credential-face");
  invert.classList.add("credential-invert");
  invert.setAttribute("aria-hidden", "true");
  invert.querySelectorAll("a").forEach((link) => {
    const stand = document.createElement("span");
    stand.className = "credential-link-mirror";
    stand.textContent = link.textContent;
    link.replaceWith(stand);
  });
  row.append(invert);
  row.classList.add("has-invert");
}

function initAxis(section) {
  const gsap = window.gsap;
  const keys = [...section.querySelectorAll(".credential-face > .credential-key")];
  if (!keys.length || !gsap || prefersReducedMotion()) return;
  gsap.set(keys, { "--wdth": 75 });
  onArrive(section, "top 78%", () => {
    gsap.to(keys, {
      "--wdth": 100,
      duration: duration.axis,
      stagger: delay.key,
      ease: ease.settle,
      overwrite: true,
      onComplete() {
        gsap.set(keys, { clearProps: "--wdth" });
      },
    });
  });
}

export function initCredentials() {
  const section = document.getElementById("credentials");
  if (!section) return;
  section.querySelectorAll(".credential-row").forEach(mirror);
  initAxis(section);
}
