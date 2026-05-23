(function () {
  'use strict';

  /* =====================================================
     Form 1120S S-Corporation Income Calculator
     — AI upload via shared IncomeUpload module
     — field sync, dual S-Corp calculation
     — shared utilities via MSFG.IncomeCalc
     ===================================================== */

  const fmt = MSFG.formatCurrency;
  const pn  = MSFG.parseNumById;
  const IC  = MSFG.IncomeCalc;

  // =====================================================
  // FIELD MAPPING — AI → Form Fields
  // =====================================================

  const AI_FIELD_MAP = {
    netGainLoss:         'net',
    otherIncome:         'oth',
    depreciation:        'dep',
    depletion:           'depl',
    amortization:        'amort',
    mortgagesPayable:    'mort',
    mealsEntertainment:  'meals'
  };

  /** Clear only the fields that AI auto-fills */
  function clearAiFields() {
    const prefix = 'c1';
    const fields = ['net', 'oth', 'dep', 'depl', 'amort', 'mort', 'meals'];
    fields.forEach(f => {
      const el1 = document.getElementById(prefix + '_' + f + '1');
      const el2 = document.getElementById(prefix + '_' + f + '2');
      if (el1) el1.value = '0';
      if (el2) el2.value = '0';
    });
  }

  /** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
  function syncFieldsFromDocs() {
    const prefix = 'c1';
    IncomeUpload.getDocStore().forEach((doc, i) => {
      const ySuffix = (i === 0) ? '1' : '2';
      Object.keys(AI_FIELD_MAP).forEach(aiKey => {
        IC.setField(prefix + '_' + AI_FIELD_MAP[aiKey] + ySuffix, doc[aiKey]);
      });
    });
  }

  // =====================================================
  // S-CORPORATION CALCULATION
  // =====================================================

  function computeCorp(prefix) {
    const net1   = pn(prefix + '_net1');
    const net2   = pn(prefix + '_net2');
    const oth1   = pn(prefix + '_oth1');
    const oth2   = pn(prefix + '_oth2');
    const dep1   = pn(prefix + '_dep1');
    const dep2   = pn(prefix + '_dep2');
    const depl1  = pn(prefix + '_depl1');
    const depl2  = pn(prefix + '_depl2');
    const amort1 = pn(prefix + '_amort1');
    const amort2 = pn(prefix + '_amort2');
    const mort1  = pn(prefix + '_mort1');
    const mort2  = pn(prefix + '_mort2');
    const meals1 = pn(prefix + '_meals1');
    const meals2 = pn(prefix + '_meals2');
    const own    = pn(prefix + '_owner') / 100;

    const sum1 = net1 + oth1 + dep1 + depl1 + amort1;
    const sum2 = net2 + oth2 + dep2 + depl2 + amort2;
    const year1 = sum1 - mort1 - meals1;
    const year2 = sum2 - mort2 - meals2;

    const hasYr2 = [net2, oth2, dep2, depl2, amort2, mort2, meals2]
      .some(v => v !== 0);

    // Ownership applied AFTER averaging (per 1120S underwriting rules)
    const result = IC.policyCalc(year1, hasYr2 ? year2 : 0);
    const monthly = result.monthly * own;

    return {
      year1, year2, sum1, sum2,
      monthly, method: result.method,
      mort1, mort2, meals1, meals2,
      own: own * 100
    };
  }

  // =====================================================
  // MAIN CALCULATION
  // =====================================================

  function calculate() {
    const c1 = computeCorp('c1');
    document.getElementById('c1_year1').textContent = fmt(c1.year1);
    document.getElementById('c1_year2').textContent = fmt(c1.year2);
    document.getElementById('c1_month').textContent = fmt(c1.monthly);
    document.getElementById('result_c1').textContent = fmt(c1.monthly);

    const c2 = computeCorp('c2');
    document.getElementById('c2_year1').textContent = fmt(c2.year1);
    document.getElementById('c2_year2').textContent = fmt(c2.year2);
    document.getElementById('c2_month').textContent = fmt(c2.monthly);
    document.getElementById('result_c2').textContent = fmt(c2.monthly);

    const combined = c1.monthly + c2.monthly;
    document.getElementById('combined1120s').textContent = fmt(combined);

    updateMathSteps(c1, c2, combined);
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(c1, c2, combined) {
    const stepsEl = document.getElementById('calcSteps-income-1120s');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    // Formula reference
    html += '<div class="math-step">';
    html += '<h4>S-Corporation Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<span class="math-note">For each S-Corporation:</span>';
    html += '<div class="math-values">';
    html += 'Subtotal = Net Gain + Other + Depreciation + Depletion + Amortization<br>';
    html += 'Annual = Subtotal &minus; Mortgages &minus; Meals<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = ((Year 1 + Year 2) / 24) &times; Ownership %<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 / 12) &times; Ownership %';
    html += '</div></div></div>';

    // S-Corp 1
    html += buildCorpStep('S-Corporation 1', c1);

    // S-Corp 2 (only if has values)
    const c2HasData = c2.year1 !== 0 || c2.year2 !== 0;
    if (c2HasData) {
      html += buildCorpStep('S-Corporation 2', c2);
    }

    // Combined total
    html += '<div class="math-step highlight">';
    html += '<h4>Total Monthly Income</h4>';
    html += '<div class="math-formula">';
    html += 'S-Corp 1: ' + fmt(c1.monthly) + '<br>';
    if (c2HasData) {
      html += '+ S-Corp 2: ' + fmt(c2.monthly) + '<br>';
    }
    html += '<div class="math-values"><strong>Total Monthly: ' + fmt(combined) + '</strong></div>';
    html += '</div></div>';

    html += '</div>';
    stepsEl.innerHTML = html;
  }

  function buildCorpStep(label, c) {
    let html = '<div class="math-step">';
    html += '<h4>' + label + ' Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Subtotal Year 1: ' + fmt(c.sum1) + '<br>';
    html += 'Subtotal Year 2: ' + fmt(c.sum2) + '<br>';
    html += 'Less Mortgages: ' + fmt(c.mort1) + ' / ' + fmt(c.mort2) + '<br>';
    html += 'Less Meals: ' + fmt(c.meals1) + ' / ' + fmt(c.meals2) + '<br>';
    html += 'Ownership: ' + c.own + '%<br>';
    html += '<div class="math-values">';
    html += 'Year 1 = ' + fmt(c.sum1) + ' &minus; ' + fmt(c.mort1) + ' &minus; ' + fmt(c.meals1) + ' = ' + fmt(c.year1) + '<br>';
    html += 'Year 2 = ' + fmt(c.sum2) + ' &minus; ' + fmt(c.mort2) + ' &minus; ' + fmt(c.meals2) + ' = ' + fmt(c.year2) + '<br>';
    html += 'Method: ' + IC.methodLabel(c.method) + '<br>';
    html += '<strong>Monthly: ' + fmt(c.monthly) + '</strong>';
    html += '</div></div></div>';
    return html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    const c1 = computeCorp('c1');
    const c2 = computeCorp('c2');
    const combined = c1.monthly + c2.monthly;

    IC.downloadCSV([
      ['Form 1120S S-Corporation Income Calculator'],
      [''],
      ['Corporation', 'Year 1 Income', 'Year 2 Income', 'Ownership %', 'Monthly Income'],
      ['S-Corp 1', c1.year1, c1.year2, c1.own, c1.monthly],
      ['S-Corp 2', c2.year1, c2.year2, c2.own, c2.monthly],
      [''],
      ['Total Monthly Income', '', '', '', combined],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'form1120s-income-');
  }

  // =====================================================
  // CLEAR ALL
  // =====================================================

  function clearAll() {
    IC.clearAll(calculate, { '*owner': '100' });
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  document.addEventListener('DOMContentLoaded', () => {
    IncomeUpload.init({
      slug:  'income-1120s',
      label: '1120S',
      maxDocs: 2,
      buildCardBody: (doc, i) => {
        const yearLabel  = doc.taxYear || '?';
        const nameLabel  = doc.corporationName || '';
        const einLabel   = doc.ein || '';
        const totalLabel = (doc.totalIncome != null && doc.totalIncome !== 0) ? fmt(doc.totalIncome) : '--';

        let html = '';
        html += '<div class="doc-card__header">';
        html += '<span class="doc-card__year">' + yearLabel + '</span>';
        if (nameLabel) html += '<span class="doc-card__name">' + IncomeUpload.escHtml(nameLabel) + '</span>';
        if (einLabel) html += '<span class="doc-card__filing">EIN: ' + IncomeUpload.escHtml(einLabel) + '</span>';
        html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
        html += '</div>';
        html += '<div class="doc-card__amounts">';
        html += '<span>Total Income (Line 6): ' + totalLabel + '</span>';
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
