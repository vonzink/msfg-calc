(function () {
  'use strict';

  const P = MSFG.parseNum;
  const fmt = MSFG.formatCurrency;

  /* ---- Dynamic row stores ---- */
  let incomeRows = [];   // { id, name, type, amount }
  let liabilityRows = []; // { id, holder, type, balance, payment, months, omit, payoff, account }
  let incomeCounter = 0;
  let liabilityCounter = 0;

  /* ---- Static field IDs ---- */
  const additionalIds = ['bgSpouseIncome', 'bgSideGig', 'bgOtherHousehold'];
  const housingIds = ['bgPI', 'bgPropertyTax', 'bgHomeInsurance', 'bgMI', 'bgHOA', 'bgFlood', 'bgOtherHousing'];
  const livingIds = ['bgUtilities', 'bgTelecom', 'bgGroceries', 'bgTransport', 'bgInsurance', 'bgChildcare', 'bgEntertainment', 'bgOtherLiving'];
  const reserveIds = ['bgChecking', 'bgSavings', 'bgRetirement', 'bgInvestments', 'bgOtherAssets'];
  const adjustmentIds = ['bgTaxRate', 'bgSavingsRate'];
  const loanIds = ['bgLoanAmount', 'bgRate', 'bgTermMonths', 'bgPropertyValue', 'bgCreditScore', 'bgNumBorrowers'];
  const metaIds = ['bgBorrowerName', 'bgFileNumber', 'bgPrepDate', 'bgLoanPurpose', 'bgProduct'];

  const allStaticIds = [].concat(additionalIds, housingIds, livingIds, reserveIds, adjustmentIds, loanIds, metaIds);

  /* Computed fields */
  const computedIds = ['bgPI'];
  let overrides = {};

  /* ---- Helpers ---- */
  function v(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    return P(el.value) || 0;
  }

  function setComputed(id, calculatedValue) {
    const el = document.getElementById(id);
    if (!el) return calculatedValue;
    if (overrides[id]) return P(el.value) || 0;
    el.value = Math.round(calculatedValue * 100) / 100;
    return calculatedValue;
  }

  function sumIds(ids) {
    let total = 0;
    ids.forEach((id) => { total += v(id); });
    return total;
  }

  function friendlyLiabType(type) {
    if (!type) return '';
    const map = {
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
    const id = incomeCounter;
    const row = {
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
    const container = document.getElementById('bgIncomeBody');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'bg-income-row';
    div.dataset.incomeIdx = String(row.id);

    const main = document.createElement('div');
    main.className = 'bg-income-row__main';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'bg-income-row__name';
    nameInput.placeholder = 'Employer / Source';
    nameInput.value = row.name;
    nameInput.dataset.field = 'name';
    if (isMismo) nameInput.classList.add('mismo-populated');

    const typeInput = document.createElement('input');
    typeInput.type = 'text';
    typeInput.className = 'bg-income-row__type';
    typeInput.placeholder = 'Type';
    typeInput.value = row.type;
    typeInput.dataset.field = 'type';
    if (isMismo) typeInput.classList.add('mismo-populated');

    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.className = 'bg-input bg-income-row__amount';
    amountInput.value = row.amount;
    amountInput.min = '0';
    amountInput.step = '1';
    amountInput.dataset.field = 'amount';
    if (isMismo) amountInput.classList.add('mismo-populated');

    const period = document.createElement('span');
    period.className = 'bg-row__period';
    period.textContent = '/mo';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'bg-row__remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => { removeIncomeRow(row.id); });

    main.appendChild(nameInput);
    main.appendChild(typeInput);
    main.appendChild(amountInput);
    main.appendChild(period);
    main.appendChild(removeBtn);
    div.appendChild(main);

    /* Bind change events */
    nameInput.addEventListener('input', () => {
      row.name = nameInput.value;
      nameInput.classList.remove('mismo-populated');
    });
    typeInput.addEventListener('input', () => {
      row.type = typeInput.value;
      typeInput.classList.remove('mismo-populated');
    });
    amountInput.addEventListener('input', () => {
      row.amount = P(amountInput.value) || 0;
      amountInput.classList.remove('mismo-populated');
      calculate();
    });
    amountInput.addEventListener('change', calculate);

    container.appendChild(div);
  }

  function removeIncomeRow(id) {
    incomeRows = incomeRows.filter((r) => r.id !== id);
    const el = document.querySelector('[data-income-idx="' + id + '"]');
    if (el) el.remove();
    calculate();
  }

  function clearIncomeRows() {
    incomeRows = [];
    incomeCounter = 0;
    const body = document.getElementById('bgIncomeBody');
    if (body) body.innerHTML = '';
  }

  /* ---- Liability Row Management ---- */
  function createLiabilityRow(data) {
    liabilityCounter++;
    const id = liabilityCounter;
    const row = {
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
    const body = document.getElementById('bgLiabilityBody');
    if (!body) return;

    const div = document.createElement('div');
    div.className = 'bg-liab-row';
    if (row.omit) div.classList.add('bg-liab-row--omitted');
    if (row.payoff) div.classList.add('bg-liab-row--payoff');
    div.dataset.liabIdx = String(row.id);

    /* Holder / Creditor name */
    const holderInput = document.createElement('input');
    holderInput.type = 'text';
    holderInput.className = 'bg-liab-col bg-liab-col--name';
    holderInput.placeholder = 'Creditor';
    holderInput.value = row.holder;
    if (isMismo) holderInput.classList.add('mismo-populated');

    /* Type */
    const typeSpan = document.createElement('span');
    typeSpan.className = 'bg-liab-col bg-liab-col--type';
    typeSpan.textContent = friendlyLiabType(row.type);
    typeSpan.title = row.type;

    /* Balance */
    const balanceInput = document.createElement('input');
    balanceInput.type = 'number';
    balanceInput.className = 'bg-liab-col bg-liab-col--balance bg-input';
    balanceInput.value = row.balance;
    balanceInput.min = '0';
    balanceInput.step = '1';
    if (isMismo) balanceInput.classList.add('mismo-populated');

    /* Payment */
    const paymentInput = document.createElement('input');
    paymentInput.type = 'number';
    paymentInput.className = 'bg-liab-col bg-liab-col--payment bg-input';
    paymentInput.value = row.payment;
    paymentInput.min = '0';
    paymentInput.step = '1';
    if (isMismo) paymentInput.classList.add('mismo-populated');

    /* Remaining months */
    const monthsInput = document.createElement('input');
    monthsInput.type = 'number';
    monthsInput.className = 'bg-liab-col bg-liab-col--months bg-input';
    monthsInput.value = row.months || '';
    monthsInput.min = '0';
    monthsInput.step = '1';
    monthsInput.placeholder = '-';
    if (isMismo && row.months) monthsInput.classList.add('mismo-populated');

    /* Omit checkbox */
    const omitLabel = document.createElement('label');
    omitLabel.className = 'bg-liab-col bg-liab-col--omit bg-liab-check';
    const omitCb = document.createElement('input');
    omitCb.type = 'checkbox';
    omitCb.checked = row.omit;
    omitLabel.appendChild(omitCb);

    /* Payoff checkbox */
    const payoffLabel = document.createElement('label');
    payoffLabel.className = 'bg-liab-col bg-liab-col--payoff bg-liab-check';
    const payoffCb = document.createElement('input');
    payoffCb.type = 'checkbox';
    payoffCb.checked = row.payoff;
    payoffLabel.appendChild(payoffCb);

    /* Remove button */
    const removeBtn = document.createElement('button');
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
    holderInput.addEventListener('input', () => {
      row.holder = holderInput.value;
      holderInput.classList.remove('mismo-populated');
    });
    balanceInput.addEventListener('input', () => {
      row.balance = P(balanceInput.value) || 0;
      balanceInput.classList.remove('mismo-populated');
      calculate();
    });
    balanceInput.addEventListener('change', calculate);
    paymentInput.addEventListener('input', () => {
      row.payment = P(paymentInput.value) || 0;
      paymentInput.classList.remove('mismo-populated');
      calculate();
    });
    paymentInput.addEventListener('change', calculate);
    monthsInput.addEventListener('input', () => {
      row.months = P(monthsInput.value) || 0;
      monthsInput.classList.remove('mismo-populated');
    });

    omitCb.addEventListener('change', () => {
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

    payoffCb.addEventListener('change', () => {
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

    removeBtn.addEventListener('click', () => { removeLiabilityRow(row.id); });

    body.appendChild(div);
  }

  function removeLiabilityRow(id) {
    liabilityRows = liabilityRows.filter((r) => r.id !== id);
    const el = document.querySelector('[data-liab-idx="' + id + '"]');
    if (el) el.remove();
    calculate();
  }

  function clearLiabilityRows() {
    liabilityRows = [];
    liabilityCounter = 0;
    const body = document.getElementById('bgLiabilityBody');
    if (body) body.innerHTML = '';
  }

  /* ---- DTI status helpers ---- */
  function setGauge(gaugeId, pct, guidelinePct, limitPct, maxPct) {
    const el = document.getElementById(gaugeId);
    if (!el) return;
    const capped = Math.min(pct, maxPct);
    el.style.width = (capped / maxPct * 100) + '%';
    el.className = 'bg-gauge__fill';
    if (pct > limitPct) el.classList.add('bg-gauge__fill--over');
    else if (pct > guidelinePct) el.classList.add('bg-gauge__fill--warn');
  }

  function setStatus(id, pct, guideline, limit, label) {
    const el = document.getElementById(id);
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
    let employmentTotal = 0;
    incomeRows.forEach((r) => { employmentTotal += r.amount || 0; });
    const qualifyingIncome = employmentTotal;
    const additionalTotal = sumIds(additionalIds);
    const grandTotalIncome = qualifyingIncome + additionalTotal;

    /* TAX & SAVINGS ADJUSTMENTS */
    const taxRate = v('bgTaxRate') / 100;
    const savingsRate = v('bgSavingsRate') / 100;
    const taxAmount = grandTotalIncome * taxRate;
    const afterTaxIncome = grandTotalIncome - taxAmount;
    const savingsAmount = grandTotalIncome * savingsRate;
    const spendableIncome = afterTaxIncome - savingsAmount;

    document.getElementById('bgEmploymentTotal').textContent = fmt(employmentTotal);
    document.getElementById('bgTotalQualIncome').textContent = fmt(qualifyingIncome);
    document.getElementById('bgAdditionalTotal').textContent = fmt(additionalTotal);
    document.getElementById('bgGrandTotalIncome').textContent = fmt(grandTotalIncome);
    document.getElementById('bgAfterTaxIncome').textContent = fmt(afterTaxIncome);
    document.getElementById('bgSavingsAmount').textContent = fmt(savingsAmount);
    document.getElementById('bgSpendableIncome').textContent = fmt(spendableIncome);

    /* PROPOSED HOUSING */
    const loanAmount = v('bgLoanAmount');
    const rate = v('bgRate');
    const termMonths = v('bgTermMonths');

    let piCalc = 0;
    if (loanAmount > 0 && rate > 0 && termMonths > 0) {
      piCalc = MSFG.calcMonthlyPayment(loanAmount, rate / 100, termMonths / 12);
    }
    const pi = setComputed('bgPI', piCalc);

    const housingTotal = sumIds(housingIds);
    document.getElementById('bgHousingTotal').textContent = fmt(housingTotal);

    /* LIABILITIES — only active (not omitted, not payoff) */
    let liabilitiesTotal = 0;
    let payoffTotal = 0;
    let activeCount = 0;
    let omittedCount = 0;

    liabilityRows.forEach((r) => {
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
    const livingTotal = sumIds(livingIds);
    document.getElementById('bgLivingTotal').textContent = fmt(livingTotal);

    /* TOTAL EXPENSES */
    const grandTotalExpenses = housingTotal + liabilitiesTotal + livingTotal;
    document.getElementById('bgGrandTotalExpenses').textContent = fmt(grandTotalExpenses);

    /* DTI RATIOS (use qualifying income only) */
    const frontDTI = qualifyingIncome > 0 ? (housingTotal / qualifyingIncome * 100) : 0;
    const backDTI = qualifyingIncome > 0 ? ((housingTotal + liabilitiesTotal) / qualifyingIncome * 100) : 0;

    document.getElementById('bgFrontDTI').textContent = frontDTI.toFixed(2) + '%';
    document.getElementById('bgBackDTI').textContent = backDTI.toFixed(2) + '%';

    setGauge('bgFrontGauge', frontDTI, 32, 47, 65);
    setGauge('bgBackGauge', backDTI, 47, 55, 70);
    setStatus('bgFrontStatus', frontDTI, 32, 47, 'housing');
    setStatus('bgBackStatus', backDTI, 47, 55, 'debt');

    /* RESIDUAL INCOME */
    const residualAfterDTI = qualifyingIncome - housingTotal - liabilitiesTotal;
    const residualAfterLiving = grandTotalIncome - grandTotalExpenses;

    document.getElementById('bgResidualAfterDTI').textContent = fmt(residualAfterDTI);
    document.getElementById('bgResidualAfterLiving').textContent = fmt(residualAfterLiving);
    document.getElementById('bgResidualIncome').textContent = fmt(residualAfterDTI);

    const residualEl = document.getElementById('bgResidualStatus');
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
    const netCashFlow = spendableIncome - grandTotalExpenses;
    document.getElementById('bgNetCashFlow').textContent = fmt(netCashFlow);
    document.getElementById('bgSummaryGrossIncome').textContent = fmt(grandTotalIncome);

    const taxRow = document.getElementById('bgSummaryTaxRow');
    const savingsRow = document.getElementById('bgSummarySavingsRow');
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

    const cfStatus = document.getElementById('bgCashFlowStatus');
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
    const frontValEl = document.getElementById('bgFrontDTI');
    const backValEl = document.getElementById('bgBackDTI');
    const residualValEl = document.getElementById('bgResidualIncome');
    const cashFlowValEl = document.getElementById('bgNetCashFlow');

    if (frontValEl) frontValEl.style.color = frontDTI > 47 ? '#c62828' : frontDTI > 32 ? '#e65100' : '#2d6a4f';
    if (backValEl) backValEl.style.color = backDTI > 55 ? '#c62828' : backDTI > 47 ? '#e65100' : '#2d6a4f';
    if (residualValEl) residualValEl.style.color = residualAfterDTI < 0 ? '#c62828' : '#2d6a4f';
    if (cashFlowValEl) cashFlowValEl.style.color = netCashFlow < 0 ? '#c62828' : '#2d6a4f';

    /* RESERVES */
    const totalReserves = sumIds(reserveIds);
    document.getElementById('bgTotalReserves').textContent = fmt(totalReserves);
    const reserveMonths = housingTotal > 0 ? Math.floor(totalReserves / housingTotal) : 0;
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
    const container = document.getElementById('calcSteps-budget');
    if (!container) return;

    let html = '';

    html += '<div class="calc-step"><h4>Step 1: Monthly P&I Payment</h4>';
    if (d.loanAmount > 0 && d.rate > 0 && d.termMonths > 0) {
      const r = d.rate / 100 / 12;
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

    const borrowers = budgetData.borrowers || [];
    const liabilities = budgetData.liabilities || [];
    const qualification = budgetData.qualification || {};

    /* --- Income: build rows from each borrower's employers and income items --- */
    let detailedIncomeTotal = 0;

    borrowers.forEach((b) => {
      /* Per-employer income items */
      if (b.employers && b.employers.length) {
        b.employers.forEach((emp) => {
          if (emp.incomeItems && emp.incomeItems.length) {
            emp.incomeItems.forEach((item) => {
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
        b.incomeItems.forEach((item) => {
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
    const qualTotal = qualification.totalMonthlyIncome || 0;
    if (qualTotal > 0 && detailedIncomeTotal < qualTotal) {
      const remainder = qualTotal - detailedIncomeTotal;
      /* Find first employer name for attribution */
      let empName = 'Employment Income';
      borrowers.forEach((b) => {
        if (empName === 'Employment Income' && b.employers && b.employers.length) {
          const first = b.employers[0];
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
    liabilities.forEach((l) => {
      const isMortgage = (l.type || '').toLowerCase() === 'mortgageloan';
      const isPayoff = l.payoff || false;

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
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = MSFG.MISMOParser.parse(e.target.result);

        /* Set standard fields */
        const fieldMap = MSFG.MISMOParser.getCalcMap('budget');
        if (fieldMap) {
          const mapped = fieldMap(data);
          Object.keys(mapped).forEach((id) => {
            if (id.indexOf('__') === 0) return; // skip special keys
            const el = document.getElementById(id);
            if (!el) return;
            if (el.tagName === 'SELECT') {
              for (let i = 0; i < el.options.length; i++) {
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
    const msg = e.data;
    if (msg && msg.type === 'msfg-mismo-data') {
      try {
        const data = MSFG.MISMOParser.parse(msg.xml);
        const fieldMap = MSFG.MISMOParser.getCalcMap('budget');
        if (fieldMap) {
          const mapped = fieldMap(data);
          Object.keys(mapped).forEach((id) => {
            if (id.indexOf('__') === 0) return;
            const el = document.getElementById(id);
            if (!el) return;
            if (el.tagName === 'SELECT') {
              for (let i = 0; i < el.options.length; i++) {
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

    allStaticIds.forEach((id) => {
      const el = document.getElementById(id);
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
    const prepDate = document.getElementById('bgPrepDate');
    if (prepDate && !prepDate.value) {
      const today = new Date();
      prepDate.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    }

    /* Remove the placeholder income row from HTML — we manage rows dynamically */
    const body = document.getElementById('bgIncomeBody');
    if (body) body.innerHTML = '';
    createIncomeRow({});

    /* Computed field override tracking */
    computedIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        overrides[id] = true;
        el.classList.add('bg-input--overridden');
      });
      el.addEventListener('dblclick', () => {
        delete overrides[id];
        el.classList.remove('bg-input--overridden');
        calculate();
      });
    });

    /* Bind all static inputs */
    allStaticIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    /* Add income row button */
    const addIncomeBtn = document.getElementById('bgAddIncomeRow');
    if (addIncomeBtn) addIncomeBtn.addEventListener('click', () => { createIncomeRow({}); });

    /* Add liability row button */
    const addLiabBtn = document.getElementById('bgAddLiabilityRow');
    if (addLiabBtn) addLiabBtn.addEventListener('click', () => { createLiabilityRow({}); });

    /* Print & Clear buttons */
    const printBtn = document.getElementById('bgPrintBtn');
    if (printBtn) printBtn.addEventListener('click', printBudget);

    const clearBtn = document.getElementById('bgClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);

    /* Workspace message listener */
    window.addEventListener('message', handleMessage);


    /* MISMO-populated field: remove glow on manual edit */
    document.querySelector('.calc-page').addEventListener('input', (e) => {
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

    const stored = sessionStorage.getItem('msfg-mismo-data');
    const storedXml = sessionStorage.getItem('msfg-mismo-xml');
    if (!stored && !storedXml) return;

    try {
      const data = stored ? JSON.parse(stored) : null;

      /* If we have parsed data, use it directly for __budget_data */
      if (data) {
        /* Set standard DOM fields first */
        if (MSFG.MISMOParser) {
          const mapFn = MSFG.MISMOParser.getCalcMap('budget');
          if (mapFn) {
            const mapped = mapFn(data);
            Object.keys(mapped).forEach((id) => {
              if (id.indexOf('__') === 0) return;
              const el = document.getElementById(id);
              if (!el) return;
              if (el.tagName === 'SELECT') {
                for (let i = 0; i < el.options.length; i++) {
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
        const budgetData = {
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

  document.addEventListener('DOMContentLoaded', () => {
    init();
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');

    if (MSFG.CalcActions) {
      MSFG.CalcActions.register(function () {
        const g = function (id) { const el = document.getElementById(id); return el ? el.textContent || el.value : ''; };
        return {
          title: 'Household Budget Analysis',
          sections: [
            {
              heading: 'Borrower & Loan',
              rows: [
                { label: 'Borrower(s)', value: g('bgBorrowerName') || '(not entered)' },
                { label: 'Loan Amount', value: fmt(P(g('bgLoanAmount'))) },
                { label: 'Interest Rate', value: parseFloat(g('bgRate') || 0).toFixed(3) + '%' },
                { label: 'Term', value: g('bgTermMonths') + ' months' }
              ]
            },
            {
              heading: 'Income',
              rows: [
                { label: 'Total Qualifying Income', value: g('bgTotalQualIncome') },
                { label: 'Additional Income', value: g('bgAdditionalTotal') },
                { label: 'Total Gross Income', value: g('bgGrandTotalIncome'), isTotal: true },
                { label: 'After-Tax Income', value: g('bgAfterTaxIncome') },
                { label: 'Spendable Income', value: g('bgSpendableIncome') }
              ]
            },
            {
              heading: 'Expenses',
              rows: [
                { label: 'Housing Payment', value: g('bgHousingTotal') },
                { label: 'Credit Report Liabilities', value: g('bgLiabilitiesTotal') },
                { label: 'Living Expenses', value: g('bgLivingTotal') },
                { label: 'Total Expenses', value: g('bgGrandTotalExpenses'), isTotal: true }
              ]
            },
            {
              heading: 'DTI & Residual',
              rows: [
                { label: 'Front-End DTI', value: g('bgFrontDTI'), isTotal: true },
                { label: 'Back-End DTI', value: g('bgBackDTI'), isTotal: true },
                { label: 'Residual Income', value: g('bgResidualIncome') },
                { label: 'Net Cash Flow', value: g('bgNetCashFlow') }
              ]
            },
            {
              heading: 'Reserves',
              rows: [
                { label: 'Total Reserves', value: g('bgTotalReserves') },
                { label: 'Months of Reserves', value: g('bgReserveMonths') }
              ]
            }
          ]
        };
      });
    }
  });
})();
