/* Report templates: refi, cash-vs-mortgage, buy-vs-rent, amortization */
(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;
  var h = RT.helpers;
  var val = h.val, txt = h.txt, fmt = h.fmt, fmt0 = h.fmt0, pct = h.pct, ratePct = h.ratePct;
  var pdfKeyValue = h.pdfKeyValue;

  /* ---- Cash vs Mortgage ---- */
  RT.register('cash-vs-mortgage', function (doc) {
    return {
      inputs: {
        price: val(doc,'priceCash'), closingCash: val(doc,'closingCash'),
        closingMort: val(doc,'closingMortgage'), downPct: val(doc,'downPct'),
        rate: val(doc,'mortRate'), term: val(doc,'mortTerm'),
        investReturn: val(doc,'investReturn'), appreciation: val(doc,'appreciation'),
        period: val(doc,'periodCash')
      },
      results: {
        costCash: txt(doc,'costCash'), costMortgage: txt(doc,'costMortgage'),
        difference: txt(doc,'diffCashMort'),
        recommendation: txt(doc,'recommendation')
      },
      breakdown: {
        cash: {
          purchasePrice: txt(doc,'cashPurchasePrice'), closingCosts: txt(doc,'cashClosingCosts'),
          appreciation: txt(doc,'cashAppreciation'), total: txt(doc,'cashTotal')
        },
        mortgage: {
          downPayment: txt(doc,'mortDownPayment'), closingCosts: txt(doc,'mortClosingCosts'),
          payments: txt(doc,'mortPayments'), investmentBalance: txt(doc,'mortInvestmentBalance'),
          remainingBalance: txt(doc,'mortRemainingBalance'), investmentGrowth: txt(doc,'mortInvestmentGrowth'),
          appreciation: txt(doc,'mortAppreciation'), total: txt(doc,'mortTotal')
        }
      }
    };
  }, function (data) {
    var inp = data.inputs;
    var brk = data.breakdown;
    var down = inp.price * inp.downPct / 100;
    var loan = inp.price - down;
    var html = '';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Scenario Parameters</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Purchase Price</span><span>' + fmt0(inp.price) + '</span></div>';
    html += '<div class="rpt-param"><span>Down Payment</span><span>' + pct(inp.downPct) + ' (' + fmt0(down) + ')</span></div>';
    html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt0(loan) + '</span></div>';
    html += '<div class="rpt-param"><span>Interest Rate</span><span>' + ratePct(inp.rate) + '</span></div>';
    html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.term + ' years</span></div>';
    html += '<div class="rpt-param"><span>Expected Investment Return</span><span>' + pct(inp.investReturn) + '</span></div>';
    html += '<div class="rpt-param"><span>Annual Property Appreciation</span><span>' + pct(inp.appreciation) + '</span></div>';
    html += '<div class="rpt-param"><span>Analysis Period</span><span>' + inp.period + ' years</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Cost Comparison</h4>';
    html += '<div class="rpt-comparison">';
    html += '<div class="rpt-compare-col"><h4>Cash Purchase</h4>';
    html += '<table class="rpt-table"><tbody>';
    html += '<tr><td>Purchase Price</td><td class="rpt-num">' + brk.cash.purchasePrice + '</td></tr>';
    html += '<tr><td>Closing Costs</td><td class="rpt-num">' + brk.cash.closingCosts + '</td></tr>';
    html += '<tr><td>Property Appreciation</td><td class="rpt-num">' + brk.cash.appreciation + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Net Cost</span><span>' + brk.cash.total + '</span></div>';
    html += '</div>';

    html += '<div class="rpt-compare-col"><h4>Mortgage Purchase</h4>';
    html += '<table class="rpt-table"><tbody>';
    html += '<tr><td>Down Payment</td><td class="rpt-num">' + brk.mortgage.downPayment + '</td></tr>';
    html += '<tr><td>Closing Costs</td><td class="rpt-num">' + brk.mortgage.closingCosts + '</td></tr>';
    html += '<tr><td>Total Mortgage Payments</td><td class="rpt-num">' + brk.mortgage.payments + '</td></tr>';
    html += '<tr><td>Investment Balance (end of term)</td><td class="rpt-num">' + brk.mortgage.investmentBalance + '</td></tr>';
    html += '<tr><td>Remaining Mortgage Balance</td><td class="rpt-num">' + brk.mortgage.remainingBalance + '</td></tr>';
    html += '<tr><td>Net Investment Benefit</td><td class="rpt-num">' + brk.mortgage.investmentGrowth + '</td></tr>';
    html += '<tr><td>Property Appreciation</td><td class="rpt-num">' + brk.mortgage.appreciation + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Net Cost</span><span>' + brk.mortgage.total + '</span></div>';
    html += '</div></div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Analysis</h4>';
    html += '<div class="rpt-recommendation"><span>Recommendation:</span> ' + data.results.recommendation + '</div>';
    html += '<div class="rpt-difference">Net Savings: ' + data.results.difference + '</div>';
    html += '</div>';
    return html;
  }, function (data) {
    var inp = data.inputs; var brk = data.breakdown; var res = data.results;
    return pdfKeyValue(data,
      [['Purchase Price', fmt0(inp.price)], ['Down Payment', pct(inp.downPct)], ['Rate', ratePct(inp.rate)], ['Term', inp.term + ' yrs'], ['Investment Return', pct(inp.investReturn)], ['Appreciation', pct(inp.appreciation)], ['Period', inp.period + ' yrs']],
      [['Cash Net Cost', brk.cash.total], ['Mortgage Net Cost', brk.mortgage.total], ['Difference', res.difference]],
      'Recommendation', null
    ).concat([{ text: res.recommendation, bold: true, fontSize: 11, color: '#2d6a4f', margin: [0, 8, 0, 0] }]);
  });

  /* ---- Buy vs Rent ---- */
  RT.register('buy-vs-rent', function (doc) {
    return {
      inputs: {
        price: val(doc,'purchasePrice'), downPct: val(doc,'downPercent'),
        rate: val(doc,'rateBuy'), term: val(doc,'termBuy'),
        taxRate: val(doc,'taxRate'), insurance: val(doc,'insurance'),
        maintenance: val(doc,'maintenance'), appreciation: val(doc,'appreciation'),
        rent: val(doc,'rent'), rentIncrease: val(doc,'rentIncrease'),
        period: val(doc,'period'), investReturn: val(doc,'investmentReturn')
      },
      results: {
        monthlyPayment: txt(doc,'mortgagePay'), ownCost: txt(doc,'ownCost'),
        rentCost: txt(doc,'rentCost'), equity: txt(doc,'equity'),
        difference: txt(doc,'difference'), recommendation: txt(doc,'recommendationText')
      }
    };
  }, function (data) {
    var inp = data.inputs; var res = data.results;
    var down = inp.price * inp.downPct / 100;
    var html = '';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Scenario Parameters</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Purchase Price</span><span>' + fmt0(inp.price) + '</span></div>';
    html += '<div class="rpt-param"><span>Down Payment</span><span>' + pct(inp.downPct) + ' (' + fmt0(down) + ')</span></div>';
    html += '<div class="rpt-param"><span>Interest Rate</span><span>' + ratePct(inp.rate) + '</span></div>';
    html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.term + ' years</span></div>';
    html += '<div class="rpt-param"><span>Property Tax Rate</span><span>' + pct(inp.taxRate) + '</span></div>';
    html += '<div class="rpt-param"><span>Home Appreciation</span><span>' + pct(inp.appreciation) + '</span></div>';
    html += '<div class="rpt-param"><span>Current Monthly Rent</span><span>' + fmt0(inp.rent) + '</span></div>';
    html += '<div class="rpt-param"><span>Rent Increase Rate</span><span>' + pct(inp.rentIncrease) + '</span></div>';
    html += '<div class="rpt-param"><span>Analysis Period</span><span>' + inp.period + ' years</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Cost Comparison</h4>';
    html += '<div class="rpt-comparison"><div class="rpt-compare-col">';
    html += '<h4>Buying</h4>';
    html += '<table class="rpt-table"><tbody>';
    html += '<tr><td>Monthly Mortgage Payment</td><td class="rpt-num">' + res.monthlyPayment + '</td></tr>';
    html += '<tr><td>Total Ownership Cost</td><td class="rpt-num">' + res.ownCost + '</td></tr>';
    html += '<tr><td>Net Equity at Sale</td><td class="rpt-num">' + res.equity + '</td></tr>';
    html += '</tbody></table>';
    html += '</div><div class="rpt-compare-col">';
    html += '<h4>Renting</h4>';
    html += '<table class="rpt-table"><tbody>';
    html += '<tr><td>Total Rent Paid</td><td class="rpt-num">' + res.rentCost + '</td></tr>';
    html += '</tbody></table>';
    html += '</div></div>';
    html += '<div class="rpt-grand-total"><span>Financial Impact</span><span>' + res.difference + '</span></div>';
    html += '</div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Analysis</h4>';
    html += '<div class="rpt-recommendation"><span>Recommendation:</span> ' + (res.recommendation || '') + '</div>';
    html += '</div>';
    return html;
  }, function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Purchase Price', fmt0(inp.price)], ['Down Payment', pct(inp.downPct)], ['Rate', ratePct(inp.rate)], ['Rent', fmt0(inp.rent) + '/mo'], ['Period', inp.period + ' yrs']],
      [['Monthly Payment', res.monthlyPayment], ['Total Own Cost', res.ownCost], ['Total Rent Cost', res.rentCost], ['Net Equity', res.equity], ['Difference', res.difference]]
    ).concat(res.recommendation ? [{ text: res.recommendation, bold: true, fontSize: 11, color: '#2d6a4f', margin: [0, 8, 0, 0] }] : []);
  });

  /* ---- Refi ---- */
  RT.register('refi', function (doc) {
    var cowSection = doc.getElementById('costOfWaitingResults');
    var cowVisible = cowSection && cowSection.style.display !== 'none';
    var drSection = doc.getElementById('doubleRefiResults');
    var drVisible = drSection && drSection.style.display !== 'none';

    var data = {
      inputs: {
        currentBalance: val(doc,'currentBalance'), currentRate: val(doc,'currentRate'),
        remainingTerm: val(doc,'currentTermRemaining'), propertyValue: val(doc,'currentPropertyValue'),
        currentLoanType: txt(doc,'currentLoanType'),
        newAmount: val(doc,'refiLoanAmount'), newRate: val(doc,'refiRate'), newTerm: val(doc,'refiTerm'),
        refiLoanType: txt(doc,'refiLoanType'),
        futureRate: val(doc,'futureRate'), monthsToWait: val(doc,'monthsToWait'),
        planToStay: val(doc,'planToStayMonths'), targetBreakeven: val(doc,'targetBreakeven')
      },
      refiNow: {
        currentPayment: txt(doc,'compareCurrentPayment'), newPayment: txt(doc,'compareNewPayment'),
        monthlySavings: txt(doc,'resultMonthlySavings'), breakeven: txt(doc,'resultBreakevenNow'),
        totalClosingCosts: txt(doc,'resultTotalClosingCost'), netSavings: txt(doc,'resultNetSavings')
      },
      recommendation: txt(doc,'adviceHeadline'),
      adviceDetail: txt(doc,'adviceDetail')
    };

    if (cowVisible) {
      data.costOfWaiting = {
        extraInterest: txt(doc,'resultExtraInterest'),
        futurePayment: txt(doc,'resultFuturePayment'),
        futureSavings: txt(doc,'resultFutureSavings'),
        breakevenWait: txt(doc,'resultBreakevenWait'),
        nowCosts: txt(doc,'breakdownNowCosts'),
        nowSavings: txt(doc,'breakdownNowSavings'),
        nowBreakeven: txt(doc,'breakdownNowBreakeven'),
        nowNet: txt(doc,'breakdownNowNet'),
        waitCosts: txt(doc,'breakdownWaitCosts'),
        waitExtra: txt(doc,'breakdownWaitExtra'),
        waitEffective: txt(doc,'breakdownWaitEffective'),
        waitSavings: txt(doc,'breakdownWaitSavings'),
        waitBreakeven: txt(doc,'breakdownWaitBreakeven'),
        waitNet: txt(doc,'breakdownWaitNet'),
        difference: txt(doc,'resultDifference'),
        differenceExplain: txt(doc,'differenceExplain')
      };
    }

    if (drVisible) {
      data.doubleRefi = {
        phase1Savings: txt(doc,'resultDoubleRefiPhase1Savings'),
        phase1Detail: txt(doc,'resultDoubleRefiPhase1Detail'),
        phase2Payment: txt(doc,'resultDoubleRefiPhase2Payment'),
        phase2Detail: txt(doc,'resultDoubleRefiPhase2Detail'),
        totalCosts: txt(doc,'resultDoubleRefiTotalCosts'),
        breakeven: txt(doc,'resultDoubleRefiBreakeven'),
        compare3NowCosts: txt(doc,'compare3NowCosts'),
        compare3NowSavings: txt(doc,'compare3NowSavings'),
        compare3NowNet: txt(doc,'compare3NowNet'),
        compare3DoubleCosts: txt(doc,'compare3DoubleCosts'),
        compare3DoublePhase1: txt(doc,'compare3DoublePhase1'),
        compare3DoublePhase2: txt(doc,'compare3DoublePhase2'),
        compare3DoubleNet: txt(doc,'compare3DoubleNet'),
        compare3WaitCosts: txt(doc,'compare3WaitCosts'),
        compare3WaitSavings: txt(doc,'compare3WaitSavings'),
        compare3WaitNet: txt(doc,'compare3WaitNet'),
        bestStrategy: txt(doc,'doubleRefiBestLabel'),
        bestExplain: txt(doc,'doubleRefiBestExplain')
      };
    }

    var bullets = [];
    var bulletEls = doc.querySelectorAll('#adviceBullets li');
    bulletEls.forEach(function (li) {
      bullets.push({ text: li.textContent.trim(), type: li.classList.contains('con') ? 'con' : li.classList.contains('neutral-point') ? 'neutral' : 'pro' });
    });
    data.adviceBullets = bullets;

    data.results = {
      currentPayment: data.refiNow.currentPayment, newPayment: data.refiNow.newPayment,
      monthlySavings: data.refiNow.monthlySavings, breakeven: data.refiNow.breakeven,
      totalClosingCosts: data.refiNow.totalClosingCosts, netSavings: data.refiNow.netSavings,
      recommendation: data.recommendation
    };

    return data;
  }, function (data) {
    var inp = data.inputs;
    var now = data.refiNow || data.results || {};
    var html = '';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Comparison</h4>';
    html += '<div class="rpt-comparison"><div class="rpt-compare-col"><h4>Current Loan</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Balance</span><span>' + fmt0(inp.currentBalance) + '</span></div>';
    html += '<div class="rpt-param"><span>Rate</span><span>' + ratePct(inp.currentRate) + '</span></div>';
    if (inp.currentLoanType) html += '<div class="rpt-param"><span>Loan Type</span><span>' + inp.currentLoanType + '</span></div>';
    if (inp.remainingTerm) html += '<div class="rpt-param"><span>Remaining Term</span><span>' + inp.remainingTerm + ' mo</span></div>';
    if (inp.propertyValue) html += '<div class="rpt-param"><span>Property Value</span><span>' + fmt0(inp.propertyValue) + '</span></div>';
    html += '<div class="rpt-param" style="font-weight:600"><span>Monthly Payment</span><span>' + (now.currentPayment || '') + '</span></div>';
    html += '</div></div>';
    html += '<div class="rpt-compare-col"><h4>Refinance Offer</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>New Amount</span><span>' + fmt0(inp.newAmount) + '</span></div>';
    html += '<div class="rpt-param"><span>New Rate</span><span>' + ratePct(inp.newRate) + '</span></div>';
    if (inp.refiLoanType) html += '<div class="rpt-param"><span>Loan Type</span><span>' + inp.refiLoanType + '</span></div>';
    if (inp.newTerm) html += '<div class="rpt-param"><span>New Term</span><span>' + inp.newTerm + ' mo</span></div>';
    html += '<div class="rpt-param" style="font-weight:600"><span>Monthly Payment</span><span>' + (now.newPayment || '') + '</span></div>';
    html += '</div></div></div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Refinance Now</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Metric</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    html += '<tr><td>Monthly Savings</td><td class="rpt-num">' + (now.monthlySavings || '') + '</td></tr>';
    html += '<tr><td>Total Closing Costs</td><td class="rpt-num">' + (now.totalClosingCosts || '') + '</td></tr>';
    html += '<tr><td>Breakeven Point</td><td class="rpt-num">' + (now.breakeven || '') + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Net Savings (Stay Period)</span><span>' + (now.netSavings || '') + '</span></div>';
    html += '</div>';

    if (data.costOfWaiting) {
      var cow = data.costOfWaiting;
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Cost of Waiting</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Metric</th><th class="rpt-num">Value</th></tr></thead><tbody>';
      if (inp.futureRate) html += '<tr><td>Expected Future Rate</td><td class="rpt-num">' + ratePct(inp.futureRate) + '</td></tr>';
      if (inp.monthsToWait) html += '<tr><td>Months Until Future Rate</td><td class="rpt-num">' + inp.monthsToWait + ' mo</td></tr>';
      html += '<tr><td>Extra Interest While Waiting</td><td class="rpt-num">' + cow.extraInterest + '</td></tr>';
      html += '<tr><td>Future Monthly Payment</td><td class="rpt-num">' + cow.futurePayment + '</td></tr>';
      html += '<tr><td>Future Monthly Savings</td><td class="rpt-num">' + cow.futureSavings + '</td></tr>';
      html += '<tr><td>Breakeven (If You Wait)</td><td class="rpt-num">' + cow.breakevenWait + '</td></tr>';
      html += '</tbody></table>';

      html += '<div class="rpt-comparison" style="margin-top:0.75rem;">';
      html += '<div class="rpt-compare-col"><h4>Refi Now</h4>';
      html += '<div class="rpt-params">';
      if (cow.nowCosts) html += '<div class="rpt-param"><span>Closing Costs</span><span>' + cow.nowCosts + '</span></div>';
      if (cow.nowSavings) html += '<div class="rpt-param"><span>Monthly Savings</span><span>' + cow.nowSavings + '</span></div>';
      if (cow.nowBreakeven) html += '<div class="rpt-param"><span>Breakeven</span><span>' + cow.nowBreakeven + '</span></div>';
      if (cow.nowNet) html += '<div class="rpt-param" style="font-weight:600"><span>Net Savings</span><span>' + cow.nowNet + '</span></div>';
      html += '</div></div>';
      html += '<div class="rpt-compare-col"><h4>Wait & Refi Later</h4>';
      html += '<div class="rpt-params">';
      if (cow.waitCosts) html += '<div class="rpt-param"><span>Closing Costs</span><span>' + cow.waitCosts + '</span></div>';
      if (cow.waitExtra) html += '<div class="rpt-param"><span>Extra Interest</span><span>' + cow.waitExtra + '</span></div>';
      if (cow.waitEffective) html += '<div class="rpt-param"><span>Effective Cost</span><span>' + cow.waitEffective + '</span></div>';
      if (cow.waitSavings) html += '<div class="rpt-param"><span>Monthly Savings</span><span>' + cow.waitSavings + '</span></div>';
      if (cow.waitBreakeven) html += '<div class="rpt-param"><span>Breakeven</span><span>' + cow.waitBreakeven + '</span></div>';
      if (cow.waitNet) html += '<div class="rpt-param" style="font-weight:600"><span>Net Savings</span><span>' + cow.waitNet + '</span></div>';
      html += '</div></div></div>';

      if (cow.difference) {
        html += '<div class="rpt-grand-total"><span>Net Difference</span><span>' + cow.difference + '</span></div>';
      }
      html += '</div>';
    }

    if (data.doubleRefi) {
      var dr = data.doubleRefi;
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Refi Twice Strategy</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Metric</th><th class="rpt-num">Value</th></tr></thead><tbody>';
      html += '<tr><td>Phase 1 Savings</td><td class="rpt-num">' + dr.phase1Savings + '</td></tr>';
      if (dr.phase1Detail) html += '<tr><td colspan="2" style="font-size:0.85em;color:#666;padding-left:1.5rem">' + dr.phase1Detail + '</td></tr>';
      html += '<tr><td>Phase 2 Payment</td><td class="rpt-num">' + dr.phase2Payment + '</td></tr>';
      if (dr.phase2Detail) html += '<tr><td colspan="2" style="font-size:0.85em;color:#666;padding-left:1.5rem">' + dr.phase2Detail + '</td></tr>';
      html += '<tr><td>Total Costs (2 Refis)</td><td class="rpt-num">' + dr.totalCosts + '</td></tr>';
      html += '<tr><td>Combined Breakeven</td><td class="rpt-num">' + dr.breakeven + '</td></tr>';
      html += '</tbody></table>';

      html += '<div class="rpt-comparison" style="margin-top:0.75rem;">';
      html += '<div class="rpt-compare-col"><h4>Refi Now Only</h4><div class="rpt-params">';
      if (dr.compare3NowCosts) html += '<div class="rpt-param"><span>Costs</span><span>' + dr.compare3NowCosts + '</span></div>';
      if (dr.compare3NowSavings) html += '<div class="rpt-param"><span>Savings</span><span>' + dr.compare3NowSavings + '</span></div>';
      if (dr.compare3NowNet) html += '<div class="rpt-param" style="font-weight:600"><span>Net</span><span>' + dr.compare3NowNet + '</span></div>';
      html += '</div></div>';
      html += '<div class="rpt-compare-col"><h4>Refi Twice</h4><div class="rpt-params">';
      if (dr.compare3DoubleCosts) html += '<div class="rpt-param"><span>Total Costs</span><span>' + dr.compare3DoubleCosts + '</span></div>';
      if (dr.compare3DoublePhase1) html += '<div class="rpt-param"><span>Phase 1 Svgs</span><span>' + dr.compare3DoublePhase1 + '</span></div>';
      if (dr.compare3DoublePhase2) html += '<div class="rpt-param"><span>Phase 2 Svgs</span><span>' + dr.compare3DoublePhase2 + '</span></div>';
      if (dr.compare3DoubleNet) html += '<div class="rpt-param" style="font-weight:600"><span>Net</span><span>' + dr.compare3DoubleNet + '</span></div>';
      html += '</div></div>';
      html += '<div class="rpt-compare-col"><h4>Wait & Refi Once</h4><div class="rpt-params">';
      if (dr.compare3WaitCosts) html += '<div class="rpt-param"><span>Eff. Cost</span><span>' + dr.compare3WaitCosts + '</span></div>';
      if (dr.compare3WaitSavings) html += '<div class="rpt-param"><span>Savings</span><span>' + dr.compare3WaitSavings + '</span></div>';
      if (dr.compare3WaitNet) html += '<div class="rpt-param" style="font-weight:600"><span>Net</span><span>' + dr.compare3WaitNet + '</span></div>';
      html += '</div></div></div>';

      if (dr.bestStrategy) {
        html += '<div class="rpt-grand-total"><span>Best Strategy</span><span>' + dr.bestStrategy + '</span></div>';
      }
      html += '</div>';
    }

    if (data.recommendation) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Recommendation</h4>';
      html += '<div class="rpt-recommendation"><span>' + data.recommendation + '</span></div>';
      if (data.adviceDetail) html += '<p style="margin:0.25rem 0 0;font-size:0.85em;color:#555">' + data.adviceDetail + '</p>';
      if (data.adviceBullets && data.adviceBullets.length) {
        html += '<ul style="margin:0.5rem 0 0;padding-left:1.25rem;font-size:0.85em">';
        data.adviceBullets.forEach(function (b) {
          var icon = b.type === 'pro' ? '✓' : b.type === 'con' ? '✗' : '•';
          var color = b.type === 'pro' ? '#2d6a4f' : b.type === 'con' ? '#c0392b' : '#666';
          html += '<li style="color:' + color + '">' + icon + ' ' + b.text + '</li>';
        });
        html += '</ul>';
      }
      html += '</div>';
    }
    return html;
  }, function (data) {
    var inp = data.inputs;
    var now = data.refiNow || data.results || {};
    var content = [];

    var loanParams = [
      ['', 'Current Loan', 'Refinance Offer'],
      ['Balance / Amount', fmt0(inp.currentBalance), fmt0(inp.newAmount)],
      ['Rate', ratePct(inp.currentRate), ratePct(inp.newRate)]
    ];
    if (inp.currentLoanType || inp.refiLoanType) loanParams.push(['Loan Type', inp.currentLoanType || '—', inp.refiLoanType || '—']);
    if (inp.remainingTerm || inp.newTerm) loanParams.push(['Term', (inp.remainingTerm || '—') + ' mo', (inp.newTerm || '—') + ' mo']);
    loanParams.push(['Monthly Payment', now.currentPayment || '—', now.newPayment || '—']);

    var loanBody = loanParams.map(function (r, i) {
      if (i === 0) return [{ text: r[0], style: 'tableHeader' }, { text: r[1], style: 'tableHeader', alignment: 'center' }, { text: r[2], style: 'tableHeader', alignment: 'center' }];
      return [r[0], { text: r[1], alignment: 'right' }, { text: r[2], alignment: 'right' }];
    });
    content.push({ table: { headerRows: 1, widths: ['*', 120, 120], body: loanBody }, layout: 'lightHorizontalLines' });

    content.push({ text: 'Refinance Now', style: 'sectionTitle', margin: [0, 10, 0, 4] });
    var nowBody = [
      [{ text: 'Metric', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }],
      ['Monthly Savings', { text: now.monthlySavings || '', alignment: 'right' }],
      ['Total Closing Costs', { text: now.totalClosingCosts || '', alignment: 'right' }],
      ['Breakeven Point', { text: now.breakeven || '', alignment: 'right' }],
      [{ text: 'Net Savings (Stay Period)', bold: true }, { text: now.netSavings || '', alignment: 'right', bold: true }]
    ];
    content.push({ table: { headerRows: 1, widths: ['*', 120], body: nowBody }, layout: 'lightHorizontalLines' });

    if (data.costOfWaiting) {
      var cow = data.costOfWaiting;
      content.push({ text: 'Cost of Waiting', style: 'sectionTitle', margin: [0, 10, 0, 4] });
      var cowBody = [
        [{ text: 'Metric', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }]
      ];
      if (inp.futureRate) cowBody.push(['Expected Future Rate', { text: ratePct(inp.futureRate), alignment: 'right' }]);
      if (inp.monthsToWait) cowBody.push(['Months Until Future Rate', { text: inp.monthsToWait + ' mo', alignment: 'right' }]);
      cowBody.push(['Extra Interest While Waiting', { text: cow.extraInterest, alignment: 'right' }]);
      cowBody.push(['Future Monthly Payment', { text: cow.futurePayment, alignment: 'right' }]);
      cowBody.push(['Future Monthly Savings', { text: cow.futureSavings, alignment: 'right' }]);
      cowBody.push(['Breakeven (If You Wait)', { text: cow.breakevenWait, alignment: 'right' }]);
      content.push({ table: { headerRows: 1, widths: ['*', 120], body: cowBody }, layout: 'lightHorizontalLines' });

      var cmpBody = [
        [{ text: '', style: 'tableHeader' }, { text: 'Refi Now', style: 'tableHeader', alignment: 'center' }, { text: 'Wait & Refi', style: 'tableHeader', alignment: 'center' }]
      ];
      if (cow.nowCosts || cow.waitCosts) cmpBody.push(['Closing Costs', { text: cow.nowCosts || '—', alignment: 'right' }, { text: cow.waitEffective || cow.waitCosts || '—', alignment: 'right' }]);
      if (cow.nowSavings || cow.waitSavings) cmpBody.push(['Monthly Savings', { text: cow.nowSavings || '—', alignment: 'right' }, { text: cow.waitSavings || '—', alignment: 'right' }]);
      if (cow.nowBreakeven || cow.waitBreakeven) cmpBody.push(['Breakeven', { text: cow.nowBreakeven || '—', alignment: 'right' }, { text: cow.waitBreakeven || '—', alignment: 'right' }]);
      if (cow.nowNet || cow.waitNet) cmpBody.push([{ text: 'Net Savings', bold: true }, { text: cow.nowNet || '—', alignment: 'right', bold: true }, { text: cow.waitNet || '—', alignment: 'right', bold: true }]);
      if (cmpBody.length > 1) content.push({ table: { headerRows: 1, widths: ['*', 110, 110], body: cmpBody }, layout: 'lightHorizontalLines', margin: [0, 6, 0, 0] });

      if (cow.difference) {
        content.push({ columns: [{ text: 'Net Difference', bold: true, fontSize: 11, color: '#2d6a4f' }, { text: cow.difference, alignment: 'right', bold: true, fontSize: 11, color: '#2d6a4f' }], margin: [0, 6, 0, 0] });
      }
    }

    if (data.doubleRefi) {
      var dr = data.doubleRefi;
      content.push({ text: 'Refi Twice Strategy', style: 'sectionTitle', margin: [0, 10, 0, 4] });
      var drBody = [
        [{ text: 'Metric', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }],
        ['Phase 1 Savings', { text: dr.phase1Savings, alignment: 'right' }],
        ['Phase 2 Payment', { text: dr.phase2Payment, alignment: 'right' }],
        ['Total Costs (2 Refis)', { text: dr.totalCosts, alignment: 'right' }],
        ['Combined Breakeven', { text: dr.breakeven, alignment: 'right' }]
      ];
      content.push({ table: { headerRows: 1, widths: ['*', 120], body: drBody }, layout: 'lightHorizontalLines' });

      var triBody = [
        [{ text: '', style: 'tableHeader' }, { text: 'Refi Now', style: 'tableHeader', alignment: 'center' }, { text: 'Refi Twice', style: 'tableHeader', alignment: 'center' }, { text: 'Wait & Refi', style: 'tableHeader', alignment: 'center' }]
      ];
      triBody.push(['Costs', { text: dr.compare3NowCosts || '—', alignment: 'right' }, { text: dr.compare3DoubleCosts || '—', alignment: 'right' }, { text: dr.compare3WaitCosts || '—', alignment: 'right' }]);
      triBody.push([{ text: 'Net Savings', bold: true }, { text: dr.compare3NowNet || '—', alignment: 'right', bold: true }, { text: dr.compare3DoubleNet || '—', alignment: 'right', bold: true }, { text: dr.compare3WaitNet || '—', alignment: 'right', bold: true }]);
      content.push({ table: { headerRows: 1, widths: ['*', 90, 90, 90], body: triBody }, layout: 'lightHorizontalLines', margin: [0, 6, 0, 0] });

      if (dr.bestStrategy) {
        content.push({ columns: [{ text: 'Best Strategy', bold: true, fontSize: 11, color: '#2d6a4f' }, { text: dr.bestStrategy, alignment: 'right', bold: true, fontSize: 11, color: '#2d6a4f' }], margin: [0, 6, 0, 0] });
      }
    }

    if (data.recommendation) {
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#2d6a4f' }], margin: [0, 10, 0, 4] });
      content.push({ text: data.recommendation, bold: true, fontSize: 11, color: '#2d6a4f', margin: [0, 4, 0, 0] });
      if (data.adviceDetail) content.push({ text: data.adviceDetail, fontSize: 9, color: '#555', margin: [0, 2, 0, 0] });
      if (data.adviceBullets && data.adviceBullets.length) {
        var bulletList = data.adviceBullets.map(function (b) {
          var icon = b.type === 'pro' ? '✓ ' : b.type === 'con' ? '✗ ' : '• ';
          return { text: icon + b.text, fontSize: 9, color: b.type === 'pro' ? '#2d6a4f' : b.type === 'con' ? '#c0392b' : '#555' };
        });
        content.push({ ul: bulletList, margin: [0, 4, 0, 0] });
      }
    }
    return content;
  });

  /* ---- Amortization ---- */
  RT.register('amortization', function (doc) {
    var homeValue = val(doc, 'homePrice');
    var downDollar = val(doc, 'downPaymentDollar');
    var downPct = val(doc, 'downPaymentPercent');
    var loanAmount = homeValue - downDollar;
    var rate = val(doc, 'interestRate');
    var termBtn = doc.querySelector('#termToggle .amort-term-btn.active');
    var term = termBtn ? parseInt(termBtn.dataset.years, 10) : 30;

    var taxInput = doc.getElementById('propertyTax');
    var taxVal = taxInput ? parseFloat(taxInput.value) || 0 : 0;
    var taxPeriod = taxInput ? taxInput.dataset.period : 'annual';
    var taxYr = taxPeriod === 'monthly' ? taxVal * 12 : taxVal;

    var insInput = doc.getElementById('homeInsurance');
    var insVal = insInput ? parseFloat(insInput.value) || 0 : 0;
    var insPeriod = insInput ? insInput.dataset.period : 'annual';
    var insYr = insPeriod === 'monthly' ? insVal * 12 : insVal;

    var monthlyPMI = val(doc, 'pmi');

    var extraAmount = val(doc, 'extraPayment');
    var freqBtn = doc.querySelector('#extraFreqToggle .amort-term-btn.active');
    var extraFreq = freqBtn ? freqBtn.dataset.freq : 'monthly';
    var startMonthSel = doc.getElementById('extraStartMonth');
    var startYearSel = doc.getElementById('extraStartYear');
    var extraStartMonth = startMonthSel ? parseInt(startMonthSel.value, 10) : 0;
    var extraStartYear = startYearSel ? parseInt(startYearSel.value, 10) : new Date().getFullYear();

    var totalPayment = txt(doc, 'resultMonthlyPI');
    var totalMonthly = txt(doc, 'resultTotalMonthly');
    var totalInterestText = txt(doc, 'resultTotalInterest');
    var totalCostText = txt(doc, 'resultTotalCost');
    var payoffDate = txt(doc, 'resultPayoffDate');
    var interestSaved = txt(doc, 'resultInterestSaved');
    var timeSaved = txt(doc, 'resultTimeSaved');
    var monthlyDetail = txt(doc, 'resultMonthlyDetail');

    var chartImage = '';
    var canvas = doc.getElementById('amortChart');
    if (canvas) {
      try { chartImage = canvas.toDataURL('image/png'); } catch (e) { /* cross-origin */ }
    }

    var schedule = [];
    var totalInterest = 0;
    var totalPrincipal = 0;
    var totalExtra = 0;
    var monthRows = doc.querySelectorAll('.amort-month-row');
    monthRows.forEach(function (row) {
      var cells = row.querySelectorAll('td');
      if (cells.length < 7) return;
      var pmtNum = parseInt(cells[0].textContent.trim(), 10);
      if (isNaN(pmtNum)) return;
      var principal = parseFloat((cells[3].textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
      var interest = parseFloat((cells[4].textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
      var extra = parseFloat((cells[5].textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
      var balance = parseFloat((cells[6].textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
      totalPrincipal += principal;
      totalInterest += interest;
      totalExtra += extra;
      schedule.push({
        num: pmtNum,
        date: cells[1].textContent.trim(),
        payment: parseFloat((cells[2].textContent || '').replace(/[^0-9.\-]/g, '')) || 0,
        principal: principal,
        interest: interest,
        extra: extra,
        balance: balance
      });
    });

    var yearlyMap = {};
    schedule.forEach(function (pmt) {
      var yr = pmt.date ? pmt.date.split(' ').pop() : '';
      if (!yr) return;
      if (!yearlyMap[yr]) yearlyMap[yr] = { year: yr, interest: 0, principal: 0, extra: 0, payments: 0, count: 0 };
      yearlyMap[yr].interest += pmt.interest;
      yearlyMap[yr].principal += pmt.principal;
      yearlyMap[yr].extra += pmt.extra;
      yearlyMap[yr].payments += pmt.payment;
      yearlyMap[yr].count++;
    });
    var yearlySummary = [];
    Object.keys(yearlyMap).sort().forEach(function (yr) { yearlySummary.push(yearlyMap[yr]); });

    return {
      inputs: {
        homeValue: homeValue, downPct: downPct, downPayment: downDollar,
        loanAmount: loanAmount, rate: rate, term: term,
        taxYr: taxYr, insYr: insYr, monthlyPMI: monthlyPMI,
        extraAmount: extraAmount, extraFreq: extraFreq,
        extraStartMonth: extraStartMonth, extraStartYear: extraStartYear
      },
      results: {
        monthlyPI: totalPayment,
        totalMonthly: totalMonthly,
        monthlyDetail: monthlyDetail,
        totalInterest: totalInterest,
        totalPrincipal: totalPrincipal,
        totalExtra: totalExtra,
        totalCost: totalCostText,
        payoffDate: payoffDate,
        interestSaved: interestSaved,
        timeSaved: timeSaved
      },
      chartImage: chartImage,
      schedule: schedule,
      yearlySummary: yearlySummary
    };
  }, function (data) {
    var inp = data.inputs; var res = data.results;
    var html = '';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Mortgage Parameters</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Home Value</span><span>' + fmt0(inp.homeValue) + '</span></div>';
    html += '<div class="rpt-param"><span>Down Payment</span><span>' + pct(inp.downPct) + ' (' + fmt0(inp.downPayment) + ')</span></div>';
    html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt0(inp.loanAmount) + '</span></div>';
    html += '<div class="rpt-param"><span>Interest Rate</span><span>' + ratePct(inp.rate) + '</span></div>';
    html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.term + ' years</span></div>';
    if (inp.taxYr) html += '<div class="rpt-param"><span>Annual Property Tax</span><span>' + fmt0(inp.taxYr) + '</span></div>';
    if (inp.insYr) html += '<div class="rpt-param"><span>Annual Insurance</span><span>' + fmt0(inp.insYr) + '</span></div>';
    if (inp.monthlyPMI) html += '<div class="rpt-param"><span>Monthly PMI</span><span>' + fmt(inp.monthlyPMI) + '</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Payment Summary</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    if (res.monthlyPI) html += '<tr><td>Monthly P&I</td><td class="rpt-num">' + res.monthlyPI + '</td></tr>';
    if (res.totalMonthly) html += '<tr><td>Total Monthly Payment</td><td class="rpt-num">' + res.totalMonthly + '</td></tr>';
    if (res.monthlyDetail) html += '<tr><td colspan="2" style="font-size:0.78rem;color:#6c757d;">' + res.monthlyDetail + '</td></tr>';
    if (res.totalPrincipal) html += '<tr><td>Total Principal</td><td class="rpt-num">' + fmt(res.totalPrincipal) + '</td></tr>';
    if (res.totalInterest) html += '<tr><td>Total Interest Paid</td><td class="rpt-num">' + fmt(res.totalInterest) + '</td></tr>';
    if (res.totalExtra) html += '<tr><td>Total Extra Payments</td><td class="rpt-num">' + fmt(res.totalExtra) + '</td></tr>';
    html += '</tbody></table>';
    if (res.totalCost) {
      html += '<div class="rpt-grand-total"><span>Total Cost of Loan</span><span>' + res.totalCost + '</span></div>';
    }
    if (res.payoffDate) {
      html += '<div class="rpt-grand-total" style="margin-top:4px"><span>Payoff Date</span><span>' + res.payoffDate + '</span></div>';
    }
    html += '</div>';

    if (inp.extraAmount && inp.extraAmount > 0) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Extra Payment Impact</h4>';
      html += '<div class="rpt-params">';
      html += '<div class="rpt-param"><span>Extra Payment</span><span>' + fmt(inp.extraAmount) + ' (' + inp.extraFreq + ')</span></div>';
      if (res.interestSaved) html += '<div class="rpt-param"><span>Interest Saved</span><span style="color:#28a745;font-weight:700">' + res.interestSaved + '</span></div>';
      if (res.timeSaved && res.timeSaved !== '--') html += '<div class="rpt-param"><span>Time Saved</span><span style="color:#28a745;font-weight:700">' + res.timeSaved + '</span></div>';
      html += '</div></div>';
    }

    if (data.chartImage) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Amortization Chart</h4>';
      html += '<img src="' + data.chartImage + '" style="width:100%;max-width:700px;border-radius:6px;margin:4px 0;" alt="Amortization Chart">';
      html += '</div>';
    }

    if (data.yearlySummary && data.yearlySummary.length) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Annual Breakdown</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Year</th><th class="rpt-num">Principal</th><th class="rpt-num">Interest</th><th class="rpt-num">Extra</th><th class="rpt-num">Total Paid</th></tr></thead><tbody>';
      data.yearlySummary.forEach(function (yr) {
        html += '<tr><td>' + yr.year + '</td>';
        html += '<td class="rpt-num">' + fmt(yr.principal) + '</td>';
        html += '<td class="rpt-num">' + fmt(yr.interest) + '</td>';
        html += '<td class="rpt-num">' + (yr.extra ? fmt(yr.extra) : '—') + '</td>';
        html += '<td class="rpt-num">' + fmt(yr.payments) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    if (data.schedule && data.schedule.length) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Full Amortization Schedule (' + data.schedule.length + ' payments)</h4>';
      html += '<table class="rpt-table" style="font-size:0.78rem"><thead><tr>';
      html += '<th>#</th><th>Date</th><th class="rpt-num">Payment</th>';
      html += '<th class="rpt-num">Principal</th><th class="rpt-num">Interest</th><th class="rpt-num">Extra</th><th class="rpt-num">Balance</th>';
      html += '</tr></thead><tbody>';
      data.schedule.forEach(function (pmt) {
        html += '<tr><td>' + pmt.num + '</td><td>' + pmt.date + '</td>';
        html += '<td class="rpt-num">' + fmt(pmt.payment) + '</td>';
        html += '<td class="rpt-num">' + fmt(pmt.principal) + '</td>';
        html += '<td class="rpt-num">' + fmt(pmt.interest) + '</td>';
        html += '<td class="rpt-num">' + (pmt.extra ? fmt(pmt.extra) : '—') + '</td>';
        html += '<td class="rpt-num">' + fmt(pmt.balance) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    return html;
  }, function (data) {
    var inp = data.inputs; var res = data.results;
    var params = [
      ['Home Value', fmt0(inp.homeValue)], ['Down Payment', pct(inp.downPct) + ' (' + fmt0(inp.downPayment) + ')'],
      ['Loan Amount', fmt0(inp.loanAmount)], ['Interest Rate', ratePct(inp.rate)],
      ['Loan Term', inp.term + ' years']
    ];
    if (inp.taxYr) params.push(['Annual Property Tax', fmt0(inp.taxYr)]);
    if (inp.insYr) params.push(['Annual Insurance', fmt0(inp.insYr)]);
    if (inp.monthlyPMI) params.push(['Monthly PMI', fmt(inp.monthlyPMI)]);
    if (inp.extraAmount) params.push(['Extra Payment', fmt(inp.extraAmount) + ' (' + inp.extraFreq + ')']);
    var results = [];
    if (res.monthlyPI) results.push(['Monthly P&I', res.monthlyPI]);
    if (res.totalMonthly) results.push(['Total Monthly', res.totalMonthly]);
    if (res.totalPrincipal) results.push(['Total Principal', fmt(res.totalPrincipal)]);
    if (res.totalInterest) results.push(['Total Interest Paid', fmt(res.totalInterest)]);
    if (res.totalCost) results.push(['Total Cost of Loan', res.totalCost]);
    if (res.payoffDate) results.push(['Payoff Date', res.payoffDate]);
    if (res.interestSaved) results.push(['Interest Saved', res.interestSaved]);
    if (res.timeSaved && res.timeSaved !== '--') results.push(['Time Saved', res.timeSaved]);
    var content = pdfKeyValue(data, params, results);

    if (data.yearlySummary && data.yearlySummary.length) {
      content.push({ text: 'Annual Breakdown', style: 'sectionTitle', margin: [0, 10, 0, 4] });
      var yrBody = [[
        { text: 'Year', style: 'tableHeader' },
        { text: 'Principal', style: 'tableHeader', alignment: 'right' },
        { text: 'Interest', style: 'tableHeader', alignment: 'right' },
        { text: 'Extra', style: 'tableHeader', alignment: 'right' },
        { text: 'Total Paid', style: 'tableHeader', alignment: 'right' }
      ]];
      data.yearlySummary.forEach(function (yr) {
        yrBody.push([yr.year,
          { text: fmt(yr.principal), alignment: 'right' },
          { text: fmt(yr.interest), alignment: 'right' },
          { text: yr.extra ? fmt(yr.extra) : '—', alignment: 'right' },
          { text: fmt(yr.payments), alignment: 'right' }
        ]);
      });
      content.push({ table: { headerRows: 1, widths: ['*', 80, 80, 60, 80], body: yrBody }, layout: 'lightHorizontalLines' });
    }

    if (data.schedule && data.schedule.length) {
      content.push({ text: 'Full Amortization Schedule', style: 'sectionTitle', margin: [0, 10, 0, 4], pageBreak: 'before' });
      var sBody = [[
        { text: '#', style: 'tableHeader' }, { text: 'Date', style: 'tableHeader' },
        { text: 'Payment', style: 'tableHeader', alignment: 'right' },
        { text: 'Principal', style: 'tableHeader', alignment: 'right' },
        { text: 'Interest', style: 'tableHeader', alignment: 'right' },
        { text: 'Extra', style: 'tableHeader', alignment: 'right' },
        { text: 'Balance', style: 'tableHeader', alignment: 'right' }
      ]];
      data.schedule.forEach(function (pmt) {
        sBody.push([
          String(pmt.num), pmt.date,
          { text: fmt(pmt.payment), alignment: 'right' },
          { text: fmt(pmt.principal), alignment: 'right' },
          { text: fmt(pmt.interest), alignment: 'right' },
          { text: pmt.extra ? fmt(pmt.extra) : '—', alignment: 'right' },
          { text: fmt(pmt.balance), alignment: 'right' }
        ]);
      });
      content.push({ table: { headerRows: 1, widths: [22, 55, 65, 65, 65, 50, 75], body: sBody }, layout: 'lightHorizontalLines', fontSize: 7 });
    }
    return content;
  });
})();
