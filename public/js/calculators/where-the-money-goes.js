/**
 * Where the Money Goes — interactive training page.
 * One conventional loan: money at funding (Sankey 1) and every month (Sankey 2).
 * Pure client-side; every input recomputes the model, both charts and all copy.
 */

(function() {
  'use strict';

  function init() {
  const WM = MSFG.WtmgMath;
  const compute = WM.compute, autoCoupon = WM.autoCoupon, estPrice = WM.estPrice, pts = WM.pts, pc = WM.pc;
  const DEFAULTS = WM.DEFAULTS, ANCHOR = WM.ANCHOR, AVG_MARGIN = WM.AVG_MARGIN, SPLIT = WM.SPLIT;
  const C = {blue:'#3E7CC9', slate:'#5E6B78', green:'#2E9E6E', gray:'#9AA3AB'};
  const DEFAULT_INFO = "Hover or tap a ribbon to see how it's calculated.";
  const BAR = 10, PAD = 16, W = 1200;
  const NM_LH = 16, AMT_LH = 22, SB_LH = 14;
  const arr = v => Array.isArray(v) ? v : (v === null ? [] : [v]);

  const state = Object.assign({}, DEFAULTS, {couponAuto:false, priceEst:false, price2Est:false});

  // ---------- formatting ----------
  const m0 = x => MSFG.formatCurrency(x, 0);
  const m2 = x => MSFG.formatCurrency(x, 2);
  const ptsU = x => pts(x) + (Math.abs(Math.round(x * 1000) / 1000) === 1 ? ' pt' : ' pts');
  const kfmt = x => x >= 1e6 ? '$' + (x / 1e6).toFixed(x % 1e6 ? 2 : 0).replace(/\.?0+$/, '') + 'M' : '$' + Math.round(x / 1000) + 'K';

  // ---------- chart configs ----------
  function chart1Config(r){
    const m = r.after, lock = r.lock;
    const pv = 0.05 * m.P; // principal drawn as 5% of face
    const buyV = pv - m.disc; // below par, the buy-side principal ribbon shrinks by the discount
    const scale = 429 / (buyV + Math.max(0, m.prem) + m.bpD + m.msr + m.lossD);
    const borrowerSub = m.bpD > 0 ? ['loan funded · paid', `${m0(m.bpD)} in points`] : m.crD > 0 ? ['loan funded ·', `${m0(m.crD)} credit to costs`] : ['loan funded ·', 'pays $0 of the comp'];
    const nodes = [
      {id:'bb',  col:0, side:'left', color:'blue',  name:'Bond buyer', amount:m0(m.proceeds), sub:[`pays ${m.price.toFixed(2)} for the MBS`, r.moved ? `after the market move` : '', m.disc > 0 ? `${m0(m.disc)} below face` : '']},
      {id:'fn',  col:1, color:'slate', name:'Fannie Mae MBS', amount:m0(m.proceeds), sub:['swaps the loan for a', 'guaranteed bond']},
      {id:'bp',  col:1, color:'blue',  name:['Borrower-paid', 'points'], amount:m0(m.bpD), sub:[`${ptsU(-m.borrowerPts)} · cash at closing`, (m.mode === 'none' || m.solvedSheet) ? 'computed from the margins' : 'from the sheet price']},
      {id:'sr',  col:1, color:'gray',  name:["Wholesaler's", 'servicing rights'], amount:m0(m.msr), sub:[`${ptsU(m.msrPts)} · not cash`, `${m.mult.toFixed(1)}× the ${pc(m.strip)} strip`, m.solvedMsr ? 'solved from the sheet' : 'estimate']},
      {id:'wl',  col:1, color:'slate', name:['Wholesaler', 'absorbs a loss'], amount:m0(m.lossD), sub:[`${ptsU(m.lossPts)} · its own capital`, 'unless its hedge covers it']},
      {id:'uwm', col:2, color:'slate', name:['Wholesaler', '(wholesale lender)'], amount:m0(m.uwmIn), sub:[`prices ${pc(m.rate)} at`, `${m.borrowerPts === 0 ? 'par' : (m.borrowerPts < 0 ? '−' : '+') + ptsU(Math.abs(m.borrowerPts))} after comp`]},
      {id:'msfg',col:3, color:'slate', name:'MSFG', amount:m0(m.compD), sub:[`${pts(m.comp)}% lender-paid comp`]},
      {id:'lo',  col:4, color:'green', name:['Loan officer', `${pts(m.lo)} pts`], amount:m0(m.loD), sub:[]},
      {id:'mk',  col:4, color:'slate', name:['MSFG keeps', `${pts(m.comp - m.lo)} pts`], amount:m0(m.mkD), sub:['before expenses, not profit']},
      ...SPLIT.map(([id, name], i) => ({id:'sp_' + id, col:5, color:'green', name:`${name} · ${pts(m.shares[i])}%`, amount:m0(m.splitShow[i]), sub:[]})),
      {id:'llpa', col:5, color:'green', name:['Fannie Mae', `LLPAs · ${pts(m.llpa)} pts`], amount:m0(m.llpaD), sub:['upfront risk fee,', 'passed to the borrower']},
      {id:'br',  col:5, color:'green', name:'Borrower', amount:m0(m.P), sub:borrowerSub},
      {id:'uk',  col:5, color:'green', name:['Wholesaler keeps', `${pts(m.margin)} pts`], amount:m0(m.keep), sub:[r.moved ? `margin after move · was ${pts(lock.margin)}` : m.solvedMargin ? 'margin · solved from sheet' : m.margin === AVG_MARGIN ? 'margin · UWM Q2 2026 avg.' : 'margin input']}
    ];
    nodes.forEach(n => { n.sub = n.sub.filter(Boolean); });
    const eq = `${pts(lock.premPts)} premium + ${pts(m.msrPts)} servicing − ${pts(lock.margin)} margin − ${pts(m.comp)} comp${m.llpa > 0 ? ` − ${pts(m.llpa)} LLPAs` : ''} = ${pts(m.borrowerPts)} pts${r.moved ? ' at lock' : ''}`;
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
      {s:'sr', t:'uwm', v:m.msr, label:m0(m.msr), dashed:true, text:`${m0(m.P)} × ${pts(m.msrPts)} / 100 = ${m0(m.msr)}. ${m.solvedMsr ? `Solved at lock: sheet ${pts(m.sheetPts)} − premium ${pts(lock.premPts)} + margin ${pts(lock.margin)} + comp ${pts(m.comp)} = ${pts(m.msrPts)} pts. ` : ''}The value the wholesaler books for keeping the ${pc(m.strip)} servicing strip${m.excess > 0 ? ` (${pc(m.svc)} base + ${pc(m.excess)} excess)` : ''}, about ${m2(m.servicer)} a month before costs; ${m.mult.toFixed(1)}× the annual strip. An estimate, not cash at funding. Typical marks run 3.5–5×; a large wholesaler like UWM carries its book at about 1.7–2.1% of UPB on 5.90%-rate loans.`},
      {s:'uwm', t:'msfg', v:m.compD, label:m0(m.compD), text:`${m0(m.P)} × ${pts(m.comp)} / 100 = ${m0(m.compD)}. The wholesaler pays MSFG's ${pts(m.comp)}% lender-paid comp out of the loan's value; the borrower pays nothing for it directly, it's built into the ${pc(m.rate)} rate.`},
      {s:'uwm', t:'llpa', v:m.llpaD, label:m0(m.llpaD), text:`${m0(m.P)} × ${pts(m.llpa)} / 100 = ${m0(m.llpaD)}. Loan-level price adjustments: Fannie Mae's upfront fee for this file's risk (credit score, LTV, occupancy, property type, cash-out), charged when the loan is delivered. The wholesaler passes it straight through to the borrower's price, point for point.`},
      {s:'uwm', t:'br', v:pv, label:`principal ${m0(m.P)}`, broken:true, text:`The wholesaler wires ${m0(m.P)} at closing (to the seller or to pay off the old loan). Drawn shortened.`},
      {s:'uwm', t:'br', v:m.crD, label:`credit ${m0(m.crD)}`, text:`Borrower price: ${eq}. Positive, so the wholesaler gives the borrower ${m0(m.P)} × ${pts(m.borrowerPts)} / 100 = ${m0(m.crD)} as a lender credit toward closing costs. Under lender-paid comp a credit can offset costs but cannot be paid out as cash.`},
      {s:'uwm', t:'uk', v:m.keep, label:m0(m.keep), text:`${m0(m.P)} × ${pts(m.margin)} / 100 = ${m0(m.keep)}. ` + (r.moved ? `Margin after the market move: ${pts(lock.margin)} at lock ${m.premPts - lock.premPts >= 0 ? '+' : '−'} ${pts(Math.abs(m.premPts - lock.premPts))} change in execution = ${pts(m.margin)} pts. The borrower's price, the comp and the servicing mark were already set, so the move lands here.` : m.solvedMargin ? `Solved: premium ${pts(m.premPts)} + servicing ${pts(m.msrPts)} − comp ${pts(m.comp)} − sheet ${pts(m.sheetPts)} = ${pts(m.margin)} pts, against UWM's reported Q2 2026 average of 1.33.` : m.margin === AVG_MARGIN ? "The default is UWM's reported Q2 2026 average total gain margin (133 bps), a company average, not a loan-level number." : `Set by the wholesaler margin input (${pts(m.margin)} pts; UWM's reported Q2 2026 average was 1.33).`)},
      {s:'msfg', t:'lo', v:m.loD, label:m0(m.loD), text:`${m0(m.P)} × ${pts(m.lo)} pts / 100 = ${m0(m.loD)}.`},
      {s:'msfg', t:'mk', v:m.mkD, label:m0(m.mkD), text:`${m0(m.compD)} − ${m0(m.loD)} = ${m0(m.mkD)}. Gross to the company, before expenses; the four ribbons out of it show where it goes.`},
      ...SPLIT.map(([id, name, desc], i) => ({s:'mk', t:'sp_' + id, v:m.splitD[i], label:m0(m.splitShow[i]), text:`${m0(m.mkD)} × ${pts(m.shares[i])}% = ${m0(m.splitShow[i])} (${pts(m.splitD[i] / m.P * 100)} pts of the loan). ${name}: ${desc}. The shares are MSFG's own allocation assumptions, editable above.`}))
    ];
    return {scale, gap:12, colX:[150, 320, 490, 660, 830, 1000], nodes, links};
  }

  function chart2Config(r){
    const m = r.monthly;
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

  function renderText(r){
    const lock = r.lock, after = r.after, month = r.monthly;
    $('lede').textContent = `One ${kfmt(after.P)} loan: money at closing, money every month.`;
    const w = $('warnings'); w.hidden = !r.warnings.length; w.textContent = r.warnings.join(' ');
    $('in-result').textContent = after.borrowerPts === 0 ? 'Par' : after.borrowerPts < 0 ? `Pays ${ptsU(-after.borrowerPts)}` : `Credit ${ptsU(after.borrowerPts)}`;

    const gapAbs = Math.abs(after.gap), gapD = after.P * gapAbs / 100;
    const sheetWord = after.sheetPts === 0 ? 'par after comp' : after.sheetPts < 0 ? `borrower pays ${ptsU(-after.sheetPts)}` : `${ptsU(after.sheetPts)} credit`;
    const sheetSrc = after.solvedSheet ? 'Computed from the other four variables; no sheet entered' : after.sheetCost === DEFAULTS.sheet && after.rate === DEFAULTS.rate ? 'Source: UWM sheet at 7.25%, base −0.234 + 2.25% lender-paid comp' : 'As entered from the sheet';
    const estNote = r.priceEst ? ` (estimated from the 6.5% quote)` : '';
    let tile3;
    if (after.solvedSheet) {
      tile3 = card(after.borrowerPts < 0 ? 'b' : 'gr', 'Borrower points, solved', `${after.borrowerPts < 0 ? m0(after.bpD) + ' paid at closing' : after.borrowerPts > 0 ? m0(after.crD) + ' lender credit' : 'no points, no credit'} on ${m0(after.P)}`, priceWord(after.borrowerPts), `${pts(lock.margin)} margin + ${pts(after.comp)} comp − ${pts(lock.premPts)} premium − ${pts(after.msrPts)} servicing = ${pts(-after.borrowerPts)} pts to the borrower. Compare it with the wholesaler's grid at ${pc(after.rate)}.`);
    } else if (after.solvedComp) {
      tile3 = card(after.comp < 0.005 ? 'y' : 'g', 'Implied broker comp', `LO ${pts(after.lo)} / MSFG ${pts(after.comp - after.lo)} · ${m0(after.compD)}`, ptsU(after.comp), `What the sheet price leaves for the broker after a ${pts(lock.margin)}-pt margin with servicing at ${pts(after.msrPts)} pts${estNote}. The UWM example sheet is built on 2.25.`);
    } else if (after.solvedPrice) {
      tile3 = card(lock.premPts < 0 ? 'y' : 'g', `Implied MBS price · ${pc(lock.coupon)} coupon`, `${lock.premPts < 0 ? 'discount' : 'premium'} of ${ptsU(Math.abs(lock.premPts))} · ${m0(lock.prem)} · vs. ${estPrice(lock.coupon).toFixed(2)} ${lock.coupon === ANCHOR.coupon ? 'quoted' : 'estimated'}`, lock.price.toFixed(2), `The execution the wholesaler needs to sell this loan at ${sheetWord} with a ${pts(lock.margin)}-pt margin, ${pts(after.comp)} comp and servicing at ${pts(after.msrPts)} pts.`);
    } else if (gapAbs >= 0.005) {
      tile3 = after.gap > 0
        ? card('y', 'Gap: sheet vs. modeled execution', `The sheet is ${m0(gapD)} richer for the borrower than this execution`, `${ptsU(after.gap)} better`, `To hit ${pts(lock.margin)} pts at the sheet price the wholesaler needs servicing worth ${pts(after.impliedMsr)} pts; at ${pts(after.msrPts)} pts it earns ${pts(after.impliedMargin)} pts here.`)
        : card('y', 'Gap: sheet vs. modeled execution', `The sheet costs the borrower ${m0(gapD)} more than this execution`, `${ptsU(gapAbs)} worse`, `At the sheet price the wholesaler earns ${pts(after.impliedMargin)} pts on this loan, above its ${pts(lock.margin)}-pt target.`);
    } else if (after.solvedMargin) {
      tile3 = card(lock.margin < AVG_MARGIN - 0.005 ? 'y' : 'gr', 'Implied wholesaler margin', `vs. UWM's 1.33-pt Q2 2026 average · servicing held at ${pts(after.msrPts)} pts`, ptsU(lock.margin), lock.margin < AVG_MARGIN - 0.005 ? `The sheet is ${pts(AVG_MARGIN - lock.margin)} pts thinner than average at this rate.` : lock.margin > AVG_MARGIN + 0.005 ? `The sheet is ${pts(lock.margin - AVG_MARGIN)} pts richer than average at this rate.` : 'Right at the average.');
    } else if (after.solvedMsr) {
      tile3 = card(after.mult < 3 || after.mult > 5 ? 'y' : 'g', 'Implied servicing value', `${after.mult.toFixed(1)}× the ${pc(after.strip)} annual strip · ${m0(after.msr)}`, ptsU(after.msrPts), `Backed out of the sheet at a ${pts(lock.margin)}-pt margin; ${multWord(after.mult)}.`);
    } else {
      tile3 = card('', 'Gap: sheet vs. modeled execution', 'Sheet matches this execution', '0 pts', `The wholesaler earns its ${pts(lock.margin)}-pt margin at the entered servicing value.`);
    }
    const mv = $('move'); mv.hidden = !r.moved;
    if (r.moved) {
      const delta = after.margin - lock.margin;
      mv.innerHTML =
        card('', 'At lock', `${pc(lock.coupon)} coupon @ ${lock.price.toFixed(2)} · ${m0(after.P * lock.margin / 100)}`, `${ptsU(lock.margin)} margin`, 'The execution the sheet price was built on.') +
        card(after.margin < 0 ? 'y' : 'gr', 'After the market move', `${pc(after.coupon)} coupon @ ${after.price.toFixed(2)} · ${m0(after.P * after.margin / 100)}`, after.margin < 0 ? `${ptsU(after.margin)} · a loss` : `${ptsU(after.margin)} margin`, "The borrower's price, MSFG's comp and the servicing mark are locked, so the margin absorbs the move.") +
        card('y', 'Change to the wholesaler', `${m0(after.P * delta / 100)} on this loan`, `${delta >= 0 ? '+' : ''}${ptsU(delta)}`, after.margin < 0 ? `The wholesaler funds ${m0(after.lossD)} from its own capital unless its hedge covers it.` : 'A hedged pipeline offsets this with TBA positions; unhedged, it flows straight to the margin.');
    }
    $('pricing').innerHTML =
      card(after.borrowerPts < 0 ? 'b' : after.borrowerPts > 0 ? 'gr' : '', `Modeled borrower price at ${pc(after.rate)}`, after.borrowerPts === 0 ? 'No points, no credit' : after.borrowerPts < 0 ? `${m0(after.bpD)} in points at closing` : `${m0(after.crD)} lender credit toward closing costs`, priceWord(after.borrowerPts),
           `${pts(lock.premPts)} premium + ${pts(after.msrPts)} servicing − ${pts(lock.margin)} margin − ${pts(after.comp)} comp${after.llpa > 0 ? ` − ${pts(after.llpa)} LLPAs` : ''}`) +
      card('', `Wholesaler's rate sheet at ${pc(after.rate)}`, sheetWord, after.sheetPts === 0 ? 'Par' : priceWord(after.sheetPts), sheetSrc) +
      tile3;

    $('cap1').textContent = `Ribbon width = dollars, this chart only. Principal ribbons (//) are drawn shortened; every other width is to scale. One-time, at funding. Lender-paid comp: the borrower pays nothing out of pocket for it; it's built into the ${pc(after.rate)} rate. Borrower points or credit come from the sheet price and the margins, not typed in.${after.disc > 0 ? ` The ${pc(after.coupon)} coupon trades below par, so the buy-side principal ribbons are drawn ${m0(after.disc)} thinner than the funding ribbon.` : ''}`;

    const worth = lock.premPts + after.msrPts;
    const n1 = `At ${pc(after.rate)} with a ${pc(lock.coupon)} coupon at ${lock.price.toFixed(2)}, this loan is worth ${pts(worth)} pts to the wholesaler (${pts(lock.premPts)} ${lock.premPts < 0 ? 'discount' : 'premium'} in cash ${lock.premPts < 0 ? 'offset by' : '+'} ${pts(after.msrPts)} servicing value). After the wholesaler's ${pts(lock.margin)}-pt margin${after.llpa > 0 ? `, Fannie's ${pts(after.llpa)}-pt LLPAs` : ''} and MSFG's ${pts(after.comp)}-pt comp, ${pts(after.borrowerPts)} pts is left for the borrower: ` +
      (after.borrowerPts < 0 ? `they pay ${m0(after.bpD)} in points at closing.` : after.borrowerPts > 0 ? `they get a ${m0(after.crD)} lender credit toward closing costs.` : `par, no points and no credit.`);
    let n2;
    if (after.solvedSheet) n2 = `No sheet price entered: the borrower's price is what falls out of the other four variables. At a ${pts(lock.margin)}-pt margin, ${pts(after.comp)}-pt comp, ${pts(lock.premPts)}-pt ${lock.premPts < 0 ? 'discount' : 'premium'}${estNote} and ${pts(after.msrPts)} pts of servicing value, the borrower ${after.borrowerPts < 0 ? `pays ${ptsU(-after.borrowerPts)} (${m0(after.bpD)})` : after.borrowerPts > 0 ? `gets a ${ptsU(after.borrowerPts)} credit (${m0(after.crD)})` : 'is at par'}. If the wholesaler's grid shows a different number at ${pc(after.rate)}, the difference is in the servicing mark or the margin.`;
    else if (after.solvedComp) n2 = `Reading the sheet backwards for comp: at ${sheetWord}, a ${pts(lock.margin)}-pt margin and servicing worth ${pts(after.msrPts)} pts, the loan supports ${ptsU(after.comp)} of broker comp (${m0(after.compD)}). ${after.comp > 2.25 + 0.005 ? 'That is more than the 2.25 the example sheet is built on, so this pricing leaves room.' : after.comp < 2.25 - 0.005 ? 'That is less than the 2.25 the example sheet is built on: at this price, comp would have to come down or the borrower would pay more.' : 'That matches the 2.25 the example sheet is built on.'}`;
    else if (after.solvedPrice) n2 = `Reading the sheet backwards for execution: to sell this loan at ${sheetWord} while keeping a ${pts(lock.margin)}-pt margin, paying ${pts(after.comp)} comp and valuing servicing at ${pts(after.msrPts)} pts, the wholesaler needs ${lock.price.toFixed(2)} for the ${pc(lock.coupon)} coupon, a ${pts(Math.abs(lock.premPts))}-pt ${lock.premPts < 0 ? 'discount' : 'premium'}. The ${lock.coupon === ANCHOR.coupon ? 'quoted' : 'estimated'} price is ${estPrice(lock.coupon).toFixed(2)}, so the market is ${Math.abs(lock.price - estPrice(lock.coupon)) < 0.005 ? 'right there' : (lock.price > estPrice(lock.coupon) ? `${pts(lock.price - estPrice(lock.coupon))} pts short of what this pricing needs` : `${pts(estPrice(lock.coupon) - lock.price)} pts better than this pricing needs`)}.`;
    else if (gapAbs >= 0.005) n2 = after.gap > 0
      ? `The wholesaler's actual sheet prices this rate at ${sheetWord}, ${ptsU(after.gap)} (${m0(gapD)}) better for the borrower than this execution. To still hit its ${pts(lock.margin)}-pt margin it would have to value servicing at ${pts(after.impliedMsr)} pts. At the ${pts(after.msrPts)}-pt mark it earns ${pts(after.impliedMargin)} pts on this loan${after.impliedMargin < 0 ? ', a loss' : ''}. What fills a gap like this: specified-pool pay-ups, g-fee buy-downs, hedge results, the wholesaler's own servicing marks, or pricing to win volume.`
      : `The wholesaler's actual sheet prices this rate at ${sheetWord}, ${ptsU(gapAbs)} (${m0(gapD)}) worse for the borrower than this execution, so it earns about ${pts(after.impliedMargin)} pts on this loan, above its ${pts(lock.margin)}-pt target.`;
    else if (after.solvedMsr) n2 = `Reading the sheet backwards: at ${sheetWord} and a ${pts(lock.margin)}-pt margin, the wholesaler must be valuing the servicing on this loan at ${pts(after.msrPts)} pts, ${after.mult.toFixed(1)}× the ${pc(after.strip)} strip${after.excess > 0 ? ` (${pc(after.svc)} base plus ${pc(after.excess)} excess because the ${pc(after.rate)} note sits above the ${pc(lock.coupon)} coupon + ${pc(after.floor)})` : ''}. That is ${multWord(after.mult)}.${r.priceEst ? ` The ${pc(lock.coupon)} coupon price is estimated from the 6.5% quote; a real quote changes this split between premium and servicing, not the borrower's price.` : ''}`;
    else if (after.solvedMargin) n2 = `Reading the sheet backwards: at ${sheetWord} with servicing worth ${pts(after.msrPts)} pts, the wholesaler earns ${pts(lock.margin)} pts on this loan against UWM's reported 1.33-pt average.`;
    else n2 = `The wholesaler's actual sheet at this rate (${sheetWord}) matches the modeled execution, so it earns its ${pts(lock.margin)}-pt margin with servicing valued at ${pts(after.msrPts)} pts.`;
    const quarter = after.P * 0.25 / 100;
    const n3 = `Levers: every 0.25 pt of wholesaler margin or broker comp moves the borrower's price by 0.25 pt (${m0(quarter)} on this loan), and so does every 0.25 of MBS price. LO and MSFG split the ${pts(after.comp)}-pt comp ${pts(after.lo)} / ${pts(after.comp - after.lo)}; it is paid by the wholesaler out of the rate, never as a line item to the borrower.${after.crD > 0 ? ' Under lender-paid comp a credit can offset closing costs but cannot be returned as cash.' : ''}`;
    const n4 = after.mkD > 0
      ? `MSFG's ${m0(after.mkD)} is gross, not profit. At the shares entered it covers ${m0(after.splitShow[0])} of fixed cost, ${m0(after.splitShow[1])} of variable cost and ${m0(after.splitShow[2])} of one-time expense, leaving ${m0(after.splitShow[3])} of profit (${pts(after.splitD[3] / after.P * 100)} pts of the loan). The LO's ${m0(after.loD)} is the single largest line in the broker's share.`
      : `With LO comp equal to broker comp, MSFG keeps nothing on this loan and there is nothing to split.`;
    const notes1 = [n1, n2, n3, n4];
    if (r.moved) {
      const delta = after.margin - lock.margin;
      notes1.splice(2, 0, `Market move after lock: the execution went from ${pc(lock.coupon)} @ ${lock.price.toFixed(2)} to ${pc(after.coupon)} @ ${after.price.toFixed(2)}, ${delta >= 0 ? 'a gain' : 'a drop'} of ${ptsU(Math.abs(delta))} (${m0(Math.abs(after.P * delta / 100))}). The borrower's price (${sheetWord}) and MSFG's ${pts(after.comp)}-pt comp were locked and the servicing mark is held at ${pts(after.msrPts)} pts, so the wholesaler's margin goes from ${pts(lock.margin)} to ${pts(after.margin)} pts${after.margin < 0 ? `, a ${m0(after.lossD)} loss the chart shows as the wholesaler's own capital flowing in` : ''}. This is why wholesalers hedge locked pipelines with TBA sales: the hedge gains what the loan loses. It cuts both ways; UWM's Q2 2026 results carried a $603 million hedge loss.`);
    }
    setNotes('notes1', notes1);

    const share = x => after.rev > 0 ? Math.round(x / after.rev * 100) + '%' : '0%';
    $('rev').innerHTML =
      card('b', 'Borrower-paid points · cash at closing', `${m0(after.bpD)} · ${after.bpD > 0 ? ptsU(-after.borrowerPts) : '0 pts'}`, share(after.bpD)) +
      (after.disc > 0
        ? card('y', 'MBS discount · cost at sale', `${m0(-after.disc)} · ${ptsU(after.premPts)} · the coupon trades below par`, 'cost')
        : card('', "Bond buyer's premium · cash at sale", `${m0(after.prem)} · ${ptsU(after.premPts)}`, share(after.prem))) +
      card('g', 'Servicing value · booked, not cash', `${m0(after.msr)} · ${ptsU(after.msrPts)}`, share(after.msr));
    $('revline').textContent = after.rev > 0
      ? `Of the ${m0(after.rev)} the wholesaler takes in beyond the principal (${pts(after.rev / after.P * 100)} pts), ${m0(after.bpD)} (${share(after.bpD)}) is extra cost to the borrower at closing${after.disc > 0 ? '' : `, ${m0(after.prem)} (${share(after.prem)}) comes from the bond buyer`}, and ${m0(after.msr)} (${share(after.msr)}) is servicing value it books rather than receives. That ${after.disc > 0 ? `covers the ${m0(after.disc)} MBS discount, ` : ''}${after.llpaD > 0 ? `pays Fannie's ${m0(after.llpaD)} in LLPAs, ` : ''}pays MSFG's ${m0(after.compD)} comp${after.crD > 0 ? `, returns ${m0(after.crD)} to the borrower as a credit,` : ''} and leaves the wholesaler ${m0(after.keep)}. Raise the margin or the comp and the borrower's share rises point for point; raise the MBS price or the servicing value and it falls.`
      : 'With no premium, no points, and no servicing value, the wholesaler has no front-end revenue on this loan.';

    $('sub2').textContent = `The bond buyer's ${pc(after.coupon)} = ${pc(after.tsy)} Treasury + ${pc(month.spread)} risk spread; default risk is priced in Fannie's g-fee.`;
    $('cap2').textContent = `Ribbon width = dollars, this chart only. Escrow and mortgage insurance excluded. The ${pc(month.rateRisk)} / ${pc(month.refi)} split of the ${pc(month.spread)} spread is an illustrative estimate, not market data. Treasury: ${pc(after.tsy)}${after.tsy === DEFAULTS.tsy ? ', Nov 17, 2026' : ', as entered'}.${after.excess > 0 ? ` Excess servicing of ${pc(after.excess)} appears because the note rate exceeds coupon + ${pc(after.floor)}.` : ''}`;
    setNotes('notes2', [`Bond buyer's ${pc(after.coupon)} = ${pc(after.tsy)} Treasury + ${pc(month.spread)} for rate and refi risk. Default risk is Fannie's, paid through the ${pc(after.gfee)} g-fee. The ${pc(after.strip)} servicing strip goes to whoever services the loan. Month 1 only: interest shrinks and principal grows over time.`]);

    $('msrcards').innerHTML =
      card('', 'Servicing strip', `${pc(after.svc)}/yr${after.excess > 0 ? ` + ${pc(after.excess)} excess` : ''}`) +
      card('', 'Gross servicing income', `${m2(after.servicer)}/mo, before costs`) +
      card('', 'MSR value', `${m0(after.msr)} (${ptsU(after.msrPts)}) · ${after.solvedMsr ? 'solved from the sheet' : 'your mark'} · ${after.mult.toFixed(1)}× the strip`);
  }

  // ---------- inputs ----------
  const FIELDS = ['loan','rate','sheet','llpa','coupon','price','tsy','comp','lo','margin','msr','svc','gfee','fixed','variable','onetime','profit','coupon2','price2'];
  function syncInputs(r){
    const lock = r.lock;
    FIELDS.forEach(f => {
      const i = $('in-' + f); const s = $('src-' + f);
      if (!s.dataset.orig) s.dataset.orig = s.textContent;
      let label = null, cls = '';
      const edited = state[f] !== DEFAULTS[f];
      if (f === 'msr' && lock.solvedMsr) { label = `Solved · ${lock.mult.toFixed(1)}× the strip`; cls = 'solved'; i.disabled = true; if (document.activeElement !== i) i.value = Math.round(lock.msrPts * 1000) / 1000; }
      else if (f === 'margin' && lock.solvedMargin) { label = r.moved ? 'Solved at lock · see move tiles' : 'Solved from sheet price'; cls = 'solved'; i.disabled = true; if (document.activeElement !== i) i.value = Math.round(lock.margin * 1000) / 1000; }
      else if (f === 'comp' && lock.solvedComp) { label = 'Solved from sheet price'; cls = 'solved'; i.disabled = true; if (document.activeElement !== i) i.value = Math.round(lock.comp * 1000) / 1000; }
      else if (f === 'price' && lock.solvedPrice) { label = `Solved · ${pc(lock.coupon)} coupon`; cls = 'solved'; i.disabled = true; if (document.activeElement !== i) i.value = lock.price.toFixed(2); }
      else if (f === 'sheet' && lock.solvedSheet) { label = 'Solved · + = borrower pays'; cls = 'solved'; i.disabled = true; if (document.activeElement !== i) i.value = Math.round(-lock.borrowerPts * 1000) / 1000; }
      else if (f === 'coupon2' || f === 'price2') {
        i.disabled = false;
        const lockVal = f === 'coupon2' ? lock.coupon : lock.price;
        if (document.activeElement !== i) i.value = state[f] === null ? (f === 'price2' ? lockVal.toFixed(2) : lockVal) : state[f];
        if (state[f] === null || !r.moved) label = null;
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
    if (r.moved) $('after').open = true;
  }
  function renderAll(){
    const r = compute(state);
    r.priceEst = state.priceEst;
    renderSankey(chart1Config(r), $('chart1'), $('info1'));
    renderSankey(chart2Config(r), $('chart2'), $('info2'));
    renderText(r);
    syncInputs(r);
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
    if (f === 'price2') { state.price2Est = false; if (state.coupon2 === null) state.coupon2 = compute(state).lock.coupon; }
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
