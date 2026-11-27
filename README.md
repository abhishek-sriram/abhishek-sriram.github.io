# Abhishek Sriram

Personal site. Static HTML, CSS, and ES modules. No build step and no npm dependencies for the site.

Live: [https://abhishek-sriram.github.io/](https://abhishek-sriram.github.io/)

## Run locally

From the repo root:

```bash
npx --yes serve -l 8080
```

Open the local URL `serve` prints. Modules use ES imports, so opening `index.html` via `file://` will not load the scripts.

## Edit

Visible copy lives in `index.html`.

System diagrams live in `js/data/systems.js`. Each system needs `id`, `title`, `status`, `summary`, `nodes`, and `edges`. If `why`, `tradeoff`, or `metric` is unknown, leave it `null` and mark the gap with a `TODO(owner)` comment. Reload and open `#systems/<id>`.

The hero search index lives in `js/data/index.js`. Copy each entry from `index.html`.

Toolkit names live in two places that must stay in step: the list in `index.html`, and `js/data/toolkit.js`. Each tool once per mode.

Colour, type, and radius live in `css/tokens.css`. Motion durations live in `js/core/motion.config.js`.
