'use strict';

/* =====================================================
   1120S K-1 Income Calculator
   — AI upload (via IncomeUpload), field sync, 4 K-1 entity calculation
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

/** AI fields map into K-1 slot (k{aiTargetK1}_) by default. */
var AI_FIELD_MAP = {
  ordinaryIncome:     '_ord',
  rentalRealEstate:   '_rent',
  otherRentalIncome:  '_other'
};

/** Clear only the fields that AI auto-fills for the target K-1 */
function clearAiFields() {
  var prefix = 'k' + aiTargetK1;
  var fields = ['ord', 'rent', 'other'];
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
// K-1 ENTITY CALCULATION
// =====================================================

function computeK1(num) {
  var p = 'k' + num;

  var ord1   = pn(p + '_ord1');
  var ord2   = pn(p + '_ord2');
  var rent1  = pn(p + '_rent1');
  var rent2  = pn(p + '_rent2');
  var other1 = pn(p + '_other1');
  var other2 = pn(p + '_other2');

  var year1 = ord1 + rent1 + other1;
  var year2 = ord2 + rent2 + other2;

  var year2Vals = [ord2, rent2, other2];
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
    other1: other1, other2: other2
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

    document.getElementById('k' + i + '_yr1').textContent = fmt(k.year1);
    document.getElementById('k' + i + '_yr2').textContent = fmt(k.year2);
    document.getElementById('k' + i + '_month').textContent = fmt(k.monthly);
    document.getElementById('resultK' + i).textContent = fmt(k.monthly);

    combined += k.monthly;
  }

  document.getElementById('combinedK1').textContent = fmt(combined);

  updateMathSteps(results, combined);
}

// =====================================================
// MATH STEPS
// =====================================================

function updateMathSteps(results, combined) {
  var stepsEl = document.getElementById('calcSteps-income-1120s-k1');
  if (!stepsEl) return;

  var html = '';
  html += '<div class="math-steps">';

  // Formula reference
  html += '<div class="math-step">';
  html += '<h4>1120S K-1 Income Formula</h4>';
  html += '<div class="math-formula">';
  html += '<span class="math-note">For each K-1 entity:</span>';
  html += '<div class="math-values">';
  html += 'Annual = Ordinary Income + Rental RE Income + Other Rental Income<br><br>';
  html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
  html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
  html += 'ELSE:<br>';
  html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
  html += '</div></div></div>';

  // Per-entity steps
  for (var i = 0; i < K1_COUNT; i++) {
    var d = results[i];
    var hasData = d.year1 !== 0 || d.year2 !== 0;
    if (hasData) {
      html += buildK1MathStep(i + 1, d);
    }
  }

  // Combined total
  html += '<div class="math-step highlight">';
  html += '<h4>Total Monthly K-1 Income</h4>';
  html += '<div class="math-formula">';
  for (var j = 0; j < K1_COUNT; j++) {
    var r = results[j];
    var hasVal = r.year1 !== 0 || r.year2 !== 0;
    if (hasVal) {
      html += (j > 0 ? '+ ' : '') + 'K-1 #' + (j + 1) + ': ' + fmt(r.monthly) + '<br>';
    }
  }
  html += '<div class="math-values"><strong>Total Monthly: ' + fmt(combined) + '</strong></div>';
  html += '</div></div>';

  html += '</div>'; // close .math-steps
  stepsEl.innerHTML = html;
}

function buildK1MathStep(num, d) {
  var methodLabel = d.method === 'average'
    ? '24-month average (Year 1 > Year 2)'
    : 'Year 1 / 12';

  var html = '';
  html += '<div class="math-step">';
  html += '<h4>K-1 #' + num + ' Calculation</h4>';
  html += '<div class="math-formula">';
  html += 'Ordinary Income: ' + fmt(d.ord1) + ' / ' + fmt(d.ord2) + '<br>';
  html += 'Rental RE Income: ' + fmt(d.rent1) + ' / ' + fmt(d.rent2) + '<br>';
  html += 'Other Rental: ' + fmt(d.other1) + ' / ' + fmt(d.other2) + '<br>';
  html += '<div class="math-values">';
  html += 'Year 1 = ' + fmt(d.ord1) + ' + ' + fmt(d.rent1) + ' + ' + fmt(d.other1) + ' = ' + fmt(d.year1) + '<br>';
  html += 'Year 2 = ' + fmt(d.ord2) + ' + ' + fmt(d.rent2) + ' + ' + fmt(d.other2) + ' = ' + fmt(d.year2) + '<br>';
  html += 'Method: ' + methodLabel + '<br>';
  html += '<strong>Monthly: ' + fmt(d.monthly) + '</strong>';
  html += '</div></div></div>';
  return html;
}

// =====================================================
// DOCUMENT CARD BODY (for IncomeUpload)
// =====================================================

function buildCardBody(doc, i) {
  var yearLabel  = doc.taxYear || '?';
  var nameLabel  = doc.corporationName || doc.entityName || '';
  var einLabel   = doc.ein || '';

  var html = '';
  html += '<div class="doc-card__header">';
  html += '<span class="doc-card__year">' + yearLabel + '</span>';
  if (nameLabel) html += '<span class="doc-card__name">' + IncomeUpload.escHtml(nameLabel) + '</span>';
  if (einLabel) html += '<span class="doc-card__filing">EIN: ' + IncomeUpload.escHtml(einLabel) + '</span>';
  html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
  html += '</div>';
  html += '<div class="doc-card__amounts">';
  html += IncomeUpload.yearBadge(i);
  html += '</div>';

  return html;
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {
  var rows = [
    ['1120S K-1 Income Calculator'],
    [''],
    ['K-1 Entity', 'Year 1 Income', 'Year 2 Income', 'Monthly Income']
  ];

  var combined = 0;
  for (var i = 1; i <= K1_COUNT; i++) {
    var k = computeK1(i);
    rows.push(['K-1 #' + i, k.year1, k.year2, k.monthly]);
    combined += k.monthly;
  }

  rows.push(['']);
  rows.push(['Total Monthly K-1 Income', '', '', combined]);
  rows.push(['']);
  rows.push(['Generated', new Date().toLocaleString()]);

  var csv = rows.map(function (row) {
    return row.map(function (cell) { return '"' + cell + '"'; }).join(',');
  }).join('\n');

  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '1120s-k1-income-' + Date.now() + '.csv';
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
    slug:          'income-1120s-k1',
    label:         '1120S K-1',
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
