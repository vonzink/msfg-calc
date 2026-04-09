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

      // Debt entries
      var debtRows = [];
      for (var i = 1; i <= 5; i++) {
        var bal = val(doc, 'd' + i + '_bal');
        var rate = val(doc, 'd' + i + '_rate');
        var pay = val(doc, 'd' + i + '_pay');
        if (bal && parseFloat(bal) > 0) {
          debtRows.push({ label: 'Debt ' + i, value: '$' + Number(bal).toLocaleString() + '  @  ' + rate + '%  —  $' + Number(pay).toLocaleString() + '/mo' });
        }
      }
      if (debtRows.length) {
        sections.push({ heading: 'Debt Entries', rows: debtRows });
      }

      // Results
      var totalBal = txt(doc, 'totalBal');
      var totalPay = txt(doc, 'totalPay');
      var blendedRate = txt(doc, 'blendedRate');

      if (!totalBal || totalBal === '$0') return null;

      sections.push({
        heading: 'Results',
        rows: [
          { label: 'Total Balance', value: totalBal },
          { label: 'Total Monthly Payment', value: totalPay },
          { label: 'Blended Interest Rate', value: blendedRate, isTotal: true }
        ]
      });

      return { title: 'Blended Rate Calculator', sections: sections };
    });
  }
})();
