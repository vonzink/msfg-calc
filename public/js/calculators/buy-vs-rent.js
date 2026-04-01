/* =====================================================
   Buy vs Rent Calculator
   ===================================================== */
(function () {
  'use strict';

  const P = MSFG.parseNum;
  const fmt = MSFG.formatCurrency;
  const pct = MSFG.formatPercent;

  /* ---- Toggle helper ---- */
  function setupToggle(toggleId, inputId, priceId, pctStep, dollarStep, pctPlaceholder, dollarPlaceholder) {
    const toggle = document.getElementById(toggleId);
    const input = document.getElementById(inputId);
    if (!toggle || !input) return;

    toggle.addEventListener('click', function () {
      const price = P(document.getElementById(priceId).value);
      const currentVal = P(input.value);
      const mode = toggle.dataset.mode;

      if (mode === 'pct') {
        // Switch to dollar mode
        const dollarVal = price > 0 ? Math.round(price * currentVal / 100) : 0;
        toggle.dataset.mode = 'dollar';
        toggle.textContent = '$';
        input.value = dollarVal || '';
        input.step = dollarStep;
        input.placeholder = dollarPlaceholder;
      } else {
        // Switch to percent mode
        const pctVal = price > 0 ? (currentVal / price * 100) : 0;
        toggle.dataset.mode = 'pct';
        toggle.textContent = '%';
        input.value = pctVal ? pctVal.toFixed(3) : '';
        input.step = pctStep;
        input.placeholder = pctPlaceholder;
      }
      input.classList.remove('is-default');
      calculate();
    });
  }

  function resolveToggleValue(toggleId, inputId, priceId) {
    const toggle = document.getElementById(toggleId);
    const val = P(document.getElementById(inputId).value);
    const price = P(document.getElementById(priceId).value);
    if (!toggle) return { pct: 0, dollar: 0 };

    if (toggle.dataset.mode === 'pct') {
      return { pct: val / 100, dollar: price * val / 100 };
    }
    return { pct: price > 0 ? val / price : 0, dollar: val };
  }

  /* ---- Mortgage math ---- */
  function mortgagePayment(principal, annualRate, totalPayments) {
    if (totalPayments <= 0 || principal <= 0) return 0;
    if (annualRate === 0) return principal / totalPayments;
    const r = annualRate / 12;
    return (principal * r) / (1 - Math.pow(1 + r, -totalPayments));
  }

  function balanceAfterPayments(principal, annualRate, totalPayments, paymentsMade) {
    if (annualRate === 0) return principal - (principal / totalPayments) * paymentsMade;
    const r = annualRate / 12;
    const pmt = mortgagePayment(principal, annualRate, totalPayments);
    return principal * Math.pow(1 + r, paymentsMade) - pmt * ((Math.pow(1 + r, paymentsMade) - 1) / r);
  }

  /* ---- Main calculation ---- */
  function calculate() {
    const price = P(document.getElementById('purchasePrice').value);
    const rate = P(document.getElementById('rateBuy').value) / 100;
    const term = P(document.getElementById('termBuy').value);
    const ins = P(document.getElementById('insurance').value);
    const maint = P(document.getElementById('maintenance').value);
    const appr = P(document.getElementById('appreciation').value) / 100;
    const costInflation = P(document.getElementById('costInflation').value) / 100;
    const sellingPct = P(document.getElementById('sellingCosts').value) / 100;
    const rent = P(document.getElementById('rent').value);
    const rentInc = P(document.getElementById('rentIncrease').value) / 100;
    const period = P(document.getElementById('period').value);
    const investReturn = P(document.getElementById('investmentReturn').value) / 100;

    if (price <= 0 || period <= 0) return;

    const downResolved = resolveToggleValue('downToggle', 'downPaymentInput', 'purchasePrice');
    const taxResolved = resolveToggleValue('taxToggle', 'taxInput', 'purchasePrice');

    const down = downResolved.dollar;
    const loan = price - down;
    const nPayments = term * 12;
    const analysisMonths = period * 12;
    const pmt = mortgagePayment(loan, rate, nPayments);

    const baseTaxAnnual = taxResolved.dollar;

    // Year-by-year ownership costs (taxes, insurance, maintenance inflate)
    let totalOwnership = down;
    let mortgageTotal = 0;
    let taxesTotal = 0;
    let insuranceTotal = 0;
    let maintenanceTotal = 0;

    for (let y = 0; y < period; y++) {
      const inflationFactor = Math.pow(1 + costInflation, y);
      const homeValueYear = price * Math.pow(1 + appr, y);
      const taxThisYear = (baseTaxAnnual > 0 && price > 0)
        ? baseTaxAnnual * (homeValueYear / price)
        : 0;
      const insThisYear = ins * inflationFactor;
      const maintThisYear = maint * inflationFactor;

      const yearMortgage = pmt * 12;
      mortgageTotal += yearMortgage;
      taxesTotal += taxThisYear;
      insuranceTotal += insThisYear;
      maintenanceTotal += maintThisYear;
      totalOwnership += yearMortgage + taxThisYear + insThisYear + maintThisYear;
    }

    // Equity at sale
    const paymentsMade = Math.min(analysisMonths, nPayments);
    const bal = balanceAfterPayments(loan, rate, nPayments, paymentsMade);
    const salePrice = price * Math.pow(1 + appr, period);
    const sellingCost = salePrice * sellingPct;
    const equity = salePrice - Math.max(0, bal) - sellingCost;

    // Renting scenario
    let totalRent = 0;
    let currentRent = rent;
    for (let y = 0; y < period; y++) {
      totalRent += currentRent * 12;
      currentRent *= (1 + rentInc);
    }

    const investValue = down * Math.pow(1 + investReturn, period);
    const investmentGrowth = investValue - down;

    const netOwn = totalOwnership - equity;
    const netRent = totalRent - investmentGrowth;
    const diff = netRent - netOwn;

    // Update DOM
    document.getElementById('mortgagePay').textContent = fmt(pmt);
    document.getElementById('ownCost').textContent = fmt(totalOwnership);
    document.getElementById('rentCost').textContent = fmt(totalRent);
    document.getElementById('equity').textContent = fmt(equity);

    const recText = document.getElementById('recommendationText');
    const diffText = document.getElementById('differenceText');
    const diffValue = document.getElementById('difference');
    diffValue.textContent = fmt(Math.abs(diff));

    if (diff > 0) {
      recText.textContent = 'Buying saves you';
      diffText.textContent = 'over ' + period + ' years compared to renting (' + fmt(Math.abs(diff) / period) + '/yr)';
    } else {
      recText.textContent = 'Renting saves you';
      diffText.textContent = 'over ' + period + ' years compared to buying (' + fmt(Math.abs(diff) / period) + '/yr)';
    }

    document.getElementById('downPayment').textContent = fmt(down);
    document.getElementById('mortgageTotal').textContent = fmt(mortgageTotal);
    document.getElementById('taxesTotal').textContent = fmt(taxesTotal);
    document.getElementById('insuranceTotal').textContent = fmt(insuranceTotal);
    document.getElementById('maintenanceTotal').textContent = fmt(maintenanceTotal);
    document.getElementById('equityBreakdown').textContent = '-' + fmt(equity);
    document.getElementById('netOwnBreakdown').textContent = fmt(netOwn);

    document.getElementById('rentTotal').textContent = fmt(totalRent);
    document.getElementById('investGrowthDisplay').textContent = '-' + fmt(investmentGrowth);
    document.getElementById('netRentBreakdown').textContent = fmt(netRent);

    updateMathSteps(price, down, loan, pmt, rate, nPayments, period, appr, sellingPct, costInflation, rentInc, investReturn, baseTaxAnnual, totalOwnership, mortgageTotal, taxesTotal, insuranceTotal, maintenanceTotal, salePrice, sellingCost, bal, equity, totalRent, rent, investValue, investmentGrowth, netOwn, netRent, diff);
  }

  /* ---- Show Calculations steps ---- */
  function updateMathSteps(price, down, loan, pmt, rate, nPayments, period, appr, sellingPct, costInflation, rentInc, investReturn, baseTaxAnnual, totalOwnership, mortgageTotal, taxesTotal, insuranceTotal, maintenanceTotal, salePrice, sellingCost, bal, equity, totalRent, rentMo, investValue, investmentGrowth, netOwn, netRent, diff) {
    const container = document.getElementById('calcSteps-buy-vs-rent');
    if (!container) return;

    const r = rate / 12;
    const downPctDisplay = price > 0 ? pct(down / price * 100) : '0.000%';
    let html = '';

    html += '<div class="calc-step"><h4>Step 1: Down Payment &amp; Loan Amount</h4>'
      + '<div class="calc-step__formula">'
      + 'Down Payment = ' + fmt(price) + ' &times; ' + downPctDisplay + ' = <strong>' + fmt(down) + '</strong><br>'
      + 'Loan Amount = ' + fmt(price) + ' - ' + fmt(down) + ' = <strong>' + fmt(loan) + '</strong>'
      + '</div></div>';

    html += '<div class="calc-step"><h4>Step 2: Monthly Mortgage Payment</h4>'
      + '<div class="calc-step__formula">'
      + 'Payment = P &times; r / (1 - (1+r)<sup>-n</sup>)<br>'
      + '<span class="calc-step__note">P = ' + fmt(loan) + ', r = ' + pct(rate * 100) + '/12 = ' + (r * 100).toFixed(5) + '%, n = ' + nPayments + '</span><br>'
      + '<span class="calc-step__values">= <strong>' + fmt(pmt) + '</strong>/month</span>'
      + '</div></div>';

    html += '<div class="calc-step"><h4>Step 3: Total Ownership Costs (' + period + ' Years)</h4>'
      + '<div class="calc-step__formula">'
      + 'Down Payment: ' + fmt(down) + '<br>'
      + 'Mortgage Payments: ' + fmt(pmt) + ' &times; ' + (period * 12) + ' months = ' + fmt(mortgageTotal) + '<br>'
      + 'Property Taxes: ' + fmt(taxesTotal) + ' <span class="calc-step__note">(increases with home appreciation)</span><br>'
      + 'Insurance: ' + fmt(insuranceTotal) + ' <span class="calc-step__note">(inflates at ' + pct(costInflation * 100) + '/yr)</span><br>'
      + 'Maintenance: ' + fmt(maintenanceTotal) + ' <span class="calc-step__note">(inflates at ' + pct(costInflation * 100) + '/yr)</span><br>'
      + '<span class="calc-step__values">Total = <strong>' + fmt(totalOwnership) + '</strong></span>'
      + '</div></div>';

    html += '<div class="calc-step"><h4>Step 4: Net Equity at Sale</h4>'
      + '<div class="calc-step__formula">'
      + 'Home Value = ' + fmt(price) + ' &times; (1 + ' + pct(appr * 100) + ')<sup>' + period + '</sup> = ' + fmt(salePrice) + '<br>'
      + 'Remaining Balance = ' + fmt(Math.max(0, bal)) + '<br>'
      + 'Selling Costs = ' + fmt(salePrice) + ' &times; ' + pct(sellingPct * 100) + ' = ' + fmt(sellingCost) + '<br>'
      + '<span class="calc-step__values">Equity = ' + fmt(salePrice) + ' - ' + fmt(Math.max(0, bal)) + ' - ' + fmt(sellingCost) + ' = <strong>' + fmt(equity) + '</strong></span>'
      + '</div></div>';

    html += '<div class="calc-step"><h4>Step 5: Total Renting Costs (' + period + ' Years)</h4>'
      + '<div class="calc-step__formula">'
      + 'Starting Rent: ' + fmt(rentMo) + '/month, increasing ' + pct(rentInc * 100) + '/yr<br>'
      + '<span class="calc-step__values">Total Rent = <strong>' + fmt(totalRent) + '</strong></span>'
      + '</div></div>';

    html += '<div class="calc-step"><h4>Step 6: Investment Growth of Down Payment</h4>'
      + '<div class="calc-step__formula">'
      + 'Future Value = ' + fmt(down) + ' &times; (1 + ' + pct(investReturn * 100) + ')<sup>' + period + '</sup> = ' + fmt(investValue) + '<br>'
      + '<span class="calc-step__values">Growth = ' + fmt(investValue) + ' - ' + fmt(down) + ' = <strong>' + fmt(investmentGrowth) + '</strong></span>'
      + '</div></div>';

    html += '<div class="calc-step highlight"><h4>Step 7: Net Cost Comparison</h4>'
      + '<div class="calc-step__formula">'
      + 'Net Cost of Buying = Total Ownership - Equity<br>'
      + '<span class="calc-step__values">= ' + fmt(totalOwnership) + ' - ' + fmt(equity) + ' = <strong>' + fmt(netOwn) + '</strong></span><br><br>'
      + 'Net Cost of Renting = Total Rent - Investment Growth<br>'
      + '<span class="calc-step__values">= ' + fmt(totalRent) + ' - ' + fmt(investmentGrowth) + ' = <strong>' + fmt(netRent) + '</strong></span><br><br>'
      + 'Difference = ' + fmt(netRent) + ' - ' + fmt(netOwn) + ' = <strong>' + fmt(diff) + '</strong><br>'
      + '<span class="calc-step__note">' + (diff > 0 ? 'Buying is cheaper' : 'Renting is cheaper') + ' by ' + fmt(Math.abs(diff)) + ' over ' + period + ' years</span>'
      + '</div></div>';

    container.innerHTML = html;
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', function () {
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');

    // Set up toggles
    setupToggle('downToggle', 'downPaymentInput', 'purchasePrice', '0.5', '1000', 'Down %', 'Down payment amount');
    setupToggle('taxToggle', 'taxInput', 'purchasePrice', '0.01', '100', 'Tax rate %', 'Annual taxes');

    // Main inputs
    const inputIds = ['purchasePrice', 'downPaymentInput', 'taxInput', 'rateBuy', 'termBuy',
      'insurance', 'maintenance', 'appreciation', 'costInflation',
      'sellingCosts', 'rent', 'rentIncrease', 'period', 'investmentReturn'];
    inputIds.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', calculate);
        el.addEventListener('change', calculate);
      }
    });

    calculate();
  });
})();
