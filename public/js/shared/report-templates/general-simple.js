(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;
  var h = RT.helpers;
  var val = h.val, txt = h.txt, fmt = h.fmt, fmt0 = h.fmt0, pct = h.pct, ratePct = h.ratePct;
  var pdfKeyValue = h.pdfKeyValue;

  /* ---- APR ---- */
  RT.register('apr',
    function (doc) {
      return {
        inputs: {
          loanAmount: val(doc,'loanAmount'), rate: val(doc,'interestRate'),
          term: txt(doc,'loanTerm'), discountPoints: val(doc,'discountPoints'),
          financedFees: val(doc,'financedFees'), prepaidFees: val(doc,'prepaidFees')
        },
        results: {
          monthlyPayment: txt(doc,'monthlyPayment'), amountFinanced: txt(doc,'amountFinanced'),
          financeCharges: txt(doc,'financeCharges'), apr: txt(doc,'aprResult'),
          noteRate: txt(doc,'noteRateDisplay'), aprDisplay: txt(doc,'aprDisplay'),
          aprSpread: txt(doc,'aprSpread')
        }
      };
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      var html = '';

      html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Parameters</h4>';
      html += '<div class="rpt-params">';
      html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt0(inp.loanAmount) + '</span></div>';
      html += '<div class="rpt-param"><span>Note Rate</span><span>' + ratePct(inp.rate) + '</span></div>';
      html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.term + '</span></div>';
      html += '<div class="rpt-param"><span>Discount Points</span><span>' + pct(inp.discountPoints) + '</span></div>';
      if (inp.financedFees) html += '<div class="rpt-param"><span>Total Financed Fees</span><span>' + fmt0(inp.financedFees) + '</span></div>';
      if (inp.prepaidFees) html += '<div class="rpt-param"><span>Total Prepaid Fees</span><span>' + fmt0(inp.prepaidFees) + '</span></div>';
      html += '</div></div>';

      html += '<div class="rpt-section"><h4 class="rpt-section-title">APR Disclosure</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
      html += '<tr><td>Monthly Payment (P&I)</td><td class="rpt-num">' + res.monthlyPayment + '</td></tr>';
      html += '<tr><td>Amount Financed</td><td class="rpt-num">' + res.amountFinanced + '</td></tr>';
      html += '<tr><td>Total Finance Charges</td><td class="rpt-num">' + res.financeCharges + '</td></tr>';
      html += '<tr><td>Note Rate</td><td class="rpt-num">' + res.noteRate + '</td></tr>';
      html += '<tr><td>APR Spread</td><td class="rpt-num">' + res.aprSpread + '</td></tr>';
      html += '</tbody></table>';
      html += '<div class="rpt-grand-total"><span>Annual Percentage Rate (APR)</span><span>' + res.apr + '</span></div>';
      html += '</div>';
      return html;
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      return pdfKeyValue(data,
        [['Loan Amount', fmt0(inp.loanAmount)], ['Note Rate', ratePct(inp.rate)], ['Term', inp.term], ['Points', pct(inp.discountPoints)]],
        [['Monthly P&I', res.monthlyPayment], ['Amount Financed', res.amountFinanced], ['Finance Charges', res.financeCharges], ['APR Spread', res.aprSpread], ['APR', res.apr]]
      );
    }
  );

  /* ---- Blended Rate ---- */
  RT.register('blended-rate',
    function (doc) {
      var debts = [];
      for (var i = 1; i <= 5; i++) {
        var b = val(doc,'d'+i+'_bal'), r = val(doc,'d'+i+'_rate'), p = val(doc,'d'+i+'_pay');
        if (b || r || p) debts.push({ label: 'Debt ' + i, balance: b, rate: r, payment: p });
      }
      return {
        debts: debts,
        results: {
          totalBalance: txt(doc,'totalBal'), totalPayment: txt(doc,'totalPay'),
          blendedRate: txt(doc,'blendedRate')
        }
      };
    },
    function (data) {
      var html = '';
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Debt Summary</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Debt</th><th class="rpt-num">Balance</th><th class="rpt-num">Rate</th><th class="rpt-num">Payment</th></tr></thead><tbody>';
      (data.debts || []).forEach(function (d) {
        html += '<tr><td>' + d.label + '</td><td class="rpt-num">' + fmt(d.balance) + '</td><td class="rpt-num">' + pct(d.rate) + '</td><td class="rpt-num">' + fmt(d.payment) + '</td></tr>';
      });
      html += '</tbody></table>';
      var r = data.results;
      html += '<div class="rpt-subtotal"><span>Total Balance</span><span>' + r.totalBalance + '</span></div>';
      html += '<div class="rpt-subtotal"><span>Total Payment</span><span>' + r.totalPayment + '</span></div>';
      html += '</div>';
      html += '<div class="rpt-grand-total"><span>Blended Rate</span><span>' + r.blendedRate + '</span></div>';
      return html;
    },
    function (data) {
      var body = [[{ text: 'Debt', style: 'tableHeader' }, { text: 'Balance', style: 'tableHeader', alignment: 'right' }, { text: 'Rate', style: 'tableHeader', alignment: 'right' }, { text: 'Payment', style: 'tableHeader', alignment: 'right' }]];
      (data.debts || []).forEach(function (d) { body.push([d.label, { text: fmt(d.balance), alignment: 'right' }, { text: pct(d.rate), alignment: 'right' }, { text: fmt(d.payment), alignment: 'right' }]); });
      var r = data.results;
      return [
        { table: { headerRows: 1, widths: ['*', 80, 60, 80], body: body }, layout: 'lightHorizontalLines' },
        { columns: [{ text: 'Blended Rate', bold: true, fontSize: 12, color: '#2d6a4f' }, { text: r.blendedRate, alignment: 'right', bold: true, fontSize: 12, color: '#2d6a4f' }], margin: [0, 8, 0, 0] }
      ];
    }
  );

  /* ---- Buydown ---- */
  RT.register('buydown',
    function (doc) {
      var years = [];
      var yearCards = doc.querySelectorAll('.year-card');
      yearCards.forEach(function (card) {
        var yearObj = {};
        var heading = card.querySelector('h4, h3, .year-header');
        if (heading) {
          var badge = heading.querySelector('.rate-badge');
          yearObj.rate = badge ? badge.textContent.trim() : '';
          var headClone = heading.cloneNode(true);
          var badgeInClone = headClone.querySelector('.rate-badge');
          if (badgeInClone) badgeInClone.remove();
          yearObj.label = headClone.textContent.trim();
        }
        var items = card.querySelectorAll('.year-item');
        items.forEach(function (item) {
          var lbl = item.querySelector('.label');
          var value = item.querySelector('.value');
          if (lbl && value) {
            var key = lbl.textContent.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
            yearObj[key] = value.textContent.trim();
          }
        });
        years.push(yearObj);
      });
      return {
        inputs: {
          loanAmount: val(doc,'loanAmount'), noteRate: val(doc,'noteRate'),
          loanTerm: txt(doc,'loanTerm'), buydownType: txt(doc,'buydownType')
        },
        results: {
          basePayment: txt(doc,'basePayment'), year1Payment: txt(doc,'year1Payment'),
          year1Savings: txt(doc,'year1Savings'), totalCost: txt(doc,'totalCost')
        },
        years: years
      };
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      var html = '';
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Parameters</h4>';
      html += '<div class="rpt-params">';
      html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt0(inp.loanAmount) + '</span></div>';
      html += '<div class="rpt-param"><span>Note Rate</span><span>' + ratePct(inp.noteRate) + '</span></div>';
      html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.loanTerm + '</span></div>';
      html += '<div class="rpt-param"><span>Buydown Type</span><span>' + inp.buydownType + '</span></div>';
      html += '</div></div>';

      html += '<div class="rpt-section"><h4 class="rpt-section-title">Payment Summary</h4>';
      html += '<div class="rpt-params">';
      html += '<div class="rpt-param"><span>Full Note-Rate Payment</span><span>' + res.basePayment + '</span></div>';
      html += '<div class="rpt-param"><span>Year 1 Reduced Payment</span><span>' + res.year1Payment + '</span></div>';
      html += '<div class="rpt-param"><span>Year 1 Monthly Savings</span><span>' + res.year1Savings + '</span></div>';
      html += '</div>';
      html += '<div class="rpt-grand-total"><span>Total Buydown Cost</span><span>' + res.totalCost + '</span></div>';
      html += '</div>';

      if (data.years && data.years.length) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">Year-by-Year Breakdown</h4>';
        html += '<table class="rpt-table"><thead><tr><th>Period</th><th class="rpt-num">Rate</th><th class="rpt-num">P&I Payment</th><th class="rpt-num">Total Payment</th><th class="rpt-num">Monthly Savings</th></tr></thead><tbody>';
        data.years.forEach(function (yr) {
          var piVal = yr.p_i_payment || '';
          var totalVal = yr.total_payment || '';
          var savVal = yr.monthly_savings || '';
          html += '<tr><td>' + (yr.label || '') + '</td>';
          html += '<td class="rpt-num">' + (yr.rate || '') + '</td>';
          html += '<td class="rpt-num">' + piVal + '</td>';
          html += '<td class="rpt-num">' + totalVal + '</td>';
          html += '<td class="rpt-num">' + savVal + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      return html;
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      var content = pdfKeyValue(data,
        [['Loan Amount', fmt0(inp.loanAmount)], ['Note Rate', ratePct(inp.noteRate)], ['Term', inp.loanTerm], ['Buydown Type', inp.buydownType]],
        [['Full Rate Payment', res.basePayment], ['Year 1 Payment', res.year1Payment], ['Year 1 Savings', res.year1Savings], ['Total Buydown Cost', res.totalCost]]
      );
      if (data.years && data.years.length) {
        var body = [[
          { text: 'Period', style: 'tableHeader' },
          { text: 'Rate', style: 'tableHeader', alignment: 'right' },
          { text: 'P&I', style: 'tableHeader', alignment: 'right' },
          { text: 'Total', style: 'tableHeader', alignment: 'right' },
          { text: 'Savings', style: 'tableHeader', alignment: 'right' }
        ]];
        data.years.forEach(function (yr) {
          body.push([
            yr.label || '',
            { text: yr.rate || '', alignment: 'right' },
            { text: yr.p_i_payment || '', alignment: 'right' },
            { text: yr.total_payment || '', alignment: 'right' },
            { text: yr.monthly_savings || '', alignment: 'right' }
          ]);
        });
        content.push({ text: 'Year-by-Year Breakdown', style: 'sectionTitle', margin: [0, 10, 0, 4] });
        content.push({ table: { headerRows: 1, widths: ['*', 60, 80, 80, 80], body: body }, layout: 'lightHorizontalLines' });
      }
      return content;
    }
  );

  /* ---- REO Investment ---- */
  RT.register('reo',
    function (doc) {
      return {
        inputs: {
          address: (txt(doc,'street') + ' ' + txt(doc,'city')).trim(),
          purchasePrice: val(doc,'purchasePrice'), downPct: val(doc,'downPct'),
          rate: val(doc,'rate'), term: val(doc,'termYears'),
          grossRents: val(doc,'grossRents'), appreciation: val(doc,'appreciation')
        },
        results: {
          renoTotal: txt(doc,'renoTotal'), cashInvested: txt(doc,'cashInvested'),
          noiMonthly: txt(doc,'noiMonthly'), r2p: txt(doc,'r2p'),
          year1CapRate: txt(doc,'cap1'), year1CashFlow: txt(doc,'cf1'),
          year1CoC: txt(doc,'coc1')
        }
      };
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      var html = '';
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Property Details</h4>';
      html += '<div class="rpt-params">';
      if (inp.address) html += '<div class="rpt-param"><span>Property Address</span><span>' + inp.address + '</span></div>';
      html += '<div class="rpt-param"><span>Purchase Price</span><span>' + fmt0(inp.purchasePrice) + '</span></div>';
      html += '<div class="rpt-param"><span>Down Payment</span><span>' + pct(inp.downPct) + '</span></div>';
      html += '<div class="rpt-param"><span>Interest Rate</span><span>' + ratePct(inp.rate) + '</span></div>';
      html += '<div class="rpt-param"><span>Gross Monthly Rents</span><span>' + fmt0(inp.grossRents) + '</span></div>';
      html += '</div></div>';
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Investment Analysis</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
      html += '<tr><td>Renovation Total</td><td class="rpt-num">' + res.renoTotal + '</td></tr>';
      html += '<tr><td>Total Cash Invested</td><td class="rpt-num">' + res.cashInvested + '</td></tr>';
      html += '<tr><td>Monthly Net Operating Income</td><td class="rpt-num">' + res.noiMonthly + '</td></tr>';
      html += '<tr><td>Rent-to-Price Ratio</td><td class="rpt-num">' + res.r2p + '</td></tr>';
      html += '<tr><td>Year 1 Cap Rate</td><td class="rpt-num">' + res.year1CapRate + '</td></tr>';
      html += '<tr><td>Year 1 Cash Flow</td><td class="rpt-num">' + res.year1CashFlow + '</td></tr>';
      html += '</tbody></table>';
      html += '<div class="rpt-grand-total"><span>Year 1 Cash-on-Cash Return</span><span>' + res.year1CoC + '</span></div>';
      html += '</div>';
      return html;
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      return pdfKeyValue(data,
        [['Property', inp.address || '—'], ['Purchase Price', fmt0(inp.purchasePrice)], ['Down Payment', pct(inp.downPct)], ['Rate', ratePct(inp.rate)], ['Gross Rents', fmt0(inp.grossRents) + '/mo']],
        [['Renovation Total', res.renoTotal], ['Cash Invested', res.cashInvested], ['Monthly NOI', res.noiMonthly], ['Year 1 Cap Rate', res.year1CapRate], ['Year 1 Cash Flow', res.year1CashFlow], ['Year 1 Cash-on-Cash', res.year1CoC]]
      );
    }
  );
})();
