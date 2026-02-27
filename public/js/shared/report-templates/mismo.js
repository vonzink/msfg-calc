/* Report template: MISMO Document Analyzer — Enhanced */
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
          html += '<div class="rpt-param"><span>' + esc(f.label) + '</span><span>' + esc(f.value) + '</span></div>';
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
        html += '<table class="rpt-table"><thead><tr><th style="width:50px">Status</th><th>Document</th><th>Reason</th></tr></thead><tbody>';
        sec.items.forEach(function (item) {
          var icon = '\u25CF'; var color = '#c62828';
          if (item.status === 'ok') { icon = '\u2713'; color = '#2e7d32'; }
          else if (item.status === 'conditional') { icon = '\u25B2'; color = '#e65100'; }
          html += '<tr>';
          html += '<td style="text-align:center;color:' + color + ';font-weight:700">' + icon + '</td>';
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

      // Loan Summary — all fields
      var summaryBody = [
        [{ text: 'Loan Summary', style: 'tableHeader' }, { text: '', style: 'tableHeader' }]
      ];
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
          summaryBody.push([f.label, { text: f.value, alignment: 'right' }]);
        }
      });
      content.push({ table: { headerRows: 1, widths: ['*', 'auto'], body: summaryBody }, layout: 'lightHorizontalLines' });

      // Status Chips
      if (data.chips && data.chips.length) {
        content.push({ text: 'Status Indicators', style: 'sectionTitle', margin: [0, 10, 0, 4] });
        data.chips.forEach(function (chip) {
          var color = '#333';
          if (chip.status === 'ok') color = '#2e7d32';
          else if (chip.status === 'warn') color = '#e65100';
          else if (chip.status === 'need') color = '#c62828';
          content.push({ text: chip.label, color: color, fontSize: 9, bold: true, margin: [0, 2, 0, 2] });
        });
      }

      // Complexity flags
      if (data.complexityFlags && data.complexityFlags.length) {
        content.push({ text: 'Complexity: ' + data.complexityFlags.join(' | '), fontSize: 8, color: '#1565c0', margin: [0, 4, 0, 4] });
      }

      // Checklist Sections
      data.sections.forEach(function (sec) {
        if (!sec.items || !sec.items.length) return;
        content.push({ text: sec.title, style: 'sectionTitle', margin: [0, 10, 0, 4] });
        var body = [
          [{ text: 'Status', style: 'tableHeader', alignment: 'center' },
           { text: 'Document', style: 'tableHeader' },
           { text: 'Reason', style: 'tableHeader' }]
        ];
        sec.items.forEach(function (item) {
          var icon = '\u25CF'; var color = '#c62828';
          if (item.status === 'ok') { icon = '\u2713'; color = '#2e7d32'; }
          else if (item.status === 'conditional') { icon = '\u25B2'; color = '#e65100'; }
          body.push([
            { text: icon, alignment: 'center', color: color, bold: true },
            { text: item.name, fontSize: 9 },
            { text: item.reason, fontSize: 8, color: '#666' }
          ]);
        });
        content.push({
          table: { headerRows: 1, widths: [30, '*', '*'], body: body },
          layout: 'lightHorizontalLines'
        });
      });

      return content;
    }
  );
})();
