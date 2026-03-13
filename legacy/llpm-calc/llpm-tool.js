import { calcLLPAs } from './pricing-engine.js';

const $ = (sel) => document.querySelector(sel);

function fmtPts(n) {
  if (n == null || Number.isNaN(n)) return '0.000';
  return Number(n).toFixed(3);
}

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return '$0';
  const abs = Math.abs(Number(n));
  const prefix = n < 0 ? '-$' : '$';
  return prefix + abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function readNumber(id) {
  const el = $(id);
  if (!el) return 0;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : 0;
}

function readBool(id) {
  return !!$(id)?.checked;
}

function readRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}

function getState() {
  return {
    baseRate: readNumber('#baseRate'),
    startingPoints: readNumber('#startingPoints'),
    loanAmount: readNumber('#loanAmount'),
    propertyValue: readNumber('#propertyValue'),
    baseLTVForMMI: readNumber('#baseLTVForMMI'),
    creditScore: readNumber('#creditScore'),
    termYears: readNumber('#termYears'),
    purpose: readRadio('purpose'),
    productType: readRadio('productType'),
    occupancy: readRadio('occupancy'),
    units: $('#units')?.value || '1',
    isCondo: readBool('#isCondo'),
    isManufacturedHome: readBool('#isManufacturedHome'),
    isHighBalance: readBool('#isHighBalance'),
    hasSubordinateFinancing: readBool('#hasSubordinateFinancing'),
    applyMMI: readBool('#applyMMI'),
    isHighLTVRefi: readBool('#isHighLTVRefi'),
    waiverHomeReady: readBool('#waiverHomeReady'),
    waiverFirstTimeHB: readBool('#waiverFirstTimeHB'),
    waiverDutyToServe: readBool('#waiverDutyToServe')
  };
}

function render(results, state) {
  $('#chipLTV').innerHTML = `Gross LTV: <strong>${results.grossLTV.toFixed(2)}%</strong>`;
  $('#chipTotal').innerHTML = `Total LLPAs: <strong>${fmtPts(results.totalPoints)}</strong>`;

  const finalPoints = state.startingPoints + results.totalPoints;
  const finalPrice = 100 - finalPoints;
  const dollarImpact = state.loanAmount * (finalPoints / 100);

  $('#kvFinalPoints').textContent = fmtPts(finalPoints);
  $('#kvFinalPrice').textContent = fmtPts(finalPrice);
  $('#kvDollarImpact').textContent = fmtMoney(dollarImpact);

  const tbody = $('#breakdownTable tbody');
  tbody.innerHTML = '';
  if (!results.breakdown.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="muted center">No adjustments</td></tr>`;
  } else {
    for (const row of results.breakdown) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(row.name)}</td>
        <td class="right">${fmtPts(row.points)}</td>
        <td class="muted">${escapeHtml(row.reason || '')}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  const warnBox = $('#warnings');
  if (results.warnings?.length) {
    warnBox.style.display = 'block';
    warnBox.innerHTML = `<strong>Heads up:</strong><ul>${results.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
  } else {
    warnBox.style.display = 'none';
    warnBox.innerHTML = '';
  }

  // UI logic: show MMI toggle only when base LTV > 80 (gross OR provided base LTV)
  const mmiGuard = (results.baseLTVForMMI > 80 && results.baseLTVForMMI <= 97);
  $('#mmiRow').style.display = mmiGuard ? 'flex' : 'none';

  // Show High LTV refi toggle only for limited cash-out (typical)
  const showHL = (state.purpose === 'LimitedCashOut');
  $('#hlvrRow').style.display = showHL ? 'flex' : 'none';
  if (!showHL) $('#isHighLTVRefi').checked = false;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function update() {
  const state = getState();
  const results = calcLLPAs(state);
  render(results, state);
}

function wire() {
  document.addEventListener('input', (e) => {
    if (e.target.matches('input, select')) update();
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches('input, select')) update();
  });

  // Action buttons (useful when browser/module caching gets sticky)
  $('#btnRecalc')?.addEventListener('click', (e) => {
    e.preventDefault();
    update();
  });

  $('#btnReset')?.addEventListener('click', (e) => {
    e.preventDefault();
    const form = $('#llpmForm');
    if (form) form.reset();
    // Ensure conditional rows update too
    update();
  });

  update();
}

wire();


// Debug helper
window.LLPM = { update };
