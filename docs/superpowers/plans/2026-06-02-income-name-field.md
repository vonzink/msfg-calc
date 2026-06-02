# Income Calculator Name Field → Session Report

## Problem

When multiple income calculators (especially K-1s) are added to a session report, every block renders an identical heading ("Schedule K-1 Income") and generic subtitle ("K-1 #1"), so the underwriter cannot tell which K-1 belongs to which company. Renaming the workspace panel does **not** help — `workspace.js:301` passes the original calc `name`, not the edited `panel.label`, so the rename never reaches the export.

## Solution (approved design)

Add an **optional name field** (`id="entityName"`) to each income calculator. The report capture reads it straight from the captured DOM (same mechanism `schedule-b`/`schedule-e` already use). When filled, the name labels that calculator everywhere in the report; blank falls back to today's defaults.

User decisions (2026-06-02):
- **Scope:** all 13 income calculators (form-appropriate labels).
- **Placement:** BOTH — green entry heading AND the section subtitle.
- **Panel rename:** also wire it — `workspace.js` passes `panel.label` so existing renames flow into the report heading.

## Architecture facts (verified)

- Extractors receive a live DOM snapshot; `helpers.txt(doc, id)` reads `doc.getElementById(id).value`. So a new `id="entityName"` input is readable with zero changes to the extractor plumbing.
- Entry **heading** = `item.name`, set at capture time in `report.js → addItem({ name })`. Composed from the `<h1>` (standalone) or the name passed by `workspace.js` (workspace).
- Section **subtitle** = `data.sections[].title`, produced by each extractor in `report-templates/income-standard.js` (12 calcs) and `income-special.js` (`rental-1038`).
- `pdfIncomeTable` / `renderIncomeTable` render `sec.title` verbatim — no heading text of their own; the green heading is drawn by the report page from `item.name`.
- `workspace.js:301` is inside a closure where `panel` is in scope (`panel.instanceId` used at :317); `panel.label` holds the live edited label (default = `name`).
- 13 numeric income calcs: `1040, 1065, 1120, 1120s, 1120s-k1, k1, rental-1038, schedule-b, schedule-c, schedule-d, schedule-e, schedule-e-subject, schedule-f`. `questionnaire.ejs` is the legacy stub — **exclude** (no extractor).

## Tasks

### Task 1 — Shared partial + style
Create `views/partials/income-name-field.ejs`:
- A `.calc-name-field` block: `<label for="entityName">` + `<input type="text" id="entityName" maxlength="80" autocomplete="off">`.
- Accept an include local `nameLabel` (string) for the label text; default `'Borrower / Entity Name'` when not provided (`typeof nameLabel !== 'undefined' ? nameLabel : 'Borrower / Entity Name'`).
- Placeholder e.g. `e.g. ABC Holdings LLC`. Small helper line: `Shown as this calculator's label in the session report (optional).`
- No inline JS, no inline handlers. Reuse existing form input styling; add a small rule to `public/css/calculators/income-base.css` for `.calc-name-field` spacing if needed.

### Task 2 — Include partial in all 13 income EJS
Insert immediately after the description `<p>` inside `.calc-page__header` in each file, passing a form-appropriate `nameLabel`:
- `k1.ejs` → `'Partnership Name'`
- `1065.ejs` → `'Partnership Name'`
- `1120.ejs` → `'Corporation Name'`
- `1120s.ejs` → `'S-Corporation Name'`
- `1120s-k1.ejs` → `'S-Corp Name'`
- `schedule-c.ejs` → `'Business Name'`
- `schedule-f.ejs` → `'Farm Name'`
- `rental-1038.ejs` → `'Property / Entity Name'`
- `schedule-e.ejs` → `'Borrower Name'`
- `schedule-e-subject.ejs` → `'Subject Property Name'`
- `schedule-b.ejs` → `'Borrower Name'`
- `schedule-d.ejs` → `'Borrower Name'`
- `1040.ejs` → `'Borrower Name'`
Pattern: `<%- include('../../partials/income-name-field', { nameLabel: 'Partnership Name' }) %>`
DO NOT touch `questionnaire.ejs`.

### Task 3 — report.js: compose heading from entityName
In `MSFG.Report.captureStructured` (report.js ~line 349, after `const calcDoc = resolveCalcDocument(baseDoc);`):
```js
let finalName = calcName;
const nameField = calcDoc.getElementById('entityName');
const entity = nameField && nameField.value ? nameField.value.trim() : '';
if (entity && finalName.indexOf(entity) === -1) finalName = finalName + ' — ' + entity;
```
Then pass `name: finalName` to `addItem` instead of `name: calcName`. (Generic — harmless for non-income calcs that lack the field.)

### Task 4 — workspace.js: pass panel label
`workspace.js:301`: change `MSFG.Report.captureStructured(slug, name, icon, baseDoc)` to `MSFG.Report.captureStructured(slug, panel.label || name, icon, baseDoc)`. No regression: `panel.label` defaults to `name` until renamed.

### Task 5 — income-standard.js subtitles
For the single-entity business forms, set the **primary** section title from `txt(doc,'entityName')` with the existing default as fallback. Keep ownership badges and all rows unchanged.
- `k1`: section 1 title `txt(doc,'entityName') || 'K-1 #1'` (others stay `K-1 #2/#3/#4`).
- `1120s-k1`: same (`|| 'K-1 #1'`).
- `1065`: partnership 1 title `txt(doc,'entityName') || 'Partnership 1'`.
- `1120s`: S-Corp 1 title `|| 'S-Corporation 1'`.
- `1120`: title `|| 'Form 1120 C-Corporation'`.
- `schedule-c`: business 1 title `|| 'Business 1'`.
- `schedule-f`: title `|| 'Farm Income'`.
- `schedule-d`: title `|| 'Capital Gains / Losses'`.
Leave multi-section / already-named extractors' subtitles unchanged (`1040`, `schedule-b`, `schedule-e`, `schedule-e-subject`) — the heading (Task 3) covers those.

### Task 6 — income-special.js: rental-1038
Read `rental-1038`'s extractor. If it emits a section `title` (or a heading row), set it from `txt(doc,'entityName')` with its current default as fallback. If its structure has no natural title slot, heading-only (Task 3) is sufficient — note that in the commit.

### Task 7 — Verify, commit, push, deploy
`npm run build && npm test && npm run lint` (lint clean on changed source). Manual spot-check: open `/calculators/k1`, type a name, Add to Report, open `/report`, confirm heading + subtitle show the name; repeat one workspace panel rename. Commit (atomic per task is fine), `git push origin main`, then surface `cd ~/msfg-calc && bash deploy/update.sh`.
