/**
 * Where the Money Goes — interactive training page.
 * One conventional loan: money at funding (Sankey 1) and every month (Sankey 2).
 * Pure client-side; every input recomputes the model, both charts and all copy.
 */

(function() {
  'use strict';

  function init() {
  const C = {blue:'#3E7CC9', slate:'#5E6B78', green:'#2E9E6E', gray:'#9AA3AB'};
  const DEFAULT_INFO = "Hover or tap a ribbon to see how it's calculated.";
  const BAR = 10, PAD = 16, W = 1200;
  const NM_LH = 16, AMT_LH = 22, SB_LH = 14;
  const arr = v => Array.isArray(v) ? v : (v === null ? [] : [v]);

  const DEFAULTS = {loan:500000, rate:7.25, sheet:2.016, solve:'msr', coupon:6.50, price:100.69, tsy:5.11, comp:2.25, lo:1.125, margin:1.33, msr:0.874, svc:0.25, gfee:0.50, llpa:0, fixed:30, variable:50, onetime:10, profit:10, coupon2:null, price2:null};
  const ANCHOR = {coupon:6.50, price:100.69, perPoint:3.5}; // price moves about 3.5 pts per 1% of coupon
  const RATE_SHARE = 0.59 / 1.39, AVG_MARGIN = 1.33;
  const SPLIT = [['fixed', 'Fixed cost', 'rent, salaries, systems, licensing, allocated per loan'], ['variable', 'Variable cost', 'processing, credit, disclosures, marketing that scale with volume'], ['onetime', 'One-time expense', 'launch or project costs allocated to this loan'], ['profit', 'Profit', 'what MSFG actually clears on the loan']];
  const state = Object.assign({}, DEFAULTS, {couponAuto:false, priceEst:false, price2Est:false});

  // ---------- formatting ----------
  const m0 = x => (x < 0 ? '−' : '') + '$' + Math.round(Math.abs(x)).toLocaleString('en-US');
  const m2 = x => (x < 0 ? '−' : '') + '$' + Math.abs(x).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const pts = x => { const s = (Math.round(x * 1000) / 1000).toString(); return s === '-0' ? '0' : s.replace('-', '−'); };
  const ptsU = x => pts(x) + (Math.abs(Math.round(x * 1000) / 1000) === 1 ? ' pt' : ' pts');
  const pc = (x, d = 2) => (Math.abs(x * 100 - Math.round(x * 100)) > 1e-6 && d === 2 ? x.toFixed(3) : x.toFixed(d)) + '%';
  const kfmt = x => x >= 1e6 ? '$' + (x / 1e6).toFixed(x % 1e6 ? 2 : 0).replace(/\.?0+$/, '') + 'M' : '$' + Math.round(x / 1000) + 'K';
  const splitDollars = (total, shares) => { const raw = shares.map(s => total * s); const fl = raw.map(Math.floor); let rem = Math.round(total) - fl.reduce((a, b) => a + b, 0); raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rem > 0) { fl[i]++; rem--; } }); return fl; };
  const autoCoupon = (rate, svc, gfee) => Math.max(0.5, Math.floor((rate - gfee - svc) / 0.5 + 1e-9) * 0.5);
  const estPrice = c => Math.round((ANCHOR.price + (c - ANCHOR.coupon) * ANCHOR.perPoint) * 100) / 100;

  // ---------- model ----------
  function compute(s){
    const warnings = [];
    const P = s.loan;
    let coupon = s.coupon, rate = s.rate, tsy = s.tsy, lo = s.lo, margin = s.margin, msrPts = s.msr, price = s.price, comp = s.comp;
    const svc = s.svc, gfee = s.gfee, mode = s.solve, llpa = Math.max(0, s.llpa);
    const floor = gfee + svc;
    if (rate < coupon + floor) { coupon = autoCoupon(rate, svc, gfee); warnings.push(`The note rate must cover the coupon plus ${pc(floor)} (g-fee + servicing strip). Coupon shown as ${pc(coupon)}; enter that coupon's price if you have it.`); }
    if (tsy >= coupon) { tsy = coupon - 0.25; warnings.push(`The Treasury yield has to sit below the MBS coupon. Shown as ${pc(tsy)}.`); }
    const splitSum = s.fixed + s.variable + s.onetime + s.profit;
    let shares = [s.fixed, s.variable, s.onetime, s.profit];
    if (Math.abs(splitSum - 100) > 0.01) { shares = splitSum > 0 ? shares.map(x => x / splitSum * 100) : [25, 25, 25, 25]; warnings.push(`MSFG's four shares add up to ${pts(splitSum)}%, not 100%; they are scaled to 100% in the chart.`); }

    let premPts = price - 100;
    let sheetPts = -s.sheet; // internal convention: positive = credit to the borrower
    // One identity: premium + servicing − margin − comp = borrower price (sheet). Solve for whichever variable was picked.
    let solvedMsr = false, solvedMargin = false, solvedComp = false, solvedPrice = false, solvedSheet = false;
    if (mode === 'msr') {
      msrPts = sheetPts - premPts + margin + comp + llpa; solvedMsr = true;
      if (msrPts < 0) { msrPts = 0; margin = premPts - comp - llpa - sheetPts; solvedMargin = true; warnings.push(`Even with zero servicing value, the sheet price is richer than this execution supports at a ${pts(s.margin)}-pt margin; the wholesaler's margin is solved instead.`); }
    } else if (mode === 'margin') {
      margin = premPts + msrPts - comp - llpa - sheetPts; solvedMargin = true;
      if (margin < 0) { margin = 0; msrPts = sheetPts - premPts + comp + llpa; solvedMsr = true; warnings.push(`At a ${pts(s.msr)}-pt servicing value the sheet price leaves the wholesaler a loss; margin is shown as 0 and the servicing value is solved instead.`); }
    } else if (mode === 'comp') {
      comp = premPts + msrPts - margin - llpa - sheetPts; solvedComp = true;
      if (comp < 0) { comp = 0; warnings.push('At these inputs there is nothing left for broker comp: the borrower price, margin, LLPAs and execution use up more than the loan is worth. Comp is shown as 0 and the gap is shown.'); }
    } else if (mode === 'price') {
      premPts = sheetPts - msrPts + margin + comp + llpa; price = Math.round((100 + premPts) * 1000) / 1000; solvedPrice = true;
    } else if (mode === 'sheet') {
      solvedSheet = true; // borrower price falls out of the other four; the sheet field mirrors it
    }
    if (msrPts < 0) { msrPts = 0; warnings.push('The sheet price is richer than the modeled execution even with zero servicing value and zero margin; the gap is shown.'); }
    if (lo > comp) { lo = comp; warnings.push(`LO comp cannot exceed broker comp${solvedComp ? ' (solved at ' + pts(comp) + ' pts)' : ''}. Shown as equal.`); }

    // Layer 2: the market moves after the lock. Borrower price, comp and the servicing mark are held; the margin absorbs the change.
    const lockCoupon = coupon, lockPrice = price, lockPremPts = premPts, lockMargin = margin;
    let moved = false;
    if (s.coupon2 !== null || s.price2 !== null) {
      let c2 = s.coupon2 !== null ? s.coupon2 : coupon, p2 = s.price2 !== null ? s.price2 : price;
      if (rate < c2 + floor) { const asked = c2; c2 = autoCoupon(rate, svc, gfee); if (s.price2Est || s.price2 === null) p2 = c2 === ANCHOR.coupon ? ANCHOR.price : estPrice(c2); warnings.push(`After the move, a ${pc(asked)} coupon does not fit under the ${pc(rate)} note; shown as ${pc(c2)}${s.price2Est ? ' with an estimated price' : ''}.`); }
      moved = Math.abs(c2 - coupon) > 1e-9 || Math.abs(p2 - price) > 1e-9;
      if (moved) {
        coupon = c2; price = p2; premPts = price - 100;
        margin = lockMargin + (premPts - lockPremPts);
        if (tsy >= coupon) { tsy = coupon - 0.25; warnings.push(`The Treasury yield has to sit below the MBS coupon. Shown as ${pc(tsy)}.`); }
      }
    }
    const lossPts = Math.max(0, -margin);

    const prem = P * premPts / 100;
    const msr = P * msrPts / 100;
    const compD = P * comp / 100, loD = P * lo / 100, mkD = compD - loD, keep = P * Math.max(0, margin) / 100, lossD = P * lossPts / 100, llpaD = P * llpa / 100;
    const splitD = shares.map(x => mkD * x / 100);
    const splitShow = splitDollars(mkD, shares.map(x => x / 100));
    let borrowerPts = premPts + msrPts - margin - comp - llpa;
    if (Math.abs(borrowerPts) < 0.0005) borrowerPts = 0;
    if (solvedSheet) sheetPts = borrowerPts;
    const bpD = P * Math.max(0, -borrowerPts) / 100;
    const crD = P * Math.max(0, borrowerPts) / 100;
    const proceeds = P + prem;
    const disc = Math.max(0, -prem);
    const uwmIn = proceeds + bpD + msr + lossD;
    const rev = Math.max(0, prem) + bpD + msr;
    const gap = sheetPts - borrowerPts;
    const impliedMsr = msrPts + gap;
    const impliedMargin = lockMargin - gap;

    const r = rate / 100 / 12;
    const pmt = P * r / (1 - Math.pow(1 + r, -360));
    const int = P * r, prin = pmt - int;
    const gfD = P * gfee / 100 / 12, svD = P * svc / 100 / 12, trD = P * tsy / 100 / 12;
    const spread = coupon - tsy, rateRisk = spread * RATE_SHARE, refi = spread - rateRisk;
    const rrD = P * rateRisk / 100 / 12, rfD = P * refi / 100 / 12;
    const excess = Math.max(0, rate - coupon - floor), exD = P * excess / 100 / 12;
    const strip = svc + excess, mult = strip > 0 ? msrPts / strip : 0;

    return {warnings, P, price, coupon, rate, tsy, lo, comp, margin, msrPts, sheetPts, sheetCost:solvedSheet ? -borrowerPts : s.sheet, svc, gfee, floor, mode, solvedMsr, solvedMargin, solvedComp, solvedPrice, solvedSheet,
            premPts, prem, disc, msr, compD, loD, mkD, keep, lossD, lossPts, llpa, llpaD, shares, splitD, splitShow,
            lockCoupon, lockPrice, lockPremPts, lockMargin, moved,
            borrowerPts, bpD, crD, proceeds, uwmIn, rev, gap, impliedMsr, impliedMargin,
            pmt, int, prin, gfD, svD, trD, spread, rateRisk, refi, rrD, rfD, excess, exD, strip, mult,
            bondIn: trD + rrD + rfD + prin, servicer: svD + exD};
  }

  // ---------- chart configs ----------
  function chart1Config(m){
    const pv = 0.05 * m.P; // principal drawn as 5% of face
    const buyV = pv - m.disc; // below par, the buy-side principal ribbon shrinks by the discount
    const scale = 429 / (buyV + Math.max(0, m.prem) + m.bpD + m.msr + m.lossD);
    const borrowerSub = m.bpD > 0 ? ['loan funded · paid', `${m0(m.bpD)} in points`] : m.crD > 0 ? ['loan funded ·', `${m0(m.crD)} credit to costs`] : ['loan funded ·', 'pays $0 of the comp'];
    const nodes = [
      {id:'bb',  col:0, side:'left', color:'blue',  name:'Bond buyer', amount:m0(m.proceeds), sub:[`pays ${m.price.toFixed(2)} for the MBS`, m.moved ? `after the market move` : '', m.disc > 0 ? `${m0(m.disc)} below face` : '']},
      {id:'fn',  col:1, color:'slate', name:'Fannie Mae MBS', amount:m0(m.proceeds), sub:['swaps the loan for a', 'guaranteed bond']},
      {id:'bp',  col:1, color:'blue',  name:['Borrower-paid', 'points'], amount:m0(m.bpD), sub:[`${ptsU(-m.borrowerPts)} · cash at closing`, (m.mode === 'none' || m.solvedSheet) ? 'computed from the margins' : 'from the sheet price']},
      {id:'sr',  col:1, color:'gray',  name:["Wholesaler's", 'servicing rights'], amount:m0(m.msr), sub:[`${ptsU(m.msrPts)} · not cash`, `${m.mult.toFixed(1)}× the ${pc(m.strip)} strip`, m.solvedMsr ? 'solved from the sheet' : 'estimate']},
      {id:'wl',  col:1, color:'slate', name:['Wholesaler', 'absorbs a loss'], amount:m0(m.lossD), sub:[`${ptsU(m.lossPts)} · its own capital`, 'unless its hedge covers it']},
      {id:'uwm', col:2, color:'slate', name:['Wholesaler', '(wholesale lender)'], amount:m0(m.uwmIn), sub:[`prices ${pc(m.rate)} at`, `${m.borrowerPts === 0 ? 'par' : (m.borrowerPts < 0 ? '−' : '+') + ptsU(Math.abs(m.borrowerPts))} after comp`]},
      {id:'msfg',col:3, color:'slate', name:'MSFG', amount:m0(m.compD), sub:[`${pts(m.comp)}% lender-paid comp`]},
      {id:'lo',  col:4, color:'green', name:['Loan officer', `${pts(m.lo)} pts`], amount:m0(m.loD), sub:[]},
      {id:'mk',  col:4, color:'slate', name:['MSFG keeps', `${pts(m.comp - m.lo)} pts`], amount:m0(m.mkD), sub:['before expenses, not profit']},
      ...SPLIT.map(([id, name], i) => ({id:'sp_' + id, col:5, color:'green', name:`${name} · ${pts(m.shares[i])}%`, amount:'$' + m.splitShow[i].toLocaleString('en-US'), sub:[]})),
      {id:'llpa', col:5, color:'green', name:['Fannie Mae', `LLPAs · ${pts(m.llpa)} pts`], amount:m0(m.llpaD), sub:['upfront risk fee,', 'passed to the borrower']},
      {id:'br',  col:5, color:'green', name:'Borrower', amount:m0(m.P), sub:borrowerSub},
      {id:'uk',  col:5, color:'green', name:['Wholesaler keeps', `${pts(m.margin)} pts`], amount:m0(m.keep), sub:[m.moved ? `margin after move · was ${pts(m.lockMargin)}` : m.solvedMargin ? 'margin · solved from sheet' : m.margin === AVG_MARGIN ? 'margin · UWM Q2 2026 avg.' : 'margin input']}
    ];
    nodes.forEach(n => { n.sub = n.sub.filter(Boolean); });
    const eq = `${pts(m.lockPremPts)} premium + ${pts(m.msrPts)} servicing − ${pts(m.lockMargin)} margin − ${pts(m.comp)} comp${m.llpa > 0 ? ` − ${pts(m.llpa)} LLPAs` : ''} = ${pts(m.borrowerPts)} pts${m.moved ? ' at lock' : ''}`;
    const principalBuyText = m.disc > 0
      ? `${m0(m.P)} face value × ${m.price.toFixed(2)} / 100 = ${m0(m.proceeds)}. The ${m0(m.disc)} discount below par is a cost the wholesaler has to recover from points and servicing value. Drawn shortened.`
      : `${m0(m.P)} face value. Drawn shortened so the smaller flows show.`;
    const links = [
      {s:'bb', t:'fn', v:Math.max(0, m.prem), label:`premium ${m0(m.prem)}`, text:`${m0(m.P)} × (${m.price.toFixed(2)} − 100) / 100 = ${m0(m.prem)} (${pts(m.premPts)} pts) above face value.`},
      {s:'bb', t:'fn', v:buyV, label:m.disc > 0 ? `proceeds ${m0(m.proceeds)}` : `principal ${m0(m.P)}`, broken:true, text:principalBuyText},
      {s:'fn', t:'uwm', v:Math.max(0, m.prem), label:`premium ${m0(m.prem)}`, text:'The premium goes to the wholesaler as the seller of the loan into the MBS.'},
      {s:'fn', t:'uwm', v:buyV, label:m.disc > 0 ? `proceeds ${m0(m.proceeds)}` : `principal ${m0(m.P)}`, broken:true, text:(m.disc > 0 ? `${m0(m.proceeds)} for a ${m0(m.P)} loan: the wholesaler gets back ${m0(m.disc)} less than it lent. ` : 'Repays the wholesaler for the money it lent. ') + 'In practice cash settles buyer → wholesaler; Fannie wraps the loan in its guarantee.'},
      {s:'bp', t:'uwm', v:m.bpD, label:m0(m.bpD), text:`Borrower price: ${eq}. Negative, so the borrower pays ${m0(m.P)} × ${pts(-m.borrowerPts)} / 100 = ${m0(m.bpD)} in discount points at closing, on top of the ${pts(m.comp)}% comp already built into the rate. This is the piece of the wholesaler's revenue that comes straight from the borrower's pocket.`},
      {s:'wl', t:'uwm', v:m.lossD, label:m0(m.lossD), text:`After the market move the loan is worth ${pts(m.premPts + m.msrPts)} pts (${pts(m.premPts)} ${m.premPts < 0 ? 'discount' : 'premium'} + ${pts(m.msrPts)} servicing) but the wholesaler still owes ${pts(m.comp)} comp and locked the borrower at ${pts(-m.sheetPts)} pts, so it is ${m0(m.lossD)} short (${ptsU(m.lossPts)}). A hedged pipeline makes this back on its TBA position; an unhedged one books the loss.`},
      {s:'sr', t:'uwm', v:m.msr, label:m0(m.msr), dashed:true, text:`${m0(m.P)} × ${pts(m.msrPts)} / 100 = ${m0(m.msr)}. ${m.solvedMsr ? `Solved at lock: sheet ${pts(m.sheetPts)} − premium ${pts(m.lockPremPts)} + margin ${pts(m.lockMargin)} + comp ${pts(m.comp)} = ${pts(m.msrPts)} pts. ` : ''}The value the wholesaler books for keeping the ${pc(m.strip)} servicing strip${m.excess > 0 ? ` (${pc(m.svc)} base + ${pc(m.excess)} excess)` : ''}, about ${m2(m.servicer)} a month before costs; ${m.mult.toFixed(1)}× the annual strip. An estimate, not cash at funding. Typical marks run 3.5–5×; a large wholesaler like UWM carries its book at about 1.7–2.1% of UPB on 5.90%-rate loans.`},
      {s:'uwm', t:'msfg', v:m.compD, label:m0(m.compD), text:`${m0(m.P)} × ${pts(m.comp)} / 100 = ${m0(m.compD)}. The wholesaler pays MSFG's ${pts(m.comp)}% lender-paid comp out of the loan's value; the borrower pays nothing for it directly, it's built into the ${pc(m.rate)} rate.`},
      {s:'uwm', t:'llpa', v:m.llpaD, label:m0(m.llpaD), text:`${m0(m.P)} × ${pts(m.llpa)} / 100 = ${m0(m.llpaD)}. Loan-level price adjustments: Fannie Mae's upfront fee for this file's risk (credit score, LTV, occupancy, property type, cash-out), charged when the loan is delivered. The wholesaler passes it straight through to the borrower's price, point for point.`},
      {s:'uwm', t:'br', v:pv, label:`principal ${m0(m.P)}`, broken:true, text:`The wholesaler wires ${m0(m.P)} at closing (to the seller or to pay off the old loan). Drawn shortened.`},
      {s:'uwm', t:'br', v:m.crD, label:`credit ${m0(m.crD)}`, text:`Borrower price: ${eq}. Positive, so the wholesaler gives the borrower ${m0(m.P)} × ${pts(m.borrowerPts)} / 100 = ${m0(m.crD)} as a lender credit toward closing costs. Under lender-paid comp a credit can offset costs but cannot be paid out as cash.`},
      {s:'uwm', t:'uk', v:m.keep, label:m0(m.keep), text:`${m0(m.P)} × ${pts(m.margin)} / 100 = ${m0(m.keep)}. ` + (m.moved ? `Margin after the market move: ${pts(m.lockMargin)} at lock ${m.premPts - m.lockPremPts >= 0 ? '+' : '−'} ${pts(Math.abs(m.premPts - m.lockPremPts))} change in execution = ${pts(m.margin)} pts. The borrower's price, the comp and the servicing mark were already set, so the move lands here.` : m.solvedMargin ? `Solved: premium ${pts(m.premPts)} + servicing ${pts(m.msrPts)} − comp ${pts(m.comp)} − sheet ${pts(m.sheetPts)} = ${pts(m.margin)} pts, against UWM's reported Q2 2026 average of 1.33.` : m.margin === AVG_MARGIN ? "The default is UWM's reported Q2 2026 average total gain margin (133 bps), a company average, not a loan-level number." : `Set by the wholesaler margin input (${pts(m.margin)} pts; UWM's reported Q2 2026 average was 1.33).`)},
      {s:'msfg', t:'lo', v:m.loD, label:m0(m.loD), text:`${m0(m.P)} × ${pts(m.lo)} pts / 100 = ${m0(m.loD)}.`},
      {s:'msfg', t:'mk', v:m.mkD, label:m0(m.mkD), text:`${m0(m.compD)} − ${m0(m.loD)} = ${m0(m.mkD)}. Gross to the company, before expenses; the four ribbons out of it show where it goes.`},
      ...SPLIT.map(([id, name, desc], i) => ({s:'mk', t:'sp_' + id, v:m.splitD[i], label:'$' + m.splitShow[i].toLocaleString('en-US'), text:`${m0(m.mkD)} × ${pts(m.shares[i])}% = $${m.splitShow[i].toLocaleString('en-US')} (${pts(m.splitD[i] / m.P * 100)} pts of the loan). ${name}: ${desc}. The shares are MSFG's own allocation assumptions, editable above.`}))
    ];
    return {scale, gap:12, colX:[150, 320, 490, 660, 830, 1000], nodes, links};
  }

  function chart2Config(m){
    const scale = 426 / m.pmt;
    const nodes = [
      {id:'pay', col:0, side:'left', color:'blue', name:'Borrower payment', amount:m2(m.pmt) + '/mo', sub:[`principal + interest, ${pc(m.rate)}`]},
      {id:'int', col:1, color:'slate', name:'Interest', amount:m2(m.int), sub:[]},
      {id:'prn', col:1, color:'slate', name:'Principal', amount:m2(m.prin), sub:['pays the balance down']},
      {id:'gf',  col:2, color:'slate', name:`Default risk · ${pc(m.gfee)} g-fee`, amount:m2(m.gfD), sub:[]},
      {id:'sv',  col:2, color:'slate', name:`Servicing · ${pc(m.svc)}`, amount:m2(m.svD), sub:[]},
      {id:'ex',  col:2, color:'slate', name:`Excess servicing · ${pc(m.excess)}`, amount:m2(m.exD), sub:[`note rate above coupon + ${pc(m.floor)}`, 'stays with the servicer']},
      {id:'tr',  col:2, color:'slate', name:`10-yr Treasury base · ${pc(m.tsy)}`, amount:m2(m.trD), sub:['what a risk-free bond pays']},
      {id:'rr',  col:2, color:'gray',  name:`Rate & extension risk · ${pc(m.rateRisk)}`, amount:m2(m.rrD), sub:['illustrative split']},
      {id:'rf',  col:2, color:'gray',  name:`Refi / prepay risk · ${pc(m.refi)}`, amount:m2(m.rfD), sub:['illustrative split']},
      {id:'pt',  col:2, color:'slate', hideLabel:true, name:'Principal pass-through', amount:m2(m.prin), sub:[]},
      {id:'fm',  col:3, color:'green', name:'Fannie Mae', amount:m2(m.gfD), sub:['covers defaults']},
      {id:'svc', col:3, color:'green', name:'Servicer', amount:m2(m.servicer), sub:['the wholesaler, if it keeps', 'servicing · gross']},
      {id:'bby', col:3, color:'green', name:'Bond buyer', amount:m2(m.bondIn), sub:[`${pc(m.coupon)} coupon + principal`]}
    ];
    const t = {
      gf: `${m0(m.P)} × ${pc(m.gfee)} ÷ 12. Fannie's price for taking the default risk; the base g-fee varies by lender and includes the 0.10% TCCA surcharge.`,
      sv: `${m0(m.P)} × ${pc(m.svc)} ÷ 12. The base servicing strip.`,
      ex: `${m0(m.P)} × ${pc(m.excess)} ÷ 12. The note rate runs ${pc(m.excess)} above coupon + g-fee + servicing strip; that extra strip stays with whoever services the loan.`,
      tr: `${m0(m.P)} × ${pc(m.tsy)} ÷ 12. 10-yr Treasury yield${m.tsy === DEFAULTS.tsy ? ' on Nov 17, 2026' : ' as entered'}.`,
      rr: `Illustrative share of the ${pc(m.spread)} spread: if rates rise, the loan lasts longer and the bond loses value.`,
      rf: `Illustrative share of the ${pc(m.spread)} spread: if rates fall, the borrower refis and the buyer gets paid back early.`,
      pt: 'Month-1 principal passes straight through to the bond holder.'
    };
    const links = [
      {s:'pay', t:'int', v:m.int, label:m2(m.int), text:`${m0(m.P)} × ${pc(m.rate)} ÷ 12 (month 1; shrinks as the balance drops).`},
      {s:'pay', t:'prn', v:m.prin, label:m2(m.prin), text:`${m2(m.pmt)} − ${m2(m.int)} (month 1; grows over time).`},
      {s:'int', t:'gf', v:m.gfD, label:m2(m.gfD), text:t.gf},
      {s:'int', t:'sv', v:m.svD, label:m2(m.svD), text:t.sv},
      {s:'int', t:'ex', v:m.exD, label:m2(m.exD), text:t.ex},
      {s:'int', t:'tr', v:m.trD, label:m2(m.trD), text:t.tr},
      {s:'int', t:'rr', v:m.rrD, label:m2(m.rrD), text:t.rr},
      {s:'int', t:'rf', v:m.rfD, label:m2(m.rfD), text:t.rf},
      {s:'prn', t:'pt', v:m.prin, label:m2(m.prin), text:t.pt},
      {s:'gf', t:'fm', v:m.gfD, label:m2(m.gfD), text:t.gf},
      {s:'sv', t:'svc', v:m.svD, label:m2(m.svD), text:t.sv},
      {s:'ex', t:'svc', v:m.exD, label:m2(m.exD), text:t.ex},
      {s:'tr', t:'bby', v:m.trD, label:m2(m.trD), text:t.tr},
      {s:'rr', t:'bby', v:m.rrD, label:m2(m.rrD), text:t.rr},
      {s:'rf', t:'bby', v:m.rfD, label:m2(m.rfD), text:t.rf},
      {s:'pt', t:'bby', v:m.prin, label:m2(m.prin), text:t.pt}
    ];
    return {scale, gap:12, colX:[170, 450, 730, 1010], nodes, links};
  }

  // ---------- Sankey layout ----------
  function layout(cfg){
    cfg.links = cfg.links.filter(l => l.v > 0.004);
    const used = new Set(); cfg.links.forEach(l => { used.add(l.s); used.add(l.t); });
    cfg.nodes = cfg.nodes.filter(n => used.has(n.id));
    const byId = {}; cfg.nodes.forEach(n => byId[n.id] = n);
    cfg.nodes.forEach(n => { n.inV = 0; n.outV = 0; n.ins = []; n.outs = []; });
    cfg.links.forEach((l, i) => {
      l.i = i; l.src = byId[l.s]; l.tgt = byId[l.t];
      l.px = l.v * cfg.scale;
      l.src.outV += l.v; l.src.outs.push(l);
      l.tgt.inV += l.v; l.tgt.ins.push(l);
    });
    cfg.nodes.forEach(n => {
      n.barH = Math.max(n.inV, n.outV) * cfg.scale;
      n.nameLines = arr(n.name); n.subLines = arr(n.sub);
      n.labelH = n.hideLabel ? 0 : n.nameLines.length * NM_LH + AMT_LH + n.subLines.length * SB_LH;
      n.slotH = Math.max(n.barH, n.labelH);
      n.x = cfg.colX[n.col];
    });
    const cols = [];
    cfg.nodes.forEach(n => { (cols[n.col] = cols[n.col] || []).push(n); });
    for (let i = 0; i < cols.length; i++) cols[i] = cols[i] || [];

    const place = n => {
      n.barY = n.slotY + (n.slotH - n.barH) / 2;
      let o = 0; n.outs.forEach(l => { l.sy0 = n.barY + o; o += l.px; l.sy1 = n.barY + o; });
      o = 0; n.ins.forEach(l => { l.ty0 = n.barY + o; o += l.px; l.ty1 = n.barY + o; });
    };

    cols.forEach(col => {
      let cursor = -Infinity;
      col.forEach(n => {
        let desired = -Infinity;
        if (n.ins.length) desired = Math.max(desired, n.ins[0].sy0 - (n.slotH - n.barH) / 2);
        let off = 0;
        n.ins.forEach(l => {
          if (l.tgt.col - l.src.col > 1) {
            let bottom = -Infinity;
            for (let k = l.src.col + 1; k < l.tgt.col; k++) cols[k].forEach(m => { bottom = Math.max(bottom, m.slotY + m.slotH); });
            if (bottom > -Infinity) desired = Math.max(desired, bottom + 2 * cfg.gap - off - (n.slotH - n.barH) / 2);
          }
          off += l.px;
        });
        if (desired === -Infinity) desired = cursor === -Infinity ? 0 : cursor;
        n.slotY = Math.max(desired, cursor);
        cursor = n.slotY + n.slotH + cfg.gap;
        place(n);
      });
    });

    let minY = Infinity, maxY = -Infinity;
    cfg.nodes.forEach(n => { minY = Math.min(minY, n.slotY, n.barY); maxY = Math.max(maxY, n.slotY + n.slotH, n.barY + n.barH); });
    const shift = PAD - minY;
    cfg.nodes.forEach(n => { n.slotY += shift; n.barY += shift; });
    cfg.links.forEach(l => { l.sy0 += shift; l.sy1 += shift; l.ty0 += shift; l.ty1 += shift; });
    cfg.height = maxY - minY + 2 * PAD;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  function renderSankey(cfg, svg, info){
    layout(cfg);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.classList.remove('has-active');
    info.textContent = DEFAULT_INFO;
    svg.setAttribute('viewBox', `0 0 ${W} ${cfg.height}`);
    const gLinks = el('g', {class:'links'}, svg);
    const gBars = el('g', {class:'bars'}, svg);
    const gBrk = el('g', {class:'breaks'}, svg);
    const gLbl = el('g', {class:'lbl'}, svg);

    cfg.links.forEach(l => {
      const x0 = l.src.x + BAR, x1 = l.tgt.x, xm = (x0 + x1) / 2;
      const d = `M${x0},${l.sy0} C${xm},${l.sy0} ${xm},${l.ty0} ${x1},${l.ty0} L${x1},${l.ty1} C${xm},${l.ty1} ${xm},${l.sy1} ${x0},${l.sy1} Z`;
      const color = l.tgt.color === 'green' ? C.green : C[l.src.color];
      l.title = `${arr(l.src.name).join(' ')} → ${arr(l.tgt.name).join(' ')} · ${l.label}`;
      el('path', {d, fill:color, class:'ribbon' + (l.dashed ? ' dashed' : ''), 'data-i':l.i, tabindex:0, role:'button', 'aria-label':`${l.title}. ${l.text}`}, gLinks);
      if (l.broken) {
        const yt = (l.sy0 + l.ty0) / 2, yb = (l.sy1 + l.ty1) / 2, h = yb - yt;
        const dx = Math.min(24, 6 + h * 0.1);
        [-6, 6].forEach(o => el('line', {x1:xm + o + dx / 2, y1:yt - 3, x2:xm + o - dx / 2, y2:yb + 3, class:'brk'}, gBrk));
      }
    });

    cfg.nodes.forEach(n => {
      el('rect', {x:n.x, y:n.barY, width:BAR, height:n.barH, fill:C[n.color], class:'bar ' + n.color}, gBars);
      if (n.hideLabel) return;
      const left = n.side === 'left';
      const x = left ? n.x - 8 : n.x + BAR + 8;
      const anchor = left ? 'end' : 'start';
      let y = n.barY + n.barH / 2 - n.labelH / 2;
      n.nameLines.forEach((t, i) => { const tx = el('text', {x, y: y + 12 + i * NM_LH, 'text-anchor':anchor, class:'nm'}, gLbl); tx.textContent = t; });
      y += n.nameLines.length * NM_LH;
      const a = el('text', {x, y: y + 17, 'text-anchor':anchor, class:'amt'}, gLbl); a.textContent = n.amount;
      y += AMT_LH;
      n.subLines.forEach((t, i) => { const tx = el('text', {x, y: y + 11 + i * SB_LH, 'text-anchor':anchor, class:'sb'}, gLbl); tx.textContent = t; });
    });

    const paths = Array.from(gLinks.querySelectorAll('.ribbon'));
    let pinned = null;
    const show = i => {
      svg.classList.add('has-active');
      paths.forEach(p => p.classList.toggle('active', +p.dataset.i === i));
      const l = cfg.links[i];
      info.textContent = '';
      const s = document.createElement('strong'); s.textContent = l.title;
      info.appendChild(s); info.appendChild(document.createTextNode(l.text));
    };
    const clear = () => {
      if (pinned !== null) return show(pinned);
      svg.classList.remove('has-active');
      paths.forEach(p => p.classList.remove('active'));
    };
    svg._clear = clear;
    paths.forEach(p => {
      const i = +p.dataset.i;
      p.addEventListener('pointerenter', () => { if (pinned === null) show(i); });
      p.addEventListener('focus', () => { if (pinned === null) show(i); });
      p.addEventListener('blur', () => { if (pinned === null) clear(); });
      const toggle = () => {
        if (pinned === i) { pinned = null; clear(); info.textContent = DEFAULT_INFO; }
        else { pinned = i; show(i); }
      };
      p.addEventListener('click', e => { e.preventDefault(); toggle(); });
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
    if (!svg._wired) { svg.addEventListener('pointerleave', () => svg._clear && svg._clear()); svg._wired = true; }
  }

  // ---------- page text ----------
  const $ = id => document.getElementById(id);
  const setNotes = (id, texts) => { const box = $(id); box.textContent = ''; texts.forEach(t => { const p = document.createElement('p'); p.className = 'note'; p.textContent = t; box.appendChild(p); }); };
  const card = (cls, k, v, big, f) => `<div class="card ${cls}"><span class="k">${k}</span>${big !== undefined && big !== null ? `<span class="pct">${big}</span>` : ''}<span class="v">${v}</span>${f ? `<span class="f">${f}</span>` : ''}</div>`;
  const priceWord = x => x === 0 ? 'par' : x < 0 ? `pays ${ptsU(-x)}` : `${ptsU(x)} credit`;
  const multWord = x => x < 3 ? 'below the usual 3.5–5× range: the wholesaler is likely earning less than its average here, or pricing this rate to win volume' : x <= 5 ? 'inside the usual 3.5–5× range, so the sheet is consistent with the margin entered' : 'above the usual 3.5–5× range: either the wholesaler executes better than a plain TBA sale, or it is earning more than the margin entered';

  function renderText(m){
    // Lock view: layer-1 tiles and notes describe the execution the sheet price was built on, even after a market move.
    const lk = m.moved ? Object.assign({}, m, {premPts:m.lockPremPts, margin:m.lockMargin, price:m.lockPrice, coupon:m.lockCoupon, prem:m.P * m.lockPremPts / 100}) : m;
    $('lede').textContent = `One ${kfmt(m.P)} loan: money at closing, money every month.`;
    const w = $('warnings'); w.hidden = !m.warnings.length; w.textContent = m.warnings.join(' ');
    $('in-result').textContent = m.borrowerPts === 0 ? 'Par' : m.borrowerPts < 0 ? `Pays ${ptsU(-m.borrowerPts)}` : `Credit ${ptsU(m.borrowerPts)}`;

    const gapAbs = Math.abs(m.gap), gapD = m.P * gapAbs / 100;
    const sheetWord = m.sheetPts === 0 ? 'par after comp' : m.sheetPts < 0 ? `borrower pays ${ptsU(-m.sheetPts)}` : `${ptsU(m.sheetPts)} credit`;
    const sheetSrc = m.solvedSheet ? 'Computed from the other four variables; no sheet entered' : m.sheetCost === DEFAULTS.sheet && m.rate === DEFAULTS.rate ? 'Source: UWM sheet at 7.25%, base −0.234 + 2.25% lender-paid comp' : 'As entered from the sheet';
    const estNote = m.priceEst ? ` (estimated from the 6.5% quote)` : '';
    let tile3;
    if (m.solvedSheet) {
      tile3 = card(m.borrowerPts < 0 ? 'b' : 'gr', 'Borrower points, solved', `${m.borrowerPts < 0 ? m0(m.bpD) + ' paid at closing' : m.borrowerPts > 0 ? m0(m.crD) + ' lender credit' : 'no points, no credit'} on ${m0(m.P)}`, priceWord(m.borrowerPts), `${pts(lk.margin)} margin + ${pts(m.comp)} comp − ${pts(lk.premPts)} premium − ${pts(m.msrPts)} servicing = ${pts(-m.borrowerPts)} pts to the borrower. Compare it with the wholesaler's grid at ${pc(m.rate)}.`);
    } else if (m.solvedComp) {
      tile3 = card(m.comp < 0.005 ? 'y' : 'g', 'Implied broker comp', `LO ${pts(m.lo)} / MSFG ${pts(m.comp - m.lo)} · ${m0(m.compD)}`, ptsU(m.comp), `What the sheet price leaves for the broker after a ${pts(lk.margin)}-pt margin with servicing at ${pts(m.msrPts)} pts${estNote}. The UWM example sheet is built on 2.25.`);
    } else if (m.solvedPrice) {
      tile3 = card(lk.premPts < 0 ? 'y' : 'g', `Implied MBS price · ${pc(lk.coupon)} coupon`, `${lk.premPts < 0 ? 'discount' : 'premium'} of ${ptsU(Math.abs(lk.premPts))} · ${m0(lk.prem)} · vs. ${estPrice(lk.coupon).toFixed(2)} ${lk.coupon === ANCHOR.coupon ? 'quoted' : 'estimated'}`, lk.price.toFixed(2), `The execution the wholesaler needs to sell this loan at ${sheetWord} with a ${pts(lk.margin)}-pt margin, ${pts(m.comp)} comp and servicing at ${pts(m.msrPts)} pts.`);
    } else if (gapAbs >= 0.005) {
      tile3 = m.gap > 0
        ? card('y', 'Gap: sheet vs. modeled execution', `The sheet is ${m0(gapD)} richer for the borrower than this execution`, `${ptsU(m.gap)} better`, `To hit ${pts(lk.margin)} pts at the sheet price the wholesaler needs servicing worth ${pts(m.impliedMsr)} pts; at ${pts(m.msrPts)} pts it earns ${pts(m.impliedMargin)} pts here.`)
        : card('y', 'Gap: sheet vs. modeled execution', `The sheet costs the borrower ${m0(gapD)} more than this execution`, `${ptsU(gapAbs)} worse`, `At the sheet price the wholesaler earns ${pts(m.impliedMargin)} pts on this loan, above its ${pts(lk.margin)}-pt target.`);
    } else if (m.solvedMargin) {
      tile3 = card(lk.margin < AVG_MARGIN - 0.005 ? 'y' : 'gr', 'Implied wholesaler margin', `vs. UWM's 1.33-pt Q2 2026 average · servicing held at ${pts(m.msrPts)} pts`, ptsU(lk.margin), lk.margin < AVG_MARGIN - 0.005 ? `The sheet is ${pts(AVG_MARGIN - lk.margin)} pts thinner than average at this rate.` : lk.margin > AVG_MARGIN + 0.005 ? `The sheet is ${pts(lk.margin - AVG_MARGIN)} pts richer than average at this rate.` : 'Right at the average.');
    } else if (m.solvedMsr) {
      tile3 = card(m.mult < 3 || m.mult > 5 ? 'y' : 'g', 'Implied servicing value', `${m.mult.toFixed(1)}× the ${pc(m.strip)} annual strip · ${m0(m.msr)}`, ptsU(m.msrPts), `Backed out of the sheet at a ${pts(lk.margin)}-pt margin; ${multWord(m.mult)}.`);
    } else {
      tile3 = card('', 'Gap: sheet vs. modeled execution', 'Sheet matches this execution', '0 pts', `The wholesaler earns its ${pts(lk.margin)}-pt margin at the entered servicing value.`);
    }
    const mv = $('move'); mv.hidden = !m.moved;
    if (m.moved) {
      const delta = m.margin - m.lockMargin;
      mv.innerHTML =
        card('', 'At lock', `${pc(m.lockCoupon)} coupon @ ${m.lockPrice.toFixed(2)} · ${m0(m.P * m.lockMargin / 100)}`, `${ptsU(m.lockMargin)} margin`, 'The execution the sheet price was built on.') +
        card(m.margin < 0 ? 'y' : 'gr', 'After the market move', `${pc(m.coupon)} coupon @ ${m.price.toFixed(2)} · ${m0(m.P * m.margin / 100)}`, m.margin < 0 ? `${ptsU(m.margin)} · a loss` : `${ptsU(m.margin)} margin`, "The borrower's price, MSFG's comp and the servicing mark are locked, so the margin absorbs the move.") +
        card('y', 'Change to the wholesaler', `${m0(m.P * delta / 100)} on this loan`, `${delta >= 0 ? '+' : ''}${ptsU(delta)}`, m.margin < 0 ? `The wholesaler funds ${m0(m.lossD)} from its own capital unless its hedge covers it.` : 'A hedged pipeline offsets this with TBA positions; unhedged, it flows straight to the margin.');
    }
    $('pricing').innerHTML =
      card(m.borrowerPts < 0 ? 'b' : m.borrowerPts > 0 ? 'gr' : '', `Modeled borrower price at ${pc(m.rate)}`, m.borrowerPts === 0 ? 'No points, no credit' : m.borrowerPts < 0 ? `${m0(m.bpD)} in points at closing` : `${m0(m.crD)} lender credit toward closing costs`, priceWord(m.borrowerPts),
           `${pts(lk.premPts)} premium + ${pts(m.msrPts)} servicing − ${pts(lk.margin)} margin − ${pts(m.comp)} comp${m.llpa > 0 ? ` − ${pts(m.llpa)} LLPAs` : ''}`) +
      card('', `Wholesaler's rate sheet at ${pc(m.rate)}`, sheetWord, m.sheetPts === 0 ? 'Par' : priceWord(m.sheetPts), sheetSrc) +
      tile3;

    $('cap1').textContent = `Ribbon width = dollars, this chart only. Principal ribbons (//) are drawn shortened; every other width is to scale. One-time, at funding. Lender-paid comp: the borrower pays nothing out of pocket for it; it's built into the ${pc(m.rate)} rate. Borrower points or credit come from the sheet price and the margins, not typed in.${m.disc > 0 ? ` The ${pc(m.coupon)} coupon trades below par, so the buy-side principal ribbons are drawn ${m0(m.disc)} thinner than the funding ribbon.` : ''}`;

    const worth = lk.premPts + m.msrPts;
    const n1 = `At ${pc(m.rate)} with a ${pc(lk.coupon)} coupon at ${lk.price.toFixed(2)}, this loan is worth ${pts(worth)} pts to the wholesaler (${pts(lk.premPts)} ${lk.premPts < 0 ? 'discount' : 'premium'} in cash ${lk.premPts < 0 ? 'offset by' : '+'} ${pts(m.msrPts)} servicing value). After the wholesaler's ${pts(lk.margin)}-pt margin${m.llpa > 0 ? `, Fannie's ${pts(m.llpa)}-pt LLPAs` : ''} and MSFG's ${pts(m.comp)}-pt comp, ${pts(m.borrowerPts)} pts is left for the borrower: ` +
      (m.borrowerPts < 0 ? `they pay ${m0(m.bpD)} in points at closing.` : m.borrowerPts > 0 ? `they get a ${m0(m.crD)} lender credit toward closing costs.` : `par, no points and no credit.`);
    let n2;
    if (m.solvedSheet) n2 = `No sheet price entered: the borrower's price is what falls out of the other four variables. At a ${pts(lk.margin)}-pt margin, ${pts(m.comp)}-pt comp, ${pts(lk.premPts)}-pt ${lk.premPts < 0 ? 'discount' : 'premium'}${estNote} and ${pts(m.msrPts)} pts of servicing value, the borrower ${m.borrowerPts < 0 ? `pays ${ptsU(-m.borrowerPts)} (${m0(m.bpD)})` : m.borrowerPts > 0 ? `gets a ${ptsU(m.borrowerPts)} credit (${m0(m.crD)})` : 'is at par'}. If the wholesaler's grid shows a different number at ${pc(m.rate)}, the difference is in the servicing mark or the margin.`;
    else if (m.solvedComp) n2 = `Reading the sheet backwards for comp: at ${sheetWord}, a ${pts(lk.margin)}-pt margin and servicing worth ${pts(m.msrPts)} pts, the loan supports ${ptsU(m.comp)} of broker comp (${m0(m.compD)}). ${m.comp > 2.25 + 0.005 ? 'That is more than the 2.25 the example sheet is built on, so this pricing leaves room.' : m.comp < 2.25 - 0.005 ? 'That is less than the 2.25 the example sheet is built on: at this price, comp would have to come down or the borrower would pay more.' : 'That matches the 2.25 the example sheet is built on.'}`;
    else if (m.solvedPrice) n2 = `Reading the sheet backwards for execution: to sell this loan at ${sheetWord} while keeping a ${pts(lk.margin)}-pt margin, paying ${pts(m.comp)} comp and valuing servicing at ${pts(m.msrPts)} pts, the wholesaler needs ${lk.price.toFixed(2)} for the ${pc(lk.coupon)} coupon, a ${pts(Math.abs(lk.premPts))}-pt ${lk.premPts < 0 ? 'discount' : 'premium'}. The ${lk.coupon === ANCHOR.coupon ? 'quoted' : 'estimated'} price is ${estPrice(lk.coupon).toFixed(2)}, so the market is ${Math.abs(lk.price - estPrice(lk.coupon)) < 0.005 ? 'right there' : (lk.price > estPrice(lk.coupon) ? `${pts(lk.price - estPrice(lk.coupon))} pts short of what this pricing needs` : `${pts(estPrice(lk.coupon) - lk.price)} pts better than this pricing needs`)}.`;
    else if (gapAbs >= 0.005) n2 = m.gap > 0
      ? `The wholesaler's actual sheet prices this rate at ${sheetWord}, ${ptsU(m.gap)} (${m0(gapD)}) better for the borrower than this execution. To still hit its ${pts(lk.margin)}-pt margin it would have to value servicing at ${pts(m.impliedMsr)} pts. At the ${pts(m.msrPts)}-pt mark it earns ${pts(m.impliedMargin)} pts on this loan${m.impliedMargin < 0 ? ', a loss' : ''}. What fills a gap like this: specified-pool pay-ups, g-fee buy-downs, hedge results, the wholesaler's own servicing marks, or pricing to win volume.`
      : `The wholesaler's actual sheet prices this rate at ${sheetWord}, ${ptsU(gapAbs)} (${m0(gapD)}) worse for the borrower than this execution, so it earns about ${pts(m.impliedMargin)} pts on this loan, above its ${pts(lk.margin)}-pt target.`;
    else if (m.solvedMsr) n2 = `Reading the sheet backwards: at ${sheetWord} and a ${pts(lk.margin)}-pt margin, the wholesaler must be valuing the servicing on this loan at ${pts(m.msrPts)} pts, ${m.mult.toFixed(1)}× the ${pc(m.strip)} strip${m.excess > 0 ? ` (${pc(m.svc)} base plus ${pc(m.excess)} excess because the ${pc(m.rate)} note sits above the ${pc(lk.coupon)} coupon + ${pc(m.floor)})` : ''}. That is ${multWord(m.mult)}.${m.priceEst ? ` The ${pc(lk.coupon)} coupon price is estimated from the 6.5% quote; a real quote changes this split between premium and servicing, not the borrower's price.` : ''}`;
    else if (m.solvedMargin) n2 = `Reading the sheet backwards: at ${sheetWord} with servicing worth ${pts(m.msrPts)} pts, the wholesaler earns ${pts(lk.margin)} pts on this loan against UWM's reported 1.33-pt average.`;
    else n2 = `The wholesaler's actual sheet at this rate (${sheetWord}) matches the modeled execution, so it earns its ${pts(lk.margin)}-pt margin with servicing valued at ${pts(m.msrPts)} pts.`;
    const quarter = m.P * 0.25 / 100;
    const n3 = `Levers: every 0.25 pt of wholesaler margin or broker comp moves the borrower's price by 0.25 pt (${m0(quarter)} on this loan), and so does every 0.25 of MBS price. LO and MSFG split the ${pts(m.comp)}-pt comp ${pts(m.lo)} / ${pts(m.comp - m.lo)}; it is paid by the wholesaler out of the rate, never as a line item to the borrower.${m.crD > 0 ? ' Under lender-paid comp a credit can offset closing costs but cannot be returned as cash.' : ''}`;
    const n4 = m.mkD > 0
      ? `MSFG's ${m0(m.mkD)} is gross, not profit. At the shares entered it covers $${m.splitShow[0].toLocaleString('en-US')} of fixed cost, $${m.splitShow[1].toLocaleString('en-US')} of variable cost and $${m.splitShow[2].toLocaleString('en-US')} of one-time expense, leaving $${m.splitShow[3].toLocaleString('en-US')} of profit (${pts(m.splitD[3] / m.P * 100)} pts of the loan). The LO's ${m0(m.loD)} is the single largest line in the broker's share.`
      : `With LO comp equal to broker comp, MSFG keeps nothing on this loan and there is nothing to split.`;
    const notes1 = [n1, n2, n3, n4];
    if (m.moved) {
      const delta = m.margin - m.lockMargin;
      notes1.splice(2, 0, `Market move after lock: the execution went from ${pc(m.lockCoupon)} @ ${m.lockPrice.toFixed(2)} to ${pc(m.coupon)} @ ${m.price.toFixed(2)}, ${delta >= 0 ? 'a gain' : 'a drop'} of ${ptsU(Math.abs(delta))} (${m0(Math.abs(m.P * delta / 100))}). The borrower's price (${sheetWord}) and MSFG's ${pts(m.comp)}-pt comp were locked and the servicing mark is held at ${pts(m.msrPts)} pts, so the wholesaler's margin goes from ${pts(m.lockMargin)} to ${pts(m.margin)} pts${m.margin < 0 ? `, a ${m0(m.lossD)} loss the chart shows as the wholesaler's own capital flowing in` : ''}. This is why wholesalers hedge locked pipelines with TBA sales: the hedge gains what the loan loses. It cuts both ways; UWM's Q2 2026 results carried a $603 million hedge loss.`);
    }
    setNotes('notes1', notes1);

    const share = x => m.rev > 0 ? Math.round(x / m.rev * 100) + '%' : '0%';
    $('rev').innerHTML =
      card('b', 'Borrower-paid points · cash at closing', `${m0(m.bpD)} · ${m.bpD > 0 ? ptsU(-m.borrowerPts) : '0 pts'}`, share(m.bpD)) +
      (m.disc > 0
        ? card('y', 'MBS discount · cost at sale', `${m0(-m.disc)} · ${ptsU(m.premPts)} · the coupon trades below par`, 'cost')
        : card('', "Bond buyer's premium · cash at sale", `${m0(m.prem)} · ${ptsU(m.premPts)}`, share(m.prem))) +
      card('g', 'Servicing value · booked, not cash', `${m0(m.msr)} · ${ptsU(m.msrPts)}`, share(m.msr));
    $('revline').textContent = m.rev > 0
      ? `Of the ${m0(m.rev)} the wholesaler takes in beyond the principal (${pts(m.rev / m.P * 100)} pts), ${m0(m.bpD)} (${share(m.bpD)}) is extra cost to the borrower at closing${m.disc > 0 ? '' : `, ${m0(m.prem)} (${share(m.prem)}) comes from the bond buyer`}, and ${m0(m.msr)} (${share(m.msr)}) is servicing value it books rather than receives. That ${m.disc > 0 ? `covers the ${m0(m.disc)} MBS discount, ` : ''}${m.llpaD > 0 ? `pays Fannie's ${m0(m.llpaD)} in LLPAs, ` : ''}pays MSFG's ${m0(m.compD)} comp${m.crD > 0 ? `, returns ${m0(m.crD)} to the borrower as a credit,` : ''} and leaves the wholesaler ${m0(m.keep)}. Raise the margin or the comp and the borrower's share rises point for point; raise the MBS price or the servicing value and it falls.`
      : 'With no premium, no points, and no servicing value, the wholesaler has no front-end revenue on this loan.';

    $('sub2').textContent = `The bond buyer's ${pc(m.coupon)} = ${pc(m.tsy)} Treasury + ${pc(m.spread)} risk spread; default risk is priced in Fannie's g-fee.`;
    $('cap2').textContent = `Ribbon width = dollars, this chart only. Escrow and mortgage insurance excluded. The ${pc(m.rateRisk)} / ${pc(m.refi)} split of the ${pc(m.spread)} spread is an illustrative estimate, not market data. Treasury: ${pc(m.tsy)}${m.tsy === DEFAULTS.tsy ? ', Nov 17, 2026' : ', as entered'}.${m.excess > 0 ? ` Excess servicing of ${pc(m.excess)} appears because the note rate exceeds coupon + ${pc(m.floor)}.` : ''}`;
    setNotes('notes2', [`Bond buyer's ${pc(m.coupon)} = ${pc(m.tsy)} Treasury + ${pc(m.spread)} for rate and refi risk. Default risk is Fannie's, paid through the ${pc(m.gfee)} g-fee. The ${pc(m.strip)} servicing strip goes to whoever services the loan. Month 1 only: interest shrinks and principal grows over time.`]);

    $('msrcards').innerHTML =
      card('', 'Servicing strip', `${pc(m.svc)}/yr${m.excess > 0 ? ` + ${pc(m.excess)} excess` : ''}`) +
      card('', 'Gross servicing income', `${m2(m.servicer)}/mo, before costs`) +
      card('', 'MSR value', `${m0(m.msr)} (${ptsU(m.msrPts)}) · ${m.solvedMsr ? 'solved from the sheet' : 'your mark'} · ${m.mult.toFixed(1)}× the strip`);
  }

  // ---------- inputs ----------
  const FIELDS = ['loan','rate','sheet','llpa','coupon','price','tsy','comp','lo','margin','msr','svc','gfee','fixed','variable','onetime','profit','coupon2','price2'];
  function syncInputs(m){
    FIELDS.forEach(f => {
      const i = $('in-' + f); const s = $('src-' + f);
      if (!s.dataset.orig) s.dataset.orig = s.textContent;
      let label = null, cls = '';
      const edited = state[f] !== DEFAULTS[f];
      if (f === 'msr' && m.solvedMsr) { label = `Solved · ${m.mult.toFixed(1)}× the strip`; cls = 'solved'; i.disabled = true; if (document.activeElement !== i) i.value = Math.round(m.msrPts * 1000) / 1000; }
      else if (f === 'margin' && m.solvedMargin) { label = m.moved ? 'Solved at lock · see move tiles' : 'Solved from sheet price'; cls = 'solved'; i.disabled = true; if (document.activeElement !== i) i.value = Math.round(m.lockMargin * 1000) / 1000; }
      else if (f === 'comp' && m.solvedComp) { label = 'Solved from sheet price'; cls = 'solved'; i.disabled = true; if (document.activeElement !== i) i.value = Math.round(m.comp * 1000) / 1000; }
      else if (f === 'price' && m.solvedPrice) { label = `Solved · ${pc(m.coupon)} coupon`; cls = 'solved'; i.disabled = true; if (document.activeElement !== i) i.value = m.price.toFixed(2); }
      else if (f === 'sheet' && m.solvedSheet) { label = 'Solved · + = borrower pays'; cls = 'solved'; i.disabled = true; if (document.activeElement !== i) i.value = Math.round(-m.borrowerPts * 1000) / 1000; }
      else if (f === 'coupon2' || f === 'price2') {
        i.disabled = false;
        const lockVal = f === 'coupon2' ? m.lockCoupon : m.lockPrice;
        if (document.activeElement !== i) i.value = state[f] === null ? (f === 'price2' ? lockVal.toFixed(2) : lockVal) : state[f];
        if (state[f] === null || !m.moved) label = null;
        else if (f === 'price2' && state.price2Est) { label = 'Estimated for the new coupon · edit if you have the quote'; cls = 'solved'; }
        else { label = 'Market move'; cls = 'edited'; }
      }
      else {
        i.disabled = false;
        if (document.activeElement !== i) i.value = state[f];
        if (f === 'coupon' && state.couponAuto) { label = `Auto: highest coupon under rate − ${pc(state.gfee + state.svc)}`; cls = 'solved'; }
        else if (f === 'price' && state.priceEst) { label = `Estimated from 6.5 @ 100.69 · edit if you have the quote`; cls = 'solved'; }
        else if (edited) { label = f === 'sheet' ? 'Edited · + = borrower pays' : 'Edited'; cls = 'edited'; }
      }
      s.textContent = label || s.dataset.orig; s.className = 's ' + cls;
    });
    $('in-solve').value = state.solve;
    $('src-solve').textContent = state.solve === 'none' ? 'Compare modeled vs. sheet' : state.solve === 'sheet' ? 'From the other four variables' : 'So modeled price = sheet';
    if (m.moved) $('after').open = true;
  }
  function renderAll(){
    const m = compute(state);
    m.priceEst = state.priceEst;
    renderSankey(chart1Config(m), $('chart1'), $('info1'));
    renderSankey(chart2Config(m), $('chart2'), $('info2'));
    renderText(m);
    syncInputs(m);
  }
  FIELDS.forEach(f => $('in-' + f).addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (!isFinite(v)) return;
    if (v < 0 && f !== 'sheet') return;
    if (f === 'loan' && v < 1000) return;
    state[f] = v;
    if (f === 'rate' || f === 'svc' || f === 'gfee') {
      const c = autoCoupon(state.rate, state.svc, state.gfee);
      if (c !== state.coupon) { state.coupon = c; state.couponAuto = true; state.price = c === ANCHOR.coupon ? ANCHOR.price : estPrice(c); state.priceEst = c !== ANCHOR.coupon; }
      state.coupon2 = null; state.price2 = null; state.price2Est = false; // a new lock clears any after-lock move
    }
    if (f === 'coupon') { state.couponAuto = false; state.price = v === ANCHOR.coupon ? ANCHOR.price : estPrice(v); state.priceEst = v !== ANCHOR.coupon; }
    if (f === 'price') state.priceEst = false;
    if (f === 'coupon2') { state.price2 = v === ANCHOR.coupon ? ANCHOR.price : estPrice(v); state.price2Est = v !== ANCHOR.coupon; }
    if (f === 'price2') { state.price2Est = false; if (state.coupon2 === null) state.coupon2 = compute(state).lockCoupon; }
    renderAll();
  }));
  $('in-solve').addEventListener('change', e => { state.solve = e.target.value; renderAll(); });
  $('reset').addEventListener('click', () => { Object.assign(state, DEFAULTS, {couponAuto:false, priceEst:false, price2Est:false}); $('after').open = false; renderAll(); });
  $('inputs').addEventListener('submit', e => e.preventDefault());
  renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
