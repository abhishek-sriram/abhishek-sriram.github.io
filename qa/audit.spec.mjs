/**
 * Portfolio QA audit — Playwright + axe-core.
 * Run: node audit.spec.mjs  (server must be on BASE_URL)
 * Writes: qa/results/audit.json, qa/screenshots/*
 */
import { chromium, devices } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const OUT = path.join(__dirname, 'results');
const SHOTS = path.join(__dirname, 'screenshots');

const VIEWPORTS = [
  { name: '320x640', width: 320, height: 640 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
];

const THEMES = ['light', 'dark'];
const UNVERIFIABLE_HOSTS = ['linkedin.com', 'www.linkedin.com', 'coursera.org', 'www.coursera.org', 'drive.google.com'];

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const report = {
  baseUrl: BASE,
  startedAt: new Date().toISOString(),
  areas: {},
  issues: [],
  axe: [],
  lighthouse: null,
  console: [],
  network: [],
  externalLinks: [],
  screenshots: [],
  notes: [],
};

function issue(severity, area, title, detail) {
  report.issues.push({ severity, area, title, ...detail });
}

function setArea(name, status, note = '') {
  report.areas[name] = { status, note };
}

async function withPage(browser, opts, fn) {
  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    colorScheme: opts.colorScheme || 'light',
    reducedMotion: opts.reducedMotion || 'no-preference',
    hasTouch: opts.width <= 768,
  });
  if (opts.theme) {
    await context.addInitScript((theme) => {
      try {
        localStorage.setItem('theme', theme);
      } catch (e) {}
    }, opts.theme);
  }
  const page = await context.newPage();
  const consoleMsgs = [];
  const failedReqs = [];
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMsgs.push({ type, text: msg.text(), location: msg.location() });
    }
  });
  page.on('pageerror', (err) => {
    consoleMsgs.push({ type: 'pageerror', text: String(err) });
  });
  page.on('requestfailed', (req) => {
    failedReqs.push({
      url: req.url(),
      failure: req.failure()?.errorText,
      method: req.method(),
    });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedReqs.push({
        url: res.url(),
        status: res.status(),
        method: res.request().method(),
      });
    }
  });

  try {
    await fn(page, { consoleMsgs, failedReqs, context });
  } finally {
    await context.close();
  }
}

function probeUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(
      url,
      {
        method: 'HEAD',
        timeout: 12000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; PortfolioQA/1.0; +https://abhishek-sriram.github.io)',
          Accept: '*/*',
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        res.resume();
        if ((status === 405 || status === 403 || status === 999) && res.method !== 'GET') {
          // fall through to GET below via resolve then retry
        }
        resolve({ url, status, method: 'HEAD' });
      }
    );
    req.on('error', () => {
      // retry GET
      const req2 = lib.request(
        url,
        {
          method: 'GET',
          timeout: 12000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; PortfolioQA/1.0; +https://abhishek-sriram.github.io)',
            Accept: '*/*',
          },
        },
        (res) => {
          const status = res.statusCode || 0;
          res.resume();
          resolve({ url, status, method: 'GET' });
        }
      );
      req2.on('error', (err) => resolve({ url, status: 0, error: String(err), method: 'GET' }));
      req2.on('timeout', () => {
        req2.destroy();
        resolve({ url, status: 0, error: 'timeout', method: 'GET' });
      });
      req2.end();
    });
    req.on('timeout', () => {
      req.destroy();
      const req2 = lib.request(
        url,
        {
          method: 'GET',
          timeout: 12000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; PortfolioQA/1.0; +https://abhishek-sriram.github.io)',
          },
        },
        (res) => {
          const status = res.statusCode || 0;
          res.resume();
          resolve({ url, status, method: 'GET' });
        }
      );
      req2.on('error', (err) => resolve({ url, status: 0, error: String(err), method: 'GET' }));
      req2.end();
    });
    req.end();
  });
}

async function checkExternalLinks(page) {
  const hrefs = await page.evaluate(() => {
    const out = new Set();
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (href.startsWith('http://') || href.startsWith('https://')) out.add(href);
    });
    return [...out];
  });

  const results = [];
  for (const url of hrefs) {
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      results.push({ url, status: 0, verdict: 'fail', note: 'invalid URL' });
      continue;
    }
    const unverifiable = UNVERIFIABLE_HOSTS.some(
      (h) => host === h || host.endsWith('.' + h.replace(/^www\./, ''))
    );
    const res = await probeUrl(url);
    // Follow redirects count as ok for 2xx/3xx
    let verdict = 'pass';
    let note = '';
    if (res.status >= 200 && res.status < 400) {
      verdict = 'pass';
    } else if (unverifiable && (res.status === 403 || res.status === 999 || res.status === 0 || res.status === 999)) {
      verdict = 'unverifiable';
      note = `bot-blocked or restricted (${res.status || res.error || 'n/a'})`;
    } else if (unverifiable && res.status >= 400) {
      verdict = 'unverifiable';
      note = `status ${res.status}`;
    } else if (res.status === 0) {
      verdict = 'fail';
      note = res.error || 'no response';
    } else {
      verdict = 'fail';
      note = `status ${res.status}`;
    }
    // LinkedIn/Coursera/Drive: always treat 403/999 as unverifiable
    if (unverifiable && (res.status === 403 || res.status === 999)) {
      verdict = 'unverifiable';
      note = `bot-blocked (${res.status})`;
    }
    results.push({ ...res, host, verdict, note });
  }
  report.externalLinks = results;
  const fails = results.filter((r) => r.verdict === 'fail');
  for (const f of fails) {
    issue('P0', 'external-links', `External link failed: ${f.url}`, {
      file: 'index.html',
      selector: `a[href="${f.url}"]`,
      viewport: 'n/a',
      theme: 'n/a',
      reproduction: `HEAD/GET ${f.url} → ${f.status || f.error}`,
      suggestedFix: 'Update or remove the broken URL; confirm the destination is public.',
    });
  }
  setArea(
    'external-links',
    fails.length ? 'fail' : 'pass',
    `${results.filter((r) => r.verdict === 'pass').length} ok, ${results.filter((r) => r.verdict === 'unverifiable').length} unverifiable, ${fails.length} fail`
  );
}

async function checkOverflow(page, viewport, theme) {
  const findings = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const issues = [];
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
      issues.push({
        type: 'document-overflow',
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      });
    }
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      if (rect.width > vw + 2 && rect.height > 0) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const sel =
          el.id
            ? `#${el.id}`
            : el.className && typeof el.className === 'string'
              ? `${el.tagName.toLowerCase()}.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
              : el.tagName.toLowerCase();
        issues.push({
          type: 'wider-than-viewport',
          selector: sel,
          width: Math.round(rect.width),
          vw,
        });
      }
    }
    // text overflow / clipping heuristic (skip intentionally clipped SR-only nodes)
    for (const el of document.querySelectorAll('p, h1, h2, h3, h4, li, td, th, a, span, figcaption, button')) {
      if (el.classList?.contains('fx-count-sr') || el.getAttribute('aria-hidden') === 'true') continue;
      const style = getComputedStyle(el);
      if (style.overflow === 'hidden' || style.textOverflow === 'ellipsis') {
        if (el.scrollWidth > el.clientWidth + 2) {
          issues.push({
            type: 'text-clipped',
            selector: el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(' ')[0]}` : el.tagName,
            text: (el.textContent || '').trim().slice(0, 80),
          });
        }
      }
    }
    return issues.slice(0, 40);
  });

  for (const f of findings) {
    const sev = f.type === 'document-overflow' ? 'P0' : 'P1';
    issue(sev, 'layout', `Layout: ${f.type}`, {
      file: 'css/',
      selector: f.selector || 'html',
      viewport,
      theme,
      reproduction: `Load at ${viewport} theme=${theme}; observe ${JSON.stringify(f)}`,
      suggestedFix:
        f.type === 'document-overflow'
          ? 'Constrain wide children (min-width:0, overflow, fluid media) so scrollWidth ≤ clientWidth.'
          : 'Reduce fixed widths / padding or allow wrap so content fits the viewport.',
      detail: f,
    });
  }
  return findings;
}

async function checkAnchors(page) {
  return page.evaluate(() => {
    const anchors = [...document.querySelectorAll('a[href^="#"]')];
    const missing = [];
    const ok = [];
    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (!href || href === '#') continue;
      const raw = href.slice(1);
      // deep links like systems/mindpulse/shap are handled by JS hash router
      if (raw.includes('/')) {
        const root = raw.split('/')[0];
        if (!document.getElementById(root)) {
          missing.push({ href, reason: `root id #${root} missing` });
        } else {
          ok.push(href);
        }
        continue;
      }
      if (!document.getElementById(raw)) {
        missing.push({ href, reason: `no element with id="${raw}"` });
      } else {
        ok.push(href);
      }
    }
    return { ok, missing };
  });
}

async function checkScrollspy(page, viewport) {
  // Only meaningful when nav links are visible (desktop) or menu can open
  const results = [];
  const links = [
    { href: '#systems', id: 'systems' },
    { href: '#experience', id: 'experience' },
    { href: '#projects', id: 'projects' },
    { href: '#toolkit', id: 'toolkit' },
    { href: '#about', id: 'about' },
    { href: '#credentials', id: 'credentials' },
    { href: '#contact', id: 'contact' },
  ];

  for (const link of links) {
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ block: 'center' });
    }, link.id);
    await page.waitForTimeout(500);
    const active = await page.evaluate((href) => {
      const a = document.querySelector(`.nav-links a[href="${href}"]`);
      return a ? a.getAttribute('aria-current') === 'location' : false;
    }, link.href);
    results.push({ ...link, active });
  }
  return results;
}

async function checkKeyboard(page, viewport, theme) {
  const findings = {
    tabStops: [],
    missingFocus: [],
    skipLink: null,
    menuEscape: null,
    trap: null,
  };

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  // Skip link — assert DOM order (Playwright Tab from a cold body is unreliable)
  const skipOrder = await page.evaluate(() => {
    const focusables = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter((el) => {
        if (el.hasAttribute('disabled')) return false;
        const ti = el.getAttribute('tabindex');
        if (ti !== null && Number(ti) < 0) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== 'hidden' && cs.display !== 'none';
      });
    const first = focusables[0];
    return {
      count: focusables.length,
      className: first?.className || '',
      href: first?.getAttribute?.('href'),
      text: (first?.textContent || '').trim().slice(0, 40),
      isSkip: Boolean(first?.classList?.contains('skip-link')),
    };
  });
  findings.skipLink = skipOrder;
  if (!skipOrder.isSkip) {
    issue('P1', 'keyboard', 'Skip link not first focusable', {
      file: 'index.html',
      selector: 'a.skip-link',
      viewport,
      theme,
      reproduction: 'Inspect first focusable in DOM order',
      suggestedFix: 'Make .skip-link the first focusable element in DOM order.',
      detail: skipOrder,
    });
  } else {
    await page.locator('a.skip-link').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({
      id: document.activeElement?.id,
      hash: location.hash,
      mainTop: document.getElementById('main')?.getBoundingClientRect().top,
    }));
    findings.skipLink.after = after;
    if (after.id !== 'main' && after.hash !== '#main' && !(after.mainTop != null && after.mainTop < 120)) {
      const scrolled = await page.evaluate(() => window.scrollY);
      if (scrolled < 10 && after.mainTop > 200) {
        issue('P1', 'keyboard', 'Skip link did not move focus/scroll to #main', {
          file: 'index.html',
          selector: 'a.skip-link',
          viewport,
          theme,
          reproduction: 'Activate Skip to content',
          suggestedFix: 'Ensure #main is focusable (tabindex="-1") and receives focus on skip activation.',
        });
      }
    }
  }

  // Collect tab order + visible focus (capped)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const maxTabs = 80;
  const seen = new Set();
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const key = `${el.tagName}|${el.id}|${el.className}|${el.getAttribute('href')}|${(el.textContent || '').trim().slice(0, 40)}`;
      // visible focus: outline or box-shadow or ring via outline-width
      const hasFocus =
        (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
        (cs.boxShadow && cs.boxShadow !== 'none') ||
        cs.outlineOffset !== '0px';
      return {
        key,
        tag: el.tagName,
        id: el.id,
        className: typeof el.className === 'string' ? el.className : '',
        href: el.getAttribute?.('href'),
        text: (el.textContent || '').trim().slice(0, 60),
        hasFocus,
        outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
        inView: r.bottom > 0 && r.top < window.innerHeight,
        role: el.getAttribute('role'),
      };
    });
    if (!info) break;
    if (seen.has(info.key)) {
      // cycle detected — not necessarily a trap if we completed a full cycle of page focusables
      if (findings.tabStops.length > 5) {
        findings.trap = { kind: 'cycle', at: info };
        break;
      }
    }
    seen.add(info.key);
    findings.tabStops.push(info);
    if (!info.hasFocus) {
      findings.missingFocus.push(info);
    }
  }

  for (const m of findings.missingFocus.slice(0, 15)) {
    issue('P1', 'keyboard', `No visible focus indicator: ${m.tag}${m.id ? '#' + m.id : ''} ${m.text}`, {
      file: 'css/base.css / components',
      selector: m.id ? `#${m.id}` : m.className ? `.${m.className.split(' ')[0]}` : m.tag,
      viewport,
      theme,
      reproduction: 'Tab until this control is focused',
      suggestedFix: 'Ensure :focus-visible outline (signal) is not overridden; SVG nodes need CSS focus styles.',
      detail: m,
    });
  }

  // Mobile menu Escape
  if (viewport.width <= 1100) {
    const toggleVisible = await page.locator('#navToggle').isVisible().catch(() => false);
    if (toggleVisible) {
      await page.locator('#navToggle').click();
      await page.waitForTimeout(200);
      const open = await page.evaluate(() => document.getElementById('nav')?.dataset.open === 'true');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      const closed = await page.evaluate(() => document.getElementById('nav')?.dataset.open !== 'true');
      findings.menuEscape = { opened: open, closedAfterEscape: closed };
      if (!open || !closed) {
        issue('P1', 'keyboard', 'Mobile menu Escape open/close failed', {
          file: 'js/modules/nav.js',
          selector: '#navToggle / #navMenu',
          viewport,
          theme,
          reproduction: 'Open hamburger, press Escape',
          suggestedFix: 'Ensure Escape closes menu and restores focus to toggle.',
          detail: findings.menuEscape,
        });
      }
    }
  }

  return findings;
}

async function checkWorkbench(page, viewport, theme) {
  const findings = { tabs: [], nodes: {}, deepLink: null, layers: null, trace: null, stepper: null };

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.getElementById('systems')?.scrollIntoView());
  await page.waitForTimeout(400);

  const tabs = page.locator('[role="tab"]');
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i++) {
    const tab = tabs.nth(i);
    const id = await tab.getAttribute('data-system-id');
    await tab.click();
    await page.waitForTimeout(300);
    const selected = await tab.getAttribute('aria-selected');
    const hash = await page.evaluate(() => location.hash);
    findings.tabs.push({ id, selected, hash });
    if (selected !== 'true') {
      issue('P0', 'workbench', `System tab ${id} did not select`, {
        file: 'js/modules/systems.js',
        selector: `[data-system-id="${id}"]`,
        viewport,
        theme,
        reproduction: `Click systems tab ${id}`,
        suggestedFix: 'Fix selectSystem / aria-selected sync.',
      });
    }
  }

  // Deep link
  await page.goto(BASE + '/#systems/mindpulse/shap', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  findings.deepLink = await page.evaluate(() => {
    const tab = document.querySelector('[data-system-id="mindpulse"]');
    const node = document.querySelector('[data-node-id="shap"]');
    const ann = document.getElementById('systemsAnnotation');
    const step = document.querySelector('.systems-step[data-node-id="shap"]');
    return {
      hash: location.hash,
      tabSelected: tab?.getAttribute('aria-selected'),
      nodePressed: node?.getAttribute('aria-pressed'),
      annotation: (ann?.textContent || '').slice(0, 120),
      stepExpanded: step?.querySelector('button')?.getAttribute('aria-expanded'),
      svgHidden: document.getElementById('systemsSvg')?.hasAttribute('hidden'),
      stepperHidden: document.getElementById('systemsStepper')?.hasAttribute('hidden'),
    };
  });
  if (findings.deepLink.tabSelected !== 'true' || !String(findings.deepLink.annotation).includes('SHAP')) {
    issue('P0', 'workbench', 'Deep link #systems/mindpulse/shap did not select SHAP', {
      file: 'js/modules/systems.js',
      selector: '#systems',
      viewport,
      theme,
      reproduction: 'Open /#systems/mindpulse/shap',
      suggestedFix: 'Ensure hash parse selects system + node on init.',
      detail: findings.deepLink,
    });
  }

  // Mouse + keyboard node selection (desktop SVG)
  if (viewport.width >= 720) {
    await page.goto(BASE + '/#systems/mindpulse', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const node = page.locator('.systems-node[data-node-id="shap"]');
    if (await node.count()) {
      await node.click({ force: true });
      await page.waitForTimeout(200);
      const mouseSel = await page.evaluate(() => ({
        pressed: document
          .querySelector('.systems-node[data-node-id="shap"]')
          ?.getAttribute('aria-pressed'),
        hash: location.hash,
        ann: document.getElementById('systemsAnnotation')?.textContent,
      }));
      findings.nodes.mouse = mouseSel;
      if (mouseSel.pressed !== 'true') {
        issue('P0', 'workbench', 'Mouse node selection failed for shap', {
          file: 'js/modules/systems.js',
          selector: '.systems-node[data-node-id="shap"]',
          viewport,
          theme,
          reproduction: 'Click SHAP node',
          suggestedFix: 'Fix click handler / selection styles.',
        });
      }

      // Keyboard
      await page.locator('.systems-node[data-node-id="questionnaire"]').focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(150);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      findings.nodes.keyboard = await page.evaluate(() => ({
        active: document.activeElement?.getAttribute?.('data-node-id'),
        pressed: document
          .querySelector('.systems-node[aria-pressed="true"]')
          ?.getAttribute('data-node-id'),
        hash: location.hash,
      }));
    }

    // Layer toggles — legislative ebook has metrics
    await page.locator('[data-system-id="legislative-ebook"]').click();
    await page.waitForTimeout(300);
    const metrics = page.locator('.systems-layer input[value="metrics"]');
    if (await metrics.count()) {
      await metrics.check();
      await page.waitForTimeout(200);
      findings.layers = await page.evaluate(() => ({
        metricsChecked: document.querySelector('.systems-layer input[value="metrics"]')?.checked,
        dimmed: document.querySelectorAll('.systems-node.is-dimmed').length,
        metricsClass: document.querySelectorAll('.systems-node.is-metrics').length,
      }));
      if (!findings.layers.metricsChecked) {
        issue('P1', 'workbench', 'Metrics layer toggle did not stick', {
          file: 'js/modules/systems.js',
          selector: '.systems-layer input[value="metrics"]',
          viewport,
          theme,
          reproduction: 'Select Legislative eBook, check Metrics',
          suggestedFix: 'Fix layer checkbox state / applyLayerStyles.',
        });
      }
    }

    // Privacy layer on B4iGo
    await page.locator('[data-system-id="b4igo"]').click();
    await page.waitForTimeout(300);
    const privacy = page.locator('.systems-layer input[value="privacy"]');
    if (await privacy.count()) {
      await privacy.check();
      await page.waitForTimeout(200);
      const priv = await page.evaluate(() => ({
        checked: document.querySelector('.systems-layer input[value="privacy"]')?.checked,
        boundary: document.querySelector('.systems-privacy-boundary')?.getAttribute('visibility'),
      }));
      findings.layers = { ...findings.layers, privacy: priv };
      if (priv.boundary !== 'visible') {
        issue('P1', 'workbench', 'Privacy boundary not visible when Privacy layer on', {
          file: 'js/modules/systems.js',
          selector: '.systems-privacy-boundary',
          viewport,
          theme,
          reproduction: 'Select B4iGo, enable Privacy layer',
          suggestedFix: 'Toggle privacy boundary visibility with layer state.',
        });
      }
    }

    // Trace a request
    await page.locator('[data-system-id="mindpulse"]').click();
    await page.waitForTimeout(300);
    await page.locator('#systemsTrace').click();
    await page.waitForTimeout(400);
    findings.trace = await page.evaluate(() => ({
      label: document.getElementById('systemsTrace')?.textContent,
      pressed: document.getElementById('systemsTrace')?.getAttribute('aria-pressed'),
      tracing: document.querySelector('.systems-node.is-trace, .systems-edge.is-trace, .systems-traveler[visibility="visible"]') != null,
    }));
    // stop if still running
    const still = await page.locator('#systemsTrace').textContent();
    if (still?.includes('Stop')) {
      await page.locator('#systemsTrace').click();
      await page.waitForTimeout(200);
    }
    if (findings.trace.pressed !== 'true' && !findings.trace.tracing && findings.trace.label === 'Trace a request') {
      // might have finished instantly under reduced motion — soft check
      issue('P2', 'workbench', 'Trace a request did not visibly enter tracing state', {
        file: 'js/modules/systems.js',
        selector: '#systemsTrace',
        viewport,
        theme,
        reproduction: 'Click Trace a request on MindPulse',
        suggestedFix: 'Verify trace animation / aria-pressed updates.',
        detail: findings.trace,
      });
    }
  } else {
    // Mobile stepper
    await page.goto(BASE + '/#systems/mindpulse/shap', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    findings.stepper = await page.evaluate(() => {
      const stepper = document.getElementById('systemsStepper');
      const svg = document.getElementById('systemsSvg');
      return {
        stepperHidden: stepper?.hasAttribute('hidden'),
        svgHidden: svg?.hasAttribute('hidden'),
        stepCount: stepper?.querySelectorAll('.systems-step').length || 0,
        shapExpanded: stepper
          ?.querySelector('[data-node-id="shap"] button')
          ?.getAttribute('aria-expanded'),
      };
    });
    if (findings.stepper.stepperHidden || !findings.stepper.svgHidden) {
      issue('P0', 'workbench', 'Mobile stepper not shown (or SVG still visible) below 720px', {
        file: 'js/modules/systems.js / css/sections/systems.css',
        selector: '#systemsStepper',
        viewport,
        theme,
        reproduction: `Viewport ${viewport.width}px, open Systems`,
        suggestedFix: 'Ensure updateMode() hides SVG and shows stepper under 720px.',
        detail: findings.stepper,
      });
    } else if (findings.stepper.shapExpanded !== 'true') {
      issue('P1', 'workbench', 'Deep-linked SHAP step not expanded on mobile', {
        file: 'js/modules/systems.js',
        selector: '.systems-step[data-node-id="shap"]',
        viewport,
        theme,
        reproduction: 'Open #systems/mindpulse/shap at <720px',
        suggestedFix: 'Sync stepper expanded state with selected node.',
        detail: findings.stepper,
      });
    }
  }

  return findings;
}

async function checkContact(page, viewport, theme) {
  await page.goto(BASE + '/#contact', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const resume = await page.locator('#contact a[href*="drive.google.com"]').count();
  if (!resume) {
    issue('P0', 'contact', 'Resume link missing in contact', {
      file: 'index.html',
      selector: '#contact a[href*="drive.google.com"]',
      viewport,
      theme,
      reproduction: 'Open #contact',
      suggestedFix: 'Ensure Resume (PDF) link is present in contact-links.',
    });
  }

  // grant clipboard
  const context = page.context();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

  const copyBtn = page.locator('.contact-copy');
  await copyBtn.scrollIntoViewIfNeeded();
  await copyBtn.click();
  await page.waitForTimeout(400);
  const status = await page.locator('#copyStatus').textContent();
  const btnText = await copyBtn.textContent();
  let clip = '';
  try {
    clip = await page.evaluate(() => navigator.clipboard.readText());
  } catch {
    clip = '(clipboard read blocked)';
  }
  const ok =
    (status || '').includes('Copied') ||
    (btnText || '').includes('Copied') ||
    clip.includes('abhisriram15@gmail.com');
  if (!ok) {
    issue('P0', 'contact', 'Copy email button did not announce/copy', {
      file: 'js/modules/contact.js',
      selector: '.contact-copy / #copyStatus',
      viewport,
      theme,
      reproduction: 'Click Copy on contact section',
      suggestedFix: 'Ensure clipboard write succeeds and #copyStatus receives "Copied".',
      detail: { status, btnText, clip },
    });
  }
  return { resume: !!resume, status, btnText, clip, ok };
}

async function checkThemePersist(browser) {
  // Seed storage without a sticky init script (sticky scripts re-apply on every reload
  // and falsely fail the toggle→persist check).
  const seed = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
  });
  const seedPage = await seed.newPage();
  await seedPage.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await seedPage.evaluate(() => {
    try {
      localStorage.setItem('theme', 'dark');
    } catch (e) {}
  });
  await seed.close();

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
    storageState: undefined,
  });
  // Copy seeded origin storage via adding cookies/localStorage through a first navigation
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      localStorage.setItem('theme', 'dark');
    } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const early = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.waitForTimeout(100);
  const late = await page.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    return { theme: document.documentElement.dataset.theme, bg };
  });
  await page.locator('#themeToggle').click();
  await page.waitForTimeout(200);
  const stored = await page.evaluate(() => localStorage.getItem('theme'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  const afterReload = await page.evaluate(() => document.documentElement.dataset.theme);
  await context.close();

  const flashRisk = early !== 'dark';
  if (flashRisk) {
    issue('P1', 'theme', 'Theme not applied from localStorage before first paint path', {
      file: 'index.html (inline head script)',
      selector: 'html[data-theme]',
      viewport: '1280x800',
      theme: 'dark',
      reproduction: 'Set localStorage theme=dark, hard reload, check dataset.theme at DOMContentLoaded',
      suggestedFix: 'Keep blocking inline script before CSS; verify it runs.',
      detail: { early, late },
    });
  }
  if (stored !== 'light' || afterReload !== 'light') {
    issue('P0', 'theme', 'Theme toggle does not persist across reload', {
      file: 'js/modules/nav.js',
      selector: '#themeToggle',
      viewport: '1280x800',
      theme: 'light',
      reproduction: 'Toggle theme, reload',
      suggestedFix: 'Persist theme in localStorage and read in head script.',
      detail: { stored, afterReload },
    });
  }
  return { early, late, stored, afterReload, flashRisk };
}

async function checkReducedMotion(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'light');
    } catch (e) {}
  });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  // scroll full page
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, h);
  });
  await page.waitForTimeout(300);
  const visibility = await page.evaluate(() => {
    const hidden = [];
    document
      .querySelectorAll(
        '.reveal, .fx-reveal > *, .hero-enter, .field-log-item, .cred-entry, .log-entry, .about-sidenote, .about-optimise-item, .fx-marker'
      )
      .forEach((el) => {
        const cs = getComputedStyle(el);
        const opacity = parseFloat(cs.opacity);
        if (opacity < 0.9) {
          hidden.push({
            sel: el.className,
            opacity,
            transform: cs.transform,
          });
        }
      });
    return {
      hidden,
      revealIn: document.querySelectorAll('.reveal.is-in').length,
      revealTotal: document.querySelectorAll('.reveal').length,
      fxRevealIn: document.querySelectorAll('.fx-reveal.is-in').length,
    };
  });
  await context.close();
  if (visibility.hidden.length) {
    issue('P0', 'reduced-motion', 'Content still hidden under prefers-reduced-motion', {
      file: 'js/modules/reveal.js / css/effects.css',
      selector: '.reveal / .fx-reveal',
      viewport: '1280x800',
      theme: 'light',
      reproduction: 'Emulate prefers-reduced-motion: reduce, load and scroll',
      suggestedFix: 'Force opacity:1 / transform:none when reduced motion is set.',
      detail: visibility,
    });
  }
  return visibility;
}

async function checkEffects(browser) {
  const findings = {
    noJs: null,
    touchParity: null,
    focusMatchesHover: null,
    idleAnimations: null,
    longTasks: null,
  };

  // 1) No permanent invisibility without JS
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      colorScheme: 'light',
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(200);
    findings.noJs = await page.evaluate(() => {
      const htmlHasJs = document.documentElement.classList.contains('js');
      const hidden = [];
      document
        .querySelectorAll(
          '.reveal, .fx-reveal > *, .hero-enter, .hero-title-line, .field-log-item, .cred-entry, .about-sidenote, .about-optimise-item, .fx-marker, .hero-proof-cap'
        )
        .forEach((el) => {
          const cs = getComputedStyle(el);
          if (parseFloat(cs.opacity) < 0.9 || cs.visibility === 'hidden') {
            hidden.push({
              tag: el.tagName,
              className: String(el.className).slice(0, 80),
              opacity: cs.opacity,
            });
          }
        });
      return { htmlHasJs, hidden: hidden.slice(0, 20) };
    });
    await context.close();
    if (findings.noJs.htmlHasJs || findings.noJs.hidden.length) {
      issue('P0', 'effects', 'Content hidden without JavaScript', {
        file: 'css/effects.css / index.html',
        selector: '.js .fx-reveal / .reveal',
        viewport: '1280x800',
        theme: 'light',
        reproduction: 'Load with JavaScript disabled',
        suggestedFix: 'Gate entrance opacity behind .js only; never hide content without JS.',
        detail: findings.noJs,
      });
    }
  }

  // 2) Hover-only information also on touch + focus matches hover
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: 'light',
      hasTouch: true,
      isMobile: true,
    });
    await context.addInitScript(() => {
      try {
        localStorage.setItem('theme', 'light');
      } catch (e) {}
    });
    const page = await context.newPage();
    await page.goto(BASE + '/#toolkit', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    findings.touchParity = await page.evaluate(() => {
      const noted = document.querySelectorAll('.toolkit-tool--noted .toolkit-used-in');
      const visible = [...noted].filter((el) => {
        const cs = getComputedStyle(el);
        return parseFloat(cs.opacity) > 0.8 && cs.pointerEvents !== 'none';
      });
      return { noted: noted.length, visibleOnTouch: visible.length };
    });
    if (
      findings.touchParity.noted > 0 &&
      findings.touchParity.visibleOnTouch < findings.touchParity.noted
    ) {
      issue('P1', 'effects', 'Hover-only toolkit notes not available on touch', {
        file: 'css/sections/toolkit.css',
        selector: '.toolkit-used-in',
        viewport: '390x844',
        theme: 'light',
        reproduction: 'Load toolkit on touch / coarse pointer',
        suggestedFix: 'Keep used-in notes visible under (hover: none) or (pointer: coarse).',
        detail: findings.touchParity,
      });
    }
    await context.close();
  }

  // 3) Focus states match hover states for effect primitives
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'light',
    });
    await context.addInitScript(() => {
      try {
        localStorage.setItem('theme', 'light');
      } catch (e) {}
    });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const snap = async (locator, pseudo) =>
      locator.evaluate((el, pseudoSel) => {
        const cs = getComputedStyle(el, pseudoSel || undefined);
        return {
          transform: cs.transform,
          backgroundSize: cs.backgroundSize,
          borderTopColor: cs.borderTopColor,
          backgroundColor: cs.backgroundColor,
        };
      }, pseudo || null);

    const settle = () => page.waitForTimeout(280);

    const mismatches = [];
    const underline = page.locator('a.fx-underline').first();
    await underline.scrollIntoViewIfNeeded();
    await underline.hover();
    await settle();
    const uHover = await snap(underline);
    await page.mouse.move(0, 0);
    await underline.focus();
    await settle();
    const uFocus = await snap(underline);
    if (uHover.backgroundSize !== uFocus.backgroundSize) {
      mismatches.push({ sel: 'a.fx-underline', key: 'backgroundSize', hover: uHover, focus: uFocus });
    }

    // Log entries opt out of lift via .fx-tilt-none; hover/focus share background instead.
    await page.goto(BASE + '/#experience', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const press = page.locator('.log-entry.fx-press').first();
    await press.evaluate((el) => {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    });
    await press.hover();
    await settle();
    const pHover = await snap(press);
    await page.mouse.move(0, 0);
    await press.focus();
    await settle();
    const pFocus = await snap(press);
    if (pHover.backgroundColor !== pFocus.backgroundColor) {
      mismatches.push({ sel: '.log-entry.fx-press', key: 'backgroundColor', hover: pHover, focus: pFocus });
    }

    await page.goto(BASE + '/#projects', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const corners = page.locator('.case-file.fx-corners').first();
    await corners.evaluate((el) => {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    });
    await corners.hover();
    await settle();
    const cHover = await snap(corners, '::before');
    await page.mouse.move(0, 0);
    await corners.focus();
    await settle();
    const cFocus = await snap(corners, '::before');
    if (cHover.transform !== cFocus.transform) {
      mismatches.push({ sel: '.case-file.fx-corners::before', key: 'transform', hover: cHover, focus: cFocus });
    }

    const cssParity = await page.evaluate(async () => {
      let underlineFocus = false;
      let pressFocus = false;
      let cornersFocus = false;
      const texts = [];
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue; // cross-origin (fonts) — skip
        }
        for (const rule of rules || []) {
          const text = rule.cssText || '';
          texts.push(text.slice(0, 120));
          if (text.includes('.fx-underline:focus-visible')) underlineFocus = true;
          if (text.includes('.fx-press:focus-visible')) pressFocus = true;
          if (text.includes('.fx-corners:focus-within') || text.includes('.fx-corners:focus-visible')) {
            cornersFocus = true;
          }
        }
      }
      // Fallback: fetch same-origin effects.css if cssRules empty
      if (!underlineFocus || !pressFocus || !cornersFocus) {
        try {
          const css = await (await fetch('/css/effects.css')).text();
          if (css.includes('.fx-underline:focus-visible')) underlineFocus = true;
          if (css.includes('.fx-press:focus-visible')) pressFocus = true;
          if (css.includes('.fx-corners:focus-within') || css.includes('.fx-corners:focus-visible')) {
            cornersFocus = true;
          }
        } catch (e) {
          return { readable: false, error: String(e) };
        }
      }
      return { readable: true, underlineFocus, pressFocus, cornersFocus };
    });
    findings.focusMatchesHover = { mismatches, cssParity };
    if (mismatches.length) {
      issue('P1', 'effects', 'Focus state does not match hover for an effect primitive', {
        file: 'css/effects.css',
        selector: mismatches[0].sel,
        viewport: '1440x900',
        theme: 'light',
        reproduction: 'Hover then keyboard-focus the same control; compare computed styles',
        suggestedFix: 'Pair :hover motion with :focus-visible / :focus-within.',
        detail: mismatches,
      });
    }
    if (cssParity.readable && (!cssParity.underlineFocus || !cssParity.pressFocus || !cssParity.cornersFocus)) {
      issue('P1', 'effects', 'Focus styles missing for an effect primitive that has hover', {
        file: 'css/effects.css',
        selector: '.fx-underline / .fx-press / .fx-corners',
        viewport: '1440x900',
        theme: 'light',
        reproduction: 'Inspect :focus-visible rules vs :hover',
        suggestedFix: 'Pair every hover motion with :focus-visible / :focus-within.',
        detail: cssParity,
      });
    }
    await context.close();
  }

  // 4) No idle animations >3s except optional systems trace
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'light',
      reducedMotion: 'no-preference',
    });
    await context.addInitScript(() => {
      try {
        localStorage.setItem('theme', 'light');
      } catch (e) {}
    });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    // Let entrance + failsafe (≤3s) finish; stay idle with no scroll
    await page.waitForTimeout(3500);
    findings.idleAnimations = await page.evaluate(() => {
      const running = document.getAnimations({ subtree: true }).filter((a) => {
        if (a.playState !== 'running') return false;
        const el = a.effect?.target;
        const cls = el?.className?.toString?.() || '';
        const id = el?.id || '';
        // Optional Workbench trace traveler is allowed
        if (id === 'systemsTraveler' || cls.includes('systems-traveler') || cls.includes('systems-trail')) {
          return false;
        }
        // Still animating after the 3s idle budget
        return true;
      });
      return running.slice(0, 20).map((a) => {
        const el = a.effect?.target;
        return {
          name: a.animationName || a.id || 'js',
          currentTime: a.currentTime,
          target: el ? `${el.tagName}${el.id ? '#' + el.id : ''}.${String(el.className).slice(0, 40)}` : null,
        };
      });
    });
    if (findings.idleAnimations.length) {
      issue('P1', 'effects', 'Animation still running while idle past 3s', {
        file: 'css/effects.css / js/modules/effects.js',
        selector: findings.idleAnimations[0]?.target || 'document',
        viewport: '1440x900',
        theme: 'light',
        reproduction: 'Load page, wait 3.5s without scrolling; inspect getAnimations()',
        suggestedFix: 'Cap failsafe delays at 3s; avoid infinite loops except optional trace.',
        detail: findings.idleAnimations,
      });
    }
    await context.close();
  }

  // 5) No long tasks over 50ms during scroll (PerformanceObserver)
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'light',
    });
    await context.addInitScript(() => {
      try {
        localStorage.setItem('theme', 'light');
      } catch (e) {}
    });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    findings.longTasks = await page.evaluate(async () => {
      window.__longTasks = [];
      let observer = null;
      // Yield so load-time longtasks settle before we start measuring scroll
      await new Promise((r) => setTimeout(r, 1000));
      const scrollStart = performance.now();
      try {
        observer = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.startTime < scrollStart) continue;
            if (e.duration > 50) {
              window.__longTasks.push({ name: e.name, duration: e.duration, start: e.startTime });
            }
          }
        });
        observer.observe({ type: 'longtask', buffered: false });
      } catch (err) {
        return { supported: false, error: String(err), over50: [] };
      }
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 240) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 32));
      }
      window.scrollTo(0, h);
      await new Promise((r) => setTimeout(r, 200));
      observer.disconnect();
      return {
        supported: true,
        over50: window.__longTasks.slice(0, 20),
        max: window.__longTasks.reduce((m, t) => Math.max(m, t.duration), 0),
      };
    });
    if (findings.longTasks.supported && findings.longTasks.over50.length) {
      issue('P1', 'effects', `Long tasks >50ms during scroll (max ${Math.round(findings.longTasks.max)}ms)`, {
        file: 'js/modules/effects.js',
        selector: 'document',
        viewport: '1440x900',
        theme: 'light',
        reproduction: 'PerformanceObserver longtask while scrolling full page',
        suggestedFix: 'Share one IntersectionObserver; avoid layout work on scroll; drop idle will-change.',
        detail: findings.longTasks,
      });
    }
    await context.close();
  }

  setArea(
    'effects',
    report.issues.some((i) => i.area === 'effects' && (i.severity === 'P0' || i.severity === 'P1'))
      ? 'fail'
      : report.issues.some((i) => i.area === 'effects')
        ? 'warn'
        : 'pass',
    'no-js visibility, touch parity, focus=hover, idle≤3s, scroll longtasks'
  );
  return findings;
}

async function measureCls(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  // scroll full page slowly
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 300) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(80);
  }
  await page.evaluate((h) => window.scrollTo(0, h), height);
  await page.waitForTimeout(500);
  const cls = await page.evaluate(() => window.__cls || 0);
  return cls;
}

async function runAxe(page, viewport, theme) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const compact = {
    viewport,
    theme,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.slice(0, 8).map((n) => ({
        target: n.target,
        html: n.html?.slice(0, 200),
        failureSummary: n.failureSummary,
      })),
    })),
    incomplete: results.incomplete.length,
    passes: results.passes.length,
  };
  report.axe.push(compact);
  for (const v of compact.violations) {
    const sev = v.impact === 'critical' || v.impact === 'serious' ? 'P1' : 'P2';
    issue(sev, 'a11y-axe', `axe: ${v.id} — ${v.help}`, {
      file: 'index.html / css',
      selector: v.nodes[0]?.target?.join?.(' ') || '',
      viewport,
      theme,
      reproduction: `axe-core WCAG 2.1 AA at ${viewport} ${theme}`,
      suggestedFix: v.helpUrl || v.description,
      detail: { impact: v.impact, nodes: v.nodes.slice(0, 3) },
    });
  }
  return compact;
}

async function takeScreenshot(page, viewport, theme) {
  const name = `${viewport}_${theme}.png`;
  const file = path.join(SHOTS, name);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(name);
  return file;
}

async function main() {
  // Health check
  try {
    await fetch(BASE + '/');
  } catch (e) {
    console.error(`Server not reachable at ${BASE}. Start serve.mjs or python http.server first.`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  // External links once
  await withPage(browser, { width: 1280, height: 800, theme: 'light', colorScheme: 'light' }, async (page, logs) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await checkExternalLinks(page);
    report.console.push({ scope: 'external-pass', msgs: logs.consoleMsgs });
    report.network.push({ scope: 'external-pass', failed: logs.failedReqs });
  });

  // Theme persist + reduced motion + effects quality gates
  report.themePersist = await checkThemePersist(browser);
  report.reducedMotion = await checkReducedMotion(browser);
  report.effects = await checkEffects(browser);

  // CLS at desktop light
  await withPage(browser, { width: 1440, height: 900, theme: 'light', colorScheme: 'light' }, async (page) => {
    report.cls = await measureCls(page);
    if (report.cls > 0.1) {
      issue('P1', 'cls', `Cumulative layout shift while scrolling: ${report.cls.toFixed(4)}`, {
        file: 'css / fonts / reveal',
        selector: 'document',
        viewport: '1440x900',
        theme: 'light',
        reproduction: 'Load page, scroll full height while observing layout-shift entries',
        suggestedFix: 'Reserve space for fonts/diagrams; avoid late-injected height changes.',
      });
    } else if (report.cls > 0.05) {
      issue('P2', 'cls', `CLS while scrolling: ${report.cls.toFixed(4)} (under 0.1)`, {
        file: 'css',
        selector: 'document',
        viewport: '1440x900',
        theme: 'light',
        reproduction: 'Scroll full page',
        suggestedFix: 'Tighten late reveals / font metric overrides if noticeable.',
      });
    }
  });

  // Matrix: viewport × theme (localStorage) + also OS prefers via colorScheme
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const colorScheme = theme; // also emulate prefers-color-scheme
      await withPage(
        browser,
        { ...vp, theme, colorScheme },
        async (page, logs) => {
          await page.goto(BASE + '/', { waitUntil: 'networkidle' });
          await page.waitForTimeout(500);

          // console / network
          const errs = logs.consoleMsgs.filter((m) => m.type === 'error' || m.type === 'pageerror');
          const warns = logs.consoleMsgs.filter((m) => m.type === 'warning');
          const notFound = logs.failedReqs.filter((r) => r.status === 404);
          report.console.push({ viewport: vp.name, theme, msgs: logs.consoleMsgs });
          report.network.push({ viewport: vp.name, theme, failed: logs.failedReqs });
          for (const e of errs) {
            issue('P0', 'console', `Console error: ${e.text}`, {
              file: 'js/',
              selector: 'n/a',
              viewport: vp.name,
              theme,
              reproduction: `Open ${BASE} at ${vp.name} ${theme}`,
              suggestedFix: 'Fix the thrown error / missing resource.',
            });
          }
          for (const n of notFound) {
            issue('P0', 'network', `404: ${n.url}`, {
              file: 'index.html',
              selector: 'n/a',
              viewport: vp.name,
              theme,
              reproduction: `Load page; request ${n.url}`,
              suggestedFix: 'Add the missing asset or fix the URL (e.g. og.png).',
            });
          }

          // overflow
          await checkOverflow(page, vp.name, theme);

          // anchors
          const anchors = await checkAnchors(page);
          if (anchors.missing.length) {
            for (const m of anchors.missing) {
              issue('P0', 'anchors', `Broken in-page anchor ${m.href}`, {
                file: 'index.html',
                selector: `a[href="${m.href}"]`,
                viewport: vp.name,
                theme,
                reproduction: `Click or resolve ${m.href}`,
                suggestedFix: m.reason,
              });
            }
          }

          // scrollspy (one theme per viewport is enough — do light)
          if (theme === 'light') {
            const spy = await checkScrollspy(page, vp.name);
            report[`scrollspy_${vp.name}`] = spy;
            const inactive = spy.filter((s) => !s.active);
            // About/Toolkit order in page differs from nav numbers — scrollspy uses IO so mid-page may miss
            for (const s of inactive) {
              issue('P1', 'scrollspy', `Nav link ${s.href} did not receive aria-current when section centered`, {
                file: 'js/modules/nav.js',
                selector: `.nav-links a[href="${s.href}"]`,
                viewport: vp.name,
                theme,
                reproduction: `Scroll #${s.id} into center; check aria-current`,
                suggestedFix: 'Tune IntersectionObserver rootMargin/threshold or ensure section ids match.',
              });
            }
          }

          // axe (all combos — expensive but requested)
          await page.goto(BASE + '/', { waitUntil: 'networkidle' });
          await runAxe(page, vp.name, theme);

          // screenshot
          await takeScreenshot(page, vp.name, theme);
        }
      );
    }
  }

  // Keyboard pass — sample mobile + desktop, both themes
  for (const sample of [
    { width: 390, height: 844, name: '390x844' },
    { width: 1440, height: 900, name: '1440x900' },
  ]) {
    for (const theme of THEMES) {
      await withPage(browser, { ...sample, theme, colorScheme: theme }, async (page) => {
        report[`keyboard_${sample.name}_${theme}`] = await checkKeyboard(page, sample, theme);
      });
    }
  }

  // Workbench — mobile + desktop, light (+ dark deep link check)
  for (const sample of [
    { width: 390, height: 844, name: '390x844' },
    { width: 1440, height: 900, name: '1440x900' },
  ]) {
    for (const theme of THEMES) {
      try {
        await withPage(browser, { ...sample, theme, colorScheme: theme }, async (page) => {
          report[`workbench_${sample.name}_${theme}`] = await checkWorkbench(page, sample, theme);
        });
      } catch (err) {
        issue('P0', 'workbench', `Workbench check threw: ${err.message}`, {
          file: 'js/modules/systems.js',
          selector: '#systems',
          viewport: sample.name,
          theme,
          reproduction: 'Automated workbench interaction suite',
          suggestedFix: 'Investigate stack; harden selectors against duplicate data-node-id.',
          detail: { stack: String(err.stack || err).slice(0, 500) },
        });
      }
    }
  }

  // Contact
  await withPage(browser, { width: 1280, height: 800, theme: 'light', colorScheme: 'light' }, async (page) => {
    report.contact = await checkContact(page, '1280x800', 'light');
  });

  // Also test prefers-color-scheme without localStorage theme
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      colorScheme: scheme,
    });
    // clear theme key
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('theme');
      } catch (e) {}
    });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const applied = await page.evaluate(() => {
      const themeAttr = document.documentElement.dataset.theme || null;
      const bg = getComputedStyle(document.body).backgroundColor;
      const ink = getComputedStyle(document.body).color;
      return { themeAttr, bg, ink };
    });
    report[`prefers_${scheme}`] = applied;
    // dark scheme without data-theme should still look dark via CSS media query
    const isDarkBg = applied.bg.match(/rgb\(\s*(\d+)/);
    const r = isDarkBg ? Number(isDarkBg[1]) : 255;
    if (scheme === 'dark' && r > 100) {
      issue('P1', 'theme', 'prefers-color-scheme: dark not reflected when localStorage theme unset', {
        file: 'css/tokens.css',
        selector: ':root',
        viewport: '1280x800',
        theme: 'os-dark',
        reproduction: 'Clear localStorage theme; set OS dark; reload',
        suggestedFix: 'Verify @media (prefers-color-scheme: dark) :root:not([data-theme]) tokens.',
        detail: applied,
      });
    }
    if (scheme === 'light' && r < 100) {
      issue('P1', 'theme', 'prefers-color-scheme: light shows dark paper', {
        file: 'css/tokens.css',
        selector: ':root',
        viewport: '1280x800',
        theme: 'os-light',
        reproduction: 'Clear localStorage theme; set OS light; reload',
        suggestedFix: 'Default tokens should be paper light.',
        detail: applied,
      });
    }
    await context.close();
  }

  // Area rollup
  const byArea = {};
  for (const i of report.issues) {
    byArea[i.area] = byArea[i.area] || { P0: 0, P1: 0, P2: 0 };
    byArea[i.area][i.severity] = (byArea[i.area][i.severity] || 0) + 1;
  }
  for (const [area, counts] of Object.entries(byArea)) {
    const status = counts.P0 ? 'fail' : counts.P1 ? 'fail' : counts.P2 ? 'warn' : 'pass';
    if (!report.areas[area]) setArea(area, status, JSON.stringify(counts));
    else {
      report.areas[area].status = status;
      report.areas[area].note = JSON.stringify(counts);
    }
  }
  // Explicit expected areas
  const expected = [
    'console',
    'network',
    'layout',
    'anchors',
    'scrollspy',
    'external-links',
    'a11y-axe',
    'keyboard',
    'workbench',
    'contact',
    'theme',
    'reduced-motion',
    'cls',
    'effects',
  ];
  for (const a of expected) {
    if (!report.areas[a]) setArea(a, 'pass', 'no issues recorded');
  }

  report.finishedAt = new Date().toISOString();
  report.issueCounts = {
    P0: report.issues.filter((i) => i.severity === 'P0').length,
    P1: report.issues.filter((i) => i.severity === 'P1').length,
    P2: report.issues.filter((i) => i.severity === 'P2').length,
  };

  const outFile = path.join(OUT, 'audit.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outFile}`);
  console.log(`Issues: P0=${report.issueCounts.P0} P1=${report.issueCounts.P1} P2=${report.issueCounts.P2}`);
  console.log(`Screenshots: ${report.screenshots.length} in ${SHOTS}`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
