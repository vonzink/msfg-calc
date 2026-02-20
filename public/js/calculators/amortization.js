/* =====================================================
   Amortization Calculator — MSFG
   Full schedule, chart, extra payments, PMI auto-drop
   ===================================================== */
'use strict';

const AmortCalc = (() => {

  /* ---------- DOM refs ---------- */
  const dom = {};
  let chart = null;
  let currentSchedule = [];
  let baseSchedule = []; // schedule without extras, for savings comparison
  let currentMode = 'purchase'; // 'purchase' or 'refinance'

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  /* ---------- Init ---------- */
  const init = () => {
    cacheDom();
    populateDateSelectors();
    bindEvents();
    updateLTVDisplay();
    calculate();
  };

  const cacheDom = () => {
    // Mode toggle
    dom.modeToggle        = document.getElementById('modeToggle');
    dom.purchaseFields    = document.getElementById('purchaseFields');
    dom.refiFields        = document.getElementById('refiFields');

    // Loan inputs (purchase)
    dom.homePrice         = document.getElementById('homePrice');
    dom.homePriceSlider   = document.getElementById('homePriceSlider');
    dom.downPaymentDollar = document.getElementById('downPaymentDollar');
    dom.downPaymentPercent= document.getElementById('downPaymentPercent');
    dom.loanAmount        = document.getElementById('loanAmount');
    dom.interestRate      = document.getElementById('interestRate');
    dom.startMonth        = document.getElementById('startMonth');
    dom.startYear         = document.getElementById('startYear');
    dom.termToggle        = document.getElementById('termToggle');

    // Loan inputs (refinance)
    dom.refiLoanAmount    = document.getElementById('refiLoanAmount');
    dom.refiLoanSlider    = document.getElementById('refiLoanSlider');
    dom.appraisedValue    = document.getElementById('appraisedValue');
    dom.cashOut           = document.getElementById('cashOut');
    dom.refiEquity        = document.getElementById('refiEquity');

    // LTV display
    dom.ltvDisplay        = document.getElementById('ltvDisplay');
    dom.ltvValue          = document.getElementById('ltvValue');
    dom.ltvFill           = document.getElementById('ltvFill');
    dom.ltvNote           = document.getElementById('ltvNote');

    // Taxes & Insurance
    dom.propertyTax       = document.getElementById('propertyTax');
    dom.homeInsurance     = document.getElementById('homeInsurance');
    dom.pmi               = document.getElementById('pmi');
    dom.pmiNote           = document.getElementById('pmiNote');
    dom.taxToggle         = document.getElementById('taxToggle');
    dom.insuranceToggle   = document.getElementById('insuranceToggle');

    // Extra payments
    dom.extraPaymentToggle = document.getElementById('extraPaymentToggle');
    dom.extraPaymentSection = document.getElementById('extraPaymentSection');
    dom.extraPayment      = document.getElementById('extraPayment');
    dom.extraFreqToggle   = document.getElementById('extraFreqToggle');
    dom.extraStartMonth   = document.getElementById('extraStartMonth');
    dom.extraStartYear    = document.getElementById('extraStartYear');
    dom.extraStartDateGroup = document.getElementById('extraStartDateGroup');

    // Results
    dom.resultsSection    = document.getElementById('resultsSection');
    dom.resultMonthlyPI   = document.getElementById('resultMonthlyPI');
    dom.resultTotalMonthly= document.getElementById('resultTotalMonthly');
    dom.resultMonthlyDetail = document.getElementById('resultMonthlyDetail');
    dom.resultTotalInterest = document.getElementById('resultTotalInterest');
    dom.resultTotalCost   = document.getElementById('resultTotalCost');
    dom.resultPayoffDate  = document.getElementById('resultPayoffDate');
    dom.extraSavingsRow   = document.getElementById('extraSavingsRow');
    dom.resultInterestSaved = document.getElementById('resultInterestSaved');
    dom.resultTimeSaved   = document.getElementById('resultTimeSaved');
    dom.resultCashEquityCard  = document.getElementById('resultCashEquityCard');
    dom.resultCashEquityLabel = document.getElementById('resultCashEquityLabel');
    dom.resultCashEquityValue = document.getElementById('resultCashEquityValue');
    dom.resultStartingLTV     = document.getElementById('resultStartingLTV');

    // Chart & Schedule
    dom.chartSection      = document.getElementById('chartSection');
    dom.amortChart        = document.getElementById('amortChart');
    dom.scheduleSection   = document.getElementById('scheduleSection');
    dom.scheduleBody      = document.getElementById('scheduleBody');
  };

  /* ---------- Date Selectors ---------- */
  const populateDateSelectors = () => {
    const now = new Date();
    const nextMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const defaultYear = nextMonth > 11 ? currentYear + 1 : currentYear;
    const defaultMonth = nextMonth > 11 ? 0 : nextMonth;

    // Populate month selects
    [dom.startMonth, dom.extraStartMonth].forEach(sel => {
      MONTH_FULL.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = m;
        sel.appendChild(opt);
      });
    });

    // Populate year selects
    [dom.startYear, dom.extraStartYear].forEach(sel => {
      for (let y = currentYear; y <= currentYear + 40; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        sel.appendChild(opt);
      }
    });

    dom.startMonth.value = defaultMonth;
    dom.startYear.value = defaultYear;
    dom.extraStartMonth.value = defaultMonth;
    dom.extraStartYear.value = defaultYear;
  };

  /* ---------- Event Binding ---------- */
  const bindEvents = () => {
    // Mode toggle (Purchase / Refinance)
    dom.modeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.amort-term-btn');
      if (!btn || btn.dataset.mode === currentMode) return;
      dom.modeToggle.querySelectorAll('.amort-term-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setMode(btn.dataset.mode);
    });

    // Home price ↔ slider sync
    dom.homePrice.addEventListener('input', () => {
      dom.homePriceSlider.value = dom.homePrice.value;
      syncDownPaymentFromPercent();
      updateSliderFill();
      updateLTVDisplay();
      debouncedCalc();
    });
    dom.homePriceSlider.addEventListener('input', () => {
      dom.homePrice.value = dom.homePriceSlider.value;
      syncDownPaymentFromPercent();
      updateSliderFill();
      updateLTVDisplay();
      debouncedCalc();
    });

    // Down payment sync
    dom.downPaymentDollar.addEventListener('input', () => {
      syncDownPaymentFromDollar();
      updateLTVDisplay();
      debouncedCalc();
    });
    dom.downPaymentPercent.addEventListener('input', () => {
      syncDownPaymentFromPercent();
      updateLTVDisplay();
      debouncedCalc();
    });

    // Refi Loan Amount ↔ slider sync
    dom.refiLoanAmount.addEventListener('input', () => {
      dom.refiLoanSlider.value = dom.refiLoanAmount.value;
      updateRefiSliderFill();
      updateRefiEquityDisplay();
      updateLTVDisplay();
      debouncedCalc();
    });
    dom.refiLoanSlider.addEventListener('input', () => {
      dom.refiLoanAmount.value = dom.refiLoanSlider.value;
      updateRefiSliderFill();
      updateRefiEquityDisplay();
      updateLTVDisplay();
      debouncedCalc();
    });

    // Appraised Value input
    dom.appraisedValue.addEventListener('input', () => {
      updateRefiEquityDisplay();
      updateLTVDisplay();
      debouncedCalc();
    });

    // Cash Out input
    dom.cashOut.addEventListener('input', debouncedCalc);
    dom.cashOut.addEventListener('change', calculate);

    // Standard inputs
    [dom.interestRate, dom.startMonth, dom.startYear, dom.propertyTax,
     dom.homeInsurance, dom.pmi, dom.extraPayment, dom.extraStartMonth,
     dom.extraStartYear].forEach(el => {
      el.addEventListener('input', debouncedCalc);
      el.addEventListener('change', calculate);
    });

    // Loan term toggle
    dom.termToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.amort-term-btn');
      if (!btn) return;
      dom.termToggle.querySelectorAll('.amort-term-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      calculate();
    });

    // Extra payment frequency toggle
    dom.extraFreqToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.amort-term-btn');
      if (!btn) return;
      dom.extraFreqToggle.querySelectorAll('.amort-term-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      calculate();
    });

    // Extra payments section toggle
    dom.extraPaymentToggle.addEventListener('click', () => {
      const section = dom.extraPaymentSection;
      const isOpen = section.style.display !== 'none';
      section.style.display = isOpen ? 'none' : '';
      dom.extraPaymentToggle.classList.toggle('open', !isOpen);
    });

    // Tax/Insurance period toggles
    bindPeriodToggle(dom.taxToggle);
    bindPeriodToggle(dom.insuranceToggle);

    // Initial slider fill
    updateSliderFill();
    updateRefiSliderFill();

    // Auto-set PMI based on down payment % (purchase mode)
    dom.downPaymentPercent.addEventListener('change', () => {
      if (currentMode !== 'purchase') return;
      updatePMISuggestion();
    });
  };

  /* ---------- Period Toggle (monthly/annual) ---------- */
  const bindPeriodToggle = (toggleEl) => {
    toggleEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const fieldId = toggleEl.dataset.field;
      const input = document.getElementById(fieldId);
      const currentPeriod = input.dataset.period;
      const newPeriod = btn.dataset.period;

      if (currentPeriod === newPeriod) return;

      toggleEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const val = MSFG.parseNum(input.value);
      if (currentPeriod === 'annual' && newPeriod === 'monthly') {
        input.value = Math.round(val / 12);
      } else if (currentPeriod === 'monthly' && newPeriod === 'annual') {
        input.value = Math.round(val * 12);
      }
      input.dataset.period = newPeriod;
      calculate();
    });
  };

  /* ---------- Debounce ---------- */
  let debounceTimer = null;
  const debouncedCalc = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(calculate, 150);
  };

  /* ---------- Slider Fill ---------- */
  const updateSliderFill = () => {
    const slider = dom.homePriceSlider;
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--fill', `${pct}%`);
  };

  const updateRefiSliderFill = () => {
    const slider = dom.refiLoanSlider;
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--fill', `${pct}%`);
  };

  /* ---------- Mode Switch ---------- */
  const setMode = (mode) => {
    const prevMode = currentMode;
    currentMode = mode;

    if (mode === 'refinance') {
      // Carry values: Purchase → Refi
      if (prevMode === 'purchase') {
        const loanAmt = getLoanAmount();
        const hp = MSFG.parseNum(dom.homePrice.value);
        dom.refiLoanAmount.value = loanAmt;
        dom.refiLoanSlider.value = loanAmt;
        dom.appraisedValue.value = hp;
        dom.cashOut.value = 0;
        updateRefiSliderFill();
        updateRefiEquityDisplay();
      }
      dom.purchaseFields.style.display = 'none';
      dom.refiFields.style.display = '';
    } else {
      // Carry values: Refi → Purchase
      if (prevMode === 'refinance') {
        const apprVal = MSFG.parseNum(dom.appraisedValue.value);
        const refiLoan = MSFG.parseNum(dom.refiLoanAmount.value);
        const dp = Math.max(apprVal - refiLoan, 0);
        dom.homePrice.value = apprVal;
        dom.homePriceSlider.value = Math.min(Math.max(apprVal, 50000), 2000000);
        dom.downPaymentDollar.value = dp;
        dom.downPaymentPercent.value = apprVal > 0 ? ((dp / apprVal) * 100).toFixed(1) : 0;
        updateSliderFill();
        updateLoanAmountDisplay();
      }
      dom.purchaseFields.style.display = '';
      dom.refiFields.style.display = 'none';
    }

    updateLTVDisplay();
    updatePMISuggestion();
    calculate();
  };

  /* ---------- Refi Equity Display ---------- */
  const updateRefiEquityDisplay = () => {
    const apprVal = MSFG.parseNum(dom.appraisedValue.value);
    const loanAmt = MSFG.parseNum(dom.refiLoanAmount.value);
    const equity = Math.max(apprVal - loanAmt, 0);
    dom.refiEquity.value = MSFG.formatCurrency(equity, 0);
  };

  /* ---------- LTV Display ---------- */
  const updateLTVDisplay = () => {
    let loanAmt, propertyVal;

    if (currentMode === 'purchase') {
      loanAmt = getLoanAmount();
      propertyVal = MSFG.parseNum(dom.homePrice.value);
    } else {
      loanAmt = MSFG.parseNum(dom.refiLoanAmount.value);
      propertyVal = MSFG.parseNum(dom.appraisedValue.value);
    }

    const ltv = propertyVal > 0 ? (loanAmt / propertyVal) * 100 : 0;
    const ltvClamped = Math.min(ltv, 100); // clamp fill at 100%

    dom.ltvValue.textContent = `${ltv.toFixed(1)}%`;
    dom.ltvFill.style.width = `${ltvClamped}%`;

    // Color coding
    dom.ltvValue.classList.remove('warning', 'danger');
    dom.ltvFill.classList.remove('warning', 'danger');

    if (ltv > 95) {
      dom.ltvValue.classList.add('danger');
      dom.ltvFill.classList.add('danger');
    } else if (ltv > 80) {
      dom.ltvValue.classList.add('warning');
      dom.ltvFill.classList.add('warning');
    }

    // Note
    if (ltv > 80) {
      dom.ltvNote.textContent = 'LTV exceeds 80% — PMI may be required';
    } else {
      dom.ltvNote.textContent = '';
    }
  };

  /* ---------- PMI Auto-Suggest ---------- */
  const updatePMISuggestion = () => {
    let ltv, loanAmt;

    if (currentMode === 'purchase') {
      const hp = MSFG.parseNum(dom.homePrice.value);
      loanAmt = getLoanAmount();
      ltv = hp > 0 ? (loanAmt / hp) * 100 : 0;
    } else {
      loanAmt = MSFG.parseNum(dom.refiLoanAmount.value);
      const apprVal = MSFG.parseNum(dom.appraisedValue.value);
      ltv = apprVal > 0 ? (loanAmt / apprVal) * 100 : 0;
    }

    if (ltv > 80 && MSFG.parseNum(dom.pmi.value) === 0) {
      const suggestedPMI = Math.round((loanAmt * 0.005) / 12);
      dom.pmi.value = suggestedPMI;
      dom.pmiNote.textContent = 'Auto-estimated at 0.5% annual rate';
    } else if (ltv <= 80) {
      dom.pmi.value = 0;
      dom.pmiNote.textContent = '';
    }
  };

  /* ---------- Down Payment Sync ---------- */
  const syncDownPaymentFromDollar = () => {
    const hp = MSFG.parseNum(dom.homePrice.value);
    const dp = MSFG.parseNum(dom.downPaymentDollar.value);
    dom.downPaymentPercent.value = hp > 0 ? ((dp / hp) * 100).toFixed(1) : 0;
    updateLoanAmountDisplay();
  };

  const syncDownPaymentFromPercent = () => {
    const hp = MSFG.parseNum(dom.homePrice.value);
    const pct = MSFG.parseNum(dom.downPaymentPercent.value);
    dom.downPaymentDollar.value = Math.round(hp * (pct / 100));
    updateLoanAmountDisplay();
  };

  const updateLoanAmountDisplay = () => {
    const loan = getLoanAmount();
    dom.loanAmount.value = MSFG.formatCurrency(loan, 0);
  };

  const getLoanAmount = () => {
    const hp = MSFG.parseNum(dom.homePrice.value);
    const dp = MSFG.parseNum(dom.downPaymentDollar.value);
    return Math.max(hp - dp, 0);
  };

  /* ---------- Read Inputs ---------- */
  const getInputs = () => {
    let homePrice, downPayment, principal, propertyValue, cashOut;

    if (currentMode === 'purchase') {
      homePrice = MSFG.parseNum(dom.homePrice.value);
      downPayment = MSFG.parseNum(dom.downPaymentDollar.value);
      principal = Math.max(homePrice - downPayment, 0);
      propertyValue = homePrice;
      cashOut = 0;
    } else {
      principal = MSFG.parseNum(dom.refiLoanAmount.value);
      propertyValue = MSFG.parseNum(dom.appraisedValue.value);
      homePrice = propertyValue; // for backwards compat in schedule
      downPayment = Math.max(propertyValue - principal, 0);
      cashOut = MSFG.parseNum(dom.cashOut.value);
    }

    const annualRate = MSFG.parseNum(dom.interestRate.value) / 100;
    const termYears = getActiveTerm();
    const startMonth = parseInt(dom.startMonth.value, 10);
    const startYear = parseInt(dom.startYear.value, 10);

    // Taxes & Insurance → monthly
    let propertyTax = MSFG.parseNum(dom.propertyTax.value);
    if (dom.propertyTax.dataset.period === 'annual') propertyTax /= 12;

    let homeInsurance = MSFG.parseNum(dom.homeInsurance.value);
    if (dom.homeInsurance.dataset.period === 'annual') homeInsurance /= 12;

    const monthlyPMI = MSFG.parseNum(dom.pmi.value);

    // Extra payments
    const extraAmount = MSFG.parseNum(dom.extraPayment.value);
    const extraFreq = getActiveFreq();
    const extraStartMonth = parseInt(dom.extraStartMonth.value, 10);
    const extraStartYear = parseInt(dom.extraStartYear.value, 10);

    return {
      mode: currentMode, homePrice, downPayment, principal, propertyValue, cashOut,
      annualRate, termYears, startMonth, startYear,
      monthlyTax: propertyTax, monthlyIns: homeInsurance, monthlyPMI,
      extraAmount, extraFreq, extraStartMonth, extraStartYear
    };
  };

  const getActiveTerm = () => {
    const active = dom.termToggle.querySelector('.amort-term-btn.active');
    return active ? parseInt(active.dataset.years, 10) : 30;
  };

  const getActiveFreq = () => {
    const active = dom.extraFreqToggle.querySelector('.amort-term-btn.active');
    return active ? active.dataset.freq : 'monthly';
  };

  /* ---------- Core: Generate Schedule ---------- */
  const generateSchedule = (inputs, includeExtras = true) => {
    const { principal, annualRate, termYears, startMonth, startYear,
            propertyValue, monthlyTax, monthlyIns, monthlyPMI,
            extraAmount, extraFreq, extraStartMonth, extraStartYear } = inputs;

    if (principal <= 0 || termYears <= 0) return [];

    const monthlyRate = annualRate / 12;
    const totalPayments = termYears * 12;
    const basePayment = MSFG.calcMonthlyPayment(principal, annualRate, termYears);

    const schedule = [];
    let balance = principal;

    for (let i = 1; i <= totalPayments && balance > 0.005; i++) {
      const month = (startMonth + i - 1) % 12;
      const year = startYear + Math.floor((startMonth + i - 1) / 12);
      const schedYear = Math.ceil(i / 12);

      // Interest for this month
      const interestPmt = balance * monthlyRate;
      let principalPmt = Math.min(basePayment - interestPmt, balance);
      let payment = interestPmt + principalPmt;

      // Extra payment logic
      let extra = 0;
      if (includeExtras && extraAmount > 0) {
        const extraStartDate = new Date(extraStartYear, extraStartMonth, 1);
        const thisDate = new Date(year, month, 1);

        if (thisDate >= extraStartDate) {
          if (extraFreq === 'monthly') {
            extra = extraAmount;
          } else if (extraFreq === 'annually') {
            // Pay extra once per year on anniversary month
            if (month === extraStartMonth) {
              extra = extraAmount;
            }
          } else if (extraFreq === 'one-time') {
            if (month === extraStartMonth && year === extraStartYear) {
              extra = extraAmount;
            }
          }
        }
      }

      // Cap extra so balance doesn't go negative
      extra = Math.min(extra, balance - principalPmt);
      if (extra < 0) extra = 0;

      balance -= (principalPmt + extra);
      if (balance < 0.005) balance = 0;

      // LTV & PMI
      const ltv = propertyValue > 0 ? (balance / propertyValue) * 100 : 0;
      const pmiActive = ltv > 80 && monthlyPMI > 0;
      const pmiThisMonth = pmiActive ? monthlyPMI : 0;

      schedule.push({
        paymentNum: i,
        month, year, schedYear,
        date: `${MONTHS[month]} ${year}`,
        payment: payment + extra,
        principal: principalPmt,
        interest: interestPmt,
        extra,
        balance,
        ltv,
        pmiActive,
        pmiThisMonth,
        monthlyTax: monthlyTax,
        monthlyIns: monthlyIns,
        totalMonthly: payment + extra + monthlyTax + monthlyIns + pmiThisMonth
      });
    }

    return schedule;
  };

  /* ---------- Main Calculate ---------- */
  const calculate = () => {
    if (currentMode === 'purchase') {
      updateLoanAmountDisplay();
    } else {
      updateRefiEquityDisplay();
    }
    updateLTVDisplay();
    const inputs = getInputs();

    if (inputs.principal <= 0) {
      hideResults();
      return;
    }

    // Schedule with extras
    currentSchedule = generateSchedule(inputs, true);
    // Schedule without extras (for savings comparison)
    baseSchedule = generateSchedule(inputs, false);

    if (currentSchedule.length === 0) {
      hideResults();
      return;
    }

    updateResults(inputs, currentSchedule, baseSchedule);
    renderChart(currentSchedule);
    renderTable(currentSchedule);
    renderCalcSteps(inputs, currentSchedule);
    showResults();
  };

  const hideResults = () => {
    dom.resultsSection.style.display = 'none';
    dom.chartSection.style.display = 'none';
    dom.scheduleSection.style.display = 'none';
  };

  const showResults = () => {
    dom.resultsSection.style.display = '';
    dom.chartSection.style.display = '';
    dom.scheduleSection.style.display = '';
  };

  /* ---------- Update Results ---------- */
  const updateResults = (inputs, schedule, baseSchedule) => {
    const monthlyPI = MSFG.calcMonthlyPayment(inputs.principal, inputs.annualRate, inputs.termYears);
    const firstRow = schedule[0];
    const lastRow = schedule[schedule.length - 1];

    const totalInterest = schedule.reduce((sum, r) => sum + r.interest, 0);
    const totalPaid = schedule.reduce((sum, r) => sum + r.payment, 0);
    const totalExtra = schedule.reduce((sum, r) => sum + r.extra, 0);

    dom.resultMonthlyPI.textContent = MSFG.formatCurrency(monthlyPI);

    // Total monthly = P&I + tax + ins + PMI (first month)
    const totalMonthly = monthlyPI + inputs.monthlyTax + inputs.monthlyIns +
                         (firstRow.pmiActive ? inputs.monthlyPMI : 0);
    dom.resultTotalMonthly.textContent = MSFG.formatCurrency(totalMonthly);

    // Detail breakdown
    const parts = [`P&I ${MSFG.formatCurrency(monthlyPI)}`];
    if (inputs.monthlyTax > 0) parts.push(`Tax ${MSFG.formatCurrency(inputs.monthlyTax)}`);
    if (inputs.monthlyIns > 0) parts.push(`Ins ${MSFG.formatCurrency(inputs.monthlyIns)}`);
    if (firstRow.pmiActive) parts.push(`PMI ${MSFG.formatCurrency(inputs.monthlyPMI)}`);
    dom.resultMonthlyDetail.textContent = parts.join(' + ');

    dom.resultTotalInterest.textContent = MSFG.formatCurrency(totalInterest, 0);
    dom.resultTotalCost.textContent = MSFG.formatCurrency(totalPaid + (schedule.length * (inputs.monthlyTax + inputs.monthlyIns)) +
      schedule.reduce((s, r) => s + r.pmiThisMonth, 0), 0);
    dom.resultPayoffDate.textContent = `${MONTH_FULL[lastRow.month]} ${lastRow.year}`;

    // Cash to Close / Equity + Starting LTV
    if (inputs.mode === 'refinance') {
      dom.resultCashEquityLabel.textContent = 'Equity';
      const equity = Math.max(inputs.propertyValue - inputs.principal, 0);
      dom.resultCashEquityValue.textContent = MSFG.formatCurrency(equity, 0);
    } else {
      dom.resultCashEquityLabel.textContent = 'Cash to Close';
      dom.resultCashEquityValue.textContent = MSFG.formatCurrency(inputs.downPayment, 0);
    }

    const startingLTV = inputs.propertyValue > 0
      ? ((inputs.principal / inputs.propertyValue) * 100).toFixed(1) + '%'
      : '--';
    dom.resultStartingLTV.textContent = startingLTV;

    // Extra payment savings
    if (totalExtra > 0 && baseSchedule.length > schedule.length) {
      const baseInterest = baseSchedule.reduce((sum, r) => sum + r.interest, 0);
      const interestSaved = baseInterest - totalInterest;
      const monthsSaved = baseSchedule.length - schedule.length;
      const yearsSaved = Math.floor(monthsSaved / 12);
      const remainMonths = monthsSaved % 12;

      dom.resultInterestSaved.textContent = MSFG.formatCurrency(interestSaved, 0);

      let timeStr = '';
      if (yearsSaved > 0) timeStr += `${yearsSaved} yr`;
      if (remainMonths > 0) timeStr += `${yearsSaved > 0 ? ' ' : ''}${remainMonths} mo`;
      dom.resultTimeSaved.textContent = timeStr || '--';
      dom.extraSavingsRow.style.display = '';
    } else {
      dom.extraSavingsRow.style.display = 'none';
    }
  };

  /* ---------- Chart ---------- */
  const renderChart = (schedule) => {
    // Aggregate to annual data points
    const years = {};
    schedule.forEach(row => {
      const key = row.schedYear;
      if (!years[key]) {
        years[key] = { year: row.year, interest: 0, principal: 0, balance: 0 };
      }
      years[key].interest += row.interest;
      years[key].principal += row.principal + row.extra;
      years[key].balance = row.balance;
    });

    const yearKeys = Object.keys(years).map(Number).sort((a, b) => a - b);
    const labels = yearKeys.map(k => `Year ${k}`);
    const balanceData = yearKeys.map(k => Math.round(years[k].balance));

    // Cumulative series
    let cumInterest = 0, cumPrincipal = 0;
    const cumInterestData = [];
    const cumPrincipalData = [];
    yearKeys.forEach(k => {
      cumInterest += years[k].interest;
      cumPrincipal += years[k].principal;
      cumInterestData.push(Math.round(cumInterest));
      cumPrincipalData.push(Math.round(cumPrincipal));
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Remaining Balance',
          data: balanceData,
          borderColor: '#2d6a4f',
          backgroundColor: 'rgba(45, 106, 79, 0.08)',
          fill: true,
          tension: 0.3,
          pointStyle: 'circle',
          pointRadius: 3,
          borderWidth: 2.5
        },
        {
          label: 'Cumulative Interest',
          data: cumInterestData,
          borderColor: '#dc3545',
          backgroundColor: 'rgba(220, 53, 69, 0.06)',
          fill: true,
          tension: 0.3,
          pointStyle: 'triangle',
          pointRadius: 3,
          borderWidth: 2
        },
        {
          label: 'Cumulative Principal',
          data: cumPrincipalData,
          borderColor: '#40916c',
          backgroundColor: 'rgba(64, 145, 108, 0.06)',
          fill: true,
          tension: 0.3,
          pointStyle: 'rect',
          pointRadius: 3,
          borderWidth: 2
        }
      ]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, padding: 16, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${MSFG.formatCurrency(ctx.raw, 0)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => val >= 1000 ? `$${Math.round(val / 1000)}k` : `$${val}`
          },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          grid: { display: false }
        }
      }
    };

    if (chart) {
      chart.data = chartData;
      chart.options = options;
      chart.update();
    } else {
      chart = new Chart(dom.amortChart, { type: 'line', data: chartData, options });
    }
  };

  /* ---------- Schedule Table ---------- */
  const renderTable = (schedule) => {
    const tbody = dom.scheduleBody;
    tbody.innerHTML = '';

    // Group by schedYear
    const yearGroups = {};
    schedule.forEach(row => {
      if (!yearGroups[row.schedYear]) yearGroups[row.schedYear] = [];
      yearGroups[row.schedYear].push(row);
    });

    const yearKeys = Object.keys(yearGroups).map(Number).sort((a, b) => a - b);

    yearKeys.forEach(yearNum => {
      const rows = yearGroups[yearNum];
      const yearTotals = rows.reduce((acc, r) => {
        acc.payment += r.payment;
        acc.principal += r.principal;
        acc.interest += r.interest;
        acc.extra += r.extra;
        return acc;
      }, { payment: 0, principal: 0, interest: 0, extra: 0 });

      const endBalance = rows[rows.length - 1].balance;

      // Year header row (clickable)
      const yearRow = document.createElement('tr');
      yearRow.className = 'amort-year-header';
      yearRow.dataset.year = yearNum;
      yearRow.innerHTML =
        `<td colspan="2"><button type="button" class="amort-year-btn">` +
        `<svg class="amort-year-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg> ` +
        `Year ${yearNum} <span class="amort-year-range">(${rows[0].date} – ${rows[rows.length - 1].date})</span></button></td>` +
        `<td>${MSFG.formatCurrency(yearTotals.payment, 0)}</td>` +
        `<td>${MSFG.formatCurrency(yearTotals.principal, 0)}</td>` +
        `<td>${MSFG.formatCurrency(yearTotals.interest, 0)}</td>` +
        `<td>${yearTotals.extra > 0 ? MSFG.formatCurrency(yearTotals.extra, 0) : '—'}</td>` +
        `<td>${MSFG.formatCurrency(endBalance, 0)}</td>`;

      yearRow.addEventListener('click', () => toggleYearRows(yearNum));
      tbody.appendChild(yearRow);

      // Monthly detail rows (collapsed by default)
      rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'amort-month-row';
        tr.dataset.year = yearNum;
        tr.style.display = 'none';
        tr.innerHTML =
          `<td>${row.paymentNum}</td>` +
          `<td>${row.date}</td>` +
          `<td>${MSFG.formatCurrency(row.payment)}</td>` +
          `<td>${MSFG.formatCurrency(row.principal)}</td>` +
          `<td>${MSFG.formatCurrency(row.interest)}</td>` +
          `<td>${row.extra > 0 ? MSFG.formatCurrency(row.extra) : '—'}</td>` +
          `<td>${MSFG.formatCurrency(row.balance)}</td>`;
        tbody.appendChild(tr);
      });
    });
  };

  const toggleYearRows = (yearNum) => {
    const monthRows = dom.scheduleBody.querySelectorAll(`.amort-month-row[data-year="${yearNum}"]`);
    const yearHeader = dom.scheduleBody.querySelector(`.amort-year-header[data-year="${yearNum}"]`);
    const isOpen = monthRows[0] && monthRows[0].style.display !== 'none';

    monthRows.forEach(row => {
      row.style.display = isOpen ? 'none' : '';
    });
    yearHeader.classList.toggle('open', !isOpen);
  };

  /* ---------- CSV Export ---------- */
  const exportCSV = () => {
    if (currentSchedule.length === 0) return;

    const headers = ['Payment #', 'Date', 'Payment', 'Principal', 'Interest', 'Extra', 'Balance', 'LTV'];
    const csvRows = [headers.join(',')];

    currentSchedule.forEach(row => {
      csvRows.push([
        row.paymentNum,
        row.date,
        row.payment.toFixed(2),
        row.principal.toFixed(2),
        row.interest.toFixed(2),
        row.extra.toFixed(2),
        row.balance.toFixed(2),
        row.ltv.toFixed(2)
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'amortization-schedule.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- Calc Steps (Show Calculations) ---------- */
  const renderCalcSteps = (inputs, schedule) => {
    const stepsContainer = document.getElementById('calcSteps-amortization');
    if (!stepsContainer) return;

    const monthlyPI = MSFG.calcMonthlyPayment(inputs.principal, inputs.annualRate, inputs.termYears);
    const totalInterest = schedule.reduce((sum, r) => sum + r.interest, 0);
    const totalExtra = schedule.reduce((sum, r) => sum + r.extra, 0);
    const r = inputs.annualRate / 12;
    const n = inputs.termYears * 12;

    let html = '';

    // Step 0: Loan Context
    const startLTV = inputs.propertyValue > 0
      ? ((inputs.principal / inputs.propertyValue) * 100).toFixed(1) : '0.0';

    if (inputs.mode === 'refinance') {
      html += `<div class="calc-step">
        <h4>Refinance Loan Details</h4>
        <span class="calc-step__values">
          Loan Amount: ${MSFG.formatCurrency(inputs.principal, 0)}<br>
          Appraised Value: ${MSFG.formatCurrency(inputs.propertyValue, 0)}<br>
          ${inputs.cashOut > 0 ? `Cash Out: ${MSFG.formatCurrency(inputs.cashOut, 0)}<br>` : ''}
          Equity: ${MSFG.formatCurrency(Math.max(inputs.propertyValue - inputs.principal, 0), 0)}<br>
          Starting LTV: ${startLTV}%
        </span>
      </div>`;
    } else {
      html += `<div class="calc-step">
        <h4>Purchase Loan Details</h4>
        <span class="calc-step__values">
          Home Price: ${MSFG.formatCurrency(inputs.homePrice, 0)}<br>
          Down Payment: ${MSFG.formatCurrency(inputs.downPayment, 0)} (${inputs.homePrice > 0 ? ((inputs.downPayment / inputs.homePrice) * 100).toFixed(1) : 0}%)<br>
          Loan Amount: ${MSFG.formatCurrency(inputs.principal, 0)}<br>
          Starting LTV: ${startLTV}%
        </span>
      </div>`;
    }

    // Step 1: Monthly Payment
    html += `<div class="calc-step">
      <h4>Monthly P&I Payment</h4>
      <div class="calc-step__formula">
        M = P &times; r / (1 - (1 + r)<sup>-n</sup>)
      </div>
      <span class="calc-step__values">
        P = ${MSFG.formatCurrency(inputs.principal, 0)}, r = ${inputs.annualRate.toFixed(5)}/12 = ${r.toFixed(7)}, n = ${n}<br>
        M = ${MSFG.formatCurrency(monthlyPI)}
      </span>
    </div>`;

    // Step 2: Total Interest
    html += `<div class="calc-step">
      <h4>Total Interest Paid</h4>
      <div class="calc-step__formula">
        Sum of all monthly interest charges over ${schedule.length} payments
      </div>
      <span class="calc-step__values">
        Total Interest = ${MSFG.formatCurrency(totalInterest, 0)}
      </span>
    </div>`;

    // Step 3: Extra Payments Impact
    if (totalExtra > 0) {
      const baseInterest = baseSchedule.reduce((sum, rw) => sum + rw.interest, 0);
      html += `<div class="calc-step highlight">
        <h4>Extra Payment Impact</h4>
        <div class="calc-step__formula">
          Extra payments: ${MSFG.formatCurrency(inputs.extraAmount)} ${inputs.extraFreq}<br>
          Total extra paid: ${MSFG.formatCurrency(totalExtra, 0)}
        </div>
        <span class="calc-step__values">
          Original term: ${baseSchedule.length} months | New term: ${schedule.length} months<br>
          Interest without extras: ${MSFG.formatCurrency(baseInterest, 0)}<br>
          Interest with extras: ${MSFG.formatCurrency(totalInterest, 0)}<br>
          Savings: ${MSFG.formatCurrency(baseInterest - totalInterest, 0)}
        </span>
      </div>`;
    }

    // Step 4: PMI
    if (inputs.monthlyPMI > 0) {
      const pmiMonths = schedule.filter(rw => rw.pmiActive).length;
      const pmiTotal = pmiMonths * inputs.monthlyPMI;
      const dropRow = schedule.find(rw => !rw.pmiActive);
      html += `<div class="calc-step">
        <h4>PMI Analysis</h4>
        <div class="calc-step__formula">
          PMI active while LTV > 80%<br>
          Monthly PMI: ${MSFG.formatCurrency(inputs.monthlyPMI)}
        </div>
        <span class="calc-step__values">
          PMI months: ${pmiMonths} | Total PMI cost: ${MSFG.formatCurrency(pmiTotal, 0)}
          ${dropRow ? `<br>PMI drops off: ${dropRow.date} (LTV ${dropRow.ltv.toFixed(1)}%)` : ''}
        </span>
      </div>`;
    }

    stepsContainer.innerHTML = html;
  };

  /* ---------- Public API ---------- */
  return { init, calculate, exportCSV };

})();

document.addEventListener('DOMContentLoaded', AmortCalc.init);
