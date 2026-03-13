/* =====================================================
   REFI MI — Mortgage Insurance Calculations
   Mountain State Financial Group

   Calculates monthly MI and upfront MI/funding fees
   for Conventional, FHA, VA, and USDA loan types.
   ===================================================== */

const RefiMI = (() => {
    'use strict';

    /**
     * Conventional PMI rate table (annual % of loan amount).
     * Rates vary by LTV and credit score. Using mid-range estimates.
     * PMI drops off at 80% LTV (or 78% auto-termination).
     */
    function convPMIRate(ltv, creditScore) {
        if (ltv <= 80) return 0;
        // Rough PMI rate schedule (annual % of loan)
        if (ltv <= 85) return creditScore >= 740 ? 0.25 : creditScore >= 700 ? 0.38 : 0.52;
        if (ltv <= 90) return creditScore >= 740 ? 0.35 : creditScore >= 700 ? 0.52 : 0.78;
        if (ltv <= 95) return creditScore >= 740 ? 0.51 : creditScore >= 700 ? 0.80 : 1.05;
        return creditScore >= 740 ? 0.75 : creditScore >= 700 ? 1.05 : 1.30;
    }

    /**
     * FHA MIP rates (as of 2024+).
     * Upfront: 1.75% of base loan amount.
     * Annual MIP depends on loan term, LTV, and amount.
     * For loans > 15 years and amount <= $726,200:
     *   LTV <= 95%: 0.50% annual
     *   LTV > 95%:  0.55% annual
     * FHA MIP lasts for the life of the loan if LTV > 90% at origination.
     */
    function fhaMIP(loanAmount, propertyValue, termMonths) {
        const ltv = (loanAmount / propertyValue) * 100;
        const upfront = RefiEngine.round2(loanAmount * 0.0175);

        let annualRate;
        if (termMonths <= 180) {
            // 15-year or less
            annualRate = ltv <= 90 ? 0.15 : 0.40;
        } else {
            // > 15 years
            annualRate = ltv <= 95 ? 0.50 : 0.55;
        }

        const monthlyMI = RefiEngine.round2((loanAmount * (annualRate / 100)) / 12);
        const lifeOfLoan = ltv > 90;

        return {
            upfront,
            monthlyMI,
            annualRate,
            lifeOfLoan,
            note: lifeOfLoan
                ? 'FHA MIP for life of loan (LTV > 90% at origination)'
                : 'FHA MIP for 11 years (LTV ≤ 90% at origination)'
        };
    }

    /**
     * VA Funding Fee schedule.
     * First-time use: Down < 5% = 2.15%, 5-9.99% = 1.50%, ≥ 10% = 1.25%
     * Subsequent use: Down < 5% = 3.30%, 5-9.99% = 1.50%, ≥ 10% = 1.25%
     * Exempt: Disabled veterans (10%+ disability)
     * No monthly MI for VA.
     */
    function vaFundingFee(loanAmount, propertyValue, isSubsequentUse) {
        const ltv = (loanAmount / propertyValue) * 100;
        const downPct = 100 - ltv;

        let feeRate;
        if (isSubsequentUse) {
            if (downPct < 5) feeRate = 3.30;
            else if (downPct < 10) feeRate = 1.50;
            else feeRate = 1.25;
        } else {
            if (downPct < 5) feeRate = 2.15;
            else if (downPct < 10) feeRate = 1.50;
            else feeRate = 1.25;
        }

        const fundingFee = RefiEngine.round2(loanAmount * (feeRate / 100));

        return {
            upfront: fundingFee,
            monthlyMI: 0,
            feeRate,
            note: `VA Funding Fee: ${feeRate}% (no monthly MI)`
        };
    }

    /**
     * USDA Guarantee Fee.
     * Upfront: 1.00% of loan amount
     * Annual: 0.35% of remaining balance (paid monthly)
     */
    function usdaGuaranteeFee(loanAmount) {
        const upfront = RefiEngine.round2(loanAmount * 0.01);
        const monthlyMI = RefiEngine.round2((loanAmount * 0.0035) / 12);

        return {
            upfront,
            monthlyMI,
            annualRate: 0.35,
            note: 'USDA Guarantee Fee: 1% upfront + 0.35% annual'
        };
    }

    /**
     * Calculate MI for any loan type.
     *
     * @param {string} loanType - 'Conventional', 'FHA', 'VA', or 'USDA'
     * @param {number} loanAmount - Loan amount
     * @param {number} propertyValue - Property value / appraised value
     * @param {number} termMonths - Loan term in months
     * @param {object} options - { creditScore, isSubsequentVA }
     * @returns {object} { monthlyMI, upfront, ltv, loanType, note, hasMI }
     */
    function calcMI(loanType, loanAmount, propertyValue, termMonths, options) {
        options = options || {};
        const creditScore = options.creditScore || 720;
        const isSubsequentVA = options.isSubsequentVA || false;

        if (!propertyValue || propertyValue <= 0 || !loanAmount || loanAmount <= 0) {
            return { monthlyMI: 0, upfront: 0, ltv: 0, loanType, note: '', hasMI: false };
        }

        const ltv = RefiEngine.round2((loanAmount / propertyValue) * 100);

        switch (loanType) {
            case 'FHA': {
                const result = fhaMIP(loanAmount, propertyValue, termMonths);
                return {
                    monthlyMI: result.monthlyMI,
                    upfront: result.upfront,
                    ltv,
                    loanType,
                    note: result.note,
                    hasMI: true,
                    annualRate: result.annualRate,
                    lifeOfLoan: result.lifeOfLoan
                };
            }
            case 'VA': {
                const result = vaFundingFee(loanAmount, propertyValue, isSubsequentVA);
                return {
                    monthlyMI: 0,
                    upfront: result.upfront,
                    ltv,
                    loanType,
                    note: result.note,
                    hasMI: result.upfront > 0,
                    feeRate: result.feeRate
                };
            }
            case 'USDA': {
                const result = usdaGuaranteeFee(loanAmount);
                return {
                    monthlyMI: result.monthlyMI,
                    upfront: result.upfront,
                    ltv,
                    loanType,
                    note: result.note,
                    hasMI: true,
                    annualRate: result.annualRate
                };
            }
            case 'Conventional':
            default: {
                const pmiRate = convPMIRate(ltv, creditScore);
                const monthlyMI = pmiRate > 0
                    ? RefiEngine.round2((loanAmount * (pmiRate / 100)) / 12)
                    : 0;
                return {
                    monthlyMI,
                    upfront: 0,
                    ltv,
                    loanType: 'Conventional',
                    note: monthlyMI > 0
                        ? `Conventional PMI: ${pmiRate}%/yr (drops at 80% LTV)`
                        : 'No PMI required (LTV ≤ 80%)',
                    hasMI: monthlyMI > 0,
                    annualRate: pmiRate
                };
            }
        }
    }

    return {
        calcMI,
        convPMIRate,
        fhaMIP,
        vaFundingFee,
        usdaGuaranteeFee
    };

})();
