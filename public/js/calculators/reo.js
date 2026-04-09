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

      // Property info
      var street = val(doc, 'street');
      var city = val(doc, 'city');
      var price = val(doc, 'purchasePrice');

      if (!price || parseFloat(price) === 0) return null;

      var propRows = [{ label: 'Purchase Price', value: '$' + Number(price).toLocaleString() }];
      if (street) propRows.unshift({ label: 'Property', value: street + (city ? ', ' + city : ''), bold: true });

      var down = val(doc, 'downPct');
      var rate = val(doc, 'rate');
      var term = val(doc, 'termYears');
      if (down) propRows.push({ label: 'Down Payment', value: down + '%' });
      if (rate) propRows.push({ label: 'Interest Rate', value: rate + '%' });
      if (term) propRows.push({ label: 'Loan Term', value: term + ' years' });
      sections.push({ heading: 'Property & Financing', rows: propRows });

      // Key metrics
      var r2p = txt(doc, 'r2p');
      var renoTotal = txt(doc, 'renoTotal');
      var cashInvested = txt(doc, 'cashInvested');
      var noiMonthly = txt(doc, 'noiMonthly');

      var metricRows = [];
      if (r2p) metricRows.push({ label: 'Rent-to-Price Ratio', value: r2p });
      if (renoTotal) metricRows.push({ label: 'Total Renovation', value: renoTotal });
      if (cashInvested) metricRows.push({ label: 'Cash Invested', value: cashInvested });
      if (noiMonthly) metricRows.push({ label: 'Monthly NOI', value: noiMonthly, isTotal: true });
      if (metricRows.length) {
        sections.push({ heading: 'Key Metrics', rows: metricRows });
      }

      // 5-Year projection
      var projRows = [];
      for (var y = 1; y <= 5; y++) {
        var pv = txt(doc, 'pv' + y);
        var cf = txt(doc, 'cf' + y);
        var coc = txt(doc, 'coc' + y);
        var eq = txt(doc, 'eq' + y);
        if (pv) {
          projRows.push({ label: 'Year ' + y, value: 'Value: ' + pv + '  |  Cash Flow: ' + cf + '  |  CoC: ' + coc + '  |  Equity: ' + eq });
        }
      }
      if (projRows.length) {
        sections.push({ heading: '5-Year Projection', rows: projRows });
      }

      return { title: 'REO Investment Analysis', sections: sections };
    });
  }
})();
