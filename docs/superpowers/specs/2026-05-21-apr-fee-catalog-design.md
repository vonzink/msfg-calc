# APR Calculator: Fee Catalog Integration

**Date:** 2026-05-21
**Status:** Approved
**Source spec:** `mortgage_apr_fee_catalog.md`

## Goal

Make the APR calculator accurate for Conventional, FHA, and VA loans by classifying every fee per Regulation Z and the source fee catalog. Keep the UI usable for loan officers — no overwhelming fee picker.

## Architecture

New shared module `public/js/shared/apr-fee-catalog.js` exposes `MSFG.AprFeeCatalog`:

- `FEES` — dictionary of fee definitions keyed by spec fee ID (e.g. `origination_fee`, `fha_ufmip`). Each entry has: `displayName`, `aprFlagDefault`, `appliesTo` (loan types), `conditionCodes`, `mismoAliases`.
- `UI_GROUPS` — ordered groupings used to render the form (6 groups: Lender, MI/Guaranty, Title & Settlement, Third-Party, Government, Prepaids & Escrow).
- `resolveAprTreatment(feeId, context)` — direct port of the resolver from the source spec. Returns `{ includeInApr, aprFlagUsed, reason }`.
- `MISMO_ALIAS_MAP` — MISMO `FeeType`/`FeeTypeOtherDescription` → catalog fee ID.

The calculator JS consumes the catalog, builds the form dynamically on load, runs the resolver on every fee at calc time, and feeds the classified totals into an upgraded APR solver that handles a payment stream (P&I + monthly MI months).

## Files Touched

- NEW `public/js/shared/apr-fee-catalog.js`
- MODIFIED `public/js/calculators/apr.js`
- MODIFIED `views/calculators/apr.ejs`
- MODIFIED `public/js/shared/mismo-calc-maps.js` (apr block only)
- MODIFIED `routes/calculators.js` (add catalog to apr extraScripts)
- MODIFIED `public/css/calculators/apr.css` (pill styling)
- NEW `tests/apr-fee-catalog.test.js`

## UI Design

### Loan Type Selector

Dropdown at top of Loan Information: Conventional / FHA / VA. Default Conventional. MISMO import overrides the default. Changing it re-renders the MI section and toggles UFMIP/Funding Fee fields. Existing values for fees that exist across loan types are preserved.

### Fee Groups

Six collapsible groups (matching catalog categories):

1. **Lender Charges** — origination, discount points ($ or %), underwriting, processing, application, admin, lock/float-down, tax service, lender flood monitoring, other. Default APR_YES.
2. **Mortgage Insurance / Guaranty** — loan-type aware:
   - Conv: PMI type select (Monthly / Single / Split / Lender-Paid), upfront/monthly amounts, duration months
   - FHA: UFMIP (auto 1.75% of base, financed toggle), Monthly MIP (auto from LTV/term), duration
   - VA: Funding Fee (lookup by usage/down %, exempt toggle, financed toggle)
3. **Title & Settlement** — lender's title, settlement, title search/exam, attorney/doc prep, CPL, notary, other. Default APR_NO (bona-fide-and-reasonable assumed).
4. **Third-Party Services** — appraisal, credit report, initial flood cert, VOE, AUS fee, pest/well/septic, other. Defaults vary per catalog (AUS = APR_YES, others = APR_NO).
5. **Government Recording & Taxes** — recording, transfer tax, mortgage recording tax, e-recording. Default APR_NO (public official exclusion).
6. **Prepaids & Escrow Reserves** — prepaid interest (per diem × days), hazard premium, initial tax escrow, initial insurance escrow, HOA dues prepaid. Mixed defaults.

### Live APR Pill

Every fee input has a right-aligned pill: green "APR" or gray "Non-APR". Driven by `resolveAprTreatment`. Click to manually override (dotted underline indicates override). Hover shows the resolver's reason string.

### Per-Fee Flags

Inside an "Advanced" expander on each fee row (collapsed by default to keep UI clean):
- "Seller paid" checkbox
- "Borrower legally bound" checkbox (for seller-paid)
- "Bona fide and reasonable" checkbox (default checked for real-estate-related fees)
- "Charged to all applicants" checkbox (only on application fee)

### Credits

Existing lender credit and seller credit inputs preserved. Lender credit subtracts dollar-for-dollar from APR-classified fees total. Seller credits don't affect APR (already counted via seller-paid flag if applicable).

## Resolver

Direct port of `resolveAprTreatment` from source spec lines 522–649. Decision order:

1. Zero/negative amount → exclude
2. Seller-paid + borrower not legally bound → APR_NO
3. Application fee + charged-to-all flag → APR_NO
4. Public official fee flag → APR_NO
5. Life-of-loan monitoring flag → APR_YES
6. Borrower-can-choose-insurer flag → APR_NO (property insurance)
7. Optional product with disclosures → APR_NO
8. Bona-fide-and-reasonable flag → APR_NO (real-estate services)
9. Fall back to `aprFlagDefault`
10. Conditional with no facts → include conservatively

Manual UI override takes precedence over resolver output but does not modify the underlying definition.

## APR Solver Upgrade

Current: single monthly P&I, `PV(payment, rate, n) = AmountFinanced`.

New: payment stream as a vector of length `n = termYears × 12`:
- Each month: P&I + active monthly MI (if month ≤ `miDurationMonths`)
- Bisect rate where `Σ payment[i] / (1 + r/12)^i = AmountFinanced`
- FHA UFMIP and VA Funding Fee, when financed: added to principal for P&I AND treated as prepaid finance charges (subtract from Amount Financed)
- Bisection same convergence criteria as today: 100 iterations, `1e-8` tolerance

### Amount Financed Formula

```
AmountFinanced = NoteAmount
               − Σ(prepaid finance charges)
               − Σ(financed finance charges treated as prepaid)
```

Note that financed APR fees (e.g. financed UFMIP) are double-counted on purpose: they are part of the note amount AND subtracted from Amount Financed. This is the correct Reg Z treatment.

## MISMO Mapping

The `apr` block in `mismo-calc-maps.js` is rewritten as a thin translator:

```js
reg('apr', function (data) {
  var m = {};

  // Basic loan fields
  if (data.loan.amount) m['loanAmount'] = data.loan.amount;
  if (data.loan.rate) m['interestRate'] = data.loan.rate;
  if (data.loan.termMonths) m['loanTerm'] = data.loan.termMonths / 12;
  if (data.loan.mortgageType) m['aprLoanType'] = mapLoanType(data.loan.mortgageType);
  if (data.loan.discountPoints) m['discountPoints'] = data.loan.discountPoints;

  // Fees via catalog alias map
  var fees = data.fees || {};
  Object.keys(fees).forEach(function (key) {
    var feeId = MSFG.AprFeeCatalog.mismoKeyToFeeId(key);
    if (feeId) m['fee_' + feeId] = fees[key].amount;
  });

  // Prepaids, escrow, credits
  // ... (see implementation)

  return m;
});
```

Alias coverage matches the table in the design discussion (origination, discount points, underwriting, processing, application, credit report, appraisal, flood cert, tax service, technology, MERS, VOE, wire transfer, title lender's, title owner's, settlement, CPL, tax cert, recording, e-recording, transfer tax, UFMIP, VA funding fee, monthly MI).

Unmapped fees fall into a generic "Other Lender Fees" or "Other Title" bucket based on `IntegratedDisclosureSectionType`, default APR_CONDITIONAL → conservatively included.

## Testing

New file `tests/apr-fee-catalog.test.js`:

- Resolver decision tree (12 cases covering each branch)
- FHA UFMIP cash vs financed both produce APR_YES inclusion
- VA Funding Fee cash, financed, exempt
- Seller-paid + not legally bound → excluded
- Application fee with/without charged-to-all flag
- Monthly MI in payment stream raises APR above bare P&I APR
- MISMO alias map covers every key in the existing `mismo-calc-maps.js` apr block
- Sample MISMO file (Conv30yr scenario) produces sensible APR

## Out of Scope

- Compliance overrides at state/loan-product level (catalog allows for it, UI doesn't expose it yet)
- Editor for the catalog itself (defined in JS)
- Detailed FHA/VA funding fee tables (use placeholder factors; refine in a later pass)
- Backwards compatibility with old URL params (`la`, `ir`, etc.) preserved; new fee params not added to URL state
