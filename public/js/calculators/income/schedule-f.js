(function () {
  'use strict';

  /* =====================================================
     Schedule F Farm Income Calculator
     — AI upload via shared IncomeUpload module
     — Field sync, single-entity calculation
     — shared utilities via MSFG.IncomeCalc
     ===================================================== */

  const fmt = MSFG.formatCurrency;
  const pn  = MSFG.parseNumById;
  const IC  = MSFG.IncomeCalc;

  // =====================================================
  // FIELD MAPPING — AI → Form Fields
  // =====================================================

  const AI_FIELD_MAP = {
    netProfit:          'f_np',
    coopPayments:       'f_coop',
    otherIncome:        'f_other',
    depreciation:       'f_dep',
    amortization:       'f_amort',
    businessUseOfHome:  'f_home',
    mealsEntertainment: 'f_meals'
  };

  /** Clear only the fields that AI auto-fills */
  function clearAiFields() {
    const fields = ['f_np', 'f_coop', 'f_other', 'f_dep', 'f_amort', 'f_home', 'f_meals'];
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
  // CARD BODY BUILDER
  // =====================================================

  function buildCardBody(doc, i) {
    const yearLabel  = doc.taxYear || '?';
    const nameLabel  = doc.farmName || '';
    const totalLabel = (doc.netProfit != null && doc.netProfit !== 0) ? fmt(doc.netProfit) : '--';

    let html = '';
    html += '<div class="doc-card__header">';
    html += '<span class="doc-card__year">' + yearLabel + '</span>';
    if (nameLabel) html += '<span class="doc-card__name">' + IncomeUpload.escHtml(nameLabel) + '</span>';
    html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
    html += '</div>';
    html += '<div class="doc-card__amounts">';
    html += '<span>Net Profit/Loss: ' + totalLabel + '</span>';
    html += IncomeUpload.yearBadge(i);
    html += '</div>';
    return html;
  }

  // =====================================================
  // FARM INCOME CALCULATION
  // =====================================================

  function calculate() {
    const np1    = pn('f_np1');
    const np2    = pn('f_np2');
    const coop1  = pn('f_coop1');
    const coop2  = pn('f_coop2');
    const other1 = pn('f_other1');
    const other2 = pn('f_other2');
    const dep1   = pn('f_dep1');
    const dep2   = pn('f_dep2');
    const amort1 = pn('f_amort1');
    const amort2 = pn('f_amort2');
    const home1  = pn('f_home1');
    const home2  = pn('f_home2');
    const meals1 = pn('f_meals1');
    const meals2 = pn('f_meals2');

    const year1 = np1 + coop1 + other1 + dep1 + amort1 + home1 - meals1;
    const year2 = np2 + coop2 + other2 + dep2 + amort2 + home2 - meals2;

    // Check if Year 2 has data
    const hasYr2 = [np2, coop2, other2, dep2, amort2, home2, meals2].some(v => v !== 0);
    const result = IC.policyCalc(year1, hasYr2 ? year2 : 0);

    IC.setResult('f_total1', year1);
    IC.setResult('f_total2', year2);
    IC.setResult('f_monthly', result.monthly);

    updateMathSteps({
      np1, np2, coop1, coop2, other1, other2,
      dep1, dep2, amort1, amort2, home1, home2,
      meals1, meals2, year1, year2,
      monthly: result.monthly, method: result.method, hasYr2
    });
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(data) {
    const stepsEl = document.getElementById('calcSteps-income-schedule-f');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    // Formula reference
    html += '<div class="math-step">';
    html += '<h4>Schedule F Farm Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<span class="math-note">For farm income:</span>';
    html += '<div class="math-values">';
    html += 'Annual = Net Profit + Coop/CCC + Other + Depreciation + Amortization + Home &minus; Meals<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    // Year 1 breakdown
    html += '<div class="math-step">';
    html += '<h4>Year 1 Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Net Profit: ' + fmt(data.np1) + '<br>';
    html += '+ Coop/CCC: ' + fmt(data.coop1) + '<br>';
    html += '+ Other Income: ' + fmt(data.other1) + '<br>';
    html += '+ Depreciation: ' + fmt(data.dep1) + '<br>';
    html += '+ Amortization: ' + fmt(data.amort1) + '<br>';
    html += '+ Business Use of Home: ' + fmt(data.home1) + '<br>';
    html += '&minus; Meals: ' + fmt(data.meals1) + '<br>';
    html += '<div class="math-values"><strong>Year 1 Total = ' + fmt(data.year1) + '</strong></div>';
    html += '</div></div>';

    // Year 2 breakdown
    if (data.hasYr2) {
      html += '<div class="math-step">';
      html += '<h4>Year 2 Calculation</h4>';
      html += '<div class="math-formula">';
      html += 'Net Profit: ' + fmt(data.np2) + '<br>';
      html += '+ Coop/CCC: ' + fmt(data.coop2) + '<br>';
      html += '+ Other Income: ' + fmt(data.other2) + '<br>';
      html += '+ Depreciation: ' + fmt(data.dep2) + '<br>';
      html += '+ Amortization: ' + fmt(data.amort2) + '<br>';
      html += '+ Business Use of Home: ' + fmt(data.home2) + '<br>';
      html += '&minus; Meals: ' + fmt(data.meals2) + '<br>';
      html += '<div class="math-values"><strong>Year 2 Total = ' + fmt(data.year2) + '</strong></div>';
      html += '</div></div>';
    }

    // Monthly result
    html += '<div class="math-step highlight">';
    html += '<h4>Monthly Qualifying Income</h4>';
    html += '<div class="math-formula">';
    html += 'Method: ' + IC.methodLabel(data.method) + '<br>';
    if (data.method === 'average') {
      html += '(' + fmt(data.year1) + ' + ' + fmt(data.year2) + ') / 24<br>';
    } else {
      html += fmt(data.year1) + ' / 12<br>';
    }
    html += '<div class="math-values"><strong>Monthly Income: ' + fmt(data.monthly) + '</strong></div>';
    html += '</div></div>';

    html += '</div>';
    stepsEl.innerHTML = html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    const np1    = pn('f_np1');
    const np2    = pn('f_np2');
    const coop1  = pn('f_coop1');
    const coop2  = pn('f_coop2');
    const other1 = pn('f_other1');
    const other2 = pn('f_other2');
    const dep1   = pn('f_dep1');
    const dep2   = pn('f_dep2');
    const amort1 = pn('f_amort1');
    const amort2 = pn('f_amort2');
    const home1  = pn('f_home1');
    const home2  = pn('f_home2');
    const meals1 = pn('f_meals1');
    const meals2 = pn('f_meals2');

    const year1 = np1 + coop1 + other1 + dep1 + amort1 + home1 - meals1;
    const year2 = np2 + coop2 + other2 + dep2 + amort2 + home2 - meals2;
    const hasYr2 = [np2, coop2, other2, dep2, amort2, home2, meals2].some(v => v !== 0);
    const monthly = (hasYr2 && year1 > year2) ? (year1 + year2) / 24 : year1 / 12;

    IC.downloadCSV([
      ['Schedule F Farm Income Calculator'],
      [''],
      ['Line Item', 'Year 1', 'Year 2'],
      ['Net Profit or Loss', np1, np2],
      ['Ongoing Coop & CCC Payments', coop1, coop2],
      ['Other Income or Loss', other1, other2],
      ['Depreciation', dep1, dep2],
      ['Amortization/Casualty Loss/Depletion', amort1, amort2],
      ['Business Use of Home', home1, home2],
      ['Meal & Entertainment Exclusion', meals1, meals2],
      [''],
      ['Year 1 Total', year1, ''],
      ['Year 2 Total', '', year2],
      ['Monthly Qualifying Income', monthly, ''],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'schedule-f-income-');
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
      slug:          'income-schedule-f',
      label:         'Schedule F',
      maxDocs:       2,
      buildCardBody,
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
