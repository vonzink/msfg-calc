/* Report template: Conditions & Documents */
(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;

  RT.register('mismo',
    /* ---- EXTRACTOR ---- */
    function (doc) {
      // Loan summary — original + enhanced fields
      var kvFields = ['kvBorrower', 'kvPurpose', 'kvType', 'kvAmount', 'kvPropertyType', 'kvOccupancy', 'kvLTV', 'kvProperty'];
      var summary = {};
      kvFields.forEach(function (id) {
        var el = doc.getElementById(id);
        summary[id] = el ? el.textContent.trim() : '';
      });

      // Bail if no data loaded
      if (summary.kvBorrower === '\u2014' && summary.kvPurpose === '\u2014') return null;

      // Status chips — expanded set
      var chipIds = ['chipProgram', 'chipEmp', 'chipRes', 'chipGaps', 'chipREO', 'chipDec'];
      var chips = [];
      chipIds.forEach(function (id) {
        var chip = doc.getElementById(id);
        if (!chip) return;
        var status = 'pending';
        if (chip.classList.contains('mismo-chip--ok')) status = 'ok';
        else if (chip.classList.contains('mismo-chip--warn')) status = 'warn';
        else if (chip.classList.contains('mismo-chip--need')) status = 'need';
        chips.push({ label: chip.textContent.trim(), status: status });
      });

      // Complexity flags
      var complexityEl = doc.getElementById('mismoComplexity');
      var complexityFlags = [];
      if (complexityEl) {
        complexityEl.querySelectorAll('.mismo-complexity-flag').forEach(function (f) {
          complexityFlags.push(f.textContent.trim());
        });
      }

      // Checklist sections
      var sectionDefs = [
        { id: 'incomeChecklist', title: 'Income Documentation' },
        { id: 'generalChecklist', title: 'General Documentation' },
        { id: 'assetChecklist', title: 'Asset Documentation' },
        { id: 'creditChecklist', title: 'Credit Documentation' }
      ];

      var sections = [];
      sectionDefs.forEach(function (sec) {
        var container = doc.getElementById(sec.id);
        if (!container) return;
        var items = [];
        container.querySelectorAll('.mismo-doc-item').forEach(function (item) {
          var statusEl = item.querySelector('.mismo-doc-item__status');
          var nameEl = item.querySelector('.mismo-doc-item__name');
          var reasonEl = item.querySelector('.mismo-doc-item__reason');

          var status = statusEl ? statusEl.value : 'required';
          var name = nameEl ? nameEl.value.trim() : '';
          var reason = reasonEl ? reasonEl.value.trim() : '';

          if (name) items.push({ name: name, status: status, reason: reason });
        });
        sections.push({ title: sec.title, items: items });
      });

      return {
        borrower: summary.kvBorrower,
        purpose: summary.kvPurpose,
        loanType: summary.kvType,
        amount: summary.kvAmount,
        propertyType: summary.kvPropertyType,
        occupancy: summary.kvOccupancy,
        ltv: summary.kvLTV,
        property: summary.kvProperty,
        chips: chips,
        complexityFlags: complexityFlags,
        sections: sections
      };
    },

    /* ---- RENDERER ---- */
    function (data) {
      var esc = MSFG.escHtml;
      var html = '';

      // Loan Summary
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Summary</h4>';
      html += '<div class="rpt-params">';
      var summaryFields = [
        { label: 'Borrower(s)', value: data.borrower },
        { label: 'Loan Purpose', value: data.purpose },
        { label: 'Loan Type', value: data.loanType },
        { label: 'Loan Amount', value: data.amount },
        { label: 'Property Type', value: data.propertyType },
        { label: 'Occupancy', value: data.occupancy },
        { label: 'LTV', value: data.ltv },
        { label: 'Subject Property', value: data.property }
      ];
      summaryFields.forEach(function (f) {
        if (f.value && f.value !== '\u2014') {
          var bold = f.label === 'Borrower(s)';
          html += '<div class="rpt-param"><span>' + esc(f.label) + '</span><span' + (bold ? ' style="font-weight:700;font-size:1.05em"' : '') + '>' + esc(f.value) + '</span></div>';
        }
      });
      html += '</div></div>';

      // Status Chips
      if (data.chips && data.chips.length) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">Status Indicators</h4>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">';
        data.chips.forEach(function (chip) {
          var bg = '#e0e0e0'; var color = '#333';
          if (chip.status === 'ok') { bg = '#e8f5e9'; color = '#2e7d32'; }
          else if (chip.status === 'warn') { bg = '#fff3e0'; color = '#e65100'; }
          else if (chip.status === 'need') { bg = '#ffebee'; color = '#c62828'; }
          html += '<span style="display:inline-block;padding:4px 12px;border-radius:12px;font-size:0.82rem;font-weight:600;background:' + bg + ';color:' + color + '">' + esc(chip.label) + '</span>';
        });
        html += '</div>';
        // Complexity flags
        if (data.complexityFlags && data.complexityFlags.length) {
          html += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">';
          data.complexityFlags.forEach(function (flag) {
            html += '<span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;background:#e3f2fd;color:#1565c0;border:1px solid #90caf9">' + esc(flag) + '</span>';
          });
          html += '</div>';
        }
        html += '</div>';
      }

      // Checklist Sections
      data.sections.forEach(function (sec) {
        if (!sec.items || !sec.items.length) return;
        html += '<div class="rpt-section"><h4 class="rpt-section-title">' + esc(sec.title) + '</h4>';
        html += '<table class="rpt-table"><thead><tr><th style="width:90px">Status</th><th>Document</th><th>Reason</th></tr></thead><tbody>';
        sec.items.forEach(function (item) {
          var label = 'Required'; var color = '#c62828';
          if (item.status === 'ok') { label = 'Cleared'; color = '#2e7d32'; }
          else if (item.status === 'conditional') { label = 'Conditional'; color = '#e65100'; }
          else if (item.status === 'incomplete') { label = 'Incomplete'; color = '#1565c0'; }
          html += '<tr>';
          html += '<td style="text-align:center;color:' + color + ';font-weight:700;font-size:0.82em">' + label + '</td>';
          html += '<td>' + esc(item.name) + '</td>';
          html += '<td style="font-size:0.85em;color:#666">' + esc(item.reason) + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      });

      return html;
    },

    /* ---- PDF GENERATOR ---- */
    function (data) {
      var content = [];

      // Loan Summary + Status side by side
      var summaryFields = [
        { label: 'Borrower(s)', value: data.borrower },
        { label: 'Purpose', value: data.purpose },
        { label: 'Type', value: data.loanType },
        { label: 'Amount', value: data.amount },
        { label: 'Prop. Type', value: data.propertyType },
        { label: 'Occupancy', value: data.occupancy },
        { label: 'LTV', value: data.ltv },
        { label: 'Property', value: data.property }
      ];
      var sBody = [];
      summaryFields.forEach(function (f) {
        if (f.value && f.value !== '\u2014') {
          var isBorrower = f.label === 'Borrower(s)';
          sBody.push([{ text: f.label, fontSize: 6, color: '#6c757d' }, { text: f.value, fontSize: 6, alignment: 'right', bold: isBorrower }]);
        }
      });
      var tightLay = { hLineWidth: function(i, node) { return (i === 0 || i === node.table.body.length) ? 0 : 0.5; }, vLineWidth: function() { return 0; }, hLineColor: function() { return '#e2e6ea'; }, paddingLeft: function() { return 3; }, paddingRight: function() { return 3; }, paddingTop: function() { return 1.5; }, paddingBottom: function() { return 1.5; } };

      // Status chips as inline text
      var chipStack = [];
      if (data.chips && data.chips.length) {
        var chipTexts = data.chips.map(function (chip) {
          var color = '#333';
          if (chip.status === 'ok') color = '#2e7d32';
          else if (chip.status === 'warn') color = '#b8960c';
          else if (chip.status === 'need') color = '#c62828';
          return { text: chip.label, color: color, fontSize: 6, bold: true };
        });
        chipStack.push({ text: 'Status Indicators', style: 'sectionTitle', margin: [0, 0, 0, 2] });
        // Render each chip on its own line
        chipTexts.forEach(function(ct) { chipStack.push({ text: ct.text, color: ct.color, fontSize: ct.fontSize, bold: ct.bold, margin: [0, 1, 0, 1] }); });
      }
      if (data.complexityFlags && data.complexityFlags.length) {
        chipStack.push({ text: 'Complexity: ' + data.complexityFlags.join(' | '), fontSize: 6.5, color: '#1565c0', margin: [0, 2, 0, 0] });
      }

      content.push({
        columns: [
          { width: '55%', table: { widths: ['*', 'auto'], body: sBody }, layout: tightLay },
          { width: '3%', text: '' },
          { width: '42%', stack: chipStack }
        ],
        columnGap: 0,
        margin: [0, 0, 0, 4]
      });

      // Checklist Sections — compact tables
      data.sections.forEach(function (sec) {
        if (!sec.items || !sec.items.length) return;
        content.push({ text: sec.title, style: 'sectionTitle', margin: [0, 4, 0, 2] });
        var body = [
          [{ text: 'Status', style: 'tableHeader', alignment: 'center' },
           { text: 'Document', style: 'tableHeader' },
           { text: 'Reason', style: 'tableHeader' }]
        ];
        sec.items.forEach(function (item) {
          var label = 'Required'; var color = '#c62828';
          if (item.status === 'ok') { label = 'Cleared'; color = '#2e7d32'; }
          else if (item.status === 'conditional') { label = 'Conditional'; color = '#b8960c'; }
          else if (item.status === 'incomplete') { label = 'Incomplete'; color = '#1565c0'; }
          body.push([
            { text: label, alignment: 'center', color: color, bold: true, fontSize: 6.5 },
            { text: item.name, fontSize: 6 },
            { text: item.reason, fontSize: 6.5, color: '#666' }
          ]);
        });
        content.push({
          table: { headerRows: 1, widths: [50, '*', '*'], body: body },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 2]
        });
      });

      return content;
    }
  );
})();
