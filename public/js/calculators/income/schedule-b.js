'use strict';

/* =====================================================
   Schedule B Interest & Dividend Income Calculator
   — field sync, 3-institution calculation
   — upload/cards handled by shared income-upload.js
   ===================================================== */

var fmt = MSFG.formatCurrency;
var pn  = MSFG.parseNumById;

// =====================================================
// FIELD MAPPING — AI → Form Fields
// =====================================================

/**
 * AI data maps into Institution 1 (inst1_) fields by default.
 * institutions array: first institution fills inst1_ fields.
 * totalInterest  → inst1_interest
 * taxExemptInterest → inst1_taxexempt
 * totalDividends → inst1_dividend
 */
var AI_FIELD_MAP = {
  totalInterest:       'interest',
  taxExemptInterest:   'taxexempt',
  totalDividends:      'dividend'
};

/** Clear only the fields that AI auto-fills (Institution 1 line items) */
function clearAiFields() {
  var fields = ['interest', 'taxexempt', 'dividend'];
  fields.forEach(function (f) {
    var el1 = document.getElementById('inst1_' + f + '_y1');
    var el2 = document.getElementById('inst1_' + f + '_y2');
    if (el1) el1.value = '0';
    if (el2) el2.value = '0';
  });
}

/** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
function syncFieldsFromDocs() {
  var docStore = IncomeUpload.getDocStore();
  docStore.forEach(function (doc, i) {
    var ySuffix = (i === 0) ? 'y1' : 'y2';

    // If the AI returns an institutions array, use the first one
    var source = doc;
    if (doc.institutions && doc.institutions.length > 0) {
      source = doc.institutions[0];
    }

    Object.keys(AI_FIELD_MAP).forEach(function (aiKey) {
      var fieldBase = AI_FIELD_MAP[aiKey];
      var fieldId = 'inst1_' + fieldBase + '_' + ySuffix;
      setField(fieldId, source[aiKey]);
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
  var totalY1 = 0;
  var totalY2 = 0;

  // Loop through all 3 institutions
  for (var i = 1; i <= 3; i++) {
    var prefix = 'inst' + i;

    var intY1  = pn(prefix + '_interest_y1');
    var intY2  = pn(prefix + '_interest_y2');
    var texY1  = pn(prefix + '_taxexempt_y1');
    var texY2  = pn(prefix + '_taxexempt_y2');
    var divY1  = pn(prefix + '_dividend_y1');
    var divY2  = pn(prefix + '_dividend_y2');

    totalY1 += intY1 + texY1 + divY1;
    totalY2 += intY2 + texY2 + divY2;
  }

  // Standard averaging policy
  var hasYr2 = totalY2 !== 0;
  var monthly, method;

  if (hasYr2 && totalY1 > totalY2) {
    monthly = (totalY1 + totalY2) / 24;
    method = 'average';
  } else {
    monthly = totalY1 / 12;
    method = 'recent';
  }

  // Update DOM
  document.getElementById('totalYear1').textContent = fmt(totalY1);
  document.getElementById('totalYear2').textContent = fmt(totalY2);
  document.getElementById('incomeToUse').textContent = fmt(monthly);

  updateMathSteps({
    totalY1: totalY1,
    totalY2: totalY2,
    monthly: monthly,
    method: method,
    hasYr2: hasYr2
  });
}

// =====================================================
// MATH STEPS
// =====================================================

function updateMathSteps(data) {
  var stepsEl = document.getElementById('calcSteps-income-schedule-b');
  if (!stepsEl) return;

  var html = '';
  html += '<div class="math-steps">';

  // Formula reference
  html += '<div class="math-step">';
  html += '<h4>Schedule B Income Formula</h4>';
  html += '<div class="math-formula">';
  html += '<span class="math-note">For each institution:</span>';
  html += '<div class="math-values">';
  html += 'Annual = Interest + Tax-Exempt Interest + Dividends<br><br>';
  html += 'Total Year 1 = Sum of all institutions (Year 1)<br>';
  html += 'Total Year 2 = Sum of all institutions (Year 2)<br><br>';
  html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
  html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
  html += 'ELSE:<br>';
  html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
  html += '</div></div></div>';

  // Per-institution breakdown
  for (var i = 1; i <= 3; i++) {
    var prefix = 'inst' + i;
    var intY1  = pn(prefix + '_interest_y1');
    var intY2  = pn(prefix + '_interest_y2');
    var texY1  = pn(prefix + '_taxexempt_y1');
    var texY2  = pn(prefix + '_taxexempt_y2');
    var divY1  = pn(prefix + '_dividend_y1');
    var divY2  = pn(prefix + '_dividend_y2');

    var instY1 = intY1 + texY1 + divY1;
    var instY2 = intY2 + texY2 + divY2;

    // Only show institutions that have data
    if (instY1 !== 0 || instY2 !== 0) {
      html += '<div class="math-step">';
      html += '<h4>Institution ' + i + '</h4>';
      html += '<div class="math-formula">';
      html += 'Interest:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + fmt(intY1) + ' / ' + fmt(intY2) + '<br>';
      html += 'Tax-Exempt:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + fmt(texY1) + ' / ' + fmt(texY2) + '<br>';
      html += 'Dividends:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + fmt(divY1) + ' / ' + fmt(divY2) + '<br>';
      html += '<div class="math-values">';
      html += 'Year 1 = ' + fmt(intY1) + ' + ' + fmt(texY1) + ' + ' + fmt(divY1) + ' = ' + fmt(instY1) + '<br>';
      html += 'Year 2 = ' + fmt(intY2) + ' + ' + fmt(texY2) + ' + ' + fmt(divY2) + ' = ' + fmt(instY2);
      html += '</div></div></div>';
    }
  }

  // Averaging / final result
  var methodLabel = data.method === 'average'
    ? '24-month average (Year 1 > Year 2)'
    : 'Year 1 / 12 (most recent)';

  html += '<div class="math-step highlight">';
  html += '<h4>Monthly Qualifying Income</h4>';
  html += '<div class="math-formula">';
  html += 'Total Year 1: ' + fmt(data.totalY1) + '<br>';
  html += 'Total Year 2: ' + fmt(data.totalY2) + '<br>';
  html += 'Method: ' + methodLabel + '<br>';

  if (data.method === 'average') {
    html += '<div class="math-values">';
    html += '(' + fmt(data.totalY1) + ' + ' + fmt(data.totalY2) + ') / 24 = <strong>' + fmt(data.monthly) + '</strong>';
    html += '</div>';
  } else {
    html += '<div class="math-values">';
    html += fmt(data.totalY1) + ' / 12 = <strong>' + fmt(data.monthly) + '</strong>';
    html += '</div>';
  }

  html += '</div></div>';

  html += '</div>'; // close .math-steps
  stepsEl.innerHTML = html;
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {
  var totalY1 = 0;
  var totalY2 = 0;

  var rows = [
    ['Schedule B Interest & Dividend Income Calculator'],
    [''],
    ['Institution', 'Type', 'Year 1', 'Year 2']
  ];

  for (var i = 1; i <= 3; i++) {
    var prefix = 'inst' + i;
    var intY1  = pn(prefix + '_interest_y1');
    var intY2  = pn(prefix + '_interest_y2');
    var texY1  = pn(prefix + '_taxexempt_y1');
    var texY2  = pn(prefix + '_taxexempt_y2');
    var divY1  = pn(prefix + '_dividend_y1');
    var divY2  = pn(prefix + '_dividend_y2');

    rows.push(['Institution ' + i, 'Interest', intY1, intY2]);
    rows.push(['Institution ' + i, 'Tax-Exempt Interest', texY1, texY2]);
    rows.push(['Institution ' + i, 'Dividends', divY1, divY2]);

    totalY1 += intY1 + texY1 + divY1;
    totalY2 += intY2 + texY2 + divY2;
  }

  var hasYr2 = totalY2 !== 0;
  var monthly;
  if (hasYr2 && totalY1 > totalY2) {
    monthly = (totalY1 + totalY2) / 24;
  } else {
    monthly = totalY1 / 12;
  }

  rows.push(['']);
  rows.push(['Totals', '', totalY1, totalY2]);
  rows.push(['Monthly Qualifying Income', '', '', monthly]);
  rows.push(['']);
  rows.push(['Generated', new Date().toLocaleString()]);

  var csv = rows.map(function (row) {
    return row.map(function (cell) { return '"' + cell + '"'; }).join(',');
  }).join('\n');

  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'schedule-b-income-' + Date.now() + '.csv';
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
    slug:  'income-schedule-b',
    label: 'Schedule B',
    maxDocs: 2,
    buildCardBody: function (doc, i) {
      var yearLabel = doc.taxYear || '?';
      var totalInt  = (doc.totalInterest != null) ? fmt(doc.totalInterest) : '--';
      var totalDiv  = (doc.totalDividends != null) ? fmt(doc.totalDividends) : '--';

      var html = '';
      html += '<div class="doc-card__header">';
      html += '<span class="doc-card__year">' + yearLabel + '</span>';
      html += '<span class="doc-card__name">Schedule B</span>';
      html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
      html += '</div>';
      html += '<div class="doc-card__amounts">';
      html += '<span>Interest: ' + totalInt + '</span>';
      html += '<span>Dividends: ' + totalDiv + '</span>';
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
