/* =====================================================
   REFI UI — DOM Controller & Event Handling
   Mountain State Financial Group

   Manages all DOM interactions, form reading,
   result display, and section toggling.
   ===================================================== */

const RefiUI = (() => {
    'use strict';

    // Cached DOM references
    const dom = {};
    let lastResults = null;

    // Debounce helper — delays rapid-fire calls for typing events
    function debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    // -------------------------------------------------
    // INITIALIZATION
    // -------------------------------------------------

    function init() {
        cacheDOMRefs();
        bindEvents();
        bindSectionCollapseToggles();
        updateLiveCalculations();
        updateClosingCostTotals();
    }

    function cacheDOMRefs() {
        // Current loan
        dom.currentBalance = document.getElementById('currentBalance');
        dom.currentRate = document.getElementById('currentRate');
        dom.currentTermRemaining = document.getElementById('currentTermRemaining');
        dom.currentPropertyValue = document.getElementById('currentPropertyValue');
        dom.currentLoanType = document.getElementById('currentLoanType');
        dom.manualPaymentToggle = document.getElementById('manualPaymentToggle');
        dom.manualPaymentSection = document.getElementById('manualPaymentSection');
        dom.currentPaymentManual = document.getElementById('currentPaymentManual');
        dom.manualFullPaymentToggle = document.getElementById('manualFullPaymentToggle');
        dom.manualFullPaymentSection = document.getElementById('manualFullPaymentSection');
        dom.currentFullPaymentManual = document.getElementById('currentFullPaymentManual');
        dom.currentPaymentDisplay = document.getElementById('currentPaymentDisplay');
        dom.currentPaymentDetail = document.getElementById('currentPaymentDetail');

        // Current MI display + editable input
        dom.currentMIInfo = document.getElementById('currentMIInfo');
        dom.currentLTV = document.getElementById('currentLTV');
        dom.currentMIInput = document.getElementById('currentMIInput');
        dom.currentMIModeBtn = document.getElementById('currentMIModeBtn');
        dom.currentMIHint = document.getElementById('currentMIHint');
        dom.currentMINote = document.getElementById('currentMINote');

        // Monthly Escrow (shared across all scenarios, display-only)
        dom.monthlyEscrow = document.getElementById('monthlyEscrow');

        // Refi offer
        dom.refiLoanAmount = document.getElementById('refiLoanAmount');
        dom.refiRate = document.getElementById('refiRate');
        dom.refiTerm = document.getElementById('refiTerm');
        dom.refiLoanType = document.getElementById('refiLoanType');
        dom.refiPaymentDisplay = document.getElementById('refiPaymentDisplay');
        dom.refiPaymentDetail = document.getElementById('refiPaymentDetail');

        // Refi MI display + editable inputs
        dom.refiMIInfo = document.getElementById('refiMIInfo');
        dom.refiLTV = document.getElementById('refiLTV');
        dom.refiMIMonthlyInput = document.getElementById('refiMIMonthlyInput');
        dom.refiMIMonthlyModeBtn = document.getElementById('refiMIMonthlyModeBtn');
        dom.refiMIMonthlyHint = document.getElementById('refiMIMonthlyHint');
        dom.refiMIUpfrontInput = document.getElementById('refiMIUpfrontInput');
        dom.refiMIUpfrontModeBtn = document.getElementById('refiMIUpfrontModeBtn');
        dom.refiMIUpfrontHint = document.getElementById('refiMIUpfrontHint');
        dom.refiMINote = document.getElementById('refiMINote');

        // Closing cost MI display elements
        dom.feeUpfrontMIDisplay = document.getElementById('feeUpfrontMIDisplay');
        dom.feeMonthlyMIDisplay = document.getElementById('feeMonthlyMIDisplay');

        // Future rate
        dom.futureRate = document.getElementById('futureRate');
        dom.monthsToWait = document.getElementById('monthsToWait');
        dom.futureMIInput = document.getElementById('futureMIInput');
        dom.futureMIModeBtn = document.getElementById('futureMIModeBtn');
        dom.futurePaymentDisplay = document.getElementById('futurePaymentDisplay');
        dom.futurePaymentDetail = document.getElementById('futurePaymentDetail');

        // Cost of Waiting toggle
        dom.costOfWaitingToggle = document.getElementById('costOfWaitingToggle');
        dom.costOfWaitingFields = document.getElementById('costOfWaitingFields');
        dom.costOfWaitingResults = document.getElementById('costOfWaitingResults');

        // Cash Out
        dom.cashOutToggle = document.getElementById('cashOutToggle');
        dom.cashOutFields = document.getElementById('cashOutFields');
        dom.cashOutAmount = document.getElementById('cashOutAmount');
        dom.cashOutDebtPayments = document.getElementById('cashOutDebtPayments');
        dom.cashOutAdjustedSavings = document.getElementById('cashOutAdjustedSavings');
        dom.btnAddDebt = document.getElementById('btnAddDebt');
        dom.btnAutoSum = document.getElementById('btnAutoSum');
        dom.debtRows = document.getElementById('debtRows');

        // Advice settings
        dom.targetBreakeven = document.getElementById('targetBreakeven');
        dom.planToStayMonths = document.getElementById('planToStayMonths');

        // Fee fields — driven by FEE_CONFIG
        dom.fees = {};
        RefiEngine.FEE_CONFIG.forEach(item => {
            dom.fees[item.id] = document.getElementById(item.id);
        });

        // Fee totals
        dom.totalOrigination = document.getElementById('totalOrigination');
        dom.totalCannotShop = document.getElementById('totalCannotShop');
        dom.totalCanShop = document.getElementById('totalCanShop');
        dom.totalGovFees = document.getElementById('totalGovFees');
        dom.totalPrepaids = document.getElementById('totalPrepaids');
        dom.totalEscrow = document.getElementById('totalEscrow');
        dom.totalClosingCostsBreakeven = document.getElementById('totalClosingCostsBreakeven');

        // Buttons
        dom.btnCalculate = document.getElementById('btnCalculate');
        dom.btnReset = document.getElementById('btnReset');
        dom.btnPrint = document.getElementById('btnPrint');

        // Results container
        dom.resultsContainer = document.getElementById('resultsContainer');
    }

    // -------------------------------------------------
    // SECTION COLLAPSE TOGGLES (for input sections)
    // -------------------------------------------------

    function bindSectionCollapseToggles() {
        document.querySelectorAll('.section-header-toggle').forEach(header => {
            header.addEventListener('click', () => {
                const targetId = header.getAttribute('data-target');
                const body = document.getElementById(targetId);
                if (!body) return;

                const isOpen = body.classList.contains('open');
                body.classList.toggle('open');

                // Update arrow button
                const btn = header.querySelector('.section-collapse-btn');
                if (btn) {
                    btn.innerHTML = isOpen ? '&#9654;' : '&#9660;';  // ► or ▼
                    btn.setAttribute('aria-expanded', !isOpen);
                }
            });
        });
    }

    // -------------------------------------------------
    // EVENT BINDING
    // -------------------------------------------------

    function bindEvents() {
        const debouncedLiveCalc = debounce(updateLiveCalculations, 150);

        // Calculate button
        dom.btnCalculate.addEventListener('click', runCalculation);

        // Reset button
        dom.btnReset.addEventListener('click', resetAll);

        // Toggle events — immediate (not debounced)
        dom.manualPaymentToggle.addEventListener('change', () => {
            dom.manualPaymentSection.style.display =
                dom.manualPaymentToggle.checked ? 'block' : 'none';
            // Mutually exclusive with full payment override
            if (dom.manualPaymentToggle.checked && dom.manualFullPaymentToggle.checked) {
                dom.manualFullPaymentToggle.checked = false;
                dom.manualFullPaymentSection.style.display = 'none';
            }
            updateLiveCalculations();
        });
        dom.manualFullPaymentToggle.addEventListener('change', () => {
            dom.manualFullPaymentSection.style.display =
                dom.manualFullPaymentToggle.checked ? 'block' : 'none';
            // Mutually exclusive with P&I override
            if (dom.manualFullPaymentToggle.checked && dom.manualPaymentToggle.checked) {
                dom.manualPaymentToggle.checked = false;
                dom.manualPaymentSection.style.display = 'none';
            }
            updateLiveCalculations();
        });
        dom.costOfWaitingToggle.addEventListener('change', () => {
            dom.costOfWaitingFields.style.display =
                dom.costOfWaitingToggle.checked ? 'block' : 'none';
            updateLiveCalculations();
        });
        dom.cashOutToggle.addEventListener('change', () => {
            dom.cashOutFields.style.display =
                dom.cashOutToggle.checked ? 'block' : 'none';
            updateLiveCalculations();
        });

        // Cash out debt row management
        dom.btnAddDebt.addEventListener('click', addDebtRow);
        dom.btnAutoSum.addEventListener('click', autoSumDebts);

        // Typing inputs — debounced
        dom.cashOutDebtPayments.addEventListener('input', debouncedLiveCalc);
        dom.cashOutAmount.addEventListener('input', debouncedLiveCalc);

        // Delegate debt row input changes — debounced
        dom.debtRows.addEventListener('input', (e) => {
            if (e.target.classList.contains('debt-payment') || e.target.classList.contains('debt-balance')) {
                debouncedLiveCalc();
            }
        });

        // Live update payment displays — debounced for typing
        const liveInputs = [
            dom.currentBalance, dom.currentRate, dom.currentTermRemaining,
            dom.currentPaymentManual, dom.currentFullPaymentManual,
            dom.currentPropertyValue,
            dom.monthlyEscrow,
            dom.refiLoanAmount, dom.refiRate, dom.refiTerm,
            dom.futureRate, dom.monthsToWait
        ];
        liveInputs.forEach(input => {
            if (input) input.addEventListener('input', debouncedLiveCalc);
        });

        // Dropdown changes — immediate
        if (dom.currentLoanType) dom.currentLoanType.addEventListener('change', updateLiveCalculations);
        if (dom.refiLoanType) dom.refiLoanType.addEventListener('change', updateLiveCalculations);

        // Live update closing cost totals
        Object.values(dom.fees).forEach(input => {
            if (input) input.addEventListener('input', updateClosingCostTotals);
        });

        // MI editable inputs — debounced
        [dom.currentMIInput, dom.refiMIMonthlyInput, dom.refiMIUpfrontInput].forEach(input => {
            if (input) input.addEventListener('input', debouncedLiveCalc);
        });

        // MI mode toggle buttons ($ / %)
        bindMIModeToggle('currentMIModeBtn', 'currentMIInput', 'currentMIHint', function() {
            return num(dom.currentBalance);
        });
        bindMIModeToggle('refiMIMonthlyModeBtn', 'refiMIMonthlyInput', 'refiMIMonthlyHint', function() {
            return num(dom.refiLoanAmount);
        });
        bindMIModeToggle('refiMIUpfrontModeBtn', 'refiMIUpfrontInput', 'refiMIUpfrontHint', function() {
            return num(dom.refiLoanAmount);
        });
        bindMIModeToggle('futureMIModeBtn', 'futureMIInput', null, function() {
            return num(dom.refiLoanAmount);
        });

        // Future MI input — debounced
        if (dom.futureMIInput) dom.futureMIInput.addEventListener('input', debouncedLiveCalc);

        // Prepaids & Initial Escrow collapsible toggle
        const btnTogglePrepaids = document.getElementById('btnTogglePrepaids');
        const prepaidsSectionWrap = document.getElementById('prepaidsSectionWrap');
        if (btnTogglePrepaids && prepaidsSectionWrap) {
            btnTogglePrepaids.addEventListener('click', () => {
                const isOpen = prepaidsSectionWrap.style.display !== 'none';
                prepaidsSectionWrap.style.display = isOpen ? 'none' : '';
                btnTogglePrepaids.classList.toggle('open', !isOpen);
            });
        }

        // Print
        dom.btnPrint.addEventListener('click', () => {
            // Open all collapsible sections before printing
            document.querySelectorAll('.chart-content, .collapsible-content').forEach(el => {
                el.classList.add('open');
            });
            window.print();
        });

        // Allow Enter key to trigger calculation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.preventDefault();
                runCalculation();
            }
        });
    }

    // -------------------------------------------------
    // MI MODE TOGGLE ($ / %)
    // -------------------------------------------------

    /**
     * Bind a $/% toggle button for an MI input.
     * When toggling from $ to %, convert the current dollar value to %.
     * When toggling from % to $, convert the current % value to $.
     */
    function bindMIModeToggle(btnId, inputId, hintId, getLoanAmount) {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        const hint = document.getElementById(hintId);
        if (!btn || !input) return;

        btn.addEventListener('click', function() {
            var mode = btn.getAttribute('data-mode');
            var val = parseFloat(input.value) || 0;
            var loanAmt = getLoanAmount();

            if (mode === 'dollar') {
                // Switch to percent mode — convert $ → %
                var pct = (loanAmt > 0 && val > 0) ? ((val * 12) / loanAmt) * 100 : 0;
                // For upfront fields, don't multiply by 12
                if (btnId.indexOf('Upfront') !== -1) {
                    pct = (loanAmt > 0 && val > 0) ? (val / loanAmt) * 100 : 0;
                }
                input.value = pct ? pct.toFixed(4) : '0';
                input.step = '0.01';
                btn.textContent = '%';
                btn.setAttribute('data-mode', 'percent');
            } else {
                // Switch to dollar mode — convert % → $
                var dollars;
                if (btnId.indexOf('Upfront') !== -1) {
                    dollars = (val / 100) * loanAmt;
                } else {
                    dollars = ((val / 100) * loanAmt) / 12;
                }
                input.value = dollars ? dollars.toFixed(2) : '0';
                input.step = '0.01';
                btn.textContent = '$';
                btn.setAttribute('data-mode', 'dollar');
            }
            updateLiveCalculations();
        });
    }

    /**
     * Resolve an MI input to a dollar value, accounting for its current mode.
     */
    function resolveMIDollar(inputEl, modeBtnEl, loanAmount, isUpfront) {
        var val = parseFloat(inputEl.value) || 0;
        var mode = modeBtnEl.getAttribute('data-mode');
        if (mode === 'percent') {
            if (isUpfront) {
                return RefiEngine.round2((val / 100) * loanAmount);
            }
            return RefiEngine.round2(((val / 100) * loanAmount) / 12);
        }
        return RefiEngine.round2(val);
    }

    // -------------------------------------------------
    // LIVE PAYMENT DISPLAY UPDATES
    // -------------------------------------------------

function updateLiveCalculations() {
    const currentBalance = num(dom.currentBalance);
    const currentRate = num(dom.currentRate);
    const currentTermRemaining = num(dom.currentTermRemaining);
    const currentPropertyValue = num(dom.currentPropertyValue);
    const currentLoanType = dom.currentLoanType ? dom.currentLoanType.value : 'Conventional';

    const refiLoanAmount = num(dom.refiLoanAmount);
    const refiRate = num(dom.refiRate);
    const refiTerm = num(dom.refiTerm);
    const refiLoanType = dom.refiLoanType ? dom.refiLoanType.value : 'Conventional';
    const escrow = num(dom.monthlyEscrow);

    // Current payment
    const currentPmt = RefiEngine.calcMonthlyPayment(currentBalance, currentRate, currentTermRemaining);
    const currentPmtBase = dom.manualPaymentToggle.checked ? num(dom.currentPaymentManual) : currentPmt;

    // Resolve current MI to dollars for display
    const currentMIDollar = dom.currentMIInput && dom.currentMIModeBtn
        ? resolveMIDollar(dom.currentMIInput, dom.currentMIModeBtn, currentBalance, false) : 0;

    if (dom.manualFullPaymentToggle.checked) {
        // Full payment override — display exactly what the user typed, no additions
        const fullPmt = num(dom.currentFullPaymentManual);
        dom.currentPaymentDisplay.textContent = formatMoney(fullPmt);
        if (dom.currentPaymentDetail) {
            dom.currentPaymentDetail.textContent = 'Manual full payment override';
        }
        dom.currentPaymentDisplay.title = 'Manual full payment entry';
    } else {
        // Computed: P&I + T&I + MI
        const currentTotalPmt = RefiEngine.round2(currentPmtBase + escrow + currentMIDollar);
        const currentParts = ['Pmt ' + formatMoney(currentPmtBase)];
        if (currentMIDollar > 0) currentParts.push('MI ' + formatMoney(currentMIDollar));
        if (escrow > 0) currentParts.push('T&I ' + formatMoney(escrow));

        dom.currentPaymentDisplay.textContent = currentParts.length > 1 ? formatMoney(currentTotalPmt) : formatMoney(currentPmtBase);
        if (dom.currentPaymentDetail) {
            dom.currentPaymentDetail.textContent = currentParts.length > 1 ? currentParts.join(' + ') : '';
        }
        dom.currentPaymentDisplay.title = dom.manualPaymentToggle.checked ? 'Manual payment entry' : 'Computed from balance, rate & term';
    }

    // Current MI — update LTV and hint, but user controls the value
    if (typeof RefiMI !== 'undefined') {
        const currentMI = RefiMI.calcMI(
            currentLoanType,
            currentBalance,
            currentPropertyValue,
            currentTermRemaining
        );
        updateMIDisplay('current', currentMI);
        // Show computed hint
        if (dom.currentMIHint) {
            dom.currentMIHint.textContent = currentMI.monthlyMI > 0
                ? 'Est: ' + formatMoney(currentMI.monthlyMI) + '/mo'
                : '';
        }
    }

    // Refi payment (including MI)
    const refiPmt = RefiEngine.calcMonthlyPayment(refiLoanAmount, refiRate, refiTerm);
    // MI is resolved below after MI display update, but we need it here for display.
    // Pre-resolve refi monthly MI for the payment display.
    const refiMIDollarForDisplay = dom.refiMIMonthlyInput && dom.refiMIMonthlyModeBtn
        ? resolveMIDollar(dom.refiMIMonthlyInput, dom.refiMIMonthlyModeBtn, refiLoanAmount, false) : 0;
    const refiTotalPmt = RefiEngine.round2(refiPmt + escrow + refiMIDollarForDisplay);
    const refiDisplayParts = ['Pmt ' + formatMoney(refiPmt)];
    if (refiMIDollarForDisplay > 0) refiDisplayParts.push('MI ' + formatMoney(refiMIDollarForDisplay));
    if (escrow > 0) refiDisplayParts.push('T&I ' + formatMoney(escrow));

    dom.refiPaymentDisplay.textContent = refiDisplayParts.length > 1 ? formatMoney(refiTotalPmt) : formatMoney(refiPmt);
    if (dom.refiPaymentDetail) {
        dom.refiPaymentDetail.textContent = refiDisplayParts.length > 1 ? refiDisplayParts.join(' + ') : '';
    }

    // Refi MI — update LTV and hints, user controls values
    if (typeof RefiMI !== 'undefined') {
        const refiMI = RefiMI.calcMI(refiLoanType, refiLoanAmount, currentPropertyValue, refiTerm);
        updateMIDisplay('refi', refiMI);
        // Show computed hints
        if (dom.refiMIMonthlyHint) {
            dom.refiMIMonthlyHint.textContent = refiMI.monthlyMI > 0
                ? 'Est: ' + formatMoney(refiMI.monthlyMI) + '/mo'
                : '';
        }
        if (dom.refiMIUpfrontHint) {
            dom.refiMIUpfrontHint.textContent = refiMI.upfront > 0
                ? 'Est: ' + formatMoney(refiMI.upfront)
                : '';
        }
    }

    // Resolve editable MI values to dollars
    const refiMonthlyMIDollar = dom.refiMIMonthlyInput && dom.refiMIMonthlyModeBtn
        ? resolveMIDollar(dom.refiMIMonthlyInput, dom.refiMIMonthlyModeBtn, refiLoanAmount, false)
        : 0;
    const refiUpfrontMIDollar = dom.refiMIUpfrontInput && dom.refiMIUpfrontModeBtn
        ? resolveMIDollar(dom.refiMIUpfrontInput, dom.refiMIUpfrontModeBtn, refiLoanAmount, true)
        : 0;

    // Sync MI to hidden closing cost fields
    if (dom.fees.feeUpfrontMI) dom.fees.feeUpfrontMI.value = refiUpfrontMIDollar;
    if (dom.fees.feeMonthlyMI) dom.fees.feeMonthlyMI.value = refiMonthlyMIDollar;
    if (dom.feeUpfrontMIDisplay) dom.feeUpfrontMIDisplay.textContent = formatMoney(refiUpfrontMIDollar);
    if (dom.feeMonthlyMIDisplay) dom.feeMonthlyMIDisplay.textContent = formatMoney(refiMonthlyMIDollar);

    // Future payment (only update if Cost of Waiting is enabled)
    if (dom.costOfWaitingToggle.checked) {
        const futurePmt = RefiEngine.calcMonthlyPayment(refiLoanAmount, num(dom.futureRate), refiTerm);
        const futureMIDollar = dom.futureMIInput && dom.futureMIModeBtn
            ? resolveMIDollar(dom.futureMIInput, dom.futureMIModeBtn, refiLoanAmount, false) : 0;
        const futureTotalPmt = RefiEngine.round2(futurePmt + futureMIDollar + escrow);
        const futureParts = [];
        futureParts.push('Pmt ' + formatMoney(futurePmt));
        if (futureMIDollar > 0) futureParts.push('MI ' + formatMoney(futureMIDollar));
        if (escrow > 0) futureParts.push('T&I ' + formatMoney(escrow));
        dom.futurePaymentDisplay.textContent = futureParts.length > 1 ? formatMoney(futureTotalPmt) : formatMoney(futurePmt);
        if (dom.futurePaymentDetail) {
            dom.futurePaymentDetail.textContent = futureParts.length > 1 ? futureParts.join(' + ') : '';
        }
    }

    // Cash out adjusted savings
    // When full payment override is active, use the full amount directly (MI/escrow included)
    // and compare against the full refi payment (P&I + MI) — escrow cancels out
    const currentPmtFinal = dom.manualFullPaymentToggle.checked
        ? num(dom.currentFullPaymentManual)
        : (dom.manualPaymentToggle.checked ? num(dom.currentPaymentManual) : currentPmt);
    const refiPmtFinal = dom.manualFullPaymentToggle.checked
        ? RefiEngine.round2(refiPmt + refiMIDollarForDisplay + escrow)
        : refiPmt;
    const piSavings = RefiEngine.round2(currentPmtFinal - refiPmtFinal);
    const debtPayments = dom.cashOutToggle.checked ? num(dom.cashOutDebtPayments) : 0;
    const adjustedSavings = RefiEngine.round2(piSavings + debtPayments);

    dom.cashOutAdjustedSavings.textContent = formatMoney(adjustedSavings);

    // Re-sync closing cost totals since MI hidden fields were updated
    updateClosingCostTotals();
}
/**
 * Update the MI info display for either current or refi loan.
 * Now only updates LTV, note, and row styling — inputs are user-controlled.
 */
function updateMIDisplay(prefix, miData) {
    const ltvEl = document.getElementById(prefix + 'LTV');
    const noteEl = document.getElementById(prefix + 'MINote');
    const infoRow = document.getElementById(prefix + 'MIInfo');

    if (ltvEl) ltvEl.textContent = miData.ltv.toFixed(1) + '%';
    if (noteEl) noteEl.textContent = miData.note || '';

    if (infoRow) {
        infoRow.classList.remove('has-mi', 'no-mi');
        infoRow.classList.add(miData.hasMI ? 'has-mi' : 'no-mi');
    }
}
        

    // -------------------------------------------------
    // LIVE CLOSING COST TOTAL UPDATES
    // -------------------------------------------------

    function updateClosingCostTotals() {
        const fees = readFees();
        const costs = RefiEngine.calcClosingCosts(fees);

        dom.totalOrigination.textContent = formatMoney(costs.origination);
        dom.totalCannotShop.textContent = formatMoney(costs.cannotShop);
        dom.totalCanShop.textContent = formatMoney(costs.canShop);
        dom.totalGovFees.textContent = formatMoney(costs.govFees);
        dom.totalPrepaids.textContent = formatMoney(costs.prepaids);
        dom.totalEscrow.textContent = formatMoney(costs.escrow);
        dom.totalClosingCostsBreakeven.textContent = formatMoney(costs.totalBreakeven);
    }

    // -------------------------------------------------
    // READ ALL INPUTS
    // -------------------------------------------------

    function readAllInputs() {
        var refiLoanAmount = num(dom.refiLoanAmount);
        var currentBalance = num(dom.currentBalance);

        return {
            currentBalance: currentBalance,
            currentRate: num(dom.currentRate),
            currentTermRemaining: num(dom.currentTermRemaining),
            currentPropertyValue: num(dom.currentPropertyValue),
            currentLoanType: dom.currentLoanType ? dom.currentLoanType.value : 'Conventional',
            useManualPayment: dom.manualPaymentToggle.checked,
            currentPaymentManual: num(dom.currentPaymentManual),
            useManualFullPayment: dom.manualFullPaymentToggle.checked,
            currentFullPaymentManual: num(dom.currentFullPaymentManual),
            currentMIValue: num(dom.currentMIInput),
            currentMIMonthlyDollar: dom.currentMIInput && dom.currentMIModeBtn
                ? resolveMIDollar(dom.currentMIInput, dom.currentMIModeBtn, currentBalance, false) : 0,

            monthlyEscrow: num(dom.monthlyEscrow),

            refiLoanAmount: refiLoanAmount,
            refiRate: num(dom.refiRate),
            refiTerm: num(dom.refiTerm),
            refiLoanType: dom.refiLoanType ? dom.refiLoanType.value : 'Conventional',

            cashOutEnabled: dom.cashOutToggle.checked,
            cashOutAmount: num(dom.cashOutAmount),
            cashOutDebtPayments: num(dom.cashOutDebtPayments),
            cashOutDebts: readDebtRows(),

            costOfWaitingEnabled: dom.costOfWaitingToggle.checked,
            futureRate: num(dom.futureRate),
            monthsToWait: num(dom.monthsToWait),
            futureMIValue: num(dom.futureMIInput),
            futureMIDollar: dom.futureMIInput && dom.futureMIModeBtn
                ? resolveMIDollar(dom.futureMIInput, dom.futureMIModeBtn, num(dom.refiLoanAmount), false) : 0,

            targetBreakeven: num(dom.targetBreakeven),
            planToStayMonths: num(dom.planToStayMonths),

            fees: readFees()
        };
    }

    function readFees() {
        const fees = {};
        Object.keys(dom.fees).forEach(id => {
            fees[id] = num(dom.fees[id]);
        });
        return fees;
    }

    function readDebtRows() {
        const debts = [];
        const rows = dom.debtRows.querySelectorAll('.debt-row');
        rows.forEach((row, i) => {
            const nameInput = row.querySelector('input[type="text"]');
            const balanceInput = row.querySelector('.debt-balance');
            const paymentInput = row.querySelector('.debt-payment');
            const rateInput = row.querySelector('.debt-rate');
            debts.push({
                name: nameInput ? nameInput.value : `Debt ${i + 1}`,
                balance: balanceInput ? parseFloat(balanceInput.value) || 0 : 0,
                payment: paymentInput ? parseFloat(paymentInput.value) || 0 : 0,
                rate: rateInput ? parseFloat(rateInput.value) || 0 : 0
            });
        });
        return debts;
    }

    // -------------------------------------------------
    // WRITE ALL INPUTS (for profile loading)
    // -------------------------------------------------

    function writeAllInputs(data) {
        if (!data) return;

        // Current loan
        if (data.currentBalance !== undefined) dom.currentBalance.value = data.currentBalance;
        if (data.currentRate !== undefined) dom.currentRate.value = data.currentRate;
        if (data.currentTermRemaining !== undefined) dom.currentTermRemaining.value = data.currentTermRemaining;
        if (data.currentPropertyValue !== undefined) dom.currentPropertyValue.value = data.currentPropertyValue;

        // Manual payment toggle
        if (data.useManualPayment !== undefined) {
            dom.manualPaymentToggle.checked = data.useManualPayment;
            dom.manualPaymentSection.style.display = data.useManualPayment ? 'block' : 'none';
        }
        if (data.currentPaymentManual !== undefined) dom.currentPaymentManual.value = data.currentPaymentManual;

        // Full payment override toggle
        if (data.useManualFullPayment !== undefined) {
            dom.manualFullPaymentToggle.checked = data.useManualFullPayment;
            dom.manualFullPaymentSection.style.display = data.useManualFullPayment ? 'block' : 'none';
        }
        if (data.currentFullPaymentManual !== undefined) dom.currentFullPaymentManual.value = data.currentFullPaymentManual;

        // Current loan type
        if (data.currentLoanType !== undefined && dom.currentLoanType) dom.currentLoanType.value = data.currentLoanType;

        // Monthly Escrow
        if (data.monthlyEscrow !== undefined) dom.monthlyEscrow.value = data.monthlyEscrow;

        // Refi offer
        if (data.refiLoanAmount !== undefined) dom.refiLoanAmount.value = data.refiLoanAmount;
        if (data.refiRate !== undefined) dom.refiRate.value = data.refiRate;
        if (data.refiTerm !== undefined) dom.refiTerm.value = data.refiTerm;
        if (data.refiLoanType !== undefined && dom.refiLoanType) dom.refiLoanType.value = data.refiLoanType;
        // Backward compat: old profiles used refiProduct
        if (data.refiProduct !== undefined && !data.refiLoanType && dom.refiLoanType) {
            // Map old product values to new loan types
            const prodMap = {
                'Conv30Year': 'Conventional', 'Conv20Year': 'Conventional', 'Conv15Year': 'Conventional',
                'FHA30Year': 'FHA', 'VA30Year': 'VA', 'USDA30Year': 'USDA'
            };
            dom.refiLoanType.value = prodMap[data.refiProduct] || 'Conventional';
        }

        // Cash out
        if (data.cashOutEnabled !== undefined) {
            dom.cashOutToggle.checked = data.cashOutEnabled;
            dom.cashOutFields.style.display = data.cashOutEnabled ? 'block' : 'none';
        }
        if (data.cashOutAmount !== undefined) dom.cashOutAmount.value = data.cashOutAmount;
        if (data.cashOutDebtPayments !== undefined) dom.cashOutDebtPayments.value = data.cashOutDebtPayments;

        // Restore debt rows
        if (data.cashOutDebts && data.cashOutDebts.length > 0) {
            while (dom.debtRows.firstChild) dom.debtRows.removeChild(dom.debtRows.firstChild);
            debtRowCount = 0;
            data.cashOutDebts.forEach((debt, i) => {
                dom.debtRows.appendChild(
                    buildDebtRow(debt.name, debt.balance, debt.payment, debt.rate, i > 0)
                );
            });
        }

        // Cost of Waiting toggle
        if (data.costOfWaitingEnabled !== undefined) {
            dom.costOfWaitingToggle.checked = data.costOfWaitingEnabled;
            dom.costOfWaitingFields.style.display = data.costOfWaitingEnabled ? 'block' : 'none';
        }

        // Future rate
        if (data.futureRate !== undefined) dom.futureRate.value = data.futureRate;
        if (data.monthsToWait !== undefined) dom.monthsToWait.value = data.monthsToWait;
        if (data.futureMIValue !== undefined && dom.futureMIInput) dom.futureMIInput.value = data.futureMIValue;

        // Advice settings
        if (data.targetBreakeven !== undefined) dom.targetBreakeven.value = data.targetBreakeven;
        if (data.planToStayMonths !== undefined) dom.planToStayMonths.value = data.planToStayMonths;

        // Fees
        if (data.fees) {
            Object.keys(data.fees).forEach(id => {
                if (dom.fees[id]) dom.fees[id].value = data.fees[id];
            });
        }

        // Editable MI inputs (restore from fees — dollar mode)
        if (data.fees) {
            if (dom.currentMIInput) dom.currentMIInput.value = data.currentMIValue || 0;
            if (dom.refiMIMonthlyInput) dom.refiMIMonthlyInput.value = data.fees.feeMonthlyMI || 0;
            if (dom.refiMIUpfrontInput) dom.refiMIUpfrontInput.value = data.fees.feeUpfrontMI || 0;
        }
        // Future MI
        if (data.futureMIValue !== undefined && dom.futureMIInput) dom.futureMIInput.value = data.futureMIValue;
        // Reset MI mode buttons to dollar
        ['currentMIModeBtn', 'refiMIMonthlyModeBtn', 'refiMIUpfrontModeBtn', 'futureMIModeBtn'].forEach(function(id) {
            var btn = document.getElementById(id);
            if (btn) { btn.textContent = '$'; btn.setAttribute('data-mode', 'dollar'); }
        });

        // Re-compute live values
        updateLiveCalculations();
        updateClosingCostTotals();
    }

    // -------------------------------------------------
    // DEBT ROW MANAGEMENT
    // -------------------------------------------------

    let debtRowCount = 1;

    /**
     * Create a labeled number input group for debt rows.
     */
    function createDebtInputGroup(labelText, className, defaultVal, min, step, max, flex) {
        const group = document.createElement('div');
        group.className = 'input-group';
        group.style.cssText = `flex:${flex || '1'};`;

        const label = document.createElement('label');
        label.style.fontSize = '0.75rem';
        label.textContent = labelText;
        group.appendChild(label);

        const input = document.createElement('input');
        input.type = 'number';
        input.className = className;
        input.value = defaultVal;
        input.min = min;
        input.step = step;
        if (max !== undefined) input.max = max;
        group.appendChild(input);

        return group;
    }

    function buildDebtRow(name, balance, payment, rate, showRemove) {
        debtRowCount++;
        const row = document.createElement('div');
        row.className = 'debt-row input-row';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = `debtName${debtRowCount}`;
        nameInput.placeholder = 'Debt description';
        nameInput.style.cssText = 'flex:2; min-width:150px;';
        nameInput.value = name || '';
        row.appendChild(nameInput);

        row.appendChild(createDebtInputGroup('Balance', 'debt-balance', balance || 0, 0, 100));
        row.appendChild(createDebtInputGroup('Monthly Pmt', 'debt-payment', payment || 0, 0, 1));
        row.appendChild(createDebtInputGroup('Rate %', 'debt-rate', rate || 0, 0, 0.1, 40, '0.7'));

        if (showRemove) {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn btn-link';
            removeBtn.style.cssText = 'color:var(--danger); flex:0;';
            removeBtn.textContent = '\u2715';
            removeBtn.addEventListener('click', () => row.remove());
            row.appendChild(removeBtn);
        }

        return row;
    }

    function addDebtRow() {
        dom.debtRows.appendChild(buildDebtRow('', 0, 0, 0, true));
    }

    function autoSumDebts() {
        let totalPayment = 0;
        const paymentInputs = dom.debtRows.querySelectorAll('.debt-payment');
        paymentInputs.forEach(input => {
            totalPayment += parseFloat(input.value) || 0;
        });
        dom.cashOutDebtPayments.value = totalPayment.toFixed(2);
        updateLiveCalculations();
    }

    // -------------------------------------------------
    // RUN CALCULATION
    // -------------------------------------------------

    function runCalculation() {
        const inputs = readAllInputs();

        // Run engine (includes validation)
        const results = RefiEngine.runAnalysis(inputs);

        if (results.valid === false) {
            alert('Please fix the following:\n\n' + results.errors.join('\n'));
            return;
        }

        lastResults = results;

        // Display results
        displayResults(results);

        // Build charts — open chart sections first so canvases have dimensions
        if (typeof RefiCharts !== 'undefined') {
            document.querySelectorAll('.chart-content').forEach(function(el) {
                // Skip transition so canvas immediately gets full size
                el.style.transition = 'none';
                el.classList.add('open');
                // Update toggle button text
                var btn = el.previousElementSibling ? el.previousElementSibling.querySelector('.chart-toggle') : null;
                if (btn) {
                    if (!btn.dataset.labelShow) {
                        btn.dataset.labelShow = btn.textContent;
                        btn.dataset.labelHide = btn.textContent.replace('Show', 'Hide');
                    }
                    btn.textContent = btn.dataset.labelHide || btn.textContent.replace('Show', 'Hide');
                }
            });
            // Force reflow then render charts, then restore transitions
            void document.body.offsetHeight;
            RefiCharts.renderAll(results);
            requestAnimationFrame(function() {
                document.querySelectorAll('.chart-content').forEach(function(el) {
                    el.style.transition = '';
                });
            });
        }

        // Build advice
        if (typeof RefiAdvice !== 'undefined') {
            RefiAdvice.render(results);
        }

        // Build calculation details
        buildMathDetails(results);

        // Build closing cost summary table
        buildClosingCostSummary(results);

        // Show/hide Cost of Waiting results section
        if (dom.costOfWaitingResults) {
            dom.costOfWaitingResults.style.display = inputs.costOfWaitingEnabled ? '' : 'none';
        }

        // Display double refi results
        displayDoubleRefi(results);

        // Show results with animation
        dom.resultsContainer.classList.remove('hidden');
        dom.resultsContainer.classList.add('visible');

        // Scroll to results
        dom.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // -------------------------------------------------
    // DISPLAY RESULTS
    // -------------------------------------------------

    function displayResults(r) {
        const analysis = r.analysis;

        // Refinance Now metrics
        // If cash-out is active, show the adjusted label
        const savingsCard = document.getElementById('cardMonthlySavings');
        if (r.cashOut.enabled && r.cashOut.debtPayments > 0) {
            savingsCard.querySelector('h3').textContent = 'Adjusted Monthly Savings';
            setText('resultMonthlySavings',
                formatMoney(analysis.monthlySavingsNow) +
                ' (Pmt: ' + formatMoney(analysis.piSavingsNow) + ' + Debt: ' + formatMoney(analysis.cashOutDebtPayments) + ')'
            );
        } else {
            savingsCard.querySelector('h3').textContent = 'Monthly Savings';
            setText('resultMonthlySavings', formatMoney(analysis.monthlySavingsNow));
        }

        setText('resultBreakevenNow', analysis.breakevenNow === Infinity ? 'N/A' : analysis.breakevenNow + ' months');
        setText('resultTotalClosingCost', formatMoney(analysis.closingCosts));
        setText('resultNetSavings', formatMoney(analysis.refiNowNetSavings));

        // Color-code monthly savings card
        setCardStatus('cardMonthlySavings', analysis.monthlySavingsNow > 0 ? 'favorable' : 'unfavorable');

        // Color-code breakeven card
        const targetBE = r.inputs.targetBreakeven;
        if (analysis.breakevenNow === Infinity) {
            setCardStatus('cardBreakevenNow', 'unfavorable');
        } else if (analysis.breakevenNow <= targetBE) {
            setCardStatus('cardBreakevenNow', 'favorable');
        } else {
            setCardStatus('cardBreakevenNow', 'neutral');
        }

        // Net savings card
        setCardStatus('cardNetSavings', analysis.refiNowNetSavings > 0 ? 'favorable' : 'unfavorable');

        // Payment comparison (include user-entered MI and escrow if applicable)
        const escrow = r.inputs.monthlyEscrow || 0;
        const refiTotal = r.refiPayment + r.refiMonthlyMI + escrow;

        // Build breakdown parts for current payment
        if (r.inputs.useManualFullPayment) {
            // Full payment override — display the user's original full payment amount
            setText('compareCurrentPayment', formatMoney(r.inputs.currentFullPaymentManual));
            setText('compareCurrentDetail', 'Manual full payment override');
        } else {
            const currentTotal = r.currentPayment + r.currentMonthlyMI + escrow;
            const currentParts = ['Pmt ' + formatMoney(r.currentPayment)];
            if (r.currentMonthlyMI > 0) currentParts.push('MI ' + formatMoney(r.currentMonthlyMI));
            if (escrow > 0) currentParts.push('T&I ' + formatMoney(escrow));

            setText('compareCurrentPayment', currentParts.length > 1 ? formatMoney(currentTotal) : formatMoney(r.currentPayment));
            setText('compareCurrentDetail', currentParts.length > 1 ? currentParts.join(' + ') : '');
        }

        // Build breakdown parts for new payment
        const refiParts = ['Pmt ' + formatMoney(r.refiPayment)];
        if (r.refiMonthlyMI > 0) refiParts.push('MI ' + formatMoney(r.refiMonthlyMI));
        if (escrow > 0) refiParts.push('T&I ' + formatMoney(escrow));

        setText('compareNewPayment', refiParts.length > 1 ? formatMoney(refiTotal) : formatMoney(r.refiPayment));
        setText('compareNewDetail', refiParts.length > 1 ? refiParts.join(' + ') : '');

        // Cost of waiting metrics (populate even if hidden so PDF can use them)
        setText('resultExtraInterest', formatMoney(analysis.extraInterest));
        const futureParts = ['Pmt ' + formatMoney(analysis.futurePIPayment)];
        if (analysis.futureMI > 0) futureParts.push('MI ' + formatMoney(analysis.futureMI));
        if (escrow > 0) futureParts.push('T&I ' + formatMoney(escrow));
        const futureTotal = r.futurePayment + escrow;
        setText('resultFuturePayment', futureParts.length > 1 ? formatMoney(futureTotal) : formatMoney(r.futurePayment));
        setText('resultFutureDetail', futureParts.length > 1 ? futureParts.join(' + ') : '');
        setText('resultFutureSavings', formatMoney(analysis.futureMonthlySavings));
        setText('resultBreakevenWait', analysis.breakevenWait === Infinity ? 'N/A' : analysis.breakevenWait + ' months');

        setCardStatus('cardExtraInterest', analysis.extraInterest > 0 ? 'unfavorable' : 'favorable');
        setCardStatus('cardFutureSavings', analysis.futureMonthlySavings > 0 ? 'favorable' : 'unfavorable');
        if (analysis.breakevenWait === Infinity) {
            setCardStatus('cardBreakevenWait', 'unfavorable');
        } else if (analysis.breakevenWait <= targetBE) {
            setCardStatus('cardBreakevenWait', 'favorable');
        } else {
            setCardStatus('cardBreakevenWait', 'neutral');
        }

        // Breakdown cards
        setText('breakdownNowCosts', formatMoney(analysis.closingCosts));
        setText('breakdownNowSavings', formatMoney(analysis.monthlySavingsNow) + '/mo');
        setText('breakdownNowBreakeven', analysis.breakevenNow === Infinity ? 'N/A' : analysis.breakevenNow + ' mo');
        setText('breakdownNowNet', formatMoney(analysis.refiNowNetSavings));

        setText('breakdownWaitCosts', formatMoney(analysis.closingCosts));
        setText('breakdownWaitExtra', formatMoney(analysis.extraInterest));
        setText('breakdownWaitEffective', formatMoney(analysis.effectiveTotalCost));
        setText('breakdownWaitSavings', formatMoney(analysis.futureMonthlySavings) + '/mo');
        setText('breakdownWaitBreakeven', analysis.breakevenWait === Infinity ? 'N/A' : analysis.breakevenWait + ' mo');
        setText('breakdownWaitNet', formatMoney(analysis.waitNetSavings));

        // Scenario pills — rate & wait period context
        const pillRefiNow = document.getElementById('pillRefiNow');
        if (pillRefiNow) pillRefiNow.textContent = r.inputs.refiRate + '%';

        const pillWait = document.getElementById('pillWait');
        if (pillWait) pillWait.textContent = r.inputs.futureRate + '% · ' + analysis.monthsToWait + ' mo wait';

        // Difference card
        const diffCard = document.getElementById('differenceCard');
        const diffValue = document.getElementById('resultDifference');
        const diffExplain = document.getElementById('differenceExplain');

        diffValue.textContent = formatMoney(Math.abs(analysis.netDifference));
        diffCard.classList.remove('positive', 'negative');

        if (analysis.netDifference > 0) {
            diffCard.classList.add('positive');
            diffValue.textContent = '+' + formatMoney(analysis.netDifference);
            diffExplain.textContent = `Refinancing NOW saves you ${formatMoney(analysis.netDifference)} more than waiting over your ${r.inputs.planToStayMonths}-month stay.`;
        } else if (analysis.netDifference < 0) {
            diffCard.classList.add('negative');
            diffValue.textContent = '-' + formatMoney(Math.abs(analysis.netDifference));
            diffExplain.textContent = `Waiting and refinancing later saves you ${formatMoney(Math.abs(analysis.netDifference))} more over your ${r.inputs.planToStayMonths}-month stay.`;
        } else {
            diffExplain.textContent = 'Both scenarios produce the same net savings.';
        }
    }

    // -------------------------------------------------
    // DOUBLE REFI RESULTS DISPLAY
    // -------------------------------------------------

    function displayDoubleRefi(r) {
        const section = document.getElementById('doubleRefiResults');
        if (!section) return;

        const dr = r.doubleRefi;

        // Only show when Cost of Waiting is enabled and double refi was calculated
        if (!dr || !r.inputs.costOfWaitingEnabled) {
            section.style.display = 'none';
            return;
        }
        section.style.display = '';

        const analysis = r.analysis;
        const targetBE = r.inputs.targetBreakeven;

        // Target rate label
        setText('doubleRefiTargetRate', r.inputs.futureRate);

        // Phase 1: savings during first refi period
        setText('resultDoubleRefiPhase1Savings', formatMoney(dr.monthlySavingsPhase1) + '/mo');
        setText('resultDoubleRefiPhase1Detail',
            formatMoney(dr.monthlySavingsPhase1) + '/mo for ' + dr.phase1Months + ' months = ' + formatMoney(dr.phase1Savings));
        setCardStatus('cardDoubleRefiPhase1Savings', dr.monthlySavingsPhase1 > 0 ? 'favorable' : 'unfavorable');

        // Phase 2: second refi payment
        setText('resultDoubleRefiPhase2Payment', formatMoney(dr.secondRefiPayment));
        setText('resultDoubleRefiPhase2Detail',
            formatMoney(dr.monthlySavingsPhase2) + '/mo savings for ' + dr.phase2Months + ' months');
        setCardStatus('cardDoubleRefiPhase2Payment', dr.piSavingsPhase2 > 0 ? 'favorable' : 'neutral');

        // Total costs (2x)
        setText('resultDoubleRefiTotalCosts', formatMoney(dr.totalCosts));

        // Breakeven
        setText('resultDoubleRefiBreakeven',
            dr.breakevenMonth === Infinity ? 'N/A' : dr.breakevenMonth + ' months');
        if (dr.breakevenMonth === Infinity) {
            setCardStatus('cardDoubleRefiBreakeven', 'unfavorable');
        } else if (dr.breakevenMonth <= targetBE) {
            setCardStatus('cardDoubleRefiBreakeven', 'favorable');
        } else {
            setCardStatus('cardDoubleRefiBreakeven', 'neutral');
        }

        // 3-Way comparison
        setText('compare3NowCosts', formatMoney(analysis.closingCosts));
        setText('compare3NowSavings', formatMoney(analysis.monthlySavingsNow) + '/mo');
        setText('compare3NowNet', formatMoney(analysis.refiNowNetSavings));

        setText('compare3DoubleCosts', formatMoney(dr.totalCosts));
        setText('compare3DoublePhase1', formatMoney(dr.phase1Savings));
        setText('compare3DoublePhase2', formatMoney(dr.phase2Savings));
        setText('compare3DoubleNet', formatMoney(dr.netSavings));

        setText('compare3WaitCosts', formatMoney(analysis.effectiveTotalCost));
        setText('compare3WaitSavings', formatMoney(analysis.futureMonthlySavings) + '/mo');
        setText('compare3WaitNet', formatMoney(analysis.waitNetSavings));

        // 3-way comparison pills
        const pillRefiNowOnly = document.getElementById('pillRefiNowOnly');
        if (pillRefiNowOnly) pillRefiNowOnly.textContent = r.inputs.refiRate + '%';

        const pillWaitOnce = document.getElementById('pillWaitOnce');
        if (pillWaitOnce) pillWaitOnce.textContent = r.inputs.futureRate + '% · ' + analysis.monthsToWait + ' mo wait';

        // Determine best strategy
        const scenarios = [
            { label: 'Refi Now Only', net: analysis.refiNowNetSavings },
            { label: 'Refi Now + Refi Again', net: dr.netSavings },
            { label: 'Wait & Refi Once', net: analysis.waitNetSavings }
        ];
        scenarios.sort((x, y) => y.net - x.net);
        const best = scenarios[0];
        const second = scenarios[1];

        const winnerCard = document.getElementById('doubleRefiWinnerCard');
        winnerCard.classList.remove('positive', 'negative');

        const bestLabel = document.getElementById('doubleRefiBestLabel');
        const bestExplain = document.getElementById('doubleRefiBestExplain');

        bestLabel.textContent = best.label;

        if (best.net > second.net) {
            winnerCard.classList.add('positive');
            const advantage = RefiEngine.round2(best.net - second.net);
            bestExplain.textContent = best.label + ' saves ' + formatMoney(advantage) +
                ' more than the next best option (' + second.label + ') over your ' +
                r.inputs.planToStayMonths + '-month stay.';
        } else {
            bestExplain.textContent = 'Multiple strategies produce similar results. Consider rate confidence and cash flow preferences.';
        }
    }

    // -------------------------------------------------
    // CALCULATION DETAILS (MATH STEPS)
    // -------------------------------------------------

    function buildMathDetails(r) {
        const container = document.getElementById('mathStepsContainer');
        const analysis = r.analysis;

        let html = '';

        // Current Payment
        html += `
        <div class="math-group">
            <h4>Current Monthly Payment</h4>
            <div class="math-step">
                <div class="step-label">Formula: M = P &times; [r(1+r)<sup>n</sup>] / [(1+r)<sup>n</sup> - 1]</div>
                <div class="step-formula">
                    P = ${formatMoney(r.inputs.currentBalance)} | r = ${r.inputs.currentRate}% / 12 = ${(r.inputs.currentRate / 1200).toFixed(8)} | n = ${r.inputs.currentTermRemaining}
                </div>
                <div class="step-result">= ${formatMoney(r.currentPaymentComputed)}${r.inputs.useManualFullPayment ? ' (full payment override: ' + formatMoney(r.inputs.currentFullPaymentManual) + ')' : (r.inputs.useManualPayment ? ' (payment overridden to ' + formatMoney(r.inputs.currentPaymentManual) + ')' : '')}</div>
            </div>
        </div>`;

        // Refi Payment
        html += `
        <div class="math-group">
            <h4>New Monthly Payment</h4>
            <div class="math-step">
                <div class="step-formula">
                    P = ${formatMoney(r.inputs.refiLoanAmount)} | r = ${r.inputs.refiRate}% / 12 = ${(r.inputs.refiRate / 1200).toFixed(8)} | n = ${r.inputs.refiTerm}
                </div>
                <div class="step-result">= ${formatMoney(r.refiPayment)}</div>
            </div>
        </div>`;

        // Monthly Savings
        if (r.cashOut.enabled && r.cashOut.debtPayments > 0) {
            html += `
            <div class="math-group">
                <h4>Monthly Savings (with Cash Out Debt Consolidation)</h4>
                <div class="math-step">
                    <div class="step-label">Payment Savings</div>
                    <div class="step-formula">${formatMoney(r.currentPayment)} - ${formatMoney(r.refiPayment)}</div>
                    <div class="step-result">= ${formatMoney(analysis.piSavingsNow)} per month</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Debt Payments Eliminated (Cash Out)</div>
                    <div class="step-result">= ${formatMoney(r.cashOut.debtPayments)} per month</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Total Adjusted Monthly Savings</div>
                    <div class="step-formula">${formatMoney(analysis.piSavingsNow)} + ${formatMoney(r.cashOut.debtPayments)}</div>
                    <div class="step-result">= ${formatMoney(analysis.monthlySavingsNow)} per month</div>
                </div>
            </div>`;
        } else {
            html += `
            <div class="math-group">
                <h4>Monthly Savings (Refinance Now)</h4>
                <div class="math-step">
                    <div class="step-formula">${formatMoney(r.currentPayment)} - ${formatMoney(r.refiPayment)}</div>
                    <div class="step-result">= ${formatMoney(analysis.monthlySavingsNow)} per month</div>
                </div>
            </div>`;
        }

        // Breakeven Now
        html += `
        <div class="math-group">
            <h4>Breakeven (Refinance Now)</h4>
            <div class="math-step">
                <div class="step-label">Breakeven = Total Closing Costs / Monthly Savings</div>
                <div class="step-formula">${formatMoney(analysis.closingCosts)} / ${formatMoney(analysis.monthlySavingsNow)}</div>
                <div class="step-result">= ${analysis.breakevenNow === Infinity ? 'N/A (no savings)' : analysis.breakevenNow + ' months'}</div>
            </div>
        </div>`;

        // Cost of Waiting (only if enabled)
        if (r.inputs.costOfWaitingEnabled) {
            html += `
            <div class="math-group">
                <h4>Cost of Waiting Analysis</h4>
                <div class="math-step">
                    <div class="step-label">Extra interest paid while waiting (${analysis.monthsToWait} months)</div>
                    <div class="step-formula">${formatMoney(analysis.monthlySavingsNow)} &times; ${analysis.monthsToWait} months</div>
                    <div class="step-result">= ${formatMoney(analysis.extraInterest)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Balance after waiting ${analysis.monthsToWait} months</div>
                    <div class="step-result">= ${formatMoney(analysis.balanceAfterWait)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Future Monthly Payment (${r.inputs.futureRate}% on ${formatMoney(analysis.balanceAfterWait)})</div>
                    <div class="step-result">= ${formatMoney(r.futurePayment)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Future monthly savings vs current</div>
                    <div class="step-formula">${formatMoney(r.currentPayment)} - ${formatMoney(r.futurePayment)}</div>
                    <div class="step-result">= ${formatMoney(analysis.futureMonthlySavings)} per month</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Effective total cost if waiting</div>
                    <div class="step-formula">${formatMoney(analysis.closingCosts)} + ${formatMoney(analysis.extraInterest)}</div>
                    <div class="step-result">= ${formatMoney(analysis.effectiveTotalCost)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Adjusted breakeven if waiting</div>
                    <div class="step-formula">${formatMoney(analysis.effectiveTotalCost)} / ${formatMoney(analysis.futureMonthlySavings)}</div>
                    <div class="step-result">= ${analysis.breakevenWait === Infinity ? 'N/A (no savings)' : analysis.breakevenWait + ' months'}</div>
                </div>
            </div>`;
        }

        // Double Refi Details (only if calculated)
        if (r.doubleRefi) {
            const dr = r.doubleRefi;
            html += `
            <div class="math-group">
                <h4>Double Refi Strategy — Refi Now, Then Refi Again</h4>
                <div class="math-step">
                    <div class="step-label">Phase 1: Refi now at ${r.inputs.refiRate}% for ${dr.phase1Months} months</div>
                    <div class="step-formula">Monthly savings: ${formatMoney(r.currentPayment)} - ${formatMoney(r.refiPayment)} = ${formatMoney(dr.piSavingsPhase1)}/mo</div>
                    <div class="step-result">Phase 1 total: ${formatMoney(dr.piSavingsPhase1)} &times; ${dr.phase1Months} = ${formatMoney(dr.phase1Savings)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Balance at month ${dr.phase1Months} (when 2nd refi occurs)</div>
                    <div class="step-result">= ${formatMoney(dr.balanceAtSecondRefi)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Phase 2: Refi again at ${r.inputs.futureRate}% on ${formatMoney(dr.balanceAtSecondRefi)}</div>
                    <div class="step-formula">New payment: ${formatMoney(dr.secondRefiPayment)} | Savings: ${formatMoney(r.currentPayment)} - ${formatMoney(dr.secondRefiPayment)} = ${formatMoney(dr.piSavingsPhase2)}/mo</div>
                    <div class="step-result">Phase 2 total: ${formatMoney(dr.piSavingsPhase2)} &times; ${dr.phase2Months} = ${formatMoney(dr.phase2Savings)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Total closing costs (2x)</div>
                    <div class="step-formula">${formatMoney(dr.firstRefiCosts)} + ${formatMoney(dr.secondRefiCosts)}</div>
                    <div class="step-result">= ${formatMoney(dr.totalCosts)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Net savings (Double Refi Strategy)</div>
                    <div class="step-formula">(${formatMoney(dr.phase1Savings)} + ${formatMoney(dr.phase2Savings)}) - ${formatMoney(dr.totalCosts)}</div>
                    <div class="step-result">= ${formatMoney(dr.netSavings)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Combined breakeven</div>
                    <div class="step-result">= ${dr.breakevenMonth === Infinity ? 'N/A (costs not recovered)' : dr.breakevenMonth + ' months'}</div>
                </div>
            </div>`;
        }

        // Net Savings Comparison
        html += `
        <div class="math-group">
            <h4>Net Savings Comparison (over ${r.inputs.planToStayMonths} months)</h4>
            <div class="math-step">
                <div class="step-label">Refinance Now Net Savings</div>
                <div class="step-formula">(${formatMoney(analysis.monthlySavingsNow)} &times; ${r.inputs.planToStayMonths}) - ${formatMoney(analysis.closingCosts)}</div>
                <div class="step-result">= ${formatMoney(analysis.refiNowNetSavings)}</div>
            </div>`;

        if (r.doubleRefi) {
            html += `
            <div class="math-step">
                <div class="step-label">Refi Now + Refi Again Net Savings</div>
                <div class="step-result">= ${formatMoney(r.doubleRefi.netSavings)}</div>
            </div>`;
        }

        if (r.inputs.costOfWaitingEnabled) {
            html += `
            <div class="math-step">
                <div class="step-label">Wait & Refinance Net Savings</div>
                <div class="step-formula">(${formatMoney(analysis.futureMonthlySavings)} &times; ${Math.max(0, r.inputs.planToStayMonths - analysis.monthsToWait)}) - ${formatMoney(analysis.effectiveTotalCost)}</div>
                <div class="step-result">= ${formatMoney(analysis.waitNetSavings)}</div>
            </div>
            <div class="math-step">
                <div class="step-label">Difference (Now vs Wait)</div>
                <div class="step-result" style="font-size:1.1rem;">= ${formatMoney(analysis.netDifference)} ${analysis.netDifference > 0 ? '(Refinance Now is better)' : analysis.netDifference < 0 ? '(Waiting is better)' : '(Equal)'}</div>
            </div>`;
        }

        html += `</div>`;

        container.innerHTML = html;
    }

    // -------------------------------------------------
    // CLOSING COST SUMMARY TABLE
    // -------------------------------------------------

    function buildClosingCostSummary(r) {
        const container = document.getElementById('closingCostTableContainer');
        const fees = r.inputs.fees;
        const costs = r.costs;
        const config = RefiEngine.FEE_CONFIG;

        // Group display metadata
        const groupMeta = {
            origination: { label: 'Origination Charges', costKey: 'origination', subtotalLabel: 'Origination Total' },
            cannotShop:  { label: 'Services Borrower Cannot Shop', costKey: 'cannotShop', subtotalLabel: 'Cannot Shop Total' },
            canShop:     { label: 'Services Borrower Can Shop For', costKey: 'canShop', subtotalLabel: 'Can Shop Total' },
            govFees:     { label: 'Taxes & Government Fees', costKey: 'govFees', subtotalLabel: 'Government Fees Total' },
            mi:          { label: 'Mortgage Insurance / Funding Fees' },
            other:       { label: 'Other', costKey: 'other', subtotalLabel: null }
        };
        const groupOrder = ['origination', 'cannotShop', 'canShop', 'govFees', 'mi', 'other'];

        // Build rows from FEE_CONFIG
        const rows = [];
        groupOrder.forEach(group => {
            const meta = groupMeta[group];
            if (!meta) return;
            rows.push({ section: true, label: meta.label });

            config.filter(item => item.group === group).forEach(item => {
                const row = { label: item.label, value: fees[item.id] || 0 };
                if (item.monthlySeparate) row.note = '/month (not in closing cost total)';
                rows.push(row);
            });

            if (meta.subtotalLabel) {
                rows.push({ subtotal: true, label: meta.subtotalLabel, value: costs[meta.costKey] });
            }
        });

        rows.push({ grand: true, label: 'Total Closing Costs (for Breakeven)', value: costs.totalBreakeven });

        // Excluded section (prepaids & escrow)
        rows.push({ section: true, label: 'Excluded from Breakeven', excluded: true });
        config.filter(item => item.excludeFromBreakeven).forEach(item => {
            rows.push({ label: item.label, value: fees[item.id] || 0, excluded: true });
        });
        rows.push({
            subtotal: true, label: 'Total Prepaids & Escrow',
            value: RefiEngine.round2(costs.prepaids + costs.escrow), excluded: true
        });

        rows.push({ grand: true, label: 'Total All Closing Costs', value: costs.totalAll });

        // Render table
        let html = '<table class="closing-summary-table">';
        html += '<thead><tr><th>Fee Description</th><th class="amount-col">Amount</th></tr></thead><tbody>';

        rows.forEach(row => {
            if (row.section) {
                html += `<tr class="section-header${row.excluded ? ' excluded-row' : ''}"><td colspan="2">${row.label}</td></tr>`;
            } else if (row.grand) {
                html += `<tr class="grand-total"><td>${row.label}</td><td class="amount-col">${formatMoney(row.value)}</td></tr>`;
            } else if (row.subtotal) {
                html += `<tr class="subtotal${row.excluded ? ' excluded-row' : ''}"><td>${row.label}</td><td class="amount-col">${formatMoney(row.value)}</td></tr>`;
            } else {
                html += `<tr${row.excluded ? ' class="excluded-row"' : ''}><td>${row.label}</td><td class="amount-col">${formatMoney(row.value)}</td></tr>`;
            }
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    // -------------------------------------------------
    // RESET
    // -------------------------------------------------

    function resetAll() {
        if (!confirm('Reset all inputs to defaults?')) return;

        // Current loan
        dom.currentBalance.value = 485000;
        dom.currentRate.value = 6.875;
        dom.currentTermRemaining.value = 348;
        dom.currentPropertyValue.value = 660000;
        dom.manualPaymentToggle.checked = false;
        dom.manualPaymentSection.style.display = 'none';
        dom.currentPaymentManual.value = 0;
        dom.manualFullPaymentToggle.checked = false;
        dom.manualFullPaymentSection.style.display = 'none';
        dom.currentFullPaymentManual.value = 0;
        dom.monthlyEscrow.value = 0;

        // Refi
        dom.refiLoanAmount.value = 485000;
        dom.refiRate.value = 5.750;
        dom.refiTerm.value = 360;
        if (dom.refiLoanType) dom.refiLoanType.value = 'Conventional';
        if (dom.currentLoanType) dom.currentLoanType.value = 'Conventional';

        // MI editable inputs
        if (dom.currentMIInput) dom.currentMIInput.value = 0;
        if (dom.refiMIMonthlyInput) dom.refiMIMonthlyInput.value = 0;
        if (dom.refiMIUpfrontInput) dom.refiMIUpfrontInput.value = 0;
        if (dom.futureMIInput) dom.futureMIInput.value = 0;
        // Reset MI mode buttons to dollar
        ['currentMIModeBtn', 'refiMIMonthlyModeBtn', 'refiMIUpfrontModeBtn', 'futureMIModeBtn'].forEach(function(id) {
            var btn = document.getElementById(id);
            if (btn) { btn.textContent = '$'; btn.setAttribute('data-mode', 'dollar'); }
        });

        // Cash Out
        dom.cashOutToggle.checked = false;
        dom.cashOutFields.style.display = 'none';
        dom.cashOutAmount.value = 0;
        dom.cashOutDebtPayments.value = 0;
        // Reset debt rows to a single empty row
        while (dom.debtRows.firstChild) dom.debtRows.removeChild(dom.debtRows.firstChild);
        debtRowCount = 0;
        dom.debtRows.appendChild(buildDebtRow('', 0, 0, 0, false));

        // Cost of Waiting
        dom.costOfWaitingToggle.checked = true;
        dom.costOfWaitingFields.style.display = 'block';

        // Future
        dom.futureRate.value = 5.250;
        dom.monthsToWait.value = 6;

        // Advice
        dom.targetBreakeven.value = 36;
        dom.planToStayMonths.value = 84;

        // Fees — set to worksheet defaults
        const feeDefaults = {
            feeOrigination: 0, feeUnderwriting: 0, feeDiscount: 0, feeLenderCredit: 0,
            feeAppraisal: 850, feeCreditReport: 145, feeFloodCert: 13.50,
            feeMERS: 24.95, feeTaxService: 90, feeTechnology: 100,
            feeVOE: 110, feeVOT: 50,
            feeERecording: 12, feeTitleCPL: 25, feeTitleLenders: 750,
            feeTitleSettlement: 300, feeTitleTaxCert: 50,
            feeRecording: 195,
            feePrepaidInterest: 0,
            feeEscrowTax: 911.91, feeEscrowInsurance: 474.34,
            feeUpfrontMI: 0, feeMonthlyMI: 0,
            feeOther: 0
        };
        Object.keys(feeDefaults).forEach(id => {
            if (dom.fees[id]) dom.fees[id].value = feeDefaults[id];
        });

        // Hide results
        dom.resultsContainer.classList.add('hidden');
        dom.resultsContainer.classList.remove('visible');
        lastResults = null;

        // Destroy charts
        if (typeof RefiCharts !== 'undefined') {
            RefiCharts.destroyAll();
        }

        // Re-compute live values
        updateLiveCalculations();
        updateClosingCostTotals();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // -------------------------------------------------
    // UTILITY HELPERS
    // -------------------------------------------------

    function num(el) {
        return parseFloat(el?.value) || 0;
    }

    function formatMoney(val) {
        if (val === Infinity || val === -Infinity || isNaN(val)) return 'N/A';
        const absVal = Math.abs(val);
        const formatted = '$' + absVal.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return val < 0 ? '-' + formatted : formatted;
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setCardStatus(cardId, status) {
        const card = document.getElementById(cardId);
        if (!card) return;
        card.classList.remove('favorable', 'unfavorable', 'neutral');
        card.classList.add(status);
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // -------------------------------------------------
    // SECTION TOGGLE (used globally for chart/collapsible)
    // -------------------------------------------------

    // Make toggleSection available globally for onclick handlers
    window.toggleSection = function(sectionId) {
        const content = document.getElementById(sectionId);
        if (!content) return;
        const isOpen = content.classList.contains('open');
        content.classList.toggle('open');

        // Update button text using data attribute or sensible defaults
        const btn = content.previousElementSibling?.querySelector('.chart-toggle, .toggle-button');
        if (btn) {
            // Use the original label stored in data attribute, or derive it
            if (!btn.dataset.labelShow) {
                btn.dataset.labelShow = btn.textContent;
                btn.dataset.labelHide = btn.textContent.replace('Show', 'Hide');
            }
            btn.textContent = isOpen ? btn.dataset.labelShow : btn.dataset.labelHide;
        }
    };

    // -------------------------------------------------
    // PUBLIC API
    // -------------------------------------------------

    return {
        init,
        getLastResults: () => lastResults,
        formatMoney,
        readAllInputs,
        writeAllInputs,
        runCalculation
    };

})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    RefiUI.init();
});
