# Applied AI Field Journal

Personal portfolio for **Abhishek Sriram** — static HTML, CSS, and vanilla JS. No build step, no framework, no npm dependencies for the site itself.

Live site: [https://abhishek-sriram.github.io/](https://abhishek-sriram.github.io/)

## Run locally

Any static file server works. From the repo root:

```bash
npx --yes serve -l 8080
```

Then open `http://localhost:8080/` (or the Local URL `serve` prints).

Modules use ES imports, so opening `index.html` via `file://` will not load scripts correctly.

## Design

Read [`DESIGN.md`](DESIGN.md) before changing UI. Colours, type, and spacing tokens live only in [`css/tokens.css`](css/tokens.css).

## Add a system to the Workbench

1. Open [`js/data/systems.js`](js/data/systems.js).
2. Append an object to the `systems` export with:
   - `id` — URL slug (`#systems/<id>`)
   - `title`, `status`, `summary`
   - optional `note`, `links`
   - `nodes` — each with `id`, `label`, `kind`, `col`, `row`, `what`, and optional `why` / `tradeoff` / `metric` / `layers`
   - `edges` — `{ from, to, label?, layers? }` using node ids
3. Facts only from published copy. If a rationale or metric is unknown, leave `null` and a `TODO(abhishek): …` comment.
4. Reload the page and open `#systems/<id>`.

Link to a system from elsewhere with `#systems/<id>` or `#systems/<id>/<nodeId>`.

## Social image

`img/og.svg` is the source for Open Graph / Twitter cards. Export a **1200×630 PNG** to `img/og.png` — most social crawlers do not fetch SVG.

```bash
# Example with Inkscape or similar:
# inkscape img/og.svg --export-filename=img/og.png -w 1200 -h 630
```

## Lighthouse

With Chrome installed:

```bash
npx --yes lighthouse http://localhost:8080/ --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless" --quiet
```
