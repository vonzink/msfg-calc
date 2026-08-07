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
  // MILEAGE DEPRECIATION ADD-BACK
  // Fannie Mae standard-mileage depreciation component ($/mile) by tax year.
  // Add-back = business miles (Sch C Part IV, Line 44a) × rate for that year.
  // =====================================================

  const MILE_RATES = {
    '2025': 0.33,
    '2024': 0.30,
    '2023': 0.28,
    '2022': 0.26,
    '2021': 0.26
  };

  /** Set the rate input for a given year suffix from the selected tax year. */
  function syncMileRate(y) {
    const yearEl = document.getElementById('b1_year' + y);
    const rateEl = document.getElementById('b1_rate' + y);
    if (!yearEl || !rateEl) return;
    const rate = MILE_RATES[yearEl.value];
    if (rate != null) rateEl.value = rate;
  }

  /** Recompute the $ add-back field for a given year suffix from miles × rate. */
  function syncMileAddback(y) {
    const addEl = document.getElementById('b1_mile' + y);
    if (!addEl) return;
    const miles = pn('b1_miles' + y);
    const rate  = pn('b1_rate' + y);
    addEl.value = Math.round(miles * rate);
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

    // Mileage add-back detail (for the math-steps display)
    const miles1 = pn(prefix + '_miles1');
    const miles2 = pn(prefix + '_miles2');
    const rate1  = pn(prefix + '_rate1');
    const rate2  = pn(prefix + '_rate2');
    const taxY1  = (document.getElementById(prefix + '_year1') || {}).value || '';
    const taxY2  = (document.getElementById(prefix + '_year2') || {}).value || '';

    const sum1 = np1 + oth1 + depl1 + depr1 + home1 + mile1 + amort1;
    const sum2 = np2 + oth2 + depl2 + depr2 + home2 + mile2 + amort2;
    const year1 = sum1 - meals1;
    const year2 = sum2 - meals2;

    const hasYr2 = [np2, oth2, depl2, depr2, meals2, home2, mile2, amort2]
      .some(v => v !== 0);

    const result = IC.policyCalc(year1, hasYr2 ? year2 : 0);

    return {
      year1, year2, sum1, sum2, hasYr2,
      monthly: result.monthly, method: result.method,
      meals1, meals2,
      mile1, mile2, miles1, miles2, rate1, rate2, taxY1, taxY2
    };
  }

  // =====================================================
  // MAIN CALCULATION
  // =====================================================

  function calculate() {
    const b = computeBusiness('b1');
    IC.setResult('combined_c', b.monthly);
    updateMathSteps(b);
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(b) {
    const stepsEl = document.getElementById('calcSteps-income-schedule-c');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    // Formula reference
    html += '<div class="math-step">';
    html += '<h4>Schedule C Income Formula</h4>';
    html += '<div class="math-formula">';
    html += '<div class="math-values">';
    html += 'Annual = Net Profit + Other Income + Depletion + Depreciation<br>';
    html += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; + Business Use of Home + Mileage Depr + Amortization<br>';
    html += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; &minus; Meals &amp; Entertainment<br><br>';
    html += 'Mileage Depr = Business Miles &times; IRS depreciation rate for the tax year<br><br>';
    html += 'IF Year 2 provided AND Year 1 &gt; Year 2:<br>';
    html += '&nbsp;&nbsp;Monthly = (Year 1 + Year 2) / 24<br>';
    html += 'ELSE:<br>';
    html += '&nbsp;&nbsp;Monthly = Year 1 / 12';
    html += '</div></div></div>';

    html += buildMileageStep(b);
    html += buildBizStep(b);

    html += '</div>';
    stepsEl.innerHTML = html;
  }

  /** Depreciation component ($/mile) by tax year — for reference. */
  function buildMileageStep(d) {
    let html = '<div class="math-step">';
    html += '<h4>Mileage Depreciation Add-back</h4>';
    html += '<div class="math-formula">';

    // Per-year derivation (only shown when miles were entered)
    const line = (label, miles, rate, year, addback) => {
      if (miles > 0) {
        return label + ': ' + MSFG.formatNumber(miles) + ' mi &times; $' + rate.toFixed(2) +
               '/mi' + (year ? ' (' + year + ')' : '') + ' = ' + fmt(miles * rate) + '<br>';
      }
      if (addback !== 0) {
        return label + ' (manual add-back): ' + fmt(addback) + '<br>';
      }
      return '';
    };

    let derived = '';
    derived += line('Year 1', d.miles1, d.rate1, d.taxY1, d.mile1);
    if (d.hasYr2 || d.miles2 > 0 || d.mile2 !== 0) {
      derived += line('Year 2', d.miles2, d.rate2, d.taxY2, d.mile2);
    }
    html += derived || 'No mileage entered.<br>';

    // Rate reference table
    html += '<div class="math-values">';
    html += 'Fannie Mae depreciation component ($/mile):<br>';
    html += '2025 = $0.33&nbsp;&nbsp;|&nbsp;&nbsp;2024 = $0.30&nbsp;&nbsp;|&nbsp;&nbsp;';
    html += '2023 = $0.28&nbsp;&nbsp;|&nbsp;&nbsp;2022 = $0.26&nbsp;&nbsp;|&nbsp;&nbsp;2021 = $0.26';
    html += '</div></div></div>';
    return html;
  }

  function buildBizStep(d) {
    let html = '<div class="math-step">';
    html += '<h4>Schedule C Calculation</h4>';
    html += '<div class="math-formula">';
    html += 'Subtotal Year 1: ' + fmt(d.sum1) + '<br>';
    if (d.hasYr2) html += 'Subtotal Year 2: ' + fmt(d.sum2) + '<br>';
    html += 'Less Meals: ' + fmt(d.meals1);
    if (d.hasYr2) html += ' / ' + fmt(d.meals2);
    html += '<br>';
    html += '<div class="math-values">';
    html += 'Year 1 = ' + fmt(d.sum1) + ' &minus; ' + fmt(d.meals1) + ' = ' + fmt(d.year1) + '<br>';
    if (d.hasYr2) {
      html += 'Year 2 = ' + fmt(d.sum2) + ' &minus; ' + fmt(d.meals2) + ' = ' + fmt(d.year2) + '<br>';
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
    const b = computeBusiness('b1');

    IC.downloadCSV([
      ['Schedule C Sole Proprietorship Income Calculator'],
      [''],
      ['', 'Year 1', 'Year 2'],
      ['Tax Year', b.taxY1, b.taxY2],
      ['Business Miles (Line 44a)', b.miles1, b.miles2],
      ['Mileage Rate ($/mile)', b.rate1, b.rate2],
      ['Mileage Depreciation Add-back', b.mile1, b.mile2],
      [''],
      ['Year 1 Income', b.year1],
      ['Year 2 Income', b.year2],
      ['Monthly Income', b.monthly],
      [''],
      ['Generated', new Date().toLocaleString()]
    ], 'schedule-c-income-');
  }

  // =====================================================
  // CLEAR ALL
  // =====================================================

  function clearAll() {
    IC.clearAll(calculate);
    // IC.clearAll zeros number inputs (incl. miles/rate) but not <select>s.
    const y1 = document.getElementById('b1_year1');
    const y2 = document.getElementById('b1_year2');
    if (y1) y1.value = '2025';
    if (y2) y2.value = '2024';
    ['1', '2'].forEach(y => { syncMileRate(y); syncMileAddback(y); });
    calculate();
  }

  /** Set the year dropdowns from uploaded docs (index 0 = Year 1) and re-sync. */
  function syncYearsFromDocs() {
    IncomeUpload.getDocStore().forEach((doc, i) => {
      const y = (i === 0) ? '1' : '2';
      const sel = document.getElementById('b1_year' + y);
      if (sel && doc.taxYear != null && MILE_RATES[String(doc.taxYear)] != null) {
        sel.value = String(doc.taxYear);
      }
      syncMileRate(y);
      syncMileAddback(y);
    });
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
        syncYearsFromDocs();
        calculate();
      },
      onRemove: () => {
        clearAiFields();
        if (IncomeUpload.getDocStore().length > 0) {
          syncFieldsFromDocs();
          syncYearsFromDocs();
        }
        calculate();
      }
    });

    // Wire mileage add-back: year → rate, and (miles × rate) → add-back $.
    // The add-back field stays hand-editable; typing miles/rate/year overrides it.
    ['1', '2'].forEach(y => {
      const yearEl  = document.getElementById('b1_year' + y);
      const milesEl = document.getElementById('b1_miles' + y);
      const rateEl  = document.getElementById('b1_rate' + y);
      if (yearEl)  yearEl.addEventListener('change', () => { syncMileRate(y); syncMileAddback(y); calculate(); });
      if (milesEl) milesEl.addEventListener('input', () => { syncMileAddback(y); calculate(); });
      if (rateEl)  rateEl.addEventListener('input', () => { syncMileAddback(y); calculate(); });
      // Ensure rate/add-back are consistent with the default selected year at load.
      syncMileRate(y);
      syncMileAddback(y);
    });

    IC.initPage(calculate);
  });

  window.calculate = calculate;
  window.exportCSV = exportCSV;
  window.clearAll = clearAll;

})();
