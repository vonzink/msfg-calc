// packages/rules-engine/src/schema.ts
import { z } from "zod";

export const PayFrequencySchema = z.enum(["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY"]);
export const BasePayTypeSchema = z.enum(["SALARY", "HOURLY"]);
export const IncomeComponentSchema = z.enum([
  "BASE","OVERTIME","BONUS","COMMISSION","SHIFT_DIFF","TIPS","OTHER"
]);

export const EmploymentSchema = z.object({
  employmentId: z.string().min(1),
  employerName: z.string().min(1),
  isCurrent: z.boolean(),
  startDateISO: z.string().optional(),
  endDateISO: z.string().optional(),
  basePayType: BasePayTypeSchema,
  payFrequency: PayFrequencySchema,
  baseRate: z.number().nonnegative(),
  expectedHoursPerWeek: z.number().nonnegative().nullable().optional(),
  hoursFluctuate: z.boolean().optional(),
  hasRecentCompChange: z.boolean().optional(),
  compChangeDateISO: z.string().optional(),
});

export const PaystubSchema = z.object({
  employmentId: z.string().min(1),
  asOfDateISO: z.string().min(10),
  payPeriodEndDateISO: z.string().optional(),
  payPeriodsYTD: z.number().int().positive().optional(),
  ytd: z.record(IncomeComponentSchema, z.number().nonnegative()).partial(),
  currentPeriod: z.record(IncomeComponentSchema, z.number().nonnegative()).partial().optional(),
  grossYTD: z.number().nonnegative().optional(),
});

export const W2Schema = z.object({
  employmentId: z.string().min(1),
  year: z.number().int().min(1900),
  annual: z.record(IncomeComponentSchema, z.number().nonnegative()).partial(),
  total: z.number().nonnegative().optional(),
});

export const EvidenceBundleSchema = z.object({
  program: z.literal("CONVENTIONAL_FANNIE"),
  borrower: z.object({ borrowerId: z.string().min(1), name: z.string().optional() }),
  employments: z.array(EmploymentSchema).min(1),
  paystubs: z.array(PaystubSchema).min(1),
  w2s: z.array(W2Schema).optional(),
  voes: z.array(z.any()).optional(), // tighten later
  gaps: z.array(z.any()).optional(),
  evaluationDateISO: z.string().min(10),
});