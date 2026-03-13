/* =====================================================
   REFI ENGINE — Core Calculation Module
   Mountain State Financial Group

   Pure functions for mortgage math. No DOM access.
   All monetary values in dollars, rates as decimals
   internally (e.g., 5.75% → 0.0575).
   ===================================================== */

const RefiEngine = (() => {
    'use strict';

    // -------------------------------------------------
    // UTILITY HELPERS
    // -------------------------------------------------

    /**
     * Convert annual rate percentage to monthly decimal rate.
     * @param {number} annualPct - e.g. 5.75
     * @returns {number} monthly rate, e.g. 0.004791667
     */
    function monthlyRate(annualPct) {
        return (annualPct / 100) / 12;
    }

    /**
     * Round to 2 decimal places (money).
     */
    function round2(val) {
        return Math.round(val * 100) / 100;
    }

    // -------------------------------------------------
    // MONTHLY P&I PAYMENT
    // -------------------------------------------------

    /**
     * Standard amortization payment formula.
     * M = P * [ r(1+r)^n ] / [ (1+r)^n - 1 ]
     *
     * @param {number} principal  - Loan amount
     * @param {number} annualPct  - Annual interest rate as %
     * @param {number} termMonths - Total loan term in months
     * @returns {number} Monthly P&I payment
     */
    function calcMonthlyPayment(principal, annualPct, termMonths) {
        if (principal <= 0 || termMonths <= 0) return 0;
        if (annualPct <= 0) return round2(principal / termMonths);

        const r = monthlyRate(annualPct);
        const factor = Math.pow(1 + r, termMonths);
        return round2(principal * (r * factor) / (factor - 1));
    }

    // -------------------------------------------------
    // FEE CONFIGURATION — Single source of truth
    // -------------------------------------------------

    const FEE_CONFIG = [
        // Origination Charges
        { group: 'origination', id: 'feeOrigination', label: 'Origination Fee / Points' },
        { group: 'origination', id: 'feeUnderwriting', label: 'Underwriting / Processing Fee' },
        { group: 'origination', id: 'feeDiscount', label: 'Discount Points' },
        { group: 'origination', id: 'feeLenderCredit', label: 'Lender Credit' },

        // Services Borrower Cannot Shop
        { group: 'cannotShop', id: 'feeAppraisal', label: 'Appraisal Fee' },
        { group: 'cannotShop', id: 'feeCreditReport', label: 'Credit Report Fee' },
        { group: 'cannotShop', id: 'feeFloodCert', label: 'Flood Certification' },
        { group: 'cannotShop', id: 'feeMERS', label: 'MERS Registration Fee' },
        { group: 'cannotShop', id: 'feeTaxService', label: 'Tax Related Service Fee' },
        { group: 'cannotShop', id: 'feeTechnology', label: 'Technology Fee' },
        { group: 'cannotShop', id: 'feeVOE', label: 'Verification of Employment Fee' },
        { group: 'cannotShop', id: 'feeVOT', label: 'Verification of Tax Return Fee' },

        // Services Borrower Can Shop For
        { group: 'canShop', id: 'feeERecording', label: 'E-Recording Fee' },
        { group: 'canShop', id: 'feeTitleCPL', label: 'Title - Closing Protection Letter Fee' },
        { group: 'canShop', id: 'feeTitleLenders', label: 'Title - Lenders Coverage Premium' },
        { group: 'canShop', id: 'feeTitleSettlement', label: 'Title - Settlement Fee' },
        { group: 'canShop', id: 'feeTitleTaxCert', label: 'Title - Tax Cert Fee' },

        // Taxes & Government Fees
        { group: 'govFees', id: 'feeRecording', label: 'Recording Fee for Deed' },

        // Prepaids (excluded from breakeven)
        { group: 'prepaids', id: 'feePrepaidInterest', label: 'Prepaid Interest', excludeFromBreakeven: true },

        // Initial Escrow (excluded from breakeven)
        { group: 'escrow', id: 'feeEscrowTax', label: 'County Property Tax', excludeFromBreakeven: true },
        { group: 'escrow', id: 'feeEscrowInsurance', label: 'Hazard Insurance', excludeFromBreakeven: true },

        // Mortgage Insurance / Funding Fees
        { group: 'mi', id: 'feeUpfrontMI', label: 'Upfront MI / Funding Fee' },
        { group: 'mi', id: 'feeMonthlyMI', label: 'Monthly MI', monthlySeparate: true },

        // Other
        { group: 'other', id: 'feeOther', label: 'Other Fees' }
    ];

    // -------------------------------------------------
    // CLOSING COSTS AGGREGATION
    // -------------------------------------------------

    /**
     * Given the individual fee values, compute category totals
     * and the breakeven-eligible total (excluding prepaids & escrow).
     * Grouping is driven by FEE_CONFIG.
     *
     * @param {object} fees - All fee field values keyed by field id
     * @returns {object} { origination, cannotShop, canShop, govFees,
     *                      prepaids, escrow, other, upfrontMI, monthlyMI,
     *                      totalBreakeven, totalAll }
     */
    function calcClosingCosts(fees) {
        // Sum fees by group from FEE_CONFIG
        const sums = {};
        FEE_CONFIG.forEach(item => {
            if (item.monthlySeparate) return;
            if (!sums[item.group]) sums[item.group] = 0;
            sums[item.group] += (fees[item.id] || 0);
        });

        const origination = round2(sums.origination || 0);
        const cannotShop  = round2(sums.cannotShop || 0);
        const canShop     = round2(sums.canShop || 0);
        const govFees     = round2(sums.govFees || 0);
        const prepaids    = round2(sums.prepaids || 0);
        const escrow      = round2(sums.escrow || 0);
        const other       = round2(sums.other || 0);
        const upfrontMI   = round2(sums.mi || 0);
        const monthlyMI   = round2(fees.feeMonthlyMI || 0);

        // Breakeven-eligible: everything EXCEPT prepaids and escrow
        const totalBreakeven = round2(origination + cannotShop + canShop + govFees + other + upfrontMI);
        const totalAll = round2(totalBreakeven + prepaids + escrow);

        return {
            origination, cannotShop, canShop, govFees,
            prepaids, escrow, other, upfrontMI, monthlyMI,
            totalBreakeven, totalAll
        };
    }

    // -------------------------------------------------
    // BREAKEVEN — REFINANCE NOW
    // -------------------------------------------------

    /**
     * Simple breakeven: months to recoup closing costs via monthly savings.
     * breakeven = closingCosts / monthlySavings
     *
     * @param {number} closingCosts   - Breakeven-eligible total
     * @param {number} monthlySavings - Positive = saving money
     * @returns {number} Breakeven in months (Infinity if no savings)
     */
    function calcBreakevenNow(closingCosts, monthlySavings) {
        if (monthlySavings <= 0) return Infinity;
        return Math.ceil(closingCosts / monthlySavings);
    }

    // -------------------------------------------------
    // COST OF WAITING
    // -------------------------------------------------

    /**
     * Calculate the cost of waiting for a future rate.
     *
     * Logic:
     * 1. During the waiting period, borrower keeps paying at current rate.
     *    If they had refinanced NOW, they'd pay at the refi rate.
     *    The difference per month is the "extra interest cost" of waiting.
     *    extraInterest = (currentPayment - refiNowPayment) * monthsToWait
     *
     * 2. After waiting, they refinance at the future rate.
     *    New balance = currentBalance after X more months of current payments.
     *    futurePayment = payment on that new balance at future rate.
     *
     * 3. Effective total cost if waiting:
     *    = closingCosts + extraInterest
     *
     * 4. Future monthly savings = currentPayment - futurePayment
     *
     * 5. Adjusted breakeven = effectiveTotalCost / futureMonthlySavings
     *
     * @param {object} params
     * @returns {object}
     */
    function calcCostOfWaiting(params) {
        const {
            currentBalance,
            currentRate,
            currentTermRemaining,
            currentPayment,
            refiNowPayment,
            refiLoanAmount,
            refiRate,
            refiTerm,
            futureRate,
            monthsToWait,
            closingCosts,
            planToStayMonths,
            cashOutDebtPayments = 0,
            futureMI = 0
        } = params;

        // 1. P&I savings (before cash-out adjustments)
        const piSavingsNow = round2(currentPayment - refiNowPayment);

        // 2. Total monthly savings including eliminated debt payments (cash-out)
        //    If borrower is paying off debts via cash-out, those eliminated payments
        //    are added to the effective monthly savings.
        const monthlySavingsNow = round2(piSavingsNow + cashOutDebtPayments);

        // 3. Extra interest paid while waiting
        //    = total monthly savings foregone each month while waiting
        const extraInterest = round2(Math.max(0, monthlySavingsNow) * monthsToWait);

        // 4. Compute remaining balance after waiting period
        //    (borrower continues paying current loan for monthsToWait months)
        const balanceAfterWait = calcRemainingBalance(
            currentBalance,
            currentRate,
            currentTermRemaining,
            monthsToWait
        );

        // 5. Future payment at the future rate on the remaining balance.
        //    DESIGN NOTE: Both "refi now" and "wait & refi" use the full refiTerm
        //    (e.g., 360 months) because refinancing creates a NEW loan with its own
        //    full term — you don't get a shorter loan just because you waited.
        //    The timing difference is handled in the net savings comparison: the
        //    "wait" scenario only earns savings for (planToStayMonths - monthsToWait)
        //    months, while "refi now" earns for the full planToStayMonths.
        const futurePIPayment = calcMonthlyPayment(balanceAfterWait, futureRate, refiTerm);
        const futurePayment = round2(futurePIPayment + futureMI);
        const piSavingsWait = round2(currentPayment - futurePayment);
        const futureMonthlySavings = round2(piSavingsWait + cashOutDebtPayments);

        // 6. Effective total cost of waiting = closing costs + extra interest
        const effectiveTotalCost = round2(closingCosts + extraInterest);

        // 7. Breakeven if you wait
        const breakevenWait = futureMonthlySavings > 0
            ? Math.ceil(effectiveTotalCost / futureMonthlySavings)
            : Infinity;

        // 8. Net savings comparison over the plan-to-stay period
        //    Refinance NOW net savings:
        const refiNowMonthsOfSavings = Math.max(0, planToStayMonths);
        const refiNowTotalSavings = round2(monthlySavingsNow * refiNowMonthsOfSavings);
        const refiNowNetSavings = round2(refiNowTotalSavings - closingCosts);

        //    Wait & Refinance net savings:
        //    After waiting, you save for (planToStayMonths - monthsToWait) months
        const waitSavingsMonths = Math.max(0, planToStayMonths - monthsToWait);
        const waitTotalSavings = round2(futureMonthlySavings * waitSavingsMonths);
        const waitNetSavings = round2(waitTotalSavings - effectiveTotalCost);

        // 9. Difference: positive means "refinance now is better"
        const netDifference = round2(refiNowNetSavings - waitNetSavings);

        return {
            piSavingsNow,
            monthlySavingsNow,
            cashOutDebtPayments,
            extraInterest,
            balanceAfterWait: round2(balanceAfterWait),
            futurePIPayment,
            futurePayment,
            futureMI,
            piSavingsWait,
            futureMonthlySavings,
            effectiveTotalCost,
            breakevenNow: calcBreakevenNow(closingCosts, monthlySavingsNow),
            breakevenWait,
            refiNowTotalSavings,
            refiNowNetSavings,
            waitTotalSavings,
            waitNetSavings,
            netDifference,
            // Pass through for display
            closingCosts,
            monthsToWait,
            planToStayMonths
        };
    }

    // -------------------------------------------------
    // DOUBLE REFI — REFI NOW, THEN REFI AGAIN
    // -------------------------------------------------

    /**
     * Calculate the scenario where the borrower refinances NOW,
     * then refinances AGAIN when rates drop to the future rate.
     *
     * Phase 1: Refi at current offered rate for monthsToWait months
     * Phase 2: Refi again at futureRate on remaining balance
     * Cost: Two sets of closing costs
     *
     * @param {object} params
     * @returns {object}
     */
    function calcDoubleRefi(params) {
        const {
            currentPayment,
            refiLoanAmount,
            refiRate,
            refiTerm,
            refiNowPayment,
            futureRate,
            monthsToWait,
            closingCosts,
            planToStayMonths,
            cashOutDebtPayments = 0,
            futureMI = 0
        } = params;

        // Phase 1: savings from first refi during the waiting period
        const piSavingsPhase1 = round2(currentPayment - refiNowPayment);
        const monthlySavingsPhase1 = round2(piSavingsPhase1 + cashOutDebtPayments);

        // Balance on first refi after monthsToWait payments
        const balanceAtSecondRefi = calcRemainingBalance(
            refiLoanAmount, refiRate, refiTerm, monthsToWait
        );

        // Phase 2: second refi at future rate on remaining balance, fresh term
        // Include future MI in the second refi payment
        const secondRefiPIPayment = calcMonthlyPayment(balanceAtSecondRefi, futureRate, refiTerm);
        const secondRefiPayment = round2(secondRefiPIPayment + futureMI);
        const piSavingsPhase2 = round2(currentPayment - secondRefiPayment);
        const monthlySavingsPhase2 = round2(piSavingsPhase2 + cashOutDebtPayments);

        // Time in each phase
        const phase1Months = monthsToWait;
        const phase2Months = Math.max(0, planToStayMonths - monthsToWait);

        // Total costs: two sets of closing costs
        const totalCosts = round2(closingCosts * 2);

        // Total savings
        const phase1Savings = round2(monthlySavingsPhase1 * phase1Months);
        const phase2Savings = round2(monthlySavingsPhase2 * phase2Months);
        const totalSavings = round2(phase1Savings + phase2Savings);

        // Net savings
        const netSavings = round2(totalSavings - totalCosts);

        // Month-by-month breakeven (accounts for two cost events)
        let cumulative = -closingCosts; // first refi costs at month 0
        let breakevenMonth = Infinity;

        for (let m = 1; m <= planToStayMonths; m++) {
            if (m <= monthsToWait) {
                cumulative += monthlySavingsPhase1;
            } else if (m === monthsToWait + 1) {
                // Second refi costs hit at start of phase 2
                cumulative -= closingCosts;
                cumulative += monthlySavingsPhase2;
            } else {
                cumulative += monthlySavingsPhase2;
            }

            if (cumulative >= 0 && breakevenMonth === Infinity) {
                breakevenMonth = m;
            }
        }

        return {
            balanceAtSecondRefi: round2(balanceAtSecondRefi),
            secondRefiPayment,
            piSavingsPhase1,
            monthlySavingsPhase1,
            piSavingsPhase2,
            monthlySavingsPhase2,
            phase1Months,
            phase2Months,
            phase1Savings,
            phase2Savings,
            firstRefiCosts: closingCosts,
            secondRefiCosts: closingCosts,
            totalCosts,
            totalSavings,
            netSavings,
            breakevenMonth
        };
    }

    /**
     * Build cumulative savings timeline for the double refi scenario.
     * Used to add a third line on the breakeven chart.
     *
     * @param {object} doubleRefi - Output from calcDoubleRefi
     * @param {number} maxMonths  - How many months to project
     * @returns {number[]} cumulative savings array
     */
    function buildDoubleRefiTimeline(doubleRefi, maxMonths) {
        const timeline = [];
        let cumulative = -doubleRefi.firstRefiCosts;

        for (let m = 0; m <= maxMonths; m++) {
            if (m === 0) {
                timeline.push(round2(cumulative));
                continue;
            }

            if (m <= doubleRefi.phase1Months) {
                cumulative += doubleRefi.monthlySavingsPhase1;
            } else if (m === doubleRefi.phase1Months + 1) {
                cumulative -= doubleRefi.secondRefiCosts;
                cumulative += doubleRefi.monthlySavingsPhase2;
            } else {
                cumulative += doubleRefi.monthlySavingsPhase2;
            }

            timeline.push(round2(cumulative));
        }

        return timeline;
    }

    // -------------------------------------------------
    // REMAINING BALANCE AFTER N PAYMENTS
    // -------------------------------------------------

    /**
     * Compute the remaining loan balance after `n` payments.
     * B_n = P * [(1+r)^N - (1+r)^n] / [(1+r)^N - 1]
     */
    function calcRemainingBalance(principal, annualPct, totalTermMonths, paymentsAlreadyMade) {
        if (annualPct <= 0) {
            const pmt = principal / totalTermMonths;
            return Math.max(0, principal - pmt * paymentsAlreadyMade);
        }

        const r = monthlyRate(annualPct);
        const N = totalTermMonths;
        const n = paymentsAlreadyMade;
        const factorN = Math.pow(1 + r, N);
        const factorNn = Math.pow(1 + r, n);
        return Math.max(0, principal * (factorN - factorNn) / (factorN - 1));
    }

    // -------------------------------------------------
    // AMORTIZATION SCHEDULE (partial, for charts)
    // -------------------------------------------------

    /**
     * Generate month-by-month amortization for the first `months` payments.
     * Returns array of { month, payment, principal, interest, balance }.
     */
    function generateAmortization(loanAmount, annualPct, termMonths, months) {
        const schedule = [];
        const r = monthlyRate(annualPct);
        const payment = calcMonthlyPayment(loanAmount, annualPct, termMonths);
        let balance = loanAmount;

        const limit = Math.min(months || 60, termMonths);

        for (let m = 1; m <= limit; m++) {
            const interest = round2(balance * r);
            const principalPaid = round2(payment - interest);
            balance = round2(Math.max(0, balance - principalPaid));
            schedule.push({
                month: m,
                payment,
                principal: principalPaid,
                interest,
                balance
            });
        }

        return schedule;
    }

    // -------------------------------------------------
    // CUMULATIVE SAVINGS TIMELINE (for breakeven chart)
    // -------------------------------------------------

    /**
     * Build month-by-month cumulative savings arrays for both scenarios.
     * Used for the breakeven timeline chart.
     *
     * @param {object} results - Output from calcCostOfWaiting
     * @param {number} maxMonths - How many months to project
     * @returns {object} { labels, refiNowCumulative, waitCumulative }
     */
    function buildSavingsTimeline(results, maxMonths) {
        const labels = [];
        const refiNowCumulative = [];
        const waitCumulative = [];

        // Guard against Infinity to prevent infinite loop
        const beNow = (results.breakevenNow === Infinity) ? 60 : results.breakevenNow;
        const beWait = (results.breakevenWait === Infinity) ? 60 : results.breakevenWait;
        const max = maxMonths || Math.min(Math.max(beNow, beWait, 60) + 12, 360);

        for (let m = 0; m <= max; m++) {
            labels.push(m);

            // Refinance NOW: start saving immediately but subtract closing costs
            const nowCum = round2((results.monthlySavingsNow * m) - results.closingCosts);
            refiNowCumulative.push(nowCum);

            // WAIT scenario:
            //   During waiting period (months 0 to monthsToWait): no savings,
            //     plus losing money (extra interest accumulates)
            //   After waiting period: saving at future rate but subtract effective total cost
            if (m <= results.monthsToWait) {
                // During waiting: no refi has happened yet.
                // Net position = 0 savings accumulated, minus closing costs that will be owed.
                // The opportunity cost (savings foregone) is captured in the "extra interest" metric.
                waitCumulative.push(round2(-results.effectiveTotalCost));
            } else {
                const monthsSinceRefi = m - results.monthsToWait;
                const waitCum = round2(
                    (results.futureMonthlySavings * monthsSinceRefi) - results.effectiveTotalCost
                );
                waitCumulative.push(waitCum);
            }
        }

        return { labels, refiNowCumulative, waitCumulative };
    }

    // -------------------------------------------------
    // FULL ANALYSIS (orchestrator)
    // -------------------------------------------------

    /**
     * Run the complete analysis. Called by the UI layer.
     *
     * @param {object} inputs - All form values
     * @returns {object} Complete results package
     */
    function runAnalysis(inputs) {
        // --- Input validation ---
        const errors = [];
        if (!inputs.currentBalance || inputs.currentBalance <= 0)
            errors.push('Current loan balance must be greater than zero.');
        if (inputs.currentRate === undefined || inputs.currentRate <= 0 || inputs.currentRate >= 30)
            errors.push('Current interest rate must be between 0% and 30%.');
        if (!inputs.currentTermRemaining || inputs.currentTermRemaining <= 0)
            errors.push('Remaining term must be greater than zero.');
        if (!inputs.refiLoanAmount || inputs.refiLoanAmount <= 0)
            errors.push('Refinance loan amount must be greater than zero.');
        if (inputs.refiRate === undefined || inputs.refiRate <= 0 || inputs.refiRate >= 30)
            errors.push('Refinance interest rate must be between 0% and 30%.');
        if (!inputs.refiTerm || inputs.refiTerm <= 0)
            errors.push('Refinance loan term must be greater than zero.');
        if (!inputs.planToStayMonths || inputs.planToStayMonths <= 0)
            errors.push('Plan-to-stay period must be greater than zero.');
        if (inputs.costOfWaitingEnabled) {
            if (inputs.futureRate === undefined || inputs.futureRate <= 0 || inputs.futureRate >= 30)
                errors.push('Future interest rate must be between 0% and 30%.');
            if (!inputs.monthsToWait || inputs.monthsToWait <= 0)
                errors.push('Months to wait must be greater than zero.');
        }
        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // Current payment
        const currentPaymentComputed = calcMonthlyPayment(
            inputs.currentBalance,
            inputs.currentRate,
            inputs.currentTermRemaining
        );

        // When full payment override is active, the user's value includes P&I + T&I + MI.
        // Strip out escrow (T&I) so the engine compares P&I+MI vs P&I+MI.
        // Escrow is the same on both sides and doesn't affect savings/breakeven.
        const currentPayment = inputs.useManualFullPayment
            ? round2(inputs.currentFullPaymentManual - (inputs.monthlyEscrow || 0))
            : (inputs.useManualPayment ? inputs.currentPaymentManual : currentPaymentComputed);

        // Refi payment
        const refiPayment = calcMonthlyPayment(
            inputs.refiLoanAmount,
            inputs.refiRate,
            inputs.refiTerm
        );

        // Cash out: debt payments being eliminated
        const cashOutEnabled = inputs.cashOutEnabled || false;
        const cashOutAmount = cashOutEnabled ? (inputs.cashOutAmount || 0) : 0;
        const cashOutDebtPayments = cashOutEnabled ? (inputs.cashOutDebtPayments || 0) : 0;
        const cashOutDebts = cashOutEnabled ? (inputs.cashOutDebts || []) : [];

        // MI calculations
        const currentLoanType = inputs.currentLoanType || 'Conventional';
        const refiLoanType = inputs.refiLoanType || 'Conventional';
        let currentMI = { monthlyMI: 0, upfront: 0, ltv: 0, hasMI: false, note: '' };
        let refiMI = { monthlyMI: 0, upfront: 0, ltv: 0, hasMI: false, note: '' };

        if (typeof RefiMI !== 'undefined') {
            currentMI = RefiMI.calcMI(currentLoanType, inputs.currentBalance, inputs.currentPropertyValue, inputs.currentTermRemaining);
            refiMI = RefiMI.calcMI(refiLoanType, inputs.refiLoanAmount, inputs.currentPropertyValue, inputs.refiTerm);
        }

        // Closing costs
        const costs = calcClosingCosts(inputs.fees);

        // MI values: use ONLY what the user entered. Auto-calc is hint-only.
        // User input of 0 means 0 MI — no fallback to auto-calculated values.
        // When full payment override is active, current MI is already included
        // in the user's manually entered total — don't double-count it.
        const currentMonthlyMI = inputs.useManualFullPayment
            ? 0
            : ((inputs.currentMIMonthlyDollar !== undefined) ? inputs.currentMIMonthlyDollar : 0);
        const refiMonthlyMI = inputs.fees
            ? (inputs.fees.feeMonthlyMI || 0) : 0;

        // Cost of Waiting enabled flag (defaults to true for backward compat)
        const costOfWaitingEnabled = inputs.costOfWaitingEnabled !== undefined
            ? inputs.costOfWaitingEnabled
            : true;

        // Include user-entered MI in the effective payments for savings/breakeven.
        // MI difference affects monthly savings: if current MI > refi MI, that's
        // additional savings; if refi MI > current MI, that's additional cost.
        const currentPaymentWithMI = round2(currentPayment + currentMonthlyMI);
        const refiPaymentWithMI = round2(refiPayment + refiMonthlyMI);

        // Future MI: user-entered MI for the future/wait refinance scenario
        const futureMI = costOfWaitingEnabled
            ? (inputs.futureMIDollar || 0) : 0;

        // Cost of waiting analysis — cashOutDebtPayments is passed through
        // to be factored into the monthly savings calculation
        const analysis = calcCostOfWaiting({
            currentBalance: inputs.currentBalance,
            currentRate: inputs.currentRate,
            currentTermRemaining: inputs.currentTermRemaining,
            currentPayment: currentPaymentWithMI,
            refiNowPayment: refiPaymentWithMI,
            refiLoanAmount: inputs.refiLoanAmount,
            refiRate: inputs.refiRate,
            refiTerm: inputs.refiTerm,
            futureRate: costOfWaitingEnabled ? inputs.futureRate : inputs.refiRate,
            monthsToWait: costOfWaitingEnabled ? inputs.monthsToWait : 0,
            closingCosts: costs.totalBreakeven,
            planToStayMonths: inputs.planToStayMonths,
            cashOutDebtPayments,
            futureMI
        });

        // Future payment (for display)
        const futureBalance = analysis.balanceAfterWait;
        const futurePayment = analysis.futurePayment;

        // Double Refi analysis (refi now, then refi again when rates drop)
        let doubleRefi = null;
        if (costOfWaitingEnabled && inputs.monthsToWait > 0) {
            doubleRefi = calcDoubleRefi({
                currentPayment: currentPaymentWithMI,
                refiLoanAmount: inputs.refiLoanAmount,
                refiRate: inputs.refiRate,
                refiTerm: inputs.refiTerm,
                refiNowPayment: refiPaymentWithMI,
                futureRate: inputs.futureRate,
                monthsToWait: inputs.monthsToWait,
                closingCosts: costs.totalBreakeven,
                planToStayMonths: inputs.planToStayMonths,
                cashOutDebtPayments,
                futureMI
            });
        }

        // Savings timeline for charts
        const chartMax = Math.min(
            Math.max(
                (analysis.breakevenNow === Infinity ? 60 : analysis.breakevenNow),
                (costOfWaitingEnabled && analysis.breakevenWait !== Infinity ? analysis.breakevenWait : 60),
                (doubleRefi && doubleRefi.breakevenMonth !== Infinity ? doubleRefi.breakevenMonth : 60),
                60
            ) + 24,
            inputs.planToStayMonths + 12
        );
        const timeline = buildSavingsTimeline(analysis, chartMax);

        // Double refi timeline for chart
        const doubleRefiTimeline = doubleRefi
            ? buildDoubleRefiTimeline(doubleRefi, chartMax)
            : null;

        // Amortization for first 60 months — all scenarios
        const amortCurrent = generateAmortization(
            inputs.currentBalance, inputs.currentRate, inputs.currentTermRemaining, 60
        );
        const amortRefi = generateAmortization(
            inputs.refiLoanAmount, inputs.refiRate, inputs.refiTerm, 60
        );
        const amortFuture = costOfWaitingEnabled
            ? generateAmortization(futureBalance, inputs.futureRate, inputs.refiTerm, 60)
            : generateAmortization(inputs.refiLoanAmount, inputs.refiRate, inputs.refiTerm, 60);

        return {
            valid: true,
            currentPaymentComputed,
            currentPayment,
            refiPayment,
            futurePayment,
            futureBalance,
            costs,
            analysis,
            doubleRefi,
            timeline,
            doubleRefiTimeline,
            amortization: {
                current: amortCurrent,
                refi: amortRefi,
                future: amortFuture
            },
            cashOut: {
                enabled: cashOutEnabled,
                amount: cashOutAmount,
                debtPayments: cashOutDebtPayments,
                debts: cashOutDebts
            },
            currentMI,
            refiMI,
            currentMonthlyMI,
            refiMonthlyMI,
            futureMI,
            inputs // pass through for reference
        };
    }

    // -------------------------------------------------
    // PUBLIC API
    // -------------------------------------------------

    return {
        FEE_CONFIG,
        calcMonthlyPayment,
        calcClosingCosts,
        calcBreakevenNow,
        calcCostOfWaiting,
        calcDoubleRefi,
        calcRemainingBalance,
        generateAmortization,
        buildSavingsTimeline,
        buildDoubleRefiTimeline,
        runAnalysis,
        // Utility
        monthlyRate,
        round2
    };

})();
