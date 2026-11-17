/**
 * Fannie Mae LLPA engine — classic-script port of legacy/llpm-calc/pricing-engine.js.
 * Reads MSFG.LLPA_MATRIX (public/js/shared/llpa-matrix.js) and exposes MSFG.LLPA.calcLLPAs(input).
 *
 * - All values are in points (0.375 = 0.375 points of the loan amount).
 * - Base table is a credit-score × LTV lookup per purpose (purchase / limited cash-out / cash-out).
 * - Attribute LLPAs are feature × LTV lookups per purpose.
 * - High LTV Refinance caps apply to the base + attribute subtotal only.
 * - Waivers (HomeReady, first-time homebuyer, Duty to Serve) remove everything except the minimum-MI option.
 *
 * input: { loanAmount, propertyValue, creditScore, termYears, purpose ('Purchase'|'LimitedCashOut'|'CashOut'),
 *          productType ('Fixed'|'ARM'), occupancy ('Primary'|'SecondHome'|'Investment'), units ('1'..'4'),
 *          isCondo, isManufacturedHome, isHighBalance, hasSubordinateFinancing, applyMMI, baseLTVForMMI,
 *          isHighLTVRefi, waiverHomeReady, waiverFirstTimeHB, waiverDutyToServe }
 * returns: { grossLTV, baseLTVForMMI, termBucket, purposeKey, breakdown:[{name, points, reason}], totalPoints, warnings }
 */
/* global globalThis */
(function() {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.MSFG = root.MSFG || {};
  const MATRIX = () => root.MSFG.LLPA_MATRIX;

  function calcLLPAs(input) {
    const M = MATRIX();
    if (!M) throw new Error('MSFG.LLPA_MATRIX is not loaded; include shared/llpa-matrix.js first');
    const warnings = [];
    const breakdown = [];

    const grossLTV = input.propertyValue > 0 ? (input.loanAmount / input.propertyValue) * 100 : 0;
    const baseLTVForMMI = (typeof input.baseLTVForMMI === 'number' && input.baseLTVForMMI > 0) ? input.baseLTVForMMI : grossLTV;
    const termBucket = (input.termYears && input.termYears <= 15) ? '<=15' : '>15';
    const purposeKey = purposeToKey(input.purpose);

    // Base LLPA: purchase and limited cash-out tables are zero for terms of 15 years or less; cash-out keeps its table.
    const zeroBaseForShortTerm = termBucket === '<=15' && (purposeKey === 'purchase' || purposeKey === 'limitedCashOut');
    const base = zeroBaseForShortTerm ? 0 : lookup2D(M.base[purposeKey], input.creditScore, grossLTV);
    if (base !== 0) push(breakdown, 'Base LLPA (Credit Score × LTV)', base, labelPurpose(purposeKey) + ' base table');

    let attrsTotal = 0;
    const addFeature = (feature, label, reason) => {
      const v = lookupFeature(M, purposeKey, feature, grossLTV);
      attrsTotal += v;
      if (v !== 0) push(breakdown, label, v, reason || 'Additional LLPAs by loan attribute');
    };
    if (input.productType === 'ARM') addFeature('Adjustable-rate mortgage', 'Adjustable-rate mortgage');
    if (input.isCondo) addFeature('Condo1', 'Condo');
    if (input.isManufacturedHome) addFeature('Manufactured home2', 'Manufactured home', 'Additional LLPAs by loan attribute (SFC 235)');
    if (input.occupancy === 'SecondHome') addFeature('Second home', 'Second home');
    else if (input.occupancy === 'Investment') addFeature('Investment property', 'Investment property');
    if (input.units && parseInt(input.units, 10) >= 2) addFeature('Two- to four-unit property', 'Two- to four-unit property');
    if (input.isHighBalance) {
      const feature = input.productType === 'ARM' ? 'High-balance ARM' : 'High-balance fixed-rate';
      addFeature(feature, feature, 'Additional LLPAs by loan attribute (SFC 808)');
    }
    if (input.hasSubordinateFinancing) addFeature('Subordinate financing3', 'Subordinate financing');

    // High LTV Refinance cap on the base + attribute subtotal (minimum-MI is outside the cap).
    let cappedSubtotal = base + attrsTotal;
    if (input.isHighLTVRefi) {
      const cap = getHighLtvRefiCap(M, { occupancy: input.occupancy, units: input.units, ltv: grossLTV, termBucket });
      if (cap !== null && cappedSubtotal > cap) {
        push(breakdown, 'High LTV Refinance cap waiver', cap - cappedSubtotal, 'Cap applied: ' + cap.toFixed(3) + ' (Tables 1–3 only)');
        cappedSubtotal = cap;
      }
    }

    // Waivers remove all LLPAs except the minimum-MI option.
    const waiverFlags = [];
    if (input.waiverHomeReady) waiverFlags.push('HomeReady®');
    if (input.waiverFirstTimeHB) waiverFlags.push('First-time homebuyer');
    if (input.waiverDutyToServe) waiverFlags.push('Duty to Serve');
    let waivedSubtotal = cappedSubtotal;
    if (waiverFlags.length && waivedSubtotal !== 0) {
      push(breakdown, 'LLPA Waiver (' + waiverFlags.join(' + ') + ')', -waivedSubtotal, 'Waives all LLPAs except MMI');
      waivedSubtotal = 0;
    }

    // Minimum mortgage insurance coverage option: priced on base/net LTV; not available on High LTV Refinance.
    let mmiPoints = 0;
    if (input.applyMMI && !input.isHighLTVRefi) {
      mmiPoints = lookupMMI(M, input.creditScore, baseLTVForMMI);
      if (mmiPoints !== 0) push(breakdown, 'Minimum MI coverage option', mmiPoints, 'Based on base/net LTV: ' + baseLTVForMMI.toFixed(2) + '%');
    } else if (input.applyMMI && input.isHighLTVRefi) {
      warnings.push('MMI is not applicable to High LTV Refinance per the matrix.');
    }

    return {
      grossLTV, baseLTVForMMI, termBucket, purposeKey, breakdown,
      totalPoints: waivedSubtotal + mmiPoints,
      warnings
    };
  }

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
    if (columns.indexOf('<=30') >= 0 || columns.indexOf('<=30.00') >= 0 || columns.indexOf('<=30.00%') >= 0) {
      // cash-out tables stop at 80
      if (x <= 30) return '<=30';
      if (x <= 60) return '30.01-60';
      if (x <= 70) return '60.01-70';
      if (x <= 75) return '70.01-75';
      return '75.01-80';
    }
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
  const cell = (row, key) => (row && row[key] !== undefined && row[key] !== null) ? Number(row[key]) : 0;
  function lookup2D(table, creditScore, ltv) {
    const row = table && table[creditScoreBucket(creditScore)];
    if (!row) return 0;
    return cell(row, ltvBucket(ltv, Object.keys(row)));
  }
  function lookupFeature(M, purposeKey, featureName, ltv) {
    const t = M.attributes[purposeKey];
    const row = t && t[featureName];
    if (!row) return 0;
    return cell(row, ltvBucket(ltv, Object.keys(row)));
  }
  function lookupMMI(M, creditScore, baseLTV) {
    const ltv = Number(baseLTV);
    if (!(ltv > 80 && ltv <= 97)) return 0;
    const cs = Number(creditScore);
    let rowKey;
    if (cs >= 740) rowKey = '>740';
    else if (cs >= 720) rowKey = '720 - 739';
    else if (cs >= 700) rowKey = '700 - 719';
    else if (cs >= 680) rowKey = '680 - 699';
    else if (cs >= 660) rowKey = '660 - 679';
    else if (cs >= 640) rowKey = '640 - 659';
    else if (cs >= 620) rowKey = '620 - 639';
    else rowKey = '< 620';
    const row = M.mmi[rowKey];
    if (!row) return 0;
    const colKey = ltv <= 85 ? '80.01-85' : ltv <= 90 ? '85.01-90' : ltv <= 95 ? '90.01-95' : '95.01-97';
    return cell(row, colKey);
  }
  function getHighLtvRefiCap(M, o) {
    const u = parseInt(o.units || '1', 10);
    const occ = o.occupancy || 'Primary';
    let rowName = null;
    if (occ === 'Primary') rowName = u === 1 ? 'Principal residence 1 unit' : u === 2 ? 'Principal residence 2 units' : 'Principal residence 3-4 units';
    else if (occ === 'SecondHome') rowName = 'Second home 1 unit';
    else if (occ === 'Investment') rowName = 'Investment property 1-4 units';
    const row = M.highLtvRefiCaps.find(r => r.name === rowName);
    if (!row) return null;
    const x = Number(o.ltv);
    const termKey = o.termBucket === '<=15' ? '<=15' : '>15';
    if (x >= row.lowRange[0] && x <= row.lowRange[1]) return null;
    if (x >= row.midRange[0] && x <= row.midRange[1]) return row.midCap[termKey];
    if (x > row.highThreshold) return row.highCap[termKey];
    return null;
  }
  function push(list, name, points, reason) { list.push({ name, points: Number(points), reason }); }

  root.MSFG.LLPA = { calcLLPAs, creditScoreBucket, ltvBucket, version: () => (MATRIX() ? MATRIX().version : null) };
})();
