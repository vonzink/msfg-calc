(function () {
  'use strict';

  var P = MSFG.parseNum;
  var fmt = MSFG.formatCurrency;

  /* ---- DOM cache ---- */
  var dom = {};
  var feeInputIds = [
    // Origination
    'fwOrigFee', 'fwDiscountPts', 'fwProcessingFee', 'fwUnderwritingFee',
    // Cannot shop
    'fwAppraisalFee', 'fwCreditReportFee', 'fwTechFee', 'fwVOEFee',
    'fwFloodFee', 'fwTaxServiceFee', 'fwMERSFee',
    // Can shop
    'fwERecordingFee', 'fwTitleCPL', 'fwTitleLenders', 'fwTitleSettlement',
    'fwTitleTaxCert', 'fwTitleOwners', 'fwWireFee',
    // Government
    'fwRecordingFee', 'fwTransferTax',
    // Prepaids (monthly + months)
    'fwHazInsAmt', 'fwHazInsMonths', 'fwPrepaidIntPerDiem', 'fwPrepaidIntDays',
    // Escrow
    'fwEscTaxAmt', 'fwEscTaxMonths', 'fwEscInsAmt', 'fwEscInsMonths',
    // Other
    'fwOther1', 'fwOther2',
    // Monthly
    'fwMonthlyMI', 'fwMonthlyHOA',
    // Credits
    'fwSellerCredits', 'fwLenderCredits',
    // Top inputs
    'fwPropertyValue', 'fwLoanAmount', 'fwRate', 'fwTermMonths',
    'fwTotalLoanAmt', 'fwDownPayment', 'fwAPR'
  ];

  var allInputIds = feeInputIds.concat([
    'fwBorrowerName', 'fwFileNumber', 'fwPrepDate',
    'fwLoanPurpose', 'fwProduct', 'fwOccupancy', 'fwPropertyType'
  ]);

  function cacheDom() {
    allInputIds.forEach(function (id) {
      dom[id] = document.getElementById(id);
    });
  }

  function v(id) {
    var el = dom[id] || document.getElementById(id);
    if (!el) return 0;
    return P(el.value) || 0;
  }

  /* ---- Section subtotal helpers ---- */
  function sumIds(ids) {
    var total = 0;
    ids.forEach(function (id) { total += v(id); });
    return total;
  }

  /* ---- Main calculation ---- */
  function calculate() {
    var loanAmount = v('fwLoanAmount');
    var rate = v('fwRate');
    var termMonths = v('fwTermMonths');
    var propertyValue = v('fwPropertyValue');
    var downPayment = v('fwDownPayment');
    var totalLoanAmt = v('fwTotalLoanAmt') || loanAmount;

    // Origination section
    var origTotal = sumIds(['fwOrigFee', 'fwDiscountPts', 'fwProcessingFee', 'fwUnderwritingFee']);
    document.getElementById('fwOrigTotal').textContent = fmt(origTotal);

    // Services borrower cannot shop
    var cannotShopTotal = sumIds(['fwAppraisalFee', 'fwCreditReportFee', 'fwTechFee', 'fwVOEFee', 'fwFloodFee', 'fwTaxServiceFee', 'fwMERSFee']);
    document.getElementById('fwCannotShopTotal').textContent = fmt(cannotShopTotal);

    // Services borrower can shop
    var canShopTotal = sumIds(['fwERecordingFee', 'fwTitleCPL', 'fwTitleLenders', 'fwTitleSettlement', 'fwTitleTaxCert', 'fwTitleOwners', 'fwWireFee']);
    document.getElementById('fwCanShopTotal').textContent = fmt(canShopTotal);

    // Government fees
    var govTotal = sumIds(['fwRecordingFee', 'fwTransferTax']);
    document.getElementById('fwGovTotal').textContent = fmt(govTotal);

    // Prepaids
    var prepaidHazIns = v('fwHazInsAmt') * v('fwHazInsMonths');
    document.getElementById('fwPrepaidHazIns').textContent = fmt(prepaidHazIns);

    var prepaidInterest = v('fwPrepaidIntPerDiem') * v('fwPrepaidIntDays');
    document.getElementById('fwPrepaidInterest').textContent = fmt(prepaidInterest);

    var prepaidsTotal = prepaidHazIns + prepaidInterest;
    document.getElementById('fwPrepaidsTotal').textContent = fmt(prepaidsTotal);

    // Escrow
    var escrowTax = v('fwEscTaxAmt') * v('fwEscTaxMonths');
    document.getElementById('fwEscrowTax').textContent = fmt(escrowTax);

    var escrowIns = v('fwEscInsAmt') * v('fwEscInsMonths');
    document.getElementById('fwEscrowIns').textContent = fmt(escrowIns);

    var escrowTotal = escrowTax + escrowIns;
    document.getElementById('fwEscrowTotal').textContent = fmt(escrowTotal);

    // Other
    var otherTotal = sumIds(['fwOther1', 'fwOther2']);
    document.getElementById('fwOtherTotal').textContent = fmt(otherTotal);

    // Total closing costs (all fee sections)
    var totalClosingCost = origTotal + cannotShopTotal + canShopTotal + govTotal + otherTotal;
    var totalPrepaids = prepaidsTotal + escrowTotal;

    // Funds needed to close
    var loanPurpose = (dom['fwLoanPurpose'] || document.getElementById('fwLoanPurpose')).value;
    var purchasePrice = loanPurpose === 'Purchase' ? propertyValue : 0;

    // Update label based on purpose
    var priceLabel = document.getElementById('fwPurchasePriceLabel');
    if (priceLabel) {
      priceLabel.textContent = loanPurpose === 'Purchase' ? 'Purchase Price' : 'Payoff Amount';
    }

    document.getElementById('fwPurchasePrice').textContent = fmt(purchasePrice);
    document.getElementById('fwEstPrepaids').textContent = fmt(totalPrepaids);
    document.getElementById('fwEstClosing').textContent = fmt(totalClosingCost);

    var totalDue = purchasePrice + totalPrepaids + totalClosingCost;
    document.getElementById('fwTotalDue').textContent = fmt(totalDue);

    document.getElementById('fwSummaryLoanAmt').textContent = fmt(loanAmount);

    var sellerCredits = v('fwSellerCredits');
    var lenderCredits = v('fwLenderCredits');
    var totalPaid = loanAmount;
    document.getElementById('fwTotalPaid').textContent = fmt(totalPaid);

    var fundsFromYou = totalDue - totalPaid - sellerCredits - lenderCredits;
    document.getElementById('fwFundsFromYou').textContent = fmt(fundsFromYou);

    // Monthly payment
    var monthlyPI = 0;
    if (loanAmount > 0 && rate > 0 && termMonths > 0) {
      monthlyPI = MSFG.calcMonthlyPayment(loanAmount, rate, termMonths / 12);
    }
    document.getElementById('fwMonthlyPI').textContent = fmt(monthlyPI);

    var monthlyIns = v('fwHazInsAmt');
    document.getElementById('fwMonthlyIns').textContent = fmt(monthlyIns);

    var monthlyTax = v('fwEscTaxAmt');
    document.getElementById('fwMonthlyTax').textContent = fmt(monthlyTax);

    var mi = v('fwMonthlyMI');
    var hoa = v('fwMonthlyHOA');

    var totalMonthly = monthlyPI + monthlyIns + monthlyTax + mi + hoa;
    document.getElementById('fwTotalMonthly').textContent = fmt(totalMonthly);

    // Auto-compute down payment when property value and loan amount are set
    if (propertyValue > 0 && loanAmount > 0 && loanPurpose === 'Purchase') {
      var computedDown = propertyValue - loanAmount;
      if (computedDown >= 0 && dom['fwDownPayment'] && !dom['fwDownPayment'].dataset.userEdited) {
        dom['fwDownPayment'].value = computedDown;
      }
    }

    // Auto-compute total loan amount if not set
    if (totalLoanAmt === 0 && loanAmount > 0) {
      if (dom['fwTotalLoanAmt']) dom['fwTotalLoanAmt'].value = loanAmount;
    }

    // Send tally to workspace
    if (window.top !== window) {
      window.top.postMessage({
        type: 'msfg-tally-update',
        slug: 'fee-worksheet',
        monthlyPayment: totalMonthly,
        loanAmount: loanAmount,
        cashToClose: fundsFromYou
      }, window.location.origin);
    }
  }

  /* ---- Print ---- */
  function printWorksheet() {
    window.print();
  }

  /* ---- Clear ---- */
  function clearAll() {
    allInputIds.forEach(function (id) {
      var el = dom[id] || document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else if (el.type === 'date') {
        el.value = '';
      } else if (el.type === 'number') {
        el.value = el.id === 'fwTermMonths' ? '360' :
                   el.id === 'fwHazInsMonths' ? '12' :
                   el.id === 'fwEscTaxMonths' ? '3' :
                   el.id === 'fwEscInsMonths' ? '3' : '0';
      } else {
        el.value = '';
      }
      delete el.dataset.userEdited;
    });
    calculate();
  }

  /* ---- Init ---- */
  function init() {
    cacheDom();

    // Set default prep date to today
    var prepDate = dom['fwPrepDate'];
    if (prepDate && !prepDate.value) {
      var today = new Date();
      var y = today.getFullYear();
      var m = String(today.getMonth() + 1).padStart(2, '0');
      var d = String(today.getDate()).padStart(2, '0');
      prepDate.value = y + '-' + m + '-' + d;
    }

    // Track user edits on down payment
    if (dom['fwDownPayment']) {
      dom['fwDownPayment'].addEventListener('input', function () {
        this.dataset.userEdited = '1';
      });
    }

    // Bind all inputs
    allInputIds.forEach(function (id) {
      var el = dom[id] || document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    // Action buttons
    var printBtn = document.getElementById('fwPrintBtn');
    if (printBtn) printBtn.addEventListener('click', printWorksheet);

    var clearBtn = document.getElementById('fwClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);

    calculate();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
