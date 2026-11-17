/**
 * Unit tests for the REO Investment ROI projection model (legacy/calc-reo/reo-math.js).
 *
 * The base scenario was worked by hand:
 *   $200,000 purchase, 25% down, 6% / 30-year P&I, $5,000 closing costs, $20,000 renovation,
 *   renovated value $240,000, 6% selling costs, $2,000 rent, 5% vacancy,
 *   $100 insurance + $100 maintenance + 1.2% property tax ($200/mo),
 *   3% appreciation, 2% rent and expense growth, 80% building share, 24% bracket, 27.5 years.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const M = require('../legacy/calc-reo/reo-math.js');

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg || ''} expected ${expected} ± ${tol}, got ${actual}`);

const BASE = {
  purchasePrice: 200000, downPct: 0.25, rate: 0.06, termYears: 30, amortType: 'pi', acqCosts: 5000,
  renoTotal: 20000, renoMonths: 0, renoValue: 240000, sellCostPct: 0.06,
  grossRents: 2000, vacancy: 0.05, carryMonthly: 100, operatingMonthly: 100, propTaxRate: 0.012,
  appreciation: 0.03, rentIncrease: 0.02, expIncrease: 0.02,
  improvePct: 0.8, taxBracket: 0.24, deprYears: 27.5
};
const run = (over) => M.project(Object.assign({}, BASE, over));

describe('REO projection: base scenario, year 1', () => {
  const r = run();

  it('counts down payment, closing costs and renovation as cash invested', () => {
    near(r.cashInvested, 75000, 0.01);
    near(r.loanAmount, 150000, 0.01);
  });

  it('computes NOI and debt service', () => {
    near(r.noiMonthly, 1500, 0.01);
    near(r.noi[0], 18000, 0.01);
    near(r.monthlyPayment, 899.33, 0.01);
    near(r.debtService[0], 10791.91, 0.05);
    near(r.interest[0], 8949.89, 0.05);
    near(r.loanBalance[0], 148157.98, 0.05);
  });

  it('cash flow before taxes is NOI less debt service', () => {
    near(r.cashFlow[0], 7208.09, 0.05);
    near(r.cashOnCash[0], 7208.09 / 75000, 1e-6);
  });

  it('after-tax cash flow subtracts tax on NOI less interest less depreciation', () => {
    near(r.annualDepreciation, 184000 / 27.5, 0.01);
    near(r.taxableIncome[0], 2359.20, 0.05);
    near(r.incomeTax[0], 566.21, 0.05);
    near(r.afterTaxCashFlow[0], 6641.88, 0.05);
    assert.ok(r.afterTaxCashFlow[0] < r.cashFlow[0], 'a taxable profit lowers cash flow');
  });

  it('net equity is sale value less selling costs less the loan balance', () => {
    near(r.propValue[0], 247200, 0.01);
    near(r.netEquity[0], 84210.02, 0.05);
  });

  it('cumulative after-tax return is cash flows plus net equity less cash invested', () => {
    near(r.cumulativeReturn[0], 15851.90, 0.1);
    near(r.roi[0], 15851.90 / 75000, 1e-5);
  });
});

describe('REO projection: identities across all five years', () => {
  const r = run();

  it('accumulates after-tax cash flow and ties the return to its parts', () => {
    let cum = 0;
    for (let i = 0; i < 5; i++) {
      cum += r.afterTaxCashFlow[i];
      near(r.cumAfterTaxCashFlow[i], cum, 0.01);
      near(r.cumulativeReturn[i], cum + r.netEquity[i] - r.cashInvested, 0.01);
      near(r.debtService[i], r.interest[i] + r.principalPaid[i], 0.01);
      near(r.cashFlow[i], r.noi[i] - r.debtService[i], 0.01);
    }
  });

  it('loan balance falls by the principal paid', () => {
    near(r.loanAmount - r.loanBalance[4], r.principalPaid.reduce((a, b) => a + b, 0), 0.01);
  });

  it('cap rate is a fully rented year of NOI over that year\'s property value', () => {
    const r = run();
    near(r.capRate[0], 18000 / 247200, 1e-9);
    near(r.capRate[1], (22800 * 1.02 - 4800 * 1.02) / (240000 * 1.03 * 1.03), 1e-9);
    // Renovation months cut year-1 NOI but not the cap rate.
    near(run({ renoMonths: 3 }).capRate[0], r.capRate[0], 1e-9);
    // Rising value with flat rents lowers the cap rate over time.
    const flat = run({ rentIncrease: 0, expIncrease: 0 });
    assert.ok(flat.capRate[4] < flat.capRate[0]);
  });

  it('grows rent and expenses from year 2', () => {
    near(r.grossIncome[1], 22800 * 1.02, 0.01);
    near(r.expenses[2], 4800 * 1.02 * 1.02, 0.01);
  });
});

describe('REO projection: other cases', () => {
  it('a tax loss raises after-tax cash flow by the tax saved', () => {
    const r = run({ grossRents: 1200 });
    assert.ok(r.taxableIncome[0] < 0);
    near(r.afterTaxCashFlow[0], r.cashFlow[0] - r.taxableIncome[0] * 0.24, 0.01);
    assert.ok(r.afterTaxCashFlow[0] > r.cashFlow[0]);
  });

  it('zero tax bracket leaves cash flow unchanged', () => {
    const r = run({ taxBracket: 0 });
    near(r.afterTaxCashFlow[0], r.cashFlow[0], 1e-9);
  });

  it('renovation months cut year-1 rent but taxes and insurance still accrue', () => {
    const r = run({ renoMonths: 3 });
    near(r.grossIncome[0], 1900 * 9, 0.01);
    near(r.expenses[0], 300 * 12 + 100 * 9, 0.01);
    near(r.grossIncome[1], 22800 * 1.02, 0.01);
  });

  it('interest-only keeps the balance flat', () => {
    const r = run({ amortType: 'io' });
    near(r.debtService[0], 9000, 0.01);
    near(r.loanBalance[4], 150000, 0.01);
    near(r.netEquity[0], 247200 * 0.94 - 150000, 0.01);
  });

  it('all cash has no debt and invests the full price', () => {
    const r = run({ amortType: 'cash' });
    near(r.cashInvested, 225000, 0.01);
    near(r.cashFlow[0], 18000, 0.01);
    assert.ok(Number.isNaN(r.dcr[0]));
    near(r.netEquity[0], 247200 * 0.94, 0.01);
  });

  it('empty inputs produce zeros, not NaN or Infinity', () => {
    const r = M.project({});
    for (const key of ['cashFlow', 'afterTaxCashFlow', 'netEquity', 'cumulativeReturn', 'roi']) {
      for (const v of r[key]) assert.strictEqual(v, 0, key);
    }
  });
});
