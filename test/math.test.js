/**
 * Math unit tests for MSFG Calculator Suite
 *
 * Tests the core calcMonthlyPayment function used across calculators.
 * Uses Node's built-in test runner.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Replicate the calcMonthlyPayment function from utils.js
// (browser-only file, so we extract the pure math for server-side testing)
function calcMonthlyPayment(principal, annualRate, years) {
  if (principal <= 0 || years <= 0) return 0;
  if (annualRate === 0) return principal / (years * 12);
  const r = annualRate / 12;
  const n = years * 12;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

describe('calcMonthlyPayment', () => {

  it('30-year at 6.5% on $300,000', () => {
    const pmt = calcMonthlyPayment(300000, 0.065, 30);
    // Expected: ~$1,896.20
    assert.ok(Math.abs(pmt - 1896.20) < 0.10, `Expected ~$1,896.20, got $${pmt.toFixed(2)}`);
  });

  it('15-year at 5.5% on $250,000', () => {
    const pmt = calcMonthlyPayment(250000, 0.055, 15);
    // Expected: ~$2,042.71
    assert.ok(Math.abs(pmt - 2042.71) < 0.10, `Expected ~$2,042.71, got $${pmt.toFixed(2)}`);
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

  it('10-year at 7% on $200,000', () => {
    const pmt = calcMonthlyPayment(200000, 0.07, 10);
    // Expected: ~$2,322.17
    assert.ok(Math.abs(pmt - 2322.17) < 0.10, `Expected ~$2,322.17, got $${pmt.toFixed(2)}`);
  });

  it('high rate: 12% on $100,000 for 30 years', () => {
    const pmt = calcMonthlyPayment(100000, 0.12, 30);
    // Expected: ~$1,028.61
    assert.ok(Math.abs(pmt - 1028.61) < 0.10, `Expected ~$1,028.61, got $${pmt.toFixed(2)}`);
  });
});
