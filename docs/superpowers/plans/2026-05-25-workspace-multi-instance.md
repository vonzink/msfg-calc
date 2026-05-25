# Workspace Multi-Instance + Multi-Slot Calc Collapse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the spec at `docs/superpowers/specs/2026-05-25-workspace-multi-instance-design.md`. Workspace panels become `instanceId`-keyed with editable labels; 5 multi-slot income calcs collapse to single-entity.

**Architecture:** Five calc collapses (mechanical, independent) ship first to land the simpler per-page UX. Then the workspace gains multi-instance plumbing, then the panel-header label, then the selector counter. Nine tasks, one atomic commit per task.

**Tech Stack:** Vanilla JS (ES6 + IIFE), EJS templates, plain CSS, Express 5. esbuild via `npm run build`. Node test runner via `npm test`.

---

## File Structure

Files modified across all tasks:

- `public/js/calculators/income/k1.js` — collapse to 1 entity (Task 1)
- `views/calculators/income/k1.ejs` — drop K-1 #2..4 sections (Task 1)
- `public/js/calculators/income/1120s-k1.js` — collapse to 1 entity (Task 2)
- `views/calculators/income/1120s-k1.ejs` — drop K-1 #2..4 sections (Task 2)
- `public/js/calculators/income/schedule-c.js` — collapse to 1 business (Task 3)
- `views/calculators/income/schedule-c.ejs` — drop Business 2 (Task 3)
- `public/js/calculators/income/1065.js` — collapse to 1 partnership (Task 4)
- `views/calculators/income/1065.ejs` — drop Partnership 2 (Task 4)
- `public/js/calculators/income/1120s.js` — collapse to 1 S-Corp (Task 5)
- `views/calculators/income/1120s.ejs` — drop S-Corp 2 (Task 5)
- `public/js/workspace.js` — multi-instance plumbing + label + selector counter (Tasks 6, 7, 8)
- `views/workspace.ejs` — minor selector markup tweaks if needed (Task 8)
- `public/css/workspace.css` (or workspace style file in `public/css/`) — styles for editable label + count badge (Tasks 7, 8)

No new files created. No test changes (existing 331-test suite should pass after each commit).

The 5 calc collapses (Tasks 1–5) are independent of each other and of the workspace work; they can ship in any order. The workspace tasks (6, 7, 8) are sequential — Task 6 establishes the instance model that 7 and 8 build on.

---

## Task 1: Collapse `k1` (Schedule K-1 1065) to single entity

**Files:**
- Modify: `views/calculators/income/k1.ejs`
- Modify: `public/js/calculators/income/k1.js`

The current page has K-1 #1, K-1 #2 (Optional), K-1 #3 (Optional), K-1 #4 (Optional) — each a `<div class="calc-section">` with `<h2>K-1 #N</h2>` and an `.income-table`. Plus four `.result-card`s and a `.result-highlight` for the combined total. After this task there is exactly one K-1 section, one result card, no combined total.

- [ ] **Step 1: Delete sections K-1 #2, K-1 #3, K-1 #4 from `views/calculators/income/k1.ejs`**

Locate the second `<div class="calc-section">` whose `<h2>` is `K-1 #2 (Optional)`. Delete that entire `<div class="calc-section">` block through its matching closing `</div>`. Repeat for `K-1 #3 (Optional)` and `K-1 #4 (Optional)`. Inputs in those sections (`k2_*`, `k3_*`, `k4_*` IDs) all go away.

- [ ] **Step 2: Update the K-1 #1 section heading**

Change the `<h2>K-1 #1</h2>` heading to `<h2>Schedule K-1</h2>`. The introductory `<p>` describing it can stay or get a light edit to remove "from first partnership" phrasing if present; otherwise leave as-is.

- [ ] **Step 3: Replace the results grid with a single result card and drop the combined-total highlight**

Find the block that contains four `.result-card` divs (`result_k1`, `result_k2`, `result_k3`, `result_k4`) and the `.result-highlight` block with `id="combinedK1"`. Replace the entire results-grid + result-highlight block with:

```html
      <div class="result-highlight u-mt-lg">
        <div class="result-highlight__label">Monthly K-1 Income</div>
        <div class="result-highlight__value" id="combinedK1">$0.00</div>
      </div>
```

Keep the element `id="combinedK1"` — workspace tally and report extractors read this id. Single-entity calcs reuse it as the only output.

- [ ] **Step 4: Rewrite `public/js/calculators/income/k1.js` to drop the 4-entity loop**

Open `public/js/calculators/income/k1.js`. Make the following changes (the file is short — under 260 lines today):

a) Delete the line `const K1_COUNT = 4;`.

b) Delete the local variable `let aiTargetK1 = 1;` if still present (the prior aiTarget cleanup pass removed similar declarations across other calcs; verify and remove if found).

c) Replace the `calculate()` function body. Current loop:

```js
  function calculate() {
    const results = [];
    let combined = 0;

    for (let i = 1; i <= K1_COUNT; i++) {
      const k = computeK1(i);
      results.push(k);

      IC.setResult('k' + i + '_yr1', k.year1);
      IC.setResult('k' + i + '_yr2', k.year2);
      IC.setResult('k' + i + '_month', k.monthly);
      IC.setResult('resultK' + i, k.monthly);

      combined += k.monthly;
    }

    IC.setResult('combinedK1', combined);

    updateMathSteps(results, combined);
  }
```

New body:

```js
  function calculate() {
    const k = computeK1(1);
    IC.setResult('combinedK1', k.monthly);
    updateMathSteps(k);
  }
```

d) Rewrite `updateMathSteps(results, combined)` → `updateMathSteps(k)`. The new body drops the K1_COUNT loop and renders only one entity:

```js
  function updateMathSteps(k) {
    const stepsEl = document.getElementById('calcSteps-income-k1');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    // Formula reference
    html += '<div class="math-step">';
    html += '<h4>K-1 Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<div class="math-values">';
    html += 'Annual = Ordinary + Rental RE + Other Rental + Guaranteed Payments<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    html += buildK1Step(k);

    html += '</div>';
    stepsEl.innerHTML = html;
  }
```

e) Change `buildK1Step(num, k)` to `buildK1Step(k)` (drop `num` parameter; the heading is no longer numbered). New body:

```js
  function buildK1Step(k) {
    let html = '<div class="math-step">';
    html += '<h4>K-1 Calculation</h4>';
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
  }
```

f) Replace `exportCSV()` body. Old version loops K1_COUNT and lists multiple rows; new version handles one entity:

```js
  function exportCSV() {
    const k = computeK1(1);

    IC.downloadCSV([
      ['Schedule K-1 (1065) Partnership Income Calculator'],
      [''],
      ['Year 1 Income', k.year1],
      ['Year 2 Income', k.year2],
      ['Monthly Income', k.monthly],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'k1-1065-income-');
  }
```

`computeK1(num)` keeps its signature — it's a pure helper that takes a prefix index. We always call it with `1` now, but leaving the signature unchanged means the prefix string stays `'k1'` and matches the field IDs.

- [ ] **Step 5: Build, test, manual spot-check, commit**

Run:

```bash
npm run build && npm test
```

Expected: `Minified 63/63 files` and `tests 331 ... fail 0`.

Manual sanity:

```bash
npm run dev
```

Open `http://localhost:3000/calculators/income/k1`. Verify only one K-1 section visible. Enter ordinary income `5000` Y1, rental `1000` Y1, leave Y2 blank. "Monthly K-1 Income" reads `$500.00`. Stop the dev server.

Commit:

```bash
git add views/calculators/income/k1.ejs public/js/calculators/income/k1.js
git commit -m "$(cat <<'EOF'
refactor(income/k1): collapse 4 K-1 slots to single entity

Multi-K-1 entry moves to the workspace (separate plan task). The
calc page now has one K-1 section, one result, no combined total.

Field-ID prefix (k1_*) preserved so report extractors and AI
upload still target the right inputs without further changes.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Collapse `1120s-k1` (1120S K-1) to single entity

**Files:**
- Modify: `views/calculators/income/1120s-k1.ejs`
- Modify: `public/js/calculators/income/1120s-k1.js`

Structure identical to k1 except for the field set (`ordinary`, `rentalRealEstate`, `otherRentalIncome` — no `guaranteedPayments`).

- [ ] **Step 1: Delete K-1 #2, #3, #4 sections from `views/calculators/income/1120s-k1.ejs`**

Delete each `<div class="calc-section">` block whose `<h2>` reads `K-1 #2 (Optional)`, `K-1 #3 (Optional)`, `K-1 #4 (Optional)` through their matching closing `</div>`.

- [ ] **Step 2: Update K-1 #1 heading**

Change `<h2>K-1 #1</h2>` to `<h2>1120S K-1</h2>`.

- [ ] **Step 3: Replace results grid with single result-highlight**

Find the results block containing `result_k1`..`result_k4` cards and the `combinedK1` highlight. Replace with:

```html
      <div class="result-highlight u-mt-lg">
        <div class="result-highlight__label">Monthly K-1 Income</div>
        <div class="result-highlight__value" id="combinedK1">$0.00</div>
      </div>
```

(Same `id="combinedK1"` — workspace tally + report extractor depend on it.)

- [ ] **Step 4: Rewrite `public/js/calculators/income/1120s-k1.js`**

a) Delete `const K1_COUNT = 4;`.

b) Delete `let aiTargetK1 = 1;` if present.

c) Replace `calculate()`:

```js
  function calculate() {
    const k = computeK1(1);
    IC.setResult('combinedK1', k.monthly);
    updateMathSteps(k);
  }
```

d) Replace `updateMathSteps(results, combined)` with single-entity version:

```js
  function updateMathSteps(k) {
    const stepsEl = document.getElementById('calcSteps-income-1120s-k1');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    html += '<div class="math-step">';
    html += '<h4>1120S K-1 Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<div class="math-values">';
    html += 'Annual = Ordinary + Rental RE + Other Rental<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    html += buildK1Step(k);

    html += '</div>';
    stepsEl.innerHTML = html;
  }
```

e) Replace `buildK1Step(num, d)` with `buildK1Step(d)`:

```js
  function buildK1Step(d) {
    let html = '<div class="math-step">';
    html += '<h4>K-1 Calculation</h4>';
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
  }
```

f) Replace `exportCSV()`:

```js
  function exportCSV() {
    const k = computeK1(1);

    IC.downloadCSV([
      ['1120S K-1 Income Calculator'],
      [''],
      ['Year 1 Income', k.year1],
      ['Year 2 Income', k.year2],
      ['Monthly Income', k.monthly],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], '1120s-k1-income-');
  }
```

- [ ] **Step 5: Build, test, manual spot-check, commit**

```bash
npm run build && npm test
```

`tests 331 ... fail 0`.

Manual: `npm run dev`, open `http://localhost:3000/calculators/income/1120s-k1`. Verify single section, enter `5000` ordinary Y1, see `$416.67` monthly.

Commit:

```bash
git add views/calculators/income/1120s-k1.ejs public/js/calculators/income/1120s-k1.js
git commit -m "$(cat <<'EOF'
refactor(income/1120s-k1): collapse 4 K-1 slots to single entity

Multi-K-1 entry moves to the workspace. Same shape change as k1.js:
one section, one result, no combined total. Field-ID prefix (k1_*)
preserved.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Collapse `schedule-c` (Sole Proprietorship) to single business

**Files:**
- Modify: `views/calculators/income/schedule-c.ejs`
- Modify: `public/js/calculators/income/schedule-c.js`

- [ ] **Step 1: Delete the Business 2 section from `views/calculators/income/schedule-c.ejs`**

Locate the second `<div class="calc-section">` whose `<h2>` reads `Business 2 (Optional)` (or `Business 2`). Delete the entire block from its opening `<div class="calc-section">` through its matching closing `</div>`. Inputs `b2_*` go away. The small per-section "Year 1 / Year 2 / Monthly" result widget inside Business 2 (`b2_year1`, `b2_year2`, `b2_month`) goes away too.

Also delete the Business 1 per-section result widget at the end of Business 1 (the `corp-results`/`results` div with `b1_year1`, `b1_year2`, `b1_month`). These per-section widgets duplicate the final result card and clutter a single-entity layout.

- [ ] **Step 2: Update Business 1 heading**

Change `<h2>Business 1</h2>` to `<h2>Schedule C</h2>`.

- [ ] **Step 3: Replace results grid with single result-highlight**

Find the block containing the two `.result-card` divs (`result_b1`, `result_b2`) and the `.result-highlight` with id `combined_c`. Replace with:

```html
      <div class="result-highlight u-mt-lg">
        <div class="result-highlight__label">Monthly Schedule C Income</div>
        <div class="result-highlight__value" id="combined_c">$0.00</div>
      </div>
```

- [ ] **Step 4: Rewrite `public/js/calculators/income/schedule-c.js`**

a) Delete `let aiTargetBusiness = 'b1';` if present (prior cleanup may have removed it).

b) Replace `calculate()`:

```js
  function calculate() {
    const b = computeBusiness('b1');
    IC.setResult('combined_c', b.monthly);
    updateMathSteps(b);
  }
```

c) Rewrite `updateMathSteps(data)` to handle one business. Replace the whole function body (the old one took `{b1, b2, combined}` and rendered both):

```js
  function updateMathSteps(b) {
    const stepsEl = document.getElementById('calcSteps-income-schedule-c');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    // Formula reference
    html += '<div class="math-step">';
    html += '<h4>Schedule C Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<span class="math-note">For each business:</span>';
    html += '<div class="math-values">';
    html += 'Annual = Net Profit + Other Income + Depletion + Depreciation<br>';
    html += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; + Business Use of Home + Mileage Depr + Amortization<br>';
    html += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; &minus; Meals &amp; Entertainment<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    html += buildBizStep(b);

    html += '</div>';
    stepsEl.innerHTML = html;
  }
```

d) Change `buildBizStep(label, d)` to `buildBizStep(d)` (no label arg needed; heading is fixed). New body:

```js
  function buildBizStep(d) {
    let html = '<div class="math-step">';
    html += '<h4>Schedule C Calculation</h4>';
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
  }
```

e) Replace `exportCSV()`:

```js
  function exportCSV() {
    const b = computeBusiness('b1');

    IC.downloadCSV([
      ['Schedule C Sole Proprietorship Income Calculator'],
      [''],
      ['Year 1 Income', b.year1],
      ['Year 2 Income', b.year2],
      ['Monthly Income', b.monthly],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'schedule-c-income-');
  }
```

`computeBusiness(prefix)` signature unchanged. We always call it with `'b1'`.

- [ ] **Step 5: Build, test, manual spot-check, commit**

```bash
npm run build && npm test
```

Manual: open Schedule C, enter net profit `60000` Y1, see `$5,000.00` monthly.

Commit:

```bash
git add views/calculators/income/schedule-c.ejs public/js/calculators/income/schedule-c.js
git commit -m "$(cat <<'EOF'
refactor(income/schedule-c): collapse 2 businesses to single entity

Multi-business entry moves to the workspace. Field-ID prefix (b1_*)
preserved for report extractor / AI upload compatibility.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Collapse `1065` (Partnership) to single partnership

**Files:**
- Modify: `views/calculators/income/1065.ejs`
- Modify: `public/js/calculators/income/1065.js`

- [ ] **Step 1: Delete Partnership 2 section from `views/calculators/income/1065.ejs`**

Delete the entire `<div class="calc-section">` block whose `<h2>` reads `Partnership 2 (Optional)` (or similar). The block contains all `p2_*` inputs and the per-section result widget with `p2_year1`, `p2_year2`, `p2_month`. Delete the analogous per-section result widget inside Partnership 1 if it exists.

- [ ] **Step 2: Update Partnership 1 heading**

Change `<h2>Partnership 1</h2>` to `<h2>Form 1065 Partnership</h2>`.

- [ ] **Step 3: Replace results grid with single result-highlight**

Find the block containing `result_p1`, `result_p2` cards and the `combined1065` highlight. Replace with:

```html
      <div class="result-highlight u-mt-lg">
        <div class="result-highlight__label">Monthly Partnership Income</div>
        <div class="result-highlight__value" id="combined1065">$0.00</div>
      </div>
```

- [ ] **Step 4: Rewrite `public/js/calculators/income/1065.js`**

a) Delete `let aiTargetPartnership = 'p1';` if present.

b) Replace `calculate()`:

```js
  function calculate() {
    const p = computePartnership('p1');
    IC.setResult('combined1065', p.monthly);
    updateMathSteps(p);
  }
```

c) Replace `updateMathSteps(p1, p2, combined)`:

```js
  function updateMathSteps(p) {
    const stepsEl = document.getElementById('calcSteps-income-1065');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    html += '<div class="math-step">';
    html += '<h4>Partnership Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<div class="math-values">';
    html += 'Subtotal = Ordinary + Farm + Gain + Other + Depreciation + Depletion + Amortization<br>';
    html += 'Annual = (Subtotal &minus; Mortgages &minus; Meals) &times; Ownership %<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    html += buildPartnershipStep(p);

    html += '</div>';
    stepsEl.innerHTML = html;
  }
```

d) Change `buildPartnershipStep(label, p)` to `buildPartnershipStep(p)`:

```js
  function buildPartnershipStep(p) {
    let html = '<div class="math-step">';
    html += '<h4>Partnership Calculation</h4>';
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
  }
```

e) Replace `exportCSV()`:

```js
  function exportCSV() {
    const p = computePartnership('p1');

    IC.downloadCSV([
      ['Form 1065 Partnership Income Calculator'],
      [''],
      ['Year 1 Income', p.total1],
      ['Year 2 Income', p.total2],
      ['Ownership %', p.own],
      ['Monthly Income', p.monthly],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'form1065-income-');
  }
```

- [ ] **Step 5: Build, test, manual spot-check, commit**

```bash
npm run build && npm test
```

Manual: open 1065, enter ordinary income `60000` Y1, ownership `100`, see `$5,000.00`.

Commit:

```bash
git add views/calculators/income/1065.ejs public/js/calculators/income/1065.js
git commit -m "$(cat <<'EOF'
refactor(income/1065): collapse 2 partnerships to single entity

Multi-partnership entry moves to the workspace. Field-ID prefix (p1_*)
preserved.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Collapse `1120s` (S-Corporation) to single S-Corp

**Files:**
- Modify: `views/calculators/income/1120s.ejs`
- Modify: `public/js/calculators/income/1120s.js`

- [ ] **Step 1: Delete S-Corp 2 section from `views/calculators/income/1120s.ejs`**

Delete the entire `<div class="calc-section">` block whose `<h2>` reads `S-Corporation 2 (Optional)` (or similar). All `c2_*` inputs and the per-section result widget go away. Delete the analogous per-section result widget inside S-Corp 1.

- [ ] **Step 2: Update S-Corp 1 heading**

Change `<h2>S-Corporation 1</h2>` to `<h2>Form 1120S S-Corporation</h2>`.

- [ ] **Step 3: Replace results grid with single result-highlight**

Find the block containing `result_c1`, `result_c2` cards and `combined1120s` highlight. Replace with:

```html
      <div class="result-highlight u-mt-lg">
        <div class="result-highlight__label">Monthly S-Corp Income</div>
        <div class="result-highlight__value" id="combined1120s">$0.00</div>
      </div>
```

- [ ] **Step 4: Rewrite `public/js/calculators/income/1120s.js`**

a) Delete `let aiTargetCorp = 'c1';` if present.

b) Replace `calculate()`:

```js
  function calculate() {
    const c = computeCorp('c1');
    IC.setResult('combined1120s', c.monthly);
    updateMathSteps(c);
  }
```

c) Replace `updateMathSteps(c1, c2, combined)`:

```js
  function updateMathSteps(c) {
    const stepsEl = document.getElementById('calcSteps-income-1120s');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    html += '<div class="math-step">';
    html += '<h4>S-Corporation Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<div class="math-values">';
    html += 'Subtotal = Net Gain + Other + Depreciation + Depletion + Amortization<br>';
    html += 'Annual = Subtotal &minus; Mortgages &minus; Meals<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = ((Year 1 + Year 2) / 24) &times; Ownership %<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 / 12) &times; Ownership %';
    html += '</div></div></div>';

    html += buildCorpStep(c);

    html += '</div>';
    stepsEl.innerHTML = html;
  }
```

d) Change `buildCorpStep(label, c)` to `buildCorpStep(c)`:

```js
  function buildCorpStep(c) {
    let html = '<div class="math-step">';
    html += '<h4>S-Corporation Calculation</h4>';
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
  }
```

e) Replace `exportCSV()`:

```js
  function exportCSV() {
    const c = computeCorp('c1');

    IC.downloadCSV([
      ['Form 1120S S-Corporation Income Calculator'],
      [''],
      ['Year 1 Income', c.year1],
      ['Year 2 Income', c.year2],
      ['Ownership %', c.own],
      ['Monthly Income', c.monthly],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'form1120s-income-');
  }
```

- [ ] **Step 5: Build, test, manual spot-check, commit**

```bash
npm run build && npm test
```

Manual: open 1120s, enter net gain `60000` Y1, ownership `100`, see `$5,000.00`.

Commit:

```bash
git add views/calculators/income/1120s.ejs public/js/calculators/income/1120s.js
git commit -m "$(cat <<'EOF'
refactor(income/1120s): collapse 2 S-Corps to single entity

Multi-S-Corp entry moves to the workspace. Field-ID prefix (c1_*)
preserved.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Workspace multi-instance plumbing

**Files:**
- Modify: `public/js/workspace.js`

This task makes panels `instanceId`-keyed and migrates existing sessionStorage shape. It does NOT add the editable label or selector counter — those come in Tasks 7 and 8.

- [ ] **Step 1: Add `genInstanceId` helper near the top of the IIFE**

In `public/js/workspace.js`, just below the existing `let activePanels = [];` and `const DEFAULT_ZOOM = 85;` lines, add:

```js
  function genInstanceId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return 'wsi-' + window.crypto.randomUUID();
    }
    return 'wsi-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
```

- [ ] **Step 2: Rewrite `addPanel` to accept an optional `opts` arg and key by `instanceId`**

Locate the current `addPanel` function. Its body starts with the duplicate-prevention guard `if (activePanels.find(...)) return;` and continues with panel object creation and DOM building.

Change the signature and the panel object. Find:

```js
  function addPanel(slug, name, icon) {
    if (activePanels.find((p) => p.slug === slug)) return;

    const panel = {
      slug: slug,
      name: name,
      icon: icon,
      zoom: DEFAULT_ZOOM,
      tally: { monthlyPayment: 0, loanAmount: 0, cashToClose: 0, monthlyIncome: 0 }
    };
    activePanels.push(panel);

    const el = document.createElement('div');
    el.className = 'ws-panel';
    el.id = 'ws-panel-' + slug;
```

Replace with:

```js
  function addPanel(slug, name, icon, opts) {
    opts = opts || {};
    const instanceId = opts.instanceId || genInstanceId();
    const label = opts.label || name;
    const zoom = opts.zoom || DEFAULT_ZOOM;

    const panel = {
      instanceId: instanceId,
      slug: slug,
      name: name,
      label: label,
      icon: icon,
      zoom: zoom,
      tally: { monthlyPayment: 0, loanAmount: 0, cashToClose: 0, monthlyIncome: 0 }
    };
    activePanels.push(panel);

    const el = document.createElement('div');
    el.className = 'ws-panel';
    el.id = 'ws-panel-' + instanceId;
```

Note the removed duplicate-prevention guard — multiple instances of the same slug are now allowed. The DOM id switches from `ws-panel-${slug}` to `ws-panel-${instanceId}`.

- [ ] **Step 3: Update all DOM ID references inside `addPanel` that used `slug` to use `instanceId`**

Search the `addPanel` function body for further references to `'ws-panel-' + slug`. There should be none after Step 2, but if the implementer finds any (e.g., inside event handlers built into the inner HTML), update each to `'ws-panel-' + instanceId`.

Inside the same function, the `panel` object is now closed over for the iframe `load` handler and other listeners. Anywhere the inner handlers reference `slug` to look up other DOM (e.g., `document.getElementById('ws-panel-' + slug)`), change those to use `panel.instanceId`. In practice the existing handlers already use the `panel` and `iframe` closure variables — no further change expected. Verify by reading the function body end-to-end after the Step 2 edit.

- [ ] **Step 4: Update `saveAllInputs` and `extractPanelInputs` to key by instanceId**

Find:

```js
  function saveAllInputs() {
    const data = {};
    activePanels.forEach((panel) => {
      const inputs = extractPanelInputs(panel.slug);
      if (inputs) data[panel.slug] = inputs;
    });
    try {
      sessionStorage.setItem('msfg-workspace-inputs', JSON.stringify(data));
    } catch (e) { /* quota exceeded or private mode */ }
  }

  function extractPanelInputs(slug) {
    const panelEl = document.getElementById('ws-panel-' + slug);
```

Change to:

```js
  function saveAllInputs() {
    const data = {};
    activePanels.forEach((panel) => {
      const inputs = extractPanelInputs(panel.instanceId);
      if (inputs) data[panel.instanceId] = inputs;
    });
    try {
      sessionStorage.setItem('msfg-workspace-inputs', JSON.stringify(data));
    } catch (e) { /* quota exceeded or private mode */ }
  }

  function extractPanelInputs(instanceId) {
    const panelEl = document.getElementById('ws-panel-' + instanceId);
```

- [ ] **Step 5: Update `scheduleRestore` and `restorePanelInputs` to key by instanceId**

Find every reference to `allData[slug]` inside `scheduleRestore` and `restorePanelInputs`. Change to `allData[instanceId]`. The function signatures themselves also change: `scheduleRestore(iframe, slug)` → `scheduleRestore(iframe, instanceId)`, `restorePanelInputs(slug)` → `restorePanelInputs(instanceId)`. Update call sites accordingly.

Find the iframe `load` handler inside `addPanel`:

```js
    iframe.addEventListener('load', () => {
      MSFG.WS.applyZoomToIframe(iframe, panel.zoom);
      MSFG.WorkspaceMISMO.schedulePopulate(iframe, slug);
      scheduleRestore(iframe, slug);
    });
```

Change to:

```js
    iframe.addEventListener('load', () => {
      MSFG.WS.applyZoomToIframe(iframe, panel.zoom);
      MSFG.WorkspaceMISMO.schedulePopulate(iframe, slug);
      scheduleRestore(iframe, panel.instanceId);
    });
```

(The MISMO populate still uses `slug` because MISMO config is per-calc-type, not per-instance. Leave it.)

- [ ] **Step 6: Save the panels array under the new shape**

Find the function that persists `activePanels` to `msfg-workspace-panels` (search for `'msfg-workspace-panels'` setItem call). The save must now include `instanceId` and `label` for each panel. If a `saveAllPanels()` function exists, update it; if the save is inlined in another handler (e.g. `addPanel`, `removePanel`), update each site. Example expected shape:

```js
  function saveAllPanels() {
    const data = activePanels.map((p) => ({
      instanceId: p.instanceId,
      slug: p.slug,
      label: p.label,
      icon: p.icon,
      zoom: p.zoom
    }));
    try {
      sessionStorage.setItem('msfg-workspace-panels', JSON.stringify(data));
    } catch (e) { /* quota */ }
  }
```

If `saveAllPanels` is currently inline, factor it into a function with this exact body. Call it everywhere panels are added or removed (currently typically right after `activePanels.push(...)` and after panel removal handlers).

- [ ] **Step 7: Rewrite `restorePanels` to migrate the old shape on load**

Find the existing `restorePanels` function. Replace its body with the migration-aware version:

```js
  function restorePanels() {
    const stored = sessionStorage.getItem('msfg-workspace-panels');
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      if (!Array.isArray(data) || data.length === 0) return;
      data.forEach((p) => {
        if (!p.slug) return;
        // Migrate old shape (no instanceId) → set instanceId = slug
        const instanceId = p.instanceId || p.slug;
        const label = p.label || p.name;
        addPanel(p.slug, p.name, p.icon, { instanceId, label, zoom: p.zoom });
      });
      // Persist back under the new shape so old data dies on next save
      saveAllPanels();
    } catch (e) { /* corrupted data, skip */ }
  }
```

Migration is one-shot: on load, any old slug-keyed entries are read in, then immediately rewritten under the new shape (instanceId = slug for migrated entries; brand-new entries get UUIDs).

- [ ] **Step 8: Update the URL `?add=` auto-add path**

Find the block beginning `// Auto-add calculators from URL query params`. Currently it checks `!btn.classList.contains('active')` to dedupe and calls `addPanel(slug, name, icon)` once per slug. Replace with:

```js
    const urlParams = new URLSearchParams(window.location.search);
    const addParam = urlParams.get('add');
    if (addParam) {
      const slugsToAdd = addParam.split(',').map((s) => s.trim()).filter(Boolean);
      slugsToAdd.forEach((slug) => {
        const btn = document.querySelector('.workspace__selector-btn[data-slug="' + slug + '"]');
        if (!btn) return;
        const nameEl = btn.querySelector('.workspace__selector-name');
        const iconEl = btn.querySelector('.workspace__selector-icon');
        const name = nameEl ? nameEl.textContent : slug;
        const icon = iconEl ? iconEl.textContent : '\u{1F4DD}';
        addPanel(slug, name, icon);
      });
      if (window.history.replaceState) {
        window.history.replaceState({}, '', '/workspace');
      }
    }
```

No `.active` check; every slug occurrence in the comma list creates a new panel.

- [ ] **Step 9: Update the selector button click handler to always add a new instance**

Find the selector button click handler (search the IIFE for `.workspace__selector-btn` followed by `.addEventListener('click'`). Today its inner logic toggles `.active` and calls `addPanel(slug, name, icon)` only if not active. Replace with the always-add behavior:

```js
    document.querySelectorAll('.workspace__selector-btn').forEach((btn) => {
      btn.addEventListener('click', function() {
        const slug = btn.getAttribute('data-slug');
        const nameEl = btn.querySelector('.workspace__selector-name');
        const iconEl = btn.querySelector('.workspace__selector-icon');
        const name = nameEl ? nameEl.textContent : slug;
        const icon = iconEl ? iconEl.textContent : '\u{1F4DD}';
        addPanel(slug, name, icon);
        btn.classList.add('active');
      });
    });
```

(Counter UX comes in Task 8 — leave a plain `.active` toggle for now.)

- [ ] **Step 10: Update panel close / removeAll handlers to handle instance-keyed state**

Find the wsClearAll handler:

```js
    document.getElementById('wsClearAll').addEventListener('click', () => {
      activePanels = [];
      panelsContainer.querySelectorAll('.ws-panel').forEach((p) => { p.remove(); });
      document.querySelectorAll('.workspace__selector-btn.active').forEach((b) => { b.classList.remove('active'); });
      sessionStorage.removeItem('msfg-workspace-panels');
      sessionStorage.removeItem('msfg-workspace-inputs');
      updateState();
    });
```

Leave this as-is — it clears everything and works regardless of keying.

Find the per-panel close handler (search for `.ws-panel__btn--close` click handler). Its current logic removes the panel by slug. Update it to:

```js
      el.querySelector('.ws-panel__btn--close').addEventListener('click', (e) => {
        e.stopPropagation();
        activePanels = activePanels.filter((p) => p.instanceId !== panel.instanceId);
        el.remove();

        // If this was the last instance of this slug, un-active the selector button
        const stillHasSlug = activePanels.some((p) => p.slug === slug);
        if (!stillHasSlug) {
          const btn = document.querySelector('.workspace__selector-btn[data-slug="' + slug + '"]');
          if (btn) btn.classList.remove('active');
        }

        saveAllPanels();
        saveAllInputs();
        updateState();
      });
```

If the existing handler has a different shape (e.g., it currently looks up `panelEl` by `'ws-panel-' + slug`), replace the slug filter with `instanceId` filter as above.

- [ ] **Step 11: Build + test**

```bash
npm run build && npm test
```

Expected: `Minified 63/63 files` and `tests 331 ... fail 0`.

- [ ] **Step 12: Manual spot-check — multi-instance**

```bash
npm run dev
```

Open `http://localhost:3000/workspace`. Click "Add Calculator", click Schedule K-1 in the drawer. Click Schedule K-1 again. Two K-1 panels should appear (each with its own iframe loading `/calculators/income/k1`). Each panel's DOM id is unique (inspect; you should see two different `wsi-…` instance ids).

Close one panel. The other remains. Refresh the page. The remaining panel restores. The closed panel is gone.

Stop the dev server.

- [ ] **Step 13: Commit**

```bash
git add public/js/workspace.js
git commit -m "$(cat <<'EOF'
feat(workspace): key panels by instanceId, allow multi-instance

addPanel no longer guards against duplicate slugs. Each call creates
a new panel with a generated instanceId (crypto.randomUUID fallback
to Date.now+random for older browsers). sessionStorage shape changes:

  msfg-workspace-panels  : [{ instanceId, slug, label, icon, zoom }]
  msfg-workspace-inputs  : { [instanceId]: ... }

restorePanels migrates old (slug-keyed) entries by assigning
instanceId = slug, then re-persists under the new shape. One-shot.

URL ?add=slug,slug now produces one panel per occurrence. The
selector button .active class still tracks "at least one of this
slug exists" but no longer blocks new adds.

Label field added to panel state. Editable label UI ships in a
follow-up task.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Editable panel-header label

**Files:**
- Modify: `public/js/workspace.js`
- Modify: `public/css/workspace.css` (create if missing, or add styles inline to `views/workspace.ejs` if existing CSS file isn't found)

This task adds the user-editable label to each panel's header.

- [ ] **Step 1: Locate the panel header HTML template inside `addPanel`**

In `public/js/workspace.js`, find the line `el.innerHTML = '<div class="ws-panel__head` (or similar — it's the template literal that builds the panel's DOM). The header structure today is roughly:

```html
<div class="ws-panel__header">
  <span class="ws-panel__icon">{icon}</span>
  <span class="ws-panel__name">{name}</span>
  <button class="ws-panel__btn ws-panel__btn--collapse">…</button>
  <button class="ws-panel__btn ws-panel__btn--report">…</button>
  <button class="ws-panel__btn ws-panel__btn--close">…</button>
</div>
```

(Exact class names may differ; locate the actual structure by reading the file. The principle: there's a header bar with the calculator name as text.)

- [ ] **Step 2: Replace the static `.ws-panel__name` span with an editable label element**

Change the panel name span from:

```html
<span class="ws-panel__name">' + name + '</span>
```

to:

```html
<span class="ws-panel__label" contenteditable="true" spellcheck="false" data-default="' + escAttr(name) + '">' + escHtml(label) + '</span>
```

If `escHtml` / `escAttr` helpers don't exist in this file, use `MSFG.escHtml` (defined in `public/js/shared/utils.js` per CLAUDE.md). For the attribute version, wrap in single-quote-safe escape; if MSFG doesn't expose one, define a local:

```js
  function escAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
```

(Place near `genInstanceId` from Task 6.)

The data-default attribute holds the calc's display name so an empty edit reverts to it.

- [ ] **Step 3: Wire the label input handler**

After the existing header-click and collapse-toggle handlers inside `addPanel`, add an input listener that writes back to panel state, persists, and prevents the click from collapsing the panel:

```js
    const labelEl = el.querySelector('.ws-panel__label');
    if (labelEl) {
      labelEl.addEventListener('click', (e) => {
        // Click on the label is for editing — don't collapse the panel
        e.stopPropagation();
      });
      labelEl.addEventListener('keydown', (e) => {
        // Enter commits the edit and blurs
        if (e.key === 'Enter') {
          e.preventDefault();
          labelEl.blur();
        }
      });
      labelEl.addEventListener('blur', () => {
        let val = (labelEl.textContent || '').trim();
        if (val.length > 80) val = val.slice(0, 80);
        if (!val) val = labelEl.getAttribute('data-default') || panel.name;
        labelEl.textContent = val;
        panel.label = val;
        saveAllPanels();
      });
      labelEl.addEventListener('input', () => {
        // Enforce 80-char limit live
        if ((labelEl.textContent || '').length > 80) {
          labelEl.textContent = labelEl.textContent.slice(0, 80);
          // Restore caret to end
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(labelEl);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    }
```

- [ ] **Step 4: Add CSS for the editable label**

Locate the workspace CSS file. If `public/css/workspace.css` exists, append to it. If it does not, check what stylesheet currently styles the workspace (look at the `<link>` tags in `views/workspace.ejs`). Add the styles to whichever file is loaded by the workspace page. As a fallback if no obvious file exists, add a small `<style>` block to `views/workspace.ejs` just above the closing `</div>` of the outer `.workspace` container — style-src CSP allows `'unsafe-inline'`.

Styles:

```css
.ws-panel__label {
  cursor: text;
  padding: 2px 4px;
  border-radius: 4px;
  outline: none;
  min-width: 4ch;
  display: inline-block;
}
.ws-panel__label:hover {
  background: var(--surface-alt, rgba(0,0,0,0.04));
}
.ws-panel__label:focus {
  background: var(--surface-alt, rgba(0,0,0,0.06));
  box-shadow: 0 0 0 2px var(--brand-primary, #3b82f6);
}
```

- [ ] **Step 5: Build + test**

```bash
npm run build && npm test
```

`tests 331 ... fail 0`.

- [ ] **Step 6: Manual spot-check — label persistence**

```bash
npm run dev
```

Open `/workspace`. Add a Schedule K-1. The header label reads `Schedule K-1` (the default). Click it; cursor enters. Type `Acme Corp`. Click outside. The header now reads `Acme Corp`. Refresh — `Acme Corp` persists. Add a second K-1 (defaults again to `Schedule K-1`). Verify the two panels are independent.

Clear the label entirely and click out — it should revert to the default `Schedule K-1`.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add public/js/workspace.js public/css/workspace.css views/workspace.ejs
git commit -m "$(cat <<'EOF'
feat(workspace): editable per-panel label in header

Each panel header now exposes a contenteditable label that defaults
to the calculator's display name (e.g. "Schedule K-1"). Users can
rename to identify the entity ("Acme Corp", "123 Main St"). Empty
edits revert to the default; max length 80 chars.

Label persists in panel state and round-trips through sessionStorage.
Workspace-only — standalone calc pages are unaware of labels.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

(If the `public/css/workspace.css` file didn't exist and the implementer added an inline `<style>` block to `views/workspace.ejs` instead, omit the CSS file from `git add` and include only the EJS file.)

---

## Task 8: Selector button instance counter

**Files:**
- Modify: `public/js/workspace.js`
- Modify: `public/css/workspace.css` (or wherever workspace styles live — same file as Task 7)

Adds a small `×N` badge to each selector button when there are 2+ instances of that calc type.

- [ ] **Step 1: Add `updateSelectorCounts()` helper**

In `public/js/workspace.js`, near the other helpers in the IIFE (e.g., right after `genInstanceId`), add:

```js
  function updateSelectorCounts() {
    // Group active panels by slug
    const counts = {};
    activePanels.forEach((p) => {
      counts[p.slug] = (counts[p.slug] || 0) + 1;
    });
    document.querySelectorAll('.workspace__selector-btn').forEach((btn) => {
      const slug = btn.getAttribute('data-slug');
      const n = counts[slug] || 0;
      let badge = btn.querySelector('.workspace__selector-count');
      if (n > 1) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'workspace__selector-count';
          btn.appendChild(badge);
        }
        badge.textContent = '×' + n;
      } else if (badge) {
        badge.remove();
      }
      // Keep .active in sync (covers cases where Task 6's add/remove handlers
      // didn't toggle .active accurately)
      btn.classList.toggle('active', n >= 1);
    });
  }
```

- [ ] **Step 2: Call `updateSelectorCounts()` from every panel add/remove path**

In `addPanel`, after the new panel is pushed into `activePanels` and the DOM appended (i.e., at the very end of the function), add:

```js
    updateSelectorCounts();
```

In the per-panel close handler (the `.ws-panel__btn--close` click handler from Task 6 Step 10), after `saveAllPanels()` and `saveAllInputs()`, add (replacing the manual `.active` toggle logic that was added in Task 6):

```js
        updateSelectorCounts();
```

Remove the explicit `btn.classList.remove('active')` block from that handler since `updateSelectorCounts` now manages `.active`.

In the `wsClearAll` handler, after the existing `document.querySelectorAll('.workspace__selector-btn.active').forEach((b) => { b.classList.remove('active'); });`, add a call:

```js
      updateSelectorCounts();
```

The `forEach .remove('active')` line can stay as a no-op safety net or be deleted — `updateSelectorCounts()` will set every button's `.active` correctly because `activePanels` is empty at that point.

In `restorePanels` (modified in Task 6), after the addPanel loop and `saveAllPanels()`, add:

```js
    updateSelectorCounts();
```

- [ ] **Step 3: Add CSS for the badge**

Append to the workspace CSS file (or inline `<style>` block — see Task 7 Step 4):

```css
.workspace__selector-count {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  background: var(--brand-primary, #3b82f6);
  color: #fff;
  font-size: 0.75em;
  border-radius: 10px;
  vertical-align: middle;
}
```

- [ ] **Step 4: Build + test**

```bash
npm run build && npm test
```

`tests 331 ... fail 0`.

- [ ] **Step 5: Manual spot-check — counter**

```bash
npm run dev
```

Open `/workspace`. Open the selector drawer. Click Schedule K-1 — drawer button shows `.active` (whatever visual indicator is already styled), no badge yet. Click it again — badge `×2` appears. Click again — `×3`. Close one panel — `×2`. Close another — badge disappears, button still `.active`. Close the last — `.active` removed.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add public/js/workspace.js public/css/workspace.css views/workspace.ejs
git commit -m "$(cat <<'EOF'
feat(workspace): selector button counter for multi-instance

When a calc has 2+ instances in the workspace, its selector drawer
button shows a small "×N" badge. Single-instance shows no badge.
Zero-instance removes any badge.

updateSelectorCounts() runs on every add, remove, restore, and
clearAll, replacing the ad-hoc .active toggling from prior code.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Final verification, push, deploy

**Files:** None modified. Verification only.

- [ ] **Step 1: Full build + test + lint**

```bash
npm run build && npm test && npm run lint 2>&1 | grep -E "error" | grep -v "IncomeUpload" | grep -v "\.min\.js" | head -10 || echo "no new lint issues"
```

Expected:
- `Minified 63/63 files`
- `tests 331 ... fail 0`
- `no new lint issues` (pre-existing `.min.js` semicolon warnings and `IncomeUpload is not defined` warnings are tolerated)

- [ ] **Step 2: End-to-end manual spot-check**

```bash
npm run dev
```

Walk through this sequence at `http://localhost:3000`:

1. `/calculators/income/k1` — only one K-1 section visible. Enter values, see monthly result.
2. `/calculators/income/1120s-k1` — only one K-1 section visible.
3. `/calculators/income/schedule-c` — only Business 1 section. Enter net profit `60000` Y1, see `$5,000.00` monthly.
4. `/calculators/income/1065` — only Partnership 1. Enter values with ownership `100`, see expected monthly.
5. `/calculators/income/1120s` — only S-Corp 1. Enter values with ownership `100`, see expected monthly.
6. `/workspace` — selector drawer opens. Add Schedule K-1 three times. Three panels, each with `Schedule K-1` default label, selector button shows `×3` badge.
7. Rename the first panel to `Acme Corp`. Rename the second to `Beta LLC`. Refresh — both labels persist.
8. Close `Beta LLC`. Badge updates to `×2`. The remaining `Acme Corp` and unnamed third panel stay.
9. Add a Schedule E. Rename to `123 Main St`. Selector button for Schedule E shows `.active`, no badge (only one instance).
10. Hit `?add=income/k1,income/k1,income/schedule-c` URL. Two new K-1 panels (count badge goes up) and one new Schedule C panel.

Stop the dev server.

- [ ] **Step 3: Push to main**

```bash
git push origin main
```

- [ ] **Step 4: Surface deploy command for the user**

The deploy itself runs on the EC2 box. Report the command back to the user:

```bash
cd ~/msfg-calc && bash deploy/update.sh
```

The script runs `git pull origin main && npm ci && npm run build && pm2 restart msfg-calc`.

- [ ] **Step 5: After deploy, smoke-check production**

When the user confirms the deploy completed, open `https://msfginfo.com/workspace` (or whichever prod URL). Add two Schedule K-1 panels, name one, confirm the labels and instance counter behave as on local. If anything is off, capture details and iterate.

---

## Out of scope (deferred to later specs)

Per the spec's "Out of scope" section, these are explicitly NOT in this plan:

- Per-instance labels visible on standalone calc pages (label would have to move into calc data — ruled out by user).
- Report template restructuring to handle multi-instance same-slug capture. Two instances of `income/k1` will still capture under one slug; their data will collide in the report. Flagged as follow-up.
- Saved / named workspace presets ("John Smith file" — load a labeled set of panels with input data).
- Multi-instance support for `schedule-b` (3-institution interest/dividend page). Explicitly out of scope per scope choice during brainstorming.
- Standalone calc page deprecation. Standalone pages remain available for quick one-off use.
- A separate "rename" button next to the editable label.
