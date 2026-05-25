# Workspace Multi-Instance + Multi-Slot Calc Restructure — Design

**Date:** 2026-05-25
**Scope:** `public/js/workspace.js`, `views/workspace.ejs`, 5 income calc EJS templates, 5 income calc JS files.
**Predecessor:** 2026-05-23 income calculator polish pass (commit `821754d` shipped the shared `MSFG.IncomeCalc` module; this builds on top).

## Goal

Enable users to add multiple instances of the same calculator to the workspace, each with a user-editable label (e.g. company name, property address). Collapse five multi-slot income calculators to a single entity per page; the workspace becomes the only way to enter multiple entities.

## Motivation

Today the workspace silently rejects a second instance of the same slug. The K-1 calculators (and several other multi-entity calcs) work around this by cramming 4 or 2 hardcoded entity slots into one page. This is awkward when each entity needs a distinct label, and the slot count is arbitrary.

After this change:

- One K-1 = one workspace panel = one company.
- One Schedule E = one workspace panel = one property.
- Adding "another K-1 for company B" means adding another panel from the selector.
- Each panel header shows an editable label that defaults to the calculator's display name.

## Non-goals

- **No label storage on the calc page itself.** The label lives in workspace panel state only. Standalone calc pages (outside `/workspace`) have no label concept, and print / email / CSV from there continues to show the calc title only.
- **No URL shape change for `?add=`.** Same comma-separated slug list, but repeated slugs now create separate instances instead of being silently deduped.
- **No backend storage.** Everything still lives in `sessionStorage`. Future "saved workspaces" feature is a separate spec.
- **No report-template restructuring.** Today the report captures by slug; this spec keeps that. With multi-instance, two instances of the same slug will collide in the report — flagged as a follow-up.
- **No template changes outside the 5 named calc templates and `workspace.ejs`.**

## Architecture

Three coordinated changes:

1. **Workspace panel identity** — `addPanel` switches from slug-keyed to `instanceId`-keyed. `instanceId` is generated via `crypto.randomUUID()` on add.
2. **Panel header label** — each panel header gains an editable label field that defaults to the calc's display name and persists in panel state.
3. **Multi-slot calc collapse** — five calc templates + JS modules drop their extra hardcoded entity slots, reducing each to a single entity.

The changes are coupled at the user-experience level but mostly independent at the code level: workspace.js / workspace.ejs change knows nothing about calc internals; the calc collapses know nothing about workspaces.

## Components

### Workspace (`public/js/workspace.js`, `views/workspace.ejs`)

**`addPanel(slug, name, icon, opts?)` signature widened:**

```js
function addPanel(slug, name, icon, opts) {
  opts = opts || {};
  const instanceId = opts.instanceId || ('wsi-' + crypto.randomUUID());
  const label = opts.label || name;
  // ... (no longer returns early on duplicate slug)
  const panel = {
    instanceId,
    slug,
    label,
    icon,
    zoom: opts.zoom || DEFAULT_ZOOM,
    tally: { monthlyPayment: 0, loanAmount: 0, cashToClose: 0, monthlyIncome: 0 }
  };
  activePanels.push(panel);
  // DOM id is now ws-panel-${instanceId}
}
```

**Selector buttons:**

- No longer toggle `.active` to lock out re-add.
- Each click calls `addPanel(slug, name, icon)` with no `opts` — a fresh instance.
- Show a small badge with the current instance count of that calc type (e.g. "K-1 ×3"). When count is 0, no badge.

**Panel header DOM (in the JS template-literal that builds panel HTML):**

The current `name` text in the header becomes:

```html
<div class="ws-panel__label" contenteditable="true" spellcheck="false">{label}</div>
```

with an `input` event handler that:
- writes the new value back into `panel.label`,
- calls `saveAllPanels()` to persist,
- enforces a max length (e.g. 80 chars; trim by JS, never via HTML attribute since contenteditable doesn't honor it).

Empty label after edit defaults back to the calculator's display name.

**Selector "active" state** — currently used both for the visual indicator in the selector drawer and to prevent duplicates. We retain it as an indicator (selector button gets `.active` when one or more instances of that slug exist) but it no longer blocks add.

### Persistence (`sessionStorage`)

Two keys change shape:

**`msfg-workspace-panels`**

Before:
```js
[{ slug, name, icon, zoom }, ...]
```

After:
```js
[{ instanceId, slug, label, icon, zoom }, ...]
```

**`msfg-workspace-inputs`**

Before:
```js
{ [slug]: { _api, data, ... }, ... }
```

After:
```js
{ [instanceId]: { _api, data, ... }, ... }
```

**Migration on load:**

In `restorePanels()`, before parsing each entry:

```js
if (!p.instanceId) {
  p.instanceId = p.slug;          // 1:1 carry-over (input map keyed by slug also matches)
  p.label = p.label || p.name;
}
```

After the first save under the new shape, old data naturally dies.

### URL `?add=` shape

Unchanged: comma-separated slug list. Each slug in the list now creates one new instance (instead of being deduped after the first occurrence). Example:

- `?add=income/k1` → 1 K-1 panel.
- `?add=income/k1,income/k1,income/k1` → 3 K-1 panels.

The auto-add loop reads slugs in order and calls `addPanel(slug, name, icon)` once per occurrence with no `opts`.

### Workspace tally

Tally currently sums monthly income values from each panel by reading the calc's DOM via `MSFG.WS.applyZoomToIframe`-adjacent helpers. The reader is keyed by `panel` (object), not by slug — so multi-instance just works. No change.

### Multi-slot calc collapse (5 files)

For each of `k1`, `1120s-k1`, `schedule-c`, `1065`, `1120s`:

**EJS template** — delete the second (and through fourth, for K-1) entity section. Result:

- `k1.ejs`: 4 sections → 1 section.
- `1120s-k1.ejs`: 4 sections → 1 section.
- `schedule-c.ejs`: 2 business sections → 1 (Business 1 only).
- `1065.ejs`: 2 partnership sections → 1.
- `1120s.ejs`: 2 S-Corp sections → 1.

The combined-total `result-highlight` block becomes redundant when there's one entity. Either remove it (cleaner) or keep it as a duplicate of the single entity's total. **Decision: remove it.** The single entity's `result-card` becomes the only displayed result.

Result-card heading should also change: "Business 1" → "Net Profit", "Partnership 1" → "Partnership Income", etc. The slot-numbered label loses meaning when there's only one.

**JS module** — drop the multi-entity logic:

- `computeK1` / `computeBusiness` / `computePartnership` / `computeCorp` keep their per-prefix shape (preserves their existing internals and field-ID prefixes) but `calculate()` only calls them once with the slot-1 prefix.
- Remove `K1_COUNT` constant and the for-loop in K-1 calcs.
- Remove the second-entity result writes (`b2_*`, `c2_*`, `p2_*`, `k2_*`..`k4_*`).
- Remove the "combined" total compute and write (no `combined1065`, `combined1120s`, `combined_c`, `combinedK1` writes needed).
- Math step builder: drop the "Total Monthly Income" wrapper section; the single entity step is the result.

**Field-ID prefixes stay** — `k1_*`, `b1_*`, `p1_*`, `c1_*`. This:
- Preserves the existing report extractors in `report-templates/income-standard.js`.
- Preserves AI upload's existing `aiTarget*`-removed flow (which always wrote to slot 1).
- Means no template ID rename pass.

**CSS** — likely unaffected. Each calc's CSS file styles `.calc-section`, `.income-table`, `.result-card`, `.result-highlight` generically; no slot-specific selectors expected. Spot-check each `public/css/calculators/income-<slug>.css` during implementation and remove any rules that target deleted DOM (e.g., a rule for "second business header").

## Selector counter UX

The selector drawer lists every calc as a button. Today the button gets `.active` when present. After this change:

- `.active` still gets applied when count ≥ 1 (visual indicator).
- A small `<span class="workspace__selector-count">×{n}</span>` appears next to the button text when count > 1.
- The count updates on add and on close (panel removal).

Implementation: a helper `updateSelectorCounts()` that scans `activePanels`, groups by slug, and updates each selector button. Called from `addPanel` and the close-panel handler.

## Panel close behavior

Today closing a panel removes it from `activePanels`, removes its DOM, and decreases the selector's "active" state. After this change, closing one of N instances:

- Removes that single instance from `activePanels` (find by `instanceId`).
- Removes its DOM (by id `ws-panel-${instanceId}`).
- Recomputes selector button active/count state. The button stays `.active` if other instances of that slug remain.

## Backward compatibility

- **Existing user sessionStorage data**: migrated on first load (see Persistence section). Single-instance sessions carry over without data loss.
- **Existing report data in IndexedDB**: not affected (report capture is read-only of DOM at the moment of capture).
- **External links** with `?add=income/k1`: continue to work; produce one K-1 panel as before.
- **Standalone calc pages**: unchanged behavior — they just no longer support multi-entity input. Documented in the "Non-goals" section above.

## User-visible behavior changes

1. Selector buttons no longer "fade out" or block after add — every click adds a fresh panel.
2. Panel header shows an editable label (placeholder = calc display name).
3. Selector buttons show a count badge when ≥ 2 instances exist.
4. The 5 affected calc standalone pages lose their extra entity slot UI.
5. Workspace tally updates work as before — sums across all panels regardless of slug duplication.

## Risk surface

| Risk | Mitigation |
|---|---|
| `crypto.randomUUID()` not available in older browsers | Fallback to `'wsi-' + Date.now() + '-' + Math.random().toString(36).slice(2)`. |
| Report template extractors break when 2 K-1 panels capture the same field IDs | Out of scope; flagged as follow-up. User will see two report cards labeled identically until that's fixed. |
| Standalone calc users who relied on multi-entity input lose that workflow | Documented in non-goals; workspace is the supported path going forward. |
| Migration drops user's old K-1 sheet 2-4 data | sessionStorage only holds the current browsing session's inputs; users who switch to the new build mid-session would lose extra-slot entries. Low-impact (no persistent storage of inputs). |

## Verification

After all 5 calcs collapsed and workspace changes shipped:

1. `npm run build && npm test` — 331 existing tests pass (none touch workspace or per-calc DOM structure beyond shared module behavior).
2. Manual checks at `localhost:3000`:
   - `/workspace` → add Schedule K-1 twice → both panels render, labels independently editable, each iframe scrollable.
   - Label a panel "Acme Corp"; refresh the page; label persists.
   - `/calculators/income/schedule-c` → only Business 1 section visible; entering values produces a working monthly result.
   - `/calculators/income/k1` → only one K-1 section visible.
   - `?add=income/k1,income/k1` → 2 K-1 panels load.
   - Close one of two K-1 panels → the other remains; selector button still shows ×1 indicator.

## Out of scope (deferred to later specs)

- Per-instance labels visible on standalone calc page (would require label-in-calc-data, ruled out by user).
- Report template restructuring to handle multi-instance same-slug capture.
- Saved / named workspace presets ("John Smith file" — load a labeled set of panels with input data).
- Multi-instance support for `schedule-b` (3-institution interest/dividend page). Explicitly out of scope per scope choice.
- Standalone calc page deprecation. Standalone pages remain available for quick one-off use.
- A "rename" button next to the editable label (inline contenteditable suffices; if usability suffers we can add it later).

## Implementation order

Suggested for the writing-plans phase:

1. Multi-slot calc collapse (5 files × EJS + JS) — independent, mechanical, easy to verify in isolation.
2. Workspace multi-instance plumbing (`addPanel`, persistence, migration).
3. Editable panel-header label (DOM + handler + persist).
4. Selector counter UX.
5. Final integration check + manual spot-checks.

Each shipped as its own commit. Single deploy at the end.
