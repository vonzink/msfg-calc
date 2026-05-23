(function () {
  'use strict';

  /* =====================================================
     Schedule B Interest & Dividend Income Calculator
     — field sync, 3-institution calculation
     — upload/cards handled by shared income-upload.js
     — shared utilities via MSFG.IncomeCalc
     ===================================================== */

  const fmt = MSFG.formatCurrency;
  const pn  = MSFG.parseNumById;
  const IC  = MSFG.IncomeCalc;

  // =====================================================
  // FIELD MAPPING — AI → Form Fields
  // =====================================================

  const AI_FIELD_MAP = {
    totalInterest:       'interest',
    taxExemptInterest:   'taxexempt',
    totalDividends:      'dividend'
  };

  /** Clear only the fields that AI auto-fills (Institution 1 line items) */
  function clearAiFields() {
    const fields = ['interest', 'taxexempt', 'dividend'];
    fields.forEach(f => {
      const el1 = document.getElementById('inst1_' + f + '_y1');
      const el2 = document.getElementById('inst1_' + f + '_y2');
      if (el1) el1.value = '0';
      if (el2) el2.value = '0';
    });
  }

  /** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
  function syncFieldsFromDocs() {
    IncomeUpload.getDocStore().forEach((doc, i) => {
      const ySuffix = (i === 0) ? 'y1' : 'y2';

      // If the AI returns an institutions array, use the first one
      const source = (doc.institutions && doc.institutions.length > 0)
        ? doc.institutions[0] : doc;

      Object.keys(AI_FIELD_MAP).forEach(aiKey => {
        IC.setField('inst1_' + AI_FIELD_MAP[aiKey] + '_' + ySuffix, source[aiKey]);
      });
    });
  }

  // =====================================================
  // CALCULATION
  // =====================================================

  function calculate() {
    let totalY1 = 0;
    let totalY2 = 0;

    for (let i = 1; i <= 3; i++) {
      const prefix = 'inst' + i;
      totalY1 += pn(prefix + '_interest_y1') + pn(prefix + '_taxexempt_y1') + pn(prefix + '_dividend_y1');
      totalY2 += pn(prefix + '_interest_y2') + pn(prefix + '_taxexempt_y2') + pn(prefix + '_dividend_y2');
    }

    const result = IC.policyCalc(totalY1, totalY2);

    IC.setResult('totalYear1', totalY1);
    IC.setResult('totalYear2', totalY2);
    IC.setResult('incomeToUse', result.monthly);

    updateMathSteps({
      totalY1, totalY2,
      monthly: result.monthly,
      method: result.method,
      hasYr2: totalY2 !== 0
    });
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(data) {
    const stepsEl = document.getElementById('calcSteps-income-schedule-b');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

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
    for (let i = 1; i <= 3; i++) {
      const prefix = 'inst' + i;
      const intY1  = pn(prefix + '_interest_y1');
      const intY2  = pn(prefix + '_interest_y2');
      const texY1  = pn(prefix + '_taxexempt_y1');
      const texY2  = pn(prefix + '_taxexempt_y2');
      const divY1  = pn(prefix + '_dividend_y1');
      const divY2  = pn(prefix + '_dividend_y2');
      const instY1 = intY1 + texY1 + divY1;
      const instY2 = intY2 + texY2 + divY2;

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

    // Monthly result
    html += '<div class="math-step highlight">';
    html += '<h4>Monthly Qualifying Income</h4>';
    html += '<div class="math-formula">';
    html += 'Total Year 1: ' + fmt(data.totalY1) + '<br>';
    html += 'Total Year 2: ' + fmt(data.totalY2) + '<br>';
    html += 'Method: ' + IC.methodLabel(data.method) + '<br>';

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
    html += '</div>';
    stepsEl.innerHTML = html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    let totalY1 = 0;
    let totalY2 = 0;

    const rows = [
      ['Schedule B Interest & Dividend Income Calculator'],
      [''],
      ['Institution', 'Type', 'Year 1', 'Year 2']
    ];

    for (let i = 1; i <= 3; i++) {
      const prefix = 'inst' + i;
      const intY1  = pn(prefix + '_interest_y1');
      const intY2  = pn(prefix + '_interest_y2');
      const texY1  = pn(prefix + '_taxexempt_y1');
      const texY2  = pn(prefix + '_taxexempt_y2');
      const divY1  = pn(prefix + '_dividend_y1');
      const divY2  = pn(prefix + '_dividend_y2');

      rows.push(['Institution ' + i, 'Interest', intY1, intY2]);
      rows.push(['Institution ' + i, 'Tax-Exempt Interest', texY1, texY2]);
      rows.push(['Institution ' + i, 'Dividends', divY1, divY2]);

      totalY1 += intY1 + texY1 + divY1;
      totalY2 += intY2 + texY2 + divY2;
    }

    const hasYr2 = totalY2 !== 0;
    const monthly = (hasYr2 && totalY1 > totalY2) ? (totalY1 + totalY2) / 24 : totalY1 / 12;

    rows.push(['']);
    rows.push(['Totals', '', totalY1, totalY2]);
    rows.push(['Monthly Qualifying Income', '', '', monthly]);
    rows.push(['']);
    rows.push(['Generated', new Date().toLocaleString()]);

    IC.downloadCSV(rows, 'schedule-b-income-');
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
      slug:  'income-schedule-b',
      label: 'Schedule B',
      maxDocs: 2,
      buildCardBody: (doc, i) => {
        const yearLabel = doc.taxYear || '?';
        const totalInt  = (doc.totalInterest != null) ? fmt(doc.totalInterest) : '--';
        const totalDiv  = (doc.totalDividends != null) ? fmt(doc.totalDividends) : '--';

        let html = '';
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
