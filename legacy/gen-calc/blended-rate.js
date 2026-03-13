'use strict';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function parseNum(v) {
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
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

function calcDebt() {
  var totalBal = 0;
  var totalPay = 0;
  var weightedRate = 0;
  var debts = [];

  for (var i = 1; i <= 5; i++) {
    var bal = parseNum(document.getElementById('d' + i + '_bal').value);
    var rate = parseNum(document.getElementById('d' + i + '_rate').value) / 100;
    var pay = parseNum(document.getElementById('d' + i + '_pay').value);

    if (bal > 0) {
      debts.push({
        num: i,
        balance: bal,
        rate: rate,
        payment: pay,
        weightedContribution: bal * rate
      });
    }

    totalBal += bal;
    totalPay += pay;
    weightedRate += bal * rate;
  }

  var blended = totalBal > 0 ? (weightedRate / totalBal) * 100 : 0;

  document.getElementById('totalBal').textContent = formatCurrency(totalBal);
  document.getElementById('totalPay').textContent = formatCurrency(totalPay);
  document.getElementById('blendedRate').textContent = blended.toFixed(3) + '%';

  updateMathCalculations(debts, totalBal, totalPay, weightedRate, blended);
}

function updateMathCalculations(debts, totalBal, totalPay, weightedRate, blended) {
  var mathDiv = document.getElementById('mathCalculations');

  if (debts.length === 0) {
    mathDiv.innerHTML =
      '<div class="calculation-step">' +
      '<h4>No Debts Entered</h4>' +
      '<p>Enter at least one debt with a balance greater than zero to see the calculation details.</p>' +
      '</div>';
    return;
  }

  var debtBreakdown = '';
  debts.forEach(function (debt) {
    debtBreakdown +=
      '<div class="calculation-step">' +
      '<h4>Debt ' + debt.num + ' Weighted Contribution</h4>' +
      '<p>Balance: ' + formatCurrency(debt.balance) + '</p>' +
      '<p>Interest Rate: ' + (debt.rate * 100).toFixed(3) + '%</p>' +
      '<p>Monthly Payment: ' + formatCurrency(debt.payment) + '</p>' +
      '<p>Weighted Contribution = Balance &times; Rate</p>' +
      '<p>Weighted Contribution = ' + formatCurrency(debt.balance) + ' &times; ' + (debt.rate * 100).toFixed(3) + '%</p>' +
      '<p>Weighted Contribution = ' + debt.weightedContribution.toFixed(2) + '</p>' +
      '</div>';
  });

  mathDiv.innerHTML =
    debtBreakdown +
    '<div class="calculation-step">' +
    '<h4>Total Weighted Rate Calculation</h4>' +
    '<p>Sum of all weighted contributions: ' + weightedRate.toFixed(2) + '</p>' +
    '<p>Total Balance: ' + formatCurrency(totalBal) + '</p>' +
    '<p>Total Monthly Payments: ' + formatCurrency(totalPay) + '</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>Blended Interest Rate Formula</h4>' +
    '<p>Blended Rate = (Sum of Weighted Contributions &divide; Total Balance) &times; 100</p>' +
    '<p>Blended Rate = (' + weightedRate.toFixed(2) + ' &divide; ' + totalBal.toFixed(2) + ') &times; 100</p>' +
    '<p>Blended Rate = ' + blended.toFixed(3) + '%</p>' +
    '</div>' +
    '<div class="calculation-step">' +
    '<h4>What This Means</h4>' +
    '<p>Your effective interest rate across all debts is <strong>' + blended.toFixed(3) + '%</strong>.</p>' +
    '<p>If you consolidate these debts into a single loan with an interest rate lower than ' + blended.toFixed(3) + '%, you will save money on interest charges.</p>' +
    '<p>Consider focusing extra payments on your highest-rate debts first to reduce your overall interest costs faster.</p>' +
    '</div>';
}

document.addEventListener('DOMContentLoaded', function () {
  var inputIds = [
    'd1_bal', 'd1_rate', 'd1_pay',
    'd2_bal', 'd2_rate', 'd2_pay',
    'd3_bal', 'd3_rate', 'd3_pay',
    'd4_bal', 'd4_rate', 'd4_pay',
    'd5_bal', 'd5_rate', 'd5_pay'
  ];

  inputIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', calcDebt);
      el.addEventListener('change', calcDebt);
    }
  });

  var toggleBtn = document.querySelector('.toggle-button');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleCalculations);

  calcDebt();
});
