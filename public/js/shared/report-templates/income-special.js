(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;
  var h = RT.helpers;
  var val = h.val, txt = h.txt, fmt = h.fmt, fmt0 = h.fmt0, pct = h.pct, ratePct = h.ratePct;

  /* ---- Income: Rental 1038 ---- */
  RT.register('income/rental-1038',
    function (doc) {
      return {
        methodA: {
          address: txt(doc,'methodA_address'),
          months: val(doc,'methodA_months'),
          rents: val(doc,'methodA_rents'),
          expenses: val(doc,'methodA_expenses'),
          insurance: val(doc,'methodA_insurance'),
          mortgageInterest: val(doc,'methodA_mortint'),
          taxes: val(doc,'methodA_taxes'),
          hoa: val(doc,'methodA_hoa'),
          depreciation: val(doc,'methodA_deprec'),
          oneTime: val(doc,'methodA_onetime'),
          pitia: val(doc,'methodA_pitia'),
          adjusted: val(doc,'methodA_adjusted'),
          result: val(doc,'methodA_result')
        },
        methodB: {
          address: txt(doc,'methodB_address'),
          grossRent: val(doc,'methodB_grossrent'),
          pitia: val(doc,'methodB_pitia'),
          adjusted: val(doc,'methodB_adjusted'),
          result: val(doc,'methodB_result')
        },
        totalMonthly: val(doc,'methodA_result')
      };
    },
    function (data) {
      var a = data.methodA;
      var html = '<div class="rpt-section"><h4 class="rpt-section-title">Method A \u2014 Schedule E Analysis</h4>';
      if (a.address) html += '<p class="rpt-address">' + a.address + '</p>';
      html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
      html += '<tr><td>Months in Service</td><td class="rpt-num">' + a.months + '</td></tr>';
      html += '<tr><td>Total Rents Received</td><td class="rpt-num">' + fmt(a.rents) + '</td></tr>';
      html += '<tr><td>Total Expenses</td><td class="rpt-num">' + fmt(a.expenses) + '</td></tr>';
      html += '<tr><td>Depreciation</td><td class="rpt-num">' + fmt(a.depreciation) + '</td></tr>';
      html += '<tr><td>Insurance</td><td class="rpt-num">' + fmt(a.insurance) + '</td></tr>';
      html += '<tr><td>Mortgage Interest</td><td class="rpt-num">' + fmt(a.mortgageInterest) + '</td></tr>';
      html += '<tr><td>Taxes</td><td class="rpt-num">' + fmt(a.taxes) + '</td></tr>';
      html += '<tr><td>HOA Dues</td><td class="rpt-num">' + fmt(a.hoa) + '</td></tr>';
      html += '<tr><td>PITIA Payment</td><td class="rpt-num">' + fmt(a.pitia) + '</td></tr>';
      html += '</tbody></table>';
      html += '<div class="rpt-grand-total"><span>Monthly Qualifying Income</span><span>' + fmt(a.result) + '</span></div>';
      html += '</div>';
      return html;
    },
    function (data) {
      var a = data.methodA;
      var body = [
        [{ text: 'Item', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }],
        ['Months in Service', { text: String(a.months), alignment: 'right' }],
        ['Total Rents', { text: fmt(a.rents), alignment: 'right' }],
        ['Total Expenses', { text: fmt(a.expenses), alignment: 'right' }],
        ['Depreciation', { text: fmt(a.depreciation), alignment: 'right' }],
        ['PITIA Payment', { text: fmt(a.pitia), alignment: 'right' }]
      ];
      return [
        a.address ? { text: a.address, italics: true, margin: [0, 4, 0, 4] } : null,
        { table: { headerRows: 1, widths: ['*', 100], body: body }, layout: 'lightHorizontalLines' },
        { columns: [{ text: 'Monthly Qualifying Income', bold: true, fontSize: 12, color: '#2d6a4f' }, { text: fmt(a.result), alignment: 'right', bold: true, fontSize: 12, color: '#2d6a4f' }], margin: [0, 8, 0, 0] }
      ].filter(Boolean);
    }
  );

  /* ---- Variable Income Analyzer ---- */
  RT.register('var-income',
    function (doc) {
      var employments = [];
      var panels = doc.querySelectorAll('.employment-panel');
      panels.forEach(function (panel) {
        var empName = (panel.querySelector('.emp-employer-name') || {}).value || '';
        var position = (panel.querySelector('.emp-position') || {}).value || '';
        var payType = (panel.querySelector('.emp-pay-type') || {}).value || '';
        var payFreq = (panel.querySelector('.emp-pay-frequency') || {}).value || '';
        var baseRate = parseFloat((panel.querySelector('.emp-base-rate') || {}).value) || 0;
        var startDate = (panel.querySelector('.emp-start-date') || {}).value || '';
        var asOfDate = (panel.querySelector('.emp-as-of-date') || {}).value || '';
        var payPeriods = parseFloat((panel.querySelector('.emp-pay-periods-ytd') || {}).value) || 0;
        var ytdBase = parseFloat((panel.querySelector('.emp-ytd-base') || {}).value) || 0;
        var ytdOT = parseFloat((panel.querySelector('.emp-ytd-overtime') || {}).value) || 0;
        var ytdBonus = parseFloat((panel.querySelector('.emp-ytd-bonus') || {}).value) || 0;
        var ytdComm = parseFloat((panel.querySelector('.emp-ytd-commission') || {}).value) || 0;
        var ytdOther = parseFloat((panel.querySelector('.emp-ytd-other') || {}).value) || 0;
        var prior1Base = parseFloat((panel.querySelector('.emp-prior1-base') || {}).value) || 0;
        var prior1OT = parseFloat((panel.querySelector('.emp-prior1-overtime') || {}).value) || 0;
        var prior1Bonus = parseFloat((panel.querySelector('.emp-prior1-bonus') || {}).value) || 0;
        var prior1Comm = parseFloat((panel.querySelector('.emp-prior1-commission') || {}).value) || 0;
        var prior2Base = parseFloat((panel.querySelector('.emp-prior2-base') || {}).value) || 0;
        var prior2OT = parseFloat((panel.querySelector('.emp-prior2-overtime') || {}).value) || 0;
        var prior2Bonus = parseFloat((panel.querySelector('.emp-prior2-bonus') || {}).value) || 0;
        var prior2Comm = parseFloat((panel.querySelector('.emp-prior2-commission') || {}).value) || 0;
        if (empName || ytdBase || prior1Base) {
          employments.push({
            employer: empName, position: position, payType: payType, payFreq: payFreq,
            baseRate: baseRate, startDate: startDate, asOfDate: asOfDate, payPeriods: payPeriods,
            ytd: { base: ytdBase, overtime: ytdOT, bonus: ytdBonus, commission: ytdComm, other: ytdOther },
            prior1: { base: prior1Base, overtime: prior1OT, bonus: prior1Bonus, commission: prior1Comm },
            prior2: { base: prior2Base, overtime: prior2OT, bonus: prior2Bonus, commission: prior2Comm }
          });
        }
      });

      var monthlyBase = txt(doc,'resultMonthlyBase');
      var monthlyVariable = txt(doc,'resultMonthlyVariable');
      var monthlyTotal = txt(doc,'resultMonthlyTotal');
      var qualifyingIncome = txt(doc,'resultQualifyingIncome');

      var flags = [];
      var flagEls = doc.querySelectorAll('#flagsContainer .flag-item, #flagsContainer li');
      flagEls.forEach(function (el) { flags.push(el.textContent.trim()); });

      var docs = [];
      var docEls = doc.querySelectorAll('#docsContainer .doc-item, #docsContainer li');
      docEls.forEach(function (el) { docs.push(el.textContent.trim()); });

      var breakdowns = [];
      var breakdownEls = doc.querySelectorAll('#empBreakdownContainer .calc-section');
      breakdownEls.forEach(function (sec) {
        var title = sec.querySelector('h2, h3');
        var rows = [];
        sec.querySelectorAll('tr').forEach(function (tr) {
          var cells = tr.querySelectorAll('td');
          if (cells.length >= 2) {
            rows.push({ label: cells[0].textContent.trim(), value: cells[cells.length - 1].textContent.trim() });
          }
        });
        breakdowns.push({ title: title ? title.textContent.trim() : '', rows: rows });
      });

      return {
        employments: employments,
        results: {
          monthlyBase: monthlyBase, monthlyVariable: monthlyVariable,
          monthlyTotal: monthlyTotal, qualifyingIncome: qualifyingIncome
        },
        flags: flags,
        docs: docs,
        breakdowns: breakdowns
      };
    },
    function (data) {
      var res = data.results;
      var html = '';

      if (data.employments && data.employments.length) {
        data.employments.forEach(function (emp, i) {
          html += '<div class="rpt-section"><h4 class="rpt-section-title">Employment ' + (i + 1) + (emp.employer ? ' \u2014 ' + emp.employer : '') + '</h4>';
          html += '<div class="rpt-params">';
          if (emp.employer) html += '<div class="rpt-param"><span>Employer</span><span>' + emp.employer + '</span></div>';
          if (emp.position) html += '<div class="rpt-param"><span>Position</span><span>' + emp.position + '</span></div>';
          html += '<div class="rpt-param"><span>Pay Type</span><span>' + emp.payType + '</span></div>';
          if (emp.baseRate) html += '<div class="rpt-param"><span>' + (emp.payType === 'HOURLY' ? 'Hourly Rate' : 'Annual Salary') + '</span><span>' + (emp.payType === 'HOURLY' ? fmt(emp.baseRate) + '/hr' : fmt0(emp.baseRate)) + '</span></div>';
          if (emp.startDate) html += '<div class="rpt-param"><span>Start Date</span><span>' + emp.startDate + '</span></div>';
          html += '</div>';

          html += '<table class="rpt-table"><thead><tr><th>Earnings Type</th><th class="rpt-num">YTD</th><th class="rpt-num">Prior Year 1</th><th class="rpt-num">Prior Year 2</th></tr></thead><tbody>';
          html += '<tr><td>Base</td><td class="rpt-num">' + fmt(emp.ytd.base) + '</td><td class="rpt-num">' + fmt(emp.prior1.base) + '</td><td class="rpt-num">' + fmt(emp.prior2.base) + '</td></tr>';
          if (emp.ytd.overtime || emp.prior1.overtime || emp.prior2.overtime) html += '<tr><td>Overtime</td><td class="rpt-num">' + fmt(emp.ytd.overtime) + '</td><td class="rpt-num">' + fmt(emp.prior1.overtime) + '</td><td class="rpt-num">' + fmt(emp.prior2.overtime) + '</td></tr>';
          if (emp.ytd.bonus || emp.prior1.bonus || emp.prior2.bonus) html += '<tr><td>Bonus</td><td class="rpt-num">' + fmt(emp.ytd.bonus) + '</td><td class="rpt-num">' + fmt(emp.prior1.bonus) + '</td><td class="rpt-num">' + fmt(emp.prior2.bonus) + '</td></tr>';
          if (emp.ytd.commission || emp.prior1.commission || emp.prior2.commission) html += '<tr><td>Commission</td><td class="rpt-num">' + fmt(emp.ytd.commission) + '</td><td class="rpt-num">' + fmt(emp.prior1.commission) + '</td><td class="rpt-num">' + fmt(emp.prior2.commission) + '</td></tr>';
          if (emp.ytd.other) html += '<tr><td>Other</td><td class="rpt-num">' + fmt(emp.ytd.other) + '</td><td class="rpt-num">\u2014</td><td class="rpt-num">\u2014</td></tr>';
          html += '</tbody></table></div>';
        });
      }

      if (data.breakdowns && data.breakdowns.length) {
        data.breakdowns.forEach(function (bd) {
          html += '<div class="rpt-section"><h4 class="rpt-section-title">' + bd.title + '</h4>';
          if (bd.rows.length) {
            html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
            bd.rows.forEach(function (r) {
              html += '<tr><td>' + r.label + '</td><td class="rpt-num">' + r.value + '</td></tr>';
            });
            html += '</tbody></table>';
          }
          html += '</div>';
        });
      }

      html += '<div class="rpt-section"><h4 class="rpt-section-title">Income Summary</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Category</th><th class="rpt-num">Monthly</th></tr></thead><tbody>';
      html += '<tr><td>Monthly Base Income</td><td class="rpt-num">' + res.monthlyBase + '</td></tr>';
      html += '<tr><td>Monthly Variable Income</td><td class="rpt-num">' + res.monthlyVariable + '</td></tr>';
      html += '<tr><td>Total Monthly Usable</td><td class="rpt-num">' + res.monthlyTotal + '</td></tr>';
      html += '</tbody></table>';
      html += '<div class="rpt-grand-total"><span>Qualifying Monthly Income</span><span>' + res.qualifyingIncome + '</span></div>';
      html += '</div>';

      if (data.flags && data.flags.length) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">Flags & Observations</h4>';
        html += '<ul style="margin:0;padding-left:1.25rem;font-size:0.85em">';
        data.flags.forEach(function (f) { html += '<li>' + f + '</li>'; });
        html += '</ul></div>';
      }

      if (data.docs && data.docs.length) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">Required Documentation</h4>';
        html += '<ul style="margin:0;padding-left:1.25rem;font-size:0.85em">';
        data.docs.forEach(function (d) { html += '<li>' + d + '</li>'; });
        html += '</ul></div>';
      }
      return html;
    },
    function (data) {
      var res = data.results;
      var content = [];

      if (data.employments && data.employments.length) {
        data.employments.forEach(function (emp, i) {
          content.push({ text: 'Employment ' + (i + 1) + (emp.employer ? ' \u2014 ' + emp.employer : ''), style: 'sectionTitle', margin: [0, 8, 0, 4] });
          var body = [
            [{ text: 'Earnings', style: 'tableHeader' }, { text: 'YTD', style: 'tableHeader', alignment: 'right' }, { text: 'Prior Yr 1', style: 'tableHeader', alignment: 'right' }, { text: 'Prior Yr 2', style: 'tableHeader', alignment: 'right' }],
            ['Base', { text: fmt(emp.ytd.base), alignment: 'right' }, { text: fmt(emp.prior1.base), alignment: 'right' }, { text: fmt(emp.prior2.base), alignment: 'right' }]
          ];
          if (emp.ytd.overtime || emp.prior1.overtime) body.push(['Overtime', { text: fmt(emp.ytd.overtime), alignment: 'right' }, { text: fmt(emp.prior1.overtime), alignment: 'right' }, { text: fmt(emp.prior2.overtime), alignment: 'right' }]);
          if (emp.ytd.bonus || emp.prior1.bonus) body.push(['Bonus', { text: fmt(emp.ytd.bonus), alignment: 'right' }, { text: fmt(emp.prior1.bonus), alignment: 'right' }, { text: fmt(emp.prior2.bonus), alignment: 'right' }]);
          if (emp.ytd.commission || emp.prior1.commission) body.push(['Commission', { text: fmt(emp.ytd.commission), alignment: 'right' }, { text: fmt(emp.prior1.commission), alignment: 'right' }, { text: fmt(emp.prior2.commission), alignment: 'right' }]);
          content.push({ table: { headerRows: 1, widths: ['*', 80, 80, 80], body: body }, layout: 'lightHorizontalLines' });
        });
      }

      content.push({ text: 'Income Summary', style: 'sectionTitle', margin: [0, 10, 0, 4] });
      var rBody = [
        [{ text: 'Category', style: 'tableHeader' }, { text: 'Monthly', style: 'tableHeader', alignment: 'right' }],
        ['Monthly Base', { text: res.monthlyBase, alignment: 'right' }],
        ['Monthly Variable', { text: res.monthlyVariable, alignment: 'right' }],
        ['Total Usable', { text: res.monthlyTotal, alignment: 'right' }]
      ];
      content.push({ table: { headerRows: 1, widths: ['*', 120], body: rBody }, layout: 'lightHorizontalLines' });
      content.push({ columns: [{ text: 'Qualifying Monthly Income', bold: true, fontSize: 12, color: '#2d6a4f' }, { text: res.qualifyingIncome, alignment: 'right', bold: true, fontSize: 12, color: '#2d6a4f' }], margin: [0, 8, 0, 0] });

      if (data.flags && data.flags.length) {
        content.push({ text: 'Flags & Observations', style: 'sectionTitle', margin: [0, 10, 0, 4] });
        content.push({ ul: data.flags.map(function (f) { return { text: f, fontSize: 9 }; }) });
      }
      return content;
    }
  );
})();
