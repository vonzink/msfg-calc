/* Report template: Loan Comparison */
(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;
  var h = RT.helpers;
  var val = h.val, txt = h.txt, fmt = h.fmt, ratePct = h.ratePct;

  /* =========================================================
     Loan Comparison
     ========================================================= */
  RT.register('compare',
    function (doc) {
      var headerRow = doc.getElementById('cmpHeaderRow');
      var colThs = headerRow ? headerRow.querySelectorAll('.cmp-col-th') : [];
      var count = colThs.length;
      if (!count) return null;

      var loans = [];
      for (var i = 1; i <= count; i++) {
        loans.push({
          label: txt(doc, 'cmpLabel_' + i),
          loanAmount: val(doc, 'cmpLoanAmount_' + i),
          propertyValue: val(doc, 'cmpPropertyValue_' + i),
          rate: val(doc, 'cmpRate_' + i),
          term: val(doc, 'cmpTerm_' + i),
          product: txt(doc, 'cmpProduct_' + i),
          purpose: txt(doc, 'cmpPurpose_' + i),
          monthlyPI: val(doc, 'cmpMonthlyPI_' + i),
          origFee: val(doc, 'cmpOrigFee_' + i),
          discountPts: val(doc, 'cmpDiscountPts_' + i),
          processingFee: val(doc, 'cmpProcessingFee_' + i),
          underwritingFee: val(doc, 'cmpUnderwritingFee_' + i),
          appraisalFee: val(doc, 'cmpAppraisalFee_' + i),
          creditReportFee: val(doc, 'cmpCreditReportFee_' + i),
          titleFees: val(doc, 'cmpTitleFees_' + i),
          otherThirdParty: val(doc, 'cmpOtherThirdParty_' + i),
          recordingFee: val(doc, 'cmpRecordingFee_' + i),
          transferTax: val(doc, 'cmpTransferTax_' + i),
          prepaidInsurance: val(doc, 'cmpPrepaidInsurance_' + i),
          prepaidInterest: val(doc, 'cmpPrepaidInterest_' + i),
          escrowTax: val(doc, 'cmpEscrowTax_' + i),
          escrowInsurance: val(doc, 'cmpEscrowInsurance_' + i),
          downPayment: val(doc, 'cmpDownPayment_' + i),
          sellerCredits: val(doc, 'cmpSellerCredits_' + i),
          lenderCredits: val(doc, 'cmpLenderCredits_' + i),
          monthlyTax: val(doc, 'cmpMonthlyTax_' + i),
          monthlyInsurance: val(doc, 'cmpMonthlyInsurance_' + i),
          monthlyMI: val(doc, 'cmpMonthlyMI_' + i),
          monthlyHOA: val(doc, 'cmpMonthlyHOA_' + i),
          apr: val(doc, 'cmpAPR_' + i),
          notes: txt(doc, 'cmpNotes_' + i)
        });
      }

      return {
        borrower: txt(doc, 'cmpBorrower'),
        property: txt(doc, 'cmpProperty'),
        fileNumber: txt(doc, 'cmpFileNumber'),
        prepDate: txt(doc, 'cmpPrepDate'),
        loanCount: count,
        loans: loans
      };
    },
    function (data) {
      var loans = data.loans || [];
      var n = loans.length;
      if (!n) return '<p class="rpt-no-template">No loans to compare.</p>';

      function bestIdx(key) {
        var best = Infinity, idx = -1;
        for (var i = 0; i < n; i++) {
          var v = loans[i][key];
          if (v > 0 && v < best) { best = v; idx = i; }
        }
        return idx;
      }

      function cell(value, isBest) {
        return '<td class="rpt-num' + (isBest ? ' rpt-cmp-best' : '') + '">' + value + '</td>';
      }

      function fmtRow(label, key, formatter, highlight) {
        var bi = highlight ? bestIdx(key) : -1;
        var html = '<tr><td>' + label + '</td>';
        for (var i = 0; i < n; i++) {
          html += cell(formatter(loans[i][key]), i === bi);
        }
        return html + '</tr>';
      }

      function feeRow(label, key) {
        var hasVal = false;
        for (var i = 0; i < n; i++) { if (loans[i][key]) hasVal = true; }
        if (!hasVal) return '';
        return fmtRow(label, key, fmt, false);
      }

      function sectionHeader(title) {
        return '<tr><td colspan="' + (n + 1) + '" style="background:var(--brand-primary,#2d6a4f);color:#fff;font-weight:700;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.03em;padding:6px 8px">' + title + '</td></tr>';
      }

      function subtotalRow(label, keys) {
        var html = '<tr style="font-weight:700;background:var(--color-gray-50,#fafafa)"><td>' + label + '</td>';
        for (var i = 0; i < n; i++) {
          var total = 0;
          keys.forEach(function (k) { total += loans[i][k] || 0; });
          html += '<td class="rpt-num">' + fmt(total) + '</td>';
        }
        return html + '</tr>';
      }

      var html = '';
      var i;

      if (data.borrower || data.property || data.fileNumber) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Information</h4>';
        html += '<div class="rpt-params">';
        if (data.borrower) html += '<div class="rpt-param"><span>Borrower(s)</span><span>' + data.borrower + '</span></div>';
        if (data.property) html += '<div class="rpt-param"><span>Property</span><span>' + data.property + '</span></div>';
        if (data.fileNumber) html += '<div class="rpt-param"><span>File #</span><span>' + data.fileNumber + '</span></div>';
        if (data.prepDate) html += '<div class="rpt-param"><span>Date</span><span>' + data.prepDate + '</span></div>';
        html += '</div></div>';
      }

      html += '<table class="rpt-table rpt-cmp-table"><thead><tr><th></th>';
      for (i = 0; i < n; i++) {
        html += '<th class="rpt-num">' + (loans[i].label || 'Loan ' + (i + 1)) + '</th>';
      }
      html += '</tr></thead><tbody>';

      html += fmtRow('Loan Amount', 'loanAmount', fmt, false);
      html += fmtRow('Property Value', 'propertyValue', fmt, false);
      html += fmtRow('Rate', 'rate', ratePct, true);
      html += fmtRow('Term', 'term', function (v) { return v + ' mo'; }, false);

      html += '<tr><td>Product</td>';
      for (i = 0; i < n; i++) html += '<td class="rpt-num">' + (loans[i].product || '\u2014') + '</td>';
      html += '</tr>';
      html += '<tr><td>Purpose</td>';
      for (i = 0; i < n; i++) html += '<td class="rpt-num">' + (loans[i].purpose || '\u2014') + '</td>';
      html += '</tr>';

      html += fmtRow('Monthly P&I', 'monthlyPI', fmt, true);

      html += sectionHeader('Origination Charges');
      html += feeRow('Origination Fee', 'origFee');
      html += feeRow('Discount Points', 'discountPts');
      html += feeRow('Processing Fee', 'processingFee');
      html += feeRow('Underwriting Fee', 'underwritingFee');
      html += subtotalRow('Origination Total', ['origFee', 'discountPts', 'processingFee', 'underwritingFee']);

      html += sectionHeader('Third-Party Fees');
      html += feeRow('Appraisal Fee', 'appraisalFee');
      html += feeRow('Credit Report Fee', 'creditReportFee');
      html += feeRow('Title / Settlement', 'titleFees');
      html += feeRow('Other Third-Party', 'otherThirdParty');
      html += subtotalRow('Third-Party Total', ['appraisalFee', 'creditReportFee', 'titleFees', 'otherThirdParty']);

      html += sectionHeader('Government Fees');
      html += feeRow('Recording Fee', 'recordingFee');
      html += feeRow('Transfer Tax', 'transferTax');
      html += subtotalRow('Government Total', ['recordingFee', 'transferTax']);

      html += sectionHeader('Prepaids');
      html += feeRow('Prepaid Insurance', 'prepaidInsurance');
      html += feeRow('Prepaid Interest', 'prepaidInterest');
      html += subtotalRow('Prepaids Total', ['prepaidInsurance', 'prepaidInterest']);

      html += sectionHeader('Escrow Deposits');
      html += feeRow('Escrow Tax', 'escrowTax');
      html += feeRow('Escrow Insurance', 'escrowInsurance');
      html += subtotalRow('Escrow Total', ['escrowTax', 'escrowInsurance']);

      var closingKeys = ['origFee', 'discountPts', 'processingFee', 'underwritingFee',
        'appraisalFee', 'creditReportFee', 'titleFees', 'otherThirdParty',
        'recordingFee', 'transferTax', 'prepaidInsurance', 'prepaidInterest',
        'escrowTax', 'escrowInsurance'];
      html += '<tr style="font-weight:700;background:var(--color-gray-100)"><td>Total Closing Costs</td>';
      for (i = 0; i < n; i++) {
        var tc = 0;
        closingKeys.forEach(function (k) { tc += loans[i][k] || 0; });
        html += '<td class="rpt-num">' + fmt(tc) + '</td>';
      }
      html += '</tr>';

      html += fmtRow('Down Payment', 'downPayment', fmt, false);
      html += fmtRow('Seller Credits', 'sellerCredits', fmt, false);
      html += fmtRow('Lender Credits', 'lenderCredits', fmt, false);

      html += '<tr style="font-weight:700;background:var(--brand-primary,#2d6a4f);color:#fff"><td style="color:#fff">Cash to Close</td>';
      var ctcBest = Infinity, ctcIdx = -1;
      var ctcVals = [];
      for (i = 0; i < n; i++) {
        var tc2 = 0;
        closingKeys.forEach(function (k) { tc2 += loans[i][k] || 0; });
        var ctc = loans[i].downPayment + tc2 - loans[i].sellerCredits - loans[i].lenderCredits;
        ctcVals.push(ctc);
        if (ctc > 0 && ctc < ctcBest) { ctcBest = ctc; ctcIdx = i; }
      }
      for (i = 0; i < n; i++) {
        html += '<td class="rpt-num" style="color:#fff' + (i === ctcIdx ? ';background:#1b5e20' : '') + '">' + fmt(ctcVals[i]) + '</td>';
      }
      html += '</tr>';

      html += sectionHeader('Monthly Payment');
      html += feeRow('Property Tax', 'monthlyTax');
      html += feeRow('Hazard Insurance', 'monthlyInsurance');
      html += feeRow('Mortgage Insurance', 'monthlyMI');
      html += feeRow('HOA', 'monthlyHOA');

      html += '<tr style="font-weight:700;background:var(--brand-primary,#2d6a4f);color:#fff"><td style="color:#fff">Total Monthly</td>';
      var tmBest = Infinity, tmIdx = -1;
      var tmVals = [];
      for (i = 0; i < n; i++) {
        var tm = loans[i].monthlyPI + (loans[i].monthlyTax || 0) + (loans[i].monthlyInsurance || 0) + (loans[i].monthlyMI || 0) + (loans[i].monthlyHOA || 0);
        tmVals.push(tm);
        if (tm > 0 && tm < tmBest) { tmBest = tm; tmIdx = i; }
      }
      for (i = 0; i < n; i++) {
        html += '<td class="rpt-num" style="color:#fff' + (i === tmIdx ? ';background:#1b5e20' : '') + '">' + fmt(tmVals[i]) + '</td>';
      }
      html += '</tr>';

      html += '<tr><td>Total Interest</td>';
      var tiBest = Infinity, tiIdx = -1;
      for (i = 0; i < n; i++) {
        var ti = loans[i].term > 0 ? Math.max(0, (loans[i].monthlyPI * loans[i].term) - loans[i].loanAmount) : 0;
        if (ti > 0 && ti < tiBest) { tiBest = ti; tiIdx = i; }
      }
      for (i = 0; i < n; i++) {
        var ti2 = loans[i].term > 0 ? Math.max(0, (loans[i].monthlyPI * loans[i].term) - loans[i].loanAmount) : 0;
        html += cell(fmt(ti2), i === tiIdx);
      }
      html += '</tr>';

      html += fmtRow('APR', 'apr', ratePct, true);

      var hasNotes = false;
      for (i = 0; i < n; i++) { if (loans[i].notes) hasNotes = true; }
      if (hasNotes) {
        html += '<tr><td>Notes</td>';
        for (i = 0; i < n; i++) {
          html += '<td style="font-size:0.82em;white-space:pre-wrap;text-align:left">' + MSFG.escHtml(loans[i].notes || '') + '</td>';
        }
        html += '</tr>';
      }

      html += '</tbody></table>';
      return html;
    },
    function (data) {
      var loans = data.loans || [];
      var n = loans.length;
      if (!n) return [{ text: 'No loans to compare.', italics: true }];

      var content = [];

      var headerParts = [];
      if (data.borrower) headerParts.push('Borrower: ' + data.borrower);
      if (data.property) headerParts.push('Property: ' + data.property);
      if (data.fileNumber) headerParts.push('File #: ' + data.fileNumber);
      if (data.prepDate) headerParts.push('Date: ' + data.prepDate);
      if (headerParts.length) {
        content.push({ text: headerParts.join('  |  '), fontSize: 8, color: '#666', margin: [0, 0, 0, 8] });
      }

      var widths = ['*'];
      for (var i = 0; i < n; i++) widths.push('auto');

      function headerRow() {
        var cells = [{ text: '', style: 'tableHeader' }];
        for (var i = 0; i < n; i++) {
          cells.push({ text: loans[i].label || 'Loan ' + (i + 1), style: 'tableHeader', alignment: 'right' });
        }
        return cells;
      }

      function dataRow(label, values, opts) {
        opts = opts || {};
        var cells = [{ text: label, fontSize: 7, bold: opts.bold || false }];
        for (var i = 0; i < n; i++) {
          cells.push({
            text: values[i],
            fontSize: 7,
            alignment: 'right',
            bold: opts.bold || false,
            color: opts.highlight && opts.bestIdx === i ? '#1b5e20' : undefined,
            fillColor: opts.highlight && opts.bestIdx === i ? '#e8f5e9' : (opts.fill || undefined)
          });
        }
        return cells;
      }

      function sectionRow(title) {
        var cells = [];
        for (var i = 0; i <= n; i++) {
          cells.push({
            text: i === 0 ? title : '',
            fontSize: 7.5,
            bold: true,
            color: '#ffffff',
            fillColor: '#2d6a4f'
          });
        }
        return cells;
      }

      function bestOf(key) {
        var best = Infinity, idx = -1;
        for (var i = 0; i < n; i++) {
          if (loans[i][key] > 0 && loans[i][key] < best) { best = loans[i][key]; idx = i; }
        }
        return idx;
      }

      var body = [];
      body.push(headerRow());

      body.push(dataRow('Loan Amount', loans.map(function (l) { return fmt(l.loanAmount); })));
      body.push(dataRow('Rate', loans.map(function (l) { return ratePct(l.rate); }), { highlight: true, bestIdx: bestOf('rate') }));
      body.push(dataRow('Term', loans.map(function (l) { return l.term + ' mo'; })));
      body.push(dataRow('Product', loans.map(function (l) { return l.product || '\u2014'; })));
      body.push(dataRow('Monthly P&I', loans.map(function (l) { return fmt(l.monthlyPI); }), { highlight: true, bestIdx: bestOf('monthlyPI') }));

      body.push(sectionRow('ORIGINATION'));
      body.push(dataRow('Origination Total', loans.map(function (l) {
        return fmt(l.origFee + l.discountPts + l.processingFee + l.underwritingFee);
      })));

      body.push(sectionRow('THIRD-PARTY'));
      body.push(dataRow('Third-Party Total', loans.map(function (l) {
        return fmt(l.appraisalFee + l.creditReportFee + l.titleFees + l.otherThirdParty);
      })));

      body.push(sectionRow('GOVERNMENT'));
      body.push(dataRow('Government Total', loans.map(function (l) {
        return fmt(l.recordingFee + l.transferTax);
      })));

      body.push(sectionRow('PREPAIDS & ESCROW'));
      body.push(dataRow('Prepaids + Escrow', loans.map(function (l) {
        return fmt(l.prepaidInsurance + l.prepaidInterest + l.escrowTax + l.escrowInsurance);
      })));

      var closingKeys2 = ['origFee', 'discountPts', 'processingFee', 'underwritingFee',
        'appraisalFee', 'creditReportFee', 'titleFees', 'otherThirdParty',
        'recordingFee', 'transferTax', 'prepaidInsurance', 'prepaidInterest',
        'escrowTax', 'escrowInsurance'];
      body.push(dataRow('Total Closing Costs', loans.map(function (l) {
        var t = 0; closingKeys2.forEach(function (k) { t += l[k] || 0; }); return fmt(t);
      }), { bold: true, fill: '#f5f5f5' }));

      body.push(dataRow('Down Payment', loans.map(function (l) { return fmt(l.downPayment); })));
      body.push(dataRow('Credits', loans.map(function (l) { return fmt(l.sellerCredits + l.lenderCredits); })));

      var ctcVals2 = loans.map(function (l) {
        var t = 0; closingKeys2.forEach(function (k) { t += l[k] || 0; });
        return l.downPayment + t - l.sellerCredits - l.lenderCredits;
      });
      var ctcBest2 = Infinity, ctcIdx2 = -1;
      ctcVals2.forEach(function (v, i) { if (v > 0 && v < ctcBest2) { ctcBest2 = v; ctcIdx2 = i; } });
      body.push(dataRow('Cash to Close', ctcVals2.map(function (v) { return fmt(v); }), { bold: true, highlight: true, bestIdx: ctcIdx2 }));

      body.push(sectionRow('MONTHLY PAYMENT'));
      var tmVals2 = loans.map(function (l) {
        return l.monthlyPI + (l.monthlyTax || 0) + (l.monthlyInsurance || 0) + (l.monthlyMI || 0) + (l.monthlyHOA || 0);
      });
      var tmBest2 = Infinity, tmIdx2 = -1;
      tmVals2.forEach(function (v, i) { if (v > 0 && v < tmBest2) { tmBest2 = v; tmIdx2 = i; } });
      body.push(dataRow('Total Monthly', tmVals2.map(function (v) { return fmt(v); }), { bold: true, highlight: true, bestIdx: tmIdx2 }));

      var tiVals = loans.map(function (l) {
        return l.term > 0 ? Math.max(0, (l.monthlyPI * l.term) - l.loanAmount) : 0;
      });
      var tiBest2 = Infinity, tiIdx2 = -1;
      tiVals.forEach(function (v, i) { if (v > 0 && v < tiBest2) { tiBest2 = v; tiIdx2 = i; } });
      body.push(dataRow('Total Interest', tiVals.map(function (v) { return fmt(v); }), { highlight: true, bestIdx: tiIdx2 }));

      body.push(dataRow('APR', loans.map(function (l) { return ratePct(l.apr); }), { highlight: true, bestIdx: bestOf('apr') }));

      var hasNotes2 = false;
      for (var ni = 0; ni < n; ni++) { if (loans[ni].notes) hasNotes2 = true; }
      if (hasNotes2) {
        body.push(dataRow('Notes', loans.map(function (l) { return l.notes || ''; })));
      }

      content.push({
        table: { headerRows: 1, widths: widths, body: body },
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

      return content;
    }
  );
})();
