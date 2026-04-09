/* Report template: LLPM Tool (LLPA / LLPM Calculator) */
(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;
  var h = RT.helpers;
  var val = h.val, txt = h.txt, fmt = h.fmt, fmt0 = h.fmt0, ratePct = h.ratePct;

  /* Helper: read checked radio value by name */
  function radioVal(doc, name) {
    var el = doc.querySelector('input[type="radio"][name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  /* Helper: read checkbox state by id */
  function chk(doc, id) {
    var el = doc.getElementById(id);
    return el ? !!el.checked : false;
  }

  RT.register('llpm',
    /* ---- Extractor ---- */
    function (doc) {
      // Inputs
      var inputs = {
        loanAmount: val(doc, 'loanAmount'),
        propertyValue: val(doc, 'propertyValue'),
        creditScore: val(doc, 'creditScore'),
        termYears: txt(doc, 'termYears'),
        baseRate: val(doc, 'baseRate'),
        startingPoints: val(doc, 'startingPoints'),
        units: txt(doc, 'units'),
        purpose: radioVal(doc, 'purpose'),
        productType: radioVal(doc, 'productType'),
        occupancy: radioVal(doc, 'occupancy'),
        isCondo: chk(doc, 'isCondo'),
        isManufacturedHome: chk(doc, 'isManufacturedHome'),
        isHighBalance: chk(doc, 'isHighBalance'),
        hasSubordinateFinancing: chk(doc, 'hasSubordinateFinancing'),
        isHighLTVRefi: chk(doc, 'isHighLTVRefi'),
        applyMMI: chk(doc, 'applyMMI')
      };

      // Results
      var results = {
        grossLTV: txt(doc, 'chipLTV'),
        totalLLPAs: txt(doc, 'chipTotal'),
        finalPoints: txt(doc, 'kvFinalPoints'),
        finalPrice: txt(doc, 'kvFinalPrice'),
        dollarImpact: txt(doc, 'kvDollarImpact')
      };

      // Breakdown table rows
      var breakdown = [];
      var tbody = doc.querySelector('#breakdownTable tbody');
      if (tbody) {
        var rows = tbody.querySelectorAll('tr');
        for (var i = 0; i < rows.length; i++) {
          var cells = rows[i].querySelectorAll('td');
          if (cells.length >= 2) {
            var name = (cells[0].textContent || '').trim();
            var pts = (cells[1].textContent || '').trim();
            var reason = cells.length >= 3 ? (cells[2].textContent || '').trim() : '';
            if (name && name !== 'No adjustments') {
              breakdown.push({ name: name, points: pts, reason: reason });
            }
          }
        }
      }
      results.breakdown = breakdown;

      // Warnings
      var warnBox = doc.getElementById('warnings');
      var warnings = [];
      if (warnBox && warnBox.style.display !== 'none') {
        var lis = warnBox.querySelectorAll('li');
        for (var w = 0; w < lis.length; w++) {
          warnings.push((lis[w].textContent || '').trim());
        }
      }
      results.warnings = warnings;

      return { inputs: inputs, results: results };
    },

    /* ---- HTML Renderer ---- */
    function (data) {
      var inp = data.inputs;
      var res = data.results;
      var html = '';

      // Purpose / Product / Occupancy labels
      var purposeLabels = { 'Purchase': 'Purchase', 'LimitedCashOut': 'Limited Cash-Out', 'CashOut': 'Cash-Out' };
      var prodLabels = { 'Fixed': 'Fixed', 'ARM': 'ARM' };
      var occLabels = { 'Primary': 'Primary', 'SecondHome': 'Second Home', 'Investment': 'Investment' };

      html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Parameters</h4>';
      html += '<div class="rpt-params">';
      html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt0(inp.loanAmount) + '</span></div>';
      html += '<div class="rpt-param"><span>Property Value</span><span>' + fmt0(inp.propertyValue) + '</span></div>';
      html += '<div class="rpt-param"><span>Credit Score</span><span>' + (inp.creditScore || '\u2014') + '</span></div>';
      html += '<div class="rpt-param"><span>Term</span><span>' + inp.termYears + ' years</span></div>';
      html += '<div class="rpt-param"><span>Base Rate</span><span>' + ratePct(inp.baseRate) + '</span></div>';
      html += '<div class="rpt-param"><span>Starting Points</span><span>' + parseFloat(inp.startingPoints || 0).toFixed(3) + '</span></div>';
      if (parseInt(inp.units) > 1) html += '<div class="rpt-param"><span>Units</span><span>' + inp.units + '</span></div>';
      html += '<div class="rpt-param"><span>Purpose</span><span>' + (purposeLabels[inp.purpose] || inp.purpose) + '</span></div>';
      html += '<div class="rpt-param"><span>Product</span><span>' + (prodLabels[inp.productType] || inp.productType) + '</span></div>';
      html += '<div class="rpt-param"><span>Occupancy</span><span>' + (occLabels[inp.occupancy] || inp.occupancy) + '</span></div>';
      html += '</div>';

      // Flags
      var flags = [];
      if (inp.isCondo) flags.push('Condo');
      if (inp.isManufacturedHome) flags.push('Manufactured Home');
      if (inp.isHighBalance) flags.push('High-Balance');
      if (inp.hasSubordinateFinancing) flags.push('Subordinate Financing');
      if (inp.isHighLTVRefi) flags.push('High LTV Refinance');
      if (inp.applyMMI) flags.push('MMI Applied');
      if (flags.length) {
        html += '<div class="rpt-param"><span>Flags</span><span>' + MSFG.escHtml(flags.join(', ')) + '</span></div>';
      }
      html += '</div>';

      // Results summary
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Pricing Summary</h4>';
      html += '<div class="rpt-params">';
      html += '<div class="rpt-param"><span>Final Points</span><span>' + res.finalPoints + '</span></div>';
      html += '<div class="rpt-param"><span>Final Price</span><span>' + res.finalPrice + '</span></div>';
      html += '<div class="rpt-param"><span>Dollar Impact</span><span>' + res.dollarImpact + '</span></div>';
      html += '</div></div>';

      // Breakdown table
      if (res.breakdown && res.breakdown.length) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">LLPA Breakdown</h4>';
        html += '<table class="rpt-table"><thead><tr><th>Adjustment</th><th class="rpt-num">Points</th><th>Reason</th></tr></thead><tbody>';
        res.breakdown.forEach(function (row) {
          html += '<tr><td>' + MSFG.escHtml(row.name) + '</td><td class="rpt-num">' + MSFG.escHtml(row.points) + '</td><td>' + MSFG.escHtml(row.reason) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }

      // Warnings
      if (res.warnings && res.warnings.length) {
        html += '<div class="rpt-section" style="background:#fff7e6;padding:.75rem 1rem;border-radius:8px;border:1px solid #ffe0a3;color:#8a5a00">';
        html += '<strong>Heads up:</strong><ul style="margin:.5rem 0 0 1.2rem">';
        res.warnings.forEach(function (w) {
          html += '<li>' + MSFG.escHtml(w) + '</li>';
        });
        html += '</ul></div>';
      }

      return html;
    },

    /* ---- PDF Generator ---- */
    function (data) {
      var inp = data.inputs;
      var res = data.results;
      var content = [];

      var purposeLabels = { 'Purchase': 'Purchase', 'LimitedCashOut': 'Limited Cash-Out', 'CashOut': 'Cash-Out' };
      var prodLabels = { 'Fixed': 'Fixed', 'ARM': 'ARM' };
      var occLabels = { 'Primary': 'Primary', 'SecondHome': 'Second Home', 'Investment': 'Investment' };

      // Loan parameters
      var params = [
        ['Loan Amount', fmt0(inp.loanAmount)],
        ['Property Value', fmt0(inp.propertyValue)],
        ['Credit Score', String(inp.creditScore || '\u2014')],
        ['Term', inp.termYears + ' years'],
        ['Base Rate', ratePct(inp.baseRate)],
        ['Starting Points', parseFloat(inp.startingPoints || 0).toFixed(3)],
        ['Purpose', purposeLabels[inp.purpose] || inp.purpose],
        ['Product', prodLabels[inp.productType] || inp.productType],
        ['Occupancy', occLabels[inp.occupancy] || inp.occupancy]
      ];
      if (parseInt(inp.units) > 1) params.splice(5, 0, ['Units', inp.units]);

      var flags = [];
      if (inp.isCondo) flags.push('Condo');
      if (inp.isManufacturedHome) flags.push('Manufactured Home');
      if (inp.isHighBalance) flags.push('High-Balance');
      if (inp.hasSubordinateFinancing) flags.push('Subordinate Financing');
      if (inp.isHighLTVRefi) flags.push('High LTV Refinance');
      if (inp.applyMMI) flags.push('MMI Applied');
      if (flags.length) params.push(['Flags', flags.join(', ')]);

      // Results
      var results = [
        ['Final Points', res.finalPoints],
        ['Final Price', res.finalPrice],
        ['Dollar Impact', res.dollarImpact]
      ];

      content.push(h.pdfKeyValue(data, params, results));

      // Breakdown table
      if (res.breakdown && res.breakdown.length) {
        content.push({ text: 'LLPA Breakdown', style: 'sectionHeader', margin: [0, 4, 0, 2] });

        var body = [
          [
            { text: 'Adjustment', style: 'tableHeader' },
            { text: 'Points', style: 'tableHeader', alignment: 'right' },
            { text: 'Reason', style: 'tableHeader' }
          ]
        ];
        res.breakdown.forEach(function (row) {
          body.push([
            { text: row.name, fontSize: 7.5 },
            { text: row.points, fontSize: 7.5, alignment: 'right' },
            { text: row.reason || '', fontSize: 7.5, color: '#666' }
          ]);
        });

        content.push({
          table: { headerRows: 1, widths: ['*', 40, '*'], body: body },
          layout: {
            hLineWidth: function () { return 0.5; },
            vLineWidth: function () { return 0; },
            hLineColor: function () { return '#e0e0e0'; },
            paddingLeft: function () { return 6; },
            paddingRight: function () { return 6; },
            paddingTop: function () { return 3; },
            paddingBottom: function () { return 3; }
          }
        });
      }

      // Warnings
      if (res.warnings && res.warnings.length) {
        content.push({ text: 'Warnings', style: 'sectionHeader', margin: [0, 4, 0, 2] });
        var warnList = res.warnings.map(function (w) { return { text: w, fontSize: 7.5, color: '#8a5a00' }; });
        content.push({ ul: warnList, margin: [10, 0, 0, 0] });
      }

      return content;
    }
  );
})();
