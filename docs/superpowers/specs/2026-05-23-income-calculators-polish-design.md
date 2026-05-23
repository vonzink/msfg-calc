# Income Calculator Polish — Design

**Date:** 2026-05-23
**Scope:** 13 income calculators + `public/js/shared/income-calc-base.js`
**Predecessor:** Income calculator systemic refactor (extraction of `MSFG.IncomeCalc` shared module, ES6 + IIFE conversion)

## Goal

Fix six classes of inconsistency and fragility that the prior refactor surfaced but deliberately did not address. All fixes preserve underwriting math; the user-visible behavior either stays identical or becomes more consistent.

## Non-goals

- No new features (slot picker, cross-calculator data flow, PDF export, multi-year support — all deferred to a later phase).
- No AI prompt changes.
- No template changes.
- No test changes (existing 331 tests must continue to pass without modification).
- No unrelated refactoring.

## Fix 1 — Remove dead `aiTarget*` state

### Problem

Five calculators declare a mutable slot-target variable that no code path ever mutates:

| File | Variable | Default |
|---|---|---|
| `1065.js` | `aiTargetPartnership` | `'p1'` |
| `1120s.js` | `aiTargetCorp` | `'c1'` |
| `schedule-c.js` | `aiTargetBusiness` | `'b1'` |
| `k1.js` | `aiTargetK1` | `1` |
| `1120s-k1.js` | `aiTargetK1` | `1` |

The variable is read inside `clearAiFields()` and `syncFieldsFromDocs()` to build a field-ID prefix. Because nothing writes to it, every upload always fills slot 1.

### Fix

Delete the `let aiTargetX = ...` declaration in each of the five files. Inline the slot-1 literal at every read site. Functions keep their names and shapes (other calcs have `clearAiFields`/`syncFieldsFromDocs` too); only their internals simplify.

### Behavior change

None. The runtime path was already pinned to slot 1.

### Touched files

`1065.js`, `1120s.js`, `schedule-c.js`, `k1.js`, `1120s-k1.js`.

---

## Fix 2 — Stop reverse-engineering math-step subtotals

### Problem

`1120s.buildCorpStep` and `schedule-c.buildBizStep` reconstruct a "subtotal" line by adding subtracted terms back onto the final annual figure:

```js
// 1120s.js
const sub1 = c.year1 + c.mort1 + c.meals1;

// schedule-c.js
const sub1 = d.year1 + d.meals1;
```

If the formula ever changes (e.g., a new subtraction term is added), the displayed math step will silently disagree with the actual computation. The math is right; the rendered explanation lies.

### Fix

Have `computeCorp()` (1120s) and `computeBusiness()` (schedule-c) return the pre-subtraction subtotal alongside the year totals. Name them `sum1`/`sum2` to match the existing convention in `1065.js`. Math-step builders read those fields directly — no arithmetic in the rendering path.

### Behavior change

None visible. The rendered numbers stay identical for all currently-supported inputs.

### Touched files

`1120s.js`, `schedule-c.js`.

---

## Fix 3 — Hide empty Year 2 in math steps

### Problem

When a calculator has no Year 2 data, most calcs hide the Y2 step entirely (1065, 1120s already do this at the entity level). Others always render Y2 rows full of zeros even when Y2 has no values.

Specifically:
- `schedule-c`: hides Business 2 when empty (good) but **always** renders Y1+Y2 lines inside each business's math step.
- `schedule-e`: renders Y2 step only when `hasYr2` (good).
- `schedule-e-subject`: renders Y2 step only when `hasYr2` (good).
- `schedule-f`: renders Y2 step only when `hasYr2` (good).
- `schedule-d`: renders Y2 step only when `hasYr2` (good).
- `1040`: each category always renders Y1 + Y2 totals, even when both are zero.
- `1120`: always renders Y2 step.
- `1120s`, `1065`: always render Y2 inside each entity's step.
- `k1`, `1120s-k1`: always render Y2 inside each populated K-1's step.

### Fix

Standardize on the hide-when-empty pattern. Each per-entity / per-section math-step builder takes a `hasYr2` boolean (either threaded through the compute return or recomputed locally) and conditionally renders:

- The "Year 2" subtotal line
- Any "X / Y" comparison line (render as just `X` when no Y2)
- The Y2-subtraction terms in formula recaps

When `hasYr2` is false, the math step shows Year 1 alone with the formula collapsed to `Year 1 / 12`.

### Behavior change

User-visible only: cleaner math output when the user hasn't filled in Y2. No change to computed monthly income.

### Touched files

`schedule-c.js`, `1040.js`, `1120.js`, `1120s.js`, `1065.js`, `k1.js`, `1120s-k1.js`.

`schedule-d.js`, `schedule-e.js`, `schedule-e-subject.js`, `schedule-f.js` already behave correctly — no change.

`rental-1038.js` has no Y2 concept — no change.

---

## Fix 4 — Color the monthly result when negative

### Problem

`schedule-e` color-codes its final result (green for positive = qualifying income, red for negative = liability) and adds explanatory text. Every other calculator can also produce a negative monthly result (capital losses, farm losses, partnership losses, business losses with meals subtraction, etc.) but displays it in default body text — no visual signal that the number means "this isn't income."

### Fix

Add a single helper to the shared module:

```js
// MSFG.IncomeCalc
function resultClass(value) {
  return value < 0 ? 'income-result--negative' : 'income-result--positive';
}
```

Apply the class to **every result-display element** that receives a computed monthly figure — not only the "combined total" but also the per-entity / per-section monthly rows. Examples:

- `1040.js`: 5 category monthly cells (`w2_month`, `alimony_month`, `pension_month`, `unemp_month`, `ss_month`) + `combined1040` + each `result_*` mirror.
- `1065.js`: `p1_month`, `p2_month`, `result_p1`, `result_p2`, `combined1065`.
- `k1.js`: `k1_month` … `k4_month`, `resultK1` … `resultK4`, `combinedK1`.
- `schedule-e.js`: `prop1_result`. (Schedule-e's existing inline-styled caption text inside the math steps stays as-is — that's a schedule-e-only piece of prose. The new class applies to the result figure itself, which currently has no coloring.)
- Single-result calcs (schedule-b, schedule-d, etc.): the one final-result cell.

Implementation pattern in each `calculate()`:

```js
const el = document.getElementById('combined1040');
el.textContent = fmt(combined);
el.classList.remove('income-result--negative', 'income-result--positive');
el.classList.add(IC.resultClass(combined));
```

Or a one-liner helper if it reads better:

```js
IC.setResult('combined1040', combined);   // sets textContent + class in one call
```

The implementation may choose either form; both are acceptable.

Style two CSS classes globally in `income-base.css`:

```css
.income-result--negative { color: var(--color-danger); }
.income-result--positive { /* default — no override needed */ }
```

The schedule-e-specific "Add to qualifying income" / "Count as monthly expense (liability)" prose stays inside `schedule-e.js` only. The class is the universal signal; the prose is the situational explanation.

### Behavior change

Negative final-result figures now render in the danger color across all calcs. Positive figures unchanged. No layout shift.

### Touched files

`income-calc-base.js` (add helper), `income-base.css` (add two class rules), all 13 calculator files (apply class after writing the final result).

---

## Fix 5 — Converge on `IC.methodLabel`

### Problem

`1040.js` has a local helper:

```js
function methodNote(method) {
  return method === 'average'
    ? '(Year 1 > Year 2, using 24-month average)'
    : '(Using most recent year / 12)';
}
```

Every other calculator uses `IC.methodLabel(method)` which returns the shorter `"24-month average (Year 1 > Year 2)"` / `"Year 1 / 12"`.

### Fix

Delete `methodNote` from `1040.js`. Replace its call sites with `IC.methodLabel`. The rendered string changes from `<span class="math-note">(Year 1 > Year 2, using 24-month average)</span>` to `<span class="math-note">24-month average (Year 1 > Year 2)</span>` — same semantic content, consistent format, no leading paren.

### Behavior change

Minor visual change in the 1040 math steps only. Phrasing now matches the other twelve calculators.

### Touched files

`1040.js`.

---

## Fix 6 — Document `policyCalc`'s zero-total edge case

### Problem

The shared `IC.policyCalc(year1, year2)` treats `year2 === 0` as "no Year 2 data" and falls through to `year1 / 12`. The old per-calculator code computed `hasYr2` by inspecting individual Y2 inputs, then averaged on `(hasYr2 && total1 > total2)`. There is a vanishingly narrow case where the old code would average and the new code does not: the user enters Y2 values that sum to exactly zero (e.g., equal-and-opposite gains and losses).

The new behavior is arguably more correct — averaging Year 1 with a zero Year 2 understates the borrower's income by half — but it is a behavior change.

### Fix

Update the JSDoc for `policyCalc` to spell out the rule:

```js
/**
 * Standard 2-year income averaging policy.
 *
 * - If year2 is zero, returns year1 / 12 regardless of caller intent.
 *   Callers that distinguish "no Y2 data" from "Y2 data summing to zero"
 *   must pre-filter and pass 0 explicitly when no Y2 data exists.
 * - If year2 is non-zero AND year1 > year2, returns (year1 + year2) / 24.
 * - Otherwise returns year1 / 12.
 *
 * @param {number} year1 - Most recent year total
 * @param {number} year2 - Prior year total (0 if not provided)
 * @returns {{ monthly: number, method: 'average'|'recent', formula: string }}
 */
```

No code change.

### Behavior change

None. Documentation only.

### Touched files

`income-calc-base.js`.

---

## Implementation plan summary

| Fix | Files | Risk | LOC delta |
|---|---|---|---|
| 1. Remove dead `aiTarget*` | 5 calcs | Trivial | -10 to -15 |
| 2. Pre-subtraction subtotals | 2 calcs | Low | +6 (new return fields) |
| 3. Hide empty Y2 in math steps | 7 calcs | Low | ~+50 (gate conditionals) |
| 4. Negative result coloring | 13 calcs + shared + CSS | Low | ~+30 |
| 5. 1040 → `IC.methodLabel` | 1 calc | Trivial | -8 (delete helper, swap 5 callsites) |
| 6. `policyCalc` JSDoc | Shared module | Trivial | +8 |

**Total:** roughly +60 to +80 lines net, across 14 source files plus one CSS file. No new dependencies. No template changes. No test changes.

## Verification

After each fix:

1. `npm run build` — regenerate `.min.js` companions for any touched file.
2. `npm test` — all 331 existing tests must continue passing.
3. `npm run lint` — must not introduce new errors in touched files (pre-existing `IncomeUpload is not defined` warnings stay).

After the full set:

4. Manual spot-check at `localhost:3000`:
   - Enter Y1-only data in one calc per "shape" (single-entity, multi-entity, K-1, dual-method) and confirm math steps hide Y2.
   - Enter inputs that produce a negative monthly result and confirm the figure renders in danger color.
   - Upload a Schedule E (or any AI doc) into a multi-entity calc and confirm it still fills slot 1.
   - Open the 1040 math steps and confirm method labels match other calculators.

## Out of scope

The following items were discussed and explicitly deferred to a later "new features" phase:

- Functional slot picker UI (would resurrect the now-deleted `aiTargetX` state)
- Cross-calculator data flow (Schedule C/E/B/D → 1040)
- Session state persistence (IndexedDB form values)
- PDF export
- 3+ year averaging
- Math steps as tables instead of `<br>`-separated lines
- Trend visualization (sparklines, etc.)
- Collapsing unused entity/K-1 slots
- "AI-filled" indicator badges
- Inline line-number help tooltips
- Richer doc cards

These remain on the roadmap but are not part of this polish pass.
