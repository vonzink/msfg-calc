'use strict';

/* =====================================================
   Schedule F Farm Income Calculator
   — AI upload via shared IncomeUpload module
   — Field sync, single-entity calculation
   ===================================================== */

var fmt = MSFG.formatCurrency;
var pn  = MSFG.parseNumById;

// =====================================================
// FIELD MAPPING — AI → Form Fields
// =====================================================

var AI_FIELD_MAP = {
  netProfit:          'f_np',
  coopPayments:       'f_coop',
  otherIncome:        'f_other',
  depreciation:       'f_dep',
  amortization:       'f_amort',
  businessUseOfHome:  'f_home',
  mealsEntertainment: 'f_meals'
};

/** Clear only the fields that AI auto-fills */
function clearAiFields() {
  var fields = ['f_np', 'f_coop', 'f_other', 'f_dep', 'f_amort', 'f_home', 'f_meals'];
  fields.forEach(function (f) {
    var el1 = document.getElementById(f + '1');
    var el2 = document.getElementById(f + '2');
    if (el1) el1.value = '0';
    if (el2) el2.value = '0';
  });
}

/** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
function syncFieldsFromDocs() {
  IncomeUpload.getDocStore().forEach(function (doc, i) {
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
// CARD BODY BUILDER
// =====================================================

function buildCardBody(doc, i) {
  var yearLabel  = doc.taxYear || '?';
  var nameLabel  = doc.farmName || '';
  var totalLabel = (doc.netProfit != null && doc.netProfit !== 0) ? fmt(doc.netProfit) : '--';

  var html = '';
  html += '<div class="doc-card__header">';
  html += '<span class="doc-card__year">' + yearLabel + '</span>';
  if (nameLabel) html += '<span class="doc-card__name">' + IncomeUpload.escHtml(nameLabel) + '</span>';
  html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
  html += '</div>';
  html += '<div class="doc-card__amounts">';
  html += '<span>Net Profit/Loss: ' + totalLabel + '</span>';
  html += IncomeUpload.yearBadge(i);
  html += '</div>';

  return html;
}

// =====================================================
// FARM INCOME CALCULATION
// =====================================================

function calculate() {
  var np1    = pn('f_np1');
  var np2    = pn('f_np2');
  var coop1  = pn('f_coop1');
  var coop2  = pn('f_coop2');
  var other1 = pn('f_other1');
  var other2 = pn('f_other2');
  var dep1   = pn('f_dep1');
  var dep2   = pn('f_dep2');
  var amort1 = pn('f_amort1');
  var amort2 = pn('f_amort2');
  var home1  = pn('f_home1');
  var home2  = pn('f_home2');
  var meals1 = pn('f_meals1');
  var meals2 = pn('f_meals2');

  var year1 = np1 + coop1 + other1 + dep1 + amort1 + home1 - meals1;
  var year2 = np2 + coop2 + other2 + dep2 + amort2 + home2 - meals2;

  // Check if Year 2 has data
  var year2Vals = [np2, coop2, other2, dep2, amort2, home2, meals2];
  var hasYr2 = year2Vals.some(function (v) { return v !== 0; });

  var monthly, method;
  if (hasYr2 && year1 > year2) {
    monthly = (year1 + year2) / 24;
    method = 'average';
  } else {
    monthly = year1 / 12;
    method = 'recent';
  }

  // Update DOM
  document.getElementById('f_total1').textContent = fmt(year1);
  document.getElementById('f_total2').textContent = fmt(year2);
  document.getElementById('f_monthly').textContent = fmt(monthly);

  updateMathSteps({
    np1: np1, np2: np2,
    coop1: coop1, coop2: coop2,
    other1: other1, other2: other2,
    dep1: dep1, dep2: dep2,
    amort1: amort1, amort2: amort2,
    home1: home1, home2: home2,
    meals1: meals1, meals2: meals2,
    year1: year1, year2: year2,
    monthly: monthly, method: method,
    hasYr2: hasYr2
  });
}

// =====================================================
// MATH STEPS
// =====================================================

function updateMathSteps(data) {
  var stepsEl = document.getElementById('calcSteps-income-schedule-f');
  if (!stepsEl) return;

  var html = '';
  html += '<div class="math-steps">';

  // Formula reference
  html += '<div class="math-step">';
  html += '<h4>Schedule F Farm Income Formula</h4>';
  html += '<div class="math-formula">';
  html += '<span class="math-note">For farm income:</span>';
  html += '<div class="math-values">';
  html += 'Annual = Net Profit + Coop/CCC + Other + Depreciation + Amortization + Home &minus; Meals<br><br>';
  html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
  html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
  html += 'ELSE:<br>';
  html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
  html += '</div></div></div>';

  // Year 1 breakdown
  html += '<div class="math-step">';
  html += '<h4>Year 1 Calculation</h4>';
  html += '<div class="math-formula">';
  html += 'Net Profit: ' + fmt(data.np1) + '<br>';
  html += '+ Coop/CCC: ' + fmt(data.coop1) + '<br>';
  html += '+ Other Income: ' + fmt(data.other1) + '<br>';
  html += '+ Depreciation: ' + fmt(data.dep1) + '<br>';
  html += '+ Amortization: ' + fmt(data.amort1) + '<br>';
  html += '+ Business Use of Home: ' + fmt(data.home1) + '<br>';
  html += '&minus; Meals: ' + fmt(data.meals1) + '<br>';
  html += '<div class="math-values">';
  html += '<strong>Year 1 Total = ' + fmt(data.year1) + '</strong>';
  html += '</div></div></div>';

  // Year 2 breakdown (only if has data)
  if (data.hasYr2) {
    html += '<div class="math-step">';
    html += '<h4>Year 2 Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Net Profit: ' + fmt(data.np2) + '<br>';
    html += '+ Coop/CCC: ' + fmt(data.coop2) + '<br>';
    html += '+ Other Income: ' + fmt(data.other2) + '<br>';
    html += '+ Depreciation: ' + fmt(data.dep2) + '<br>';
    html += '+ Amortization: ' + fmt(data.amort2) + '<br>';
    html += '+ Business Use of Home: ' + fmt(data.home2) + '<br>';
    html += '&minus; Meals: ' + fmt(data.meals2) + '<br>';
    html += '<div class="math-values">';
    html += '<strong>Year 2 Total = ' + fmt(data.year2) + '</strong>';
    html += '</div></div></div>';
  }

  // Monthly result
  var methodLabel = data.method === 'average'
    ? '24-month average (Year 1 > Year 2)'
    : 'Year 1 / 12 (most recent year only)';

  html += '<div class="math-step highlight">';
  html += '<h4>Monthly Qualifying Income</h4>';
  html += '<div class="math-formula">';
  html += 'Method: ' + methodLabel + '<br>';
  if (data.method === 'average') {
    html += '(' + fmt(data.year1) + ' + ' + fmt(data.year2) + ') / 24<br>';
  } else {
    html += fmt(data.year1) + ' / 12<br>';
  }
  html += '<div class="math-values"><strong>Monthly Income: ' + fmt(data.monthly) + '</strong></div>';
  html += '</div></div>';

  html += '</div>'; // close .math-steps
  stepsEl.innerHTML = html;
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {
  var np1    = pn('f_np1');
  var np2    = pn('f_np2');
  var coop1  = pn('f_coop1');
  var coop2  = pn('f_coop2');
  var other1 = pn('f_other1');
  var other2 = pn('f_other2');
  var dep1   = pn('f_dep1');
  var dep2   = pn('f_dep2');
  var amort1 = pn('f_amort1');
  var amort2 = pn('f_amort2');
  var home1  = pn('f_home1');
  var home2  = pn('f_home2');
  var meals1 = pn('f_meals1');
  var meals2 = pn('f_meals2');

  var year1 = np1 + coop1 + other1 + dep1 + amort1 + home1 - meals1;
  var year2 = np2 + coop2 + other2 + dep2 + amort2 + home2 - meals2;

  var year2Vals = [np2, coop2, other2, dep2, amort2, home2, meals2];
  var hasYr2 = year2Vals.some(function (v) { return v !== 0; });
  var monthly;
  if (hasYr2 && year1 > year2) {
    monthly = (year1 + year2) / 24;
  } else {
    monthly = year1 / 12;
  }

  var rows = [
    ['Schedule F Farm Income Calculator'],
    [''],
    ['Line Item', 'Year 1', 'Year 2'],
    ['Net Profit or Loss', np1, np2],
    ['Ongoing Coop & CCC Payments', coop1, coop2],
    ['Other Income or Loss', other1, other2],
    ['Depreciation', dep1, dep2],
    ['Amortization/Casualty Loss/Depletion', amort1, amort2],
    ['Business Use of Home', home1, home2],
    ['Meal & Entertainment Exclusion', meals1, meals2],
    [''],
    ['Year 1 Total', year1, ''],
    ['Year 2 Total', '', year2],
    ['Monthly Qualifying Income', monthly, ''],
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
  a.download = 'schedule-f-income-' + Date.now() + '.csv';
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
    slug:          'income-schedule-f',
    label:         'Schedule F',
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
