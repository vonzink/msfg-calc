/* =====================================================
   APR Calculator
   ===================================================== */
(function() {
  'use strict';

  var P = MSFG.parseNum;
  var fmt = MSFG.formatCurrency;
  var pct = MSFG.formatPercent;

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
    var r = annualRate / 12;
    return payment * (1 - Math.pow(1 + r, -n)) / r;
  }

  function calcAPR(monthlyPmt, amtFinanced, n) {
    if (amtFinanced <= 0 || monthlyPmt <= 0 || n <= 0) return 0;
    if (monthlyPmt * n < amtFinanced) return 0;

    var lo = 0.0001, hi = 1, apr = 0;
    for (var i = 0; i < 100; i++) {
      apr = (lo + hi) / 2;
      var pv = calcPV(monthlyPmt, apr, n);
      if (Math.abs(pv - amtFinanced) < 1e-8) break;
      if (pv > amtFinanced) lo = apr; else hi = apr;
    }
    return apr;
  }

  function calculate() {
    var s = getState();
    if (s.loanAmount <= 0) return;

    var principal = s.loanAmount + s.financedFees;
    var monthlyPmt = MSFG.calcMonthlyPayment(principal, s.interestRate, s.loanTerm);
    var pointsAmt = s.loanAmount * s.discountPoints;
    var amtFinanced = s.loanAmount - pointsAmt - s.prepaidFees;
    var n = s.loanTerm * 12;
    var totalPmts = monthlyPmt * n;
    var finChg = totalPmts - amtFinanced;
    var apr = amtFinanced > 0 ? calcAPR(monthlyPmt, amtFinanced, n) : 0;
    var aprSpread = (apr - s.interestRate) * 100;
    var totalUpfront = pointsAmt + s.prepaidFees + s.financedFees;
    var monthlyFee = totalUpfront / n;

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
    var container = document.getElementById('calcSteps-apr');
    if (!container) return;

    var r = s.interestRate / 12;
    var html = '';

    html += '<div class="calc-step"><h4>Step 1: Principal for Payment</h4><div class="calc-step__formula">Principal = Loan Amount + Financed Fees<br><span class="calc-step__values">= ' + fmt(s.loanAmount) + ' + ' + fmt(s.financedFees) + ' = <strong>' + fmt(principal) + '</strong></span></div></div>';

    html += '<div class="calc-step"><h4>Step 2: Monthly Payment (P&I)</h4><div class="calc-step__formula">Payment = Principal × (r / (1 - (1+r)<sup>-n</sup>))<br><span class="calc-step__note">r = ' + pct(s.interestRate * 100) + '/12 = ' + (r * 100).toFixed(5) + '% monthly, n = ' + n + '</span><br><span class="calc-step__values">= <strong>' + fmt(monthlyPmt) + '</strong></span></div></div>';

    html += '<div class="calc-step"><h4>Step 3: Amount Financed (Reg Z)</h4><div class="calc-step__formula">Amount Financed = Loan Amount - Points - Prepaids<br><span class="calc-step__values">= ' + fmt(s.loanAmount) + ' - ' + fmt(pointsAmt) + ' - ' + fmt(s.prepaidFees) + ' = <strong>' + fmt(amtFinanced) + '</strong></span></div></div>';

    html += '<div class="calc-step"><h4>Step 4: Total Finance Charges</h4><div class="calc-step__formula">Finance Charges = (Payment × Payments) - Amount Financed<br><span class="calc-step__values">= ' + fmt(totalPmts) + ' - ' + fmt(amtFinanced) + ' = <strong>' + fmt(finChg) + '</strong></span></div></div>';

    html += '<div class="calc-step"><h4>Step 5: Solve for APR</h4><div class="calc-step__formula">Find rate where PV(all payments) = Amount Financed<br><span class="calc-step__values"><strong>APR = ' + pct(apr * 100) + '</strong></span></div></div>';

    html += '<div class="calc-step highlight"><h4>Why APR > Note Rate</h4><div class="calc-step__formula"><span class="calc-step__note">The APR exceeds the note rate because you pay interest on the full principal (including financed fees), but only receive the Amount Financed after points and prepaids.</span></div></div>';

    container.innerHTML = html;
  }

  function updateURL(s) {
    var url = new URL(window.location);
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

  // Expose globals for inline onclick handlers
  window.toggleFeeBreakdown = function(type) {
    var el = document.getElementById(type + 'FeeBreakdown');
    var txt = document.getElementById(type + 'ToggleText');
    if (el.style.display === 'none') { el.style.display = 'block'; txt.textContent = 'Hide Fee Breakdown'; }
    else { el.style.display = 'none'; txt.textContent = 'Show Fee Breakdown'; }
  };

  window.updateFinancedFees = function() {
    var ids = ['originationFee','processingFee','underwritingFee','applicationFee','otherFinancedFees'];
    var total = 0;
    ids.forEach(function(id) { total += P(document.getElementById(id).value); });
    document.getElementById('financedFees').value = total;
    calculate();
  };

  window.updatePrepaidFees = function() {
    var ids = ['prepaidInterest','mortgageInsurance','monthlyMI','otherPrepaidFees'];
    var total = 0;
    ids.forEach(function(id) { total += P(document.getElementById(id).value); });
    document.getElementById('prepaidFees').value = total;
    calculate();
  };

  window.exportCSV = function() {
    var s = getState();
    var principal = s.loanAmount + s.financedFees;
    var pmt = MSFG.calcMonthlyPayment(principal, s.interestRate, s.loanTerm);
    var rows = [
      ['APR Calculator Results',''],['',''],
      ['Loan Amount', fmt(s.loanAmount)], ['Interest Rate', pct(s.interestRate*100)],
      ['Loan Term', s.loanTerm+' years'], ['Monthly Payment', fmt(pmt)],
      ['',''], ['Generated', new Date().toLocaleString()]
    ];
    var csv = rows.map(function(r){return r.join(',');}).join('\n');
    var blob = new Blob([csv], {type:'text/csv'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'apr_calculation.csv'; a.click();
  };

  window.shareLink = function() {
    navigator.clipboard.writeText(window.location.href).then(function() { alert('Link copied!'); });
  };

  window.clearAll = function() {
    applyState({ loanAmount:300000, interestRate:0.065, loanTerm:30, discountPoints:0, financedFees:0, prepaidFees:0 });
    ['originationFee','processingFee','underwritingFee','applicationFee','otherFinancedFees','creditReportFee','floodCertFee','taxServiceFee','prepaidInterest','mortgageInsurance','monthlyMI','otherPrepaidFees','escrowReserves','titleInsurance','recordingFees'].forEach(function(id) {
      var el = document.getElementById(id); if(el) el.value = 0;
    });
    calculate();
  };

  // Init
  document.addEventListener('DOMContentLoaded', function() {
    var params = new URLSearchParams(window.location.search);
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

    ['loanAmount','interestRate','loanTerm','discountPoints','financedFees','prepaidFees'].forEach(function(id) {
      var el = document.getElementById(id);
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    calculate();
  });
})();
