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

      // Loan parameters
      var loanAmt = val(doc, 'loanAmount');
      var noteRate = val(doc, 'noteRate');
      var loanTerm = val(doc, 'loanTerm');
      var buydownType = val(doc, 'buydownType');

      if (!loanAmt || parseFloat(loanAmt) === 0) return null;

      sections.push({
        heading: 'Loan Parameters',
        rows: [
          { label: 'Loan Amount', value: '$' + Number(loanAmt).toLocaleString() },
          { label: 'Note Rate', value: noteRate + '%' },
          { label: 'Loan Term', value: loanTerm },
          { label: 'Buydown Type', value: buydownType }
        ]
      });

      // Results
      var basePayment = txt(doc, 'basePayment');
      var year1Payment = txt(doc, 'year1Payment');
      var year1Savings = txt(doc, 'year1Savings');
      var totalCost = txt(doc, 'totalCost');

      if (basePayment) {
        var resultRows = [
          { label: 'Full Rate Payment', value: basePayment },
          { label: 'Year 1 Payment', value: year1Payment },
          { label: 'Year 1 Savings', value: year1Savings },
          { label: 'Total Buydown Cost', value: totalCost, isTotal: true }
        ];
        sections.push({ heading: 'Buydown Results', rows: resultRows });
      }

      // Year-by-year breakdown (if present)
      var breakdownEl = doc.getElementById('yearlyBreakdown');
      if (breakdownEl) {
        var yearRows = [];
        breakdownEl.querySelectorAll('tr').forEach(function (tr) {
          var cells = tr.querySelectorAll('td');
          if (cells.length >= 3) {
            yearRows.push({ label: cells[0].textContent.trim(), value: cells[1].textContent.trim() + '  (save ' + cells[2].textContent.trim() + ')' });
          }
        });
        if (yearRows.length) {
          sections.push({ heading: 'Year-by-Year Breakdown', rows: yearRows });
        }
      }

      return { title: 'Buydown Calculator', sections: sections };
    });
  }
})();
