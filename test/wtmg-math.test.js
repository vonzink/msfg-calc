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
const run = over => M.compute(Object.assign({}, M.DEFAULTS, over));

function assertBalanced(fe, label) {
  const inflow = fe.proceeds + fe.bpD + fe.msr + fe.lossD;
  const outflow = fe.compD + fe.llpaD + fe.P + fe.crD + fe.keep;
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

  it('solves servicing value to 0.874 pts, 3.5× the strip', () => {
    assert.ok(L.solvedMsr);
    assert.strictEqual(pts3(L.msrPts), 0.874);
    near(L.msr, 4370, 0.5);
    near(L.mult, 3.5, 0.01);
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
    assert.strictEqual(m.excess, 0);
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

  it('solves servicing to 2.314 pts on a 0.50% strip (0.25 excess)', () => {
    assert.strictEqual(pts3(L.msrPts), 2.314);
    assert.strictEqual(pts3(L.excess), 0.25);
    assert.strictEqual(pts3(r.monthly.excess), 0.25);
    near(L.mult, 4.6, 0.05);
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
  it('program table: Fannie/Freddie fixed is 25 bp strip + editable 50 bp g-fee with LLPAs; FHA, VA and USDA are Ginnie II 19 bp + fixed 6 bp with none', () => {
    const P = M.PROGRAMS;
    assert.deepStrictEqual(Object.keys(P), ['conv', 'fha', 'va', 'usda']);
    assert.strictEqual(P.conv.strip, 0.25); assert.strictEqual(P.conv.fee, 0.5); assert.strictEqual(P.conv.feeFixed, false); assert.strictEqual(P.conv.llpa, true); assert.strictEqual(P.conv.agency, 'Fannie Mae');
    ['fha', 'va', 'usda'].forEach(k => { assert.strictEqual(P[k].strip, 0.19, k); assert.strictEqual(P[k].fee, 0.06, k); assert.strictEqual(P[k].feeFixed, true, k); assert.strictEqual(P[k].llpa, false, k); assert.strictEqual(P[k].agency, 'Ginnie Mae', k); });
    assert.strictEqual(P.va.label, 'VA');
  });

  it('the default is conventional: strip 0.25, g-fee 0.50 and unchanged output', () => {
    const r = run();
    assert.strictEqual(r.lock.program, 'conv');
    assert.strictEqual(r.lock.svc, 0.25); assert.strictEqual(r.lock.gfee, 0.5);
    near(r.after.borrowerPts, -2.016, 1e-9);
    assert.strictEqual(r.monthly.prog.agency, 'Fannie Mae');
  });

  it('the program overrides a typed strip or fee: FHA is 0.19 + 0.06 whatever was entered, and the floor drops to 0.25', () => {
    const r = run({ program: 'fha', svc: 0.5, gfee: 0.9 });
    assert.strictEqual(r.lock.svc, 0.19); assert.strictEqual(r.lock.gfee, 0.06); near(r.lock.floor, 0.25, 1e-9);
    // 7.25% into the 6.5 coupon leaves 0.50 of excess servicing above the 19 bp base.
    near(r.after.excess, 0.5, 1e-9); near(r.after.strip, 0.69, 1e-9);
    // A conventional g-fee edit still works.
    assert.strictEqual(run({ gfee: 0.6 }).lock.gfee, 0.6);
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
    assert.strictEqual(pts3(r.after.excess), 0.5);
    assert.strictEqual(pts3(r.monthly.excess), 0.5);
    assert.strictEqual(r.lock.excess, 0);
    assertBothBalanced(r);
  });

  it('an after-lock coupon that does not fit falls back with a warning and no move', () => {
    const r = run({ coupon2: 7.0, price2: M.estPrice(7.0), price2Est: true });
    assert.ok(!r.moved);
    assert.ok(r.warnings.some(w => /does not fit/.test(w)));
    assertAfterEqualsLock(r);
  });
});
