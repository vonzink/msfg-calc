/**
 * MSFG Batch LLPM Pricing Tool
 *
 * Runs Fannie Mae LLPA matrix adjustments (Conventional only) on multiple
 * borrowers from CSV/Excel. Uses the same pricing-engine.js that powers
 * the single-loan LLPM tool.
 *
 * @version 1.0.0
 */

import { calcLLPAs } from '/calculators/llpm/pricing-engine.js';

// ============= DOM HELPERS =============

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============= FORMATTERS =============

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '$0';
  const abs = Math.abs(n);
  const prefix = n < 0 ? '-$' : '$';
  return prefix + abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPercent(n, decimals = 3) {
  if (n == null || isNaN(n)) return '0.000%';
  return n.toFixed(decimals) + '%';
}

function fmtPoints(n) {
  if (n == null || isNaN(n)) return '0.000';
  return n.toFixed(3);
}

function parseMoney(str) {
  if (typeof str === 'number') return str;
  return parseFloat(String(str).replace(/[$,]/g, '')) || 0;
}

function parseRate(str) {
  if (typeof str === 'number') {
    return (str > 0 && str < 1) ? str * 100 : str;
  }
  const cleaned = String(str).replace(/%/g, '').trim();
  const parsed = parseFloat(cleaned) || 0;
  return (parsed > 0 && parsed < 1) ? parsed * 100 : parsed;
}

function parseBoolean(str) {
  if (typeof str === 'boolean') return str;
  if (typeof str === 'number') return str === 1;
  const s = String(str).trim().toLowerCase();
  return ['yes', 'y', 'true', '1', 'x'].includes(s);
}

// ============= PAYMENT CALCULATION =============

function calcMonthlyPayment(principal, annualRate, years = 30) {
  if (principal <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function estimateRateFromPayment(principal, payment, years = 30) {
  if (principal <= 0 || payment <= 0) return 0;
  let rate = 6.0;
  for (let i = 0; i < 150; i++) {
    const calc = calcMonthlyPayment(principal, rate, years);
    const diff = calc - payment;
    if (Math.abs(diff) < 0.5) return rate;
    rate += (diff > 0) ? -0.005 : 0.005;
    if (rate < 0.1) rate = 0.1;
  }
  return rate;
}

// ============= FILE PARSING =============

let rawRows = [];
let mappedData = [];

function parseCSV(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length) throw new Error('File is empty');

  function splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    if (vals.length < 2) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function parseExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (!data.length) throw new Error('File is empty');

  const headers = data[0].map((h) => String(h || '').trim());
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i] || data[i].length === 0) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = data[i][idx] != null ? String(data[i][idx]).trim() : '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

// ============= COLUMN MAPPING =============

const FIELD_DEFS = [
  { key: 'clientName',    label: 'Client Name',           required: true,  pattern: /^(client|name|borrower|customer).*name/i },
  { key: 'loanAmount',    label: 'Loan Amount',            required: true,  pattern: /^(loan.*amount|amount|principal)/i },
  { key: 'propertyValue', label: 'Property Value',         required: true,  pattern: /^(property.*value|home.*value|value|appraisal)/i },
  { key: 'creditScore',   label: 'Credit Score',           required: true,  pattern: /^(credit.*score|fico|score)/i },
  { key: 'purpose',       label: 'Loan Purpose',           required: false, pattern: /^(purpose|loan.*purpose|transaction)/i },
  { key: 'productType',   label: 'Product Type',           required: false, pattern: /^(product.*type|product|mortgage.*type)/i },
  { key: 'occupancy',     label: 'Occupancy',              required: false, pattern: /^(occupancy|occupancy.*type)/i },
  { key: 'propertyType',  label: 'Property Type',          required: false, pattern: /^(property.*type|home.*type|type)/i },
  { key: 'units',         label: 'Units',                  required: false, pattern: /^(units|number.*units|num.*units)/i },
  { key: 'termYears',     label: 'Loan Term (years)',       required: false, pattern: /^(term|loan.*term|years)/i },
  { key: 'highBalance',   label: 'High Balance (Y/N)',      required: false, pattern: /^(high.*balance|super.*conform)/i },
  { key: 'subFinancing',  label: 'Subordinate Financing',   required: false, pattern: /^(sub.*financ|second.*lien)/i },
  { key: 'currentRate',   label: 'Current Rate',            required: true,  pattern: /^(old.*rate|current.*rate|note.*rate|rate|interest.*rate|existing.*rate)/i },
  { key: 'currentPayment',label: 'Current Payment',         required: true,  pattern: /^(current.*payment|payment|monthly.*payment)/i },
];

function autoDetectMapping(headers) {
  const mapping = {};
  headers.forEach((header) => {
    const norm = header.toLowerCase().trim();
    for (const def of FIELD_DEFS) {
      if (def.pattern.test(norm) && !mapping[def.key]) {
        mapping[def.key] = header;
        break;
      }
    }
  });
  return mapping;
}

function renderColumnMapping(headers, autoMapping) {
  const grid = $('#mappingGrid');
  grid.innerHTML = '';

  FIELD_DEFS.forEach((def) => {
    const div = document.createElement('div');
    div.className = 'mapping-item';

    const label = document.createElement('label');
    label.textContent = def.label + (def.required ? ' *' : '');

    const select = document.createElement('select');
    select.id = `map-${def.key}`;

    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— Not Mapped —';
    select.appendChild(opt0);

    headers.forEach((h) => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      if (autoMapping[def.key] === h) opt.selected = true;
      select.appendChild(opt);
    });

    div.appendChild(label);
    div.appendChild(select);
    grid.appendChild(div);
  });
}

function getCurrentMapping() {
  const mapping = {};
  FIELD_DEFS.forEach((def) => {
    const sel = $(`#map-${def.key}`);
    if (sel && sel.value) mapping[def.key] = sel.value;
  });
  return mapping;
}

// ============= DATA TRANSFORMATION =============

function normalizePurpose(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (/purchase/.test(s)) return 'Purchase';
  if (/cash.?out/.test(s) && !/limited/.test(s)) return 'CashOut';
  if (/limited|rate.?term|refi/.test(s)) return 'LimitedCashOut';
  return 'Purchase';
}

function normalizeOccupancy(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (/invest/.test(s)) return 'Investment';
  if (/second/.test(s)) return 'SecondHome';
  return 'Primary';
}

function normalizeProductType(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (/arm|adjust/.test(s)) return 'ARM';
  return 'Fixed';
}

function transformRow(row, mapping) {
  const loanAmount = parseMoney(row[mapping.loanAmount] || 0);
  const propertyValue = parseMoney(row[mapping.propertyValue] || 0);
  const creditScoreRaw = parseInt(row[mapping.creditScore] || '780');
  const creditScore = isNaN(creditScoreRaw) ? 780 : creditScoreRaw;
  const currentPayment = parseMoney(row[mapping.currentPayment] || 0);
  const rawRate = mapping.currentRate ? parseRate(row[mapping.currentRate]) : null;
  const currentRate = rawRate != null && rawRate > 0 && rawRate < 25 ? rawRate : null;
  const termYears = parseInt(row[mapping.termYears] || '30') || 30;

  const purposeRaw = mapping.purpose ? row[mapping.purpose] : '';
  const propertyTypeRaw = String(row[mapping.propertyType] || '').trim().toLowerCase();

  return {
    clientName: row[mapping.clientName] || 'Unknown',
    loanAmount,
    propertyValue,
    creditScore,
    purpose: normalizePurpose(purposeRaw),
    productType: normalizeProductType(row[mapping.productType] || ''),
    occupancy: normalizeOccupancy(row[mapping.occupancy] || ''),
    isCondo: /condo/i.test(propertyTypeRaw),
    isManufacturedHome: /manufactur/i.test(propertyTypeRaw),
    units: String(row[mapping.units] || '1').trim(),
    termYears,
    isHighBalance: mapping.highBalance ? parseBoolean(row[mapping.highBalance]) : false,
    hasSubordinateFinancing: mapping.subFinancing ? parseBoolean(row[mapping.subFinancing]) : false,
    currentRate,
    currentPayment,
    propertyTypeRaw: row[mapping.propertyType] || 'SFR',
  };
}

// ============= BATCH CALCULATION =============

function processBatch(data, globalInputs) {
  return data.map((borrower) => {
    const purpose = globalInputs.loanPurpose || borrower.purpose;

    const engineInput = {
      loanAmount: borrower.loanAmount,
      propertyValue: borrower.propertyValue,
      creditScore: borrower.creditScore,
      purpose,
      productType: borrower.productType,
      occupancy: borrower.occupancy,
      isCondo: borrower.isCondo,
      isManufacturedHome: borrower.isManufacturedHome,
      units: borrower.units,
      termYears: borrower.termYears,
      isHighBalance: borrower.isHighBalance,
      hasSubordinateFinancing: borrower.hasSubordinateFinancing,
      isHighLTVRefi: false,
      waiverHomeReady: globalInputs.waiverHomeReady,
      waiverFirstTimeHB: globalInputs.waiverFirstTimeHB,
      waiverDutyToServe: globalInputs.waiverDutyToServe,
      applyMMI: globalInputs.applyMMI,
    };

    const result = calcLLPAs(engineInput);

    const baseRate = globalInputs.baseRate;
    const startingPoints = globalInputs.startingPoints;
    const finalPoints = startingPoints + result.totalPoints;
    const pointCost = borrower.loanAmount * (finalPoints / 100);

    let currentRate = borrower.currentRate;
    if (!currentRate && borrower.currentPayment > 0) {
      currentRate = estimateRateFromPayment(borrower.loanAmount, borrower.currentPayment, borrower.termYears);
    }

    const currentPayment = borrower.currentPayment || 0;
    const newPayment = calcMonthlyPayment(borrower.loanAmount, baseRate, borrower.termYears);
    const paymentDiff = currentPayment > 0 ? newPayment - currentPayment : 0;

    const breakEvenMonths = (pointCost > 0 && paymentDiff < 0)
      ? Math.abs(pointCost / paymentDiff)
      : null;

    const issues = [];
    if (borrower.loanAmount <= 0) issues.push('Missing loan amount');
    if (borrower.propertyValue <= 0) issues.push('Missing property value');
    if (currentPayment <= 0 && !borrower.currentRate) issues.push('Missing payment/rate');

    return {
      clientName: borrower.clientName,
      loanAmount: borrower.loanAmount,
      propertyValue: borrower.propertyValue,
      creditScore: borrower.creditScore,
      purpose,
      productType: borrower.productType,
      occupancy: borrower.occupancy,
      propertyTypeRaw: borrower.propertyTypeRaw,
      units: borrower.units,
      termYears: borrower.termYears,
      ltv: result.grossLTV,
      currentRate: currentRate || 0,
      currentPayment,
      adjustedRate: baseRate,
      newPayment,
      paymentDiff,
      totalPoints: result.totalPoints,
      finalPoints,
      pointCost,
      breakEvenMonths,
      breakdown: result.breakdown,
      warnings: result.warnings,
      dataQuality: { isComplete: issues.length === 0, issues },
    };
  });
}

// ============= UI: GLOBAL INPUTS =============

function getGlobalInputs() {
  const purposeEl = $('input[name="loanPurpose"]:checked');
  return {
    baseRate: parseFloat($('#baseRate').value) || 6.75,
    startingPoints: parseFloat($('#startingPoints').value) || 0,
    loanPurpose: purposeEl ? purposeEl.value : 'Purchase',
    waiverHomeReady: $('#waiverHomeReady').checked,
    waiverFirstTimeHB: $('#waiverFirstTimeHB').checked,
    waiverDutyToServe: $('#waiverDutyToServe').checked,
    applyMMI: $('#applyMMI').checked,
    breakEvenThreshold: parseInt($('#breakEvenThreshold').value) || 18,
  };
}

// ============= UI: STATS =============

function renderStats(results) {
  const total = results.length;
  const saving = results.filter((r) => r.paymentDiff < 0).length;
  const volume = results.reduce((s, r) => s + r.loanAmount, 0);
  const avgPts = total > 0 ? results.reduce((s, r) => s + r.totalPoints, 0) / total : 0;
  const avgPmtChange = total > 0 ? results.reduce((s, r) => s + r.paymentDiff, 0) / total : 0;

  $('#statTotal').textContent = total;
  $('#statSavings').textContent = saving;
  $('#statVolume').textContent = fmtMoney(volume);
  $('#statAvgPoints').textContent = fmtPoints(avgPts);

  const el = $('#statAvgPaymentChange');
  el.textContent = fmtMoney(avgPmtChange);
  el.classList.toggle('positive', avgPmtChange < 0);
  el.classList.toggle('negative', avgPmtChange > 0);
}

// ============= UI: RESULTS TABLE =============

let currentSort = { col: null, dir: 'asc' };
let currentResults = [];
let filteredResults = [];

function renderTable(results, filter = '') {
  filteredResults = results;

  if (filter) {
    const q = filter.toLowerCase();
    filteredResults = results.filter((r) => r.clientName.toLowerCase().includes(q));
  }

  if (currentSort.col) {
    filteredResults.sort((a, b) => {
      let aVal, bVal;
      if (currentSort.col === 'status') {
        aVal = a.dataQuality.isComplete ? 1 : 0;
        bVal = b.dataQuality.isComplete ? 1 : 0;
      } else {
        aVal = a[currentSort.col];
        bVal = b[currentSort.col];
      }
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); }
      if (aVal == null) aVal = 0;
      if (bVal == null) bVal = 0;
      return currentSort.dir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
  }

  const threshold = getGlobalInputs().breakEvenThreshold;
  const tbody = $('#resultsBody');
  tbody.innerHTML = '';

  filteredResults.forEach((r, idx) => {
    const tr = document.createElement('tr');
    const pmtClass = r.paymentDiff < 0 ? 'positive' : r.paymentDiff > 0 ? 'negative' : 'muted';
    const highlight = r.breakEvenMonths !== null && r.breakEvenMonths < threshold;
    if (highlight) tr.classList.add('break-even-highlight');

    const ok = r.dataQuality.isComplete;
    const statusTitle = ok ? 'Complete data' : r.dataQuality.issues.join(', ');

    tr.innerHTML = `
      <td class="${ok ? 'positive' : 'negative'}" title="${statusTitle}" style="text-align:center;cursor:help;font-size:1rem;">${ok ? '✓' : '✗'}</td>
      <td><strong>${r.clientName}</strong></td>
      <td>${fmtMoney(r.loanAmount)}</td>
      <td>${fmtPercent(r.ltv, 1)}</td>
      <td>${r.creditScore}</td>
      <td>${r.purpose}<br><small class="muted">${r.productType} · ${r.occupancy}</small></td>
      <td>${r.currentRate > 0 ? fmtPercent(r.currentRate) : 'N/A'}<br><small class="muted">${r.currentPayment > 0 ? fmtMoney(r.currentPayment) : '—'}</small></td>
      <td>${fmtPercent(r.adjustedRate)}<br><small class="muted">${fmtMoney(r.newPayment)}</small></td>
      <td class="${pmtClass}">
        ${r.currentPayment > 0 ? (r.paymentDiff < 0 ? '-' : '+') + fmtMoney(Math.abs(r.paymentDiff)) : '—'}
        ${r.breakEvenMonths !== null ? `<br><small class="muted">BE: ${Math.round(r.breakEvenMonths)} mo</small>` : ''}
      </td>
      <td class="${r.pointCost > 0 ? 'negative' : r.pointCost < 0 ? 'positive' : ''}">${fmtMoney(r.pointCost)}</td>
      <td><button class="breakdown-btn" data-idx="${idx}">${fmtPoints(r.totalPoints)}</button></td>
    `;
    tbody.appendChild(tr);
  });

  $$('.breakdown-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.target.dataset.idx);
      showBreakdown(filteredResults[i]);
    });
  });
}

// ============= UI: BREAKDOWN MODAL =============

function showBreakdown(r) {
  const modal = $('#breakdownModal');
  const content = $('#breakdownModalContent');

  let html = `
    <h3>${r.clientName} — LLPA Breakdown</h3>
    <div class="modal-summary">
      <div class="kv"><div class="k">Loan Amount</div><div class="v">${fmtMoney(r.loanAmount)}</div></div>
      <div class="kv"><div class="k">Gross LTV</div><div class="v">${fmtPercent(r.ltv, 2)}</div></div>
      <div class="kv"><div class="k">Credit Score</div><div class="v">${r.creditScore}</div></div>
      <div class="kv"><div class="k">Purpose</div><div class="v">${r.purpose}</div></div>
      <div class="kv"><div class="k">Starting Points</div><div class="v">${fmtPoints(r.finalPoints - r.totalPoints)}</div></div>
      <div class="kv"><div class="k">Total LLPAs</div><div class="v">${fmtPoints(r.totalPoints)}</div></div>
      <div class="kv"><div class="k">Final Points</div><div class="v">${fmtPoints(r.finalPoints)}</div></div>
      <div class="kv"><div class="k">Point Cost</div><div class="v">${fmtMoney(r.pointCost)}</div></div>
    </div>
  `;

  if (r.warnings && r.warnings.length) {
    html += `<div class="status-msg warning" style="margin-bottom:1rem;">${r.warnings.join('<br>')}</div>`;
  }

  html += `
    <table class="breakdown-detail-table">
      <thead><tr><th>Adjustment</th><th>Points</th><th>Reason</th></tr></thead>
      <tbody>
  `;

  if (r.breakdown.length === 0) {
    html += '<tr><td colspan="3" style="text-align:center;color:var(--gray);">No adjustments applied</td></tr>';
  } else {
    r.breakdown.forEach((adj) => {
      const cls = adj.points < 0 ? 'positive' : adj.points > 0 ? 'negative' : '';
      html += `<tr><td>${adj.name}</td><td class="${cls}"><strong>${fmtPoints(adj.points)}</strong></td><td>${adj.reason}</td></tr>`;
    });
  }

  html += '</tbody></table>';
  html += `<button class="btn btn-secondary" id="closeModalBtn">Close</button>`;

  content.innerHTML = html;
  modal.classList.add('show');

  $('#closeModalBtn').addEventListener('click', closeModal);
}

function closeModal() {
  $('#breakdownModal').classList.remove('show');
}

// ============= EXPORT FUNCTIONS =============

function exportToCSV() {
  if (!currentResults.length) return;

  const headers = [
    'Status', 'Issues', 'Client Name', 'Loan Amount', 'Property Value', 'LTV',
    'Credit Score', 'Purpose', 'Product Type', 'Occupancy', 'Property Type',
    'Units', 'Term', 'Current Rate', 'Current Payment', 'New Rate', 'New Payment',
    'Payment Change', 'LLPA Points', 'Final Points', 'Point Cost', 'Break-Even (mo)',
  ];

  const rows = currentResults.map((r) => [
    r.dataQuality.isComplete ? 'Complete' : 'Incomplete',
    r.dataQuality.issues.join('; '),
    r.clientName, r.loanAmount, r.propertyValue, r.ltv.toFixed(2) + '%',
    r.creditScore, r.purpose, r.productType, r.occupancy, r.propertyTypeRaw,
    r.units, r.termYears, fmtPercent(r.currentRate), r.currentPayment.toFixed(2),
    fmtPercent(r.adjustedRate), r.newPayment.toFixed(2), r.paymentDiff.toFixed(2),
    r.totalPoints.toFixed(3), r.finalPoints.toFixed(3), r.pointCost.toFixed(2),
    r.breakEvenMonths !== null ? Math.round(r.breakEvenMonths) : 'N/A',
  ]);

  const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
  downloadFile(csv, 'batch-llpm-results.csv', 'text/csv');
}

function exportToExcel() {
  if (!currentResults.length) return;

  const ws = XLSX.utils.json_to_sheet(currentResults.map((r) => ({
    'Status': r.dataQuality.isComplete ? 'Complete' : 'Incomplete',
    'Issues': r.dataQuality.issues.join('; '),
    'Client Name': r.clientName,
    'Loan Amount': r.loanAmount,
    'Property Value': r.propertyValue,
    'LTV': r.ltv.toFixed(2) + '%',
    'Credit Score': r.creditScore,
    'Purpose': r.purpose,
    'Product Type': r.productType,
    'Occupancy': r.occupancy,
    'Property Type': r.propertyTypeRaw,
    'Units': r.units,
    'Term (yr)': r.termYears,
    'Current Rate': fmtPercent(r.currentRate),
    'Current Payment': r.currentPayment.toFixed(2),
    'New Rate': fmtPercent(r.adjustedRate),
    'New Payment': r.newPayment.toFixed(2),
    'Payment Change': r.paymentDiff.toFixed(2),
    'LLPA Points': r.totalPoints.toFixed(3),
    'Final Points': r.finalPoints.toFixed(3),
    'Point Cost': r.pointCost.toFixed(2),
    'Break-Even (mo)': r.breakEvenMonths !== null ? Math.round(r.breakEvenMonths) : 'N/A',
  })));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'LLPM Results');
  XLSX.writeFile(wb, 'batch-llpm-results.xlsx');
}

async function exportToPDF() {
  if (!currentResults.length) return;

  const btn = $('#exportPdfBtn');
  const orig = btn.textContent;
  btn.textContent = 'Generating…';
  btn.disabled = true;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 10;

    doc.setFontSize(16);
    doc.text('MSFG Batch LLPM Results (Conventional)', m, 14);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, m, 20);

    const total = currentResults.length;
    const saving = currentResults.filter((r) => r.paymentDiff < 0).length;
    const volume = currentResults.reduce((s, r) => s + r.loanAmount, 0);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Loans: ${total}  |  Saving: ${saving}  |  Volume: ${fmtMoney(volume)}`, m, 27);

    const cols = [
      { h: 'Client', k: 'clientName', w: 30 },
      { h: 'Loan Amt', k: 'loanAmount', w: 22 },
      { h: 'LTV', k: 'ltv', w: 14 },
      { h: 'Credit', k: 'creditScore', w: 14 },
      { h: 'Purpose', k: 'purpose', w: 22 },
      { h: 'Old Rate', k: 'currentRate', w: 16 },
      { h: 'Old Pmt', k: 'currentPayment', w: 18 },
      { h: 'New Rate', k: 'adjustedRate', w: 16 },
      { h: 'New Pmt', k: 'newPayment', w: 18 },
      { h: 'Pmt Chg', k: 'paymentDiff', w: 18 },
      { h: 'Points', k: 'totalPoints', w: 14 },
      { h: 'Pt Cost', k: 'pointCost', w: 18 },
      { h: 'BE (mo)', k: 'breakEven', w: 16 },
    ];

    let x0 = m;
    const xs = cols.map((c) => { const p = x0; x0 += c.w; return p; });

    const tblData = currentResults.map((r) => ({
      clientName: r.clientName.substring(0, 18),
      loanAmount: fmtMoney(r.loanAmount),
      ltv: fmtPercent(r.ltv, 1),
      creditScore: String(r.creditScore),
      purpose: r.purpose.substring(0, 12),
      currentRate: fmtPercent(r.currentRate),
      currentPayment: fmtMoney(r.currentPayment),
      adjustedRate: fmtPercent(r.adjustedRate),
      newPayment: fmtMoney(r.newPayment),
      paymentDiff: (r.paymentDiff < 0 ? '-' : '+') + fmtMoney(Math.abs(r.paymentDiff)),
      totalPoints: fmtPoints(r.totalPoints),
      pointCost: fmtMoney(r.pointCost),
      breakEven: r.breakEvenMonths !== null ? Math.round(r.breakEvenMonths) + ' mo' : 'N/A',
    }));

    function drawHeader(y) {
      doc.setFillColor(240, 240, 240);
      doc.rect(m, y - 4, pw - m * 2, 7, 'F');
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(80, 80, 80);
      cols.forEach((c, i) => doc.text(c.h, xs[i], y));
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      return y + 7;
    }

    let y = drawHeader(34);
    const rh = 5.5;

    tblData.forEach((row, ri) => {
      if (y + rh > ph - m) {
        doc.addPage();
        y = drawHeader(m + 8);
      }
      if (ri % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(m, y - 3.5, pw - m * 2, rh, 'F'); }

      const threshold = getGlobalInputs().breakEvenThreshold;
      const orig = currentResults[ri];
      if (orig.breakEvenMonths !== null && orig.breakEvenMonths < threshold) {
        doc.setFillColor(220, 255, 220);
        doc.rect(m, y - 3.5, pw - m * 2, rh, 'F');
      }

      doc.setFontSize(7);
      cols.forEach((c, i) => {
        const val = String(row[c.k] || '').substring(0, 16);
        if (c.k === 'paymentDiff' && currentResults[ri].paymentDiff < 0) doc.setTextColor(0, 140, 0);
        else if (c.k === 'paymentDiff' && currentResults[ri].paymentDiff > 0) doc.setTextColor(200, 0, 0);
        else doc.setTextColor(0, 0, 0);
        doc.text(val, xs[i], y);
      });
      y += rh;
    });

    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${p}/${pages}  |  MSFG Batch LLPM Tool`, pw / 2, ph - 4, { align: 'center' });
    }

    doc.save(`batch-llpm-results-${Date.now()}.pdf`);
  } catch (err) {
    console.error('PDF export error:', err);
    alert('PDF export failed: ' + err.message);
  } finally {
    btn.textContent = orig;
    btn.disabled = false;
  }
}

function downloadFile(content, name, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============= FILE UPLOAD HANDLER =============

async function handleFileUpload(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  try {
    let parsed;
    if (ext === 'csv') {
      parsed = parseCSV(await file.text());
    } else if (ext === 'xlsx' || ext === 'xls') {
      parsed = parseExcel(await file.arrayBuffer());
    } else {
      throw new Error('Unsupported file format. Upload CSV or Excel.');
    }

    if (!parsed.rows.length) throw new Error('No data rows found');

    rawRows = parsed.rows;

    const info = $('#fileInfo');
    info.textContent = `✓ Loaded: ${file.name} (${parsed.rows.length} borrowers)`;
    info.classList.remove('hidden');
    $('#errorMessage').classList.add('hidden');
    $('#uploadZone').classList.add('has-file');

    const autoMap = autoDetectMapping(parsed.headers);
    renderColumnMapping(parsed.headers, autoMap);
    $('#mappingSection').classList.remove('hidden');

    setTimeout(() => {
      $('#mappingSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } catch (err) {
    const errEl = $('#errorMessage');
    errEl.textContent = `✗ Error: ${err.message}`;
    errEl.classList.remove('hidden');
    $('#fileInfo').classList.add('hidden');
    console.error('Upload error:', err);
  }
}

// ============= SORTING =============

function handleSort(col) {
  if (currentSort.col === col) {
    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.col = col;
    currentSort.dir = 'asc';
  }

  $$('.results-table th.sortable').forEach((th) => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.col === col) th.classList.add(`sorted-${currentSort.dir}`);
  });

  renderTable(currentResults, $('#searchBox').value);
}

// ============= EVENT WIRING =============

function wireEvents() {
  const zone = $('#uploadZone');
  const input = $('#fileInput');

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files[0]);
  });

  input.addEventListener('change', (e) => {
    if (e.target.files.length) handleFileUpload(e.target.files[0]);
  });

  $('#confirmMapping').addEventListener('click', () => {
    const mapping = getCurrentMapping();
    const missing = FIELD_DEFS.filter((d) => d.required && !mapping[d.key]).map((d) => d.label);
    if (missing.length) {
      const errEl = $('#errorMessage');
      errEl.textContent = `✗ Required fields not mapped: ${missing.join(', ')}`;
      errEl.classList.remove('hidden');
      return;
    }
    $('#errorMessage').classList.add('hidden');

    mappedData = rawRows.map((row) => transformRow(row, mapping));
    $('#mappingSection').classList.add('hidden');
    $('#inputsSection').classList.remove('hidden');
    $('#inputsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('#calculateBtn').addEventListener('click', () => {
    const globals = getGlobalInputs();
    currentResults = processBatch(mappedData, globals);

    let incomplete = currentResults.filter((r) => !r.dataQuality.isComplete).length;
    if (incomplete > 0) {
      alert(`${incomplete} of ${currentResults.length} rows have incomplete data. Look for ✗ in the Status column.`);
    }

    renderStats(currentResults);
    renderTable(currentResults);
    $('#resultsSection').classList.remove('hidden');
    $('#resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('#searchBox').addEventListener('input', (e) => {
    renderTable(currentResults, e.target.value);
  });

  $$('.results-table th.sortable').forEach((th) => {
    th.addEventListener('click', () => handleSort(th.dataset.col));
  });

  $('#exportCsvBtn').addEventListener('click', exportToCSV);
  $('#exportExcelBtn').addEventListener('click', exportToExcel);
  $('#exportPdfBtn').addEventListener('click', exportToPDF);

  $('#resetBtn').addEventListener('click', () => location.reload());

  $('#modalBackdrop').addEventListener('click', closeModal);
}

// ============= INIT =============

document.addEventListener('DOMContentLoaded', () => {
  wireEvents();
});
