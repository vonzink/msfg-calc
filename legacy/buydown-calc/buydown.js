'use strict';

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function parseNum(id) {
  var val = parseFloat(document.getElementById(id).value);
  return isNaN(val) ? 0 : val;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatCurrencyDecimal(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatPercent(rate) {
  return rate.toFixed(3) + '%';
}

// =====================================================
// MORTGAGE CALCULATIONS
// =====================================================

function calculateMonthlyPayment(principal, annualRatePercent, years) {
  if (principal <= 0 || years <= 0) return 0;
  if (annualRatePercent <= 0) return principal / (years * 12);

  var monthlyRate = annualRatePercent / 100 / 12;
  var numberOfPayments = years * 12;

  return principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
         (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
}

// =====================================================
// BUYDOWN CALCULATIONS
// =====================================================

function getBuydownRates(buydownType, noteRate) {
  switch (buydownType) {
    case '3-2-1':
      return {
        year1: Math.max(0, noteRate - 3),
        year2: Math.max(0, noteRate - 2),
        year3: Math.max(0, noteRate - 1),
        fullRate: noteRate,
        years: 3
      };
    case '2-1':
      return {
        year1: Math.max(0, noteRate - 2),
        year2: Math.max(0, noteRate - 1),
        year3: noteRate,
        fullRate: noteRate,
        years: 2
      };
    case '1-1':
      return {
        year1: Math.max(0, noteRate - 1),
        year2: Math.max(0, noteRate - 1),
        year3: noteRate,
        fullRate: noteRate,
        years: 2
      };
    case '1-0':
      return {
        year1: Math.max(0, noteRate - 1),
        year2: noteRate,
        year3: noteRate,
        fullRate: noteRate,
        years: 1
      };
    default:
      return {
        year1: noteRate,
        year2: noteRate,
        year3: noteRate,
        fullRate: noteRate,
        years: 0
      };
  }
}

function calculateBuydownResults(state) {
  var rates = getBuydownRates(state.buydownType, state.noteRate);
  var fullPayment = calculateMonthlyPayment(state.loanAmount, rates.fullRate, state.loanTerm);

  var years = [];
  var totalCost = 0;

  for (var i = 1; i <= 3; i++) {
    var rate = rates['year' + i];
    var piPayment = calculateMonthlyPayment(state.loanAmount, rate, state.loanTerm);
    var monthlySavings = fullPayment - piPayment;
    var yearlySavings = monthlySavings * 12;

    var totalPayment = piPayment;
    if (state.includeTaxes) totalPayment += state.propertyTaxes / 12;
    if (state.includeInsurance) totalPayment += state.insurance / 12;
    totalPayment += state.hoa;

    if (rate < rates.fullRate) {
      totalCost += yearlySavings;
    }

    years.push({
      year: i,
      rate: rate,
      piPayment: piPayment,
      totalPayment: totalPayment,
      monthlySavings: monthlySavings,
      yearlySavings: yearlySavings,
      isReduced: rate < rates.fullRate
    });
  }

  var fullTotalPayment = fullPayment;
  if (state.includeTaxes) fullTotalPayment += state.propertyTaxes / 12;
  if (state.includeInsurance) fullTotalPayment += state.insurance / 12;
  fullTotalPayment += state.hoa;

  years.push({
    year: 4,
    rate: rates.fullRate,
    piPayment: fullPayment,
    totalPayment: fullTotalPayment,
    monthlySavings: 0,
    yearlySavings: 0,
    isReduced: false
  });

  return {
    rates: rates,
    years: years,
    fullPayment: fullPayment,
    fullTotalPayment: fullTotalPayment,
    totalCost: totalCost
  };
}

// =====================================================
// STATE MANAGEMENT
// =====================================================

function getCurrentState() {
  return {
    loanAmount: parseNum('loanAmount'),
    noteRate: parseNum('noteRate'),
    loanTerm: parseInt(document.getElementById('loanTerm').value),
    buydownType: document.getElementById('buydownType').value,
    includeTaxes: document.getElementById('includeTaxes').classList.contains('active'),
    includeInsurance: document.getElementById('includeInsurance').classList.contains('active'),
    propertyTaxes: parseNum('propertyTaxes'),
    insurance: parseNum('insurance'),
    hoa: parseNum('hoa')
  };
}

function toggleOption(id) {
  var el = document.getElementById(id);
  el.classList.toggle('active');

  var taxInputs = document.getElementById('taxInsuranceInputs');
  var showInputs = document.getElementById('includeTaxes').classList.contains('active') ||
                    document.getElementById('includeInsurance').classList.contains('active');
  taxInputs.style.display = showInputs ? 'block' : 'none';

  calculate();
}

// =====================================================
// VALIDATION
// =====================================================

function validateAndWarn(state) {
  var warningBox = document.getElementById('warningBox');

  var minRate = state.buydownType === '3-2-1' ? 3 :
               state.buydownType === '2-1' ? 2 : 1;

  if (state.noteRate < minRate && state.noteRate > 0) {
    warningBox.innerHTML = '\u26a0\ufe0f <strong>Warning:</strong> Note rate (' + formatPercent(state.noteRate) + ') is lower than the ' + state.buydownType + ' buydown reduction. Year 1 rate will be floored at 0%.';
    warningBox.className = 'warning-box';
    warningBox.style.display = 'block';
    return true;
  }

  if (state.loanAmount <= 0 || state.noteRate <= 0) {
    warningBox.style.display = 'none';
    return false;
  }

  warningBox.style.display = 'none';
  return true;
}

// =====================================================
// MAIN CALCULATION & RENDER
// =====================================================

var currentChart = null;

function calculate() {
  var state = getCurrentState();

  if (state.loanAmount <= 0 || state.noteRate <= 0) {
    return;
  }

  validateAndWarn(state);

  var results = calculateBuydownResults(state);

  document.getElementById('chipLoan').textContent = 'Loan: ' + formatCurrency(state.loanAmount);
  document.getElementById('chipRate').textContent = 'Note Rate: ' + formatPercent(state.noteRate);
  document.getElementById('chipType').textContent = state.buydownType + ' Buydown';
  document.getElementById('chipCost').textContent = 'Buydown Cost: ' + formatCurrency(results.totalCost);

  document.getElementById('basePayment').textContent = formatCurrencyDecimal(results.fullTotalPayment);
  document.getElementById('year1Payment').textContent = formatCurrencyDecimal(results.years[0].totalPayment);
  document.getElementById('year1Savings').textContent = formatCurrency(results.years[0].monthlySavings) + '/mo';
  document.getElementById('totalCost').textContent = formatCurrency(results.totalCost);

  renderYearlyBreakdown(results, state);

  updateMathSteps(state, results);

  if (currentChart && document.getElementById('chartContainer').style.display === 'block') {
    var chartTitle = currentChart.options.plugins.title.text;
    if (chartTitle === 'Buydown Credit Remaining') {
      showRemainingChart();
    } else {
      showPaymentChart();
    }
  }

  updateURL(state);
}

function renderYearlyBreakdown(results, state) {
  var container = document.getElementById('yearlyBreakdown');
  container.innerHTML = '';

  var yearsToShow = [];
  if (state.buydownType === '3-2-1') {
    yearsToShow = [0, 1, 2, 3];
  } else if (state.buydownType === '2-1') {
    yearsToShow = [0, 1, 3];
  } else if (state.buydownType === '1-1') {
    yearsToShow = [0, 1, 3];
  } else {
    yearsToShow = [0, 3];
  }

  yearsToShow.forEach(function (index) {
    var year = results.years[index];
    var isFullRate = !year.isReduced && year.year > 1;

    var card = document.createElement('div');
    card.className = 'year-card' + (isFullRate ? ' full-rate' : '');

    var fullRateStart = results.rates.years + 1;
    var yearLabel = isFullRate ? 'Full Rate (Year ' + fullRateStart + '+)' : 'Year ' + year.year;

    var gridHTML =
      '<div class="year-item">' +
      '<div class="label">P&I Payment</div>' +
      '<div class="value">' + formatCurrencyDecimal(year.piPayment) + '</div>' +
      '</div>';

    if (state.includeTaxes) {
      gridHTML +=
        '<div class="year-item">' +
        '<div class="label">Taxes</div>' +
        '<div class="value">' + formatCurrency(state.propertyTaxes / 12) + '</div>' +
        '</div>';
    }

    if (state.includeInsurance) {
      gridHTML +=
        '<div class="year-item">' +
        '<div class="label">Insurance</div>' +
        '<div class="value">' + formatCurrency(state.insurance / 12) + '</div>' +
        '</div>';
    }

    if (state.hoa > 0) {
      gridHTML +=
        '<div class="year-item">' +
        '<div class="label">HOA</div>' +
        '<div class="value">' + formatCurrency(state.hoa) + '</div>' +
        '</div>';
    }

    gridHTML +=
      '<div class="year-item">' +
      '<div class="label">Total Payment</div>' +
      '<div class="value">' + formatCurrencyDecimal(year.totalPayment) + '</div>' +
      '</div>';

    if (year.isReduced) {
      gridHTML +=
        '<div class="year-item">' +
        '<div class="label">Monthly Savings</div>' +
        '<div class="value savings-badge">' + formatCurrency(year.monthlySavings) + '</div>' +
        '</div>';
    }

    card.innerHTML =
      '<h4>' +
      yearLabel +
      '<span class="rate-badge">' + formatPercent(year.rate) + '</span>' +
      '</h4>' +
      '<div class="year-grid">' + gridHTML + '</div>';

    container.appendChild(card);
  });
}

// =====================================================
// MATH STEPS
// =====================================================

function updateMathSteps(state, results) {
  var step1HTML = '';
  if (state.buydownType === '3-2-1') {
    step1HTML =
      'Year 1: ' + formatPercent(state.noteRate) + ' - 3% = <strong>' + formatPercent(results.rates.year1) + '</strong><br>' +
      'Year 2: ' + formatPercent(state.noteRate) + ' - 2% = <strong>' + formatPercent(results.rates.year2) + '</strong><br>' +
      'Year 3: ' + formatPercent(state.noteRate) + ' - 1% = <strong>' + formatPercent(results.rates.year3) + '</strong><br>' +
      'Year 4+: Full rate = <strong>' + formatPercent(results.rates.fullRate) + '</strong>';
  } else if (state.buydownType === '2-1') {
    step1HTML =
      'Year 1: ' + formatPercent(state.noteRate) + ' - 2% = <strong>' + formatPercent(results.rates.year1) + '</strong><br>' +
      'Year 2: ' + formatPercent(state.noteRate) + ' - 1% = <strong>' + formatPercent(results.rates.year2) + '</strong><br>' +
      'Year 3+: Full rate = <strong>' + formatPercent(results.rates.fullRate) + '</strong>';
  } else if (state.buydownType === '1-1') {
    step1HTML =
      'Year 1: ' + formatPercent(state.noteRate) + ' - 1% = <strong>' + formatPercent(results.rates.year1) + '</strong><br>' +
      'Year 2: ' + formatPercent(state.noteRate) + ' - 1% = <strong>' + formatPercent(results.rates.year2) + '</strong><br>' +
      'Year 3+: Full rate = <strong>' + formatPercent(results.rates.fullRate) + '</strong>';
  } else {
    step1HTML =
      'Year 1: ' + formatPercent(state.noteRate) + ' - 1% = <strong>' + formatPercent(results.rates.year1) + '</strong><br>' +
      'Year 2+: Full rate = <strong>' + formatPercent(results.rates.fullRate) + '</strong>';
  }
  document.getElementById('mathStep1').innerHTML = step1HTML;

  var step2HTML =
    '<tr>' +
    '<th>Period</th>' +
    '<th>Rate</th>' +
    '<th>Monthly Payment</th>' +
    '</tr>';

  var yearsToShow = state.buydownType === '3-2-1' ? [0, 1, 2, 3] :
                   state.buydownType === '2-1' ? [0, 1, 3] :
                   state.buydownType === '1-1' ? [0, 1, 3] : [0, 3];

  yearsToShow.forEach(function (i) {
    var year = results.years[i];
    var label = year.year === 4 ? 'Full Rate' : 'Year ' + year.year;
    step2HTML +=
      '<tr>' +
      '<td>' + label + '</td>' +
      '<td>' + formatPercent(year.rate) + '</td>' +
      '<td>' + formatCurrencyDecimal(year.piPayment) + '</td>' +
      '</tr>';
  });
  document.getElementById('mathStep2').innerHTML = step2HTML;

  var step3HTML =
    '<tr>' +
    '<th>Year</th>' +
    '<th>Full Payment</th>' +
    '<th>Reduced Payment</th>' +
    '<th>Monthly Savings</th>' +
    '<th>Annual Savings</th>' +
    '</tr>';

  results.years.slice(0, 3).forEach(function (year) {
    if (year.isReduced) {
      step3HTML +=
        '<tr>' +
        '<td>Year ' + year.year + '</td>' +
        '<td>' + formatCurrencyDecimal(results.fullPayment) + '</td>' +
        '<td>' + formatCurrencyDecimal(year.piPayment) + '</td>' +
        '<td>' + formatCurrencyDecimal(year.monthlySavings) + '</td>' +
        '<td>' + formatCurrency(year.yearlySavings) + '</td>' +
        '</tr>';
    }
  });
  document.getElementById('mathStep3').innerHTML = step3HTML;

  var costBreakdown = '';
  var runningTotal = 0;
  results.years.slice(0, 3).forEach(function (year) {
    if (year.isReduced) {
      costBreakdown += 'Year ' + year.year + ': ' + formatCurrency(year.yearlySavings) + '<br>';
      runningTotal += year.yearlySavings;
    }
  });
  costBreakdown += '<br><strong>Total Buydown Cost: ' + formatCurrency(results.totalCost) + '</strong>';
  document.getElementById('mathStep4').innerHTML = costBreakdown;
}

function toggleMath() {
  var section = document.getElementById('mathSection');
  var toggle = document.getElementById('mathToggle');

  if (section.classList.contains('open')) {
    section.classList.remove('open');
    toggle.textContent = 'Show Math';
  } else {
    section.classList.add('open');
    toggle.textContent = 'Hide Math';
  }
}

// =====================================================
// CHARTS
// =====================================================

function showPaymentChart() {
  var state = getCurrentState();
  var results = calculateBuydownResults(state);

  var ctx = document.getElementById('buydownChart').getContext('2d');

  if (currentChart) currentChart.destroy();

  var labels = [];
  var payments = [];
  var colors = [];

  var yearsToShow = state.buydownType === '3-2-1' ? [0, 1, 2, 3] :
                   state.buydownType === '2-1' ? [0, 1, 3] :
                   state.buydownType === '1-1' ? [0, 1, 3] : [0, 3];

  yearsToShow.forEach(function (i) {
    var year = results.years[i];
    labels.push(year.year === 4 ? 'Full Rate' : 'Year ' + year.year);
    payments.push(year.totalPayment);
    colors.push(year.isReduced ? 'rgba(45, 106, 79, 0.8)' : 'rgba(64, 145, 108, 0.8)');
  });

  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Monthly Payment',
        data: payments,
        backgroundColor: colors,
        borderColor: colors.map(function (c) { return c.replace('0.8', '1'); }),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Monthly Payment by Year',
          font: { size: 16 }
        },
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function (value) { return '$' + value.toLocaleString(); }
          }
        }
      }
    }
  });

  document.getElementById('chartContainer').style.display = 'block';
}

function showRemainingChart() {
  var state = getCurrentState();
  var results = calculateBuydownResults(state);

  var ctx = document.getElementById('buydownChart').getContext('2d');

  if (currentChart) currentChart.destroy();

  var labels = [];
  var remaining = [];
  var totalMonths = state.buydownType === '3-2-1' ? 36 :
                   (state.buydownType === '2-1' || state.buydownType === '1-1') ? 24 : 12;

  for (var month = 0; month <= totalMonths; month++) {
    labels.push(month === 0 ? 'Start' : 'Mo ' + month);

    var used = 0;
    if (month <= 12) {
      used = results.years[0].monthlySavings * month;
    } else if (month <= 24) {
      used = results.years[0].yearlySavings + results.years[1].monthlySavings * (month - 12);
    } else {
      used = results.years[0].yearlySavings + results.years[1].yearlySavings +
             results.years[2].monthlySavings * (month - 24);
    }

    remaining.push(Math.max(0, results.totalCost - used));
  }

  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Buydown Remaining',
        data: remaining,
        borderColor: 'rgba(45, 106, 79, 1)',
        backgroundColor: 'rgba(45, 106, 79, 0.2)',
        borderWidth: 3,
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Buydown Credit Remaining',
          font: { size: 16 }
        },
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) { return '$' + value.toLocaleString(); }
          }
        },
        x: {
          ticks: {
            maxTicksLimit: 12
          }
        }
      }
    }
  });

  document.getElementById('chartContainer').style.display = 'block';
}

// =====================================================
// URL STATE & EXPORT
// =====================================================

function serializeState(state) {
  return new URLSearchParams({
    la: state.loanAmount,
    nr: state.noteRate,
    lt: state.loanTerm,
    bt: state.buydownType,
    it: state.includeTaxes ? '1' : '0',
    ii: state.includeInsurance ? '1' : '0',
    pt: state.propertyTaxes,
    ins: state.insurance,
    hoa: state.hoa
  }).toString();
}

function deserializeState(params) {
  return {
    loanAmount: parseFloat(params.get('la')) || 400000,
    noteRate: parseFloat(params.get('nr')) || 7,
    loanTerm: parseInt(params.get('lt')) || 30,
    buydownType: params.get('bt') || '3-2-1',
    includeTaxes: params.get('it') === '1',
    includeInsurance: params.get('ii') === '1',
    propertyTaxes: parseFloat(params.get('pt')) || 0,
    insurance: parseFloat(params.get('ins')) || 0,
    hoa: parseFloat(params.get('hoa')) || 0
  };
}

function updateURL(state) {
  var url = new URL(window.location);
  url.search = serializeState(state);
  window.history.replaceState({}, '', url);
}

function loadFromURL() {
  var params = new URLSearchParams(window.location.search);
  if (params.toString()) {
    var state = deserializeState(params);

    document.getElementById('loanAmount').value = state.loanAmount;
    document.getElementById('noteRate').value = state.noteRate;
    document.getElementById('loanTerm').value = state.loanTerm;
    document.getElementById('buydownType').value = state.buydownType;

    if (state.includeTaxes) document.getElementById('includeTaxes').classList.add('active');
    if (state.includeInsurance) document.getElementById('includeInsurance').classList.add('active');

    document.getElementById('propertyTaxes').value = state.propertyTaxes;
    document.getElementById('insurance').value = state.insurance;
    document.getElementById('hoa').value = state.hoa;

    if (state.includeTaxes || state.includeInsurance) {
      document.getElementById('taxInsuranceInputs').style.display = 'block';
    }
  }
}

function exportCSV() {
  var state = getCurrentState();
  var results = calculateBuydownResults(state);

  var lines = [
    ['Buydown Calculator Results', ''],
    ['', ''],
    ['Loan Information', ''],
    ['Loan Amount', formatCurrency(state.loanAmount)],
    ['Note Rate', formatPercent(state.noteRate)],
    ['Loan Term', state.loanTerm + ' years'],
    ['Buydown Type', state.buydownType],
    ['', ''],
    ['Year-by-Year Breakdown', '', '', ''],
    ['Year', 'Rate', 'P&I Payment', 'Total Payment']
  ];

  results.years.forEach(function (y) {
    lines.push([
      y.year === 4 ? 'Full Rate' : 'Year ' + y.year,
      formatPercent(y.rate),
      formatCurrencyDecimal(y.piPayment),
      formatCurrencyDecimal(y.totalPayment)
    ]);
  });

  lines.push(['', '']);
  lines.push(['Summary', '']);
  lines.push(['Year 1 Monthly Savings', formatCurrency(results.years[0].monthlySavings)]);
  lines.push(['Total Buydown Cost', formatCurrency(results.totalCost)]);
  lines.push(['', '']);
  lines.push(['Generated', new Date().toLocaleString()]);

  var csv = lines.map(function (row) {
    return row.map(function (cell) { return '"' + cell + '"'; }).join(',');
  }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'buydown-calculator-' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function shareLink() {
  navigator.clipboard.writeText(window.location.href).then(function () {
    alert('Link copied to clipboard!');
  });
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function wireEvents() {
  var inputs = ['loanAmount', 'noteRate', 'loanTerm', 'buydownType',
               'propertyTaxes', 'insurance', 'hoa'];
  inputs.forEach(function (id) {
    document.getElementById(id).addEventListener('input', calculate);
    document.getElementById(id).addEventListener('change', calculate);
  });
}

// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener('DOMContentLoaded', function () {
  wireEvents();
  loadFromURL();
  calculate();
});
