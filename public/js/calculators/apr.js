/* =====================================================
   APR Calculator
   ===================================================== */
(function() {
  'use strict';

  const P = MSFG.parseNum;
  const fmt = MSFG.formatCurrency;
  const pct = MSFG.formatPercent;

  function getState() {
    return {
      loanAmount: P(document.getElementById('loanAmount').value),
      interestRate: P(document.getElementById('interestRate').value) / 100,
      loanTerm: P(document.getElementById('loanTerm').value),
      discountPoints: P(document.getElementById('discountPoints').value) / 100,
      financedFees: P(document.getElementById('financedFees').value),
      prepaidFees: P(document.getElementById('prepaidFees').value)
    };
  }

  function calcPV(payment, annualRate, n) {
    if (payment <= 0 || n <= 0) return 0;
    if (annualRate === 0) return payment * n;
    const r = annualRate / 12;
    return payment * (1 - Math.pow(1 + r, -n)) / r;
  }

  function calcAPR(monthlyPmt, amtFinanced, n) {
    if (amtFinanced <= 0 || monthlyPmt <= 0 || n <= 0) return 0;
    if (monthlyPmt * n < amtFinanced) return 0;

    let lo = 0.0001, hi = 1, apr = 0;
    for (let i = 0; i < 100; i++) {
      apr = (lo + hi) / 2;
      const pv = calcPV(monthlyPmt, apr, n);
      if (Math.abs(pv - amtFinanced) < 1e-8) break;
      if (pv > amtFinanced) lo = apr; else hi = apr;
    }
    return apr;
  }

  function calculate() {
    const s = getState();
    if (s.loanAmount <= 0) return;

    const principal = s.loanAmount + s.financedFees;
    const monthlyPmt = MSFG.calcMonthlyPayment(principal, s.interestRate, s.loanTerm);
    const pointsAmt = s.loanAmount * s.discountPoints;
    const amtFinanced = s.loanAmount - pointsAmt - s.prepaidFees;
    const n = s.loanTerm * 12;
    const totalPmts = monthlyPmt * n;
    const finChg = totalPmts - amtFinanced;
    const apr = amtFinanced > 0 ? calcAPR(monthlyPmt, amtFinanced, n) : 0;
    const aprSpread = (apr - s.interestRate) * 100;
    const totalUpfront = pointsAmt + s.prepaidFees + s.financedFees;
    const monthlyFee = totalUpfront / n;

    document.getElementById('monthlyPayment').textContent = fmt(monthlyPmt);
    document.getElementById('amountFinanced').textContent = fmt(Math.max(0, amtFinanced));
    document.getElementById('financeCharges').textContent = fmt(Math.max(0, finChg));
    document.getElementById('aprResult').textContent = pct(apr * 100);
    document.getElementById('noteRateDisplay').textContent = pct(s.interestRate * 100);
    document.getElementById('aprDisplay').textContent = pct(apr * 100);
    document.getElementById('aprSpread').textContent = '+' + aprSpread.toFixed(3) + '%';
    document.getElementById('totalUpfrontCosts').textContent = fmt(totalUpfront);
    document.getElementById('monthlyFeeCost').textContent = fmt(monthlyFee) + '/mo';

    document.getElementById('aprWarning').style.display = aprSpread > 0.5 ? 'block' : 'none';

    updateMathSteps(s, principal, monthlyPmt, pointsAmt, amtFinanced, n, totalPmts, finChg, apr);
    updateURL(s);
  }

  function updateMathSteps(s, principal, monthlyPmt, pointsAmt, amtFinanced, n, totalPmts, finChg, apr) {
    const container = document.getElementById('calcSteps-apr');
    if (!container) return;

    const r = s.interestRate / 12;
    let html = '';

    html += '<div class="calc-step"><h4>Step 1: Principal for Payment</h4><div class="calc-step__formula">Principal = Loan Amount + Financed Fees<br><span class="calc-step__values">= ' + fmt(s.loanAmount) + ' + ' + fmt(s.financedFees) + ' = <strong>' + fmt(principal) + '</strong></span></div></div>';

    html += '<div class="calc-step"><h4>Step 2: Monthly Payment (P&I)</h4><div class="calc-step__formula">Payment = Principal × (r / (1 - (1+r)<sup>-n</sup>))<br><span class="calc-step__note">r = ' + pct(s.interestRate * 100) + '/12 = ' + (r * 100).toFixed(5) + '% monthly, n = ' + n + '</span><br><span class="calc-step__values">= <strong>' + fmt(monthlyPmt) + '</strong></span></div></div>';

    html += '<div class="calc-step"><h4>Step 3: Amount Financed (Reg Z)</h4><div class="calc-step__formula">Amount Financed = Loan Amount - Points - Prepaids<br><span class="calc-step__values">= ' + fmt(s.loanAmount) + ' - ' + fmt(pointsAmt) + ' - ' + fmt(s.prepaidFees) + ' = <strong>' + fmt(amtFinanced) + '</strong></span></div></div>';

    html += '<div class="calc-step"><h4>Step 4: Total Finance Charges</h4><div class="calc-step__formula">Finance Charges = (Payment × Payments) - Amount Financed<br><span class="calc-step__values">= ' + fmt(totalPmts) + ' - ' + fmt(amtFinanced) + ' = <strong>' + fmt(finChg) + '</strong></span></div></div>';

    html += '<div class="calc-step"><h4>Step 5: Solve for APR</h4><div class="calc-step__formula">Find rate where PV(all payments) = Amount Financed<br><span class="calc-step__values"><strong>APR = ' + pct(apr * 100) + '</strong></span></div></div>';

    html += '<div class="calc-step highlight"><h4>Why APR > Note Rate</h4><div class="calc-step__formula"><span class="calc-step__note">The APR exceeds the note rate because you pay interest on the full principal (including financed fees), but only receive the Amount Financed after points and prepaids.</span></div></div>';

    container.innerHTML = html;
  }

  function updateURL(s) {
    const url = new URL(window.location);
    url.search = new URLSearchParams({
      la: s.loanAmount, ir: (s.interestRate * 100).toString(),
      lt: s.loanTerm, dp: (s.discountPoints * 100).toString(),
      ff: s.financedFees, pf: s.prepaidFees
    }).toString();
    window.history.replaceState({}, '', url);
  }

  function applyState(s) {
    document.getElementById('loanAmount').value = s.loanAmount;
    document.getElementById('interestRate').value = (s.interestRate * 100).toFixed(3);
    document.getElementById('loanTerm').value = s.loanTerm;
    document.getElementById('discountPoints').value = (s.discountPoints * 100).toFixed(3);
    document.getElementById('financedFees').value = s.financedFees;
    document.getElementById('prepaidFees').value = s.prepaidFees;
  }

  function toggleFeeBreakdown(type) {
    const el = document.getElementById(type + 'FeeBreakdown');
    const txt = document.getElementById(type + 'ToggleText');
    if (el.style.display === 'none') { el.style.display = 'block'; txt.textContent = 'Hide Fee Breakdown'; }
    else { el.style.display = 'none'; txt.textContent = 'Show Fee Breakdown'; }
  }

  function updateFinancedFees() {
    const ids = ['originationFee','processingFee','underwritingFee','applicationFee','otherFinancedFees'];
    let total = 0;
    ids.forEach(function(id) { total += P(document.getElementById(id).value); });
    document.getElementById('financedFees').value = total;
    calculate();
  }

  function updatePrepaidFees() {
    const ids = ['prepaidInterest','mortgageInsurance','monthlyMI','otherPrepaidFees'];
    let total = 0;
    ids.forEach(function(id) { total += P(document.getElementById(id).value); });
    document.getElementById('prepaidFees').value = total;
    calculate();
  }

  function exportCSV() {
    const s = getState();
    const principal = s.loanAmount + s.financedFees;
    const pmt = MSFG.calcMonthlyPayment(principal, s.interestRate, s.loanTerm);
    const rows = [
      ['APR Calculator Results',''],['',''],
      ['Loan Amount', fmt(s.loanAmount)], ['Interest Rate', pct(s.interestRate*100)],
      ['Loan Term', s.loanTerm+' years'], ['Monthly Payment', fmt(pmt)],
      ['',''], ['Generated', new Date().toLocaleString()]
    ];
    const csv = rows.map(function(r){return r.join(',');}).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'apr_calculation.csv'; a.click();
  }

  function shareLink() {
    navigator.clipboard.writeText(window.location.href).then(function() { alert('Link copied!'); });
  }

  function clearAll() {
    applyState({ loanAmount:300000, interestRate:0.065, loanTerm:30, discountPoints:0, financedFees:0, prepaidFees:0 });
    ['originationFee','processingFee','underwritingFee','applicationFee','otherFinancedFees','creditReportFee','floodCertFee','taxServiceFee','prepaidInterest','mortgageInsurance','monthlyMI','otherPrepaidFees','escrowReserves','titleInsurance','recordingFees'].forEach(function(id) {
      const el = document.getElementById(id); if(el) el.value = 0;
    });
    calculate();
  }

  // ---- MISMO Data Integration ----
  // Fields that belong to financed fee breakdown
  const financedFeeIds = ['originationFee','processingFee','underwritingFee','applicationFee','otherFinancedFees','creditReportFee','floodCertFee','taxServiceFee'];
  // Fields that belong to prepaid fee breakdown
  const prepaidFeeIds = ['prepaidInterest','mortgageInsurance','monthlyMI','otherPrepaidFees','escrowReserves','titleInsurance','recordingFees'];

  function applyMISMOData(data) {
    if (!MSFG.MISMOParser) return;
    const mapFn = MSFG.MISMOParser.getCalcMap('apr');
    if (!mapFn) return;
    const fieldMap = mapFn(data);

    let hasFinanced = false;
    let hasPrepaid = false;

    for (const [id, value] of Object.entries(fieldMap)) {
      const field = document.getElementById(id);
      if (!field) continue;

      field.value = value;
      field.classList.remove('is-default');
      field.classList.add('mismo-populated');

      if (financedFeeIds.indexOf(id) !== -1) hasFinanced = true;
      if (prepaidFeeIds.indexOf(id) !== -1) hasPrepaid = true;
    }

    // Roll up sub-fees into totals
    if (hasFinanced) updateFinancedFees();
    if (hasPrepaid) updatePrepaidFees();
    calculate();
  }

  // Init
  document.addEventListener('DOMContentLoaded', function() {
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');

    const params = new URLSearchParams(window.location.search);
    if (params.has('la')) {
      applyState({
        loanAmount: P(params.get('la')) || 300000,
        interestRate: (P(params.get('ir')) || 6.5) / 100,
        loanTerm: P(params.get('lt')) || 30,
        discountPoints: (P(params.get('dp')) || 0) / 100,
        financedFees: P(params.get('ff')) || 0,
        prepaidFees: P(params.get('pf')) || 0
      });
    }

    // Bind main input listeners
    ['loanAmount','interestRate','loanTerm','discountPoints','financedFees','prepaidFees'].forEach(function(id) {
      const el = document.getElementById(id);
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    // Bind fee breakdown toggle buttons
    document.querySelectorAll('[data-action="toggle-fees"]').forEach(function(btn) {
      btn.addEventListener('click', function() { toggleFeeBreakdown(btn.dataset.target); });
    });

    // Bind financed fee inputs
    document.querySelectorAll('[data-fee-group="financed"]').forEach(function(input) {
      input.addEventListener('change', updateFinancedFees);
    });

    // Bind prepaid fee inputs
    document.querySelectorAll('[data-fee-group="prepaid"]').forEach(function(input) {
      input.addEventListener('change', updatePrepaidFees);
    });

    // Bind action bar buttons
    const actions = {
      'export-csv': exportCSV,
      'print': function() { window.print(); },
      'share-link': shareLink,
      'clear-all': clearAll
    };
    document.querySelectorAll('[data-action]').forEach(function(el) {
      const fn = actions[el.dataset.action];
      if (fn) el.addEventListener('click', fn);
    });

    // Remove mismo-populated class on manual user input
    document.querySelectorAll('.calc-page input').forEach(function(input) {
      input.addEventListener('input', function() {
        input.classList.remove('mismo-populated');
      });
    });

    // Check sessionStorage for existing MISMO data (from workspace)
    const stored = sessionStorage.getItem('msfg-mismo-data');
    if (stored) {
      try {
        applyMISMOData(JSON.parse(stored));
      } catch (_) { /* ignore parse errors */ }
    }

    // Listen for workspace MISMO broadcasts via postMessage
    window.addEventListener('message', function(e) {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'msfg-mismo-broadcast' || e.data.type === 'msfg-mismo-update') {
        let parsed = e.data.parsed || null;
        if (!parsed && e.data.xml && MSFG.MISMOParser) {
          parsed = MSFG.MISMOParser.parse(e.data.xml);
        }
        if (parsed) {
          sessionStorage.setItem('msfg-mismo-data', JSON.stringify(parsed));
          applyMISMOData(parsed);
        }
      }
    });

    calculate();

    /* ---- Register email data provider ---- */
    if (MSFG.CalcActions) {
      MSFG.CalcActions.register(function () {
        const g = function (id) { const el = document.getElementById(id); return el ? el.textContent || el.value : ''; };
        return {
          title: 'APR Analysis',
          sections: [
            {
              heading: 'Loan Details',
              rows: [
                { label: 'Loan Amount', value: g('loanAmount') ? MSFG.formatCurrency(MSFG.parseNum(g('loanAmount'))) : '$0' },
                { label: 'Note Rate', value: g('noteRate') + '%' },
                { label: 'Loan Term', value: g('loanTerm') + ' years' }
              ]
            },
            {
              heading: 'Results',
              rows: [
                { label: 'Annual Percentage Rate (APR)', value: g('aprResult'), isTotal: true },
                { label: 'Monthly Payment (P&I)', value: g('monthlyPI') },
                { label: 'Total Finance Charge', value: g('financeCharge') },
                { label: 'Total of Payments', value: g('totalPayments') },
                { label: 'Amount Financed', value: g('amountFinanced') }
              ]
            },
            {
              heading: 'Cost Analysis',
              rows: [
                { label: 'Monthly Rate Difference', value: g('monthlyRateDiff') },
                { label: 'Total Fees in APR', value: g('totalFeeCost') },
                { label: 'Effective Monthly Fee Cost', value: g('monthlyFeeCost') }
              ]
            }
          ]
        };
      });
    }
  });
})();
