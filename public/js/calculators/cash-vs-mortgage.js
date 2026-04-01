/* =====================================================
   Cash vs Mortgage Comparison Calculator
   ===================================================== */
(function () {
  'use strict';

  const P = MSFG.parseNum;
  const fmt = MSFG.formatCurrency;
  const pct = MSFG.formatPercent;

  /* ---- Gather inputs ---- */
  function getState() {
    const price = P(document.getElementById('priceCash').value);
    const closingCash = P(document.getElementById('closingCash').value);
    const closingMort = P(document.getElementById('closingMortgage').value);
    const downPctVal = P(document.getElementById('downPct').value) / 100;
    const downAmtVal = P(document.getElementById('downAmt').value);
    const rate = P(document.getElementById('mortRate').value) / 100;
    const term = P(document.getElementById('mortTerm').value);
    const investR = P(document.getElementById('investReturn').value) / 100;
    const apprR = P(document.getElementById('appreciation').value) / 100;
    const period = P(document.getElementById('periodCash').value);

    return { price, closingCash, closingMort, downPctVal, downAmtVal, rate, term, investR, apprR, period };
  }

  /* ---- Mortgage math ---- */
  function mortgagePayment(principal, annualRate, totalMonths) {
    if (totalMonths <= 0 || principal <= 0) return 0;
    if (annualRate === 0) return principal / totalMonths;
    const r = annualRate / 12;
    return (principal * r) / (1 - Math.pow(1 + r, -totalMonths));
  }

  function balanceAfterPayments(principal, annualRate, totalMonths, paymentsMade) {
    if (paymentsMade >= totalMonths) return 0;
    if (annualRate === 0) return principal - (principal / totalMonths) * paymentsMade;
    const r = annualRate / 12;
    const pmt = mortgagePayment(principal, annualRate, totalMonths);
    return principal * Math.pow(1 + r, paymentsMade) -
           pmt * ((Math.pow(1 + r, paymentsMade) - 1) / r);
  }

  /* ---- Sync down payment fields ---- */
  function syncDownFromPercent() {
    const price = P(document.getElementById('priceCash').value);
    const pctVal = P(document.getElementById('downPct').value) / 100;
    document.getElementById('downAmt').value = Math.round(price * pctVal);
    document.getElementById('downAmt').classList.remove('is-default');
    calculate();
  }

  function syncDownFromAmount() {
    const price = P(document.getElementById('priceCash').value);
    const amount = P(document.getElementById('downAmt').value);
    if (price > 0) {
      document.getElementById('downPct').value = ((amount / price) * 100).toFixed(3);
      document.getElementById('downPct').classList.remove('is-default');
    }
    calculate();
  }

  /* ---- Main calculation ---- */
  function calculate() {
    const s = getState();
    if (s.price <= 0 || s.period <= 0) return;

    const down = s.downAmtVal > 0 ? s.downAmtVal : s.price * s.downPctVal;
    const loan = s.price - down;
    const months = s.term * 12;
    const monthly = mortgagePayment(loan, s.rate, months);
    const analysisMonths = s.period * 12;

    // Property appreciation (same for both scenarios)
    const appreciatedValue = s.price * Math.pow(1 + s.apprR, s.period);
    const appreciationGain = appreciatedValue - s.price;

    // Cash scenario: pay full price + closing, offset by appreciation
    const costCash = s.price + s.closingCash - appreciationGain;

    // Mortgage scenario
    let costMort = down + s.closingMort;
    let investBalance = s.price - down - s.closingMort;
    const initialInvestment = investBalance;

    // Investment grows monthly; mortgage payments tracked separately
    for (let m = 1; m <= analysisMonths; m++) {
      costMort += monthly;
      investBalance *= 1 + s.investR / 12;
    }

    const remainingBalance = Math.max(0, balanceAfterPayments(loan, s.rate, months, Math.min(analysisMonths, months)));
    const netAfterPayoff = investBalance - remainingBalance;
    const investmentGrowth = netAfterPayoff - initialInvestment;
    costMort -= investmentGrowth;
    costMort -= appreciationGain;

    const mortgagePaymentsTotal = monthly * analysisMonths;
    const diff = costMort - costCash;

    // Update DOM — result cards
    document.getElementById('costCash').textContent = fmt(costCash);
    document.getElementById('costMortgage').textContent = fmt(costMort);
    document.getElementById('monthlyPmt').textContent = fmt(monthly);
    document.getElementById('diffCashMort').textContent = fmt(Math.abs(diff));

    // Recommendation
    const recText = document.getElementById('recommendationText');
    const diffText = document.getElementById('differenceText');

    if (diff > 0) {
      recText.textContent = 'Cash purchase saves you';
      diffText.textContent = 'over ' + s.period + ' years compared to a mortgage (' + fmt(Math.abs(diff) / s.period) + '/yr)';
    } else {
      recText.textContent = 'Mortgage saves you';
      diffText.textContent = 'over ' + s.period + ' years compared to cash (' + fmt(Math.abs(diff) / s.period) + '/yr)';
    }

    // Cash breakdown
    document.getElementById('cashPurchasePrice').textContent = fmt(s.price);
    document.getElementById('cashClosingCosts').textContent = fmt(s.closingCash);
    document.getElementById('cashAppreciation').textContent = '-' + fmt(appreciationGain);
    document.getElementById('cashTotal').textContent = fmt(costCash);

    // Mortgage breakdown
    document.getElementById('mortDownPayment').textContent = fmt(down);
    document.getElementById('mortClosingCosts').textContent = fmt(s.closingMort);
    document.getElementById('mortPayments').textContent = fmt(mortgagePaymentsTotal);
    document.getElementById('mortInvestmentBalance').textContent = fmt(investBalance);
    document.getElementById('mortRemainingBalance').textContent = '-' + fmt(remainingBalance);
    document.getElementById('mortInvestmentGrowth').textContent = '-' + fmt(investmentGrowth);
    document.getElementById('mortAppreciation').textContent = '-' + fmt(appreciationGain);
    document.getElementById('mortTotal').textContent = fmt(costMort);

    updateMathSteps(s, down, loan, monthly, months, analysisMonths, initialInvestment, investBalance, remainingBalance, investmentGrowth, mortgagePaymentsTotal, appreciatedValue, appreciationGain, costCash, costMort, diff);
  }

  /* ---- Show Calculations steps ---- */
  function updateMathSteps(s, down, loan, monthly, months, analysisMonths, initialInvestment, investBalance, remainingBalance, investmentGrowth, mortgagePaymentsTotal, appreciatedValue, appreciationGain, costCash, costMort, diff) {
    const container = document.getElementById('calcSteps-cash-vs-mortgage');
    if (!container) return;

    const r = s.rate / 12;
    let html = '';

    // Step 1: Property appreciation
    html += '<div class="calc-step"><h4>Step 1: Property Appreciation</h4>'
      + '<div class="calc-step__formula">'
      + 'Appreciated Value = ' + fmt(s.price) + ' &times; (1 + ' + pct(s.apprR * 100) + ')<sup>' + s.period + '</sup> = ' + fmt(appreciatedValue) + '<br>'
      + 'Appreciation Gain = ' + fmt(appreciatedValue) + ' - ' + fmt(s.price) + ' = <strong>' + fmt(appreciationGain) + '</strong><br>'
      + '<span class="calc-step__note">This gain applies equally to both scenarios.</span>'
      + '</div></div>';

    // Step 2: Cash purchase
    html += '<div class="calc-step"><h4>Step 2: Cash Purchase Net Cost</h4>'
      + '<div class="calc-step__formula">'
      + 'Net Cost = Purchase Price + Closing Costs - Appreciation Gain<br>'
      + '<span class="calc-step__values">= ' + fmt(s.price) + ' + ' + fmt(s.closingCash) + ' - ' + fmt(appreciationGain) + ' = <strong>' + fmt(costCash) + '</strong></span>'
      + '</div></div>';

    // Step 3: Down payment & loan
    html += '<div class="calc-step"><h4>Step 3: Mortgage - Down Payment &amp; Loan</h4>'
      + '<div class="calc-step__formula">'
      + 'Down Payment = <strong>' + fmt(down) + '</strong><br>'
      + 'Loan Amount = ' + fmt(s.price) + ' - ' + fmt(down) + ' = <strong>' + fmt(loan) + '</strong>'
      + '</div></div>';

    // Step 4: Monthly payment
    html += '<div class="calc-step"><h4>Step 4: Monthly Mortgage Payment</h4>'
      + '<div class="calc-step__formula">'
      + 'Payment = P &times; r / (1 - (1+r)<sup>-n</sup>)<br>'
      + '<span class="calc-step__note">P = ' + fmt(loan) + ', r = ' + pct(s.rate * 100) + '/12 = ' + (r * 100).toFixed(5) + '%, n = ' + months + '</span><br>'
      + '<span class="calc-step__values">= <strong>' + fmt(monthly) + '</strong>/month</span><br>'
      + 'Total Payments (' + analysisMonths + ' months) = <strong>' + fmt(mortgagePaymentsTotal) + '</strong>'
      + '</div></div>';

    // Step 5: Investment growth
    html += '<div class="calc-step"><h4>Step 5: Investment Growth of Remaining Cash</h4>'
      + '<div class="calc-step__formula">'
      + 'Cash Invested = Purchase Price - Down Payment - Closing Costs<br>'
      + '<span class="calc-step__values">= ' + fmt(s.price) + ' - ' + fmt(down) + ' - ' + fmt(s.closingMort) + ' = <strong>' + fmt(initialInvestment) + '</strong></span><br>'
      + 'Monthly Growth Rate = ' + pct(s.investR * 100) + ' / 12 = ' + (s.investR / 12 * 100).toFixed(4) + '%<br>'
      + 'Balance after ' + analysisMonths + ' months = <strong>' + fmt(investBalance) + '</strong>'
      + '</div></div>';

    // Step 6: Remaining balance
    html += '<div class="calc-step"><h4>Step 6: Remaining Mortgage Balance</h4>'
      + '<div class="calc-step__formula">'
      + 'After ' + analysisMonths + ' payments on a ' + months + '-month loan:<br>'
      + '<span class="calc-step__values">Remaining Balance = <strong>' + fmt(remainingBalance) + '</strong></span><br>'
      + '<span class="calc-step__note">This must be paid off from the investment account at the end of the analysis period.</span>'
      + '</div></div>';

    // Step 7: Net investment benefit
    html += '<div class="calc-step"><h4>Step 7: Net Investment Benefit</h4>'
      + '<div class="calc-step__formula">'
      + 'Net After Payoff = Investment Balance - Remaining Balance<br>'
      + '<span class="calc-step__values">= ' + fmt(investBalance) + ' - ' + fmt(remainingBalance) + ' = ' + fmt(investBalance - remainingBalance) + '</span><br>'
      + 'Net Benefit = Net After Payoff - Initial Investment<br>'
      + '<span class="calc-step__values">= ' + fmt(investBalance - remainingBalance) + ' - ' + fmt(initialInvestment) + ' = <strong>' + fmt(investmentGrowth) + '</strong></span>'
      + '</div></div>';

    // Step 8: Final comparison
    html += '<div class="calc-step highlight"><h4>Step 8: Net Cost Comparison</h4>'
      + '<div class="calc-step__formula">'
      + 'Mortgage Net Cost = Down + Closing + Payments - Investment Benefit - Appreciation<br>'
      + '<span class="calc-step__values">= ' + fmt(down) + ' + ' + fmt(s.closingMort) + ' + ' + fmt(mortgagePaymentsTotal) + ' - ' + fmt(investmentGrowth) + ' - ' + fmt(appreciationGain) + ' = <strong>' + fmt(costMort) + '</strong></span><br><br>'
      + 'Cash Net Cost = <strong>' + fmt(costCash) + '</strong><br><br>'
      + 'Difference = ' + fmt(costMort) + ' - ' + fmt(costCash) + ' = <strong>' + fmt(diff) + '</strong><br>'
      + '<span class="calc-step__note">' + (diff > 0 ? 'Cash is cheaper' : 'Mortgage is cheaper') + ' by ' + fmt(Math.abs(diff)) + ' over ' + s.period + ' years</span>'
      + '</div></div>';

    container.innerHTML = html;
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', function () {
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');

    // Main inputs
    const inputIds = ['priceCash', 'closingCash', 'closingMortgage',
      'mortRate', 'mortTerm', 'investReturn', 'appreciation', 'periodCash'];
    inputIds.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', calculate);
        el.addEventListener('change', calculate);
      }
    });

    // Down payment % <-> $ sync
    const downPctEl = document.getElementById('downPct');
    const downAmtEl = document.getElementById('downAmt');
    if (downPctEl) {
      downPctEl.addEventListener('input', syncDownFromPercent);
      downPctEl.addEventListener('change', syncDownFromPercent);
    }
    if (downAmtEl) {
      downAmtEl.addEventListener('input', syncDownFromAmount);
      downAmtEl.addEventListener('change', syncDownFromAmount);
    }

    // Purchase price changes should update down payment $
    document.getElementById('priceCash').addEventListener('input', function () {
      const pctVal = P(document.getElementById('downPct').value);
      if (pctVal > 0) syncDownFromPercent();
    });

    calculate();
  });
})();
