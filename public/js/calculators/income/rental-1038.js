(function () {
  'use strict';

  /* =====================================================
     Rental Property Income (1038) Calculator
     — Method A: Schedule E  |  Method B: Lease Agreement
     — AI upload for Schedule E extraction
     — shared utilities via MSFG.IncomeCalc
     ===================================================== */

  const fmt = MSFG.formatCurrency;
  const pn  = MSFG.parseNumById;
  const IC  = MSFG.IncomeCalc;

  let currentMethod = 'scheduleE';

  // =====================================================
  // FIELD MAPPING — AI → Form Fields
  // =====================================================

  const AI_FIELD_MAP = {
    rentsReceived:     'methodA_rents',
    totalExpenses:     'methodA_expenses',
    insurance:         'methodA_insurance',
    mortgageInterest:  'methodA_mortint',
    taxes:             'methodA_taxes',
    depreciation:      'methodA_deprec'
  };

  function syncFieldsFromDoc(doc) {
    Object.keys(AI_FIELD_MAP).forEach(aiKey => {
      IC.setField(AI_FIELD_MAP[aiKey], doc[aiKey]);
    });

    // fairRentalDays: if > 0, convert to months
    if (doc.fairRentalDays && doc.fairRentalDays > 0) {
      let months = Math.round(doc.fairRentalDays / 30);
      if (months < 1) months = 1;
      if (months > 12) months = 12;
      IC.setField('methodA_months', months);
    }
  }

  function clearMethodAFields() {
    const fields = ['methodA_rents', 'methodA_expenses', 'methodA_insurance',
                    'methodA_mortint', 'methodA_taxes', 'methodA_hoa',
                    'methodA_deprec', 'methodA_onetime'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '0';
    });
    const monthsEl = document.getElementById('methodA_months');
    if (monthsEl) monthsEl.value = '12';
  }

  // =====================================================
  // METHOD SELECTOR
  // =====================================================

  function selectMethod(method) {
    currentMethod = method;

    document.querySelectorAll('.method-btn').forEach((btn, i) => {
      btn.classList.toggle('active',
        (method === 'scheduleE' && i === 0) || (method === 'lease' && i === 1));
    });

    const methodA = document.getElementById('methodA');
    const methodB = document.getElementById('methodB');
    if (methodA) methodA.classList.toggle('active', method === 'scheduleE');
    if (methodB) methodB.classList.toggle('active', method === 'lease');

    calculate();
  }

  // =====================================================
  // CALCULATIONS
  // =====================================================

  function calculate() {
    if (currentMethod === 'scheduleE') {
      calculateMethodA();
    } else {
      calculateMethodB();
    }
  }

  function calculateMethodA() {
    const rents     = pn('methodA_rents');
    const expenses  = pn('methodA_expenses');
    const insurance = pn('methodA_insurance');
    const mortint   = pn('methodA_mortint');
    const taxes     = pn('methodA_taxes');
    const hoa       = pn('methodA_hoa');
    const deprec    = pn('methodA_deprec');
    const onetime   = pn('methodA_onetime');
    let months      = pn('methodA_months') || 12;
    const pitia     = pn('methodA_pitia');

    if (months < 1) months = 1;
    if (months > 12) months = 12;

    const adjustedIncome = (rents + insurance + mortint + taxes + hoa + deprec + onetime) - expenses;
    const monthlyAdjusted = adjustedIncome / months;
    const finalResult = monthlyAdjusted - pitia;

    const adjEl = document.getElementById('methodA_adjusted');
    if (adjEl) adjEl.textContent = fmt(monthlyAdjusted);

    const resEl = document.getElementById('methodA_result');
    if (resEl) resEl.textContent = fmt(finalResult);

    updateMathSteps({
      method: 'A',
      rents, expenses, insurance, mortint, taxes, hoa, deprec, onetime,
      months, adjustedIncome, monthlyAdjusted, pitia, finalResult
    });
  }

  function calculateMethodB() {
    const grossRent = pn('methodB_grossrent');
    const pitia     = pn('methodB_pitia');

    const adjustedMonthly = grossRent * 0.75;
    const finalResult = adjustedMonthly - pitia;

    const adjEl = document.getElementById('methodB_adjusted');
    if (adjEl) adjEl.textContent = fmt(adjustedMonthly);

    const resEl = document.getElementById('methodB_result');
    if (resEl) resEl.textContent = fmt(finalResult);

    updateMathSteps({
      method: 'B',
      grossRent, adjustedMonthly, pitia, finalResult
    });
  }

  // =====================================================
  // MATH STEPS
  // =====================================================

  function updateMathSteps(data) {
    const stepsEl = document.getElementById('calcSteps-income-rental-1038');
    if (!stepsEl) return;

    let html = '<div class="math-steps">';

    if (data.method === 'A') {
      // Formula reference
      html += '<div class="math-step">';
      html += '<h4>Method A: Schedule E Formula</h4>';
      html += '<div class="math-formula">';
      html += '<span class="math-note">Rental Income from Schedule E with PITIA add-backs:</span>';
      html += '<div class="math-values">';
      html += 'Adjusted = Rents &minus; Total Expenses + Insurance + Mort Interest + Taxes + HOA + Depreciation + One-time<br>';
      html += 'Monthly = Adjusted / Months in Service<br>';
      html += 'Net = Monthly &minus; Proposed PITIA';
      html += '</div></div></div>';

      // Step 1: Schedule E adjustments
      html += '<div class="math-step">';
      html += '<h4>Step 1 &ndash; Adjusted Annual Income</h4>';
      html += '<div class="math-formula">';
      html += 'A1. Rents received: ' + fmt(data.rents) + '<br>';
      html += 'A2. Total expenses: &minus;' + fmt(data.expenses) + '<br>';
      html += 'A3. Insurance (add back): +' + fmt(data.insurance) + '<br>';
      html += 'A4. Mortgage interest (add back): +' + fmt(data.mortint) + '<br>';
      html += 'A5. Taxes (add back): +' + fmt(data.taxes) + '<br>';
      html += 'A6. HOA dues (add back): +' + fmt(data.hoa) + '<br>';
      html += 'A7. Depreciation (add back): +' + fmt(data.deprec) + '<br>';
      html += 'A8. One-time expense (add back): +' + fmt(data.onetime) + '<br>';
      html += '<div class="math-values">';
      html += 'Adjusted Annual = ' + fmt(data.adjustedIncome);
      html += '</div></div></div>';

      // Step 2: Monthly
      html += '<div class="math-step">';
      html += '<h4>Step 2 &ndash; Adjusted Monthly Income</h4>';
      html += '<div class="math-formula">';
      html += fmt(data.adjustedIncome) + ' / ' + data.months + ' months<br>';
      html += '<div class="math-values">';
      html += 'A9. Monthly = ' + fmt(data.monthlyAdjusted);
      html += '</div></div></div>';

      // Step 3: Net after PITIA
      html += '<div class="math-step highlight">';
      html += '<h4>Step 3 &ndash; Net Rental Income</h4>';
      html += '<div class="math-formula">';
      html += fmt(data.monthlyAdjusted) + ' &minus; ' + fmt(data.pitia) + ' (PITIA)<br>';
      html += '<div class="math-values">';
      html += '<strong>Net Rental Income = ' + fmt(data.finalResult) + '</strong>';
      html += '</div></div></div>';

    } else {
      // Method B
      html += '<div class="math-step">';
      html += '<h4>Method B: Lease Agreement Formula</h4>';
      html += '<div class="math-formula">';
      html += '<span class="math-note">Gross rent &times; 75% vacancy/expense factor, less proposed PITIA:</span>';
      html += '<div class="math-values">';
      html += 'Adjusted Monthly = Gross Rent &times; 0.75<br>';
      html += 'Net = Adjusted Monthly &minus; Proposed PITIA';
      html += '</div></div></div>';

      // Step 1: 75% factor
      html += '<div class="math-step">';
      html += '<h4>Step 1 &ndash; Adjusted Monthly Rent</h4>';
      html += '<div class="math-formula">';
      html += 'B1. Gross monthly rent: ' + fmt(data.grossRent) + '<br>';
      html += fmt(data.grossRent) + ' &times; 0.75<br>';
      html += '<div class="math-values">';
      html += 'B2. Adjusted Monthly = ' + fmt(data.adjustedMonthly);
      html += '</div></div></div>';

      // Step 2: Net after PITIA
      html += '<div class="math-step highlight">';
      html += '<h4>Step 2 &ndash; Net Rental Income</h4>';
      html += '<div class="math-formula">';
      html += fmt(data.adjustedMonthly) + ' &minus; ' + fmt(data.pitia) + ' (PITIA)<br>';
      html += '<div class="math-values">';
      html += '<strong>Net Rental Income = ' + fmt(data.finalResult) + '</strong>';
      html += '</div></div></div>';
    }

    html += '</div>';
    stepsEl.innerHTML = html;
  }

  // =====================================================
  // EXPORT CSV
  // =====================================================

  function exportCSV() {
    const rows = [
      ['Rental Income Worksheet (1038)'],
      ['Method', currentMethod === 'scheduleE' ? 'A - Schedule E' : 'B - Lease Agreement'],
      ['']
    ];

    if (currentMethod === 'scheduleE') {
      const rents     = pn('methodA_rents');
      const expenses  = pn('methodA_expenses');
      const insurance = pn('methodA_insurance');
      const mortint   = pn('methodA_mortint');
      const taxes     = pn('methodA_taxes');
      const hoa       = pn('methodA_hoa');
      const deprec    = pn('methodA_deprec');
      const onetime   = pn('methodA_onetime');
      const months    = pn('methodA_months') || 12;
      const pitia     = pn('methodA_pitia');

      const adjustedIncome = (rents + insurance + mortint + taxes + hoa + deprec + onetime) - expenses;
      const monthlyAdj = adjustedIncome / months;
      const finalResult = monthlyAdj - pitia;

      rows.push(['Field', 'Amount']);
      rows.push(['A1. Total rents received', rents]);
      rows.push(['A2. Total expenses', expenses]);
      rows.push(['A3. Insurance (add back)', insurance]);
      rows.push(['A4. Mortgage interest (add back)', mortint]);
      rows.push(['A5. Taxes (add back)', taxes]);
      rows.push(['A6. HOA dues (add back)', hoa]);
      rows.push(['A7. Depreciation (add back)', deprec]);
      rows.push(['A8. One-time expense (add back)', onetime]);
      rows.push(['Months in service', months]);
      rows.push(['A9. Adjusted Monthly Income', monthlyAdj]);
      rows.push(['A10. Proposed PITIA', pitia]);
      rows.push(['']);
      rows.push(['Net Rental Income (Method A)', finalResult]);
    } else {
      const grossRent = pn('methodB_grossrent');
      const pitiaB    = pn('methodB_pitia');
      const adjustedMonthly = grossRent * 0.75;
      const finalResultB = adjustedMonthly - pitiaB;

      rows.push(['Field', 'Amount']);
      rows.push(['B1. Gross monthly rent', grossRent]);
      rows.push(['B2. Adjusted Monthly (75%)', adjustedMonthly]);
      rows.push(['B3. Proposed PITIA', pitiaB]);
      rows.push(['']);
      rows.push(['Net Rental Income (Method B)', finalResultB]);
    }

    rows.push(['']);
    rows.push(['Generated', new Date().toLocaleString()]);

    IC.downloadCSV(rows, 'rental-income-1038-');
  }

  // =====================================================
  // CLEAR ALL
  // =====================================================

  function clearAll() {
    IC.clearAll(calculate, { 'methodA_months': '12' });
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  document.addEventListener('DOMContentLoaded', () => {
    // Method selector buttons
    document.querySelectorAll('[data-method]').forEach(btn => {
      const method = btn.getAttribute('data-method');
      btn.addEventListener('click', () => selectMethod(method));
      btn.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectMethod(method);
        }
      });
    });

    IncomeUpload.init({
      slug:     'income-rental-1038',
      label:    'Schedule E',
      maxDocs:  1,
      buildCardBody: (doc) => {
        const yearLabel  = doc.taxYear || 'Schedule E';
        const rentsLabel = (doc.rentsReceived != null && doc.rentsReceived !== 0)
          ? fmt(doc.rentsReceived) : '--';

        let html = '';
        html += '<div class="doc-card__header">';
        html += '<span class="doc-card__year">' + IncomeUpload.escHtml(String(yearLabel)) + '</span>';
        html += '<span class="doc-card__name">Schedule E</span>';
        html += '<span class="doc-card__badge">Method A</span>';
        html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
        html += '</div>';
        html += '<div class="doc-card__amounts">';
        html += '<span>Rents Received: ' + rentsLabel + '</span>';
        html += '</div>';
        return html;
      },
      onAfterSync: () => {
        const docs = IncomeUpload.getDocStore();
        if (docs.length > 0) {
          syncFieldsFromDoc(docs[0]);
          if (currentMethod !== 'scheduleE') {
            selectMethod('scheduleE');
          }
        }
        calculate();
      },
      onRemove: () => {
        clearMethodAFields();
        calculate();
      }
    });

    IC.initPage(calculate);
  });

  window.calculate = calculate;
  window.exportCSV = exportCSV;
  window.clearAll = clearAll;

})();
