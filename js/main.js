import { applyMotionConfig, prefersReducedMotion } from "./core/motion.js";
import { noteFrame, qualityProfile, qualityTier } from "./core/quality.js";

document.documentElement.dataset.motion = prefersReducedMotion() ? "reduce" : "full";
document.documentElement.dataset.tier = qualityTier();
applyMotionConfig();
globalThis.__quality = { tier: qualityTier, profile: qualityProfile, noteFrame };

function turn() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

await turn();

const [
  scrollMod,
  irisMod,
  chromeMod,
  cursorMod,
  grainMod,
  magnetMod,
  heroMod,
  indexMod,
  systemsMod,
  systemsData,
  experienceMod,
  projectsMod,
  toolkitMod,
  aboutMod,
  credentialsMod,
  contactMod,
  footerMod,
  handoffMod,
  velocityMod,
  outlineMod,
  decodeMod,
  marqueeMod,
  titlesMod,
  loadMod,
] = await Promise.all([
  import("./core/scroll.js"),
  import("./core/iris.js"),
  import("./core/chrome.js"),
  import("./core/cursor.js"),
  import("./core/grain.js"),
  import("./core/magnet.js"),
  import("./sections/hero.js"),
  import("./data/index.js"),
  import("./sections/systems.js"),
  import("./data/systems.js"),
  import("./sections/experience.js"),
  import("./sections/projects.js"),
  import("./sections/toolkit.js"),
  import("./sections/about.js"),
  import("./sections/credentials.js"),
  import("./sections/contact.js"),
  import("./sections/footer.js"),
  import("./core/handoff.js"),
  import("./core/velocity.js"),
  import("./core/outline.js"),
  import("./core/decode.js"),
  import("./core/marquee.js"),
  import("./core/titles.js"),
  import("./core/load.js"),
]);

await turn();

scrollMod.initScroll();
irisMod.initIris();
await turn();

chromeMod.initChrome();
cursorMod.initCursor();
grainMod.initGrain();
magnetMod.initMagnet();
await turn();

const heroMotion = heroMod.initHero(indexMod.queryIndex);
await turn();

systemsMod.initSystems(systemsData.systems);
await turn();

experienceMod.initExperience();
projectsMod.initProjects();
await turn();

toolkitMod.initToolkit();
aboutMod.initAbout();
credentialsMod.initCredentials();
contactMod.initContact();
footerMod.initFooter();
await turn();

handoffMod.initHandoff();
velocityMod.initVelocity();
outlineMod.initOutline();
decodeMod.initDecode();
marqueeMod.initMarquee();
titlesMod.initTitles();
await turn();

loadMod.initLoad(heroMotion);
