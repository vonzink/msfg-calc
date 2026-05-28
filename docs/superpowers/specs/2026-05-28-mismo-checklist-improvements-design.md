# Conditions & Documents (MISMO) Calculator Improvements — Design

**Date:** 2026-05-28
**Scope:** `public/js/calculators/mismo.js`, `public/js/calculators/mismo-docs.js`, `public/js/shared/mismo-doc-parser.js`, `views/calculators/mismo.ejs`, `public/css/calculators/mismo.css`
**Calculator:** Conditions & Documents (`/calculators/mismo`)

## Goal

Six targeted improvements to the Conditions & Documents checklist: wrap condition cells, shorten borrower prefixes to first name, fix a duplicated section heading in copy/email output, add a one-line color legend, add an "Urgent" severity category, and replace the "Property Type" heading cell with "Days to Closing".

## Background — current structure

- `mismo-doc-parser.js` parses the uploaded MISMO XML into a `data` object (borrowers, employments, assets, liabilities, REO, subject property, etc.). It does **not** currently parse any closing/disbursement date.
- `mismo-docs.js` generates condition objects `{ name, status, reason }` across four sections (income, general, assets, credit). Borrower-specific conditions are prefixed with `tag = b.name + ':'` (full name, e.g. `"SAM W SAWAGED:"`).
- `mismo.js` is the orchestrator: parses → builds `checklistState[section]` arrays → renders editable rows (`createItemRow`) → populates the Loan Summary cells (`updateLoanSummary` / `setKV`) → registers the CalcActions email/copy provider.
- The editable checklist row is a CSS grid `110px 1fr 1fr 28px`: status `<select>` | name `<input>` | reason `<input>` | delete button.
- Status values today: `required`, `conditional`, `incomplete`, `ok` (labeled "Cleared").
- The copy/email output (CalcActions provider) renders each section with a `heading` plus a first "count" row, then one stacked row per item with a colored bullet (`required`=#c62828, `conditional`=#b8960c, `ok`=#2e7d32, `incomplete`=#1565c0).
- The Loan Summary grid (`mismo.ejs`) has 8 cells: Borrower(s), Loan Purpose, Loan Type, Loan Amount, **Property Type** (`kvPropertyType`, shows e.g. "FeeSimple"), Occupancy, LTV, Subject Property.

## Non-goals

- No change to the underlying condition-generation logic (which docs are required for which loan scenario) beyond the borrower-name prefix.
- No change to the informational sections (employment timeline, risk score, attention flags).
- The property-type value is still parsed and still drives condition logic; only its **display cell** in the heading is repurposed.
- No persistence backend changes — everything stays in the existing `__calcState` / sessionStorage model.

---

## Change 1 — Condition cells wrap

### Problem

The name and reason cells in `createItemRow` (mismo.js) are `<input type="text">`, which clip long text and scroll horizontally instead of wrapping.

### Fix

Convert both `nameInput` and `reasonInput` from `<input type="text">` to auto-growing `<textarea>`:

- `textarea`, `rows=1`, `class` unchanged (`mismo-doc-item__name` / `mismo-doc-item__reason`).
- Value set via `.value`; `input` listener still writes back to `item.name` / `item.reason`.
- Auto-grow helper: on `input` and once after insertion, set `el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px';`.
- The grid row's `align-items` becomes `start` (or `stretch`) so the status select and delete button align to the top while the text cells grow downward.

### CSS

In `mismo.css` `.mismo-doc-item__name` / `__reason`:
- `white-space: normal; overflow: hidden; resize: vertical; line-height: 1.4; min-height: <one row>;`
- Remove any `white-space: nowrap` / `text-overflow: ellipsis` on those cells.
- `.mismo-doc-item { align-items: start; }`

---

## Change 2 — Borrower prefix shows first name only

### Problem

`mismo-docs.js` line 268: `const tag = b.name + ':';` produces conditions like `"SAM W SAWAGED: Personal tax returns…"`. The full name is verbose and repeats on every borrower-specific line.

### Fix

Introduce a `firstName(fullName)` helper and use it for the tag:

```js
function firstName(full) {
  if (!full) return '';
  const token = String(full).trim().split(/\s+/)[0] || '';
  // Title-case: "SAM" -> "Sam"
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}
// ...
const tag = firstName(b.name) + ':';
```

Result: `"Sam: Personal tax returns…"`.

The **Loan Summary "Borrower(s)" cell is unchanged** — it still shows the full name(s) joined with commas (that lives in `mismo.js` `updateLoanSummary`, which is not modified for this change).

### Edge cases

- Single-token name (`"CHER"`) → `"Cher"`.
- Empty name → empty prefix (existing behavior of an empty tag string is acceptable).

---

## Change 3 — Copy/email drops the duplicated section name

### Problem

In `mismo.js` the CalcActions provider's `buildSection(heading, sectionKey)` pushes the section with `heading: heading` (e.g. "Income Documentation") **and** a first row `{ label: heading, value: countParts, isTotal: true }`. The email renderer prints the section heading and then the first row's label — so "Income Documentation" appears twice, followed by the count.

### Fix

Keep the section `heading`. Change the first row so its **label is the count text** and its value is empty:

```js
rows.push({ label: countParts.join('  ·  ') || 'None', value: '', isTotal: true });
```

Rendered result:
```
Income Documentation
3 required · 1 conditional
●  Sam: Personal tax returns (1040s) — 2025
   — Self-employed …
```

No other rows change.

---

## Change 4 — One-line color legend

### Problem

Copy/email lines use colored bullets with no label per line (the status isn't spelled out), so the reader can't tell what a bullet color means. On-screen rows are also color-coded by status.

### Fix

Add a single legend row, rendered once near the top of the output (and on-screen above the first checklist section).

**Copy/email:** as the first section (before "Loan Summary") OR as a dedicated row immediately under the title. Implementation: push a synthetic legend section/row to the CalcActions payload:

```js
sections.push({
  heading: 'Legend',
  rows: [{
    label: '🔴 Urgent   🔴 Required   🟡 Conditional   🟢 Received   🔵 Incomplete',
    value: '',
    isTotal: false
  }]
});
```

Placed before the Loan Summary section so it reads as a key. (Urgent and Required both render as red bullets in the body; the legend text distinguishes them by order/word. The email bullet colors differ — Urgent darker — even though the legend emoji is the same red.)

**On-screen:** a compact one-line strip (`.mismo-legend`) inserted above the first `.mismo-checklist-section` (in `mismo.ejs`), e.g.:

```html
<div class="mismo-legend" id="mismoLegend">
  <span class="mismo-legend__item mismo-legend__item--urgent">Urgent</span>
  <span class="mismo-legend__item mismo-legend__item--required">Required</span>
  <span class="mismo-legend__item mismo-legend__item--conditional">Conditional</span>
  <span class="mismo-legend__item mismo-legend__item--ok">Received</span>
  <span class="mismo-legend__item mismo-legend__item--incomplete">Incomplete</span>
</div>
```

Each item shows a small colored dot (`::before`) matching the row/bullet color. One line, wraps only on very narrow screens.

---

## Change 5 — "Urgent" severity category

### Problem

No way to flag a condition as urgent. Requested: a dark-red background with red lettering, a distinct category in the per-item dropdown.

### Fix

Add `urgent` as a new status across the stack:

**Dropdown (`createItemRow`, mismo.js):** add `'urgent'` as the first option:
```js
var statusLabels = { urgent: 'Urgent', required: 'Required', conditional: 'Conditional', incomplete: 'Incomplete', ok: 'Cleared' };
['urgent', 'required', 'conditional', 'incomplete', 'ok'].forEach(function (s) { … });
```

**Row CSS (`mismo.css`):** new modifier:
```css
.mismo-doc-item--urgent {
  background: #3a0d0d;      /* dark red */
}
.mismo-doc-item--urgent .mismo-doc-item__name,
.mismo-doc-item--urgent .mismo-doc-item__reason {
  color: #ff5252;          /* red lettering */
  background: transparent;
}
.mismo-doc-item--urgent .mismo-doc-item__status { color: #ff5252; }
```
(Final hex values tuned during implementation for contrast/readability; intent = dark-red field, red text.)

**Section counts (`updateSectionCounts`, mismo.js):** count urgent first:
```js
const urgent = items.filter(i => i.status === 'urgent').length;
// parts: urgent first, then required, conditional, incomplete
if (urgent > 0) parts.push(urgent + ' urgent');
```

**Copy/email counts (`buildSection`):** same — include `urgent` first in `countParts`.

**Copy/email bullet color (`buildSection`):** add urgent → `#8b0000` (darker than required's #c62828):
```js
bulletColor: item.status === 'urgent' ? '#8b0000' :
             item.status === 'required' ? '#c62828' :
             item.status === 'conditional' ? '#b8960c' :
             item.status === 'ok' ? '#2e7d32' :
             item.status === 'incomplete' ? '#1565c0' : '#666'
```

**Ordering:** in `renderChecklist`, render urgent items first within their section so they surface at the top. Sort a shallow copy by a status rank (`urgent` < `required` < `conditional` < `incomplete` < `ok`) before creating rows; do not mutate `checklistState` order (preserve insertion order in state; sort only the render pass). Copy/email `buildSection` applies the same sort to its `items` iteration.

**Default status:** newly generated conditions and manually added items keep their existing defaults (`required` for added items). Nothing is auto-marked urgent — it's a manual escalation.

---

## Change 6 — "Days to Closing" replaces the "Property Type" heading cell

### Parser (`mismo-doc-parser.js`)

Add extraction of an estimated closing date. MISMO 3.4 commonly carries it under a `CLOSING_INFORMATION` container or a `*ClosingDate` / `EstimatedClosingDate` element. Implementation:

- Search the document for the first present of a small candidate list of element local-names: `EstimatedClosingDate`, `ClosingDate`, `EstimatedClosingDateTime`, `LoanScheduledClosingDate`, `DisbursementDate`. Use the existing namespace-aware `getElementsByTagNameNS` helper pattern.
- Parse via the existing `parseDate`. Store as `data.estimatedClosingDate` (a `Date` or `null`).

### Orchestrator (`mismo.js` `updateLoanSummary`)

Replace the `kvPropertyType` population with a "Days to Closing" computation:

- If `data.estimatedClosingDate` is a valid future/!null date: `days = ceil((closing - todayMidnight) / 86400000)`. Show `"<days> days (<Mon D>)"`, e.g. `"23 days (Jun 20)"`. If the date is in the past, show `"Past due (<Mon D>)"`.
- If no parsed date: render an inline `<input type="date">` in the cell (id `kvClosingDateInput`). On `change`, recompute and persist the chosen date into calc state; display flips to the `"<days> days (<Mon D>)"` form with a small "edit" affordance to reopen the picker.

### View (`mismo.ejs`)

Replace the Property Type cell:
```html
<div class="mismo-kv">
  <div class="mismo-kv-label">Days to Closing</div>
  <div class="mismo-kv-value" id="kvClosing">&mdash;</div>
</div>
```
(The `kvPropertyType` id is removed from the heading grid. Property type remains available internally via `data.propertyType` for condition logic.)

### State persistence (`__calcState`)

The manually-entered closing date (when MISMO lacks one) must survive save/restore. Add the chosen date (ISO string) to the `__calcState.save()` payload and re-apply it in `restore()`. The existing save/restore already serializes the summary cells; extend it to carry `closingDateOverride`.

---

## Files touched

| File | Changes |
|---|---|
| `public/js/shared/mismo-doc-parser.js` | Parse `estimatedClosingDate` from candidate elements |
| `public/js/calculators/mismo-docs.js` | `firstName()` helper; `tag = firstName(b.name) + ':'` |
| `public/js/calculators/mismo.js` | Textarea cells + auto-grow; urgent in dropdown/counts/render-sort; Days-to-Closing summary + editable fallback + persistence; email builder count-row fix, legend row, urgent bullet/count |
| `views/calculators/mismo.ejs` | Heading cell → Days to Closing; on-screen legend strip |
| `public/css/calculators/mismo.css` | Textarea wrap; `.mismo-doc-item--urgent`; `.mismo-legend` |

## Verification

1. `npm run build && npm test` — existing 331 tests pass (none touch mismo DOM internals).
2. `npm run lint` — no new errors in touched files (`.min.js` pre-existing warnings tolerated).
3. Manual at `localhost:3000/calculators/mismo`:
   - Upload a sample MISMO. Long condition names/reasons wrap instead of clipping.
   - Borrower-specific conditions read "Sam:" not "SAM W SAWAGED:". Loan Summary still shows full name.
   - Set an item to "Urgent" → row turns dark red with red text; it sorts to the top of its section; section count shows "1 urgent · …".
   - Days to Closing cell: with a MISMO that has a closing date → shows "<n> days (Mon D)"; with one that lacks it → date picker appears, picking a date shows the day count; reload restores it.
   - Copy to clipboard / Email: section name appears once, followed by the count line; a one-line legend appears near the top; urgent bullets are darker red.

## Out of scope (future)

- Auto-escalating conditions to "Urgent" based on closing proximity (e.g. < 7 days). Manual-only for now.
- Surfacing property type elsewhere in the heading (it moved out; not re-added).
- Per-borrower color coding of conditions.
