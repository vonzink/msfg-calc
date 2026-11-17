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

// The module attaches itself to globalThis.MSFG when there is no window.
require('../public/js/shared/where-the-money-goes-math.js');
const M = globalThis.MSFG.WtmgMath;

const near = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) <= tol, `${msg || ''} expected ${expected} ± ${tol}, got ${actual}`);
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
    assert.deepStrictEqual(L.splitShow, [1688, 2813, 562, 562]);
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
    assert.deepStrictEqual(r.warnings, []);
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
    const r = run({ llpa: 0.75 });
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
    assert.deepStrictEqual(M.splitDollars(5625, [0.3, 0.5, 0.1, 0.1]), [1688, 2813, 562, 562]);
    assert.deepStrictEqual(M.splitDollars(1001, [0.5, 0.5]), [501, 500]);
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
