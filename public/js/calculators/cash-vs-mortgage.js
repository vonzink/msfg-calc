/* =====================================================
   Cash vs Mortgage Comparison Calculator
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
        const dollarVal = price > 0 ? Math.round(price * currentVal / 100) : 0;
        toggle.dataset.mode = 'dollar';
        toggle.textContent = '$';
        input.value = dollarVal || '';
        input.step = dollarStep;
        input.placeholder = dollarPlaceholder;
      } else {
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

  /* ---- Main calculation ---- */
  function calculate() {
    const price = P(document.getElementById('priceCash').value);
    const closingCash = P(document.getElementById('closingCash').value);
    const closingMort = P(document.getElementById('closingMortgage').value);
    const rate = P(document.getElementById('mortRate').value) / 100;
    const term = P(document.getElementById('mortTerm').value);
    const investR = P(document.getElementById('investReturn').value) / 100;
    const apprR = P(document.getElementById('appreciation').value) / 100;
    const period = P(document.getElementById('periodCash').value);

    if (price <= 0 || period <= 0) return;

    const downResolved = resolveToggleValue('downToggle', 'downPaymentInput', 'priceCash');
    const down = downResolved.dollar;
    const loan = price - down;
    const months = term * 12;
    const monthly = mortgagePayment(loan, rate, months);
    const analysisMonths = period * 12;

    // Property appreciation (same for both scenarios)
    const appreciatedValue = price * Math.pow(1 + apprR, period);
    const appreciationGain = appreciatedValue - price;

    // Cash scenario
    const costCash = price + closingCash - appreciationGain;

    // Mortgage scenario
    let costMort = down + closingMort;
    let investBalance = price - down - closingMort;
    const initialInvestment = investBalance;

    for (let m = 1; m <= analysisMonths; m++) {
      costMort += monthly;
      investBalance *= 1 + investR / 12;
    }

    const remainingBalance = Math.max(0, balanceAfterPayments(loan, rate, months, Math.min(analysisMonths, months)));
    const netAfterPayoff = investBalance - remainingBalance;
    const investmentGrowth = netAfterPayoff - initialInvestment;
    costMort -= investmentGrowth;
    costMort -= appreciationGain;

    const mortgagePaymentsTotal = monthly * analysisMonths;
    const diff = costMort - costCash;

    // Update DOM
    document.getElementById('costCash').textContent = fmt(costCash);
    document.getElementById('costMortgage').textContent = fmt(costMort);
    document.getElementById('monthlyPmt').textContent = fmt(monthly);
    document.getElementById('diffCashMort').textContent = fmt(Math.abs(diff));

    const recText = document.getElementById('recommendationText');
    const diffText = document.getElementById('differenceText');

    if (diff > 0) {
      recText.textContent = 'Cash purchase saves you';
      diffText.textContent = 'over ' + period + ' years compared to a mortgage (' + fmt(Math.abs(diff) / period) + '/yr)';
    } else {
      recText.textContent = 'Mortgage saves you';
      diffText.textContent = 'over ' + period + ' years compared to cash (' + fmt(Math.abs(diff) / period) + '/yr)';
    }

    // Cash breakdown
    document.getElementById('cashPurchasePrice').textContent = fmt(price);
    document.getElementById('cashClosingCosts').textContent = fmt(closingCash);
    document.getElementById('cashAppreciation').textContent = '-' + fmt(appreciationGain);
    document.getElementById('cashTotal').textContent = fmt(costCash);

    // Mortgage breakdown
    document.getElementById('mortDownPayment').textContent = fmt(down);
    document.getElementById('mortClosingCosts').textContent = fmt(closingMort);
    document.getElementById('mortPayments').textContent = fmt(mortgagePaymentsTotal);
    document.getElementById('mortInvestmentBalance').textContent = fmt(investBalance);
    document.getElementById('mortRemainingBalance').textContent = '-' + fmt(remainingBalance);
    document.getElementById('mortInvestmentGrowth').textContent = '-' + fmt(investmentGrowth);
    document.getElementById('mortAppreciation').textContent = '-' + fmt(appreciationGain);
    document.getElementById('mortTotal').textContent = fmt(costMort);

    updateMathSteps(price, down, loan, monthly, rate, months, analysisMonths, period, closingCash, closingMort, investR, apprR, initialInvestment, investBalance, remainingBalance, investmentGrowth, mortgagePaymentsTotal, appreciatedValue, appreciationGain, costCash, costMort, diff);
  }

  /* ---- Show Calculations steps ---- */
  function updateMathSteps(price, down, loan, monthly, rate, months, analysisMonths, period, closingCash, closingMort, investR, apprR, initialInvestment, investBalance, remainingBalance, investmentGrowth, mortgagePaymentsTotal, appreciatedValue, appreciationGain, costCash, costMort, diff) {
    const container = document.getElementById('calcSteps-cash-vs-mortgage');
    if (!container) return;

    const r = rate / 12;
    let html = '';

    html += '<div class="calc-step"><h4>Step 1: Property Appreciation</h4>'
      + '<div class="calc-step__formula">'
      + 'Appreciated Value = ' + fmt(price) + ' &times; (1 + ' + pct(apprR * 100) + ')<sup>' + period + '</sup> = ' + fmt(appreciatedValue) + '<br>'
      + 'Appreciation Gain = ' + fmt(appreciatedValue) + ' - ' + fmt(price) + ' = <strong>' + fmt(appreciationGain) + '</strong><br>'
      + '<span class="calc-step__note">This gain applies equally to both scenarios.</span>'
      + '</div></div>';

    html += '<div class="calc-step"><h4>Step 2: Cash Purchase Net Cost</h4>'
      + '<div class="calc-step__formula">'
      + 'Net Cost = Purchase Price + Closing Costs - Appreciation Gain<br>'
      + '<span class="calc-step__values">= ' + fmt(price) + ' + ' + fmt(closingCash) + ' - ' + fmt(appreciationGain) + ' = <strong>' + fmt(costCash) + '</strong></span>'
      + '</div></div>';

    html += '<div class="calc-step"><h4>Step 3: Mortgage - Down Payment &amp; Loan</h4>'
      + '<div class="calc-step__formula">'
      + 'Down Payment = <strong>' + fmt(down) + '</strong><br>'
      + 'Loan Amount = ' + fmt(price) + ' - ' + fmt(down) + ' = <strong>' + fmt(loan) + '</strong>'
      + '</div></div>';

    html += '<div class="calc-step"><h4>Step 4: Monthly Mortgage Payment</h4>'
      + '<div class="calc-step__formula">'
      + 'Payment = P &times; r / (1 - (1+r)<sup>-n</sup>)<br>'
      + '<span class="calc-step__note">P = ' + fmt(loan) + ', r = ' + pct(rate * 100) + '/12 = ' + (r * 100).toFixed(5) + '%, n = ' + months + '</span><br>'
      + '<span class="calc-step__values">= <strong>' + fmt(monthly) + '</strong>/month</span><br>'
      + 'Total Payments (' + analysisMonths + ' months) = <strong>' + fmt(mortgagePaymentsTotal) + '</strong>'
      + '</div></div>';

    html += '<div class="calc-step"><h4>Step 5: Investment Growth of Remaining Cash</h4>'
      + '<div class="calc-step__formula">'
      + 'Cash Invested = Purchase Price - Down Payment - Closing Costs<br>'
      + '<span class="calc-step__values">= ' + fmt(price) + ' - ' + fmt(down) + ' - ' + fmt(closingMort) + ' = <strong>' + fmt(initialInvestment) + '</strong></span><br>'
      + 'Monthly Growth Rate = ' + pct(investR * 100) + ' / 12 = ' + (investR / 12 * 100).toFixed(4) + '%<br>'
      + 'Balance after ' + analysisMonths + ' months = <strong>' + fmt(investBalance) + '</strong>'
      + '</div></div>';

    html += '<div class="calc-step"><h4>Step 6: Remaining Mortgage Balance</h4>'
      + '<div class="calc-step__formula">'
      + 'After ' + analysisMonths + ' payments on a ' + months + '-month loan:<br>'
      + '<span class="calc-step__values">Remaining Balance = <strong>' + fmt(remainingBalance) + '</strong></span><br>'
      + '<span class="calc-step__note">This must be paid off from the investment account at the end of the analysis period.</span>'
      + '</div></div>';

    html += '<div class="calc-step"><h4>Step 7: Net Investment Benefit</h4>'
      + '<div class="calc-step__formula">'
      + 'Net After Payoff = Investment Balance - Remaining Balance<br>'
      + '<span class="calc-step__values">= ' + fmt(investBalance) + ' - ' + fmt(remainingBalance) + ' = ' + fmt(investBalance - remainingBalance) + '</span><br>'
      + 'Net Benefit = Net After Payoff - Initial Investment<br>'
      + '<span class="calc-step__values">= ' + fmt(investBalance - remainingBalance) + ' - ' + fmt(initialInvestment) + ' = <strong>' + fmt(investmentGrowth) + '</strong></span>'
      + '</div></div>';

    html += '<div class="calc-step highlight"><h4>Step 8: Net Cost Comparison</h4>'
      + '<div class="calc-step__formula">'
      + 'Mortgage Net Cost = Down + Closing + Payments - Investment Benefit - Appreciation<br>'
      + '<span class="calc-step__values">= ' + fmt(down) + ' + ' + fmt(closingMort) + ' + ' + fmt(mortgagePaymentsTotal) + ' - ' + fmt(investmentGrowth) + ' - ' + fmt(appreciationGain) + ' = <strong>' + fmt(costMort) + '</strong></span><br><br>'
      + 'Cash Net Cost = <strong>' + fmt(costCash) + '</strong><br><br>'
      + 'Difference = ' + fmt(costMort) + ' - ' + fmt(costCash) + ' = <strong>' + fmt(diff) + '</strong><br>'
      + '<span class="calc-step__note">' + (diff > 0 ? 'Cash is cheaper' : 'Mortgage is cheaper') + ' by ' + fmt(Math.abs(diff)) + ' over ' + period + ' years</span>'
      + '</div></div>';

    container.innerHTML = html;
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', function () {
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');

    setupToggle('downToggle', 'downPaymentInput', 'priceCash', '0.5', '1000', 'Down %', 'Down payment amount');

    const inputIds = ['priceCash', 'downPaymentInput', 'closingCash', 'closingMortgage',
      'mortRate', 'mortTerm', 'investReturn', 'appreciation', 'periodCash'];
    inputIds.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', calculate);
        el.addEventListener('change', calculate);
      }
    });

    calculate();

    /* ---- Register email data provider ---- */
    if (MSFG.CalcActions) {
      MSFG.CalcActions.register(function () {
        return {
          title: 'Cash vs Mortgage Comparison',
          sections: [
            {
              heading: 'Summary',
              rows: [
                { label: 'Purchase Price', value: document.getElementById('priceCash').value ? fmt(P(document.getElementById('priceCash').value)) : '$0' },
                { label: 'Analysis Period', value: document.getElementById('periodCash').value + ' years' },
                { label: 'Net Cost of Cash', value: document.getElementById('cashResult').textContent },
                { label: 'Net Cost of Mortgage', value: document.getElementById('mortgageResult').textContent },
                { label: 'Recommendation', value: document.getElementById('recommendText').textContent + ' ' + document.getElementById('savingsAmount').textContent, isTotal: true }
              ]
            },
            {
              heading: 'Cash Purchase Breakdown',
              rows: [
                { label: 'Purchase Price', value: document.getElementById('cashPrice').textContent },
                { label: 'Closing Costs', value: document.getElementById('cashClosing').textContent },
                { label: 'Property Appreciation', value: document.getElementById('cashAppreciation').textContent },
                { label: 'Net Cost of Cash', value: document.getElementById('cashTotal').textContent, isTotal: true }
              ]
            },
            {
              heading: 'Mortgage Breakdown',
              rows: [
                { label: 'Down Payment', value: document.getElementById('mortDown').textContent },
                { label: 'Closing Costs', value: document.getElementById('mortClosing').textContent },
                { label: 'Total Mortgage Payments', value: document.getElementById('mortPayments').textContent },
                { label: 'Monthly Payment', value: document.getElementById('monthlyPaymentDisplay').textContent },
                { label: 'Investment Balance', value: document.getElementById('mortInvestmentBalance').textContent },
                { label: 'Remaining Mortgage Balance', value: document.getElementById('mortRemainingBalance').textContent },
                { label: 'Net Investment Benefit', value: document.getElementById('mortInvestmentGrowth').textContent },
                { label: 'Property Appreciation', value: document.getElementById('mortAppreciation').textContent },
                { label: 'Net Cost of Mortgage', value: document.getElementById('mortTotal').textContent, isTotal: true }
              ]
            }
          ]
        };
      });
    }
  });
})();
