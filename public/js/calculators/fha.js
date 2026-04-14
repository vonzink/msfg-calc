/* =====================================================
   FHA Loan Calculator — Redesigned Live-Calc Engine
   Purchase, Rate/Term Refi, Cash-Out Refi, Streamline
   3-column refi comparison mode
   ===================================================== */
'use strict';

(function () {

  const P = MSFG.parseNum;
  const fmt = MSFG.formatCurrency;
  const pmt = MSFG.calcMonthlyPayment;

  /* ---- Constants ---- */
  const UFMIP_RATE = 0.0175;

  /* ---- MIP Rate Lookup Table ---- */
  const MIP_TABLE = {
    long: { // term > 15 years
      low:  { high: 0.0055, low: 0.0050 }, // loan <= 726200
      high: { high: 0.0075, low: 0.0070 }  // loan > 726200
    },
    short: { // term <= 15 years
      low:  { high: 0.0040, low: 0.0015 }, // loan <= 726200
      high: { high: 0.0065, low: 0.0040 }  // loan > 726200
    }
  };
  const MIP_LOAN_THRESHOLD = 726200;

  /* ---- Max LTV by Occupancy / Scenario ---- */
  const MAX_LTV = {
    purchase:  { oo: 0.965 },
    rateTerm:  { oo: 0.9775 },
    cashOut:   { oo: 0.80 }
  };

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

  /* ---- Loan mode state ---- */
  let loanMode = 'purchase'; // 'purchase' or 'refi'

  /* ---- DOM helpers ---- */
  const el = (id) => document.getElementById(id);
  const val = (id) => { const e = el(id); return e ? P(e.value) : 0; };
  const txt = (id) => { const e = el(id); return e ? (e.value || '').trim() : ''; };

  function setText(id, text) {
    const e = el(id);
    if (!e) return;
    if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') e.value = text;
    else e.textContent = text;
  }

  function setHtml(id, html) {
    const e = el(id);
    if (e) e.innerHTML = html;
  }

  const COST_IDS = [
    'fhaCostOrigination', 'fhaCostProcessing', 'fhaCostUnderwriting', 'fhaCostPoints',
    'fhaCostCredit', 'fhaCostFlood', 'fhaCostInspection',
    'fhaCostTitleSearch', 'fhaCostTitleInsurance', 'fhaCostRecording', 'fhaCostAttorney',
    'fhaCostSurvey', 'fhaCostPest', 'fhaCostOther'
  ];

  /* ---- Debounce ---- */
  let _timer;
  function debounce(fn, ms) {
    return function () { clearTimeout(_timer); _timer = setTimeout(fn, ms); };
  }

  /* ===========================================================
     Read All Inputs
     =========================================================== */
  function sumClosingCosts() {
    let total = 0;
    for (const id of COST_IDS) total += val(id);
    return total;
  }

  function readInputs() {
    return {
      borrowerName:       txt('fhaBorrowerName'),
      caseId:             txt('fhaCaseId'),
      appraisedValue:     val('fhaAppraisedValue'),
      purchasePrice:      val('fhaPurchasePrice'),
      propertyType:       txt('fhaPropertyType'),
      occupancy:          'oo', // FHA requires owner-occupied
      countyLimit:        val('fhaCountyLimit'),
      isExistingFha:      el('fhaIsExistingFha') ? el('fhaIsExistingFha').checked : false,
      currentUpb:         val('fhaCurrentUpb'),
      currentRate:        val('fhaCurrentRate'),
      currentPayment:     val('fhaCurrentPayment'),
      currentLoanType:    txt('fhaCurrentLoanType'),
      currentMipRate:     0, // auto-calculated in recalculate()
      originalLoanAmount: val('fhaOriginalLoanAmount'),
      remainingTerm:      val('fhaRemainingTerm'),
      endorsementDate:    txt('fhaEndorsementDate'),
      firstPaymentDate:   txt('fhaFirstPaymentDate'),
      currentDate:        txt('fhaCurrentDate'),
      totalClosingCosts:  sumClosingCosts(),
      accruedInterest:    val('fhaAccruedInterest'),
      newRate:            val('fhaNewRate'),
      newTerm:            parseInt(txt('fhaNewTerm'), 10) || 30,
      newLoanType:        txt('fhaNewLoanType'),
      requestedLoanAmount: val('fhaRequestedLoanAmount'),
      financeUfmip:       el('fhaFinanceUfmip') ? el('fhaFinanceUfmip').checked : true,
      prepaidsCash:       val('fhaPrepaidsCash'),
      totalCredits:       val('fhaTotalCredits'),
      escrowRefund:       val('fhaEscrowRefund')
    };
  }

  /* ===========================================================
     MIP Rate Lookup
     =========================================================== */
  function lookupMipRate(baseLoan, ltv, termYears) {
    const tier = termYears > 15 ? MIP_TABLE.long : MIP_TABLE.short;
    const bracket = baseLoan <= MIP_LOAN_THRESHOLD ? tier.low : tier.high;
    const ltvThreshold = termYears > 15 ? 0.95 : 0.90;
    return ltv > ltvThreshold ? bracket.high : bracket.low;
  }

  /* ===========================================================
     Three-Way Max Mortgage Calculation
     =========================================================== */
  function calcThreeWayMax(state, scenario, value, ufmipRefund) {
    const occupancy = state.occupancy || 'oo';

    // 1. LTV calc
    let maxLtvPct;
    if (scenario === 'purchase') {
      maxLtvPct = (MAX_LTV.purchase[occupancy] !== undefined)
        ? MAX_LTV.purchase[occupancy] : MAX_LTV.purchase.oo;
    } else if (scenario === 'cashOut') {
      maxLtvPct = MAX_LTV.cashOut[occupancy] !== undefined
        ? MAX_LTV.cashOut[occupancy] : MAX_LTV.cashOut.oo;
    } else {
      // rateTerm or streamline
      maxLtvPct = (MAX_LTV.rateTerm[occupancy] !== undefined)
        ? MAX_LTV.rateTerm[occupancy] : MAX_LTV.rateTerm.oo;
    }

    const ltvCalc = value > 0 ? value * maxLtvPct : 0;

    // 2. Existing debt calc (refi only)
    let existingDebtCalc = 0;
    if (scenario !== 'purchase' && state.currentUpb > 0) {
      const refundCredit = ufmipRefund ? ufmipRefund.refundAmount : 0;
      existingDebtCalc = state.currentUpb + state.totalClosingCosts
        + state.prepaidsCash + state.accruedInterest
        - refundCredit - state.totalCredits;
    }

    // 3. Statutory limit
    const statutoryLimit = state.countyLimit > 0 ? state.countyLimit : 0;

    // Max base = min of positive values
    const candidates = [];
    if (ltvCalc > 0) candidates.push(ltvCalc);
    if (existingDebtCalc > 0 && scenario !== 'purchase') candidates.push(existingDebtCalc);
    if (statutoryLimit > 0) candidates.push(statutoryLimit);

    const maxBase = candidates.length > 0 ? Math.min(...candidates) : 0;

    return { ltvCalc, existingDebtCalc, statutoryLimit, maxBase, maxLtvPct };
  }

  /* ===========================================================
     Net Tangible Benefit — Combined Rate Method
     =========================================================== */
  function evaluateNtb(state, scenario, newPI, newMipMonthly, annualMipRate) {
    const result = { met: null, detail: '' };

    if (!state.currentPayment || !newPI) {
      result.detail = 'Insufficient data';
      return result;
    }

    const oldType = state.currentLoanType;
    const newType = state.newLoanType;
    const combinedRateOld = state.currentRate + state.currentMipRate;
    const combinedRateNew = state.newRate + (annualMipRate * 100);
    const combinedDiff = combinedRateOld - combinedRateNew;

    const oldPayment = state.currentPayment;
    const newTotal = newPI + newMipMonthly;

    const isStreamline = scenario === 'streamline';

    // Seasoning-based ARM check
    let armSeasoning = 0;
    if (state.firstPaymentDate && state.currentDate) {
      const fp = new Date(state.firstPaymentDate);
      const cd = new Date(state.currentDate);
      if (!isNaN(fp.getTime()) && !isNaN(cd.getTime())) {
        armSeasoning = Math.max(0,
          (cd.getFullYear() - fp.getFullYear()) * 12 + (cd.getMonth() - fp.getMonth())
        );
      }
    }

    // Fixed -> Fixed: combined rate new must be >= 0.5% below old
    if (oldType === 'fixed' && newType === 'fixed') {
      if (combinedDiff >= 0.5) {
        result.met = true;
        result.detail = 'Combined rate reduced ' + combinedDiff.toFixed(3)
          + '% (\u22650.5% required)';
      } else {
        result.met = false;
        result.detail = 'Combined rate reduction ' + combinedDiff.toFixed(3)
          + '% < 0.5% required';
      }
    }

    // ARM (< 15mo seasoning) -> Fixed: new can be <= 2% above old
    else if (oldType === 'arm' && newType === 'fixed') {
      if (armSeasoning < 15) {
        // Less than 15 months seasoning: new can be up to 2% above old
        if (combinedDiff >= -2) {
          result.met = true;
          result.detail = 'ARM\u2192Fixed (< 15mo): combined rate diff '
            + combinedDiff.toFixed(3) + '% (up to 2% increase allowed)';
        } else {
          result.met = false;
          result.detail = 'ARM\u2192Fixed (< 15mo): rate increase '
            + Math.abs(combinedDiff).toFixed(3) + '% exceeds 2% limit';
        }
      } else {
        // 15+ months seasoning: treat like fixed-to-fixed
        if (combinedDiff >= 0.5) {
          result.met = true;
          result.detail = 'ARM\u2192Fixed (\u226515mo): combined rate reduced '
            + combinedDiff.toFixed(3) + '%';
        } else {
          result.met = false;
          result.detail = 'ARM\u2192Fixed (\u226515mo): combined rate reduction '
            + combinedDiff.toFixed(3) + '% < 0.5%';
        }
      }
    }

    // Fixed -> 1yr ARM: combined new must be >= 2% below old
    else if (oldType === 'fixed' && newType === 'arm') {
      if (combinedDiff >= 2) {
        result.met = true;
        result.detail = 'Fixed\u21921yr ARM: combined rate reduced '
          + combinedDiff.toFixed(3) + '% (\u22652% required)';
      } else {
        result.met = false;
        result.detail = 'Fixed\u21921yr ARM: combined rate reduction '
          + combinedDiff.toFixed(3) + '% < 2% required';
      }
    }

    // ARM -> ARM/Hybrid: combined new must be >= 1% below old
    else if (oldType === 'arm' && newType === 'arm') {
      if (combinedDiff >= 1) {
        result.met = true;
        result.detail = 'ARM\u2192ARM: combined rate reduced '
          + combinedDiff.toFixed(3) + '% (\u22651% required)';
      } else {
        result.met = false;
        result.detail = 'ARM\u2192ARM: combined rate reduction '
          + combinedDiff.toFixed(3) + '% < 1% required';
      }
    }

    // Streamline 5% combined P&I + MIP reduction test
    if (isStreamline && result.met !== true) {
      const pctReduction = (oldPayment - newTotal) / oldPayment;
      if (pctReduction >= 0.05) {
        result.met = true;
        result.detail = 'Streamline: payment reduced '
          + (pctReduction * 100).toFixed(2) + '% (\u22655% required)';
      } else if (result.met === null) {
        result.met = false;
        result.detail = 'Streamline: only ' + (pctReduction * 100).toFixed(2)
          + '% reduction (need \u22655%)';
      }
    }

    // Term Reduction test: if new term < remaining AND rate not increased AND payment increase <= $50
    if (result.met !== true && state.remainingTerm > 0) {
      const newTermMonths = state.newTerm * 12;
      const remainingMonths = state.remainingTerm;
      if (newTermMonths < remainingMonths
        && state.newRate <= state.currentRate
        && (newTotal - oldPayment) <= 50) {
        result.met = true;
        result.detail = 'Term reduction: ' + remainingMonths + 'mo \u2192 '
          + newTermMonths + 'mo, payment increase \u2264$50';
      }
    }

    return result;
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

    if (!pmtsEl || !daysEl) return;

    if (seasoning.paymentsMade === null) {
      pmtsEl.textContent = '\u2014';
      daysEl.textContent = '\u2014';
      if (pmtsCard) pmtsCard.className = 'fha-status-card';
      if (daysCard) daysCard.className = 'fha-status-card';
      if (pmtsDetail) pmtsDetail.textContent = '';
      if (daysDetail) daysDetail.textContent = '';
      return;
    }

    pmtsEl.textContent = seasoning.paymentsMade;
    daysEl.textContent = seasoning.daysSince;

    if (pmtsCard) pmtsCard.className = 'fha-status-card ' + (seasoning.paymentsPass ? 'pass' : 'fail');
    if (daysCard) daysCard.className = 'fha-status-card ' + (seasoning.daysPass ? 'pass' : 'fail');

    if (pmtsDetail) {
      pmtsDetail.textContent = seasoning.paymentsPass
        ? 'Meets requirement (\u22656 payments)'
        : 'Need ' + (6 - seasoning.paymentsMade) + ' more payment(s)';
      pmtsDetail.style.color = seasoning.paymentsPass ? '#2e7d32' : '#c62828';
    }

    if (daysDetail) {
      daysDetail.textContent = seasoning.daysPass
        ? 'Meets requirement (\u2265210 days)'
        : 'Need ' + (210 - seasoning.daysSince) + ' more day(s)';
      daysDetail.style.color = seasoning.daysPass ? '#2e7d32' : '#c62828';
    }
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
     Format Helpers
     =========================================================== */
  function formatCashToClose(amount) {
    if (!Number.isFinite(amount)) return '\u2014';
    if (amount > 0.01) return fmt(amount) + ' due';
    if (amount < -0.01) return fmt(Math.abs(amount)) + ' to borrower';
    return '$0.00';
  }

  function minPositive(a, b) {
    const vals = [a, b].filter(v => Number.isFinite(v) && v > 0);
    return vals.length ? Math.min(...vals) : 0;
  }

  function monthsBetweenDates(date1, date2) {
    if (!date1 || !date2) return 0;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return Math.max(0,
      (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())
    );
  }

  /* ===========================================================
     Scenario Calculator — computes one refi or purchase scenario
     =========================================================== */
  function calcScenario(state, scenario, value, ufmipRefund) {
    const isStreamline = scenario === 'streamline';

    // Three-way max mortgage
    const threeWay = calcThreeWayMax(state, scenario, value, ufmipRefund);

    // For streamline, base loan = UPB - UFMIP refund (overrides three-way)
    let maxBase;
    if (isStreamline) {
      maxBase = Math.max(0, state.currentUpb - ufmipRefund.refundAmount);
    } else {
      maxBase = threeWay.maxBase;
    }

    // Actual base loan
    let actualBase;
    let cappedNote = '';
    if (isStreamline) {
      actualBase = maxBase; // streamline is formula-driven
    } else if (state.requestedLoanAmount > 0 && state.requestedLoanAmount <= maxBase) {
      actualBase = state.requestedLoanAmount;
    } else {
      actualBase = maxBase;
      if (state.requestedLoanAmount > maxBase && maxBase > 0) {
        cappedNote = 'Requested amount exceeds max \u2014 capped at ' + fmt(maxBase) + '.';
      }
    }

    // UFMIP
    const ufmipAmt = actualBase * UFMIP_RATE;
    const totalLoan = state.financeUfmip ? actualBase + ufmipAmt : actualBase;

    // LTV
    const ltv = value > 0 ? actualBase / value : 0;

    // Annual MIP rate
    const annualMipRate = lookupMipRate(actualBase, ltv, state.newTerm);
    const monthlyMIP = (actualBase * annualMipRate) / 12;

    // Monthly P&I
    const monthlyPI = (totalLoan > 0 && state.newRate > 0 && state.newTerm > 0)
      ? pmt(totalLoan, state.newRate / 100, state.newTerm)
      : 0;

    // Total monthly = PI + MIP only
    const totalMonthly = monthlyPI + monthlyMIP;

    // NTB
    const ntb = evaluateNtb(state, scenario, monthlyPI, monthlyMIP, annualMipRate);

    // Cash to close — compute and keep breakdown
    let cashToClose;
    const ctcBreakdown = {
      downPayment: 0, ufmipOop: 0, payoff: 0,
      closingCosts: 0, prepaids: state.prepaidsCash,
      accrued: 0, loanCredit: 0,
      credits: state.totalCredits, escrowRefund: 0
    };

    if (scenario === 'purchase') {
      ctcBreakdown.downPayment = Math.max(0, (state.purchasePrice || value) - actualBase);
      ctcBreakdown.ufmipOop = state.financeUfmip ? 0 : ufmipAmt;
      cashToClose = ctcBreakdown.downPayment + state.prepaidsCash
        + ctcBreakdown.ufmipOop - state.totalCredits;
    } else if (isStreamline) {
      ctcBreakdown.escrowRefund = state.escrowRefund;
      cashToClose = state.prepaidsCash - state.totalCredits - state.escrowRefund;
    } else {
      ctcBreakdown.payoff = state.currentUpb || 0;
      ctcBreakdown.closingCosts = state.totalClosingCosts;
      ctcBreakdown.accrued = state.accruedInterest;
      ctcBreakdown.loanCredit = totalLoan;
      ctcBreakdown.escrowRefund = state.escrowRefund;
      cashToClose = (ctcBreakdown.payoff + state.totalClosingCosts
        + state.prepaidsCash + state.accruedInterest)
        - totalLoan - state.totalCredits - state.escrowRefund;
    }

    return {
      threeWay, maxBase, actualBase, ufmipAmt, totalLoan, ltv,
      annualMipRate, monthlyPI, monthlyMIP, totalMonthly,
      ntb, cashToClose, ctcBreakdown, cappedNote
    };
  }

  /* ===========================================================
     NTB Pill HTML
     =========================================================== */
  function ntbPillHtml(ntb) {
    if (ntb.met === null) return '<span class="fha-ntb-pill na">N/A</span>';
    if (ntb.met) return '<span class="fha-ntb-pill pass">PASS</span>';
    return '<span class="fha-ntb-pill fail">FAIL</span>';
  }

  /* ===========================================================
     Render a refi scenario column
     =========================================================== */
  function renderRefiColumn(prefix, r, ufmipRefund, isNA) {
    if (isNA) {
      const ids = ['maxLoan', 'ufmipRefund', 'ufmip', 'totalLoan', 'ltv',
        'pi', 'mip', 'total', 'ntb', 'ntbDetail',
        'payoff', 'closingCosts', 'prepaids', 'accrued', 'loanCredit',
        'credits', 'escrowRefund', 'cashToClose'];
      ids.forEach(id => setText(prefix + id, 'N/A'));
      return;
    }
    setText(prefix + 'maxLoan', r.maxBase > 0 ? fmt(r.maxBase) : '\u2014');
    setText(prefix + 'ufmipRefund', ufmipRefund && ufmipRefund.refundAmount > 0
      ? '-' + fmt(ufmipRefund.refundAmount)
        + ' (' + ufmipRefund.refundPercent + '% at mo ' + ufmipRefund.monthsSince + ')'
      : '\u2014');
    setText(prefix + 'ufmip', r.ufmipAmt > 0 ? fmt(r.ufmipAmt) : '\u2014');
    setText(prefix + 'totalLoan', r.totalLoan > 0 ? fmt(r.totalLoan) : '\u2014');
    setText(prefix + 'ltv', r.ltv > 0 ? MSFG.formatPercent(r.ltv * 100) : '\u2014');
    setText(prefix + 'pi', r.monthlyPI > 0 ? fmt(r.monthlyPI) : '\u2014');
    setText(prefix + 'mip', r.monthlyMIP > 0 ? fmt(r.monthlyMIP) : '\u2014');
    setText(prefix + 'total', r.totalMonthly > 0 ? fmt(r.totalMonthly) : '\u2014');
    setHtml(prefix + 'ntb', ntbPillHtml(r.ntb));
    setText(prefix + 'ntbDetail', r.ntb.detail || '');

    // Cash to close breakdown
    const b = r.ctcBreakdown;
    setText(prefix + 'payoff', b.payoff > 0 ? fmt(b.payoff) : '$0.00');
    setText(prefix + 'closingCosts', b.closingCosts > 0 ? fmt(b.closingCosts) : '$0.00');
    setText(prefix + 'prepaids', b.prepaids > 0 ? fmt(b.prepaids) : '$0.00');
    setText(prefix + 'accrued', b.accrued > 0 ? fmt(b.accrued) : '$0.00');
    setText(prefix + 'loanCredit', b.loanCredit > 0 ? '-' + fmt(b.loanCredit) : '$0.00');
    setText(prefix + 'credits', b.credits > 0 ? '-' + fmt(b.credits) : '$0.00');
    setText(prefix + 'escrowRefund', b.escrowRefund > 0 ? '-' + fmt(b.escrowRefund) : '$0.00');
    setText(prefix + 'cashToClose', formatCashToClose(r.cashToClose));
  }

  /* ===========================================================
     Main Recalculate — Live Calc
     =========================================================== */
  function recalculate() {
    const state = readInputs();
    const notes = [];
    const isRefi = loanMode === 'refi';

    // Determine the value basis
    let value;
    if (!isRefi) {
      value = minPositive(state.purchasePrice, state.appraisedValue);
    } else {
      value = state.appraisedValue || 0;
    }

    // Check if we have enough data to show results
    const hasEnoughData = !isRefi
      ? (state.purchasePrice > 0 || state.appraisedValue > 0)
      : (state.appraisedValue > 0 || state.currentUpb > 0);

    const resultsSection = el('fhaResultsSection');
    if (!hasEnoughData) {
      if (resultsSection) resultsSection.classList.add('u-hidden');
      return;
    }
    if (resultsSection) resultsSection.classList.remove('u-hidden');

    // Closing costs display
    setText('fhaTotalClosingCosts', fmt(state.totalClosingCosts));

    // Seasoning (refi only)
    const seasoning = validateSeasoning(state);
    if (isRefi) renderSeasoningStatus(seasoning);

    // UFMIP Refund (refi with existing FHA)
    const ufmipRefund = (isRefi && state.isExistingFha)
      ? calculateUfmipRefund(state)
      : { refundPercent: 0, refundAmount: 0, originalUfmip: 0, monthsSince: 0 };

    // Auto-calculate current MIP rate from existing loan data for NTB
    if (isRefi && state.isExistingFha && state.originalLoanAmount > 0) {
      const origValue = state.appraisedValue || state.originalLoanAmount;
      const origLtv = origValue > 0 ? state.originalLoanAmount / origValue : 0.96;
      const origTermYears = state.remainingTerm > 0
        ? Math.ceil(state.remainingTerm / 12) : 30;
      const oldMipRate = lookupMipRate(state.originalLoanAmount, origLtv, origTermYears);
      state.currentMipRate = oldMipRate * 100; // store as percent to match currentRate
    }

    if (!isRefi) {
      // ========== PURCHASE MODE ==========
      const r = calcScenario(state, 'purchase', value, null);

      // Three-calc max mortgage display
      setText('fhaLtvCalc', r.threeWay.ltvCalc > 0 ? fmt(r.threeWay.ltvCalc) : '\u2014');
      setText('fhaStatutoryLimit', r.threeWay.statutoryLimit > 0 ? fmt(r.threeWay.statutoryLimit) : '\u2014');
      setText('fhaMaxBaseLoan', r.maxBase > 0 ? fmt(r.maxBase) : '\u2014');

      // Loan amounts
      setText('fhaActualBaseLoan', r.actualBase > 0 ? fmt(r.actualBase) : '\u2014');
      setText('fhaNewUfmipAmt', r.ufmipAmt > 0 ? fmt(r.ufmipAmt) : '\u2014');
      setText('fhaTotalLoanAmt', r.totalLoan > 0 ? fmt(r.totalLoan) : '\u2014');
      setText('fhaLtv', r.ltv > 0 ? MSFG.formatPercent(r.ltv * 100) : '\u2014');
      setText('fhaMipRateDisplay', (r.annualMipRate * 100).toFixed(2) + '%');

      // Monthly breakdown
      setText('fhaMonthlyPI', r.monthlyPI > 0 ? fmt(r.monthlyPI) : '\u2014');
      setText('fhaMonthlyMip', r.monthlyMIP > 0 ? fmt(r.monthlyMIP) : '\u2014');
      setText('fhaTotalMonthly', r.totalMonthly > 0 ? fmt(r.totalMonthly) : '\u2014');

      // Cash to close breakdown
      setText('fhaDownPayment', r.ctcBreakdown.downPayment > 0 ? fmt(r.ctcBreakdown.downPayment) : '$0.00');
      setText('fhaPrepaidsDisplay', r.ctcBreakdown.prepaids > 0 ? fmt(r.ctcBreakdown.prepaids) : '$0.00');
      setText('fhaCreditsDisplay', r.ctcBreakdown.credits > 0 ? '-' + fmt(r.ctcBreakdown.credits) : '$0.00');
      const ufmipOopRow = el('fhaUfmipOopRow');
      if (ufmipOopRow) {
        if (r.ctcBreakdown.ufmipOop > 0) {
          ufmipOopRow.style.display = '';
          setText('fhaUfmipOop', fmt(r.ctcBreakdown.ufmipOop));
        } else {
          ufmipOopRow.style.display = 'none';
        }
      }
      setText('fhaCashToClose', formatCashToClose(r.cashToClose));

      // Notes
      notes.push('Max base loan at '
        + (r.threeWay.maxLtvPct * 100).toFixed(2) + '% of lesser of price or value.');
      if (r.cappedNote) notes.push(r.cappedNote);
      if (!state.financeUfmip && r.ufmipAmt > 0) {
        notes.push('UFMIP of ' + fmt(r.ufmipAmt) + ' not financed \u2014 due at closing.');
      }

      // Render calc steps for purchase
      renderCalcSteps(state, {
        scenario: 'purchase', value, maxBase: r.maxBase, actualBase: r.actualBase,
        ufmipAmt: r.ufmipAmt, totalLoan: r.totalLoan, ltv: r.ltv,
        annualMipRate: r.annualMipRate, monthlyPI: r.monthlyPI, monthlyMIP: r.monthlyMIP,
        totalMonthly: r.totalMonthly, cashToClose: r.cashToClose,
        ntb: r.ntb, ufmipRefund: ufmipRefund, threeWay: r.threeWay,
        isStreamline: false, isCashOut: false
      });

      // Workspace tally
      if (window.top !== window) {
        window.top.postMessage({
          type: 'msfg-tally-update',
          slug: 'fha',
          monthlyPayment: r.totalMonthly,
          loanAmount: r.totalLoan,
          cashToClose: r.cashToClose
        }, window.location.origin);
      }

    } else {
      // ========== REFI MODE — compute all three scenarios ==========
      const rtResult = calcScenario(state, 'rateTerm', value, ufmipRefund);
      const coResult = calcScenario(state, 'cashOut', value, ufmipRefund);

      // Streamline: only if existing FHA and UPB > 0
      const slEligible = state.isExistingFha && state.currentUpb > 0;
      const slResult = slEligible
        ? calcScenario(state, 'streamline', value, ufmipRefund)
        : null;

      // Render Rate/Term column
      renderRefiColumn('fhaRT_', rtResult, ufmipRefund, false);

      // Render Cash-Out column
      renderRefiColumn('fhaCO_', coResult, ufmipRefund, false);

      // Render Streamline column
      renderRefiColumn('fhaSL_', slResult, ufmipRefund, !slEligible);

      // Seasoning summary for streamline
      const seasoningSummary = el('fhaSeasoningSummary');
      const seasoningText = el('fhaSeasoningSummaryText');
      if (seasoningSummary && seasoningText) {
        if (slEligible && seasoning.paymentsMade !== null) {
          seasoningSummary.style.display = '';
          const bothPass = seasoning.paymentsPass && seasoning.daysPass;
          seasoningText.textContent = seasoning.paymentsMade + ' payments, '
            + seasoning.daysSince + ' days \u2014 '
            + (bothPass ? 'Meets requirements' : 'Does NOT meet requirements');
          seasoningText.style.color = bothPass ? '#2e7d32' : '#c62828';
        } else {
          seasoningSummary.style.display = 'none';
        }
      }

      // Notes
      notes.push('Rate/Term: max LTV ' + (rtResult.threeWay.maxLtvPct * 100).toFixed(2) + '% of appraised value.');
      notes.push('Cash-Out: max LTV ' + (coResult.threeWay.maxLtvPct * 100).toFixed(2) + '% of appraised value.');
      if (slEligible) {
        notes.push('Streamline: base loan = UPB \u2212 UFMIP refund.');
        if (ufmipRefund.refundAmount > 0) {
          notes.push('UFMIP Refund: ' + fmt(ufmipRefund.refundAmount)
            + ' (' + ufmipRefund.refundPercent + '% at month ' + ufmipRefund.monthsSince + ').');
        }
      } else {
        notes.push('Streamline: not eligible (requires existing FHA loan with UPB > 0).');
      }

      if (state.endorsementDate && state.currentDate) {
        const months = monthsBetweenDates(state.endorsementDate, state.currentDate);
        if (months < 12) {
          notes.push('Cash-Out: owned < 12 months \u2014 may not be eligible.');
        }
      }

      if (!state.financeUfmip) {
        notes.push('UFMIP not financed \u2014 due at closing.');
      }

      // Render calc steps using Rate/Term as primary
      renderCalcSteps(state, {
        scenario: 'rateTerm', value, maxBase: rtResult.maxBase, actualBase: rtResult.actualBase,
        ufmipAmt: rtResult.ufmipAmt, totalLoan: rtResult.totalLoan, ltv: rtResult.ltv,
        annualMipRate: rtResult.annualMipRate, monthlyPI: rtResult.monthlyPI, monthlyMIP: rtResult.monthlyMIP,
        totalMonthly: rtResult.totalMonthly, cashToClose: rtResult.cashToClose,
        ntb: rtResult.ntb, ufmipRefund: ufmipRefund, threeWay: rtResult.threeWay,
        isStreamline: false, isCashOut: false
      });

      // Workspace tally: send Rate/Term figures as primary
      if (window.top !== window) {
        window.top.postMessage({
          type: 'msfg-tally-update',
          slug: 'fha',
          monthlyPayment: rtResult.totalMonthly,
          loanAmount: rtResult.totalLoan,
          cashToClose: rtResult.cashToClose
        }, window.location.origin);
      }
    }

    // Render notes
    const notesList = el('fhaResultNotes');
    if (notesList) {
      notesList.innerHTML = '';
      notes.forEach(note => {
        const li = document.createElement('li');
        li.textContent = note;
        notesList.appendChild(li);
      });
    }
  }

  /* ===========================================================
     Render Calc Steps
     =========================================================== */
  function renderCalcSteps(state, r) {
    const container = el('calcSteps-fha');
    if (!container) return;

    const steps = [];

    if (r.scenario === 'purchase') {
      steps.push(step('Value Used',
        'Lesser of ' + fmt(state.purchasePrice) + ' and ' + fmt(state.appraisedValue),
        fmt(r.value)));
      steps.push(step('Max Base Loan',
        'Value \u00D7 ' + (r.threeWay.maxLtvPct * 100).toFixed(2) + '%',
        fmt(r.threeWay.ltvCalc)));
    } else if (r.isStreamline) {
      steps.push(step('Current UPB', '', fmt(state.currentUpb)));
      if (r.ufmipRefund.refundAmount > 0) {
        steps.push(step('UFMIP Refund',
          fmt(r.ufmipRefund.originalUfmip) + ' \u00D7 ' + r.ufmipRefund.refundPercent + '%',
          '-' + fmt(r.ufmipRefund.refundAmount)));
      }
      steps.push(step('Base Loan', 'UPB \u2212 UFMIP refund', fmt(r.maxBase)));
    } else {
      steps.push(step('LTV Calc',
        fmt(state.appraisedValue) + ' \u00D7 ' + (r.threeWay.maxLtvPct * 100).toFixed(2) + '%',
        fmt(r.threeWay.ltvCalc)));
      if (r.threeWay.existingDebtCalc > 0) {
        steps.push(step('Existing Debt Calc',
          'UPB + costs + prepaids + accrued int \u2212 refund \u2212 credits',
          fmt(r.threeWay.existingDebtCalc)));
      }
      if (r.threeWay.statutoryLimit > 0) {
        steps.push(step('Statutory Limit', 'County loan limit', fmt(r.threeWay.statutoryLimit)));
      }
      steps.push(step('Max Base Loan', 'Min of above', fmt(r.maxBase)));
    }

    if (r.actualBase !== r.maxBase) {
      steps.push(step('Actual Base Loan', 'Requested (capped at max)', fmt(r.actualBase)));
    }

    steps.push(step('UFMIP',
      fmt(r.actualBase) + ' \u00D7 1.75%' + (state.financeUfmip ? ' (financed)' : ' (cash)'),
      fmt(r.ufmipAmt)));
    steps.push(step('Total Loan',
      'Base + ' + (state.financeUfmip ? 'UFMIP' : '(UFMIP not financed)'),
      fmt(r.totalLoan)));

    if (r.ltv > 0) {
      steps.push(step('LTV', fmt(r.actualBase) + ' \u00F7 ' + fmt(r.value),
        (r.ltv * 100).toFixed(2) + '%'));
    }

    steps.push(step('Annual MIP Rate', 'Lookup based on loan amount, LTV, term',
      (r.annualMipRate * 100).toFixed(2) + '%'));
    steps.push(step('Monthly MIP',
      fmt(r.actualBase) + ' \u00D7 ' + (r.annualMipRate * 100).toFixed(2) + '% \u00F7 12',
      fmt(r.monthlyMIP)));

    if (r.monthlyPI > 0) {
      steps.push(step('Monthly P&I',
        fmt(r.totalLoan) + ' @ ' + state.newRate + '% / ' + state.newTerm + 'yr',
        fmt(r.monthlyPI)));
    }

    steps.push(step('Total Monthly', 'P&I + MIP', fmt(r.totalMonthly)));

    if (r.ntb.met !== null) {
      steps.push(step('NTB', r.ntb.detail,
        r.ntb.met === true ? 'PASS' : 'FAIL'));
    }

    steps.push(step('Cash to Close', '', formatCashToClose(r.cashToClose)));

    const title = r.scenario === 'purchase' ? 'Purchase'
      : r.isStreamline ? 'Streamline'
      : r.isCashOut ? 'Cash-Out Refi' : 'Rate/Term Refi';

    container.innerHTML = stepSection(title + ' Calculation', steps);
  }

  function stepSection(title, steps) {
    let html = '<div class="calc-step"><h4>' + MSFG.escHtml(title) + '</h4>';
    html += '<div class="calc-step__formula">';
    steps.forEach(s => {
      html += '<div style="margin-bottom:4px;"><strong>'
        + MSFG.escHtml(s.label) + ':</strong> ';
      if (s.formula) {
        html += '<span style="color:var(--color-gray-500)">'
          + MSFG.escHtml(s.formula) + '</span> = ';
      }
      html += '<strong>' + MSFG.escHtml(s.value) + '</strong></div>';
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
    if (!tbody) return;
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
        refundTable[parseInt(e.target.dataset.idx, 10)].refund = parseFloat(e.target.value) || 0;
        recalculate();
      }
    });
  }

  function resetRefundTable() {
    refundTable = DEFAULT_REFUND_TABLE.map(r => Object.assign({}, r));
    populateRefundTable();
    recalculate();
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
        if (!body) return;
        if (body.classList.contains('collapsed')) {
          body.classList.remove('collapsed');
          if (icon) icon.classList.remove('collapsed');
        } else {
          body.classList.add('collapsed');
          if (icon) icon.classList.add('collapsed');
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
        dropZone.textContent = 'MISMO loaded: ' + file.name;
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
        const optByVal = field.querySelector('option[value="' + value + '"]');
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
      field.classList.remove('is-default');
      field.classList.add('mismo-populated');
    }

    // Trigger recalculation after MISMO data is applied
    recalculate();
  }

  /* ===========================================================
     Purchase / Refi Toggle
     =========================================================== */
  function initLoanToggle() {
    const btns = document.querySelectorAll('.fha-toggle-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loanMode = btn.dataset.mode;
        applyLoanMode();
        recalculate();
      });
    });
    applyLoanMode();
  }

  function applyLoanMode() {
    const purchaseEls = document.querySelectorAll('.fha-purchase-only');
    const refiEls = document.querySelectorAll('.fha-refi-only');

    if (loanMode === 'purchase') {
      purchaseEls.forEach(e => { e.style.display = ''; });
      refiEls.forEach(e => { e.style.display = 'none'; });
    } else {
      purchaseEls.forEach(e => { e.style.display = 'none'; });
      refiEls.forEach(e => { e.style.display = ''; });
    }
  }

  /* ===========================================================
     CalcActions — Print / Email Data Extractor
     =========================================================== */
  function registerCalcActions() {
    if (!MSFG.CalcActions) return;

    MSFG.CalcActions.register(function () {
      const g = (id) => { const e = el(id); return e ? e.textContent : '\u2014'; };
      const sections = [];

      // Borrower & Property
      const borrower = txt('fhaBorrowerName');
      const caseId = txt('fhaCaseId');
      const propRows = [];
      if (borrower) propRows.push({ label: 'Borrower', value: borrower });
      if (caseId) propRows.push({ label: 'FHA Case ID', value: caseId });
      propRows.push(
        { label: 'Appraised Value', value: val('fhaAppraisedValue') ? fmt(val('fhaAppraisedValue')) : '\u2014' },
        { label: 'Purchase Price', value: val('fhaPurchasePrice') ? fmt(val('fhaPurchasePrice')) : 'N/A' }
      );
      if (val('fhaCountyLimit') > 0) {
        propRows.push({ label: 'County Loan Limit', value: fmt(val('fhaCountyLimit')) });
      }
      sections.push({ heading: 'Borrower & Property', rows: propRows });

      // Current Loan (refi only)
      if (loanMode === 'refi' && val('fhaCurrentUpb') > 0) {
        const currentRows = [
          { label: 'Current UPB', value: fmt(val('fhaCurrentUpb')) },
          { label: 'Current Rate', value: val('fhaCurrentRate') ? val('fhaCurrentRate') + '%' : '\u2014' },
          { label: 'Current P&I + MIP', value: val('fhaCurrentPayment') ? fmt(val('fhaCurrentPayment')) : '\u2014' },
          { label: 'Existing FHA', value: el('fhaIsExistingFha') && el('fhaIsExistingFha').checked ? 'Yes' : 'No' }
        ];
        sections.push({ heading: 'Current Loan', rows: currentRows });
      }

      // New Loan Parameters
      sections.push({
        heading: 'New Loan Parameters',
        rows: [
          { label: 'Interest Rate', value: val('fhaNewRate') ? val('fhaNewRate') + '%' : '\u2014' },
          { label: 'Loan Term', value: txt('fhaNewTerm') + ' years' },
          { label: 'Loan Type', value: txt('fhaNewLoanType') === 'arm' ? 'ARM' : 'Fixed' },
          { label: 'Finance UFMIP', value: el('fhaFinanceUfmip') && el('fhaFinanceUfmip').checked ? 'Yes' : 'No' }
        ]
      });

      if (loanMode === 'purchase') {
        // Purchase results from single-column IDs
        const resultRows = [
          { label: 'Max Base Loan', value: g('fhaMaxBaseLoan') },
          { label: 'Actual Base Loan', value: g('fhaActualBaseLoan') },
          { label: 'UFMIP', value: g('fhaNewUfmipAmt') },
          { label: 'Total Loan', value: g('fhaTotalLoanAmt'), isTotal: true },
          { label: 'LTV', value: g('fhaLtv') },
          { label: 'Annual MIP Rate', value: g('fhaMipRateDisplay') },
          { label: 'Monthly P&I', value: g('fhaMonthlyPI') },
          { label: 'Monthly MIP', value: g('fhaMonthlyMip') },
          { label: 'Total Monthly', value: g('fhaTotalMonthly'), isTotal: true },
          { label: 'Est. Cash to Close', value: g('fhaCashToClose'), isTotal: true }
        ];
        sections.push({ heading: 'Purchase Results', rows: resultRows });
      } else {
        // Refi comparison — extract all three columns
        const scenarioNames = ['Rate/Term', 'Cash-Out', 'Streamline'];
        const prefixes = ['fhaRT_', 'fhaCO_', 'fhaSL_'];
        const fields = [
          ['Max Base Loan', 'maxLoan'],
          ['UFMIP', 'ufmip'],
          ['Total Loan', 'totalLoan'],
          ['LTV', 'ltv'],
          ['P&I', 'pi'],
          ['Monthly MIP', 'mip'],
          ['Total Monthly', 'total'],
          ['NTB', 'ntb'],
          ['Cash to Close', 'cashToClose']
        ];

        prefixes.forEach((prefix, i) => {
          const rows = fields.map(f => ({
            label: f[0],
            value: g(prefix + f[1]),
            isTotal: f[0] === 'Total Loan' || f[0] === 'Total Monthly' || f[0] === 'Cash to Close'
          }));
          sections.push({ heading: scenarioNames[i] + ' Refi', rows });
        });
      }

      // Closing costs (if any)
      if (sumClosingCosts() > 0) {
        const costRows = [];
        const costLabels = {
          fhaCostOrigination: 'Origination', fhaCostProcessing: 'Processing',
          fhaCostUnderwriting: 'Underwriting', fhaCostPoints: 'Discount Points',
          fhaCostCredit: 'Credit Report', fhaCostFlood: 'Flood Cert',
          fhaCostInspection: 'Inspection', fhaCostTitleSearch: 'Title Search',
          fhaCostTitleInsurance: 'Title Insurance', fhaCostRecording: 'Recording',
          fhaCostAttorney: 'Attorney', fhaCostSurvey: 'Survey',
          fhaCostPest: 'Pest Inspection', fhaCostOther: 'Other'
        };
        for (const id of COST_IDS) {
          const amount = val(id);
          if (amount > 0) {
            costRows.push({ label: costLabels[id] || id, value: fmt(amount) });
          }
        }
        costRows.push({ label: 'Total Closing Costs', value: g('fhaTotalClosingCosts'), isTotal: true });
        sections.push({ heading: 'Closing Costs', rows: costRows });
      }

      return { title: 'FHA Loan Analysis', sections: sections };
    });
  }

  /* ===========================================================
     Init — DOMContentLoaded
     =========================================================== */
  function init() {
    // Default value styling
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');

    // Set current date to today
    const today = new Date().toISOString().split('T')[0];
    const cdEl = el('fhaCurrentDate');
    if (cdEl && !cdEl.value) cdEl.value = today;

    // Populate UFMIP refund table
    populateRefundTable();

    // Collapsible sections
    initCollapsibles();

    // Purchase / Refi toggle
    initLoanToggle();

    // Live calculation: bind input event on calc page with debounce
    const calcPage = document.querySelector('.calc-page');
    if (calcPage) {
      calcPage.addEventListener('input', debounce(recalculate, 100));
    }

    // Also bind change events for selects, checkboxes, and date inputs
    const changeSelectors = [
      'fhaPropertyType', 'fhaNewTerm', 'fhaNewLoanType',
      'fhaCurrentLoanType',
      'fhaEndorsementDate', 'fhaFirstPaymentDate', 'fhaCurrentDate'
    ];
    changeSelectors.forEach(id => {
      const e = el(id);
      if (e) e.addEventListener('change', recalculate);
    });

    // Checkbox change events
    const checkboxIds = ['fhaIsExistingFha', 'fhaFinanceUfmip'];
    checkboxIds.forEach(id => {
      const e = el(id);
      if (e) e.addEventListener('change', recalculate);
    });

    // Reset refund table button
    const resetBtn = el('fhaResetRefundBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetRefundTable);

    // MISMO integration
    initMISMODropZone();

    // Print / Email action bar
    registerCalcActions();

    // Initial calculation
    recalculate();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
