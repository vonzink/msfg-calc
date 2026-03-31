/**
 * Math unit tests for MSFG Calculator Suite
 *
 * Tests pure calculation functions used across calculators:
 * - Monthly payment (P&I)
 * - APR via bisection
 * - Present value
 * - DTI ratios
 * - Residual income
 * - FHA UFMIP calculations
 * - parseNum edge cases
 *
 * Uses Node's built-in test runner.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

/* =====================================================
   Replicated pure-math functions from client-side code
   (browser-only, so we extract for server-side testing)
   ===================================================== */

/** Monthly payment — from utils.js MSFG.calcMonthlyPayment */
function calcMonthlyPayment(principal, annualRate, years) {
  if (principal <= 0 || years <= 0) return 0;
  if (annualRate === 0) return principal / (years * 12);
  const r = annualRate / 12;
  const n = years * 12;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Present value — from apr.js / compare.js calcPV */
function calcPV(payment, annualRate, n) {
  if (payment <= 0 || n <= 0) return 0;
  if (annualRate === 0) return payment * n;
  const r = annualRate / 12;
  return payment * (1 - Math.pow(1 + r, -n)) / r;
}

/** APR via bisection — from apr.js / compare.js calcAPR */
function calcAPR(monthlyPmt, amtFinanced, n) {
  if (amtFinanced <= 0 || monthlyPmt <= 0 || n <= 0) return 0;
  if (monthlyPmt * n < amtFinanced) return 0;
  let lo = 0.0001, hi = 1, apr = 0;
  for (let i = 0; i < 100; i++) {
    apr = (lo + hi) / 2;
    const pv = calcPV(monthlyPmt, apr, n);
    if (Math.abs(pv - amtFinanced) < 1e-8) break;
    if (pv > amtFinanced) lo = apr; else hi = apr;
  }
  return apr;
}

/** parseNum — from utils.js MSFG.parseNum */
function parseNum(val) {
  if (typeof val === 'string') val = val.replace(/[,$]/g, '');
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

/** DTI ratio — replicates budget.js logic */
function calcDTI(obligations, qualifyingIncome) {
  return qualifyingIncome > 0 ? (obligations / qualifyingIncome * 100) : 0;
}

/** FHA UFMIP — replicates fha.js logic */
function calcUFMIP(baseLoan, ufmipRate) {
  return baseLoan * ufmipRate;
}

/** FHA total loan with financed UFMIP */
function calcFHATotalLoan(baseLoan, ufmipRate) {
  return baseLoan + calcUFMIP(baseLoan, ufmipRate);
}

/* =====================================================
   Tests
   ===================================================== */

describe('calcMonthlyPayment', () => {

  it('30-year at 6.5% on $300,000', () => {
    const pmt = calcMonthlyPayment(300000, 0.065, 30);
    assert.ok(Math.abs(pmt - 1896.20) < 0.01, `Expected ~$1,896.20, got $${pmt.toFixed(2)}`);
  });

  it('15-year at 5.5% on $250,000', () => {
    const pmt = calcMonthlyPayment(250000, 0.055, 15);
    assert.ok(Math.abs(pmt - 2042.71) < 0.01, `Expected ~$2,042.71, got $${pmt.toFixed(2)}`);
  });

  it('30-year at 7.0% on $400,000', () => {
    const pmt = calcMonthlyPayment(400000, 0.07, 30);
    assert.ok(Math.abs(pmt - 2661.21) < 0.01, `Expected ~$2,661.21, got $${pmt.toFixed(2)}`);
  });

  it('10-year at 7% on $200,000', () => {
    const pmt = calcMonthlyPayment(200000, 0.07, 10);
    assert.ok(Math.abs(pmt - 2322.17) < 0.01, `Expected ~$2,322.17, got $${pmt.toFixed(2)}`);
  });

  it('high rate: 12% on $100,000 for 30 years', () => {
    const pmt = calcMonthlyPayment(100000, 0.12, 30);
    assert.ok(Math.abs(pmt - 1028.61) < 0.01, `Expected ~$1,028.61, got $${pmt.toFixed(2)}`);
  });

  it('30-year at 0% (interest-free) on $120,000', () => {
    const pmt = calcMonthlyPayment(120000, 0, 30);
    assert.strictEqual(pmt, 120000 / 360);
  });

  it('returns 0 for zero principal', () => {
    assert.strictEqual(calcMonthlyPayment(0, 0.065, 30), 0);
  });

  it('returns 0 for negative principal', () => {
    assert.strictEqual(calcMonthlyPayment(-100000, 0.065, 30), 0);
  });

  it('returns 0 for zero years', () => {
    assert.strictEqual(calcMonthlyPayment(300000, 0.065, 0), 0);
  });

  it('very low rate: 0.1% on $500,000 for 30 years', () => {
    const pmt = calcMonthlyPayment(500000, 0.001, 30);
    // At near-zero rate, payment ≈ principal / months + tiny interest
    assert.ok(pmt > 500000 / 360, 'Payment should exceed zero-rate payment');
    assert.ok(pmt < 1500, 'Payment should be reasonable');
  });

  it('very short term: 1 year at 6% on $12,000', () => {
    const pmt = calcMonthlyPayment(12000, 0.06, 1);
    assert.ok(Math.abs(pmt - 1032.81) < 0.02, `Expected ~$1,032.81, got $${pmt.toFixed(2)}`);
  });
});

describe('calcPV (present value)', () => {

  it('PV of $1,000/mo at 6% for 360 months', () => {
    const pv = calcPV(1000, 0.06, 360);
    assert.ok(Math.abs(pv - 166791.61) < 1, `Expected ~$166,791.61, got $${pv.toFixed(2)}`);
  });

  it('PV at 0% is simply payment * n', () => {
    const pv = calcPV(500, 0, 120);
    assert.strictEqual(pv, 60000);
  });

  it('returns 0 for zero payment', () => {
    assert.strictEqual(calcPV(0, 0.06, 360), 0);
  });

  it('returns 0 for zero months', () => {
    assert.strictEqual(calcPV(1000, 0.06, 0), 0);
  });

  it('round-trips with calcMonthlyPayment', () => {
    // If we calculate payment for $300k at 6.5% for 30yr,
    // the PV of that payment stream at 6.5% for 360mo should be ~$300k
    const pmt = calcMonthlyPayment(300000, 0.065, 30);
    const pv = calcPV(pmt, 0.065, 360);
    assert.ok(Math.abs(pv - 300000) < 0.01, `PV should round-trip to $300,000, got $${pv.toFixed(2)}`);
  });
});

describe('calcAPR (bisection)', () => {

  it('APR equals note rate when no fees', () => {
    const pmt = calcMonthlyPayment(300000, 0.065, 30);
    const apr = calcAPR(pmt, 300000, 360);
    assert.ok(Math.abs(apr - 0.065) < 0.0001, `APR should equal 6.5% with no fees, got ${(apr * 100).toFixed(4)}%`);
  });

  it('APR > note rate when prepaid fees reduce amount financed', () => {
    const principal = 300000;
    const rate = 0.065;
    const pmt = calcMonthlyPayment(principal, rate, 30);
    const prepaidFees = 5000;
    const amtFinanced = principal - prepaidFees;
    const apr = calcAPR(pmt, amtFinanced, 360);
    assert.ok(apr > rate, `APR ${(apr * 100).toFixed(3)}% should exceed note rate ${(rate * 100).toFixed(3)}%`);
  });

  it('APR > note rate with discount points', () => {
    const loanAmount = 300000;
    const rate = 0.065;
    const points = 0.01; // 1 point
    const principal = loanAmount; // no financed fees
    const pmt = calcMonthlyPayment(principal, rate, 30);
    const amtFinanced = loanAmount - (loanAmount * points);
    const apr = calcAPR(pmt, amtFinanced, 360);
    assert.ok(apr > rate, `APR should exceed note rate with points`);
    assert.ok(apr < rate + 0.01, `APR spread should be modest with 1 point`);
  });

  it('APR with financed fees: higher principal, same amount financed', () => {
    const loanAmount = 300000;
    const financedFees = 3000;
    const rate = 0.065;
    const principal = loanAmount + financedFees;
    const pmt = calcMonthlyPayment(principal, rate, 30);
    const amtFinanced = loanAmount; // amount financed excludes financed fees
    const apr = calcAPR(pmt, amtFinanced, 360);
    assert.ok(apr > rate, `APR should exceed note rate with financed fees`);
  });

  it('returns 0 for zero amount financed', () => {
    assert.strictEqual(calcAPR(1000, 0, 360), 0);
  });

  it('returns 0 for zero payment', () => {
    assert.strictEqual(calcAPR(0, 300000, 360), 0);
  });

  it('returns 0 for zero months', () => {
    assert.strictEqual(calcAPR(1000, 300000, 0), 0);
  });

  it('returns 0 when total payments < amount financed', () => {
    // $100/mo for 12 months = $1,200 < $300,000
    assert.strictEqual(calcAPR(100, 300000, 12), 0);
  });
});

describe('DTI calculations', () => {

  it('front-end DTI: housing / qualifying income', () => {
    const housing = 2396.20; // P&I + taxes + insurance
    const income = 8000;
    const dti = calcDTI(housing, income);
    assert.ok(Math.abs(dti - 29.95) < 0.01, `Expected ~29.95%, got ${dti.toFixed(2)}%`);
  });

  it('back-end DTI: housing + debts / qualifying income', () => {
    const housing = 2000;
    const debts = 800;
    const income = 7500;
    const dti = calcDTI(housing + debts, income);
    assert.ok(Math.abs(dti - 37.33) < 0.01, `Expected ~37.33%, got ${dti.toFixed(2)}%`);
  });

  it('DTI returns 0 when income is 0', () => {
    assert.strictEqual(calcDTI(2000, 0), 0);
  });

  it('DTI can exceed 100%', () => {
    const dti = calcDTI(10000, 5000);
    assert.strictEqual(dti, 200);
  });

  it('DTI is 0 when obligations are 0', () => {
    assert.strictEqual(calcDTI(0, 8000), 0);
  });

  it('guideline thresholds: front-end 32%, back-end 47%', () => {
    // At exactly the guideline
    const frontAtGuideline = calcDTI(2560, 8000); // 32%
    assert.ok(Math.abs(frontAtGuideline - 32) < 0.01);

    const backAtGuideline = calcDTI(3760, 8000); // 47%
    assert.ok(Math.abs(backAtGuideline - 47) < 0.01);
  });

  it('limit thresholds: front-end 47%, back-end 55%', () => {
    const frontAtLimit = calcDTI(3760, 8000); // 47%
    assert.ok(Math.abs(frontAtLimit - 47) < 0.01);

    const backAtLimit = calcDTI(4400, 8000); // 55%
    assert.ok(Math.abs(backAtLimit - 55) < 0.01);
  });
});

describe('Budget: tax, savings, spendable income', () => {

  it('tax deduction from gross income', () => {
    const gross = 8000;
    const taxRate = 0.22;
    const taxAmount = gross * taxRate;
    const afterTax = gross - taxAmount;
    assert.strictEqual(taxAmount, 1760);
    assert.strictEqual(afterTax, 6240);
  });

  it('savings deduction from gross income', () => {
    const gross = 8000;
    const savingsRate = 0.10;
    const savingsAmount = gross * savingsRate;
    assert.strictEqual(savingsAmount, 800);
  });

  it('spendable income = gross - tax - savings', () => {
    const gross = 8000;
    const taxAmount = gross * 0.22;   // 1760
    const afterTax = gross - taxAmount; // 6240
    const savings = gross * 0.10;      // 800
    const spendable = afterTax - savings;
    assert.strictEqual(spendable, 5440);
  });

  it('net cash flow = spendable - all expenses', () => {
    const spendable = 5440;
    const housing = 2396.20;
    const debts = 0;
    const living = 0;
    const net = spendable - housing - debts - living;
    assert.ok(Math.abs(net - 3043.80) < 0.01, `Expected ~$3,043.80, got $${net.toFixed(2)}`);
  });

  it('zero tax/savings rates = spendable equals gross', () => {
    const gross = 10000;
    const spendable = gross - (gross * 0) - (gross * 0);
    assert.strictEqual(spendable, gross);
  });

  it('residual income = qualifying - housing - debts', () => {
    const qualifying = 8000;
    const housing = 2396.20;
    const debts = 500;
    const residual = qualifying - housing - debts;
    assert.ok(Math.abs(residual - 5103.80) < 0.01, `Expected ~$5,103.80, got $${residual.toFixed(2)}`);
  });
});

describe('FHA calculations', () => {

  it('UFMIP at 1.75% on $300,000 base loan', () => {
    const ufmip = calcUFMIP(300000, 0.0175);
    assert.ok(Math.abs(ufmip - 5250) < 0.01, `Expected $5,250, got $${ufmip.toFixed(2)}`);
  });

  it('total FHA loan with financed UFMIP', () => {
    const total = calcFHATotalLoan(300000, 0.0175);
    assert.strictEqual(total, 305250);
  });

  it('FHA payment on total loan amount', () => {
    const totalLoan = calcFHATotalLoan(300000, 0.0175); // 305,250
    const pmt = calcMonthlyPayment(totalLoan, 0.065, 30);
    assert.ok(Math.abs(pmt - 1929.38) < 0.10, `Expected ~$1,929.38, got $${pmt.toFixed(2)}`);
  });

  it('UFMIP is 0 on zero loan', () => {
    assert.strictEqual(calcUFMIP(0, 0.0175), 0);
  });

  it('FHA max loan = purchase price * LTV - down payment scenario', () => {
    const purchasePrice = 350000;
    const ltv = 0.965; // 96.5% FHA LTV
    const baseLoan = purchasePrice * ltv;
    assert.ok(Math.abs(baseLoan - 337750) < 0.01);
    const totalLoan = calcFHATotalLoan(baseLoan, 0.0175);
    assert.ok(Math.abs(totalLoan - 343660.63) < 0.01, `Expected ~$343,660.63, got $${totalLoan.toFixed(2)}`);
  });
});

describe('parseNum edge cases', () => {

  it('parses plain number', () => {
    assert.strictEqual(parseNum('1234'), 1234);
  });

  it('strips commas', () => {
    assert.strictEqual(parseNum('1,234,567'), 1234567);
  });

  it('strips dollar sign', () => {
    assert.strictEqual(parseNum('$300,000'), 300000);
  });

  it('handles decimals', () => {
    assert.strictEqual(parseNum('6.5'), 6.5);
  });

  it('handles currency with decimals', () => {
    assert.strictEqual(parseNum('$1,234.56'), 1234.56);
  });

  it('returns 0 for empty string', () => {
    assert.strictEqual(parseNum(''), 0);
  });

  it('returns 0 for non-numeric string', () => {
    assert.strictEqual(parseNum('abc'), 0);
  });

  it('returns 0 for undefined', () => {
    assert.strictEqual(parseNum(undefined), 0);
  });

  it('returns 0 for null', () => {
    assert.strictEqual(parseNum(null), 0);
  });

  it('passes through numeric types', () => {
    assert.strictEqual(parseNum(42), 42);
    assert.strictEqual(parseNum(3.14), 3.14);
  });

  it('handles negative values', () => {
    assert.strictEqual(parseNum('-500'), -500);
  });

  it('handles negative currency', () => {
    assert.strictEqual(parseNum('-$1,200.50'), -1200.50);
  });
});

describe('Amortization schedule math', () => {

  it('total interest over 30yr loan at 6.5% on $300k', () => {
    const pmt = calcMonthlyPayment(300000, 0.065, 30);
    const totalPaid = pmt * 360;
    const totalInterest = totalPaid - 300000;
    // Known: ~$382,633
    assert.ok(Math.abs(totalInterest - 382633) < 100, `Expected ~$382,633, got $${totalInterest.toFixed(0)}`);
  });

  it('first month interest and principal split', () => {
    const principal = 300000;
    const rate = 0.065;
    const pmt = calcMonthlyPayment(principal, rate, 30);
    const firstMonthInterest = principal * (rate / 12);
    const firstMonthPrincipal = pmt - firstMonthInterest;

    assert.ok(Math.abs(firstMonthInterest - 1625.00) < 0.01, `Interest: $${firstMonthInterest.toFixed(2)}`);
    assert.ok(Math.abs(firstMonthPrincipal - 271.20) < 0.01, `Principal: $${firstMonthPrincipal.toFixed(2)}`);
  });

  it('remaining balance after 12 payments', () => {
    let balance = 300000;
    const rate = 0.065;
    const monthlyRate = rate / 12;
    const pmt = calcMonthlyPayment(300000, rate, 30);

    for (let i = 0; i < 12; i++) {
      const interest = balance * monthlyRate;
      const princ = pmt - interest;
      balance -= princ;
    }

    // After 1 year, balance should be ~$296,647
    assert.ok(Math.abs(balance - 296647) < 50, `Expected ~$296,647, got $${balance.toFixed(0)}`);
  });

  it('loan fully amortizes to ~$0 at term end', () => {
    let balance = 300000;
    const rate = 0.065;
    const monthlyRate = rate / 12;
    const pmt = calcMonthlyPayment(300000, rate, 30);

    for (let i = 0; i < 360; i++) {
      const interest = balance * monthlyRate;
      const princ = pmt - interest;
      balance -= princ;
    }

    assert.ok(Math.abs(balance) < 0.01, `Balance should be ~$0 at end of term, got $${balance.toFixed(2)}`);
  });
});
