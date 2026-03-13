// packages/rules-engine/src/requirements.ts
import type { DecisionPackage, EvidenceBundle, Requirement } from "./types";

export function buildRequirements(evidence: EvidenceBundle, decision: DecisionPackage): {
  globalRequirements: Requirement[];
  employmentRequirements: Requirement[][];
} {
  const global: Requirement[] = [];
  const perEmp: Requirement[][] = evidence.employments.map(() => []);

  // Baseline docs
  global.push({
    id: "REQ_PAYSTUB_RECENT",
    severity: "stop",
    title: "Most recent paystub showing YTD earnings",
    description: "Paystub must be current and reflect year-to-date earnings.",
    documentTypes: ["PAYSTUB"],
  });

  // W-2s if variable components are used
  evidence.employments.forEach((emp, idx) => {
    const empResult = decision.employments.find((e) => e.employmentId === emp.employmentId);
    const usesVariable =
      (empResult?.monthlyByComponent.OVERTIME ?? 0) > 0 ||
      (empResult?.monthlyByComponent.BONUS ?? 0) > 0 ||
      (empResult?.monthlyByComponent.COMMISSION ?? 0) > 0 ||
      (!!emp.hoursFluctuate);

    if (usesVariable) {
      perEmp[idx].push({
        id: "REQ_W2_HISTORY",
        severity: "warn",
        title: "W-2 history for variable income",
        description: "Variable income typically requires history to support stability and trending.",
        appliesToEmploymentId: emp.employmentId,
        documentTypes: ["W2"],
      });
    }

    if (evidence.employments.length > 1) {
      perEmp[idx].push({
        id: "REQ_VOE_VERBAL",
        severity: "warn",
        title: "Verbal VOE",
        description: "Multiple employers generally require verbal verification of employment.",
        appliesToEmploymentId: emp.employmentId,
        documentTypes: ["VOE_VERBAL"],
      });
    }
  });

  // Employment gaps
  if ((evidence.gaps ?? []).some((g) => !g.explanationProvided)) {
    global.push({
      id: "REQ_GAP_LETTER",
      severity: "warn",
      title: "Gap letter / LOE",
      description: "Employment gap(s) indicated; provide explanation letter.",
      documentTypes: ["GAP_LETTER"],
    });
  }

  return { globalRequirements: global, employmentRequirements: perEmp };
}