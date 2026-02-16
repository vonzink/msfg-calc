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
        dom.manualPaymentToggle = document.getElementById('manualPaymentToggle');
        dom.manualPaymentSection = document.getElementById('manualPaymentSection');
        dom.currentPaymentManual = document.getElementById('currentPaymentManual');
        dom.currentPaymentDisplay = document.getElementById('currentPaymentDisplay');

        // Refi offer
        dom.refiLoanAmount = document.getElementById('refiLoanAmount');
        dom.refiRate = document.getElementById('refiRate');
        dom.refiTerm = document.getElementById('refiTerm');
        dom.refiProduct = document.getElementById('refiProduct');
        dom.refiPaymentDisplay = document.getElementById('refiPaymentDisplay');

        // Future rate
        dom.futureRate = document.getElementById('futureRate');
        dom.monthsToWait = document.getElementById('monthsToWait');
        dom.futurePaymentDisplay = document.getElementById('futurePaymentDisplay');

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

        // Fee fields (all start with "fee")
        dom.fees = {};
        const feeIds = [
            'feeOrigination', 'feeUnderwriting', 'feeDiscount', 'feeLenderCredit',
            'feeAppraisal', 'feeCreditReport', 'feeFloodCert', 'feeMERS',
            'feeTaxService', 'feeTechnology', 'feeVOE', 'feeVOT',
            'feeERecording', 'feeTitleCPL', 'feeTitleLenders',
            'feeTitleSettlement', 'feeTitleTaxCert',
            'feeRecording',
            'feePrepaidInterest',
            'feeEscrowTax', 'feeEscrowInsurance',
            'feeOther'
        ];
        feeIds.forEach(id => {
            dom.fees[id] = document.getElementById(id);
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
        dom.btnExportPDF = document.getElementById('btnExportPDF');
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
        // Calculate button
        dom.btnCalculate.addEventListener('click', runCalculation);

        // Reset button
        dom.btnReset.addEventListener('click', resetAll);

        // Manual payment toggle
        dom.manualPaymentToggle.addEventListener('change', () => {
            dom.manualPaymentSection.style.display =
                dom.manualPaymentToggle.checked ? 'block' : 'none';
            updateLiveCalculations();
        });

        // Cost of Waiting toggle
        dom.costOfWaitingToggle.addEventListener('change', () => {
            dom.costOfWaitingFields.style.display =
                dom.costOfWaitingToggle.checked ? 'block' : 'none';
            updateLiveCalculations();
        });

        // Cash out toggle
        dom.cashOutToggle.addEventListener('change', () => {
            dom.cashOutFields.style.display =
                dom.cashOutToggle.checked ? 'block' : 'none';
            updateLiveCalculations();
        });

        // Cash out debt row management
        dom.btnAddDebt.addEventListener('click', addDebtRow);
        dom.btnAutoSum.addEventListener('click', autoSumDebts);

        // Cash out live updates
        dom.cashOutDebtPayments.addEventListener('input', updateLiveCalculations);
        dom.cashOutAmount.addEventListener('input', updateLiveCalculations);

        // Delegate debt row input changes
        dom.debtRows.addEventListener('input', (e) => {
            if (e.target.classList.contains('debt-payment') || e.target.classList.contains('debt-balance')) {
                updateLiveCalculations();
            }
        });

        // Live update payment displays when inputs change
        const liveInputs = [
            dom.currentBalance, dom.currentRate, dom.currentTermRemaining,
            dom.currentPaymentManual,
            dom.refiLoanAmount, dom.refiRate, dom.refiTerm,
            dom.futureRate, dom.monthsToWait
        ];
        liveInputs.forEach(input => {
            if (input) input.addEventListener('input', updateLiveCalculations);
        });

        // Live update closing cost totals
        Object.values(dom.fees).forEach(input => {
            if (input) input.addEventListener('input', updateClosingCostTotals);
        });

        // PDF export
        dom.btnExportPDF.addEventListener('click', () => {
            if (lastResults && typeof RefiPDF !== 'undefined') {
                RefiPDF.exportPDF(lastResults);
            }
        });

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
    // LIVE PAYMENT DISPLAY UPDATES
    // -------------------------------------------------

    function updateLiveCalculations() {
        // Current payment
        const currentPmt = RefiEngine.calcMonthlyPayment(
            num(dom.currentBalance),
            num(dom.currentRate),
            num(dom.currentTermRemaining)
        );

        if (dom.manualPaymentToggle.checked) {
            dom.currentPaymentDisplay.textContent = formatMoney(num(dom.currentPaymentManual));
            dom.currentPaymentDisplay.title = 'Manual entry';
        } else {
            dom.currentPaymentDisplay.textContent = formatMoney(currentPmt);
            dom.currentPaymentDisplay.title = 'Computed from balance, rate & term';
        }

        // Refi payment
        const refiPmt = RefiEngine.calcMonthlyPayment(
            num(dom.refiLoanAmount),
            num(dom.refiRate),
            num(dom.refiTerm)
        );
        dom.refiPaymentDisplay.textContent = formatMoney(refiPmt);

        // Future payment (only update if Cost of Waiting is enabled)
        if (dom.costOfWaitingToggle.checked) {
            const futurePmt = RefiEngine.calcMonthlyPayment(
                num(dom.refiLoanAmount),
                num(dom.futureRate),
                num(dom.refiTerm)
            );
            dom.futurePaymentDisplay.textContent = formatMoney(futurePmt);
        }

        // Cash out adjusted savings
        const currentPmtFinal = dom.manualPaymentToggle.checked
            ? num(dom.currentPaymentManual)
            : currentPmt;
        const piSavings = RefiEngine.round2(currentPmtFinal - refiPmt);
        const debtPayments = dom.cashOutToggle.checked ? num(dom.cashOutDebtPayments) : 0;
        const adjustedSavings = RefiEngine.round2(piSavings + debtPayments);
        dom.cashOutAdjustedSavings.textContent = formatMoney(adjustedSavings);
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
        return {
            currentBalance: num(dom.currentBalance),
            currentRate: num(dom.currentRate),
            currentTermRemaining: num(dom.currentTermRemaining),
            currentPropertyValue: num(dom.currentPropertyValue),
            useManualPayment: dom.manualPaymentToggle.checked,
            currentPaymentManual: num(dom.currentPaymentManual),

            refiLoanAmount: num(dom.refiLoanAmount),
            refiRate: num(dom.refiRate),
            refiTerm: num(dom.refiTerm),
            refiProduct: dom.refiProduct.value,

            cashOutEnabled: dom.cashOutToggle.checked,
            cashOutAmount: num(dom.cashOutAmount),
            cashOutDebtPayments: num(dom.cashOutDebtPayments),
            cashOutDebts: readDebtRows(),

            costOfWaitingEnabled: dom.costOfWaitingToggle.checked,
            futureRate: num(dom.futureRate),
            monthsToWait: num(dom.monthsToWait),

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

        // Refi offer
        if (data.refiLoanAmount !== undefined) dom.refiLoanAmount.value = data.refiLoanAmount;
        if (data.refiRate !== undefined) dom.refiRate.value = data.refiRate;
        if (data.refiTerm !== undefined) dom.refiTerm.value = data.refiTerm;
        if (data.refiProduct !== undefined) dom.refiProduct.value = data.refiProduct;

        // Cash out
        if (data.cashOutEnabled !== undefined) {
            dom.cashOutToggle.checked = data.cashOutEnabled;
            dom.cashOutFields.style.display = data.cashOutEnabled ? 'block' : 'none';
        }
        if (data.cashOutAmount !== undefined) dom.cashOutAmount.value = data.cashOutAmount;
        if (data.cashOutDebtPayments !== undefined) dom.cashOutDebtPayments.value = data.cashOutDebtPayments;

        // Restore debt rows
        if (data.cashOutDebts && data.cashOutDebts.length > 0) {
            dom.debtRows.innerHTML = '';
            debtRowCount = 0;
            data.cashOutDebts.forEach((debt, i) => {
                debtRowCount++;
                const row = document.createElement('div');
                row.className = 'debt-row input-row';
                const isFirst = i === 0;
                row.innerHTML = `
                    <input type="text" id="debtName${debtRowCount}" placeholder="Debt description" style="flex:2; min-width:150px;" value="${escHtml(debt.name || '')}">
                    <div class="input-group" style="flex:1;">
                        <label style="font-size:0.75rem;">Balance</label>
                        <input type="number" class="debt-balance" value="${debt.balance || 0}" min="0" step="100">
                    </div>
                    <div class="input-group" style="flex:1;">
                        <label style="font-size:0.75rem;">Monthly Pmt</label>
                        <input type="number" class="debt-payment" value="${debt.payment || 0}" min="0" step="1">
                    </div>
                    <div class="input-group" style="flex:0.7;">
                        <label style="font-size:0.75rem;">Rate %</label>
                        <input type="number" class="debt-rate" value="${debt.rate || 0}" min="0" max="40" step="0.1">
                    </div>
                    ${!isFirst ? '<button type="button" class="btn btn-link" onclick="this.parentElement.remove();" style="color:var(--danger); flex:0;">&#10005;</button>' : ''}
                `;
                dom.debtRows.appendChild(row);
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

        // Advice settings
        if (data.targetBreakeven !== undefined) dom.targetBreakeven.value = data.targetBreakeven;
        if (data.planToStayMonths !== undefined) dom.planToStayMonths.value = data.planToStayMonths;

        // Fees
        if (data.fees) {
            Object.keys(data.fees).forEach(id => {
                if (dom.fees[id]) dom.fees[id].value = data.fees[id];
            });
        }

        // Re-compute live values
        updateLiveCalculations();
        updateClosingCostTotals();
    }

    // -------------------------------------------------
    // DEBT ROW MANAGEMENT
    // -------------------------------------------------

    let debtRowCount = 1;

    function addDebtRow() {
        debtRowCount++;
        const row = document.createElement('div');
        row.className = 'debt-row input-row';
        row.innerHTML = `
            <input type="text" id="debtName${debtRowCount}" placeholder="Debt description" style="flex:2; min-width:150px;">
            <div class="input-group" style="flex:1;">
                <label style="font-size:0.75rem;">Balance</label>
                <input type="number" class="debt-balance" value="0" min="0" step="100">
            </div>
            <div class="input-group" style="flex:1;">
                <label style="font-size:0.75rem;">Monthly Pmt</label>
                <input type="number" class="debt-payment" value="0" min="0" step="1">
            </div>
            <div class="input-group" style="flex:0.7;">
                <label style="font-size:0.75rem;">Rate %</label>
                <input type="number" class="debt-rate" value="0" min="0" max="40" step="0.1">
            </div>
            <button type="button" class="btn btn-link" onclick="this.parentElement.remove();" style="color:var(--danger); flex:0;">&#10005;</button>
        `;
        dom.debtRows.appendChild(row);
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

        // Validation
        if (inputs.currentBalance <= 0) {
            alert('Please enter a valid current loan balance.');
            dom.currentBalance.focus();
            return;
        }
        if (inputs.refiLoanAmount <= 0) {
            alert('Please enter a valid refinance loan amount.');
            dom.refiLoanAmount.focus();
            return;
        }

        // Run engine
        const results = RefiEngine.runAnalysis(inputs);
        lastResults = results;

        // Display results
        displayResults(results);

        // Build charts
        if (typeof RefiCharts !== 'undefined') {
            RefiCharts.renderAll(results);
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
        const a = r.analysis;

        // Refinance Now metrics
        // If cash-out is active, show the adjusted label
        const savingsCard = document.getElementById('cardMonthlySavings');
        if (r.cashOut.enabled && r.cashOut.debtPayments > 0) {
            savingsCard.querySelector('h3').textContent = 'Adjusted Monthly Savings';
            setText('resultMonthlySavings',
                formatMoney(a.monthlySavingsNow) +
                ' (P&I: ' + formatMoney(a.piSavingsNow) + ' + Debt: ' + formatMoney(a.cashOutDebtPayments) + ')'
            );
        } else {
            savingsCard.querySelector('h3').textContent = 'Monthly P&I Savings';
            setText('resultMonthlySavings', formatMoney(a.monthlySavingsNow));
        }

        setText('resultBreakevenNow', a.breakevenNow === Infinity ? 'N/A' : a.breakevenNow + ' months');
        setText('resultTotalClosingCost', formatMoney(a.closingCosts));
        setText('resultNetSavings', formatMoney(a.refiNowNetSavings));

        // Color-code monthly savings card
        setCardStatus('cardMonthlySavings', a.monthlySavingsNow > 0 ? 'favorable' : 'unfavorable');

        // Color-code breakeven card
        const targetBE = r.inputs.targetBreakeven;
        if (a.breakevenNow === Infinity) {
            setCardStatus('cardBreakevenNow', 'unfavorable');
        } else if (a.breakevenNow <= targetBE) {
            setCardStatus('cardBreakevenNow', 'favorable');
        } else {
            setCardStatus('cardBreakevenNow', 'neutral');
        }

        // Net savings card
        setCardStatus('cardNetSavings', a.refiNowNetSavings > 0 ? 'favorable' : 'unfavorable');

        // Payment comparison
        setText('compareCurrentPayment', formatMoney(r.currentPayment));
        setText('compareNewPayment', formatMoney(r.refiPayment));

        // Cost of waiting metrics (populate even if hidden so PDF can use them)
        setText('resultExtraInterest', formatMoney(a.extraInterest));
        setText('resultFuturePayment', formatMoney(r.futurePayment));
        setText('resultFutureSavings', formatMoney(a.futureMonthlySavings));
        setText('resultBreakevenWait', a.breakevenWait === Infinity ? 'N/A' : a.breakevenWait + ' months');

        setCardStatus('cardExtraInterest', a.extraInterest > 0 ? 'unfavorable' : 'favorable');
        setCardStatus('cardFutureSavings', a.futureMonthlySavings > 0 ? 'favorable' : 'unfavorable');
        if (a.breakevenWait === Infinity) {
            setCardStatus('cardBreakevenWait', 'unfavorable');
        } else if (a.breakevenWait <= targetBE) {
            setCardStatus('cardBreakevenWait', 'favorable');
        } else {
            setCardStatus('cardBreakevenWait', 'neutral');
        }

        // Breakdown cards
        setText('breakdownNowCosts', formatMoney(a.closingCosts));
        setText('breakdownNowSavings', formatMoney(a.monthlySavingsNow) + '/mo');
        setText('breakdownNowBreakeven', a.breakevenNow === Infinity ? 'N/A' : a.breakevenNow + ' mo');
        setText('breakdownNowNet', formatMoney(a.refiNowNetSavings));

        setText('breakdownWaitCosts', formatMoney(a.closingCosts));
        setText('breakdownWaitExtra', formatMoney(a.extraInterest));
        setText('breakdownWaitEffective', formatMoney(a.effectiveTotalCost));
        setText('breakdownWaitSavings', formatMoney(a.futureMonthlySavings) + '/mo');
        setText('breakdownWaitBreakeven', a.breakevenWait === Infinity ? 'N/A' : a.breakevenWait + ' mo');
        setText('breakdownWaitNet', formatMoney(a.waitNetSavings));

        // Difference card
        const diffCard = document.getElementById('differenceCard');
        const diffValue = document.getElementById('resultDifference');
        const diffExplain = document.getElementById('differenceExplain');

        diffValue.textContent = formatMoney(Math.abs(a.netDifference));
        diffCard.classList.remove('positive', 'negative');

        if (a.netDifference > 0) {
            diffCard.classList.add('positive');
            diffValue.textContent = '+' + formatMoney(a.netDifference);
            diffExplain.textContent = `Refinancing NOW saves you ${formatMoney(a.netDifference)} more than waiting over your ${r.inputs.planToStayMonths}-month stay.`;
        } else if (a.netDifference < 0) {
            diffCard.classList.add('negative');
            diffValue.textContent = '-' + formatMoney(Math.abs(a.netDifference));
            diffExplain.textContent = `Waiting and refinancing later saves you ${formatMoney(Math.abs(a.netDifference))} more over your ${r.inputs.planToStayMonths}-month stay.`;
        } else {
            diffExplain.textContent = 'Both scenarios produce the same net savings.';
        }
    }

    // -------------------------------------------------
    // CALCULATION DETAILS (MATH STEPS)
    // -------------------------------------------------

    function buildMathDetails(r) {
        const container = document.getElementById('mathStepsContainer');
        const a = r.analysis;

        let html = '';

        // Current Payment
        html += `
        <div class="math-group">
            <h4>Current Monthly P&I Payment</h4>
            <div class="math-step">
                <div class="step-label">Formula: M = P &times; [r(1+r)<sup>n</sup>] / [(1+r)<sup>n</sup> - 1]</div>
                <div class="step-formula">
                    P = ${formatMoney(r.inputs.currentBalance)} | r = ${r.inputs.currentRate}% / 12 = ${(r.inputs.currentRate / 1200).toFixed(8)} | n = ${r.inputs.currentTermRemaining}
                </div>
                <div class="step-result">= ${formatMoney(r.currentPaymentComputed)}${r.inputs.useManualPayment ? ' (overridden to ' + formatMoney(r.currentPayment) + ')' : ''}</div>
            </div>
        </div>`;

        // Refi Payment
        html += `
        <div class="math-group">
            <h4>Refinance Monthly P&I Payment</h4>
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
                    <div class="step-label">P&I Savings</div>
                    <div class="step-formula">${formatMoney(r.currentPayment)} - ${formatMoney(r.refiPayment)}</div>
                    <div class="step-result">= ${formatMoney(a.piSavingsNow)} per month</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Debt Payments Eliminated (Cash Out)</div>
                    <div class="step-result">= ${formatMoney(r.cashOut.debtPayments)} per month</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Total Adjusted Monthly Savings</div>
                    <div class="step-formula">${formatMoney(a.piSavingsNow)} + ${formatMoney(r.cashOut.debtPayments)}</div>
                    <div class="step-result">= ${formatMoney(a.monthlySavingsNow)} per month</div>
                </div>
            </div>`;
        } else {
            html += `
            <div class="math-group">
                <h4>Monthly Savings (Refinance Now)</h4>
                <div class="math-step">
                    <div class="step-formula">${formatMoney(r.currentPayment)} - ${formatMoney(r.refiPayment)}</div>
                    <div class="step-result">= ${formatMoney(a.monthlySavingsNow)} per month</div>
                </div>
            </div>`;
        }

        // Breakeven Now
        html += `
        <div class="math-group">
            <h4>Breakeven (Refinance Now)</h4>
            <div class="math-step">
                <div class="step-label">Breakeven = Total Closing Costs / Monthly Savings</div>
                <div class="step-formula">${formatMoney(a.closingCosts)} / ${formatMoney(a.monthlySavingsNow)}</div>
                <div class="step-result">= ${a.breakevenNow === Infinity ? 'N/A (no savings)' : a.breakevenNow + ' months'}</div>
            </div>
        </div>`;

        // Cost of Waiting (only if enabled)
        if (r.inputs.costOfWaitingEnabled) {
            html += `
            <div class="math-group">
                <h4>Cost of Waiting Analysis</h4>
                <div class="math-step">
                    <div class="step-label">Extra interest paid while waiting (${a.monthsToWait} months)</div>
                    <div class="step-formula">${formatMoney(a.monthlySavingsNow)} &times; ${a.monthsToWait} months</div>
                    <div class="step-result">= ${formatMoney(a.extraInterest)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Balance after waiting ${a.monthsToWait} months</div>
                    <div class="step-result">= ${formatMoney(a.balanceAfterWait)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Future P&I Payment (${r.inputs.futureRate}% on ${formatMoney(a.balanceAfterWait)})</div>
                    <div class="step-result">= ${formatMoney(r.futurePayment)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Future monthly savings vs current</div>
                    <div class="step-formula">${formatMoney(r.currentPayment)} - ${formatMoney(r.futurePayment)}</div>
                    <div class="step-result">= ${formatMoney(a.futureMonthlySavings)} per month</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Effective total cost if waiting</div>
                    <div class="step-formula">${formatMoney(a.closingCosts)} + ${formatMoney(a.extraInterest)}</div>
                    <div class="step-result">= ${formatMoney(a.effectiveTotalCost)}</div>
                </div>
                <div class="math-step">
                    <div class="step-label">Adjusted breakeven if waiting</div>
                    <div class="step-formula">${formatMoney(a.effectiveTotalCost)} / ${formatMoney(a.futureMonthlySavings)}</div>
                    <div class="step-result">= ${a.breakevenWait === Infinity ? 'N/A (no savings)' : a.breakevenWait + ' months'}</div>
                </div>
            </div>`;
        }

        // Net Savings Comparison
        html += `
        <div class="math-group">
            <h4>Net Savings Comparison (over ${r.inputs.planToStayMonths} months)</h4>
            <div class="math-step">
                <div class="step-label">Refinance Now Net Savings</div>
                <div class="step-formula">(${formatMoney(a.monthlySavingsNow)} &times; ${r.inputs.planToStayMonths}) - ${formatMoney(a.closingCosts)}</div>
                <div class="step-result">= ${formatMoney(a.refiNowNetSavings)}</div>
            </div>`;

        if (r.inputs.costOfWaitingEnabled) {
            html += `
            <div class="math-step">
                <div class="step-label">Wait & Refinance Net Savings</div>
                <div class="step-formula">(${formatMoney(a.futureMonthlySavings)} &times; ${Math.max(0, r.inputs.planToStayMonths - a.monthsToWait)}) - ${formatMoney(a.effectiveTotalCost)}</div>
                <div class="step-result">= ${formatMoney(a.waitNetSavings)}</div>
            </div>
            <div class="math-step">
                <div class="step-label">Difference (Now vs Wait)</div>
                <div class="step-result" style="font-size:1.1rem;">= ${formatMoney(a.netDifference)} ${a.netDifference > 0 ? '(Refinance Now is better)' : a.netDifference < 0 ? '(Waiting is better)' : '(Equal)'}</div>
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

        const rows = [
            { section: true, label: 'Origination Charges' },
            { label: 'Origination Fee / Points', value: fees.feeOrigination },
            { label: 'Underwriting / Processing Fee', value: fees.feeUnderwriting },
            { label: 'Discount Points', value: fees.feeDiscount },
            { label: 'Lender Credit', value: fees.feeLenderCredit },
            { subtotal: true, label: 'Origination Total', value: costs.origination },

            { section: true, label: 'Services Borrower Cannot Shop' },
            { label: 'Appraisal Fee', value: fees.feeAppraisal },
            { label: 'Credit Report Fee', value: fees.feeCreditReport },
            { label: 'Flood Certification', value: fees.feeFloodCert },
            { label: 'MERS Registration Fee', value: fees.feeMERS },
            { label: 'Tax Related Service Fee', value: fees.feeTaxService },
            { label: 'Technology Fee', value: fees.feeTechnology },
            { label: 'Verification of Employment Fee', value: fees.feeVOE },
            { label: 'Verification of Tax Return Fee', value: fees.feeVOT },
            { subtotal: true, label: 'Cannot Shop Total', value: costs.cannotShop },

            { section: true, label: 'Services Borrower Can Shop For' },
            { label: 'E-Recording Fee', value: fees.feeERecording },
            { label: 'Title - Closing Protection Letter Fee', value: fees.feeTitleCPL },
            { label: 'Title - Lenders Coverage Premium', value: fees.feeTitleLenders },
            { label: 'Title - Settlement Fee', value: fees.feeTitleSettlement },
            { label: 'Title - Tax Cert Fee', value: fees.feeTitleTaxCert },
            { subtotal: true, label: 'Can Shop Total', value: costs.canShop },

            { section: true, label: 'Taxes & Government Fees' },
            { label: 'Recording Fee for Deed', value: fees.feeRecording },
            { subtotal: true, label: 'Government Fees Total', value: costs.govFees },

            { section: true, label: 'Other' },
            { label: 'Other Fees', value: fees.feeOther },

            { grand: true, label: 'Total Closing Costs (for Breakeven)', value: costs.totalBreakeven },

            { section: true, label: 'Excluded from Breakeven', excluded: true },
            { label: 'Prepaid Interest', value: costs.prepaids, excluded: true },
            { label: 'Escrow - Property Tax', value: fees.feeEscrowTax, excluded: true },
            { label: 'Escrow - Hazard Insurance', value: fees.feeEscrowInsurance, excluded: true },
            { subtotal: true, label: 'Total Prepaids & Escrow', value: RefiEngine.round2(costs.prepaids + costs.escrow), excluded: true },

            { grand: true, label: 'Total All Closing Costs', value: costs.totalAll },
        ];

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

        // Refi
        dom.refiLoanAmount.value = 485000;
        dom.refiRate.value = 5.750;
        dom.refiTerm.value = 360;
        dom.refiProduct.value = 'Conv30Year';

        // Cash Out
        dom.cashOutToggle.checked = false;
        dom.cashOutFields.style.display = 'none';
        dom.cashOutAmount.value = 0;
        dom.cashOutDebtPayments.value = 0;
        // Reset debt rows to a single empty row
        dom.debtRows.innerHTML = `
            <div class="debt-row input-row">
                <input type="text" id="debtName1" placeholder="Debt description" style="flex:2; min-width:150px;">
                <div class="input-group" style="flex:1;">
                    <label style="font-size:0.75rem;">Balance</label>
                    <input type="number" class="debt-balance" value="0" min="0" step="100">
                </div>
                <div class="input-group" style="flex:1;">
                    <label style="font-size:0.75rem;">Monthly Pmt</label>
                    <input type="number" class="debt-payment" value="0" min="0" step="1">
                </div>
                <div class="input-group" style="flex:0.7;">
                    <label style="font-size:0.75rem;">Rate %</label>
                    <input type="number" class="debt-rate" value="0" min="0" max="40" step="0.1">
                </div>
            </div>`;
        debtRowCount = 1;

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
