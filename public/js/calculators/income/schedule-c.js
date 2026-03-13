'use strict';

/* =====================================================
   Schedule C Sole Proprietorship Income Calculator
   — AI upload via shared IncomeUpload module
   — Field sync, dual-business calculation
   ===================================================== */

var fmt = MSFG.formatCurrency;
var pn  = MSFG.parseNumById;

// Track which Business slot the AI data should fill
// Default: Business 1
var aiTargetBusiness = 'b1';

// =====================================================
// FIELD MAPPING — AI → Form Fields
// =====================================================

/** AI fields map into Business 1 (b1_) by default. */
var AI_FIELD_MAP = {
  netProfit:            '_np',
  otherIncome:          '_oth',
  depletion:            '_depl',
  depreciation:         '_depr',
  mealsEntertainment:   '_meals',
  businessUseOfHome:    '_home'
};

/** Clear only the fields that AI auto-fills (Business 1 line items) */
function clearAiFields() {
  var prefix = aiTargetBusiness;
  var fields = ['np', 'oth', 'depl', 'depr', 'meals', 'home'];
  fields.forEach(function (f) {
    var el1 = document.getElementById(prefix + '_' + f + '1');
    var el2 = document.getElementById(prefix + '_' + f + '2');
    if (el1) el1.value = '0';
    if (el2) el2.value = '0';
  });
}

/** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
function syncFieldsFromDocs() {
  var prefix = aiTargetBusiness;

  IncomeUpload.getDocStore().forEach(function (doc, i) {
    var ySuffix = (i === 0) ? '1' : '2'; // Year 1 = suffix 1, Year 2 = suffix 2

    Object.keys(AI_FIELD_MAP).forEach(function (aiKey) {
      var fieldSuffix = AI_FIELD_MAP[aiKey];
      var fieldId = prefix + fieldSuffix + ySuffix;
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
// CARD BODY BUILDER
// =====================================================

function buildCardBody(doc, i) {
  var yearLabel  = doc.taxYear || '?';
  var nameLabel  = doc.businessName || '';
  var totalLabel = (doc.netProfit != null && doc.netProfit !== 0) ? fmt(doc.netProfit) : '--';

  var html = '';
  html += '<div class="doc-card__header">';
  html += '<span class="doc-card__year">' + yearLabel + '</span>';
  if (nameLabel) html += '<span class="doc-card__name">' + IncomeUpload.escHtml(nameLabel) + '</span>';
  html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
  html += '</div>';
  html += '<div class="doc-card__amounts">';
  html += '<span>Net Profit (Line 31): ' + totalLabel + '</span>';
  html += IncomeUpload.yearBadge(i);
  html += '</div>';

  return html;
}

// =====================================================
// BUSINESS CALCULATION
// =====================================================

function computeBusiness(prefix) {
  var np1    = pn(prefix + '_np1');
  var np2    = pn(prefix + '_np2');
  var oth1   = pn(prefix + '_oth1');
  var oth2   = pn(prefix + '_oth2');
  var depl1  = pn(prefix + '_depl1');
  var depl2  = pn(prefix + '_depl2');
  var depr1  = pn(prefix + '_depr1');
  var depr2  = pn(prefix + '_depr2');
  var meals1 = pn(prefix + '_meals1');
  var meals2 = pn(prefix + '_meals2');
  var home1  = pn(prefix + '_home1');
  var home2  = pn(prefix + '_home2');
  var mile1  = pn(prefix + '_mile1');
  var mile2  = pn(prefix + '_mile2');
  var amort1 = pn(prefix + '_amort1');
  var amort2 = pn(prefix + '_amort2');

  var year1 = np1 + oth1 + depl1 + depr1 + home1 + mile1 + amort1 - meals1;
  var year2 = np2 + oth2 + depl2 + depr2 + home2 + mile2 + amort2 - meals2;

  var year2Vals = [np2, oth2, depl2, depr2, meals2, home2, mile2, amort2];
  var hasYr2 = year2Vals.some(function (v) { return v !== 0; });

  var monthly, method;
  if (hasYr2 && year1 > year2) {
    monthly = (year1 + year2) / 24;
    method = 'average';
  } else {
    monthly = year1 / 12;
    method = 'recent';
  }

  return {
    year1: year1, year2: year2,
    monthly: monthly, method: method,
    meals1: meals1, meals2: meals2
  };
}

// =====================================================
// MAIN CALCULATION
// =====================================================

function calculate() {
  var b1 = computeBusiness('b1');
  document.getElementById('b1_year1').textContent = fmt(b1.year1);
  document.getElementById('b1_year2').textContent = fmt(b1.year2);
  document.getElementById('b1_month').textContent = fmt(b1.monthly);
  document.getElementById('result_b1').textContent = fmt(b1.monthly);

  var b2 = computeBusiness('b2');
  document.getElementById('b2_year1').textContent = fmt(b2.year1);
  document.getElementById('b2_year2').textContent = fmt(b2.year2);
  document.getElementById('b2_month').textContent = fmt(b2.monthly);
  document.getElementById('result_b2').textContent = fmt(b2.monthly);

  var combined = b1.monthly + b2.monthly;
  document.getElementById('combined_c').textContent = fmt(combined);

  updateMathSteps({ b1: b1, b2: b2, combined: combined });
}

// =====================================================
// MATH STEPS
// =====================================================

function updateMathSteps(data) {
  var stepsEl = document.getElementById('calcSteps-income-schedule-c');
  if (!stepsEl) return;

  var b1 = data.b1;
  var b2 = data.b2;
  var combined = data.combined;

  var html = '';
  html += '<div class="math-steps">';

  // Formula reference
  html += '<div class="math-step">';
  html += '<h4>Schedule C Income Formula</h4>';
  html += '<div class="math-formula">';
  html += '<span class="math-note">For each business:</span>';
  html += '<div class="math-values">';
  html += 'Annual = Net Profit + Other Income + Depletion + Depreciation<br>';
  html += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; + Business Use of Home + Mileage Depr + Amortization<br>';
  html += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; &minus; Meals &amp; Entertainment<br><br>';
  html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
  html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
  html += 'ELSE:<br>';
  html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
  html += '</div></div></div>';

  // Business 1
  html += buildBizMathStep('Business 1', b1);

  // Business 2 (only if has values)
  var b2HasData = b2.year1 !== 0 || b2.year2 !== 0;
  if (b2HasData) {
    html += buildBizMathStep('Business 2', b2);
  }

  // Combined total
  html += '<div class="math-step highlight">';
  html += '<h4>Total Monthly Income</h4>';
  html += '<div class="math-formula">';
  html += 'Business 1: ' + fmt(b1.monthly) + '<br>';
  if (b2HasData) {
    html += '+ Business 2: ' + fmt(b2.monthly) + '<br>';
  }
  html += '<div class="math-values"><strong>Total Monthly: ' + fmt(combined) + '</strong></div>';
  html += '</div></div>';

  html += '</div>'; // close .math-steps
  stepsEl.innerHTML = html;
}

function buildBizMathStep(label, d) {
  var methodLabel = d.method === 'average'
    ? '24-month average (Year 1 > Year 2)'
    : 'Year 1 / 12';

  var sub1 = d.year1 + d.meals1; // subtotal before meals subtraction
  var sub2 = d.year2 + d.meals2;

  var html = '';
  html += '<div class="math-step">';
  html += '<h4>' + label + ' Calculation</h4>';
  html += '<div class="math-formula">';
  html += 'Subtotal Year 1: ' + fmt(sub1) + '<br>';
  html += 'Subtotal Year 2: ' + fmt(sub2) + '<br>';
  html += 'Less Meals: ' + fmt(d.meals1) + ' / ' + fmt(d.meals2) + '<br>';
  html += '<div class="math-values">';
  html += 'Year 1 = ' + fmt(sub1) + ' &minus; ' + fmt(d.meals1) + ' = ' + fmt(d.year1) + '<br>';
  html += 'Year 2 = ' + fmt(sub2) + ' &minus; ' + fmt(d.meals2) + ' = ' + fmt(d.year2) + '<br>';
  html += 'Method: ' + methodLabel + '<br>';
  html += '<strong>Monthly: ' + fmt(d.monthly) + '</strong>';
  html += '</div></div></div>';
  return html;
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {
  var b1 = computeBusiness('b1');
  var b2 = computeBusiness('b2');
  var combined = b1.monthly + b2.monthly;

  var rows = [
    ['Schedule C Sole Proprietorship Income Calculator'],
    [''],
    ['Business', 'Year 1 Income', 'Year 2 Income', 'Monthly Income'],
    ['Business 1', b1.year1, b1.year2, b1.monthly],
    ['Business 2', b2.year1, b2.year2, b2.monthly],
    [''],
    ['Total Monthly Income', '', '', combined],
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
  a.download = 'schedule-c-income-' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// =====================================================
// CLEAR ALL
// =====================================================

function clearAll() {
  // Reset document store
  IncomeUpload.setDocStore([]);
  IncomeUpload.renderDocCards();

  // Reset all number inputs to 0
  var inputs = document.querySelectorAll('input[type="number"]');
  inputs.forEach(function (input) {
    input.value = '0';
  });

  // Reset upload zone
  IncomeUpload.resetZone();

  calculate();
}

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function () {
  IncomeUpload.init({
    slug:          'income-schedule-c',
    label:         'Schedule C',
    maxDocs:       2,
    buildCardBody: buildCardBody,
    onAfterSync:   function () {
      clearAiFields();
      syncFieldsFromDocs();
      calculate();
    },
    onRemove: function () {
      clearAiFields();
      if (IncomeUpload.getDocStore().length > 0) syncFieldsFromDocs();
      calculate();
    }
  });
  MSFG.markDefaults('.calc-page');
  MSFG.bindDefaultClearing('.calc-page');
  calculate();
});
