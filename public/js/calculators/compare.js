(function () {
  'use strict';

  const P = MSFG.parseNum;
  const fmt = MSFG.formatCurrency;

  /* ---- State ---- */
  let loanCount = 1;
  const MAX_LOANS = 4;

  /* All input field keys that exist per loan column */
  const INPUT_KEYS = [
    'LoanAmount', 'PropertyValue', 'Rate', 'Term', 'Product', 'Purpose',
    'OrigFee', 'DiscountPts', 'ProcessingFee', 'UnderwritingFee',
    'AppraisalFee', 'CreditReportFee', 'TitleFees', 'OtherThirdParty',
    'RecordingFee', 'TransferTax',
    'PrepaidInsurance', 'PrepaidInterest',
    'EscrowTax', 'EscrowInsurance',
    'DownPayment', 'SellerCredits', 'LenderCredits',
    'MonthlyTax', 'MonthlyInsurance', 'MonthlyMI', 'MonthlyHOA'
  ];

  /* Custom line items */
  let customItems = [];
  let customItemCounter = 0;

  /* Section insertion targets for custom items */
  const SECTION_INSERT = {
    origination: '.cmp-subtotal-row[data-section="origination"]',
    thirdParty: '.cmp-subtotal-row[data-section="thirdParty"]',
    government: '.cmp-subtotal-row[data-section="government"]',
    prepaids: '.cmp-subtotal-row[data-section="prepaids"]',
    escrow: '.cmp-subtotal-row[data-section="escrow"]',
    monthly: '[data-row="totalMonthly"]'
  };

  /* ---- Helpers ---- */
  function el(id) { return document.getElementById(id); }

  function v(id) {
    const e = el(id);
    if (!e) return 0;
    return P(e.value) || 0;
  }

  function setText(id, text) {
    const e = el(id);
    if (e) {
      if (e.tagName === 'INPUT') e.value = text;
      else e.textContent = text;
    }
  }

  /* ---- APR Calculation (Reg Z binary search) ---- */
  function calcPV(payment, annualRate, n) {
    if (payment <= 0 || n <= 0) return 0;
    if (annualRate === 0) return payment * n;
    const r = annualRate / 12;
    return payment * (1 - Math.pow(1 + r, -n)) / r;
  }

  function calcAPR(monthlyPmt, amtFinanced, n) {
    if (amtFinanced <= 0 || monthlyPmt <= 0 || n <= 0) return 0;
    if (monthlyPmt * n < amtFinanced) return 0;
    let lo = 0.0001, hi = 1, apr = 0;
    for (let i = 0; i < 100; i++) {
      apr = (lo + hi) / 2;
      const pv = calcPV(monthlyPmt, apr, n);
      if (Math.abs(pv - amtFinanced) < 1e-8) break;
      if (pv > amtFinanced) lo = apr; else hi = apr;
    }
    return apr;
  }

  /* ---- Custom line items ---- */
  function sumCustomForSection(section, idx) {
    let total = 0;
    customItems.forEach(item => {
      if (item.section === section) {
        total += v('cmpCustom_' + item.id + '_' + idx);
      }
    });
    return total;
  }

  function addCustomItem() {
    const sectionKey = el('cmpNewItemSection').value;
    const nameInput = el('cmpNewItemName');
    const name = (nameInput.value || '').trim();
    if (!name) { nameInput.focus(); return; }

    customItemCounter++;
    const itemId = customItemCounter;
    const dataRow = 'custom_' + itemId;

    customItems.push({ id: itemId, section: sectionKey, name: name, dataRow: dataRow });

    // Build the <tr>
    const tr = document.createElement('tr');
    tr.className = 'cmp-detail-row cmp-detail-row--custom';
    tr.dataset.section = sectionKey;
    tr.dataset.row = dataRow;
    tr.dataset.customId = String(itemId);

    // Label cell with remove button
    const labelTd = document.createElement('td');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'cmp-custom-name';
    nameSpan.textContent = name;
    labelTd.appendChild(nameSpan);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'cmp-custom-remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', function () { removeCustomItem(itemId); });
    labelTd.appendChild(removeBtn);
    tr.appendChild(labelTd);

    // One input cell per active loan column
    for (let c = 1; c <= loanCount; c++) {
      const td = document.createElement('td');
      td.classList.add('cmp-loan-cell');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'cmp-input';
      inp.id = 'cmpCustom_' + itemId + '_' + c;
      inp.value = '0';
      inp.min = '0';
      inp.step = '1';
      inp.addEventListener('input', calculate);
      inp.addEventListener('change', calculate);
      td.appendChild(inp);
      tr.appendChild(td);
    }

    // Insert before section's subtotal row
    const selector = SECTION_INSERT[sectionKey];
    const anchor = selector ? el('cmpBody').querySelector(selector) : null;
    if (anchor) {
      anchor.parentNode.insertBefore(tr, anchor);
    }

    // Auto-expand the section if collapsed
    const sectionRows = document.querySelectorAll('.cmp-detail-row[data-section="' + sectionKey + '"]');
    const headerRow = document.querySelector('.cmp-section-row[data-section="' + sectionKey + '"]');
    const toggle = headerRow ? headerRow.querySelector('.cmp-section-toggle') : null;
    sectionRows.forEach(r => r.classList.remove('cmp-detail-row--hidden'));
    if (toggle) toggle.textContent = '\u25B2';

    // Reset the add form
    nameInput.value = '';
    calculate();
  }

  function removeCustomItem(itemId) {
    customItems = customItems.filter(item => item.id !== itemId);
    const row = el('cmpBody').querySelector('[data-custom-id="' + itemId + '"]');
    if (row) row.remove();
    calculate();
  }

  /* ---- Column management ---- */
  function addLoan() {
    if (loanCount >= MAX_LOANS) return;
    loanCount++;
    const idx = loanCount;

    // Add header column (before the Add button column)
    const headerRow = el('cmpHeaderRow');
    const addCol = el('cmpAddCol');
    const th = document.createElement('th');
    th.className = 'cmp-col-th';
    th.dataset.col = idx;
    th.innerHTML =
      '<div class="cmp-col-header">' +
        '<input type="text" class="cmp-col-label" id="cmpLabel_' + idx + '" value="Loan ' + idx + '">' +
        '<button type="button" class="cmp-remove-btn" title="Remove" data-col="' + idx + '">&times;</button>' +
      '</div>';
    headerRow.insertBefore(th, addCol);

    // Add cells to each body row
    const rows = el('cmpBody').querySelectorAll('tr');
    rows.forEach(row => {
      const rowKey = row.dataset.row;

      // Section header rows — update colspan
      if (row.classList.contains('cmp-section-row')) {
        const td = row.querySelector('td');
        td.setAttribute('colspan', '99');
        return;
      }

      // Data rows — clone the cell pattern from loan 1
      const firstCell = row.querySelector('td:nth-child(2)');
      if (!firstCell) return;
      const td = document.createElement('td');

      const input1 = firstCell.querySelector('input');
      const select1 = firstCell.querySelector('select');
      const textarea1 = firstCell.querySelector('textarea');
      const span1 = firstCell.querySelector('span');

      if (textarea1) {
        const ta = document.createElement('textarea');
        ta.id = 'cmp' + rowKey.charAt(0).toUpperCase() + rowKey.slice(1) + '_' + idx;
        ta.className = textarea1.className;
        ta.rows = textarea1.rows;
        ta.placeholder = textarea1.placeholder;
        ta.value = '';
        td.appendChild(ta);
      } else if (input1) {
        const inp = input1.cloneNode(true);
        inp.id = 'cmp' + rowKey.charAt(0).toUpperCase() + rowKey.slice(1) + '_' + idx;
        // Reset value
        if (inp.type === 'number') inp.value = rowKey === 'term' || rowKey === 'Term' ? '360' : '0';
        else inp.value = '';
        // Copy classes
        inp.className = input1.className;
        td.appendChild(inp);
        inp.addEventListener('input', calculate);
        inp.addEventListener('change', calculate);
      } else if (select1) {
        const sel = select1.cloneNode(true);
        sel.id = 'cmp' + rowKey.charAt(0).toUpperCase() + rowKey.slice(1) + '_' + idx;
        td.appendChild(sel);
        sel.addEventListener('change', calculate);
      } else if (span1) {
        const sp = document.createElement('span');
        sp.id = 'cmp' + rowKey.charAt(0).toUpperCase() + rowKey.slice(1) + '_' + idx;
        sp.className = span1.className;
        sp.textContent = rowKey === 'apr' ? '0.000%' : '$0';
        td.appendChild(sp);
      }

      td.classList.add('cmp-loan-cell');
      row.appendChild(td);
    });

    // Bind remove button
    th.querySelector('.cmp-remove-btn').addEventListener('click', function () {
      removeLoan(parseInt(this.dataset.col, 10));
    });

    // Disable add button if at max
    if (loanCount >= MAX_LOANS) {
      el('cmpAddBtn').disabled = true;
    }

    // Try MISMO prefill
    prefillFromMISMO(idx);

    calculate();
  }

  function removeLoan(colIdx) {
    if (loanCount <= 1) return;

    // Remove header th
    const th = el('cmpHeaderRow').querySelector('[data-col="' + colIdx + '"]');
    if (th) th.remove();

    // Remove cells from body rows
    const rows = el('cmpBody').querySelectorAll('tr');
    rows.forEach(row => {
      if (row.classList.contains('cmp-section-row')) return;
      const cells = row.querySelectorAll('td');
      cells.forEach(td => {
        const child = td.querySelector('[id$="_' + colIdx + '"]');
        if (child) td.remove();
      });
    });

    // Reindex remaining columns
    reindexColumns();

    el('cmpAddBtn').disabled = false;
    calculate();
  }

  function reindexColumns() {
    const ths = el('cmpHeaderRow').querySelectorAll('.cmp-col-th');
    loanCount = ths.length;

    ths.forEach((th, i) => {
      const newIdx = i + 1;
      const oldIdx = parseInt(th.dataset.col, 10);
      th.dataset.col = newIdx;

      // Reindex header elements
      const labelInput = th.querySelector('.cmp-col-label');
      if (labelInput) {
        labelInput.id = 'cmpLabel_' + newIdx;
        if (labelInput.value === 'Loan ' + oldIdx) labelInput.value = 'Loan ' + newIdx;
      }
      const removeBtn = th.querySelector('.cmp-remove-btn');
      if (removeBtn) removeBtn.dataset.col = newIdx;
    });

    // Reindex body cells
    const rows = el('cmpBody').querySelectorAll('tr');
    rows.forEach(row => {
      if (row.classList.contains('cmp-section-row')) return;
      const cells = row.querySelectorAll('td');
      // cells[0] = label, cells[1..N] = loan columns
      for (let c = 1; c < cells.length; c++) {
        const child = cells[c].querySelector('[id]');
        if (child) {
          // Replace trailing _N with correct index
          child.id = child.id.replace(/_\d+$/, '_' + c);
        }
      }
    });

    // Remove stale remove buttons on loan 1 (should never have one)
    const firstTh = el('cmpHeaderRow').querySelector('[data-col="1"]');
    if (firstTh) {
      const btn = firstTh.querySelector('.cmp-remove-btn');
      if (btn) btn.remove();
    }
  }

  /* ---- Calculation ---- */
  function calculate() {
    for (let i = 1; i <= loanCount; i++) {
      calculateLoan(i);
    }
    highlightBest();
    sendTally();
  }

  function calculateLoan(idx) {
    const loanAmount = v('cmpLoanAmount_' + idx);
    const rate = v('cmpRate_' + idx);
    const term = v('cmpTerm_' + idx);

    // Monthly P&I
    let monthlyPI = 0;
    if (loanAmount > 0 && rate > 0 && term > 0) {
      monthlyPI = MSFG.calcMonthlyPayment(loanAmount, rate / 100, term / 12);
    }
    setText('cmpMonthlyPI_' + idx, monthlyPI.toFixed(2));

    // Section subtotals (including custom items)
    const origTotal = v('cmpOrigFee_' + idx) + v('cmpDiscountPts_' + idx) +
                      v('cmpProcessingFee_' + idx) + v('cmpUnderwritingFee_' + idx) +
                      sumCustomForSection('origination', idx);
    setText('cmpOrigTotal_' + idx, fmt(origTotal));

    const thirdPartyTotal = v('cmpAppraisalFee_' + idx) + v('cmpCreditReportFee_' + idx) +
                            v('cmpTitleFees_' + idx) + v('cmpOtherThirdParty_' + idx) +
                            sumCustomForSection('thirdParty', idx);
    setText('cmpThirdPartyTotal_' + idx, fmt(thirdPartyTotal));

    const govTotal = v('cmpRecordingFee_' + idx) + v('cmpTransferTax_' + idx) +
                     sumCustomForSection('government', idx);
    setText('cmpGovTotal_' + idx, fmt(govTotal));

    const prepaidsTotal = v('cmpPrepaidInsurance_' + idx) + v('cmpPrepaidInterest_' + idx) +
                          sumCustomForSection('prepaids', idx);
    setText('cmpPrepaidsTotal_' + idx, fmt(prepaidsTotal));

    const escrowTotal = v('cmpEscrowTax_' + idx) + v('cmpEscrowInsurance_' + idx) +
                        sumCustomForSection('escrow', idx);
    setText('cmpEscrowTotal_' + idx, fmt(escrowTotal));

    const totalClosing = origTotal + thirdPartyTotal + govTotal + prepaidsTotal + escrowTotal;
    setText('cmpTotalClosing_' + idx, fmt(totalClosing));

    // Cash to close
    const downPayment = v('cmpDownPayment_' + idx);
    const sellerCredits = v('cmpSellerCredits_' + idx);
    const lenderCredits = v('cmpLenderCredits_' + idx);
    const cashToClose = downPayment + totalClosing - sellerCredits - lenderCredits;
    setText('cmpCashToClose_' + idx, fmt(cashToClose));

    // Total monthly payment
    const monthlyTax = v('cmpMonthlyTax_' + idx);
    const monthlyIns = v('cmpMonthlyInsurance_' + idx);
    const monthlyMI = v('cmpMonthlyMI_' + idx);
    const monthlyHOA = v('cmpMonthlyHOA_' + idx);
    const totalMonthly = monthlyPI + monthlyTax + monthlyIns + monthlyMI + monthlyHOA +
                         sumCustomForSection('monthly', idx);
    setText('cmpTotalMonthly_' + idx, fmt(totalMonthly));

    // Total interest over life of loan
    const totalInterest = term > 0 ? (monthlyPI * term) - loanAmount : 0;
    setText('cmpTotalInterest_' + idx, fmt(Math.max(0, totalInterest)));

    // APR (Reg Z: amount financed = loan - discount points - prepaids)
    const discountPts = v('cmpDiscountPts_' + idx);
    const amtFinanced = loanAmount - discountPts - prepaidsTotal;
    let apr = 0;
    if (amtFinanced > 0 && monthlyPI > 0 && term > 0) {
      apr = calcAPR(monthlyPI, amtFinanced, term);
    }
    setText('cmpAPR_' + idx, apr > 0 ? (apr * 100).toFixed(3) + '%' : '0.000%');
  }

  /* ---- Best-value highlighting ---- */
  function highlightBest() {
    if (loanCount < 2) {
      // Clear all highlights when only 1 loan
      document.querySelectorAll('.cmp-best, .cmp-best-cell').forEach(e => {
        e.classList.remove('cmp-best', 'cmp-best-cell');
      });
      return;
    }

    const bestRows = {
      rate: 'Rate', totalClosing: 'TotalClosing', cashToClose: 'CashToClose',
      totalMonthly: 'TotalMonthly', totalInterest: 'TotalInterest', apr: 'APR'
    };

    Object.keys(bestRows).forEach(rowKey => {
      const key = bestRows[rowKey];
      let bestVal = Infinity;
      let bestIdx = -1;

      // Collect values
      for (let i = 1; i <= loanCount; i++) {
        const id = 'cmp' + key + '_' + i;
        const e = el(id);
        if (!e) continue;
        let val;
        if (e.tagName === 'INPUT') val = P(e.value) || 0;
        else val = P((e.textContent || '').replace(/[^0-9.-]/g, '')) || 0;
        if (val > 0 && val < bestVal) {
          bestVal = val;
          bestIdx = i;
        }
      }

      // Apply/remove highlights
      for (let i = 1; i <= loanCount; i++) {
        const id = 'cmp' + key + '_' + i;
        const e = el(id);
        if (!e) continue;
        const cell = e.closest('td') || e;
        if (i === bestIdx && bestVal < Infinity) {
          if (e.tagName === 'INPUT') e.classList.add('cmp-best');
          cell.classList.add('cmp-best-cell');
        } else {
          if (e.tagName === 'INPUT') e.classList.remove('cmp-best');
          cell.classList.remove('cmp-best-cell');
        }
      }
    });
  }

  /* ---- Section toggle ---- */
  function toggleSection(section) {
    const rows = document.querySelectorAll('.cmp-detail-row[data-section="' + section + '"]');
    const headerRow = document.querySelector('.cmp-section-row[data-section="' + section + '"]');
    const toggle = headerRow ? headerRow.querySelector('.cmp-section-toggle') : null;

    const isHidden = rows.length > 0 && rows[0].classList.contains('cmp-detail-row--hidden');
    rows.forEach(r => {
      if (isHidden) r.classList.remove('cmp-detail-row--hidden');
      else r.classList.add('cmp-detail-row--hidden');
    });

    if (toggle) toggle.textContent = isHidden ? '\u25B2' : '\u25BC';
  }

  /* ---- MISMO prefill ---- */
  function prefillFromMISMO(colIdx) {
    try {
      const raw = sessionStorage.getItem('msfg-mismo-data');
      if (!raw) return;
      const data = JSON.parse(raw);
      const mapFn = MSFG.MISMOParser.getCalcMap('compare');
      if (!mapFn) return;
      const fields = mapFn(data, colIdx);
      Object.keys(fields).forEach(id => {
        const e = el(id);
        if (!e) return;
        if (e.tagName === 'SELECT') {
          for (let o = 0; o < e.options.length; o++) {
            if (e.options[o].value === String(fields[id])) {
              e.selectedIndex = o;
              break;
            }
          }
        } else {
          e.value = fields[id];
        }
      });

      // Also fill shared fields if this is the first loan
      if (colIdx === 1) {
        if (data.borrowerName && el('cmpBorrower') && !el('cmpBorrower').value) {
          el('cmpBorrower').value = data.borrowerName;
        }
        if (data.propertyAddress && el('cmpProperty') && !el('cmpProperty').value) {
          el('cmpProperty').value = data.propertyAddress;
        }
      }
      // Auto-expand fee sections that have populated values
      const feeFields = {
        origination: ['OrigFee', 'DiscountPts', 'ProcessingFee', 'UnderwritingFee'],
        thirdParty: ['AppraisalFee', 'CreditReportFee', 'TitleFees', 'OtherThirdParty'],
        government: ['RecordingFee', 'TransferTax'],
        prepaids: ['PrepaidInsurance', 'PrepaidInterest'],
        escrow: ['EscrowTax', 'EscrowInsurance'],
        monthly: ['MonthlyTax', 'MonthlyInsurance', 'MonthlyMI', 'MonthlyHOA']
      };
      Object.keys(feeFields).forEach(section => {
        const hasData = feeFields[section].some(key => {
          const e = el('cmp' + key + '_' + colIdx);
          return e && P(e.value) > 0;
        });
        if (hasData) {
          const rows = document.querySelectorAll('.cmp-detail-row[data-section="' + section + '"]');
          const headerRow = document.querySelector('.cmp-section-row[data-section="' + section + '"]');
          const toggle = headerRow ? headerRow.querySelector('.cmp-section-toggle') : null;
          rows.forEach(r => r.classList.remove('cmp-detail-row--hidden'));
          if (toggle) toggle.textContent = '\u25B2';
        }
      });

    } catch (e) {
      // Silently ignore parse errors
    }
    calculate();
  }

  /* ---- Clear all ---- */
  function clearAll() {
    // Remove extra loan columns
    while (loanCount > 1) {
      removeLoan(loanCount);
    }

    // Remove all custom item rows
    customItems.forEach(item => {
      const row = el('cmpBody').querySelector('[data-custom-id="' + item.id + '"]');
      if (row) row.remove();
    });
    customItems = [];
    customItemCounter = 0;

    // Reset loan 1 inputs
    INPUT_KEYS.forEach(key => {
      const e = el('cmp' + key + '_1');
      if (!e) return;
      if (e.tagName === 'SELECT') e.selectedIndex = 0;
      else if (e.type === 'number') e.value = key === 'Term' ? '360' : '0';
      else e.value = '';
    });

    // Reset notes
    const notes1 = el('cmpNotes_1');
    if (notes1) notes1.value = '';

    // Reset shared fields
    ['cmpBorrower', 'cmpProperty', 'cmpFileNumber'].forEach(id => {
      const e = el(id);
      if (e) e.value = '';
    });
    const prepDate = el('cmpPrepDate');
    if (prepDate) prepDate.value = '';

    // Reset label
    const label1 = el('cmpLabel_1');
    if (label1) label1.value = 'Loan 1';

    el('cmpAddBtn').disabled = false;
    calculate();
  }

  /* ---- Workspace tally ---- */
  function sendTally() {
    if (window.top === window) return;
    const monthlyPI = v('cmpMonthlyPI_1');
    const loanAmount = v('cmpLoanAmount_1');
    window.top.postMessage({
      type: 'msfg-tally-update',
      slug: 'compare',
      monthlyPayment: monthlyPI + v('cmpMonthlyTax_1') + v('cmpMonthlyInsurance_1') + v('cmpMonthlyMI_1') + v('cmpMonthlyHOA_1'),
      loanAmount: loanAmount,
      cashToClose: P((el('cmpCashToClose_1') || {}).textContent || '0') || 0
    }, window.location.origin);
  }

  /* ---- Init ---- */
  function init() {
    // Set default prep date
    const prepDate = el('cmpPrepDate');
    if (prepDate && !prepDate.value) {
      const today = new Date();
      prepDate.value = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
    }

    // Add loan-cell class to all Loan 1 data cells (second td in each row)
    el('cmpBody').querySelectorAll('tr').forEach(row => {
      if (row.classList.contains('cmp-section-row')) return;
      const cells = row.querySelectorAll('td');
      for (let c = 1; c < cells.length; c++) {
        cells[c].classList.add('cmp-loan-cell');
      }
    });

    // Bind all loan-1 inputs
    document.querySelectorAll('#cmpBody input, #cmpBody select').forEach(inp => {
      inp.addEventListener('input', calculate);
      inp.addEventListener('change', calculate);
    });

    // Section toggle clicks
    document.querySelectorAll('.cmp-section-row').forEach(row => {
      row.addEventListener('click', () => {
        toggleSection(row.dataset.section);
      });
    });

    // Add loan button
    el('cmpAddBtn').addEventListener('click', addLoan);

    // Add custom item button
    const addItemBtn = el('cmpAddItemBtn');
    if (addItemBtn) addItemBtn.addEventListener('click', addCustomItem);

    // Enter key on name input adds item
    const newItemName = el('cmpNewItemName');
    if (newItemName) {
      newItemName.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addCustomItem(); }
      });
    }

    // Action buttons
    const printBtn = el('cmpPrintBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const clearBtn = el('cmpClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);

    // Try MISMO prefill for loan 1
    prefillFromMISMO(1);

    calculate();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
