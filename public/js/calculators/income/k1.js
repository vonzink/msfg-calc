'use strict';

/* =====================================================
   Schedule K-1 (1065) Partnership Income Calculator
   — AI upload (via IncomeUpload), field sync, 4-entity K-1 calculation
   ===================================================== */

var fmt = MSFG.formatCurrency;
var pn  = MSFG.parseNumById;

var K1_COUNT = 4;

// Track which K-1 slot the AI data should fill
// Default: K-1 #1
var aiTargetK1 = 1;

// =====================================================
// FIELD MAPPING — AI → Form Fields
// =====================================================

/** AI fields map into K-1 #1 (k1_) by default. */
var AI_FIELD_MAP = {
  ordinaryIncome:      '_ord',
  rentalRealEstate:    '_rent',
  otherRentalIncome:   '_other',
  guaranteedPayments:  '_guar'
};

/** Clear only the fields that AI auto-fills (K-1 target line items) */
function clearAiFields() {
  var prefix = 'k' + aiTargetK1;
  var fields = ['ord', 'rent', 'other', 'guar'];
  fields.forEach(function (f) {
    var el1 = document.getElementById(prefix + '_' + f + '1');
    var el2 = document.getElementById(prefix + '_' + f + '2');
    if (el1) el1.value = '0';
    if (el2) el2.value = '0';
  });
}

/** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
function syncFieldsFromDocs() {
  var prefix = 'k' + aiTargetK1;

  IncomeUpload.getDocStore().forEach(function (doc, i) {
    var ySuffix = (i === 0) ? '1' : '2'; // Year 1 = suffix 1, Year 2 = suffix 2

    Object.keys(AI_FIELD_MAP).forEach(function (aiKey) {
      var fieldBase = AI_FIELD_MAP[aiKey];
      var fieldId = prefix + fieldBase + ySuffix;
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
// K-1 CALCULATION
// =====================================================

function computeK1(num) {
  var prefix = 'k' + num;

  var ord1   = pn(prefix + '_ord1');
  var ord2   = pn(prefix + '_ord2');
  var rent1  = pn(prefix + '_rent1');
  var rent2  = pn(prefix + '_rent2');
  var other1 = pn(prefix + '_other1');
  var other2 = pn(prefix + '_other2');
  var guar1  = pn(prefix + '_guar1');
  var guar2  = pn(prefix + '_guar2');

  var year1 = ord1 + rent1 + other1 + guar1;
  var year2 = ord2 + rent2 + other2 + guar2;

  var year2Vals = [ord2, rent2, other2, guar2];
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
    ord1: ord1, ord2: ord2,
    rent1: rent1, rent2: rent2,
    other1: other1, other2: other2,
    guar1: guar1, guar2: guar2
  };
}

// =====================================================
// MAIN CALCULATION
// =====================================================

function calculate() {
  var results = [];
  var combined = 0;

  for (var i = 1; i <= K1_COUNT; i++) {
    var k = computeK1(i);
    results.push(k);

    document.getElementById('k' + i + '_yr1').textContent  = fmt(k.year1);
    document.getElementById('k' + i + '_yr2').textContent  = fmt(k.year2);
    document.getElementById('k' + i + '_month').textContent = fmt(k.monthly);
    document.getElementById('resultK' + i).textContent      = fmt(k.monthly);

    combined += k.monthly;
  }

  document.getElementById('combinedK1').textContent = fmt(combined);

  updateMathSteps(results, combined);
}

// =====================================================
// MATH STEPS
// =====================================================

function updateMathSteps(results, combined) {
  var stepsEl = document.getElementById('calcSteps-income-k1');
  if (!stepsEl) return;

  var html = '';
  html += '<div class="math-steps">';

  // Formula reference
  html += '<div class="math-step">';
  html += '<h4>Partnership K-1 Income Formula</h4>';
  html += '<div class="math-formula">';
  html += '<span class="math-note">For each K-1:</span>';
  html += '<div class="math-values">';
  html += 'Annual = Ordinary Income + Rental Real Estate + Other Rental + Guaranteed Payments<br><br>';
  html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
  html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
  html += 'ELSE:<br>';
  html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
  html += '</div></div></div>';

  // Individual K-1 steps
  for (var i = 0; i < results.length; i++) {
    var k = results[i];
    var hasData = k.year1 !== 0 || k.year2 !== 0;
    if (i === 0 || hasData) {
      html += buildK1MathStep('K-1 #' + (i + 1), k);
    }
  }

  // Combined total
  html += '<div class="math-step highlight">';
  html += '<h4>Total Monthly Income</h4>';
  html += '<div class="math-formula">';
  for (var j = 0; j < results.length; j++) {
    var kj = results[j];
    var hasDataJ = kj.year1 !== 0 || kj.year2 !== 0;
    if (j === 0 || hasDataJ) {
      html += (j > 0 ? '+ ' : '') + 'K-1 #' + (j + 1) + ': ' + fmt(kj.monthly) + '<br>';
    }
  }
  html += '<div class="math-values"><strong>Total Monthly: ' + fmt(combined) + '</strong></div>';
  html += '</div></div>';

  html += '</div>'; // close .math-steps
  stepsEl.innerHTML = html;
}

function buildK1MathStep(label, k) {
  var methodLabel = k.method === 'average'
    ? '24-month average (Year 1 > Year 2)'
    : 'Year 1 / 12';

  var html = '';
  html += '<div class="math-step">';
  html += '<h4>' + label + ' Calculation</h4>';
  html += '<div class="math-formula">';
  html += 'Ordinary Income: ' + fmt(k.ord1) + ' / ' + fmt(k.ord2) + '<br>';
  html += 'Rental Real Estate: ' + fmt(k.rent1) + ' / ' + fmt(k.rent2) + '<br>';
  html += 'Other Rental: ' + fmt(k.other1) + ' / ' + fmt(k.other2) + '<br>';
  html += 'Guaranteed Payments: ' + fmt(k.guar1) + ' / ' + fmt(k.guar2) + '<br>';
  html += '<div class="math-values">';
  html += 'Year 1 = ' + fmt(k.ord1) + ' + ' + fmt(k.rent1) + ' + ' + fmt(k.other1) + ' + ' + fmt(k.guar1) + ' = ' + fmt(k.year1) + '<br>';
  html += 'Year 2 = ' + fmt(k.ord2) + ' + ' + fmt(k.rent2) + ' + ' + fmt(k.other2) + ' + ' + fmt(k.guar2) + ' = ' + fmt(k.year2) + '<br>';
  html += 'Method: ' + methodLabel + '<br>';
  html += '<strong>Monthly: ' + fmt(k.monthly) + '</strong>';
  html += '</div></div></div>';
  return html;
}

// =====================================================
// DOCUMENT CARD BODY (for IncomeUpload)
// =====================================================

function buildCardBody(doc, i) {
  var yearLabel  = doc.taxYear || '?';
  var nameLabel  = doc.partnershipName || '';
  var einLabel   = doc.ein || '';
  var totalLabel = (doc.totalIncome != null && doc.totalIncome !== 0) ? fmt(doc.totalIncome) : '--';

  var html = '';
  html += '<div class="doc-card__header">';
  html += '<span class="doc-card__year">' + yearLabel + '</span>';
  if (nameLabel) html += '<span class="doc-card__name">' + IncomeUpload.escHtml(nameLabel) + '</span>';
  if (einLabel) html += '<span class="doc-card__filing">EIN: ' + IncomeUpload.escHtml(einLabel) + '</span>';
  html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
  html += '</div>';
  html += '<div class="doc-card__amounts">';
  html += '<span>Total K-1 Income: ' + totalLabel + '</span>';
  html += IncomeUpload.yearBadge(i);
  html += '</div>';

  return html;
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {
  var results = [];
  var combined = 0;

  for (var i = 1; i <= K1_COUNT; i++) {
    var k = computeK1(i);
    results.push(k);
    combined += k.monthly;
  }

  var rows = [
    ['Schedule K-1 (1065) Partnership Income Calculator'],
    [''],
    ['K-1', 'Year 1 Income', 'Year 2 Income', 'Monthly Income'],
  ];

  for (var j = 0; j < results.length; j++) {
    rows.push(['K-1 #' + (j + 1), results[j].year1, results[j].year2, results[j].monthly]);
  }

  rows.push(['']);
  rows.push(['Total Monthly Income', '', '', combined]);
  rows.push(['']);
  rows.push(['Generated', new Date().toLocaleString()]);

  var csv = rows.map(function (row) {
    return row.map(function (cell) { return '"' + cell + '"'; }).join(',');
  }).join('\n');

  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'k1-1065-income-' + Date.now() + '.csv';
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
  IncomeUpload.resetZone();

  // Reset all number inputs to 0
  var inputs = document.querySelectorAll('input[type="number"]');
  inputs.forEach(function (input) {
    input.value = '0';
  });

  // Reset owner to 100
  var ownerEl = document.getElementById('owner');
  if (ownerEl) ownerEl.value = '100';

  calculate();
}

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function () {
  IncomeUpload.init({
    slug:          'income-k1',
    label:         'K-1',
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
