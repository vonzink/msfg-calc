/* =====================================================
   REFI ADVICE — Recommendation Engine
   Mountain State Financial Group

   Analyzes results and generates actionable
   refinance guidance with configurable thresholds.
   ===================================================== */

const RefiAdvice = (() => {
    'use strict';

    // -------------------------------------------------
    // RENDER ADVICE
    // -------------------------------------------------

    function render(results) {
        const a = results.analysis;
        const target = results.inputs.targetBreakeven;
        const stay = results.inputs.planToStayMonths;
        const section = document.getElementById('adviceSection');
        const headline = document.getElementById('adviceHeadline');
        const detail = document.getElementById('adviceDetail');
        const bulletsDiv = document.getElementById('adviceBullets');

        // Remove old classes
        section.classList.remove('advice-now', 'advice-wait', 'advice-caution');

        // Determine recommendation
        const recommendation = analyzeScenarios(results);

        // Set class
        section.classList.add(recommendation.cssClass);

        // Set headline
        headline.textContent = recommendation.headline;

        // Set detail
        detail.textContent = recommendation.detail;

        // Build bullet points
        let bulletsHtml = '<ul class="advice-bullets">';
        recommendation.pros.forEach(pro => {
            bulletsHtml += `<li>${pro}</li>`;
        });
        recommendation.cons.forEach(con => {
            bulletsHtml += `<li class="con">${con}</li>`;
        });
        recommendation.neutralPoints.forEach(point => {
            bulletsHtml += `<li class="neutral-point">${point}</li>`;
        });
        bulletsHtml += '</ul>';
        bulletsDiv.innerHTML = bulletsHtml;
    }

    // -------------------------------------------------
    // SCENARIO ANALYSIS
    // -------------------------------------------------

    function analyzeScenarios(results) {
        const a = results.analysis;
        const target = results.inputs.targetBreakeven;
        const stay = results.inputs.planToStayMonths;
        const fmt = RefiUI.formatMoney;
        const co = results.cashOut;
        const costOfWaitingEnabled = results.inputs.costOfWaitingEnabled !== false;

        const pros = [];
        const cons = [];
        const neutralPoints = [];

        // Cash-out context note
        if (co.enabled && co.debtPayments > 0) {
            neutralPoints.push(`Cash-out refinance: ${fmt(co.amount)} cash out, eliminating ${fmt(co.debtPayments)}/mo in debt payments`);
        }

        // If Cost of Waiting is disabled, use simplified analysis (no wait comparison)
        if (!costOfWaitingEnabled) {
            return analyzeRefiOnly(results, pros, cons, neutralPoints);
        }

        // Key decision factors
        const hasPositiveSavingsNow = a.monthlySavingsNow > 0;
        const hasPositiveSavingsWait = a.futureMonthlySavings > 0;
        const breakevenNowMeetsTarget = a.breakevenNow !== Infinity && a.breakevenNow <= target;
        const breakevenWaitMeetsTarget = a.breakevenWait !== Infinity && a.breakevenWait <= target;
        const staysLongEnoughNow = a.breakevenNow !== Infinity && a.breakevenNow < stay;
        const staysLongEnoughWait = a.breakevenWait !== Infinity && (a.breakevenWait + a.monthsToWait) < stay;
        const nowIsBetter = a.netDifference > 0;
        const waitIsBetter = a.netDifference < 0;
        const rateDrop = results.inputs.currentRate - results.inputs.refiRate;
        const futureRateDrop = results.inputs.currentRate - results.inputs.futureRate;

        // ---- SCENARIO 1: Refinance Now is clearly better ----
        if (hasPositiveSavingsNow && breakevenNowMeetsTarget && nowIsBetter) {
            pros.push(`Monthly savings of ${fmt(a.monthlySavingsNow)} by refinancing now`);
            pros.push(`Breakeven in ${a.breakevenNow} months — within your ${target}-month target`);
            pros.push(`Net savings of ${fmt(a.refiNowNetSavings)} over your ${stay}-month stay`);

            if (a.extraInterest > 0) {
                pros.push(`Avoid ${fmt(a.extraInterest)} in extra interest that waiting would cost`);
            }

            if (waitIsBetter === false) {
                pros.push(`Refinancing now saves ${fmt(a.netDifference)} more than waiting`);
            }

            // Rate info
            neutralPoints.push(`Rate reduction: ${results.inputs.currentRate}% → ${results.inputs.refiRate}% (${rateDrop.toFixed(3)}% drop)`);

            if (hasPositiveSavingsWait) {
                cons.push(`Waiting could yield a lower payment of ${fmt(results.futurePayment)}/mo at ${results.inputs.futureRate}%, but the cost of waiting offsets the benefit`);
            }

            return {
                cssClass: 'advice-now',
                headline: '✓ Refinance Now — Favorable',
                detail: `Refinancing now meets your breakeven target and produces the best overall net savings over your planned stay.`,
                pros, cons, neutralPoints
            };
        }

        // ---- SCENARIO 2: Waiting is clearly better ----
        if (waitIsBetter && hasPositiveSavingsWait && (!breakevenNowMeetsTarget || !nowIsBetter)) {
            pros.push(`Waiting ${a.monthsToWait} months for ${results.inputs.futureRate}% yields ${fmt(a.futureMonthlySavings)}/mo savings`);
            pros.push(`Waiting produces ${fmt(Math.abs(a.netDifference))} more in net savings than refinancing now`);

            if (staysLongEnoughWait) {
                pros.push(`Net savings of ${fmt(a.waitNetSavings)} over your remaining stay after waiting`);
            }

            neutralPoints.push(`Expected rate: ${results.inputs.futureRate}% (additional ${(results.inputs.refiRate - results.inputs.futureRate).toFixed(3)}% below today's offer)`);
            neutralPoints.push(`Waiting period: ${a.monthsToWait} months`);

            if (a.extraInterest > 0) {
                cons.push(`Extra interest of ${fmt(a.extraInterest)} during the waiting period`);
            }

            if (hasPositiveSavingsNow) {
                cons.push(`You'll miss out on ${fmt(a.monthlySavingsNow)}/mo savings during the ${a.monthsToWait}-month wait`);
            }

            // Risk warning
            cons.push(`Future rates are not guaranteed — if rates don't drop to ${results.inputs.futureRate}%, the analysis changes`);

            return {
                cssClass: 'advice-wait',
                headline: '⏳ Consider Waiting',
                detail: `The analysis suggests waiting for a better rate produces more savings, assuming rates reach ${results.inputs.futureRate}% within ${a.monthsToWait} months.`,
                pros, cons, neutralPoints
            };
        }

        // ---- SCENARIO 3: Refinance now is OK but doesn't meet target ----
        if (hasPositiveSavingsNow && !breakevenNowMeetsTarget && staysLongEnoughNow) {
            pros.push(`Monthly savings of ${fmt(a.monthlySavingsNow)} by refinancing now`);
            pros.push(`You'll still recoup costs before you plan to move/sell`);

            if (nowIsBetter) {
                pros.push(`Refinancing now saves ${fmt(a.netDifference)} more than waiting`);
            }

            cons.push(`Breakeven of ${a.breakevenNow} months exceeds your ${target}-month target`);
            cons.push(`Closing costs of ${fmt(a.closingCosts)} are significant relative to monthly savings`);

            neutralPoints.push(`Rate reduction: ${rateDrop.toFixed(3)}% — a modest improvement`);
            neutralPoints.push(`Net savings of ${fmt(a.refiNowNetSavings)} over ${stay} months`);

            return {
                cssClass: 'advice-wait',
                headline: '⚠ Refinance Now — Below Target',
                detail: `Refinancing produces savings but the breakeven period of ${a.breakevenNow} months exceeds your ${target}-month target. Consider if the long-term savings justify the upfront cost.`,
                pros, cons, neutralPoints
            };
        }

        // ---- SCENARIO 4: No meaningful savings either way ----
        if (!hasPositiveSavingsNow && !hasPositiveSavingsWait) {
            cons.push(`No monthly savings from refinancing at ${results.inputs.refiRate}%`);
            cons.push(`No monthly savings from the future rate of ${results.inputs.futureRate}% either`);
            cons.push(`Closing costs of ${fmt(a.closingCosts)} would not be recovered`);

            neutralPoints.push(`Current rate: ${results.inputs.currentRate}%`);
            neutralPoints.push(`Consider refinancing only if rates drop significantly below your current rate`);

            return {
                cssClass: 'advice-caution',
                headline: '✗ Refinancing Not Recommended',
                detail: `Neither the current offer nor the anticipated future rate produces meaningful savings relative to your current loan terms.`,
                pros, cons, neutralPoints
            };
        }

        // ---- SCENARIO 5: Savings exist but won't recoup before moving ----
        if (hasPositiveSavingsNow && !staysLongEnoughNow) {
            cons.push(`Breakeven of ${a.breakevenNow === Infinity ? '∞' : a.breakevenNow} months exceeds your planned ${stay}-month stay`);
            cons.push(`You would not recoup the ${fmt(a.closingCosts)} in closing costs before leaving`);
            cons.push(`Net loss of ${fmt(Math.abs(a.refiNowNetSavings))} over your stay period`);

            neutralPoints.push(`Monthly savings of ${fmt(a.monthlySavingsNow)} are insufficient given the timeframe`);

            return {
                cssClass: 'advice-caution',
                headline: '✗ Refinancing Not Recommended — Insufficient Stay Period',
                detail: `While refinancing produces monthly savings, you won't stay long enough to recoup the closing costs.`,
                pros, cons, neutralPoints
            };
        }

        // ---- SCENARIO 6: Mixed / close call ----
        if (hasPositiveSavingsNow) {
            pros.push(`Monthly savings of ${fmt(a.monthlySavingsNow)} available now`);
        }
        if (nowIsBetter) {
            pros.push(`Refinancing now is ${fmt(a.netDifference)} better than waiting`);
        }
        if (waitIsBetter) {
            cons.push(`Waiting could be ${fmt(Math.abs(a.netDifference))} better`);
        }
        if (a.extraInterest > 0) {
            neutralPoints.push(`Cost of waiting: ${fmt(a.extraInterest)} in extra interest`);
        }

        neutralPoints.push(`This is a close call — consider your confidence in the future rate assumption`);
        neutralPoints.push(`If rates don't reach ${results.inputs.futureRate}%, refinancing now becomes the better option`);

        return {
            cssClass: 'advice-wait',
            headline: '⚖ Close Call — Review Carefully',
            detail: `The numbers are close between refinancing now and waiting. Your decision may depend on rate confidence and personal circumstances.`,
            pros, cons, neutralPoints
        };
    }

    // -------------------------------------------------
    // SIMPLIFIED ANALYSIS (Refi-only, no cost of waiting)
    // -------------------------------------------------

    function analyzeRefiOnly(results, pros, cons, neutralPoints) {
        const a = results.analysis;
        const target = results.inputs.targetBreakeven;
        const stay = results.inputs.planToStayMonths;
        const fmt = RefiUI.formatMoney;
        const rateDrop = results.inputs.currentRate - results.inputs.refiRate;

        const hasPositiveSavings = a.monthlySavingsNow > 0;
        const breakevenMeetsTarget = a.breakevenNow !== Infinity && a.breakevenNow <= target;
        const staysLongEnough = a.breakevenNow !== Infinity && a.breakevenNow < stay;

        neutralPoints.push(`Rate reduction: ${results.inputs.currentRate}% → ${results.inputs.refiRate}% (${rateDrop.toFixed(3)}% drop)`);

        // Favorable
        if (hasPositiveSavings && breakevenMeetsTarget) {
            pros.push(`Monthly savings of ${fmt(a.monthlySavingsNow)} by refinancing`);
            pros.push(`Breakeven in ${a.breakevenNow} months — within your ${target}-month target`);
            pros.push(`Net savings of ${fmt(a.refiNowNetSavings)} over your ${stay}-month stay`);

            return {
                cssClass: 'advice-now',
                headline: '✓ Refinance — Favorable',
                detail: `Refinancing meets your breakeven target and produces positive net savings over your planned stay.`,
                pros, cons, neutralPoints
            };
        }

        // Below target but still recoverable
        if (hasPositiveSavings && !breakevenMeetsTarget && staysLongEnough) {
            pros.push(`Monthly savings of ${fmt(a.monthlySavingsNow)} by refinancing`);
            pros.push(`You'll still recoup costs before you plan to move/sell`);
            cons.push(`Breakeven of ${a.breakevenNow} months exceeds your ${target}-month target`);
            cons.push(`Closing costs of ${fmt(a.closingCosts)} are significant relative to monthly savings`);
            neutralPoints.push(`Net savings of ${fmt(a.refiNowNetSavings)} over ${stay} months`);

            return {
                cssClass: 'advice-wait',
                headline: '⚠ Refinance — Below Target',
                detail: `Refinancing produces savings but the breakeven period of ${a.breakevenNow} months exceeds your ${target}-month target.`,
                pros, cons, neutralPoints
            };
        }

        // Insufficient stay
        if (hasPositiveSavings && !staysLongEnough) {
            cons.push(`Breakeven of ${a.breakevenNow === Infinity ? '∞' : a.breakevenNow} months exceeds your planned ${stay}-month stay`);
            cons.push(`You would not recoup the ${fmt(a.closingCosts)} in closing costs before leaving`);
            neutralPoints.push(`Monthly savings of ${fmt(a.monthlySavingsNow)} are insufficient given the timeframe`);

            return {
                cssClass: 'advice-caution',
                headline: '✗ Refinancing Not Recommended — Insufficient Stay Period',
                detail: `While refinancing produces monthly savings, you won't stay long enough to recoup the closing costs.`,
                pros, cons, neutralPoints
            };
        }

        // No savings
        cons.push(`No monthly savings from refinancing at ${results.inputs.refiRate}%`);
        cons.push(`Closing costs of ${fmt(a.closingCosts)} would not be recovered`);
        neutralPoints.push(`Consider refinancing only if rates drop significantly below your current rate`);

        return {
            cssClass: 'advice-caution',
            headline: '✗ Refinancing Not Recommended',
            detail: `The refinance offer does not produce meaningful savings relative to your current loan terms.`,
            pros, cons, neutralPoints
        };
    }

    // -------------------------------------------------
    // PUBLIC API
    // -------------------------------------------------

    return {
        render,
        analyzeScenarios
    };

})();
