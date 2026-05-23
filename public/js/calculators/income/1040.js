(function () {
  'use strict';

  /* =====================================================
     Form 1040 Page 1 Income Calculator
     — AI upload via shared IncomeUpload module
     — field sync, multi-category policy-based calculation
     — shared utilities via MSFG.IncomeCalc
     ===================================================== */

  const fmt = MSFG.formatCurrency;
  const pn  = MSFG.parseNumById;
  const IC  = MSFG.IncomeCalc;

  // =====================================================
  // FIELD MAPPING — AI → Form Fields
  // =====================================================

  /** Clear only the fields that AI auto-fills (Employer 1 + single-row fields) */
  function clearAiFields() {
    const ids = [
      'w2_1_y1', 'w2_1_y2',
      'alimony1', 'alimony2',
      'pen1_15_y1', 'pen1_15_y2',
      'pen1_16_y1', 'pen1_16_y2',
      'unemp1', 'unemp2',
      'ss1', 'ss2'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '0';
    });
  }

  /** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
  function syncFieldsFromDocs() {
    IncomeUpload.getDocStore().forEach((doc, i) => {
      const ySuffix = (i === 0) ? '1' : '2';
      const yField  = (i === 0) ? 'y1' : 'y2';

      IC.setField('w2_1_' + yField, doc.wages);
      IC.setField('alimony' + ySuffix, doc.alimony);
      IC.setField('pen1_15_' + yField, doc.iraDistributionsTaxable);
      IC.setField('pen1_16_' + yField, doc.pensionsAnnuitiesTaxable);
      IC.setField('unemp' + ySuffix, doc.unemployment);
      IC.setField('ss' + ySuffix, doc.socialSecurity);
    });
  }

  // =====================================================
  // MAIN CALCULATION
  // =====================================================

  function calculate() {
    // W-2 section (4 employer slots)
    const w2_y1 = pn('w2_1_y1') + pn('w2_2_y1') + pn('w2_3_y1') + pn('w2_4_y1');
    const w2_y2 = pn('w2_1_y2') + pn('w2_2_y2') + pn('w2_3_y2') + pn('w2_4_y2');
    const w2_result = IC.policyCalc(w2_y1, w2_y2);
    IC.setResult('w2_month', w2_result.monthly);
    IC.setResult('result_w2', w2_result.monthly);

    // Alimony
    const al_y1 = pn('alimony1');
    const al_y2 = pn('alimony2');
    const al_result = IC.policyCalc(al_y1, al_y2);
    IC.setResult('alimony_month', al_result.monthly);
    IC.setResult('result_alimony', al_result.monthly);

    // Pension/annuity (3 pension slots, each with IRA + Pensions lines)
    const pen_y1 = pn('pen1_15_y1') + pn('pen1_16_y1') +
                   pn('pen2_15_y1') + pn('pen2_16_y1') +
                   pn('pen3_15_y1') + pn('pen3_16_y1');
    const pen_y2 = pn('pen1_15_y2') + pn('pen1_16_y2') +
                   pn('pen2_15_y2') + pn('pen2_16_y2') +
                   pn('pen3_15_y2') + pn('pen3_16_y2');
    const pen_result = IC.policyCalc(pen_y1, pen_y2);
    IC.setResult('pension_month', pen_result.monthly);
    IC.setResult('result_pension', pen_result.monthly);

    // Unemployment
    const un_y1 = pn('unemp1');
    const un_y2 = pn('unemp2');
    const un_result = IC.policyCalc(un_y1, un_y2);
    IC.setResult('unemp_month', un_result.monthly);
    IC.setResult('result_unemp', un_result.monthly);

    // Social Security
    const ss_y1 = pn('ss1');
    const ss_y2 = pn('ss2');
    const ss_result = IC.policyCalc(ss_y1, ss_y2);
    IC.setResult('ss_month', ss_result.monthly);
    IC.setResult('result_ss', ss_result.monthly);

    // Combined
    const combined = w2_result.monthly + al_result.monthly + pen_result.monthly +
                     un_result.monthly + ss_result.monthly;
    IC.setResult('combined1040', combined);

    updateMathSteps({
      w2:      { y1: w2_y1,  y2: w2_y2,  result: w2_result },
      alimony: { y1: al_y1,  y2: al_y2,  result: al_result },
      pension: { y1: pen_y1, y2: pen_y2, result: pen_result },
      unemp:   { y1: un_y1,  y2: un_y2,  result: un_result },
      ss:      { y1: ss_y1,  y2: ss_y2,  result: ss_result },
      combined
    });
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(data) {
    const stepsEl = document.getElementById('calcSteps-income-1040');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    // Policy reference
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
    html += '<div class="math-step">';
    html += '<h4>W-2 Income Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Year 1 Total: ' + fmt(data.w2.y1) + '<br>';
    if (data.w2.y2 !== 0) html += 'Year 2 Total: ' + fmt(data.w2.y2) + '<br>';
    html += '<span class="math-note">' + IC.methodLabel(data.w2.result.method) + '</span>';
    html += '<div class="math-values">' + data.w2.result.formula + '</div>';
    html += '</div></div>';

    // Alimony (only if non-zero)
    if (data.alimony.y1 > 0 || data.alimony.y2 > 0) {
      html += '<div class="math-step">';
      html += '<h4>Alimony Calculation</h4>';
      html += '<div class="math-formula">';
      html += 'Year 1: ' + fmt(data.alimony.y1) + '<br>';
      if (data.alimony.y2 !== 0) html += 'Year 2: ' + fmt(data.alimony.y2) + '<br>';
      html += '<span class="math-note">' + IC.methodLabel(data.alimony.result.method) + '</span>';
      html += '<div class="math-values">' + data.alimony.result.formula + '</div>';
      html += '</div></div>';
    }

    // Pension
    html += '<div class="math-step">';
    html += '<h4>Pension/Retirement Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Year 1 Total: ' + fmt(data.pension.y1) + '<br>';
    if (data.pension.y2 !== 0) html += 'Year 2 Total: ' + fmt(data.pension.y2) + '<br>';
    html += '<span class="math-note">' + IC.methodLabel(data.pension.result.method) + '</span>';
    html += '<div class="math-values">' + data.pension.result.formula + '</div>';
    html += '</div></div>';

    // Unemployment (only if non-zero)
    if (data.unemp.y1 > 0 || data.unemp.y2 > 0) {
      html += '<div class="math-step">';
      html += '<h4>Unemployment Calculation</h4>';
      html += '<div class="math-formula">';
      html += 'Year 1: ' + fmt(data.unemp.y1) + '<br>';
      if (data.unemp.y2 !== 0) html += 'Year 2: ' + fmt(data.unemp.y2) + '<br>';
      html += '<span class="math-note">' + IC.methodLabel(data.unemp.result.method) + '</span>';
      html += '<div class="math-values">' + data.unemp.result.formula + '</div>';
      html += '</div></div>';
    }

    // Social Security
    html += '<div class="math-step">';
    html += '<h4>Social Security Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Year 1 Total: ' + fmt(data.ss.y1) + '<br>';
    if (data.ss.y2 !== 0) html += 'Year 2 Total: ' + fmt(data.ss.y2) + '<br>';
    html += '<span class="math-note">' + IC.methodLabel(data.ss.result.method) + '</span>';
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

    html += '</div>';
    stepsEl.innerHTML = html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    IC.downloadCSV([
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
    ], 'form1040-income-');
  }

  // =====================================================
  // CLEAR ALL
  // =====================================================

  function clearAll() {
    IC.clearAll(calculate);
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  document.addEventListener('DOMContentLoaded', () => {
    IncomeUpload.init({
      slug:  'income-1040',
      label: '1040',
      maxDocs: 2,
      buildCardBody: (doc, i) => {
        const yearLabel   = doc.taxYear || '?';
        const nameLabel   = doc.filerName || '';
        const filingLabel = doc.filingStatus || '';
        const totalLabel  = (doc.totalIncome != null && doc.totalIncome !== 0) ? fmt(doc.totalIncome) : '--';

        let html = '';
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
      onAfterSync: () => {
        clearAiFields();
        syncFieldsFromDocs();
        calculate();
      },
      onRemove: () => {
        clearAiFields();
        if (IncomeUpload.getDocStore().length > 0) syncFieldsFromDocs();
        calculate();
      }
    });

    IC.initPage(calculate);
  });

  window.calculate = calculate;
  window.exportCSV = exportCSV;
  window.clearAll = clearAll;

})();
