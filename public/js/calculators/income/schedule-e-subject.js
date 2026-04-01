'use strict';

/* =====================================================
   Schedule E Subject Property Calculator
   — AI upload via shared IncomeUpload module
   — field sync, single property (no payment subtraction)
   ===================================================== */

var fmt = MSFG.formatCurrency;
var pn  = MSFG.parseNumById;

// =====================================================
// FIELD MAPPING — AI → Form Fields
// =====================================================

var AI_FIELD_MAP = {
  rentsReceived:   'rents',
  royaltiesReceived: 'roy',
  amortization:    'cas',
  totalExpenses:   'exp',
  depreciation:    'dep',
  insurance:       'ins',
  mortgageInterest: 'int',
  taxes:           'tax'
};

/** Clear only the fields that AI auto-fills */
function clearAiFields() {
  var fields = ['rents', 'roy', 'cas', 'exp', 'dep', 'ins', 'int', 'tax'];
  fields.forEach(function (f) {
    var el1 = document.getElementById('sr1_' + f);
    var el2 = document.getElementById('sr2_' + f);
    if (el1) el1.value = '0';
    if (el2) el2.value = '0';
  });
}

/** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
function syncFieldsFromDocs() {
  var docStore = IncomeUpload.getDocStore();
  docStore.forEach(function (doc, i) {
    var prefix = (i === 0) ? 'sr1_' : 'sr2_';

    Object.keys(AI_FIELD_MAP).forEach(function (aiKey) {
      var fieldBase = AI_FIELD_MAP[aiKey];
      var fieldId = prefix + fieldBase;
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

function computeYear(yr) {
  var rents = pn('sr' + yr + '_rents');
  var roy   = pn('sr' + yr + '_roy');
  var cas   = pn('sr' + yr + '_cas');
  var exp   = pn('sr' + yr + '_exp');
  var dep   = pn('sr' + yr + '_dep');
  var ins   = pn('sr' + yr + '_ins');
  var int_  = pn('sr' + yr + '_int');
  var tax   = pn('sr' + yr + '_tax');

  var total = rents + roy + cas + dep + ins + int_ + tax - exp;

  return {
    rents: rents, roy: roy, cas: cas, exp: exp,
    dep: dep, ins: ins, int: int_, tax: tax,
    total: total
  };
}

function calculate() {
  var y1 = computeYear('1');
  var y2 = computeYear('2');

  // Check if Year 2 has any data
  var yr2Vals = [y2.rents, y2.roy, y2.cas, y2.exp, y2.dep, y2.ins, y2.int, y2.tax];
  var hasYr2 = yr2Vals.some(function (v) { return v !== 0; });

  var monthly, method;
  if (hasYr2 && y1.total > y2.total) {
    monthly = (y1.total + y2.total) / 24;
    method = 'average';
  } else {
    monthly = y1.total / 12;
    method = 'recent';
  }

  document.getElementById('sr_total1').textContent = fmt(y1.total);
  document.getElementById('sr_total2').textContent = fmt(y2.total);
  document.getElementById('sr_avg').textContent = fmt(monthly);

  updateMathSteps({ y1: y1, y2: y2, hasYr2: hasYr2, monthly: monthly, method: method });
}

// =====================================================
// MATH STEPS
// =====================================================

function updateMathSteps(data) {
  var stepsEl = document.getElementById('calcSteps-income-schedule-e-subject');
  if (!stepsEl) return;

  var html = '';
  html += '<div class="math-steps">';

  // Formula reference
  html += '<div class="math-step">';
  html += '<h4>Subject Property Income Formula</h4>';
  html += '<div class="math-formula">';
  html += '<span class="math-note">Schedule E subject property (no payment subtraction):</span>';
  html += '<div class="math-values">';
  html += 'Annual = Rents + Royalties + Amort/Casualty + Depreciation + Insurance + Mortgage Interest + Taxes &minus; Total Expenses<br><br>';
  html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
  html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
  html += 'ELSE:<br>';
  html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
  html += '</div></div></div>';

  // Year 1 breakdown
  html += '<div class="math-step">';
  html += '<h4>Year 1 Calculation</h4>';
  html += '<div class="math-formula">';
  html += 'Rents Received: ' + fmt(data.y1.rents) + '<br>';
  html += '+ Royalties: ' + fmt(data.y1.roy) + '<br>';
  html += '+ Amort/Casualty: ' + fmt(data.y1.cas) + '<br>';
  html += '+ Depreciation: ' + fmt(data.y1.dep) + '<br>';
  html += '+ Insurance: ' + fmt(data.y1.ins) + '<br>';
  html += '+ Mortgage Interest: ' + fmt(data.y1.int) + '<br>';
  html += '+ Taxes: ' + fmt(data.y1.tax) + '<br>';
  html += '&minus; Total Expenses: ' + fmt(data.y1.exp) + '<br>';
  html += '<div class="math-values"><strong>Year 1 Total = ' + fmt(data.y1.total) + '</strong></div>';
  html += '</div></div>';

  // Year 2 breakdown (if data exists)
  if (data.hasYr2) {
    html += '<div class="math-step">';
    html += '<h4>Year 2 Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Rents Received: ' + fmt(data.y2.rents) + '<br>';
    html += '+ Royalties: ' + fmt(data.y2.roy) + '<br>';
    html += '+ Amort/Casualty: ' + fmt(data.y2.cas) + '<br>';
    html += '+ Depreciation: ' + fmt(data.y2.dep) + '<br>';
    html += '+ Insurance: ' + fmt(data.y2.ins) + '<br>';
    html += '+ Mortgage Interest: ' + fmt(data.y2.int) + '<br>';
    html += '+ Taxes: ' + fmt(data.y2.tax) + '<br>';
    html += '&minus; Total Expenses: ' + fmt(data.y2.exp) + '<br>';
    html += '<div class="math-values"><strong>Year 2 Total = ' + fmt(data.y2.total) + '</strong></div>';
    html += '</div></div>';
  }

  // Monthly result
  var methodLabel = data.method === 'average'
    ? '24-month average (Year 1 > Year 2)'
    : 'Year 1 / 12';

  html += '<div class="math-step highlight">';
  html += '<h4>Monthly Average</h4>';
  html += '<div class="math-formula">';
  html += 'Method: ' + methodLabel + '<br>';
  if (data.method === 'average') {
    html += '(' + fmt(data.y1.total) + ' + ' + fmt(data.y2.total) + ') / 24<br>';
  } else {
    html += fmt(data.y1.total) + ' / 12<br>';
  }
  html += '<div class="math-values"><strong>Monthly Average: ' + fmt(data.monthly) + '</strong></div>';
  html += '</div></div>';

  html += '</div>'; // close .math-steps
  stepsEl.innerHTML = html;
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {
  var y1 = computeYear('1');
  var y2 = computeYear('2');

  var yr2Vals = [y2.rents, y2.roy, y2.cas, y2.exp, y2.dep, y2.ins, y2.int, y2.tax];
  var hasYr2 = yr2Vals.some(function (v) { return v !== 0; });

  var monthly;
  if (hasYr2 && y1.total > y2.total) {
    monthly = (y1.total + y2.total) / 24;
  } else {
    monthly = y1.total / 12;
  }

  var rows = [
    ['Schedule E Subject Property Calculator'],
    [''],
    ['Line Item', 'Year 1', 'Year 2'],
    ['Rents Received (Ln 3)', y1.rents, y2.rents],
    ['Royalties Received (Ln 4)', y1.roy, y2.roy],
    ['Amortization/Casualty Loss (Ln 19)', y1.cas, y2.cas],
    ['Total Expenses (Ln 20)', y1.exp, y2.exp],
    ['Depreciation (Ln 18)', y1.dep, y2.dep],
    ['Insurance (Ln 9)', y1.ins, y2.ins],
    ['Mortgage Interest (Ln 12)', y1.int, y2.int],
    ['Taxes (Ln 16)', y1.tax, y2.tax],
    [''],
    ['Year 1 Total', y1.total, ''],
    ['Year 2 Total', '', y2.total],
    ['Monthly Average', monthly, ''],
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
  a.download = 'schedule-e-subject-' + Date.now() + '.csv';
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
    slug:    'income-schedule-e-subject',
    label:   'Schedule E',
    maxDocs: 2,
    buildCardBody: function (doc, i) {
      var yearLabel  = doc.taxYear || '?';
      var nameLabel  = doc.propertyAddress || '';
      var rentsLabel = (doc.rentsReceived != null && doc.rentsReceived !== 0) ? fmt(doc.rentsReceived) : '--';

      var html = '';
      html += '<div class="doc-card__header">';
      html += '<span class="doc-card__year">' + yearLabel + '</span>';
      if (nameLabel) html += '<span class="doc-card__name">' + IncomeUpload.escHtml(nameLabel) + '</span>';
      html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
      html += '</div>';
      html += '<div class="doc-card__amounts">';
      html += '<span>Rents Received (Line 3): ' + rentsLabel + '</span>';
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

    /* Register email data provider */
    if (MSFG.CalcActions) {
      MSFG.CalcActions.register(function () {
        const title = document.querySelector('.calc-page__header h1');
        const sections = [];

        /* Gather all form-row data as rows */
        const formRows = [];
        document.querySelectorAll('.form-row').forEach(function (row) {
          const label = row.querySelector('label');
          const input = row.querySelector('input, select');
          if (label && input) {
            const val = input.value;
            if (val && val !== '0' && val !== '') {
              formRows.push({ label: label.textContent.trim(), value: '$' + parseFloat(val || 0).toLocaleString() });
            }
          }
        });
        if (formRows.length) sections.push({ heading: 'Income Details', rows: formRows });

        /* Gather total rows */
        const totalRows = [];
        document.querySelectorAll('.total-row').forEach(function (row) {
          const label = row.querySelector('label');
          const val = row.querySelector('.total-value');
          if (label && val) {
            totalRows.push({ label: label.textContent.trim(), value: val.textContent.trim(), isTotal: true });
          }
        });
        if (totalRows.length) sections.push({ heading: 'Results', rows: totalRows });

        return { title: title ? title.textContent.trim() : 'Income Calculator', sections: sections };
      });
    }
});
