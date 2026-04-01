'use strict';

/* =====================================================
   Form 1120 C-Corporation Income Calculator
   — field sync, C-Corp calculation
   — upload/cards handled by shared income-upload.js
   ===================================================== */

var fmt = MSFG.formatCurrency;
var pn  = MSFG.parseNumById;

// =====================================================
// FIELD MAPPING — AI → Form Fields
// =====================================================

var AI_FIELD_MAP = {
  capitalGain:        'cap',
  netGainLoss:        'net',
  otherIncome:        'oth',
  depreciation:       'dep',
  depletion:          'depl',
  domesticProduction: 'dpd',
  amortization:       'amort',
  nolDeduction:       'nol',
  taxableIncome:      'taxable',
  totalTax:           'totaltax',
  mortgagesPayable:   'mort',
  mealsEntertainment: 'meals',
  dividendsPaid:      'dividend'
};

/** Clear only the fields that AI auto-fills */
function clearAiFields() {
  var fields = ['cap', 'net', 'oth', 'dep', 'depl', 'dpd', 'amort', 'nol', 'taxable', 'totaltax', 'mort', 'meals', 'dividend'];
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
    var ySuffix = (i === 0) ? '1' : '2'; // Year 1 = suffix 1, Year 2 = suffix 2

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
// MAIN CALCULATION
// =====================================================

function calculate() {
  var cap1 = pn('cap1'),        cap2 = pn('cap2');
  var net1 = pn('net1'),        net2 = pn('net2');
  var oth1 = pn('oth1'),        oth2 = pn('oth2');
  var dep1 = pn('dep1'),        dep2 = pn('dep2');
  var depl1 = pn('depl1'),      depl2 = pn('depl2');
  var dpd1 = pn('dpd1'),        dpd2 = pn('dpd2');
  var amort1 = pn('amort1'),    amort2 = pn('amort2');
  var nol1 = pn('nol1'),        nol2 = pn('nol2');
  var taxable1 = pn('taxable1'), taxable2 = pn('taxable2');
  var tax1 = pn('totaltax1'),   tax2 = pn('totaltax2');
  var mort1 = pn('mort1'),      mort2 = pn('mort2');
  var meals1 = pn('meals1'),    meals2 = pn('meals2');
  var div1 = pn('dividend1'),   div2 = pn('dividend2');
  var ownership = pn('ownership') / 100;

  // Show/hide ownership warning
  var warningEl = document.getElementById('ownershipWarning');
  if (warningEl) {
    warningEl.style.display = ownership < 1 ? 'block' : 'none';
  }

  // Sum add-back items
  var sum1 = cap1 + net1 + oth1 + dep1 + depl1 + dpd1 + amort1 + nol1 + taxable1;
  var sum2 = cap2 + net2 + oth2 + dep2 + depl2 + dpd2 + amort2 + nol2 + taxable2;

  // Calculate: (sum - deductions) * ownership% - dividends
  var total1 = (sum1 - tax1 - mort1 - meals1) * ownership - div1;
  var total2 = (sum2 - tax2 - mort2 - meals2) * ownership - div2;

  // Determine if year 2 has values
  var year2Vals = [cap2, net2, oth2, dep2, depl2, dpd2, amort2, nol2, taxable2, tax2, mort2, meals2, div2];
  var hasYr2 = year2Vals.some(function (v) { return v !== 0; });

  var monthly, method;
  if (hasYr2 && total1 > total2) {
    monthly = (total1 + total2) / 24;
    method = 'average';
  } else {
    monthly = total1 / 12;
    method = 'recent';
  }

  // Update displays
  document.getElementById('yr1_total').textContent = fmt(total1);
  document.getElementById('yr2_total').textContent = fmt(total2);
  document.getElementById('monthly_income').textContent = fmt(monthly);
  document.getElementById('combined1120').textContent = fmt(monthly);

  // Update math steps
  updateMathSteps({
    sum1: sum1, sum2: sum2,
    tax1: tax1, tax2: tax2,
    mort1: mort1, mort2: mort2,
    meals1: meals1, meals2: meals2,
    div1: div1, div2: div2,
    ownership: ownership * 100,
    total1: total1, total2: total2,
    monthly: monthly, method: method,
    hasYr2: hasYr2
  });
}

// =====================================================
// MATH STEPS
// =====================================================

function updateMathSteps(d) {
  var stepsEl = document.getElementById('calcSteps-income-1120');
  if (!stepsEl) return;

  var html = '';
  html += '<div class="math-steps">';

  // Formula reference
  html += '<div class="math-step">';
  html += '<h4>C-Corporation Income Formula</h4>';
  html += '<div class="math-formula">';
  html += '<span class="math-note">Standard underwriting formula for Form 1120:</span>';
  html += '<div class="math-values">';
  html += 'Subtotal = CapGain + NetGain + Other + Dep + Depl + DPD + Amort + NOL + Taxable<br>';
  html += 'Pre-Dividend = (Subtotal &minus; Tax &minus; Mortgages &minus; Meals) &times; Ownership %<br>';
  html += 'Annual Income = Pre-Dividend &minus; Dividends Paid<br><br>';
  html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
  html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
  html += 'ELSE:<br>';
  html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
  html += '</div></div></div>';

  // Year 1 calculation
  html += '<div class="math-step">';
  html += '<h4>Year 1 Calculation</h4>';
  html += '<div class="math-formula">';
  html += 'Subtotal: ' + fmt(d.sum1) + '<br>';
  html += 'Less Tax: ' + fmt(d.tax1) + '<br>';
  html += 'Less Mortgages: ' + fmt(d.mort1) + '<br>';
  html += 'Less Meals: ' + fmt(d.meals1) + '<br>';
  html += '&times; Ownership: ' + d.ownership + '%<br>';
  html += 'Less Dividends: ' + fmt(d.div1);
  html += '<div class="math-values">';
  html += 'Year 1 = (' + fmt(d.sum1) + ' &minus; ' + fmt(d.tax1) + ' &minus; ' + fmt(d.mort1) + ' &minus; ' + fmt(d.meals1) + ') &times; ' + d.ownership + '% &minus; ' + fmt(d.div1) + ' = <strong>' + fmt(d.total1) + '</strong>';
  html += '</div></div></div>';

  // Year 2 calculation
  html += '<div class="math-step">';
  html += '<h4>Year 2 Calculation</h4>';
  html += '<div class="math-formula">';
  html += 'Subtotal: ' + fmt(d.sum2) + '<br>';
  html += 'Less Tax: ' + fmt(d.tax2) + '<br>';
  html += 'Less Mortgages: ' + fmt(d.mort2) + '<br>';
  html += 'Less Meals: ' + fmt(d.meals2) + '<br>';
  html += '&times; Ownership: ' + d.ownership + '%<br>';
  html += 'Less Dividends: ' + fmt(d.div2);
  html += '<div class="math-values">';
  html += 'Year 2 = <strong>' + fmt(d.total2) + '</strong>';
  html += '</div></div></div>';

  // Monthly result
  var methodLabel = d.method === 'average'
    ? '24-month average (Year 1 > Year 2)'
    : 'Year 1 / 12';
  html += '<div class="math-step highlight">';
  html += '<h4>Monthly Income Result</h4>';
  html += '<div class="math-formula">';
  html += 'Method: ' + methodLabel;
  html += '<div class="math-values"><strong>Monthly Income: ' + fmt(d.monthly) + '</strong></div>';
  html += '</div></div>';

  html += '</div>'; // close .math-steps
  stepsEl.innerHTML = html;
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {
  var rows = [
    ['Form 1120 Corporation Income Calculator'],
    [''],
    ['', 'Year 1', 'Year 2'],
    ['Income', document.getElementById('yr1_total').textContent, document.getElementById('yr2_total').textContent],
    ['Ownership %', pn('ownership'), ''],
    ['Monthly Income', document.getElementById('monthly_income').textContent, ''],
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
  a.download = 'form1120-income-' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// =====================================================
// CLEAR ALL
// =====================================================

function clearAll() {
  IncomeUpload.setDocStore([]);
  IncomeUpload.renderDocCards();

  // Reset all number inputs (ownership → 100, everything else → 0)
  var inputs = document.querySelectorAll('input[type="number"]');
  inputs.forEach(function (input) {
    input.value = input.id === 'ownership' ? '100' : '0';
  });

  IncomeUpload.resetZone();
  calculate();
}

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function () {
  IncomeUpload.init({
    slug:  'income-1120',
    label: '1120',
    maxDocs: 2,
    buildCardBody: function (doc, i) {
      var yearLabel  = doc.taxYear || '?';
      var nameLabel  = doc.corporationName || '';
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
      html += '<span>Total Income (Line 11): ' + totalLabel + '</span>';
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
