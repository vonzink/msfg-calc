import { LLPA_MATRIX } from './llpa-matrix-2026-01-28.js';

/**
 * Pricing engine for Fannie Mae LLPA Matrix (01.28.2026).
 * - All returns are in points (e.g., 0.375 = 0.375 points)
 * - Base table is a 2D lookup (credit score x LTV).
 * - Additional LLPAs are feature x LTV lookups (varies by purpose).
 * - Waivers remove *all* LLPAs except Minimum MI option (MMI).
 */

export function calcLLPAs(input) {
  const warnings = [];
  const breakdown = [];

  // ---- Derived values ----
  const grossLTV = input.propertyValue > 0 ? (input.loanAmount / input.propertyValue) * 100 : 0;
  const baseLTVForMMI = (typeof input.baseLTVForMMI === 'number' && input.baseLTVForMMI > 0)
    ? input.baseLTVForMMI
    : grossLTV;

  const termBucket = (input.termYears && input.termYears <= 15) ? '<=15' : '>15';
  const purposeKey = purposeToKey(input.purpose);

  // ---- Base LLPA (Table 1/2/3) ----
  // Per your rule: for Purchase + Limited cash-out, when term <= 15 years,
  // the credit-score × LTV base-table cells are 0.00. Cash-out still uses its base table.
  const isShortTerm = termBucket === '<=15';
  const zeroBaseForShortTerm = isShortTerm && (purposeKey === 'purchase' || purposeKey === 'limitedCashOut');
  const base = zeroBaseForShortTerm ? 0 : lookup2D(LLPA_MATRIX.base[purposeKey], input.creditScore, grossLTV);
  if (base !== 0) push(breakdown, 'Base LLPA (Credit Score × LTV)', base, `${labelPurpose(purposeKey)} base table`);

  // ---- Attribute LLPAs ----
  let attrsTotal = 0;

  // ARM add-on (purchase/limited cash-out only in this matrix)
  if (input.productType === 'ARM') {
    const arm = lookupFeature(purposeKey, 'Adjustable-rate mortgage', grossLTV);
    attrsTotal += arm;
    if (arm !== 0) push(breakdown, 'Adjustable-rate mortgage', arm, 'Additional LLPAs by loan attribute');
  }

  // Condo / Manufactured
  if (input.isCondo) {
    const condo = lookupFeature(purposeKey, 'Condo1', grossLTV);
    attrsTotal += condo;
    if (condo !== 0) push(breakdown, 'Condo', condo, 'Additional LLPAs by loan attribute');
  }
  if (input.isManufacturedHome) {
    const mh = lookupFeature(purposeKey, 'Manufactured home2', grossLTV);
    attrsTotal += mh;
    if (mh !== 0) push(breakdown, 'Manufactured home', mh, 'Additional LLPAs by loan attribute (SFC 235)');
  }

  // Occupancy (Second home / Investment)
  if (input.occupancy === 'SecondHome') {
    const sh = lookupFeature(purposeKey, 'Second home', grossLTV);
    attrsTotal += sh;
    if (sh !== 0) push(breakdown, 'Second home', sh, 'Additional LLPAs by loan attribute');
  } else if (input.occupancy === 'Investment') {
    const inv = lookupFeature(purposeKey, 'Investment property', grossLTV);
    attrsTotal += inv;
    if (inv !== 0) push(breakdown, 'Investment property', inv, 'Additional LLPAs by loan attribute');
  }

  // 2-4 units
  if (input.units && parseInt(input.units, 10) >= 2) {
    const u = lookupFeature(purposeKey, 'Two- to four-unit property', grossLTV);
    attrsTotal += u;
    if (u !== 0) push(breakdown, 'Two- to four-unit property', u, 'Additional LLPAs by loan attribute');
  }

  // High balance: fixed vs ARM rows are different
  if (input.isHighBalance) {
    const feature = (input.productType === 'ARM') ? 'High-balance ARM' : 'High-balance fixed-rate';
    const hb = lookupFeature(purposeKey, feature, grossLTV);
    attrsTotal += hb;
    if (hb !== 0) push(breakdown, feature, hb, 'Additional LLPAs by loan attribute (SFC 808)');
  }

  // Subordinate financing
  if (input.hasSubordinateFinancing) {
    const sub = lookupFeature(purposeKey, 'Subordinate financing3', grossLTV);
    attrsTotal += sub;
    if (sub !== 0) push(breakdown, 'Subordinate financing', sub, 'Additional LLPAs by loan attribute');
  }

  // ---- High LTV Refinance cap (Table 6) ----
  // Only applies if user indicates this is a "High LTV Refinance Loan".
  // Cap is on cumulative LLPAs from tables 1-3 (base + attributes). MMI is NOT part of the cap table.
  let cappedSubtotal = base + attrsTotal;
  if (input.isHighLTVRefi) {
    const cap = getHighLtvRefiCap({ occupancy: input.occupancy, units: input.units, ltv: grossLTV, termBucket });
    if (cap != null && cappedSubtotal > cap) {
      const waive = cap - cappedSubtotal;
      push(breakdown, 'High LTV Refinance cap waiver', waive, `Cap applied: ${cap.toFixed(3)} (Tables 1–3 only)`);
      cappedSubtotal = cap;
    }
  }

  // ---- Waivers (HomeReady / First-time HB / Duty to Serve) ----
  // Per matrix: all LLPAs are waived (Exception: MMI still charged if applicable).
  const waiverFlags = [];
  if (input.waiverHomeReady) waiverFlags.push('HomeReady®');
  if (input.waiverFirstTimeHB) waiverFlags.push('First-time homebuyer');
  if (input.waiverDutyToServe) waiverFlags.push('Duty to Serve');

  let waivedSubtotal = cappedSubtotal;
  if (waiverFlags.length) {
    const waiverAdj = -waivedSubtotal;
    if (waiverAdj !== 0) {
      push(breakdown, `LLPA Waiver (${waiverFlags.join(' + ')})`, waiverAdj, 'Waives all LLPAs except MMI');
      waivedSubtotal = 0;
    }
  }

  // ---- Minimum Mortgage Insurance Coverage Option (MMI) ----
  // Applies when toggle enabled; matrix is based on base/net LTV (not gross).
  // Not applicable to High LTV Refinance.
  let mmiPoints = 0;
  if (input.applyMMI && !input.isHighLTVRefi) {
    mmiPoints = lookupMMI(input.creditScore, baseLTVForMMI);
    if (mmiPoints !== 0) {
      push(breakdown, 'Minimum MI coverage option', mmiPoints, `Based on base/net LTV: ${baseLTVForMMI.toFixed(2)}%`);
    }
  } else if (input.applyMMI && input.isHighLTVRefi) {
    warnings.push('MMI is not applicable to High LTV Refinance per the matrix.');
  }

  const total = waivedSubtotal + mmiPoints; // waivedSubtotal is already after caps + waivers
  return {
    grossLTV,
    baseLTVForMMI,
    termBucket,
    purposeKey,
    breakdown,
    totalPoints: total,
    warnings
  };
}

// ---------------- helpers ----------------

function purposeToKey(purpose) {
  if (purpose === 'Purchase') return 'purchase';
  if (purpose === 'LimitedCashOut') return 'limitedCashOut';
  return 'cashOut';
}

function labelPurpose(key) {
  if (key === 'purchase') return 'Purchase';
  if (key === 'limitedCashOut') return 'Limited cash-out refinance';
  return 'Cash-out refinance';
}

function creditScoreBucket(score) {
  const s = Number(score);
  if (!isFinite(s)) return '<= 639';
  if (s >= 780) return '≥ 780';
  if (s >= 760) return '760-779';
  if (s >= 740) return '740-759';
  if (s >= 720) return '720-739';
  if (s >= 700) return '700-719';
  if (s >= 680) return '680-699';
  if (s >= 660) return '660-679';
  if (s >= 640) return '640-659';
  return '<= 639';
}

function ltvBucket(ltv, columns) {
  const x = Number(ltv);
  if (!isFinite(x)) return columns[columns.length - 1];

  // columns differ by purpose (cash-out has fewer)
  if (columns.includes('<=30') || columns.includes('<=30.00') || columns.includes('<=30.00%')) {
    // cash-out buckets
    if (x <= 30) return '<=30';
    if (x <= 60) return '30.01-60';
    if (x <= 70) return '60.01-70';
    if (x <= 75) return '70.01-75';
    return '75.01-80';
  }

  // purchase / limited cash-out buckets
  if (x <= 30) return '<30';
  if (x <= 60) return '30.01-60';
  if (x <= 70) return '60.01-70';
  if (x <= 75) return '70.01-75';
  if (x <= 80) return '75.01-80';
  if (x <= 85) return '80.01-85';
  if (x <= 90) return '85.01-90';
  if (x <= 95) return '90.01-95';
  return '>95';
}

function lookup2D(table, creditScore, ltv) {
  const rowKey = creditScoreBucket(creditScore);
  const row = table[rowKey];
  if (!row) return 0;
  const colKey = ltvBucket(ltv, Object.keys(row));
  return Number(row[colKey] ?? 0);
}

function lookupFeature(purposeKey, featureName, ltv) {
  const t = LLPA_MATRIX.attributes[purposeKey];
  const row = t?.[featureName];
  if (!row) return 0;
  const colKey = ltvBucket(ltv, Object.keys(row));
  return Number(row[colKey] ?? 0);
}

function lookupMMI(creditScore, baseLTV) {
  const ltv = Number(baseLTV);

  // Matrix columns exist only for 80.01-97 (specific buckets)
  if (!(ltv > 80 && ltv <= 97)) return 0;

  const cs = Number(creditScore);
  let rowKey = '>740';
  if (cs >= 740) rowKey = '>740';
  else if (cs >= 720) rowKey = '720 - 739';
  else if (cs >= 700) rowKey = '700 - 719';
  else if (cs >= 680) rowKey = '680 - 699';
  else if (cs >= 660) rowKey = '660 - 679';
  else if (cs >= 640) rowKey = '640 - 659';
  else if (cs >= 620) rowKey = '620 - 639';
  else rowKey = '< 620';

  const row = LLPA_MATRIX.mmi[rowKey];
  if (!row) return 0;

  let colKey = '80.01-85';
  if (ltv <= 85) colKey = '80.01-85';
  else if (ltv <= 90) colKey = '85.01-90';
  else if (ltv <= 95) colKey = '90.01-95';
  else colKey = '95.01-97';

  return Number(row[colKey] ?? 0);
}

function getHighLtvRefiCap({ occupancy, units, ltv, termBucket }) {
  const u = parseInt(units || '1', 10);
  const occ = occupancy || 'Primary';

  // Map to a cap row label
  let rowName = null;
  if (occ === 'Primary') {
    if (u === 1) rowName = 'Principal residence 1 unit';
    else if (u === 2) rowName = 'Principal residence 2 units';
    else rowName = 'Principal residence 3-4 units';
  } else if (occ === 'SecondHome') {
    rowName = 'Second home 1 unit';
  } else if (occ === 'Investment') {
    rowName = 'Investment property 1-4 units';
  }

  const row = LLPA_MATRIX.highLtvRefiCaps.find(r => r.name === rowName);
  if (!row) return null;

  const x = Number(ltv);
  const termKey = termBucket === '<=15' ? '<=15' : '>15';

  // Low range: no cap
  if (x >= row.lowRange[0] && x <= row.lowRange[1]) return null;

  // Mid range: cap applies
  if (x >= row.midRange[0] && x <= row.midRange[1]) return row.midCap[termKey];

  // High range: cap applies
  if (x > row.highThreshold) return row.highCap[termKey];

  return null;
}

function push(list, name, points, reason) {
  list.push({ name, points: Number(points), reason });
}
