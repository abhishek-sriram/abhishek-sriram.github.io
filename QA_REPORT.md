# QA Report — Applied AI Field Journal

**Date:** 2026-11-22 (post-effects re-run)  
**URL under test:** `http://127.0.0.1:8000/`  
**Method:** Playwright + axe-core (`qa/audit.spec.mjs`, `qa/verify-extras.mjs`), Lighthouse desktop/mobile, full-page + section screenshots in `qa/screenshots/` (pre-effects archive in `qa/screenshots/before-effects/`).  
**Note:** Site served with `node qa/serve.mjs`. Effects kit in `css/effects.css` + `js/modules/effects.js`; shared IntersectionObserver; failsafe delays capped at 3s.

---

## Before / after — Lighthouse

| Form factor | Metric | Before (pre-effects) | After (this run) | Δ |
|---|---|---:|---:|---|
| Desktop | Performance | **98** | **99** | +1 |
| Desktop | Accessibility | **100** | **100** | 0 |
| Desktop | Best Practices | **100** | **100** | 0 |
| Desktop | SEO | **100** | **100** | 0 |
| Desktop | LCP | 1.1 s | 0.7 s | better |
| Desktop | CLS | 0.004 | 0.01 | within &lt;0.02 |
| Desktop | TBT | 0 ms | 0 ms | 0 |
| Mobile | Performance | **85** | **89** | +4 |
| Mobile | Accessibility | **100** | **100** | 0 |
| Mobile | Best Practices | **100** | **100** | 0 |
| Mobile | SEO | **100** | **100** | 0 |
| Mobile | LCP | 3.5 s | 2.8 s | better |
| Mobile | CLS | 0 | 0 | 0 |
| Mobile | TBT | 170 ms | 150 ms | −20 |

Raw JSON: `qa/lighthouse/summary.json` (prior snapshot: `qa/lighthouse/summary.before.json`).

**Perf budget:** Effects did **not** cost more than 2 performance points (desktop +1, mobile +4). Targets met for desktop Perf 95+, A11y/BP/SEO 100, CLS &lt;0.02, TBT &lt;100ms. Mobile Perf 89 and TBT 150ms remain below the aspirational 95 / 100ms bars (same long-standing LCP/TBT path as before; not an effects regression).

---

## Summary — pass / fail by area

| Area | Result | Notes |
|---|---|---|
| Console errors / warnings | **PASS** | No page/console errors across 5×2 viewport/theme matrix |
| Failed requests / 404s | **PASS** | No failed document/asset requests; `/img/og.png` → 200 |
| Horizontal overflow / clipped text | **PASS** | `scrollWidth ≤ clientWidth`; SR-only `.fx-count-sr` excluded from clip heuristic |
| In-page anchors | **PASS** | All `#…` targets resolve |
| Nav scrollspy | **PASS** | DOM § order matches nav |
| External links | **PASS** | 13 OK; LinkedIn unverifiable (405/bot) |
| axe-core WCAG 2.1 AA | **PASS** | 0 violations across matrix (toolkit used-in links use `--ink` for AA on `paper-2`) |
| Keyboard / focus / skip / menu | **PASS** | Skip is first focusable; `#main` receives focus; menu Escape OK |
| Workbench | **PASS** | Tabs, nodes, trace, layers, deep link, mobile stepper |
| Contact copy + Resume | **PASS** | Copy + Resume link |
| Theme persist / no flash | **PASS** | Persist verified without sticky `addInitScript` |
| `prefers-reduced-motion` | **PASS** | Reveals / fx / hero content visible under reduce |
| Effects quality gates | **PASS** | No-JS visible; touch used-in parity; focus≈hover; idle animations clear after 3s; no scroll longtasks &gt;50ms |
| Cumulative layout shift | **PASS** | Desktop CLS 0.01; mobile 0 |
| Lighthouse scores | **RECORDED** | See before/after table |
| Visual / hierarchy | **PASS** | Featured case corners toned down; no section busier than peers |

### Effects checklist (new)

| Check | Result |
|---|---|
| No permanently invisible content without JS | Pass (`.js` gates + noscript fallback) |
| Hover-only info also on touch | Pass (toolkit `used-in` visible under coarse/no-hover) |
| Focus states match hover | Pass (underline / press background / corners) |
| No idle animation &gt;3s except optional trace | Pass |
| No long tasks &gt;50ms during scroll | Pass (shared IO; no idle `will-change`) |

---

## Issues (ranked)

### P0 — broken

*None.*

### P1 — clear UX / accessibility defects

*None open from this re-run.* Prior P1s (section order, axe nested-interactive, skip focus, og.png, mobile annotation, null Why/Trade-off) remain **FIXED**.

### P2 — polish (deferred, unchanged)

1. Toolkit densify — deferred (layout).  
2. Hero proof caption weight — deferred.  
3. Project index empty Result cells — deferred (no invented facts).  
4. Mobile LCP / TBT under aspirational 95 / 100ms — deferred (font/LCP path; improved vs before but not at target).  
5. Dual “back to top” — deferred.  
6. Systems tabs wrap on mid widths — deferred.

---

## Visual compare (effects)

| Section | Verdict |
|---|---|
| Hero | Keep counts + marker on signal phrase; quiet. |
| Systems | Keep stamp/trace; optional trace only while active. |
| Experience | Keep `.fx-press.fx-tilt-none` (border/bg only). |
| Projects | **Toned down** — featured `.fx-corners` no longer always-on at 28% opacity; hover/focus only. Marker on MindPulse quote **keep**. |
| Toolkit | Keep pipe draw + transform-only layer titles (opacity fade removed — was A11y CLS trap). |
| About | Marker on lede **keep**; one accent is enough. |
| Credentials / Contact | Quiet; no extra chrome. |

**Recommendation:** Keep underline, marker (sparingly), press+tilt-none, count, reveal, page-turn, read-progress. Keep corners on the lead case only as hover/focus. Do not add more markers or simultaneous entrance stacks. Mobile Perf/TBT aspirational targets need font/LCP work, not fewer effects.

---

## Automated evidence

| Artifact | Path |
|---|---|
| Audit JSON | `qa/results/audit.json` (P0=0 P1=0 P2=0) |
| Full-page shots | `qa/screenshots/*.png` |
| Pre-effects archive | `qa/screenshots/before-effects/` |
| Section crops | `qa/screenshots/crops/` |
| Lighthouse | `qa/lighthouse/` |
| Runner | `qa/audit.spec.mjs`, `qa/verify-extras.mjs`, `qa/serve.mjs` |
