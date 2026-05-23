(function () {
  'use strict';

  /* =====================================================
     Schedule D Capital Gains/Losses Income Calculator
     — field sync, capital gains calculation
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
    shortTermGainLoss: 'd_stcg',
    longTermGainLoss:  'd_ltcg'
  };

  /** Clear only the fields that AI auto-fills */
  function clearAiFields() {
    const fields = ['d_stcg', 'd_ltcg'];
    fields.forEach(f => {
      const el1 = document.getElementById(f + '1');
      const el2 = document.getElementById(f + '2');
      if (el1) el1.value = '0';
      if (el2) el2.value = '0';
    });
  }

  /** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
  function syncFieldsFromDocs() {
    IncomeUpload.getDocStore().forEach((doc, i) => {
      const ySuffix = (i === 0) ? '1' : '2';
      Object.keys(AI_FIELD_MAP).forEach(aiKey => {
        IC.setField(AI_FIELD_MAP[aiKey] + ySuffix, doc[aiKey]);
      });
    });
  }

  // =====================================================
  // CALCULATION
  // =====================================================

  function calculate() {
    const stcg1 = pn('d_stcg1');
    const stcg2 = pn('d_stcg2');
    const ltcg1 = pn('d_ltcg1');
    const ltcg2 = pn('d_ltcg2');

    const total1 = stcg1 + ltcg1;
    // Pass 0 for year2 if no year 2 data, so policyCalc treats it as single-year
    const hasYr2 = (stcg2 !== 0 || ltcg2 !== 0);
    const total2 = hasYr2 ? stcg2 + ltcg2 : 0;

    const result = IC.policyCalc(total1, total2);

    // Display results
    IC.setResult('d_total1', total1);
    IC.setResult('d_total2', stcg2 + ltcg2);
    IC.setResult('d_monthly', result.monthly);

    updateMathSteps({
      stcg1, stcg2, ltcg1, ltcg2,
      total1, total2: stcg2 + ltcg2,
      monthly: result.monthly, method: result.method,
      hasYr2
    });
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(d) {
    const stepsEl = document.getElementById('calcSteps-income-schedule-d');
    if (!stepsEl) return;

    let html = '';
    html += '<div class="math-steps">';

    // Formula reference
    html += '<div class="math-step">';
    html += '<h4>Capital Gains Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<span class="math-note">For each tax year:</span>';
    html += '<div class="math-values">';
    html += 'Total = Short-Term Gain/Loss + Long-Term Gain/Loss<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    // Year 1
    html += '<div class="math-step">';
    html += '<h4>Year 1 (Most Recent)</h4>';
    html += '<div class="math-formula">';
    html += 'Short-Term: ' + fmt(d.stcg1) + '<br>';
    html += 'Long-Term: ' + fmt(d.ltcg1) + '<br>';
    html += '<div class="math-values">';
    html += 'Year 1 Total = ' + fmt(d.stcg1) + ' + ' + fmt(d.ltcg1) + ' = ' + fmt(d.total1);
    html += '</div></div></div>';

    // Year 2 (only if has values)
    if (d.hasYr2) {
      html += '<div class="math-step">';
      html += '<h4>Year 2 (Prior)</h4>';
      html += '<div class="math-formula">';
      html += 'Short-Term: ' + fmt(d.stcg2) + '<br>';
      html += 'Long-Term: ' + fmt(d.ltcg2) + '<br>';
      html += '<div class="math-values">';
      html += 'Year 2 Total = ' + fmt(d.stcg2) + ' + ' + fmt(d.ltcg2) + ' = ' + fmt(d.total2);
      html += '</div></div></div>';
    }

    // Monthly result
    html += '<div class="math-step highlight">';
    html += '<h4>Monthly Income</h4>';
    html += '<div class="math-formula">';
    html += 'Method: ' + IC.methodLabel(d.method) + '<br>';
    if (d.method === 'average') {
      html += '(' + fmt(d.total1) + ' + ' + fmt(d.total2) + ') / 24<br>';
    } else {
      html += fmt(d.total1) + ' / 12<br>';
    }
    html += '<div class="math-values"><strong>Monthly Income: ' + fmt(d.monthly) + '</strong></div>';
    html += '</div></div>';

    html += '</div>'; // close .math-steps
    stepsEl.innerHTML = html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    const stcg1 = pn('d_stcg1');
    const stcg2 = pn('d_stcg2');
    const ltcg1 = pn('d_ltcg1');
    const ltcg2 = pn('d_ltcg2');
    const total1 = stcg1 + ltcg1;
    const total2 = stcg2 + ltcg2;
    const hasYr2 = (stcg2 !== 0 || ltcg2 !== 0);
    const monthly = (hasYr2 && total1 > total2) ? (total1 + total2) / 24 : total1 / 12;

    IC.downloadCSV([
      ['Schedule D Capital Gains/Losses Income Calculator'],
      [''],
      ['Description', 'Year 1 (Most Recent)', 'Year 2 (Prior)'],
      ['Short-Term Capital Gain/Loss', stcg1, stcg2],
      ['Long-Term Capital Gain/Loss', ltcg1, ltcg2],
      [''],
      ['Year 1 Total', total1, ''],
      ['Year 2 Total', '', total2],
      ['Monthly Income', monthly, ''],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'schedule-d-income-');
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
      slug:  'income-schedule-d',
      label: 'Schedule D',
      maxDocs: 2,
      buildCardBody: (doc, i) => {
        const yearLabel = doc.taxYear || '?';
        const stcg = doc.shortTermGainLoss != null ? fmt(doc.shortTermGainLoss) : '--';
        const ltcg = doc.longTermGainLoss != null ? fmt(doc.longTermGainLoss) : '--';

        let html = '';
        html += '<div class="doc-card__header">';
        html += '<span class="doc-card__year">' + yearLabel + '</span>';
        html += '<span class="doc-card__name">Schedule D</span>';
        html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
        html += '</div>';
        html += '<div class="doc-card__amounts">';
        html += '<span>ST: ' + stcg + '</span>';
        html += '<span>LT: ' + ltcg + '</span>';
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

  // Expose to window for delegated event handler in utils.js
  window.calculate = calculate;
  window.exportCSV = exportCSV;
  window.clearAll = clearAll;

})();
