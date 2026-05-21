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
          '<span class="apr-pill" data-fee-id="' + esc(feeId) + '" title="Click to override">APR</span>' +
        '</div>' +
        (flagsHtml ? '<details class="apr-fee-row__advanced"><summary>Advanced</summary>' + flagsHtml + '</details>' : '') +
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
      sellerCredit: P(document.getElementById('sellerCredit').value)
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
      return;
    }

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

    document.getElementById('monthlyPayment').textContent = fmt(ps.pi);
    document.getElementById('amountFinanced').textContent = fmt(Math.max(0, amtFinanced));
    document.getElementById('financeCharges').textContent = fmt(Math.max(0, finChg));
    document.getElementById('aprResult').textContent = pct(apr * 100);
    document.getElementById('noteRateDisplay').textContent = pct(inp.interestRate * 100);
    document.getElementById('aprDisplay').textContent = pct(apr * 100);
    document.getElementById('aprSpread').textContent = (aprSpread >= 0 ? '+' : '') + aprSpread.toFixed(3) + '%';
    document.getElementById('totalUpfrontCosts').textContent = fmt(totalUpfrontApr);
    document.getElementById('monthlyFeeCost').textContent = fmt(totalUpfrontApr / n) + '/mo';
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

  function bindFeeGroupEvents() {
    const root = document.getElementById('aprFeeGroups');
    if (!root) return;

    root.addEventListener('input', function (e) {
      const t = e.target;
      if (t.matches('.apr-fee-input')) {
        const feeId = t.dataset.feeId;
        feeState[feeId] = feeState[feeId] || {};
        feeState[feeId].amount = P(t.value);
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

    // Loan type from MISMO
    if (fieldMap.aprLoanType) {
      const sel = document.getElementById('aprLoanType');
      if (sel) {
        sel.value = fieldMap.aprLoanType;
        loanType = fieldMap.aprLoanType;
      }
      delete fieldMap.aprLoanType;
    }

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
      if (['CONV','FHA','VA'].indexOf(lpt) !== -1) {
        loanType = lpt;
        document.getElementById('aprLoanType').value = lpt;
      }
    }

    // Loan type change
    document.getElementById('aprLoanType').addEventListener('change', function (e) {
      loanType = e.target.value;
      renderFeeGroups();
      calculate();
    });

    // Main input listeners
    ['loanAmount','interestRate','loanTerm','discountPoints','lenderCredit','sellerCredit','propertyValue'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

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
