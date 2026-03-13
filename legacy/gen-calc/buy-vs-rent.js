'use strict';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function parseNum(val) {
  var n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function mortgagePayment(p, r, n) {
  if (r === 0) return p / n;
  var m = r / 12;
  return (p * m) / (1 - Math.pow(1 + m, -n));
}

function futureValue(p, r, n) {
  return p * Math.pow(1 + r, n);
}

function balanceAfterPayments(principal, r, n, paymentsMade) {
  if (r === 0) return principal - (principal / n) * paymentsMade;
  var m = r / 12;
  return (
    principal * Math.pow(1 + m, paymentsMade) -
    mortgagePayment(principal, r, n) *
      ((Math.pow(1 + m, paymentsMade) - 1) / m)
  );
}

function toggleCalculations() {
  var calculations = document.getElementById('calculationDetails');
  var toggleText = document.getElementById('toggleText');

  if (calculations.classList.contains('hidden')) {
    calculations.classList.remove('hidden');
    toggleText.textContent = 'Hide Details';
  } else {
    calculations.classList.add('hidden');
    toggleText.textContent = 'Show Details';
  }
}

function calcBuyRent() {
  var price = parseNum(document.getElementById('purchasePrice').value);
  var downPct = parseNum(document.getElementById('downPercent').value) / 100;
  var rate = parseNum(document.getElementById('rateBuy').value) / 100;
  var term = parseNum(document.getElementById('termBuy').value);
  var taxRate = parseNum(document.getElementById('taxRate').value) / 100;
  var ins = parseNum(document.getElementById('insurance').value);
  var maint = parseNum(document.getElementById('maintenance').value);
  var appr = parseNum(document.getElementById('appreciation').value) / 100;
  var rent = parseNum(document.getElementById('rent').value);
  var rentInc = parseNum(document.getElementById('rentIncrease').value) / 100;
  var period = parseNum(document.getElementById('period').value);
  var investReturn = parseNum(document.getElementById('investmentReturn').value) / 100;

  var down = price * downPct;
  var loan = price - down;
  var nPayments = term * 12;
  var pmt = mortgagePayment(loan, rate, nPayments);

  var totalOwnership = down;
  var analysisMonths = period * 12;

  var mortgageTotal = 0;
  var taxesTotal = 0;
  var insuranceTotal = 0;
  var maintenanceTotal = 0;

  for (var m = 1; m <= analysisMonths; m++) {
    totalOwnership += pmt;
    mortgageTotal += pmt;
    var monthlyTax = (price * taxRate) / 12;
    totalOwnership += monthlyTax;
    taxesTotal += monthlyTax;
    var monthlyIns = ins / 12;
    var monthlyMaint = maint / 12;
    totalOwnership += monthlyIns + monthlyMaint;
    insuranceTotal += monthlyIns;
    maintenanceTotal += monthlyMaint;
  }

  var bal = balanceAfterPayments(loan, rate, nPayments, analysisMonths);
  var salePrice = price * Math.pow(1 + appr, period);
  var sellingCost = salePrice * 0.06;
  var equity = salePrice - bal - sellingCost;

  var totalRent = 0;
  var investValue = down;
  var currentRent = rent;
  for (var y = 1; y <= period; y++) {
    totalRent += currentRent * 12;
    investValue *= 1 + investReturn;
    currentRent *= 1 + rentInc;
  }

  var investmentGrowth = investValue - down;

  var netOwn = totalOwnership - equity;
  var netRent = totalRent - investmentGrowth;
  var diff = netRent - netOwn;

  document.getElementById('mortgagePay').textContent = formatCurrency(pmt);
  document.getElementById('ownCost').textContent = formatCurrency(totalOwnership);
  document.getElementById('rentCost').textContent = formatCurrency(totalRent);
  document.getElementById('equity').textContent = formatCurrency(equity);

  var diffCard = document.getElementById('differenceCard');
  var diffText = document.getElementById('differenceText');
  if (diff > 0) {
    diffCard.className = 'difference positive';
    diffText.textContent = 'Renting costs MORE than buying';
  } else {
    diffCard.className = 'difference negative';
    diffText.textContent = 'Renting costs LESS than buying';
  }
  document.getElementById('difference').textContent = formatCurrency(Math.abs(diff));

  updateRecommendation(diff, Math.abs(diff), netOwn, netRent, period);

  document.getElementById('downPayment').textContent = formatCurrency(down);
  document.getElementById('mortgageTotal').textContent = formatCurrency(mortgageTotal);
  document.getElementById('taxesTotal').textContent = formatCurrency(taxesTotal);
  document.getElementById('insuranceTotal').textContent = formatCurrency(insuranceTotal);
  document.getElementById('maintenanceTotal').textContent = formatCurrency(maintenanceTotal);
  document.getElementById('equityBreakdown').textContent = '-' + formatCurrency(equity);
  document.getElementById('netOwnBreakdown').textContent = formatCurrency(netOwn);

  document.getElementById('rentTotal').textContent = formatCurrency(totalRent);
  document.getElementById('investmentGrowth').textContent = '-' + formatCurrency(investmentGrowth);
  document.getElementById('netRentBreakdown').textContent = formatCurrency(netRent);

  updateCalculationDetails(price, down, pmt, totalOwnership, totalRent, equity, investmentGrowth, netOwn, netRent, diff, period);
}

function updateRecommendation(diff, absDiff, netOwn, netRent, period) {
  var recommendationText = document.getElementById('recommendationText');
  var recommendationDetails = document.getElementById('recommendationDetails');

  var savingsPercent = ((absDiff / Math.min(netOwn, netRent)) * 100).toFixed(1);
  var savingsPerYear = absDiff / period;

  if (diff > 0) {
    recommendationText.textContent = 'RECOMMENDATION: Buy the Home';
    recommendationDetails.innerHTML =
      '<strong>Buying is the better financial choice.</strong><br>' +
      'You would save <strong>' + formatCurrency(absDiff) + '</strong> (' + savingsPercent + '% savings) ' +
      'over ' + period + ' years by buying instead of renting. That\'s approximately ' +
      '<strong>' + formatCurrency(savingsPerYear) + '</strong> in savings per year. This analysis ' +
      'assumes the home appreciates as projected and you invest your down payment ' +
      'at the specified return rate if renting.';
  } else {
    recommendationText.textContent = 'RECOMMENDATION: Continue Renting';
    recommendationDetails.innerHTML =
      '<strong>Renting is the better financial choice.</strong><br>' +
      'You would save <strong>' + formatCurrency(absDiff) + '</strong> (' + savingsPercent + '% savings) ' +
      'over ' + period + ' years by continuing to rent instead of buying. That\'s approximately ' +
      '<strong>' + formatCurrency(savingsPerYear) + '</strong> in savings per year. This assumes ' +
      'you invest the down payment at the specified return rate, which provides ' +
      'better returns than the net cost of homeownership.';
  }
}

function updateCalculationDetails(price, down, pmt, totalOwnership, totalRent, equity, investmentGrowth, netOwn, netRent, diff, period) {
  var detailsDiv = document.getElementById('calculationDetails');
  var appr = parseNum(document.getElementById('appreciation').value) / 100;
  var homeValue = price * Math.pow(1 + appr, period);
  var currentRent = parseNum(document.getElementById('rent').value);
  var rateBuy = parseNum(document.getElementById('rateBuy').value);
  var termBuy = parseNum(document.getElementById('termBuy').value);
  var investReturnVal = parseNum(document.getElementById('investmentReturn').value);

  detailsDiv.innerHTML =
    '<div class="calculation-step">' +
    '<h4>Buying Cost Calculation</h4>' +
    '<p>Down Payment: ' + formatCurrency(down) + '</p>' +
    '<p>Monthly Mortgage Payment: ' + formatCurrency(pmt) + '</p>' +
    '<p>Total Ownership Cost: ' + formatCurrency(totalOwnership) + '</p>' +
    '<p>Home Value After ' + period + ' Years: ' + formatCurrency(homeValue) + '</p>' +
    '<p>Net Equity at Sale: ' + formatCurrency(equity) + '</p>' +
    '<p>Net Cost of Buying: ' + formatCurrency(netOwn) + '</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Renting Cost Calculation</h4>' +
    '<p>Current Monthly Rent: ' + formatCurrency(currentRent) + '</p>' +
    '<p>Total Rent Payments: ' + formatCurrency(totalRent) + '</p>' +
    '<p>Down Payment Invested: ' + formatCurrency(down) + '</p>' +
    '<p>Investment Growth: ' + formatCurrency(investmentGrowth) + '</p>' +
    '<p>Net Cost of Renting: ' + formatCurrency(netRent) + '</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Mortgage Payment Formula</h4>' +
    '<p>Monthly Payment = P &times; [r(1+r)^n] / [(1+r)^n - 1]</p>' +
    '<p>Where P = Principal, r = Monthly Rate, n = Total Payments</p>' +
    '<p>Principal: ' + formatCurrency(price - down) + '</p>' +
    '<p>Monthly Rate: ' + (rateBuy / 12).toFixed(4) + '%</p>' +
    '<p>Total Payments: ' + (termBuy * 12) + '</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Investment Growth Formula</h4>' +
    '<p>Future Value = Present Value &times; (1 + Annual Rate)^Years</p>' +
    '<p>Initial Investment: ' + formatCurrency(down) + '</p>' +
    '<p>Annual Return: ' + investReturnVal + '%</p>' +
    '<p>Time Period: ' + period + ' years</p>' +
    '<p>Final Value: ' + formatCurrency(down + investmentGrowth) + '</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Final Comparison</h4>' +
    '<p>Net Cost of Buying: ' + formatCurrency(netOwn) + '</p>' +
    '<p>Net Cost of Renting: ' + formatCurrency(netRent) + '</p>' +
    '<p>Difference: ' + formatCurrency(diff) + '</p>' +
    '<p>' + (diff > 0 ? 'Renting costs more' : 'Buying costs more') + ' by ' + formatCurrency(Math.abs(diff)) + '</p>' +
    '</div>';
}

document.addEventListener('DOMContentLoaded', function () {
  var inputIds = ['purchasePrice', 'downPercent', 'rateBuy', 'termBuy',
                  'taxRate', 'insurance', 'maintenance', 'appreciation',
                  'rent', 'rentIncrease', 'period', 'investmentReturn'];
  inputIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', calcBuyRent);
      el.addEventListener('change', calcBuyRent);
    }
  });

  var toggleBtn = document.querySelector('.toggle-button');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleCalculations);

  calcBuyRent();
});
