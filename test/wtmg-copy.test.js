/**
 * Tests for the Where the Money Goes page copy (MSFG.WtmgCopy).
 * Each sentence template has sign and plural branches; these pin them so a wording edit cannot
 * silently flip "pays" into "credit", "gain" into "drop", or "1 pts" back into the text.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ window: {}, document: { addEventListener() {} }, Intl, console });
for (const file of ['shared/utils.js', 'shared/llpa-matrix.js', 'shared/llpa-engine.js', 'shared/where-the-money-goes-math.js', 'shared/where-the-money-goes-copy.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', file), 'utf8'), context);
}
const M = vm.runInContext('MSFG.WtmgMath', context);
const C = vm.runInContext('MSFG.WtmgCopy', context);

// `run` pins the original servicing-from-the-sheet mode the sentences were worked in; `runDefault` is the page as it opens
// (margin solved at a 4× servicing mark).
const LEGACY = { solve: 'msr', msrMult: null };
const run = (over, priceEst) => { const r = M.compute(Object.assign({}, M.DEFAULTS, LEGACY, over)); r.priceEst = !!priceEst; return r; };
const runDefault = over => M.compute(Object.assign({}, M.DEFAULTS, over));
const has = (text, needle) => assert.ok(text.includes(needle), `expected "${needle}" in: ${text.slice(0, 160)}…`);
const lacks = (text, needle) => assert.ok(!text.includes(needle), `did not expect "${needle}" in: ${text.slice(0, 160)}…`);

describe('small words', () => {
  it('points are singular only at exactly one', () => {
    assert.strictEqual(C.ptsU(1), '1 pt');
    assert.strictEqual(C.ptsU(-1), '−1 pt');
    assert.strictEqual(C.ptsU(2.016), '2.016 pts');
    assert.strictEqual(C.ptsU(0), '0 pts');
  });

  it('priceWord reads the sign of the borrower price', () => {
    assert.strictEqual(C.priceWord(0), 'par');
    assert.strictEqual(C.priceWord(-2.016), 'pays 2.016 pts');
    assert.strictEqual(C.priceWord(1.5), '1.5 pts credit');
    assert.strictEqual(C.priceWord(1), '1 pt credit');
  });

  it('multWord brackets the usual 3.5–5× servicing range', () => {
    has(C.multWord(2.9), 'below the usual');
    has(C.multWord(3.5), 'inside the usual');
    has(C.multWord(5), 'inside the usual');
    has(C.multWord(5.1), 'above the usual');
  });

  it('source lines are assembled from the SOURCES block', () => {
    assert.strictEqual(C.sheetSrc(run().after), 'Source: UWM sheet at 7.25%, base −0.234 + 2.25% lender-paid comp');
    assert.strictEqual(C.sheetSrc(run({ rate: 7.0, sheet: 2.326, coupon: 6.0, price: 98.94 }).after), 'As entered from the sheet');
    has(C.notes1(run({ price2: 99.94 }))[2], "UWM's Q2 2026 results carried a $603 million hedge loss");
  });

  it('result chip', () => {
    assert.strictEqual(C.result(run()), 'Pays 2.016 pts');
    assert.strictEqual(C.result(run({ solve: 'sheet', msr: 2.8 })), 'Par');
    assert.strictEqual(C.result(run({ rate: 7.75, sheet: -1.5, coupon: 7.0, price: M.estPrice(7.0) })), 'Credit 1.5 pts');
  });
});

describe('the page as it opens', () => {
  it('solved-margin note reads the 4× mark against the 1.24 average', () => {
    const n = C.notes1(runDefault());
    assert.strictEqual(n.length, 4);
    has(n[1], 'a 2.25-pt comp and a 4× servicing mark (1.125 pts: 4× the 0.25% base strip + 2.5× the 0.05% excess), the wholesaler earns 1.581 pts on this loan, 0.341 pts richer than UWM\'s reported Q3 2026 average of 1.24.');
    has(n[1], 'Change the multiple');
    has(C.notes1(runDefault({ msrMult: 3 }))[1], 'a 3× servicing mark (0.875 pts: 3× the 0.25% base strip + 2.5× the 0.05% excess), the wholesaler earns 1.331 pts on this loan, 0.091 pts richer than UWM');
    has(C.notes1(runDefault({ rate: 7.75, coupon: 7, price: M.estPrice(7) }))[1], 'a 4× servicing mark (1.125 pts: 4× the 0.25% base strip + 2.5× the 0.05% excess)'); // 7.0 coupon, same 0.05 excess
    const noExcess = C.notes1(runDefault({ rate: 7.2 }))[1]; // 7.20 − 6.5 − 0.70 = 0 excess
    has(noExcess, 'a 4× servicing mark (1 pts: 4× the 0.25% base strip)'); lacks(noExcess, 'excess');
    has(C.notes1(runDefault({ msrMult: null, msr: 0.5 }))[1], 'servicing worth 0.5 pts, the wholesaler earns 0.956 pts on this loan, 0.284 pts thinner than');
    lacks(C.notes1(runDefault({ msrMult: null, msr: 0.5 }))[1], 'Change the multiple');
  });

  it('tiles and cards follow the default mode', () => {
    const t = C.pricingTiles(runDefault());
    assert.strictEqual(t[2].k, 'Implied wholesaler margin'); has(t[2].f, 'richer than average');
    has(C.msrCards(runDefault())[2].v, 'set at 4× the base strip + 2.5× the excess');
    has(C.msrCards(runDefault({ rate: 7.2 }))[2].v, 'set at 4× the base strip'); lacks(C.msrCards(runDefault({ rate: 7.2 }))[2].v, 'excess');
    assert.strictEqual(C.result(runDefault()), 'Pays 2.016 pts');
  });
});

describe('pricing tiles', () => {
  it('default: borrower pays, servicing implied inside the usual range', () => {
    const [t1, t2, t3] = C.pricingTiles(run());
    assert.strictEqual(t1.big, 'pays 2.016 pts');
    assert.strictEqual(t1.cls, 'b');
    has(t1.f, '0.784 servicing');
    lacks(t1.f, 'LLPAs');
    assert.strictEqual(t2.big, 'pays 2.016 pts');
    has(t2.f, 'Source: UWM sheet');
    assert.strictEqual(t3.k, 'Implied servicing value');
    has(t3.f, 'below the usual'); // 0.784 / 0.30 strip = 2.6×
  });

  it('LLPAs appear in the identity line only when present', () => {
    has(C.pricingTiles(run({ llpaMode: 'manual', llpa: 0.75 }))[0].f, '− 0.75 LLPAs');
  });

  it('gap tile says better or worse by the sign of the gap', () => {
    // At a 1.25 mark the model would charge 1.55 pts; the sheet charges 2.016, so the sheet is worse for the borrower.
    const worse = C.pricingTiles(run({ solve: 'none', msr: 1.25 }))[2];
    assert.strictEqual(worse.big, '0.466 pts worse');
    has(worse.f, 'above its 1.24-pt target');
    // At a 0.5 mark the model would charge 2.3 pts; the sheet's 2.016 is better for the borrower.
    const better = C.pricingTiles(run({ solve: 'none', msr: 0.5 }))[2];
    assert.strictEqual(better.big, '0.284 pts better');
    has(better.f, 'needs servicing worth');
  });

  it('each solve mode gets its own third tile', () => {
    assert.strictEqual(C.pricingTiles(run({ solve: 'comp', msr: 1.0 }))[2].k, 'Implied broker comp');
    has(C.pricingTiles(run({ solve: 'price', msr: 1.25 }))[2].k, 'Implied MBS price');
    const sheet = C.pricingTiles(run({ solve: 'sheet', msr: 2.8 }))[2];
    assert.strictEqual(sheet.k, 'Borrower points, solved');
    assert.strictEqual(sheet.big, 'par');
    has(sheet.v, 'no points, no credit');
  });

  it('implied margin tile compares with the 1.24 average', () => {
    has(C.pricingTiles(run({ solve: 'margin', msr: 0.5 }))[2].f, 'thinner than average');
    assert.strictEqual(C.pricingTiles(run({ solve: 'margin', msr: 0.784 }))[2].f, 'Right at the average.');
    has(C.pricingTiles(run({ solve: 'margin', msr: 1.25 }))[2].f, 'richer than average');
  });

  it('a credit flips the first tile to green and to credit wording', () => {
    const t1 = C.pricingTiles(run({ rate: 7.75, sheet: -1.5, coupon: 7.0, price: M.estPrice(7.0) }))[0];
    assert.strictEqual(t1.cls, 'gr');
    has(t1.v, 'lender credit toward closing costs');
  });
});

describe('market move tiles and note', () => {
  it('no move, no tiles', () => {
    assert.strictEqual(C.moveTiles(run()), null);
    assert.strictEqual(C.notes1(run()).length, 4);
  });

  it('a drop is signed negative and read as a drop', () => {
    const r = run({ price2: 99.94 });
    const [, after, change] = C.moveTiles(r);
    assert.strictEqual(after.big, '0.49 pts margin');
    assert.strictEqual(change.big, '−0.75 pts');
    has(change.f, 'hedged pipeline');
    const notes = C.notes1(r);
    assert.strictEqual(notes.length, 5);
    has(notes[2], 'Market move after lock');
    has(notes[2], 'a drop of 0.75 pts');
    lacks(notes[2], 'loss the chart shows');
  });

  it('a gain is signed positive', () => {
    const [, , change] = C.moveTiles(run({ price2: 101.5 }));
    assert.strictEqual(change.big, '+0.81 pts');
    has(C.notes1(run({ price2: 101.5 }))[2], 'a gain of 0.81 pts');
  });

  it('a loss is called a loss and funded from capital', () => {
    const r = run({ price2: 98.9 });
    const [, after, change] = C.moveTiles(r);
    assert.strictEqual(after.cls, 'y');
    has(after.big, '· a loss');
    has(change.f, 'funds $2,750 from its own capital');
    has(C.notes1(r)[2], 'loss the chart shows');
  });
});

describe('notes', () => {
  it('first note ends on the borrower outcome', () => {
    has(C.notes1(run())[0], 'they pay $10,080 in points at closing.');
    has(C.notes1(run({ rate: 7.75, sheet: -1.5, coupon: 7.0, price: M.estPrice(7.0) }))[0], 'they get a $7,500 lender credit');
    has(C.notes1(run({ solve: 'sheet', msr: 2.8 }))[0], 'par, no points and no credit.');
  });

  it('second note follows the solve mode', () => {
    has(C.notes1(run())[1], 'must be valuing the servicing');
    has(C.notes1(run({ solve: 'comp', msr: 1.0 }))[1], 'more than the 2.25 the example sheet is built on');
    has(C.notes1(run({ solve: 'margin', msr: 0.5 }))[1], 'earns 0.956 pts');
    has(C.notes1(run({ solve: 'none', msr: 1.25 }))[1], 'worse for the borrower');
    has(C.notes1(run({ solve: 'none', msr: 0.5 }))[1], 'better for the borrower');
    has(C.notes1(run({ solve: 'sheet', msr: 2.8 }, true))[1], '(estimated from the 6.5% quote)');
    lacks(C.notes1(run({ solve: 'sheet', msr: 2.8 }, false))[1], 'estimated from');
  });

  it('levers note mentions credits only when there is one', () => {
    lacks(C.notes1(run())[2], 'cannot be returned as cash');
    has(C.notes1(run({ rate: 7.75, sheet: -1.5, coupon: 7.0, price: M.estPrice(7.0) }))[2], 'cannot be returned as cash');
  });

  it('split note handles the nothing-to-split case', () => {
    has(C.notes1(run())[3], 'leaving $562 of profit');
    has(C.notes1(run({ lo: 2.25 }))[3], 'nothing to split');
  });

  it('wholesaler split note appears only when the split is on', () => {
    assert.strictEqual(C.notes1(run()).length, 4);
    const on = C.notes1(run({ wsplit: true }));
    assert.strictEqual(on.length, 5);
    has(on[4], "The wholesaler's $6,200 is also gross, not profit");
    has(on[4], 'leaving $1,240 of profit (0.248 pts of the loan)');
    has(C.notes1(run({ wsplit: true, price2: 98.9 }))[5], 'funds a loss, so there is nothing to split');
  });

  it('discount wording when the coupon trades below par', () => {
    const n1 = C.notes1(run({ rate: 7.0, sheet: 2.326, coupon: 6.0, price: M.estPrice(6.0) }))[0];
    has(n1, 'discount in cash offset by');
  });
});

describe('revenue, chart-2 copy and servicing cards', () => {
  it('revenue cards switch between premium and discount', () => {
    const def = C.revenue(run());
    assert.strictEqual(def.cards[1].k, "Bond buyer's premium · cash at sale");
    has(def.line, 'comes from the bond buyer');
    const disc = C.revenue(run({ rate: 7.0, sheet: 2.326, coupon: 6.0, price: M.estPrice(6.0) }));
    assert.strictEqual(disc.cards[1].k, 'MBS discount · cost at sale');
    assert.strictEqual(disc.cards[1].big, 'cost');
    has(disc.line, 'covers the $5,300 MBS discount');
    has(C.revenue(run({ llpaMode: 'manual', llpa: 0.75 })).line, "pays Fannie's $3,750 in LLPAs");
    has(C.revenue(run({ rate: 7.75, sheet: -1.5, coupon: 7.0, price: M.estPrice(7.0) })).line, 'returns $7,500 to the borrower as a credit');
  });

  it('chart-2 header and note carry the spread decomposition', () => {
    assert.strictEqual(C.sub2(run()), "The bond buyer's 6.50% = 5.11% Treasury + 1.39% risk spread; default risk is priced in Fannie's g-fee.");
    has(C.notes2(run())[0], '0.30% servicing strip');
    has(C.notes2(run())[0], "Default risk is Fannie's, paid through the 0.45% g-fee.");
  });

  it('government programs read Ginnie Mae as the wrap, not Fannie', () => {
    const r = run({ program: 'fha' });
    has(C.sub2(r), "default risk is insured by FHA and paid through the upfront and annual MIP; Ginnie Mae's 0.06% guaranty fee covers timely payment to the bond holder.");
    lacks(C.sub2(r), 'Fannie');
    has(C.notes2(r)[0], '$211.98 a month of annual MIP');
    has(C.notes2(r)[0], 'covers timely payment to the bond holder');
    has(C.notes2(r)[0], '0.69% servicing strip');
  });

  it('LLPA panel explains a clean file, lists grid lines, and handles manual mode', () => {
    const clean = C.llpaPanel(run());
    has(clean.head, 'LTV 71.43%');
    assert.strictEqual(clean.rows.length, 0);
    has(clean.foot, 'No adjustments');
    has(clean.foot, '2026-01-28');
    const risky = C.llpaPanel(run({ creditScore: 680, propertyValue: 526316, occupancy: 'Investment' }));
    assert.ok(risky.rows.length >= 2);
    assert.ok(risky.rows.some(x => x.name === 'Investment property'));
    has(risky.foot, 'charged to the wholesaler at delivery');
    const manual = C.llpaPanel(run({ llpaMode: 'manual', llpa: 0.5 }));
    has(manual.head, 'typed manually: 0.5 pts');
    assert.strictEqual(manual.total, 'total 0.5 pts = $2,500');
    has(clean.caption, 'for a purchase, Fannie Mae LLPA Matrix effective 2026-01-28');
    has(C.llpaPanel(run({ purpose: 'CashOut' })).caption, 'for a cash-out refinance');
  });

  it('program fee cards and the funding note for FHA, VA and USDA; none for conventional', () => {
    assert.deepStrictEqual(Array.from(C.feeCards(run())), []);
    assert.strictEqual(C.feeNote(run()), null);
    const fha = C.feeCards(run({ program: 'fha' }));
    assert.strictEqual(fha[0].k, 'FHA upfront MIP'); assert.strictEqual(fha[0].big, '1.75%'); has(fha[0].v, 'financed, so the loan funds at $508,750');
    assert.strictEqual(fha[1].k, 'FHA annual MIP'); assert.strictEqual(fha[1].big, '0.50%/yr'); has(fha[1].v, '$211.98 a month on $508,750');
    has(C.feeNote(run({ program: 'fha' })), 'financed into the loan, so the wholesaler funds $508,750 rather than $500,000');
    assert.strictEqual(C.notes1(run({ program: 'fha' })).length, 5);
    const usda = C.feeCards(run({ program: 'usda', financeUpfront: false }));
    assert.strictEqual(usda[0].cls, 'y'); has(usda[0].v, '$5,000 on the $500,000 base loan · paid in cash at closing');
    has(C.feeNote(run({ program: 'usda', financeUpfront: false })), 'Financing it would raise the loan to $505,000');
    const va = C.feeCards(run({ program: 'va', propertyValue: 520000, vaSubsequentUse: true }));
    assert.strictEqual(va[0].k, 'VA funding fee · subsequent use, under 5% down'); assert.strictEqual(va[0].big, '3.30%');
    assert.strictEqual(va[1].big, 'none');
    has(C.feeCards(run({ program: 'va', vaExempt: true }))[0].v, 'Exempt');
  });

  it('conventional MI above 80% LTV gets its own card, note and chart-2 wording; none at 71% LTV', () => {
    assert.deepStrictEqual(Array.from(C.feeCards(runDefault())), []);
    assert.strictEqual(C.feeNote(runDefault()), null);
    lacks(C.sub2(run()), 'MI');
    lacks(C.notes2(run())[0], 'monthly MI');
    const r = run({ propertyValue: 526316 }); // 95% LTV, conventional
    const cards = C.feeCards(r);
    assert.strictEqual(cards.length, 1);
    assert.strictEqual(cards[0].k, 'Borrower-paid monthly MI · LTV 95.00%'); assert.strictEqual(cards[0].big, '0.30%/yr');
    has(cards[0].v, '$125.00 a month on $500,000'); has(cards[0].v, 'cancels at 80% LTV');
    const note = C.feeNote(r);
    has(note, 'Above 80% LTV Fannie requires mortgage insurance'); has(note, '$125.00 a month'); has(note, 'LLPAs, which price the same risk upfront');
    assert.strictEqual(C.notes1(r).length, 5);
    assert.strictEqual(C.sub2(r), "The bond buyer's 6.50% = 5.11% Treasury + 1.39% risk spread; default risk is priced in Fannie's g-fee, with 0.30% borrower-paid MI ahead of it above 80% LTV.");
    has(C.notes2(r)[0], 'At 95.00% LTV the borrower also pays 0.30% a year of monthly MI ($125.00 a month on top of principal and interest) to a private mortgage insurer');
    has(C.feeNote(run({ propertyValue: 526316, waiverFirstTimeHB: true })), 'conventional counterpart of FHA');
  });

  it('servicing cards reflect excess strip and solved vs typed mark', () => {
    const def = C.msrCards(run());
    assert.strictEqual(def[0].v, '0.25%/yr + 0.05% excess');
    has(def[2].v, 'solved from the sheet');
    const r7 = C.msrCards(run({ rate: 7.0, sheet: 2.326, coupon: 6.0, price: M.estPrice(6.0) }));
    assert.strictEqual(r7[0].v, '0.25%/yr + 0.30% excess');
    has(C.msrCards(run({ solve: 'none' }))[2].v, 'your mark');
    has(C.msrCards(run({ msrMult: 4 }))[2].v, 'set at 4× the base strip + 2.5× the excess');
    has(C.notes1(run({ msrMult: 4 }))[1], 'a 4× servicing mark (1.125 pts: 4× the 0.25% base strip + 2.5× the 0.05% excess), the wholesaler earns 1.581 pts on this loan, 0.341 pts richer than');
  });
});
