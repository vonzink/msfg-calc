(function () {
  'use strict';

  const P = MSFG.parseNum;
  const fmt = MSFG.formatCurrency;

  /* ---- DOM cache ---- */
  const dom = {};
  const feeInputIds = [
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
  const computedIds = [
    'fwPrepaidHazIns', 'fwPrepaidInterest',
    'fwEscrowTax', 'fwEscrowIns',
    'fwPurchasePrice', 'fwEstPrepaids', 'fwEstClosing',
    'fwDiscount', 'fwTotalDue', 'fwSummaryLoanAmt', 'fwTotalPaid',
    'fwMonthlyPI', 'fwMonthlyIns', 'fwMonthlyTax'
  ];

  const allInputIds = feeInputIds.concat(computedIds).concat([
    'fwBorrowerName', 'fwFileNumber', 'fwPrepDate',
    'fwLoanPurpose', 'fwProduct', 'fwOccupancy', 'fwPropertyType'
  ]);

  /* Track which computed fields the user has manually overridden */
  const overrides = {};

  /* Track dynamically added line items */
  let customItems = [];
  let customItemCounter = 0;

  /* Section container mapping */
  const sectionContainers = {
    origination: 'fwOrigItems',
    cannotShop: 'fwCannotShopItems',
    canShop: 'fwCanShopItems',
    government: 'fwGovItems',
    prepaids: 'fwPrepaidsItems',
    escrow: 'fwEscrowItems',
    other: 'fwOtherItems'
  };

  function cacheDom() {
    allInputIds.forEach((id) => {
      dom[id] = document.getElementById(id);
    });
  }

  function v(id) {
    const el = dom[id] || document.getElementById(id);
    if (!el) return 0;
    return P(el.value) || 0;
  }

  /** Set a computed field value — respects user overrides */
  function setComputed(id, calculatedValue) {
    const el = dom[id] || document.getElementById(id);
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
    let total = 0;
    ids.forEach((id) => { total += v(id); });
    return total;
  }

  /** Sum all custom items belonging to a section */
  function sumCustomItems(section) {
    let total = 0;
    customItems.forEach((item) => {
      if (item.section === section) {
        const el = document.getElementById(item.inputId);
        if (el) total += P(el.value) || 0;
      }
    });
    return total;
  }

  /* ---- Main calculation ---- */
  function calculate() {
    const loanAmount = v('fwLoanAmount');
    const rate = v('fwRate');
    const termMonths = v('fwTermMonths');
    const propertyValue = v('fwPropertyValue');

    // Origination section
    const origTotal = sumIds(['fwOrigFee', 'fwDiscountPts', 'fwProcessingFee', 'fwUnderwritingFee']) + sumCustomItems('origination');
    document.getElementById('fwOrigTotal').textContent = fmt(origTotal);

    // Services borrower cannot shop
    const cannotShopTotal = sumIds(['fwAppraisalFee', 'fwCreditReportFee', 'fwTechFee', 'fwVOEFee', 'fwFloodFee', 'fwTaxServiceFee', 'fwMERSFee']) + sumCustomItems('cannotShop');
    document.getElementById('fwCannotShopTotal').textContent = fmt(cannotShopTotal);

    // Services borrower can shop
    const canShopTotal = sumIds(['fwERecordingFee', 'fwTitleCPL', 'fwTitleLenders', 'fwTitleSettlement', 'fwTitleTaxCert', 'fwTitleOwners', 'fwWireFee']) + sumCustomItems('canShop');
    document.getElementById('fwCanShopTotal').textContent = fmt(canShopTotal);

    // Government fees
    const govTotal = sumIds(['fwRecordingFee', 'fwTransferTax']) + sumCustomItems('government');
    document.getElementById('fwGovTotal').textContent = fmt(govTotal);

    // Prepaids
    const prepaidHazIns = setComputed('fwPrepaidHazIns', v('fwHazInsAmt') * v('fwHazInsMonths'));
    const prepaidInterest = setComputed('fwPrepaidInterest', v('fwPrepaidIntPerDiem') * v('fwPrepaidIntDays'));
    const prepaidsTotal = prepaidHazIns + prepaidInterest + sumCustomItems('prepaids');
    document.getElementById('fwPrepaidsTotal').textContent = fmt(prepaidsTotal);

    // Escrow
    const escrowTax = setComputed('fwEscrowTax', v('fwEscTaxAmt') * v('fwEscTaxMonths'));
    const escrowIns = setComputed('fwEscrowIns', v('fwEscInsAmt') * v('fwEscInsMonths'));
    const escrowTotal = escrowTax + escrowIns + sumCustomItems('escrow');
    document.getElementById('fwEscrowTotal').textContent = fmt(escrowTotal);

    // Other
    const otherTotal = sumIds(['fwOther1', 'fwOther2']) + sumCustomItems('other');
    document.getElementById('fwOtherTotal').textContent = fmt(otherTotal);

    // Closing costs: estClosing EXCLUDES origination; discount = origination total
    const estClosingRaw = cannotShopTotal + canShopTotal + govTotal + otherTotal;
    const discountRaw = origTotal;
    const totalPrepaids = prepaidsTotal + escrowTotal;

    // Funds needed to close
    const loanPurpose = (dom['fwLoanPurpose'] || document.getElementById('fwLoanPurpose')).value;
    const isRefi = loanPurpose.indexOf('Refinance') !== -1;
    const purchasePrice = setComputed('fwPurchasePrice', isRefi ? 0 : propertyValue);

    // Update label based on purpose
    const priceLabel = document.getElementById('fwPurchasePriceLabel');
    if (priceLabel) {
      priceLabel.textContent = isRefi ? 'Refinance' : 'Purchase Price';
    }

    const estPrepaids = setComputed('fwEstPrepaids', totalPrepaids);
    const estClosing = setComputed('fwEstClosing', estClosingRaw);
    const discount = setComputed('fwDiscount', discountRaw);

    const totalDue = setComputed('fwTotalDue', purchasePrice + estPrepaids + estClosing + discount);

    const summaryLoanAmt = setComputed('fwSummaryLoanAmt', loanAmount);

    const sellerCredits = v('fwSellerCredits');
    const lenderCredits = v('fwLenderCredits');
    const totalPaid = setComputed('fwTotalPaid', summaryLoanAmt);

    const fundsFromYou = totalDue - totalPaid - sellerCredits - lenderCredits;
    document.getElementById('fwFundsFromYou').textContent = fmt(fundsFromYou);

    // Monthly payment
    let monthlyPI = 0;
    if (loanAmount > 0 && rate > 0 && termMonths > 0) {
      monthlyPI = MSFG.calcMonthlyPayment(loanAmount, rate / 100, termMonths / 12);
    }
    monthlyPI = setComputed('fwMonthlyPI', monthlyPI);

    const monthlyIns = setComputed('fwMonthlyIns', v('fwHazInsAmt'));
    const monthlyTax = setComputed('fwMonthlyTax', v('fwEscTaxAmt'));

    const mi = v('fwMonthlyMI');
    const hoa = v('fwMonthlyHOA');

    const totalMonthly = monthlyPI + monthlyIns + monthlyTax + mi + hoa;
    document.getElementById('fwTotalMonthly').textContent = fmt(totalMonthly);

    // Auto-compute down payment when property value and loan amount are set
    if (propertyValue > 0 && loanAmount > 0 && loanPurpose === 'Purchase') {
      const computedDown = propertyValue - loanAmount;
      if (computedDown >= 0 && dom['fwDownPayment'] && !dom['fwDownPayment'].dataset.userEdited) {
        dom['fwDownPayment'].value = computedDown;
      }
    }

    // Auto-compute total loan amount if not set
    const totalLoanAmt = v('fwTotalLoanAmt') || loanAmount;
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
    const sectionKey = document.getElementById('fwNewItemSection').value;
    const nameInput = document.getElementById('fwNewItemName');
    const amountInput = document.getElementById('fwNewItemAmount');
    const name = (nameInput.value || '').trim();
    const amount = P(amountInput.value) || 0;

    if (!name) {
      nameInput.focus();
      return;
    }

    customItemCounter++;
    const inputId = 'fwCustom_' + customItemCounter;

    const item = {
      id: customItemCounter,
      section: sectionKey,
      name: name,
      inputId: inputId
    };
    customItems.push(item);

    // Build the row
    const row = document.createElement('div');
    row.className = 'fw-fee-row fw-fee-row--custom';
    row.dataset.customId = String(customItemCounter);

    const label = document.createElement('label');
    label.textContent = name;

    const input = document.createElement('input');
    input.type = 'number';
    input.id = inputId;
    input.value = amount;
    input.min = '0';
    input.step = '0.01';
    input.className = 'fw-fee-input';
    input.addEventListener('input', calculate);
    input.addEventListener('change', calculate);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'fw-fee-remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => {
      removeLineItem(item.id);
    });

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(removeBtn);

    // Append to correct section
    const containerId = sectionContainers[sectionKey];
    const container = document.getElementById(containerId);
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
    customItems = customItems.filter((item) => item.id !== id);

    // Remove from DOM
    const row = document.querySelector('[data-custom-id="' + id + '"]');
    if (row) row.remove();

    calculate();
  }

  /* ---- Programmatic line item creation (for MISMO workspace integration) ---- */
  function addCustomItemProgrammatic(section, name, amount) {
    customItemCounter++;
    const inputId = 'fwCustom_' + customItemCounter;

    const item = {
      id: customItemCounter,
      section: section,
      name: name,
      inputId: inputId
    };
    customItems.push(item);

    const row = document.createElement('div');
    row.className = 'fw-fee-row fw-fee-row--custom';
    row.dataset.customId = String(customItemCounter);

    const label = document.createElement('label');
    label.textContent = name;

    const input = document.createElement('input');
    input.type = 'number';
    input.id = inputId;
    input.value = amount || 0;
    input.min = '0';
    input.step = '0.01';
    input.className = 'fw-fee-input';
    input.addEventListener('input', calculate);
    input.addEventListener('change', calculate);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'fw-fee-remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => {
      removeLineItem(item.id);
    });

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(removeBtn);

    const containerId = sectionContainers[section];
    const container = document.getElementById(containerId);
    if (container) {
      container.appendChild(row);
    }

    calculate();
  }

  // Expose for workspace iframe integration
  window.MSFG_FW_addCustomItem = addCustomItemProgrammatic;

  /* ---- Print ---- */
  function printWorksheet() {
    window.print();
  }

  /* ---- Clear ---- */
  function clearAll() {
    // Reset overrides
    for (const key in overrides) delete overrides[key];
    computedIds.forEach((id) => {
      const el = dom[id] || document.getElementById(id);
      if (el) el.classList.remove('fw-fee-input--overridden');
    });

    // Remove custom items
    customItems.forEach((item) => {
      const row = document.querySelector('[data-custom-id="' + item.id + '"]');
      if (row) row.remove();
    });
    customItems = [];
    customItemCounter = 0;

    allInputIds.forEach((id) => {
      const el = dom[id] || document.getElementById(id);
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
    const prepDate = dom['fwPrepDate'];
    if (prepDate && !prepDate.value) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      prepDate.value = y + '-' + m + '-' + d;
    }

    // Track user edits on down payment
    if (dom['fwDownPayment']) {
      dom['fwDownPayment'].addEventListener('input', function () {
        this.dataset.userEdited = '1';
      });
    }

    // Mark computed fields as overridden when user edits them
    computedIds.forEach((id) => {
      const el = dom[id] || document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        overrides[id] = true;
        el.classList.add('fw-fee-input--overridden');
      });
      // Double-click to reset override
      el.addEventListener('dblclick', () => {
        delete overrides[id];
        el.classList.remove('fw-fee-input--overridden');
        calculate();
      });
    });

    // Bind all inputs
    allInputIds.forEach((id) => {
      const el = dom[id] || document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    // Add line item button
    const addBtn = document.getElementById('fwAddItemBtn');
    if (addBtn) addBtn.addEventListener('click', addLineItem);

    // Allow Enter key to add item
    const nameInput = document.getElementById('fwNewItemName');
    const amountInput = document.getElementById('fwNewItemAmount');
    [nameInput, amountInput].forEach((el) => {
      if (el) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addLineItem();
          }
        });
      }
    });

    // Action buttons
    const printBtn = document.getElementById('fwPrintBtn');
    if (printBtn) printBtn.addEventListener('click', printWorksheet);

    const clearBtn = document.getElementById('fwClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);

    calculate();
  }

  document.addEventListener('DOMContentLoaded', () => {
    init();
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');
  });
})();
