/* =====================================================
   APR Calculator
   Loan-type aware. Payment-stream APR solver.
   Uses MSFG.AprFeeCatalog for fee classification.
   ===================================================== */
(function () {
  'use strict';

  const P = MSFG.parseNum;
  const fmt = MSFG.formatCurrency;
  const pct = MSFG.formatPercent;
  const esc = MSFG.escHtml;
  const Catalog = MSFG.AprFeeCatalog;

  // In-memory per-fee state: { [feeId]: { amount, manualOverride, flags } }
  const feeState = {};

  // Loan type
  let loanType = 'CONV';

  // UI state
  let filterNonZero = false;
  // Tracks fee IDs that the user manually edited so we don't auto-overwrite
  const manuallyEditedFees = {};
  // True once a MISMO file has been applied; defaults are then suppressed
  // because the MISMO file is the source of truth for fees.
  let mismoLoaded = false;

  /* ---- Auto-calc helpers ---- */

  // Apply catalog defaultAmount to any fee that isn't already populated.
  // Skips fees the user has manually edited.
  // Skipped entirely once MISMO has been loaded — MISMO is then the source of truth.
  function applyCatalogDefaults() {
    if (mismoLoaded) return;
    Object.keys(Catalog.FEES).forEach(function (feeId) {
      const def = Catalog.FEES[feeId];
      if (typeof def.defaultAmount !== 'number') return;
      if (def.appliesTo.indexOf(loanType) === -1) return;
      if (manuallyEditedFees[feeId]) return;
      const current = (feeState[feeId] && feeState[feeId].amount) || 0;
      if (current > 0) return;
      feeState[feeId] = feeState[feeId] || {};
      feeState[feeId].amount = def.defaultAmount;
      const el = document.getElementById('fee_' + feeId);
      if (el) el.value = def.defaultAmount;
    });
  }

  // 15 days of prepaid interest = loan × rate × 15 / 365
  function autoCalcPrepaidInterest(inp) {
    if (manuallyEditedFees['prepaid_interest']) return;
    if (inp.loanAmount <= 0 || inp.interestRate <= 0) return;
    const amt = +(inp.loanAmount * inp.interestRate * 15 / 365).toFixed(2);
    feeState['prepaid_interest'] = feeState['prepaid_interest'] || {};
    feeState['prepaid_interest'].amount = amt;
    const el = document.getElementById('fee_prepaid_interest');
    if (el && document.activeElement !== el) el.value = amt;
  }

  // PMI factor by LTV (rough industry averages, configurable later)
  function pmiAnnualFactor(ltv) {
    if (ltv <= 0.80) return 0;
    if (ltv <= 0.85) return 0.0032;
    if (ltv <= 0.90) return 0.0045;
    if (ltv <= 0.95) return 0.0062;
    return 0.0085;
  }

  // FHA annual MIP factor by LTV and term (post-March 2023 chart, simplified)
  function fhaAnnualMipFactor(ltv, termYears) {
    if (termYears > 15) {
      if (ltv <= 0.90) return 0.0050;
      return 0.0055;
    }
    if (ltv <= 0.90) return 0.0015;
    return 0.0040;
  }

  function autoCalcMonthlyMI(inp) {
    if (inp.loanAmount <= 0 || inp.propertyValue <= 0) return;
    const ltv = inp.loanAmount / inp.propertyValue;

    if (loanType === 'CONV') {
      if (manuallyEditedFees['monthly_borrower_paid_pmi']) return;
      const factor = pmiAnnualFactor(ltv);
      const monthly = +((inp.loanAmount * factor) / 12).toFixed(2);
      feeState['monthly_borrower_paid_pmi'] = feeState['monthly_borrower_paid_pmi'] || {};
      feeState['monthly_borrower_paid_pmi'].amount = monthly;
      const el = document.getElementById('fee_monthly_borrower_paid_pmi');
      if (el && document.activeElement !== el) el.value = monthly;
    } else if (loanType === 'FHA') {
      if (manuallyEditedFees['fha_annual_mip']) return;
      const factor = fhaAnnualMipFactor(ltv, inp.loanTerm);
      const monthly = +((inp.loanAmount * factor) / 12).toFixed(2);
      feeState['fha_annual_mip'] = feeState['fha_annual_mip'] || {};
      feeState['fha_annual_mip'].amount = monthly;
      const el = document.getElementById('fee_fha_annual_mip');
      if (el && document.activeElement !== el) el.value = monthly;
    }
  }

  function fhaUfmipFactor() { return 0.0175; }

  function vaFundingFeeFactor(usage, downPct) {
    // Simplified table — purchase loans, regular military. Refine later.
    // Values from VA funding fee chart effective 2023.
    if (usage === 'exempt') return 0;
    const dp = downPct || 0;
    if (usage === 'subsequent') {
      if (dp >= 0.10) return 0.0125;
      if (dp >= 0.05) return 0.0150;
      return 0.0330;
    }
    // first-time use
    if (dp >= 0.10) return 0.0125;
    if (dp >= 0.05) return 0.0150;
    return 0.0215;
  }

  function autoUpdateFinancedMI(inp) {
    if (loanType === 'FHA') {
      // Only auto-populate if user hasn't manually edited
      if (!manuallyEditedFees['fha_ufmip'] && inp.loanAmount > 0) {
        const amt = +(inp.loanAmount * fhaUfmipFactor()).toFixed(2);
        feeState['fha_ufmip'] = feeState['fha_ufmip'] || {};
        feeState['fha_ufmip'].amount = amt;
        const el = document.getElementById('fee_fha_ufmip');
        if (el && document.activeElement !== el) el.value = amt;
      }
    } else if (loanType === 'VA') {
      if (!manuallyEditedFees['va_funding_fee'] && inp.loanAmount > 0) {
        const usage = (document.getElementById('vaUsage') || {}).value || 'first';
        const dpPct = inp.propertyValue > 0 ? (inp.propertyValue - inp.loanAmount) / inp.propertyValue : 0;
        const factor = vaFundingFeeFactor(usage, dpPct);
        const amt = +(inp.loanAmount * factor).toFixed(2);
        feeState['va_funding_fee'] = feeState['va_funding_fee'] || {};
        feeState['va_funding_fee'].amount = amt;
        const el = document.getElementById('fee_va_funding_fee');
        if (el && document.activeElement !== el) el.value = amt;
      }
    }
  }

  /* ---- Fee Group Rendering ---- */

  function feeRowHtml(feeId) {
    const def = Catalog.getFee(feeId);
    if (!def) return '';
    const state = feeState[feeId] || {};
    const amount = state.amount || 0;
    const flagsHtml = buildFlagInputs(feeId, def, state.flags || {});

    return (
      '<div class="apr-fee-row" data-fee-id="' + esc(feeId) + '">' +
        '<div class="apr-fee-row__main">' +
          '<label for="fee_' + esc(feeId) + '">' + esc(def.displayName) + ' ($)</label>' +
          '<input type="number" id="fee_' + esc(feeId) + '" data-fee-id="' + esc(feeId) + '" value="' + amount + '" min="0" step="50" class="apr-fee-input">' +
          '<button type="button" class="apr-pill" data-fee-id="' + esc(feeId) + '" aria-label="Toggle APR classification">APR</button>' +
        '</div>' +
        (flagsHtml ? '<details class="apr-fee-row__advanced"><summary>Advanced</summary><div class="apr-flag-grid">' + flagsHtml + '</div></details>' : '') +
      '</div>'
    );
  }

  function buildFlagInputs(feeId, def, currentFlags) {
    const codes = def.conditionCodes || [];
    const parts = [];

    if (feeId === 'application_fee_conditional') {
      parts.push(
        '<label class="apr-flag"><input type="checkbox" data-flag="chargedToAllApplicants" data-fee-id="' + esc(feeId) + '"' + (currentFlags.chargedToAllApplicants ? ' checked' : '') + '> Charged to all applicants</label>'
      );
    }
    if (codes.indexOf('BONA_FIDE_REASONABLE') !== -1) {
      const checked = currentFlags.bonaFideAndReasonable === false ? '' : ' checked';
      parts.push(
        '<label class="apr-flag"><input type="checkbox" data-flag="bonaFideAndReasonable" data-fee-id="' + esc(feeId) + '"' + checked + '> Bona fide &amp; reasonable</label>'
      );
    }
    if (codes.indexOf('BORROWER_CAN_CHOOSE_INSURER') !== -1) {
      const checked = currentFlags.borrowerCanChooseInsurer === false ? '' : ' checked';
      parts.push(
        '<label class="apr-flag"><input type="checkbox" data-flag="borrowerCanChooseInsurer" data-fee-id="' + esc(feeId) + '"' + checked + '> Borrower can choose insurer</label>'
      );
    }
    // Always allow seller-paid flag
    parts.push(
      '<label class="apr-flag"><input type="checkbox" data-flag="isSellerPaid" data-fee-id="' + esc(feeId) + '"' + (currentFlags.isSellerPaid ? ' checked' : '') + '> Seller paid</label>' +
      '<label class="apr-flag apr-flag--child"><input type="checkbox" data-flag="borrowerLegallyBound" data-fee-id="' + esc(feeId) + '"' + (currentFlags.borrowerLegallyBound === false ? '' : ' checked') + '> Borrower legally bound</label>'
    );

    return parts.join('');
  }

  function renderFeeGroups() {
    const container = document.getElementById('aprFeeGroups');
    if (!container) return;

    const html = Catalog.UI_GROUPS.map(function (group) {
      const applicableIds = group.feeIds.filter(function (feeId) {
        const def = Catalog.getFee(feeId);
        return def && def.appliesTo.indexOf(loanType) !== -1;
      });
      if (!applicableIds.length) return '';

      const rows = applicableIds.map(feeRowHtml).join('');
      const hasValues = applicableIds.some(function (id) {
        return feeState[id] && feeState[id].amount > 0;
      });
      // Lender + MI + Prepaids open by default; others closed
      const defaultOpen = group.id === 'lender' || group.id === 'mi' || group.id === 'prepaids';
      const isOpen = hasValues || defaultOpen;
      const totalNote = (function () {
        const total = applicableIds.reduce(function (acc, id) {
          return acc + ((feeState[id] && feeState[id].amount) || 0);
        }, 0);
        return total > 0 ? ' <span class="apr-fee-group__total">' + fmt(total) + '</span>' : '';
      })();

      return (
        '<details class="calc-section apr-fee-group"' + (isOpen ? ' open' : '') + ' data-group-id="' + esc(group.id) + '">' +
          '<summary><h2>' + esc(group.label) + totalNote + '</h2></summary>' +
          '<div class="apr-fee-group__rows">' + rows + '</div>' +
        '</details>'
      );
    }).join('');

    container.innerHTML = html;
    updateAllPills();
    applyFilterNonZero();
  }

  /* ---- Pill / Override ---- */

  function updateAllPills() {
    document.querySelectorAll('.apr-pill').forEach(function (pill) {
      const feeId = pill.dataset.feeId;
      const res = resolveFee(feeId, { forDisplay: true });
      pill.textContent = res.includeInApr ? 'APR' : 'Non-APR';
      pill.classList.toggle('apr-pill--yes', res.includeInApr);
      pill.classList.toggle('apr-pill--no', !res.includeInApr);
      pill.classList.toggle('apr-pill--override', !!(feeState[feeId] && feeState[feeId].manualOverride));
      pill.title = res.reason + (feeState[feeId] && feeState[feeId].manualOverride ? ' (manual override)' : '');
    });
  }

  function resolveFee(feeId, opts) {
    const state = feeState[feeId] || {};
    const flags = state.flags || {};
    // For pill display we want classification independent of amount.
    // For totals we want 0-amount → excluded.
    const amount = (opts && opts.forDisplay) ? 1 : (state.amount || 0);
    return Catalog.resolveAprTreatment(feeId, {
      loanType: loanType,
      amount: amount,
      isSellerPaid: !!flags.isSellerPaid,
      borrowerLegallyBound: flags.borrowerLegallyBound !== false,
      chargedToAllApplicants: !!flags.chargedToAllApplicants,
      bonaFideAndReasonable: flags.bonaFideAndReasonable !== false,
      borrowerCanChooseInsurer: flags.borrowerCanChooseInsurer !== false,
      manualOverride: state.manualOverride || null
    });
  }

  /* ---- APR Math ---- */

  // Build a payment vector of length n.
  // Each entry is total monthly cash flow (P&I + active monthly MI).
  function buildPaymentStream(principal, annualRate, n, monthlyMI, miDurationMonths) {
    const r = annualRate / 12;
    const pi = (r === 0) ? principal / n : principal * r / (1 - Math.pow(1 + r, -n));
    const stream = new Array(n);
    for (let i = 0; i < n; i++) {
      let pay = pi;
      if (monthlyMI > 0 && i < miDurationMonths) pay += monthlyMI;
      stream[i] = pay;
    }
    return { stream: stream, pi: pi };
  }

  function pvStream(stream, annualRate) {
    if (annualRate === 0) return stream.reduce(function (a, b) { return a + b; }, 0);
    const r = annualRate / 12;
    let pv = 0;
    for (let i = 0; i < stream.length; i++) {
      pv += stream[i] / Math.pow(1 + r, i + 1);
    }
    return pv;
  }

  function solveApr(stream, amountFinanced) {
    if (amountFinanced <= 0) return 0;
    const total = stream.reduce(function (a, b) { return a + b; }, 0);
    if (total < amountFinanced) return 0;

    let lo = 0.0001, hi = 1, mid = 0;
    for (let i = 0; i < 100; i++) {
      mid = (lo + hi) / 2;
      const pv = pvStream(stream, mid);
      if (Math.abs(pv - amountFinanced) < 1e-7) break;
      if (pv > amountFinanced) lo = mid; else hi = mid;
    }
    return mid;
  }

  /* ---- Calculation ---- */

  function getInputs() {
    return {
      loanAmount: P(document.getElementById('loanAmount').value),
      interestRate: P(document.getElementById('interestRate').value) / 100,
      loanTerm: P(document.getElementById('loanTerm').value),
      discountPointsPct: P(document.getElementById('discountPoints').value) / 100,
      lenderCredit: P(document.getElementById('lenderCredit').value),
      sellerCredit: P(document.getElementById('sellerCredit').value),
      propertyValue: P(document.getElementById('propertyValue').value)
    };
  }

  function classifyFees(loanAmount) {
    let aprPrepaidTotal = 0;
    let aprFinancedFromFees = 0;
    let monthlyMI = 0;
    let nonAprTotal = 0;

    Object.keys(feeState).forEach(function (feeId) {
      const state = feeState[feeId];
      if (!state || !state.amount) return;
      const def = Catalog.getFee(feeId);
      if (!def || def.appliesTo.indexOf(loanType) === -1) return;

      const res = resolveFee(feeId);

      // Monthly MI types feed payment stream
      if (feeId === 'monthly_borrower_paid_pmi' || feeId === 'fha_annual_mip') {
        if (res.includeInApr) monthlyMI += state.amount;
        return;
      }

      // Financed prepaid finance charges (FHA UFMIP, VA Funding Fee)
      if (feeId === 'fha_ufmip' || feeId === 'va_funding_fee') {
        if (res.includeInApr) aprFinancedFromFees += state.amount;
        return;
      }

      if (res.includeInApr) {
        aprPrepaidTotal += state.amount;
      } else {
        nonAprTotal += state.amount;
      }
    });

    // Apply lender credit to APR-classified fees (cap at 0)
    const inputs = getInputs();
    aprPrepaidTotal = Math.max(0, aprPrepaidTotal - inputs.lenderCredit);

    return {
      aprPrepaidTotal: aprPrepaidTotal,
      aprFinancedFromFees: aprFinancedFromFees,
      monthlyMI: monthlyMI,
      nonAprTotal: nonAprTotal
    };
  }

  function calculate() {
    const inp = getInputs();
    if (inp.loanAmount <= 0) {
      document.getElementById('monthlyPayment').textContent = fmt(0);
      document.getElementById('aprResult').textContent = pct(0);
      document.getElementById('noteRateDisplay').textContent = pct(inp.interestRate * 100);
      return;
    }

    // Auto-fill UFMIP / VA Funding Fee based on loan type + amount + property value
    autoUpdateFinancedMI(inp);

    // Auto-fill 15 days prepaid interest and monthly MI
    autoCalcPrepaidInterest(inp);
    autoCalcMonthlyMI(inp);

    const cls = classifyFees(inp.loanAmount);
    const pointsAmt = inp.loanAmount * inp.discountPointsPct;

    // Note amount = base loan + financed APR fees (UFMIP / VA FF when financed)
    const noteAmount = inp.loanAmount + cls.aprFinancedFromFees;
    const n = inp.loanTerm * 12;

    // MI duration: simple defaults
    // FHA monthly MIP: life of loan for >90% LTV (default 360); 11yrs otherwise
    // PMI: until 78% LTV (rough est: 60 months default)
    let miDuration = n;
    if (loanType === 'CONV') miDuration = Math.min(n, 60);

    // Build payment stream from note amount at note rate
    const ps = buildPaymentStream(noteAmount, inp.interestRate, n, cls.monthlyMI, miDuration);

    // Amount Financed (Reg Z) = noteAmount - prepaid finance charges - financed finance charges
    //   Points reduce amount financed (treated as prepaid).
    //   APR prepaid fees reduce amount financed.
    //   Financed APR fees (UFMIP, VA FF) reduce amount financed even though they're in note amount.
    const amtFinanced = noteAmount - pointsAmt - cls.aprPrepaidTotal - cls.aprFinancedFromFees;

    const apr = solveApr(ps.stream, amtFinanced);
    const totalPmts = ps.stream.reduce(function (a, b) { return a + b; }, 0);
    const finChg = totalPmts - amtFinanced;
    const aprSpread = (apr - inp.interestRate) * 100;
    const totalUpfrontApr = pointsAmt + cls.aprPrepaidTotal + cls.aprFinancedFromFees;

    const spreadTxt = (aprSpread >= 0 ? '+' : '') + aprSpread.toFixed(3) + '%';
    const setText = function (id, val) { const el = document.getElementById(id); if (el) el.textContent = val; };

    setText('monthlyPayment', fmt(ps.pi));
    setText('amountFinanced', fmt(Math.max(0, amtFinanced)));
    setText('financeCharges', fmt(Math.max(0, finChg)));
    setText('aprResult', pct(apr * 100));
    setText('noteRateDisplay', pct(inp.interestRate * 100));
    setText('noteRateDisplay2', pct(inp.interestRate * 100));
    setText('aprDisplay', pct(apr * 100));
    setText('aprSpread', spreadTxt);
    setText('aprSpread2', spreadTxt);
    setText('totalUpfrontCosts', fmt(totalUpfrontApr));
    setText('monthlyFeeCost', fmt(totalUpfrontApr / n) + '/mo');
    document.getElementById('aprWarning').classList.toggle('u-hidden', aprSpread <= 0.5);

    updateMathSteps(inp, noteAmount, ps.pi, pointsAmt, amtFinanced, n, totalPmts, finChg, apr, cls);
    updateURL(inp);
  }

  function updateMathSteps(inp, noteAmount, pi, pointsAmt, amtFinanced, n, totalPmts, finChg, apr, cls) {
    const container = document.getElementById('calcSteps-apr');
    if (!container) return;

    let html = '';
    html += '<div class="calc-step"><h4>Loan Type</h4><div class="calc-step__formula"><strong>' + loanType + '</strong></div></div>';
    html += '<div class="calc-step"><h4>Step 1: Note Amount</h4><div class="calc-step__formula">Base Loan + Financed APR Fees<br><span class="calc-step__values">= ' + fmt(inp.loanAmount) + ' + ' + fmt(cls.aprFinancedFromFees) + ' = <strong>' + fmt(noteAmount) + '</strong></span></div></div>';
    html += '<div class="calc-step"><h4>Step 2: Monthly P&amp;I</h4><div class="calc-step__formula">Payment based on Note Amount at Note Rate<br><span class="calc-step__values">= <strong>' + fmt(pi) + '</strong></span></div></div>';
    if (cls.monthlyMI > 0) {
      html += '<div class="calc-step"><h4>Step 2b: Monthly MI</h4><div class="calc-step__formula">Added to payment stream while active<br><span class="calc-step__values">= <strong>' + fmt(cls.monthlyMI) + '/mo</strong></span></div></div>';
    }
    html += '<div class="calc-step"><h4>Step 3: Amount Financed</h4><div class="calc-step__formula">Note Amount − Points − APR Prepaids − Financed APR Fees<br><span class="calc-step__values">= ' + fmt(noteAmount) + ' − ' + fmt(pointsAmt) + ' − ' + fmt(cls.aprPrepaidTotal) + ' − ' + fmt(cls.aprFinancedFromFees) + ' = <strong>' + fmt(amtFinanced) + '</strong></span></div></div>';
    html += '<div class="calc-step"><h4>Step 4: Total Finance Charges</h4><div class="calc-step__formula">Σ(Payment Stream) − Amount Financed<br><span class="calc-step__values">= ' + fmt(totalPmts) + ' − ' + fmt(amtFinanced) + ' = <strong>' + fmt(finChg) + '</strong></span></div></div>';
    html += '<div class="calc-step"><h4>Step 5: Solve APR</h4><div class="calc-step__formula">Find r where PV(Payment Stream) = Amount Financed<br><span class="calc-step__values"><strong>APR = ' + pct(apr * 100) + '</strong></span></div></div>';
    container.innerHTML = html;
  }

  function updateURL(inp) {
    const url = new URL(window.location);
    url.search = new URLSearchParams({
      la: inp.loanAmount, ir: (inp.interestRate * 100).toString(),
      lt: inp.loanTerm, dp: (inp.discountPointsPct * 100).toString(),
      lpt: loanType
    }).toString();
    window.history.replaceState({}, '', url);
  }

  /* ---- Event Wiring ---- */

  function applyFilterNonZero() {
    document.querySelectorAll('.apr-fee-row').forEach(function (row) {
      const feeId = row.dataset.feeId;
      const amt = (feeState[feeId] && feeState[feeId].amount) || 0;
      const focused = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.feeId === feeId;
      const hide = filterNonZero && amt <= 0 && !focused;
      row.classList.toggle('is-zero-hidden', hide);
    });
    updateFeeHint();
  }

  function updateFeeHint() {
    const hint = document.getElementById('aprFeeHint');
    if (!hint) return;
    const total = document.querySelectorAll('.apr-fee-row').length;
    const visible = total - document.querySelectorAll('.apr-fee-row.is-zero-hidden').length;
    hint.textContent = filterNonZero
      ? visible + ' of ' + total + ' fees with values'
      : total + ' available fees';
  }

  function bindFeeGroupEvents() {
    const root = document.getElementById('aprFeeGroups');
    if (!root) return;

    root.addEventListener('input', function (e) {
      const t = e.target;
      if (t.matches('.apr-fee-input')) {
        const feeId = t.dataset.feeId;
        feeState[feeId] = feeState[feeId] || {};
        feeState[feeId].amount = P(t.value);
        manuallyEditedFees[feeId] = true;
        updateAllPills();
        calculate();
      }
    });

    root.addEventListener('change', function (e) {
      const t = e.target;
      if (t.dataset.flag) {
        const feeId = t.dataset.feeId;
        feeState[feeId] = feeState[feeId] || {};
        feeState[feeId].flags = feeState[feeId].flags || {};
        feeState[feeId].flags[t.dataset.flag] = t.checked;
        updateAllPills();
        calculate();
      }
    });

    root.addEventListener('click', function (e) {
      const t = e.target;
      if (t.classList && t.classList.contains('apr-pill')) {
        const feeId = t.dataset.feeId;
        feeState[feeId] = feeState[feeId] || {};
        const current = feeState[feeId].manualOverride;
        const resolved = resolveFee(feeId).includeInApr;
        if (!current) {
          feeState[feeId].manualOverride = resolved ? 'APR_NO' : 'APR_YES';
        } else if (current === 'APR_YES') {
          feeState[feeId].manualOverride = 'APR_NO';
        } else {
          feeState[feeId].manualOverride = null;
        }
        updateAllPills();
        calculate();
      }
    });
  }

  /* ---- MISMO Integration ---- */

  function applyMISMOData(data) {
    if (!MSFG.MISMOParser) return;
    const mapFn = MSFG.MISMOParser.getCalcMap('apr');
    if (!mapFn) return;
    const fieldMap = mapFn(data);

    // Loan type from MISMO — update both hidden input and segmented control
    if (fieldMap.aprLoanType) {
      loanType = fieldMap.aprLoanType;
      const hidden = document.getElementById('aprLoanType');
      if (hidden) hidden.value = loanType;
      document.querySelectorAll('.apr-loan-type__btn').forEach(function (btn) {
        const active = btn.dataset.loanType === loanType;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      const vaG = document.getElementById('vaUsageGroup');
      if (vaG) vaG.style.display = loanType === 'VA' ? '' : 'none';
      delete fieldMap.aprLoanType;
    }

    // MISMO supersedes catalog defaults. Clear any pre-filled default amounts
    // so only MISMO-supplied fees (and user manual edits) remain.
    mismoLoaded = true;
    Object.keys(feeState).forEach(function (feeId) {
      if (manuallyEditedFees[feeId]) return;
      if (feeState[feeId]) feeState[feeId].amount = 0;
    });

    // Re-render fee groups for the (possibly new) loan type
    renderFeeGroups();

    // Apply scalar fields first
    ['loanAmount','interestRate','loanTerm','discountPoints','propertyValue'].forEach(function (id) {
      if (typeof fieldMap[id] !== 'undefined') {
        const el = document.getElementById(id);
        if (el) {
          el.value = fieldMap[id];
          el.classList.add('mismo-populated');
        }
        delete fieldMap[id];
      }
    });

    // Remaining keys are fee_<id>
    Object.keys(fieldMap).forEach(function (key) {
      const m = key.match(/^fee_(.+)$/);
      if (!m) return;
      const feeId = m[1];
      const def = Catalog.getFee(feeId);
      if (!def) return;
      feeState[feeId] = feeState[feeId] || {};
      feeState[feeId].amount = fieldMap[key];
      const input = document.getElementById('fee_' + feeId);
      if (input) {
        input.value = fieldMap[key];
        input.classList.add('mismo-populated');
      }
    });

    updateAllPills();
    calculate();
  }

  /* ---- Actions ---- */

  function exportCSV() {
    const inp = getInputs();
    const rows = [
      ['APR Calculator Results',''], ['',''],
      ['Loan Type', loanType],
      ['Base Loan Amount', fmt(inp.loanAmount)],
      ['Interest Rate', pct(inp.interestRate * 100)],
      ['Loan Term', inp.loanTerm + ' years'],
      ['Monthly P&I', document.getElementById('monthlyPayment').textContent],
      ['APR', document.getElementById('aprResult').textContent],
      ['Amount Financed', document.getElementById('amountFinanced').textContent],
      ['Total Finance Charges', document.getElementById('financeCharges').textContent],
      ['',''], ['Generated', new Date().toLocaleString()]
    ];
    const csv = rows.map(function (r) { return r.join(','); }).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'apr_calculation.csv'; a.click();
  }

  function shareLink() {
    navigator.clipboard.writeText(window.location.href).then(function () { alert('Link copied!'); });
  }

  function clearAll() {
    document.getElementById('loanAmount').value = 0;
    document.getElementById('interestRate').value = 0;
    document.getElementById('loanTerm').value = 30;
    document.getElementById('discountPoints').value = 0;
    document.getElementById('lenderCredit').value = 0;
    document.getElementById('sellerCredit').value = 0;
    document.getElementById('propertyValue').value = 0;
    Object.keys(feeState).forEach(function (k) { delete feeState[k]; });
    Object.keys(manuallyEditedFees).forEach(function (k) { delete manuallyEditedFees[k]; });
    // Reset MISMO flag so catalog defaults come back
    mismoLoaded = false;
    sessionStorage.removeItem('msfg-mismo-data');
    applyCatalogDefaults();
    renderFeeGroups();
    calculate();
  }

  /* ---- Init ---- */

  document.addEventListener('DOMContentLoaded', function () {
    if (MSFG.markDefaults) MSFG.markDefaults('.calc-page');
    if (MSFG.bindDefaultClearing) MSFG.bindDefaultClearing('.calc-page');

    // URL params
    const params = new URLSearchParams(window.location.search);
    if (params.has('la')) document.getElementById('loanAmount').value = P(params.get('la')) || 0;
    if (params.has('ir')) document.getElementById('interestRate').value = P(params.get('ir')) || 0;
    if (params.has('lt')) document.getElementById('loanTerm').value = P(params.get('lt')) || 30;
    if (params.has('dp')) document.getElementById('discountPoints').value = P(params.get('dp')) || 0;
    if (params.has('lpt')) {
      const lpt = params.get('lpt');
      if (['CONV','FHA','VA'].indexOf(lpt) !== -1) loanType = lpt;
    }

    // Loan type segmented control
    function setLoanType(newType) {
      loanType = newType;
      document.getElementById('aprLoanType').value = newType;
      document.querySelectorAll('.apr-loan-type__btn').forEach(function (btn) {
        const active = btn.dataset.loanType === newType;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      const vaGroup = document.getElementById('vaUsageGroup');
      if (vaGroup) vaGroup.style.display = newType === 'VA' ? '' : 'none';
      applyCatalogDefaults();
      renderFeeGroups();
      calculate();
    }
    document.querySelectorAll('.apr-loan-type__btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setLoanType(btn.dataset.loanType); });
    });

    // VA usage triggers funding fee recompute
    const vaUsage = document.getElementById('vaUsage');
    if (vaUsage) {
      vaUsage.addEventListener('change', function () {
        manuallyEditedFees['va_funding_fee'] = false;
        calculate();
      });
    }

    // Filter toggle
    const filterCb = document.getElementById('aprFilterNonZero');
    if (filterCb) {
      filterCb.addEventListener('change', function () {
        filterNonZero = filterCb.checked;
        applyFilterNonZero();
      });
    }

    // Main input listeners
    ['loanAmount','interestRate','loanTerm','discountPoints','lenderCredit','sellerCredit','propertyValue'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    // Reflect initial loanType into segmented control
    document.querySelectorAll('.apr-loan-type__btn').forEach(function (btn) {
      const active = btn.dataset.loanType === loanType;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const vaGroupInit = document.getElementById('vaUsageGroup');
    if (vaGroupInit) vaGroupInit.style.display = loanType === 'VA' ? '' : 'none';

    // Pre-populate fees with catalog defaults so the page is useful out of the box
    applyCatalogDefaults();
    renderFeeGroups();
    bindFeeGroupEvents();

    // Action bar
    const actions = {
      'export-csv': exportCSV,
      'print': function () { window.print(); },
      'share-link': shareLink,
      'clear-all': clearAll
    };
    document.querySelectorAll('[data-action]').forEach(function (el) {
      const fn = actions[el.dataset.action];
      if (fn) el.addEventListener('click', fn);
    });

    // sessionStorage MISMO
    const stored = sessionStorage.getItem('msfg-mismo-data');
    if (stored) {
      try { applyMISMOData(JSON.parse(stored)); } catch (_) { /* ignore */ }
    }

    // postMessage MISMO
    window.addEventListener('message', function (e) {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'msfg-mismo-broadcast' || e.data.type === 'msfg-mismo-update') {
        let parsed = e.data.parsed || null;
        if (!parsed && e.data.xml && MSFG.MISMOParser) {
          parsed = MSFG.MISMOParser.parse(e.data.xml);
        }
        if (parsed) {
          sessionStorage.setItem('msfg-mismo-data', JSON.stringify(parsed));
          applyMISMOData(parsed);
        }
      }
    });

    calculate();

    /* Email data provider */
    if (MSFG.CalcActions) {
      MSFG.CalcActions.register(function () {
        const g = function (id) { const el = document.getElementById(id); return el ? el.textContent || el.value : ''; };
        return {
          title: 'APR Analysis',
          sections: [
            {
              heading: 'Loan Details',
              rows: [
                { label: 'Loan Type', value: loanType },
                { label: 'Base Loan Amount', value: g('loanAmount') ? fmt(P(g('loanAmount'))) : '$0' },
                { label: 'Note Rate', value: g('noteRateDisplay') },
                { label: 'Loan Term', value: g('loanTerm') + ' years' }
              ]
            },
            {
              heading: 'Results',
              rows: [
                { label: 'APR', value: g('aprResult'), isTotal: true },
                { label: 'Monthly P&I', value: g('monthlyPayment') },
                { label: 'Total Finance Charges', value: g('financeCharges') },
                { label: 'Amount Financed', value: g('amountFinanced') }
              ]
            }
          ]
        };
      });
    }
  });
})();
