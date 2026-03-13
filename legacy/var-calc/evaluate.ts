// packages/rules-engine/src/evaluate.ts
import crypto from "crypto";
import type { EvidenceBundle, DecisionPackage } from "./types";
import { EvidenceBundleSchema } from "./schema";
import { buildRequirements } from "./requirements";
import { evaluateWithRuleset } from "./rulesets/fannieVariableIncome_v2026_02";

function hashInput(input: unknown): string {
  const normalized = JSON.stringify(input);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function evaluateIncome(evidence: EvidenceBundle): DecisionPackage {
  // Validate
  const parsed = EvidenceBundleSchema.parse(evidence);

  const inputHash = hashInput(parsed);

  // Evaluate
  const decision = evaluateWithRuleset(parsed);

  // Requirements / doc checklist (global)
  const reqs = buildRequirements(parsed, decision);

  return {
    ...decision,
    globalRequirements: reqs.globalRequirements,
    employments: decision.employments.map((e, idx) => ({
      ...e,
      requirements: reqs.employmentRequirements[idx] ?? [],
    })),
    audit: { inputHash },
  };
}