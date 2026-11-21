# Changelog

## Harden & ship pass

### Cleanup
- Removed `css/legacy.css` and its stylesheet link.
- Dropped unused legacy bridges and dead selectors in `css/base.css` / `css/components.css` (`btn-ghost`, `btn-solid`, `.section.alt`, `.nav-cta`, `.hero-badge-dot`).
- Removed empty `js/modules/about.js` and `js/modules/projects.js`; stripped unused reveal observer from `nav.js`.
- Confirmed no hard-coded colour or font-stack values outside `css/tokens.css` (print palette overrides live there too).

### SEO & sharing
- Refined `<title>` and meta description; added canonical, Open Graph, Twitter card, per-scheme `theme-color`, and Person JSON-LD.
- Added `img/favicon.svg` (replacing PNG-as-favicon), `img/og.svg` (1200×630), `robots.txt`, `sitemap.xml`, and on-brand `404.html`.
- Note: export `img/og.svg` → `img/og.png` for most social crawlers.

### Accessibility
- Single `h1`, logical heading order, landmarks (`header` / `main` / `footer` / labelled `nav`).
- Visible `:focus-visible` rings; aria labels on icon-only controls (theme toggle, menu, copy).
- Credentials reveal gated behind `.js` and restored on `:focus-within` / reduced motion so content is never hidden from keyboard or AT users.
- Toolkit “used in” notes no longer use `visibility: hidden` (keeps links in the tab order).
- Contact-band hover keeps paper-on-ink (signal failed AA on the inverted surface).
- Trace / diagram motion is decorative; reduced-motion paths keep content reachable.

### Contrast
- Light `--ink-3` darkened to `#6B675C` (AA 4.5:1 on `--paper` and `--paper-2`).
- Added `--selection-fg` so marker selection text stays AA in both themes.
- Decorative `--rule` hairlines intentionally below 3:1 (not required UI chrome).

### Performance
- Preconnect + preload for primary latin woff2 files; `font-display: swap` via Google Fonts.
- `size-adjust` / metric-override fallback faces to limit late-font layout shift.
- Module script remains deferred by default; SVG diagrams already declare width/height.

### Print
- New `css/print.css`: single column, black on white, hides nav / theme toggle / Workbench SVG / Contact band, appends URLs after links, avoids breaks inside entries.

### Docs
- Added this changelog and `README.md` (local serve + how to add a system).
