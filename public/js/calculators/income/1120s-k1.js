(function () {
  'use strict';

  /* =====================================================
     1120S K-1 Income Calculator
     — AI upload via shared IncomeUpload module
     — field sync, single-entity K-1 calculation
     — shared utilities via MSFG.IncomeCalc
     ===================================================== */

  const fmt = MSFG.formatCurrency;
  const pn  = MSFG.parseNumById;
  const IC  = MSFG.IncomeCalc;

  // =====================================================
  // FIELD MAPPING — AI → Form Fields
  // =====================================================

  const AI_FIELD_MAP = {
    ordinaryIncome:     '_ord',
    rentalRealEstate:   '_rent',
    otherRentalIncome:  '_other'
  };

  /** Clear only the fields that AI auto-fills */
  function clearAiFields() {
    const prefix = 'k1';
    const fields = ['ord', 'rent', 'other'];
    fields.forEach(f => {
      const el1 = document.getElementById(prefix + '_' + f + '1');
      const el2 = document.getElementById(prefix + '_' + f + '2');
      if (el1) el1.value = '0';
      if (el2) el2.value = '0';
    });
  }

  /** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
  function syncFieldsFromDocs() {
    const prefix = 'k1';
    IncomeUpload.getDocStore().forEach((doc, i) => {
      const ySuffix = (i === 0) ? '1' : '2';
      Object.keys(AI_FIELD_MAP).forEach(aiKey => {
        IC.setField(prefix + AI_FIELD_MAP[aiKey] + ySuffix, doc[aiKey]);
      });
    });
  }

  // =====================================================
  // K-1 ENTITY CALCULATION
  // =====================================================

  function computeK1(num) {
    const p = 'k' + num;

    const ord1   = pn(p + '_ord1');
    const ord2   = pn(p + '_ord2');
    const rent1  = pn(p + '_rent1');
    const rent2  = pn(p + '_rent2');
    const other1 = pn(p + '_other1');
    const other2 = pn(p + '_other2');

    const year1 = ord1 + rent1 + other1;
    const year2 = ord2 + rent2 + other2;

    const hasYr2 = [ord2, rent2, other2].some(v => v !== 0);
    const result = IC.policyCalc(year1, hasYr2 ? year2 : 0);

    return {
      year1, year2, hasYr2,
      monthly: result.monthly, method: result.method,
      ord1, ord2, rent1, rent2, other1, other2
    };
  }

  // =====================================================
  // MAIN CALCULATION
  // =====================================================

  function calculate() {
    const k = computeK1(1);
    IC.setResult('combinedK1', k.monthly);
    updateMathSteps(k);
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(k) {
    const stepsEl = document.getElementById('calcSteps-income-1120s-k1');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    html += '<div class="math-step">';
    html += '<h4>1120S K-1 Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<div class="math-values">';
    html += 'Annual = Ordinary + Rental RE + Other Rental<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    html += buildK1Step(k);

    html += '</div>';
    stepsEl.innerHTML = html;
  }

  function buildK1Step(d) {
    let html = '<div class="math-step">';
    html += '<h4>K-1 Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Ordinary Income: ' + fmt(d.ord1);
    if (d.hasYr2) html += ' / ' + fmt(d.ord2);
    html += '<br>';
    html += 'Rental RE Income: ' + fmt(d.rent1);
    if (d.hasYr2) html += ' / ' + fmt(d.rent2);
    html += '<br>';
    html += 'Other Rental: ' + fmt(d.other1);
    if (d.hasYr2) html += ' / ' + fmt(d.other2);
    html += '<br>';
    html += '<div class="math-values">';
    html += 'Year 1 = ' + fmt(d.ord1) + ' + ' + fmt(d.rent1) + ' + ' + fmt(d.other1) + ' = ' + fmt(d.year1) + '<br>';
    if (d.hasYr2) {
      html += 'Year 2 = ' + fmt(d.ord2) + ' + ' + fmt(d.rent2) + ' + ' + fmt(d.other2) + ' = ' + fmt(d.year2) + '<br>';
    }
    html += 'Method: ' + IC.methodLabel(d.method) + '<br>';
    html += '<strong>Monthly: ' + fmt(d.monthly) + '</strong>';
    html += '</div></div></div>';
    return html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    const k = computeK1(1);

    IC.downloadCSV([
      ['1120S K-1 Income Calculator'],
      [''],
      ['Year 1 Income', k.year1],
      ['Year 2 Income', k.year2],
      ['Monthly Income', k.monthly],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], '1120s-k1-income-');
  }

  // =====================================================
  // CLEAR ALL
  // =====================================================

  function clearAll() {
    IC.clearAll(calculate, { 'owner': '100' });
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  document.addEventListener('DOMContentLoaded', () => {
    IncomeUpload.init({
      slug:  'income-1120s-k1',
      label: '1120S K-1',
      maxDocs: 2,
      buildCardBody: (doc, i) => {
        const yearLabel  = doc.taxYear || '?';
        const nameLabel  = doc.corporationName || doc.entityName || '';
        const einLabel   = doc.ein || '';

        let html = '';
        html += '<div class="doc-card__header">';
        html += '<span class="doc-card__year">' + yearLabel + '</span>';
        if (nameLabel) html += '<span class="doc-card__name">' + IncomeUpload.escHtml(nameLabel) + '</span>';
        if (einLabel) html += '<span class="doc-card__filing">EIN: ' + IncomeUpload.escHtml(einLabel) + '</span>';
        html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
        html += '</div>';
        html += '<div class="doc-card__amounts">';
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
