(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;
  var h = RT.helpers;
  var val = h.val, txt = h.txt, fmt0 = h.fmt0, ratePct = h.ratePct;
  var pdfKeyValue = h.pdfKeyValue;

  /* ---- FHA (Unified: purchase, refi, streamline comparison) ---- */
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
        refi: {
          maxLoan: txt(doc,'fhaRefiMaxLoan'), actualLoan: txt(doc,'fhaRefiActualLoan'),
          ufmip: txt(doc,'fhaRefiUfmip'),
          totalLoan: txt(doc,'fhaRefiTotalLoan'), ltv: txt(doc,'fhaRefiLtv'),
          payment: txt(doc,'fhaRefiPayment'), ntb: txt(doc,'fhaRefiNtb'),
          cashToClose: txt(doc,'fhaRefiCashToClose')
        },
        streamline: {
          maxLoan: txt(doc,'fhaSlMaxLoan'), actualLoan: txt(doc,'fhaSlActualLoan'),
          ufmipRefund: txt(doc,'fhaSlUfmipRefund'),
          newUfmip: txt(doc,'fhaSlNewUfmip'), totalLoan: txt(doc,'fhaSlTotalLoan'),
          payment: txt(doc,'fhaSlPayment'), ntb: txt(doc,'fhaSlNtb'),
          cashToClose: txt(doc,'fhaSlCashToClose')
        },
        purchase: {
          maxLoan: txt(doc,'fhaPurchMaxLoan'), actualLoan: txt(doc,'fhaPurchActualLoan'),
          ufmip: txt(doc,'fhaPurchUfmip'),
          totalLoan: txt(doc,'fhaPurchTotalLoan'), ltv: txt(doc,'fhaPurchLtv'),
          payment: txt(doc,'fhaPurchPayment'), cashToClose: txt(doc,'fhaPurchCashToClose')
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

      // Comparison table
      var hasRefi = data.refi.totalLoan && data.refi.totalLoan !== '\u2014';
      var hasSl = data.streamline.totalLoan && data.streamline.totalLoan !== '\u2014';
      var hasPurch = data.purchase.totalLoan && data.purchase.totalLoan !== '\u2014';

      html += '<div class="rpt-section"><h4 class="rpt-section-title">FHA Scenario Comparison</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Item</th>';
      if (hasPurch) html += '<th class="rpt-num">Purchase</th>';
      if (hasRefi) html += '<th class="rpt-num">FHA Refi</th>';
      if (hasSl) html += '<th class="rpt-num">Streamline</th>';
      html += '</tr></thead><tbody>';

      var rows = [
        ['Max Base Loan', 'maxLoan'],
        ['Actual Base Loan', 'actualLoan'],
        ['UFMIP Refund', 'ufmipRefund'],
        ['New UFMIP', 'ufmip', 'newUfmip'],
        ['Total Loan', 'totalLoan'],
        ['LTV', 'ltv'],
        ['New P&I Payment', 'payment'],
        ['NTB', 'ntb'],
        ['Cash to Close', 'cashToClose']
      ];

      rows.forEach(function (row) {
        var label = row[0];
        var key = row[1];
        html += '<tr><td>' + label + '</td>';
        if (hasPurch) html += '<td class="rpt-num">' + (data.purchase[key] || '\u2014') + '</td>';
        if (hasRefi) html += '<td class="rpt-num">' + (data.refi[key] || '\u2014') + '</td>';
        if (hasSl) {
          var slKey = row[2] || key;
          html += '<td class="rpt-num">' + (data.streamline[slKey] || data.streamline[key] || '\u2014') + '</td>';
        }
        html += '</tr>';
      });

      html += '</tbody></table></div>';
      return html;
    },
    function (data) {
      var inp = data.inputs;
      var inputPairs = [['Borrower', inp.borrower || '\u2014'], ['Appraised Value', fmt0(inp.appraisedValue)]];
      if (inp.currentUpb) inputPairs.push(['Current UPB', fmt0(inp.currentUpb)]);
      if (inp.newRate) inputPairs.push(['New Rate', ratePct(inp.newRate)]);

      var resultPairs = [];
      if (data.refi.totalLoan) {
        resultPairs.push(['FHA Refi Total Loan', data.refi.totalLoan]);
        resultPairs.push(['FHA Refi NTB', data.refi.ntb || '\u2014']);
        resultPairs.push(['FHA Refi Cash to Close', data.refi.cashToClose || '\u2014']);
      }
      if (data.streamline.totalLoan) {
        resultPairs.push(['Streamline Total Loan', data.streamline.totalLoan]);
        resultPairs.push(['Streamline NTB', data.streamline.ntb || '\u2014']);
        resultPairs.push(['Streamline Cash to Close', data.streamline.cashToClose || '\u2014']);
      }
      if (data.purchase.totalLoan) {
        resultPairs.push(['Purchase Total Loan', data.purchase.totalLoan]);
        resultPairs.push(['Purchase Cash to Close', data.purchase.cashToClose || '\u2014']);
      }

      return pdfKeyValue(data, inputPairs, resultPairs);
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
