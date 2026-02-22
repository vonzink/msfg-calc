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

  /* Computed fields that auto-calculate but can be overridden by user */
  var computedIds = [
    'fwPrepaidHazIns', 'fwPrepaidInterest',
    'fwEscrowTax', 'fwEscrowIns',
    'fwPurchasePrice', 'fwEstPrepaids', 'fwEstClosing',
    'fwTotalDue', 'fwSummaryLoanAmt', 'fwTotalPaid',
    'fwMonthlyPI', 'fwMonthlyIns', 'fwMonthlyTax'
  ];

  var allInputIds = feeInputIds.concat(computedIds).concat([
    'fwBorrowerName', 'fwFileNumber', 'fwPrepDate',
    'fwLoanPurpose', 'fwProduct', 'fwOccupancy', 'fwPropertyType'
  ]);

  /* Track which computed fields the user has manually overridden */
  var overrides = {};

  /* Track dynamically added line items */
  var customItems = [];
  var customItemCounter = 0;

  /* Section container mapping */
  var sectionContainers = {
    origination: 'fwOrigItems',
    cannotShop: 'fwCannotShopItems',
    canShop: 'fwCanShopItems',
    government: 'fwGovItems',
    prepaids: 'fwPrepaidsItems',
    escrow: 'fwEscrowItems',
    other: 'fwOtherItems'
  };

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

  /** Set a computed field value — respects user overrides */
  function setComputed(id, calculatedValue) {
    var el = dom[id] || document.getElementById(id);
    if (!el) return calculatedValue;
    if (overrides[id]) {
      // User overrode this field, use their value
      return P(el.value) || 0;
    }
    el.value = Math.round(calculatedValue * 100) / 100;
    return calculatedValue;
  }

  /* ---- Section subtotal helpers ---- */
  function sumIds(ids) {
    var total = 0;
    ids.forEach(function (id) { total += v(id); });
    return total;
  }

  /** Sum all custom items belonging to a section */
  function sumCustomItems(section) {
    var total = 0;
    customItems.forEach(function (item) {
      if (item.section === section) {
        var el = document.getElementById(item.inputId);
        if (el) total += P(el.value) || 0;
      }
    });
    return total;
  }

  /* ---- Main calculation ---- */
  function calculate() {
    var loanAmount = v('fwLoanAmount');
    var rate = v('fwRate');
    var termMonths = v('fwTermMonths');
    var propertyValue = v('fwPropertyValue');

    // Origination section
    var origTotal = sumIds(['fwOrigFee', 'fwDiscountPts', 'fwProcessingFee', 'fwUnderwritingFee']) + sumCustomItems('origination');
    document.getElementById('fwOrigTotal').textContent = fmt(origTotal);

    // Services borrower cannot shop
    var cannotShopTotal = sumIds(['fwAppraisalFee', 'fwCreditReportFee', 'fwTechFee', 'fwVOEFee', 'fwFloodFee', 'fwTaxServiceFee', 'fwMERSFee']) + sumCustomItems('cannotShop');
    document.getElementById('fwCannotShopTotal').textContent = fmt(cannotShopTotal);

    // Services borrower can shop
    var canShopTotal = sumIds(['fwERecordingFee', 'fwTitleCPL', 'fwTitleLenders', 'fwTitleSettlement', 'fwTitleTaxCert', 'fwTitleOwners', 'fwWireFee']) + sumCustomItems('canShop');
    document.getElementById('fwCanShopTotal').textContent = fmt(canShopTotal);

    // Government fees
    var govTotal = sumIds(['fwRecordingFee', 'fwTransferTax']) + sumCustomItems('government');
    document.getElementById('fwGovTotal').textContent = fmt(govTotal);

    // Prepaids
    var prepaidHazIns = setComputed('fwPrepaidHazIns', v('fwHazInsAmt') * v('fwHazInsMonths'));
    var prepaidInterest = setComputed('fwPrepaidInterest', v('fwPrepaidIntPerDiem') * v('fwPrepaidIntDays'));
    var prepaidsTotal = prepaidHazIns + prepaidInterest + sumCustomItems('prepaids');
    document.getElementById('fwPrepaidsTotal').textContent = fmt(prepaidsTotal);

    // Escrow
    var escrowTax = setComputed('fwEscrowTax', v('fwEscTaxAmt') * v('fwEscTaxMonths'));
    var escrowIns = setComputed('fwEscrowIns', v('fwEscInsAmt') * v('fwEscInsMonths'));
    var escrowTotal = escrowTax + escrowIns + sumCustomItems('escrow');
    document.getElementById('fwEscrowTotal').textContent = fmt(escrowTotal);

    // Other
    var otherTotal = sumIds(['fwOther1', 'fwOther2']) + sumCustomItems('other');
    document.getElementById('fwOtherTotal').textContent = fmt(otherTotal);

    // Total closing costs (all fee sections)
    var totalClosingCost = origTotal + cannotShopTotal + canShopTotal + govTotal + otherTotal;
    var totalPrepaids = prepaidsTotal + escrowTotal;

    // Funds needed to close
    var loanPurpose = (dom['fwLoanPurpose'] || document.getElementById('fwLoanPurpose')).value;
    var purchasePrice = setComputed('fwPurchasePrice', loanPurpose === 'Purchase' ? propertyValue : 0);

    // Update label based on purpose
    var priceLabel = document.getElementById('fwPurchasePriceLabel');
    if (priceLabel) {
      priceLabel.textContent = loanPurpose === 'Purchase' ? 'Purchase Price' : 'Payoff Amount';
    }

    var estPrepaids = setComputed('fwEstPrepaids', totalPrepaids);
    var estClosing = setComputed('fwEstClosing', totalClosingCost);

    var totalDue = setComputed('fwTotalDue', purchasePrice + estPrepaids + estClosing);

    var summaryLoanAmt = setComputed('fwSummaryLoanAmt', loanAmount);

    var sellerCredits = v('fwSellerCredits');
    var lenderCredits = v('fwLenderCredits');
    var totalPaid = setComputed('fwTotalPaid', summaryLoanAmt);

    var fundsFromYou = totalDue - totalPaid - sellerCredits - lenderCredits;
    document.getElementById('fwFundsFromYou').textContent = fmt(fundsFromYou);

    // Monthly payment
    var monthlyPI = 0;
    if (loanAmount > 0 && rate > 0 && termMonths > 0) {
      monthlyPI = MSFG.calcMonthlyPayment(loanAmount, rate / 100, termMonths / 12);
    }
    monthlyPI = setComputed('fwMonthlyPI', monthlyPI);

    var monthlyIns = setComputed('fwMonthlyIns', v('fwHazInsAmt'));
    var monthlyTax = setComputed('fwMonthlyTax', v('fwEscTaxAmt'));

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
    var totalLoanAmt = v('fwTotalLoanAmt') || loanAmount;
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

  /* ---- Add custom line item ---- */
  function addLineItem() {
    var sectionKey = document.getElementById('fwNewItemSection').value;
    var nameInput = document.getElementById('fwNewItemName');
    var amountInput = document.getElementById('fwNewItemAmount');
    var name = (nameInput.value || '').trim();
    var amount = P(amountInput.value) || 0;

    if (!name) {
      nameInput.focus();
      return;
    }

    customItemCounter++;
    var inputId = 'fwCustom_' + customItemCounter;

    var item = {
      id: customItemCounter,
      section: sectionKey,
      name: name,
      inputId: inputId
    };
    customItems.push(item);

    // Build the row
    var row = document.createElement('div');
    row.className = 'fw-fee-row fw-fee-row--custom';
    row.dataset.customId = String(customItemCounter);

    var label = document.createElement('label');
    label.textContent = name;

    var input = document.createElement('input');
    input.type = 'number';
    input.id = inputId;
    input.value = amount;
    input.min = '0';
    input.step = '0.01';
    input.className = 'fw-fee-input';
    input.addEventListener('input', calculate);
    input.addEventListener('change', calculate);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'fw-fee-remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', function () {
      removeLineItem(item.id);
    });

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(removeBtn);

    // Append to correct section
    var containerId = sectionContainers[sectionKey];
    var container = document.getElementById(containerId);
    if (container) {
      container.appendChild(row);
    }

    // Reset add form
    nameInput.value = '';
    amountInput.value = '0';

    calculate();
  }

  function removeLineItem(id) {
    // Remove from array
    customItems = customItems.filter(function (item) { return item.id !== id; });

    // Remove from DOM
    var row = document.querySelector('[data-custom-id="' + id + '"]');
    if (row) row.remove();

    calculate();
  }

  /* ---- Print ---- */
  function printWorksheet() {
    window.print();
  }

  /* ---- Clear ---- */
  function clearAll() {
    // Reset overrides
    overrides = {};
    computedIds.forEach(function (id) {
      var el = dom[id] || document.getElementById(id);
      if (el) el.classList.remove('fw-fee-input--overridden');
    });

    // Remove custom items
    customItems.forEach(function (item) {
      var row = document.querySelector('[data-custom-id="' + item.id + '"]');
      if (row) row.remove();
    });
    customItems = [];
    customItemCounter = 0;

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

    // Mark computed fields as overridden when user edits them
    computedIds.forEach(function (id) {
      var el = dom[id] || document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        overrides[id] = true;
        el.classList.add('fw-fee-input--overridden');
      });
      // Double-click to reset override
      el.addEventListener('dblclick', function () {
        delete overrides[id];
        el.classList.remove('fw-fee-input--overridden');
        calculate();
      });
    });

    // Bind all inputs
    allInputIds.forEach(function (id) {
      var el = dom[id] || document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    // Add line item button
    var addBtn = document.getElementById('fwAddItemBtn');
    if (addBtn) addBtn.addEventListener('click', addLineItem);

    // Allow Enter key to add item
    var nameInput = document.getElementById('fwNewItemName');
    var amountInput = document.getElementById('fwNewItemAmount');
    [nameInput, amountInput].forEach(function (el) {
      if (el) {
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            addLineItem();
          }
        });
      }
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
