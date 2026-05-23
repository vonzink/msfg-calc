(function () {
  'use strict';

  /* =====================================================
     Form 1065 Partnership Income Calculator
     — AI upload via shared IncomeUpload module
     — field sync, dual-partnership calculation
     — shared utilities via MSFG.IncomeCalc
     ===================================================== */

  const fmt = MSFG.formatCurrency;
  const pn  = MSFG.parseNumById;
  const IC  = MSFG.IncomeCalc;

  // =====================================================
  // FIELD MAPPING — AI → Form Fields
  // =====================================================

  const AI_FIELD_MAP = {
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

  /** Clear only the fields that AI auto-fills */
  function clearAiFields() {
    const prefix = 'p1';
    const fields = ['ord', 'farm', 'gain', 'oth', 'dep', 'depl', 'amort', 'mort', 'meals'];
    fields.forEach(f => {
      const el1 = document.getElementById(prefix + '_' + f + '1');
      const el2 = document.getElementById(prefix + '_' + f + '2');
      if (el1) el1.value = '0';
      if (el2) el2.value = '0';
    });
  }

  /** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
  function syncFieldsFromDocs() {
    const prefix = 'p1';
    IncomeUpload.getDocStore().forEach((doc, i) => {
      const ySuffix = (i === 0) ? '1' : '2';
      Object.keys(AI_FIELD_MAP).forEach(aiKey => {
        IC.setField(prefix + '_' + AI_FIELD_MAP[aiKey] + ySuffix, doc[aiKey]);
      });
    });
  }

  // =====================================================
  // PARTNERSHIP CALCULATION
  // =====================================================

  function computePartnership(prefix) {
    const ord1   = pn(prefix + '_ord1');
    const ord2   = pn(prefix + '_ord2');
    const farm1  = pn(prefix + '_farm1');
    const farm2  = pn(prefix + '_farm2');
    const gain1  = pn(prefix + '_gain1');
    const gain2  = pn(prefix + '_gain2');
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

    const sum1 = ord1 + farm1 + gain1 + oth1 + dep1 + depl1 + amort1;
    const sum2 = ord2 + farm2 + gain2 + oth2 + dep2 + depl2 + amort2;

    const total1 = (sum1 - mort1 - meals1) * own;
    const total2 = (sum2 - mort2 - meals2) * own;

    const hasYr2 = [ord2, farm2, gain2, oth2, dep2, depl2, amort2, mort2, meals2]
      .some(v => v !== 0);

    const result = IC.policyCalc(total1, hasYr2 ? total2 : 0);

    return {
      sum1, sum2, total1, total2,
      monthly: result.monthly, method: result.method,
      mort1, mort2, meals1, meals2,
      own: own * 100
    };
  }

  // =====================================================
  // MAIN CALCULATION
  // =====================================================

  function calculate() {
    const p1 = computePartnership('p1');
    IC.setResult('p1_year1', p1.total1);
    IC.setResult('p1_year2', p1.total2);
    IC.setResult('p1_month', p1.monthly);
    IC.setResult('result_p1', p1.monthly);

    const p2 = computePartnership('p2');
    IC.setResult('p2_year1', p2.total1);
    IC.setResult('p2_year2', p2.total2);
    IC.setResult('p2_month', p2.monthly);
    IC.setResult('result_p2', p2.monthly);

    const combined = p1.monthly + p2.monthly;
    IC.setResult('combined1065', combined);

    updateMathSteps(p1, p2, combined);
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(p1, p2, combined) {
    const stepsEl = document.getElementById('calcSteps-income-1065');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    // Formula reference
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

    html += buildPartnershipStep('Partnership 1', p1);

    const p2HasData = p2.sum1 !== 0 || p2.sum2 !== 0 || p2.mort1 !== 0 || p2.meals1 !== 0;
    if (p2HasData) {
      html += buildPartnershipStep('Partnership 2', p2);
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

  function buildPartnershipStep(label, p) {
    let html = '<div class="math-step">';
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
    html += 'Method: ' + IC.methodLabel(p.method) + '<br>';
    html += '<strong>Monthly: ' + fmt(p.monthly) + '</strong>';
    html += '</div></div></div>';
    return html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    const p1 = computePartnership('p1');
    const p2 = computePartnership('p2');
    const combined = p1.monthly + p2.monthly;

    IC.downloadCSV([
      ['Form 1065 Partnership Income Calculator'],
      [''],
      ['Partnership', 'Year 1 Income', 'Year 2 Income', 'Ownership %', 'Monthly Income'],
      ['Partnership 1', p1.total1, p1.total2, p1.own, p1.monthly],
      ['Partnership 2', p2.total1, p2.total2, p2.own, p2.monthly],
      [''],
      ['Total Monthly Income', '', '', '', combined],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'form1065-income-');
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
      slug:  'income-1065',
      label: '1065',
      maxDocs: 2,
      buildCardBody: (doc, i) => {
        const yearLabel  = doc.taxYear || '?';
        const nameLabel  = doc.partnershipName || '';
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
        html += '<span>Total Income (Line 8): ' + totalLabel + '</span>';
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
