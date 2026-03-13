'use strict';

/* =====================================================
   Schedule D Capital Gains/Losses Income Calculator
   — field sync, capital gains calculation
   — upload/cards handled by shared income-upload.js
   ===================================================== */

var fmt = MSFG.formatCurrency;
var pn  = MSFG.parseNumById;

// =====================================================
// FIELD MAPPING — AI → Form Fields
// =====================================================

var AI_FIELD_MAP = {
  shortTermGainLoss: 'd_stcg',
  longTermGainLoss:  'd_ltcg'
};

/** Clear only the fields that AI auto-fills */
function clearAiFields() {
  var fields = ['d_stcg', 'd_ltcg'];
  fields.forEach(function (f) {
    var el1 = document.getElementById(f + '1');
    var el2 = document.getElementById(f + '2');
    if (el1) el1.value = '0';
    if (el2) el2.value = '0';
  });
}

/** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
function syncFieldsFromDocs() {
  var docStore = IncomeUpload.getDocStore();
  docStore.forEach(function (doc, i) {
    var ySuffix = (i === 0) ? '1' : '2';

    Object.keys(AI_FIELD_MAP).forEach(function (aiKey) {
      var fieldBase = AI_FIELD_MAP[aiKey];
      var fieldId = fieldBase + ySuffix;
      setField(fieldId, doc[aiKey]);
    });
  });
}

function setField(id, value) {
  var el = document.getElementById(id);
  if (el && value != null) {
    el.value = value || 0;
  }
}

// =====================================================
// CALCULATION
// =====================================================

function calculate() {
  var stcg1 = pn('d_stcg1');
  var stcg2 = pn('d_stcg2');
  var ltcg1 = pn('d_ltcg1');
  var ltcg2 = pn('d_ltcg2');

  var total1 = stcg1 + ltcg1;
  var total2 = stcg2 + ltcg2;

  // Check if Year 2 has data
  var hasYr2 = (stcg2 !== 0 || ltcg2 !== 0);

  var monthly, method;
  if (hasYr2 && total1 > total2) {
    monthly = (total1 + total2) / 24;
    method = 'average';
  } else {
    monthly = total1 / 12;
    method = 'recent';
  }

  // Display results
  document.getElementById('d_total1').textContent = fmt(total1);
  document.getElementById('d_total2').textContent = fmt(total2);
  document.getElementById('d_monthly').textContent = fmt(monthly);

  updateMathSteps({
    stcg1: stcg1, stcg2: stcg2,
    ltcg1: ltcg1, ltcg2: ltcg2,
    total1: total1, total2: total2,
    monthly: monthly, method: method,
    hasYr2: hasYr2
  });
}

// =====================================================
// MATH STEPS
// =====================================================

function updateMathSteps(d) {
  var stepsEl = document.getElementById('calcSteps-income-schedule-d');
  if (!stepsEl) return;

  var methodLabel = d.method === 'average'
    ? '24-month average (Year 1 > Year 2)'
    : 'Year 1 / 12';

  var html = '';
  html += '<div class="math-steps">';

  // Formula reference
  html += '<div class="math-step">';
  html += '<h4>Capital Gains Income Formula</h4>';
  html += '<div class="math-formula">';
  html += '<span class="math-note">For each tax year:</span>';
  html += '<div class="math-values">';
  html += 'Total = Short-Term Gain/Loss + Long-Term Gain/Loss<br><br>';
  html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
  html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
  html += 'ELSE:<br>';
  html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
  html += '</div></div></div>';

  // Year 1
  html += '<div class="math-step">';
  html += '<h4>Year 1 (Most Recent)</h4>';
  html += '<div class="math-formula">';
  html += 'Short-Term: ' + fmt(d.stcg1) + '<br>';
  html += 'Long-Term: ' + fmt(d.ltcg1) + '<br>';
  html += '<div class="math-values">';
  html += 'Year 1 Total = ' + fmt(d.stcg1) + ' + ' + fmt(d.ltcg1) + ' = ' + fmt(d.total1);
  html += '</div></div></div>';

  // Year 2 (only if has values)
  if (d.hasYr2) {
    html += '<div class="math-step">';
    html += '<h4>Year 2 (Prior)</h4>';
    html += '<div class="math-formula">';
    html += 'Short-Term: ' + fmt(d.stcg2) + '<br>';
    html += 'Long-Term: ' + fmt(d.ltcg2) + '<br>';
    html += '<div class="math-values">';
    html += 'Year 2 Total = ' + fmt(d.stcg2) + ' + ' + fmt(d.ltcg2) + ' = ' + fmt(d.total2);
    html += '</div></div></div>';
  }

  // Monthly result
  html += '<div class="math-step highlight">';
  html += '<h4>Monthly Income</h4>';
  html += '<div class="math-formula">';
  html += 'Method: ' + methodLabel + '<br>';
  if (d.method === 'average') {
    html += '(' + fmt(d.total1) + ' + ' + fmt(d.total2) + ') / 24<br>';
  } else {
    html += fmt(d.total1) + ' / 12<br>';
  }
  html += '<div class="math-values"><strong>Monthly Income: ' + fmt(d.monthly) + '</strong></div>';
  html += '</div></div>';

  html += '</div>'; // close .math-steps
  stepsEl.innerHTML = html;
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {
  var stcg1 = pn('d_stcg1');
  var stcg2 = pn('d_stcg2');
  var ltcg1 = pn('d_ltcg1');
  var ltcg2 = pn('d_ltcg2');
  var total1 = stcg1 + ltcg1;
  var total2 = stcg2 + ltcg2;
  var hasYr2 = (stcg2 !== 0 || ltcg2 !== 0);
  var monthly = (hasYr2 && total1 > total2) ? (total1 + total2) / 24 : total1 / 12;

  var rows = [
    ['Schedule D Capital Gains/Losses Income Calculator'],
    [''],
    ['Description', 'Year 1 (Most Recent)', 'Year 2 (Prior)'],
    ['Short-Term Capital Gain/Loss', stcg1, stcg2],
    ['Long-Term Capital Gain/Loss', ltcg1, ltcg2],
    [''],
    ['Year 1 Total', total1, ''],
    ['Year 2 Total', '', total2],
    ['Monthly Income', monthly, ''],
    [''],
    ['Generated', new Date().toLocaleString()]
  ];

  var csv = rows.map(function (row) {
    return row.map(function (cell) { return '"' + cell + '"'; }).join(',');
  }).join('\n');

  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'schedule-d-income-' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// =====================================================
// CLEAR ALL
// =====================================================

function clearAll() {
  IncomeUpload.setDocStore([]);
  IncomeUpload.renderDocCards();

  // Reset all number inputs to 0
  var inputs = document.querySelectorAll('input[type="number"]');
  inputs.forEach(function (input) { input.value = '0'; });

  IncomeUpload.resetZone();
  calculate();
}

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function () {
  IncomeUpload.init({
    slug:  'income-schedule-d',
    label: 'Schedule D',
    maxDocs: 2,
    buildCardBody: function (doc, i) {
      var yearLabel = doc.taxYear || '?';
      var stcg = doc.shortTermGainLoss != null ? fmt(doc.shortTermGainLoss) : '--';
      var ltcg = doc.longTermGainLoss != null ? fmt(doc.longTermGainLoss) : '--';

      var html = '';
      html += '<div class="doc-card__header">';
      html += '<span class="doc-card__year">' + yearLabel + '</span>';
      html += '<span class="doc-card__name">Schedule D</span>';
      html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
      html += '</div>';
      html += '<div class="doc-card__amounts">';
      html += '<span>ST: ' + stcg + '</span>';
      html += '<span>LT: ' + ltcg + '</span>';
      html += IncomeUpload.yearBadge(i);
      html += '</div>';
      return html;
    },
    onAfterSync: function () {
      clearAiFields();
      syncFieldsFromDocs();
      calculate();
    },
    onRemove: function () {
      clearAiFields();
      var docStore = IncomeUpload.getDocStore();
      if (docStore.length > 0) syncFieldsFromDocs();
      calculate();
    }
  });
  MSFG.markDefaults('.calc-page');
  MSFG.bindDefaultClearing('.calc-page');
  calculate();
});
