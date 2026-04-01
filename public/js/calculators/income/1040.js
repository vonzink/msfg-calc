'use strict';

/* =====================================================
   Form 1040 Page 1 Income Calculator
   — field sync, policy-based calculation
   — upload/cards handled by shared income-upload.js
   ===================================================== */

var fmt = MSFG.formatCurrency;
var pn  = MSFG.parseNumById;

// =====================================================
// FIELD MAPPING — AI → Form Fields
// =====================================================

/** Clear only the fields that AI auto-fills (Employer 1 + single-row fields) */
function clearAiFields() {
  var ids = [
    'w2_1_y1', 'w2_1_y2',
    'alimony1', 'alimony2',
    'pen1_15_y1', 'pen1_15_y2',
    'pen1_16_y1', 'pen1_16_y2',
    'unemp1', 'unemp2',
    'ss1', 'ss2'
  ];
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '0';
  });
}

/** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
function syncFieldsFromDocs() {
  var docStore = IncomeUpload.getDocStore();
  docStore.forEach(function (doc, i) {
    // Year 1 suffix = '1' or 'y1', Year 2 suffix = '2' or 'y2'
    var ySuffix = (i === 0) ? '1' : '2';     // for alimony1/2, unemp1/2, ss1/2
    var yField  = (i === 0) ? 'y1' : 'y2';   // for w2_1_y1/y2, pen1_15_y1/y2

    // W-2 wages → Employer 1 slot
    setField('w2_1_' + yField, doc.wages);

    // Alimony
    setField('alimony' + ySuffix, doc.alimony);

    // IRA distributions (taxable) → Pension 1 IRA row
    setField('pen1_15_' + yField, doc.iraDistributionsTaxable);

    // Pensions/annuities (taxable) → Pension 1 Pensions row
    setField('pen1_16_' + yField, doc.pensionsAnnuitiesTaxable);

    // Unemployment
    setField('unemp' + ySuffix, doc.unemployment);

    // Social Security (gross amount for qualification)
    setField('ss' + ySuffix, doc.socialSecurity);
  });
}

function setField(id, value) {
  var el = document.getElementById(id);
  if (el && value != null) {
    el.value = value || 0;
  }
}

// =====================================================
// POLICY CALCULATION
// =====================================================

function policyCalc(year1, year2) {
  var hasYr2 = year2 !== 0;
  if (hasYr2 && year1 > year2) {
    return {
      monthly: (year1 + year2) / 24,
      method: 'average',
      formula: '(' + fmt(year1) + ' + ' + fmt(year2) + ') / 24 = ' + fmt((year1 + year2) / 24)
    };
  }
  return {
    monthly: year1 / 12,
    method: 'recent',
    formula: fmt(year1) + ' / 12 = ' + fmt(year1 / 12)
  };
}

// =====================================================
// MAIN CALCULATION
// =====================================================

function calculate() {
  // W-2 section
  var w2_y1 = pn('w2_1_y1') + pn('w2_2_y1') + pn('w2_3_y1') + pn('w2_4_y1');
  var w2_y2 = pn('w2_1_y2') + pn('w2_2_y2') + pn('w2_3_y2') + pn('w2_4_y2');
  var w2_result = policyCalc(w2_y1, w2_y2);
  document.getElementById('w2_month').textContent = fmt(w2_result.monthly);
  document.getElementById('result_w2').textContent = fmt(w2_result.monthly);

  // Alimony
  var al_y1 = pn('alimony1');
  var al_y2 = pn('alimony2');
  var al_result = policyCalc(al_y1, al_y2);
  document.getElementById('alimony_month').textContent = fmt(al_result.monthly);
  document.getElementById('result_alimony').textContent = fmt(al_result.monthly);

  // Pension/annuity
  var pen_y1 = pn('pen1_15_y1') + pn('pen1_16_y1') +
               pn('pen2_15_y1') + pn('pen2_16_y1') +
               pn('pen3_15_y1') + pn('pen3_16_y1');
  var pen_y2 = pn('pen1_15_y2') + pn('pen1_16_y2') +
               pn('pen2_15_y2') + pn('pen2_16_y2') +
               pn('pen3_15_y2') + pn('pen3_16_y2');
  var pen_result = policyCalc(pen_y1, pen_y2);
  document.getElementById('pension_month').textContent = fmt(pen_result.monthly);
  document.getElementById('result_pension').textContent = fmt(pen_result.monthly);

  // Unemployment
  var un_y1 = pn('unemp1');
  var un_y2 = pn('unemp2');
  var un_result = policyCalc(un_y1, un_y2);
  document.getElementById('unemp_month').textContent = fmt(un_result.monthly);
  document.getElementById('result_unemp').textContent = fmt(un_result.monthly);

  // Social Security
  var ss_y1 = pn('ss1');
  var ss_y2 = pn('ss2');
  var ss_result = policyCalc(ss_y1, ss_y2);
  document.getElementById('ss_month').textContent = fmt(ss_result.monthly);
  document.getElementById('result_ss').textContent = fmt(ss_result.monthly);

  // Combined
  var combined = w2_result.monthly + al_result.monthly + pen_result.monthly +
                 un_result.monthly + ss_result.monthly;
  document.getElementById('combined1040').textContent = fmt(combined);

  // Math steps
  updateMathSteps({
    w2:      { y1: w2_y1,  y2: w2_y2,  result: w2_result },
    alimony: { y1: al_y1,  y2: al_y2,  result: al_result },
    pension: { y1: pen_y1, y2: pen_y2, result: pen_result },
    unemp:   { y1: un_y1,  y2: un_y2,  result: un_result },
    ss:      { y1: ss_y1,  y2: ss_y2,  result: ss_result },
    combined: combined
  });
}

// =====================================================
// MATH STEPS
// =====================================================

function updateMathSteps(data) {
  var stepsEl = document.getElementById('calcSteps-income-1040');
  if (!stepsEl) return;

  var html = '';

  // Policy reference
  html += '<div class="math-steps">';
  html += '<div class="math-step">';
  html += '<h4>Income Averaging Policy</h4>';
  html += '<div class="math-formula">';
  html += '<span class="math-note">Standard underwriting guidelines for income calculation:</span>';
  html += '<div class="math-values">';
  html += 'IF Year 2 is provided AND Year 1 &gt; Year 2:<br>';
  html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br><br>';
  html += 'ELSE:<br>';
  html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
  html += '</div></div></div>';

  // W-2
  var w2Method = data.w2.result.method === 'average'
    ? '(Year 1 > Year 2, using 24-month average)'
    : '(Using most recent year / 12)';
  html += '<div class="math-step">';
  html += '<h4>W-2 Income Calculation</h4>';
  html += '<div class="math-formula">';
  html += 'Year 1 Total: ' + fmt(data.w2.y1) + '<br>';
  html += 'Year 2 Total: ' + fmt(data.w2.y2) + '<br>';
  html += '<span class="math-note">' + w2Method + '</span>';
  html += '<div class="math-values">' + data.w2.result.formula + '</div>';
  html += '</div></div>';

  // Alimony (only if non-zero)
  if (data.alimony.y1 > 0 || data.alimony.y2 > 0) {
    var alMethod = data.alimony.result.method === 'average'
      ? '(Year 1 > Year 2, using 24-month average)'
      : '(Using most recent year / 12)';
    html += '<div class="math-step">';
    html += '<h4>Alimony Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Year 1: ' + fmt(data.alimony.y1) + '<br>';
    html += 'Year 2: ' + fmt(data.alimony.y2) + '<br>';
    html += '<span class="math-note">' + alMethod + '</span>';
    html += '<div class="math-values">' + data.alimony.result.formula + '</div>';
    html += '</div></div>';
  }

  // Pension
  var penMethod = data.pension.result.method === 'average'
    ? '(Year 1 > Year 2, using 24-month average)'
    : '(Using most recent year / 12)';
  html += '<div class="math-step">';
  html += '<h4>Pension/Retirement Calculation</h4>';
  html += '<div class="math-formula">';
  html += 'Year 1 Total: ' + fmt(data.pension.y1) + '<br>';
  html += 'Year 2 Total: ' + fmt(data.pension.y2) + '<br>';
  html += '<span class="math-note">' + penMethod + '</span>';
  html += '<div class="math-values">' + data.pension.result.formula + '</div>';
  html += '</div></div>';

  // Unemployment (only if non-zero)
  if (data.unemp.y1 > 0 || data.unemp.y2 > 0) {
    var unMethod = data.unemp.result.method === 'average'
      ? '(Year 1 > Year 2, using 24-month average)'
      : '(Using most recent year / 12)';
    html += '<div class="math-step">';
    html += '<h4>Unemployment Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Year 1: ' + fmt(data.unemp.y1) + '<br>';
    html += 'Year 2: ' + fmt(data.unemp.y2) + '<br>';
    html += '<span class="math-note">' + unMethod + '</span>';
    html += '<div class="math-values">' + data.unemp.result.formula + '</div>';
    html += '</div></div>';
  }

  // Social Security
  var ssMethod = data.ss.result.method === 'average'
    ? '(Year 1 > Year 2, using 24-month average)'
    : '(Using most recent year / 12)';
  html += '<div class="math-step">';
  html += '<h4>Social Security Calculation</h4>';
  html += '<div class="math-formula">';
  html += 'Year 1 Total: ' + fmt(data.ss.y1) + '<br>';
  html += 'Year 2 Total: ' + fmt(data.ss.y2) + '<br>';
  html += '<span class="math-note">' + ssMethod + '</span>';
  html += '<div class="math-values">' + data.ss.result.formula + '</div>';
  html += '</div></div>';

  // Combined total
  html += '<div class="math-step highlight">';
  html += '<h4>Total Monthly Income</h4>';
  html += '<div class="math-formula">';
  html += 'W-2: ' + fmt(data.w2.result.monthly) + '<br>';
  if (data.alimony.result.monthly > 0) html += '+ Alimony: ' + fmt(data.alimony.result.monthly) + '<br>';
  html += '+ Pension: ' + fmt(data.pension.result.monthly) + '<br>';
  if (data.unemp.result.monthly > 0) html += '+ Unemployment: ' + fmt(data.unemp.result.monthly) + '<br>';
  html += '+ Social Security: ' + fmt(data.ss.result.monthly) + '<br>';
  html += '<div class="math-values"><strong>Total Monthly: ' + fmt(data.combined) + '</strong></div>';
  html += '</div></div>';

  html += '</div>'; // close .math-steps

  stepsEl.innerHTML = html;
}

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {
  var rows = [
    ['Form 1040 Page 1 Income Calculator'],
    [''],
    ['Section', 'Year 1', 'Year 2', 'Monthly Income'],
    ['W-2 Income',
      pn('w2_1_y1') + pn('w2_2_y1') + pn('w2_3_y1') + pn('w2_4_y1'),
      pn('w2_1_y2') + pn('w2_2_y2') + pn('w2_3_y2') + pn('w2_4_y2'),
      document.getElementById('w2_month').textContent
    ],
    ['Alimony Received',
      pn('alimony1'),
      pn('alimony2'),
      document.getElementById('alimony_month').textContent
    ],
    ['Pension/Annuity',
      pn('pen1_15_y1') + pn('pen1_16_y1') + pn('pen2_15_y1') + pn('pen2_16_y1') + pn('pen3_15_y1') + pn('pen3_16_y1'),
      pn('pen1_15_y2') + pn('pen1_16_y2') + pn('pen2_15_y2') + pn('pen2_16_y2') + pn('pen3_15_y2') + pn('pen3_16_y2'),
      document.getElementById('pension_month').textContent
    ],
    ['Unemployment',
      pn('unemp1'),
      pn('unemp2'),
      document.getElementById('unemp_month').textContent
    ],
    ['Social Security',
      pn('ss1'),
      pn('ss2'),
      document.getElementById('ss_month').textContent
    ],
    [''],
    ['Total Monthly Income', '', '', document.getElementById('combined1040').textContent],
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
  a.download = 'form1040-income-' + Date.now() + '.csv';
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
  inputs.forEach(function (input) { input.value = '0'; });

  IncomeUpload.resetZone();
  calculate();
}

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function () {
  IncomeUpload.init({
    slug:  'income-1040',
    label: '1040',
    maxDocs: 2,
    buildCardBody: function (doc, i) {
      var yearLabel   = doc.taxYear || '?';
      var nameLabel   = doc.filerName || '';
      var filingLabel = doc.filingStatus || '';
      var totalLabel  = (doc.totalIncome != null && doc.totalIncome !== 0) ? fmt(doc.totalIncome) : '--';

      var html = '';
      html += '<div class="doc-card__header">';
      html += '<span class="doc-card__year">' + yearLabel + '</span>';
      if (nameLabel) html += '<span class="doc-card__name">' + IncomeUpload.escHtml(nameLabel) + '</span>';
      if (filingLabel) html += '<span class="doc-card__filing">' + IncomeUpload.escHtml(filingLabel) + '</span>';
      html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
      html += '</div>';
      html += '<div class="doc-card__amounts">';
      html += '<span>Total Income (Line 9): ' + totalLabel + '</span>';
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
