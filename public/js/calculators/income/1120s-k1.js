(function () {
  'use strict';

  /* =====================================================
     1120S K-1 Income Calculator
     — AI upload via shared IncomeUpload module
     — field sync, 4-entity K-1 calculation
     — shared utilities via MSFG.IncomeCalc
     ===================================================== */

  const fmt = MSFG.formatCurrency;
  const pn  = MSFG.parseNumById;
  const IC  = MSFG.IncomeCalc;

  const K1_COUNT = 4;

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
      year1, year2,
      monthly: result.monthly, method: result.method,
      ord1, ord2, rent1, rent2, other1, other2
    };
  }

  // =====================================================
  // MAIN CALCULATION
  // =====================================================

  function calculate() {
    const results = [];
    let combined = 0;

    for (let i = 1; i <= K1_COUNT; i++) {
      const k = computeK1(i);
      results.push(k);

      document.getElementById('k' + i + '_yr1').textContent = fmt(k.year1);
      document.getElementById('k' + i + '_yr2').textContent = fmt(k.year2);
      document.getElementById('k' + i + '_month').textContent = fmt(k.monthly);
      document.getElementById('resultK' + i).textContent = fmt(k.monthly);

      combined += k.monthly;
    }

    document.getElementById('combinedK1').textContent = fmt(combined);

    updateMathSteps(results, combined);
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(results, combined) {
    const stepsEl = document.getElementById('calcSteps-income-1120s-k1');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    // Formula reference
    html += '<div class="math-step">';
    html += '<h4>1120S K-1 Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<span class="math-note">For each K-1 entity:</span>';
    html += '<div class="math-values">';
    html += 'Annual = Ordinary Income + Rental RE Income + Other Rental Income<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    // Per-entity steps
    for (let i = 0; i < K1_COUNT; i++) {
      const d = results[i];
      const hasData = d.year1 !== 0 || d.year2 !== 0;
      if (hasData) {
        html += buildK1Step(i + 1, d);
      }
    }

    // Combined total
    html += '<div class="math-step highlight">';
    html += '<h4>Total Monthly K-1 Income</h4>';
    html += '<div class="math-formula">';
    for (let j = 0; j < K1_COUNT; j++) {
      const r = results[j];
      const hasVal = r.year1 !== 0 || r.year2 !== 0;
      if (hasVal) {
        html += (j > 0 ? '+ ' : '') + 'K-1 #' + (j + 1) + ': ' + fmt(r.monthly) + '<br>';
      }
    }
    html += '<div class="math-values"><strong>Total Monthly: ' + fmt(combined) + '</strong></div>';
    html += '</div></div>';

    html += '</div>';
    stepsEl.innerHTML = html;
  }

  function buildK1Step(num, d) {
    let html = '<div class="math-step">';
    html += '<h4>K-1 #' + num + ' Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Ordinary Income: ' + fmt(d.ord1) + ' / ' + fmt(d.ord2) + '<br>';
    html += 'Rental RE Income: ' + fmt(d.rent1) + ' / ' + fmt(d.rent2) + '<br>';
    html += 'Other Rental: ' + fmt(d.other1) + ' / ' + fmt(d.other2) + '<br>';
    html += '<div class="math-values">';
    html += 'Year 1 = ' + fmt(d.ord1) + ' + ' + fmt(d.rent1) + ' + ' + fmt(d.other1) + ' = ' + fmt(d.year1) + '<br>';
    html += 'Year 2 = ' + fmt(d.ord2) + ' + ' + fmt(d.rent2) + ' + ' + fmt(d.other2) + ' = ' + fmt(d.year2) + '<br>';
    html += 'Method: ' + IC.methodLabel(d.method) + '<br>';
    html += '<strong>Monthly: ' + fmt(d.monthly) + '</strong>';
    html += '</div></div></div>';
    return html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    const rows = [
      ['1120S K-1 Income Calculator'],
      [''],
      ['K-1 Entity', 'Year 1 Income', 'Year 2 Income', 'Monthly Income']
    ];

    let combined = 0;
    for (let i = 1; i <= K1_COUNT; i++) {
      const k = computeK1(i);
      rows.push(['K-1 #' + i, k.year1, k.year2, k.monthly]);
      combined += k.monthly;
    }

    rows.push(['']);
    rows.push(['Total Monthly K-1 Income', '', '', combined]);
    rows.push(['']);
    rows.push(['Generated', new Date().toLocaleString()]);

    IC.downloadCSV(rows, '1120s-k1-income-');
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
