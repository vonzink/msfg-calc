'use strict';

/* =====================================================
   Form 1065 Partnership Income Calculator
   — field sync, partnership calculation
   — upload/cards handled by shared income-upload.js
   ===================================================== */

var fmt = MSFG.formatCurrency;
var pn  = MSFG.parseNumById;

// Track which partnership slot the AI data should fill
var aiTargetPartnership = 'p1';

// =====================================================
// FIELD MAPPING — AI → Form Fields
// =====================================================

var AI_FIELD_MAP = {
  ordinaryIncome:      'ord',
  netFarmProfit:       'farm',
  netGainLoss:         'gain',
  otherIncomeLoss:     'oth',
  depreciation:        'dep',
  depletion:           'depl',
  amortization:        'amort',
  mortgagesPayable:    'mort',
  mealsEntertainment:  'meals'
};

function clearAiFields() {
  var prefix = aiTargetPartnership;
  var fields = ['ord', 'farm', 'gain', 'oth', 'dep', 'depl', 'amort', 'mort', 'meals'];
  fields.forEach(function (f) {
    var el1 = document.getElementById(prefix + '_' + f + '1');
    var el2 = document.getElementById(prefix + '_' + f + '2');
    if (el1) el1.value = '0';
    if (el2) el2.value = '0';
  });
}

function syncFieldsFromDocs() {
  var prefix = aiTargetPartnership;
  var docStore = IncomeUpload.getDocStore();

  docStore.forEach(function (doc, i) {
    var ySuffix = (i === 0) ? '1' : '2';

    Object.keys(AI_FIELD_MAP).forEach(function (aiKey) {
      var fieldBase = AI_FIELD_MAP[aiKey];
      var fieldId = prefix + '_' + fieldBase + ySuffix;
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
// PARTNERSHIP CALCULATION
// =====================================================

function computePartnership(prefix) {
  var ord1   = pn(prefix + '_ord1');
  var ord2   = pn(prefix + '_ord2');
  var farm1  = pn(prefix + '_farm1');
  var farm2  = pn(prefix + '_farm2');
  var gain1  = pn(prefix + '_gain1');
  var gain2  = pn(prefix + '_gain2');
  var oth1   = pn(prefix + '_oth1');
  var oth2   = pn(prefix + '_oth2');
  var dep1   = pn(prefix + '_dep1');
  var dep2   = pn(prefix + '_dep2');
  var depl1  = pn(prefix + '_depl1');
  var depl2  = pn(prefix + '_depl2');
  var amort1 = pn(prefix + '_amort1');
  var amort2 = pn(prefix + '_amort2');
  var mort1  = pn(prefix + '_mort1');
  var mort2  = pn(prefix + '_mort2');
  var meals1 = pn(prefix + '_meals1');
  var meals2 = pn(prefix + '_meals2');
  var own    = pn(prefix + '_owner') / 100;

  var sum1 = ord1 + farm1 + gain1 + oth1 + dep1 + depl1 + amort1;
  var sum2 = ord2 + farm2 + gain2 + oth2 + dep2 + depl2 + amort2;

  var total1 = (sum1 - mort1 - meals1) * own;
  var total2 = (sum2 - mort2 - meals2) * own;

  var year2Vals = [ord2, farm2, gain2, oth2, dep2, depl2, amort2, mort2, meals2];
  var hasYr2 = year2Vals.some(function (v) { return v !== 0; });

  var monthly, method;
  if (hasYr2 && total1 > total2) {
    monthly = (total1 + total2) / 24;
    method = 'average';
  } else {
    monthly = total1 / 12;
    method = 'recent';
  }

  return {
    sum1: sum1, sum2: sum2,
    total1: total1, total2: total2,
    monthly: monthly, method: method,
    mort1: mort1, mort2: mort2,
    meals1: meals1, meals2: meals2,
    own: own * 100
  };
}

// =====================================================
// MAIN CALCULATION
// =====================================================

function calculate() {
  var p1 = computePartnership('p1');
  document.getElementById('p1_year1').textContent = fmt(p1.total1);
  document.getElementById('p1_year2').textContent = fmt(p1.total2);
  document.getElementById('p1_month').textContent = fmt(p1.monthly);
  document.getElementById('result_p1').textContent = fmt(p1.monthly);

  var p2 = computePartnership('p2');
  document.getElementById('p2_year1').textContent = fmt(p2.total1);
  document.getElementById('p2_year2').textContent = fmt(p2.total2);
  document.getElementById('p2_month').textContent = fmt(p2.monthly);
  document.getElementById('result_p2').textContent = fmt(p2.monthly);

  var combined = p1.monthly + p2.monthly;
  document.getElementById('combined1065').textContent = fmt(combined);

  updateMathSteps(p1, p2, combined);
}

// =====================================================
// MATH STEPS
// =====================================================

function updateMathSteps(p1, p2, combined) {
  var stepsEl = document.getElementById('calcSteps-income-1065');
  if (!stepsEl) return;

  var html = '';
  html += '<div class="math-steps">';

  html += '<div class="math-step">';
  html += '<h4>Partnership Income Formula</h4>';
  html += '<div class="math-formula">';
  html += '<span class="math-note">For each partnership:</span>';
  html += '<div class="math-values">';
  html += 'Subtotal = Ordinary + Farm + Gain + Other + Depreciation + Depletion + Amortization<br>';
  html += 'Annual Income = (Subtotal &minus; Mortgages &minus; Meals) &times; Ownership %<br><br>';
  html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
  html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
  html += 'ELSE:<br>';
  html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
  html += '</div></div></div>';

  html += buildPartnershipMathStep('Partnership 1', p1);

  var p2HasData = p2.sum1 !== 0 || p2.sum2 !== 0 || p2.mort1 !== 0 || p2.meals1 !== 0;
  if (p2HasData) {
    html += buildPartnershipMathStep('Partnership 2', p2);
  }

  html += '<div class="math-step highlight">';
  html += '<h4>Total Monthly Income</h4>';
  html += '<div class="math-formula">';
  html += 'Partnership 1: ' + fmt(p1.monthly) + '<br>';
  if (p2HasData) {
    html += '+ Partnership 2: ' + fmt(p2.monthly) + '<br>';
  }
  html += '<div class="math-values"><strong>Total Monthly: ' + fmt(combined) + '</strong></div>';
  html += '</div></div>';

  html += '</div>';
  stepsEl.innerHTML = html;
}

function buildPartnershipMathStep(label, p) {
  var methodLabel = p.method === 'average'
    ? '24-month average (Year 1 > Year 2)'
    : 'Year 1 / 12';

  var html = '';
  html += '<div class="math-step">';
  html += '<h4>' + label + ' Calculation</h4>';
  html += '<div class="math-formula">';
  html += 'Subtotal Year 1: ' + fmt(p.sum1) + '<br>';
  html += 'Subtotal Year 2: ' + fmt(p.sum2) + '<br>';
  html += 'Less Mortgages: ' + fmt(p.mort1) + ' / ' + fmt(p.mort2) + '<br>';
  html += 'Less Meals: ' + fmt(p.meals1) + ' / ' + fmt(p.meals2) + '<br>';
  html += 'Ownership: ' + p.own + '%<br>';
  html += '<div class="math-values">';
  html += 'Year 1 = (' + fmt(p.sum1) + ' &minus; ' + fmt(p.mort1) + ' &minus; ' + fmt(p.meals1) + ') &times; ' + p.own + '% = ' + fmt(p.total1) + '<br>';
  html += 'Year 2 = (' + fmt(p.sum2) + ' &minus; ' + fmt(p.mort2) + ' &minus; ' + fmt(p.meals2) + ') &times; ' + p.own + '% = ' + fmt(p.total2) + '<br>';
  html += 'Method: ' + methodLabel + '<br>';
  html += '<strong>Monthly: ' + fmt(p.monthly) + '</strong>';
  html += '</div></div></div>';
  return html;
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {
  var p1 = computePartnership('p1');
  var p2 = computePartnership('p2');
  var combined = p1.monthly + p2.monthly;

  var rows = [
    ['Form 1065 Partnership Income Calculator'],
    [''],
    ['Partnership', 'Year 1 Income', 'Year 2 Income', 'Ownership %', 'Monthly Income'],
    ['Partnership 1', p1.total1, p1.total2, p1.own, p1.monthly],
    ['Partnership 2', p2.total1, p2.total2, p2.own, p2.monthly],
    [''],
    ['Total Monthly Income', '', '', '', combined],
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
  a.download = 'form1065-income-' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// =====================================================
// CLEAR ALL
// =====================================================

function clearAll() {
  IncomeUpload.setDocStore([]);
  IncomeUpload.renderDocCards();

  var inputs = document.querySelectorAll('input[type="number"]');
  inputs.forEach(function (input) {
    input.value = input.id.indexOf('owner') !== -1 ? '100' : '0';
  });

  IncomeUpload.resetZone();
  calculate();
}

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function () {
  IncomeUpload.init({
    slug:  'income-1065',
    label: '1065',
    maxDocs: 2,
    buildCardBody: function (doc, i) {
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
      html += '<span>Total Income (Line 8): ' + totalLabel + '</span>';
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
