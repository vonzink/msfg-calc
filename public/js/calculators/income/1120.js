(function () {
  'use strict';

  /* =====================================================
     Form 1120 C-Corporation Income Calculator
     — AI upload via shared IncomeUpload module
     — field sync, single-entity C-Corp calculation
     — shared utilities via MSFG.IncomeCalc
     ===================================================== */

  const fmt = MSFG.formatCurrency;
  const pn  = MSFG.parseNumById;
  const IC  = MSFG.IncomeCalc;

  // =====================================================
  // FIELD MAPPING — AI → Form Fields
  // =====================================================

  const AI_FIELD_MAP = {
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
    const fields = ['cap', 'net', 'oth', 'dep', 'depl', 'dpd', 'amort', 'nol', 'taxable', 'totaltax', 'mort', 'meals', 'dividend'];
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
  // MAIN CALCULATION
  // =====================================================

  function calculate() {
    const cap1 = pn('cap1'),        cap2 = pn('cap2');
    const net1 = pn('net1'),        net2 = pn('net2');
    const oth1 = pn('oth1'),        oth2 = pn('oth2');
    const dep1 = pn('dep1'),        dep2 = pn('dep2');
    const depl1 = pn('depl1'),      depl2 = pn('depl2');
    const dpd1 = pn('dpd1'),        dpd2 = pn('dpd2');
    const amort1 = pn('amort1'),    amort2 = pn('amort2');
    const nol1 = pn('nol1'),        nol2 = pn('nol2');
    const taxable1 = pn('taxable1'), taxable2 = pn('taxable2');
    const tax1 = pn('totaltax1'),   tax2 = pn('totaltax2');
    const mort1 = pn('mort1'),      mort2 = pn('mort2');
    const meals1 = pn('meals1'),    meals2 = pn('meals2');
    const div1 = pn('dividend1'),   div2 = pn('dividend2');
    const ownership = pn('ownership') / 100;

    // Show/hide ownership warning
    const warningEl = document.getElementById('ownershipWarning');
    if (warningEl) {
      warningEl.classList.toggle('u-hidden', ownership >= 1);
    }

    // Sum add-back items
    const sum1 = cap1 + net1 + oth1 + dep1 + depl1 + dpd1 + amort1 + nol1 + taxable1;
    const sum2 = cap2 + net2 + oth2 + dep2 + depl2 + dpd2 + amort2 + nol2 + taxable2;

    // Calculate: (sum - deductions) * ownership% - dividends
    const total1 = (sum1 - tax1 - mort1 - meals1) * ownership - div1;
    const total2 = (sum2 - tax2 - mort2 - meals2) * ownership - div2;

    // Determine if year 2 has values
    const hasYr2 = [cap2, net2, oth2, dep2, depl2, dpd2, amort2, nol2, taxable2, tax2, mort2, meals2, div2]
      .some(v => v !== 0);

    const result = IC.policyCalc(total1, hasYr2 ? total2 : 0);

    // Update displays
    document.getElementById('yr1_total').textContent = fmt(total1);
    document.getElementById('yr2_total').textContent = fmt(total2);
    document.getElementById('monthly_income').textContent = fmt(result.monthly);
    document.getElementById('combined1120').textContent = fmt(result.monthly);

    updateMathSteps({
      sum1, sum2, tax1, tax2, mort1, mort2, meals1, meals2,
      div1, div2, ownership: ownership * 100,
      total1, total2,
      monthly: result.monthly, method: result.method, hasYr2
    });
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(d) {
    const stepsEl = document.getElementById('calcSteps-income-1120');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

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
    html += '<div class="math-step highlight">';
    html += '<h4>Monthly Income Result</h4>';
    html += '<div class="math-formula">';
    html += 'Method: ' + IC.methodLabel(d.method);
    html += '<div class="math-values"><strong>Monthly Income: ' + fmt(d.monthly) + '</strong></div>';
    html += '</div></div>';

    html += '</div>';
    stepsEl.innerHTML = html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    IC.downloadCSV([
      ['Form 1120 Corporation Income Calculator'],
      [''],
      ['', 'Year 1', 'Year 2'],
      ['Income', document.getElementById('yr1_total').textContent, document.getElementById('yr2_total').textContent],
      ['Ownership %', pn('ownership'), ''],
      ['Monthly Income', document.getElementById('monthly_income').textContent, ''],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'form1120-income-');
  }

  // =====================================================
  // CLEAR ALL
  // =====================================================

  function clearAll() {
    IC.clearAll(calculate, { 'ownership': '100' });
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  document.addEventListener('DOMContentLoaded', () => {
    IncomeUpload.init({
      slug:  'income-1120',
      label: '1120',
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
        html += '<span>Total Income (Line 11): ' + totalLabel + '</span>';
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
