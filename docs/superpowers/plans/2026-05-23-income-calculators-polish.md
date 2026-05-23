# Income Calculator Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the six polish fixes specified in `docs/superpowers/specs/2026-05-23-income-calculators-polish-design.md` to the 13 income calculators and the shared `MSFG.IncomeCalc` module.

**Architecture:** The recent refactor (commit `821754d`) extracted shared utilities. This plan tightens consistency, removes dead code, adds two shared helpers (`resultClass`, `setResult`), adds two CSS classes, and gates Year-2 math rendering on a `hasYr2` flag threaded through `compute*` returns. No behavior change to underwriting math; no template changes; no test changes.

**Tech Stack:** Vanilla JS (ES6 + IIFE), plain CSS, EJS, Express 5. esbuild for minification via `npm run build`. Node test runner via `npm test`.

---

## File Structure

Files touched across all tasks:

- `public/js/shared/income-calc-base.js` — JSDoc update on `policyCalc`; add `resultClass` and `setResult` helpers
- `public/css/calculators/income-base.css` — add `.income-result--negative` / `.income-result--positive`
- `public/js/calculators/income/1040.js` — Fix 5 (`IC.methodLabel`), Fix 3 (per-category Y2 hiding), Fix 4 (result coloring)
- `public/js/calculators/income/1065.js` — Fix 1 (remove `aiTargetPartnership`), Fix 3 (entity Y2 hiding), Fix 4
- `public/js/calculators/income/1120.js` — Fix 3 (Y2 step hiding), Fix 4
- `public/js/calculators/income/1120s.js` — Fix 1 (remove `aiTargetCorp`), Fix 2 (subtotal returns), Fix 3, Fix 4
- `public/js/calculators/income/1120s-k1.js` — Fix 1 (remove `aiTargetK1`), Fix 3 (entity Y2 hiding), Fix 4
- `public/js/calculators/income/k1.js` — Fix 1 (remove `aiTargetK1`), Fix 3, Fix 4
- `public/js/calculators/income/schedule-c.js` — Fix 1 (remove `aiTargetBusiness`), Fix 2, Fix 3, Fix 4
- `public/js/calculators/income/schedule-b.js` — Fix 4 only
- `public/js/calculators/income/schedule-d.js` — Fix 4 only
- `public/js/calculators/income/schedule-e.js` — Fix 4 only
- `public/js/calculators/income/schedule-e-subject.js` — Fix 4 only
- `public/js/calculators/income/schedule-f.js` — Fix 4 only
- `public/js/calculators/income/rental-1038.js` — Fix 4 only

Task order is independent-fix-first (cheap wins, build confidence) then larger fixes. Every task ends with `npm run build && npm test` (all 331 must pass) and one atomic git commit.

---

## Task 1: Document `policyCalc` edge case (Fix 6)

**Files:**
- Modify: `public/js/shared/income-calc-base.js:25-50` (JSDoc above `policyCalc`)

- [ ] **Step 1: Replace the JSDoc above `policyCalc`**

Find this block in `public/js/shared/income-calc-base.js` (currently around lines 25-33):

```js
  /**
   * Standard 2-year income averaging policy.
   * IF Year 2 provided AND Year 1 > Year 2 → 24-month average
   * ELSE → Year 1 / 12
   *
   * @param {number} year1 - Most recent year total
   * @param {number} year2 - Prior year total (0 if not provided)
   * @returns {{ monthly: number, method: string, formula: string }}
   */
```

Replace with:

```js
  /**
   * Standard 2-year income averaging policy.
   *
   * - If year2 === 0, returns year1 / 12 regardless of caller intent.
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

- [ ] **Step 2: Build + test**

```bash
npm run build && npm test
```

Expected: `Minified 63/63 files` and `tests 331 ... fail 0`.

- [ ] **Step 3: Commit**

```bash
git add public/js/shared/income-calc-base.js
git commit -m "$(cat <<'EOF'
docs(income): clarify policyCalc handling of zero year2

Spell out that year2 === 0 always falls through to "Year 1 / 12",
even when the caller had Y2 inputs that summed to zero. Callers that
want to distinguish must pre-filter.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 1040 adopts `IC.methodLabel` (Fix 5)

**Files:**
- Modify: `public/js/calculators/income/1040.js`

- [ ] **Step 1: Delete the local `methodNote` helper**

Find and delete this function block in `public/js/calculators/income/1040.js` (currently inside the IIFE, just above `updateMathSteps`):

```js
  function methodNote(method) {
    return method === 'average'
      ? '(Year 1 > Year 2, using 24-month average)'
      : '(Using most recent year / 12)';
  }
```

- [ ] **Step 2: Replace each `methodNote` call with `IC.methodLabel`**

Inside `updateMathSteps`, replace **all five** occurrences of `methodNote(...)` with `IC.methodLabel(...)`. The five call sites are inside the W-2, Alimony, Pension, Unemployment, and Social Security math-step blocks. Each looks like:

```js
html += '<span class="math-note">' + methodNote(data.w2.result.method) + '</span>';
```

Change to:

```js
html += '<span class="math-note">' + IC.methodLabel(data.w2.result.method) + '</span>';
```

Repeat for `data.alimony.result.method`, `data.pension.result.method`, `data.unemp.result.method`, `data.ss.result.method`.

- [ ] **Step 3: Build + test**

```bash
npm run build && npm test
```

Expected: `tests 331 ... fail 0`.

- [ ] **Step 4: Commit**

```bash
git add public/js/calculators/income/1040.js
git commit -m "$(cat <<'EOF'
refactor(income/1040): use shared IC.methodLabel for math step captions

Removes the local methodNote() helper. The five category math steps now
display the same concise label as the other 12 calculators
("24-month average (Year 1 > Year 2)" or "Year 1 / 12").

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Remove dead `aiTarget*` state (Fix 1)

**Files:**
- Modify: `public/js/calculators/income/1065.js`
- Modify: `public/js/calculators/income/1120s.js`
- Modify: `public/js/calculators/income/schedule-c.js`
- Modify: `public/js/calculators/income/k1.js`
- Modify: `public/js/calculators/income/1120s-k1.js`

Each file gets the same shape of change: delete the unused `let aiTargetX = ...` declaration and replace the two read sites (inside `clearAiFields` and `syncFieldsFromDocs`) with the literal slot-1 prefix.

- [ ] **Step 1: 1065.js — remove `aiTargetPartnership`**

In `public/js/calculators/income/1065.js`:

Delete line 16 (and its blank surrounding):

```js
  // Track which partnership slot the AI data should fill
  let aiTargetPartnership = 'p1';
```

Replace inside `clearAiFields` (line ~36):

```js
    const prefix = aiTargetPartnership;
```

with:

```js
    const prefix = 'p1';
```

Replace inside `syncFieldsFromDocs` (line ~48) — same edit:

```js
    const prefix = aiTargetPartnership;
```

with:

```js
    const prefix = 'p1';
```

- [ ] **Step 2: 1120s.js — remove `aiTargetCorp`**

In `public/js/calculators/income/1120s.js`:

Delete line 16:

```js
  // Track which S-Corp slot the AI data should fill
  let aiTargetCorp = 'c1';
```

Replace inside `clearAiFields` (line ~34) and `syncFieldsFromDocs` (line ~46):

```js
    const prefix = aiTargetCorp;
```

with:

```js
    const prefix = 'c1';
```

- [ ] **Step 3: schedule-c.js — remove `aiTargetBusiness`**

In `public/js/calculators/income/schedule-c.js`:

Delete line 16:

```js
  // Track which Business slot the AI data should fill
  let aiTargetBusiness = 'b1';
```

Replace inside `clearAiFields` (line ~33) and `syncFieldsFromDocs` (line ~45):

```js
    const prefix = aiTargetBusiness;
```

with:

```js
    const prefix = 'b1';
```

- [ ] **Step 4: k1.js — remove `aiTargetK1`**

In `public/js/calculators/income/k1.js`:

Delete line 18 (and surrounding comment):

```js
  // Track which K-1 slot the AI data should fill
  let aiTargetK1 = 1;
```

Replace inside `clearAiFields` (line ~33) and `syncFieldsFromDocs` (line ~45):

```js
    const prefix = 'k' + aiTargetK1;
```

with:

```js
    const prefix = 'k1';
```

(Note: do **not** touch line 59 inside `computeK1(num)` — that `'k' + num` is the per-entity iteration, not the dead state.)

- [ ] **Step 5: 1120s-k1.js — remove `aiTargetK1`**

In `public/js/calculators/income/1120s-k1.js`:

Delete line 18:

```js
  // Track which K-1 slot the AI data should fill
  let aiTargetK1 = 1;
```

Replace inside `clearAiFields` (line ~32) and `syncFieldsFromDocs` (line ~44):

```js
    const prefix = 'k' + aiTargetK1;
```

with:

```js
    const prefix = 'k1';
```

- [ ] **Step 6: Build + test**

```bash
npm run build && npm test
```

Expected: `tests 331 ... fail 0`.

- [ ] **Step 7: Commit**

```bash
git add public/js/calculators/income/1065.js \
        public/js/calculators/income/1120s.js \
        public/js/calculators/income/schedule-c.js \
        public/js/calculators/income/k1.js \
        public/js/calculators/income/1120s-k1.js
git commit -m "$(cat <<'EOF'
refactor(income): remove unused aiTarget* state from 5 calculators

The aiTargetPartnership / aiTargetCorp / aiTargetBusiness / aiTargetK1
variables were declared mutable but never written. Every upload was
already going to slot 1; this just removes the misleading "let".

If/when a slot picker UI is added later, the state can come back
without ambiguity about what it was doing in the meantime.

Files: 1065, 1120s, schedule-c, k1, 1120s-k1.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Return pre-subtraction subtotals from `computeBusiness` / `computeCorp` (Fix 2)

**Files:**
- Modify: `public/js/calculators/income/1120s.js`
- Modify: `public/js/calculators/income/schedule-c.js`

- [ ] **Step 1: 1120s.js — widen `computeCorp` return and stop reverse-engineering in `buildCorpStep`**

In `public/js/calculators/income/1120s.js`, find `computeCorp(prefix)`. The current body computes:

```js
    const year1 = net1 + oth1 + dep1 + depl1 + amort1 - mort1 - meals1;
    const year2 = net2 + oth2 + dep2 + depl2 + amort2 - mort2 - meals2;
```

Above those, add the pre-subtraction subtotals:

```js
    const sum1 = net1 + oth1 + dep1 + depl1 + amort1;
    const sum2 = net2 + oth2 + dep2 + depl2 + amort2;
    const year1 = sum1 - mort1 - meals1;
    const year2 = sum2 - mort2 - meals2;
```

Then add `sum1` and `sum2` to the returned object. The return becomes:

```js
    return {
      year1, year2, sum1, sum2,
      monthly, method: result.method,
      mort1, mort2, meals1, meals2,
      own: own * 100
    };
```

Now find `buildCorpStep(label, c)`. Delete the local recomputation:

```js
    const sub1 = c.year1 + c.mort1 + c.meals1;
    const sub2 = c.year2 + c.mort2 + c.meals2;
```

In the HTML below, replace `fmt(sub1)` / `fmt(sub2)` with `fmt(c.sum1)` / `fmt(c.sum2)` everywhere they appear (two lines: "Subtotal Year 1" / "Subtotal Year 2" rows, and the "Year 1 = sub1 − ..." / "Year 2 = sub2 − ..." computation lines).

- [ ] **Step 2: schedule-c.js — widen `computeBusiness` return and stop reverse-engineering in `buildBizStep`**

In `public/js/calculators/income/schedule-c.js`, find `computeBusiness(prefix)`. The current body computes:

```js
    const year1 = np1 + oth1 + depl1 + depr1 + home1 + mile1 + amort1 - meals1;
    const year2 = np2 + oth2 + depl2 + depr2 + home2 + mile2 + amort2 - meals2;
```

Above those, add:

```js
    const sum1 = np1 + oth1 + depl1 + depr1 + home1 + mile1 + amort1;
    const sum2 = np2 + oth2 + depl2 + depr2 + home2 + mile2 + amort2;
    const year1 = sum1 - meals1;
    const year2 = sum2 - meals2;
```

Add `sum1` and `sum2` to the returned object:

```js
    return {
      year1, year2, sum1, sum2,
      monthly: result.monthly, method: result.method,
      meals1, meals2
    };
```

In `buildBizStep(label, d)`, delete:

```js
    const sub1 = d.year1 + d.meals1;
    const sub2 = d.year2 + d.meals2;
```

Replace `fmt(sub1)` / `fmt(sub2)` with `fmt(d.sum1)` / `fmt(d.sum2)` in the HTML below.

- [ ] **Step 3: Build + test**

```bash
npm run build && npm test
```

Expected: `tests 331 ... fail 0`. Math-step output for 1120s and schedule-c renders identical figures as before (the new `sum1`/`sum2` are arithmetically equal to the deleted `sub1`/`sub2`).

- [ ] **Step 4: Commit**

```bash
git add public/js/calculators/income/1120s.js public/js/calculators/income/schedule-c.js
git commit -m "$(cat <<'EOF'
refactor(income): compute subtotals once instead of reverse-engineering them

1120s and schedule-c previously rebuilt the pre-subtraction subtotal in
their math-step builders by adding subtracted terms back onto the final
year total. That worked but went silently wrong if the formula changed.

compute{Corp,Business} now returns sum1/sum2 alongside year1/year2.
buildCorpStep / buildBizStep read those directly. No arithmetic in the
rendering path.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Negative-result coloring across all 13 calculators (Fix 4)

**Files:**
- Modify: `public/js/shared/income-calc-base.js` (add `resultClass` and `setResult` helpers)
- Modify: `public/css/calculators/income-base.css` (add two utility classes)
- Modify: all 13 calculators in `public/js/calculators/income/*.js` (apply helper to result writes)

- [ ] **Step 1: Add `resultClass` and `setResult` to the shared module**

In `public/js/shared/income-calc-base.js`, inside the IIFE, add the following functions after `methodLabel`:

```js
  /**
   * Return the CSS class to apply to a monthly-result display element
   * based on the sign of its value. Treats 0 as positive.
   *
   * @param {number} value
   * @returns {'income-result--negative'|'income-result--positive'}
   */
  function resultClass(value) {
    return value < 0 ? 'income-result--negative' : 'income-result--positive';
  }

  /**
   * Set a result-display element's text and signed-color class in one call.
   * Safe to call with a missing element (no-op).
   *
   * @param {string|HTMLElement} idOrEl - Element ID or DOM node
   * @param {number} value - Numeric value to display (formatted via formatCurrency)
   */
  function setResult(idOrEl, value) {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return;
    el.textContent = fmt(value);
    el.classList.remove('income-result--negative', 'income-result--positive');
    el.classList.add(resultClass(value));
  }
```

Add both names to the public API return at the bottom of the IIFE. The current return reads:

```js
  return {
    setField,
    policyCalc,
    methodLabel,
    downloadCSV,
    clearAll,
    registerEmailProvider,
    initPage
  };
```

Change to:

```js
  return {
    setField,
    policyCalc,
    methodLabel,
    downloadCSV,
    clearAll,
    registerEmailProvider,
    initPage,
    resultClass,
    setResult
  };
```

- [ ] **Step 2: Add the two CSS classes to `income-base.css`**

In `public/css/calculators/income-base.css`, append at the end of the file:

```css
/* =====================================================
   Result coloring (shared by all income calculators)
   ===================================================== */

.income-result--negative {
  color: var(--color-danger);
}

.income-result--positive {
  /* default text color — no override needed */
}
```

- [ ] **Step 3: Replace result-writes in `1040.js`**

In `public/js/calculators/income/1040.js`, inside `calculate()`, find each line of the form:

```js
document.getElementById('w2_month').textContent = fmt(w2_result.monthly);
```

Replace with:

```js
IC.setResult('w2_month', w2_result.monthly);
```

Apply to all 11 result-write sites:
- `w2_month`, `result_w2`
- `alimony_month`, `result_alimony`
- `pension_month`, `result_pension`
- `unemp_month`, `result_unemp`
- `ss_month`, `result_ss`
- `combined1040`

For each, the second argument is the same numeric value the original line passed to `fmt()`.

- [ ] **Step 4: Replace result-writes in `1065.js`**

In `public/js/calculators/income/1065.js`, inside `calculate()`, replace each `document.getElementById(id).textContent = fmt(value)` for these IDs:

```js
IC.setResult('p1_year1', p1.total1);
IC.setResult('p1_year2', p1.total2);
IC.setResult('p1_month', p1.monthly);
IC.setResult('result_p1', p1.monthly);
IC.setResult('p2_year1', p2.total1);
IC.setResult('p2_year2', p2.total2);
IC.setResult('p2_month', p2.monthly);
IC.setResult('result_p2', p2.monthly);
IC.setResult('combined1065', combined);
```

- [ ] **Step 5: Replace result-writes in `1120.js`**

In `public/js/calculators/income/1120.js`, inside `calculate()`:

```js
IC.setResult('yr1_total', total1);
IC.setResult('yr2_total', total2);
IC.setResult('monthly_income', result.monthly);
IC.setResult('combined1120', result.monthly);
```

- [ ] **Step 6: Replace result-writes in `1120s.js`**

In `public/js/calculators/income/1120s.js`, inside `calculate()`:

```js
IC.setResult('c1_year1', c1.year1);
IC.setResult('c1_year2', c1.year2);
IC.setResult('c1_month', c1.monthly);
IC.setResult('result_c1', c1.monthly);
IC.setResult('c2_year1', c2.year1);
IC.setResult('c2_year2', c2.year2);
IC.setResult('c2_month', c2.monthly);
IC.setResult('result_c2', c2.monthly);
IC.setResult('combined1120s', combined);
```

- [ ] **Step 7: Replace result-writes in `1120s-k1.js`**

In `public/js/calculators/income/1120s-k1.js`, inside `calculate()`, inside the `for (let i = 1; i <= K1_COUNT; i++)` loop, replace the four `document.getElementById(...)textContent = fmt(...)` lines with:

```js
IC.setResult('k' + i + '_yr1', k.year1);
IC.setResult('k' + i + '_yr2', k.year2);
IC.setResult('k' + i + '_month', k.monthly);
IC.setResult('resultK' + i, k.monthly);
```

After the loop, replace:

```js
IC.setResult('combinedK1', combined);
```

- [ ] **Step 8: Replace result-writes in `k1.js`**

In `public/js/calculators/income/k1.js`, inside `calculate()`, inside the `for (let i = 1; i <= K1_COUNT; i++)` loop:

```js
IC.setResult('k' + i + '_yr1', k.year1);
IC.setResult('k' + i + '_yr2', k.year2);
IC.setResult('k' + i + '_month', k.monthly);
IC.setResult('resultK' + i, k.monthly);
```

After the loop:

```js
IC.setResult('combinedK1', combined);
```

- [ ] **Step 9: Replace result-writes in `rental-1038.js`**

In `public/js/calculators/income/rental-1038.js`, inside `calculateMethodA()`:

```js
IC.setResult('methodA_adjusted', monthlyAdjusted);
IC.setResult('methodA_result', finalResult);
```

(Delete the surrounding `if (adjEl) ... textContent = ...` and `if (resEl) ... textContent = ...` blocks — `setResult` already null-guards.)

Inside `calculateMethodB()`:

```js
IC.setResult('methodB_adjusted', adjustedMonthly);
IC.setResult('methodB_result', finalResult);
```

- [ ] **Step 10: Replace result-writes in `schedule-b.js`**

In `public/js/calculators/income/schedule-b.js`, inside `calculate()`:

```js
IC.setResult('totalYear1', totalY1);
IC.setResult('totalYear2', totalY2);
IC.setResult('incomeToUse', result.monthly);
```

- [ ] **Step 11: Replace result-writes in `schedule-c.js`**

In `public/js/calculators/income/schedule-c.js`, inside `calculate()`:

```js
IC.setResult('b1_year1', b1.year1);
IC.setResult('b1_year2', b1.year2);
IC.setResult('b1_month', b1.monthly);
IC.setResult('result_b1', b1.monthly);
IC.setResult('b2_year1', b2.year1);
IC.setResult('b2_year2', b2.year2);
IC.setResult('b2_month', b2.monthly);
IC.setResult('result_b2', b2.monthly);
IC.setResult('combined_c', combined);
```

- [ ] **Step 12: Replace result-writes in `schedule-d.js`**

In `public/js/calculators/income/schedule-d.js`, inside `calculate()`:

```js
IC.setResult('d_total1', total1);
IC.setResult('d_total2', stcg2 + ltcg2);
IC.setResult('d_monthly', result.monthly);
```

- [ ] **Step 13: Replace result-writes in `schedule-e.js`**

In `public/js/calculators/income/schedule-e.js`, inside `calculate()`:

```js
IC.setResult('prop1_result', finalResult);
```

- [ ] **Step 14: Replace result-writes in `schedule-e-subject.js`**

In `public/js/calculators/income/schedule-e-subject.js`, inside `calculate()`:

```js
IC.setResult('sr_total1', y1.total);
IC.setResult('sr_total2', y2.total);
IC.setResult('sr_avg', result.monthly);
```

- [ ] **Step 15: Replace result-writes in `schedule-f.js`**

In `public/js/calculators/income/schedule-f.js`, inside `calculate()`:

```js
IC.setResult('f_total1', year1);
IC.setResult('f_total2', year2);
IC.setResult('f_monthly', result.monthly);
```

- [ ] **Step 16: Build + test**

```bash
npm run build && npm test
```

Expected: `Minified 63/63 files` and `tests 331 ... fail 0`.

- [ ] **Step 17: Manual spot-check (must run server locally)**

```bash
npm run dev
```

Open `http://localhost:3000/calculators/income/schedule-d` and enter `-5000` into Short-Term Capital Gain/Loss Y1. The Monthly Income figure should render in red. Enter `5000` instead — the figure should render in normal text color. Stop the dev server (Ctrl-C) when done.

- [ ] **Step 18: Commit**

```bash
git add public/js/shared/income-calc-base.js \
        public/css/calculators/income-base.css \
        public/js/calculators/income/
git commit -m "$(cat <<'EOF'
feat(income): color monthly results red when negative

Adds IC.resultClass(value) and IC.setResult(idOrEl, value) to the
shared module, plus .income-result--negative / .income-result--positive
CSS classes (income-base.css).

All 13 income calculators now route result-display writes through
IC.setResult, which sets textContent and the signed-color class in
one call. Negative figures render in var(--color-danger); positive
figures render in default text color.

Schedule-E's existing positive/negative caption text inside its math
steps is unchanged (calc-specific prose, not the universal signal).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Hide empty Year 2 in math steps (Fix 3)

Seven files need a `hasYr2` flag threaded through their `compute*` return (where one exists) and gated Y2 rendering inside the math-step builder. Schedule-d, schedule-e, schedule-e-subject, schedule-f already do this correctly — they are not modified. Rental-1038 has no Y2 concept — not modified. Schedule-b has only the top-level Y1/Y2 totals which are already conditional via `policyCalc` method — not modified.

**Files:**
- Modify: `public/js/calculators/income/schedule-c.js`
- Modify: `public/js/calculators/income/1040.js`
- Modify: `public/js/calculators/income/1120.js`
- Modify: `public/js/calculators/income/1120s.js`
- Modify: `public/js/calculators/income/1065.js`
- Modify: `public/js/calculators/income/k1.js`
- Modify: `public/js/calculators/income/1120s-k1.js`

- [ ] **Step 1: schedule-c.js — thread `hasYr2` through `computeBusiness` and gate `buildBizStep` Y2 rows**

In `public/js/calculators/income/schedule-c.js`, inside `computeBusiness(prefix)`, the existing `hasYr2` is already computed locally:

```js
    const hasYr2 = [np2, oth2, depl2, depr2, meals2, home2, mile2, amort2]
      .some(v => v !== 0);
```

Add it to the returned object:

```js
    return {
      year1, year2, sum1, sum2, hasYr2,
      monthly: result.monthly, method: result.method,
      meals1, meals2
    };
```

In `buildBizStep(label, d)`, rewrite the body to gate Y2 rows. Replace the existing body's HTML composition with:

```js
    let html = '<div class="math-step">';
    html += '<h4>' + label + ' Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Subtotal Year 1: ' + fmt(d.sum1) + '<br>';
    if (d.hasYr2) html += 'Subtotal Year 2: ' + fmt(d.sum2) + '<br>';
    html += 'Less Meals: ' + fmt(d.meals1);
    if (d.hasYr2) html += ' / ' + fmt(d.meals2);
    html += '<br>';
    html += '<div class="math-values">';
    html += 'Year 1 = ' + fmt(d.sum1) + ' &minus; ' + fmt(d.meals1) + ' = ' + fmt(d.year1) + '<br>';
    if (d.hasYr2) {
      html += 'Year 2 = ' + fmt(d.sum2) + ' &minus; ' + fmt(d.meals2) + ' = ' + fmt(d.year2) + '<br>';
    }
    html += 'Method: ' + IC.methodLabel(d.method) + '<br>';
    html += '<strong>Monthly: ' + fmt(d.monthly) + '</strong>';
    html += '</div></div></div>';
    return html;
```

- [ ] **Step 2: 1040.js — gate Y2 row inside each category math step**

In `public/js/calculators/income/1040.js`, inside `updateMathSteps`, each of the five category blocks (W-2, Alimony, Pension, Unemployment, Social Security) currently always renders both Y1 and Y2 totals. Convert each to gate the Y2 row when `data.<category>.y2 === 0`.

For the W-2 block, change:

```js
    html += 'Year 1 Total: ' + fmt(data.w2.y1) + '<br>';
    html += 'Year 2 Total: ' + fmt(data.w2.y2) + '<br>';
```

to:

```js
    html += 'Year 1 Total: ' + fmt(data.w2.y1) + '<br>';
    if (data.w2.y2 !== 0) html += 'Year 2 Total: ' + fmt(data.w2.y2) + '<br>';
```

Apply the same pattern (`if (data.<category>.y<n> !== 0)`) to:
- Alimony block: gate `'Year 2: ' + fmt(data.alimony.y2)` on `data.alimony.y2 !== 0`
- Pension block: gate `'Year 2 Total: ' + fmt(data.pension.y2)` on `data.pension.y2 !== 0`
- Unemployment block: gate `'Year 2: ' + fmt(data.unemp.y2)` on `data.unemp.y2 !== 0`
- Social Security block: gate `'Year 2 Total: ' + fmt(data.ss.y2)` on `data.ss.y2 !== 0`

Note: the outer "render this section only if non-zero" guard for Alimony and Unemployment stays as-is; this change is *inside* each rendered section.

- [ ] **Step 3: 1120.js — gate the entire Year 2 calculation step block**

In `public/js/calculators/income/1120.js`, inside `updateMathSteps(d)`, find the section currently starting:

```js
    // Year 2 calculation
    html += '<div class="math-step">';
    html += '<h4>Year 2 Calculation</h4>';
```

Wrap the entire Year-2 step (from `// Year 2 calculation` through the closing `</div></div></div>` of that block) in a guard:

```js
    if (d.hasYr2) {
      // Year 2 calculation
      html += '<div class="math-step">';
      html += '<h4>Year 2 Calculation</h4>';
      // ... (existing Y2 HTML composition unchanged)
      html += '</div></div></div>';
    }
```

`d.hasYr2` is already passed in via the `updateMathSteps` argument object — no compute change needed.

- [ ] **Step 4: 1120s.js — thread `hasYr2` through `computeCorp` and gate `buildCorpStep` Y2 rows**

In `public/js/calculators/income/1120s.js`, inside `computeCorp(prefix)`, the existing `hasYr2`:

```js
    const hasYr2 = [net2, oth2, dep2, depl2, amort2, mort2, meals2]
      .some(v => v !== 0);
```

Add to return:

```js
    return {
      year1, year2, sum1, sum2, hasYr2,
      monthly, method: result.method,
      mort1, mort2, meals1, meals2,
      own: own * 100
    };
```

In `buildCorpStep(label, c)`, rewrite the HTML composition to gate Y2 rows. Replace the existing body's HTML composition (after `c.sum1`/`c.sum2` are read — see Task 4) with:

```js
    let html = '<div class="math-step">';
    html += '<h4>' + label + ' Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Subtotal Year 1: ' + fmt(c.sum1) + '<br>';
    if (c.hasYr2) html += 'Subtotal Year 2: ' + fmt(c.sum2) + '<br>';
    html += 'Less Mortgages: ' + fmt(c.mort1);
    if (c.hasYr2) html += ' / ' + fmt(c.mort2);
    html += '<br>';
    html += 'Less Meals: ' + fmt(c.meals1);
    if (c.hasYr2) html += ' / ' + fmt(c.meals2);
    html += '<br>';
    html += 'Ownership: ' + c.own + '%<br>';
    html += '<div class="math-values">';
    html += 'Year 1 = ' + fmt(c.sum1) + ' &minus; ' + fmt(c.mort1) + ' &minus; ' + fmt(c.meals1) + ' = ' + fmt(c.year1) + '<br>';
    if (c.hasYr2) {
      html += 'Year 2 = ' + fmt(c.sum2) + ' &minus; ' + fmt(c.mort2) + ' &minus; ' + fmt(c.meals2) + ' = ' + fmt(c.year2) + '<br>';
    }
    html += 'Method: ' + IC.methodLabel(c.method) + '<br>';
    html += '<strong>Monthly: ' + fmt(c.monthly) + '</strong>';
    html += '</div></div></div>';
    return html;
```

- [ ] **Step 5: 1065.js — thread `hasYr2` through `computePartnership` and gate `buildPartnershipStep` Y2 rows**

In `public/js/calculators/income/1065.js`, inside `computePartnership(prefix)`, the existing `hasYr2`:

```js
    const hasYr2 = [ord2, farm2, gain2, oth2, dep2, depl2, amort2, mort2, meals2]
      .some(v => v !== 0);
```

Add to return:

```js
    return {
      sum1, sum2, total1, total2, hasYr2,
      monthly: result.monthly, method: result.method,
      mort1, mort2, meals1, meals2,
      own: own * 100
    };
```

In `buildPartnershipStep(label, p)`, rewrite to gate Y2 rows:

```js
    let html = '<div class="math-step">';
    html += '<h4>' + label + ' Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Subtotal Year 1: ' + fmt(p.sum1) + '<br>';
    if (p.hasYr2) html += 'Subtotal Year 2: ' + fmt(p.sum2) + '<br>';
    html += 'Less Mortgages: ' + fmt(p.mort1);
    if (p.hasYr2) html += ' / ' + fmt(p.mort2);
    html += '<br>';
    html += 'Less Meals: ' + fmt(p.meals1);
    if (p.hasYr2) html += ' / ' + fmt(p.meals2);
    html += '<br>';
    html += 'Ownership: ' + p.own + '%<br>';
    html += '<div class="math-values">';
    html += 'Year 1 = (' + fmt(p.sum1) + ' &minus; ' + fmt(p.mort1) + ' &minus; ' + fmt(p.meals1) + ') &times; ' + p.own + '% = ' + fmt(p.total1) + '<br>';
    if (p.hasYr2) {
      html += 'Year 2 = (' + fmt(p.sum2) + ' &minus; ' + fmt(p.mort2) + ' &minus; ' + fmt(p.meals2) + ') &times; ' + p.own + '% = ' + fmt(p.total2) + '<br>';
    }
    html += 'Method: ' + IC.methodLabel(p.method) + '<br>';
    html += '<strong>Monthly: ' + fmt(p.monthly) + '</strong>';
    html += '</div></div></div>';
    return html;
```

- [ ] **Step 6: k1.js — thread `hasYr2` through `computeK1` and gate `buildK1Step` Y2 rows**

In `public/js/calculators/income/k1.js`, inside `computeK1(num)`, the existing `hasYr2`:

```js
    const hasYr2 = [ord2, rent2, other2, guar2].some(v => v !== 0);
```

Add to return:

```js
    return {
      year1, year2, hasYr2,
      monthly: result.monthly, method: result.method,
      ord1, ord2, rent1, rent2, other1, other2, guar1, guar2
    };
```

In `buildK1Step(num, k)`, rewrite to gate Y2 portions:

```js
    let html = '<div class="math-step">';
    html += '<h4>K-1 #' + num + ' Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Ordinary Income: ' + fmt(k.ord1);
    if (k.hasYr2) html += ' / ' + fmt(k.ord2);
    html += '<br>';
    html += 'Rental Real Estate: ' + fmt(k.rent1);
    if (k.hasYr2) html += ' / ' + fmt(k.rent2);
    html += '<br>';
    html += 'Other Rental: ' + fmt(k.other1);
    if (k.hasYr2) html += ' / ' + fmt(k.other2);
    html += '<br>';
    html += 'Guaranteed Payments: ' + fmt(k.guar1);
    if (k.hasYr2) html += ' / ' + fmt(k.guar2);
    html += '<br>';
    html += '<div class="math-values">';
    html += 'Year 1 = ' + fmt(k.ord1) + ' + ' + fmt(k.rent1) + ' + ' + fmt(k.other1) + ' + ' + fmt(k.guar1) + ' = ' + fmt(k.year1) + '<br>';
    if (k.hasYr2) {
      html += 'Year 2 = ' + fmt(k.ord2) + ' + ' + fmt(k.rent2) + ' + ' + fmt(k.other2) + ' + ' + fmt(k.guar2) + ' = ' + fmt(k.year2) + '<br>';
    }
    html += 'Method: ' + IC.methodLabel(k.method) + '<br>';
    html += '<strong>Monthly: ' + fmt(k.monthly) + '</strong>';
    html += '</div></div></div>';
    return html;
```

- [ ] **Step 7: 1120s-k1.js — thread `hasYr2` through `computeK1` and gate `buildK1Step` Y2 rows**

In `public/js/calculators/income/1120s-k1.js`, inside `computeK1(num)`, the existing `hasYr2`:

```js
    const hasYr2 = [ord2, rent2, other2].some(v => v !== 0);
```

Add to return:

```js
    return {
      year1, year2, hasYr2,
      monthly: result.monthly, method: result.method,
      ord1, ord2, rent1, rent2, other1, other2
    };
```

In `buildK1Step(num, d)`, rewrite to gate Y2 portions:

```js
    let html = '<div class="math-step">';
    html += '<h4>K-1 #' + num + ' Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Ordinary Income: ' + fmt(d.ord1);
    if (d.hasYr2) html += ' / ' + fmt(d.ord2);
    html += '<br>';
    html += 'Rental RE Income: ' + fmt(d.rent1);
    if (d.hasYr2) html += ' / ' + fmt(d.rent2);
    html += '<br>';
    html += 'Other Rental: ' + fmt(d.other1);
    if (d.hasYr2) html += ' / ' + fmt(d.other2);
    html += '<br>';
    html += '<div class="math-values">';
    html += 'Year 1 = ' + fmt(d.ord1) + ' + ' + fmt(d.rent1) + ' + ' + fmt(d.other1) + ' = ' + fmt(d.year1) + '<br>';
    if (d.hasYr2) {
      html += 'Year 2 = ' + fmt(d.ord2) + ' + ' + fmt(d.rent2) + ' + ' + fmt(d.other2) + ' = ' + fmt(d.year2) + '<br>';
    }
    html += 'Method: ' + IC.methodLabel(d.method) + '<br>';
    html += '<strong>Monthly: ' + fmt(d.monthly) + '</strong>';
    html += '</div></div></div>';
    return html;
```

- [ ] **Step 8: Build + test**

```bash
npm run build && npm test
```

Expected: `Minified 63/63 files` and `tests 331 ... fail 0`.

- [ ] **Step 9: Manual spot-check (must run server locally)**

```bash
npm run dev
```

Open `http://localhost:3000/calculators/income/schedule-c`. Enter `60000` into Business 1's Net Profit Year 1 only — leave all Year 2 fields zero. Open "Show Calculations". The Business 1 math step should show only "Subtotal Year 1", only "Less Meals: $0" (no `$0 / $0`), only the "Year 1 =" line, and method "Year 1 / 12". No "Year 2" rows. Stop the dev server.

Repeat the spot-check on `http://localhost:3000/calculators/income/1040` with a single W-2 amount (Year 1 only) — the W-2 math step should show only Year 1 Total, no Year 2 Total row.

- [ ] **Step 10: Commit**

```bash
git add public/js/calculators/income/schedule-c.js \
        public/js/calculators/income/1040.js \
        public/js/calculators/income/1120.js \
        public/js/calculators/income/1120s.js \
        public/js/calculators/income/1065.js \
        public/js/calculators/income/k1.js \
        public/js/calculators/income/1120s-k1.js
git commit -m "$(cat <<'EOF'
fix(income): hide empty Year 2 rows in math steps across 7 calcs

Schedule-c, 1040, 1120, 1120s, 1065, k1, 1120s-k1 previously rendered
"$0 / $0" sub-rows and a full Year 2 calculation line when the user
had no Y2 data. Now matches the schedule-d/-e/-e-subject/-f pattern:
when no Y2 data is present, math steps show Y1 only and the policy
collapses to "Year 1 / 12".

Compute functions widened to return hasYr2 (which they already
compute internally). Math-step builders read it to gate Y2 rows
in subtotals, less-than rows, and the Y2 calculation line.

No change to computed monthly income.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification, push, deploy

- [ ] **Step 1: Full build + test + lint**

```bash
npm run build && npm test && npm run lint 2>&1 | grep -E "(error|warning)" | grep -v "IncomeUpload" | head -20
```

Expected:
- `Minified 63/63 files`
- `tests 331 ... fail 0`
- No new lint errors introduced (pre-existing `IncomeUpload is not defined` warnings are tolerated; nothing else from touched files)

- [ ] **Step 2: Manual end-to-end spot check (local dev server)**

```bash
npm run dev
```

Walk through these four pages with their key checks:

1. `http://localhost:3000/calculators/income/schedule-d`
   - Enter `-5000` Y1, `0` Y2 → Monthly Income renders in red, no Y2 row in math steps.
   - Enter `5000` Y1, `3000` Y2 → Both years show in math steps, monthly figure in default color, method label reads `"24-month average (Year 1 > Year 2)"`.

2. `http://localhost:3000/calculators/income/1040`
   - Enter `60000` W-2 Y1, leave Y2 blank → W-2 math step has no Year 2 Total row, method label matches the schedule-d format.

3. `http://localhost:3000/calculators/income/1120s`
   - Enter values into S-Corp 1 Y1 only → math step shows Subtotal Year 1, Less Mortgages/Meals (Y1 only), no Y2 line.
   - Verify the displayed "Subtotal Year 1" equals the sum of inputs (the fix-2 change — should be a real subtotal, not reverse-engineered).

4. `http://localhost:3000/calculators/income/rental-1038`
   - Method A: enter Rents 30000, Total Expenses 25000, Months 12, PITIA 2000 → result is `(30000-25000)/12 - 2000 = -1583.33` (approx). Should render in red.

Stop the dev server (Ctrl-C).

- [ ] **Step 3: Push to main**

```bash
git push origin main
```

- [ ] **Step 4: Deploy to production**

SSH to the EC2 server and run the deploy script:

```bash
# From the EC2 box (user: ubuntu, host: 54.175.238.145):
cd <path-to-msfg-calc-checkout>
bash deploy/update.sh
```

That script does: `git pull origin main && npm ci && npm run build && pm2 restart msfg-calc`. If invoked from the dev machine instead, SSH via the configured key:

```bash
ssh -i /Users/zacharyzink/MSFG/Security/msfg-mortgage-key.pem ubuntu@54.175.238.145 \
  'cd <path-to-msfg-calc> && bash deploy/update.sh'
```

(If SSH from the dev machine fails — e.g., timeout, security-group block — the deploy must be run interactively from the EC2 console or whatever remote-access path you normally use.)

- [ ] **Step 5: Smoke-check production**

After `pm2 restart` completes, hit the prod URL of one income calculator (whichever you have a known good test record for) and confirm the math steps and result coloring behave as the local spot-checks did.

---

## Out of scope (deferred)

Per the spec's "Out of scope" section, these are explicitly NOT in this plan:
- Functional slot picker UI
- Cross-calculator data flow
- Session state persistence
- PDF export
- 3+ year averaging
- Math steps as tables
- Trend visualization
- Collapsing unused entity/K-1 slots
- "AI-filled" indicator badges
- Inline line-number help tooltips
- Richer doc cards
