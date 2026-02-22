(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;
  var h = RT.helpers;
  var val = h.val, txt = h.txt, fmt = h.fmt, fmt0 = h.fmt0, pct = h.pct, ratePct = h.ratePct;
  var pdfKeyValue = h.pdfKeyValue;

  /* ---- FHA ---- */
  RT.register('fha',
    function (doc) {
      return {
        inputs: {
          loanPurpose: txt(doc,'loanPurpose'), propertyType: txt(doc,'propertyType'),
          purchasePrice: val(doc,'purchasePrice'), appraisedValue: val(doc,'appraisedValue'),
          currentUpb: val(doc,'currentUpb'), closingCosts: val(doc,'closingCosts'),
          closingCostsCash: val(doc,'closingCostsCash'), prepaidsCash: val(doc,'prepaidsCash'),
          totalCredits: val(doc,'totalCredits'), escrowRefund: val(doc,'escrowRefund')
        },
        results: {
          baseLoan: txt(doc,'resultBaseLoan'), totalLoan: txt(doc,'resultTotalLoan'),
          ltv: txt(doc,'resultLtv'), ntb: txt(doc,'resultNtb'),
          cashToClose: txt(doc,'resultCashToClose')
        }
      };
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      var html = '';

      html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Scenario</h4>';
      html += '<div class="rpt-params">';
      html += '<div class="rpt-param"><span>Loan Purpose</span><span>' + inp.loanPurpose + '</span></div>';
      html += '<div class="rpt-param"><span>Property Type</span><span>' + inp.propertyType + '</span></div>';
      html += '<div class="rpt-param"><span>Purchase Price</span><span>' + fmt0(inp.purchasePrice) + '</span></div>';
      html += '<div class="rpt-param"><span>Appraised Value</span><span>' + fmt0(inp.appraisedValue) + '</span></div>';
      if (inp.closingCosts) html += '<div class="rpt-param"><span>Financed Closing Costs</span><span>' + fmt0(inp.closingCosts) + '</span></div>';
      if (inp.closingCostsCash) html += '<div class="rpt-param"><span>Cash Closing Costs</span><span>' + fmt0(inp.closingCostsCash) + '</span></div>';
      if (inp.prepaidsCash) html += '<div class="rpt-param"><span>Prepaids / Escrows</span><span>' + fmt0(inp.prepaidsCash) + '</span></div>';
      html += '</div></div>';

      html += '<div class="rpt-section"><h4 class="rpt-section-title">FHA Loan Results</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
      html += '<tr><td>Maximum Base FHA Loan</td><td class="rpt-num">' + res.baseLoan + '</td></tr>';
      html += '<tr><td>Total Loan Amount (w/ UFMIP)</td><td class="rpt-num">' + res.totalLoan + '</td></tr>';
      html += '<tr><td>Implied LTV</td><td class="rpt-num">' + res.ltv + '</td></tr>';
      html += '<tr><td>Net Tangible Benefit</td><td class="rpt-num">' + res.ntb + '</td></tr>';
      html += '</tbody></table>';
      html += '<div class="rpt-grand-total"><span>Estimated Cash to Close</span><span>' + res.cashToClose + '</span></div>';
      html += '</div>';
      return html;
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      return pdfKeyValue(data,
        [['Purpose', inp.loanPurpose], ['Purchase Price', fmt0(inp.purchasePrice)], ['Appraised Value', fmt0(inp.appraisedValue)]],
        [['Base FHA Loan', res.baseLoan], ['Total Loan (w/ UFMIP)', res.totalLoan], ['LTV', res.ltv], ['Net Tangible Benefit', res.ntb], ['Cash to Close', res.cashToClose]]
      );
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

  /* ---- FHA Refinance ---- */
  RT.register('fha-refi',
    function (doc) {
      return {
        inputs: {
          borrower: txt(doc,'borrowerName'), currentUpb: val(doc,'sl_upb'),
          originalLoan: val(doc,'sl_originalLoanAmount'),
          oldRate: val(doc,'ntb_oldRate'), newRate: val(doc,'ntb_newRate')
        },
        results: {
          totalClosingCosts: txt(doc,'sl_totalClosingCosts'), baseLoan: txt(doc,'sl_baseAmount'),
          newUfmip: txt(doc,'sl_newUFMIP'), finalMortgage: txt(doc,'sl_finalResult'),
          ufmipRefund: txt(doc,'sl_ufmipRefund')
        }
      };
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      var html = '';
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Current Loan Details</h4>';
      html += '<div class="rpt-params">';
      if (inp.borrower) html += '<div class="rpt-param"><span>Borrower</span><span>' + inp.borrower + '</span></div>';
      html += '<div class="rpt-param"><span>Current Unpaid Balance</span><span>' + fmt0(inp.currentUpb) + '</span></div>';
      html += '<div class="rpt-param"><span>Original Loan Amount</span><span>' + fmt0(inp.originalLoan) + '</span></div>';
      html += '<div class="rpt-param"><span>Current Interest Rate</span><span>' + ratePct(inp.oldRate) + '</span></div>';
      html += '<div class="rpt-param"><span>New Interest Rate</span><span>' + ratePct(inp.newRate) + '</span></div>';
      html += '</div></div>';
      html += '<div class="rpt-section"><h4 class="rpt-section-title">FHA Streamline Results</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Amount</th></tr></thead><tbody>';
      html += '<tr><td>Total Closing Costs</td><td class="rpt-num">' + res.totalClosingCosts + '</td></tr>';
      html += '<tr><td>Base Loan Amount</td><td class="rpt-num">' + res.baseLoan + '</td></tr>';
      html += '<tr><td>New UFMIP (1.75%)</td><td class="rpt-num">' + res.newUfmip + '</td></tr>';
      html += '<tr><td>UFMIP Refund</td><td class="rpt-num">' + res.ufmipRefund + '</td></tr>';
      html += '</tbody></table>';
      html += '<div class="rpt-grand-total"><span>Maximum Streamline Mortgage</span><span>' + res.finalMortgage + '</span></div>';
      html += '</div>';
      return html;
    },
    function (data) {
      var inp = data.inputs; var res = data.results;
      return pdfKeyValue(data,
        [['Borrower', inp.borrower || '\u2014'], ['Current UPB', fmt0(inp.currentUpb)], ['Original Loan', fmt0(inp.originalLoan)], ['Current Rate', ratePct(inp.oldRate)], ['New Rate', ratePct(inp.newRate)]],
        [['Closing Costs', res.totalClosingCosts], ['Base Loan', res.baseLoan], ['New UFMIP', res.newUfmip], ['UFMIP Refund', res.ufmipRefund], ['Max Streamline Mortgage', res.finalMortgage]]
      );
    }
  );
})();
