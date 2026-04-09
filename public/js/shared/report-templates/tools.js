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
      var fs = 7; // compact font size

      function fl(label, amount) {
        if (!amount) return null;
        return [{ text: label, fontSize: fs }, { text: fmt(amount), fontSize: fs, alignment: 'right' }];
      }
      function fml(label, amt, qty, unit, total) {
        if (!total) return null;
        var detail = amt ? fmt(amt) + 'x' + qty + unit : '';
        var totalStr = (typeof total === 'number') ? fmt(total) : fmt(0);
        return [{ text: label + (detail ? ' (' + detail + ')' : ''), fontSize: fs }, { text: totalStr, fontSize: fs, alignment: 'right' }];
      }
      function cfl(section) {
        var out = [];
        items.forEach(function (ci) {
          if (ci.section === section) {
            out.push([{ text: ci.name, italics: true, fontSize: fs }, { text: fmt(ci.amount || 0), fontSize: fs, alignment: 'right' }]);
          }
        });
        return out;
      }
      var tightLay = {
        hLineWidth: function(i, node) { return i === 0 ? 0 : 0.5; },
        vLineWidth: function() { return 0; },
        hLineColor: function() { return '#e2e6ea'; },
        paddingLeft: function() { return 3; },
        paddingRight: function() { return 3; },
        paddingTop: function() { return 1.5; },
        paddingBottom: function() { return 1.5; }
      };
      function sectionTable(title, totalStr, rows) {
        var body = [[{ text: title, bold: true, fontSize: 7.5, color: '#fff', fillColor: '#2d6a4f', margin: [2,1,2,1] }, { text: totalStr, bold: true, fontSize: 7.5, color: '#fff', fillColor: '#2d6a4f', alignment: 'right', margin: [2,1,2,1] }]];
        rows.forEach(function (r) { if (r) body.push(r); });
        return { table: { headerRows: 1, widths: ['*', 70], body: body }, layout: tightLay, margin: [0, 0, 0, 3] };
      }

      /* Loan info — compact 2-column grid */
      var leftInfo = [
        ['Borrower(s)', data.borrower || ''], ['File #', data.fileNumber || ''],
        ['Property Value', fmt(data.propertyValue)], ['Loan Amount', fmt(data.loanAmount)],
        ['Loan Purpose', data.purpose || ''], ['Occupancy', data.occupancy || ''],
        ['Product', data.product || '']
      ];
      var rightInfo = [
        ['Prep Date', data.prepDate || ''], ['Total Loan Amt', fmt(data.totalLoanAmt || 0)],
        ['Down Payment', fmt(data.downPayment || 0)], ['Interest Rate', ratePct(data.rate)],
        ['Property Type', data.propertyType || ''], ['APR / Term', ratePct(data.apr || 0) + ' / ' + data.termMonths]
      ];
      var lBody = leftInfo.map(function(r) { return [{ text: r[0], fontSize: 7, color: '#6c757d' }, { text: r[1], fontSize: 7, alignment: 'right' }]; });
      var rBody = rightInfo.map(function(r) { return [{ text: r[0], fontSize: 7, color: '#6c757d' }, { text: r[1], fontSize: 7, alignment: 'right' }]; });
      content.push({
        columns: [
          { width: '49%', table: { widths: ['*', 'auto'], body: lBody }, layout: tightLay },
          { width: '2%', text: '' },
          { width: '49%', table: { widths: ['*', 'auto'], body: rBody }, layout: tightLay }
        ],
        columnGap: 0,
        margin: [0, 0, 0, 6]
      });

      /* Fee sections — 2-column layout (left: origination/cannot shop/can shop; right: gov/prepaids/escrow/other) */
      var leftCol = [];
      leftCol.push(sectionTable('Origination Charges', data.origTotal, [fl('Origination Fee', data.origFee), fl('Discount Points', data.discountPts), fl('Processing Fee', data.processingFee), fl('Underwriting Fee', data.underwritingFee)].concat(cfl('origination'))));
      leftCol.push(sectionTable('Svc Borrower Cannot Shop', data.cannotShopTotal, [fl('Appraisal Fee', data.appraisalFee), fl('Credit Report Fee', data.creditReportFee), fl('Technology Fee', data.techFee), fl('VOE Fee', data.voeFee), fl('Flood Cert Fee', data.floodFee), fl('Tax Service Fee', data.taxServiceFee), fl('MERS Registration Fee', data.mersFee)].concat(cfl('cannotShop'))));
      leftCol.push(sectionTable('Svc Borrower Can Shop', data.canShopTotal, [fl('E-Recording Fee', data.eRecordingFee), fl('Title - CPL', data.titleCPL), fl('Title - Lenders Coverage', data.titleLenders), fl('Title - Settlement Fee', data.titleSettlement), fl('Title - Tax Cert Fee', data.titleTaxCert), fl('Title - Owners Coverage', data.titleOwners), fl('Wire Transfer Fee', data.wireFee)].concat(cfl('canShop'))));

      var rightCol = [];
      rightCol.push(sectionTable('Taxes & Gov\'t Fees', data.govTotal, [fl('Recording Fee', data.recordingFee), fl('Transfer Taxes', data.transferTax)].concat(cfl('government'))));
      rightCol.push(sectionTable('Prepaids', data.prepaidsTotal, [fml('Hazard Ins', data.hazInsAmt, data.hazInsMonths, 'mo', data.prepaidHazIns), fml('Prepaid Interest', data.prepaidIntPerDiem, data.prepaidIntDays, 'day', data.prepaidInterest)].concat(cfl('prepaids'))));
      rightCol.push(sectionTable('Initial Escrow at Closing', data.escrowTotal, [fml('Property Tax', data.escTaxAmt, data.escTaxMonths, 'mo', data.escrowTax), fml('Hazard Ins', data.escInsAmt, data.escInsMonths, 'mo', data.escrowIns)].concat(cfl('escrow'))));
      rightCol.push(sectionTable('Other', data.otherTotal, [fl('Other Fee 1', data.other1), fl('Other Fee 2', data.other2)].concat(cfl('other'))));

      content.push({
        columns: [
          { width: '49%', stack: leftCol },
          { width: '2%', text: '' },
          { width: '49%', stack: rightCol }
        ],
        columnGap: 0,
        margin: [0, 0, 0, 4]
      });

      /* Funds needed + monthly payment — side-by-side */
      var isRefi = data.purpose && data.purpose.indexOf('Refinance') !== -1;
      var fundsRows = [
        [{ text: (isRefi ? 'Refinance' : 'Purchase Price'), fontSize: fs }, { text: fmt(data.purchasePrice || 0), fontSize: fs, alignment: 'right' }],
        [{ text: 'Est. Prepaid Items', fontSize: fs }, { text: fmt(data.estPrepaids || 0), fontSize: fs, alignment: 'right' }],
        [{ text: 'Est. Closing Cost', fontSize: fs }, { text: fmt(data.estClosing || 0), fontSize: fs, alignment: 'right' }]
      ];
      if (data.discount) fundsRows.push([{ text: 'Discount', fontSize: fs }, { text: fmt(data.discount), fontSize: fs, alignment: 'right' }]);
      fundsRows.push([{ text: 'Total Due at Closing (K)', fontSize: fs, bold: true }, { text: fmt(data.totalDue || 0), fontSize: fs, alignment: 'right', bold: true }]);
      fundsRows.push([{ text: 'Loan Amount', fontSize: fs }, { text: fmt(data.summaryLoanAmt || 0), fontSize: fs, alignment: 'right' }]);
      fundsRows.push([{ text: 'Total Paid by/on Behalf (L)', fontSize: fs }, { text: fmt(data.totalPaid || 0), fontSize: fs, alignment: 'right' }]);
      fundsRows.push([{ text: 'Seller Credits', fontSize: fs }, { text: fmt(data.sellerCredits || 0), fontSize: fs, alignment: 'right' }]);
      fundsRows.push([{ text: 'Lender Credits', fontSize: fs }, { text: fmt(data.lenderCredits || 0), fontSize: fs, alignment: 'right' }]);

      var monthlyRows = [
        [{ text: 'First Mortgage', fontSize: fs }, { text: fmt(data.monthlyPI), fontSize: fs, alignment: 'right' }],
        [{ text: 'Hazard Insurance', fontSize: fs }, { text: fmt(data.monthlyIns), fontSize: fs, alignment: 'right' }],
        [{ text: 'Property Tax', fontSize: fs }, { text: fmt(data.monthlyTax), fontSize: fs, alignment: 'right' }],
        [{ text: 'Mortgage Insurance', fontSize: fs }, { text: fmt(data.monthlyMI || 0), fontSize: fs, alignment: 'right' }],
        [{ text: 'HOA', fontSize: fs }, { text: fmt(data.monthlyHOA || 0), fontSize: fs, alignment: 'right' }]
      ];

      content.push({
        columns: [
          {
            width: '49%',
            stack: [
              sectionTable('Funds Needed To Close', '', fundsRows),
              { columns: [{ text: 'Total Funds From You', bold: true, fontSize: 8.5, color: '#2d6a4f' }, { text: data.fundsFromYou, alignment: 'right', bold: true, fontSize: 8.5, color: '#2d6a4f' }], margin: [0, 1, 0, 0] }
            ]
          },
          { width: '2%', text: '' },
          {
            width: '49%',
            stack: [
              sectionTable('Monthly Housing Payment', '', monthlyRows),
              { columns: [{ text: 'Total Monthly Payment', bold: true, fontSize: 8.5, color: '#2d6a4f' }, { text: data.totalMonthly, alignment: 'right', bold: true, fontSize: 8.5, color: '#2d6a4f' }], margin: [0, 1, 0, 0] }
            ]
          }
        ],
        columnGap: 0,
        margin: [0, 0, 0, 4]
      });

      content.push({ text: 'Your actual rate, payment, and cost could be higher. Get an official Loan Estimate before choosing a loan.', fontSize: 6.5, color: '#888', italics: true, margin: [0, 2, 0, 0] });
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
