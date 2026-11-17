/**
 * Where the Money Goes — page copy.
 * Pure functions that turn a compute() result into strings and card descriptors ({cls, k, v, big, f});
 * the page script only places them. Exposed as MSFG.WtmgCopy.
 *
 * Requires shared/utils.js (MSFG.formatCurrency) and shared/where-the-money-goes-math.js (MSFG.WtmgMath).
 * r.priceEst (set by the page) says whether the lock coupon's price was estimated rather than quoted.
 */
/* global MSFG */
(function() {
  'use strict';
  const W = MSFG.WtmgMath;
  const pts = W.pts, pc = W.pc, estPrice = W.estPrice, ANCHOR = W.ANCHOR, AVG_MARGIN = W.AVG_MARGIN, DEFAULTS = W.DEFAULTS;
  const m0 = x => MSFG.formatCurrency(x, 0);
  const m2 = x => MSFG.formatCurrency(x, 2);

  const ptsU = x => pts(x) + (Math.abs(Math.round(x * 1000) / 1000) === 1 ? ' pt' : ' pts');
  const priceWord = x => x === 0 ? 'par' : x < 0 ? `pays ${ptsU(-x)}` : `${ptsU(x)} credit`;
  const multWord = x => x < 3 ? 'below the usual 3.5–5× range: the wholesaler is likely earning less than its average here, or pricing this rate to win volume' : x <= 5 ? 'inside the usual 3.5–5× range, so the sheet is consistent with the margin entered' : 'above the usual 3.5–5× range: either the wholesaler executes better than a plain TBA sale, or it is earning more than the margin entered';
  const card = (cls, k, v, big, f) => ({cls, k, v, big, f});
  const sheetWord = fe => fe.sheetPts === 0 ? 'par after comp' : fe.sheetPts < 0 ? `borrower pays ${ptsU(-fe.sheetPts)}` : `${ptsU(fe.sheetPts)} credit`;
  const sheetSrc = fe => fe.solvedSheet ? 'Computed from the other four variables; no sheet entered' : fe.sheetCost === DEFAULTS.sheet && fe.rate === DEFAULTS.rate ? 'Source: UWM sheet at 7.25%, base −0.234 + 2.25% lender-paid comp' : 'As entered from the sheet';
  const estNote = r => r.priceEst ? ` (estimated from the 6.5% quote)` : '';

  const result = r => { const b = r.after.borrowerPts; return b === 0 ? 'Par' : b < 0 ? `Pays ${ptsU(-b)}` : `Credit ${ptsU(b)}`; };

  // Third result tile: whichever variable was solved, or the gap when nothing was.
  function tile3(r) {
    const lock = r.lock, after = r.after;
    const gapAbs = Math.abs(after.gap), gapD = after.P * gapAbs / 100;
    if (after.solvedSheet) {
      return card(after.borrowerPts < 0 ? 'b' : 'gr', 'Borrower points, solved', `${after.borrowerPts < 0 ? m0(after.bpD) + ' paid at closing' : after.borrowerPts > 0 ? m0(after.crD) + ' lender credit' : 'no points, no credit'} on ${m0(after.P)}`, priceWord(after.borrowerPts), `${pts(lock.margin)} margin + ${pts(after.comp)} comp − ${pts(lock.premPts)} premium − ${pts(after.msrPts)} servicing = ${pts(-after.borrowerPts)} pts to the borrower. Compare it with the wholesaler's grid at ${pc(after.rate)}.`);
    }
    if (after.solvedComp) {
      return card(after.comp < 0.005 ? 'y' : 'g', 'Implied broker comp', `LO ${pts(after.lo)} / MSFG ${pts(after.comp - after.lo)} · ${m0(after.compD)}`, ptsU(after.comp), `What the sheet price leaves for the broker after a ${pts(lock.margin)}-pt margin with servicing at ${pts(after.msrPts)} pts${estNote(r)}. The UWM example sheet is built on 2.25.`);
    }
    if (after.solvedPrice) {
      return card(lock.premPts < 0 ? 'y' : 'g', `Implied MBS price · ${pc(lock.coupon)} coupon`, `${lock.premPts < 0 ? 'discount' : 'premium'} of ${ptsU(Math.abs(lock.premPts))} · ${m0(lock.prem)} · vs. ${estPrice(lock.coupon).toFixed(2)} ${lock.coupon === ANCHOR.coupon ? 'quoted' : 'estimated'}`, lock.price.toFixed(2), `The execution the wholesaler needs to sell this loan at ${sheetWord(after)} with a ${pts(lock.margin)}-pt margin, ${pts(after.comp)} comp and servicing at ${pts(after.msrPts)} pts.`);
    }
    if (gapAbs >= 0.005) {
      return after.gap > 0
        ? card('y', 'Gap: sheet vs. modeled execution', `The sheet is ${m0(gapD)} richer for the borrower than this execution`, `${ptsU(after.gap)} better`, `To hit ${pts(lock.margin)} pts at the sheet price the wholesaler needs servicing worth ${pts(after.impliedMsr)} pts; at ${pts(after.msrPts)} pts it earns ${pts(after.impliedMargin)} pts here.`)
        : card('y', 'Gap: sheet vs. modeled execution', `The sheet costs the borrower ${m0(gapD)} more than this execution`, `${ptsU(gapAbs)} worse`, `At the sheet price the wholesaler earns ${pts(after.impliedMargin)} pts on this loan, above its ${pts(lock.margin)}-pt target.`);
    }
    if (after.solvedMargin) {
      return card(lock.margin < AVG_MARGIN - 0.005 ? 'y' : 'gr', 'Implied wholesaler margin', `vs. UWM's 1.33-pt Q2 2026 average · servicing held at ${pts(after.msrPts)} pts`, ptsU(lock.margin), lock.margin < AVG_MARGIN - 0.005 ? `The sheet is ${pts(AVG_MARGIN - lock.margin)} pts thinner than average at this rate.` : lock.margin > AVG_MARGIN + 0.005 ? `The sheet is ${pts(lock.margin - AVG_MARGIN)} pts richer than average at this rate.` : 'Right at the average.');
    }
    if (after.solvedMsr) {
      return card(after.mult < 3 || after.mult > 5 ? 'y' : 'g', 'Implied servicing value', `${after.mult.toFixed(1)}× the ${pc(after.strip)} annual strip · ${m0(after.msr)}`, ptsU(after.msrPts), `Backed out of the sheet at a ${pts(lock.margin)}-pt margin; ${multWord(after.mult)}.`);
    }
    return card('', 'Gap: sheet vs. modeled execution', 'Sheet matches this execution', '0 pts', `The wholesaler earns its ${pts(lock.margin)}-pt margin at the entered servicing value.`);
  }

  function pricingTiles(r) {
    const lock = r.lock, after = r.after;
    return [
      card(after.borrowerPts < 0 ? 'b' : after.borrowerPts > 0 ? 'gr' : '', `Modeled borrower price at ${pc(after.rate)}`, after.borrowerPts === 0 ? 'No points, no credit' : after.borrowerPts < 0 ? `${m0(after.bpD)} in points at closing` : `${m0(after.crD)} lender credit toward closing costs`, priceWord(after.borrowerPts),
           `${pts(lock.premPts)} premium + ${pts(after.msrPts)} servicing − ${pts(lock.margin)} margin − ${pts(after.comp)} comp${after.llpa > 0 ? ` − ${pts(after.llpa)} LLPAs` : ''}`),
      card('', `Wholesaler's rate sheet at ${pc(after.rate)}`, sheetWord(after), after.sheetPts === 0 ? 'Par' : priceWord(after.sheetPts), sheetSrc(after)),
      tile3(r)
    ];
  }

  function moveTiles(r) {
    if (!r.moved) return null;
    const lock = r.lock, after = r.after;
    const delta = after.margin - lock.margin;
    return [
      card('', 'At lock', `${pc(lock.coupon)} coupon @ ${lock.price.toFixed(2)} · ${m0(after.P * lock.margin / 100)}`, `${ptsU(lock.margin)} margin`, 'The execution the sheet price was built on.'),
      card(after.margin < 0 ? 'y' : 'gr', 'After the market move', `${pc(after.coupon)} coupon @ ${after.price.toFixed(2)} · ${m0(after.P * after.margin / 100)}`, after.margin < 0 ? `${ptsU(after.margin)} · a loss` : `${ptsU(after.margin)} margin`, "The borrower's price, MSFG's comp and the servicing mark are locked, so the margin absorbs the move."),
      card('y', 'Change to the wholesaler', `${m0(after.P * delta / 100)} on this loan`, `${delta >= 0 ? '+' : ''}${ptsU(delta)}`, after.margin < 0 ? `The wholesaler funds ${m0(after.lossD)} from its own capital unless its hedge covers it.` : 'A hedged pipeline offsets this with TBA positions; unhedged, it flows straight to the margin.')
    ];
  }

  function notes1(r) {
    const lock = r.lock, after = r.after;
    const gapAbs = Math.abs(after.gap), gapD = after.P * gapAbs / 100;
    const sw = sheetWord(after);
    const worth = lock.premPts + after.msrPts;
    const n1 = `At ${pc(after.rate)} with a ${pc(lock.coupon)} coupon at ${lock.price.toFixed(2)}, this loan is worth ${pts(worth)} pts to the wholesaler (${pts(lock.premPts)} ${lock.premPts < 0 ? 'discount' : 'premium'} in cash ${lock.premPts < 0 ? 'offset by' : '+'} ${pts(after.msrPts)} servicing value). After the wholesaler's ${pts(lock.margin)}-pt margin${after.llpa > 0 ? `, Fannie's ${pts(after.llpa)}-pt LLPAs` : ''} and MSFG's ${pts(after.comp)}-pt comp, ${pts(after.borrowerPts)} pts is left for the borrower: ` +
      (after.borrowerPts < 0 ? `they pay ${m0(after.bpD)} in points at closing.` : after.borrowerPts > 0 ? `they get a ${m0(after.crD)} lender credit toward closing costs.` : `par, no points and no credit.`);
    let n2;
    if (after.solvedSheet) n2 = `No sheet price entered: the borrower's price is what falls out of the other four variables. At a ${pts(lock.margin)}-pt margin, ${pts(after.comp)}-pt comp, ${pts(lock.premPts)}-pt ${lock.premPts < 0 ? 'discount' : 'premium'}${estNote(r)} and ${pts(after.msrPts)} pts of servicing value, the borrower ${after.borrowerPts < 0 ? `pays ${ptsU(-after.borrowerPts)} (${m0(after.bpD)})` : after.borrowerPts > 0 ? `gets a ${ptsU(after.borrowerPts)} credit (${m0(after.crD)})` : 'is at par'}. If the wholesaler's grid shows a different number at ${pc(after.rate)}, the difference is in the servicing mark or the margin.`;
    else if (after.solvedComp) n2 = `Reading the sheet backwards for comp: at ${sw}, a ${pts(lock.margin)}-pt margin and servicing worth ${pts(after.msrPts)} pts, the loan supports ${ptsU(after.comp)} of broker comp (${m0(after.compD)}). ${after.comp > 2.25 + 0.005 ? 'That is more than the 2.25 the example sheet is built on, so this pricing leaves room.' : after.comp < 2.25 - 0.005 ? 'That is less than the 2.25 the example sheet is built on: at this price, comp would have to come down or the borrower would pay more.' : 'That matches the 2.25 the example sheet is built on.'}`;
    else if (after.solvedPrice) n2 = `Reading the sheet backwards for execution: to sell this loan at ${sw} while keeping a ${pts(lock.margin)}-pt margin, paying ${pts(after.comp)} comp and valuing servicing at ${pts(after.msrPts)} pts, the wholesaler needs ${lock.price.toFixed(2)} for the ${pc(lock.coupon)} coupon, a ${pts(Math.abs(lock.premPts))}-pt ${lock.premPts < 0 ? 'discount' : 'premium'}. The ${lock.coupon === ANCHOR.coupon ? 'quoted' : 'estimated'} price is ${estPrice(lock.coupon).toFixed(2)}, so the market is ${Math.abs(lock.price - estPrice(lock.coupon)) < 0.005 ? 'right there' : (lock.price > estPrice(lock.coupon) ? `${pts(lock.price - estPrice(lock.coupon))} pts short of what this pricing needs` : `${pts(estPrice(lock.coupon) - lock.price)} pts better than this pricing needs`)}.`;
    else if (gapAbs >= 0.005) n2 = after.gap > 0
      ? `The wholesaler's actual sheet prices this rate at ${sw}, ${ptsU(after.gap)} (${m0(gapD)}) better for the borrower than this execution. To still hit its ${pts(lock.margin)}-pt margin it would have to value servicing at ${pts(after.impliedMsr)} pts. At the ${pts(after.msrPts)}-pt mark it earns ${pts(after.impliedMargin)} pts on this loan${after.impliedMargin < 0 ? ', a loss' : ''}. What fills a gap like this: specified-pool pay-ups, g-fee buy-downs, hedge results, the wholesaler's own servicing marks, or pricing to win volume.`
      : `The wholesaler's actual sheet prices this rate at ${sw}, ${ptsU(gapAbs)} (${m0(gapD)}) worse for the borrower than this execution, so it earns about ${pts(after.impliedMargin)} pts on this loan, above its ${pts(lock.margin)}-pt target.`;
    else if (after.solvedMsr) n2 = `Reading the sheet backwards: at ${sw} and a ${pts(lock.margin)}-pt margin, the wholesaler must be valuing the servicing on this loan at ${pts(after.msrPts)} pts, ${after.mult.toFixed(1)}× the ${pc(after.strip)} strip${after.excess > 0 ? ` (${pc(after.svc)} base plus ${pc(after.excess)} excess because the ${pc(after.rate)} note sits above the ${pc(lock.coupon)} coupon + ${pc(after.floor)})` : ''}. That is ${multWord(after.mult)}.${r.priceEst ? ` The ${pc(lock.coupon)} coupon price is estimated from the 6.5% quote; a real quote changes this split between premium and servicing, not the borrower's price.` : ''}`;
    else if (after.solvedMargin) n2 = `Reading the sheet backwards: at ${sw} with servicing worth ${pts(after.msrPts)} pts, the wholesaler earns ${pts(lock.margin)} pts on this loan against UWM's reported 1.33-pt average.`;
    else n2 = `The wholesaler's actual sheet at this rate (${sw}) matches the modeled execution, so it earns its ${pts(lock.margin)}-pt margin with servicing valued at ${pts(after.msrPts)} pts.`;
    const quarter = after.P * 0.25 / 100;
    const n3 = `Levers: every 0.25 pt of wholesaler margin or broker comp moves the borrower's price by 0.25 pt (${m0(quarter)} on this loan), and so does every 0.25 of MBS price. LO and MSFG split the ${pts(after.comp)}-pt comp ${pts(after.lo)} / ${pts(after.comp - after.lo)}; it is paid by the wholesaler out of the rate, never as a line item to the borrower.${after.crD > 0 ? ' Under lender-paid comp a credit can offset closing costs but cannot be returned as cash.' : ''}`;
    const n4 = after.mkD > 0
      ? `MSFG's ${m0(after.mkD)} is gross, not profit. At the shares entered it covers ${m0(after.splitShow[0])} of fixed cost, ${m0(after.splitShow[1])} of variable cost and ${m0(after.splitShow[2])} of one-time expense, leaving ${m0(after.splitShow[3])} of profit (${pts(after.splitD[3] / after.P * 100)} pts of the loan). The LO's ${m0(after.loD)} is the single largest line in the broker's share.`
      : `With LO comp equal to broker comp, MSFG keeps nothing on this loan and there is nothing to split.`;
    const notes = [n1, n2, n3, n4];
    if (r.moved) {
      const delta = after.margin - lock.margin;
      notes.splice(2, 0, `Market move after lock: the execution went from ${pc(lock.coupon)} @ ${lock.price.toFixed(2)} to ${pc(after.coupon)} @ ${after.price.toFixed(2)}, ${delta >= 0 ? 'a gain' : 'a drop'} of ${ptsU(Math.abs(delta))} (${m0(Math.abs(after.P * delta / 100))}). The borrower's price (${sw}) and MSFG's ${pts(after.comp)}-pt comp were locked and the servicing mark is held at ${pts(after.msrPts)} pts, so the wholesaler's margin goes from ${pts(lock.margin)} to ${pts(after.margin)} pts${after.margin < 0 ? `, a ${m0(after.lossD)} loss the chart shows as the wholesaler's own capital flowing in` : ''}. This is why wholesalers hedge locked pipelines with TBA sales: the hedge gains what the loan loses. It cuts both ways; UWM's Q2 2026 results carried a $603 million hedge loss.`);
    }
    return notes;
  }

  function revenue(r) {
    const after = r.after;
    const share = x => after.rev > 0 ? Math.round(x / after.rev * 100) + '%' : '0%';
    const cards = [
      card('b', 'Borrower-paid points · cash at closing', `${m0(after.bpD)} · ${after.bpD > 0 ? ptsU(-after.borrowerPts) : '0 pts'}`, share(after.bpD)),
      after.disc > 0
        ? card('y', 'MBS discount · cost at sale', `${m0(-after.disc)} · ${ptsU(after.premPts)} · the coupon trades below par`, 'cost')
        : card('', "Bond buyer's premium · cash at sale", `${m0(after.prem)} · ${ptsU(after.premPts)}`, share(after.prem)),
      card('g', 'Servicing value · booked, not cash', `${m0(after.msr)} · ${ptsU(after.msrPts)}`, share(after.msr))
    ];
    const line = after.rev > 0
      ? `Of the ${m0(after.rev)} the wholesaler takes in beyond the principal (${pts(after.rev / after.P * 100)} pts), ${m0(after.bpD)} (${share(after.bpD)}) is extra cost to the borrower at closing${after.disc > 0 ? '' : `, ${m0(after.prem)} (${share(after.prem)}) comes from the bond buyer`}, and ${m0(after.msr)} (${share(after.msr)}) is servicing value it books rather than receives. That ${after.disc > 0 ? `covers the ${m0(after.disc)} MBS discount, ` : ''}${after.llpaD > 0 ? `pays Fannie's ${m0(after.llpaD)} in LLPAs, ` : ''}pays MSFG's ${m0(after.compD)} comp${after.crD > 0 ? `, returns ${m0(after.crD)} to the borrower as a credit,` : ''} and leaves the wholesaler ${m0(after.keep)}. Raise the margin or the comp and the borrower's share rises point for point; raise the MBS price or the servicing value and it falls.`
      : 'With no premium, no points, and no servicing value, the wholesaler has no front-end revenue on this loan.';
    return {cards, line};
  }

  const sub2 = r => `The bond buyer's ${pc(r.after.coupon)} = ${pc(r.after.tsy)} Treasury + ${pc(r.monthly.spread)} risk spread; default risk is priced in Fannie's g-fee.`;
  const notes2 = r => [`Bond buyer's ${pc(r.after.coupon)} = ${pc(r.after.tsy)} Treasury + ${pc(r.monthly.spread)} for rate and refi risk. Default risk is Fannie's, paid through the ${pc(r.after.gfee)} g-fee. The ${pc(r.after.strip)} servicing strip goes to whoever services the loan. Month 1 only: interest shrinks and principal grows over time.`];
  const msrCards = r => {
    const after = r.after;
    return [
      card('', 'Servicing strip', `${pc(after.svc)}/yr${after.excess > 0 ? ` + ${pc(after.excess)} excess` : ''}`),
      card('', 'Gross servicing income', `${m2(after.servicer)}/mo, before costs`),
      card('', 'MSR value', `${m0(after.msr)} (${ptsU(after.msrPts)}) · ${after.solvedMsr ? 'solved from the sheet' : 'your mark'} · ${after.mult.toFixed(1)}× the strip`)
    ];
  };

  MSFG.WtmgCopy = { ptsU, priceWord, multWord, sheetWord, sheetSrc, result, pricingTiles, moveTiles, notes1, revenue, sub2, notes2, msrCards };
})();
