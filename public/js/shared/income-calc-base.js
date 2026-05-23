'use strict';

/* =====================================================
   Income Calculator Base Utilities
   — Shared helpers for all income calculators
   — Loaded after income-upload.js, before per-calc JS
   ===================================================== */

MSFG.IncomeCalc = (function () {

  const fmt = MSFG.formatCurrency;

  // ---- Field helpers ----

  /** Set a DOM input value by ID (replaces per-calc setField) */
  function setField(id, value) {
    const el = document.getElementById(id);
    if (el && value !== null && value !== undefined) {
      el.value = value || 0;
    }
  }

  // ---- Policy calculation ----

  /**
   * Standard 2-year income averaging policy.
   *
   * - If year2 === 0, returns year1 / 12 regardless of caller intent.
   *   Callers that distinguish "no Y2 data" from "Y2 data summing to zero"
   *   must pre-filter and pass 0 explicitly when no Y2 data exists.
   * - If year2 is non-zero AND year1 > year2, returns (year1 + year2) / 24.
   * - Otherwise returns year1 / 12.
   *
   * @param {number} year1 - Most recent year total
   * @param {number} year2 - Prior year total (0 if not provided)
   * @returns {{ monthly: number, method: 'average'|'recent', formula: string }}
   */
  function policyCalc(year1, year2) {
    const hasYr2 = year2 !== 0;
    if (hasYr2 && year1 > year2) {
      const monthly = (year1 + year2) / 24;
      return {
        monthly,
        method: 'average',
        formula: '(' + fmt(year1) + ' + ' + fmt(year2) + ') / 24 = ' + fmt(monthly)
      };
    }
    const monthly = year1 / 12;
    return {
      monthly,
      method: 'recent',
      formula: fmt(year1) + ' / 12 = ' + fmt(monthly)
    };
  }

  /**
   * Human-readable label for the averaging method.
   * @param {string} method - 'average' or 'recent'
   * @returns {string}
   */
  function methodLabel(method) {
    return method === 'average'
      ? '24-month average (Year 1 > Year 2)'
      : 'Year 1 / 12';
  }

  // ---- Result display ----

  /**
   * Return the CSS class to apply to a monthly-result display element
   * based on the sign of its value. Treats 0 as positive.
   *
   * @param {number} value
   * @returns {'income-result--negative'|'income-result--positive'}
   */
  function resultClass(value) {
    return value < 0 ? 'income-result--negative' : 'income-result--positive';
  }

  /**
   * Set a result-display element's text and signed-color class in one call.
   * Safe to call with a missing element (no-op).
   *
   * @param {string|HTMLElement} idOrEl - Element ID or DOM node
   * @param {number} value - Numeric value to display (formatted via formatCurrency)
   */
  function setResult(idOrEl, value) {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return;
    el.textContent = fmt(value);
    el.classList.remove('income-result--negative', 'income-result--positive');
    el.classList.add(resultClass(value));
  }

  // ---- CSV export ----

  /**
   * Download a CSV file from a rows array.
   * Each row is an array of cell values.
   *
   * @param {Array[]} rows - 2D array of cell values
   * @param {string} filenamePrefix - e.g. 'schedule-d-income-'
   */
  function downloadCSV(rows, filenamePrefix) {
    const csv = rows.map(row =>
      row.map(cell => '"' + cell + '"').join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenamePrefix + Date.now() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Clear all ----

  /**
   * Reset calculator to default state.
   * Clears doc store, resets inputs, resets upload zone, recalculates.
   *
   * @param {Function} calculateFn - The calculator's calculate() function
   * @param {Object} [defaults] - Map of input ID → default value for non-zero defaults
   *                              e.g. { methodA_months: '12' }
   *                              Also supports pattern keys prefixed with '*':
   *                              e.g. { '*owner': '100' } matches any ID containing 'owner'
   */
  function clearAll(calculateFn, defaults) {
    IncomeUpload.setDocStore([]);
    IncomeUpload.renderDocCards();

    const defs = defaults || {};
    const patterns = {};
    const exact = {};

    // Separate pattern-based vs exact defaults
    Object.keys(defs).forEach(key => {
      if (key.charAt(0) === '*') {
        patterns[key.substring(1)] = defs[key];
      } else {
        exact[key] = defs[key];
      }
    });

    document.querySelectorAll('input[type="number"]').forEach(input => {
      // Check exact match first
      if (exact[input.id] !== undefined) {
        input.value = exact[input.id];
        return;
      }
      // Check pattern matches
      const patternKeys = Object.keys(patterns);
      for (let i = 0; i < patternKeys.length; i++) {
        if (input.id.indexOf(patternKeys[i]) !== -1) {
          input.value = patterns[patternKeys[i]];
          return;
        }
      }
      // Default to 0
      input.value = '0';
    });

    IncomeUpload.resetZone();
    if (calculateFn) calculateFn();
  }

  // ---- Email data provider ----

  /**
   * Register the standard CalcActions email data provider.
   * Gathers form-row inputs and total-row values for email summary.
   */
  function registerEmailProvider() {
    if (!MSFG.CalcActions) return;
    MSFG.CalcActions.register(() => {
      const title = document.querySelector('.calc-page__header h1');
      const sections = [];

      // Gather all form-row data
      const formRows = [];
      document.querySelectorAll('.form-row').forEach(row => {
        const label = row.querySelector('label');
        const input = row.querySelector('input, select');
        if (label && input) {
          const val = input.value;
          if (val && val !== '0' && val !== '') {
            formRows.push({
              label: label.textContent.trim(),
              value: '$' + parseFloat(val || 0).toLocaleString()
            });
          }
        }
      });
      if (formRows.length) sections.push({ heading: 'Income Details', rows: formRows });

      // Gather total rows
      const totalRows = [];
      document.querySelectorAll('.total-row').forEach(row => {
        const label = row.querySelector('label');
        const val = row.querySelector('.total-value');
        if (label && val) {
          totalRows.push({
            label: label.textContent.trim(),
            value: val.textContent.trim(),
            isTotal: true
          });
        }
      });
      if (totalRows.length) sections.push({ heading: 'Results', rows: totalRows });

      return {
        title: title ? title.textContent.trim() : 'Income Calculator',
        sections
      };
    });
  }

  // ---- Page initialization ----

  /**
   * Standard init tail for income calculator pages.
   * Marks defaults, binds default-clearing, runs initial calc,
   * and registers the email data provider.
   *
   * @param {Function} calculateFn - The calculator's calculate() function
   */
  function initPage(calculateFn) {
    MSFG.markDefaults('.calc-page');
    MSFG.bindDefaultClearing('.calc-page');
    if (calculateFn) calculateFn();
    registerEmailProvider();
  }

  // ---- Public API ----

  return {
    setField,
    policyCalc,
    methodLabel,
    downloadCSV,
    clearAll,
    registerEmailProvider,
    initPage,
    resultClass,
    setResult
  };

})();
