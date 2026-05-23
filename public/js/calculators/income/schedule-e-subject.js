(function () {
  'use strict';

  /* =====================================================
     Schedule E Subject Property Calculator
     — AI upload via shared IncomeUpload module
     — field sync, single property (no payment subtraction)
     — shared utilities via MSFG.IncomeCalc
     ===================================================== */

  const fmt = MSFG.formatCurrency;
  const pn  = MSFG.parseNumById;
  const IC  = MSFG.IncomeCalc;

  // =====================================================
  // FIELD MAPPING — AI → Form Fields
  // =====================================================

  const AI_FIELD_MAP = {
    rentsReceived:    'rents',
    royaltiesReceived: 'roy',
    amortization:     'cas',
    totalExpenses:    'exp',
    depreciation:     'dep',
    insurance:        'ins',
    mortgageInterest: 'int',
    taxes:            'tax'
  };

  /** Clear only the fields that AI auto-fills */
  function clearAiFields() {
    const fields = ['rents', 'roy', 'cas', 'exp', 'dep', 'ins', 'int', 'tax'];
    fields.forEach(f => {
      const el1 = document.getElementById('sr1_' + f);
      const el2 = document.getElementById('sr2_' + f);
      if (el1) el1.value = '0';
      if (el2) el2.value = '0';
    });
  }

  /** Map docStore entries to form fields. Index 0 = most recent = Year 1. */
  function syncFieldsFromDocs() {
    IncomeUpload.getDocStore().forEach((doc, i) => {
      const prefix = (i === 0) ? 'sr1_' : 'sr2_';
      Object.keys(AI_FIELD_MAP).forEach(aiKey => {
        IC.setField(prefix + AI_FIELD_MAP[aiKey], doc[aiKey]);
      });
    });
  }

  // =====================================================
  // CALCULATION
  // =====================================================

  function computeYear(yr) {
    const rents = pn('sr' + yr + '_rents');
    const roy   = pn('sr' + yr + '_roy');
    const cas   = pn('sr' + yr + '_cas');
    const exp   = pn('sr' + yr + '_exp');
    const dep   = pn('sr' + yr + '_dep');
    const ins   = pn('sr' + yr + '_ins');
    const int_  = pn('sr' + yr + '_int');
    const tax   = pn('sr' + yr + '_tax');

    return {
      rents, roy, cas, exp, dep, ins, int: int_, tax,
      total: rents + roy + cas + dep + ins + int_ + tax - exp
    };
  }

  function calculate() {
    const y1 = computeYear('1');
    const y2 = computeYear('2');

    const hasYr2 = [y2.rents, y2.roy, y2.cas, y2.exp, y2.dep, y2.ins, y2.int, y2.tax]
      .some(v => v !== 0);
    const result = IC.policyCalc(y1.total, hasYr2 ? y2.total : 0);

    document.getElementById('sr_total1').textContent = fmt(y1.total);
    document.getElementById('sr_total2').textContent = fmt(y2.total);
    document.getElementById('sr_avg').textContent = fmt(result.monthly);

    updateMathSteps({ y1, y2, hasYr2, monthly: result.monthly, method: result.method });
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(data) {
    const stepsEl = document.getElementById('calcSteps-income-schedule-e-subject');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    // Formula reference
    html += '<div class="math-step">';
    html += '<h4>Subject Property Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<span class="math-note">Schedule E subject property (no payment subtraction):</span>';
    html += '<div class="math-values">';
    html += 'Annual = Rents + Royalties + Amort/Casualty + Depreciation + Insurance + Mortgage Interest + Taxes &minus; Total Expenses<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    // Year 1 breakdown
    html += '<div class="math-step">';
    html += '<h4>Year 1 Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Rents Received: ' + fmt(data.y1.rents) + '<br>';
    html += '+ Royalties: ' + fmt(data.y1.roy) + '<br>';
    html += '+ Amort/Casualty: ' + fmt(data.y1.cas) + '<br>';
    html += '+ Depreciation: ' + fmt(data.y1.dep) + '<br>';
    html += '+ Insurance: ' + fmt(data.y1.ins) + '<br>';
    html += '+ Mortgage Interest: ' + fmt(data.y1.int) + '<br>';
    html += '+ Taxes: ' + fmt(data.y1.tax) + '<br>';
    html += '&minus; Total Expenses: ' + fmt(data.y1.exp) + '<br>';
    html += '<div class="math-values"><strong>Year 1 Total = ' + fmt(data.y1.total) + '</strong></div>';
    html += '</div></div>';

    // Year 2 breakdown
    if (data.hasYr2) {
      html += '<div class="math-step">';
      html += '<h4>Year 2 Calculation</h4>';
      html += '<div class="math-formula">';
      html += 'Rents Received: ' + fmt(data.y2.rents) + '<br>';
      html += '+ Royalties: ' + fmt(data.y2.roy) + '<br>';
      html += '+ Amort/Casualty: ' + fmt(data.y2.cas) + '<br>';
      html += '+ Depreciation: ' + fmt(data.y2.dep) + '<br>';
      html += '+ Insurance: ' + fmt(data.y2.ins) + '<br>';
      html += '+ Mortgage Interest: ' + fmt(data.y2.int) + '<br>';
      html += '+ Taxes: ' + fmt(data.y2.tax) + '<br>';
      html += '&minus; Total Expenses: ' + fmt(data.y2.exp) + '<br>';
      html += '<div class="math-values"><strong>Year 2 Total = ' + fmt(data.y2.total) + '</strong></div>';
      html += '</div></div>';
    }

    // Monthly result
    html += '<div class="math-step highlight">';
    html += '<h4>Monthly Average</h4>';
    html += '<div class="math-formula">';
    html += 'Method: ' + IC.methodLabel(data.method) + '<br>';
    if (data.method === 'average') {
      html += '(' + fmt(data.y1.total) + ' + ' + fmt(data.y2.total) + ') / 24<br>';
    } else {
      html += fmt(data.y1.total) + ' / 12<br>';
    }
    html += '<div class="math-values"><strong>Monthly Average: ' + fmt(data.monthly) + '</strong></div>';
    html += '</div></div>';

    html += '</div>';
    stepsEl.innerHTML = html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    const y1 = computeYear('1');
    const y2 = computeYear('2');
    const hasYr2 = [y2.rents, y2.roy, y2.cas, y2.exp, y2.dep, y2.ins, y2.int, y2.tax]
      .some(v => v !== 0);
    const monthly = (hasYr2 && y1.total > y2.total) ? (y1.total + y2.total) / 24 : y1.total / 12;

    IC.downloadCSV([
      ['Schedule E Subject Property Calculator'],
      [''],
      ['Line Item', 'Year 1', 'Year 2'],
      ['Rents Received (Ln 3)', y1.rents, y2.rents],
      ['Royalties Received (Ln 4)', y1.roy, y2.roy],
      ['Amortization/Casualty Loss (Ln 19)', y1.cas, y2.cas],
      ['Total Expenses (Ln 20)', y1.exp, y2.exp],
      ['Depreciation (Ln 18)', y1.dep, y2.dep],
      ['Insurance (Ln 9)', y1.ins, y2.ins],
      ['Mortgage Interest (Ln 12)', y1.int, y2.int],
      ['Taxes (Ln 16)', y1.tax, y2.tax],
      [''],
      ['Year 1 Total', y1.total, ''],
      ['Year 2 Total', '', y2.total],
      ['Monthly Average', monthly, ''],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'schedule-e-subject-');
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
      slug:    'income-schedule-e-subject',
      label:   'Schedule E',
      maxDocs: 2,
      buildCardBody: (doc, i) => {
        const yearLabel  = doc.taxYear || '?';
        const nameLabel  = doc.propertyAddress || '';
        const rentsLabel = (doc.rentsReceived != null && doc.rentsReceived !== 0) ? fmt(doc.rentsReceived) : '--';

        let html = '';
        html += '<div class="doc-card__header">';
        html += '<span class="doc-card__year">' + yearLabel + '</span>';
        if (nameLabel) html += '<span class="doc-card__name">' + IncomeUpload.escHtml(nameLabel) + '</span>';
        html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
        html += '</div>';
        html += '<div class="doc-card__amounts">';
        html += '<span>Rents Received (Line 3): ' + rentsLabel + '</span>';
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
