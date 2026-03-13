// packages/rules-engine/src/rulesets/fannieVariableIncome_v2026_02.ts
import type {
  DecisionPackage,
  EvidenceBundle,
  EmploymentResult,
  IncomeComponentType,
} from "../types";

const RULESET_ID = "fannie-variable-income-v2026-02";
const RULESET_VERSION = "1.0.0";

const PAY_PERIODS_PER_YEAR = { WEEKLY: 52, BIWEEKLY: 26, SEMIMONTHLY: 24, MONTHLY: 12 } as const;

function monthsElapsed(asOfISO: string): number {
  const d = new Date(asOfISO + "T00:00:00");
  return d.getMonth() + 1;
}
function safeDiv(n: number, d: number): number { return d ? n / d : 0; }
function annualToMonthly(a: number): number { return a / 12; }
function ytdToMonthly(ytd: number, asOfISO: string): number { return safeDiv(ytd, monthsElapsed(asOfISO)); }

function sumByComponent(
  employments: EmploymentResult[]
): Partial<Record<IncomeComponentType, number>> {
  const out: Partial<Record<IncomeComponentType, number>> = {};
  for (const emp of employments) {
    for (const [k, v] of Object.entries(emp.monthlyByComponent)) {
      const key = k as IncomeComponentType;
      out[key] = (out[key] ?? 0) + (v ?? 0);
    }
  }
  return out;
}

export function evaluateWithRuleset(evidence: EvidenceBundle): DecisionPackage {
  const employmentResults: EmploymentResult[] = evidence.employments.map((emp) => {
    const stubs = evidence.paystubs
      .filter((p) => p.employmentId === emp.employmentId)
      .sort((a, b) => a.asOfDateISO.localeCompare(b.asOfDateISO));
    const latestStub = stubs[stubs.length - 1];

    const w2s = (evidence.w2s ?? [])
      .filter((w) => w.employmentId === emp.employmentId)
      .sort((a, b) => b.year - a.year);

    const flags = [];
    const lines = [];
    const monthlyByComponent: Partial<Record<IncomeComponentType, number>> = {};

    // --- Base ---
    if (emp.basePayType === "SALARY") {
      const m = annualToMonthly(emp.baseRate);
      monthlyByComponent.BASE = m;
      lines.push({
        component: "BASE",
        monthlyAmount: m,
        method: "SALARY_ANNUAL_DIV_12",
        note: "Salary base pay = annual / 12.",
        evidenceUsed: { paystubAsOfDateISO: latestStub?.asOfDateISO },
      });
    } else {
      // Hourly
      const hoursFluctuate = !!emp.hoursFluctuate || !emp.expectedHoursPerWeek;
      if (!hoursFluctuate && emp.expectedHoursPerWeek) {
        const m = (emp.baseRate * emp.expectedHoursPerWeek * 52) / 12;
        monthlyByComponent.BASE = m;
        lines.push({
          component: "BASE",
          monthlyAmount: m,
          method: "HOURLY_STABLE_HOURS",
          note: "Hourly base pay with stable hours = rate * hours * 52 / 12.",
          evidenceUsed: { paystubAsOfDateISO: latestStub?.asOfDateISO },
        });
      } else {
        // Treat as variable: use YTD pace and trending (placeholder: YTD pace only until we complete trend rules)
        const baseYTD = latestStub?.ytd.BASE ?? 0;
        const currentMonthly = ytdToMonthly(baseYTD, latestStub.asOfDateISO);
        monthlyByComponent.BASE = currentMonthly;

        lines.push({
          component: "BASE",
          monthlyAmount: currentMonthly,
          method: "YTD_PACE",
          note: "Hourly base with fluctuating hours treated as variable: using YTD monthly pace (trend logic will be applied with W-2s).",
          evidenceUsed: { paystubAsOfDateISO: latestStub?.asOfDateISO, w2YearsUsed: w2s.map((w) => w.year).slice(0, 2) },
        });

        flags.push({
          severity: "info",
          code: "HOURLY_FLUCTUATING",
          message: "Hourly hours fluctuate or hours/week missing; base income treated as variable and should be trended using W-2 history when available.",
          relatedEmploymentId: emp.employmentId,
          relatedComponent: "BASE",
        });
      }
    }

    // --- Variable components (OT/Bonus/Commission): YTD pace now; trend rules will choose avg vs current lower ---
    for (const comp of ["OVERTIME", "BONUS", "COMMISSION"] as const) {
      const ytd = latestStub?.ytd[comp] ?? 0;
      if (ytd > 0) {
        const m = ytdToMonthly(ytd, latestStub.asOfDateISO);
        monthlyByComponent[comp] = m;

        lines.push({
          component: comp,
          monthlyAmount: m,
          method: "YTD_PACE",
          note: `${comp} present: using YTD monthly pace (trend rules will prefer 2-year avg or current lower when W-2s are present).`,
          evidenceUsed: { paystubAsOfDateISO: latestStub.asOfDateISO, w2YearsUsed: w2s.map((w) => w.year).slice(0, 2) },
        });
      }
    }

    return {
      employmentId: emp.employmentId,
      employerName: emp.employerName,
      monthlyByComponent,
      lines,
      flags,
      requirements: [], // filled later
    };
  });

  const monthlyTotalsByComponent = sumByComponent(employmentResults);
  const monthlyTotalUsableIncome = Object.values(monthlyTotalsByComponent).reduce((a, b) => a + (b ?? 0), 0);

  return {
    rulesetId: RULESET_ID,
    rulesetVersion: RULESET_VERSION,
    evaluationDateISO: evidence.evaluationDateISO,
    monthlyTotalUsableIncome,
    monthlyTotalsByComponent,
    employments: employmentResults,
    globalFlags: [],
    globalRequirements: [],
    audit: { inputHash: "" }, // assigned in evaluate.ts
  };
}