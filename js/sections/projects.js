import { onArrive } from "../core/arrive.js";
import { clamp } from "../core/clamp.js";
import { delay, duration, ease } from "../core/motion.config.js";
import { prefersReducedMotion } from "../core/motion.js";
import { getLenis } from "../core/scroll.js";
import { createPlate } from "./projects/plate.js";

const mobileQuery = window.matchMedia("(max-width: 719px)");
const fineQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

function slugFromHash(hash) {
  if (!hash || hash === "#") return null;
  let raw = hash.slice(1);
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (raw.startsWith("projects/")) return raw.slice("projects/".length).split("/")[0];
  if (raw.startsWith("project-")) return raw.slice("project-".length);
  return null;
}

function insetClip(rect) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const top = clamp(rect.top, 0, height);
  const left = clamp(rect.left, 0, width);
  const right = clamp(width - rect.right, 0, width);
  const bottom = clamp(height - rect.bottom, 0, height);
  return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
}

export function initProjects() {
  const section = document.getElementById("projects");
  const dialog = document.getElementById("case-file");
  if (!section || !dialog) return;

  const plate = createPlate();
  document.body.append(plate.root);

  const dossiers = new Map();
  section.querySelectorAll(".project-row").forEach((row) => {
    const id = row.dataset.project;
    if (!id) return;
    const summary = row.querySelector(".project-summary");
    const dossier = row.querySelector(".project-dossier");
    const details = row.querySelector(".project-details");
    if (!summary || !dossier || !details) return;
    dossiers.set(id, {
      id,
      row,
      summary,
      dossier,
      details,
      title: row.querySelector(".project-title")?.textContent.trim() || "",
      result: row.querySelector(".project-result")?.textContent.trim() || "",
      tags: [...row.querySelectorAll(".project-tag")].map((tag) => tag.textContent.trim()),
    });
  });

  if (!dossiers.size) return;

  let currentId = null;
  let returnFocus = null;
  let closing = false;
  let closeTimer = 0;
  let closeToken = 0;
  let onClipEnd = null;
  let keyedAt = 0;
  let heldLenis = false;
  let heldBody = false;
  let lockedY = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let plateFrame = 0;
  let pointerHot = false;
  let armedId = null;

  function knownSlug(hash) {
    const slug = slugFromHash(hash);
    return slug && dossiers.has(slug) ? slug : null;
  }

  function plateAllowed() {
    return fineQuery.matches && !mobileQuery.matches && !dialog.open;
  }

  function pauseScroll() {
    const engine = getLenis();
    if (engine) {
      engine.stop();
      heldLenis = true;
      return;
    }
    lockedY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    heldBody = true;
  }

  function resumeScroll() {
    if (heldLenis) {
      heldLenis = false;
      const index = document.getElementById("index-overlay");
      if (!index || index.hidden) getLenis()?.start();
    }
    if (heldBody) {
      heldBody = false;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      window.scrollTo(0, lockedY);
    }
  }

  function scrollToRow(row) {
    const mast = document.querySelector(".mast");
    const offset = -Math.ceil((mast?.getBoundingClientRect().height || 0) + 12);
    const engine = getLenis();
    if (engine) {
      engine.scrollTo(row, { offset, immediate: true, force: true });
      return;
    }
    const top = row.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo(0, Math.max(0, top));
  }

  function writeHash(id, mode) {
    const next = `#projects/${id}`;
    if (location.hash === next || mode === "none") return;
    const state = { caseFile: id };
    if (mode === "push") history.pushState(state, "", next);
    else history.replaceState(state, "", next);
  }

  function clearHash() {
    if (!knownSlug(location.hash)) return;
    history.replaceState({ caseFile: null }, "", "#projects");
  }

  function park(record) {
    if (!record) return;
    record.details.open = false;
    record.row.classList.remove("is-open");
    if (record.dossier.parentElement !== record.details) record.details.append(record.dossier);
  }

  function disarm() {
    armedId = null;
    plate.root.classList.remove("is-on");
    section.classList.remove("is-browsing");
    dossiers.forEach((record) => record.row.classList.remove("is-quiet"));
  }

  function aim(x, y, instant) {
    targetX = x;
    targetY = y;
    if (instant || !plate.root.classList.contains("is-on")) {
      currentX = x;
      currentY = y;
    }
    if (!plateFrame) plateFrame = requestAnimationFrame(trackPlate);
  }

  function placePlate() {
    const width = plate.root.offsetWidth || 280;
    const height = plate.root.offsetHeight || 220;
    const plateInset = 12;
    const x = clamp(currentX + 20, plateInset, Math.max(plateInset, window.innerWidth - width - plateInset));
    const y = clamp(currentY + 22, plateInset, Math.max(plateInset, window.innerHeight - height - plateInset));
    plate.root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function trackPlate() {
    const gain = prefersReducedMotion() ? 1 : 0.18;
    currentX += (targetX - currentX) * gain;
    currentY += (targetY - currentY) * gain;
    placePlate();
    const settled = Math.abs(targetX - currentX) < 0.4 && Math.abs(targetY - currentY) < 0.4;
    if (!settled && plate.root.classList.contains("is-on")) {
      plateFrame = requestAnimationFrame(trackPlate);
      return;
    }
    plateFrame = 0;
  }

  function arm(record, instant) {
    if (!plateAllowed()) return;
    if (armedId !== record.id) {
      plate.paint(record);
      armedId = record.id;
    }
    plate.root.classList.add("is-on");
    section.classList.add("is-browsing");
    dossiers.forEach((dossier) => dossier.row.classList.toggle("is-quiet", dossier !== record));
    if (instant) placePlate();
    if (!plateFrame) plateFrame = requestAnimationFrame(trackPlate);
  }

  function finishClose(keepHash) {
    closeToken += 1;
    window.clearTimeout(closeTimer);
    closeTimer = 0;
    closing = false;
    if (onClipEnd) dialog.removeEventListener("transitionend", onClipEnd);
    const record = dossiers.get(currentId);
    dialog.style.transition = "none";
    dialog.style.clipPath = "";
    if (dialog.open) dialog.close();
    park(record);
    currentId = null;
    dialog.removeAttribute("aria-labelledby");
    resumeScroll();
    if (!keepHash) clearHash();
    const back = returnFocus;
    returnFocus = null;
    if (back && document.contains(back)) back.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      dialog.style.transition = "";
    });
  }

  function requestClose({ keepHash = false, immediate = false } = {}) {
    if (!dialog.open) return;
    if (closing) {
      if (immediate) finishClose(keepHash);
      return;
    }
    const record = dossiers.get(currentId);
    const reduce = immediate || prefersReducedMotion() || !record;
    if (reduce) {
      finishClose(keepHash);
      return;
    }
    closing = true;
    const token = closeToken;
    const rect = record.summary.getBoundingClientRect();
    onClipEnd = (event) => {
      if (token !== closeToken) return;
      if (event?.propertyName !== "clip-path") return;
      finishClose(keepHash);
    };
    dialog.addEventListener("transitionend", onClipEnd);
    closeTimer = window.setTimeout(() => {
      if (token !== closeToken) return;
      finishClose(keepHash);
    }, duration.case * 1000);
    dialog.style.clipPath = insetClip(rect);
  }

  function openCase(id, { historyMode = "push", align = false } = {}) {
    const record = dossiers.get(id);
    if (!record) return;
    if (closing) finishClose(true);
    if (dialog.open && currentId === id) return;

    if (currentId && currentId !== id) park(dossiers.get(currentId));
    disarm();

    if (align) scrollToRow(record.row);

    const heading = record.dossier.querySelector(".case-title");
    const active = document.activeElement;
    const usable = active instanceof HTMLElement && active !== document.body && active !== document.documentElement;
    returnFocus = usable ? active : record.summary;
    currentId = id;
    record.details.open = false;
    dialog.append(record.dossier);
    record.details.open = true;
    record.row.classList.add("is-open");
    dossiers.forEach((dossier) => {
      if (dossier !== record) {
        dossier.details.open = false;
        dossier.row.classList.remove("is-open");
      }
    });

    if (heading?.id) dialog.setAttribute("aria-labelledby", heading.id);
    writeHash(id, historyMode);

    const rect = record.summary.getBoundingClientRect();
    const reduce = prefersReducedMotion();
    dialog.style.transition = "none";
    dialog.style.clipPath = reduce ? "inset(0px)" : insetClip(rect);
    if (!dialog.open) dialog.showModal();
    pauseScroll();
    dialog.tabIndex = -1;
    dialog.focus({ preventScroll: true });

    if (reduce) {
      requestAnimationFrame(() => {
        dialog.style.transition = "";
      });
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (currentId !== id || !dialog.open) return;
        dialog.style.transition = "";
        dialog.style.clipPath = "inset(0px)";
      });
    });
  }

  function activate(record) {
    if (dialog.open && currentId === record.id) requestClose();
    else openCase(record.id, { historyMode: "push" });
  }

  dossiers.forEach((record) => {
    record.summary.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.repeat) return;
      event.preventDefault();
      keyedAt = performance.now();
      activate(record);
    });
    record.summary.addEventListener("click", (event) => {
      event.preventDefault();
      if (performance.now() - keyedAt < 500) return;
      activate(record);
    });
  });

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !dialog.open) return;
    const nodes = [...dialog.querySelectorAll("a[href], button, input, textarea, select")].filter((el) => {
      if (el.closest("[hidden]") || el.disabled) return false;
      return el.getClientRects().length > 0;
    });
    if (!nodes.length) {
      event.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || active === dialog || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest(".case-close")) {
      requestClose();
      return;
    }
    const link = event.target.closest("a[href^='#']");
    if (!link) return;
    requestClose({ keepHash: true, immediate: true });
  });

  document.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.("a[href^='#']");
    if (!link || link.closest(".case-file")) return;
    const id = knownSlug(link.getAttribute("href"));
    if (!id) return;
    openCase(id, { historyMode: "replace", align: true });
  });

  window.addEventListener("popstate", () => {
    const id = knownSlug(location.hash);
    if (id) openCase(id, { historyMode: "none", align: true });
    else if (dialog.open) requestClose({ keepHash: true, immediate: true });
  });

  section.addEventListener("pointermove", (event) => {
    if (!plateAllowed()) return;
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    pointerHot = true;
    aim(event.clientX, event.clientY, false);
    const row = event.target.closest?.(".project-row");
    const record = row ? dossiers.get(row.dataset.project) : null;
    if (record) arm(record, false);
  });

  section.addEventListener("pointerleave", () => {
    pointerHot = false;
    const focused = document.activeElement?.closest?.(".project-row");
    const record = focused ? dossiers.get(focused.dataset.project) : null;
    if (record && plateAllowed()) {
      const rect = record.summary.getBoundingClientRect();
      aim(rect.left + Math.min(rect.width * 0.72, rect.width - 24), rect.top + rect.height * 0.35, false);
      arm(record, false);
      return;
    }
    disarm();
  });

  section.addEventListener("focusin", (event) => {
    const row = event.target.closest?.(".project-row");
    const record = row ? dossiers.get(row.dataset.project) : null;
    if (!record || !plateAllowed()) return;
    if (!pointerHot) {
      const rect = record.summary.getBoundingClientRect();
      aim(rect.left + Math.min(rect.width * 0.72, rect.width - 24), rect.top + rect.height * 0.35, true);
    }
    arm(record, !pointerHot);
  });

  section.addEventListener("focusout", (event) => {
    if (section.contains(event.relatedTarget)) return;
    if (pointerHot) return;
    disarm();
  });

  const dropPlate = () => {
    if (!plateAllowed()) disarm();
  };
  mobileQuery.addEventListener("change", dropPlate);
  fineQuery.addEventListener("change", dropPlate);
  window.addEventListener("resize", () => {
    if (plate.root.classList.contains("is-on")) placePlate();
  });

  const rows = [...section.querySelectorAll(".project-row")];
  const gsap = window.gsap;
  if (rows.length && gsap && !prefersReducedMotion()) {
    gsap.set(rows, { clipPath: "inset(0 0 0 2.25rem)" });
    onArrive(section, "top 72%", () => {
      gsap.to(rows, {
        clipPath: "inset(0px 0px 0px 0px)",
        duration: duration.row,
        stagger: delay.row,
        ease: ease.snap,
        overwrite: true,
        onComplete() {
          gsap.set(rows, { clearProps: "clipPath" });
        },
      });
    });
  }

  const opening = knownSlug(location.hash);
  if (opening) openCase(opening, { historyMode: "replace", align: true });
}
