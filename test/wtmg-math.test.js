/**
 * Unit tests for the Where the Money Goes pricing model (MSFG.WtmgMath).
 *
 * The scenarios pin numbers that were verified by hand against the UWM rate sheet
 * (7.25% row: base −0.234, borrower pays 2.016 after 2.25 lender-paid comp) and
 * against the page on Nov 17, 2026. The balance identity (everything flowing into
 * the wholesaler equals everything flowing out) must hold for both lock and after
 * states in every mode.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the shared utilities and the model into one browser-like context, as amortization.test.js does.
const context = vm.createContext({ window: {}, document: { addEventListener() {} }, Intl, console });
for (const file of ['shared/utils.js', 'shared/llpa-matrix.js', 'shared/llpa-engine.js', 'shared/where-the-money-goes-math.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', file), 'utf8'), context);
}
const M = vm.runInContext('MSFG.WtmgMath', context);
const U = vm.runInContext('MSFG', context);

const near = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) <= tol, `${msg || ''} expected ${expected} ± ${tol}, got ${actual}`);
// Arrays built inside the vm context have a different Array prototype, so compare copies.
const sameList = (actual, expected) => assert.deepStrictEqual(Array.from(actual), expected);
const pts3 = x => Math.round(x * 1000) / 1000;
// The page now opens with the margin solved at a 4× servicing mark. The pinned scenarios below were worked in the
// original "solve servicing from the sheet" mode, so `run` keeps that mode explicit; `runDefault` is the page as it opens.
const LEGACY = { solve: 'msr', msrMult: null };
const run = over => M.compute(Object.assign({}, M.DEFAULTS, LEGACY, over));
const runDefault = over => M.compute(Object.assign({}, M.DEFAULTS, over));

function assertBalanced(fe, label) {
  // An upfront program fee paid in cash passes through the wholesaler; a financed one is inside P.
  const inflow = fe.proceeds + fe.bpD + fe.msr + fe.lossD + fe.upCashD;
  const outflow = fe.compD + fe.llpaD + fe.P + fe.crD + fe.keep + fe.upCashD;
  near(inflow, outflow, 0.01, `${label || ''} wholesaler inflow vs outflow`);
  near(fe.uwmIn, inflow, 1e-6, 'uwmIn field');
  near(fe.uwmOut, outflow, 1e-6, 'uwmOut field');
}
function assertBothBalanced(r) { assertBalanced(r.lock, 'lock'); assertBalanced(r.after, 'after'); }
function assertAfterEqualsLock(r) {
  assert.strictEqual(r.moved, false);
  for (const k of ['coupon', 'price', 'premPts', 'margin', 'borrowerPts', 'bpD', 'crD', 'keep', 'lossD', 'uwmIn', 'msrPts', 'gap']) {
    assert.strictEqual(r.after[k], r.lock[k], `after.${k} should equal lock.${k} when nothing moved`);
  }
}

describe('defaults match the UWM sheet at 7.25%', () => {
  const r = run();
  const L = r.lock;

  it('borrower pays 2.016 pts = $10,080', () => {
    assert.strictEqual(pts3(L.borrowerPts), -2.016);
    near(L.bpD, 10080, 0.5);
    assert.strictEqual(L.crD, 0);
  });

  it('solves servicing value to 0.874 pts, 2.9× the 0.30% strip (0.25 base + 0.05 excess at the 0.45 g-fee)', () => {
    assert.ok(L.solvedMsr);
    assert.strictEqual(pts3(L.msrPts), 0.874);
    near(L.msr, 4370, 0.5);
    near(L.strip, 0.30, 1e-9);
    near(L.mult, 2.913, 0.005);
  });

  it('wholesaler takes in $517,900 and keeps its 1.33-pt margin', () => {
    near(L.uwmIn, 517900, 0.5);
    near(L.keep, 6650, 0.5);
    assert.strictEqual(L.lossD, 0);
    assertBothBalanced(r);
    assertAfterEqualsLock(r);
  });

  it('MSFG split is whole dollars that sum to the $5,625 kept', () => {
    sameList(L.splitShow, [1688, 2813, 562, 562]);
    assert.strictEqual(L.splitShow.reduce((a, b) => a + b, 0), 5625);
    near(L.mkD, 5625, 0.01);
  });

  it('monthly payment and interest split are right for month 1', () => {
    const m = r.monthly;
    near(m.pmt, 3410.88, 0.005);
    near(m.int, 3020.83, 0.005);
    near(m.gfD + m.svD + m.trD + m.rrD + m.rfD + m.exD, m.int, 0.005, 'interest layers sum to interest');
    near(m.bondIn, 3098.38, 0.01);
    near(m.excess, 0.05, 1e-9); // 7.25 − 6.5 − 0.45 − 0.25
    near(m.servicer, L.servicer, 1e-9, 'servicer income agrees between monthly and front end');
  });

  it('reports no gap and no warnings', () => {
    near(L.gap, 0, 1e-9);
    sameList(r.warnings, []);
  });
});

describe('the SOURCES block drives the example defaults', () => {
  it('defaults are read from the dated sources, not retyped', () => {
    const S = M.SOURCES;
    assert.strictEqual(M.DEFAULTS.rate, S.sheet.rate);
    assert.strictEqual(M.DEFAULTS.sheet, S.sheet.afterComp);
    assert.strictEqual(M.DEFAULTS.comp, S.sheet.comp);
    assert.strictEqual(M.DEFAULTS.margin, S.margin.pts);
    assert.strictEqual(M.DEFAULTS.coupon, S.mbs.coupon);
    assert.strictEqual(M.DEFAULTS.price, S.mbs.price);
    assert.strictEqual(M.DEFAULTS.tsy, S.treasury);
    assert.strictEqual(M.ANCHOR.perPoint, S.perPoint);
    assert.strictEqual(M.AVG_MARGIN, S.margin.pts);
    assert.ok(/2026/.test(S.asOf) && /2026/.test(S.asOfLong));
  });

  it('the default servicing value is the one the sheet implies at the average margin', () => {
    const S = M.SOURCES;
    const implied = -S.sheet.afterComp - (S.mbs.price - 100) + S.margin.pts + S.sheet.comp;
    assert.strictEqual(M.DEFAULTS.msr, Math.round(implied * 1000) / 1000);
    assert.strictEqual(M.DEFAULTS.msr, 0.874);
  });
});

describe('formatting and payment math come from the house utilities', () => {
  it('monthly payment equals MSFG.calcMonthlyPayment', () => {
    const r = run();
    assert.strictEqual(r.monthly.pmt, U.calcMonthlyPayment(500000, 0.0725, 30));
  });

  it('percent formatting uses 2 decimals, or 3 only when needed', () => {
    assert.strictEqual(M.pc(7.25), '7.25%');
    assert.strictEqual(M.pc(0.25), '0.25%');
    assert.strictEqual(M.pc(0.375), '0.375%');
    assert.strictEqual(M.pc(6.5, 3), '6.500%');
  });

  it('points formatting trims to 3 decimals and never shows negative zero', () => {
    assert.strictEqual(M.pts(2.016), '2.016');
    assert.strictEqual(M.pts(1.3300001), '1.33');
    assert.strictEqual(M.pts(-0), '0');
    assert.strictEqual(M.pts(-1.64), '−1.64');
  });
});

describe('coupon selection and price estimation', () => {
  it('picks the highest coupon that fits under rate − g-fee − strip', () => {
    assert.strictEqual(M.autoCoupon(7.25, 0.25, 0.5), 6.5);
    assert.strictEqual(M.autoCoupon(7.0, 0.25, 0.5), 6.0);
    assert.strictEqual(M.autoCoupon(7.75, 0.25, 0.5), 7.0);
    assert.strictEqual(M.autoCoupon(7.0, 0.25, 0.6), 6.0);
  });

  it('estimates other coupons from the 6.5 anchor at 3.5 pts per 1%', () => {
    assert.strictEqual(M.estPrice(6.5), 100.69);
    assert.strictEqual(M.estPrice(6.0), 98.94);
    assert.strictEqual(M.estPrice(7.0), 102.44);
  });
});

describe('7.00% at 2.326 pts (the UWM 7% row) into a 6.0 coupon', () => {
  const r = run({ rate: 7.0, sheet: 2.326, coupon: 6.0, price: M.estPrice(6.0) });
  const L = r.lock;

  it('solves servicing to 2.314 pts on a 0.55% strip (0.30 excess)', () => {
    assert.strictEqual(pts3(L.msrPts), 2.314);
    assert.strictEqual(pts3(L.excess), 0.3);
    assert.strictEqual(pts3(r.monthly.excess), 0.3);
    near(L.mult, 4.21, 0.05);
  });

  it('draws the below-par coupon as a discount and still balances', () => {
    near(L.disc, 5300, 0.5);
    near(L.proceeds, 494700, 0.5);
    near(L.bpD, 11630, 0.5);
    assertBothBalanced(r);
  });
});

describe('each solve mode inverts the identity', () => {
  it('sheet mode: borrower price falls out of the other four (par at a 2.89 mark)', () => {
    const r = run({ solve: 'sheet', msr: 2.89 });
    assert.ok(r.lock.solvedSheet);
    assert.strictEqual(r.lock.borrowerPts, 0);
    assert.strictEqual(r.lock.bpD, 0);
    assert.strictEqual(r.lock.crD, 0);
    assert.strictEqual(r.lock.sheetCost, 0);
    assertBothBalanced(r);
  });

  it('margin mode: 0.874 servicing gives back the 1.33 margin; 0.5 gives 0.956', () => {
    const a = run({ solve: 'margin', msr: 0.874 });
    assert.ok(a.lock.solvedMargin);
    assert.strictEqual(pts3(a.lock.margin), 1.33);
    const b = run({ solve: 'margin', msr: 0.5 });
    assert.strictEqual(pts3(b.lock.margin), 0.956);
    assertBothBalanced(b);
  });

  it('comp mode: a 1.0 servicing mark supports 2.376 pts of comp', () => {
    const r = run({ solve: 'comp', msr: 1.0 });
    assert.ok(r.lock.solvedComp);
    assert.strictEqual(pts3(r.lock.comp), 2.376);
    near(r.lock.compD, 11880, 0.5);
    assertBothBalanced(r);
  });

  it('price mode: 1.25 servicing needs 100.314; 3.0 servicing needs a 98.564 discount', () => {
    const a = run({ solve: 'price', msr: 1.25 });
    assert.ok(a.lock.solvedPrice);
    assert.strictEqual(pts3(a.lock.price), 100.314);
    assert.strictEqual(a.lock.disc, 0);
    const b = run({ solve: 'price', msr: 3.0 });
    assert.strictEqual(pts3(b.lock.price), 98.564);
    assert.ok(b.lock.disc > 0);
    assertBothBalanced(a);
    assertBothBalanced(b);
  });

  it('none mode: reports the gap instead of solving', () => {
    const r = run({ solve: 'none', msr: 1.25 });
    const L = r.lock;
    assert.ok(!L.solvedMsr && !L.solvedMargin && !L.solvedComp && !L.solvedPrice && !L.solvedSheet);
    assert.strictEqual(pts3(L.borrowerPts), -1.64);
    assert.strictEqual(pts3(L.gap), -0.376);
    assert.strictEqual(pts3(L.impliedMsr), 0.874);
    assertBothBalanced(r);
  });
});

describe('LLPAs from the Fannie matrix', () => {
  it('the example file is clean, so the default LLPA is zero and output is unchanged', () => {
    const r = run();
    assert.strictEqual(r.lock.llpaMode, 'matrix');
    assert.ok(r.lock.llpaCalc, 'matrix engine ran');
    assert.strictEqual(r.lock.llpa, 0);
    assert.strictEqual(r.lock.llpaCalc.breakdown.length, 0);
    near(r.lock.llpaCalc.grossLTV, 71.43, 0.01);
  });

  it('a 680 score at 95% LTV picks up the grid cell and shifts the borrower price by it', () => {
    const r = run({ creditScore: 680, propertyValue: 526316 });
    const direct = U.LLPA.calcLLPAs({ loanAmount: 500000, propertyValue: 526316, creditScore: 680, termYears: 30, purpose: 'Purchase', productType: 'Fixed', occupancy: 'Primary', units: '1' });
    assert.ok(direct.totalPoints > 0);
    assert.strictEqual(r.lock.llpa, direct.totalPoints);
    near(r.lock.llpaD, 500000 * direct.totalPoints / 100, 0.01);
    // In servicing-solve mode the sheet price is held, so the solved servicing value absorbs the LLPA.
    assert.strictEqual(pts3(r.lock.borrowerPts), -2.016);
    assert.strictEqual(pts3(r.lock.msrPts), pts3(0.874 + direct.totalPoints));
    assertBothBalanced(r);
  });

  it('manual mode uses the typed value and ignores the profile', () => {
    const r = run({ llpaMode: 'manual', llpa: 0.5, creditScore: 640, propertyValue: 526316 });
    assert.strictEqual(r.lock.llpaCalc, null);
    assert.strictEqual(r.lock.llpa, 0.5);
  });

  it('waivers zero the LLPA and engine warnings surface in the result', () => {
    const w = run({ creditScore: 680, propertyValue: 526316, waiverFirstTimeHB: true });
    assert.strictEqual(w.lock.llpa, 0);
    assert.ok(w.lock.llpaCalc.breakdown.some(b => /Waiver/.test(b.name)));
    const h = run({ purpose: 'LimitedCashOut', propertyValue: 450000, applyMMI: true, isHighLTVRefi: true });
    assert.ok(h.warnings.some(x => /High LTV/.test(x)));
  });
});

describe('credits, LLPAs and clamps', () => {
  it('a rich sheet at 7.75% produces a lender credit', () => {
    const r = run({ rate: 7.75, sheet: -1.5, coupon: 7.0, price: M.estPrice(7.0) });
    assert.strictEqual(pts3(r.lock.msrPts), 2.64);
    assert.strictEqual(pts3(r.lock.borrowerPts), 1.5);
    near(r.lock.crD, 7500, 0.5);
    assert.strictEqual(r.lock.bpD, 0);
    assertBothBalanced(r);
  });

  it('LLPAs are a cost the solved servicing value has to cover', () => {
    const r = run({ llpaMode: 'manual', llpa: 0.75 });
    near(r.lock.llpaD, 3750, 0.5);
    assert.strictEqual(pts3(r.lock.msrPts), 1.624);
    assert.strictEqual(pts3(r.lock.borrowerPts), -2.016);
    assertBothBalanced(r);
  });

  it('clamps an impossible coupon, Treasury and LO comp with warnings', () => {
    const r = run({ rate: 7.0, coupon: 6.5, tsy: 7.0, lo: 3.0 });
    assert.strictEqual(r.lock.coupon, 6.0);
    assert.ok(r.lock.tsy < r.lock.coupon);
    assert.strictEqual(r.lock.lo, r.lock.comp);
    assert.strictEqual(r.warnings.length, 3);
  });

  it('rescales MSFG shares that do not sum to 100 and keeps whole-dollar totals', () => {
    const r = run({ fixed: 40 });
    near(r.lock.shares.reduce((a, b) => a + b, 0), 100, 1e-9);
    assert.strictEqual(r.lock.splitShow.reduce((a, b) => a + b, 0), Math.round(r.lock.mkD));
    assert.ok(r.warnings.some(w => /110%/.test(w)));
    sameList(M.splitDollars(5625, [0.3, 0.5, 0.1, 0.1]), [1688, 2813, 562, 562]);
    sameList(M.splitDollars(1001, [0.5, 0.5]), [501, 500]);
  });
});

describe('loan programs', () => {
  it('program table: Fannie/Freddie fixed is 25 bp strip + fixed 45 bp g-fee with LLPAs; FHA, VA and USDA are Ginnie II 19 bp + fixed 6 bp with none', () => {
    const P = M.PROGRAMS;
    assert.deepStrictEqual(Object.keys(P), ['conv', 'fha', 'va', 'usda']);
    assert.strictEqual(P.conv.strip, 0.25); assert.strictEqual(P.conv.fee, 0.45); assert.strictEqual(P.conv.gov, false); assert.strictEqual(P.conv.llpa, true); assert.strictEqual(P.conv.agency, 'Fannie Mae');
    ['fha', 'va', 'usda'].forEach(k => { assert.strictEqual(P[k].strip, 0.19, k); assert.strictEqual(P[k].fee, 0.06, k); assert.strictEqual(P[k].gov, true, k); assert.strictEqual(P[k].llpa, false, k); assert.strictEqual(P[k].agency, 'Ginnie Mae', k); });
    assert.strictEqual(P.va.label, 'VA');
  });

  it('the default is conventional: strip 0.25, g-fee 0.45 and the same borrower price', () => {
    const r = run();
    assert.strictEqual(r.lock.program, 'conv');
    assert.strictEqual(r.lock.svc, 0.25); assert.strictEqual(r.lock.gfee, 0.45);
    near(r.after.borrowerPts, -2.016, 1e-9);
    assert.strictEqual(r.monthly.prog.agency, 'Fannie Mae');
  });

  it('the program overrides a typed strip or fee: FHA is 0.19 + 0.06 whatever was entered, and the floor drops to 0.25', () => {
    const r = run({ program: 'fha', svc: 0.5, gfee: 0.9 });
    assert.strictEqual(r.lock.svc, 0.19); assert.strictEqual(r.lock.gfee, 0.06); near(r.lock.floor, 0.25, 1e-9);
    // 7.25% into the 6.5 coupon leaves 0.50 of excess servicing above the 19 bp base.
    near(r.after.excess, 0.5, 1e-9); near(r.after.strip, 0.69, 1e-9);
    // The g-fee is fixed per program: a typed value is ignored.
    assert.strictEqual(run({ gfee: 0.6 }).lock.gfee, 0.45);
  });

  it('a Ginnie loan at 7.25% can carry a 7.0 coupon (auto) with no excess; at the FNMA-anchored estimate the sheet is then too rich for the margin', () => {
    assert.strictEqual(M.autoCoupon(7.25, 0.19, 0.06), 7);
    const r = run({ program: 'va', coupon: 7, price: M.estPrice(7) });
    assert.strictEqual(r.lock.coupon, 7); near(r.after.excess, 0, 1e-9);
    // 102.44 premium + 2.016 points is more than a 1.33 margin and 2.25 comp need, so servicing clamps at 0 and the margin is solved.
    assert.strictEqual(r.lock.msrPts, 0);
    assert.ok(r.warnings.some(w => w.includes("the wholesaler's margin is solved instead")), r.warnings.join(' | '));
  });

  it('government programs force LLPAs to zero even for a profile the matrix would price', () => {
    const risky = { creditScore: 680, propertyValue: 526316 };
    assert.ok(run(risky).lock.llpa > 1, 'conventional prices the 680 / 95% cell');
    const g = run(Object.assign({ program: 'usda' }, risky));
    assert.strictEqual(g.lock.llpa, 0); assert.strictEqual(g.lock.llpaCalc, null); assert.strictEqual(g.after.llpaD, 0);
    assert.strictEqual(run({ program: 'fha', llpaMode: 'manual', llpa: 0.75 }).lock.llpa, 0);
  });

  it('an unknown program falls back to conventional', () => {
    const r = run({ program: 'jumbo' });
    assert.strictEqual(r.lock.program, 'conv'); assert.strictEqual(r.lock.svc, 0.25);
  });
});

describe('government program fees', () => {
  it('VA funding fee tiers by use and down payment, and the exemption', () => {
    const fee = over => run(Object.assign({ program: 'va' }, over)).lock.upfrontPct;
    assert.strictEqual(fee({}), 1.25);                                            // 71.4% LTV: 10% or more down
    assert.strictEqual(fee({ propertyValue: 540000 }), 1.5);                      // 92.6%: 5–10% down
    assert.strictEqual(fee({ propertyValue: 520000 }), 2.15);                     // 96.2%: under 5% down
    assert.strictEqual(fee({ propertyValue: 520000, vaSubsequentUse: true }), 3.3);
    assert.strictEqual(fee({ propertyValue: 540000, vaSubsequentUse: true }), 1.5);
    assert.strictEqual(fee({ vaSubsequentUse: true }), 1.25);
    assert.strictEqual(fee({ propertyValue: 520000, vaExempt: true }), 0);
    assert.strictEqual(run({ program: 'va', propertyValue: 520000, vaExempt: true }).lock.upfrontWhy, 'exempt');
    assert.strictEqual(run({ program: 'va' }).lock.annualPct, 0);
    assert.strictEqual(run({ program: 'va' }).monthly.annualD, 0);
  });

  it('FHA: 1.75% upfront MIP financed takes the 500k loan to 508,750; annual MIP 0.50% at 71.4% LTV is $211.98 a month', () => {
    const r = run({ program: 'fha' });
    const L = r.lock;
    assert.strictEqual(L.base, 500000); near(L.upfrontD, 8750, 1e-6); assert.strictEqual(L.financed, true); near(L.P, 508750, 1e-6); assert.strictEqual(L.upCashD, 0);
    assert.strictEqual(L.annualPct, 0.5); near(r.monthly.annualD, 211.98, 0.005); near(r.monthly.total, r.monthly.pmt + 211.98, 0.005);
    near(r.after.compD, 508750 * 2.25 / 100, 1e-6, 'comp works on the funded loan');
    assert.strictEqual(run({ program: 'fha', propertyValue: 520000 }).lock.annualPct, 0.55);
    assert.strictEqual(run({ program: 'fha', loan: 800000, propertyValue: 1100000 }).lock.annualPct, 0.7);
    assert.strictEqual(run({ program: 'fha', loan: 800000, propertyValue: 820000 }).lock.annualPct, 0.75);
    assertBothBalanced(r);
  });

  it('an upfront fee paid in cash leaves the loan at the base amount and passes through the wholesaler', () => {
    const r = run({ program: 'usda', financeUpfront: false });
    const L = r.lock;
    assert.strictEqual(L.upfrontPct, 1); assert.strictEqual(L.annualPct, 0.35);
    assert.strictEqual(L.financed, false); assert.strictEqual(L.P, 500000); near(L.upCashD, 5000, 1e-6);
    near(r.after.uwmIn - run({ program: 'usda', financeUpfront: false, vaExempt: true }).after.uwmIn, 0, 1e-6);
    assertBothBalanced(r);
    near(run({ program: 'usda' }).monthly.annualD, 505000 * 0.35 / 100 / 12, 1e-6);
  });

  it('conventional loans have no program fee and P equals the base loan', () => {
    const r = run({ financeUpfront: true, vaSubsequentUse: true });
    assert.strictEqual(r.lock.upfrontPct, 0); assert.strictEqual(r.lock.upfrontD, 0); assert.strictEqual(r.lock.financed, false); assert.strictEqual(r.lock.P, 500000);
    assert.strictEqual(r.monthly.annualD, 0); assert.strictEqual(r.monthly.total, r.monthly.pmt);
  });

  it('conventional MI: none at 71.4% LTV, 0.30% borrower-paid above 80% LTV, editable, and the payment chart still balances', () => {
    assert.strictEqual(M.DEFAULTS.pmi, M.SOURCES.programs.pmi.annual); assert.strictEqual(M.DEFAULTS.pmi, 0.3);
    const none = run();
    assert.strictEqual(none.lock.annualPct, 0); assert.strictEqual(none.monthly.annualD, 0); assert.strictEqual(none.monthly.total, none.monthly.pmt);
    assert.strictEqual(runDefault().lock.annualPct, 0, 'the page as it opens has no MI');
    assert.strictEqual(run({ propertyValue: 625000 }).lock.annualPct, 0, 'exactly 80% LTV has no MI');
    const mi = run({ propertyValue: 526316 }); // 95% LTV
    near(mi.lock.ltv, 95, 0.01);
    assert.strictEqual(mi.lock.annualPct, 0.3); assert.strictEqual(mi.lock.upfrontPct, 0); assert.strictEqual(mi.lock.P, 500000);
    near(mi.monthly.annualD, 125, 1e-6);                      // 500,000 × 0.30% ÷ 12
    near(mi.monthly.total, mi.monthly.pmt + 125, 1e-6);
    // Everything the borrower pays lands somewhere: interest layers + principal + MI = total; insurer + servicer + agency + bond buyer = total.
    const m = mi.monthly;
    near(m.int + m.prin + m.annualD, m.total, 1e-6);
    near(m.bondIn + m.servicer + m.gfD + m.annualD, m.total, 0.005);
    assert.ok(mi.lock.llpa > 0, 'the 95% cell still prices LLPAs alongside MI');
    assertBothBalanced(mi);
    assert.strictEqual(run({ propertyValue: 526316, pmi: 0.55 }).lock.annualPct, 0.55);
    assert.strictEqual(run({ propertyValue: 526316, pmi: 0 }).lock.annualPct, 0);
    assert.strictEqual(run({ program: 'fha', propertyValue: 526316, pmi: 0.9 }).lock.annualPct, 0.5, 'government programs ignore the MI rate');
  });
});

describe('the page as it opens: margin solved at a 4× servicing mark', () => {
  it('defaults are margin mode with a 4× base multiple and a 2.5× excess multiple', () => {
    assert.strictEqual(M.DEFAULTS.solve, 'margin'); assert.strictEqual(M.DEFAULTS.msrMult, 4);
    assert.strictEqual(M.DEFAULTS.excessMult, M.SOURCES.excessMult); assert.strictEqual(M.DEFAULTS.excessMult, 2.5);
  });

  it('servicing is 4 × 0.25 + 2.5 × 0.05 = 1.125 pts and the margin solves to 1.581 pts with no warnings', () => {
    const r = runDefault();
    assert.strictEqual(r.lock.mode, 'margin'); assert.ok(r.lock.msrFromMult); assert.ok(r.lock.solvedMargin);
    near(r.lock.msrBasePts, 1.0, 1e-9); near(r.lock.msrExcessPts, 0.125, 1e-9); near(r.lock.msrPts, 1.125, 1e-9);
    near(r.lock.margin, 1.581, 1e-9);
    near(r.after.borrowerPts, -2.016, 1e-9); near(r.after.keep, 7905, 0.5);
    assert.strictEqual(r.warnings.length, 0);
    assertBothBalanced(r);
  });

  it('the 1.33 average stays as the comparison figure, not the default margin', () => {
    assert.strictEqual(M.AVG_MARGIN, 1.33);
    assert.strictEqual(M.DEFAULTS.margin, 1.33); // used only when the margin is typed in another solve mode
    near(runDefault({ solve: 'msr', msrMult: null }).lock.margin, 1.33, 1e-9);
  });
});

describe('servicing value from a multiple of the strip', () => {
  it('an empty multiple in servicing mode leaves the sheet solve untouched', () => {
    const r = run();
    assert.strictEqual(r.lock.msrFromMult, false); assert.strictEqual(r.lock.msrMult, null); assert.strictEqual(r.lock.mode, 'msr');
    near(r.lock.strip, 0.30, 1e-9);
  });

  it('4× on the default loan sets 1.125 pts of servicing (4 × 0.25 base + 2.5 × 0.05 excess) and solves the margin instead', () => {
    const r = run({ msrMult: 4 });
    near(r.lock.msrPts, 1.125, 1e-9);
    assert.strictEqual(r.lock.mode, 'margin'); assert.ok(r.lock.solvedMargin); assert.ok(!r.lock.solvedMsr);
    near(r.lock.margin, 0.69 + 1.125 - 2.25 + 2.016, 1e-9); // 1.581 pts
    near(r.after.borrowerPts, -2.016, 1e-9);
  });

  it('the excess strip carries its own multiple: 3.5× base + 2.5× excess on 7.00% into a 6.0 coupon is 1.625 pts', () => {
    const r = run({ rate: 7.0, sheet: 2.326, coupon: 6.0, price: M.estPrice(6.0), msrMult: 3.5 });
    near(r.lock.strip, 0.55, 1e-9); near(r.lock.excess, 0.30, 1e-9);
    near(r.lock.msrBasePts, 0.875, 1e-9); near(r.lock.msrExcessPts, 0.75, 1e-9); near(r.lock.msrPts, 1.625, 1e-9);
    assert.strictEqual(r.lock.mode, 'margin');
  });

  it('an eighth of rate that cannot reach the next coupon no longer doubles the servicing value: 7.25% → 7.50% adds 0.625 pt, not 1.0', () => {
    const a = runDefault(), b = runDefault({ rate: 7.5 });
    assert.strictEqual(b.lock.coupon, 6.5); near(b.lock.excess, 0.30, 1e-9);
    near(b.lock.msrPts - a.lock.msrPts, 2.5 * 0.25, 1e-9);           // 0.625 pt at 2.5×; it was 4 × 0.25 = 1.0 pt
    near(b.lock.msrPts, 1.75, 1e-9);
    near(runDefault({ rate: 7.5, excessMult: 0 }).lock.msrPts, 1.0, 1e-9, 'excess valued at 0× leaves the base 4 × 0.25');
    near(runDefault({ rate: 7.5, excessMult: 4 }).lock.msrPts, 2.2, 1e-9, 'excess at the base multiple reproduces the old blended 4 × 0.55');
    assert.strictEqual(runDefault({ excessMult: 'x' }).lock.excessMult, 2.5, 'a bad value falls back to the sourced multiple');
  });

  it('in another solve mode the multiples replace the typed mark', () => {
    const r = run({ solve: 'comp', msrMult: 5, msr: 0.1 });
    near(r.lock.msrPts, 1.375, 1e-9); assert.ok(r.lock.solvedComp); // 5 × 0.25 + 2.5 × 0.05
    near(r.lock.comp, 0.69 + 1.375 - 1.33 + 2.016, 1e-9); // 2.751 pts
  });
});

describe('optional wholesaler split', () => {
  it('is off by default and adds nothing to the output', () => {
    const r = run();
    assert.strictEqual(r.lock.wsplit, false);
    sameList(r.after.wsplitD, []);
    sameList(r.after.wsplitShow, []);
  });

  it('splits the $6,650 keep by the five shares into whole dollars that sum to the keep', () => {
    const r = run({ wsplit: true });
    near(r.after.keep, 6650, 0.01);
    sameList(r.lock.wshares, [30, 30, 5, 15, 20]);
    r.after.wsplitD.forEach((d, i) => near(d, 6650 * r.lock.wshares[i] / 100, 0.01, 'share ' + i));
    assert.strictEqual(Array.from(r.after.wsplitShow).reduce((a, b) => a + b, 0), 6650);
    r.after.wsplitShow.forEach(x => assert.strictEqual(x, Math.round(x)));
    assert.strictEqual(r.warnings.length, 0);
  });

  it('rescales shares that do not sum to 100, with a warning, only when the split is on', () => {
    const off = run({ wfixed: 10 });
    assert.strictEqual(off.warnings.length, 0);
    const on = run({ wsplit: true, wfixed: 10 }); // 10 + 30 + 5 + 15 + 20 = 80
    assert.ok(on.warnings.some(w => w.includes("wholesaler's five shares add up to 80%")), on.warnings.join(' | '));
    near(on.lock.wshares.reduce((a, b) => a + b, 0), 100, 1e-9);
    near(on.lock.wshares[0], 12.5, 1e-9);
  });

  it('a loss after lock leaves nothing to split', () => {
    const r = run({ wsplit: true, price2: 98.9 });
    assert.ok(r.after.margin < 0);
    assert.strictEqual(r.after.keep, 0);
    sameList(r.after.wsplitShow, [0, 0, 0, 0, 0]);
    assert.ok(r.lock.keep > 0, 'the lock state still has the keep');
  });
});

describe('after-lock market move: the margin absorbs it', () => {
  it('a 0.75-pt drop takes the margin from 1.33 to 0.58 and leaves the lock untouched', () => {
    const r = run({ price2: 99.94 });
    assert.ok(r.moved);
    assert.strictEqual(pts3(r.lock.margin), 1.33);
    assert.strictEqual(r.lock.price, 100.69);
    assert.strictEqual(pts3(r.after.margin), 0.58);
    assert.strictEqual(r.after.price, 99.94);
    near(r.after.keep, 2900, 0.5);
    assert.strictEqual(pts3(r.after.borrowerPts), -2.016, 'borrower price is locked');
    assert.strictEqual(pts3(r.after.msrPts), 0.874, 'servicing mark is held');
    assert.strictEqual(pts3(r.after.impliedMargin), 1.33, 'implied margin is measured at lock');
    assertBothBalanced(r);
  });

  it('a 1.79-pt drop turns into a loss the wholesaler funds', () => {
    const r = run({ price2: 98.9 });
    assert.strictEqual(pts3(r.after.margin), -0.46);
    assert.strictEqual(r.after.keep, 0);
    near(r.after.lossD, 2300, 0.5);
    near(r.after.uwmIn, 511250, 0.5);
    assert.strictEqual(r.lock.lossD, 0);
    assertBothBalanced(r);
  });

  it('a 0.81-pt rise lifts the margin to 2.14', () => {
    const r = run({ price2: 101.5 });
    assert.strictEqual(pts3(r.after.margin), 2.14);
    near(r.after.keep, 10700, 0.5);
    assertBothBalanced(r);
  });

  it('a coupon change after lock reprices and changes the excess strip', () => {
    const r = run({ rate: 7.75, sheet: 0, coupon: 7.0, price: M.estPrice(7.0), coupon2: 6.5, price2: M.estPrice(6.5), price2Est: true });
    assert.ok(r.moved);
    assert.strictEqual(r.after.coupon, 6.5);
    assert.strictEqual(pts3(r.after.excess), 0.55);
    assert.strictEqual(pts3(r.monthly.excess), 0.55);
    near(r.lock.excess, 0.05, 1e-9);
    assertBothBalanced(r);
  });

  it('an after-lock coupon that does not fit falls back with a warning and no move', () => {
    const r = run({ coupon2: 7.0, price2: M.estPrice(7.0), price2Est: true });
    assert.ok(!r.moved);
    assert.ok(r.warnings.some(w => /does not fit/.test(w)));
    assertAfterEqualsLock(r);
  });
});
