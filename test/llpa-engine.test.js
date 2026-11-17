/**
 * Tests for the shared LLPA engine (MSFG.LLPA) and its generated matrix (MSFG.LLPA_MATRIX).
 * Cells are checked against the Fannie Mae LLPA Matrix effective 01-28-2026 as parsed for the LLPM tool,
 * and the shared matrix is required to be identical to the legacy ES-module source it is generated from.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const context = vm.createContext({ window: {}, console });
for (const file of ['shared/llpa-matrix.js', 'shared/llpa-engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', file), 'utf8'), context);
}
// Without utils.js in the context there is no global MSFG binding; the modules attach to window.MSFG.
const LLPA = vm.runInContext('window.MSFG.LLPA', context);
const MATRIX = vm.runInContext('window.MSFG.LLPA_MATRIX', context);

const base = over => Object.assign({
  loanAmount: 500000, propertyValue: 625000, creditScore: 780, termYears: 30, purpose: 'Purchase', productType: 'Fixed',
  occupancy: 'Primary', units: '1', isCondo: false, isManufacturedHome: false, isHighBalance: false,
  hasSubordinateFinancing: false, applyMMI: false, isHighLTVRefi: false,
  waiverHomeReady: false, waiverFirstTimeHB: false, waiverDutyToServe: false
}, over);
const total = over => LLPA.calcLLPAs(base(over)).totalPoints;
const names = over => Array.from(LLPA.calcLLPAs(base(over)).breakdown.map(b => b.name));

describe('generated matrix matches the legacy LLPM source', () => {
  it('is deep-equal to legacy/llpm-calc/llpa-matrix-2026-01-28.js', async () => {
    const legacy = await import(pathToFileURL(path.join(__dirname, '../legacy/llpm-calc/llpa-matrix-2026-01-28.js')).href);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(MATRIX)), JSON.parse(JSON.stringify(legacy.LLPA_MATRIX)));
    assert.strictEqual(LLPA.version(), '2026-01-28');
  });
});

describe('base grid', () => {
  it('780+ purchase at exactly 80% LTV is 0.375; at 71% it is zero', () => {
    assert.strictEqual(total({ propertyValue: 625000 }), 0.375);
    assert.strictEqual(total({ propertyValue: 700000 }), 0);
    assert.deepStrictEqual(names({ propertyValue: 700000 }), []);
  });

  it('760-779 at 80% LTV is 0.625 and the bucket edges hold', () => {
    assert.strictEqual(total({ creditScore: 779 }), 0.625);
    assert.strictEqual(total({ creditScore: 780 }), 0.375);
    assert.strictEqual(LLPA.creditScoreBucket(759), '740-759');
    assert.strictEqual(LLPA.creditScoreBucket(639), '<= 639');
    assert.strictEqual(LLPA.ltvBucket(80, ['<30', '75.01-80', '80.01-85']), '75.01-80');
    assert.strictEqual(LLPA.ltvBucket(80.01, ['<30', '75.01-80', '80.01-85']), '80.01-85');
  });

  it('a 15-year purchase has no base LLPA; a 15-year cash-out still does', () => {
    assert.strictEqual(total({ termYears: 15 }), 0);
    assert.ok(total({ termYears: 15, purpose: 'CashOut', creditScore: 700, propertyValue: 700000 }) > 0);
  });
});

describe('attributes, caps, waivers and minimum MI', () => {
  it('investment property adds its LTV-banded adder on top of the base', () => {
    const r = LLPA.calcLLPAs(base({ occupancy: 'Investment', creditScore: 740, propertyValue: 700000 }));
    assert.ok(r.breakdown.some(b => b.name === 'Investment property' && b.points > 0));
    assert.ok(r.totalPoints > total({ creditScore: 740, propertyValue: 700000 }));
  });

  it('high balance picks the fixed-rate or ARM row', () => {
    assert.ok(names({ isHighBalance: true }).includes('High-balance fixed-rate'));
    assert.ok(names({ isHighBalance: true, productType: 'ARM' }).includes('High-balance ARM'));
  });

  it('waivers zero everything except the minimum-MI option', () => {
    const over = { creditScore: 680, propertyValue: 526316, waiverHomeReady: true }; // 95% LTV
    assert.ok(total({ creditScore: 680, propertyValue: 526316 }) > 0);
    assert.strictEqual(total(over), 0);
    const withMmi = LLPA.calcLLPAs(base(Object.assign({ applyMMI: true }, over)));
    assert.strictEqual(withMmi.totalPoints, MATRIX.mmi['680 - 699']['90.01-95']);
    assert.ok(withMmi.breakdown.some(b => /LLPA Waiver/.test(b.name)));
  });

  it('minimum MI reads the >740 row and the 95.01-97 column at 97% LTV', () => {
    const r = LLPA.calcLLPAs(base({ propertyValue: 515464, applyMMI: true })); // 97.0% LTV
    assert.ok(r.breakdown.some(b => b.name === 'Minimum MI coverage option' && b.points === MATRIX.mmi['>740']['95.01-97']));
  });

  it('minimum MI is not applied on a High LTV Refinance and warns', () => {
    const r = LLPA.calcLLPAs(base({ purpose: 'LimitedCashOut', propertyValue: 450000, applyMMI: true, isHighLTVRefi: true }));
    assert.ok(!r.breakdown.some(b => /Minimum MI/.test(b.name)));
    assert.ok(r.warnings.some(w => /not applicable to High LTV/.test(w)));
  });

  it('High LTV Refinance caps the base + attribute subtotal', () => {
    const uncapped = LLPA.calcLLPAs(base({ purpose: 'LimitedCashOut', creditScore: 640, propertyValue: 450000, occupancy: 'Investment' })); // 111% LTV
    const capped = LLPA.calcLLPAs(base({ purpose: 'LimitedCashOut', creditScore: 640, propertyValue: 450000, occupancy: 'Investment', isHighLTVRefi: true }));
    assert.ok(capped.totalPoints <= uncapped.totalPoints);
    if (capped.totalPoints < uncapped.totalPoints) assert.ok(capped.breakdown.some(b => /cap waiver/.test(b.name)));
  });
});
