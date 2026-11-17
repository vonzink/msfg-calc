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
  // Whole-dollar split that still sums to the total (largest remainder).
  const splitDollars = (total, shares) => { const raw = shares.map(s => total * s); const fl = raw.map(Math.floor); let rem = Math.round(total) - fl.reduce((a, b) => a + b, 0); raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rem > 0) { fl[i]++; rem--; } }); return fl; };
  const autoCoupon = (rate, svc, gfee) => Math.max(0.5, Math.floor((rate - gfee - svc) / 0.5 + 1e-9) * 0.5);
  const estPrice = c => Math.round((ANCHOR.price + (c - ANCHOR.coupon) * ANCHOR.perPoint) * 100) / 100;
  const isSet = v => v !== null && v !== undefined;

  // ---------- layer 1: solve the lock ----------
  function solveLock(s) {
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

    let borrowerPts = premPts + msrPts - margin - comp - llpa;
    if (Math.abs(borrowerPts) < 0.0005) borrowerPts = 0;
    if (solvedSheet) sheetPts = borrowerPts;

    return {warnings, P, rate, tsy, lo, comp, svc, gfee, llpa, floor, mode, shares, coupon, price, premPts, msrPts, margin, sheetPts,
            sheetCost: solvedSheet ? (borrowerPts === 0 ? 0 : -borrowerPts) : s.sheet, solvedMsr, solvedMargin, solvedComp, solvedPrice, solvedSheet};
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
    const excess = Math.max(0, lock.rate - exec.coupon - lock.floor), strip = lock.svc + excess;
    const msr = P * lock.msrPts / 100, mult = strip > 0 ? lock.msrPts / strip : 0;
    const compD = P * lock.comp / 100, loD = P * lock.lo / 100, mkD = compD - loD, llpaD = P * lock.llpa / 100;
    const lossPts = Math.max(0, -exec.margin), keep = P * Math.max(0, exec.margin) / 100, lossD = P * lossPts / 100;
    const splitD = lock.shares.map(x => mkD * x / 100), splitShow = splitDollars(mkD, lock.shares.map(x => x / 100));
    let borrowerPts = exec.premPts + lock.msrPts - exec.margin - lock.comp - lock.llpa;
    if (Math.abs(borrowerPts) < 0.0005) borrowerPts = 0;
    const bpD = P * Math.max(0, -borrowerPts) / 100;   // points the borrower pays
    const crD = P * Math.max(0, borrowerPts) / 100;    // lender credit to the borrower
    const uwmIn = proceeds + bpD + msr + lossD;
    const uwmOut = compD + llpaD + P + crD + keep;
    const rev = Math.max(0, prem) + bpD + msr;
    const gap = lock.sheetPts - borrowerPts;           // positive: the sheet is better for the borrower than this execution
    const impliedMsr = lock.msrPts + gap;              // servicing value needed to hit the lock margin at the sheet price
    const impliedMargin = lock.margin - gap;           // margin earned at the sheet price with the entered servicing value
    const servicer = P * strip / 100 / 12;
    return Object.assign({}, lock, {
      coupon: exec.coupon, price: exec.price, premPts: exec.premPts, margin: exec.margin, tsy: exec.tsy,
      prem, disc, proceeds, excess, strip, msr, mult, compD, loD, mkD, llpaD, lossPts, lossD, keep, splitD, splitShow,
      borrowerPts, bpD, crD, uwmIn, uwmOut, rev, gap, impliedMsr, impliedMargin, servicer
    });
  }

  // ---------- month 1 of principal and interest, for the after state ----------
  function monthly(fe) {
    const P = fe.P, r = fe.rate / 100 / 12;
    const pmt = P * r / (1 - Math.pow(1 + r, -360));
    const int = P * r, prin = pmt - int;
    const gfD = P * fe.gfee / 100 / 12, svD = P * fe.svc / 100 / 12, trD = P * fe.tsy / 100 / 12;
    const spread = fe.coupon - fe.tsy, rateRisk = spread * RATE_SHARE, refi = spread - rateRisk;
    const rrD = P * rateRisk / 100 / 12, rfD = P * refi / 100 / 12;
    const exD = P * fe.excess / 100 / 12;
    return {P, rate: fe.rate, coupon: fe.coupon, tsy: fe.tsy, svc: fe.svc, gfee: fe.gfee, floor: fe.floor, excess: fe.excess, strip: fe.strip,
            pmt, int, prin, gfD, svD, trD, spread, rateRisk, refi, rrD, rfD, exD, bondIn: trD + rrD + rfD + prin, servicer: svD + exD};
  }

  function compute(s) {
    const lockSolve = solveLock(s);
    const move = applyMove(lockSolve, s);
    const lock = frontEnd(lockSolve, lockSolve);
    const after = frontEnd(lockSolve, move);
    return {lock, after, moved: move.moved, monthly: monthly(after), warnings: lockSolve.warnings.concat(move.warnings), mode: lockSolve.mode};
  }

  root.MSFG.WtmgMath = { compute, solveLock, applyMove, frontEnd, monthly, autoCoupon, estPrice, splitDollars, pts, pc, DEFAULTS, ANCHOR, RATE_SHARE, AVG_MARGIN, SPLIT };
})();
