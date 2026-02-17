# MSFG Calculator Suite

Mortgage calculator suite for Mountain States Financial Group. Express 5 / EJS server-rendered multi-page app — no build step, no TypeScript, no bundler.

## Quick Start

```bash
npm install
npm run dev          # nodemon with auto-restart
npm start            # production (use PM2 in prod: pm2 start ecosystem.config.js)
```

Server runs on `http://localhost:3000` (configurable via `PORT` in `.env`).

## Architecture

### Server Side
- **`server.js`** — Express entry point. Mounts middleware (helmet, cookie-parser), static files, routes, and error handler.
- **`routes/`** — Route handlers:
  - `index.js` — Hub page (`/`)
  - `calculators.js` — All calculator routes (`/calculators/*`). General calcs use a data-driven `generalCalcs[]` array; income calcs use a similar `incomeCalcs[]` array. To add a new calculator, add one entry to the array.
  - `workspace.js` — Multi-calculator workspace (`/workspace`)
  - `report.js` — Session report viewer (`/report`)
  - `settings.js` — Admin settings (`/settings`, requires `SETTINGS_PASSWORD`)
- **`config/`**:
  - `calculators.json` — Master list of all 28+ calculators (slug, name, category, icon, description). Used by hub, workspace, and route registration.
  - `site.json` — Mutable branding config (site name, logo). Read fresh each request so settings changes take effect immediately.
- **`views/`** — EJS templates with `express-ejs-layouts`. Layout is `views/layouts/main.ejs`.

### Client Side
- **`public/js/shared/utils.js`** — Shared utilities on `window.MSFG` namespace: `parseNum`, `formatCurrency`, `formatPercent`, `formatNumber`, `calcMonthlyPayment`, `toggleCalcSteps`.
- **`public/js/shared/report.js`** — Report manager. Captures calculator screenshots via html2canvas → base64 JPEG, stores in IndexedDB. Handles both EJS pages (header button) and standalone pages (floating button).
- **`public/js/calculators/<slug>.js`** — Per-calculator logic. Each uses the `MSFG.*` utilities.
- **`public/js/hub.js`** — Hub page search/filter.
- **`public/js/workspace.js`** — Workspace panel management with postMessage tallying between iframes.

### Legacy Calculators
Some calculators are standalone HTML apps served via iframe stubs during migration:
- `llpm-calc/`, `batch-llpm/`, `gen-calc/mismo-calc/` — Served directly at `/calculators/llpm`, etc.
- `income/`, `refi-calc/`, `fha-calc/`, `gen-calc/`, `calc-reo/`, `buydown-calc/` — Served at `/legacy/*` for iframe embedding.
- `amort-calc/` — Static SPA at `/calculators/amortization`.

### CSS
- `public/css/` — Modern styles. `components.css` is the design system. Calculator-specific CSS in `public/css/calculators/`.
- `css/` — Legacy global styles (served at `/css/*` as fallback for legacy HTML pages).

## Conventions

### JavaScript Style
- **ES5 with `var`** — No `const`/`let`, no arrow functions, no template literals in client-side code. Server-side (Node) uses modern JS.
- **`'use strict'`** at the top of every JS file.
- **IIFE pattern** for calculator scripts that don't need global functions:
  ```js
  (function() {
    'use strict';
    // ...
  })();
  ```
- Files that expose functions via inline `onclick` handlers (e.g. `va-prequal.js`) use file-level strict mode without IIFE.
- **`MSFG` namespace** — All shared utilities live on `window.MSFG`. Never add bare globals.

### Adding a New Calculator
1. Add entry to `config/calculators.json` (slug, name, category, icon, description).
2. Add entry to `generalCalcs[]` in `routes/calculators.js` (slug, view, title, optional css/cdnScripts).
3. Create EJS template: `views/calculators/<slug>.ejs`.
4. Create JS file: `public/js/calculators/<slug>.js`.
5. Optionally create CSS: `public/css/calculators/<slug>.css` (and set `css: '<slug>'` in the route entry).

### Templates
- All calculator pages use `views/layouts/main.ejs` layout.
- Calculator templates receive: `title`, `calc` (from calculators.json), `extraHead` (optional CSS/scripts), `extraScripts`.
- Use `<%- include('../partials/show-calculations', { calcId: 'slug' }) %>` for the collapsible math steps section.

## Security
- **Helmet** with CSP — scripts only from `'self'`, cdnjs.cloudflare.com, cdn.jsdelivr.net.
- **SRI hashes** on all CDN scripts (html2canvas, Chart.js, jsPDF).
- **Settings auth** — Cookie-based, controlled by `SETTINGS_PASSWORD` env var. Empty = open (dev mode).
- **postMessage validation** — Workspace validates `e.origin` before processing iframe messages.
- **Scoped legacy mounts** — Only specific legacy directories are exposed, not the project root.

## Environment Variables
```
PORT=3000              # Server port
NODE_ENV=development   # Node environment
SETTINGS_PASSWORD=     # Admin password for /settings (empty = no auth)
```

## NPM Scripts
```bash
npm start              # Start production server
npm run dev            # Start with nodemon (auto-restart)
npm test               # Run smoke tests
npm run lint           # Run ESLint
npm run lint:fix       # Run ESLint with auto-fix
```

## Deployment
- AWS EC2 behind nginx reverse proxy
- PM2 process manager (`ecosystem.config.js`)
- `deploy/` directory contains deployment scripts and nginx config
