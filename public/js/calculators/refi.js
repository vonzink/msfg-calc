'use strict';

(function () {
  'use strict';

  function getIframeDoc() {
    var iframe = document.getElementById('legacyFrame');
    if (!iframe) return null;
    try { return iframe.contentDocument || iframe.contentWindow.document; }
    catch (e) { return null; }
  }

  function txt(doc, id) {
    var el = doc.getElementById(id);
    return el ? el.textContent.trim() : '';
  }

  function val(doc, id) {
    var el = doc.getElementById(id);
    return el ? el.value : '';
  }

  if (MSFG.CalcActions) {
    MSFG.CalcActions.register(function () {
      var doc = getIframeDoc();
      if (!doc) return null;

      var sections = [];

      // Current loan
      var curBal = val(doc, 'currentBalance');
      var curRate = val(doc, 'currentRate');
      var curTerm = val(doc, 'currentTermRemaining');

      if (!curBal || parseFloat(curBal) === 0) return null;

      sections.push({
        heading: 'Current Loan',
        rows: [
          { label: 'Current Balance', value: '$' + Number(curBal).toLocaleString() },
          { label: 'Current Rate', value: curRate + '%' },
          { label: 'Remaining Term', value: curTerm + ' months' }
        ]
      });

      // New loan
      var newAmt = val(doc, 'refiLoanAmount');
      var newRate = val(doc, 'refiRate');
      var newTerm = val(doc, 'refiTerm');

      if (newAmt) {
        sections.push({
          heading: 'New Loan',
          rows: [
            { label: 'Loan Amount', value: '$' + Number(newAmt).toLocaleString() },
            { label: 'New Rate', value: newRate + '%' },
            { label: 'New Term', value: newTerm + ' years' }
          ]
        });
      }

      // Breakeven results
      var monthlySavings = txt(doc, 'resultMonthlySavings');
      var breakeven = txt(doc, 'resultBreakevenNow');
      var closingCosts = txt(doc, 'resultTotalClosingCost');
      var netSavings = txt(doc, 'resultNetSavings');
      var curPayment = txt(doc, 'compareCurrentPayment');
      var newPayment = txt(doc, 'compareNewPayment');

      if (monthlySavings) {
        sections.push({
          heading: 'Breakeven Analysis',
          rows: [
            { label: 'Current Payment', value: curPayment },
            { label: 'New Payment', value: newPayment },
            { label: 'Monthly Savings', value: monthlySavings },
            { label: 'Total Closing Costs', value: closingCosts },
            { label: 'Breakeven Point', value: breakeven, isTotal: true },
            { label: 'Net Savings', value: netSavings }
          ]
        });
      }

      // Cost of waiting (if populated)
      var extraInterest = txt(doc, 'resultExtraInterest');
      if (extraInterest) {
        var futurePayment = txt(doc, 'resultFuturePayment');
        var futureSavings = txt(doc, 'resultFutureSavings');
        var breakWait = txt(doc, 'resultBreakevenWait');
        sections.push({
          heading: 'Cost of Waiting',
          rows: [
            { label: 'Extra Interest Paid', value: extraInterest },
            { label: 'Future Payment', value: futurePayment },
            { label: 'Future Savings vs Current', value: futureSavings },
            { label: 'Breakeven If You Wait', value: breakWait }
          ]
        });
      }

      return { title: 'Refinance Breakeven Analysis', sections: sections };
    });
  }
})();
