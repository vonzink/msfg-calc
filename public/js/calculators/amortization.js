'use strict';

(function () {
  const $ = id => document.getElementById(id);
  const money = value => MSFG.formatCurrency(value);
  const number = id => Number($(id).value);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const PROGRAMS = { conventional: 'Conventional loan', fha: 'FHA loan', va: 'VA loan' };
  const COLORS = { principal: '#2d6a4f', interest: '#df6358', tax: '#d5a044', insurance: '#65a889', hoa: '#3c99ab', mi: '#9274b4', extra: '#254c6d' };
  let mode = 'purchase';
  let result = null;
  let inputs = null;
  let paymentChart = null;
  let balanceChart = null;
  let refiInitialized = false;
  let pmiEdited = false;
  let extraDateEdited = false;
  let expandedYears = new Set([1]);

  const setText = (id, value) => { $(id).textContent = value; };
  const setGroup = (id, visible) => {
    $(id).hidden = !visible;
    $(id).querySelectorAll('input, select').forEach(el => { el.disabled = !visible; });
  };
  const populateDates = () => {
    const today = new Date();
    const firstPayment = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    ['startMonth', 'extraStartMonth'].forEach(id => {
      $(id).innerHTML = MONTHS.map((month, i) => `<option value="${i}">${month}</option>`).join('');
      $(id).value = firstPayment.getMonth();
    });
    ['startYear', 'extraStartYear'].forEach(id => {
      $(id).innerHTML = Array.from({ length: 41 }, (_, i) => `<option>${today.getFullYear() + i}</option>`).join('');
      $(id).value = firstPayment.getFullYear();
    });
  };

  const syncDownPayment = source => {
    const home = number('homePrice');
    if (source === 'downPaymentDollar') {
      $('downPaymentPercent').value = home > 0 ? Number((number('downPaymentDollar') / home * 100).toFixed(6)) : 0;
    } else {
      $('downPaymentDollar').value = Number((home * number('downPaymentPercent') / 100).toFixed(2));
    }
  };

  const updateProgramFields = () => {
    const program = $('loanProgram').value;
    setGroup('purchaseFields', mode === 'purchase');
    setGroup('refiFields', mode === 'refinance');
    setGroup('vaFields', program === 'va');
    setGroup('vaRefiGroup', program === 'va' && mode === 'refinance');
    const base = mode === 'purchase' ? number('homePrice') - number('downPaymentDollar') : number('refiLoanAmount') + number('cashOut');
    const value = mode === 'purchase' ? number('homePrice') : number('appraisedValue');
    const needsPMI = program === 'conventional' && base / value > 0.8;
    setGroup('pmiGroup', needsPMI);
    if (needsPMI && !pmiEdited) $('pmi').value = Math.max(0, Number((base * 0.005 / 12).toFixed(2)));
    setText('extraPeriodLabel', { monthly: '/mo', annually: '/yr', 'one-time': 'once' }[$('extraFrequency').value]);
  };

  const readInputs = () => ({
    mode, program: $('loanProgram').value,
    homePrice: number('homePrice'), downPayment: number('downPaymentDollar'),
    refiLoanAmount: number('refiLoanAmount'), cashOut: number('cashOut'), appraisedValue: number('appraisedValue'),
    annualRate: number('interestRate') / 100, termYears: number('loanTerm'),
    startMonth: number('startMonth'), startYear: number('startYear'),
    monthlyTax: number('propertyTax') / ($('propertyTax').dataset.period === 'annual' ? 12 : 1),
    monthlyIns: number('homeInsurance') / ($('homeInsurance').dataset.period === 'annual' ? 12 : 1),
    monthlyHOA: number('hoa'), monthlyPMI: $('pmi').disabled ? 0 : number('pmi'),
    extraAmount: number('extraPayment'), extraFreq: $('extraFrequency').value,
    extraStartMonth: number('extraStartMonth'), extraStartYear: number('extraStartYear'),
    vaUse: $('vaUse').value, vaExempt: $('vaExempt').checked, vaRefiType: $('vaRefiType').value
  });

  const validate = () => {
    const invalid = [];
    $('amortForm').querySelectorAll('input, select').forEach(el => {
      const bad = !el.disabled && !el.validity.valid;
      el.setAttribute('aria-invalid', String(bad));
      if (bad) invalid.push(el);
    });
    if (invalid.length) {
      const label = invalid[0].getAttribute('aria-label') || (document.querySelector(`label[for="${invalid[0].id}"]`) || {}).textContent || 'value';
      return `Enter a valid ${label.toLowerCase()}. Amounts must be nonnegative and the interest rate must be between 0% and 25%.`;
    }
    if (mode === 'purchase' && inputs.downPayment >= inputs.homePrice) return 'Down payment must be less than the purchase price to calculate a mortgage.';
    if (inputs.extraAmount > 0 && inputs.extraStartYear * 12 + inputs.extraStartMonth < inputs.startYear * 12 + inputs.startMonth) return 'Choose an extra payment start date on or after the first mortgage payment.';
    if (mode === 'refinance' && inputs.program === 'va' && inputs.vaRefiType === 'irrrl' && inputs.cashOut > 0) return 'Set additional cash out to $0 for an IRRRL, or choose a cash-out / regular refinance.';
    return '';
  };

  const programNote = () => {
    const loan = result.loan;
    if (inputs.program === 'fha') {
      return `${money(loan.upfrontFee)} upfront FHA mortgage insurance is included in the loan. Estimated annual MIP rate: ${(loan.mip.rate * 100).toFixed(2)}%, for ${loan.mip.months === 132 ? '11 years' : 'the loan term'} or until payoff. ${mode === 'purchase' && loan.ltv > 96.5 ? 'This scenario is below the standard 3.5% down payment; confirm eligibility with your loan officer.' : ''}`;
    }
    if (inputs.program === 'va') {
      return inputs.vaExempt ? 'Funding fee exemption selected. No monthly mortgage insurance.' : `${money(loan.upfrontFee)} VA funding fee (${(loan.feeRate * 100).toFixed(2)}%) is included in the loan. No monthly mortgage insurance.`;
    }
    if (inputs.monthlyPMI > 0) return `${money(inputs.monthlyPMI)} estimated monthly PMI. Modeled cancellation at payment ${result.pmiEnd} on the original schedule, assuming payments are current. Earlier removal requires servicer approval.`;
    return '';
  };

  const renderSummary = () => {
    const first = result.schedule[0];
    const last = result.schedule[result.schedule.length - 1];
    setText('loanAmount', money(result.loan.principal));
    setText('resultMonthlyPI', money(result.monthlyPI));
    setText('resultTaxIns', money(first.monthlyTax + first.monthlyIns));
    setText('resultTotalMonthly', money(first.totalMonthly));
    setText('resultMonthlyDetail', `${inputs.termYears}-year loan at ${(inputs.annualRate * 100).toFixed(3)}%. First payment includes ${money(first.monthlyHOA)} HOA${first.pmiThisMonth ? `, ${money(first.pmiThisMonth)} mortgage insurance` : ''}${first.extra ? `, and ${money(first.extra)} extra principal` : ''}.`);
    setText('programNote', programNote());
    $('programNote').hidden = !$('programNote').textContent;
    setText('resultTotalInterest', money(result.totalInterest));
    setText('resultTotalCost', money(result.totalCost));
    setText('resultPayoffDate', `${MONTHS[last.month]} ${last.year}`);
    setText('resultStartingLTV', `${result.loan.ltv.toFixed(1)}%`);
    setText('resultInterestSaved', money(result.interestSaved));
    const years = Math.floor(result.monthsSaved / 12);
    const months = result.monthsSaved % 12;
    setText('resultTimeSaved', [years ? `${years} ${years === 1 ? 'year' : 'years'}` : '', months ? `${months} ${months === 1 ? 'month' : 'months'}` : ''].filter(Boolean).join(', ') || '0 months');
    $('extraSavingsRow').hidden = result.totalExtra <= 0;
    setText('scheduleCaption', `${result.schedule.length} payments · Select a year to see its monthly detail.`);
    $('breakdownMonth').max = result.schedule.length;
    $('breakdownMonth').value = Math.min(number('breakdownMonth'), result.schedule.length);
    setText('lastPaymentLabel', `Month ${result.schedule.length}`);
  };

  const renderBreakdown = () => {
    if (!result) return;
    const row = result.schedule[number('breakdownMonth') - 1];
    if (!row) return;
    const label = `Month ${row.paymentNum} · Year ${row.schedYear}`;
    setText('breakdownLabel', label);
    setText('breakdownDate', `${MONTHS[row.month]} ${row.year}`);
    $('breakdownMonth').setAttribute('aria-valuetext', `${label}, ${row.date}, ${money(row.totalMonthly)}`);
    const parts = [
      ['principal', 'Principal', row.principal], ['interest', 'Interest', row.interest],
      ['tax', 'Property tax', row.monthlyTax], ['insurance', 'Insurance', row.monthlyIns], ['hoa', 'HOA', row.monthlyHOA]
    ];
    if (inputs.program === 'fha' || inputs.monthlyPMI > 0) parts.push(['mi', inputs.program === 'fha' ? 'FHA MIP' : 'PMI', row.pmiThisMonth]);
    if (result.totalExtra > 0) parts.push(['extra', 'Extra principal', row.extra]);
    $('breakdownBody').innerHTML = parts.map(([key, name, amount]) => `<tr><th scope="row"><i class="amort-dot amort-dot--${key}" aria-hidden="true"></i>${name}</th><td>${money(amount)}</td></tr>`).join('');
    $('paymentLegend').innerHTML = parts.map(([key, name]) => `<span><i class="amort-dot amort-dot--${key}"></i>${name}</span>`).join('');
    setText('breakdownTotal', money(row.totalMonthly));
    setText('donutTotal', money(row.totalMonthly));
    setText('breakdownBalance', money(row.balance));
    const pi = row.principal + row.interest;
    setText('breakdownRatio', `${(pi ? row.principal / pi * 100 : 0).toFixed(1)}% / ${(pi ? row.interest / pi * 100 : 0).toFixed(1)}%`);
    document.querySelectorAll('.amort-month-row[aria-current]').forEach(el => el.removeAttribute('aria-current'));
    const current = document.querySelector(`.amort-month-row[data-payment="${row.paymentNum}"]`);
    if (current) current.setAttribute('aria-current', 'true');
    if (typeof Chart === 'undefined') {
      $('paymentChart').hidden = true;
      return;
    }
    const data = { labels: parts.map(part => part[1]), datasets: [{ data: parts.map(part => part[2]), backgroundColor: parts.map(part => COLORS[part[0]]), borderColor: '#fff', borderWidth: 2, hoverOffset: 4 }] };
    if (paymentChart) {
      paymentChart.data = data;
      paymentChart.update('none');
    } else {
      paymentChart = new Chart($('paymentChart'), { type: 'doughnut', data, options: {
        responsive: true, maintainAspectRatio: false, cutout: '67%', animation: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${money(ctx.raw)}` } } }
      } });
    }
  };

  const renderSchedule = () => {
    const groups = {};
    result.schedule.forEach(row => { (groups[row.schedYear] || (groups[row.schedYear] = [])).push(row); });
    const columns = ['payment', 'principal', 'interest', 'extra', 'balance', 'monthlyTax', 'monthlyIns', 'monthlyHOA', 'pmiThisMonth', 'totalMonthly'];
    $('scheduleBody').innerHTML = Object.keys(groups).map(year => {
      const rows = groups[year];
      const open = expandedYears.has(Number(year));
      const totals = columns.map(key => key === 'balance' ? rows[rows.length - 1].balance : rows.reduce((sum, row) => sum + row[key], 0));
      return `<tr class="amort-year-header"><td colspan="2"><button type="button" class="amort-year-btn" data-action="toggle-year" data-year="${year}" aria-expanded="${open}" aria-controls="${rows.map(row => `amort-payment-${row.paymentNum}`).join(' ')}">Year ${year}</button></td>${totals.map(total => `<td>${money(total)}</td>`).join('')}</tr>` + rows.map(row =>
        `<tr id="amort-payment-${row.paymentNum}" class="amort-month-row" data-year="${year}" data-payment="${row.paymentNum}"${open ? '' : ' hidden'}><td>${row.paymentNum}</td><td>${row.date}</td>${columns.map(key => `<td>${money(row[key])}</td>`).join('')}</tr>`
      ).join('');
    }).join('');
    updateExpandButton();
  };

  const updateExpandButton = () => {
    const allExpanded = result && result.schedule.every(row => expandedYears.has(row.schedYear));
    const button = document.querySelector('[data-action="expand-schedule"]');
    button.textContent = allExpanded ? 'Collapse all years' : 'Expand all years';
    button.setAttribute('aria-expanded', String(Boolean(allExpanded)));
  };

  const renderBalanceChart = () => {
    if (!result || typeof Chart === 'undefined') return;
    const rows = result.schedule.filter((row, i) => row.paymentNum % 12 === 0 || i === result.schedule.length - 1);
    const data = {
      labels: ['Start'].concat(rows.map(row => `Year ${row.schedYear}`)),
      datasets: [{ label: 'Remaining balance', data: [result.loan.principal].concat(rows.map(row => row.balance)), borderColor: COLORS.principal, backgroundColor: '#2d6a4f12', borderWidth: 2, fill: true, pointRadius: 2 }]
    };
    if (balanceChart) { balanceChart.data = data; balanceChart.update('none'); }
    else balanceChart = new Chart($('amortChart'), { type: 'line', data, options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => money(ctx.raw) } } },
      scales: { y: { beginAtZero: true, ticks: { callback: value => MSFG.formatCurrency(value, 0) } }, x: { grid: { display: false } } }
    } });
  };

  const renderSteps = () => {
    $('calcSteps-amortization').innerHTML = `<div class="calc-step"><h4>Loan amount</h4><p>${money(result.loan.basePrincipal)} base loan + ${money(result.loan.upfrontFee)} financed program fee = ${money(result.loan.principal)}.</p></div>
      <div class="calc-step"><h4>Principal &amp; interest</h4><div class="calc-step__formula">${inputs.annualRate === 0 ? 'M = P ÷ n' : 'M = P × r ÷ (1 − (1 + r)<sup>−n</sup>)'}</div><p>P = ${money(result.loan.principal)}, r = ${(inputs.annualRate / 12).toFixed(8)}, n = ${inputs.termYears * 12}. Scheduled P&amp;I = ${money(result.monthlyPI)}. The final payment is adjusted to pay off the remaining balance.</p></div>
      <div class="calc-step"><h4>Monthly breakdown</h4><p>Interest = opening balance × monthly rate. Principal = P&amp;I − interest. Extra payments reduce the remaining principal. Taxes, insurance, HOA, and mortgage insurance are added separately.</p></div>
      <div class="calc-step"><h4>Loan totals</h4><p>${result.schedule.length} payments, ${money(result.totalInterest)} interest, and ${money(result.totalExtra)} extra principal. ${result.totalExtra > 0 ? `Extra payments save ${money(result.interestSaved)} in interest.` : ''}</p></div>`;
  };

  // Store structured data with the rendered calculator so report capture also works in workspace iframes.
  const reportData = () => ({
    inputs: {
      mode, program: PROGRAMS[inputs.program], homeValue: result.loan.propertyValue,
      downPayment: mode === 'purchase' ? inputs.downPayment : 0,
      downPct: mode === 'purchase' ? inputs.downPayment / inputs.homePrice * 100 : 0,
      loanAmount: result.loan.principal, rate: inputs.annualRate * 100, term: inputs.termYears,
      taxYr: inputs.monthlyTax * 12, insYr: inputs.monthlyIns * 12, monthlyHOA: inputs.monthlyHOA,
      monthlyPMI: result.schedule[0].pmiThisMonth, upfrontFee: result.loan.upfrontFee,
      extraAmount: inputs.extraAmount, extraFreq: inputs.extraFreq, extraStartMonth: inputs.extraStartMonth, extraStartYear: inputs.extraStartYear
    },
    results: {
      monthlyPI: money(result.monthlyPI), totalMonthly: $('resultTotalMonthly').textContent,
      monthlyDetail: $('resultMonthlyDetail').textContent,
      totalInterest: result.totalInterest, totalPrincipal: result.loan.principal - result.totalExtra, totalExtra: result.totalExtra,
      totalCost: money(result.totalCost), payoffDate: $('resultPayoffDate').textContent,
      interestSaved: money(result.interestSaved), timeSaved: $('resultTimeSaved').textContent
    },
    chartImage: balanceChart ? balanceChart.toBase64Image() : '',
    schedule: result.schedule.map(row => ({ num: row.paymentNum, date: row.date, payment: row.payment, principal: row.principal, interest: row.interest, extra: row.extra, balance: row.balance })),
    yearlySummary: Array.from(new Set(result.schedule.map(row => row.year))).map(year => {
      const rows = result.schedule.filter(row => row.year === year);
      const sum = key => rows.reduce((total, row) => total + row[key], 0);
      return { year: String(year), principal: sum('principal'), interest: sum('interest'), extra: sum('extra'), payments: sum('payment'), count: rows.length };
    })
  });

  const calculate = () => {
    updateProgramFields();
    inputs = readInputs();
    const error = validate();
    result = error ? null : MSFG.AmortizationMath.calculate(inputs);
    $('amortError').hidden = Boolean(result);
    setText('amortError', error || (result ? '' : 'Enter a positive loan amount and property value to calculate your mortgage.'));
    $('amortOutput').hidden = !result;
    delete $('amortOutput').dataset.amortReport;
    if (!result) return;
    renderSummary();
    renderSchedule();
    renderBreakdown();
    renderBalanceChart();
    renderSteps();
    $('amortOutput').dataset.amortReport = JSON.stringify(reportData());
  };

  const exportCSV = () => {
    if (!result) return;
    const headers = ['Payment #', 'Date', 'P&I + Extra', 'Principal', 'Interest', 'Extra', 'Balance', 'Property Tax', 'Insurance', 'HOA', 'PMI/MIP', 'Total Payment'];
    const keys = ['payment', 'principal', 'interest', 'extra', 'balance', 'monthlyTax', 'monthlyIns', 'monthlyHOA', 'pmiThisMonth', 'totalMonthly'];
    const csv = [headers.join(',')].concat(result.schedule.map(row => [row.paymentNum, row.date].concat(keys.map(key => row[key].toFixed(2))).join(','))).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'msfg-amortization-schedule.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  document.addEventListener('DOMContentLoaded', () => {
    populateDates();
    $('amortForm').addEventListener('submit', event => event.preventDefault());
    const onInput = event => {
      const id = event.target.id;
      if (['homePrice', 'downPaymentDollar', 'downPaymentPercent'].includes(id)) syncDownPayment(id);
      if (id === 'pmi') pmiEdited = true;
      if (id === 'extraStartMonth' || id === 'extraStartYear') extraDateEdited = true;
      if ((id === 'startMonth' || id === 'startYear') && !extraDateEdited) {
        $('extraStartMonth').value = $('startMonth').value;
        $('extraStartYear').value = $('startYear').value;
      }
      if (id === 'propertyTax' || id === 'homeInsurance') delete event.target.dataset.annualValue;
      calculate();
    };
    $('amortForm').addEventListener('input', onInput);
    $('amortForm').addEventListener('change', onInput);
    $('breakdownMonth').addEventListener('input', renderBreakdown);
    document.querySelector('.amort-balance-panel').addEventListener('toggle', renderBalanceChart);
    document.querySelector('.amort-page').addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'set-mode') {
        if (mode === button.dataset.mode) return;
        if (button.dataset.mode === 'refinance' && !refiInitialized) {
          $('refiLoanAmount').value = Math.max(0, number('homePrice') - number('downPaymentDollar'));
          $('appraisedValue').value = number('homePrice');
          refiInitialized = true;
        }
        mode = button.dataset.mode;
        $('modeToggle').querySelectorAll('button').forEach(el => {
          el.classList.toggle('active', el === button);
          el.setAttribute('aria-pressed', String(el === button));
        });
        calculate();
      } else if (action === 'set-period') {
        const group = button.closest('[data-field]');
        const field = $(group.dataset.field);
        if (field.dataset.period === button.dataset.period) return;
        const annual = field.dataset.annualValue === undefined ? Number(field.value) * (field.dataset.period === 'monthly' ? 12 : 1) : Number(field.dataset.annualValue);
        field.dataset.annualValue = annual;
        field.value = Number((button.dataset.period === 'monthly' ? annual / 12 : annual).toFixed(8));
        field.dataset.period = button.dataset.period;
        group.querySelectorAll('button').forEach(el => { el.classList.toggle('active', el === button); el.setAttribute('aria-pressed', String(el === button)); });
        calculate();
      } else if (action === 'toggle-year') {
        const year = Number(button.dataset.year);
        if (expandedYears.has(year)) expandedYears.delete(year); else expandedYears.add(year);
        button.setAttribute('aria-expanded', String(expandedYears.has(year)));
        document.querySelectorAll(`.amort-month-row[data-year="${year}"]`).forEach(row => { row.hidden = !expandedYears.has(year); });
        updateExpandButton();
      } else if (action === 'expand-schedule') {
        expandedYears = button.getAttribute('aria-expanded') === 'true' ? new Set() : new Set(result.schedule.map(row => row.schedYear));
        renderSchedule();
        renderBreakdown();
      } else if (action === 'export-amort') exportCSV();
      else if (action === 'reset-amort') {
        $('amortForm').reset();
        mode = 'purchase'; refiInitialized = false; pmiEdited = false; extraDateEdited = false;
        expandedYears = new Set([1]);
        populateDates();
        $('modeToggle').querySelectorAll('button').forEach(el => { const active = el.dataset.mode === mode; el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active)); });
        document.querySelectorAll('.amort-period').forEach(group => {
          const field = $(group.dataset.field);
          field.dataset.period = 'annual';
          delete field.dataset.annualValue;
          group.querySelectorAll('button').forEach(el => { const active = el.dataset.period === 'annual'; el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active)); });
        });
        $('breakdownMonth').value = 1;
        calculate();
      }
    });
    if (MSFG.CalcActions) MSFG.CalcActions.register(() => ({
      title: 'Amortization Calculator',
      sections: result ? [{ heading: `${PROGRAMS[inputs.program]} · ${mode === 'purchase' ? 'Purchase' : 'Refinance'}`, rows: [
        { label: 'Loan amount', value: money(result.loan.principal) },
        { label: 'Rate / term', value: `${(inputs.annualRate * 100).toFixed(3)}% / ${inputs.termYears} years` },
        { label: 'Monthly principal & interest', value: money(result.monthlyPI) },
        { label: 'First total monthly payment', value: $('resultTotalMonthly').textContent },
        { label: 'Total interest', value: money(result.totalInterest) },
        { label: 'Total payments', value: money(result.totalCost) },
        { label: 'Payoff date', value: $('resultPayoffDate').textContent },
        { label: 'Interest saved', value: money(result.interestSaved) }
      ] }] : [{ heading: 'No valid estimate', rows: [{ label: 'Input needed', value: $('amortError').textContent }] }]
    }));
    calculate();
  });
})();
