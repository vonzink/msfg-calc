(function () {
  'use strict';

  var P = MSFG.parseNum;
  var fmt = MSFG.formatCurrency;

  /* ---- DOM cache ---- */
  var dom = {};

  /* ---- Field ID groups ---- */
  var employmentIds = ['bgBaseIncome', 'bgOvertime', 'bgBonus', 'bgCommission'];
  var otherQualIds = ['bgSelfEmployment', 'bgRental', 'bgDividends', 'bgSSPension', 'bgSupportReceived'];
  var additionalIds = ['bgSpouseIncome', 'bgSideGig', 'bgOtherHousehold'];
  var housingIds = ['bgPI', 'bgPropertyTax', 'bgHomeInsurance', 'bgMI', 'bgHOA', 'bgFlood', 'bgOtherHousing'];
  var liabilityIds = ['bgAutoLoan', 'bgStudentLoan', 'bgCreditCard', 'bgPersonalLoan', 'bgSupportPaid', 'bgOtherDebt'];
  var livingIds = ['bgUtilities', 'bgTelecom', 'bgGroceries', 'bgTransport', 'bgInsurance', 'bgChildcare', 'bgEntertainment', 'bgOtherLiving'];
  var reserveIds = ['bgChecking', 'bgSavings', 'bgRetirement', 'bgInvestments', 'bgOtherAssets'];
  var loanIds = ['bgLoanAmount', 'bgRate', 'bgTermMonths', 'bgPropertyValue', 'bgCreditScore', 'bgNumBorrowers'];
  var metaIds = ['bgBorrowerName', 'bgFileNumber', 'bgPrepDate', 'bgLoanPurpose', 'bgProduct'];

  var allInputIds = [].concat(employmentIds, otherQualIds, additionalIds, housingIds, liabilityIds, livingIds, reserveIds, loanIds, metaIds);

  /* Computed fields */
  var computedIds = ['bgPI'];
  var overrides = {};

  /* Custom line items */
  var customItems = [];
  var customItemCounter = 0;

  var sectionContainers = {
    employment: 'bgEmploymentItems',
    otherQual: 'bgOtherQualItems',
    additional: 'bgAdditionalItems',
    housing: 'bgHousingItems',
    liabilities: 'bgLiabilityItems',
    living: 'bgLivingItems'
  };

  /* ---- Helpers ---- */
  function cacheDom() {
    allInputIds.forEach(function (id) {
      dom[id] = document.getElementById(id);
    });
  }

  function v(id) {
    var el = dom[id] || document.getElementById(id);
    if (!el) return 0;
    return P(el.value) || 0;
  }

  function setComputed(id, calculatedValue) {
    var el = dom[id] || document.getElementById(id);
    if (!el) return calculatedValue;
    if (overrides[id]) return P(el.value) || 0;
    el.value = Math.round(calculatedValue * 100) / 100;
    return calculatedValue;
  }

  function sumIds(ids) {
    var total = 0;
    ids.forEach(function (id) { total += v(id); });
    return total;
  }

  function sumCustomItems(section) {
    var total = 0;
    customItems.forEach(function (item) {
      if (item.section === section) {
        var el = document.getElementById(item.inputId);
        if (el) total += P(el.value) || 0;
      }
    });
    return total;
  }

  /* ---- DTI status helpers ---- */
  function setGauge(gaugeId, pct, thresholdPct) {
    var el = document.getElementById(gaugeId);
    if (!el) return;
    var capped = Math.min(pct, 50);
    el.style.width = (capped / 50 * 100) + '%';
    el.className = 'bg-gauge__fill';
    if (pct > thresholdPct + 5) el.classList.add('bg-gauge__fill--over');
    else if (pct > thresholdPct) el.classList.add('bg-gauge__fill--warn');
  }

  function setStatus(id, pct, threshold, label) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = 'bg-card__status';
    if (pct === 0) {
      el.textContent = 'Enter income & ' + label + ' data';
    } else if (pct <= threshold) {
      el.textContent = 'Within guidelines (\u2264' + threshold + '%)';
      el.classList.add('bg-card__status--good');
    } else if (pct <= threshold + 7) {
      el.textContent = 'Approaching limit (' + threshold + '% guideline)';
      el.classList.add('bg-card__status--warn');
    } else {
      el.textContent = 'Exceeds ' + threshold + '% guideline';
      el.classList.add('bg-card__status--over');
    }
  }

  /* ---- Main calculation ---- */
  function calculate() {
    /* INCOME */
    var employmentTotal = sumIds(employmentIds) + sumCustomItems('employment');
    var otherQualTotal = sumIds(otherQualIds) + sumCustomItems('otherQual');
    var qualifyingIncome = employmentTotal + otherQualTotal;
    var additionalTotal = sumIds(additionalIds) + sumCustomItems('additional');
    var grandTotalIncome = qualifyingIncome + additionalTotal;

    document.getElementById('bgEmploymentTotal').textContent = fmt(employmentTotal);
    document.getElementById('bgOtherQualTotal').textContent = fmt(otherQualTotal);
    document.getElementById('bgTotalQualIncome').textContent = fmt(qualifyingIncome);
    document.getElementById('bgAdditionalTotal').textContent = fmt(additionalTotal);
    document.getElementById('bgGrandTotalIncome').textContent = fmt(grandTotalIncome);

    /* PROPOSED HOUSING */
    var loanAmount = v('bgLoanAmount');
    var rate = v('bgRate');
    var termMonths = v('bgTermMonths');

    var piCalc = 0;
    if (loanAmount > 0 && rate > 0 && termMonths > 0) {
      piCalc = MSFG.calcMonthlyPayment(loanAmount, rate / 100, termMonths / 12);
    }
    var pi = setComputed('bgPI', piCalc);

    var housingTotal = sumIds(housingIds) + sumCustomItems('housing');
    document.getElementById('bgHousingTotal').textContent = fmt(housingTotal);

    /* LIABILITIES */
    var liabilitiesTotal = sumIds(liabilityIds) + sumCustomItems('liabilities');
    document.getElementById('bgLiabilitiesTotal').textContent = fmt(liabilitiesTotal);

    /* LIVING EXPENSES */
    var livingTotal = sumIds(livingIds) + sumCustomItems('living');
    document.getElementById('bgLivingTotal').textContent = fmt(livingTotal);

    /* TOTAL EXPENSES */
    var grandTotalExpenses = housingTotal + liabilitiesTotal + livingTotal;
    document.getElementById('bgGrandTotalExpenses').textContent = fmt(grandTotalExpenses);

    /* DTI RATIOS (use qualifying income only) */
    var frontDTI = qualifyingIncome > 0 ? (housingTotal / qualifyingIncome * 100) : 0;
    var backDTI = qualifyingIncome > 0 ? ((housingTotal + liabilitiesTotal) / qualifyingIncome * 100) : 0;

    document.getElementById('bgFrontDTI').textContent = frontDTI.toFixed(2) + '%';
    document.getElementById('bgBackDTI').textContent = backDTI.toFixed(2) + '%';

    setGauge('bgFrontGauge', frontDTI, 28);
    setGauge('bgBackGauge', backDTI, 36);
    setStatus('bgFrontStatus', frontDTI, 28, 'housing');
    setStatus('bgBackStatus', backDTI, 36, 'debt');

    /* RESIDUAL INCOME */
    var residualAfterDTI = qualifyingIncome - housingTotal - liabilitiesTotal;
    var residualAfterLiving = grandTotalIncome - grandTotalExpenses;

    document.getElementById('bgResidualAfterDTI').textContent = fmt(residualAfterDTI);
    document.getElementById('bgResidualAfterLiving').textContent = fmt(residualAfterLiving);
    document.getElementById('bgResidualIncome').textContent = fmt(residualAfterDTI);

    var residualEl = document.getElementById('bgResidualStatus');
    if (residualEl) {
      residualEl.className = 'bg-card__status';
      if (qualifyingIncome === 0) {
        residualEl.textContent = 'Enter all data for complete picture';
      } else if (residualAfterDTI > 0) {
        residualEl.textContent = fmt(residualAfterDTI) + ' remaining after obligations';
        residualEl.classList.add('bg-card__status--good');
      } else {
        residualEl.textContent = 'Obligations exceed qualifying income';
        residualEl.classList.add('bg-card__status--over');
      }
    }

    /* NET CASH FLOW */
    var netCashFlow = grandTotalIncome - grandTotalExpenses;
    document.getElementById('bgNetCashFlow').textContent = fmt(netCashFlow);
    document.getElementById('bgSummaryIncome').textContent = fmt(grandTotalIncome);
    document.getElementById('bgSummaryQualIncome').textContent = fmt(qualifyingIncome);
    document.getElementById('bgSummaryHousing').textContent = fmt(housingTotal);
    document.getElementById('bgSummaryDebts').textContent = fmt(liabilitiesTotal);
    document.getElementById('bgSummaryLiving').textContent = fmt(livingTotal);

    var cfStatus = document.getElementById('bgCashFlowStatus');
    if (cfStatus) {
      cfStatus.className = 'bg-card__status';
      if (netCashFlow > 0) {
        cfStatus.textContent = 'Positive cash flow';
        cfStatus.classList.add('bg-card__status--good');
      } else if (netCashFlow < 0) {
        cfStatus.textContent = 'Negative cash flow — budget exceeds income';
        cfStatus.classList.add('bg-card__status--over');
      } else {
        cfStatus.innerHTML = '&nbsp;';
      }
    }

    /* Color the card values based on DTI health */
    var frontValEl = document.getElementById('bgFrontDTI');
    var backValEl = document.getElementById('bgBackDTI');
    var residualValEl = document.getElementById('bgResidualIncome');
    var cashFlowValEl = document.getElementById('bgNetCashFlow');

    if (frontValEl) frontValEl.style.color = frontDTI > 33 ? '#c62828' : frontDTI > 28 ? '#e65100' : '#2d6a4f';
    if (backValEl) backValEl.style.color = backDTI > 43 ? '#c62828' : backDTI > 36 ? '#e65100' : '#2d6a4f';
    if (residualValEl) residualValEl.style.color = residualAfterDTI < 0 ? '#c62828' : '#2d6a4f';
    if (cashFlowValEl) cashFlowValEl.style.color = netCashFlow < 0 ? '#c62828' : '#2d6a4f';

    /* RESERVES */
    var totalReserves = sumIds(reserveIds);
    document.getElementById('bgTotalReserves').textContent = fmt(totalReserves);
    var reserveMonths = housingTotal > 0 ? Math.floor(totalReserves / housingTotal) : 0;
    document.getElementById('bgReserveMonths').textContent = reserveMonths + ' months';

    /* CALCULATION STEPS */
    updateMathSteps({
      qualifyingIncome: qualifyingIncome,
      additionalIncome: additionalTotal,
      grandTotalIncome: grandTotalIncome,
      housingTotal: housingTotal,
      liabilitiesTotal: liabilitiesTotal,
      livingTotal: livingTotal,
      pi: pi,
      loanAmount: loanAmount,
      rate: rate,
      termMonths: termMonths,
      frontDTI: frontDTI,
      backDTI: backDTI,
      residualAfterDTI: residualAfterDTI,
      residualAfterLiving: residualAfterLiving,
      totalReserves: totalReserves,
      reserveMonths: reserveMonths
    });

    /* WORKSPACE TALLY */
    if (window.top !== window) {
      window.top.postMessage({
        type: 'msfg-tally-update',
        slug: 'budget',
        monthlyPayment: housingTotal,
        loanAmount: loanAmount,
        frontDTI: frontDTI.toFixed(2) + '%',
        backDTI: backDTI.toFixed(2) + '%'
      }, window.location.origin);
    }
  }

  /* ---- Math steps ---- */
  function updateMathSteps(d) {
    var container = document.getElementById('calcSteps-budget');
    if (!container) return;

    var html = '';

    html += '<div class="calc-step"><h4>Step 1: Monthly P&I Payment</h4>';
    if (d.loanAmount > 0 && d.rate > 0 && d.termMonths > 0) {
      var r = d.rate / 100 / 12;
      html += '<div class="calc-step__formula">M = P &times; [r(1+r)<sup>n</sup>] / [(1+r)<sup>n</sup> - 1]</div>';
      html += '<div class="calc-step__values">';
      html += 'P = ' + fmt(d.loanAmount) + ', r = ' + d.rate + '% / 12 = ' + (r * 100).toFixed(6) + '%, n = ' + d.termMonths + ' months<br>';
      html += '<strong>Monthly P&I = ' + fmt(d.pi) + '</strong>';
      html += '</div>';
    } else {
      html += '<div class="calc-step__values">Enter loan amount, rate, and term to calculate P&I</div>';
    }
    html += '</div>';

    html += '<div class="calc-step"><h4>Step 2: Total Proposed Housing Payment (PITIA)</h4>';
    html += '<div class="calc-step__formula">Housing = P&I + Taxes + Insurance + MI + HOA + Flood + Other</div>';
    html += '<div class="calc-step__values"><strong>Total Housing = ' + fmt(d.housingTotal) + '</strong></div>';
    html += '</div>';

    html += '<div class="calc-step"><h4>Step 3: Front-End DTI Ratio</h4>';
    html += '<div class="calc-step__formula">Front-End DTI = (Total Housing Payment / Qualifying Monthly Income) &times; 100</div>';
    html += '<div class="calc-step__values">';
    html += 'Front-End DTI = (' + fmt(d.housingTotal) + ' / ' + fmt(d.qualifyingIncome) + ') &times; 100';
    html += '<br><strong>Front-End DTI = ' + d.frontDTI.toFixed(2) + '%</strong>';
    html += '<br><em>Conventional guideline: &le;28%, FHA: &le;31%, VA: no front-end limit</em>';
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 4: Back-End DTI Ratio</h4>';
    html += '<div class="calc-step__formula">Back-End DTI = (Housing + Recurring Debts) / Qualifying Monthly Income &times; 100</div>';
    html += '<div class="calc-step__values">';
    html += 'Back-End DTI = (' + fmt(d.housingTotal) + ' + ' + fmt(d.liabilitiesTotal) + ') / ' + fmt(d.qualifyingIncome) + ' &times; 100';
    html += '<br><strong>Back-End DTI = ' + d.backDTI.toFixed(2) + '%</strong>';
    html += '<br><em>Conventional guideline: &le;36-45%, FHA: &le;43-57%, VA: &le;41%</em>';
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 5: Residual Income</h4>';
    html += '<div class="calc-step__formula">Residual = Qualifying Income - Housing - Recurring Debts</div>';
    html += '<div class="calc-step__values">';
    html += 'Residual = ' + fmt(d.qualifyingIncome) + ' - ' + fmt(d.housingTotal) + ' - ' + fmt(d.liabilitiesTotal);
    html += '<br><strong>Residual Income = ' + fmt(d.residualAfterDTI) + '</strong>';
    html += '<br><em>VA residual income requirements vary by region, loan amount, and family size</em>';
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 6: Reserves</h4>';
    html += '<div class="calc-step__formula">Months of Reserves = Total Liquid Assets / Total Monthly Housing Payment</div>';
    html += '<div class="calc-step__values">';
    html += 'Reserves = ' + fmt(d.totalReserves) + ' / ' + fmt(d.housingTotal);
    html += '<br><strong>' + d.reserveMonths + ' months of reserves</strong>';
    html += '<br><em>Most lenders require 2-6 months reserves for qualification</em>';
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 7: Full Budget Cash Flow</h4>';
    html += '<div class="calc-step__formula">Net Cash Flow = All Income - Housing - Debts - Living Expenses</div>';
    html += '<div class="calc-step__values">';
    html += 'Cash Flow = ' + fmt(d.grandTotalIncome) + ' - ' + fmt(d.housingTotal) + ' - ' + fmt(d.liabilitiesTotal) + ' - ' + fmt(d.livingTotal);
    html += '<br><strong>Net Monthly Cash Flow = ' + fmt(d.residualAfterLiving) + '</strong>';
    html += '<br><em>Note: Additional (non-application) income included in total cash flow but excluded from DTI</em>';
    html += '</div></div>';

    container.innerHTML = html;
  }

  /* ---- Custom line items ---- */
  function addLineItem() {
    var sectionKey = document.getElementById('bgNewItemSection').value;
    var nameInput = document.getElementById('bgNewItemName');
    var amountInput = document.getElementById('bgNewItemAmount');
    var name = (nameInput.value || '').trim();
    var amount = P(amountInput.value) || 0;

    if (!name) { nameInput.focus(); return; }

    customItemCounter++;
    var inputId = 'bgCustom_' + customItemCounter;

    var item = { id: customItemCounter, section: sectionKey, name: name, inputId: inputId };
    customItems.push(item);

    var row = document.createElement('div');
    row.className = 'bg-row bg-row--custom';
    row.dataset.customId = String(customItemCounter);

    var label = document.createElement('label');
    label.textContent = name;

    var input = document.createElement('input');
    input.type = 'number';
    input.id = inputId;
    input.value = amount;
    input.min = '0';
    input.step = '0.01';
    input.className = 'bg-input';
    input.addEventListener('input', calculate);
    input.addEventListener('change', calculate);

    var period = document.createElement('span');
    period.className = 'bg-row__period';
    period.textContent = '/mo';

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'bg-row__remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', function () { removeLineItem(item.id); });

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(period);
    row.appendChild(removeBtn);

    var containerId = sectionContainers[sectionKey];
    var container = document.getElementById(containerId);
    if (container) container.appendChild(row);

    nameInput.value = '';
    amountInput.value = '0';
    calculate();
  }

  function removeLineItem(id) {
    customItems = customItems.filter(function (item) { return item.id !== id; });
    var row = document.querySelector('[data-custom-id="' + id + '"]');
    if (row) row.remove();
    calculate();
  }

  /* ---- MISMO Auto-Fill ---- */
  function populateFromMISMO(data) {
    var fields = {};

    /* Borrower info */
    if (data.borrowerName) fields['bgBorrowerName'] = data.borrowerName;
    if (data.loan.loanIdentifier) fields['bgFileNumber'] = data.loan.loanIdentifier;

    /* Loan info */
    if (data.loan.amount) fields['bgLoanAmount'] = data.loan.amount;
    if (data.loan.rate) fields['bgRate'] = data.loan.rate;
    if (data.loan.termMonths) fields['bgTermMonths'] = data.loan.termMonths;
    if (data.property.value) fields['bgPropertyValue'] = data.property.value;
    if (data.loan.productName) fields['bgProduct'] = data.loan.productName;
    if (data.borrowers.length > 0 && data.borrowers[0].creditScore) fields['bgCreditScore'] = data.borrowers[0].creditScore;
    if (data.borrowers.length) fields['bgNumBorrowers'] = data.borrowers.length;

    /* Loan purpose */
    var purposeEl = document.getElementById('bgLoanPurpose');
    if (purposeEl && data.loan.purpose) {
      var opts = purposeEl.options;
      for (var i = 0; i < opts.length; i++) {
        if (opts[i].value === data.loan.purpose || opts[i].value.toLowerCase().indexOf(data.loan.purpose.toLowerCase()) !== -1) {
          purposeEl.selectedIndex = i;
          purposeEl.classList.add('mismo-populated');
          break;
        }
      }
    }

    /* Qualifying income from MISMO */
    if (data.qualification && data.qualification.totalMonthlyIncome) {
      fields['bgBaseIncome'] = data.qualification.totalMonthlyIncome;
    } else {
      /* Sum borrower incomes */
      var totalBorrowerIncome = 0;
      data.borrowers.forEach(function (b) { totalBorrowerIncome += b.income || 0; });
      if (totalBorrowerIncome > 0) fields['bgBaseIncome'] = totalBorrowerIncome;
    }

    /* Housing expenses */
    if (data.housing.pi) fields['bgPI'] = data.housing.pi;
    if (data.housing.taxMo) fields['bgPropertyTax'] = data.housing.taxMo;
    if (data.housing.insuranceMo) fields['bgHomeInsurance'] = data.housing.insuranceMo;
    if (data.housing.mi) fields['bgMI'] = data.housing.mi;
    if (data.housing.hoa) fields['bgHOA'] = data.housing.hoa;

    /* If no housing breakdown, use projected payments */
    if (!data.housing.pi && data.loan.piPayment) fields['bgPI'] = data.loan.piPayment;
    if (!data.housing.mi && data.loan.miPayment) fields['bgMI'] = data.loan.miPayment;

    /* Escrow-based housing if no housing node */
    if (!data.housing.taxMo && data.escrow.taxMonthly) fields['bgPropertyTax'] = data.escrow.taxMonthly;
    if (!data.housing.insuranceMo && data.escrow.insMonthly) fields['bgHomeInsurance'] = data.escrow.insMonthly;

    /* Set fields and mark as MISMO-populated */
    Object.keys(fields).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.value = fields[id];
      el.classList.add('mismo-populated');
      /* If it's a computed field, mark the override since MISMO set it */
      if (computedIds.indexOf(id) !== -1 && fields[id]) {
        overrides[id] = true;
      }
    });

    /* Liabilities from MISMO — aggregate by type */
    if (data.liabilities && data.liabilities.length) {
      var liabAgg = { auto: 0, student: 0, creditCard: 0, personal: 0, other: 0 };

      data.liabilities.forEach(function (l) {
        if (l.payoff) return; // Skip liabilities being paid off
        var pmt = l.payment || 0;
        if (!pmt) return;
        var type = (l.type || '').toLowerCase();
        if (type.indexOf('auto') !== -1 || type.indexOf('carloan') !== -1 || type === 'installment') {
          liabAgg.auto += pmt;
        } else if (type.indexOf('student') !== -1 || type.indexOf('education') !== -1) {
          liabAgg.student += pmt;
        } else if (type.indexOf('revolving') !== -1 || type.indexOf('creditcard') !== -1 || type === 'revolving') {
          liabAgg.creditCard += pmt;
        } else if (type === 'mortgageloan') {
          // Skip — this is the existing mortgage, not a recurring debt for DTI
          return;
        } else {
          liabAgg.other += pmt;
        }
      });

      var liabMap = {
        'bgAutoLoan': liabAgg.auto,
        'bgStudentLoan': liabAgg.student,
        'bgCreditCard': liabAgg.creditCard,
        'bgOtherDebt': liabAgg.other
      };

      Object.keys(liabMap).forEach(function (id) {
        if (liabMap[id] > 0) {
          var el = document.getElementById(id);
          if (el) {
            el.value = Math.round(liabMap[id] * 100) / 100;
            el.classList.add('mismo-populated');
          }
        }
      });
    }

    calculate();
  }

  /* ---- File upload handler (reuses MSFG.FileUpload pattern) ---- */
  function handleMISMOFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = MSFG.MISMOParser.parse(e.target.result);
        populateFromMISMO(data);
      } catch (err) {
        console.error('MISMO parse error:', err);
      }
    };
    reader.readAsText(file);
  }

  /* ---- Listen for workspace MISMO broadcast ---- */
  function handleMessage(e) {
    if (e.origin !== window.location.origin) return;
    var msg = e.data;
    if (msg && msg.type === 'msfg-mismo-data') {
      try {
        var data = MSFG.MISMOParser.parse(msg.xml);
        populateFromMISMO(data);
      } catch (err) {
        console.error('MISMO parse error:', err);
      }
    }
  }

  /* ---- Print & Clear ---- */
  function printBudget() { window.print(); }

  function clearAll() {
    overrides = {};
    customItems.forEach(function (item) {
      var row = document.querySelector('[data-custom-id="' + item.id + '"]');
      if (row) row.remove();
    });
    customItems = [];
    customItemCounter = 0;

    allInputIds.forEach(function (id) {
      var el = dom[id] || document.getElementById(id);
      if (!el) return;
      el.classList.remove('mismo-populated');
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else if (el.type === 'date') {
        el.value = '';
      } else if (el.type === 'number') {
        el.value = id === 'bgTermMonths' ? '360' : id === 'bgNumBorrowers' ? '1' : '0';
      } else {
        el.value = '';
      }
    });
    calculate();
  }

  /* ---- Init ---- */
  function init() {
    cacheDom();

    /* Set date */
    var prepDate = dom['bgPrepDate'];
    if (prepDate && !prepDate.value) {
      var today = new Date();
      prepDate.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    }

    /* Computed field override tracking */
    computedIds.forEach(function (id) {
      var el = dom[id] || document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        overrides[id] = true;
        el.classList.add('bg-input--overridden');
      });
      el.addEventListener('dblclick', function () {
        delete overrides[id];
        el.classList.remove('bg-input--overridden');
        calculate();
      });
    });

    /* Bind all inputs */
    allInputIds.forEach(function (id) {
      var el = dom[id] || document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    /* Buttons */
    var addBtn = document.getElementById('bgAddItemBtn');
    if (addBtn) addBtn.addEventListener('click', addLineItem);

    var nameInput = document.getElementById('bgNewItemName');
    var amountInput = document.getElementById('bgNewItemAmount');
    [nameInput, amountInput].forEach(function (el) {
      if (el) {
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); addLineItem(); }
        });
      }
    });

    var printBtn = document.getElementById('bgPrintBtn');
    if (printBtn) printBtn.addEventListener('click', printBudget);

    var clearBtn = document.getElementById('bgClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);

    /* Workspace message listener */
    window.addEventListener('message', handleMessage);

    /* MISMO-populated field: remove glow on manual edit */
    document.querySelector('.calc-page').addEventListener('input', function (e) {
      if (e.target.classList.contains('mismo-populated')) {
        e.target.classList.remove('mismo-populated');
      }
    });

    calculate();
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');
  });
})();
