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
for (const file of ['shared/utils.js', 'shared/where-the-money-goes-math.js', 'shared/where-the-money-goes-copy.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', file), 'utf8'), context);
}
const M = vm.runInContext('MSFG.WtmgMath', context);
const C = vm.runInContext('MSFG.WtmgCopy', context);

const run = (over, priceEst) => { const r = M.compute(Object.assign({}, M.DEFAULTS, over)); r.priceEst = !!priceEst; return r; };
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

  it('result chip', () => {
    assert.strictEqual(C.result(run()), 'Pays 2.016 pts');
    assert.strictEqual(C.result(run({ solve: 'sheet', msr: 2.89 })), 'Par');
    assert.strictEqual(C.result(run({ rate: 7.75, sheet: -1.5, coupon: 7.0, price: M.estPrice(7.0) })), 'Credit 1.5 pts');
  });
});

describe('pricing tiles', () => {
  it('default: borrower pays, servicing implied inside the usual range', () => {
    const [t1, t2, t3] = C.pricingTiles(run());
    assert.strictEqual(t1.big, 'pays 2.016 pts');
    assert.strictEqual(t1.cls, 'b');
    has(t1.f, '0.874 servicing');
    lacks(t1.f, 'LLPAs');
    assert.strictEqual(t2.big, 'pays 2.016 pts');
    has(t2.f, 'Source: UWM sheet');
    assert.strictEqual(t3.k, 'Implied servicing value');
    has(t3.f, 'inside the usual');
  });

  it('LLPAs appear in the identity line only when present', () => {
    has(C.pricingTiles(run({ llpa: 0.75 }))[0].f, '− 0.75 LLPAs');
  });

  it('gap tile says better or worse by the sign of the gap', () => {
    // At a 1.25 mark the model would charge 1.64 pts; the sheet charges 2.016, so the sheet is worse for the borrower.
    const worse = C.pricingTiles(run({ solve: 'none', msr: 1.25 }))[2];
    assert.strictEqual(worse.big, '0.376 pts worse');
    has(worse.f, 'above its 1.33-pt target');
    // At a 0.5 mark the model would charge 2.39 pts; the sheet's 2.016 is better for the borrower.
    const better = C.pricingTiles(run({ solve: 'none', msr: 0.5 }))[2];
    assert.strictEqual(better.big, '0.374 pts better');
    has(better.f, 'needs servicing worth');
  });

  it('each solve mode gets its own third tile', () => {
    assert.strictEqual(C.pricingTiles(run({ solve: 'comp', msr: 1.0 }))[2].k, 'Implied broker comp');
    has(C.pricingTiles(run({ solve: 'price', msr: 1.25 }))[2].k, 'Implied MBS price');
    const sheet = C.pricingTiles(run({ solve: 'sheet', msr: 2.89 }))[2];
    assert.strictEqual(sheet.k, 'Borrower points, solved');
    assert.strictEqual(sheet.big, 'par');
    has(sheet.v, 'no points, no credit');
  });

  it('implied margin tile compares with the 1.33 average', () => {
    has(C.pricingTiles(run({ solve: 'margin', msr: 0.5 }))[2].f, 'thinner than average');
    assert.strictEqual(C.pricingTiles(run({ solve: 'margin', msr: 0.874 }))[2].f, 'Right at the average.');
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
    assert.strictEqual(after.big, '0.58 pts margin');
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
    has(change.f, 'funds $2,300 from its own capital');
    has(C.notes1(r)[2], 'loss the chart shows');
  });
});

describe('notes', () => {
  it('first note ends on the borrower outcome', () => {
    has(C.notes1(run())[0], 'they pay $10,080 in points at closing.');
    has(C.notes1(run({ rate: 7.75, sheet: -1.5, coupon: 7.0, price: M.estPrice(7.0) }))[0], 'they get a $7,500 lender credit');
    has(C.notes1(run({ solve: 'sheet', msr: 2.89 }))[0], 'par, no points and no credit.');
  });

  it('second note follows the solve mode', () => {
    has(C.notes1(run())[1], 'must be valuing the servicing');
    has(C.notes1(run({ solve: 'comp', msr: 1.0 }))[1], 'more than the 2.25 the example sheet is built on');
    has(C.notes1(run({ solve: 'margin', msr: 0.5 }))[1], 'earns 0.956 pts');
    has(C.notes1(run({ solve: 'none', msr: 1.25 }))[1], 'worse for the borrower');
    has(C.notes1(run({ solve: 'none', msr: 0.5 }))[1], 'better for the borrower');
    has(C.notes1(run({ solve: 'sheet', msr: 2.89 }, true))[1], '(estimated from the 6.5% quote)');
    lacks(C.notes1(run({ solve: 'sheet', msr: 2.89 }, false))[1], 'estimated from');
  });

  it('levers note mentions credits only when there is one', () => {
    lacks(C.notes1(run())[2], 'cannot be returned as cash');
    has(C.notes1(run({ rate: 7.75, sheet: -1.5, coupon: 7.0, price: M.estPrice(7.0) }))[2], 'cannot be returned as cash');
  });

  it('split note handles the nothing-to-split case', () => {
    has(C.notes1(run())[3], 'leaving $562 of profit');
    has(C.notes1(run({ lo: 2.25 }))[3], 'nothing to split');
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
    has(C.revenue(run({ llpa: 0.75 })).line, "pays Fannie's $3,750 in LLPAs");
    has(C.revenue(run({ rate: 7.75, sheet: -1.5, coupon: 7.0, price: M.estPrice(7.0) })).line, 'returns $7,500 to the borrower as a credit');
  });

  it('chart-2 header and note carry the spread decomposition', () => {
    assert.strictEqual(C.sub2(run()), "The bond buyer's 6.50% = 5.11% Treasury + 1.39% risk spread; default risk is priced in Fannie's g-fee.");
    has(C.notes2(run())[0], '0.25% servicing strip');
  });

  it('servicing cards reflect excess strip and solved vs typed mark', () => {
    const def = C.msrCards(run());
    assert.strictEqual(def[0].v, '0.25%/yr');
    has(def[2].v, 'solved from the sheet');
    const r7 = C.msrCards(run({ rate: 7.0, sheet: 2.326, coupon: 6.0, price: M.estPrice(6.0) }));
    assert.strictEqual(r7[0].v, '0.25%/yr + 0.25% excess');
    has(C.msrCards(run({ solve: 'none' }))[2].v, 'your mark');
  });
});
