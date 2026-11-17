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
    const DEFAULTS = WM.DEFAULTS, ANCHOR = WM.ANCHOR, AVG_MARGIN = WM.AVG_MARGIN, SPLIT = WM.SPLIT, S = WM.SOURCES;
    const C = {blue:'#3E7CC9', slate:'#5E6B78', green:'#2E9E6E', gray:'#9AA3AB'};
    const DEFAULT_INFO = "Hover or tap a ribbon to see how it's calculated.";
    const BAR = 10, PAD = 16, W = 1200;
    const NM_LH = 16, AMT_LH = 22, SB_LH = 14;
    const arr = v => Array.isArray(v) ? v : (v === null ? [] : [v]);

    const state = Object.assign({}, DEFAULTS, {couponAuto:false, priceEst:false, price2Est:false});

    // ---------- formatting ----------
    const m0 = x => MSFG.formatCurrency(x, 0);
    const m2 = x => MSFG.formatCurrency(x, 2);
    const CP = MSFG.WtmgCopy;
    const ptsU = CP.ptsU;

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
        {id:'uk',  col:5, color:'green', name:['Wholesaler keeps', `${pts(m.margin)} pts`], amount:m0(m.keep), sub:[r.moved ? `margin after move · was ${pts(lock.margin)}` : m.solvedMargin ? 'margin · solved from sheet' : m.margin === AVG_MARGIN ? `margin · ${S.wholesaler} ${S.margin.period} avg.` : 'margin input']}
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
        {s:'sr', t:'uwm', v:m.msr, label:m0(m.msr), dashed:true, text:`${m0(m.P)} × ${pts(m.msrPts)} / 100 = ${m0(m.msr)}. ${m.solvedMsr ? `Solved at lock: sheet ${pts(m.sheetPts)} − premium ${pts(lock.premPts)} + margin ${pts(lock.margin)} + comp ${pts(m.comp)} = ${pts(m.msrPts)} pts. ` : ''}The value the wholesaler books for keeping the ${pc(m.strip)} servicing strip${m.excess > 0 ? ` (${pc(m.svc)} base + ${pc(m.excess)} excess)` : ''}, about ${m2(m.servicer)} a month before costs; ${m.mult.toFixed(1)}× the annual strip. An estimate, not cash at funding. Typical marks run 3.5–5×; a large wholesaler like ${S.wholesaler} carries its book at about ${S.servicingBook.low}–${S.servicingBook.high}% of UPB on ${S.servicingBook.wac.toFixed(2)}%-rate loans.`},
        {s:'uwm', t:'msfg', v:m.compD, label:m0(m.compD), text:`${m0(m.P)} × ${pts(m.comp)} / 100 = ${m0(m.compD)}. The wholesaler pays MSFG's ${pts(m.comp)}% lender-paid comp out of the loan's value; the borrower pays nothing for it directly, it's built into the ${pc(m.rate)} rate.`},
        {s:'uwm', t:'llpa', v:m.llpaD, label:m0(m.llpaD), text:`${m0(m.P)} × ${pts(m.llpa)} / 100 = ${m0(m.llpaD)}. Loan-level price adjustments: Fannie Mae's upfront fee for this file's risk (credit score, LTV, occupancy, property type, cash-out), charged when the loan is delivered. The wholesaler passes it straight through to the borrower's price, point for point.`},
        {s:'uwm', t:'br', v:pv, label:`principal ${m0(m.P)}`, broken:true, text:`The wholesaler wires ${m0(m.P)} at closing (to the seller or to pay off the old loan). Drawn shortened.`},
        {s:'uwm', t:'br', v:m.crD, label:`credit ${m0(m.crD)}`, text:`Borrower price: ${eq}. Positive, so the wholesaler gives the borrower ${m0(m.P)} × ${pts(m.borrowerPts)} / 100 = ${m0(m.crD)} as a lender credit toward closing costs. Under lender-paid comp a credit can offset costs but cannot be paid out as cash.`},
        {s:'uwm', t:'uk', v:m.keep, label:m0(m.keep), text:`${m0(m.P)} × ${pts(m.margin)} / 100 = ${m0(m.keep)}. ` + (r.moved ? `Margin after the market move: ${pts(lock.margin)} at lock ${m.premPts - lock.premPts >= 0 ? '+' : '−'} ${pts(Math.abs(m.premPts - lock.premPts))} change in execution = ${pts(m.margin)} pts. The borrower's price, the comp and the servicing mark were already set, so the move lands here.` : m.solvedMargin ? `Solved: premium ${pts(m.premPts)} + servicing ${pts(m.msrPts)} − comp ${pts(m.comp)} − sheet ${pts(m.sheetPts)} = ${pts(m.margin)} pts, against ${S.wholesaler}'s reported ${S.margin.period} average of ${pts(S.margin.pts)}.` : m.margin === AVG_MARGIN ? `The default is ${S.wholesaler}'s reported ${S.margin.period} average total gain margin (${S.margin.bps} bps), a company average, not a loan-level number.` : `Set by the wholesaler margin input (${pts(m.margin)} pts; ${S.wholesaler}'s reported ${S.margin.period} average was ${pts(S.margin.pts)}).`)},
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
        tr: `${m0(m.P)} × ${pc(m.tsy)} ÷ 12. 10-yr Treasury yield${m.tsy === DEFAULTS.tsy ? ` on ${S.asOf}` : ' as entered'}.`,
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
    // Card descriptors ({cls, k, v, big, f}) from the copy module become DOM nodes; no HTML strings are assembled.
    const span = (cls, text) => { const e = document.createElement('span'); e.className = cls; e.textContent = text; return e; };
    const cardEl = d => {
      const e = document.createElement('div');
      e.className = 'card ' + d.cls;
      e.appendChild(span('k', d.k));
      if (d.big !== undefined && d.big !== null) e.appendChild(span('pct', d.big));
      e.appendChild(span('v', d.v));
      if (d.f) e.appendChild(span('f', d.f));
      return e;
    };
    const fill = (el, list) => { el.textContent = ''; list.forEach(d => el.appendChild(cardEl(d))); };

    // All sentences and tile text come from MSFG.WtmgCopy; this only places them.
    function renderText(r){
      const w = $('warnings'); w.hidden = !r.warnings.length; w.textContent = r.warnings.join(' ');
      $('in-result').textContent = CP.result(r);
      const mv = $('move'); mv.hidden = !r.moved;
      if (r.moved) fill(mv, CP.moveTiles(r));
      fill($('pricing'), CP.pricingTiles(r));
      setNotes('notes1', CP.notes1(r));
      const rev = CP.revenue(r);
      fill($('rev'), rev.cards);
      $('revline').textContent = rev.line;
      $('sub2').textContent = CP.sub2(r);
      setNotes('notes2', CP.notes2(r));
      fill($('msrcards'), CP.msrCards(r));
      renderLlpaPanel(r);
    }
    // LLPA breakdown under the borrower inputs: a heading line, the matrix lines, a footer with the total and matrix date.
    function renderLlpaPanel(r){
      const lp = CP.llpaPanel(r), panel = $('llpaPanel');
      panel.textContent = '';
      panel.appendChild(h('p', {class:'llpa-head', text:lp.head}));
      if (lp.rows.length) {
        panel.appendChild(h('table', {class:'llpa-table'}, [
          h('thead', {}, [h('tr', {}, [h('th', {text:'Adjustment'}), h('th', {class:'num', text:'Points'}), h('th', {text:'Basis'})])]),
          h('tbody', {}, lp.rows.map(x => h('tr', {}, [h('td', {text:x.name}), h('td', {class:'num', text:x.pts}), h('td', {class:'why', text:x.reason})])))
        ]));
      }
      panel.appendChild(h('p', {class:'llpa-foot', text:lp.foot}));
    }

    // ---------- inputs ----------
    // One table describes every input: how to render it, when it is locked because it is being solved,
    // what its source line says, and what else changes when the user edits it. The view only lists ids
    // in <div class="grid" data-fields="...">; the cells are built here.
    const round3 = x => Math.round(x * 1000) / 1000;
    const SOLVED = {
      msr:    { flag:'solvedMsr',    value: L => round3(L.msrPts),       label: L => `Solved · ${L.mult.toFixed(1)}× the strip` },
      margin: { flag:'solvedMargin', value: L => round3(L.margin),       label: (L, r) => r.moved ? 'Solved at lock · see move tiles' : 'Solved from sheet price' },
      comp:   { flag:'solvedComp',   value: L => round3(L.comp),         label: () => 'Solved from sheet price' },
      price:  { flag:'solvedPrice',  value: L => L.price.toFixed(2),     label: L => `Solved · ${pc(L.coupon)} coupon` },
      sheet:  { flag:'solvedSheet',  value: L => round3(-L.borrowerPts), label: () => 'Solved · + = borrower pays' }
    };
    const priceFor = c => c === ANCHOR.coupon ? ANCHOR.price : estPrice(c);
    // A new rate, strip or g-fee picks the coupon again (with an estimated price) and clears any after-lock move.
    const relock = () => {
      const c = autoCoupon(state.rate, state.svc, state.gfee);
      if (c !== state.coupon) { state.coupon = c; state.couponAuto = true; state.price = priceFor(c); state.priceEst = c !== ANCHOR.coupon; }
      state.coupon2 = null; state.price2 = null; state.price2Est = false;
    };
    const FIELD_DEFS = [
      {id:'loan',     label:'Loan amount',           min:10000, step:1000,         source:'Example', minValue:1000},
      {id:'rate',     label:'Note rate %',           min:0.5, max:20, step:0.125, source:'Example', onChange: relock},
      {id:'sheet',    label:'Points after comp',     min:-6, max:6, step:0.001,   source:`${S.wholesaler} sheet at ${pc(S.sheet.rate)} · + = borrower pays`, allowNegative:true, editedLabel:'Edited · + = borrower pays', solved:SOLVED.sheet},
      {id:'llpa',     label:'LLPAs pts',             min:0, max:10, step:0.001,   source:'Typed · + = cost to the borrower',
        computed: r => r.lock.llpaCalc ? {value: round3(r.lock.llpa), label: `From the ${MSFG.LLPA.version()} matrix · ${r.lock.llpaCalc.breakdown.length} line${r.lock.llpaCalc.breakdown.length === 1 ? '' : 's'}`} : null},
      {id:'coupon',   label:'MBS coupon %',          min:0.5, max:20, step:0.5,   source:'Market quote',
        status: () => state.couponAuto ? {label:`Auto: highest coupon under rate − ${pc(state.gfee + state.svc)}`, cls:'solved'} : null,
        onChange: v => { state.couponAuto = false; state.price = priceFor(v); state.priceEst = v !== ANCHOR.coupon; }},
      {id:'price',    label:'MBS price',             min:90, max:115, step:0.01,  source:'Market quote', solved:SOLVED.price,
        status: () => state.priceEst ? {label:`Estimated from ${pts(S.mbs.coupon)} @ ${S.mbs.price.toFixed(2)} · edit if you have the quote`, cls:'solved'} : null,
        onChange: () => { state.priceEst = false; }},
      {id:'tsy',      label:'10-yr Treasury %',      min:0.1, max:15, step:0.01,  source:`Market, ${S.asOf}`},
      {id:'coupon2',  label:'Coupon % after lock',   min:0.5, max:20, step:0.5,   source:'Same as lock · type to move', move:'coupon',
        onChange: v => { state.price2 = priceFor(v); state.price2Est = v !== ANCHOR.coupon; }},
      {id:'price2',   label:'MBS price after lock',  min:90, max:115, step:0.01,  source:'Same as lock · type to move', move:'price',
        onChange: () => { state.price2Est = false; if (state.coupon2 === null) state.coupon2 = compute(state).lock.coupon; }},
      {id:'comp',     label:'Broker comp pts',       min:0, max:5, step:0.125,    source:`Source: ${S.wholesaler} rate sheet`, solved:SOLVED.comp},
      {id:'lo',       label:'LO comp pts',           min:0, max:5, step:0.125,    source:'Example'},
      {id:'margin',   label:'Wholesaler margin pts', min:0, max:5, step:0.01,     source:`Source: ${S.wholesaler} ${S.margin.period} avg.`, solved:SOLVED.margin},
      {id:'msr',      label:'Servicing value pts',   min:0, max:8, step:0.001,    source:'Solved from sheet price', solved:SOLVED.msr},
      {id:'svc',      label:'Servicing strip %/yr',  min:0, max:2, step:0.125,    source:'Example', onChange: relock},
      {id:'gfee',     label:'Guarantee fee %/yr',    min:0, max:2, step:0.05,     source:'Example · Fannie base g-fee', onChange: relock},
      {id:'fixed',    label:'Fixed cost %',          min:0, max:100, step:1,      source:'Example · of MSFG keeps'},
      {id:'variable', label:'Variable cost %',       min:0, max:100, step:1,      source:'Example · of MSFG keeps'},
      {id:'onetime',  label:'One-time expense %',    min:0, max:100, step:1,      source:'Example · of MSFG keeps'},
      {id:'profit',   label:'Profit %',              min:0, max:100, step:1,      source:'Example · of MSFG keeps'},
      // Borrower and property: inputs to the Fannie Mae LLPA matrix.
      {id:'creditScore',   label:'Credit score',   min:300, max:850, step:1,   source:'Example · drives the LLPA grid'},
      {id:'propertyValue', label:'Property value', min:10000, step:1000,       source:'Example · LTV with the loan amount', minValue:1000},
      {id:'purpose',       label:'Purpose',        type:'select', source:'Example', options:[['Purchase', 'Purchase'], ['LimitedCashOut', 'Limited cash-out refi'], ['CashOut', 'Cash-out refi']]},
      {id:'occupancy',     label:'Occupancy',      type:'select', source:'Example', options:[['Primary', 'Primary residence'], ['SecondHome', 'Second home'], ['Investment', 'Investment property']]},
      {id:'units',         label:'Units',          type:'select', source:'Example', options:[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']]},
      {id:'llpaMode',      label:'LLPAs come from', type:'select', source: MSFG.LLPA ? `Fannie Mae LLPA Matrix effective ${MSFG.LLPA.version()}` : 'Matrix not loaded', options:[['matrix', 'Fannie LLPA matrix'], ['manual', 'A typed value']]},
      {id:'isCondo',                label:'Condo',                                 type:'checkbox'},
      {id:'isManufacturedHome',     label:'Manufactured home',                     type:'checkbox'},
      {id:'isHighBalance',          label:'High balance',                          type:'checkbox'},
      {id:'hasSubordinateFinancing', label:'Subordinate financing',               type:'checkbox'},
      {id:'applyMMI',               label:'Minimum MI coverage option',            type:'checkbox'},
      {id:'isHighLTVRefi',          label:'High LTV refinance (limited cash-out)', type:'checkbox'},
      {id:'waiverHomeReady',        label:'HomeReady waiver',                      type:'checkbox'},
      {id:'waiverFirstTimeHB',      label:'First-time homebuyer waiver (income ≤ AMI)', type:'checkbox'},
      {id:'waiverDutyToServe',      label:'Duty to Serve waiver',                  type:'checkbox'}
    ];
    const DEF = {};
    FIELD_DEFS.forEach(f => {
      if (!(f.id in DEFAULTS)) throw new Error('where-the-money-goes: field "' + f.id + '" has no default in the model');
      DEF[f.id] = f;
    });

    const h = (tag, attrs, children) => {
      const e = document.createElement(tag);
      Object.keys(attrs || {}).forEach(k => { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
      (children || []).forEach(c => e.appendChild(c));
      return e;
    };
    function renderFields(){
      document.querySelectorAll('[data-fields]').forEach(grid => {
        grid.dataset.fields.trim().split(/\s+/).forEach(id => {
          const f = DEF[id];
          if (!f) throw new Error('where-the-money-goes: unknown field "' + id + '" in data-fields');
          if (f.type === 'checkbox') {
            grid.appendChild(h('div', {class:'inp check'}, [h('label', {}, [h('input', {id:'in-' + id, type:'checkbox'}), h('span', {class:'k', text:f.label})])]));
            return;
          }
          let control;
          if (f.type === 'select') {
            control = h('select', {id:'in-' + id, 'aria-describedby':'src-' + id}, f.options.map(o => h('option', {value:o[0], text:o[1]})));
          } else {
            const attrs = {id:'in-' + id, type:'number', inputmode:'decimal', step:String(f.step), 'aria-describedby':'src-' + id};
            if (f.min !== undefined) attrs.min = String(f.min);
            if (f.max !== undefined) attrs.max = String(f.max);
            control = h('input', attrs);
          }
          grid.appendChild(h('div', {class:'inp'}, [
            h('label', {}, [h('span', {class:'k', text:f.label}), control]),
            h('span', {class:'s', id:'src-' + id, text:f.source})
          ]));
        });
      });
    }

    function syncInputs(r){
      const lock = r.lock;
      FIELD_DEFS.forEach(f => {
        const i = $('in-' + f.id), s = $('src-' + f.id);
        let value = state[f.id], label = null, cls = '', disabled = false;
        const computed = f.computed && f.computed(r);
        if (computed) {
          value = computed.value; label = computed.label; cls = 'solved'; disabled = true;
        } else if (f.solved && lock[f.solved.flag]) {
          value = f.solved.value(lock); label = f.solved.label(lock, r); cls = 'solved'; disabled = true;
        } else if (f.move) {
          const lockVal = lock[f.move];
          value = state[f.id] === null ? (f.move === 'price' ? lockVal.toFixed(2) : lockVal) : state[f.id];
          if (state[f.id] !== null && r.moved) {
            if (f.id === 'price2' && state.price2Est) { label = 'Estimated for the new coupon · edit if you have the quote'; cls = 'solved'; }
            else { label = 'Market move'; cls = 'edited'; }
          }
        } else {
          const st = f.status && f.status();
          if (st) { label = st.label; cls = st.cls; }
          else if (state[f.id] !== DEFAULTS[f.id]) { label = f.editedLabel || 'Edited'; cls = 'edited'; }
        }
        i.disabled = disabled;
        if (f.type === 'checkbox') i.checked = !!value;
        else if (document.activeElement !== i) i.value = value;
        if (s) { s.textContent = label || f.source; s.className = 's ' + cls; }
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
    renderFields();
    document.querySelectorAll('[data-asof]').forEach(el => { el.textContent = S.asOfLong; });
    FIELD_DEFS.forEach(f => $('in-' + f.id).addEventListener(f.type ? 'change' : 'input', e => {
      let v;
      if (f.type === 'checkbox') v = e.target.checked;
      else if (f.type === 'select') v = e.target.value;
      else {
        v = parseFloat(e.target.value);
        if (!isFinite(v)) return;
        if (v < 0 && !f.allowNegative) return;
        if (f.minValue !== undefined && v < f.minValue) return;
      }
      state[f.id] = v;
      if (f.onChange) f.onChange(v);
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
