/* =====================================================
   FHA Loan Calculator — Unified Engine
   Purchase, Rate/Term Refi, Cash-Out Refi, Streamline
   ===================================================== */
'use strict';

const FhaCalc = (() => {

  const P = MSFG.parseNum;
  const fmt = MSFG.formatCurrency;
  const pmt = MSFG.calcMonthlyPayment;

  const UFMIP_RATE = 0.0175;

  /* ---- HUD UFMIP Refund Schedule ---- */
  const DEFAULT_REFUND_TABLE = [
    { months: 1, refund: 80 }, { months: 2, refund: 78 }, { months: 3, refund: 76 },
    { months: 4, refund: 74 }, { months: 5, refund: 72 }, { months: 6, refund: 70 },
    { months: 7, refund: 68 }, { months: 8, refund: 66 }, { months: 9, refund: 64 },
    { months: 10, refund: 62 }, { months: 11, refund: 60 }, { months: 12, refund: 58 },
    { months: 13, refund: 56 }, { months: 14, refund: 54 }, { months: 15, refund: 52 },
    { months: 16, refund: 50 }, { months: 17, refund: 48 }, { months: 18, refund: 46 },
    { months: 19, refund: 44 }, { months: 20, refund: 42 }, { months: 21, refund: 40 },
    { months: 22, refund: 38 }, { months: 23, refund: 36 }, { months: 24, refund: 34 },
    { months: 25, refund: 32 }, { months: 26, refund: 30 }, { months: 27, refund: 28 },
    { months: 28, refund: 26 }, { months: 29, refund: 24 }, { months: 30, refund: 22 },
    { months: 31, refund: 20 }, { months: 32, refund: 18 }, { months: 33, refund: 16 },
    { months: 34, refund: 14 }, { months: 35, refund: 12 }, { months: 36, refund: 10 },
    { months: 37, refund: 0 }
  ];

  let refundTable = DEFAULT_REFUND_TABLE.map(r => Object.assign({}, r));

  /* ---- DOM helpers ---- */
  const el = (id) => document.getElementById(id);
  const val = (id) => { const e = el(id); return e ? P(e.value) : 0; };
  const txt = (id) => { const e = el(id); return e ? (e.value || '').trim() : ''; };

  const COST_IDS = [
    'fhaCostOrigination', 'fhaCostProcessing', 'fhaCostUnderwriting', 'fhaCostPoints',
    'fhaCostCredit', 'fhaCostFlood', 'fhaCostInspection',
    'fhaCostTitleSearch', 'fhaCostTitleInsurance', 'fhaCostRecording', 'fhaCostAttorney',
    'fhaCostSurvey', 'fhaCostPest', 'fhaCostOther'
  ];

  /* ===========================================================
     Read Inputs
     =========================================================== */
  function readInputs() {
    return {
      borrowerName:      txt('fhaBorrowerName'),
      caseId:            txt('fhaCaseId'),
      appraisedValue:    val('fhaAppraisedValue'),
      purchasePrice:     val('fhaPurchasePrice'),
      propertyType:      txt('fhaPropertyType'),
      isExistingFha:     el('fhaIsExistingFha').checked,
      currentUpb:        val('fhaCurrentUpb'),
      currentRate:       val('fhaCurrentRate'),
      currentPayment:    val('fhaCurrentPayment'),
      currentLoanType:   txt('fhaCurrentLoanType'),
      originalLoanAmount: val('fhaOriginalLoanAmount'),
      remainingTerm:     val('fhaRemainingTerm'),
      endorsementDate:   txt('fhaEndorsementDate'),
      firstPaymentDate:  txt('fhaFirstPaymentDate'),
      currentDate:       txt('fhaCurrentDate'),
      totalClosingCosts: sumClosingCosts(),
      accruedInterest:   val('fhaAccruedInterest'),
      newRate:           val('fhaNewRate'),
      newTerm:           val('fhaNewTerm'),
      newLoanType:       txt('fhaNewLoanType'),
      financeUfmip:      el('fhaFinanceUfmip').checked,
      prepaidsCash:      val('fhaPrepaidsCash'),
      totalCredits:      val('fhaTotalCredits'),
      escrowRefund:      val('fhaEscrowRefund'),
      refiType:          txt('fhaRefiTypeSelect')
    };
  }

  function sumClosingCosts() {
    let total = 0;
    for (const id of COST_IDS) total += val(id);
    return total;
  }

  function updateClosingCostsDisplay() {
    const total = sumClosingCosts();
    el('fhaTotalClosingCosts').textContent = fmt(total);
  }

  /* ===========================================================
     Seasoning Validation
     =========================================================== */
  function validateSeasoning(state) {
    const result = { paymentsMade: null, daysSince: null, paymentsPass: false, daysPass: false };
    if (!state.firstPaymentDate || !state.currentDate) return result;

    const fp = new Date(state.firstPaymentDate);
    const cd = new Date(state.currentDate);
    if (isNaN(fp.getTime()) || isNaN(cd.getTime())) return result;

    result.paymentsMade = Math.max(0,
      (cd.getFullYear() - fp.getFullYear()) * 12 + (cd.getMonth() - fp.getMonth())
    );
    result.daysSince = Math.max(0, Math.floor((cd - fp) / (1000 * 60 * 60 * 24)));
    result.paymentsPass = result.paymentsMade >= 6;
    result.daysPass = result.daysSince >= 210;
    return result;
  }

  function renderSeasoningStatus(seasoning) {
    const pmtsEl = el('fhaSeasoningPayments');
    const daysEl = el('fhaSeasoningDays');
    const pmtsCard = el('fhaPaymentsCard');
    const daysCard = el('fhaDaysCard');
    const pmtsDetail = el('fhaPaymentsDetail');
    const daysDetail = el('fhaDaysDetail');

    if (seasoning.paymentsMade === null) {
      pmtsEl.textContent = '\u2014';
      daysEl.textContent = '\u2014';
      pmtsCard.className = 'fha-status-card';
      daysCard.className = 'fha-status-card';
      pmtsDetail.textContent = '';
      daysDetail.textContent = '';
      return;
    }

    pmtsEl.textContent = seasoning.paymentsMade;
    daysEl.textContent = seasoning.daysSince;

    pmtsCard.className = 'fha-status-card ' + (seasoning.paymentsPass ? 'pass' : 'fail');
    daysCard.className = 'fha-status-card ' + (seasoning.daysPass ? 'pass' : 'fail');

    pmtsDetail.textContent = seasoning.paymentsPass
      ? 'Meets requirement (\u22656 payments)'
      : `Need ${6 - seasoning.paymentsMade} more payment(s)`;
    pmtsDetail.style.color = seasoning.paymentsPass ? '#2e7d32' : '#c62828';

    daysDetail.textContent = seasoning.daysPass
      ? 'Meets requirement (\u2265210 days)'
      : `Need ${210 - seasoning.daysSince} more day(s)`;
    daysDetail.style.color = seasoning.daysPass ? '#2e7d32' : '#c62828';
  }

  /* ===========================================================
     UFMIP Refund
     =========================================================== */
  function calculateUfmipRefund(state) {
    const result = { refundPercent: 0, refundAmount: 0, originalUfmip: 0, monthsSince: 0 };
    if (!state.endorsementDate || !state.currentDate || !state.originalLoanAmount) return result;

    const ed = new Date(state.endorsementDate);
    const cd = new Date(state.currentDate);
    if (isNaN(ed.getTime()) || isNaN(cd.getTime())) return result;

    // Must be endorsed after Sept 1, 1983
    if (ed < new Date('1983-09-01')) return result;

    result.originalUfmip = state.originalLoanAmount * UFMIP_RATE;
    result.monthsSince = Math.max(0,
      (cd.getFullYear() - ed.getFullYear()) * 12 + (cd.getMonth() - ed.getMonth())
    );

    // Lookup refund from table
    if (result.monthsSince >= 37) {
      result.refundPercent = 0;
    } else if (result.monthsSince >= 1) {
      const entry = refundTable.find(r => r.months === result.monthsSince);
      result.refundPercent = entry ? entry.refund : 0;
    } else {
      result.refundPercent = 80; // month 0 treated as month 1
    }

    result.refundAmount = result.originalUfmip * (result.refundPercent / 100);
    return result;
  }

  /* ===========================================================
     Scenario Calculators
     =========================================================== */
  function minPositive(a, b) {
    const vals = [a, b].filter(v => Number.isFinite(v) && v > 0);
    return vals.length ? Math.min(...vals) : 0;
  }

  function calcPayment(totalLoan, ratePercent, termYears) {
    if (!totalLoan || !ratePercent || !termYears) return 0;
    return pmt(totalLoan, ratePercent / 100, termYears);
  }

  function calculatePurchase(state, notes) {
    const priceOrValue = minPositive(state.purchasePrice, state.appraisedValue);
    if (!priceOrValue) {
      notes.push('Purchase: enter purchase price and/or appraised value.');
      return null;
    }

    const maxLtv = 0.965;
    const baseLoan = priceOrValue * maxLtv;
    const ufmipAmt = state.financeUfmip ? baseLoan * UFMIP_RATE : 0;
    const totalLoan = baseLoan + ufmipAmt;
    const ltv = baseLoan / priceOrValue;
    const payment = calcPayment(totalLoan, state.newRate, state.newTerm);
    const downPayment = Math.max(0, state.purchasePrice - baseLoan);
    const ufmipOop = state.financeUfmip ? 0 : baseLoan * UFMIP_RATE;
    const cashToClose = downPayment + state.prepaidsCash + ufmipOop - state.totalCredits;

    notes.push('Purchase: max base loan at 96.5% of lesser of price or value.');
    return {
      baseLoan, ufmipRefund: 0, ufmipAmt, totalLoan, ltv, payment,
      cashToClose, ntb: null, ntbDetail: '', seasoning: null
    };
  }

  function calculateFhaRefi(state, notes) {
    if (!state.appraisedValue) {
      notes.push('FHA Refi: enter appraised value.');
      return null;
    }

    const isCashOut = state.refiType === 'cashOut';
    const maxLtv = isCashOut ? 0.80 : 0.9775;
    const label = isCashOut ? 'Cash-Out (80%)' : 'Rate/Term (97.75%)';
    const baseLoan = state.appraisedValue * maxLtv;
    const ufmipAmt = state.financeUfmip ? baseLoan * UFMIP_RATE : 0;
    const totalLoan = baseLoan + ufmipAmt;
    const ltv = baseLoan / state.appraisedValue;
    const payment = calcPayment(totalLoan, state.newRate, state.newTerm);

    // Cash to close: (payoff + cash costs - credits - escrow refund) - totalLoan
    const payoff = state.currentUpb || 0;
    const cashToClose = (payoff + state.totalClosingCosts + state.prepaidsCash
      - state.totalCredits - state.escrowRefund) - totalLoan;

    // NTB
    const ntb = evaluateNtb(state.currentPayment, payment, state.currentRate, state.newRate,
      state.currentLoanType, state.newLoanType, 'refi');

    notes.push(`FHA Refi (${label}): max base loan at ${(maxLtv * 100).toFixed(2)}% of appraised value.`);
    if (isCashOut && state.endorsementDate) {
      const months = monthsBetweenDates(state.endorsementDate, state.currentDate);
      if (months < 12) notes.push('FHA Cash-Out: owned < 12 months \u2014 may not be eligible.');
    }

    return {
      baseLoan, ufmipRefund: 0, ufmipAmt, totalLoan, ltv, payment,
      cashToClose, ntb, ntbDetail: ntb.detail, seasoning: null
    };
  }

  function calculateStreamline(state, ufmipRefund, seasoning, notes) {
    if (!state.isExistingFha) {
      notes.push('Streamline: current loan must be FHA.');
      return null;
    }
    if (!state.currentUpb) {
      notes.push('Streamline: enter current UPB.');
      return null;
    }

    const baseLoan = state.currentUpb - ufmipRefund.refundAmount
      + state.accruedInterest + state.totalClosingCosts;
    const newUfmip = baseLoan * UFMIP_RATE;
    const totalLoan = baseLoan + newUfmip;
    const payment = calcPayment(totalLoan, state.newRate, state.newTerm);

    // Cash to close: prepaids - credits - escrow refund (costs already financed)
    const cashToClose = state.prepaidsCash - state.totalCredits - state.escrowRefund;

    // NTB for streamline
    const ntb = evaluateNtb(state.currentPayment, payment, state.currentRate, state.newRate,
      state.currentLoanType, state.newLoanType, 'streamline');

    // Seasoning status
    const seasoningPass = seasoning.paymentsPass && seasoning.daysPass;
    const seasoningStatus = (seasoning.paymentsMade === null) ? null : seasoningPass;

    notes.push('Streamline: base loan = UPB \u2212 UFMIP refund + accrued interest + closing costs.');
    if (ufmipRefund.refundAmount > 0) {
      notes.push(`UFMIP Refund: ${fmt(ufmipRefund.refundAmount)} (${ufmipRefund.refundPercent}% at month ${ufmipRefund.monthsSince}).`);
    }

    return {
      baseLoan, ufmipRefund: ufmipRefund.refundAmount, ufmipAmt: newUfmip,
      totalLoan, ltv: null, payment, cashToClose,
      ntb, ntbDetail: ntb.detail, seasoning: seasoningStatus
    };
  }

  /* ===========================================================
     Net Tangible Benefit
     =========================================================== */
  function evaluateNtb(oldPmt, newPmt, oldRate, newRate, oldType, newType, scenario) {
    const result = { met: null, reductionPercent: 0, detail: '' };
    if (!oldPmt || !newPmt) {
      result.detail = 'Insufficient data';
      return result;
    }

    const pmtReduction = oldPmt - newPmt;
    const pmtPct = pmtReduction / oldPmt;
    const rateReduction = oldRate - newRate;

    // Streamline: 5% combined reduction test
    if (scenario === 'streamline') {
      const threshold = 0.05;
      result.met = pmtPct >= threshold;
      result.reductionPercent = pmtPct;
      result.detail = result.met
        ? `Payment reduced ${(pmtPct * 100).toFixed(2)}% (\u22655% required)`
        : `Only ${(pmtPct * 100).toFixed(2)}% reduction (need \u22655%)`;
      return result;
    }

    // Standard refi: 4 loan type transitions
    if (oldType === 'fixed' && newType === 'fixed') {
      if (rateReduction >= 0.5) {
        result.met = true;
        result.detail = `Rate reduced ${rateReduction.toFixed(3)}% (\u22650.5% required)`;
      } else if (pmtReduction > 0) {
        result.met = true;
        result.detail = `Payment reduced by ${fmt(pmtReduction)}`;
      } else {
        result.met = false;
        result.detail = `Rate reduction ${rateReduction.toFixed(3)}% < 0.5% and no payment reduction`;
      }
    } else if (oldType === 'arm' && newType === 'fixed') {
      const pmtIncreasePct = ((newPmt - oldPmt) / oldPmt) * 100;
      if (pmtIncreasePct <= 20) {
        result.met = true;
        result.detail = pmtReduction >= 0
          ? `Payment reduced by ${fmt(pmtReduction)}`
          : `Payment increased ${pmtIncreasePct.toFixed(2)}% (\u226420% allowed)`;
      } else {
        result.met = false;
        result.detail = `Payment increased ${pmtIncreasePct.toFixed(2)}% (exceeds 20% limit)`;
      }
    } else if (oldType === 'fixed' && newType === 'arm') {
      if (pmtReduction > 0) {
        result.met = true;
        result.detail = `Payment reduced by ${fmt(pmtReduction)}`;
      } else {
        result.met = false;
        result.detail = 'Fixed \u2192 ARM requires payment reduction';
      }
    } else if (oldType === 'arm' && newType === 'arm') {
      if (rateReduction > 0 || pmtReduction > 0) {
        result.met = true;
        const parts = [];
        if (rateReduction > 0) parts.push(`Rate reduced ${rateReduction.toFixed(3)}%`);
        if (pmtReduction > 0) parts.push(`Payment reduced ${fmt(pmtReduction)}`);
        result.detail = parts.join('; ');
      } else {
        result.met = false;
        result.detail = 'ARM \u2192 ARM requires rate OR payment reduction';
      }
    }

    result.reductionPercent = pmtPct;
    return result;
  }

  /* ===========================================================
     Utility
     =========================================================== */
  function monthsBetweenDates(date1, date2) {
    if (!date1 || !date2) return 0;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return Math.max(0, (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()));
  }

  /* ===========================================================
     Render Comparison Results
     =========================================================== */
  function renderComparison(purchase, refi, streamline, notes) {
    el('fhaResultsSection').style.display = '';

    // Column visibility
    const showPurch = !!purchase;
    const showSl = !!streamline;

    toggleColumn('fha-purch-col', showPurch);
    toggleColumn('fha-sl-col', showSl);

    // Purchase column
    if (purchase) {
      fillCell('fhaPurchBaseLoan', fmt(purchase.baseLoan));
      fillCell('fhaPurchUfmipRefund', '\u2014');
      fillCell('fhaPurchUfmip', fmt(purchase.ufmipAmt));
      fillCell('fhaPurchTotalLoan', fmt(purchase.totalLoan));
      fillCell('fhaPurchLtv', (purchase.ltv * 100).toFixed(2) + '%');
      fillCell('fhaPurchPayment', purchase.payment ? fmt(purchase.payment) : '\u2014');
      fillNtbCell('fhaPurchNtb', null);
      fillCell('fhaPurchNtbDetail', '\u2014');
      fillCell('fhaPurchSeasoning', '\u2014');
      fillCell('fhaPurchCashToClose', formatCashToClose(purchase.cashToClose));
    }

    // Refi column
    if (refi) {
      fillCell('fhaRefiBaseLoan', fmt(refi.baseLoan));
      fillCell('fhaRefiUfmipRefund', '\u2014');
      fillCell('fhaRefiUfmip', fmt(refi.ufmipAmt));
      fillCell('fhaRefiTotalLoan', fmt(refi.totalLoan));
      fillCell('fhaRefiLtv', (refi.ltv * 100).toFixed(2) + '%');
      fillCell('fhaRefiPayment', refi.payment ? fmt(refi.payment) : '\u2014');
      fillNtbCell('fhaRefiNtb', refi.ntb);
      fillCell('fhaRefiNtbDetail', refi.ntbDetail || '\u2014');
      fillCell('fhaRefiSeasoning', '\u2014');
      fillCell('fhaRefiCashToClose', formatCashToClose(refi.cashToClose));
    } else {
      clearRefiColumn();
    }

    // Streamline column
    if (streamline) {
      fillCell('fhaSlBaseLoan', fmt(streamline.baseLoan));
      fillCell('fhaSlUfmipRefund', streamline.ufmipRefund > 0 ? '-' + fmt(streamline.ufmipRefund) : '\u2014');
      fillCell('fhaSlNewUfmip', fmt(streamline.ufmipAmt));
      fillCell('fhaSlTotalLoan', fmt(streamline.totalLoan));
      fillCell('fhaSlLtv', 'N/A');
      fillCell('fhaSlPayment', streamline.payment ? fmt(streamline.payment) : '\u2014');
      fillNtbCell('fhaSlNtb', streamline.ntb);
      fillCell('fhaSlNtbDetail', streamline.ntbDetail || '\u2014');
      fillSeasoningCell('fhaSlSeasoning', streamline.seasoning);
      fillCell('fhaSlCashToClose', formatCashToClose(streamline.cashToClose));
    } else {
      clearSlColumn();
    }

    // Highlight best total loan (lowest) and best cash to close
    highlightBest(purchase, refi, streamline);

    // Notes
    const notesList = el('fhaResultNotes');
    notesList.innerHTML = '';
    notes.forEach(note => {
      const li = document.createElement('li');
      li.textContent = note;
      notesList.appendChild(li);
    });
  }

  function fillCell(id, text) {
    const e = el(id);
    if (e) e.textContent = text;
  }

  function fillNtbCell(id, ntb) {
    const e = el(id);
    if (!e) return;
    if (!ntb || ntb.met === null) {
      e.innerHTML = '<span class="fha-ntb-pill na">N/A</span>';
    } else if (ntb.met) {
      e.innerHTML = '<span class="fha-ntb-pill pass">PASS</span>';
    } else {
      e.innerHTML = '<span class="fha-ntb-pill fail">FAIL</span>';
    }
  }

  function fillSeasoningCell(id, status) {
    const e = el(id);
    if (!e) return;
    if (status === null) {
      e.innerHTML = '<span class="fha-ntb-pill na">N/A</span>';
    } else if (status) {
      e.innerHTML = '<span class="fha-ntb-pill pass">PASS</span>';
    } else {
      e.innerHTML = '<span class="fha-ntb-pill fail">FAIL</span>';
    }
  }

  function formatCashToClose(amount) {
    if (!Number.isFinite(amount)) return '\u2014';
    if (amount > 0.01) return fmt(amount) + ' due';
    if (amount < -0.01) return fmt(Math.abs(amount)) + ' to borrower';
    return '$0.00';
  }

  function clearRefiColumn() {
    ['fhaRefiBaseLoan', 'fhaRefiUfmipRefund', 'fhaRefiUfmip', 'fhaRefiTotalLoan',
      'fhaRefiLtv', 'fhaRefiPayment', 'fhaRefiNtb', 'fhaRefiNtbDetail',
      'fhaRefiSeasoning', 'fhaRefiCashToClose'
    ].forEach(id => fillCell(id, '\u2014'));
  }

  function clearSlColumn() {
    ['fhaSlBaseLoan', 'fhaSlUfmipRefund', 'fhaSlNewUfmip', 'fhaSlTotalLoan',
      'fhaSlLtv', 'fhaSlPayment', 'fhaSlNtb', 'fhaSlNtbDetail',
      'fhaSlSeasoning', 'fhaSlCashToClose'
    ].forEach(id => fillCell(id, '\u2014'));
  }

  function toggleColumn(cls, show) {
    document.querySelectorAll('.' + cls).forEach(e => {
      e.classList.toggle('fha-col-hidden', !show);
    });
  }

  function highlightBest(purchase, refi, streamline) {
    // Clear existing highlights
    document.querySelectorAll('.fha-best-cell').forEach(e => e.classList.remove('fha-best-cell'));

    const scenarios = [];
    if (purchase) scenarios.push({ key: 'Purch', totalLoan: purchase.totalLoan, cashToClose: purchase.cashToClose });
    if (refi) scenarios.push({ key: 'Refi', totalLoan: refi.totalLoan, cashToClose: refi.cashToClose });
    if (streamline) scenarios.push({ key: 'Sl', totalLoan: streamline.totalLoan, cashToClose: streamline.cashToClose });

    if (scenarios.length < 2) return;

    // Highlight lowest total loan
    const minLoan = Math.min(...scenarios.map(s => s.totalLoan));
    scenarios.forEach(s => {
      if (s.totalLoan === minLoan) {
        const cell = el('fha' + s.key + 'TotalLoan');
        if (cell) cell.classList.add('fha-best-cell');
      }
    });

    // Highlight lowest cash to close
    const minCash = Math.min(...scenarios.map(s => s.cashToClose));
    scenarios.forEach(s => {
      if (s.cashToClose === minCash) {
        const cell = el('fha' + s.key + 'CashToClose');
        if (cell) cell.classList.add('fha-best-cell');
      }
    });
  }

  /* ===========================================================
     Render Calc Steps
     =========================================================== */
  function renderCalcSteps(purchase, refi, streamline, state) {
    const container = el('calcSteps-fha');
    if (!container) return;

    let html = '';

    if (purchase) {
      html += stepSection('Purchase Scenario', [
        step('Value Used', `Lesser of ${fmt(state.purchasePrice)} and ${fmt(state.appraisedValue)}`,
          fmt(minPositive(state.purchasePrice, state.appraisedValue))),
        step('Base Loan', 'Value Used \u00D7 96.5%', fmt(purchase.baseLoan)),
        step('UFMIP', `Base Loan \u00D7 1.75%${state.financeUfmip ? ' (financed)' : ' (cash)'}`, fmt(purchase.ufmipAmt)),
        step('Total Loan', 'Base Loan + UFMIP', fmt(purchase.totalLoan)),
        step('LTV', 'Base Loan \u00F7 Value', (purchase.ltv * 100).toFixed(2) + '%'),
        step('Cash to Close', 'Down payment + prepaids \u2212 credits', formatCashToClose(purchase.cashToClose))
      ]);
    }

    if (refi) {
      const isCashOut = state.refiType === 'cashOut';
      const maxPct = isCashOut ? '80%' : '97.75%';
      html += stepSection('FHA Refi Scenario (' + (isCashOut ? 'Cash-Out' : 'Rate/Term') + ')', [
        step('Base Loan', `${fmt(state.appraisedValue)} \u00D7 ${maxPct}`, fmt(refi.baseLoan)),
        step('UFMIP', `Base Loan \u00D7 1.75%${state.financeUfmip ? ' (financed)' : ' (cash)'}`, fmt(refi.ufmipAmt)),
        step('Total Loan', 'Base Loan + UFMIP', fmt(refi.totalLoan)),
        step('LTV', 'Base Loan \u00F7 Appraised Value', (refi.ltv * 100).toFixed(2) + '%'),
        step('New P&I', `${fmt(refi.totalLoan)} @ ${state.newRate}% / ${state.newTerm}yr`, fmt(refi.payment)),
        step('NTB', refi.ntbDetail, refi.ntb.met === true ? 'PASS' : refi.ntb.met === false ? 'FAIL' : 'N/A'),
        step('Cash to Close', '(Payoff + costs \u2212 credits \u2212 escrow refund) \u2212 loan', formatCashToClose(refi.cashToClose))
      ]);
    }

    if (streamline) {
      html += stepSection('Streamline Scenario', [
        step('UPB', 'Current payoff balance', fmt(state.currentUpb)),
        step('UFMIP Refund', `${fmt(streamline.ufmipRefund > 0 ? streamline.ufmipRefund : 0)}`, streamline.ufmipRefund > 0 ? '-' + fmt(streamline.ufmipRefund) : '\u2014'),
        step('Accrued Interest', '', fmt(state.accruedInterest)),
        step('Closing Costs', '', fmt(state.totalClosingCosts)),
        step('Base Loan', 'UPB \u2212 refund + interest + costs', fmt(streamline.baseLoan)),
        step('New UFMIP', 'Base Loan \u00D7 1.75%', fmt(streamline.ufmipAmt)),
        step('Total Loan', 'Base + New UFMIP', fmt(streamline.totalLoan)),
        step('New P&I', `${fmt(streamline.totalLoan)} @ ${state.newRate}% / ${state.newTerm}yr`, fmt(streamline.payment)),
        step('NTB', streamline.ntbDetail, streamline.ntb.met === true ? 'PASS' : streamline.ntb.met === false ? 'FAIL' : 'N/A'),
        step('Cash to Close', 'Prepaids \u2212 credits \u2212 escrow refund', formatCashToClose(streamline.cashToClose))
      ]);
    }

    container.innerHTML = html;
  }

  function stepSection(title, steps) {
    let html = `<div class="calc-step"><h4>${title}</h4>`;
    html += '<div class="calc-step__formula">';
    steps.forEach(s => {
      html += `<div style="margin-bottom:4px;"><strong>${s.label}:</strong> `;
      if (s.formula) html += `<span style="color:var(--color-gray-500)">${s.formula}</span> = `;
      html += `<strong>${s.value}</strong></div>`;
    });
    html += '</div></div>';
    return html;
  }

  function step(label, formula, value) {
    return { label, formula, value };
  }

  /* ===========================================================
     UFMIP Refund Table UI
     =========================================================== */
  function populateRefundTable() {
    const tbody = el('fhaRefundTableBody');
    tbody.innerHTML = '';

    for (let i = 0; i < refundTable.length; i += 3) {
      const row = document.createElement('tr');
      for (let j = 0; j < 3; j++) {
        const idx = i + j;
        if (idx < refundTable.length) {
          const item = refundTable[idx];
          const mLabel = item.months >= 37 ? '37+' : String(item.months);
          const tdMonth = document.createElement('td');
          tdMonth.textContent = mLabel;
          const tdRefund = document.createElement('td');
          const inp = document.createElement('input');
          inp.type = 'number';
          inp.min = '0';
          inp.max = '100';
          inp.step = '1';
          inp.value = item.refund;
          inp.dataset.idx = idx;
          tdRefund.appendChild(inp);
          tdRefund.appendChild(document.createTextNode('%'));
          row.appendChild(tdMonth);
          row.appendChild(tdRefund);
        } else {
          row.appendChild(document.createElement('td'));
          row.appendChild(document.createElement('td'));
        }
      }
      tbody.appendChild(row);
    }

    // Event delegation for refund table edits
    tbody.addEventListener('change', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.dataset.idx !== undefined) {
        refundTable[parseInt(e.target.dataset.idx)].refund = parseFloat(e.target.value) || 0;
      }
    });
  }

  function resetRefundTable() {
    refundTable = DEFAULT_REFUND_TABLE.map(r => Object.assign({}, r));
    populateRefundTable();
  }

  /* ===========================================================
     Collapsible Sections
     =========================================================== */
  function initCollapsibles() {
    document.querySelectorAll('.fha-collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const targetId = header.dataset.target;
        const body = el(targetId);
        const icon = header.querySelector('.fha-collapse-icon');
        if (body.classList.contains('collapsed')) {
          body.classList.remove('collapsed');
          icon.classList.remove('collapsed');
        } else {
          body.classList.add('collapsed');
          icon.classList.add('collapsed');
        }
      });
    });
  }

  /* ===========================================================
     MISMO Integration
     =========================================================== */
  function initMISMODropZone() {
    const dropZone = el('fhaMismoDrop');
    const fileInput = el('fhaMismoFile');
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) handleMISMOFile(e.target.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleMISMOFile(e.dataTransfer.files[0]);
    });

    // Check sessionStorage for existing MISMO data (from workspace)
    const stored = sessionStorage.getItem('msfg-mismo-data');
    if (stored) {
      try {
        applyMISMOData(JSON.parse(stored));
        dropZone.classList.add('loaded');
        dropZone.textContent = 'MISMO data loaded from session';
      } catch (_) { /* ignore parse errors */ }
    }
  }

  function handleMISMOFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (!MSFG.MISMOParser) return;
        const data = MSFG.MISMOParser.parse(e.target.result);
        sessionStorage.setItem('msfg-mismo-data', JSON.stringify(data));
        applyMISMOData(data);
        const dropZone = el('fhaMismoDrop');
        dropZone.classList.add('loaded');
        dropZone.textContent = `MISMO loaded: ${file.name}`;
      } catch (err) {
        const dropZone = el('fhaMismoDrop');
        dropZone.textContent = 'Error parsing MISMO file';
        console.error('MISMO parse error:', err);
      }
    };
    reader.readAsText(file);
  }

  function applyMISMOData(data) {
    if (!MSFG.MISMOParser) return;
    const mapFn = MSFG.MISMOParser.getCalcMap('fha');
    if (!mapFn) return;
    const fieldMap = mapFn(data);

    for (const [id, value] of Object.entries(fieldMap)) {
      const field = el(id);
      if (!field) continue;

      if (field.type === 'checkbox') {
        field.checked = !!value;
      } else if (field.tagName === 'SELECT') {
        // Try matching by value first, then by text
        const optByVal = field.querySelector(`option[value="${value}"]`);
        if (optByVal) {
          field.value = value;
        } else {
          for (const opt of field.options) {
            if (opt.textContent.toLowerCase().includes(String(value).toLowerCase())) {
              field.value = opt.value;
              break;
            }
          }
        }
      } else {
        field.value = value;
      }
    }

    // Trigger closing costs display update
    updateClosingCostsDisplay();
  }

  /* ===========================================================
     Main Calculate
     =========================================================== */
  function calculateAll() {
    const state = readInputs();
    const notes = [];

    // Seasoning
    const seasoning = validateSeasoning(state);
    renderSeasoningStatus(seasoning);

    // UFMIP Refund
    const ufmipRefund = calculateUfmipRefund(state);

    // Closing costs display
    updateClosingCostsDisplay();

    // Scenarios
    const purchase = state.purchasePrice > 0 ? calculatePurchase(state, notes) : null;
    const refi = state.appraisedValue > 0 ? calculateFhaRefi(state, notes) : null;
    const streamline = (state.isExistingFha && state.currentUpb > 0)
      ? calculateStreamline(state, ufmipRefund, seasoning, notes) : null;

    if (!purchase && !refi && !streamline) {
      notes.push('Enter property/loan data to see scenario results.');
    }

    renderComparison(purchase, refi, streamline, notes);
    renderCalcSteps(purchase, refi, streamline, state);
  }

  /* ===========================================================
     Init
     =========================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    // Set current date
    const today = new Date().toISOString().split('T')[0];
    const cdEl = el('fhaCurrentDate');
    if (cdEl && !cdEl.value) cdEl.value = today;

    // Populate refund table
    populateRefundTable();

    // Collapsible sections
    initCollapsibles();

    // Calculate button
    el('fhaCalculateBtn').addEventListener('click', calculateAll);

    // Refi type dropdown triggers recalc
    el('fhaRefiTypeSelect').addEventListener('change', () => {
      if (el('fhaResultsSection').style.display !== 'none') calculateAll();
    });

    // Seasoning validation on date changes
    ['fhaEndorsementDate', 'fhaFirstPaymentDate', 'fhaCurrentDate'].forEach(id => {
      el(id).addEventListener('change', () => {
        const state = readInputs();
        const seasoning = validateSeasoning(state);
        renderSeasoningStatus(seasoning);
      });
    });

    // Real-time closing costs total
    COST_IDS.forEach(id => {
      const e = el(id);
      if (e) e.addEventListener('input', updateClosingCostsDisplay);
    });

    // Reset refund table button
    el('fhaResetRefundBtn').addEventListener('click', resetRefundTable);

    // MISMO
    initMISMODropZone();
  });

  return { calculateAll };
})();
