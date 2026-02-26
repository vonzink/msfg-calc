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
- **`server.js`** — Express entry point. Mounts middleware (helmet, compression, cookie-parser), static files, routes, and error handler.
- **`routes/`** — Route handlers:
  - `index.js` — Hub page (`/`)
  - `calculators.js` — All calculator routes (`/calculators/*`). General calcs use a data-driven `generalCalcs[]` array; income calcs use a similar `incomeCalcs[]` array. To add a new calculator, add one entry to the array.
  - `workspace.js` — Multi-calculator workspace (`/workspace`)
  - `report.js` — Session report viewer (`/report`)
  - `settings.js` — Admin settings (`/settings`, requires `SETTINGS_PASSWORD`)
  - `api.js` — AI extraction API (`/api/ai/extract`, rate-limited)
- **`config/`**:
  - `calculators.json` — Master list of all 28+ calculators (slug, name, category, icon, description). Used by hub, workspace, and route registration.
  - `site.json` — Mutable branding config (site name, logo). Read fresh each request so settings changes take effect immediately.
  - `ai-prompts/` — Per-calculator AI extraction prompts (YAML).
- **`views/`** — EJS templates with `express-ejs-layouts`. Layout is `views/layouts/main.ejs`.

### Client Side
- **`public/js/shared/utils.js`** — Shared utilities on `window.MSFG` namespace: `parseNum`, `formatCurrency`, `formatPercent`, `formatNumber`, `calcMonthlyPayment`, `toggleCalcSteps`, `escHtml`.
- **`public/js/shared/file-upload-utils.js`** — Shared file upload utilities on `MSFG.FileUpload`: `validateFile`, `setZoneStatus`, `initDropZone`.
- **`public/js/shared/report.js`** — Report manager. Captures structured calculator data, stores in IndexedDB. Lazy-loads report templates on first capture.
- **`public/js/shared/report-templates.js`** — Report template registry (loaded eagerly only on `/report` page, lazy-loaded elsewhere).
- **`public/js/calculators/<slug>.js`** — Per-calculator logic. Each uses the `MSFG.*` utilities.
- **`public/js/hub.js`** — Hub page search/filter.
- **`public/js/workspace.js`** — Workspace panel management with postMessage tallying between iframes.

### Legacy Calculators
Some calculators are standalone HTML apps served via iframe stubs during migration:
- `llpm-calc/`, `batch-llpm/` — Served directly at `/calculators/llpm`, etc.
- `income/`, `refi-calc/`, `fha-calc/`, `gen-calc/`, `calc-reo/`, `buydown-calc/` — Served at `/legacy/*` for iframe embedding.
- `amort-calc/` — Static SPA at `/calculators/amortization`.

### CSS
- `public/css/` — Modern styles. `components.css` is the design system. Calculator-specific CSS in `public/css/calculators/`.
- `css/` — Legacy global styles (served at `/css/*` as fallback for legacy HTML pages).

## Conventions

### JavaScript Style
- **ES6+** — Use `const`/`let` (prefer `const`), arrow functions, and template literals in both client-side and server-side code. No `var`.
- **`'use strict'`** at the top of every JS file.
- **IIFE pattern** for all calculator scripts — no bare globals:
  ```js
  (function() {
    'use strict';
    // ...
  })();
  ```
- **`addEventListener` only** — Never use inline `onclick`/`onchange` attributes in new templates. Bind all events via `addEventListener` in the JS file's `DOMContentLoaded` handler. Use `data-action` attributes for action buttons.
- **`MSFG` namespace** — All shared utilities live on `window.MSFG`. Never add bare globals.
- **`MSFG.escHtml(str)`** — Use for HTML escaping. Do not define local `escHtml` functions in calculator files.
- **`MSFG.FileUpload`** — Use for upload zone initialization. Do not duplicate `validateFile`/`setZoneStatus`/drag-drop handlers.

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
- Report templates are lazy-loaded on calculator pages (loaded on demand when "Add to Report" is clicked).

## Security
- **Helmet** with CSP — scripts only from `'self'`, cdnjs.cloudflare.com, cdn.jsdelivr.net. No `unsafe-inline` in `script-src`.
- **SRI hashes** on all CDN scripts (html2canvas, Chart.js, jsPDF).
- **Settings auth** — POST-based login with timing-safe password comparison, token-based sessions via httpOnly cookie. Controlled by `SETTINGS_PASSWORD` env var. Empty = open (dev mode).
- **CSRF protection** — Double-submit cookie pattern on all settings POST routes. Include `<input type="hidden" name="_csrf" value="<%= csrfToken %>">` in every form.
- **Rate limiting** — `express-rate-limit` on AI extraction (10 req/min) and AI test (5 req/min) endpoints.
- **Error sanitization** — Client-facing error responses use generic messages; raw errors logged server-side only.
- **Logo upload** — PNG/JPG/WebP only (no SVG), MIME + extension validation, forced output filename.
- **postMessage validation** — Workspace validates `e.origin` before processing iframe messages.
- **Scoped legacy mounts** — Only specific legacy directories are exposed, not the project root.

## Performance
- **Compression** — `compression` middleware (gzip/brotli) on all responses.
- **Cache headers** — Static files served with `maxAge: 30d` in production. Cache-busted via `?v=<git-hash>`.
- **Lazy report templates** — ~150KB of report template JS loaded on demand (not on every page load).

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
npm test               # Run smoke + math + integration tests (42 tests)
npm run lint           # Run ESLint
npm run lint:fix       # Run ESLint with auto-fix
```

## Deployment
- AWS EC2 behind nginx reverse proxy
- PM2 process manager (`ecosystem.config.js`)
- `deploy/` directory contains deployment scripts and nginx config
