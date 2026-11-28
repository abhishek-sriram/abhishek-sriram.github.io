import { lockCanvasFallback, onQualityChange, qualityProfile } from "../../core/quality.js";

const emptyStats = {
  n: 0,
  median: 0,
  p95: 0,
  max: 0,
  count: 0,
  mode: "none",
  draws: 0,
};

function webglFieldSupported() {
  try {
    const probe = document.createElement("canvas");
    const attrs = {
      alpha: true,
      antialias: false,
      depth: true,
      stencil: false,
      failIfMajorPerformanceCaveat: false,
    };
    if (probe.getContext("webgl2", attrs)) return true;
    const gl = probe.getContext("webgl", attrs);
    return Boolean(gl && gl.getExtension("ANGLE_instanced_arrays"));
  } catch {
    return false;
  }
}

function replaceCanvas(node) {
  const next = document.createElement("canvas");
  next.className = "hero-field";
  next.setAttribute("aria-hidden", "true");
  next.width = 300;
  next.height = 200;
  node.replaceWith(next);
  return next;
}

export function initHeroField(canvas, index, options = {}) {
  if (!canvas) {
    return {
      retrieve() {},
      reset() {},
      frameMs() {
        return emptyStats;
      },
      releaseIntro() {},
      dispose() {},
    };
  }

  const webglOk = webglFieldSupported();
  let node = canvas;
  let current = null;
  let mode = "";
  let tags = [];
  let introReleased = false;
  let mounting = false;
  let pending = null;
  let disposed = false;

  function sharedOptions(profile) {
    return {
      reduced: options.reduced,
      holdIntro: Boolean(options.holdIntro) && !introReleased,
      tier: profile.tier,
      count: profile.count,
      dprCap: profile.dprCap,
      links: profile.links,
    };
  }

  function retire() {
    const previous = current;
    current = null;
    if (!previous) return;
    previous.dispose();
    node = replaceCanvas(node);
  }

  async function realise(profile) {
    let renderer = profile.renderer;
    if (renderer === "webgl" && !webglOk) {
      if (!profile.locked && lockCanvasFallback()) return;
      renderer = "2d";
    }
    if (current && mode === renderer && current.configure) {
      current.configure(profile);
      return;
    }
    const loaded = renderer === "webgl" ? import("./field3d.js") : import("./field2d.js");
    const imported = await loaded;
    if (disposed) return;
    retire();
    const shared = sharedOptions(profile);
    if (renderer === "webgl") {
      const created = imported.initHeroField3d(node, index, shared);
      if (!created) {
        if (!profile.locked && lockCanvasFallback()) return;
        const fallback = await import("./field2d.js");
        if (disposed) return;
        current = fallback.initHeroField2d(node, index, shared);
        mode = "2d";
      } else {
        current = created;
        mode = "webgl";
      }
    } else {
      current = imported.initHeroField2d(node, index, shared);
      mode = "2d";
    }
    if (tags.length) current?.retrieve(tags);
  }

  async function mount(profile) {
    pending = profile;
    if (mounting) return;
    mounting = true;
    while (pending && !disposed) {
      const next = pending;
      pending = null;
      await realise(next);
    }
    mounting = false;
  }

  const stop = onQualityChange((profile) => {
    mount(profile);
  });
  mount(qualityProfile());

  return {
    retrieve(next) {
      tags = [...next];
      current?.retrieve(tags);
    },
    reset() {
      tags = [];
      current?.reset();
    },
    frameMs() {
      return current?.frameMs() || emptyStats;
    },
    releaseIntro() {
      introReleased = true;
      current?.releaseIntro();
    },
    dispose() {
      disposed = true;
      pending = null;
      stop();
      current?.dispose();
      current = null;
    },
  };
}
