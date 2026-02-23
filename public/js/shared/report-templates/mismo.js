/* Report template: MISMO Document Analyzer */
(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;

  RT.register('mismo',
    /* ---- EXTRACTOR ---- */
    function (doc) {
      // Loan summary
      var borrowerEl = doc.getElementById('kvBorrower');
      var purposeEl = doc.getElementById('kvPurpose');
      var typeEl = doc.getElementById('kvType');
      var amountEl = doc.getElementById('kvAmount');

      var borrower = borrowerEl ? borrowerEl.textContent.trim() : '';
      var purpose = purposeEl ? purposeEl.textContent.trim() : '';
      var loanType = typeEl ? typeEl.textContent.trim() : '';
      var amount = amountEl ? amountEl.textContent.trim() : '';

      // Bail if no data loaded
      if (borrower === '\u2014' && purpose === '\u2014') return null;

      // Status chips
      var chipIds = ['chipEmp', 'chipRes', 'chipREO', 'chipDec'];
      var chips = [];
      chipIds.forEach(function (id) {
        var el = doc.getElementById(id);
        if (!el) return;
        var status = 'pending';
        if (el.classList.contains('ok')) status = 'ok';
        else if (el.classList.contains('warn')) status = 'warn';
        else if (el.classList.contains('need')) status = 'need';
        chips.push({ label: el.textContent.trim(), status: status });
      });

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
        container.querySelectorAll('.doc-item').forEach(function (item) {
          var status = 'required';
          if (item.classList.contains('ok')) status = 'ok';
          else if (item.classList.contains('conditional')) status = 'conditional';

          var nameEl = item.querySelector('.doc-name');
          var reasonEl = item.querySelector('.doc-reason');

          var name = '';
          if (nameEl) {
            var statusSpan = nameEl.querySelector('.doc-status');
            var statusText = statusSpan ? statusSpan.textContent : '';
            name = nameEl.textContent.replace(statusText, '').trim();
          }
          var reason = reasonEl ? reasonEl.textContent.trim() : '';
          items.push({ name: name, status: status, reason: reason });
        });
        sections.push({ title: sec.title, items: items });
      });

      return {
        borrower: borrower,
        purpose: purpose,
        loanType: loanType,
        amount: amount,
        chips: chips,
        sections: sections
      };
    },

    /* ---- RENDERER ---- */
    function (data) {
      var html = '';

      // Loan Summary
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Summary</h4>';
      html += '<div class="rpt-params">';
      if (data.borrower) html += '<div class="rpt-param"><span>Borrower(s)</span><span>' + data.borrower + '</span></div>';
      if (data.purpose && data.purpose !== '\u2014') html += '<div class="rpt-param"><span>Loan Purpose</span><span>' + data.purpose + '</span></div>';
      if (data.loanType && data.loanType !== '\u2014') html += '<div class="rpt-param"><span>Loan Type</span><span>' + data.loanType + '</span></div>';
      if (data.amount && data.amount !== '\u2014') html += '<div class="rpt-param"><span>Loan Amount</span><span>' + data.amount + '</span></div>';
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
          html += '<span style="display:inline-block;padding:4px 12px;border-radius:12px;font-size:0.82rem;font-weight:600;background:' + bg + ';color:' + color + '">' + chip.label + '</span>';
        });
        html += '</div></div>';
      }

      // Checklist Sections
      data.sections.forEach(function (sec) {
        if (!sec.items || !sec.items.length) return;
        html += '<div class="rpt-section"><h4 class="rpt-section-title">' + sec.title + '</h4>';
        html += '<table class="rpt-table"><thead><tr><th style="width:50px">Status</th><th>Document</th><th>Reason</th></tr></thead><tbody>';
        sec.items.forEach(function (item) {
          var icon = '\u25CF'; var color = '#c62828';
          if (item.status === 'ok') { icon = '\u2713'; color = '#2e7d32'; }
          else if (item.status === 'conditional') { icon = '\u25B2'; color = '#e65100'; }
          html += '<tr>';
          html += '<td style="text-align:center;color:' + color + ';font-weight:700">' + icon + '</td>';
          html += '<td>' + item.name + '</td>';
          html += '<td style="font-size:0.85em;color:#666">' + item.reason + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      });

      return html;
    },

    /* ---- PDF GENERATOR ---- */
    function (data) {
      var content = [];

      // Loan Summary
      var summaryBody = [
        [{ text: 'Loan Summary', style: 'tableHeader' }, { text: '', style: 'tableHeader' }]
      ];
      if (data.borrower) summaryBody.push(['Borrower(s)', { text: data.borrower, alignment: 'right' }]);
      if (data.purpose && data.purpose !== '\u2014') summaryBody.push(['Loan Purpose', { text: data.purpose, alignment: 'right' }]);
      if (data.loanType && data.loanType !== '\u2014') summaryBody.push(['Loan Type', { text: data.loanType, alignment: 'right' }]);
      if (data.amount && data.amount !== '\u2014') summaryBody.push(['Loan Amount', { text: data.amount, alignment: 'right' }]);
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
