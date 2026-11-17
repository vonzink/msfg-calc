/**
 * Unit tests for the Where the Money Goes pricing model (MSFG.WtmgMath).
 *
 * The scenarios pin numbers that were verified by hand against the UWM rate sheet
 * (7.25% row: base −0.234, borrower pays 2.016 after 2.25 lender-paid comp) and
 * against the page on Nov 17, 2026. The balance identity (everything flowing into
 * the wholesaler equals everything flowing out) must hold in every mode.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

// The module attaches itself to globalThis.MSFG when there is no window.
require('../public/js/shared/where-the-money-goes-math.js');
const M = globalThis.MSFG.WtmgMath;

const near = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) <= tol, `${msg || ''} expected ${expected} ± ${tol}, got ${actual}`);
const pts3 = x => Math.round(x * 1000) / 1000;
const inputs = over => Object.assign({}, M.DEFAULTS, over);

function assertBalanced(m) {
  const inflow = m.proceeds + m.bpD + m.msr + m.lossD;
  const outflow = m.compD + m.llpaD + m.P + m.crD + m.keep;
  near(inflow, outflow, 0.01, 'wholesaler inflow vs outflow');
}

describe('defaults match the UWM sheet at 7.25%', () => {
  const m = M.compute(inputs());

  it('borrower pays 2.016 pts = $10,080', () => {
    assert.strictEqual(pts3(m.borrowerPts), -2.016);
    near(m.bpD, 10080, 0.5);
    assert.strictEqual(m.crD, 0);
  });

  it('solves servicing value to 0.874 pts, 3.5× the strip', () => {
    assert.ok(m.solvedMsr);
    assert.strictEqual(pts3(m.msrPts), 0.874);
    near(m.msr, 4370, 0.5);
    near(m.mult, 3.5, 0.01);
  });

  it('wholesaler takes in $517,900 and keeps its 1.33-pt margin', () => {
    near(m.uwmIn, 517900, 0.5);
    near(m.keep, 6650, 0.5);
    assert.strictEqual(m.lossD, 0);
    assertBalanced(m);
  });

  it('MSFG split is whole dollars that sum to the $5,625 kept', () => {
    assert.deepStrictEqual(m.splitShow, [1688, 2813, 562, 562]);
    assert.strictEqual(m.splitShow.reduce((a, b) => a + b, 0), 5625);
    near(m.mkD, 5625, 0.01);
  });

  it('monthly payment and interest split are right for month 1', () => {
    near(m.pmt, 3410.88, 0.005);
    near(m.int, 3020.83, 0.005);
    near(m.gfD + m.svD + m.trD + m.rrD + m.rfD + m.exD, m.int, 0.005, 'interest layers sum to interest');
    near(m.bondIn, 3098.38, 0.01);
    assert.strictEqual(m.excess, 0);
  });

  it('reports no gap and no warnings', () => {
    near(m.gap, 0, 1e-9);
    assert.deepStrictEqual(m.warnings, []);
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
  const m = M.compute(inputs({ rate: 7.0, sheet: 2.326, coupon: 6.0, price: M.estPrice(6.0) }));

  it('solves servicing to 2.314 pts on a 0.50% strip (0.25 excess)', () => {
    assert.strictEqual(pts3(m.msrPts), 2.314);
    assert.strictEqual(pts3(m.excess), 0.25);
    near(m.mult, 4.6, 0.05);
  });

  it('draws the below-par coupon as a discount and still balances', () => {
    near(m.disc, 5300, 0.5);
    near(m.proceeds, 494700, 0.5);
    near(m.bpD, 11630, 0.5);
    assertBalanced(m);
  });
});

describe('each solve mode inverts the identity', () => {
  it('sheet mode: borrower price falls out of the other four (par at a 2.89 mark)', () => {
    const m = M.compute(inputs({ solve: 'sheet', msr: 2.89 }));
    assert.ok(m.solvedSheet);
    assert.strictEqual(m.borrowerPts, 0);
    assert.strictEqual(m.bpD, 0);
    assert.strictEqual(m.crD, 0);
    assertBalanced(m);
  });

  it('margin mode: 0.874 servicing gives back the 1.33 margin; 0.5 gives 0.956', () => {
    const a = M.compute(inputs({ solve: 'margin', msr: 0.874 }));
    assert.ok(a.solvedMargin);
    assert.strictEqual(pts3(a.margin), 1.33);
    const b = M.compute(inputs({ solve: 'margin', msr: 0.5 }));
    assert.strictEqual(pts3(b.margin), 0.956);
    assertBalanced(b);
  });

  it('comp mode: a 1.0 servicing mark supports 2.376 pts of comp', () => {
    const m = M.compute(inputs({ solve: 'comp', msr: 1.0 }));
    assert.ok(m.solvedComp);
    assert.strictEqual(pts3(m.comp), 2.376);
    near(m.compD, 11880, 0.5);
    assertBalanced(m);
  });

  it('price mode: 1.25 servicing needs 100.314; 3.0 servicing needs a 98.564 discount', () => {
    const a = M.compute(inputs({ solve: 'price', msr: 1.25 }));
    assert.ok(a.solvedPrice);
    assert.strictEqual(pts3(a.price), 100.314);
    assert.strictEqual(a.disc, 0);
    const b = M.compute(inputs({ solve: 'price', msr: 3.0 }));
    assert.strictEqual(pts3(b.price), 98.564);
    assert.ok(b.disc > 0);
    assertBalanced(a);
    assertBalanced(b);
  });

  it('none mode: reports the gap instead of solving', () => {
    const m = M.compute(inputs({ solve: 'none', msr: 1.25 }));
    assert.ok(!m.solvedMsr && !m.solvedMargin && !m.solvedComp && !m.solvedPrice && !m.solvedSheet);
    assert.strictEqual(pts3(m.borrowerPts), -1.64);
    assert.strictEqual(pts3(m.gap), -0.376);
    assert.strictEqual(pts3(m.impliedMsr), 0.874);
    assertBalanced(m);
  });
});

describe('credits, LLPAs and clamps', () => {
  it('a rich sheet at 7.75% produces a lender credit', () => {
    const m = M.compute(inputs({ rate: 7.75, sheet: -1.5, coupon: 7.0, price: M.estPrice(7.0) }));
    assert.strictEqual(pts3(m.msrPts), 2.64);
    assert.strictEqual(pts3(m.borrowerPts), 1.5);
    near(m.crD, 7500, 0.5);
    assert.strictEqual(m.bpD, 0);
    assertBalanced(m);
  });

  it('LLPAs are a cost the solved servicing value has to cover', () => {
    const m = M.compute(inputs({ llpa: 0.75 }));
    near(m.llpaD, 3750, 0.5);
    assert.strictEqual(pts3(m.msrPts), 1.624);
    assert.strictEqual(pts3(m.borrowerPts), -2.016);
    assertBalanced(m);
  });

  it('clamps an impossible coupon, Treasury and LO comp with warnings', () => {
    const m = M.compute(inputs({ rate: 7.0, coupon: 6.5, tsy: 7.0, lo: 3.0 }));
    assert.strictEqual(m.coupon, 6.0);
    assert.ok(m.tsy < m.coupon);
    assert.strictEqual(m.lo, m.comp);
    assert.strictEqual(m.warnings.length, 3);
  });

  it('rescales MSFG shares that do not sum to 100 and keeps whole-dollar totals', () => {
    const m = M.compute(inputs({ fixed: 40 }));
    near(m.shares.reduce((a, b) => a + b, 0), 100, 1e-9);
    assert.strictEqual(m.splitShow.reduce((a, b) => a + b, 0), Math.round(m.mkD));
    assert.ok(m.warnings.some(w => /110%/.test(w)));
    assert.deepStrictEqual(M.splitDollars(5625, [0.3, 0.5, 0.1, 0.1]), [1688, 2813, 562, 562]);
    assert.deepStrictEqual(M.splitDollars(1001, [0.5, 0.5]), [501, 500]);
  });
});

describe('after-lock market move: the margin absorbs it', () => {
  it('a 0.75-pt drop takes the margin from 1.33 to 0.58', () => {
    const m = M.compute(inputs({ price2: 99.94 }));
    assert.ok(m.moved);
    assert.strictEqual(pts3(m.lockMargin), 1.33);
    assert.strictEqual(pts3(m.margin), 0.58);
    near(m.keep, 2900, 0.5);
    assert.strictEqual(pts3(m.borrowerPts), -2.016, 'borrower price is locked');
    assert.strictEqual(pts3(m.msrPts), 0.874, 'servicing mark is held');
    assertBalanced(m);
  });

  it('a 1.79-pt drop turns into a loss the wholesaler funds', () => {
    const m = M.compute(inputs({ price2: 98.9 }));
    assert.strictEqual(pts3(m.margin), -0.46);
    assert.strictEqual(m.keep, 0);
    near(m.lossD, 2300, 0.5);
    near(m.uwmIn, 511250, 0.5);
    assertBalanced(m);
  });

  it('a 0.81-pt rise lifts the margin to 2.14', () => {
    const m = M.compute(inputs({ price2: 101.5 }));
    assert.strictEqual(pts3(m.margin), 2.14);
    near(m.keep, 10700, 0.5);
    assertBalanced(m);
  });

  it('an after-lock coupon that does not fit falls back with a warning and no move', () => {
    const m = M.compute(inputs({ coupon2: 7.0, price2: M.estPrice(7.0), price2Est: true }));
    assert.ok(!m.moved);
    assert.ok(m.warnings.some(w => /does not fit/.test(w)));
  });

  it('lock values describe layer one even after a move', () => {
    const m = M.compute(inputs({ price2: 99.94 }));
    assert.strictEqual(m.lockPrice, 100.69);
    assert.strictEqual(pts3(m.lockPremPts), 0.69);
    assert.strictEqual(pts3(m.impliedMargin), 1.33, 'implied margin is measured at lock');
  });
});
