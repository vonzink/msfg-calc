# MISMO Checklist Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the six MISMO checklist improvements from `docs/superpowers/specs/2026-05-28-mismo-checklist-improvements-design.md`.

**Architecture:** The Conditions & Documents calculator is `mismo.js` (orchestrator) + `mismo-docs.js` (condition generation) + `mismo-doc-parser.js` (XML parsing) + `mismo.ejs` (view) + `mismo.css`. Changes are mostly localized to render/format functions; one new parser field; one new CSS modifier. No test files exist for MISMO DOM internals — verification is build + existing test suite + manual.

**Tech Stack:** Vanilla JS (IIFE modules on `MSFG.*`), EJS, plain CSS. esbuild minify via `npm run build`. Node test runner via `npm test`.

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `public/js/shared/mismo-doc-parser.js` | Parse `estimatedClosingDate` from XML | 1 |
| `public/js/calculators/mismo-docs.js` | `firstName()` helper + first-name borrower tag | 2 |
| `public/js/calculators/mismo.js` | Textarea cells, urgent status, days-to-closing, email builder fixes | 3,4,5,6 |
| `views/calculators/mismo.ejs` | Heading cell swap, on-screen legend strip | 5,6 |
| `public/css/calculators/mismo.css` | Textarea wrap, `--urgent` row, legend, closing cell | 3,4,5,6 |

Task order respects dependencies: parser (1) before days-to-closing (5); urgent (4) before the email legend/counts (6). Tasks 2 and 3 are independent. Each task ends with `npm run build && npm test` and one commit.

The harmless `pyenv: cannot rehash` warning prefixes every Bash command in this environment — ignore it.

---

## Task 1: Parse estimated closing date

**Files:**
- Modify: `public/js/shared/mismo-doc-parser.js`

The parser's `parseMISMO(doc)` builds a `data` object literal (starts line 53) and uses `first(scope, 'ElementName')` (namespace-aware `getElementsByTagNameNS`) plus `parseDate(str)`. There is no closing-date field today.

- [ ] **Step 1: Add `estimatedClosingDate` to the data object literal**

In `parseMISMO`, the `data` literal ends with `complexityFlags: []`. Add a field. Find:

```js
      borrowerCount: 0,
      totalIncomeTypes: 0,
      complexityFlags: []       // Portfolio/complexity indicators
    };
```

Change to:

```js
      borrowerCount: 0,
      totalIncomeTypes: 0,
      complexityFlags: [],      // Portfolio/complexity indicators
      estimatedClosingDate: null // Parsed closing/disbursement date (Date or null)
    };
```

- [ ] **Step 2: Parse the closing date after the loan-terms block**

Immediately after the loan-terms block (the `const terms = first(doc, 'TERMS_OF_LOAN'); if (terms) { … }` block ending around line 98), insert:

```js
    // ---- Estimated closing date ----
    // MISMO exports vary; try a small set of candidate element local-names.
    (function () {
      const candidates = [
        'EstimatedClosingDate',
        'ClosingDate',
        'EstimatedClosingDateTime',
        'LoanScheduledClosingDate',
        'DisbursementDate',
        'ClosingDateTime'
      ];
      for (let i = 0; i < candidates.length; i++) {
        const node = first(doc, candidates[i]);
        const txt = textOf(node);
        if (txt) {
          const d = parseDate(txt);
          if (d) { data.estimatedClosingDate = d; break; }
        }
      }
    })();
```

- [ ] **Step 3: Build + test**

```bash
npm run build && npm test
```

Expected: `Minified 63/63 files` and `tests 331 ... fail 0`.

- [ ] **Step 4: Commit**

```bash
git add public/js/shared/mismo-doc-parser.js
git commit -m "$(cat <<'EOF'
feat(mismo): parse estimated closing date from MISMO XML

Adds data.estimatedClosingDate, populated from the first present of a
candidate element set (EstimatedClosingDate, ClosingDate, etc.).
Null when the export carries no closing date — the UI provides an
editable fallback (later task).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Borrower-specific conditions show first name only

**Files:**
- Modify: `public/js/calculators/mismo-docs.js`

Line 268 today: `const tag = b.name + ':';` — produces `"SAM W SAWAGED:"`.

- [ ] **Step 1: Add a `firstName` helper near the top of the IIFE**

In `mismo-docs.js`, just after the existing `formatCurrency` helper (around line 13, before `generateFHADocs`), add:

```js
  function firstName(full) {
    if (!full) return '';
    const token = String(full).trim().split(/\s+/)[0] || '';
    if (!token) return '';
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  }
```

- [ ] **Step 2: Use first name for the borrower tag**

Find (line ~268):

```js
      const tag = b.name + ':';
```

Replace with:

```js
      const tag = firstName(b.name) + ':';
```

- [ ] **Step 3: Build + test**

```bash
npm run build && npm test
```

Expected: `tests 331 ... fail 0`.

- [ ] **Step 4: Commit**

```bash
git add public/js/calculators/mismo-docs.js
git commit -m "$(cat <<'EOF'
feat(mismo): borrower-specific conditions use first name only

"SAM W SAWAGED: Personal tax returns…" -> "Sam: Personal tax returns…".
First whitespace token, title-cased. The Loan Summary Borrower(s)
cell still shows the full name(s).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Condition cells wrap (textarea + auto-grow)

**Files:**
- Modify: `public/js/calculators/mismo.js`
- Modify: `public/css/calculators/mismo.css`

`createItemRow` (mismo.js ~293) builds `nameInput` and `reasonInput` as `<input type="text">`. Convert both to auto-growing `<textarea>`.

- [ ] **Step 1: Add an `autoGrow` helper near the other helpers in mismo.js**

After `setKV` (ends line 36), add:

```js
  function autoGrow(elm) {
    elm.style.height = 'auto';
    elm.style.height = (elm.scrollHeight) + 'px';
  }
```

- [ ] **Step 2: Convert nameInput and reasonInput to textareas in `createItemRow`**

Find:

```js
    // Name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'mismo-doc-item__name';
    nameInput.value = item.name;
    nameInput.addEventListener('input', function () { item.name = this.value; });

    // Reason input
    const reasonInput = document.createElement('input');
    reasonInput.type = 'text';
    reasonInput.className = 'mismo-doc-item__reason';
    reasonInput.value = item.reason;
    reasonInput.addEventListener('input', function () { item.reason = this.value; });
```

Replace with:

```js
    // Name field (auto-growing textarea)
    const nameInput = document.createElement('textarea');
    nameInput.rows = 1;
    nameInput.className = 'mismo-doc-item__name';
    nameInput.value = item.name;
    nameInput.addEventListener('input', function () { item.name = this.value; autoGrow(this); });

    // Reason field (auto-growing textarea)
    const reasonInput = document.createElement('textarea');
    reasonInput.rows = 1;
    reasonInput.className = 'mismo-doc-item__reason';
    reasonInput.value = item.reason;
    reasonInput.addEventListener('input', function () { item.reason = this.value; autoGrow(this); });
```

- [ ] **Step 3: Size the textareas after they're in the DOM**

At the end of `createItemRow`, the function currently ends:

```js
    row.appendChild(statusSelect);
    row.appendChild(nameInput);
    row.appendChild(reasonInput);
    row.appendChild(removeBtn);
    return row;
```

Change to grow them once after append (deferred so `scrollHeight` is measured after layout):

```js
    row.appendChild(statusSelect);
    row.appendChild(nameInput);
    row.appendChild(reasonInput);
    row.appendChild(removeBtn);
    setTimeout(function () { autoGrow(nameInput); autoGrow(reasonInput); }, 0);
    return row;
```

- [ ] **Step 4: CSS — make the textareas wrap and align the row to top**

In `public/css/calculators/mismo.css`, find `.mismo-doc-item { … align-items: center; … }` and change `align-items: center;` to `align-items: start;`.

Then find the `.mismo-doc-item__name, .mismo-doc-item__reason { … }` rule and add textarea-specific properties so they wrap and look like the old inputs:

```css
.mismo-doc-item__name,
.mismo-doc-item__reason {
  padding: 0.3rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 0.85rem;
  background: transparent;
  transition: border-color 0.15s, background 0.15s;
  /* textarea wrapping */
  width: 100%;
  font-family: inherit;
  line-height: 1.4;
  resize: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  box-sizing: border-box;
}
```

(Keep the existing `.mismo-doc-item__name { font-weight: 600; … }`, `.mismo-doc-item__reason { font-size: 0.78rem; … }`, `:hover`, and `:focus` rules as-is — they still apply to textareas.)

- [ ] **Step 5: Build + test**

```bash
npm run build && npm test
```

Expected: `tests 331 ... fail 0`.

- [ ] **Step 6: Commit**

```bash
git add public/js/calculators/mismo.js public/css/calculators/mismo.css
git commit -m "$(cat <<'EOF'
feat(mismo): condition cells wrap instead of clipping

Condition name and reason cells become auto-growing textareas
(was single-line <input>). Long text wraps and the row grows
downward. Row aligns to top so the status select and delete
button stay put.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: "Urgent" severity category

**Files:**
- Modify: `public/js/calculators/mismo.js`
- Modify: `public/css/calculators/mismo.css`

Add `urgent` as a new status: dropdown option, render-order priority, section counts, row styling.

- [ ] **Step 1: Add a status-rank helper + urgent to the dropdown in mismo.js**

After the `autoGrow` helper added in Task 3, add a render-sort rank:

```js
  const STATUS_RANK = { urgent: 0, required: 1, conditional: 2, incomplete: 3, ok: 4 };
  function statusRank(s) { return STATUS_RANK[s] != null ? STATUS_RANK[s] : 5; }
```

In `createItemRow`, find:

```js
    var statusLabels = { required: 'Required', conditional: 'Conditional', incomplete: 'Incomplete', ok: 'Cleared' };
    ['required', 'conditional', 'incomplete', 'ok'].forEach(function (s) {
```

Replace with:

```js
    var statusLabels = { urgent: 'Urgent', required: 'Required', conditional: 'Conditional', incomplete: 'Incomplete', ok: 'Cleared' };
    ['urgent', 'required', 'conditional', 'incomplete', 'ok'].forEach(function (s) {
```

- [ ] **Step 2: Sort the render pass so urgent items surface first**

In `renderChecklist` (mismo.js ~262), find:

```js
    container.innerHTML = '';
    items.forEach(function (item) {
      container.appendChild(createItemRow(item, sectionKey));
    });
```

Replace with (sort a shallow copy — do NOT reorder `checklistState`):

```js
    container.innerHTML = '';
    const ordered = items.slice().sort(function (a, b) {
      return statusRank(a.status) - statusRank(b.status);
    });
    ordered.forEach(function (item) {
      container.appendChild(createItemRow(item, sectionKey));
    });
```

- [ ] **Step 3: Count urgent first in `updateSectionCounts`**

Find:

```js
      const required = items.filter(function (i) { return i.status === 'required'; }).length;
      const conditional = items.filter(function (i) { return i.status === 'conditional'; }).length;
      const incomplete = items.filter(function (i) { return i.status === 'incomplete'; }).length;
      const parts = [];
      if (required > 0) parts.push(required + ' required');
      if (conditional > 0) parts.push(conditional + ' conditional');
      if (incomplete > 0) parts.push(incomplete + ' incomplete');
```

Replace with:

```js
      const urgent = items.filter(function (i) { return i.status === 'urgent'; }).length;
      const required = items.filter(function (i) { return i.status === 'required'; }).length;
      const conditional = items.filter(function (i) { return i.status === 'conditional'; }).length;
      const incomplete = items.filter(function (i) { return i.status === 'incomplete'; }).length;
      const parts = [];
      if (urgent > 0) parts.push(urgent + ' urgent');
      if (required > 0) parts.push(required + ' required');
      if (conditional > 0) parts.push(conditional + ' conditional');
      if (incomplete > 0) parts.push(incomplete + ' incomplete');
```

- [ ] **Step 4: CSS — urgent row styling**

In `public/css/calculators/mismo.css`, find the status-modifier block:

```css
.mismo-doc-item--required    { background: #ffebee; border-left-color: #c62828; }
.mismo-doc-item--conditional { background: #fff3e0; border-left-color: #e65100; }
.mismo-doc-item--incomplete  { background: #e3f2fd; border-left-color: #1565c0; }
.mismo-doc-item--ok          { background: #e8f5e9; border-left-color: #2e7d32; }
```

Add immediately above the `--required` line:

```css
.mismo-doc-item--urgent      { background: #3a0d0d; border-left-color: #ff1744; }
.mismo-doc-item--urgent .mismo-doc-item__name,
.mismo-doc-item--urgent .mismo-doc-item__reason {
  color: #ff5252;
  background: transparent;
}
.mismo-doc-item--urgent .mismo-doc-item__name:hover,
.mismo-doc-item--urgent .mismo-doc-item__reason:hover,
.mismo-doc-item--urgent .mismo-doc-item__name:focus,
.mismo-doc-item--urgent .mismo-doc-item__reason:focus {
  background: rgba(255,255,255,0.08);
  border-color: #ff5252;
  color: #ff8a80;
}
.mismo-doc-item--urgent .mismo-doc-item__status {
  color: #c62828;
  background: rgba(255,255,255,0.9);
}
.mismo-doc-item--urgent .mismo-doc-item__remove { color: #ff8a80; }
```

- [ ] **Step 5: Build + test**

```bash
npm run build && npm test
```

Expected: `tests 331 ... fail 0`.

- [ ] **Step 6: Commit**

```bash
git add public/js/calculators/mismo.js public/css/calculators/mismo.css
git commit -m "$(cat <<'EOF'
feat(mismo): add Urgent severity category

New "Urgent" status in the per-item dropdown: dark-red row with red
lettering. Urgent items sort to the top of their section (render-only
sort, state order preserved) and count first in the section line
("2 urgent · 3 required · …").

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: "Days to Closing" replaces the "Property Type" heading cell

**Files:**
- Modify: `views/calculators/mismo.ejs`
- Modify: `public/js/calculators/mismo.js`
- Modify: `public/css/calculators/mismo.css`

- [ ] **Step 1: Swap the heading cell in `mismo.ejs`**

Find:

```html
          <div class="mismo-kv">
            <div class="mismo-kv-label">Property Type</div>
            <div class="mismo-kv-value" id="kvPropertyType">&mdash;</div>
          </div>
```

Replace with:

```html
          <div class="mismo-kv">
            <div class="mismo-kv-label">Days to Closing</div>
            <div class="mismo-kv-value" id="kvClosing">&mdash;</div>
          </div>
```

- [ ] **Step 2: Add a module-level closing-date override + render helper in mismo.js**

In the `/* ---- State ---- */` block (top of the IIFE), add a variable after `let itemCounter = 0;`:

```js
  let closingDateOverride = null; // ISO yyyy-mm-dd string set via the editable fallback
```

Then add a render helper near `updateLoanSummary` (place it just before `function updateLoanSummary`):

```js
  function fmtMonthDay(d) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate();
  }

  function toISODate(d) {
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function effectiveClosingDate(data) {
    if (closingDateOverride) {
      const d = new Date(closingDateOverride + 'T00:00:00');
      if (!isNaN(d.getTime())) return d;
    }
    if (data && data.estimatedClosingDate instanceof Date && !isNaN(data.estimatedClosingDate.getTime())) {
      return data.estimatedClosingDate;
    }
    return null;
  }

  function renderClosingCell(data) {
    const cell = el('kvClosing');
    if (!cell) return;
    const closing = effectiveClosingDate(data);

    if (closing) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days = Math.ceil((closing.getTime() - today.getTime()) / 86400000);
      const label = days < 0
        ? 'Past due (' + fmtMonthDay(closing) + ')'
        : days + ' day' + (days === 1 ? '' : 's') + ' (' + fmtMonthDay(closing) + ')';
      cell.innerHTML = '<span class="mismo-closing-text">' + label + '</span>' +
                       ' <button type="button" class="mismo-closing-edit" title="Change closing date">edit</button>';
      const editBtn = cell.querySelector('.mismo-closing-edit');
      if (editBtn) editBtn.addEventListener('click', function () { showClosingInput(data); });
    } else {
      showClosingInput(data);
    }
  }

  function showClosingInput(data) {
    const cell = el('kvClosing');
    if (!cell) return;
    cell.innerHTML = '<input type="date" class="mismo-closing-input" id="kvClosingInput">';
    const input = el('kvClosingInput');
    if (!input) return;
    if (closingDateOverride) input.value = closingDateOverride;
    input.addEventListener('change', function () {
      closingDateOverride = this.value || null;
      renderClosingCell(data);
    });
    input.focus();
  }
```

- [ ] **Step 3: Call `renderClosingCell` from `updateLoanSummary` and drop the kvPropertyType set**

In `updateLoanSummary`, find:

```js
    // Enhanced fields
    setKV('kvPropertyType', data.propertyType);
    setKV('kvOccupancy', formatOccupancy(data.occupancyType));
    setKV('kvLTV', data.ltv ? data.ltv.toFixed(1) + '%' : null);
```

Replace with:

```js
    // Enhanced fields
    renderClosingCell(data);
    setKV('kvOccupancy', formatOccupancy(data.occupancyType));
    setKV('kvLTV', data.ltv ? data.ltv.toFixed(1) + '%' : null);
```

Also reset any stale override when a fresh file is processed. In `processXML` (mismo.js ~98), find the first line:

```js
  function processXML(xmlDoc) {
    parsedData = MSFG.MISMODocParser.parseMISMO(xmlDoc);
```

Change to:

```js
  function processXML(xmlDoc) {
    closingDateOverride = null; // fresh file: let its parsed closing date take precedence
    parsedData = MSFG.MISMODocParser.parseMISMO(xmlDoc);
```

- [ ] **Step 4: Remove `kvPropertyType` from clearAll and reset the closing cell**

In `clearAll`, find:

```js
    ['kvBorrower', 'kvPurpose', 'kvType', 'kvAmount', 'kvPropertyType', 'kvOccupancy', 'kvLTV', 'kvProperty'].forEach(function (id) {
      setKV(id, null);
    });
```

Replace with:

```js
    ['kvBorrower', 'kvPurpose', 'kvType', 'kvAmount', 'kvOccupancy', 'kvLTV', 'kvProperty'].forEach(function (id) {
      setKV(id, null);
    });
    closingDateOverride = null;
    setKV('kvClosing', null);
```

- [ ] **Step 5: Persist the closing override in `__calcState`**

In `__calcState.save`, find:

```js
      var kvIds = ['kvBorrower', 'kvPurpose', 'kvType', 'kvAmount', 'kvPropertyType', 'kvOccupancy', 'kvLTV', 'kvProperty'];
```

Replace with (drop `kvPropertyType`; the closing cell is reconstructed from `closingDateOverride`/parsed data, not from its text):

```js
      var kvIds = ['kvBorrower', 'kvPurpose', 'kvType', 'kvAmount', 'kvOccupancy', 'kvLTV', 'kvProperty'];
```

Then find the `return {` inside `save` and add the closing fields. We persist both the hand-entered override AND the resolved effective date as ISO (so a parse-origin date survives restore, where `parsedData` is null):

```js
      var effClosing = effectiveClosingDate(parsedData);
      return {
        checklistState: JSON.parse(JSON.stringify(checklistState)),
        itemCounter: itemCounter,
        summary: summary,
        chips: chips,
        complexityFlags: complexityFlags,
        closingDateOverride: closingDateOverride,
        closingDateISO: effClosing ? toISODate(effClosing) : null,
        hasData: !el('mismoResults').classList.contains('u-hidden')
      };
```

In `__calcState.restore`, after `itemCounter = data.itemCounter || 0;` add:

```js
      closingDateOverride = data.closingDateOverride || null;
```

And after the checklists render (`renderAllChecklists();` near the end of `restore`), re-render the closing cell. Since `parsedData` is null on restore, feed the persisted ISO date as a synthetic `estimatedClosingDate` so a parse-origin date still shows; the restored `closingDateOverride` (if any) takes precedence inside `effectiveClosingDate`:

```js
      const restoredClosing = data.closingDateISO ? new Date(data.closingDateISO + 'T00:00:00') : null;
      renderClosingCell({ estimatedClosingDate: restoredClosing });
```

- [ ] **Step 6: CSS — closing cell input + edit button**

Append to `public/css/calculators/mismo.css`:

```css
/* --- Days to Closing cell --- */
.mismo-closing-input {
  font: inherit;
  padding: 2px 4px;
  border: 1px solid var(--color-gray-300, #ccc);
  border-radius: 4px;
  max-width: 100%;
}
.mismo-closing-edit {
  margin-left: 6px;
  border: none;
  background: transparent;
  color: var(--brand-primary, #2d6a4f);
  font-size: 0.72rem;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
```

- [ ] **Step 7: Build + test**

```bash
npm run build && npm test
```

Expected: `tests 331 ... fail 0`.

- [ ] **Step 8: Commit**

```bash
git add views/calculators/mismo.ejs public/js/calculators/mismo.js public/css/calculators/mismo.css
git commit -m "$(cat <<'EOF'
feat(mismo): show Days to Closing in heading (was Property Type)

The Property Type heading cell becomes "Days to Closing". On MISMO
load it shows "<n> days (Mon D)" computed from the parsed closing
date; when the export has no closing date it renders an inline date
picker, and the chosen date persists via __calcState. Property type
still drives condition logic internally — only the heading cell moved.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Copy/email — drop duplicate section name + add color legend

**Files:**
- Modify: `public/js/calculators/mismo.js`
- Modify: `views/calculators/mismo.ejs`
- Modify: `public/css/calculators/mismo.css`

- [ ] **Step 1: Fix the duplicate section heading + add urgent count/bullet in `buildSection`**

In the CalcActions provider (mismo.js ~590), find `buildSection`:

```js
        function buildSection(heading, sectionKey) {
          const items = checklistState[sectionKey];
          if (!items || items.length === 0) return;
          const rows = [];
          // Count summary as first row
          const required = items.filter(function (i) { return i.status === 'required'; }).length;
          const conditional = items.filter(function (i) { return i.status === 'conditional'; }).length;
          const ok = items.filter(function (i) { return i.status === 'ok'; }).length;
          const countParts = [];
          if (required > 0) countParts.push(required + ' required');
          if (conditional > 0) countParts.push(conditional + ' conditional');
          if (ok > 0) countParts.push(ok + ' received');
          rows.push({ label: heading, value: countParts.join('  ·  ') || 'None', isTotal: true });
          items.forEach(function (item) {
            rows.push({
              label: item.name,
              value: item.reason ? '— ' + item.reason : '',
              stacked: true,
              bulletColor: item.status === 'required' ? '#c62828' :
                           item.status === 'conditional' ? '#b8960c' :
                           item.status === 'ok' ? '#2e7d32' :
                           item.status === 'incomplete' ? '#1565c0' : '#666'
            });
          });
          sections.push({ heading: heading, rows: rows });
        }
```

Replace the whole function with (count row shows the count only; urgent added to counts, sort, and bullet color):

```js
        function buildSection(heading, sectionKey) {
          const items = checklistState[sectionKey];
          if (!items || items.length === 0) return;
          const rows = [];
          const urgent = items.filter(function (i) { return i.status === 'urgent'; }).length;
          const required = items.filter(function (i) { return i.status === 'required'; }).length;
          const conditional = items.filter(function (i) { return i.status === 'conditional'; }).length;
          const ok = items.filter(function (i) { return i.status === 'ok'; }).length;
          const countParts = [];
          if (urgent > 0) countParts.push(urgent + ' urgent');
          if (required > 0) countParts.push(required + ' required');
          if (conditional > 0) countParts.push(conditional + ' conditional');
          if (ok > 0) countParts.push(ok + ' received');
          // Count-only row (no repeated section name — heading already carries it)
          rows.push({ label: countParts.join('  ·  ') || 'None', value: '', isTotal: true });
          const ordered = items.slice().sort(function (a, b) {
            return statusRank(a.status) - statusRank(b.status);
          });
          ordered.forEach(function (item) {
            rows.push({
              label: item.name,
              value: item.reason ? '— ' + item.reason : '',
              stacked: true,
              bulletColor: item.status === 'urgent' ? '#8b0000' :
                           item.status === 'required' ? '#c62828' :
                           item.status === 'conditional' ? '#b8960c' :
                           item.status === 'ok' ? '#2e7d32' :
                           item.status === 'incomplete' ? '#1565c0' : '#666'
            });
          });
          sections.push({ heading: heading, rows: rows });
        }
```

(`statusRank` is defined in Task 4. Task 4 must land before Task 6 — it does in this plan order.)

- [ ] **Step 2: Add the legend section to the copy/email payload**

In the same provider, find where the loan summary section is pushed:

```js
        if (summaryRows.length > 0) {
          sections.push({ heading: 'Loan Summary', rows: summaryRows });
        }
```

Immediately BEFORE that block, insert a legend section so it renders first:

```js
        // One-line color legend (appears before Loan Summary)
        sections.push({
          heading: 'Legend',
          rows: [{
            label: '🔴 Urgent   🔴 Required   🟡 Conditional   🟢 Received   🔵 Incomplete',
            value: ''
          }]
        });
```

(Order in the payload: Legend, then Loan Summary, then the four doc sections.)

- [ ] **Step 3: Add the on-screen legend strip to `mismo.ejs`**

Find the first checklist section (Income Documentation). It looks like:

```html
      <!-- Income Documentation -->
      <div class="calc-section mismo-checklist-section" data-section="income">
```

(There may be a comment/structure just before it. Locate the first `.mismo-checklist-section`.) Insert immediately before that first checklist section:

```html
      <!-- Color legend -->
      <div class="mismo-legend" id="mismoLegend">
        <span class="mismo-legend__item mismo-legend__item--urgent">Urgent</span>
        <span class="mismo-legend__item mismo-legend__item--required">Required</span>
        <span class="mismo-legend__item mismo-legend__item--conditional">Conditional</span>
        <span class="mismo-legend__item mismo-legend__item--ok">Received</span>
        <span class="mismo-legend__item mismo-legend__item--incomplete">Incomplete</span>
      </div>
```

- [ ] **Step 4: CSS — on-screen legend strip**

Append to `public/css/calculators/mismo.css`:

```css
/* --- Color legend (one line) --- */
.mismo-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  align-items: center;
  margin: 0 0 0.75rem;
  font-size: 0.74rem;
  color: var(--text-muted, #666);
}
.mismo-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
}
.mismo-legend__item::before {
  content: '';
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.mismo-legend__item--urgent::before      { background: #8b0000; }
.mismo-legend__item--required::before    { background: #c62828; }
.mismo-legend__item--conditional::before { background: #b8960c; }
.mismo-legend__item--ok::before          { background: #2e7d32; }
.mismo-legend__item--incomplete::before  { background: #1565c0; }
```

- [ ] **Step 5: Build + test**

```bash
npm run build && npm test
```

Expected: `tests 331 ... fail 0`.

- [ ] **Step 6: Commit**

```bash
git add public/js/calculators/mismo.js views/calculators/mismo.ejs public/css/calculators/mismo.css
git commit -m "$(cat <<'EOF'
feat(mismo): copy/email — single section heading + color legend

- buildSection no longer repeats the section name; the row under the
  heading now shows only the count ("3 required · 1 conditional").
- A one-line color legend is added to the copy/email payload (before
  Loan Summary) and as an on-screen strip above the first section.
- Urgent included in section counts, render sort, and bullet color
  (#8b0000, darker than Required).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification, push, deploy

**Files:** none modified.

- [ ] **Step 1: Full build + test + lint**

```bash
npm run build && npm test && npm run lint 2>&1 | grep -E "error" | grep -v "\.min\.js" | grep -vi "IncomeUpload\|MSFG\|MISMO\|is not defined" | head -10 || echo "no new lint errors"
```

Expected: `Minified 63/63 files`, `tests 331 ... fail 0`, `no new lint errors` (pre-existing `.min.js` and global-not-defined warnings tolerated).

- [ ] **Step 2: Manual spot-check (local dev server)**

```bash
npm run dev
```

At `http://localhost:3000/calculators/mismo`, upload a sample MISMO XML (use one from the user's test set) and verify:

1. **Wrap:** A long condition name/reason wraps within its cell instead of clipping; the row grows taller.
2. **First name:** Borrower-specific conditions read "Sam: …" not "SAM W SAWAGED: …". The Loan Summary "Borrower(s)" cell still shows the full name.
3. **Urgent:** Change an item's dropdown to "Urgent" → row turns dark red with red text and jumps to the top of its section; the section count reads "1 urgent · …".
4. **Days to Closing:** the heading cell shows "Days to Closing". With a MISMO that has a closing date → "<n> days (Mon D)". With one that doesn't → a date picker; pick a date → shows the day count; reload the page (or navigate away/back in workspace) → the chosen date persists.
5. **Copy/Email:** click Email (and/or Copy). The section name appears once, followed by the count line ("3 required · 1 conditional"); a one-line legend appears near the top; urgent bullets are darker red.

Stop the dev server.

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Surface the deploy command to the user**

Report this command for the user to run on the EC2 box:

```bash
cd ~/msfg-calc && bash deploy/update.sh
```

(Pulls main, `npm ci`, `npm run build`, `pm2 restart msfg-calc`.)

- [ ] **Step 5: Production smoke-check (after user confirms deploy)**

Open `https://dashboard.msfgco.com/calc/...` (the Conditions & Documents calculator) and re-run the five manual checks from Step 2 against a real file.

---

## Out of scope (per spec)

- Auto-escalating conditions to Urgent based on closing proximity.
- Re-adding Property Type elsewhere in the heading.
- Per-borrower color coding.
