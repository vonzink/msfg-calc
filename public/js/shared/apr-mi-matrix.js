/* =====================================================
   APR Conventional MI Matrix
   Borrower-Paid Monthly BPMI factors (annualized %).
   Source: Arch MI — Borrower-Paid Monthly, Non-Refundable
   Annualized BPMI Rates, Fixed, Standard Fannie/Freddie
   coverage. Effective Feb 9, 2026.

   Monthly MI = (annualized factor / 12) * loan balance.
   Factors vary by amortization term bucket, LTV band, and
   credit-score band. Defaults are editable; user edits are
   persisted to localStorage and restored via reset().
   ===================================================== */
(function () {
  'use strict';

  const LS_KEY = 'msfg-apr-mi-matrix';

  // Credit-score columns, high → low. `min` is the inclusive floor for the band.
  const CREDIT_BANDS = [
    { key: '760+',    label: '760+',    min: 760 },
    { key: '740-759', label: '740–759', min: 740 },
    { key: '720-739', label: '720–739', min: 720 },
    { key: '700-719', label: '700–719', min: 700 },
    { key: '680-699', label: '680–699', min: 680 },
    { key: '660-679', label: '660–679', min: 660 },
    { key: '640-659', label: '640–659', min: 640 },
    { key: '620-639', label: '620–639', min: 620 },
    { key: '<620',    label: '<620',    min: 0 }
  ];

  // LTV rows, high → low (for display). `max` is the inclusive ceiling for the band.
  const LTV_BANDS = [
    { key: '95.01-97', label: '95.01–97%', max: 0.97 },
    { key: '90.01-95', label: '90.01–95%', max: 0.95 },
    { key: '85.01-90', label: '85.01–90%', max: 0.90 },
    { key: '80.01-85', label: '80.01–85%', max: 0.85 }
  ];

  // Below this LTV no borrower-paid MI applies.
  const FLOOR_LTV = 0.80;
  // Assumed credit band when no score is entered (740–759).
  const DEFAULT_CREDIT_INDEX = 1;

  const TERM_BUCKETS = [
    { key: 'gt20', label: 'Term > 20 yrs (30 & 25-yr)' },
    { key: 'le20', label: 'Term ≤ 20 yrs (20, 15 & 10-yr)' }
  ];

  // Annualized % factors. Each array is ordered to match CREDIT_BANDS.
  const DEFAULT_FACTORS = {
    gt20: {
      '95.01-97': [0.58, 0.70, 0.87, 0.99, 1.21, 1.54, 1.65, 1.86, 2.60],
      '90.01-95': [0.38, 0.53, 0.66, 0.78, 0.96, 1.28, 1.33, 1.42, 1.99],
      '85.01-90': [0.28, 0.38, 0.46, 0.55, 0.65, 0.90, 0.91, 1.04, 1.32],
      '80.01-85': [0.19, 0.20, 0.23, 0.25, 0.28, 0.38, 0.40, 0.44, 0.62]
    },
    le20: {
      '95.01-97': [0.40, 0.53, 0.68, 0.80, 1.01, 1.34, 1.51, 1.72, 2.41],
      '90.01-95': [0.32, 0.43, 0.52, 0.62, 0.77, 0.95, 1.08, 1.27, 1.78],
      '85.01-90': [0.25, 0.31, 0.37, 0.44, 0.51, 0.66, 0.74, 0.89, 1.25],
      '80.01-85': [0.17, 0.19, 0.23, 0.23, 0.26, 0.32, 0.34, 0.41, 0.57]
    }
  };

  function cloneDefaults() {
    const out = {};
    Object.keys(DEFAULT_FACTORS).forEach(function (bucket) {
      out[bucket] = {};
      Object.keys(DEFAULT_FACTORS[bucket]).forEach(function (ltvKey) {
        out[bucket][ltvKey] = DEFAULT_FACTORS[bucket][ltvKey].slice();
      });
    });
    return out;
  }

  // Returns the active matrix: a saved override if present and well-shaped,
  // otherwise the Arch defaults.
  function getFactors() {
    let saved = null;
    try {
      const raw = (typeof localStorage !== 'undefined') && localStorage.getItem(LS_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (_) { saved = null; }

    const matrix = cloneDefaults();
    if (saved && typeof saved === 'object') {
      // Overlay only valid numeric cells so a partial/old save can't break lookups.
      Object.keys(matrix).forEach(function (bucket) {
        Object.keys(matrix[bucket]).forEach(function (ltvKey) {
          const row = saved[bucket] && saved[bucket][ltvKey];
          if (Array.isArray(row)) {
            row.forEach(function (v, i) {
              if (typeof v === 'number' && isFinite(v) && v >= 0 && i < matrix[bucket][ltvKey].length) {
                matrix[bucket][ltvKey][i] = v;
              }
            });
          }
        });
      });
    }
    return matrix;
  }

  function isCustomized() {
    try {
      return !!(typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY));
    } catch (_) { return false; }
  }

  function setCell(bucket, ltvKey, creditIndex, value) {
    const matrix = getFactors();
    if (!matrix[bucket] || !matrix[bucket][ltvKey]) return;
    matrix[bucket][ltvKey][creditIndex] = value;
    try { localStorage.setItem(LS_KEY, JSON.stringify(matrix)); } catch (_) { /* ignore */ }
  }

  function reset() {
    try { localStorage.removeItem(LS_KEY); } catch (_) { /* ignore */ }
  }

  function termBucket(termYears) {
    return termYears > 20 ? 'gt20' : 'le20';
  }

  function ltvBandKey(ltv) {
    if (ltv <= 0.85) return '80.01-85';
    if (ltv <= 0.90) return '85.01-90';
    if (ltv <= 0.95) return '90.01-95';
    return '95.01-97';
  }

  function creditIndex(creditScore) {
    const s = Number(creditScore);
    if (!isFinite(s) || s < 300) return DEFAULT_CREDIT_INDEX;
    for (let i = 0; i < CREDIT_BANDS.length; i++) {
      if (s >= CREDIT_BANDS[i].min) return i;
    }
    return CREDIT_BANDS.length - 1;
  }

  // Returns the monthly MI *decimal* annual factor (e.g. 0.0058), or 0 when
  // LTV is at/below the 80% floor.
  function lookup(opts) {
    const ltv = opts.ltv;
    if (!(ltv > FLOOR_LTV)) return 0;
    const bucket = termBucket(opts.termYears);
    const ltvKey = ltvBandKey(ltv);
    const ci = creditIndex(opts.creditScore);
    const matrix = getFactors();
    const pct = matrix[bucket] && matrix[bucket][ltvKey] ? matrix[bucket][ltvKey][ci] : 0;
    return (typeof pct === 'number' ? pct : 0) / 100;
  }

  // True when a valid score was supplied; false → caller used the assumed band.
  function hasScore(creditScore) {
    const s = Number(creditScore);
    return isFinite(s) && s >= 300;
  }

  window.MSFG = window.MSFG || {};
  window.MSFG.AprMiMatrix = {
    CREDIT_BANDS: CREDIT_BANDS,
    LTV_BANDS: LTV_BANDS,
    TERM_BUCKETS: TERM_BUCKETS,
    DEFAULT_CREDIT_INDEX: DEFAULT_CREDIT_INDEX,
    FLOOR_LTV: FLOOR_LTV,
    getFactors: getFactors,
    isCustomized: isCustomized,
    setCell: setCell,
    reset: reset,
    lookup: lookup,
    hasScore: hasScore,
    termBucket: termBucket,
    ltvBandKey: ltvBandKey,
    creditIndex: creditIndex
  };
})();
