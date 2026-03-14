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
        var cells = [{ text: label, fontSize: 8, bold: opts.bold || false }];
        for (var i = 0; i < n; i++) {
          cells.push({
            text: values[i],
            fontSize: 8,
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
            fontSize: 7,
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
  /* =========================================================
     LLPM Tool (LLPA / LLPM Calculator)
     ========================================================= */

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
      html += '<div class="rpt-param"><span>Credit Score</span><span>' + (inp.creditScore || '—') + '</span></div>';
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
        ['Credit Score', String(inp.creditScore || '—')],
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
        content.push({ text: 'LLPA Breakdown', style: 'sectionHeader', margin: [0, 10, 0, 4] });

        var body = [
          [
            { text: 'Adjustment', style: 'tableHeader' },
            { text: 'Points', style: 'tableHeader', alignment: 'right' },
            { text: 'Reason', style: 'tableHeader' }
          ]
        ];
        res.breakdown.forEach(function (row) {
          body.push([
            { text: row.name, fontSize: 8 },
            { text: row.points, fontSize: 8, alignment: 'right' },
            { text: row.reason || '', fontSize: 8, color: '#666' }
          ]);
        });

        content.push({
          table: { headerRows: 1, widths: ['*', 50, '*'], body: body },
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
        content.push({ text: 'Warnings', style: 'sectionHeader', margin: [0, 10, 0, 4] });
        var warnList = res.warnings.map(function (w) { return { text: w, fontSize: 8, color: '#8a5a00' }; });
        content.push({ ul: warnList, margin: [10, 0, 0, 0] });
      }

      return content;
    }
  );

  /* =========================================================
     Loan Timeline
     ========================================================= */

  var LT_CATEGORY_COLORS = {
    milestone: '#22c55e', deadline: '#f59e0b', lock: '#3b82f6',
    contingency: '#f87171', condition: '#8b5cf6', turntime: '#06b6d4'
  };
  var LT_CATEGORY_LABELS = {
    milestone: 'Milestones', deadline: 'Deadlines', lock: 'Rate Lock',
    contingency: 'Contingencies', condition: 'Conditions', turntime: 'Turntimes'
  };

  RT.register('loan-timeline',
    /* ---- Extractor ---- */
    function (doc) {
      /* Loan info bar */
      var borrower = txt(doc, 'ltBorrower');
      var fileNum = txt(doc, 'ltFileNum');
      var purpose = txt(doc, 'ltPurpose');
      var program = txt(doc, 'ltProgram');
      var loanPurpose = '';
      var lpSel = doc.getElementById('ltLoanPurpose');
      if (lpSel) loanPurpose = lpSel.value;

      /* Standard dates + visibility */
      var dateRows = doc.querySelectorAll('.lt-date-row');
      var dates = [];
      dateRows.forEach(function (row) {
        var input = row.querySelector('input[type="date"]');
        var toggle = row.querySelector('.lt-toggle');
        var label = row.querySelector('label');
        if (!input || !input.dataset.event) return;
        var cat = '';
        var group = row.closest('[data-category]');
        if (group) cat = group.getAttribute('data-category');
        dates.push({
          id: input.dataset.event,
          label: label ? label.textContent.trim() : input.dataset.event,
          date: input.value || '',
          category: cat,
          visible: toggle ? toggle.checked : true
        });
      });

      /* Custom dates */
      var customDates = [];
      var customRows = doc.querySelectorAll('.lt-custom-row');
      customRows.forEach(function (row) {
        var nameInput = row.querySelector('input[type="text"]');
        var dateInput = row.querySelector('input[type="date"]');
        var catSelect = row.querySelector('select');
        if (nameInput && dateInput && dateInput.value) {
          customDates.push({
            label: nameInput.value || 'Custom',
            date: dateInput.value,
            category: catSelect ? catSelect.value : 'milestone'
          });
        }
      });

      /* TRID alerts */
      var alerts = [];
      var alertEls = doc.querySelectorAll('.lt-alert');
      alertEls.forEach(function (a) {
        var icon = a.querySelector('.lt-alert__icon');
        var msg = a.querySelector('.lt-alert__msg, span:last-child');
        var type = 'info';
        if (a.classList.contains('lt-alert--ok')) type = 'ok';
        else if (a.classList.contains('lt-alert--warn')) type = 'warn';
        else if (a.classList.contains('lt-alert--danger')) type = 'danger';
        alerts.push({
          type: type,
          icon: icon ? icon.textContent.trim() : '',
          text: msg ? msg.textContent.trim() : a.textContent.trim()
        });
      });

      /* Notes */
      var notesEl = doc.getElementById('ltNotes');
      var notes = notesEl ? notesEl.value : '';

      /* Extract application and funding dates for timeline bar */
      var applicationDate = '';
      var fundingDate = '';
      dates.forEach(function (d) {
        if (d.id === 'applicationTaken' && d.date) applicationDate = d.date;
        if (d.id === 'fundingEstimate' && d.date) fundingDate = d.date;
      });

      /* Collect all visible events for timeline dots */
      var timelineEvents = [];
      dates.forEach(function (d) {
        if (d.date && d.visible) {
          timelineEvents.push({ date: d.date, category: d.category, label: d.label });
        }
      });
      customDates.forEach(function (d) {
        if (d.date) {
          timelineEvents.push({ date: d.date, category: d.category, label: d.label });
        }
      });

      return {
        borrower: borrower, fileNum: fileNum, purpose: purpose, program: program,
        loanPurpose: loanPurpose, dates: dates, customDates: customDates,
        alerts: alerts, notes: notes,
        applicationDate: applicationDate, fundingDate: fundingDate,
        timelineEvents: timelineEvents
      };
    },

    /* ---- HTML Renderer ---- */
    function (data) {
      var html = '';
      var dates = data.dates || [];
      var customDates = data.customDates || [];
      var alerts = data.alerts || [];

      /* Dot helper */
      function dot(color) {
        return '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + color + ';margin-right:6px;vertical-align:middle"></span>';
      }
      function formatDate(iso) {
        if (!iso) return '—';
        var parts = iso.split('-');
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
      }

      /* Loan Info */
      if (data.borrower || data.fileNum || data.purpose || data.program) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Information</h4>';
        html += '<div class="rpt-params">';
        if (data.borrower) html += '<div class="rpt-param"><span>Borrower</span><span>' + MSFG.escHtml(data.borrower) + '</span></div>';
        if (data.fileNum) html += '<div class="rpt-param"><span>File #</span><span>' + MSFG.escHtml(data.fileNum) + '</span></div>';
        if (data.purpose) html += '<div class="rpt-param"><span>Purpose</span><span>' + MSFG.escHtml(data.purpose) + '</span></div>';
        if (data.program) html += '<div class="rpt-param"><span>Program</span><span>' + MSFG.escHtml(data.program) + '</span></div>';
        if (data.loanPurpose) html += '<div class="rpt-param"><span>TRID Purpose</span><span>' + MSFG.escHtml(data.loanPurpose) + '</span></div>';
        html += '</div></div>';
      }

      /* Timeline Progress Bar */
      var appDate = data.applicationDate || '';
      var fundDate = data.fundingDate || '';
      var tlEvents = data.timelineEvents || [];

      if (appDate && fundDate) {
        var appMs = new Date(appDate + 'T00:00:00').getTime();
        var fundMs = new Date(fundDate + 'T00:00:00').getTime();
        var nowMs = Date.now();
        var totalSpan = fundMs - appMs;
        var progressPct = totalSpan > 0 ? Math.max(0, Math.min(100, ((nowMs - appMs) / totalSpan) * 100)) : 0;

        html += '<div class="rpt-section">';
        html += '<h4 class="rpt-section-title">Timeline Progress</h4>';
        html += '<div style="padding:16px 20px;background:#fafafa;border:1px solid #e5e7eb;border-radius:8px">';

        /* Labels row */
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
        html += '<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e"></span><span style="font-size:0.8rem;font-weight:700;color:#333">APPLICATION</span><span style="font-size:0.72rem;color:#888">' + formatDate(appDate) + '</span></div>';
        html += '<div style="display:flex;align-items:center;gap:6px"><span style="font-size:0.72rem;color:#888">' + formatDate(fundDate) + '</span><span style="font-size:0.8rem;font-weight:700;color:#333">FUNDED</span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f59e0b"></span></div>';
        html += '</div>';

        /* Track */
        html += '<div style="position:relative;height:12px;background:#e5e7eb;border-radius:6px;overflow:visible">';

        /* Green fill */
        html += '<div style="position:absolute;top:0;left:0;height:100%;width:' + progressPct.toFixed(1) + '%;background:linear-gradient(90deg,#22c55e,#16a34a);border-radius:6px;transition:width 0.3s"></div>';

        /* Today marker */
        if (progressPct > 0 && progressPct < 100) {
          html += '<div style="position:absolute;top:-3px;left:' + progressPct.toFixed(1) + '%;transform:translateX(-50%);width:18px;height:18px;background:#fff;border:2px solid #16a34a;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div>';
        }

        /* Event dots */
        if (totalSpan > 0) {
          tlEvents.forEach(function (ev) {
            var evMs = new Date(ev.date + 'T00:00:00').getTime();
            var evPct = Math.max(0, Math.min(100, ((evMs - appMs) / totalSpan) * 100));
            var evColor = LT_CATEGORY_COLORS[ev.category] || '#888';
            html += '<div style="position:absolute;top:50%;left:' + evPct.toFixed(1) + '%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:' + evColor + ';border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,0.15);cursor:default" title="' + MSFG.escHtml(ev.label) + ' — ' + formatDate(ev.date) + '"></div>';
          });
        }

        html += '</div>'; /* end track */

        /* Progress text */
        var daysElapsed = Math.floor((Math.min(nowMs, fundMs) - appMs) / 86400000);
        var daysTotal = Math.floor(totalSpan / 86400000);
        var daysRemaining = Math.max(0, daysTotal - daysElapsed);
        html += '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:0.72rem;color:#888">';
        html += '<span>Day ' + Math.max(0, daysElapsed) + ' of ' + daysTotal + '</span>';
        if (nowMs < fundMs) {
          html += '<span>' + daysRemaining + ' day' + (daysRemaining !== 1 ? 's' : '') + ' remaining</span>';
        } else if (nowMs >= fundMs) {
          html += '<span style="color:#22c55e;font-weight:600">Complete</span>';
        }
        html += '</div>';

        html += '</div>'; /* end container */
        html += '</div>'; /* end rpt-section */
      }

      /* Calendar */
      var allDates = [];
      dates.forEach(function (d) { if (d.date && d.visible) allDates.push({ date: d.date, cat: d.category, label: d.label }); });
      customDates.forEach(function (d) { if (d.date) allDates.push({ date: d.date, cat: d.category, label: d.label }); });

      if (allDates.length) {
        /* Figure out which months to render */
        var monthSet = {};
        allDates.forEach(function (d) {
          var key = d.date.substring(0, 7); // YYYY-MM
          monthSet[key] = true;
        });
        var monthKeys = Object.keys(monthSet).sort();

        html += '<div class="rpt-section"><h4 class="rpt-section-title">Calendar</h4>';
        html += '<div style="display:flex;flex-direction:column;gap:24px;align-items:center">';

        monthKeys.forEach(function (mk) {
          var parts = mk.split('-');
          var year = parseInt(parts[0], 10);
          var month = parseInt(parts[1], 10) - 1;
          var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          var firstDay = new Date(year, month, 1).getDay();
          var daysInMonth = new Date(year, month + 1, 0).getDate();
          var today = new Date();

          /* Events for this month */
          var eventsInMonth = {};
          allDates.forEach(function (d) {
            if (d.date.substring(0, 7) === mk) {
              var day = parseInt(d.date.substring(8, 10), 10);
              if (!eventsInMonth[day]) eventsInMonth[day] = [];
              eventsInMonth[day].push(d);
            }
          });

          html += '<div style="width:100%;max-width:540px;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden;background:#fff">';
          html += '<div style="font-weight:800;font-size:1.05rem;padding:10px 0;text-align:center;background:#f8fafc;border-bottom:1px solid #e5e7eb;color:#1e293b;letter-spacing:0.02em">' + months[month] + ' ' + year + '</div>';
          html += '<table style="border-collapse:collapse;font-size:0.72rem;width:100%">';
          html += '<thead><tr>';
          ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function (d) {
            html += '<th style="padding:6px 4px;text-align:center;color:#64748b;font-weight:700;font-size:0.7rem;background:#f1f5f9;border-bottom:2px solid #e2e8f0">' + d + '</th>';
          });
          html += '</tr></thead><tbody><tr>';

          /* Leading empty cells */
          for (var e = 0; e < firstDay; e++) {
            html += '<td style="padding:5px 4px;border:1px solid #f0f0f0"></td>';
          }

          for (var d = 1; d <= daysInMonth; d++) {
            var cellIdx = (firstDay + d - 1) % 7;
            var isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            var hasEvents = !!eventsInMonth[d];
            var bg = isToday ? '#f0fdf4' : (hasEvents ? '#fefce8' : '');
            html += '<td style="padding:5px 4px;text-align:left;vertical-align:top;min-width:36px;min-height:44px;border:1px solid #f0f0f0;' + (bg ? 'background:' + bg + ';' : '') + '">';
            html += '<div style="font-size:0.72rem;margin-bottom:2px;' + (isToday ? 'font-weight:700;color:#22c55e' : 'color:#555') + '">' + d + '</div>';
            if (eventsInMonth[d]) {
              eventsInMonth[d].forEach(function (ev) {
                var color = LT_CATEGORY_COLORS[ev.cat] || '#888';
                html += '<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px;line-height:1.2">';
                html += '<span style="width:6px;height:6px;min-width:6px;border-radius:50%;background:' + color + ';display:inline-block"></span>';
                html += '<span style="font-size:0.65rem;color:' + color + ';font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">' + MSFG.escHtml(ev.label) + '</span>';
                html += '</div>';
              });
            }
            html += '</td>';
            if (cellIdx === 6 && d < daysInMonth) html += '</tr><tr>';
          }

          /* Trailing empty cells */
          var lastCellIdx = (firstDay + daysInMonth - 1) % 7;
          for (var t = lastCellIdx + 1; t < 7; t++) {
            html += '<td style="padding:5px 4px;border:1px solid #f0f0f0"></td>';
          }
          html += '</tr></tbody></table></div>';
        });

        html += '</div>';

        /* Legend */
        html += '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:0.72rem;color:#666;justify-content:center">';
        var cats = ['milestone', 'deadline', 'lock', 'contingency', 'condition', 'turntime'];
        cats.forEach(function (c) {
          html += '<span>' + dot(LT_CATEGORY_COLORS[c]) + LT_CATEGORY_LABELS[c] + '</span>';
        });
        html += '</div>';
        html += '</div>';
      }

      /* TRID Alerts */
      if (alerts.length) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">TRID Compliance</h4>';
        alerts.forEach(function (a) {
          var bg = '#e3f2fd', border = '#90caf9', color = '#1565c0';
          if (a.type === 'ok') { bg = '#e8f5e9'; border = '#a5d6a7'; color = '#2e7d32'; }
          else if (a.type === 'warn') { bg = '#fff8e1'; border = '#ffcc80'; color = '#e65100'; }
          else if (a.type === 'danger') { bg = '#ffebee'; border = '#ef9a9a'; color = '#c62828'; }
          html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 10px;border-radius:6px;margin-bottom:6px;font-size:0.8rem;line-height:1.4;background:' + bg + ';border:1px solid ' + border + ';color:' + color + '">';
          html += '<span style="flex-shrink:0">' + (a.icon || '') + '</span>';
          html += '<span>' + MSFG.escHtml(a.text) + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      /* Notes */
      if (data.notes) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">Notes</h4>';
        html += '<div style="white-space:pre-wrap;font-size:0.85rem;line-height:1.5;color:#333">' + MSFG.escHtml(data.notes) + '</div>';
        html += '</div>';
      }

      return html;
    },

    /* ---- PDF Generator ---- */
    function (data) {
      var dates = data.dates || [];
      var customDates = data.customDates || [];
      var alerts = data.alerts || [];
      var content = [];

      var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      function formatDate(iso) {
        if (!iso) return '\u2014';
        var parts = iso.split('-');
        return monthNamesShort[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
      }

      /* Loan Info */
      var infoRows = [];
      if (data.borrower) infoRows.push(['Borrower', data.borrower]);
      if (data.fileNum) infoRows.push(['File #', data.fileNum]);
      if (data.purpose) infoRows.push(['Purpose', data.purpose]);
      if (data.program) infoRows.push(['Program', data.program]);
      if (data.loanPurpose) infoRows.push(['TRID Purpose', data.loanPurpose]);
      if (infoRows.length) {
        var infoBody = [[{ text: 'Loan Information', style: 'tableHeader' }, { text: '', style: 'tableHeader' }]];
        infoRows.forEach(function (r) { infoBody.push([r[0], { text: r[1], alignment: 'right' }]); });
        content.push({ table: { headerRows: 1, widths: ['*', 160], body: infoBody }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 8] });
      }

      /* Timeline Progress Summary */
      var appDate = data.applicationDate || '';
      var fundDate = data.fundingDate || '';
      var tlEvents = data.timelineEvents || [];

      if (appDate && fundDate) {
        var appMs = new Date(appDate + 'T00:00:00').getTime();
        var fundMs = new Date(fundDate + 'T00:00:00').getTime();
        var nowMs = Date.now();
        var totalSpan = fundMs - appMs;
        var daysElapsed = Math.floor((Math.min(nowMs, fundMs) - appMs) / 86400000);
        var daysTotal = Math.floor(totalSpan / 86400000);
        var daysRemaining = Math.max(0, daysTotal - Math.max(0, daysElapsed));
        var progressPct = totalSpan > 0 ? Math.max(0, Math.min(100, ((nowMs - appMs) / totalSpan) * 100)) : 0;

        content.push({ text: 'Timeline Progress', style: 'sectionHeader', margin: [0, 10, 0, 4] });
        content.push({ text: 'Day ' + Math.max(0, daysElapsed) + ' of ' + daysTotal + '  \u2014  Application: ' + formatDate(appDate) + '  \u2192  Funding: ' + formatDate(fundDate), fontSize: 9, color: '#333', margin: [0, 0, 0, 4] });

        /* Text-based progress bar */
        var barLen = 40;
        var filledLen = Math.round((progressPct / 100) * barLen);
        var emptyLen = barLen - filledLen;
        var barFilled = '';
        var barEmpty = '';
        for (var bi = 0; bi < filledLen; bi++) barFilled += '\u2588';
        for (var bj = 0; bj < emptyLen; bj++) barEmpty += '\u2591';
        content.push({
          text: [
            { text: barFilled, color: '#22c55e', fontSize: 10 },
            { text: barEmpty, color: '#e5e7eb', fontSize: 10 },
            { text: '  ' + Math.round(progressPct) + '%', fontSize: 8, color: '#666' }
          ],
          margin: [0, 0, 0, 2]
        });

        if (nowMs >= fundMs) {
          content.push({ text: 'Status: Complete', fontSize: 8, color: '#22c55e', bold: true, margin: [0, 0, 0, 4] });
        } else {
          content.push({ text: daysRemaining + ' day' + (daysRemaining !== 1 ? 's' : '') + ' remaining', fontSize: 8, color: '#888', margin: [0, 0, 0, 4] });
        }

        /* Event list on timeline */
        if (tlEvents.length) {
          var evBody = [[
            { text: 'Date', style: 'tableHeader' },
            { text: 'Event', style: 'tableHeader' },
            { text: 'Category', style: 'tableHeader' },
            { text: 'Day', style: 'tableHeader', alignment: 'right' }
          ]];
          var sortedEvents = tlEvents.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
          sortedEvents.forEach(function (ev) {
            var evMs = new Date(ev.date + 'T00:00:00').getTime();
            var evDay = totalSpan > 0 ? Math.floor((evMs - appMs) / 86400000) : 0;
            var catColor = LT_CATEGORY_COLORS[ev.category] || '#888';
            var catLabel = LT_CATEGORY_LABELS[ev.category] || ev.category || '';
            evBody.push([
              { text: formatDate(ev.date), fontSize: 7 },
              { text: ev.label, fontSize: 7 },
              { text: '\u25CF ' + catLabel, fontSize: 7, color: catColor },
              { text: String(evDay), fontSize: 7, alignment: 'right' }
            ]);
          });
          content.push({ table: { headerRows: 1, widths: [70, '*', 80, 30], body: evBody }, layout: 'lightHorizontalLines', margin: [0, 4, 0, 8] });
        }
      }

      /* Calendar Months */
      var allDates = [];
      dates.forEach(function (d) { if (d.date && d.visible) allDates.push({ date: d.date, cat: d.category, label: d.label }); });
      customDates.forEach(function (d) { if (d.date) allDates.push({ date: d.date, cat: d.category, label: d.label }); });

      if (allDates.length) {
        /* Determine which months to render */
        var monthSet = {};
        allDates.forEach(function (d) {
          var key = d.date.substring(0, 7);
          monthSet[key] = true;
        });
        var monthKeys = Object.keys(monthSet).sort();

        content.push({ text: 'Calendar', style: 'sectionHeader', margin: [0, 10, 0, 6] });

        monthKeys.forEach(function (mk) {
          var parts = mk.split('-');
          var year = parseInt(parts[0], 10);
          var month = parseInt(parts[1], 10) - 1;
          var firstDay = new Date(year, month, 1).getDay();
          var daysInMonth = new Date(year, month + 1, 0).getDate();
          var today = new Date();

          /* Events for this month indexed by day */
          var eventsInMonth = {};
          allDates.forEach(function (d) {
            if (d.date.substring(0, 7) === mk) {
              var day = parseInt(d.date.substring(8, 10), 10);
              if (!eventsInMonth[day]) eventsInMonth[day] = [];
              eventsInMonth[day].push(d);
            }
          });

          /* Month title */
          content.push({ text: monthNames[month] + ' ' + year, fontSize: 10, bold: true, color: '#1e293b', alignment: 'center', margin: [0, 6, 0, 4] });

          /* Build calendar grid as pdfmake table */
          var dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
          var calBody = [];

          /* Header row */
          var headerRow = dayHeaders.map(function (dh) {
            return { text: dh, bold: true, fontSize: 7, alignment: 'center', color: '#64748b', fillColor: '#f1f5f9', margin: [0, 3, 0, 3] };
          });
          calBody.push(headerRow);

          /* Build weeks */
          var cells = [];
          /* Leading empty cells */
          for (var e = 0; e < firstDay; e++) {
            cells.push({ text: '', fillColor: '#fafafa', margin: [0, 2, 0, 2] });
          }

          for (var d = 1; d <= daysInMonth; d++) {
            var isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            var hasEvents = !!eventsInMonth[d];
            var fillColor = isToday ? '#f0fdf4' : (hasEvents ? '#fefce8' : '#ffffff');

            var cellContent = [];
            /* Day number */
            cellContent.push({ text: String(d), fontSize: 7, bold: isToday, color: isToday ? '#22c55e' : '#555' });
            /* Event dots */
            if (eventsInMonth[d]) {
              eventsInMonth[d].forEach(function (ev) {
                var color = LT_CATEGORY_COLORS[ev.cat] || '#888';
                cellContent.push({ text: '\u25CF ' + ev.label, fontSize: 5, color: color, margin: [0, 1, 0, 0] });
              });
            }

            cells.push({
              stack: cellContent,
              fillColor: fillColor,
              margin: [1, 2, 1, 2]
            });
          }

          /* Trailing empty cells to complete the last week */
          var remainder = cells.length % 7;
          if (remainder > 0) {
            for (var t = remainder; t < 7; t++) {
              cells.push({ text: '', fillColor: '#fafafa', margin: [0, 2, 0, 2] });
            }
          }

          /* Split cells into rows of 7 */
          for (var ri = 0; ri < cells.length; ri += 7) {
            calBody.push(cells.slice(ri, ri + 7));
          }

          var colW = (515 - 14) / 7; // page width ~515pt, slight margin
          content.push({
            table: {
              headerRows: 1,
              widths: [colW, colW, colW, colW, colW, colW, colW],
              body: calBody
            },
            layout: {
              hLineWidth: function () { return 0.5; },
              vLineWidth: function () { return 0.5; },
              hLineColor: function () { return '#e5e7eb'; },
              vLineColor: function () { return '#e5e7eb'; },
              paddingLeft: function () { return 2; },
              paddingRight: function () { return 2; },
              paddingTop: function () { return 1; },
              paddingBottom: function () { return 1; }
            },
            margin: [0, 0, 0, 4]
          });
        });

        /* Legend */
        var cats = ['milestone', 'deadline', 'lock', 'contingency', 'condition', 'turntime'];
        var legendItems = cats.map(function (c) {
          return { text: [{ text: '\u25CF ', color: LT_CATEGORY_COLORS[c], fontSize: 9 }, { text: LT_CATEGORY_LABELS[c], fontSize: 7, color: '#666' }] };
        });
        content.push({ columns: legendItems, margin: [0, 6, 0, 8] });
      }

      /* TRID Alerts */
      if (alerts.length) {
        content.push({ text: 'TRID Compliance', style: 'sectionHeader', margin: [0, 10, 0, 4] });
        alerts.forEach(function (a) {
          var color = '#1565c0';
          var bgColor = '#e3f2fd';
          if (a.type === 'ok') { color = '#2e7d32'; bgColor = '#e8f5e9'; }
          else if (a.type === 'warn') { color = '#e65100'; bgColor = '#fff8e1'; }
          else if (a.type === 'danger') { color = '#c62828'; bgColor = '#ffebee'; }
          content.push({
            table: {
              widths: ['*'],
              body: [[{ text: (a.icon ? a.icon + ' ' : '') + a.text, fontSize: 8, color: color, fillColor: bgColor, margin: [4, 3, 4, 3] }]]
            },
            layout: {
              hLineWidth: function () { return 0.5; },
              vLineWidth: function () { return 0.5; },
              hLineColor: function () { return '#e0e0e0'; },
              vLineColor: function () { return '#e0e0e0'; }
            },
            margin: [0, 1, 0, 1]
          });
        });
      }

      /* Notes */
      if (data.notes) {
        content.push({ text: 'Notes', style: 'sectionHeader', margin: [0, 10, 0, 4] });
        content.push({ text: data.notes, fontSize: 8, color: '#333', margin: [0, 0, 0, 4] });
      }

      return content;
    }
  );
})();
