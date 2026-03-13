// packages/rules-engine/src/types.ts

export type UUID = string;

export type PayFrequency = "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY";
export type BasePayType = "SALARY" | "HOURLY";
export type IncomeComponentType =
  | "BASE"
  | "OVERTIME"
  | "BONUS"
  | "COMMISSION"
  | "SHIFT_DIFF"
  | "TIPS"
  | "OTHER";

export type Severity = "info" | "warn" | "stop";

export type LoanProgram = "CONVENTIONAL_FANNIE"; // future: Freddie, FHA, etc.

export type DocumentType =
  | "PAYSTUB"
  | "W2"
  | "VOE_WRITTEN"
  | "VOE_VERBAL"
  | "TAX_RETURN"
  | "GAP_LETTER"
  | "EMPLOYMENT_LETTER"
  | "OTHER";

export interface DateRangeISO {
  startDateISO: string; // YYYY-MM-DD
  endDateISO?: string;  // optional if ongoing
}

export interface BorrowerProfile {
  borrowerId: UUID;
  name?: string;
}

export interface Employment {
  employmentId: UUID;
  employerName: string;
  isCurrent: boolean;

  startDateISO?: string;
  endDateISO?: string;

  basePayType: BasePayType;
  payFrequency: PayFrequency;

  // SALARY: annual salary; HOURLY: hourly rate
  baseRate: number;

  // for hourly: expected normal hours; if unknown, allow null and treat as variable
  expectedHoursPerWeek?: number | null;

  // if true, base pay is treated as variable (averaged/trended)
  hoursFluctuate?: boolean;

  // flags that drive doc requirements
  hasRecentCompChange?: boolean;
  compChangeDateISO?: string;

  // optional, can be expanded later
  positionTitle?: string;
  lineOfWork?: string;
}

export interface PaystubSnapshot {
  employmentId: UUID;

  // "as of" date on the paystub
  asOfDateISO: string;

  payPeriodEndDateISO?: string;

  payPeriodsYTD?: number;

  // YTD amounts by component (best-case input)
  ytd: Partial<Record<IncomeComponentType, number>>;

  // Current period amounts (optional; useful for “last check looks different” flags)
  currentPeriod?: Partial<Record<IncomeComponentType, number>>;

  // Gross YTD if you only have one number (fallback mode)
  grossYTD?: number;
}

export interface W2Year {
  employmentId: UUID;
  year: number; // e.g., 2025
  // Annual totals by component if known; otherwise map everything into BASE/OTHER
  annual: Partial<Record<IncomeComponentType, number>>;
  // W-2 total income if component split unknown
  total?: number;
}

export interface VOE {
  employmentId: UUID;
  type: "VERBAL" | "WRITTEN";
  verifiedDateISO: string;
  // optional: states income is expected to continue, etc.
  notes?: string;
}

export interface GapEvent {
  gapId: UUID;
  range: DateRangeISO;
  explanationProvided?: boolean;
  explanationText?: string;
}

export interface EvidenceBundle {
  program: LoanProgram;

  borrower: BorrowerProfile;

  employments: Employment[];

  paystubs: PaystubSnapshot[];

  w2s?: W2Year[];

  voes?: VOE[];

  gaps?: GapEvent[];

  // Useful if you want to compute "months elapsed" precisely
  evaluationDateISO: string; // date you run the analysis
}

export interface Flag {
  severity: Severity;
  code: string;
  message: string;
  relatedEmploymentId?: UUID;
  relatedComponent?: IncomeComponentType;
}

export interface Requirement {
  id: string;
  severity: Severity; // if missing: warn vs stop
  title: string;
  description: string;
  appliesToEmploymentId?: UUID;
  documentTypes?: DocumentType[];
}

export interface CalculationLine {
  component: IncomeComponentType;
  monthlyAmount: number;
  method:
    | "SALARY_ANNUAL_DIV_12"
    | "HOURLY_STABLE_HOURS"
    | "YTD_PACE"
    | "TWO_YEAR_AVG"
    | "CURRENT_LOWER"
    | "EXCLUDED";
  note: string;

  // Evidence trace
  evidenceUsed: {
    paystubAsOfDateISO?: string;
    w2YearsUsed?: number[];
    assumptions?: string[];
  };
}

export interface EmploymentResult {
  employmentId: UUID;
  employerName: string;

  monthlyByComponent: Partial<Record<IncomeComponentType, number>>;

  lines: CalculationLine[];

  flags: Flag[];

  requirements: Requirement[];
}

export interface DecisionPackage {
  rulesetId: string;         // e.g. "fannie-variable-income-v2026-02"
  rulesetVersion: string;    // semver, e.g. "1.0.0"

  evaluationDateISO: string;

  monthlyTotalUsableIncome: number;

  monthlyTotalsByComponent: Partial<Record<IncomeComponentType, number>>;

  employments: EmploymentResult[];

  globalFlags: Flag[];

  globalRequirements: Requirement[];

  // machine-readable “why”
  audit: {
    inputHash: string; // sha256 of normalized input
  };
}