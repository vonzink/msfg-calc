(function () {
  'use strict';

  /* =====================================================
     Schedule C Sole Proprietorship Income Calculator
     — AI upload via shared IncomeUpload module
     — field sync, dual-business calculation
     — shared utilities via MSFG.IncomeCalc
     ===================================================== */

  const fmt = MSFG.formatCurrency;
  const pn  = MSFG.parseNumById;
  const IC  = MSFG.IncomeCalc;

  // =====================================================
  // FIELD MAPPING — AI → Form Fields
  // =====================================================

  const AI_FIELD_MAP = {
    netProfit:            '_np',
    otherIncome:          '_oth',
    depletion:            '_depl',
    depreciation:         '_depr',
    mealsEntertainment:   '_meals',
    businessUseOfHome:    '_home'
  };

  /** Clear only the fields that AI auto-fills */
  function clearAiFields() {
    const prefix = 'b1';
    const fields = ['np', 'oth', 'depl', 'depr', 'meals', 'home'];
    fields.forEach(f => {
      const el1 = document.getElementById(prefix + '_' + f + '1');
      const el2 = document.getElementById(prefix + '_' + f + '2');
      if (el1) el1.value = '0';
      if (el2) el2.value = '0';
    });
  }

  /** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
  function syncFieldsFromDocs() {
    const prefix = 'b1';
    IncomeUpload.getDocStore().forEach((doc, i) => {
      const ySuffix = (i === 0) ? '1' : '2';
      Object.keys(AI_FIELD_MAP).forEach(aiKey => {
        IC.setField(prefix + AI_FIELD_MAP[aiKey] + ySuffix, doc[aiKey]);
      });
    });
  }

  // =====================================================
  // BUSINESS CALCULATION
  // =====================================================

  function computeBusiness(prefix) {
    const np1    = pn(prefix + '_np1');
    const np2    = pn(prefix + '_np2');
    const oth1   = pn(prefix + '_oth1');
    const oth2   = pn(prefix + '_oth2');
    const depl1  = pn(prefix + '_depl1');
    const depl2  = pn(prefix + '_depl2');
    const depr1  = pn(prefix + '_depr1');
    const depr2  = pn(prefix + '_depr2');
    const meals1 = pn(prefix + '_meals1');
    const meals2 = pn(prefix + '_meals2');
    const home1  = pn(prefix + '_home1');
    const home2  = pn(prefix + '_home2');
    const mile1  = pn(prefix + '_mile1');
    const mile2  = pn(prefix + '_mile2');
    const amort1 = pn(prefix + '_amort1');
    const amort2 = pn(prefix + '_amort2');

    const sum1 = np1 + oth1 + depl1 + depr1 + home1 + mile1 + amort1;
    const sum2 = np2 + oth2 + depl2 + depr2 + home2 + mile2 + amort2;
    const year1 = sum1 - meals1;
    const year2 = sum2 - meals2;

    const hasYr2 = [np2, oth2, depl2, depr2, meals2, home2, mile2, amort2]
      .some(v => v !== 0);

    const result = IC.policyCalc(year1, hasYr2 ? year2 : 0);

    return {
      year1, year2, sum1, sum2,
      monthly: result.monthly, method: result.method,
      meals1, meals2
    };
  }

  // =====================================================
  // MAIN CALCULATION
  // =====================================================

  function calculate() {
    const b1 = computeBusiness('b1');
    IC.setResult('b1_year1', b1.year1);
    IC.setResult('b1_year2', b1.year2);
    IC.setResult('b1_month', b1.monthly);
    IC.setResult('result_b1', b1.monthly);

    const b2 = computeBusiness('b2');
    IC.setResult('b2_year1', b2.year1);
    IC.setResult('b2_year2', b2.year2);
    IC.setResult('b2_month', b2.monthly);
    IC.setResult('result_b2', b2.monthly);

    const combined = b1.monthly + b2.monthly;
    IC.setResult('combined_c', combined);

    updateMathSteps({ b1, b2, combined });
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(data) {
    const stepsEl = document.getElementById('calcSteps-income-schedule-c');
    if (!stepsEl) return;

    const { b1, b2, combined } = data;

    let html = '<div class="math-steps">';

    // Formula reference
    html += '<div class="math-step">';
    html += '<h4>Schedule C Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<span class="math-note">For each business:</span>';
    html += '<div class="math-values">';
    html += 'Annual = Net Profit + Other Income + Depletion + Depreciation<br>';
    html += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; + Business Use of Home + Mileage Depr + Amortization<br>';
    html += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; &minus; Meals &amp; Entertainment<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    // Business 1
    html += buildBizStep('Business 1', b1);

    // Business 2 (only if has values)
    const b2HasData = b2.year1 !== 0 || b2.year2 !== 0;
    if (b2HasData) {
      html += buildBizStep('Business 2', b2);
    }

    // Combined total
    html += '<div class="math-step highlight">';
    html += '<h4>Total Monthly Income</h4>';
    html += '<div class="math-formula">';
    html += 'Business 1: ' + fmt(b1.monthly) + '<br>';
    if (b2HasData) {
      html += '+ Business 2: ' + fmt(b2.monthly) + '<br>';
    }
    html += '<div class="math-values"><strong>Total Monthly: ' + fmt(combined) + '</strong></div>';
    html += '</div></div>';

    html += '</div>';
    stepsEl.innerHTML = html;
  }

  function buildBizStep(label, d) {
    let html = '<div class="math-step">';
    html += '<h4>' + label + ' Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Subtotal Year 1: ' + fmt(d.sum1) + '<br>';
    html += 'Subtotal Year 2: ' + fmt(d.sum2) + '<br>';
    html += 'Less Meals: ' + fmt(d.meals1) + ' / ' + fmt(d.meals2) + '<br>';
    html += '<div class="math-values">';
    html += 'Year 1 = ' + fmt(d.sum1) + ' &minus; ' + fmt(d.meals1) + ' = ' + fmt(d.year1) + '<br>';
    html += 'Year 2 = ' + fmt(d.sum2) + ' &minus; ' + fmt(d.meals2) + ' = ' + fmt(d.year2) + '<br>';
    html += 'Method: ' + IC.methodLabel(d.method) + '<br>';
    html += '<strong>Monthly: ' + fmt(d.monthly) + '</strong>';
    html += '</div></div></div>';
    return html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    const b1 = computeBusiness('b1');
    const b2 = computeBusiness('b2');
    const combined = b1.monthly + b2.monthly;

    IC.downloadCSV([
      ['Schedule C Sole Proprietorship Income Calculator'],
      [''],
      ['Business', 'Year 1 Income', 'Year 2 Income', 'Monthly Income'],
      ['Business 1', b1.year1, b1.year2, b1.monthly],
      ['Business 2', b2.year1, b2.year2, b2.monthly],
      [''],
      ['Total Monthly Income', '', '', combined],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'schedule-c-income-');
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
      slug:  'income-schedule-c',
      label: 'Schedule C',
      maxDocs: 2,
      buildCardBody: (doc, i) => {
        const yearLabel  = doc.taxYear || '?';
        const nameLabel  = doc.businessName || '';
        const totalLabel = (doc.netProfit != null && doc.netProfit !== 0) ? fmt(doc.netProfit) : '--';

        let html = '';
        html += '<div class="doc-card__header">';
        html += '<span class="doc-card__year">' + yearLabel + '</span>';
        if (nameLabel) html += '<span class="doc-card__name">' + IncomeUpload.escHtml(nameLabel) + '</span>';
        html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
        html += '</div>';
        html += '<div class="doc-card__amounts">';
        html += '<span>Net Profit (Line 31): ' + totalLabel + '</span>';
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
