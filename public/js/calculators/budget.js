(function () {
  'use strict';

  var P = MSFG.parseNum;
  var fmt = MSFG.formatCurrency;

  /* ---- Dynamic row stores ---- */
  var incomeRows = [];   // { id, name, type, amount }
  var liabilityRows = []; // { id, holder, type, balance, payment, months, omit, payoff, account }
  var incomeCounter = 0;
  var liabilityCounter = 0;

  /* ---- Static field IDs ---- */
  var additionalIds = ['bgSpouseIncome', 'bgSideGig', 'bgOtherHousehold'];
  var housingIds = ['bgPI', 'bgPropertyTax', 'bgHomeInsurance', 'bgMI', 'bgHOA', 'bgFlood', 'bgOtherHousing'];
  var livingIds = ['bgUtilities', 'bgTelecom', 'bgGroceries', 'bgTransport', 'bgInsurance', 'bgChildcare', 'bgEntertainment', 'bgOtherLiving'];
  var reserveIds = ['bgChecking', 'bgSavings', 'bgRetirement', 'bgInvestments', 'bgOtherAssets'];
  var adjustmentIds = ['bgTaxRate', 'bgSavingsRate'];
  var loanIds = ['bgLoanAmount', 'bgRate', 'bgTermMonths', 'bgPropertyValue', 'bgCreditScore', 'bgNumBorrowers'];
  var metaIds = ['bgBorrowerName', 'bgFileNumber', 'bgPrepDate', 'bgLoanPurpose', 'bgProduct'];

  var allStaticIds = [].concat(additionalIds, housingIds, livingIds, reserveIds, adjustmentIds, loanIds, metaIds);

  /* Computed fields */
  var computedIds = ['bgPI'];
  var overrides = {};

  /* ---- Helpers ---- */
  function v(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    return P(el.value) || 0;
  }

  function setComputed(id, calculatedValue) {
    var el = document.getElementById(id);
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

  function friendlyLiabType(type) {
    if (!type) return '';
    var map = {
      'Revolving': 'Revolving',
      'Installment': 'Installment',
      'MortgageLoan': 'Mortgage',
      'HELOC': 'HELOC',
      'Open30DayChargeAccount': 'Charge Acct',
      'LeasePayment': 'Lease',
      'Other': 'Other',
      'CollectionsJudgmentsAndLiens': 'Collections'
    };
    return map[type] || type.replace(/([A-Z])/g, ' $1').trim();
  }

  /* ---- Income Row Management ---- */
  function createIncomeRow(data) {
    incomeCounter++;
    var id = incomeCounter;
    var row = {
      id: id,
      name: (data && data.name) || '',
      type: (data && data.type) || '',
      amount: (data && data.amount) || 0
    };
    incomeRows.push(row);
    renderIncomeRow(row, data && data.mismo);
    return row;
  }

  function renderIncomeRow(row, isMismo) {
    var container = document.getElementById('bgIncomeBody');
    if (!container) return;

    var div = document.createElement('div');
    div.className = 'bg-income-row';
    div.dataset.incomeIdx = String(row.id);

    var main = document.createElement('div');
    main.className = 'bg-income-row__main';

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'bg-income-row__name';
    nameInput.placeholder = 'Employer / Source';
    nameInput.value = row.name;
    nameInput.dataset.field = 'name';
    if (isMismo) nameInput.classList.add('mismo-populated');

    var typeInput = document.createElement('input');
    typeInput.type = 'text';
    typeInput.className = 'bg-income-row__type';
    typeInput.placeholder = 'Type';
    typeInput.value = row.type;
    typeInput.dataset.field = 'type';
    if (isMismo) typeInput.classList.add('mismo-populated');

    var amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.className = 'bg-input bg-income-row__amount';
    amountInput.value = row.amount;
    amountInput.min = '0';
    amountInput.step = '1';
    amountInput.dataset.field = 'amount';
    if (isMismo) amountInput.classList.add('mismo-populated');

    var period = document.createElement('span');
    period.className = 'bg-row__period';
    period.textContent = '/mo';

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'bg-row__remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', function () { removeIncomeRow(row.id); });

    main.appendChild(nameInput);
    main.appendChild(typeInput);
    main.appendChild(amountInput);
    main.appendChild(period);
    main.appendChild(removeBtn);
    div.appendChild(main);

    /* Bind change events */
    nameInput.addEventListener('input', function () {
      row.name = nameInput.value;
      nameInput.classList.remove('mismo-populated');
    });
    typeInput.addEventListener('input', function () {
      row.type = typeInput.value;
      typeInput.classList.remove('mismo-populated');
    });
    amountInput.addEventListener('input', function () {
      row.amount = P(amountInput.value) || 0;
      amountInput.classList.remove('mismo-populated');
      calculate();
    });
    amountInput.addEventListener('change', calculate);

    container.appendChild(div);
  }

  function removeIncomeRow(id) {
    incomeRows = incomeRows.filter(function (r) { return r.id !== id; });
    var el = document.querySelector('[data-income-idx="' + id + '"]');
    if (el) el.remove();
    calculate();
  }

  function clearIncomeRows() {
    incomeRows = [];
    incomeCounter = 0;
    var body = document.getElementById('bgIncomeBody');
    if (body) body.innerHTML = '';
  }

  /* ---- Liability Row Management ---- */
  function createLiabilityRow(data) {
    liabilityCounter++;
    var id = liabilityCounter;
    var row = {
      id: id,
      holder: (data && data.holder) || '',
      type: (data && data.type) || '',
      balance: (data && data.balance) || 0,
      payment: (data && data.payment) || 0,
      months: (data && data.months) || 0,
      omit: (data && data.omit) || false,
      payoff: (data && data.payoff) || false,
      account: (data && data.account) || ''
    };
    liabilityRows.push(row);
    renderLiabilityRow(row, data && data.mismo);
    return row;
  }

  function renderLiabilityRow(row, isMismo) {
    var body = document.getElementById('bgLiabilityBody');
    if (!body) return;

    var div = document.createElement('div');
    div.className = 'bg-liab-row';
    if (row.omit) div.classList.add('bg-liab-row--omitted');
    if (row.payoff) div.classList.add('bg-liab-row--payoff');
    div.dataset.liabIdx = String(row.id);

    /* Holder / Creditor name */
    var holderInput = document.createElement('input');
    holderInput.type = 'text';
    holderInput.className = 'bg-liab-col bg-liab-col--name';
    holderInput.placeholder = 'Creditor';
    holderInput.value = row.holder;
    if (isMismo) holderInput.classList.add('mismo-populated');

    /* Type */
    var typeSpan = document.createElement('span');
    typeSpan.className = 'bg-liab-col bg-liab-col--type';
    typeSpan.textContent = friendlyLiabType(row.type);
    typeSpan.title = row.type;

    /* Balance */
    var balanceInput = document.createElement('input');
    balanceInput.type = 'number';
    balanceInput.className = 'bg-liab-col bg-liab-col--balance bg-input';
    balanceInput.value = row.balance;
    balanceInput.min = '0';
    balanceInput.step = '1';
    if (isMismo) balanceInput.classList.add('mismo-populated');

    /* Payment */
    var paymentInput = document.createElement('input');
    paymentInput.type = 'number';
    paymentInput.className = 'bg-liab-col bg-liab-col--payment bg-input';
    paymentInput.value = row.payment;
    paymentInput.min = '0';
    paymentInput.step = '1';
    if (isMismo) paymentInput.classList.add('mismo-populated');

    /* Remaining months */
    var monthsInput = document.createElement('input');
    monthsInput.type = 'number';
    monthsInput.className = 'bg-liab-col bg-liab-col--months bg-input';
    monthsInput.value = row.months || '';
    monthsInput.min = '0';
    monthsInput.step = '1';
    monthsInput.placeholder = '-';
    if (isMismo && row.months) monthsInput.classList.add('mismo-populated');

    /* Omit checkbox */
    var omitLabel = document.createElement('label');
    omitLabel.className = 'bg-liab-col bg-liab-col--omit bg-liab-check';
    var omitCb = document.createElement('input');
    omitCb.type = 'checkbox';
    omitCb.checked = row.omit;
    omitLabel.appendChild(omitCb);

    /* Payoff checkbox */
    var payoffLabel = document.createElement('label');
    payoffLabel.className = 'bg-liab-col bg-liab-col--payoff bg-liab-check';
    var payoffCb = document.createElement('input');
    payoffCb.type = 'checkbox';
    payoffCb.checked = row.payoff;
    payoffLabel.appendChild(payoffCb);

    /* Remove button */
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'bg-liab-col bg-liab-col--remove bg-row__remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';

    div.appendChild(holderInput);
    div.appendChild(typeSpan);
    div.appendChild(balanceInput);
    div.appendChild(paymentInput);
    div.appendChild(monthsInput);
    div.appendChild(omitLabel);
    div.appendChild(payoffLabel);
    div.appendChild(removeBtn);

    /* Event bindings */
    holderInput.addEventListener('input', function () {
      row.holder = holderInput.value;
      holderInput.classList.remove('mismo-populated');
    });
    balanceInput.addEventListener('input', function () {
      row.balance = P(balanceInput.value) || 0;
      balanceInput.classList.remove('mismo-populated');
      calculate();
    });
    balanceInput.addEventListener('change', calculate);
    paymentInput.addEventListener('input', function () {
      row.payment = P(paymentInput.value) || 0;
      paymentInput.classList.remove('mismo-populated');
      calculate();
    });
    paymentInput.addEventListener('change', calculate);
    monthsInput.addEventListener('input', function () {
      row.months = P(monthsInput.value) || 0;
      monthsInput.classList.remove('mismo-populated');
    });

    omitCb.addEventListener('change', function () {
      row.omit = omitCb.checked;
      if (row.omit) {
        row.payoff = false;
        payoffCb.checked = false;
        div.classList.add('bg-liab-row--omitted');
        div.classList.remove('bg-liab-row--payoff');
      } else {
        div.classList.remove('bg-liab-row--omitted');
      }
      calculate();
    });

    payoffCb.addEventListener('change', function () {
      row.payoff = payoffCb.checked;
      if (row.payoff) {
        row.omit = false;
        omitCb.checked = false;
        div.classList.remove('bg-liab-row--omitted');
        div.classList.add('bg-liab-row--payoff');
      } else {
        div.classList.remove('bg-liab-row--payoff');
      }
      calculate();
    });

    removeBtn.addEventListener('click', function () { removeLiabilityRow(row.id); });

    body.appendChild(div);
  }

  function removeLiabilityRow(id) {
    liabilityRows = liabilityRows.filter(function (r) { return r.id !== id; });
    var el = document.querySelector('[data-liab-idx="' + id + '"]');
    if (el) el.remove();
    calculate();
  }

  function clearLiabilityRows() {
    liabilityRows = [];
    liabilityCounter = 0;
    var body = document.getElementById('bgLiabilityBody');
    if (body) body.innerHTML = '';
  }

  /* ---- DTI status helpers ---- */
  function setGauge(gaugeId, pct, guidelinePct, limitPct, maxPct) {
    var el = document.getElementById(gaugeId);
    if (!el) return;
    var capped = Math.min(pct, maxPct);
    el.style.width = (capped / maxPct * 100) + '%';
    el.className = 'bg-gauge__fill';
    if (pct > limitPct) el.classList.add('bg-gauge__fill--over');
    else if (pct > guidelinePct) el.classList.add('bg-gauge__fill--warn');
  }

  function setStatus(id, pct, guideline, limit, label) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = 'bg-card__status';
    if (pct === 0) {
      el.textContent = 'Enter income & ' + label + ' data';
    } else if (pct <= guideline) {
      el.textContent = 'Within guideline (\u2264' + guideline + '%)';
      el.classList.add('bg-card__status--good');
    } else if (pct <= limit) {
      el.textContent = 'Above ' + guideline + '% guideline, within ' + limit + '% limit';
      el.classList.add('bg-card__status--warn');
    } else {
      el.textContent = 'Exceeds ' + limit + '% limit';
      el.classList.add('bg-card__status--over');
    }
  }

  /* ---- Main calculation ---- */
  function calculate() {
    /* INCOME — sum all dynamic income rows */
    var employmentTotal = 0;
    incomeRows.forEach(function (r) { employmentTotal += r.amount || 0; });
    var qualifyingIncome = employmentTotal;
    var additionalTotal = sumIds(additionalIds);
    var grandTotalIncome = qualifyingIncome + additionalTotal;

    /* TAX & SAVINGS ADJUSTMENTS */
    var taxRate = v('bgTaxRate') / 100;
    var savingsRate = v('bgSavingsRate') / 100;
    var taxAmount = grandTotalIncome * taxRate;
    var afterTaxIncome = grandTotalIncome - taxAmount;
    var savingsAmount = grandTotalIncome * savingsRate;
    var spendableIncome = afterTaxIncome - savingsAmount;

    document.getElementById('bgEmploymentTotal').textContent = fmt(employmentTotal);
    document.getElementById('bgTotalQualIncome').textContent = fmt(qualifyingIncome);
    document.getElementById('bgAdditionalTotal').textContent = fmt(additionalTotal);
    document.getElementById('bgGrandTotalIncome').textContent = fmt(grandTotalIncome);
    document.getElementById('bgAfterTaxIncome').textContent = fmt(afterTaxIncome);
    document.getElementById('bgSavingsAmount').textContent = fmt(savingsAmount);
    document.getElementById('bgSpendableIncome').textContent = fmt(spendableIncome);

    /* PROPOSED HOUSING */
    var loanAmount = v('bgLoanAmount');
    var rate = v('bgRate');
    var termMonths = v('bgTermMonths');

    var piCalc = 0;
    if (loanAmount > 0 && rate > 0 && termMonths > 0) {
      piCalc = MSFG.calcMonthlyPayment(loanAmount, rate / 100, termMonths / 12);
    }
    var pi = setComputed('bgPI', piCalc);

    var housingTotal = sumIds(housingIds);
    document.getElementById('bgHousingTotal').textContent = fmt(housingTotal);

    /* LIABILITIES — only active (not omitted, not payoff) */
    var liabilitiesTotal = 0;
    var payoffTotal = 0;
    var activeCount = 0;
    var omittedCount = 0;

    liabilityRows.forEach(function (r) {
      if (r.omit) {
        omittedCount++;
      } else if (r.payoff) {
        omittedCount++;
        payoffTotal += r.balance || 0;
      } else {
        liabilitiesTotal += r.payment || 0;
        activeCount++;
      }
    });

    document.getElementById('bgLiabilitiesTotal').textContent = fmt(liabilitiesTotal);
    document.getElementById('bgActiveLiabCount').textContent = activeCount;
    document.getElementById('bgOmittedLiabCount').textContent = omittedCount;
    document.getElementById('bgPayoffTotal').textContent = fmt(payoffTotal);

    /* LIVING EXPENSES */
    var livingTotal = sumIds(livingIds);
    document.getElementById('bgLivingTotal').textContent = fmt(livingTotal);

    /* TOTAL EXPENSES */
    var grandTotalExpenses = housingTotal + liabilitiesTotal + livingTotal;
    document.getElementById('bgGrandTotalExpenses').textContent = fmt(grandTotalExpenses);

    /* DTI RATIOS (use qualifying income only) */
    var frontDTI = qualifyingIncome > 0 ? (housingTotal / qualifyingIncome * 100) : 0;
    var backDTI = qualifyingIncome > 0 ? ((housingTotal + liabilitiesTotal) / qualifyingIncome * 100) : 0;

    document.getElementById('bgFrontDTI').textContent = frontDTI.toFixed(2) + '%';
    document.getElementById('bgBackDTI').textContent = backDTI.toFixed(2) + '%';

    setGauge('bgFrontGauge', frontDTI, 32, 47, 65);
    setGauge('bgBackGauge', backDTI, 47, 55, 70);
    setStatus('bgFrontStatus', frontDTI, 32, 47, 'housing');
    setStatus('bgBackStatus', backDTI, 47, 55, 'debt');

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

    /* NET CASH FLOW (uses spendable income — after tax & savings) */
    var netCashFlow = spendableIncome - grandTotalExpenses;
    document.getElementById('bgNetCashFlow').textContent = fmt(netCashFlow);
    document.getElementById('bgSummaryGrossIncome').textContent = fmt(grandTotalIncome);

    var taxRow = document.getElementById('bgSummaryTaxRow');
    var savingsRow = document.getElementById('bgSummarySavingsRow');
    if (taxRow) {
      taxRow.style.display = taxRate > 0 ? '' : 'none';
      document.getElementById('bgSummaryTax').textContent = '-' + fmt(taxAmount);
    }
    if (savingsRow) {
      savingsRow.style.display = savingsRate > 0 ? '' : 'none';
      document.getElementById('bgSummarySavings').textContent = '-' + fmt(savingsAmount);
    }

    document.getElementById('bgSummaryHousing').textContent = fmt(housingTotal);
    document.getElementById('bgSummaryDebts').textContent = fmt(liabilitiesTotal);
    document.getElementById('bgSummaryLiving').textContent = fmt(livingTotal);
    document.getElementById('bgSummaryPayoff').textContent = fmt(payoffTotal);

    var cfStatus = document.getElementById('bgCashFlowStatus');
    if (cfStatus) {
      cfStatus.className = 'bg-card__status';
      if (netCashFlow > 0) {
        cfStatus.textContent = 'Positive cash flow';
        cfStatus.classList.add('bg-card__status--good');
      } else if (netCashFlow < 0) {
        cfStatus.textContent = 'Negative cash flow \u2014 budget exceeds income';
        cfStatus.classList.add('bg-card__status--over');
      } else {
        cfStatus.innerHTML = '&nbsp;';
      }
    }

    /* Color card values */
    var frontValEl = document.getElementById('bgFrontDTI');
    var backValEl = document.getElementById('bgBackDTI');
    var residualValEl = document.getElementById('bgResidualIncome');
    var cashFlowValEl = document.getElementById('bgNetCashFlow');

    if (frontValEl) frontValEl.style.color = frontDTI > 47 ? '#c62828' : frontDTI > 32 ? '#e65100' : '#2d6a4f';
    if (backValEl) backValEl.style.color = backDTI > 55 ? '#c62828' : backDTI > 47 ? '#e65100' : '#2d6a4f';
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
      taxRate: taxRate,
      taxAmount: taxAmount,
      afterTaxIncome: afterTaxIncome,
      savingsRate: savingsRate,
      savingsAmount: savingsAmount,
      spendableIncome: spendableIncome,
      housingTotal: housingTotal,
      liabilitiesTotal: liabilitiesTotal,
      livingTotal: livingTotal,
      payoffTotal: payoffTotal,
      activeCount: activeCount,
      omittedCount: omittedCount,
      pi: pi,
      loanAmount: loanAmount,
      rate: rate,
      termMonths: termMonths,
      frontDTI: frontDTI,
      backDTI: backDTI,
      residualAfterDTI: residualAfterDTI,
      residualAfterLiving: residualAfterLiving,
      netCashFlow: netCashFlow,
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

    html += '<div class="calc-step"><h4>Step 3: Credit Report Liabilities</h4>';
    html += '<div class="calc-step__values">';
    html += d.activeCount + ' active liabilities included in DTI = ' + fmt(d.liabilitiesTotal) + '/mo<br>';
    if (d.omittedCount > 0) html += d.omittedCount + ' liabilities omitted or marked for payoff<br>';
    if (d.payoffTotal > 0) html += '<strong>Total payoff balance (cash needed): ' + fmt(d.payoffTotal) + '</strong><br>';
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 4: Front-End DTI Ratio</h4>';
    html += '<div class="calc-step__formula">Front-End DTI = (Total Housing Payment / Qualifying Monthly Income) &times; 100</div>';
    html += '<div class="calc-step__values">';
    html += 'Front-End DTI = (' + fmt(d.housingTotal) + ' / ' + fmt(d.qualifyingIncome) + ') &times; 100';
    html += '<br><strong>Front-End DTI = ' + d.frontDTI.toFixed(2) + '%</strong>';
    html += '<br><em>Guideline: &le;32%, Limit: &le;47%</em>';
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 5: Back-End DTI Ratio</h4>';
    html += '<div class="calc-step__formula">Back-End DTI = (Housing + Active Debts) / Qualifying Monthly Income &times; 100</div>';
    html += '<div class="calc-step__values">';
    html += 'Back-End DTI = (' + fmt(d.housingTotal) + ' + ' + fmt(d.liabilitiesTotal) + ') / ' + fmt(d.qualifyingIncome) + ' &times; 100';
    html += '<br><strong>Back-End DTI = ' + d.backDTI.toFixed(2) + '%</strong>';
    html += '<br><em>Guideline: &le;47%, Limit: &le;55%</em>';
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 6: Residual Income</h4>';
    html += '<div class="calc-step__formula">Residual = Qualifying Income - Housing - Active Debts</div>';
    html += '<div class="calc-step__values">';
    html += 'Residual = ' + fmt(d.qualifyingIncome) + ' - ' + fmt(d.housingTotal) + ' - ' + fmt(d.liabilitiesTotal);
    html += '<br><strong>Residual Income = ' + fmt(d.residualAfterDTI) + '</strong>';
    html += '<br><em>VA residual income requirements vary by region, loan amount, and family size</em>';
    html += '</div></div>';

    html += '<div class="calc-step"><h4>Step 7: Reserves</h4>';
    html += '<div class="calc-step__formula">Months of Reserves = Total Liquid Assets / Total Monthly Housing Payment</div>';
    html += '<div class="calc-step__values">';
    html += 'Reserves = ' + fmt(d.totalReserves) + ' / ' + fmt(d.housingTotal);
    html += '<br><strong>' + d.reserveMonths + ' months of reserves</strong>';
    html += '<br><em>Most lenders require 2-6 months reserves for qualification</em>';
    html += '</div></div>';

    if (d.taxRate > 0 || d.savingsRate > 0) {
      html += '<div class="calc-step"><h4>Step 8: Income Adjustments</h4>';
      html += '<div class="calc-step__values">';
      html += 'Gross Monthly Income: ' + fmt(d.grandTotalIncome);
      if (d.taxRate > 0) {
        html += '<br>Estimated Taxes (' + (d.taxRate * 100).toFixed(1) + '%): -' + fmt(d.taxAmount);
        html += '<br>After-Tax Income: ' + fmt(d.afterTaxIncome);
      }
      if (d.savingsRate > 0) {
        html += '<br>Savings / Emergency Fund (' + (d.savingsRate * 100).toFixed(1) + '%): -' + fmt(d.savingsAmount);
      }
      html += '<br><strong>Spendable Income = ' + fmt(d.spendableIncome) + '</strong>';
      html += '</div></div>';
    }

    html += '<div class="calc-step"><h4>Step ' + (d.taxRate > 0 || d.savingsRate > 0 ? '9' : '8') + ': Full Budget Cash Flow</h4>';
    html += '<div class="calc-step__formula">Net Cash Flow = Spendable Income - Housing - Active Debts - Living Expenses</div>';
    html += '<div class="calc-step__values">';
    html += 'Cash Flow = ' + fmt(d.spendableIncome) + ' - ' + fmt(d.housingTotal) + ' - ' + fmt(d.liabilitiesTotal) + ' - ' + fmt(d.livingTotal);
    html += '<br><strong>Net Monthly Cash Flow = ' + fmt(d.netCashFlow) + '</strong>';
    if (d.taxRate > 0 || d.savingsRate > 0) {
      html += '<br><em>Spendable income accounts for taxes and savings deductions</em>';
    }
    html += '<br><em>Note: Additional (non-application) income included in total cash flow but excluded from DTI</em>';
    html += '</div></div>';

    container.innerHTML = html;
  }

  /* ---- MISMO Population (called by workspace or direct upload) ---- */
  function populateMISMO(budgetData) {
    /* Clear existing dynamic rows */
    clearIncomeRows();
    clearLiabilityRows();

    var borrowers = budgetData.borrowers || [];
    var liabilities = budgetData.liabilities || [];
    var qualification = budgetData.qualification || {};

    /* --- Income: build rows from each borrower's employers and income items --- */
    var detailedIncomeTotal = 0;

    borrowers.forEach(function (b) {
      /* Per-employer income items */
      if (b.employers && b.employers.length) {
        b.employers.forEach(function (emp) {
          if (emp.incomeItems && emp.incomeItems.length) {
            emp.incomeItems.forEach(function (item) {
              createIncomeRow({
                name: emp.name || 'Employer',
                type: item.type || 'Employment',
                amount: item.monthly || 0,
                mismo: true
              });
              detailedIncomeTotal += item.monthly || 0;
            });
          } else if (emp.monthlyIncome > 0) {
            /* Employer with aggregate income but no line items */
            createIncomeRow({
              name: emp.name || 'Employer',
              type: emp.status === 'Current' ? 'Base' : (emp.status || 'Employment'),
              amount: emp.monthlyIncome,
              mismo: true
            });
            detailedIncomeTotal += emp.monthlyIncome;
          }
        });
      }

      /* Direct income items (not under employer) */
      if (b.incomeItems && b.incomeItems.length) {
        b.incomeItems.forEach(function (item) {
          /* Skip if already added via employer */
          if (item.employer) return;
          createIncomeRow({
            name: 'Other Income',
            type: item.type || 'Other',
            amount: item.monthly || 0,
            mismo: true
          });
          detailedIncomeTotal += item.monthly || 0;
        });
      }
    });

    /* If qualifying income exceeds what we found in detailed items, add the remainder
       attributed to the first employer (or as generic qualifying income) */
    var qualTotal = qualification.totalMonthlyIncome || 0;
    if (qualTotal > 0 && detailedIncomeTotal < qualTotal) {
      var remainder = qualTotal - detailedIncomeTotal;
      /* Find first employer name for attribution */
      var empName = 'Employment Income';
      borrowers.forEach(function (b) {
        if (empName === 'Employment Income' && b.employers && b.employers.length) {
          var first = b.employers[0];
          if (first && first.name) empName = first.name;
        }
      });
      createIncomeRow({
        name: empName,
        type: 'Base',
        amount: remainder,
        mismo: true
      });
    }

    /* If no income at all and qualifying total exists, use it */
    if (incomeRows.length === 0 && qualTotal > 0) {
      createIncomeRow({
        name: 'Qualifying Income (total)',
        type: 'Base',
        amount: qualTotal,
        mismo: true
      });
    }

    /* If still no income rows, add one empty row */
    if (incomeRows.length === 0) {
      createIncomeRow({});
    }

    /* --- Liabilities: each individual item from credit report --- */
    liabilities.forEach(function (l) {
      var isMortgage = (l.type || '').toLowerCase() === 'mortgageloan';
      var isPayoff = l.payoff || false;

      createLiabilityRow({
        holder: l.holder || l.name || '',
        type: l.type || '',
        balance: l.balance || 0,
        payment: l.payment || 0,
        months: l.remaining || l.remainingMonths || 0,
        omit: l.exclusion || (isMortgage && !isPayoff) ? true : false,
        payoff: isPayoff || isMortgage ? true : false,
        account: l.account || '',
        mismo: true
      });
    });

    calculate();
  }

  /* Expose for workspace integration */
  window.MSFG_BG_populateMISMO = populateMISMO;

  /* ---- File upload handler ---- */
  function handleMISMOFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = MSFG.MISMOParser.parse(e.target.result);

        /* Set standard fields */
        var fieldMap = MSFG.MISMOParser.getCalcMap('budget');
        if (fieldMap) {
          var mapped = fieldMap(data);
          Object.keys(mapped).forEach(function (id) {
            if (id.indexOf('__') === 0) return; // skip special keys
            var el = document.getElementById(id);
            if (!el) return;
            if (el.tagName === 'SELECT') {
              for (var i = 0; i < el.options.length; i++) {
                if (el.options[i].value === mapped[id]) {
                  el.selectedIndex = i;
                  el.classList.add('mismo-populated');
                  break;
                }
              }
            } else {
              el.value = mapped[id];
              el.classList.add('mismo-populated');
            }
            if (computedIds.indexOf(id) !== -1 && mapped[id]) {
              overrides[id] = true;
            }
          });

          /* Populate dynamic data */
          if (mapped.__budget_data) {
            populateMISMO(mapped.__budget_data);
          }
        }
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
        var fieldMap = MSFG.MISMOParser.getCalcMap('budget');
        if (fieldMap) {
          var mapped = fieldMap(data);
          Object.keys(mapped).forEach(function (id) {
            if (id.indexOf('__') === 0) return;
            var el = document.getElementById(id);
            if (!el) return;
            if (el.tagName === 'SELECT') {
              for (var i = 0; i < el.options.length; i++) {
                if (el.options[i].value === mapped[id]) {
                  el.selectedIndex = i;
                  el.classList.add('mismo-populated');
                  break;
                }
              }
            } else {
              el.value = mapped[id];
              el.classList.add('mismo-populated');
            }
            if (computedIds.indexOf(id) !== -1 && mapped[id]) {
              overrides[id] = true;
            }
          });
          if (mapped.__budget_data) {
            populateMISMO(mapped.__budget_data);
          }
        }
      } catch (err) {
        console.error('MISMO parse error:', err);
      }
    }
  }

  /* ---- Print & Clear ---- */
  function printBudget() { window.print(); }

  function clearAll() {
    overrides = {};
    clearIncomeRows();
    clearLiabilityRows();

    /* Add one empty income row */
    createIncomeRow({});

    allStaticIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('mismo-populated');
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else if (el.type === 'date') {
        el.value = '';
      } else if (el.type === 'number') {
        el.value = id === 'bgTermMonths' ? '360' : id === 'bgNumBorrowers' ? '1' : id === 'bgTaxRate' ? '0' : id === 'bgSavingsRate' ? '0' : '0';
      } else {
        el.value = '';
      }
    });
    calculate();
  }

  /* ---- Init ---- */
  function init() {
    /* Set date */
    var prepDate = document.getElementById('bgPrepDate');
    if (prepDate && !prepDate.value) {
      var today = new Date();
      prepDate.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    }

    /* Remove the placeholder income row from HTML — we manage rows dynamically */
    var body = document.getElementById('bgIncomeBody');
    if (body) body.innerHTML = '';
    createIncomeRow({});

    /* Computed field override tracking */
    computedIds.forEach(function (id) {
      var el = document.getElementById(id);
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

    /* Bind all static inputs */
    allStaticIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    /* Add income row button */
    var addIncomeBtn = document.getElementById('bgAddIncomeRow');
    if (addIncomeBtn) addIncomeBtn.addEventListener('click', function () { createIncomeRow({}); });

    /* Add liability row button */
    var addLiabBtn = document.getElementById('bgAddLiabilityRow');
    if (addLiabBtn) addLiabBtn.addEventListener('click', function () { createLiabilityRow({}); });

    /* Print & Clear buttons */
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

    /* --- Self-populate from sessionStorage MISMO data (workspace fallback) ---
       When loaded inside a workspace iframe, the parent stores MISMO data in
       sessionStorage.  Read it directly instead of relying on cross-iframe calls,
       which can fail due to timing or lazy-loading. */
    trySessionPopulate();
  }

  function trySessionPopulate() {
    /* Only attempt if we're inside an iframe (embed mode) and have no dynamic rows yet */
    if (window === window.top) return;
    if (incomeRows.length > 1 || liabilityRows.length > 0) return;

    var stored = sessionStorage.getItem('msfg-mismo-data');
    var storedXml = sessionStorage.getItem('msfg-mismo-xml');
    if (!stored && !storedXml) return;

    try {
      var data = stored ? JSON.parse(stored) : null;

      /* If we have parsed data, use it directly for __budget_data */
      if (data) {
        /* Set standard DOM fields first */
        if (MSFG.MISMOParser) {
          var mapFn = MSFG.MISMOParser.getCalcMap('budget');
          if (mapFn) {
            var mapped = mapFn(data);
            Object.keys(mapped).forEach(function (id) {
              if (id.indexOf('__') === 0) return;
              var el = document.getElementById(id);
              if (!el) return;
              if (el.tagName === 'SELECT') {
                for (var i = 0; i < el.options.length; i++) {
                  if (el.options[i].value === mapped[id]) {
                    el.selectedIndex = i;
                    el.classList.add('mismo-populated');
                    break;
                  }
                }
              } else {
                el.value = mapped[id];
                el.classList.add('mismo-populated');
              }
              if (computedIds.indexOf(id) !== -1 && mapped[id]) {
                overrides[id] = true;
              }
            });
          }
        }

        /* Populate dynamic rows from structured data */
        var budgetData = {
          borrowers: data.borrowers || [],
          liabilities: data.liabilities || [],
          qualification: data.qualification || {},
          existingMortgage: data.existingMortgage || null
        };
        if (budgetData.borrowers.length || budgetData.liabilities.length) {
          populateMISMO(budgetData);
        }
      }
    } catch (e) {
      /* Silently ignore — sessionStorage data may be stale or malformed */
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');
  });
})();
