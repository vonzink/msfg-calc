/* =====================================================
   MSFG Calculator Suite — Shared Utilities
   ===================================================== */
'use strict';

const MSFG = window.MSFG || {};

MSFG.parseNum = function(val) {
  if (typeof val === 'string') val = val.replace(/[,$]/g, '');
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

MSFG.parseNumById = function(id) {
  const el = document.getElementById(id);
  return el ? MSFG.parseNum(el.value) : 0;
};

MSFG.formatCurrency = function(amount, decimals) {
  if (typeof decimals === 'undefined') decimals = 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount);
};

MSFG.formatPercent = function(rate, decimals) {
  if (typeof decimals === 'undefined') decimals = 3;
  return rate.toFixed(decimals) + '%';
};

MSFG.formatNumber = function(num, decimals) {
  if (typeof decimals === 'undefined') decimals = 0;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
};

/* Monthly payment using standard mortgage formula */
MSFG.calcMonthlyPayment = function(principal, annualRate, years) {
  if (principal <= 0 || years <= 0) return 0;
  if (annualRate === 0) return principal / (years * 12);
  const r = annualRate / 12;
  const n = years * 12;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
};

/* Toggle show-calculations section */
MSFG.toggleCalcSteps = function(calcId) {
  const body = document.getElementById('calcSteps-' + calcId);
  const chevron = document.getElementById('calcStepsChevron-' + calcId);
  const label = document.getElementById('calcStepsLabel-' + calcId);

  if (body.classList.contains('open')) {
    body.classList.remove('open');
    chevron.classList.remove('open');
    label.textContent = 'Show Calculations';
  } else {
    body.classList.add('open');
    chevron.classList.add('open');
    label.textContent = 'Hide Calculations';
  }
};

/* Mobile menu toggle + calc metadata from data attributes */
document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('mobileMenuToggle');
  if (toggle) {
    toggle.addEventListener('click', function() {
      const nav = document.querySelector('.site-header__nav');
      if (nav) nav.classList.toggle('open');
    });
  }

  // Delegated handler for show-calculations toggle buttons (replaces inline onclick)
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-action="toggle-calc-steps"]');
    if (btn) MSFG.toggleCalcSteps(btn.dataset.calcId);
  });

  // Remove .mismo-populated glow when user manually edits a field
  document.addEventListener('input', function(e) {
    if (e.isTrusted && e.target.classList && e.target.classList.contains('mismo-populated')) {
      e.target.classList.remove('mismo-populated');
    }
  });
  document.addEventListener('change', function(e) {
    if (e.isTrusted && e.target.classList && e.target.classList.contains('mismo-populated')) {
      e.target.classList.remove('mismo-populated');
    }
  });

  // Read calculator metadata from data attributes (replaces inline script)
  const main = document.querySelector('.site-main');
  if (main) {
    if (main.dataset.calcIcon) window.__calcIcon = main.dataset.calcIcon;
    if (main.dataset.calcSlug) window.__calcSlug = main.dataset.calcSlug;
  }

  // Apply dynamic colors from data attributes (CSP-safe)
  document.querySelectorAll('[data-color]').forEach(function(el) {
    el.style.backgroundColor = el.dataset.color;
  });
  document.querySelectorAll('[data-border-color]').forEach(function(el) {
    el.style.borderLeftColor = el.dataset.borderColor;
  });
  document.querySelectorAll('[data-max-width]').forEach(function(el) {
    el.style.maxWidth = el.dataset.maxWidth + 'px';
  });
});

/* ---- Default-value helpers ---- */

/**
 * Mark all inputs/selects inside a container that still hold their initial
 * default value (value === defaultValue at page load) with the `.is-default` class.
 * Call once on DOMContentLoaded after the DOM is ready.
 * @param {string|Element} container — selector or element (default: document)
 */
MSFG.markDefaults = function(container) {
  const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
  if (!root) return;
  root.querySelectorAll('input[type="number"], input[type="text"], input[type="date"]').forEach(function(el) {
    // Skip hidden, readonly, or calculated fields
    if (el.readOnly || el.classList.contains('calculated-field') || el.type === 'hidden') return;
    // If value is empty or '0' or '0.00' etc, mark as default
    const v = el.value.trim();
    if (v === '' || v === '0' || v === '0.00' || v === '0.000' || v === '0.0') {
      el.classList.add('is-default');
    }
  });
};

/**
 * Clear the `.is-default` class from a single element (e.g. after MISMO populates it).
 * @param {string|Element} el — element or its ID
 */
MSFG.clearDefault = function(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (el) el.classList.remove('is-default');
};

/**
 * Bind delegated listeners so that typing into an `.is-default` field removes the class.
 * Call once on DOMContentLoaded.
 * @param {string|Element} container — selector or element (default: document)
 */
MSFG.bindDefaultClearing = function(container) {
  const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
  if (!root) return;
  root.addEventListener('input', function(e) {
    if (e.target.classList && e.target.classList.contains('is-default')) {
      e.target.classList.remove('is-default');
    }
  });
};

/**
 * Remove `.is-default` from every element inside a container.
 * Useful after MISMO fully populates all fields.
 * @param {string|Element} container — selector or element (default: document)
 */
MSFG.clearAllDefaults = function(container) {
  const root = typeof container === 'string' ? document.querySelector(container) : (container || document);
  if (!root) return;
  root.querySelectorAll('.is-default').forEach(function(el) {
    el.classList.remove('is-default');
  });
};

MSFG.escHtml = function(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

MSFG.el = function(id) { return document.getElementById(id); };
MSFG.qs = function(sel, ctx) { return (ctx || document).querySelector(sel); };
MSFG.qsa = function(sel, ctx) { return (ctx || document).querySelectorAll(sel); };
MSFG.daysBetween = function(d1, d2) { return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)); };

window.MSFG = MSFG;
