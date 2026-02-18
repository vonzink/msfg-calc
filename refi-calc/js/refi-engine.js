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
    // CLOSING COSTS AGGREGATION
    // -------------------------------------------------

    /**
     * Given the individual fee values, compute category totals
     * and the breakeven-eligible total (excluding prepaids & escrow).
     *
     * @param {object} fees - All fee field values keyed by field id
     * @returns {object} { origination, cannotShop, canShop, govFees,
     *                      prepaids, escrow, other,
     *                      totalBreakeven, totalAll }
     */
    function calcClosingCosts(fees) {
        const origination = round2(
            (fees.feeOrigination || 0) +
            (fees.feeUnderwriting || 0) +
            (fees.feeDiscount || 0) +
            (fees.feeLenderCredit || 0)   // negative reduces total
        );

        const cannotShop = round2(
            (fees.feeAppraisal || 0) +
            (fees.feeCreditReport || 0) +
            (fees.feeFloodCert || 0) +
            (fees.feeMERS || 0) +
            (fees.feeTaxService || 0) +
            (fees.feeTechnology || 0) +
            (fees.feeVOE || 0) +
            (fees.feeVOT || 0)
        );

        const canShop = round2(
            (fees.feeERecording || 0) +
            (fees.feeTitleCPL || 0) +
            (fees.feeTitleLenders || 0) +
            (fees.feeTitleSettlement || 0) +
            (fees.feeTitleTaxCert || 0)
        );

        const govFees = round2(fees.feeRecording || 0);

        const prepaids = round2(fees.feePrepaidInterest || 0);

        const escrow = round2(
            (fees.feeEscrowTax || 0) +
            (fees.feeEscrowInsurance || 0)
        );

        const other = round2(fees.feeOther || 0);

        // Upfront MI / Funding Fee (included in breakeven)
        const upfrontMI = round2(fees.feeUpfrontMI || 0);

        // Monthly MI (tracked separately, not part of closing cost totals)
        const monthlyMI = round2(fees.feeMonthlyMI || 0);

        // Breakeven-eligible: everything EXCEPT prepaids and escrow
        const totalBreakeven = round2(origination + cannotShop + canShop + govFees + other + upfrontMI);

        // Grand total of all costs
        const totalAll = round2(totalBreakeven + prepaids + escrow);

        return {
            origination,
            cannotShop,
            canShop,
            govFees,
            prepaids,
            escrow,
            other,
            upfrontMI,
            monthlyMI,
            totalBreakeven,
            totalAll
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
            cashOutDebtPayments = 0
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

        // 5. Future payment at the future rate on the remaining balance
        //    We use the same loan term (refiTerm) for the future refinance
        //    Note: for the wait scenario, the cash-out amount would also need to be
        //    added to the future balance, but we assume same loan amount structure.
        const futurePayment = calcMonthlyPayment(balanceAfterWait, futureRate, refiTerm);
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
            futurePayment,
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
            cashOutDebtPayments = 0
        } = params;

        // Phase 1: savings from first refi during the waiting period
        const piSavingsPhase1 = round2(currentPayment - refiNowPayment);
        const monthlySavingsPhase1 = round2(piSavingsPhase1 + cashOutDebtPayments);

        // Balance on first refi after monthsToWait payments
        const balanceAtSecondRefi = calcRemainingBalance(
            refiLoanAmount, refiRate, refiTerm, monthsToWait
        );

        // Phase 2: second refi at future rate on remaining balance, fresh term
        const secondRefiPayment = calcMonthlyPayment(balanceAtSecondRefi, futureRate, refiTerm);
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
        // Current payment
        const currentPaymentComputed = calcMonthlyPayment(
            inputs.currentBalance,
            inputs.currentRate,
            inputs.currentTermRemaining
        );

        const currentPayment = inputs.useManualPayment
            ? inputs.currentPaymentManual
            : currentPaymentComputed;

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
        const currentMonthlyMI = (inputs.currentMIMonthlyDollar !== undefined)
            ? inputs.currentMIMonthlyDollar : 0;
        const refiMonthlyMI = inputs.fees
            ? (inputs.fees.feeMonthlyMI || 0) : 0;

        // Cost of Waiting enabled flag (defaults to true for backward compat)
        const costOfWaitingEnabled = inputs.costOfWaitingEnabled !== undefined
            ? inputs.costOfWaitingEnabled
            : true;

        // Cost of waiting analysis — cashOutDebtPayments is passed through
        // to be factored into the monthly savings calculation
        const analysis = calcCostOfWaiting({
            currentBalance: inputs.currentBalance,
            currentRate: inputs.currentRate,
            currentTermRemaining: inputs.currentTermRemaining,
            currentPayment,
            refiNowPayment: refiPayment,
            refiLoanAmount: inputs.refiLoanAmount,
            refiRate: inputs.refiRate,
            refiTerm: inputs.refiTerm,
            futureRate: costOfWaitingEnabled ? inputs.futureRate : inputs.refiRate,
            monthsToWait: costOfWaitingEnabled ? inputs.monthsToWait : 0,
            closingCosts: costs.totalBreakeven,
            planToStayMonths: inputs.planToStayMonths,
            cashOutDebtPayments
        });

        // Future payment (for display)
        const futureBalance = analysis.balanceAfterWait;
        const futurePayment = analysis.futurePayment;

        // Double Refi analysis (refi now, then refi again when rates drop)
        let doubleRefi = null;
        if (costOfWaitingEnabled && inputs.monthsToWait > 0) {
            doubleRefi = calcDoubleRefi({
                currentPayment,
                refiLoanAmount: inputs.refiLoanAmount,
                refiRate: inputs.refiRate,
                refiTerm: inputs.refiTerm,
                refiNowPayment: refiPayment,
                futureRate: inputs.futureRate,
                monthsToWait: inputs.monthsToWait,
                closingCosts: costs.totalBreakeven,
                planToStayMonths: inputs.planToStayMonths,
                cashOutDebtPayments
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
            inputs // pass through for reference
        };
    }

    // -------------------------------------------------
    // PUBLIC API
    // -------------------------------------------------

    return {
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
