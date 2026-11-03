'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual browser math and utility code, not a duplicate test formula.
const context = vm.createContext({ window: {}, document: { addEventListener() {} }, Intl, console });
for (const file of ['shared/utils.js', 'shared/amortization-math.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', file), 'utf8'), context);
}
const math = vm.runInContext('MSFG.AmortizationMath', context);
const fixture = changes => Object.assign({
  mode: 'purchase', program: 'conventional', homePrice: 250000, downPayment: 50000,
  refiLoanAmount: 200000, cashOut: 0, appraisedValue: 250000,
  annualRate: 0.075, termYears: 30, startMonth: 11, startYear: 2026,
  monthlyTax: 2500 / 12, monthlyIns: 125, monthlyHOA: 100, monthlyPMI: 0,
  extraAmount: 0, extraFreq: 'monthly', extraStartMonth: 11, extraStartYear: 2026,
  vaUse: 'first', vaExempt: false, vaRefiType: 'cash-out'
}, changes);
const near = (actual, expected, tolerance = 0.005) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should equal ${expected}`);
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);

describe('Amortization: actual payment engine', () => {
  it('matches the reference example payment and expense breakdown', () => {
    const result = math.calculate(fixture());
    assert.equal(result.loan.principal, 200000);
    assert.equal(result.monthlyPI, 1398.43);
    assert.equal(result.schedule[0].principal, 148.43);
    assert.equal(result.schedule[0].interest, 1250);
    assert.equal(result.schedule[0].totalMonthly, 1831.76);
    assert.equal(result.schedule[0].balance, 199851.57);
    assert.equal(result.schedule.length, 360);
    assert.equal(result.schedule[359].balance, 0);
    near(sum(result.schedule, 'principal'), 200000);
  });
  it('handles zero interest and year rollover without NaN or residual balance', () => {
    const result = math.calculate(fixture({ annualRate: 0, termYears: 10 }));
    assert.equal(result.totalInterest, 0);
    assert.equal(result.schedule.length, 120);
    assert.equal(result.schedule[1].date, 'Jan 2027');
    assert.equal(result.schedule[119].date, 'Nov 2036');
    assert.equal(result.schedule[119].balance, 0);
    near(sum(result.schedule, 'principal'), 200000);
  });
  it('monthly extra payments reduce term and interest, and reconcile all cash flows', () => {
    const result = math.calculate(fixture({ extraAmount: 250 }));
    assert.ok(result.monthsSaved > 0);
    assert.ok(result.interestSaved > 0);
    near(sum(result.schedule, 'principal') + result.totalExtra, result.loan.principal);
    near(sum(result.schedule, 'payment'), result.loan.principal + result.totalInterest);
    near(sum(result.schedule, 'totalMonthly'), result.totalCost);
    result.schedule.forEach(row => {
      near(row.totalMonthly, row.principal + row.interest + row.extra + row.monthlyTax + row.monthlyIns + row.monthlyHOA + row.pmiThisMonth);
      assert.ok(row.balance >= 0);
    });
  });
  it('caps a huge extra payment at the remaining balance', () => {
    const result = math.calculate(fixture({ extraAmount: 1000000 }));
    assert.equal(result.schedule.length, 1);
    assert.equal(result.schedule[0].extra, 199851.57);
    assert.equal(result.schedule[0].totalMonthly, 201683.33);
    assert.equal(result.schedule[0].balance, 0);
  });
  it('applies annual extras only on the selected anniversary, across year boundaries', () => {
    const result = math.calculate(fixture({ extraAmount: 1000, extraFreq: 'annually', extraStartYear: 2027, extraStartMonth: 1 }));
    const extras = result.schedule.filter(row => row.extra > 0);
    assert.equal(extras[0].paymentNum, 3);
    assert.equal(extras[1].paymentNum, 15);
    assert.ok(extras.every(row => row.month === 1));
  });
  it('applies a one-time extra once and ignores payments after payoff', () => {
    const once = math.calculate(fixture({ extraAmount: 5000, extraFreq: 'one-time', extraStartYear: 2027, extraStartMonth: 0 }));
    assert.equal(once.totalExtra, 5000);
    assert.equal(once.schedule[1].extra, 5000);
    const late = math.calculate(fixture({ extraAmount: 5000, extraFreq: 'one-time', extraStartYear: 2060 }));
    assert.equal(late.totalExtra, 0);
    assert.equal(late.interestSaved, 0);
  });
  it('uses the refinance principal and actually finances requested cash out', () => {
    const result = math.calculate(fixture({ mode: 'refinance', refiLoanAmount: 150000, cashOut: 25000, appraisedValue: 300000 }));
    assert.equal(result.loan.principal, 175000);
    near(result.loan.ltv, 175000 / 300000 * 100);
  });
  it('stops PMI on the original scheduled cancellation date, not the accelerated balance', () => {
    const options = fixture({ downPayment: 25000, monthlyPMI: 100, extraAmount: 300 });
    const result = math.calculate(options);
    const crossedEarly = result.schedule.find(row => row.balance < 250000 * 0.78);
    assert.ok(crossedEarly.paymentNum < result.pmiEnd);
    assert.equal(crossedEarly.pmiThisMonth, 100);
    assert.equal(result.schedule[result.pmiEnd - 2].pmiThisMonth, 100);
    assert.equal(result.schedule[result.pmiEnd - 1].pmiThisMonth, 0);
  });
  it('cancels PMI after the midpoint even with a slowly amortizing loan', () => {
    const result = math.calculate(fixture({ downPayment: 0, annualRate: 0.2, monthlyPMI: 100 }));
    assert.equal(result.pmiEnd, 181);
    assert.equal(result.schedule[179].pmiThisMonth, 100);
    assert.equal(result.schedule[180].pmiThisMonth, 0);
  });
  it('does not charge conventional PMI at 80% starting LTV', () => {
    assert.equal(math.calculate(fixture({ monthlyPMI: 100 })).schedule[0].pmiThisMonth, 0);
  });
  it('FHA finances UFMIP and uses base-loan LTV for the 11-year MIP cutoff', () => {
    const result = math.calculate(fixture({ program: 'fha', downPayment: 25000 }));
    assert.equal(result.loan.principal, 228937.5);
    assert.equal(result.loan.upfrontFee, 3937.5);
    assert.equal(result.loan.ltv, 90);
    assert.equal(result.loan.mip.months, 132);
    assert.ok(result.schedule[131].pmiThisMonth > 0);
    assert.equal(result.schedule[132].pmiThisMonth, 0);
    assert.ok(result.schedule[12].pmiThisMonth < result.schedule[0].pmiThisMonth);
  });
  it('FHA above 90% retains MIP despite extra payments reducing the balance', () => {
    const result = math.calculate(fixture({ program: 'fha', downPayment: 8750, extraAmount: 250 }));
    assert.equal(result.loan.mip.rate, 0.0055);
    assert.equal(result.loan.mip.months, 360);
    assert.ok(result.schedule[result.schedule.length - 1].pmiThisMonth > 0);
    const base = math.calculate(fixture({ program: 'fha', downPayment: 8750 }));
    assert.equal(result.schedule[120].pmiThisMonth, base.schedule[120].pmiThisMonth);
  });
  it('FHA selects the short-term and high-balance premium bands', () => {
    near(math.fhaPremium(726200, 90, 15).rate, 0.0015);
    near(math.fhaPremium(726200, 95, 15).rate, 0.004);
    near(math.fhaPremium(726201, 78, 15).rate, 0.0015);
    near(math.fhaPremium(726201, 90, 15).rate, 0.004);
    near(math.fhaPremium(726201, 91, 15).rate, 0.0065);
    near(math.fhaPremium(726201, 96.5, 30).rate, 0.0075);
  });
  it('VA fee tiers, repeat use, and exemption use the current rate chart', () => {
    const va = fixture({ program: 'va', downPayment: 0 });
    assert.equal(math.calculate(va).loan.upfrontFee, 5375);
    assert.equal(math.calculate(Object.assign({}, va, { vaUse: 'subsequent' })).loan.upfrontFee, 8250);
    assert.equal(math.calculate(Object.assign({}, va, { downPayment: 12500 })).loan.upfrontFee, 3562.5);
    assert.equal(math.calculate(Object.assign({}, va, { downPayment: 25000 })).loan.upfrontFee, 2812.5);
    const exempt = math.calculate(Object.assign({}, va, { vaExempt: true }));
    assert.equal(exempt.loan.upfrontFee, 0);
    assert.equal(exempt.schedule[0].pmiThisMonth, 0);
  });
  it('VA refinance fees do not use purchase down-payment discounts', () => {
    const va = fixture({ program: 'va', mode: 'refinance' });
    assert.equal(math.calculate(va).loan.upfrontFee, 4300);
    assert.equal(math.calculate(Object.assign({}, va, { vaUse: 'subsequent' })).loan.upfrontFee, 6600);
    assert.equal(math.calculate(Object.assign({}, va, { vaRefiType: 'irrrl' })).loan.upfrontFee, 1000);
  });
  it('rejects invalid loan principal, rate, and term', () => {
    for (const changes of [{ homePrice: 0 }, { annualRate: -1 }, { annualRate: NaN }, { termYears: 0 }, { termYears: 1000 }, { downPayment: 250000 }]) {
      assert.equal(math.calculate(fixture(changes)), null);
    }
  });
});
