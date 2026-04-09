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
    if (el.type === 'checkbox') return el.checked ? 'Yes' : '';
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
      var propVal = val(doc, 'propertyValue');
      var score = val(doc, 'creditScore');
      var term = val(doc, 'termYears');
      var baseRate = val(doc, 'baseRate');
      var startPts = val(doc, 'startingPoints');

      if (!loanAmt || parseFloat(loanAmt) === 0) return null;

      var paramRows = [
        { label: 'Loan Amount', value: '$' + Number(loanAmt).toLocaleString() },
        { label: 'Property Value', value: '$' + Number(propVal).toLocaleString() },
        { label: 'Credit Score', value: score },
        { label: 'Term', value: term },
        { label: 'Base Rate', value: baseRate + '%' },
        { label: 'Starting Points', value: startPts }
      ];

      // Flags
      var flags = [];
      if (val(doc, 'isCondo') === 'Yes') flags.push('Condo');
      if (val(doc, 'isManufacturedHome') === 'Yes') flags.push('Manufactured Home');
      if (val(doc, 'isHighBalance') === 'Yes') flags.push('High Balance');
      if (val(doc, 'hasSubordinateFinancing') === 'Yes') flags.push('Subordinate Financing');
      if (val(doc, 'isHighLTVRefi') === 'Yes') flags.push('High LTV Refi');
      if (val(doc, 'applyMMI') === 'Yes') flags.push('MMI Applied');
      if (flags.length) paramRows.push({ label: 'Flags', value: flags.join(', ') });

      sections.push({ heading: 'Loan Parameters', rows: paramRows });

      // Results
      var chipLTV = txt(doc, 'chipLTV');
      var chipTotal = txt(doc, 'chipTotal');
      var finalPoints = txt(doc, 'kvFinalPoints');
      var finalPrice = txt(doc, 'kvFinalPrice');
      var dollarImpact = txt(doc, 'kvDollarImpact');

      sections.push({
        heading: 'LLPA Results',
        rows: [
          { label: 'Gross LTV', value: chipLTV.replace('Gross LTV:', '').trim() },
          { label: 'Total LLPAs', value: chipTotal.replace('Total LLPAs:', '').trim() },
          { label: 'Final Points', value: finalPoints },
          { label: 'Final Price', value: finalPrice },
          { label: 'Dollar Impact', value: dollarImpact, isTotal: true }
        ]
      });

      // Breakdown table
      var table = doc.getElementById('breakdownTable');
      if (table) {
        var breakdownRows = [];
        table.querySelectorAll('tbody tr').forEach(function (tr) {
          var cells = tr.querySelectorAll('td');
          if (cells.length >= 2) {
            var name = cells[0].textContent.trim();
            var adj = cells[cells.length - 1].textContent.trim();
            if (name && adj && adj !== '0.000') {
              breakdownRows.push({ label: name, value: adj });
            }
          }
        });
        if (breakdownRows.length) {
          sections.push({ heading: 'LLPA Breakdown', rows: breakdownRows });
        }
      }

      return { title: 'LLPM Analysis', sections: sections };
    });
  }
})();
