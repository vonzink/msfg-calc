(function () {
  'use strict';

  const P = MSFG.parseNum;
  const fmt = MSFG.formatCurrency;

  /* ---- Constants ---- */
  let loanCount = 1;
  const MAX_LOANS = 4;
  const STATE_KEY = 'msfg-compare-state';
  const STATE_VERSION = 2; // bump to invalidate stale sessionStorage
  const TEMPLATE_KEY = 'msfg-compare-templates';
  const UFMIP_RATE = 0.0175;

  let loanMode = 'Purchase'; // 'Purchase' or 'Refinance'
  let includeExisting = false;

  /* APR manual override per loan column */
  const aprManual = {};

  /* Per-loan input field keys */
  const INPUT_KEYS = [
    'LoanAmount', 'PropertyValue', 'Rate', 'Term', 'Product',
    'OrigFee', 'DiscountPts', 'ProcessingFee', 'UnderwritingFee',
    'AppraisalFee', 'CreditReportFee', 'FloodCert', 'TaxService',
    'TitleSearch', 'TitleInsurance', 'SettlementFee', 'SurveyFee', 'PestInspection',
    'RecordingFee', 'TransferTax',
    'PrepaidInsurance', 'PrepaidInterest',
    'EscrowTax', 'EscrowInsurance', 'EscrowMI',
    'OtherFees',
    'Payoff1st', 'Payoff2nd', 'PayoffOther',
    'DownPayment', 'EarnestMoney', 'LenderCredits', 'SellerConcessions',
    'MonthlyTax', 'MonthlyInsurance', 'MonthlyMI', 'MonthlyHOA'
  ];

  /* Fields that reset APR manual override */
  const APR_AFFECTING = ['LoanAmount', 'Rate', 'Term', 'DiscountPts', 'PrepaidInsurance', 'PrepaidInterest'];

  /* Custom line items */
  let customItems = [];
  let customItemCounter = 0;

  const SECTION_INSERT = {
    origination: '.cmp-sub-row[data-row="origTotal"]',
    cannotShop: '.cmp-sub-row[data-row="cannotShopTotal"]',
    canShop: '.cmp-sub-row[data-row="canShopTotal"]',
    government: '.cmp-sub-row[data-row="govTotal"]',
    prepaids: '.cmp-sub-row[data-row="prepaidsTotal"]',
    escrow: '.cmp-sub-row[data-row="escrowTotal"]',
    other: '.cmp-sub-row[data-row="otherTotal"]',
    monthly: '[data-row="totalMonthly"]'
  };

  /* Rows relevant for existing loan (everything else gets "—") */
  const EXISTING_ROWS = new Set([
    'product', 'propertyValue', 'loanAmount', 'totalLoanAmount', 'rate', 'term',
    'ltv', 'monthlyPI', 'monthlyPIRow', 'monthlyTax', 'monthlyInsurance',
    'monthlyMI', 'monthlyHOA', 'totalMonthly', 'APR', 'notes'
  ]);

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
      if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') e.value = text;
      else e.textContent = text;
    }
  }

  /* ---- Debounced save ---- */
  let saveTimer = null;
  function debouncedSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 300);
  }

  /* ---- APR (Reg Z binary search) ---- */
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

  function bindAprInput(idx) {
    const aprEl = el('cmpAPR_' + idx);
    if (!aprEl) return;
    aprEl.addEventListener('input', function () {
      aprManual[idx] = true;
      aprEl.classList.remove('cmp-computed');
    });
    aprEl.addEventListener('change', debouncedSave);
  }

  function bindAprResetters(idx) {
    APR_AFFECTING.forEach(key => {
      const e = el('cmp' + key + '_' + idx);
      if (!e) return;
      e.addEventListener('input', function () {
        if (aprManual[idx]) {
          aprManual[idx] = false;
          const aprEl = el('cmpAPR_' + idx);
          if (aprEl) aprEl.classList.add('cmp-computed');
        }
      });
    });
  }

  /* ---- Purchase / Refi toggle ---- */
  function initModeToggle() {
    document.querySelectorAll('.cmp-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cmp-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loanMode = btn.dataset.mode;
        applyMode();
        calculate();
      });
    });
  }

  function applyMode() {
    const isPurchase = loanMode === 'Purchase';
    document.querySelectorAll('.cmp-purchase-only').forEach(r => {
      r.style.display = isPurchase ? '' : 'none';
    });
    document.querySelectorAll('.cmp-refi-only').forEach(r => {
      r.style.display = isPurchase ? 'none' : '';
    });
  }

  /* ---- Existing Loan ---- */
  function initExistingToggle() {
    const cb = el('cmpIncludeExisting');
    if (!cb) return;
    cb.addEventListener('change', () => {
      if (cb.checked && !includeExisting) {
        includeExisting = true;
        addExistingColumn();
      } else if (!cb.checked && includeExisting) {
        includeExisting = false;
        removeExistingColumn();
      }
      calculate();
    });
  }

  function addExistingColumn() {
    const headerRow = el('cmpHeaderRow');
    const firstColTh = headerRow.querySelector('.cmp-col-th[data-col="1"]');

    // Insert header
    const th = document.createElement('th');
    th.className = 'cmp-col-th cmp-existing-col-th';
    th.dataset.col = '0';
    th.innerHTML = '<div class="cmp-col-header"><span class="cmp-col-label" style="border-color:var(--color-gray-400);color:var(--color-gray-600);cursor:default;">Existing</span></div>';
    headerRow.insertBefore(th, firstColTh);

    // Add cells to body rows
    const rows = el('cmpBody').querySelectorAll('tr');
    rows.forEach(row => {
      if (row.classList.contains('cmp-section-hdr')) {
        row.querySelector('td').setAttribute('colspan', '99');
        return;
      }
      const rowKey = row.dataset.row;
      const firstCell = row.querySelector('td:nth-child(2)');
      if (!firstCell) return;

      const td = document.createElement('td');
      td.classList.add('cmp-loan-cell', 'cmp-existing-cell');

      if (EXISTING_ROWS.has(rowKey)) {
        // Clone the input/span pattern
        const input1 = firstCell.querySelector('input');
        const span1 = firstCell.querySelector('span.cmp-computed');
        const ta1 = firstCell.querySelector('textarea');
        if (ta1) {
          const ta = document.createElement('textarea');
          ta.className = ta1.className;
          ta.rows = ta1.rows;
          ta.placeholder = 'Existing loan notes...';
          ta.id = 'cmpNotes_0';
          td.appendChild(ta);
        } else if (input1 && !input1.closest('.cmp-ufmip-cell')) {
          const inp = input1.cloneNode(true);
          const key = rowKey.charAt(0).toUpperCase() + rowKey.slice(1);
          inp.id = 'cmp' + key + '_0';
          if (inp.type === 'number') inp.value = rowKey === 'term' ? '360' : '';
          else inp.value = '';
          inp.addEventListener('input', calculate);
          inp.addEventListener('change', calculate);
          td.appendChild(inp);
          if (rowKey === 'APR') bindAprInput(0);
        } else if (span1) {
          const sp = document.createElement('span');
          sp.className = span1.className;
          const key = rowKey.charAt(0).toUpperCase() + rowKey.slice(1);
          sp.id = 'cmp' + key + '_0';
          sp.textContent = '$0';
          td.appendChild(sp);
        } else {
          td.innerHTML = '<span class="cmp-existing-na">&mdash;</span>';
        }
      } else {
        td.innerHTML = '<span class="cmp-existing-na">&mdash;</span>';
      }

      // Insert before the Loan 1 cell (td at index 1)
      row.insertBefore(td, firstCell);
    });
  }

  function removeExistingColumn() {
    // Remove header
    const th = el('cmpHeaderRow').querySelector('[data-col="0"]');
    if (th) th.remove();

    // Remove cells
    document.querySelectorAll('.cmp-existing-cell').forEach(td => td.remove());

    // Reset section header colspans
    el('cmpBody').querySelectorAll('.cmp-section-hdr td').forEach(td => {
      td.setAttribute('colspan', '99');
    });
  }

  /* ---- FHA UFMIP toggle ---- */
  function showFhaRows() {
    document.querySelectorAll('.cmp-fha-row').forEach(r => r.classList.add('cmp-fha-visible'));
  }

  function hideFhaRows() {
    document.querySelectorAll('.cmp-fha-row').forEach(r => r.classList.remove('cmp-fha-visible'));
  }

  function updateFhaVisibility() {
    let anyFha = false;
    for (let i = (includeExisting ? 0 : 1); i <= loanCount; i++) {
      const prod = (el('cmpProduct_' + i) || {}).value || '';
      if (/fha/i.test(prod)) { anyFha = true; break; }
    }
    if (anyFha) showFhaRows(); else hideFhaRows();
  }

  /* ---- Custom line items ---- */
  function sumCustomForSection(section, idx) {
    let total = 0;
    customItems.forEach(item => {
      if (item.section === section) total += v('cmpCustom_' + item.id + '_' + idx);
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

    const tr = document.createElement('tr');
    tr.className = 'cmp-detail-row cmp-detail-row--custom';
    tr.dataset.section = sectionKey;
    tr.dataset.row = dataRow;
    tr.dataset.customId = String(itemId);

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
    removeBtn.addEventListener('click', () => removeCustomItem(itemId));
    labelTd.appendChild(removeBtn);
    tr.appendChild(labelTd);

    const startIdx = includeExisting ? 0 : 1;
    for (let c = startIdx; c <= loanCount; c++) {
      const td = document.createElement('td');
      td.classList.add('cmp-loan-cell');
      if (c === 0) td.classList.add('cmp-existing-cell');
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

    const selector = SECTION_INSERT[sectionKey];
    const anchor = selector ? el('cmpBody').querySelector(selector) : null;
    if (anchor) anchor.parentNode.insertBefore(tr, anchor);

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

    // Header
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

    // Body cells
    const rows = el('cmpBody').querySelectorAll('tr');
    rows.forEach(row => {
      const rowKey = row.dataset.row;
      if (row.classList.contains('cmp-section-hdr')) {
        row.querySelector('td').setAttribute('colspan', '99');
        return;
      }

      // Find the Loan 1 cell to clone pattern from
      const loan1Cell = row.querySelector('td:nth-child(' + (includeExisting ? 3 : 2) + ')');
      if (!loan1Cell) return;

      const td = document.createElement('td');
      td.classList.add('cmp-loan-cell');

      const input1 = loan1Cell.querySelector('input:not([type="checkbox"])');
      const checkbox1 = loan1Cell.querySelector('input[type="checkbox"]');
      const select1 = loan1Cell.querySelector('select');
      const textarea1 = loan1Cell.querySelector('textarea');
      const span1 = loan1Cell.querySelector('span.cmp-computed');
      const ufmipCell = loan1Cell.querySelector('.cmp-ufmip-cell');

      if (ufmipCell) {
        // Clone UFMIP cell structure
        td.innerHTML =
          '<div class="cmp-ufmip-cell">' +
            '<label class="cmp-ufmip-toggle"><input type="checkbox" id="cmpFinanceUfmip_' + idx + '"> Finance</label>' +
            '<span class="cmp-computed" id="cmpUfmipAmount_' + idx + '">$0</span>' +
          '</div>';
        td.querySelector('#cmpFinanceUfmip_' + idx).addEventListener('change', calculate);
      } else if (textarea1) {
        const ta = document.createElement('textarea');
        ta.id = 'cmpNotes_' + idx;
        ta.className = textarea1.className;
        ta.rows = textarea1.rows;
        ta.placeholder = textarea1.placeholder;
        ta.value = '';
        td.appendChild(ta);
      } else if (input1) {
        const inp = input1.cloneNode(true);
        const key = rowKey.charAt(0).toUpperCase() + rowKey.slice(1);
        inp.id = 'cmp' + key + '_' + idx;
        if (inp.type === 'number') inp.value = rowKey === 'term' ? '360' : '';
        else inp.value = '';
        inp.className = input1.className;
        td.appendChild(inp);
        if (rowKey === 'APR') {
          bindAprInput(idx);
        } else {
          inp.addEventListener('input', calculate);
          inp.addEventListener('change', calculate);
        }
      } else if (span1) {
        const sp = document.createElement('span');
        const key = rowKey.charAt(0).toUpperCase() + rowKey.slice(1);
        sp.id = 'cmp' + key + '_' + idx;
        sp.className = span1.className;
        sp.textContent = '$0';
        td.appendChild(sp);
      }

      row.appendChild(td);
    });

    // Bind remove + APR resetters
    th.querySelector('.cmp-remove-btn').addEventListener('click', function () {
      removeLoan(parseInt(this.dataset.col, 10));
    });
    bindAprResetters(idx);

    // Bind product change for FHA detection
    const prodEl = el('cmpProduct_' + idx);
    if (prodEl) prodEl.addEventListener('input', updateFhaVisibility);

    // Bind finance UFMIP
    const ufmipCb = el('cmpFinanceUfmip_' + idx);
    if (ufmipCb) ufmipCb.addEventListener('change', calculate);

    if (loanCount >= MAX_LOANS) el('cmpAddBtn').disabled = true;

    // Copy Loan 1 data
    copyLoanToColumn(1, idx);
    calculate();
  }

  function copyLoanToColumn(fromIdx, toIdx) {
    INPUT_KEYS.forEach(key => {
      const src = el('cmp' + key + '_' + fromIdx);
      const dst = el('cmp' + key + '_' + toIdx);
      if (!src || !dst) return;
      dst.value = src.value;
    });
    const srcNotes = el('cmpNotes_' + fromIdx);
    const dstNotes = el('cmpNotes_' + toIdx);
    if (srcNotes && dstNotes) dstNotes.value = srcNotes.value;

    const srcAPR = el('cmpAPR_' + fromIdx);
    const dstAPR = el('cmpAPR_' + toIdx);
    if (srcAPR && dstAPR) {
      dstAPR.value = srcAPR.value;
      if (aprManual[fromIdx]) {
        aprManual[toIdx] = true;
        dstAPR.classList.remove('cmp-computed');
      }
    }

    // Copy Finance UFMIP checkbox
    const srcUfmip = el('cmpFinanceUfmip_' + fromIdx);
    const dstUfmip = el('cmpFinanceUfmip_' + toIdx);
    if (srcUfmip && dstUfmip) dstUfmip.checked = srcUfmip.checked;
  }

  function removeLoan(colIdx) {
    if (loanCount <= 1) return;

    const th = el('cmpHeaderRow').querySelector('.cmp-col-th[data-col="' + colIdx + '"]');
    if (th) th.remove();

    const rows = el('cmpBody').querySelectorAll('tr');
    rows.forEach(row => {
      if (row.classList.contains('cmp-section-hdr')) return;
      const cells = Array.from(row.querySelectorAll('td'));
      cells.forEach(td => {
        const child = td.querySelector('[id$="_' + colIdx + '"]');
        if (child && !td.classList.contains('cmp-existing-cell')) td.remove();
      });
    });

    Object.keys(aprManual).forEach(k => delete aprManual[k]);
    reindexColumns();
    el('cmpAddBtn').disabled = false;
    calculate();
  }

  function reindexColumns() {
    const ths = el('cmpHeaderRow').querySelectorAll('.cmp-col-th:not(.cmp-existing-col-th)');
    loanCount = ths.length;

    ths.forEach((th, i) => {
      const newIdx = i + 1;
      const oldIdx = parseInt(th.dataset.col, 10);
      th.dataset.col = newIdx;

      const labelInput = th.querySelector('.cmp-col-label');
      if (labelInput && labelInput.tagName === 'INPUT') {
        labelInput.id = 'cmpLabel_' + newIdx;
        if (labelInput.value === 'Loan ' + oldIdx) labelInput.value = 'Loan ' + newIdx;
      }
      const removeBtn = th.querySelector('.cmp-remove-btn');
      if (removeBtn) removeBtn.dataset.col = newIdx;
    });

    // Reindex body cells
    const rows = el('cmpBody').querySelectorAll('tr');
    rows.forEach(row => {
      if (row.classList.contains('cmp-section-hdr')) return;
      const cells = row.querySelectorAll('td:not(.cmp-existing-cell)');
      // cells[0] = label, cells[1..N] = loan columns
      for (let c = 1; c < cells.length; c++) {
        cells[c].querySelectorAll('[id]').forEach(child => {
          child.id = child.id.replace(/_\d+$/, '_' + c);
        });
      }
    });

    // Loan 1 should not have a remove button
    const firstTh = el('cmpHeaderRow').querySelector('.cmp-col-th[data-col="1"]');
    if (firstTh) {
      const btn = firstTh.querySelector('.cmp-remove-btn');
      if (btn) btn.remove();
    }
  }

  /* ---- Calculation ---- */
  function calculate() {
    updateFhaVisibility();
    const startIdx = includeExisting ? 0 : 1;
    for (let i = startIdx; i <= loanCount; i++) {
      calculateLoan(i);
    }
    highlightBest();
    sendTally();
    debouncedSave();
  }

  function calculateLoan(idx) {
    const loanAmount = v('cmpLoanAmount_' + idx);
    const rate = v('cmpRate_' + idx);
    const term = v('cmpTerm_' + idx);
    const propValue = v('cmpPropertyValue_' + idx);

    // FHA UFMIP
    const prod = (el('cmpProduct_' + idx) || {}).value || '';
    const isFha = /fha/i.test(prod);
    const financeUfmip = isFha && el('cmpFinanceUfmip_' + idx) && el('cmpFinanceUfmip_' + idx).checked;
    const ufmipAmt = isFha ? loanAmount * UFMIP_RATE : 0;
    setText('cmpUfmipAmount_' + idx, ufmipAmt > 0 ? fmt(ufmipAmt) : '$0');

    const totalLoanAmount = financeUfmip ? loanAmount + ufmipAmt : loanAmount;
    setText('cmpTotalLoanAmount_' + idx, totalLoanAmount > 0 ? fmt(totalLoanAmount) : '$0');

    // LTV
    if (propValue > 0 && loanAmount > 0) {
      setText('cmpLtv_' + idx, ((loanAmount / propValue) * 100).toFixed(2) + '%');
    } else {
      setText('cmpLtv_' + idx, '\u2014');
    }

    // Monthly P&I (uses totalLoanAmount to include financed UFMIP)
    let monthlyPI = 0;
    if (totalLoanAmount > 0 && rate > 0 && term > 0) {
      monthlyPI = MSFG.calcMonthlyPayment(totalLoanAmount, rate / 100, term / 12);
    }
    setText('cmpMonthlyPI_' + idx, monthlyPI > 0 ? fmt(monthlyPI) : '$0');
    setText('cmpMonthlyPIRow_' + idx, monthlyPI > 0 ? fmt(monthlyPI) : '$0');

    // Section subtotals
    const origTotal = v('cmpOrigFee_' + idx) + v('cmpDiscountPts_' + idx) +
                      v('cmpProcessingFee_' + idx) + v('cmpUnderwritingFee_' + idx) +
                      sumCustomForSection('origination', idx);
    setText('cmpOrigTotal_' + idx, fmt(origTotal));

    const cannotShopTotal = v('cmpAppraisalFee_' + idx) + v('cmpCreditReportFee_' + idx) +
                            v('cmpFloodCert_' + idx) + v('cmpTaxService_' + idx) +
                            sumCustomForSection('cannotShop', idx);
    setText('cmpCannotShopTotal_' + idx, fmt(cannotShopTotal));

    const canShopTotal = v('cmpTitleSearch_' + idx) + v('cmpTitleInsurance_' + idx) +
                         v('cmpSettlementFee_' + idx) + v('cmpSurveyFee_' + idx) +
                         v('cmpPestInspection_' + idx) + sumCustomForSection('canShop', idx);
    setText('cmpCanShopTotal_' + idx, fmt(canShopTotal));

    const govTotal = v('cmpRecordingFee_' + idx) + v('cmpTransferTax_' + idx) +
                     sumCustomForSection('government', idx);
    setText('cmpGovTotal_' + idx, fmt(govTotal));

    const prepaidsTotal = v('cmpPrepaidInsurance_' + idx) + v('cmpPrepaidInterest_' + idx) +
                          sumCustomForSection('prepaids', idx);
    setText('cmpPrepaidsTotal_' + idx, fmt(prepaidsTotal));

    const escrowTotal = v('cmpEscrowTax_' + idx) + v('cmpEscrowInsurance_' + idx) +
                        v('cmpEscrowMI_' + idx) + sumCustomForSection('escrow', idx);
    setText('cmpEscrowTotal_' + idx, fmt(escrowTotal));

    const otherTotal = v('cmpOtherFees_' + idx) + sumCustomForSection('other', idx);
    setText('cmpOtherTotal_' + idx, fmt(otherTotal));

    // TOTAL CLOSING COSTS — excludes payoffs
    const totalClosing = origTotal + cannotShopTotal + canShopTotal + govTotal +
                         prepaidsTotal + escrowTotal + otherTotal;
    setText('cmpTotalClosing_' + idx, fmt(totalClosing));

    // Payoffs (separate)
    const payoffsTotal = v('cmpPayoff1st_' + idx) + v('cmpPayoff2nd_' + idx) +
                         v('cmpPayoffOther_' + idx);
    setText('cmpPayoffsTotal_' + idx, fmt(payoffsTotal));

    // Cash to Close
    const lenderCredits = v('cmpLenderCredits_' + idx);
    const sellerConcessions = v('cmpSellerConcessions_' + idx);
    const isPurchase = loanMode === 'Purchase';
    let cashToClose;

    if (isPurchase) {
      const downPayment = v('cmpDownPayment_' + idx);
      const earnestMoney = v('cmpEarnestMoney_' + idx);
      // Non-financed UFMIP adds to cash needed
      const ufmipCash = (isFha && !financeUfmip) ? ufmipAmt : 0;
      cashToClose = downPayment + totalClosing + ufmipCash - lenderCredits - sellerConcessions - earnestMoney;
    } else {
      // Refi: (closing costs + payoffs) - total loan amount - credits
      cashToClose = totalClosing + payoffsTotal - totalLoanAmount - lenderCredits - sellerConcessions;
    }
    setText('cmpCashToClose_' + idx, fmt(cashToClose));

    // Monthly Payment
    const monthlyTax = v('cmpMonthlyTax_' + idx);
    const monthlyIns = v('cmpMonthlyInsurance_' + idx);
    const monthlyMI = v('cmpMonthlyMI_' + idx);
    const monthlyHOA = v('cmpMonthlyHOA_' + idx);
    const totalMonthly = monthlyPI + monthlyTax + monthlyIns + monthlyMI + monthlyHOA +
                         sumCustomForSection('monthly', idx);
    setText('cmpTotalMonthly_' + idx, fmt(totalMonthly));

    // APR
    if (!aprManual[idx]) {
      const discountPts = v('cmpDiscountPts_' + idx);
      const amtFinanced = totalLoanAmount - discountPts - prepaidsTotal;
      let apr = 0;
      if (amtFinanced > 0 && monthlyPI > 0 && term > 0) {
        apr = calcAPR(monthlyPI, amtFinanced, term);
      }
      setText('cmpAPR_' + idx, apr > 0 ? (apr * 100).toFixed(3) : '0');
    }
  }

  /* ---- Best-value highlighting ---- */
  function highlightBest() {
    document.querySelectorAll('.cmp-best, .cmp-best-cell').forEach(e => {
      e.classList.remove('cmp-best', 'cmp-best-cell');
    });
    if (loanCount < 2) return;

    const fields = {
      rate: 'Rate', totalClosing: 'TotalClosing', cashToClose: 'CashToClose',
      totalMonthly: 'TotalMonthly', apr: 'APR'
    };

    Object.keys(fields).forEach(rowKey => {
      const key = fields[rowKey];
      let bestVal = Infinity;
      let bestIdx = -1;

      for (let i = 1; i <= loanCount; i++) {
        const id = 'cmp' + key + '_' + i;
        const e = el(id);
        if (!e) continue;
        let val;
        if (e.tagName === 'INPUT') val = P(e.value) || 0;
        else val = P((e.textContent || '').replace(/[^0-9.-]/g, '')) || 0;
        if (val > 0 && val < bestVal) { bestVal = val; bestIdx = i; }
      }

      for (let i = 1; i <= loanCount; i++) {
        const id = 'cmp' + key + '_' + i;
        const e = el(id);
        if (!e) continue;
        const cell = e.closest('td') || e;
        if (i === bestIdx && bestVal < Infinity) {
          if (e.tagName === 'INPUT') e.classList.add('cmp-best');
          cell.classList.add('cmp-best-cell');
        }
      }
    });
  }

  /* ---- State persistence ---- */
  function saveState() {
    const state = {
      _v: STATE_VERSION,
      loanCount, loanMode, includeExisting,
      customItemCounter,
      customItems: customItems.map(ci => ({ id: ci.id, section: ci.section, name: ci.name, dataRow: ci.dataRow })),
      aprManual: {},
      values: {},
      labels: {}
    };

    for (let i = (includeExisting ? 0 : 1); i <= loanCount; i++) {
      if (aprManual[i]) state.aprManual[i] = true;
    }

    ['cmpBorrower', 'cmpProperty', 'cmpFileNumber', 'cmpPrepDate', 'cmpOccupancy', 'cmpPropType'].forEach(id => {
      const e = el(id);
      if (e) state.values[id] = e.value;
    });

    for (let i = (includeExisting ? 0 : 1); i <= loanCount; i++) {
      const label = el('cmpLabel_' + i);
      if (label && label.tagName === 'INPUT') state.labels[i] = label.value;

      INPUT_KEYS.forEach(key => {
        const e = el('cmp' + key + '_' + i);
        if (e) state.values['cmp' + key + '_' + i] = e.value;
      });

      const apr = el('cmpAPR_' + i);
      if (apr) state.values['cmpAPR_' + i] = apr.value;

      const notes = el('cmpNotes_' + i);
      if (notes) state.values['cmpNotes_' + i] = notes.value;

      const ufmipCb = el('cmpFinanceUfmip_' + i);
      if (ufmipCb) state.values['cmpFinanceUfmip_' + i] = ufmipCb.checked;

      customItems.forEach(item => {
        const e = el('cmpCustom_' + item.id + '_' + i);
        if (e) state.values['cmpCustom_' + item.id + '_' + i] = e.value;
      });
    }

    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function restoreState() {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return false;
    try {
      const state = JSON.parse(raw);
      if (!state || !state.loanCount) return false;
      if (state._v !== STATE_VERSION) { sessionStorage.removeItem(STATE_KEY); return false; }

      // Restore mode
      if (state.loanMode) {
        loanMode = state.loanMode;
        document.querySelectorAll('.cmp-toggle-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === loanMode);
        });
      }

      // Restore existing loan
      if (state.includeExisting) {
        includeExisting = true;
        el('cmpIncludeExisting').checked = true;
        addExistingColumn();
      }

      // Add extra loan columns
      for (let i = 2; i <= state.loanCount; i++) addLoan();

      // Restore custom items
      if (state.customItems && state.customItems.length > 0) {
        state.customItems.forEach(ci => {
          el('cmpNewItemSection').value = ci.section;
          el('cmpNewItemName').value = ci.name;
          addCustomItem();
        });
      }
      if (state.customItemCounter) customItemCounter = state.customItemCounter;

      // Restore values
      if (state.values) {
        Object.keys(state.values).forEach(id => {
          const e = el(id);
          if (!e) return;
          if (id.startsWith('cmpFinanceUfmip_')) {
            e.checked = !!state.values[id];
          } else if (e.tagName === 'SELECT') {
            for (let o = 0; o < e.options.length; o++) {
              if (e.options[o].value === state.values[id]) { e.selectedIndex = o; break; }
            }
          } else {
            e.value = state.values[id];
          }
        });
      }

      if (state.labels) {
        Object.keys(state.labels).forEach(idx => {
          const label = el('cmpLabel_' + idx);
          if (label && label.tagName === 'INPUT') label.value = state.labels[idx];
        });
      }

      if (state.aprManual) {
        Object.keys(state.aprManual).forEach(idx => {
          aprManual[idx] = true;
          const aprEl = el('cmpAPR_' + idx);
          if (aprEl) aprEl.classList.remove('cmp-computed');
        });
      }

      applyMode();
      calculate();
      return true;
    } catch (_) { return false; }
  }

  /* ---- Templates (localStorage) ---- */
  function getTemplates() {
    try {
      return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '{}');
    } catch (_) { return {}; }
  }

  function populateTemplateDropdown() {
    const sel = el('cmpTemplateSelect');
    if (!sel) return;
    const templates = getTemplates();
    sel.innerHTML = '<option value="">Load Template...</option>';
    Object.keys(templates).sort().forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  }

  function saveTemplate() {
    const name = prompt('Template name:');
    if (!name || !name.trim()) return;

    // Build template from current Loan 1 values
    const tmpl = {};
    INPUT_KEYS.forEach(key => {
      const e = el('cmp' + key + '_1');
      if (e) tmpl[key] = e.value;
    });
    const notes = el('cmpNotes_1');
    if (notes) tmpl.Notes = notes.value;
    const apr = el('cmpAPR_1');
    if (apr) tmpl.APR = apr.value;
    const prod = el('cmpProduct_1');
    if (prod) tmpl.Product = prod.value;
    const ufmip = el('cmpFinanceUfmip_1');
    if (ufmip) tmpl.FinanceUfmip = ufmip.checked;
    tmpl.loanMode = loanMode;

    // Shared fields
    ['cmpBorrower', 'cmpProperty', 'cmpOccupancy', 'cmpPropType'].forEach(id => {
      const e = el(id);
      if (e) tmpl[id] = e.value;
    });

    const templates = getTemplates();
    templates[name.trim()] = tmpl;
    try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates)); } catch (_) {}
    populateTemplateDropdown();
  }

  function loadTemplate() {
    const sel = el('cmpTemplateSelect');
    if (!sel || !sel.value) return;
    const templates = getTemplates();
    const tmpl = templates[sel.value];
    if (!tmpl) return;

    // Apply to Loan 1
    INPUT_KEYS.forEach(key => {
      const e = el('cmp' + key + '_1');
      if (e && tmpl[key] !== undefined) e.value = tmpl[key];
    });
    if (tmpl.Notes) { const e = el('cmpNotes_1'); if (e) e.value = tmpl.Notes; }
    if (tmpl.APR) { const e = el('cmpAPR_1'); if (e) e.value = tmpl.APR; }
    if (tmpl.Product) { const e = el('cmpProduct_1'); if (e) e.value = tmpl.Product; }
    if (tmpl.FinanceUfmip !== undefined) {
      const e = el('cmpFinanceUfmip_1');
      if (e) e.checked = !!tmpl.FinanceUfmip;
    }

    // Shared fields
    ['cmpBorrower', 'cmpProperty', 'cmpOccupancy', 'cmpPropType'].forEach(id => {
      const e = el(id);
      if (e && tmpl[id] !== undefined) e.value = tmpl[id];
    });

    // Mode
    if (tmpl.loanMode) {
      loanMode = tmpl.loanMode;
      document.querySelectorAll('.cmp-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === loanMode);
      });
      applyMode();
    }

    calculate();
  }

  function deleteTemplate() {
    const sel = el('cmpTemplateSelect');
    if (!sel || !sel.value) return;
    if (!confirm('Delete template "' + sel.value + '"?')) return;
    const templates = getTemplates();
    delete templates[sel.value];
    try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates)); } catch (_) {}
    populateTemplateDropdown();
  }

  /* ---- MISMO prefill ---- */
  function prefillFromMISMO(colIdx) {
    try {
      const raw = sessionStorage.getItem('msfg-mismo-data');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!MSFG.MISMOParser) return;
      const mapFn = MSFG.MISMOParser.getCalcMap('compare');
      if (!mapFn) return;
      const fields = mapFn(data, colIdx);
      Object.keys(fields).forEach(id => {
        const e = el(id);
        if (!e) return;
        if (e.tagName === 'SELECT') {
          for (let o = 0; o < e.options.length; o++) {
            if (e.options[o].value === String(fields[id])) { e.selectedIndex = o; break; }
          }
        } else {
          e.value = fields[id];
        }
        e.classList.remove('is-default');
        e.classList.add('mismo-populated');
      });

      // Shared fields
      if (colIdx === 1) {
        if (data.borrowerName && el('cmpBorrower') && !el('cmpBorrower').value) {
          el('cmpBorrower').value = data.borrowerName;
          el('cmpBorrower').classList.add('mismo-populated');
        }
        if (data.propertyAddress && el('cmpProperty') && !el('cmpProperty').value) {
          el('cmpProperty').value = data.propertyAddress;
          el('cmpProperty').classList.add('mismo-populated');
        }
      }
    } catch (_) {}
    calculate();
  }

  /* ---- Clear all ---- */
  function clearAll() {
    while (loanCount > 1) removeLoan(loanCount);

    if (includeExisting) {
      includeExisting = false;
      el('cmpIncludeExisting').checked = false;
      removeExistingColumn();
    }

    customItems.forEach(item => {
      const row = el('cmpBody').querySelector('[data-custom-id="' + item.id + '"]');
      if (row) row.remove();
    });
    customItems = [];
    customItemCounter = 0;
    Object.keys(aprManual).forEach(k => delete aprManual[k]);

    INPUT_KEYS.forEach(key => {
      const e = el('cmp' + key + '_1');
      if (!e) return;
      if (e.tagName === 'SELECT') e.selectedIndex = 0;
      else if (e.type === 'number') e.value = key === 'Term' ? '360' : '';
      else e.value = '';
    });

    const apr1 = el('cmpAPR_1');
    if (apr1) { apr1.value = ''; apr1.classList.add('cmp-computed'); }
    const notes1 = el('cmpNotes_1');
    if (notes1) notes1.value = '';
    const ufmip1 = el('cmpFinanceUfmip_1');
    if (ufmip1) ufmip1.checked = false;

    ['cmpBorrower', 'cmpProperty', 'cmpFileNumber'].forEach(id => {
      const e = el(id); if (e) e.value = '';
    });
    const prepDate = el('cmpPrepDate');
    if (prepDate) prepDate.value = '';
    const label1 = el('cmpLabel_1');
    if (label1) label1.value = 'Loan 1';

    el('cmpAddBtn').disabled = false;
    sessionStorage.removeItem(STATE_KEY);

    loanMode = 'Purchase';
    document.querySelectorAll('.cmp-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === 'Purchase');
    });
    applyMode();
    calculate();
  }

  /* ---- Workspace tally ---- */
  function sendTally() {
    if (window.top === window) return;
    const totalMonthlyText = (el('cmpTotalMonthly_1') || {}).textContent || '0';
    const cashText = (el('cmpCashToClose_1') || {}).textContent || '0';
    window.top.postMessage({
      type: 'msfg-tally-update',
      slug: 'compare',
      monthlyPayment: P(totalMonthlyText.replace(/[^0-9.-]/g, '')) || 0,
      loanAmount: v('cmpLoanAmount_1'),
      cashToClose: P(cashText.replace(/[^0-9.-]/g, '')) || 0
    }, window.location.origin);
  }

  /* ---- Init ---- */
  function init() {
    const prepDate = el('cmpPrepDate');
    if (prepDate && !prepDate.value) {
      const today = new Date();
      prepDate.value = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
    }

    // Add loan-cell class to Loan 1 data cells
    el('cmpBody').querySelectorAll('tr').forEach(row => {
      if (row.classList.contains('cmp-section-hdr')) return;
      const cells = row.querySelectorAll('td');
      for (let c = 1; c < cells.length; c++) cells[c].classList.add('cmp-loan-cell');
    });

    // Bind inputs (except APR)
    document.querySelectorAll('#cmpBody input:not([type="checkbox"]), #cmpBody select').forEach(inp => {
      if (inp.id === 'cmpAPR_1') return;
      inp.addEventListener('input', calculate);
      inp.addEventListener('change', calculate);
    });

    // Bind checkboxes
    const ufmip1 = el('cmpFinanceUfmip_1');
    if (ufmip1) ufmip1.addEventListener('change', calculate);

    // Product change for FHA detection
    const prod1 = el('cmpProduct_1');
    if (prod1) prod1.addEventListener('input', updateFhaVisibility);

    bindAprInput(1);
    bindAprResetters(1);

    // Toggles
    initModeToggle();
    initExistingToggle();
    applyMode();

    // Buttons
    el('cmpAddBtn').addEventListener('click', addLoan);
    const addItemBtn = el('cmpAddItemBtn');
    if (addItemBtn) addItemBtn.addEventListener('click', addCustomItem);
    const newItemName = el('cmpNewItemName');
    if (newItemName) {
      newItemName.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addCustomItem(); }
      });
    }

    // Templates
    populateTemplateDropdown();
    const saveBtn = el('cmpSaveTemplateBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveTemplate);
    const loadBtn = el('cmpLoadTemplateBtn');
    if (loadBtn) loadBtn.addEventListener('click', loadTemplate);
    const delBtn = el('cmpDeleteTemplateBtn');
    if (delBtn) delBtn.addEventListener('click', deleteTemplate);

    // Restore state or MISMO
    const restored = restoreState();
    if (!restored) prefillFromMISMO(1);

    window.addEventListener('beforeunload', saveState);
    calculate();
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');

    if (MSFG.CalcActions) {
      MSFG.CalcActions.register(function () {
        const g = function (id) { const e = document.getElementById(id); return e ? e.textContent || e.value : ''; };
        const sections = [];
        for (let i = 1; i <= loanCount; i++) {
          const label = g('cmpLabel_' + i) || ('Loan ' + i);
          sections.push({
            heading: label,
            rows: [
              { label: 'Product', value: g('cmpProduct_' + i) || '\u2014' },
              { label: 'Loan Amount', value: g('cmpTotalLoanAmount_' + i) },
              { label: 'Interest Rate', value: parseFloat(g('cmpRate_' + i) || 0).toFixed(3) + '%' },
              { label: 'Term', value: g('cmpTerm_' + i) + ' months' },
              { label: 'LTV', value: g('cmpLtv_' + i) },
              { label: 'Monthly P&I', value: g('cmpMonthlyPI_' + i) },
              { label: 'Total Closing Costs', value: g('cmpTotalClosing_' + i) },
              { label: 'Cash to Close', value: g('cmpCashToClose_' + i), isTotal: true },
              { label: 'Total Monthly Payment', value: g('cmpTotalMonthly_' + i), isTotal: true },
              { label: 'APR', value: parseFloat(g('cmpAPR_' + i) || 0).toFixed(3) + '%' }
            ]
          });
        }
        return { title: 'Loan Comparison', sections: sections };
      });
    }
  });
})();
