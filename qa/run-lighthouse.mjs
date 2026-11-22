/**
 * Run Lighthouse desktop + mobile against BASE_URL and write JSON + summary.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const OUT = path.join(__dirname, 'lighthouse');
fs.mkdirSync(OUT, { recursive: true });

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, {
      cwd: __dirname,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr || stdout || `exit ${code}`));
      else resolve({ stdout, stderr });
    });
  });
}

function summarize(jsonPath) {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const cats = raw.categories || {};
  const audits = raw.audits || {};
  return {
    performance: Math.round((cats.performance?.score || 0) * 100),
    accessibility: Math.round((cats.accessibility?.score || 0) * 100),
    bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
    seo: Math.round((cats.seo?.score || 0) * 100),
    lcp: audits['largest-contentful-paint']?.numericValue,
    lcpDisplay: audits['largest-contentful-paint']?.displayValue,
    cls: audits['cumulative-layout-shift']?.numericValue,
    clsDisplay: audits['cumulative-layout-shift']?.displayValue,
    tbt: audits['total-blocking-time']?.numericValue,
    tbtDisplay: audits['total-blocking-time']?.displayValue,
  };
}

async function main() {
  const desktopOut = path.join(OUT, 'desktop.json');
  const mobileOut = path.join(OUT, 'mobile.json');

  console.log('Lighthouse desktop…');
  await run([
    'lighthouse',
    BASE,
    '--preset=desktop',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json',
    `--output-path=${desktopOut}`,
    '--chrome-flags=--headless --no-sandbox',
    '--quiet',
  ]);

  console.log('Lighthouse mobile…');
  await run([
    'lighthouse',
    BASE,
    '--form-factor=mobile',
    '--screenEmulation.mobile',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json',
    `--output-path=${mobileOut}`,
    '--chrome-flags=--headless --no-sandbox',
    '--quiet',
  ]);

  const summary = {
    desktop: summarize(desktopOut),
    mobile: summarize(mobileOut),
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
