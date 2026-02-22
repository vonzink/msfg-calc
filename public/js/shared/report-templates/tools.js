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
        if (!amt && !total) return '';
        var detail = amt ? fmt(amt) + ' x ' + qty + ' ' + unit : '';
        var totalStr = (typeof total === 'number') ? fmt(total) : (total || '');
        return '<tr><td>' + label + (detail ? ' <span style="color:#888;font-size:0.85em">(' + detail + ')</span>' : '') + '</td><td class="rpt-num">' + totalStr + '</td></tr>';
      }
      function customLines(section) {
        var out = '';
        items.forEach(function (ci) {
          if (ci.section === section && ci.amount) {
            out += '<tr><td><em>' + ci.name + '</em></td><td class="rpt-num">' + fmt(ci.amount) + '</td></tr>';
          }
        });
        return out;
      }

      /* Loan Information */
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Information</h4>';
      html += '<div class="rpt-params">';
      if (data.borrower) html += '<div class="rpt-param"><span>Borrower(s)</span><span>' + data.borrower + '</span></div>';
      if (data.fileNumber) html += '<div class="rpt-param"><span>File #</span><span>' + data.fileNumber + '</span></div>';
      if (data.prepDate) html += '<div class="rpt-param"><span>Preparation Date</span><span>' + data.prepDate + '</span></div>';
      html += '<div class="rpt-param"><span>Property Value</span><span>' + fmt(data.propertyValue) + '</span></div>';
      if (data.purpose) html += '<div class="rpt-param"><span>Loan Purpose</span><span>' + data.purpose + '</span></div>';
      if (data.product) html += '<div class="rpt-param"><span>Product</span><span>' + data.product + '</span></div>';
      if (data.downPayment) html += '<div class="rpt-param"><span>Down Payment</span><span>' + fmt(data.downPayment) + '</span></div>';
      html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt(data.loanAmount) + '</span></div>';
      if (data.occupancy) html += '<div class="rpt-param"><span>Occupancy</span><span>' + data.occupancy + '</span></div>';
      html += '<div class="rpt-param"><span>Interest Rate</span><span>' + ratePct(data.rate) + '</span></div>';
      if (data.totalLoanAmt) html += '<div class="rpt-param"><span>Total Loan Amount</span><span>' + fmt(data.totalLoanAmt) + '</span></div>';
      if (data.propertyType) html += '<div class="rpt-param"><span>Property Type</span><span>' + data.propertyType + '</span></div>';
      if (data.apr) html += '<div class="rpt-param"><span>APR</span><span>' + ratePct(data.apr) + '</span></div>';
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

      html += '<table class="rpt-table rpt-table--compact"><thead><tr><th colspan="2" style="font-weight:700">Total Estimated Funds Needed To Close</th></tr></thead><tbody>';
      html += '<tr><td>' + (data.purpose === 'Purchase' ? 'Purchase Price' : 'Payoff Amount') + '</td><td class="rpt-num">' + fmt(data.purchasePrice || 0) + '</td></tr>';
      html += '<tr><td>Estimated Prepaid Items</td><td class="rpt-num">' + fmt(data.estPrepaids || 0) + '</td></tr>';
      html += '<tr><td>Estimated Closing Cost</td><td class="rpt-num">' + fmt(data.estClosing || 0) + '</td></tr>';
      html += '<tr style="font-weight:600;border-top:1px solid #ccc"><td>Total Due from Borrower (K)</td><td class="rpt-num">' + fmt(data.totalDue || 0) + '</td></tr>';
      html += '<tr><td>Loan Amount</td><td class="rpt-num">' + fmt(data.summaryLoanAmt || 0) + '</td></tr>';
      html += '<tr><td>Total Paid by/on Behalf of Borrower (L)</td><td class="rpt-num">' + fmt(data.totalPaid || 0) + '</td></tr>';
      if (data.sellerCredits) html += '<tr><td>Seller Credits</td><td class="rpt-num">' + fmt(data.sellerCredits) + '</td></tr>';
      if (data.lenderCredits) html += '<tr><td>Lender Credits</td><td class="rpt-num">' + fmt(data.lenderCredits) + '</td></tr>';
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
      html += '<tr><td>First Mortgage (P&I)</td><td class="rpt-num">' + fmt(data.monthlyPI) + '</td></tr>';
      html += '<tr><td>Hazard Insurance</td><td class="rpt-num">' + fmt(data.monthlyIns) + '</td></tr>';
      html += '<tr><td>Property Tax</td><td class="rpt-num">' + fmt(data.monthlyTax) + '</td></tr>';
      if (data.monthlyMI) html += '<tr><td>MI</td><td class="rpt-num">' + fmt(data.monthlyMI) + '</td></tr>';
      if (data.monthlyHOA) html += '<tr><td>HOA</td><td class="rpt-num">' + fmt(data.monthlyHOA) + '</td></tr>';
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
        if (!amt && !total) return null;
        var detail = amt ? fmt(amt) + ' x ' + qty + ' ' + unit : '';
        var totalStr = (typeof total === 'number') ? fmt(total) : (total || '');
        return [label + (detail ? ' (' + detail + ')' : ''), { text: totalStr, alignment: 'right' }];
      }
      function cfl(section) {
        var out = [];
        items.forEach(function (ci) {
          if (ci.section === section && ci.amount) {
            out.push([{ text: ci.name, italics: true }, { text: fmt(ci.amount), alignment: 'right' }]);
          }
        });
        return out;
      }
      function sectionTable(title, totalStr, rows) {
        var body = [[{ text: title, style: 'tableHeader' }, { text: totalStr, style: 'tableHeader', alignment: 'right' }]];
        rows.forEach(function (r) { if (r) body.push(r); });
        if (body.length < 2) body.push(['\u2014', { text: '$0.00', alignment: 'right' }]);
        return { table: { headerRows: 1, widths: ['*', 90], body: body }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 4] };
      }

      /* Loan info */
      var infoRows = [];
      if (data.borrower) infoRows.push(['Borrower(s)', data.borrower]);
      if (data.fileNumber) infoRows.push(['File #', data.fileNumber]);
      if (data.prepDate) infoRows.push(['Preparation Date', data.prepDate]);
      infoRows.push(['Property Value', fmt(data.propertyValue)]);
      if (data.purpose) infoRows.push(['Loan Purpose', data.purpose]);
      if (data.product) infoRows.push(['Product', data.product]);
      if (data.downPayment) infoRows.push(['Down Payment', fmt(data.downPayment)]);
      infoRows.push(['Loan Amount', fmt(data.loanAmount)]);
      if (data.occupancy) infoRows.push(['Occupancy', data.occupancy]);
      infoRows.push(['Interest Rate', ratePct(data.rate)]);
      if (data.totalLoanAmt) infoRows.push(['Total Loan Amount', fmt(data.totalLoanAmt)]);
      if (data.propertyType) infoRows.push(['Property Type', data.propertyType]);
      if (data.apr) infoRows.push(['APR', ratePct(data.apr)]);
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

      var fundsBody = [[{ text: 'Funds Needed To Close', style: 'tableHeader' }, { text: '', style: 'tableHeader' }]];
      fundsBody.push([(data.purpose === 'Purchase' ? 'Purchase Price' : 'Payoff Amount'), { text: fmt(data.purchasePrice || 0), alignment: 'right' }]);
      fundsBody.push(['Estimated Prepaid Items', { text: fmt(data.estPrepaids || 0), alignment: 'right' }]);
      fundsBody.push(['Estimated Closing Cost', { text: fmt(data.estClosing || 0), alignment: 'right' }]);
      fundsBody.push([{ text: 'Total Due from Borrower (K)', bold: true }, { text: fmt(data.totalDue || 0), alignment: 'right', bold: true }]);
      fundsBody.push(['Loan Amount', { text: fmt(data.summaryLoanAmt || 0), alignment: 'right' }]);
      fundsBody.push(['Total Paid by/on Behalf of Borrower (L)', { text: fmt(data.totalPaid || 0), alignment: 'right' }]);
      if (data.sellerCredits) fundsBody.push(['Seller Credits', { text: fmt(data.sellerCredits), alignment: 'right' }]);
      if (data.lenderCredits) fundsBody.push(['Lender Credits', { text: fmt(data.lenderCredits), alignment: 'right' }]);
      content.push({ table: { headerRows: 1, widths: ['*', 110], body: fundsBody }, layout: 'lightHorizontalLines' });
      content.push({ columns: [{ text: 'Total Estimated Funds From You', bold: true, fontSize: 11, color: '#2d6a4f' }, { text: data.fundsFromYou, alignment: 'right', bold: true, fontSize: 11, color: '#2d6a4f' }], margin: [0, 4, 0, 8] });

      var monthlyBody = [[{ text: 'Monthly Housing Payment', style: 'tableHeader' }, { text: '', style: 'tableHeader' }]];
      monthlyBody.push(['First Mortgage (P&I)', { text: fmt(data.monthlyPI), alignment: 'right' }]);
      monthlyBody.push(['Hazard Insurance', { text: fmt(data.monthlyIns), alignment: 'right' }]);
      monthlyBody.push(['Property Tax', { text: fmt(data.monthlyTax), alignment: 'right' }]);
      if (data.monthlyMI) monthlyBody.push(['MI', { text: fmt(data.monthlyMI), alignment: 'right' }]);
      if (data.monthlyHOA) monthlyBody.push(['HOA', { text: fmt(data.monthlyHOA), alignment: 'right' }]);
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
          apr: val(doc, 'cmpAPR_' + i)
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
