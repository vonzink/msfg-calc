/* Report templates: fee-worksheet, loan-analysis (cover letter) */
(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;
  var h = RT.helpers;
  var val = h.val, txt = h.txt, fmt = h.fmt, fmt0 = h.fmt0, pct = h.pct, ratePct = h.ratePct;

  /* =========================================================
     Fee Worksheet
     ========================================================= */
  RT.register('fee-worksheet',
    function (doc) {
      var customItems = [];
      var customRows = doc.querySelectorAll('.fw-fee-row--custom');
      customRows.forEach(function (row) {
        var section = '';
        var parentSection = row.closest('[data-section]');
        if (parentSection) section = parentSection.getAttribute('data-section');
        var labelEl = row.querySelector('label');
        var inputEl = row.querySelector('input');
        if (labelEl && inputEl) {
          var amount = parseFloat(inputEl.value) || 0;
          if (amount) {
            customItems.push({ section: section, name: labelEl.textContent.trim(), amount: amount });
          }
        }
      });

      return {
        borrower: txt(doc,'fwBorrowerName'),
        fileNumber: txt(doc,'fwFileNumber'),
        prepDate: txt(doc,'fwPrepDate'),
        propertyValue: val(doc,'fwPropertyValue'),
        loanAmount: val(doc,'fwLoanAmount'),
        rate: val(doc,'fwRate'),
        termMonths: val(doc,'fwTermMonths'),
        product: txt(doc,'fwProduct'),
        purpose: txt(doc,'fwLoanPurpose'),
        downPayment: val(doc,'fwDownPayment'),
        occupancy: txt(doc,'fwOccupancy'),
        totalLoanAmt: val(doc,'fwTotalLoanAmt'),
        propertyType: txt(doc,'fwPropertyType'),
        apr: val(doc,'fwAPR'),

        origFee: val(doc,'fwOrigFee'),
        discountPts: val(doc,'fwDiscountPts'),
        processingFee: val(doc,'fwProcessingFee'),
        underwritingFee: val(doc,'fwUnderwritingFee'),
        origTotal: txt(doc,'fwOrigTotal'),

        appraisalFee: val(doc,'fwAppraisalFee'),
        creditReportFee: val(doc,'fwCreditReportFee'),
        techFee: val(doc,'fwTechFee'),
        voeFee: val(doc,'fwVOEFee'),
        floodFee: val(doc,'fwFloodFee'),
        taxServiceFee: val(doc,'fwTaxServiceFee'),
        mersFee: val(doc,'fwMERSFee'),
        cannotShopTotal: txt(doc,'fwCannotShopTotal'),

        eRecordingFee: val(doc,'fwERecordingFee'),
        titleCPL: val(doc,'fwTitleCPL'),
        titleLenders: val(doc,'fwTitleLenders'),
        titleSettlement: val(doc,'fwTitleSettlement'),
        titleTaxCert: val(doc,'fwTitleTaxCert'),
        titleOwners: val(doc,'fwTitleOwners'),
        wireFee: val(doc,'fwWireFee'),
        canShopTotal: txt(doc,'fwCanShopTotal'),

        recordingFee: val(doc,'fwRecordingFee'),
        transferTax: val(doc,'fwTransferTax'),
        govTotal: txt(doc,'fwGovTotal'),

        hazInsAmt: val(doc,'fwHazInsAmt'),
        hazInsMonths: val(doc,'fwHazInsMonths'),
        prepaidHazIns: val(doc,'fwPrepaidHazIns'),
        prepaidIntPerDiem: val(doc,'fwPrepaidIntPerDiem'),
        prepaidIntDays: val(doc,'fwPrepaidIntDays'),
        prepaidInterest: val(doc,'fwPrepaidInterest'),
        prepaidsTotal: txt(doc,'fwPrepaidsTotal'),

        escTaxAmt: val(doc,'fwEscTaxAmt'),
        escTaxMonths: val(doc,'fwEscTaxMonths'),
        escrowTax: val(doc,'fwEscrowTax'),
        escInsAmt: val(doc,'fwEscInsAmt'),
        escInsMonths: val(doc,'fwEscInsMonths'),
        escrowIns: val(doc,'fwEscrowIns'),
        escrowTotal: txt(doc,'fwEscrowTotal'),

        other1: val(doc,'fwOther1'),
        other2: val(doc,'fwOther2'),
        otherTotal: txt(doc,'fwOtherTotal'),

        purchasePrice: val(doc,'fwPurchasePrice'),
        estPrepaids: val(doc,'fwEstPrepaids'),
        estClosing: val(doc,'fwEstClosing'),
        discount: val(doc,'fwDiscount'),
        totalDue: val(doc,'fwTotalDue'),
        summaryLoanAmt: val(doc,'fwSummaryLoanAmt'),
        totalPaid: val(doc,'fwTotalPaid'),
        sellerCredits: val(doc,'fwSellerCredits'),
        lenderCredits: val(doc,'fwLenderCredits'),
        fundsFromYou: txt(doc,'fwFundsFromYou'),

        monthlyPI: val(doc,'fwMonthlyPI'),
        monthlyIns: val(doc,'fwMonthlyIns'),
        monthlyTax: val(doc,'fwMonthlyTax'),
        monthlyMI: val(doc,'fwMonthlyMI'),
        monthlyHOA: val(doc,'fwMonthlyHOA'),
        totalMonthly: txt(doc,'fwTotalMonthly'),

        customItems: customItems
      };
    },
    function (data) {
      var html = '';
      var items = data.customItems || [];

      function feeLine(label, amount) {
        if (!amount) return '';
        return '<tr><td>' + label + '</td><td class="rpt-num">' + fmt(amount) + '</td></tr>';
      }
      function feeMultiLine(label, amt, qty, unit, total) {
        if (typeof total === 'number' && !total) return '';
        var detail = amt ? fmt(amt) + ' x ' + qty + ' ' + unit : '';
        var totalStr = (typeof total === 'number') ? fmt(total) : fmt(0);
        return '<tr><td>' + label + (detail ? ' <span style="color:#888;font-size:0.85em">(' + detail + ')</span>' : '') + '</td><td class="rpt-num">' + totalStr + '</td></tr>';
      }
      function customLines(section) {
        var out = '';
        items.forEach(function (ci) {
          if (ci.section === section) {
            out += '<tr><td><em>' + ci.name + '</em></td><td class="rpt-num">' + fmt(ci.amount || 0) + '</td></tr>';
          }
        });
        return out;
      }

      /* Loan Information */
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Information</h4>';
      html += '<div class="rpt-params">';
      html += '<div class="rpt-param"><span>Borrower(s)</span><span>' + (data.borrower || '') + '</span></div>';
      html += '<div class="rpt-param"><span>File #</span><span>' + (data.fileNumber || '') + '</span></div>';
      html += '<div class="rpt-param"><span>Preparation Date</span><span>' + (data.prepDate || '') + '</span></div>';
      html += '<div class="rpt-param"><span>Property Value</span><span>' + fmt(data.propertyValue) + '</span></div>';
      html += '<div class="rpt-param"><span>Loan Purpose</span><span>' + (data.purpose || '') + '</span></div>';
      html += '<div class="rpt-param"><span>Product</span><span>' + (data.product || '') + '</span></div>';
      html += '<div class="rpt-param"><span>Down Payment</span><span>' + fmt(data.downPayment || 0) + '</span></div>';
      html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt(data.loanAmount) + '</span></div>';
      html += '<div class="rpt-param"><span>Occupancy</span><span>' + (data.occupancy || '') + '</span></div>';
      html += '<div class="rpt-param"><span>Interest Rate</span><span>' + ratePct(data.rate) + '</span></div>';
      html += '<div class="rpt-param"><span>Total Loan Amount</span><span>' + fmt(data.totalLoanAmt || 0) + '</span></div>';
      html += '<div class="rpt-param"><span>Property Type</span><span>' + (data.propertyType || '') + '</span></div>';
      html += '<div class="rpt-param"><span>APR</span><span>' + ratePct(data.apr || 0) + '</span></div>';
      html += '<div class="rpt-param"><span>Term</span><span>' + data.termMonths + ' months</span></div>';
      html += '</div></div>';

      /* Two-column fee layout */
      html += '<div class="rpt-fw-columns">';

      /* LEFT COLUMN */
      html += '<div class="rpt-fw-col">';
      html += '<table class="rpt-table rpt-table--compact"><thead><tr><th>Origination Charges</th><th class="rpt-num">' + data.origTotal + '</th></tr></thead><tbody>';
      html += feeLine('Origination Fee', data.origFee);
      html += feeLine('Discount Points', data.discountPts);
      html += feeLine('Processing Fee', data.processingFee);
      html += feeLine('Underwriting Fee', data.underwritingFee);
      html += customLines('origination');
      html += '</tbody></table>';

      html += '<table class="rpt-table rpt-table--compact"><thead><tr><th>Services Borrower Cannot Shop</th><th class="rpt-num">' + data.cannotShopTotal + '</th></tr></thead><tbody>';
      html += feeLine('Appraisal Fee', data.appraisalFee);
      html += feeLine('Credit Report Fee', data.creditReportFee);
      html += feeLine('Technology Fee', data.techFee);
      html += feeLine('Verification of Employment Fee', data.voeFee);
      html += feeLine('Flood Cert Fee', data.floodFee);
      html += feeLine('Tax Service Fee', data.taxServiceFee);
      html += feeLine('MERS Registration Fee', data.mersFee);
      html += customLines('cannotShop');
      html += '</tbody></table>';

      html += '<table class="rpt-table rpt-table--compact"><thead><tr><th>Services Borrower Can Shop For</th><th class="rpt-num">' + data.canShopTotal + '</th></tr></thead><tbody>';
      html += feeLine('E-Recording Fee', data.eRecordingFee);
      html += feeLine('Title - Closing Protection Letter', data.titleCPL);
      html += feeLine('Title - Lenders Coverage Premium', data.titleLenders);
      html += feeLine('Title - Settlement Fee', data.titleSettlement);
      html += feeLine('Title - Tax Cert Fee', data.titleTaxCert);
      html += feeLine('Title - Owners Coverage Premium', data.titleOwners);
      html += feeLine('Wire Transfer Fee', data.wireFee);
      html += customLines('canShop');
      html += '</tbody></table>';

      var isRefi = data.purpose && data.purpose.indexOf('Refinance') !== -1;
      html += '<table class="rpt-table rpt-table--compact"><thead><tr><th colspan="2" style="font-weight:700">Total Estimated Funds Needed To Close</th></tr></thead><tbody>';
      html += '<tr><td>' + (isRefi ? 'Refinance' : 'Purchase Price') + '</td><td class="rpt-num">' + fmt(data.purchasePrice || 0) + '</td></tr>';
      html += '<tr><td>Estimated Prepaid Items</td><td class="rpt-num">' + fmt(data.estPrepaids || 0) + '</td></tr>';
      html += '<tr><td>Estimate Closing Cost</td><td class="rpt-num">' + fmt(data.estClosing || 0) + '</td></tr>';
      if (data.discount) {
        html += '<tr><td>Discount</td><td class="rpt-num">' + fmt(data.discount) + '</td></tr>';
      }
      html += '<tr style="font-weight:600;border-top:1px solid #ccc"><td>Total Due from Borrower at Closing (K)</td><td class="rpt-num">' + fmt(data.totalDue || 0) + '</td></tr>';
      html += '<tr><td>Loan Amount</td><td class="rpt-num">' + fmt(data.summaryLoanAmt || 0) + '</td></tr>';
      html += '<tr><td>Total Paid by/on Behalf of Borrower (L)</td><td class="rpt-num">' + fmt(data.totalPaid || 0) + '</td></tr>';
      html += '<tr><td>Seller Credits</td><td class="rpt-num">' + fmt(data.sellerCredits || 0) + '</td></tr>';
      html += '<tr><td>Lender Credits</td><td class="rpt-num">' + fmt(data.lenderCredits || 0) + '</td></tr>';
      html += '</tbody></table>';
      html += '<div class="rpt-grand-total"><span>Total Estimated Funds From You</span><span>' + data.fundsFromYou + '</span></div>';
      html += '</div>';

      /* RIGHT COLUMN */
      html += '<div class="rpt-fw-col">';
      html += '<table class="rpt-table rpt-table--compact"><thead><tr><th>Taxes & Government Fees</th><th class="rpt-num">' + data.govTotal + '</th></tr></thead><tbody>';
      html += feeLine('Recording Fee For Deed', data.recordingFee);
      html += feeLine('Transfer Taxes', data.transferTax);
      html += customLines('government');
      html += '</tbody></table>';

      html += '<table class="rpt-table rpt-table--compact"><thead><tr><th>Prepaids</th><th class="rpt-num">' + data.prepaidsTotal + '</th></tr></thead><tbody>';
      html += feeMultiLine('Hazard Insurance', data.hazInsAmt, data.hazInsMonths, 'mth(s)', data.prepaidHazIns);
      html += feeMultiLine('Prepaid Interest', data.prepaidIntPerDiem, data.prepaidIntDays, 'day(s)', data.prepaidInterest);
      html += customLines('prepaids');
      html += '</tbody></table>';

      html += '<table class="rpt-table rpt-table--compact"><thead><tr><th>Initial Escrow Payment at Closing</th><th class="rpt-num">' + data.escrowTotal + '</th></tr></thead><tbody>';
      html += feeMultiLine('County Property Tax', data.escTaxAmt, data.escTaxMonths, 'mth(s)', data.escrowTax);
      html += feeMultiLine('Hazard Insurance', data.escInsAmt, data.escInsMonths, 'mth(s)', data.escrowIns);
      html += customLines('escrow');
      html += '</tbody></table>';

      html += '<table class="rpt-table rpt-table--compact"><thead><tr><th>Other</th><th class="rpt-num">' + data.otherTotal + '</th></tr></thead><tbody>';
      html += feeLine('Other Fee 1', data.other1);
      html += feeLine('Other Fee 2', data.other2);
      html += customLines('other');
      html += '</tbody></table>';

      html += '<table class="rpt-table rpt-table--compact"><thead><tr><th colspan="2" style="font-weight:700">Total Estimated Monthly Housing Payment</th></tr></thead><tbody>';
      html += '<tr><td>First Mortgage</td><td class="rpt-num">' + fmt(data.monthlyPI) + '</td></tr>';
      html += '<tr><td>Hazard Insurance</td><td class="rpt-num">' + fmt(data.monthlyIns) + '</td></tr>';
      html += '<tr><td>Property Tax</td><td class="rpt-num">' + fmt(data.monthlyTax) + '</td></tr>';
      html += '<tr><td>Mortgage Insurance</td><td class="rpt-num">' + fmt(data.monthlyMI || 0) + '</td></tr>';
      html += '<tr><td>HOA</td><td class="rpt-num">' + fmt(data.monthlyHOA || 0) + '</td></tr>';
      html += '</tbody></table>';
      html += '<div class="rpt-grand-total"><span>Total Monthly Payment</span><span>' + data.totalMonthly + '</span></div>';
      html += '</div>';
      html += '</div>';

      html += '<p style="font-size:0.8em;color:#888;margin-top:0.75rem;font-style:italic">Your actual rate, payment, and cost could be higher. Get an official Loan Estimate before choosing a loan.</p>';
      return html;
    },
    function (data) {
      var content = [];
      var items = data.customItems || [];

      function fl(label, amount) {
        if (!amount) return null;
        return [label, { text: fmt(amount), alignment: 'right' }];
      }
      function fml(label, amt, qty, unit, total) {
        if (!total) return null;
        var detail = amt ? fmt(amt) + ' x ' + qty + ' ' + unit : '';
        var totalStr = (typeof total === 'number') ? fmt(total) : fmt(0);
        return [label + (detail ? ' (' + detail + ')' : ''), { text: totalStr, alignment: 'right' }];
      }
      function cfl(section) {
        var out = [];
        items.forEach(function (ci) {
          if (ci.section === section) {
            out.push([{ text: ci.name, italics: true }, { text: fmt(ci.amount || 0), alignment: 'right' }]);
          }
        });
        return out;
      }
      function sectionTable(title, totalStr, rows) {
        var body = [[{ text: title, style: 'tableHeader' }, { text: totalStr, style: 'tableHeader', alignment: 'right' }]];
        rows.forEach(function (r) { if (r) body.push(r); });
        return { table: { headerRows: 1, widths: ['*', 90], body: body }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 4] };
      }

      /* Loan info */
      var infoRows = [];
      infoRows.push(['Borrower(s)', data.borrower || '']);
      infoRows.push(['File #', data.fileNumber || '']);
      infoRows.push(['Preparation Date', data.prepDate || '']);
      infoRows.push(['Property Value', fmt(data.propertyValue)]);
      infoRows.push(['Loan Purpose', data.purpose || '']);
      infoRows.push(['Product', data.product || '']);
      infoRows.push(['Down Payment', fmt(data.downPayment || 0)]);
      infoRows.push(['Loan Amount', fmt(data.loanAmount)]);
      infoRows.push(['Occupancy', data.occupancy || '']);
      infoRows.push(['Interest Rate', ratePct(data.rate)]);
      infoRows.push(['Total Loan Amount', fmt(data.totalLoanAmt || 0)]);
      infoRows.push(['Property Type', data.propertyType || '']);
      infoRows.push(['APR', ratePct(data.apr || 0)]);
      infoRows.push(['Term', data.termMonths + ' months']);
      var infoBody = [[{ text: 'Loan Information', style: 'tableHeader' }, { text: '', style: 'tableHeader' }]];
      infoRows.forEach(function (r) { infoBody.push([r[0], { text: r[1], alignment: 'right' }]); });
      content.push({ table: { headerRows: 1, widths: ['*', 140], body: infoBody }, layout: 'lightHorizontalLines' });

      content.push(sectionTable('Origination Charges', data.origTotal, [fl('Origination Fee', data.origFee), fl('Discount Points', data.discountPts), fl('Processing Fee', data.processingFee), fl('Underwriting Fee', data.underwritingFee)].concat(cfl('origination'))));
      content.push(sectionTable('Services Borrower Cannot Shop', data.cannotShopTotal, [fl('Appraisal Fee', data.appraisalFee), fl('Credit Report Fee', data.creditReportFee), fl('Technology Fee', data.techFee), fl('VOE Fee', data.voeFee), fl('Flood Cert Fee', data.floodFee), fl('Tax Service Fee', data.taxServiceFee), fl('MERS Registration Fee', data.mersFee)].concat(cfl('cannotShop'))));
      content.push(sectionTable('Services Borrower Can Shop For', data.canShopTotal, [fl('E-Recording Fee', data.eRecordingFee), fl('Title - CPL', data.titleCPL), fl('Title - Lenders Coverage', data.titleLenders), fl('Title - Settlement Fee', data.titleSettlement), fl('Title - Tax Cert Fee', data.titleTaxCert), fl('Title - Owners Coverage', data.titleOwners), fl('Wire Transfer Fee', data.wireFee)].concat(cfl('canShop'))));
      content.push(sectionTable('Taxes & Government Fees', data.govTotal, [fl('Recording Fee For Deed', data.recordingFee), fl('Transfer Taxes', data.transferTax)].concat(cfl('government'))));
      content.push(sectionTable('Prepaids', data.prepaidsTotal, [fml('Hazard Insurance', data.hazInsAmt, data.hazInsMonths, 'mth(s)', data.prepaidHazIns), fml('Prepaid Interest', data.prepaidIntPerDiem, data.prepaidIntDays, 'day(s)', data.prepaidInterest)].concat(cfl('prepaids'))));
      content.push(sectionTable('Initial Escrow Payment at Closing', data.escrowTotal, [fml('County Property Tax', data.escTaxAmt, data.escTaxMonths, 'mth(s)', data.escrowTax), fml('Hazard Insurance', data.escInsAmt, data.escInsMonths, 'mth(s)', data.escrowIns)].concat(cfl('escrow'))));
      content.push(sectionTable('Other', data.otherTotal, [fl('Other Fee 1', data.other1), fl('Other Fee 2', data.other2)].concat(cfl('other'))));

      var isRefi = data.purpose && data.purpose.indexOf('Refinance') !== -1;
      var fundsBody = [[{ text: 'Funds Needed To Close', style: 'tableHeader' }, { text: '', style: 'tableHeader' }]];
      fundsBody.push([(isRefi ? 'Refinance' : 'Purchase Price'), { text: fmt(data.purchasePrice || 0), alignment: 'right' }]);
      fundsBody.push(['Estimated Prepaid Items', { text: fmt(data.estPrepaids || 0), alignment: 'right' }]);
      fundsBody.push(['Estimated Closing Cost', { text: fmt(data.estClosing || 0), alignment: 'right' }]);
      if (data.discount) fundsBody.push(['Discount', { text: fmt(data.discount), alignment: 'right' }]);
      fundsBody.push([{ text: 'Total Due from Borrower at Closing (K)', bold: true }, { text: fmt(data.totalDue || 0), alignment: 'right', bold: true }]);
      fundsBody.push(['Loan Amount', { text: fmt(data.summaryLoanAmt || 0), alignment: 'right' }]);
      fundsBody.push(['Total Paid by/on Behalf of Borrower (L)', { text: fmt(data.totalPaid || 0), alignment: 'right' }]);
      fundsBody.push(['Seller Credits', { text: fmt(data.sellerCredits || 0), alignment: 'right' }]);
      fundsBody.push(['Lender Credits', { text: fmt(data.lenderCredits || 0), alignment: 'right' }]);
      content.push({ table: { headerRows: 1, widths: ['*', 110], body: fundsBody }, layout: 'lightHorizontalLines' });
      content.push({ columns: [{ text: 'Total Estimated Funds From You', bold: true, fontSize: 11, color: '#2d6a4f' }, { text: data.fundsFromYou, alignment: 'right', bold: true, fontSize: 11, color: '#2d6a4f' }], margin: [0, 4, 0, 8] });

      var monthlyBody = [[{ text: 'Monthly Housing Payment', style: 'tableHeader' }, { text: '', style: 'tableHeader' }]];
      monthlyBody.push(['First Mortgage', { text: fmt(data.monthlyPI), alignment: 'right' }]);
      monthlyBody.push(['Hazard Insurance', { text: fmt(data.monthlyIns), alignment: 'right' }]);
      monthlyBody.push(['Property Tax', { text: fmt(data.monthlyTax), alignment: 'right' }]);
      monthlyBody.push(['Mortgage Insurance', { text: fmt(data.monthlyMI || 0), alignment: 'right' }]);
      monthlyBody.push(['HOA', { text: fmt(data.monthlyHOA || 0), alignment: 'right' }]);
      content.push({ table: { headerRows: 1, widths: ['*', 110], body: monthlyBody }, layout: 'lightHorizontalLines' });
      content.push({ columns: [{ text: 'Total Monthly Payment', bold: true, fontSize: 11, color: '#2d6a4f' }, { text: data.totalMonthly, alignment: 'right', bold: true, fontSize: 11, color: '#2d6a4f' }], margin: [0, 4, 0, 4] });

      content.push({ text: 'Your actual rate, payment, and cost could be higher. Get an official Loan Estimate before choosing a loan.', fontSize: 8, color: '#888', italics: true, margin: [0, 4, 0, 0] });
      return content;
    }
  );

  /* =========================================================
     Loan Analysis (Cover Letter)
     ========================================================= */
  RT.register('loan-analysis',
    function (doc) {
      var letterEl = doc.getElementById('laLetterContent');
      var letterHtml = letterEl ? letterEl.innerHTML.trim() : '';
      if (!letterHtml) return null;
      return { letterHtml: letterHtml };
    },
    function (data) {
      if (data.letterHtml) {
        return '<style>.rpt-cover-letter .la-letter__header-logo{max-width:120px;height:auto;display:block;}.rpt-cover-letter .la-letter__header{padding:0 0 8px;}</style>' +
          '<div class="rpt-cover-letter" style="line-height:1.7;font-size:0.95rem">' + data.letterHtml + '</div>';
      }
      return '<p class="rpt-no-template">No cover letter generated.</p>';
    },
    function (data) {
      if (!data.letterHtml) return [{ text: 'No cover letter generated.', italics: true, color: '#888' }];

      var temp = document.createElement('div');
      temp.innerHTML = data.letterHtml;
      var content = [];

      var date = temp.querySelector('.la-letter__date');
      if (date) content.push({ text: date.textContent.trim(), color: '#888', margin: [0, 0, 0, 8] });

      var addr = temp.querySelector('.la-letter__address');
      if (addr) content.push({ text: addr.textContent.trim(), margin: [0, 0, 0, 8] });

      var greet = temp.querySelector('.la-letter__greeting');
      if (greet) content.push({ text: greet.textContent.trim(), margin: [0, 0, 0, 8] });

      var bodyPs = temp.querySelectorAll('.la-letter__body p');
      for (var i = 0; i < bodyPs.length; i++) {
        content.push({ text: bodyPs[i].textContent.trim(), margin: [0, 0, 0, 8] });
      }

      var sigEl = temp.querySelector('.la-letter__signature');
      if (sigEl) {
        content.push({ text: '', margin: [0, 8, 0, 0] });
        var sigLines = sigEl.querySelectorAll('p');
        for (var j = 0; j < sigLines.length; j++) {
          var line = sigLines[j].textContent.trim();
          if (!line) continue;
          var isBold = sigLines[j].classList.contains('la-sig-name');
          content.push({ text: line, bold: isBold, fontSize: isBold ? 11 : 9, color: isBold ? '#2d6a4f' : '#666', margin: [0, 1, 0, 1] });
        }
      }

      var attSection = temp.querySelector('.la-letter__attachments');
      if (attSection) {
        content.push({ text: 'Enclosed Reports', style: 'sectionTitle', margin: [0, 12, 0, 4] });
        var lis = attSection.querySelectorAll('li');
        var attItems = [];
        for (var k = 0; k < lis.length; k++) {
          attItems.push({ text: lis[k].textContent.trim(), margin: [0, 2, 0, 2] });
        }
        if (attItems.length) content.push({ ul: attItems });
      }

      return content;
    }
  );
})();
