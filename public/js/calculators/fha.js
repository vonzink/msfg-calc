/* =====================================================
   FHA Loan Calculator
   ===================================================== */
document.addEventListener('DOMContentLoaded', function() {
  var calculateBtn = document.getElementById('calculateBtn');
  var origDate = document.getElementById('origDate');

  calculateBtn.addEventListener('click', function() {
    var inputs = readInputs();
    var result = calculateFhaScenario(inputs);
    renderResults(result, inputs);
    renderCalcSteps(result, inputs);
  });

  origDate.addEventListener('change', function() {
    var months = computeMonthsOwned(origDate.value);
    updateMonthsOwnedDisplay(months);
  });

  function toNumber(id) {
    return MSFG.parseNumById(id);
  }

  function readInputs() {
    var months = computeMonthsOwned(origDate.value);
    updateMonthsOwnedDisplay(months);

    return {
      loanPurpose: document.getElementById('loanPurpose').value,
      propertyType: document.getElementById('propertyType').value,
      monthsOwned: months,
      isExistingFha: document.getElementById('isExistingFha').checked,
      financeUfmip: document.getElementById('financeUfmip').checked,
      purchasePrice: toNumber('purchasePrice'),
      appraisedValue: toNumber('appraisedValue'),
      currentUpb: toNumber('currentUpb'),
      closingCostsFinanced: toNumber('closingCosts'),
      currentPayment: toNumber('currentPayment'),
      newPayment: toNumber('newPayment'),
      closingCostsCash: toNumber('closingCostsCash'),
      prepaidsCash: toNumber('prepaidsCash'),
      totalCredits: toNumber('totalCredits'),
      escrowRefund: toNumber('escrowRefund')
    };
  }

  function computeMonthsOwned(dateStr) {
    if (!dateStr) return 0;
    var acquired = new Date(dateStr);
    if (isNaN(acquired.getTime())) return 0;
    var today = new Date();
    var months = (today.getFullYear() - acquired.getFullYear()) * 12 + (today.getMonth() - acquired.getMonth());
    if (today.getDate() < acquired.getDate()) months -= 1;
    return Math.max(0, months);
  }

  function updateMonthsOwnedDisplay(months) {
    var el = document.getElementById('monthsOwnedDisplay');
    if (!el) return;
    el.textContent = months <= 0
      ? 'Months owned (calculated): —'
      : 'Months owned (calculated): ' + months + ' month' + (months === 1 ? '' : 's');
  }

  function minPositive(a, b) {
    var vals = [a, b].filter(function(v) { return Number.isFinite(v) && v > 0; });
    if (!vals.length) return 0;
    return Math.min.apply(null, vals);
  }

  function calculateFhaScenario(inputs) {
    var notes = [];
    var ufmipRate = 0.0175;
    var baseLoan = 0, ltv = 0, valueUsed = inputs.appraisedValue || 0;
    var maxLtv;

    if (!inputs.appraisedValue && inputs.loanPurpose !== 'streamline') {
      notes.push('No appraised value entered – LTV-based limits may be inaccurate.');
    }

    switch (inputs.loanPurpose) {
      case 'purchase':
        var priceOrValue = minPositive(inputs.purchasePrice, inputs.appraisedValue);
        if (!priceOrValue) notes.push('Enter purchase price and appraised value for a purchase scenario.');
        maxLtv = 0.965;
        baseLoan = priceOrValue * maxLtv;
        valueUsed = priceOrValue;
        ltv = valueUsed ? baseLoan / valueUsed : 0;
        notes.push('Purchase: max base loan at 96.5% of lesser of price or value.');
        break;

      case 'rateTerm':
        maxLtv = 0.9775;
        baseLoan = inputs.appraisedValue * maxLtv;
        valueUsed = inputs.appraisedValue;
        ltv = valueUsed ? baseLoan / valueUsed : 0;
        notes.push('Rate/Term Refi: max base loan at 97.75% of appraised value.');
        if (inputs.monthsOwned < 12) notes.push('Owned < 12 months – acquisition cost limitations may apply.');
        break;

      case 'streamline':
        if (!inputs.isExistingFha) notes.push('Streamline selected but current loan is not marked as FHA.');
        baseLoan = inputs.currentUpb + inputs.closingCostsFinanced;
        valueUsed = inputs.appraisedValue || 0;
        ltv = valueUsed ? baseLoan / valueUsed : 0;
        notes.push('FHA Streamline: using current UPB + allowable closing costs.');
        break;

      case 'cashOut':
        maxLtv = 0.8;
        baseLoan = inputs.appraisedValue * maxLtv;
        valueUsed = inputs.appraisedValue;
        ltv = valueUsed ? baseLoan / valueUsed : 0;
        notes.push('Cash-Out Refi: max base loan at 80% of appraised value.');
        if (inputs.monthsOwned < 12) notes.push('Owned < 12 months – not eligible for FHA cash-out.');
        break;
    }

    var ufmipAmount = inputs.financeUfmip ? baseLoan * ufmipRate : 0;
    var totalLoan = baseLoan + ufmipAmount;
    var ntb = evaluateNtb(inputs.currentPayment, inputs.newPayment, inputs.loanPurpose, notes);
    var cashToClose = estimateCashToClose(inputs, { baseLoan: baseLoan, totalLoan: totalLoan, ufmipAmount: ufmipAmount }, notes);

    return { baseLoan: baseLoan, totalLoan: totalLoan, ufmipAmount: ufmipAmount, ltv: ltv, ntb: ntb, cashToClose: cashToClose, notes: notes, valueUsed: valueUsed };
  }

  function estimateCashToClose(inputs, calc, notes) {
    if (inputs.loanPurpose === 'purchase') {
      if (!inputs.purchasePrice || !calc.baseLoan) {
        notes.push('Cash to close (purchase): missing purchase price or base loan.');
        return 0;
      }
      var downPayment = Math.max(0, inputs.purchasePrice - calc.baseLoan);
      var ufmipOop = inputs.financeUfmip ? 0 : calc.ufmipAmount;
      var cash = downPayment + inputs.closingCostsCash + inputs.prepaidsCash + ufmipOop - inputs.totalCredits;
      notes.push('Cash to close (purchase): down payment + costs + prepaids - credits.');
      return cash;
    }

    var payoff = inputs.currentUpb || 0;
    var totalNeeded = payoff + inputs.closingCostsFinanced + inputs.closingCostsCash + inputs.prepaidsCash - inputs.totalCredits - inputs.escrowRefund;
    var cash = totalNeeded - calc.totalLoan;
    notes.push('Cash to close (refi): (payoff + costs - credits - escrow refund) - new loan.');
    return cash;
  }

  function evaluateNtb(currentPmt, newPmt, purpose, notes) {
    if (!currentPmt || !newPmt) {
      notes.push('NTB: Enter both current and new payments to evaluate.');
      return { met: null, reductionPercent: 0 };
    }
    var reduction = currentPmt - newPmt;
    var pct = reduction / currentPmt;

    if (purpose === 'streamline') {
      var threshold = 0.05;
      if (pct >= threshold) {
        notes.push('NTB: Streamline met – payment reduced by ' + (pct * 100).toFixed(2) + '%.');
      } else {
        notes.push('NTB: Streamline NOT met – only ' + (pct * 100).toFixed(2) + '% reduction.');
      }
      return { met: pct >= threshold, reductionPercent: pct };
    }

    notes.push('NTB: Payment change is ' + (pct * 100).toFixed(2) + '%. Confirm against FHA/Investor NTB rules.');
    return { met: null, reductionPercent: pct };
  }

  function renderResults(result, inputs) {
    var $ = function(id) { return document.getElementById(id); };

    $('resultBaseLoan').textContent = result.baseLoan > 0 ? MSFG.formatCurrency(result.baseLoan) : '—';
    $('resultTotalLoan').textContent = result.totalLoan > 0 ? MSFG.formatCurrency(result.totalLoan) : '—';
    $('resultLtv').textContent = result.ltv && result.valueUsed ? (result.ltv * 100).toFixed(2) + '%' : '—';

    var ntbEl = $('resultNtb');
    ntbEl.className = 'result-pill';
    if (result.ntb.met === true) {
      ntbEl.textContent = 'Met (\u2193 ' + (result.ntb.reductionPercent * 100).toFixed(2) + '%)';
      ntbEl.classList.add('pass');
    } else if (result.ntb.met === false) {
      ntbEl.textContent = 'Not Met (\u2193 ' + (result.ntb.reductionPercent * 100).toFixed(2) + '%)';
      ntbEl.classList.add('fail');
    } else {
      ntbEl.textContent = 'Insufficient data';
      ntbEl.classList.add('warn');
    }

    if (Number.isFinite(result.cashToClose)) {
      if (result.cashToClose > 0.01) {
        $('resultCashToClose').textContent = MSFG.formatCurrency(result.cashToClose) + ' due from borrower';
      } else if (result.cashToClose < -0.01) {
        $('resultCashToClose').textContent = MSFG.formatCurrency(Math.abs(result.cashToClose)) + ' to borrower';
      } else {
        $('resultCashToClose').textContent = '$0.00 (roughly neutral)';
      }
    } else {
      $('resultCashToClose').textContent = '—';
    }

    var notesList = $('resultNotes');
    notesList.innerHTML = '';
    result.notes.forEach(function(note) {
      var li = document.createElement('li');
      li.textContent = note;
      notesList.appendChild(li);
    });
  }

  function renderCalcSteps(result, inputs) {
    var container = document.getElementById('calcSteps-fha');
    if (!container) return;
    var fmt = MSFG.formatCurrency;
    var pct = MSFG.formatPercent;

    var html = '';

    html += '<div class="calc-step"><h4>Step 1: Determine Value Used</h4>';
    html += '<div class="calc-step__formula">';
    if (inputs.loanPurpose === 'purchase') {
      html += 'Value Used = lesser of Purchase Price and Appraised Value<br>';
      html += '<span class="calc-step__values">= lesser of ' + fmt(inputs.purchasePrice) + ' and ' + fmt(inputs.appraisedValue) + ' = <strong>' + fmt(result.valueUsed) + '</strong></span>';
    } else {
      html += 'Value Used = Appraised Value<br>';
      html += '<span class="calc-step__values">= <strong>' + fmt(result.valueUsed) + '</strong></span>';
    }
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 2: Calculate Max Base Loan</h4>';
    html += '<div class="calc-step__formula">';
    var ltvLabel = inputs.loanPurpose === 'purchase' ? '96.5%' : inputs.loanPurpose === 'rateTerm' ? '97.75%' : inputs.loanPurpose === 'cashOut' ? '80%' : 'UPB + Costs';
    html += 'Base Loan = Value Used × Max LTV (' + ltvLabel + ')<br>';
    html += '<span class="calc-step__values">= ' + fmt(result.valueUsed) + ' × ' + ltvLabel + ' = <strong>' + fmt(result.baseLoan) + '</strong></span>';
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 3: UFMIP Calculation</h4>';
    html += '<div class="calc-step__formula">';
    html += 'UFMIP = Base Loan × 1.75%<br>';
    html += '<span class="calc-step__values">= ' + fmt(result.baseLoan) + ' × 1.75% = <strong>' + fmt(result.ufmipAmount) + '</strong>';
    html += (inputs.financeUfmip ? ' (financed)' : ' (paid out of pocket)') + '</span>';
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 4: Total Loan Amount</h4>';
    html += '<div class="calc-step__formula">';
    html += 'Total Loan = Base Loan + UFMIP<br>';
    html += '<span class="calc-step__values">= ' + fmt(result.baseLoan) + ' + ' + fmt(result.ufmipAmount) + ' = <strong>' + fmt(result.totalLoan) + '</strong></span>';
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 5: LTV Ratio</h4>';
    html += '<div class="calc-step__formula">';
    html += 'LTV = Base Loan ÷ Value Used<br>';
    html += '<span class="calc-step__values">= ' + fmt(result.baseLoan) + ' ÷ ' + fmt(result.valueUsed) + ' = <strong>' + (result.ltv * 100).toFixed(2) + '%</strong></span>';
    html += '</div></div>';

    html += '<div class="calc-step highlight"><h4>Step 6: Cash to Close</h4>';
    html += '<div class="calc-step__formula">';
    html += '<span class="calc-step__values"><strong>' + fmt(result.cashToClose) + '</strong></span>';
    html += '</div></div>';

    container.innerHTML = html;
  }
});
