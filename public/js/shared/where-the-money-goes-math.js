/**
 * Where the Money Goes — pricing model (pure functions, no DOM).
 * Exposed as MSFG.WtmgMath so the page script and the unit tests share one implementation.
 *
 * Identity: borrower points = wholesaler margin + broker comp + LLPAs − MBS premium − servicing value.
 * compute(inputs) solves for whichever variable inputs.solve names, applies the optional after-lock
 * market move (margin absorbs it), and returns every figure the page renders.
 */
/* global globalThis */
(function() {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.MSFG = root.MSFG || {};

  const AVG_MARGIN = 1.33; // UWM reported Q2 2026 total gain margin, 133 bps
  const DEFAULTS = {loan:500000, rate:7.25, sheet:2.016, solve:'msr', coupon:6.50, price:100.69, tsy:5.11, comp:2.25, lo:1.125, margin:1.33, msr:0.874, svc:0.25, gfee:0.50, llpa:0, fixed:30, variable:50, onetime:10, profit:10, coupon2:null, price2:null};
  const ANCHOR = {coupon:6.50, price:100.69, perPoint:3.5}; // price moves about 3.5 pts per 1% of coupon
  const RATE_SHARE = 0.59 / 1.39; // illustrative split of the coupon-over-Treasury spread into rate risk vs refi risk
  const SPLIT = [['fixed', 'Fixed cost', 'rent, salaries, systems, licensing, allocated per loan'], ['variable', 'Variable cost', 'processing, credit, disclosures, marketing that scale with volume'], ['onetime', 'One-time expense', 'launch or project costs allocated to this loan'], ['profit', 'Profit', 'what MSFG actually clears on the loan']];
  const pts = x => { const s = (Math.round(x * 1000) / 1000).toString(); return s === '-0' ? '0' : s.replace('-', '−'); };
  const pc = (x, d = 2) => (Math.abs(x * 100 - Math.round(x * 100)) > 1e-6 && d === 2 ? x.toFixed(3) : x.toFixed(d)) + '%';
  const splitDollars = (total, shares) => { const raw = shares.map(s => total * s); const fl = raw.map(Math.floor); let rem = Math.round(total) - fl.reduce((a, b) => a + b, 0); raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rem > 0) { fl[i]++; rem--; } }); return fl; };
  const autoCoupon = (rate, svc, gfee) => Math.max(0.5, Math.floor((rate - gfee - svc) / 0.5 + 1e-9) * 0.5);
  const estPrice = c => Math.round((ANCHOR.price + (c - ANCHOR.coupon) * ANCHOR.perPoint) * 100) / 100;

  // ---------- model ----------
  function compute(s){
    const warnings = [];
    const P = s.loan;
    let coupon = s.coupon, rate = s.rate, tsy = s.tsy, lo = s.lo, margin = s.margin, msrPts = s.msr, price = s.price, comp = s.comp;
    const svc = s.svc, gfee = s.gfee, mode = s.solve, llpa = Math.max(0, s.llpa);
    const floor = gfee + svc;
    if (rate < coupon + floor) { coupon = autoCoupon(rate, svc, gfee); warnings.push(`The note rate must cover the coupon plus ${pc(floor)} (g-fee + servicing strip). Coupon shown as ${pc(coupon)}; enter that coupon's price if you have it.`); }
    if (tsy >= coupon) { tsy = coupon - 0.25; warnings.push(`The Treasury yield has to sit below the MBS coupon. Shown as ${pc(tsy)}.`); }
    const splitSum = s.fixed + s.variable + s.onetime + s.profit;
    let shares = [s.fixed, s.variable, s.onetime, s.profit];
    if (Math.abs(splitSum - 100) > 0.01) { shares = splitSum > 0 ? shares.map(x => x / splitSum * 100) : [25, 25, 25, 25]; warnings.push(`MSFG's four shares add up to ${pts(splitSum)}%, not 100%; they are scaled to 100% in the chart.`); }

    let premPts = price - 100;
    let sheetPts = -s.sheet; // internal convention: positive = credit to the borrower
    // One identity: premium + servicing − margin − comp = borrower price (sheet). Solve for whichever variable was picked.
    let solvedMsr = false, solvedMargin = false, solvedComp = false, solvedPrice = false, solvedSheet = false;
    if (mode === 'msr') {
      msrPts = sheetPts - premPts + margin + comp + llpa; solvedMsr = true;
      if (msrPts < 0) { msrPts = 0; margin = premPts - comp - llpa - sheetPts; solvedMargin = true; warnings.push(`Even with zero servicing value, the sheet price is richer than this execution supports at a ${pts(s.margin)}-pt margin; the wholesaler's margin is solved instead.`); }
    } else if (mode === 'margin') {
      margin = premPts + msrPts - comp - llpa - sheetPts; solvedMargin = true;
      if (margin < 0) { margin = 0; msrPts = sheetPts - premPts + comp + llpa; solvedMsr = true; warnings.push(`At a ${pts(s.msr)}-pt servicing value the sheet price leaves the wholesaler a loss; margin is shown as 0 and the servicing value is solved instead.`); }
    } else if (mode === 'comp') {
      comp = premPts + msrPts - margin - llpa - sheetPts; solvedComp = true;
      if (comp < 0) { comp = 0; warnings.push('At these inputs there is nothing left for broker comp: the borrower price, margin, LLPAs and execution use up more than the loan is worth. Comp is shown as 0 and the gap is shown.'); }
    } else if (mode === 'price') {
      premPts = sheetPts - msrPts + margin + comp + llpa; price = Math.round((100 + premPts) * 1000) / 1000; solvedPrice = true;
    } else if (mode === 'sheet') {
      solvedSheet = true; // borrower price falls out of the other four; the sheet field mirrors it
    }
    if (msrPts < 0) { msrPts = 0; warnings.push('The sheet price is richer than the modeled execution even with zero servicing value and zero margin; the gap is shown.'); }
    if (lo > comp) { lo = comp; warnings.push(`LO comp cannot exceed broker comp${solvedComp ? ' (solved at ' + pts(comp) + ' pts)' : ''}. Shown as equal.`); }

    // Layer 2: the market moves after the lock. Borrower price, comp and the servicing mark are held; the margin absorbs the change.
    const lockCoupon = coupon, lockPrice = price, lockPremPts = premPts, lockMargin = margin;
    let moved = false;
    if (s.coupon2 !== null || s.price2 !== null) {
      let c2 = s.coupon2 !== null ? s.coupon2 : coupon, p2 = s.price2 !== null ? s.price2 : price;
      if (rate < c2 + floor) { const asked = c2; c2 = autoCoupon(rate, svc, gfee); if (s.price2Est || s.price2 === null) p2 = c2 === ANCHOR.coupon ? ANCHOR.price : estPrice(c2); warnings.push(`After the move, a ${pc(asked)} coupon does not fit under the ${pc(rate)} note; shown as ${pc(c2)}${s.price2Est ? ' with an estimated price' : ''}.`); }
      moved = Math.abs(c2 - coupon) > 1e-9 || Math.abs(p2 - price) > 1e-9;
      if (moved) {
        coupon = c2; price = p2; premPts = price - 100;
        margin = lockMargin + (premPts - lockPremPts);
        if (tsy >= coupon) { tsy = coupon - 0.25; warnings.push(`The Treasury yield has to sit below the MBS coupon. Shown as ${pc(tsy)}.`); }
      }
    }
    const lossPts = Math.max(0, -margin);

    const prem = P * premPts / 100;
    const msr = P * msrPts / 100;
    const compD = P * comp / 100, loD = P * lo / 100, mkD = compD - loD, keep = P * Math.max(0, margin) / 100, lossD = P * lossPts / 100, llpaD = P * llpa / 100;
    const splitD = shares.map(x => mkD * x / 100);
    const splitShow = splitDollars(mkD, shares.map(x => x / 100));
    let borrowerPts = premPts + msrPts - margin - comp - llpa;
    if (Math.abs(borrowerPts) < 0.0005) borrowerPts = 0;
    if (solvedSheet) sheetPts = borrowerPts;
    const bpD = P * Math.max(0, -borrowerPts) / 100;
    const crD = P * Math.max(0, borrowerPts) / 100;
    const proceeds = P + prem;
    const disc = Math.max(0, -prem);
    const uwmIn = proceeds + bpD + msr + lossD;
    const rev = Math.max(0, prem) + bpD + msr;
    const gap = sheetPts - borrowerPts;
    const impliedMsr = msrPts + gap;
    const impliedMargin = lockMargin - gap;

    const r = rate / 100 / 12;
    const pmt = P * r / (1 - Math.pow(1 + r, -360));
    const int = P * r, prin = pmt - int;
    const gfD = P * gfee / 100 / 12, svD = P * svc / 100 / 12, trD = P * tsy / 100 / 12;
    const spread = coupon - tsy, rateRisk = spread * RATE_SHARE, refi = spread - rateRisk;
    const rrD = P * rateRisk / 100 / 12, rfD = P * refi / 100 / 12;
    const excess = Math.max(0, rate - coupon - floor), exD = P * excess / 100 / 12;
    const strip = svc + excess, mult = strip > 0 ? msrPts / strip : 0;

    return {warnings, P, price, coupon, rate, tsy, lo, comp, margin, msrPts, sheetPts, sheetCost:solvedSheet ? -borrowerPts : s.sheet, svc, gfee, floor, mode, solvedMsr, solvedMargin, solvedComp, solvedPrice, solvedSheet,
            premPts, prem, disc, msr, compD, loD, mkD, keep, lossD, lossPts, llpa, llpaD, shares, splitD, splitShow,
            lockCoupon, lockPrice, lockPremPts, lockMargin, moved,
            borrowerPts, bpD, crD, proceeds, uwmIn, rev, gap, impliedMsr, impliedMargin,
            pmt, int, prin, gfD, svD, trD, spread, rateRisk, refi, rrD, rfD, excess, exD, strip, mult,
            bondIn: trD + rrD + rfD + prin, servicer: svD + exD};
  }

  root.MSFG.WtmgMath = { compute, autoCoupon, estPrice, splitDollars, pts, pc, DEFAULTS, ANCHOR, RATE_SHARE, AVG_MARGIN, SPLIT };
})();
