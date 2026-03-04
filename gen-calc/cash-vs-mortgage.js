'use strict';

function parseNum(v) {
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function mortgagePay(principal, rate, months) {
  if (rate === 0) return principal / months;
  var m = rate / 12;
  return (principal * m) / (1 - Math.pow(1 + m, -months));
}

function futureValue(amount, rate, years) {
  return amount * Math.pow(1 + rate, years);
}

function balanceAfterPayments(principal, rate, totalMonths, paymentsMade) {
  if (paymentsMade >= totalMonths) return 0;
  if (rate === 0) return principal - (principal / totalMonths) * paymentsMade;
  var m = rate / 12;
  var pmt = mortgagePay(principal, rate, totalMonths);
  return principal * Math.pow(1 + m, paymentsMade) -
         pmt * ((Math.pow(1 + m, paymentsMade) - 1) / m);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function toggleCalculations() {
  var calculations = document.getElementById('mathCalculations');
  var toggleText = document.getElementById('toggleText');

  if (calculations.classList.contains('hidden')) {
    calculations.classList.remove('hidden');
    toggleText.textContent = 'Hide Details';
  } else {
    calculations.classList.add('hidden');
    toggleText.textContent = 'Show Details';
  }
}

function calcCashMortgage() {
  var price = parseNum(document.getElementById('priceCash').value);
  var closingCash = parseNum(document.getElementById('closingCash').value);
  var closingMort = parseNum(document.getElementById('closingMortgage').value);
  var downPct = parseNum(document.getElementById('downPct').value) / 100;
  var rate = parseNum(document.getElementById('mortRate').value) / 100;
  var term = parseNum(document.getElementById('mortTerm').value);
  var investR = parseNum(document.getElementById('investReturn').value) / 100;
  var apprR = parseNum(document.getElementById('appreciation').value) / 100;
  var period = parseNum(document.getElementById('periodCash').value);

  var down = price * downPct;
  var loan = price - down;
  var months = term * 12;
  var monthly = mortgagePay(loan, rate, months);
  var analysisMonths = period * 12;

  var appreciatedValue = price * Math.pow(1 + apprR, period);
  var appreciationGain = appreciatedValue - price;

  var costCash = price + closingCash - appreciationGain;

  var costMort = down + closingMort;
  var investBalance = price - down - closingMort;

  for (var m = 1; m <= analysisMonths; m++) {
    costMort += monthly;
    investBalance *= 1 + investR / 12;
  }

  var remainingBalance = Math.max(0, balanceAfterPayments(loan, rate, months, Math.min(analysisMonths, months)));

  var initialInvestment = price - down - closingMort;
  var netAfterPayoff = investBalance - remainingBalance;
  var investmentGrowth = netAfterPayoff - initialInvestment;
  costMort -= investmentGrowth;
  costMort -= appreciationGain;

  var diff = costMort - costCash;

  document.getElementById('costCash').textContent = formatCurrency(costCash);
  document.getElementById('costMortgage').textContent = formatCurrency(costMort);
  document.getElementById('diffCashMort').textContent = formatCurrency(Math.abs(diff));

  var diffCard = document.getElementById('differenceCard');
  var diffText = document.getElementById('differenceText');
  if (diff > 0) {
    diffCard.className = 'difference negative';
    diffText.textContent = 'Mortgage costs MORE than cash';
  } else {
    diffCard.className = 'difference positive';
    diffText.textContent = 'Mortgage costs LESS than cash';
  }

  updateBreakdowns(price, closingCash, closingMort, down, monthly, analysisMonths,
                   costCash, costMort, investmentGrowth, investBalance, remainingBalance, appreciationGain);

  updateMathCalculations(price, closingCash, closingMort, down, loan, rate, monthly,
                        analysisMonths, investR, investmentGrowth,
                        costCash, costMort, diff, investBalance, remainingBalance,
                        apprR, appreciatedValue, appreciationGain);

  updateRecommendation(diff, Math.abs(diff), costCash, costMort);
}

function updateBreakdowns(price, closingCash, closingMort, down, monthly, analysisMonths,
                          costCash, costMort, investmentGrowth, investBalance, remainingBalance, appreciationGain) {
  document.getElementById('cashPurchasePrice').textContent = formatCurrency(price);
  document.getElementById('cashClosingCosts').textContent = formatCurrency(closingCash);
  document.getElementById('cashAppreciation').textContent = '-' + formatCurrency(appreciationGain);
  document.getElementById('cashTotal').textContent = formatCurrency(costCash);

  document.getElementById('mortDownPayment').textContent = formatCurrency(down);
  document.getElementById('mortClosingCosts').textContent = formatCurrency(closingMort);
  document.getElementById('mortPayments').textContent = formatCurrency(monthly * analysisMonths);
  document.getElementById('mortInvestmentBalance').textContent = formatCurrency(investBalance);
  document.getElementById('mortRemainingBalance').textContent = '-' + formatCurrency(remainingBalance);
  document.getElementById('mortInvestmentGrowth').textContent = '-' + formatCurrency(investmentGrowth);
  document.getElementById('mortAppreciation').textContent = '-' + formatCurrency(appreciationGain);
  document.getElementById('mortTotal').textContent = formatCurrency(costMort);
}

function updateMathCalculations(price, closingCash, closingMort, down, loan, rate, monthly,
                                analysisMonths, investR, investmentGrowth,
                                costCash, costMort, diff, investBalance, remainingBalance,
                                apprR, appreciatedValue, appreciationGain) {
  var mathDiv = document.getElementById('mathCalculations');

  var mortgagePaymentsTotal = monthly * analysisMonths;
  var initialInvestment = price - down - closingMort;
  var termMonths = parseNum(document.getElementById('mortTerm').value) * 12;
  var period = analysisMonths / 12;

  mathDiv.innerHTML =
    '<div class="calculation-step">' +
    '<h4>Property Appreciation</h4>' +
    '<p>Appreciated Value = Purchase Price &times; (1 + ' + (apprR * 100).toFixed(2) + '%)^' + period + '</p>' +
    '<p>Appreciated Value = ' + formatCurrency(price) + ' &times; ' + Math.pow(1 + apprR, period).toFixed(4) + ' = ' + formatCurrency(appreciatedValue) + '</p>' +
    '<p>Appreciation Gain = ' + formatCurrency(appreciatedValue) + ' - ' + formatCurrency(price) + ' = ' + formatCurrency(appreciationGain) + '</p>' +
    '<p>This gain applies equally to both the cash buyer and mortgage buyer.</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Cash Purchase Calculation</h4>' +
    '<p>Net Cost = Purchase Price + Closing Costs - Appreciation Gain</p>' +
    '<p>Net Cost = ' + formatCurrency(price) + ' + ' + formatCurrency(closingCash) + ' - ' + formatCurrency(appreciationGain) + '</p>' +
    '<p>Net Cost = ' + formatCurrency(costCash) + '</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Mortgage Purchase Calculation</h4>' +
    '<p>Monthly Payment = P &times; [r(1+r)^n] / [(1+r)^n - 1]</p>' +
    '<p>Where P = ' + formatCurrency(loan) + ', r = ' + (rate * 100).toFixed(2) + '%/12, n = ' + termMonths + ' months</p>' +
    '<p>Monthly Payment = ' + formatCurrency(monthly) + '</p>' +
    '<p>Total Mortgage Payments (' + analysisMonths + ' months) = ' + formatCurrency(monthly) + ' &times; ' + analysisMonths + ' = ' + formatCurrency(mortgagePaymentsTotal) + '</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Investment Growth Calculation</h4>' +
    '<p>Initial Investment = Purchase Price - Down Payment - Mortgage Closing Costs</p>' +
    '<p>Initial Investment = ' + formatCurrency(price) + ' - ' + formatCurrency(down) + ' - ' + formatCurrency(closingMort) + ' = ' + formatCurrency(initialInvestment) + '</p>' +
    '<p>Monthly Growth Rate = ' + (investR * 100).toFixed(2) + '% / 12 = ' + (investR / 12 * 100).toFixed(4) + '%</p>' +
    '<p>Investment Balance = ' + formatCurrency(initialInvestment) + ' &times; (1 + ' + (investR / 12).toFixed(6) + ')^' + analysisMonths + ' = ' + formatCurrency(investBalance) + '</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Remaining Mortgage Balance</h4>' +
    '<p>After ' + analysisMonths + ' payments on a ' + termMonths + '-month loan:</p>' +
    '<p>Remaining Balance = ' + formatCurrency(remainingBalance) + '</p>' +
    '<p>At the end of the analysis period, the remaining mortgage balance must be paid off from the investment savings.</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Net Investment Benefit</h4>' +
    '<p>Net After Payoff = Investment Balance - Remaining Mortgage Balance</p>' +
    '<p>Net After Payoff = ' + formatCurrency(investBalance) + ' - ' + formatCurrency(remainingBalance) + ' = ' + formatCurrency(investBalance - remainingBalance) + '</p>' +
    '<p>Net Investment Benefit = Net After Payoff - Initial Investment</p>' +
    '<p>Net Investment Benefit = ' + formatCurrency(investBalance - remainingBalance) + ' - ' + formatCurrency(initialInvestment) + ' = ' + formatCurrency(investmentGrowth) + '</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Total Mortgage Cost</h4>' +
    '<p>Net Cost = Down Payment + Closing Costs + Mortgage Payments - Net Investment Benefit - Appreciation Gain</p>' +
    '<p>Net Cost = ' + formatCurrency(down) + ' + ' + formatCurrency(closingMort) + ' + ' + formatCurrency(mortgagePaymentsTotal) + ' - ' + formatCurrency(investmentGrowth) + ' - ' + formatCurrency(appreciationGain) + '</p>' +
    '<p>Net Cost = ' + formatCurrency(costMort) + '</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Cost Difference</h4>' +
    '<p>Difference = Mortgage Cost - Cash Cost</p>' +
    '<p>Difference = ' + formatCurrency(costMort) + ' - ' + formatCurrency(costCash) + ' = ' + formatCurrency(diff) + '</p>' +
    '</div>';
}

function updateRecommendation(diff, absDiff, costCash, costMort) {
  var recommendation = document.getElementById('recommendation');
  var conclusionText = document.getElementById('conclusionText');

  var savingsPercent = ((absDiff / Math.min(costCash, costMort)) * 100).toFixed(1);

  if (diff > 0) {
    recommendation.textContent = 'RECOMMENDATION: Pay Cash';
    conclusionText.innerHTML =
      '<strong>Paying cash is the better financial choice.</strong><br>' +
      'You would save <strong>' + formatCurrency(absDiff) + '</strong> (' + savingsPercent + '% of the lower cost option) ' +
      'by paying cash instead of taking a mortgage. This analysis assumes you would invest the ' +
      'remaining cash at the specified return rate if you chose the mortgage option.';
  } else {
    recommendation.textContent = 'RECOMMENDATION: Take Mortgage';
    conclusionText.innerHTML =
      '<strong>Taking a mortgage is the better financial choice.</strong><br>' +
      'You would save <strong>' + formatCurrency(absDiff) + '</strong> (' + savingsPercent + '% of the lower cost option) ' +
      'by taking a mortgage instead of paying cash. This assumes you invest the remaining cash ' +
      'at the specified return rate, which generates enough growth to offset the mortgage costs.';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var inputIds = ['priceCash', 'closingCash', 'closingMortgage', 'downPct',
                  'mortRate', 'mortTerm', 'investReturn', 'appreciation', 'periodCash'];

  inputIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', calcCashMortgage);
      el.addEventListener('change', calcCashMortgage);
    }
  });

  var toggleBtn = document.querySelector('.toggle-button');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleCalculations);

  calcCashMortgage();
});
