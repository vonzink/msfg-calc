// variable-income-engine.js
// Fannie-aligned logic: classify -> eligibility gates -> YTD checks -> trending -> docs -> decision

/**
 * Core references:
 * - B3-3.1-01 Variable Income + Trending rules
 * - B3-3.1-02 Employment documentation (paystub recency, W-2 coverage)
 * - B3-3.1-03 Bonus/Overtime stability (>=12 months)
 * - B3-3.1-04 Commission history (2 yrs rec; 12-24 allowed w/ positive factors)
 */

const PAY_PERIODS_PER_YEAR = { WEEKLY: 52, BIWEEKLY: 26, SEMIMONTHLY: 24, MONTHLY: 12 };

function safeDiv(n, d) { return d ? n / d : 0; }
function annualToMonthly(a) { return a / 12; }

function monthsElapsedInYear(asOfISO) {
  const d = new Date(asOfISO + "T00:00:00");
  return d.getMonth() + 1; // underwriting proxy; good enough for flags
}

function ytdToMonthly(ytd, asOfISO) {
  return safeDiv(ytd, monthsElapsedInYear(asOfISO));
}

function evaluateTrend(currentMonthly, prior1Monthly, prior2Monthly) {
  const twoYrAvg = prior2Monthly != null ? (prior1Monthly + prior2Monthly) / 2 : prior1Monthly;
  const stableOrUp = currentMonthly >= twoYrAvg - 0.01;

  if (stableOrUp) return { status: "STABLE_OR_UP", recommendedMonthly: twoYrAvg, note: "Stable/increasing: use average." };
  const stabilized = currentMonthly >= prior1Monthly - 0.01;
  if (stabilized) return { status: "DECLINED_THEN_STABLE", recommendedMonthly: currentMonthly, note: "Declined then stabilized: use current lower." };
  return { status: "DECLINING", recommendedMonthly: currentMonthly, note: "Declining: manual analysis; do not average over decline." };
}

function addFlag(flags, severity, code, message) {
  flags.push({ severity, code, message });
}

function addDoc(docs, item) {
  if (!docs.includes(item)) docs.push(item);
}

/**
 * @typedef {Object} Input
 * @property {string} asOfDateISO
 * @property {("SALARY"|"HOURLY")} basePayType
 * @property {("WEEKLY"|"BIWEEKLY"|"SEMIMONTHLY"|"MONTHLY")} payFrequency
 * @property {number} baseRateAnnualOrHourly
 * @property {number|null} expectedHoursPerWeek
 * @property {boolean} hoursFluctuate
 * @property {number} payPeriodsYTD
 * @property {{base:number, overtime:number, bonus:number, commission:number}} ytd
 * @property {{year:number, base:number, overtime:number, bonus:number, commission:number}[]} priorYears // most recent first
 * @property {number} employerCount
 * @property {boolean} jobChangedOrNewRole
 * @property {boolean} hasEmploymentGap
 * @property {boolean} usingDUValidation // optional: if true, docs may differ
 */

/**
 * @returns {{
 *  monthlyUsable:number,
 *  monthlyByType:Record<string,number>,
 *  docsRequired:string[],
 *  flags:Array<{severity:"info"|"warn"|"stop", code:string, message:string}>,
 *  notes:string[]
 * }}
 */
function underwriteVariableIncome(input) {
  const flags = [];
  const docs = [];
  const notes = [];

  // --- Base documentation baseline (B3-3.1-02) ---
  addDoc(docs, "Most recent paystub (<= 30 days old) showing YTD earnings");
  addDoc(docs, "W-2s (most recent 1–2 years depending on income type)");

  if (input.employerCount > 1) {
    addDoc(docs, "Paystubs/W-2s for each employer used to qualify");
    addDoc(docs, "Verbal VOE for each employer");
    addFlag(flags, "info", "MULTIPLE_EMPLOYERS", "Multiple jobs/employers: separate verification required.");
  }

  if (input.hasEmploymentGap) {
    addDoc(docs, "Letter of explanation for employment gap(s)");
    addFlag(flags, "warn", "GAP", "Employment gap indicated: underwriter will require explanation and may request additional history.");
  }

  if (input.jobChangedOrNewRole) {
    addDoc(docs, "Written explanation of job/role change (and impact to OT/bonus/commission)");
    addFlag(flags, "warn", "COMP_CHANGE", "Recent job/role/comp change can affect variable income continuance.");
  }

  // --- Base income calc ---
  let monthlyBase = 0;

  if (input.basePayType === "SALARY") {
    monthlyBase = annualToMonthly(input.baseRateAnnualOrHourly);
  } else {
    // HOURLY
    if (input.hoursFluctuate) {
      // treat base as variable: use YTD monthly pace + trend
      const current = ytdToMonthly(input.ytd.base, input.asOfDateISO);
      const p1 = input.priorYears[0] ? input.priorYears[0].base / 12 : null;
      const p2 = input.priorYears[1] ? input.priorYears[1].base / 12 : null;

      const tr = evaluateTrend(current, p1 ?? current, p2);
      monthlyBase = tr.recommendedMonthly;
      notes.push(`Base hourly (fluctuating): ${tr.note}`);

      if (tr.status === "DECLINING") {
        addFlag(flags, "warn", "BASE_DECLINING", "Hourly base appears declining; manual UW analysis likely required.");
      }
    } else {
      if (!input.expectedHoursPerWeek) {
        addFlag(flags, "stop", "MISSING_HOURS", "Hourly base requires expected hours/week when hours are stable.");
      } else {
        monthlyBase = (input.baseRateAnnualOrHourly * input.expectedHoursPerWeek * 52) / 12;
      }
    }
  }

  // --- Expected vs actual base YTD sanity check (your “gap detector”) ---
  const periods = PAY_PERIODS_PER_YEAR[input.payFrequency];
  if (periods && input.payPeriodsYTD > 0) {
    let expectedBaseYTD = null;

    if (input.basePayType === "SALARY") {
      expectedBaseYTD = (input.baseRateAnnualOrHourly / periods) * input.payPeriodsYTD;
    } else if (!input.hoursFluctuate && input.expectedHoursPerWeek) {
      const weekly = input.baseRateAnnualOrHourly * input.expectedHoursPerWeek;
      const perPeriod =
        input.payFrequency === "WEEKLY" ? weekly :
        input.payFrequency === "BIWEEKLY" ? weekly * 2 :
        input.payFrequency === "SEMIMONTHLY" ? weekly * (52 / 24) :
        weekly * (52 / 12);
      expectedBaseYTD = perPeriod * input.payPeriodsYTD;
    }

    if (expectedBaseYTD != null && expectedBaseYTD > 0 && input.ytd.base > 0) {
      const variance = (input.ytd.base - expectedBaseYTD) / expectedBaseYTD;
      if (Math.abs(variance) >= 0.05) {
        addFlag(flags, "warn", "YTD_MISMATCH", `Base YTD differs from expected by ${(variance * 100).toFixed(1)}% (possible gap/unpaid leave/comp change).`);
        addDoc(docs, "Explanation for YTD variance (unpaid leave, schedule change, comp change, etc.)");
      }
    }
  }

  // --- Variable components (OT, bonus, commission) ---
  function handleVar(type, ytdAmount, priorSelector, minMonthsHistory, label) {
    if (ytdAmount <= 0) return 0;

    const current = ytdToMonthly(ytdAmount, input.asOfDateISO);
    const p1 = input.priorYears[0] ? priorSelector(input.priorYears[0]) / 12 : null;
    const p2 = input.priorYears[1] ? priorSelector(input.priorYears[1]) / 12 : null;

    // History flags: Fannie uses “recommended 2 years; 12–24 may be ok with positives”
    // For OT/Bonus specifically, no less than 12 months to be considered stable.
    const monthsAvailableProxy = input.priorYears.length >= 1 ? 24 : 0; // proxy; later: compute from employment dates
    if (minMonthsHistory && monthsAvailableProxy < minMonthsHistory) {
      addFlag(flags, "warn", `${type}_HISTORY`, `${label} history may be insufficient; underwriting may require ≥${minMonthsHistory} months.`);
      addDoc(docs, `Prior year(s) evidence of ${label} (W-2, VOE, or pay history)`);
    }

    const tr = evaluateTrend(current, (p1 ?? current), p2);
    notes.push(`${label}: ${tr.note}`);

    if (tr.status === "DECLINING") {
      addFlag(flags, "warn", `${type}_DECLINING`, `${label} appears declining; do not average over decline period without analysis.`);
    }

    return tr.recommendedMonthly;
  }

  const monthlyOT = handleVar("OT", input.ytd.overtime, (y) => y.overtime, 12, "Overtime");
  const monthlyBonus = handleVar("BONUS", input.ytd.bonus, (y) => y.bonus, 12, "Bonus");
  const monthlyComm = handleVar("COMM", input.ytd.commission, (y) => y.commission, 12, "Commission"); // commission: 12–24 possible, 2 years recommended

  // --- Total ---
  const monthlyByType = {
    base: monthlyBase,
    overtime: monthlyOT,
    bonus: monthlyBonus,
    commission: monthlyComm
  };

  const monthlyUsable = Object.values(monthlyByType).reduce((a, b) => a + (b || 0), 0);

  return { monthlyUsable, monthlyByType, docsRequired: docs, flags, notes };
}

if (typeof module !== 'undefined') module.exports = { underwriteVariableIncome };