/* =====================================================
   Buy vs Rent Calculator
   ===================================================== */
(function () {
  'use strict';

  const P = MSFG.parseNum;
  const fmt = MSFG.formatCurrency;
  const pct = MSFG.formatPercent;

  /* ---- Gather inputs ---- */
  function getState() {
    const price = P(document.getElementById('purchasePrice').value);
    const downPct = P(document.getElementById('downPercent').value) / 100;
    const downAmount = P(document.getElementById('downAmount').value);
    const rate = P(document.getElementById('rateBuy').value) / 100;
    const term = P(document.getElementById('termBuy').value);
    const taxRate = P(document.getElementById('taxRate').value) / 100;
    const taxAnnual = P(document.getElementById('taxAnnual').value);
    const ins = P(document.getElementById('insurance').value);
    const maint = P(document.getElementById('maintenance').value);
    const appr = P(document.getElementById('appreciation').value) / 100;
    const costInflation = P(document.getElementById('costInflation').value) / 100;
    const sellingPct = P(document.getElementById('sellingCosts').value) / 100;
    const rent = P(document.getElementById('rent').value);
    const rentInc = P(document.getElementById('rentIncrease').value) / 100;
    const period = P(document.getElementById('period').value);
    const investReturn = P(document.getElementById('investmentReturn').value) / 100;

    return { price, downPct, downAmount, rate, term, taxRate, taxAnnual, ins, maint, appr, costInflation, sellingPct, rent, rentInc, period, investReturn };
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

  /* ---- Sync down payment fields ---- */
  function syncDownFromPercent() {
    const price = P(document.getElementById('purchasePrice').value);
    const pctVal = P(document.getElementById('downPercent').value) / 100;
    document.getElementById('downAmount').value = Math.round(price * pctVal);
    document.getElementById('downAmount').classList.remove('is-default');
    calculate();
  }

  function syncDownFromAmount() {
    const price = P(document.getElementById('purchasePrice').value);
    const amount = P(document.getElementById('downAmount').value);
    if (price > 0) {
      document.getElementById('downPercent').value = ((amount / price) * 100).toFixed(3);
      document.getElementById('downPercent').classList.remove('is-default');
    }
    calculate();
  }

  /* ---- Sync tax fields ---- */
  function syncTaxFromRate() {
    const price = P(document.getElementById('purchasePrice').value);
    const rate = P(document.getElementById('taxRate').value) / 100;
    document.getElementById('taxAnnual').value = Math.round(price * rate);
    document.getElementById('taxAnnual').classList.remove('is-default');
    calculate();
  }

  function syncTaxFromAmount() {
    const price = P(document.getElementById('purchasePrice').value);
    const annual = P(document.getElementById('taxAnnual').value);
    if (price > 0) {
      document.getElementById('taxRate').value = ((annual / price) * 100).toFixed(3);
      document.getElementById('taxRate').classList.remove('is-default');
    }
    calculate();
  }

  /* ---- Main calculation ---- */
  function calculate() {
    const s = getState();
    if (s.price <= 0 || s.period <= 0) return;

    const down = s.downAmount > 0 ? s.downAmount : s.price * s.downPct;
    const loan = s.price - down;
    const nPayments = s.term * 12;
    const analysisMonths = s.period * 12;
    const pmt = mortgagePayment(loan, s.rate, nPayments);

    // Determine base annual tax — use dollar amount if set, otherwise rate * price
    const baseTaxAnnual = s.taxAnnual > 0 ? s.taxAnnual : s.price * s.taxRate;

    // Year-by-year ownership costs (taxes, insurance, maintenance inflate)
    let totalOwnership = down;
    let mortgageTotal = 0;
    let taxesTotal = 0;
    let insuranceTotal = 0;
    let maintenanceTotal = 0;

    for (let y = 0; y < s.period; y++) {
      const inflationFactor = Math.pow(1 + s.costInflation, y);
      // Property taxes rise with home appreciation
      const homeValueYear = s.price * Math.pow(1 + s.appr, y);
      const taxThisYear = (baseTaxAnnual > 0 && s.price > 0)
        ? baseTaxAnnual * (homeValueYear / s.price)
        : 0;
      const insThisYear = s.ins * inflationFactor;
      const maintThisYear = s.maint * inflationFactor;

      const yearMortgage = pmt * 12;
      mortgageTotal += yearMortgage;
      taxesTotal += taxThisYear;
      insuranceTotal += insThisYear;
      maintenanceTotal += maintThisYear;
      totalOwnership += yearMortgage + taxThisYear + insThisYear + maintThisYear;
    }

    // Equity at sale
    const paymentsMade = Math.min(analysisMonths, nPayments);
    const bal = balanceAfterPayments(loan, s.rate, nPayments, paymentsMade);
    const salePrice = s.price * Math.pow(1 + s.appr, s.period);
    const sellingCost = salePrice * s.sellingPct;
    const equity = salePrice - Math.max(0, bal) - sellingCost;

    // Renting scenario
    let totalRent = 0;
    let currentRent = s.rent;
    for (let y = 0; y < s.period; y++) {
      totalRent += currentRent * 12;
      currentRent *= (1 + s.rentInc);
    }

    // Investment growth of the down payment if renting instead
    const investValue = down * Math.pow(1 + s.investReturn, s.period);
    const investmentGrowth = investValue - down;

    // Net costs
    const netOwn = totalOwnership - equity;
    const netRent = totalRent - investmentGrowth;
    const diff = netRent - netOwn; // positive = buying wins

    // Update DOM — results cards
    document.getElementById('mortgagePay').textContent = fmt(pmt);
    document.getElementById('ownCost').textContent = fmt(totalOwnership);
    document.getElementById('rentCost').textContent = fmt(totalRent);
    document.getElementById('equity').textContent = fmt(equity);

    // Recommendation
    const recText = document.getElementById('recommendationText');
    const diffText = document.getElementById('differenceText');
    const diffValue = document.getElementById('difference');
    diffValue.textContent = fmt(Math.abs(diff));

    if (diff > 0) {
      recText.textContent = 'Buying saves you';
      diffText.textContent = 'over ' + s.period + ' years compared to renting (' + fmt(Math.abs(diff) / s.period) + '/yr)';
    } else {
      recText.textContent = 'Renting saves you';
      diffText.textContent = 'over ' + s.period + ' years compared to buying (' + fmt(Math.abs(diff) / s.period) + '/yr)';
    }

    // Buying breakdown
    document.getElementById('downPayment').textContent = fmt(down);
    document.getElementById('mortgageTotal').textContent = fmt(mortgageTotal);
    document.getElementById('taxesTotal').textContent = fmt(taxesTotal);
    document.getElementById('insuranceTotal').textContent = fmt(insuranceTotal);
    document.getElementById('maintenanceTotal').textContent = fmt(maintenanceTotal);
    document.getElementById('equityBreakdown').textContent = '-' + fmt(equity);
    document.getElementById('netOwnBreakdown').textContent = fmt(netOwn);

    // Renting breakdown
    document.getElementById('rentTotal').textContent = fmt(totalRent);
    document.getElementById('investGrowthDisplay').textContent = '-' + fmt(investmentGrowth);
    document.getElementById('netRentBreakdown').textContent = fmt(netRent);

    updateMathSteps(s, down, loan, pmt, nPayments, baseTaxAnnual, totalOwnership, mortgageTotal, taxesTotal, insuranceTotal, maintenanceTotal, salePrice, sellingCost, bal, equity, totalRent, investValue, investmentGrowth, netOwn, netRent, diff);
  }

  /* ---- Show Calculations steps ---- */
  function updateMathSteps(s, down, loan, pmt, nPayments, baseTaxAnnual, totalOwnership, mortgageTotal, taxesTotal, insuranceTotal, maintenanceTotal, salePrice, sellingCost, bal, equity, totalRent, investValue, investmentGrowth, netOwn, netRent, diff) {
    const container = document.getElementById('calcSteps-buy-vs-rent');
    if (!container) return;

    const r = s.rate / 12;
    let html = '';

    // Step 1: Down payment & loan
    html += '<div class="calc-step"><h4>Step 1: Down Payment &amp; Loan Amount</h4>'
      + '<div class="calc-step__formula">'
      + 'Down Payment = Purchase Price &times; Down Payment %<br>'
      + '<span class="calc-step__values">= ' + fmt(s.price) + ' &times; ' + pct(s.downPct * 100) + ' = <strong>' + fmt(down) + '</strong></span><br>'
      + 'Loan Amount = ' + fmt(s.price) + ' - ' + fmt(down) + ' = <strong>' + fmt(loan) + '</strong>'
      + '</div></div>';

    // Step 2: Monthly payment
    html += '<div class="calc-step"><h4>Step 2: Monthly Mortgage Payment</h4>'
      + '<div class="calc-step__formula">'
      + 'Payment = P &times; r / (1 - (1+r)<sup>-n</sup>)<br>'
      + '<span class="calc-step__note">P = ' + fmt(loan) + ', r = ' + pct(s.rate * 100) + '/12 = ' + (r * 100).toFixed(5) + '%, n = ' + nPayments + '</span><br>'
      + '<span class="calc-step__values">= <strong>' + fmt(pmt) + '</strong>/month</span>'
      + '</div></div>';

    // Step 3: Ownership costs
    html += '<div class="calc-step"><h4>Step 3: Total Ownership Costs (' + s.period + ' Years)</h4>'
      + '<div class="calc-step__formula">'
      + 'Down Payment: ' + fmt(down) + '<br>'
      + 'Mortgage Payments: ' + fmt(pmt) + ' &times; ' + (s.period * 12) + ' months = ' + fmt(mortgageTotal) + '<br>'
      + 'Property Taxes: ' + fmt(taxesTotal) + ' <span class="calc-step__note">(increases with home appreciation)</span><br>'
      + 'Insurance: ' + fmt(insuranceTotal) + ' <span class="calc-step__note">(inflates at ' + pct(s.costInflation * 100) + '/yr)</span><br>'
      + 'Maintenance: ' + fmt(maintenanceTotal) + ' <span class="calc-step__note">(inflates at ' + pct(s.costInflation * 100) + '/yr)</span><br>'
      + '<span class="calc-step__values">Total = <strong>' + fmt(totalOwnership) + '</strong></span>'
      + '</div></div>';

    // Step 4: Home equity at sale
    html += '<div class="calc-step"><h4>Step 4: Net Equity at Sale</h4>'
      + '<div class="calc-step__formula">'
      + 'Home Value = ' + fmt(s.price) + ' &times; (1 + ' + pct(s.appr * 100) + ')<sup>' + s.period + '</sup> = ' + fmt(salePrice) + '<br>'
      + 'Remaining Balance = ' + fmt(Math.max(0, bal)) + '<br>'
      + 'Selling Costs = ' + fmt(salePrice) + ' &times; ' + pct(s.sellingPct * 100) + ' = ' + fmt(sellingCost) + '<br>'
      + '<span class="calc-step__values">Equity = ' + fmt(salePrice) + ' - ' + fmt(Math.max(0, bal)) + ' - ' + fmt(sellingCost) + ' = <strong>' + fmt(equity) + '</strong></span>'
      + '</div></div>';

    // Step 5: Renting costs
    html += '<div class="calc-step"><h4>Step 5: Total Renting Costs (' + s.period + ' Years)</h4>'
      + '<div class="calc-step__formula">'
      + 'Starting Rent: ' + fmt(s.rent) + '/month, increasing ' + pct(s.rentInc * 100) + '/yr<br>'
      + '<span class="calc-step__values">Total Rent = <strong>' + fmt(totalRent) + '</strong></span>'
      + '</div></div>';

    // Step 6: Investment growth
    html += '<div class="calc-step"><h4>Step 6: Investment Growth of Down Payment</h4>'
      + '<div class="calc-step__formula">'
      + 'Future Value = ' + fmt(down) + ' &times; (1 + ' + pct(s.investReturn * 100) + ')<sup>' + s.period + '</sup> = ' + fmt(investValue) + '<br>'
      + '<span class="calc-step__values">Growth = ' + fmt(investValue) + ' - ' + fmt(down) + ' = <strong>' + fmt(investmentGrowth) + '</strong></span>'
      + '</div></div>';

    // Step 7: Final comparison
    html += '<div class="calc-step highlight"><h4>Step 7: Net Cost Comparison</h4>'
      + '<div class="calc-step__formula">'
      + 'Net Cost of Buying = Total Ownership - Equity<br>'
      + '<span class="calc-step__values">= ' + fmt(totalOwnership) + ' - ' + fmt(equity) + ' = <strong>' + fmt(netOwn) + '</strong></span><br><br>'
      + 'Net Cost of Renting = Total Rent - Investment Growth<br>'
      + '<span class="calc-step__values">= ' + fmt(totalRent) + ' - ' + fmt(investmentGrowth) + ' = <strong>' + fmt(netRent) + '</strong></span><br><br>'
      + 'Difference = ' + fmt(netRent) + ' - ' + fmt(netOwn) + ' = <strong>' + fmt(diff) + '</strong><br>'
      + '<span class="calc-step__note">' + (diff > 0 ? 'Buying is cheaper' : 'Renting is cheaper') + ' by ' + fmt(Math.abs(diff)) + ' over ' + s.period + ' years</span>'
      + '</div></div>';

    container.innerHTML = html;
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', function () {
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');

    // Main inputs — recalculate on change
    const inputIds = ['purchasePrice', 'rateBuy', 'termBuy',
      'insurance', 'maintenance', 'appreciation', 'costInflation',
      'sellingCosts', 'rent', 'rentIncrease', 'period', 'investmentReturn'];
    inputIds.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', calculate);
        el.addEventListener('change', calculate);
      }
    });

    // Down payment % <-> $ sync
    const downPctEl = document.getElementById('downPercent');
    const downAmtEl = document.getElementById('downAmount');
    if (downPctEl) {
      downPctEl.addEventListener('input', syncDownFromPercent);
      downPctEl.addEventListener('change', syncDownFromPercent);
    }
    if (downAmtEl) {
      downAmtEl.addEventListener('input', syncDownFromAmount);
      downAmtEl.addEventListener('change', syncDownFromAmount);
    }

    // Tax rate <-> tax amount sync
    const taxRateEl = document.getElementById('taxRate');
    const taxAnnualEl = document.getElementById('taxAnnual');
    if (taxRateEl) {
      taxRateEl.addEventListener('input', syncTaxFromRate);
      taxRateEl.addEventListener('change', syncTaxFromRate);
    }
    if (taxAnnualEl) {
      taxAnnualEl.addEventListener('input', syncTaxFromAmount);
      taxAnnualEl.addEventListener('change', syncTaxFromAmount);
    }

    // Purchase price changes should update synced $ fields
    document.getElementById('purchasePrice').addEventListener('input', function () {
      const downPctVal = P(document.getElementById('downPercent').value);
      if (downPctVal > 0) syncDownFromPercent();
      const taxRateVal = P(document.getElementById('taxRate').value);
      if (taxRateVal > 0) syncTaxFromRate();
    });

    calculate();
  });
})();
