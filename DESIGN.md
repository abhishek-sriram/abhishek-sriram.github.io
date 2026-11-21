# Applied AI Field Journal

Design contract for this site. A printed engineering journal, built by an engineer who understands product design. Read this before any UI work.

The page is static HTML, CSS, and vanilla JS. No build step, no framework, no npm dependencies. Shared tokens live in `css/tokens.css`. Section prompts may change markup inside their own section; they may not invent a second palette.

## Palette — light, "paper"

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F3EFE6` | Page background |
| `--paper-2` | `#EBE6DA` | Inset panels, secondary surface |
| `--ink` | `#16150F` | Headlines, body, primary button fill |
| `--ink-2` | `#4A473D` | Secondary text |
| `--ink-3` | `#6B675C` | Tertiary text, captions (AA 4.5:1 on paper) |
| `--rule` | `#D6D0C0` | Hairlines, the lower stroke of a double rule |
| `--signal` | `#B8401A` | The only accent. Focus rings, rare emphasis |
| `--diagram-blue` | `#1E3A5F` | Diagrams and schematics only |
| `--marker` | `#F3D98B` | Text selection, highlighter |

## Palette — dark, "night edition"

Applied when `document.documentElement.dataset.theme === "dark"`, and when no `data-theme` is set and the OS prefers dark.

| Token | Hex |
|---|---|
| `--paper` | `#12110D` |
| `--paper-2` | `#1A1914` |
| `--ink` | `#ECE7DA` |
| `--ink-2` | `#B9B3A3` |
| `--ink-3` | `#8A8576` |
| `--rule` | `#2E2B22` |
| `--signal` | `#E8744A` |
| `--diagram-blue` | `#8FB3E0` |

TODO(abhishek): night-edition `--marker` was not specified. Dark theme keeps the light marker `#F3D98B` until you confirm a value.

Do not hard-code these hex values outside `css/tokens.css`.

## Type

Load from Google Fonts with `display=swap`, and only the weights in use.

| Role | Family | Weights |
|---|---|---|
| Headlines and body | Newsreader | 400, 500, italic 400 |
| UI, buttons, nav | Instrument Sans | 400, 500 |
| Kickers, figure captions, data, tags | JetBrains Mono | 400 |

Fluid scale:

- Body: `clamp(1.0625rem, 1rem + 0.3vw, 1.125rem)`
- h1: `clamp(2.5rem, 5vw + 1rem, 5rem)`
- h2: `clamp(1.75rem, 2.5vw + 1rem, 2.75rem)`

Body line-height is 1.6. Prose measure is 65ch (`.prose`).

## Layout

- 12-column grid on `.page`: `repeat(12, minmax(0, 1fr))`, column gap 24px.
- Page max-width: 1200px, centered.
- Prose: 65ch.
- Spacing scale, and nothing off it: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.

Vertical margin rules, 1px at 8% ink, sit on the left and right edges of that 1200px column and run the full viewport height.

## Components

- `.kicker` — JetBrains Mono, uppercase, 0.75rem, letter-spacing 0.08em. Example: `§ 02 Experience`.
- `.fig` / `.fig-caption` — caption is mono, pattern `Fig. 1 - ...`.
- `.rule-double` — 3px ink stroke, then 4px of paper, then a 1px `--rule` stroke.
- `.btn` — rectangular, radius 2px, 1px ink border. Primary (`.btn-primary`) is ink fill with paper text.
- `.link-arrow` — underlined text link with a trailing arrow.
- `.tag` — mono, square brackets drawn around the label, as in `[RAG]`.

`.section` opens with the same double rule.

## Motion

150–250ms, `ease-out`. Animate opacity and `translateY(8px)` only. Honor `prefers-reduced-motion` on every transition and animation, including JS that tracks the pointer.

## Background

`body` is `--paper`. A fixed `body::before` lays an SVG `feTurbulence` grain at 3% opacity, `mix-blend-mode: multiply` in light and `screen` in dark. No other texture.

## Theme

An inline script in `<head>`, before any stylesheet, sets `document.documentElement.dataset.theme` from `localStorage.getItem('theme')` inside try/catch. Absent key means follow the OS. Do not flash the wrong theme.

## Forbidden

Gradients, glows, blurred orbs, glassmorphism, `backdrop-filter`, box-shadows, pill badges, pulsing dots, emoji, border-radius above 2px, centred hero layouts, uniform grids of identical hover-lift cards, neon / emerald / purple accents, stock icon rows, lorem ipsum, invented metrics or claims.

## Content

Never invent facts about the owner. Use only what is already in `index.html`. If a fact is missing, leave `TODO(abhishek): ...` in the markup or a comment. Do not guess dates, employers, metrics, or links.

## Files

Shared tokens in `css/tokens.css`. Section styles in `css/sections/`. Print rules in `css/print.css`.
