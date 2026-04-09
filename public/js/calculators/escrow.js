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
    if (!el) return '';
    if (el.tagName === 'SELECT') return el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
    return el.value;
  }

  if (MSFG.CalcActions) {
    MSFG.CalcActions.register(function () {
      var doc = getIframeDoc();
      if (!doc) return null;

      var sections = [];

      // Loan info
      var loanType = val(doc, 'loanType');
      var state = val(doc, 'state');
      var closingDate = val(doc, 'closingDate');
      var firstPayment = val(doc, 'firstPaymentDate');

      if (!closingDate) return null;

      sections.push({
        heading: 'Loan Information',
        rows: [
          { label: 'Loan Type', value: loanType },
          { label: 'State', value: state },
          { label: 'Closing Date', value: closingDate },
          { label: 'First Payment Date', value: firstPayment }
        ].filter(function (r) { return r.value; })
      });

      // Tax & Insurance inputs
      var annualTax = val(doc, 'annualTax');
      var annualIns = val(doc, 'annualIns');
      var cushion = val(doc, 'cushionMonths');
      var inputRows = [];
      if (annualTax) inputRows.push({ label: 'Annual Property Tax', value: '$' + Number(annualTax).toLocaleString() });
      if (annualIns) inputRows.push({ label: 'Annual Insurance', value: '$' + Number(annualIns).toLocaleString() });
      if (cushion) inputRows.push({ label: 'Escrow Cushion', value: cushion + ' months' });
      if (inputRows.length) sections.push({ heading: 'Tax & Insurance', rows: inputRows });

      // Results
      var taxDeposit = txt(doc, 'resultTaxDeposit');
      var insDeposit = txt(doc, 'resultInsDeposit');
      var totalDeposit = txt(doc, 'resultTotalDeposit');
      var aggAdj = txt(doc, 'resultAggregateAdj');

      if (!totalDeposit) return null;

      var resultRows = [
        { label: 'Tax Escrow Deposit', value: taxDeposit },
        { label: 'Insurance Escrow Deposit', value: insDeposit },
        { label: 'Total Initial Escrow Deposit', value: totalDeposit, isTotal: true }
      ];
      if (aggAdj) resultRows.push({ label: 'Aggregate Adjustment', value: aggAdj });
      sections.push({ heading: 'Escrow Results', rows: resultRows });

      // Section F & G (prepaids & initial escrow)
      var sectionF = txt(doc, 'resultSectionF');
      var sectionG = txt(doc, 'resultSectionG');
      if (sectionF || sectionG) {
        var cdRows = [];
        if (sectionF) cdRows.push({ label: 'Section F — Prepaids', value: sectionF, stacked: true });
        if (sectionG) cdRows.push({ label: 'Section G — Initial Escrow', value: sectionG, stacked: true });
        sections.push({ heading: 'CD Breakdown', rows: cdRows });
      }

      return { title: 'Escrow Prepaids Calculator', sections: sections };
    });
  }
})();
