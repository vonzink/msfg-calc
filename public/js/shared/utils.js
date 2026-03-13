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

  // Read calculator metadata from data attributes (replaces inline script)
  const main = document.querySelector('.site-main');
  if (main) {
    if (main.dataset.calcIcon) window.__calcIcon = main.dataset.calcIcon;
    if (main.dataset.calcSlug) window.__calcSlug = main.dataset.calcSlug;
  }
});

MSFG.escHtml = function(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

window.MSFG = MSFG;
