# Income Calc Bug Fixes — Design

**Date:** 2026-05-25
**Scope:** `server.js` CSP cleanup + `MSFG.IncomeCalc.registerEmailProvider` rewrite
**Context:** Two bugs surfaced after the 2026-05-23 polish pass. Both ship before the larger workspace multi-instance feature.

## Bug A — Cognito CSP cleanup

### Problem

`server.js` line 60 whitelists `https://us-west-1s6ie2uego.auth.us-west-1.amazoncognito.com` in CSP `frameSrc`. Project-wide grep finds zero other references to that domain (templates, client JS, partials, layout). The CSP entry is orphaned from a removed feature.

The user reports "refused to connect" against that domain on the 1120s page. Since nothing in our code creates such an iframe, the actual source is outside our codebase — browser extension, password manager, or stale auth state from a previously installed app.

### Fix

Delete the Cognito URL from the `frameSrc` array. Resulting line:

```js
frameSrc: ["'self'"],
```

### Behavior change

Tighter CSP. No user-visible change. If a browser extension is the cause of the user's error, this fix doesn't affect that — but at least the codebase no longer pretends to need that domain.

### Files

- `server.js`

---

## Bug B — Income calc email payload empty for all 13 calcs

### Problem

`MSFG.IncomeCalc.registerEmailProvider` (defined in `public/js/shared/income-calc-base.js`) builds the calculator email body by scanning `.form-row` and `.total-row` DOM. **No income calc template uses those classes** — they all use `<table class="income-table">` for inputs and `.result-card` / `.result-highlight` for results. Result: the email modal sends an empty/title-only payload for every income calculator.

The bug has existed since the shared provider was extracted in the 2026-05-23 refactor (commit `821754d`). The user noticed first on Schedule C.

### Markup the provider must scan

Per-calc EJS template structure:

```
<div class="calc-section">
  <h2>Business 1</h2>                            ← section heading
  ...
  <table class="income-table">
    <tbody>
      <tr>
        <td>Net Profit</td>                       ← row label
        <td class="line-number">31</td>
        <td class="sign-col">+</td>
        <td><input type="number" id="b1_np1"></td> ← Y1 input
        <td><input type="number" id="b1_np2"></td> ← Y2 input
      </tr>
      ...
    </tbody>
  </table>
</div>
...
<div class="result-card">
  <div class="result-card__label">Business 1</div>
  <div class="result-card__value" id="result_b1">$0.00</div>
</div>
...
<div class="result-highlight">
  <div class="result-highlight__label">Total Monthly Income</div>
  <div class="result-highlight__value" id="combined_c">$0.00</div>
</div>
```

### Fix

Rewrite the provider's body to:

1. Title from `.calc-page__header h1` (unchanged).
2. For each `.calc-section` with an `<h2>` and an `.income-table` child:
   - Use `h2.textContent` as section heading.
   - Walk `tbody tr`. For each row:
     - `label` = first non-empty `<td>` text content (skip line-number / sign-col cells if needed; in practice first `<td>` is the description).
     - Read all `<input type="number">` descendants in row order: `Y1, Y2`.
     - Skip the row if every input is empty / `'0'`.
     - Format value: `"$Y1"` if Y2 missing or zero; `"$Y1 / $Y2"` otherwise.
   - Push section only if it has rows.
3. Build a "Results" section from `.result-card` elements:
   - Each pair: `result-card__label` + `result-card__value`.
   - Include even when value is `$0.00` (zero is meaningful for a calculated result).
4. Append the `.result-highlight` (if present) as the final row of the Results section, flagged `isTotal: true`.
5. Drop the `.form-row` / `.total-row` scan entirely — dead code in this context.

Public function signature (`registerEmailProvider()`) and the data shape passed to `MSFG.CalcActions.register` are unchanged. Only the DOM scrape logic changes.

### Files

- `public/js/shared/income-calc-base.js`

### Behavior change

Email modal payload for every income calc now contains the actual entered values and computed results, grouped by the calculator's own `.calc-section` headings. No template changes.

### Verification

1. `npm run build && npm test` — 331 tests pass.
2. Run `npm run dev`, open `http://localhost:3000/calculators/income/schedule-c`, enter Business 1 net profit `60000`, hit Email button, confirm modal preview shows the section heading "Business 1" with a "Net Profit: $60,000" row and a "Results" section with the Business 1 monthly figure.
3. Spot-check one more calc (e.g. 1040 with W-2 values) to confirm multi-section layout works.

### Risk

Low. One function, no signature change, no template touches. The `.calc-section` / `<h2>` / `.income-table` markup pattern is consistent across all 13 income calc templates (confirmed via grep).
