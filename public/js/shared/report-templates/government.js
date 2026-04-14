(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;
  var h = RT.helpers;
  var val = h.val, txt = h.txt, fmt0 = h.fmt0, ratePct = h.ratePct;
  var pdfKeyValue = h.pdfKeyValue;

  /* ---- FHA (Unified: purchase, refi 3-column comparison) ---- */
  RT.register('fha',
    function (doc) {
      return {
        inputs: {
          borrower: txt(doc,'fhaBorrowerName'), caseId: txt(doc,'fhaCaseId'),
          appraisedValue: val(doc,'fhaAppraisedValue'), purchasePrice: val(doc,'fhaPurchasePrice'),
          currentUpb: val(doc,'fhaCurrentUpb'), currentRate: val(doc,'fhaCurrentRate'),
          currentPayment: val(doc,'fhaCurrentPayment'), newRate: val(doc,'fhaNewRate'),
          totalClosingCosts: txt(doc,'fhaTotalClosingCosts')
        },
        purchase: {
          maxLoan: txt(doc,'fhaMaxBaseLoan'), actualLoan: txt(doc,'fhaActualBaseLoan'),
          ufmip: txt(doc,'fhaNewUfmipAmt'), totalLoan: txt(doc,'fhaTotalLoanAmt'),
          ltv: txt(doc,'fhaLtv'), pi: txt(doc,'fhaMonthlyPI'),
          mip: txt(doc,'fhaMonthlyMip'), total: txt(doc,'fhaTotalMonthly'),
          cashToClose: txt(doc,'fhaCashToClose')
        },
        rateTerm: {
          maxLoan: txt(doc,'fhaRT_maxLoan'), ufmip: txt(doc,'fhaRT_ufmip'),
          totalLoan: txt(doc,'fhaRT_totalLoan'), ltv: txt(doc,'fhaRT_ltv'),
          pi: txt(doc,'fhaRT_pi'), mip: txt(doc,'fhaRT_mip'),
          total: txt(doc,'fhaRT_total'), ntb: txt(doc,'fhaRT_ntb'),
          cashToClose: txt(doc,'fhaRT_cashToClose')
        },
        cashOut: {
          maxLoan: txt(doc,'fhaCO_maxLoan'), ufmip: txt(doc,'fhaCO_ufmip'),
          totalLoan: txt(doc,'fhaCO_totalLoan'), ltv: txt(doc,'fhaCO_ltv'),
          pi: txt(doc,'fhaCO_pi'), mip: txt(doc,'fhaCO_mip'),
          total: txt(doc,'fhaCO_total'), ntb: txt(doc,'fhaCO_ntb'),
          cashToClose: txt(doc,'fhaCO_cashToClose')
        },
        streamline: {
          maxLoan: txt(doc,'fhaSL_maxLoan'), ufmipRefund: txt(doc,'fhaSL_ufmipRefund'),
          ufmip: txt(doc,'fhaSL_ufmip'), totalLoan: txt(doc,'fhaSL_totalLoan'),
          pi: txt(doc,'fhaSL_pi'), mip: txt(doc,'fhaSL_mip'),
          total: txt(doc,'fhaSL_total'), ntb: txt(doc,'fhaSL_ntb'),
          cashToClose: txt(doc,'fhaSL_cashToClose')
        }
      };
    },
    function (data) {
      var inp = data.inputs;
      var html = '';

      // Inputs section
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Information</h4>';
      html += '<div class="rpt-params">';
      if (inp.borrower) html += '<div class="rpt-param"><span>Borrower</span><span>' + inp.borrower + '</span></div>';
      if (inp.caseId) html += '<div class="rpt-param"><span>FHA Case ID</span><span>' + inp.caseId + '</span></div>';
      html += '<div class="rpt-param"><span>Appraised Value</span><span>' + fmt0(inp.appraisedValue) + '</span></div>';
      if (inp.purchasePrice) html += '<div class="rpt-param"><span>Purchase Price</span><span>' + fmt0(inp.purchasePrice) + '</span></div>';
      if (inp.currentUpb) html += '<div class="rpt-param"><span>Current UPB</span><span>' + fmt0(inp.currentUpb) + '</span></div>';
      if (inp.currentRate) html += '<div class="rpt-param"><span>Current Rate</span><span>' + ratePct(inp.currentRate) + '</span></div>';
      if (inp.newRate) html += '<div class="rpt-param"><span>New Rate</span><span>' + ratePct(inp.newRate) + '</span></div>';
      if (inp.totalClosingCosts) html += '<div class="rpt-param"><span>Total Closing Costs</span><span>' + inp.totalClosingCosts + '</span></div>';
      html += '</div></div>';

      // Determine which scenarios have data
      var hasPurch = data.purchase.totalLoan && data.purchase.totalLoan !== '\u2014';
      var hasRT = data.rateTerm.totalLoan && data.rateTerm.totalLoan !== '\u2014';
      var hasCO = data.cashOut.totalLoan && data.cashOut.totalLoan !== '\u2014';
      var hasSl = data.streamline.totalLoan && data.streamline.totalLoan !== '\u2014' && data.streamline.totalLoan !== 'N/A';

      html += '<div class="rpt-section"><h4 class="rpt-section-title">FHA Scenario Comparison</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Item</th>';
      if (hasPurch) html += '<th class="rpt-num">Purchase</th>';
      if (hasRT) html += '<th class="rpt-num">Rate/Term</th>';
      if (hasCO) html += '<th class="rpt-num">Cash-Out</th>';
      if (hasSl) html += '<th class="rpt-num">Streamline</th>';
      html += '</tr></thead><tbody>';

      var rows = [
        ['Max Base Loan', 'maxLoan'],
        ['UFMIP Refund', 'ufmipRefund'],
        ['New UFMIP', 'ufmip'],
        ['Total Loan', 'totalLoan'],
        ['LTV', 'ltv'],
        ['P&I Payment', 'pi'],
        ['Monthly MIP', 'mip'],
        ['Total Monthly', 'total'],
        ['NTB', 'ntb'],
        ['Cash to Close', 'cashToClose']
      ];

      rows.forEach(function (row) {
        var label = row[0];
        var key = row[1];
        html += '<tr><td>' + label + '</td>';
        if (hasPurch) html += '<td class="rpt-num">' + (data.purchase[key] || '\u2014') + '</td>';
        if (hasRT) html += '<td class="rpt-num">' + (data.rateTerm[key] || '\u2014') + '</td>';
        if (hasCO) html += '<td class="rpt-num">' + (data.cashOut[key] || '\u2014') + '</td>';
        if (hasSl) html += '<td class="rpt-num">' + (data.streamline[key] || '\u2014') + '</td>';
        html += '</tr>';
      });

      html += '</tbody></table></div>';
      return html;
    },
    function (data) {
      var inp = data.inputs;
      var hasPurch = data.purchase.totalLoan && data.purchase.totalLoan !== '\u2014';
      var hasRT = data.rateTerm.totalLoan && data.rateTerm.totalLoan !== '\u2014';
      var hasCO = data.cashOut.totalLoan && data.cashOut.totalLoan !== '\u2014';
      var hasSl = data.streamline.totalLoan && data.streamline.totalLoan !== '\u2014' && data.streamline.totalLoan !== 'N/A';

      /* Compact info row */
      var infoPairs = [['Borrower', inp.borrower || '\u2014'], ['Appraised Value', fmt0(inp.appraisedValue)]];
      if (inp.currentUpb) infoPairs.push(['Current UPB', fmt0(inp.currentUpb)]);
      if (inp.newRate) infoPairs.push(['New Rate', ratePct(inp.newRate)]);
      if (inp.totalClosingCosts) infoPairs.push(['Closing Costs', inp.totalClosingCosts]);

      var content = [];
      var infoBody = infoPairs.map(function(p) { return [{ text: p[0], fontSize: 7.5, color: '#6c757d' }, { text: p[1], fontSize: 7.5, alignment: 'right' }]; });
      content.push({ table: { widths: ['*', 'auto'], body: infoBody }, layout: { hLineWidth: function() { return 0; }, vLineWidth: function() { return 0; }, paddingLeft: function() { return 3; }, paddingRight: function() { return 3; }, paddingTop: function() { return 1.5; }, paddingBottom: function() { return 1.5; } }, margin: [0, 0, 0, 4] });

      /* Comparison table */
      var header = [{ text: 'Item', style: 'tableHeader' }];
      if (hasPurch) header.push({ text: 'Purchase', style: 'tableHeader', alignment: 'right' });
      if (hasRT) header.push({ text: 'Rate/Term', style: 'tableHeader', alignment: 'right' });
      if (hasCO) header.push({ text: 'Cash-Out', style: 'tableHeader', alignment: 'right' });
      if (hasSl) header.push({ text: 'Streamline', style: 'tableHeader', alignment: 'right' });
      var colCount = header.length;
      var widths = ['*'];
      for (var w = 1; w < colCount; w++) widths.push(75);

      var rows = [['Max Loan','maxLoan'],['UFMIP','ufmip'],['Total Loan','totalLoan'],['LTV','ltv'],['P&I','pi'],['MIP','mip'],['Total','total'],['NTB','ntb'],['Cash to Close','cashToClose']];
      var tbody = [header];
      rows.forEach(function(row) {
        var r = [{ text: row[0], fontSize: 7.5 }];
        if (hasPurch) r.push({ text: data.purchase[row[1]] || '\u2014', fontSize: 7.5, alignment: 'right' });
        if (hasRT) r.push({ text: data.rateTerm[row[1]] || '\u2014', fontSize: 7.5, alignment: 'right' });
        if (hasCO) r.push({ text: data.cashOut[row[1]] || '\u2014', fontSize: 7.5, alignment: 'right' });
        if (hasSl) r.push({ text: data.streamline[row[1]] || '\u2014', fontSize: 7.5, alignment: 'right' });
        tbody.push(r);
      });
      content.push({ table: { headerRows: 1, widths: widths, body: tbody }, layout: RT.helpers.TIGHT, margin: [0, 0, 0, 4] });
      return content;
    }
  );

  /* ---- VA Pre-Qual ---- */
  RT.register('va-prequal',
    function (doc) {
      return {
        inputs: {
          borrower: txt(doc,'borrowerName'), familySize: txt(doc,'familySize'),
          region: txt(doc,'region'), mortgageAmount: val(doc,'mortgageAmount'),
          rate: txt(doc,'interestRate'), term: txt(doc,'loanTerm'),
          grossIncome: val(doc,'grossIncome'), squareFootage: val(doc,'squareFootage')
        },
        debts: {
          propertyTaxes: val(doc,'propertyTaxes'), homeInsurance: val(doc,'homeInsurance'),
          hoa: val(doc,'hoaDues'), carPayments: val(doc,'carPayments'),
          revolving: val(doc,'revolvingAccounts'), installment: val(doc,'installmentLoans'),
          childCare: val(doc,'childCare'), other: val(doc,'otherDebts')
        },
        results: {
          piPayment: txt(doc,'piPayment'), totalHousing: txt(doc,'totalHousing'),
          totalDebts: txt(doc,'totalDebts'), dtiRatio: txt(doc,'dtiRatio'),
          requiredResidual: txt(doc,'requiredResidual'), actualResidual: txt(doc,'actualResidual'),
          residualStatus: txt(doc,'residualStatus')
        }
      };
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      var html = '';

      html += '<div class="rpt-section"><h4 class="rpt-section-title">Borrower Information</h4>';
      html += '<div class="rpt-params">';
      if (inp.borrower) html += '<div class="rpt-param"><span>Borrower</span><span>' + inp.borrower + '</span></div>';
      html += '<div class="rpt-param"><span>Family Size</span><span>' + inp.familySize + '</span></div>';
      html += '<div class="rpt-param"><span>Region</span><span>' + inp.region + '</span></div>';
      html += '<div class="rpt-param"><span>Gross Monthly Income</span><span>' + fmt0(inp.grossIncome) + '</span></div>';
      html += '</div></div>';

      html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Details</h4>';
      html += '<div class="rpt-params">';
      html += '<div class="rpt-param"><span>Mortgage Amount</span><span>' + fmt0(inp.mortgageAmount) + '</span></div>';
      html += '<div class="rpt-param"><span>Interest Rate</span><span>' + inp.rate + '</span></div>';
      html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.term + '</span></div>';
      html += '</div></div>';

      html += '<div class="rpt-section"><h4 class="rpt-section-title">Qualification Results</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
      html += '<tr><td>Principal & Interest Payment</td><td class="rpt-num">' + res.piPayment + '</td></tr>';
      html += '<tr><td>Total Monthly Housing</td><td class="rpt-num">' + res.totalHousing + '</td></tr>';
      html += '<tr><td>Total Monthly Debts</td><td class="rpt-num">' + res.totalDebts + '</td></tr>';
      html += '<tr><td>Debt-to-Income Ratio</td><td class="rpt-num">' + res.dtiRatio + '</td></tr>';
      html += '</tbody></table></div>';

      html += '<div class="rpt-section"><h4 class="rpt-section-title">Residual Income Analysis</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
      html += '<tr><td>Required Residual Income</td><td class="rpt-num">' + res.requiredResidual + '</td></tr>';
      html += '<tr><td>Actual Residual Income</td><td class="rpt-num">' + res.actualResidual + '</td></tr>';
      html += '</tbody></table>';
      html += '<div class="rpt-grand-total"><span>Residual Income Status</span><span>' + res.residualStatus + '</span></div>';
      html += '</div>';
      return html;
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      return pdfKeyValue(data,
        [['Borrower', inp.borrower || '\u2014'], ['Mortgage', fmt0(inp.mortgageAmount)], ['Rate', inp.rate], ['Term', inp.term], ['Income', fmt0(inp.grossIncome) + '/mo']],
        [['P&I Payment', res.piPayment], ['Total Housing', res.totalHousing], ['Total Debts', res.totalDebts], ['DTI', res.dtiRatio], ['Required Residual', res.requiredResidual], ['Actual Residual', res.actualResidual], ['Status', res.residualStatus]]
      );
    }
  );

  /* ---- Escrow Prepaids ---- */
  RT.register('escrow',
    function (doc) {
      return {
        inputs: {
          loanType: txt(doc,'loanType'), state: txt(doc,'state'),
          closingDate: txt(doc,'closingDate'), annualTax: val(doc,'annualTax'),
          annualIns: val(doc,'annualIns'), cushionMonths: val(doc,'cushionMonths')
        },
        results: {
          taxDeposit: txt(doc,'resultTaxDeposit'), insDeposit: txt(doc,'resultInsDeposit'),
          totalDeposit: txt(doc,'resultTotalDeposit'), aggregateAdj: txt(doc,'resultAggregateAdj')
        }
      };
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      var html = '';
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Escrow Scenario</h4>';
      html += '<div class="rpt-params">';
      html += '<div class="rpt-param"><span>Loan Type</span><span>' + inp.loanType + '</span></div>';
      html += '<div class="rpt-param"><span>State</span><span>' + inp.state + '</span></div>';
      html += '<div class="rpt-param"><span>Closing Date</span><span>' + inp.closingDate + '</span></div>';
      html += '<div class="rpt-param"><span>Annual Property Tax</span><span>' + fmt0(inp.annualTax) + '</span></div>';
      html += '<div class="rpt-param"><span>Annual Homeowners Insurance</span><span>' + fmt0(inp.annualIns) + '</span></div>';
      html += '</div></div>';
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Escrow Deposit Breakdown</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Amount</th></tr></thead><tbody>';
      html += '<tr><td>Tax Escrow Deposit</td><td class="rpt-num">' + res.taxDeposit + '</td></tr>';
      html += '<tr><td>Insurance Escrow Deposit</td><td class="rpt-num">' + res.insDeposit + '</td></tr>';
      html += '<tr><td>Aggregate Adjustment</td><td class="rpt-num">' + res.aggregateAdj + '</td></tr>';
      html += '</tbody></table>';
      html += '<div class="rpt-grand-total"><span>Total Initial Escrow Deposit</span><span>' + res.totalDeposit + '</span></div>';
      html += '</div>';
      return html;
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      return pdfKeyValue(data,
        [['Loan Type', inp.loanType], ['State', inp.state], ['Closing Date', inp.closingDate], ['Annual Tax', fmt0(inp.annualTax)], ['Annual Insurance', fmt0(inp.annualIns)]],
        [['Tax Escrow Deposit', res.taxDeposit], ['Insurance Escrow Deposit', res.insDeposit], ['Aggregate Adjustment', res.aggregateAdj], ['Total Initial Escrow', res.totalDeposit]]
      );
    }
  );
})();
