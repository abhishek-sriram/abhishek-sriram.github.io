import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:8000';
const DIR = path.join(__dirname, 'screenshots', 'crops');
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });

await page.keyboard.press('Tab');
await page.waitForTimeout(300);
const skipFocus = await page.evaluate(() => {
  const el = document.activeElement;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    className: el.className,
    opacity: cs.opacity,
    transform: cs.transform,
    outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
    visible: r.height > 0 && Number(cs.opacity) > 0.5,
    rect: { top: r.top, left: r.left, w: r.width, h: r.height },
    focus: el.matches(':focus'),
    focusVisible: el.matches(':focus-visible'),
  };
});
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const afterSkip = await page.evaluate(() => ({
  activeId: document.activeElement?.id,
  activeTag: document.activeElement?.tagName,
  scrollY: window.scrollY,
  hash: location.hash,
  mainTabIndex: document.getElementById('main')?.getAttribute('tabindex'),
}));

const sectionOrder = await page.evaluate(() =>
  [...document.querySelectorAll('main section[id], #contact')].map((el) => el.id)
);

const navOrder = await page.evaluate(() =>
  [...document.querySelectorAll('.nav-links a[href^="#"]')].map((a) => a.getAttribute('href'))
);

// Workbench deep link + layers
await page.goto(BASE + '/#systems/mindpulse/shap', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const deep = await page.evaluate(() => ({
  hash: location.hash,
  tab: document.querySelector('[data-system-id="mindpulse"]')?.getAttribute('aria-selected'),
  node: document.querySelector('.systems-node[data-node-id="shap"]')?.getAttribute('aria-pressed'),
  ann: document.getElementById('systemsAnnotation')?.textContent?.trim().slice(0, 160),
}));

await page.click('[data-system-id="b4igo"]');
await page.waitForTimeout(300);
await page.check('.systems-layer input[value="privacy"]');
await page.waitForTimeout(200);
const privacy = await page.evaluate(() => ({
  checked: document.querySelector('.systems-layer input[value="privacy"]')?.checked,
  boundary: document.querySelector('.systems-privacy-boundary')?.getAttribute('visibility'),
}));

await page.click('[data-system-id="legislative-ebook"]');
await page.waitForTimeout(300);
await page.check('.systems-layer input[value="metrics"]');
await page.waitForTimeout(200);
const metrics = await page.evaluate(() => ({
  checked: document.querySelector('.systems-layer input[value="metrics"]')?.checked,
  metricsNodes: document.querySelectorAll('.systems-node.is-metrics').length,
  dimmed: document.querySelectorAll('.systems-node.is-dimmed').length,
}));

await page.click('#systemsTrace');
await page.waitForTimeout(500);
const trace = await page.evaluate(() => ({
  label: document.getElementById('systemsTrace')?.textContent,
  pressed: document.getElementById('systemsTrace')?.getAttribute('aria-pressed'),
}));
if ((trace.label || '').includes('Stop')) {
  await page.click('#systemsTrace');
}

// Mobile stepper
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/#systems/mindpulse/shap', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const mobile = await page.evaluate(() => ({
  svgHidden: document.getElementById('systemsSvg')?.hasAttribute('hidden'),
  stepperHidden: document.getElementById('systemsStepper')?.hasAttribute('hidden'),
  steps: document.querySelectorAll('.systems-step').length,
  shap: document
    .querySelector('.systems-step[data-node-id="shap"] button')
    ?.getAttribute('aria-expanded'),
}));

// Menu escape
await page.click('#navToggle');
await page.waitForTimeout(200);
const opened = await page.evaluate(() => document.getElementById('nav')?.dataset.open === 'true');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const closed = await page.evaluate(() => document.getElementById('nav')?.dataset.open !== 'true');

// Crop key regions at desktop light
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('theme', 'light'));
await page.reload({ waitUntil: 'networkidle' });

const crops = [
  ['hero', '#top'],
  ['systems', '#systems'],
  ['about', '#about'],
  ['toolkit', '#toolkit'],
  ['experience', '#experience'],
  ['projects', '#projects'],
  ['credentials', '#credentials'],
  ['contact', '#contact'],
];
for (const [name, sel] of crops) {
  const loc = page.locator(sel);
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await loc.screenshot({ path: path.join(DIR, `1440_light_${name}.png`) });
}

// Mobile crops
await page.setViewportSize({ width: 320, height: 640 });
await page.reload({ waitUntil: 'networkidle' });
for (const [name, sel] of ['hero|#top', 'systems|#systems', 'toolkit|#toolkit', 'projects|#projects', 'contact|#contact'].map((s) => s.split('|'))) {
  const loc = page.locator(sel);
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await loc.screenshot({ path: path.join(DIR, `320_light_${name}.png`) });
}

// Dark hero
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => localStorage.setItem('theme', 'dark'));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('#top').screenshot({ path: path.join(DIR, '1440_dark_hero.png') });

const og = await page.evaluate(async () => {
  const r = await fetch('/img/og.png', { method: 'HEAD' });
  return r.status;
});

// toolkit horizontal overflow at 320
await page.setViewportSize({ width: 320, height: 640 });
await page.goto(BASE + '/#toolkit', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const toolkitOverflow = await page.evaluate(() => {
  const pipe = document.getElementById('toolkitPipeline');
  const doc = document.documentElement.scrollWidth > document.documentElement.clientWidth;
  return {
    docOverflow: doc,
    pipeScroll: pipe ? pipe.scrollWidth > pipe.clientWidth : null,
    pipeSW: pipe?.scrollWidth,
    pipeCW: pipe?.clientWidth,
    widest: [...document.querySelectorAll('body *')]
      .map((el) => ({
        w: el.getBoundingClientRect().width,
        c: el.className?.toString?.().slice(0, 40),
      }))
      .filter((x) => x.w > 320)
      .slice(0, 10),
  };
});

// systems canvas overflow
await page.goto(BASE + '/#systems', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const systemsOverflow = await page.evaluate(() => {
  const canvas = document.getElementById('systemsCanvas');
  const svg = document.getElementById('systemsSvg');
  return {
    canvasSW: canvas?.scrollWidth,
    canvasCW: canvas?.clientWidth,
    svgW: svg?.getBoundingClientRect().width,
    svgHidden: svg?.hasAttribute('hidden'),
  };
});

console.log(
  JSON.stringify(
    {
      skipFocus,
      afterSkip,
      sectionOrder,
      navOrder,
      deep,
      privacy,
      metrics,
      trace,
      mobile,
      menu: { opened, closed },
      og,
      toolkitOverflow,
      systemsOverflow,
    },
    null,
    2
  )
);

await browser.close();
