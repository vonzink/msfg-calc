/**
 * Where the Money Goes — pricing model (pure functions, no DOM).
 * Exposed as MSFG.WtmgMath so the page script and the unit tests share one implementation.
 *
 * Identity: borrower points = wholesaler margin + broker comp + LLPAs − MBS premium − servicing value.
 *
 * compute(inputs) returns:
 *   lock    — the full front-end state at lock, after solving for inputs.solve
 *   after   — the same shape after the optional market move (margin absorbs it); equals lock when nothing moved
 *   monthly — the month-1 payment split for the after state
 *   moved, warnings, mode
 * lock and after are built by the same function, so every renderer can pick one by name.
 *
 * Requires shared/utils.js (MSFG.formatPercent, MSFG.calcMonthlyPayment) to be loaded first.
 */
/* global globalThis, MSFG */
(function() {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const NS = typeof MSFG !== 'undefined' && MSFG ? MSFG : (root.MSFG = root.MSFG || {});

  // Every sourced figure the page shows, in one place, with its date. Refreshing the example means editing this block only.
  const SOURCES = {
    asOf: 'Nov 17, 2026',
    asOfLong: 'November 17, 2026',
    wholesaler: 'UWM',
    sheet: { rate: 7.25, basePrice: -0.234, afterComp: 2.016, comp: 2.25 }, // UWM rate sheet, 7.25% row, lender-paid comp, no LLPAs
    margin: { pts: 1.24, bps: 124, period: 'Q3 2026' },                     // UWM reported total gain margin, Q3 2026 results (Nov 4, 2026)
    hedgeLoss: '$603 million', hedgeLossPeriod: 'Q2 2026',                   // UWM Q2 2026 results; keep its own period so a margin refresh doesn't relabel it
    // FHFA conforming loan limits, one unit, contiguous US. 2027 values are announced in late November; update then.
    loanLimits: { year: 2026, baseline: 832750, ceiling: 1249125 },
    servicingBook: { low: 1.7, high: 2.1, wac: 5.90 },                       // UWM MSR fair value, % of UPB, Q4 2025 / Q1 2026; portfolio WAC
    mbs: { coupon: 6.5, price: 100.69 },                                     // FNMA 30Yr 6.5% screen quote
    treasury: 5.11,                                                          // 10-yr Treasury yield
    gfee: 0.45,                                                              // Fannie ongoing guarantee fee incl. the 0.10% TCCA surcharge; FHFA reports about 45–50 bps
    // Government program fees as understood on Nov 17, 2026 (not re-verified against the primary documents that day; the
    // page is a training tool). FHA: HUD Mortgagee Letter 2023-05, effective March 20, 2023. USDA: Rural Development SFH
    // Guaranteed fee schedule, fiscal 2026. VA: 38 U.S.C. 3729 funding fee table in effect since April 7, 2023.
    programs: {
      fha:  { upfront: 1.75, annual: { stdLow: 0.50, stdHigh: 0.55, hbLow: 0.70, hbHigh: 0.75, limit: 726200 }, basis: 'HUD ML 2023-05: UFMIP 1.75% of the base loan; annual MIP on 30-year terms 0.50% / 0.55% at or below / above 95% LTV for base loans up to $726,200, 0.70% / 0.75% above that' },
      usda: { upfront: 1.00, annual: 0.35, basis: 'USDA RD SFH Guaranteed, FY2026: 1.00% upfront guarantee fee, 0.35% annual fee' },
      va:   { first: {lt5: 2.15, lt10: 1.50, ge10: 1.25}, subsequent: {lt5: 3.30, lt10: 1.50, ge10: 1.25}, basis: '38 U.S.C. 3729 purchase table since April 7, 2023; IRRRL (0.50%) and cash-out tiers not modeled; waived for veterans on VA disability compensation, eligible surviving spouses and Purple Heart recipients' },
      // Conventional: Fannie requires mortgage insurance above 80% LTV. No single published rate; this is an illustrative
      // borrower-paid monthly rate for a 780 score at 80.01–85% LTV with standard coverage, editable on the page.
      pmi:  { annual: 0.30, basis: 'Illustrative borrower-paid monthly MI, 780 score, 80.01–85% LTV, standard coverage; actual rates vary by insurer, score, LTV, DTI and coverage, and MI cancels at 80% LTV (automatically at 78%)' }
    },
    // Estimated TBA price change per 1% of coupon when no quote is entered: about 1.75 pts per adjacent
    // 50 bp coupon near par, so other coupons are priced off the 6.5 quote. A real quote should replace it.
    perPoint: 3.5,
    // Illustrative multiple for the excess servicing strip (the note rate above coupon + fee + base strip), used when the
    // servicing value is set by a multiple. Below the 3.5–5× base range: a loan priced above its coupon refinances sooner,
    // and excess IO is usually sold or marked more conservatively than the base strip.
    excessMult: 2.5
  };
  const AVG_MARGIN = SOURCES.margin.pts;
  const round3 = x => Math.round(x * 1000) / 1000;
  const DEFAULTS = {
    loan:500000, rate:SOURCES.sheet.rate, sheet:SOURCES.sheet.afterComp, solve:'margin',
    coupon:SOURCES.mbs.coupon, price:SOURCES.mbs.price, tsy:SOURCES.treasury,
    comp:SOURCES.sheet.comp, lo:1.125, margin:SOURCES.margin.pts,
    // The servicing value the sheet implies at the average margin: sheet − premium + margin + comp (no LLPAs).
    msr:round3(-SOURCES.sheet.afterComp - (SOURCES.mbs.price - 100) + SOURCES.margin.pts + SOURCES.sheet.comp),
    // Default view: servicing marked at 4× the strip and the wholesaler's margin solved from the sheet; the reported average stays as the comparison.
    program:'conv', msrMult:4, excessMult:SOURCES.excessMult, svc:0.25, gfee:SOURCES.gfee, financeUpfront:true, vaSubsequentUse:false, vaExempt:false, pmi:SOURCES.programs.pmi.annual, llpa:0, fixed:30, variable:50, onetime:10, profit:10, coupon2:null, price2:null,
    // Borrower and property, for the Fannie LLPA matrix. The example file is clean (780+, 71% LTV purchase,
    // primary, no flags), which is why the UWM sheet showed no adjustments.
    llpaMode:'matrix', creditScore:780, propertyValue:700000, purpose:'Purchase', occupancy:'Primary', units:'1',
    isCondo:false, isManufacturedHome:false, isHighBalance:false, hasSubordinateFinancing:false,
    applyMMI:false, isHighLTVRefi:false, waiverHomeReady:false, waiverFirstTimeHB:false, waiverDutyToServe:false,
    // Optional wholesaler-keeps split, off by default; shares are illustrative.
    wsplit:false, wfixed:30, wvariable:30, wonetime:5, wrate:15, wprofit:20
  };
  const ANCHOR = {coupon:SOURCES.mbs.coupon, price:SOURCES.mbs.price, perPoint:SOURCES.perPoint};
  const RATE_SHARE = 0.59 / 1.39; // illustrative split of the coupon-over-Treasury spread into rate risk vs refi risk
  const SPLIT = [['fixed', 'Fixed cost', 'rent, salaries, systems, licensing, allocated per loan'], ['variable', 'Variable cost', 'processing, credit, disclosures, marketing that scale with volume'], ['onetime', 'One-time expense', 'launch or project costs allocated to this loan'], ['profit', 'Profit', 'what MSFG actually clears on the loan']];
  // Optional split of what the wholesaler keeps. Illustrative shares: no wholesaler publishes a per-loan cost structure.
  // Loan programs. The strip is the agency minimum servicing fee (Fannie/Freddie fixed-rate 25 bp; Ginnie Mae II 19 bp).
  // The fee is fixed per program: Fannie's ongoing g-fee (SOURCES.gfee, incl. TCCA) or Ginnie Mae's 6 bp guaranty fee.
  // Only conventional loans carry Fannie LLPAs; FHA, VA and USDA price risk through upfront and annual fees (programFees).
  // A conventional loan above 80% LTV also carries borrower-paid monthly MI to a private insurer (programFees, `pmi`).
  const ginnie = (label, upfrontLabel, annualLabel, premiumWords) => ({label, gov:true, agency:'Ginnie Mae', agencyShort:'Ginnie', insurer:label, strip:0.19, stripNote:'Ginnie Mae II minimum', fee:0.06, feeNote:'Ginnie Mae guaranty fee · fixed', feeLabel:'Ginnie guaranty fee %/yr', feeWord:'guaranty fee', llpa:false, mbs:'Ginnie Mae MBS', upfrontLabel, annualLabel, premiumWords});
  const PROGRAMS = {
    conv: {label:'Fannie / Freddie fixed', gov:false, agency:'Fannie Mae', agencyShort:'Fannie', insurer:'Private mortgage insurer', strip:0.25, stripNote:'Fannie Mae minimum for fixed-rate', fee:SOURCES.gfee, feeNote:'Fannie Mae guarantee fee, incl. 0.10% TCCA · fixed', feeLabel:'Guarantee fee %/yr', feeWord:'g-fee', llpa:true, mbs:'Fannie Mae MBS', upfrontLabel:null, annualLabel:'monthly MI', premiumWords:null},
    fha: ginnie('FHA', 'upfront MIP', 'annual MIP', 'the upfront and annual MIP'),
    va: ginnie('VA', 'funding fee', null, 'the funding fee'),
    usda: ginnie('USDA', 'upfront guarantee fee', 'annual fee', 'the upfront and annual guarantee fees')
  };
  // VA funding fee, purchase loans, % of the base loan, by use and down payment (from the base LTV). IRRRL and cash-out tiers are not modeled.
  const VA_FUNDING_FEE = { first: SOURCES.programs.va.first, subsequent: SOURCES.programs.va.subsequent };
  const downTier = ltv => ltv > 95 ? 'lt5' : ltv > 90 ? 'lt10' : 'ge10';
  const DOWN_WORDS = {lt5: 'under 5% down', lt10: '5–10% down', ge10: '10% or more down'};
  // Upfront and annual fee rates for a program at a base LTV. FHA annual MIP uses the 30-year bands by LTV and by base loan
  // size; 15-year terms differ. The upfront percent applies to the base loan. Conventional: no upfront fee, and the typed
  // borrower-paid monthly MI rate (s.pmi) only above 80% LTV.
  function programFees(key, ltv, s) {
    const F = SOURCES.programs;
    if (key === 'fha') { const a = F.fha.annual, hb = s.loan > a.limit; return {upfrontPct: F.fha.upfront, annualPct: hb ? (ltv > 95 ? a.hbHigh : a.hbLow) : (ltv > 95 ? a.stdHigh : a.stdLow), upfrontWhy: ''}; }
    if (key === 'usda') return {upfrontPct: F.usda.upfront, annualPct: F.usda.annual, upfrontWhy: ''};
    if (key === 'va') {
      const tier = downTier(ltv), use = s.vaSubsequentUse ? 'subsequent' : 'first';
      return {upfrontPct: s.vaExempt ? 0 : VA_FUNDING_FEE[use][tier], annualPct: 0, upfrontWhy: s.vaExempt ? 'exempt' : `${use} use, ${DOWN_WORDS[tier]}`};
    }
    const pmi = ltv > 80 && s.pmi > 0 ? s.pmi : 0;
    return {upfrontPct: 0, annualPct: pmi, upfrontWhy: ''};
  }
  const WSPLIT = [['wfixed', 'Fixed cost', 'underwriting, closing, technology and overhead allocated per loan'], ['wvariable', 'Variable cost', 'account executives, credit, appraisal review and other per-loan spend'], ['wonetime', 'One-time expense', 'onboarding, system and project costs allocated to this loan'], ['wrate', 'Rate risk / hedge', 'the cost of hedging the locked pipeline with TBA sales; the market-move layer shows it in dollars'], ['wprofit', 'Profit', 'what the wholesaler actually clears on the loan']];

  const pts = x => { const s = (Math.round(x * 1000) / 1000).toString(); return s === '-0' ? '0' : s.replace('-', '−'); };
  // Percent with 2 decimals, or 3 when the value needs them (0.375% not 0.38%). Formatting itself is the house utility.
  const pc = (x, d = 2) => NS.formatPercent(x, Math.abs(x * 100 - Math.round(x * 100)) > 1e-6 && d === 2 ? 3 : d);
  // Servicing multiple for display: one decimal when that's exact (4.0×), two when it isn't (3.75×).
  const multX = x => { const r = Math.round(x * 100) / 100; return (Math.abs(r * 10 - Math.round(r * 10)) < 1e-9 ? r.toFixed(1) : r.toFixed(2)) + '×'; };
  const m0w = x => NS.formatCurrency(x, 0); // whole dollars, house utility (for warning text)
  // Whole-dollar split that still sums to the total (largest remainder).
  const splitDollars = (total, shares) => { const raw = shares.map(s => total * s); const fl = raw.map(Math.floor); let rem = Math.round(total) - fl.reduce((a, b) => a + b, 0); raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rem > 0) { fl[i]++; rem--; } }); return fl; };
  const autoCoupon = (rate, svc, gfee) => Math.max(0.5, Math.floor((rate - gfee - svc) / 0.5 + 1e-9) * 0.5);
  const estPrice = c => Math.round((ANCHOR.price + (c - ANCHOR.coupon) * ANCHOR.perPoint) * 100) / 100;
  const isSet = v => v !== null && v !== undefined;
  // Excess servicing: the note rate above coupon + fee + base strip. Floating-point dust (7.20 − 6.5 − 0.70) counts as zero.
  const excessOf = (rate, coupon, floor) => { const e = rate - coupon - floor; return e > 1e-9 ? e : 0; };

  // ---------- layer 1: solve the lock ----------
  function solveLock(s) {
    const warnings = [];
    const base = s.loan;
    let coupon = s.coupon, rate = s.rate, tsy = s.tsy, lo = s.lo, margin = s.margin, msrPts = s.msr, price = s.price, comp = s.comp;
    // The program fixes the strip and, for Ginnie programs, the fee; the typed svc/gfee only apply where the program leaves them open.
    const program = PROGRAMS[s.program] ? s.program : 'conv', prog = PROGRAMS[program];
    const svc = prog.strip, gfee = prog.fee;
    // Program fees on the base loan. A financed upfront fee raises the funded loan, and every per-point figure then works on that larger P.
    const ltv = s.propertyValue > 0 ? base / s.propertyValue * 100 : 0;
    const fees = programFees(program, ltv, s);
    const upfrontD = base * fees.upfrontPct / 100;
    const financed = prog.gov && !!s.financeUpfront && upfrontD > 0;
    const P = financed ? base + upfrontD : base;
    const upCashD = financed ? 0 : upfrontD;
    const floor = gfee + svc;

    // LLPAs: from the Fannie matrix when the engine is loaded and matrix mode is on, else the typed value.
    let llpa = Math.max(0, s.llpa), llpaCalc = null;
    if (!prog.llpa) llpa = 0;
    else if (s.llpaMode === 'matrix') {
      if (NS.LLPA && NS.LLPA_MATRIX) {
        llpaCalc = NS.LLPA.calcLLPAs({
          loanAmount: P, propertyValue: s.propertyValue, creditScore: s.creditScore, termYears: 30,
          purpose: s.purpose, productType: 'Fixed', occupancy: s.occupancy, units: s.units,
          isCondo: s.isCondo, isManufacturedHome: s.isManufacturedHome, isHighBalance: s.isHighBalance,
          hasSubordinateFinancing: s.hasSubordinateFinancing, applyMMI: s.applyMMI, isHighLTVRefi: s.isHighLTVRefi,
          waiverHomeReady: s.waiverHomeReady, waiverFirstTimeHB: s.waiverFirstTimeHB, waiverDutyToServe: s.waiverDutyToServe
        });
        llpa = Math.max(0, llpaCalc.totalPoints);
        if (llpaCalc.totalPoints < 0) warnings.push('The LLPA matrix returned a negative total; shown as 0.');
        llpaCalc.warnings.forEach(w => warnings.push(w));
      } else {
        warnings.push('The LLPA matrix is not loaded; using the typed LLPA value.');
      }
    }
    // Conforming limits: Fannie pricing only applies up to the county limit, and above the baseline only as high balance.
    const LIM = SOURCES.loanLimits;
    if (!prog.gov && P > LIM.ceiling) warnings.push(`${m0w(P)} is above the ${LIM.year} high-cost ceiling of ${m0w(LIM.ceiling)}: this would be a jumbo loan, and Fannie pricing doesn't apply.`);
    else if (!prog.gov && P > LIM.baseline && !s.isHighBalance) warnings.push(`${m0w(P)} is above the ${LIM.year} baseline conforming limit of ${m0w(LIM.baseline)}. In a high-cost county, check "High balance" to add that LLPA; otherwise this is a jumbo loan.`);
    if (rate < coupon + floor) { coupon = autoCoupon(rate, svc, gfee); warnings.push(`The note rate must cover the coupon plus ${pc(floor)} (${prog.feeWord} + servicing strip). Coupon shown as ${pc(coupon)}; enter that coupon's price if you have it.`); }
    if (tsy >= coupon) { tsy = coupon - 0.25; warnings.push(`The Treasury yield has to sit below the MBS coupon. Shown as ${pc(tsy)}.`); }
    // Servicing value from multiples of the strip: the base strip at the servicing multiple, and the excess strip (note
    // rate above coupon + fee + base strip at the lock coupon) at its own lower multiple, so an eighth of rate that cannot
    // reach the next coupon is not capitalized at the full base multiple. It makes the mark a given, so a request to
    // solve for servicing solves the margin instead.
    const excess = excessOf(rate, coupon, floor), strip = svc + excess;
    const msrFromMult = typeof s.msrMult === 'number' && isFinite(s.msrMult) && s.msrMult > 0;
    const msrMult = msrFromMult ? s.msrMult : null;
    const excessMult = typeof s.excessMult === 'number' && isFinite(s.excessMult) && s.excessMult >= 0 ? s.excessMult : SOURCES.excessMult;
    const msrBasePts = msrFromMult ? msrMult * svc : 0, msrExcessPts = msrFromMult ? excessMult * excess : 0;
    if (msrFromMult) msrPts = msrBasePts + msrExcessPts;
    const mode = s.solve === 'msr' && msrFromMult ? 'margin' : s.solve;
    const splitSum = s.fixed + s.variable + s.onetime + s.profit;
    let shares = [s.fixed, s.variable, s.onetime, s.profit];
    if (Math.abs(splitSum - 100) > 0.01) { shares = splitSum > 0 ? shares.map(x => x / splitSum * 100) : [25, 25, 25, 25]; warnings.push(`MSFG's four shares add up to ${pts(splitSum)}%, not 100%; they are scaled to 100% in the chart.`); }
    const wsplit = !!s.wsplit;
    let wshares = [s.wfixed, s.wvariable, s.wonetime, s.wrate, s.wprofit];
    const wsum = wshares.reduce((a, b) => a + b, 0);
    if (wsplit && Math.abs(wsum - 100) > 0.01) { wshares = wsum > 0 ? wshares.map(x => x / wsum * 100) : [20, 20, 20, 20, 20]; warnings.push(`The wholesaler's five shares add up to ${pts(wsum)}%, not 100%; they are scaled to 100% in the chart.`); }

    let premPts = price - 100;
    let sheetPts = -s.sheet; // internal convention: positive = credit to the borrower
    // The sheet price is the wholesaler's base price before LLPAs. LLPAs go on top of it, point for point, so the
    // borrower's all-in price at the sheet is sheet − LLPAs (in credit terms). Solving against the all-in price keeps
    // LLPAs out of the margin, comp, servicing and MBS price: they pass straight through to the borrower.
    const sheetAllIn = sheetPts - llpa;
    let solvedMsr = false, solvedMargin = false, solvedComp = false, solvedPrice = false, solvedSheet = false;
    const msrIn = msrPts;
    if (mode === 'msr') {
      msrPts = sheetAllIn - premPts + margin + comp + llpa; solvedMsr = true;
      if (msrPts < 0) { msrPts = 0; margin = premPts - comp - llpa - sheetAllIn; solvedMargin = true; warnings.push(`Even with zero servicing value, the sheet price is richer than this execution supports at a ${pts(s.margin)}-pt margin; the wholesaler's margin is solved instead.`); }
    } else if (mode === 'margin') {
      margin = premPts + msrPts - comp - llpa - sheetAllIn; solvedMargin = true;
      if (margin < 0) { margin = 0; msrPts = sheetAllIn - premPts + comp + llpa; solvedMsr = true; warnings.push(`At a ${pts(msrIn)}-pt servicing value the sheet price leaves the wholesaler a loss; margin is shown as 0 and the servicing value is solved instead.`); }
    } else if (mode === 'comp') {
      comp = premPts + msrPts - margin - llpa - sheetAllIn; solvedComp = true;
      if (comp < 0) { comp = 0; warnings.push('At these inputs there is nothing left for broker comp: the borrower price, margin, LLPAs and execution use up more than the loan is worth. Comp is shown as 0 and the gap is shown.'); }
    } else if (mode === 'price') {
      premPts = sheetAllIn - msrPts + margin + comp + llpa; price = Math.round((100 + premPts) * 1000) / 1000; solvedPrice = true;
    } else if (mode === 'sheet') {
      solvedSheet = true; // borrower price falls out of the other four; the sheet field mirrors it
    }
    if (msrPts < 0) { msrPts = 0; warnings.push('The sheet price is richer than the modeled execution even with zero servicing value and zero margin; the gap is shown.'); }
    if (lo > comp) { lo = comp; warnings.push(`LO comp cannot exceed broker comp${solvedComp ? ' (solved at ' + pts(comp) + ' pts)' : ''}. Shown as equal.`); }

    let borrowerPts = premPts + msrPts - margin - comp - llpa;
    if (Math.abs(borrowerPts) < 0.0005) borrowerPts = 0;
    // Solving for the borrower's price: the sheet field mirrors the pre-LLPA price that would produce it.
    if (solvedSheet) { sheetPts = borrowerPts + llpa; if (Math.abs(sheetPts) < 0.0005) sheetPts = 0; }

    return {warnings, P, base, ltv, upfrontPct: fees.upfrontPct, upfrontWhy: fees.upfrontWhy, upfrontD, financed, upCashD, annualPct: fees.annualPct,
            rate, tsy, lo, comp, svc, gfee, program, prog, strip, msrFromMult, msrMult, excessMult, msrBasePts, msrExcessPts, llpa, llpaCalc, llpaMode: s.llpaMode,
            creditScore: s.creditScore, propertyValue: s.propertyValue, purpose: s.purpose, occupancy: s.occupancy, units: s.units,
            floor, mode, shares, wsplit, wshares, coupon, price, premPts, msrPts, margin, sheetPts,
            sheetCost: solvedSheet ? (sheetPts === 0 ? 0 : -sheetPts) : s.sheet, solvedMsr, solvedMargin, solvedComp, solvedPrice, solvedSheet};
  }

  // ---------- layer 2: the market moves after the lock ----------
  // Borrower price, comp and the servicing mark are held; the margin absorbs the change in execution.
  function applyMove(lock, s) {
    const warnings = [];
    let coupon = lock.coupon, price = lock.price, premPts = lock.premPts, margin = lock.margin, tsy = lock.tsy;
    let moved = false;
    if (isSet(s.coupon2) || isSet(s.price2)) {
      let c2 = isSet(s.coupon2) ? s.coupon2 : coupon, p2 = isSet(s.price2) ? s.price2 : price;
      if (lock.rate < c2 + lock.floor) {
        const asked = c2;
        c2 = autoCoupon(lock.rate, lock.svc, lock.gfee);
        if (s.price2Est || !isSet(s.price2)) p2 = c2 === ANCHOR.coupon ? ANCHOR.price : estPrice(c2);
        warnings.push(`After the move, a ${pc(asked)} coupon does not fit under the ${pc(lock.rate)} note; shown as ${pc(c2)}${s.price2Est ? ' with an estimated price' : ''}.`);
      }
      moved = Math.abs(c2 - coupon) > 1e-9 || Math.abs(p2 - price) > 1e-9;
      if (moved) {
        coupon = c2; price = p2; premPts = price - 100;
        margin = lock.margin + (premPts - lock.premPts);
        if (tsy >= coupon) { tsy = coupon - 0.25; warnings.push(`The Treasury yield has to sit below the MBS coupon. Shown as ${pc(tsy)}.`); }
      }
    }
    return {coupon, price, premPts, margin, tsy, moved, warnings};
  }

  // ---------- one complete front-end state for a given execution ----------
  function frontEnd(lock, exec) {
    const P = lock.P;
    const prem = P * exec.premPts / 100, disc = Math.max(0, -prem), proceeds = P + prem;
    const excess = excessOf(lock.rate, exec.coupon, lock.floor), strip = lock.svc + excess;
    // Rounded so float dust (1.125 / 0.30000000000000004 = 3.7499…) doesn't display as 3.7× instead of 3.75×.
    const msr = P * lock.msrPts / 100, mult = strip > 0 ? Math.round(lock.msrPts / strip * 1e4) / 1e4 : 0;
    const compD = P * lock.comp / 100, loD = P * lock.lo / 100, mkD = compD - loD, llpaD = P * lock.llpa / 100;
    const lossPts = Math.max(0, -exec.margin), keep = P * Math.max(0, exec.margin) / 100, lossD = P * lossPts / 100;
    const splitD = lock.shares.map(x => mkD * x / 100), splitShow = splitDollars(mkD, lock.shares.map(x => x / 100));
    // The wholesaler's keep split the same way, when the optional split is on (empty otherwise).
    const wsplitD = lock.wsplit ? lock.wshares.map(x => keep * x / 100) : [];
    const wsplitShow = lock.wsplit ? splitDollars(keep, lock.wshares.map(x => x / 100)) : [];
    let borrowerPts = exec.premPts + lock.msrPts - exec.margin - lock.comp - lock.llpa;
    if (Math.abs(borrowerPts) < 0.0005) borrowerPts = 0;
    const bpD = P * Math.max(0, -borrowerPts) / 100;   // points the borrower pays
    const crD = P * Math.max(0, borrowerPts) / 100;    // lender credit to the borrower
    // An upfront fee paid in cash passes through the wholesaler to the insurer; a financed one is already inside P.
    const uwmIn = proceeds + bpD + msr + lossD + lock.upCashD;
    const uwmOut = compD + llpaD + P + crD + keep + lock.upCashD;
    const rev = Math.max(0, prem) + bpD + msr;
    const gap = (lock.sheetPts - lock.llpa) - borrowerPts; // all-in sheet vs. model; positive: the sheet is better for the borrower
    const impliedMsr = lock.msrPts + gap;              // servicing value needed to hit the lock margin at the sheet price
    const impliedMargin = lock.margin - gap;           // margin earned at the sheet price with the entered servicing value
    const servicer = P * strip / 100 / 12;
    return Object.assign({}, lock, {
      coupon: exec.coupon, price: exec.price, premPts: exec.premPts, margin: exec.margin, tsy: exec.tsy,
      prem, disc, proceeds, excess, strip, msr, mult, compD, loD, mkD, llpaD, lossPts, lossD, keep, splitD, splitShow, wsplitD, wsplitShow,
      borrowerPts, bpD, crD, uwmIn, uwmOut, rev, gap, impliedMsr, impliedMargin, servicer
    });
  }

  // ---------- month 1 of principal and interest, for the after state ----------
  function monthly(fe) {
    const P = fe.P, r = fe.rate / 100 / 12;
    const pmt = NS.calcMonthlyPayment(P, fe.rate / 100, 30);
    const int = P * r, prin = pmt - int;
    const annualD = P * fe.annualPct / 100 / 12, total = pmt + annualD; // annual MIP / fee, month 1, on top of P&I
    const gfD = P * fe.gfee / 100 / 12, svD = P * fe.svc / 100 / 12, trD = P * fe.tsy / 100 / 12;
    const spread = fe.coupon - fe.tsy, rateRisk = spread * RATE_SHARE, refi = spread - rateRisk;
    const rrD = P * rateRisk / 100 / 12, rfD = P * refi / 100 / 12;
    const exD = P * fe.excess / 100 / 12;
    return {P, rate: fe.rate, coupon: fe.coupon, tsy: fe.tsy, svc: fe.svc, gfee: fe.gfee, prog: fe.prog, annualPct: fe.annualPct, annualD, total, floor: fe.floor, excess: fe.excess, strip: fe.strip,
            pmt, int, prin, gfD, svD, trD, spread, rateRisk, refi, rrD, rfD, exD, bondIn: trD + rrD + rfD + prin, servicer: svD + exD};
  }

  function compute(s) {
    const lockSolve = solveLock(s);
    const move = applyMove(lockSolve, s);
    const lock = frontEnd(lockSolve, lockSolve);
    const after = frontEnd(lockSolve, move);
    return {lock, after, moved: move.moved, monthly: monthly(after), warnings: lockSolve.warnings.concat(move.warnings), mode: lockSolve.mode};
  }

  NS.WtmgMath = { compute, solveLock, applyMove, frontEnd, monthly, autoCoupon, estPrice, splitDollars, pts, pc, multX, SOURCES, DEFAULTS, ANCHOR, RATE_SHARE, AVG_MARGIN, SPLIT, WSPLIT, PROGRAMS, VA_FUNDING_FEE, programFees };
})();
