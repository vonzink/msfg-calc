(function () {
  'use strict';

  /* =====================================================
     Schedule K-1 (1065) Partnership Income Calculator
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
    ordinaryIncome:      '_ord',
    rentalRealEstate:    '_rent',
    otherRentalIncome:   '_other',
    guaranteedPayments:  '_guar'
  };

  /** Clear only the fields that AI auto-fills */
  function clearAiFields() {
    const prefix = 'k1';
    const fields = ['ord', 'rent', 'other', 'guar'];
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
  // K-1 CALCULATION
  // =====================================================

  function computeK1(num) {
    const prefix = 'k' + num;

    const ord1   = pn(prefix + '_ord1');
    const ord2   = pn(prefix + '_ord2');
    const rent1  = pn(prefix + '_rent1');
    const rent2  = pn(prefix + '_rent2');
    const other1 = pn(prefix + '_other1');
    const other2 = pn(prefix + '_other2');
    const guar1  = pn(prefix + '_guar1');
    const guar2  = pn(prefix + '_guar2');

    const year1 = ord1 + rent1 + other1 + guar1;
    const year2 = ord2 + rent2 + other2 + guar2;

    const hasYr2 = [ord2, rent2, other2, guar2].some(v => v !== 0);
    const result = IC.policyCalc(year1, hasYr2 ? year2 : 0);

    return {
      year1, year2,
      monthly: result.monthly, method: result.method,
      ord1, ord2, rent1, rent2, other1, other2, guar1, guar2
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

      IC.setResult('k' + i + '_yr1', k.year1);
      IC.setResult('k' + i + '_yr2', k.year2);
      IC.setResult('k' + i + '_month', k.monthly);
      IC.setResult('resultK' + i, k.monthly);

      combined += k.monthly;
    }

    IC.setResult('combinedK1', combined);

    updateMathSteps(results, combined);
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(results, combined) {
    const stepsEl = document.getElementById('calcSteps-income-k1');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    // Formula reference
    html += '<div class="math-step">';
    html += '<h4>Partnership K-1 Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<span class="math-note">For each K-1:</span>';
    html += '<div class="math-values">';
    html += 'Annual = Ordinary Income + Rental Real Estate + Other Rental + Guaranteed Payments<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    // Individual K-1 steps
    for (let i = 0; i < results.length; i++) {
      const k = results[i];
      const hasData = k.year1 !== 0 || k.year2 !== 0;
      if (i === 0 || hasData) {
        html += buildK1Step(i + 1, k);
      }
    }

    // Combined total
    html += '<div class="math-step highlight">';
    html += '<h4>Total Monthly Income</h4>';
    html += '<div class="math-formula">';
    for (let j = 0; j < results.length; j++) {
      const kj = results[j];
      const hasData = kj.year1 !== 0 || kj.year2 !== 0;
      if (j === 0 || hasData) {
        html += (j > 0 ? '+ ' : '') + 'K-1 #' + (j + 1) + ': ' + fmt(kj.monthly) + '<br>';
      }
    }
    html += '<div class="math-values"><strong>Total Monthly: ' + fmt(combined) + '</strong></div>';
    html += '</div></div>';

    html += '</div>';
    stepsEl.innerHTML = html;
  }

  function buildK1Step(num, k) {
    let html = '<div class="math-step">';
    html += '<h4>K-1 #' + num + ' Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Ordinary Income: ' + fmt(k.ord1) + ' / ' + fmt(k.ord2) + '<br>';
    html += 'Rental Real Estate: ' + fmt(k.rent1) + ' / ' + fmt(k.rent2) + '<br>';
    html += 'Other Rental: ' + fmt(k.other1) + ' / ' + fmt(k.other2) + '<br>';
    html += 'Guaranteed Payments: ' + fmt(k.guar1) + ' / ' + fmt(k.guar2) + '<br>';
    html += '<div class="math-values">';
    html += 'Year 1 = ' + fmt(k.ord1) + ' + ' + fmt(k.rent1) + ' + ' + fmt(k.other1) + ' + ' + fmt(k.guar1) + ' = ' + fmt(k.year1) + '<br>';
    html += 'Year 2 = ' + fmt(k.ord2) + ' + ' + fmt(k.rent2) + ' + ' + fmt(k.other2) + ' + ' + fmt(k.guar2) + ' = ' + fmt(k.year2) + '<br>';
    html += 'Method: ' + IC.methodLabel(k.method) + '<br>';
    html += '<strong>Monthly: ' + fmt(k.monthly) + '</strong>';
    html += '</div></div></div>';
    return html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    const rows = [
      ['Schedule K-1 (1065) Partnership Income Calculator'],
      [''],
      ['K-1', 'Year 1 Income', 'Year 2 Income', 'Monthly Income']
    ];

    let combined = 0;
    for (let i = 1; i <= K1_COUNT; i++) {
      const k = computeK1(i);
      rows.push(['K-1 #' + i, k.year1, k.year2, k.monthly]);
      combined += k.monthly;
    }

    rows.push(['']);
    rows.push(['Total Monthly Income', '', '', combined]);
    rows.push(['']);
    rows.push(['Generated', new Date().toLocaleString()]);

    IC.downloadCSV(rows, 'k1-1065-income-');
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
      slug:  'income-k1',
      label: 'K-1',
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
        html += '<span>Total K-1 Income: ' + totalLabel + '</span>';
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
