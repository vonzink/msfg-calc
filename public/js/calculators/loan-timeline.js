(function() {
  'use strict';

  /* =====================================================
     Loan Timeline — Calendar, TRID Compliance, MISMO
     ===================================================== */

  // ---- Helpers ----
  const el  = (id) => document.getElementById(id);
  const qs  = (sel) => document.querySelector(sel);
  const qsa = (sel) => document.querySelectorAll(sel);

  // Namespace-aware XML traversal (mirrors mismo-parser.js helpers)
  function qn(parent, path) {
    const parts = path.split('/');
    let node = parent;
    for (let i = 0; i < parts.length; i++) {
      if (!node) return null;
      const children = node.children || node.childNodes;
      let found = null;
      for (let j = 0; j < children.length; j++) {
        if (children[j].localName === parts[i]) { found = children[j]; break; }
      }
      node = found;
    }
    return node;
  }
  function qnAll(parent, localName) {
    const results = [];
    if (!parent) return results;
    const walk = (node) => {
      if (node.localName === localName) results.push(node);
      const kids = node.children || node.childNodes;
      for (let i = 0; i < kids.length; i++) walk(kids[i]);
    };
    walk(parent);
    return results;
  }
  function txt(parent, path) {
    const node = qn(parent, path);
    return node ? (node.textContent || '').trim() : '';
  }

  // ---- Date Utilities ----
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function toDate(str) {
    if (!str) return null;
    const d = new Date(str + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtDate(d) {
    if (!d) return '';
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
  function toISO(d) {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function sameDay(a, b) {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function daysBetween(a, b) {
    if (!a || !b) return null;
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }

  /** Add N business days (skip weekends) */
  function addBusinessDays(date, n) {
    const d = new Date(date);
    let added = 0;
    const dir = n >= 0 ? 1 : -1;
    const abs = Math.abs(n);
    while (added < abs) {
      d.setDate(d.getDate() + dir);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return d;
  }

  /** Add N calendar days */
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  // ---- Category Colors ----
  const CATEGORY_COLORS = {
    milestone:   '#22c55e',
    deadline:    '#f59e0b',
    lock:        '#3b82f6',
    contingency: '#f87171',
    condition:   '#8b5cf6',
    turntime:    '#06b6d4'
  };

  // ---- Event Definitions ----
  const EVENT_DEFS = [
    { id: 'applicationTaken',      label: 'Application Taken',      category: 'milestone' },
    { id: 'leDelivered',           label: 'LE Delivered',            category: 'milestone' },
    { id: 'intentToProceed',       label: 'Intent to Proceed',      category: 'milestone' },
    { id: 'approved',              label: 'Approved',                category: 'milestone' },
    { id: 'cdIssued',              label: 'CD Issued',               category: 'milestone' },
    { id: 'clearToClose',          label: 'Clear to Close',          category: 'milestone' },
    { id: 'closingEstimate',       label: 'Closing Date',            category: 'deadline' },
    { id: 'fundingEstimate',       label: 'Funding Date',            category: 'deadline' },
    { id: 'lockDate',              label: 'Lock Date',               category: 'lock' },
    { id: 'lockExpiration',        label: 'Lock Expiration',         category: 'lock' },
    { id: 'appraisalContingency',  label: 'Appraisal Contingency',  category: 'contingency' },
    { id: 'financingContingency',  label: 'Financing Contingency',  category: 'contingency' },
    { id: 'conditionsDue',         label: 'Conditions Due',          category: 'condition' },
    { id: 'conditionsCleared',     label: 'Conditions Cleared',      category: 'condition' },
    { id: 'submittedToUW',         label: 'Submitted to UW',         category: 'turntime' },
    { id: 'uwDecision',            label: 'UW Decision',             category: 'turntime' },
    { id: 'resubmitted',           label: 'Resubmitted',             category: 'turntime' },
    { id: 'finalApproval',         label: 'Final Approval',          category: 'turntime' },
  ];

  // ---- State ----
  const state = {
    events: {},            // { eventId: Date|null }
    visibility: {},        // { eventId: boolean } — toggle on/off
    customDates: [],       // [{ id, label, date, category }]
    currentMonth: null,    // Date (1st of displayed month)
    loanPurpose: 'Purchase',
    mismoLoaded: false,
    notes: '',
  };

  // ---- Get Visible Events (standard + custom) ----
  function getVisibleEvents() {
    const results = [];
    EVENT_DEFS.forEach(ev => {
      if (state.visibility[ev.id] !== false && state.events[ev.id]) {
        results.push({ id: ev.id, label: ev.label, category: ev.category, date: state.events[ev.id] });
      }
    });
    state.customDates.forEach(cd => {
      if (cd.date) {
        results.push({ id: cd.id, label: cd.label, category: cd.category, date: cd.date });
      }
    });
    return results;
  }

  // ---- Initialization ----
  function init() {
    // Default current month to today
    const now = new Date();
    state.currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Init all event dates to null; visibility to true
    EVENT_DEFS.forEach(ev => {
      state.events[ev.id] = null;
      state.visibility[ev.id] = true;
    });

    bindEvents();
    initMISMODropZone();
    initMISMOMessageListener();
    render();
  }

  // ---- Event Binding ----
  function bindEvents() {
    // Date inputs
    qsa('[data-event]').forEach(input => {
      input.addEventListener('change', () => {
        const evId = input.dataset.event;
        state.events[evId] = toDate(input.value);
        onDatesChanged();
      });
    });

    // Toggle checkboxes
    qsa('.lt-toggle').forEach(cb => {
      cb.addEventListener('change', () => {
        const evId = cb.dataset.toggle;
        state.visibility[evId] = cb.checked;
        const row = cb.closest('.lt-date-row');
        if (row) row.classList.toggle('lt-row--hidden', !cb.checked);
        render();
      });
    });

    // Loan purpose
    el('ltLoanPurpose').addEventListener('change', (e) => {
      state.loanPurpose = e.target.value;
      deriveFundingDate();
      render();
    });

    // Calendar nav
    qs('[data-action="prev-month"]').addEventListener('click', () => {
      state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
      renderCalendar();
    });
    qs('[data-action="next-month"]').addEventListener('click', () => {
      state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
      renderCalendar();
    });

    // Custom dates — Add button
    el('ltAddCustomDate').addEventListener('click', addCustomDate);

    // Notes
    el('ltNotes').addEventListener('input', (e) => {
      state.notes = e.target.value;
    });

    // Report button
    const reportBtn = el('ltReportBtn');
    if (reportBtn) {
      reportBtn.addEventListener('click', () => {
        if (MSFG && MSFG.Report && MSFG.Report.captureCalc) {
          MSFG.Report.captureCalc('loan-timeline');
        }
      });
    }

    // Print
    el('ltPrintBtn').addEventListener('click', () => window.print());

    // Clear
    el('ltClearBtn').addEventListener('click', clearAll);
  }

  function clearAll() {
    EVENT_DEFS.forEach(ev => {
      state.events[ev.id] = null;
      state.visibility[ev.id] = true;
      const inp = qs(`[data-event="${ev.id}"]`);
      if (inp) inp.value = '';
      const cb = qs(`[data-toggle="${ev.id}"]`);
      if (cb) { cb.checked = true; }
    });
    // Clear toggle row styles
    qsa('.lt-date-row').forEach(r => r.classList.remove('lt-row--hidden'));

    // Clear custom dates
    state.customDates = [];
    el('ltCustomDatesContainer').innerHTML = '';

    // Clear notes
    state.notes = '';
    el('ltNotes').value = '';

    state.loanPurpose = 'Purchase';
    el('ltLoanPurpose').value = 'Purchase';
    el('ltLoanInfo').style.display = 'none';
    const dropZone = el('ltMismoDrop');
    dropZone.classList.remove('loaded');
    dropZone.innerHTML = 'Drop a MISMO XML file here to auto-populate dates, or <strong>click to browse</strong>';
    const fi = el('ltMismoFile');
    if (fi) dropZone.appendChild(fi);
    state.mismoLoaded = false;
    state.currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    render();
  }

  // ---- Custom Dates ----
  function addCustomDate() {
    const id = 'custom-' + Date.now();
    const cd = { id: id, label: '', date: null, category: 'milestone' };
    state.customDates.push(cd);
    renderCustomDateRow(cd);
  }

  function renderCustomDateRow(cd) {
    const container = el('ltCustomDatesContainer');
    const row = document.createElement('div');
    row.className = 'lt-custom-row';
    row.dataset.customId = cd.id;

    // Label input
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'Label';
    labelInput.value = cd.label;
    labelInput.addEventListener('input', () => {
      cd.label = labelInput.value;
      render();
    });

    // Date input
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = cd.date ? toISO(cd.date) : '';
    dateInput.addEventListener('change', () => {
      cd.date = toDate(dateInput.value);
      render();
      sendTally();
    });

    // Category select
    const catSelect = document.createElement('select');
    const cats = Object.keys(CATEGORY_COLORS);
    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      if (cat === cd.category) opt.selected = true;
      catSelect.appendChild(opt);
    });
    catSelect.addEventListener('change', () => {
      cd.category = catSelect.value;
      render();
    });

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'lt-custom-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      state.customDates = state.customDates.filter(c => c.id !== cd.id);
      row.remove();
      render();
      sendTally();
    });

    row.appendChild(labelInput);
    row.appendChild(dateInput);
    row.appendChild(catSelect);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  // ---- MISMO Integration ----
  function initMISMODropZone() {
    const dropZone = el('ltMismoDrop');
    const fileInput = el('ltMismoFile');
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) handleMISMOFile(e.target.files[0]);
    });
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleMISMOFile(e.dataTransfer.files[0]);
    });

    // Check sessionStorage for existing MISMO data
    const storedXml = sessionStorage.getItem('msfg-mismo-xml');
    const storedData = sessionStorage.getItem('msfg-mismo-data');
    if (storedXml) {
      try {
        const parsed = storedData ? JSON.parse(storedData) : null;
        applyMISMOFromXml(storedXml, parsed);
        dropZone.classList.add('loaded');
        dropZone.textContent = 'MISMO data loaded from session';
      } catch(_) { /* ignore */ }
    }
  }

  // Listen for workspace MISMO broadcasts via postMessage
  function initMISMOMessageListener() {
    window.addEventListener('message', (e) => {
      // Accept messages from same origin or parent frame
      if (!e.data || typeof e.data !== 'object') return;

      // Listen for MISMO broadcast from workspace
      if (e.data.type === 'msfg-mismo-broadcast' || e.data.type === 'msfg-mismo-update') {
        const xmlStr = e.data.xml || e.data.xmlString;
        if (!xmlStr) return;

        sessionStorage.setItem('msfg-mismo-xml', xmlStr);
        let parsed = null;
        if (e.data.parsed) {
          parsed = e.data.parsed;
          sessionStorage.setItem('msfg-mismo-data', JSON.stringify(parsed));
        } else if (MSFG && MSFG.MISMOParser) {
          parsed = MSFG.MISMOParser.parse(xmlStr);
          sessionStorage.setItem('msfg-mismo-data', JSON.stringify(parsed));
        }

        applyMISMOFromXml(xmlStr, parsed);
        const dropZone = el('ltMismoDrop');
        if (dropZone) {
          dropZone.classList.add('loaded');
          dropZone.textContent = 'MISMO data loaded from workspace';
        }
      }

      // Also listen for sessionStorage changes triggered by other frames
      if (e.data.type === 'msfg-session-update' && e.data.key === 'msfg-mismo-xml') {
        const storedXml = sessionStorage.getItem('msfg-mismo-xml');
        const storedData = sessionStorage.getItem('msfg-mismo-data');
        if (storedXml && !state.mismoLoaded) {
          const parsed = storedData ? JSON.parse(storedData) : null;
          applyMISMOFromXml(storedXml, parsed);
        }
      }
    });
  }

  function handleMISMOFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlStr = e.target.result;
        // Store raw XML for workspace sharing
        sessionStorage.setItem('msfg-mismo-xml', xmlStr);

        // Parse standard fields via MISMOParser if available
        let parsed = null;
        if (MSFG && MSFG.MISMOParser) {
          parsed = MSFG.MISMOParser.parse(xmlStr);
          sessionStorage.setItem('msfg-mismo-data', JSON.stringify(parsed));
        }

        applyMISMOFromXml(xmlStr, parsed);

        const dropZone = el('ltMismoDrop');
        dropZone.classList.add('loaded');
        dropZone.textContent = 'MISMO loaded: ' + file.name;
      } catch (err) {
        console.error('MISMO parse error:', err);
      }
    };
    reader.readAsText(file);
  }

  function applyMISMOFromXml(xmlStr, parsedData) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');
    const root = xmlDoc.documentElement;

    // Loan purpose
    const loanNodes = qnAll(root, 'LOAN');
    const loan = loanNodes[0] || null;

    if (parsedData) {
      // Borrower name
      if (parsedData.borrowerName) el('ltBorrower').textContent = parsedData.borrowerName;
      // Loan purpose (parser stores it at parsedData.loan.purpose)
      const purpose = parsedData.loanPurpose || (parsedData.loan && parsedData.loan.purpose) || '';
      if (purpose) {
        state.loanPurpose = purpose;
        el('ltLoanPurpose').value = purpose;
        el('ltPurpose').textContent = purpose;
      }
      // Program info from parsed data
      if (parsedData.loan) {
        const l = parsedData.loan;
        const yrs = l.termMonths ? Math.round(parseInt(l.termMonths) / 12) : '';
        const prog = [l.mortgageType, yrs ? `${yrs} Year` : '', l.amortType].filter(Boolean).join(' ');
        if (prog) el('ltProgram').textContent = prog;
      }
    }

    // Extract dates from raw XML
    if (loan) {
      // Application date
      const appDate = txt(loan, 'LOAN_DETAIL/ApplicationReceivedDate');
      if (appDate) setEventDate('applicationTaken', appDate);

      // File number
      const fileNum = txt(loan, 'LOAN_IDENTIFIERS/LOAN_IDENTIFIER/LoanIdentifier') ||
                      txt(loan, 'LOAN_DETAIL/LoanIdentifier');
      if (fileNum) el('ltFileNum').textContent = fileNum;
    }

    // Closing date
    const closingInfos = qnAll(root, 'CLOSING_INFORMATION');
    for (const ci of closingInfos) {
      const detail = qn(ci, 'CLOSING_INFORMATION_DETAIL');
      if (detail) {
        const scheduled = txt(detail, 'LoanScheduledClosingDate');
        const estimated = txt(detail, 'LoanEstimatedClosingDate');
        const closingDate = scheduled || estimated;
        if (closingDate) setEventDate('closingEstimate', closingDate);
      }
    }

    // Lock info
    const locks = qnAll(root, 'LOCK');
    for (const lock of locks) {
      const lockDate = txt(lock, 'LockDate') || txt(lock, 'LOCK_DETAIL/LockDate');
      const lockExp = txt(lock, 'LockExpirationDate') || txt(lock, 'LOCK_DETAIL/LockExpirationDate');
      if (lockDate) setEventDate('lockDate', lockDate);
      if (lockExp) setEventDate('lockExpiration', lockExp);
    }

    // Product/program info
    const mtgTerms = qnAll(root, 'MORTGAGE_TERMS');
    if (mtgTerms.length > 0) {
      const mt = mtgTerms[0];
      const mtgType = txt(mt, 'MortgageType');
      const amortType = txt(mt, 'AmortizationType');
      const termMonths = txt(mt, 'LoanTermMonths') || txt(mt, 'RequestedInterestRateLockMonths');
      const yrs = termMonths ? Math.round(parseInt(termMonths) / 12) : '';
      const program = [mtgType, yrs ? `${yrs} Year` : '', amortType].filter(Boolean).join(' ');
      if (program) el('ltProgram').textContent = program;
    }

    // Show loan info bar
    el('ltLoanInfo').style.display = 'flex';
    state.mismoLoaded = true;

    // Derive funding and center calendar
    deriveFundingDate();
    centerCalendar();
    render();
  }

  function setEventDate(evId, dateStr) {
    const d = toDate(dateStr);
    state.events[evId] = d;
    const inp = qs(`[data-event="${evId}"]`);
    if (inp && d) inp.value = toISO(d);
  }

  // ---- Derived Dates ----
  function deriveFundingDate() {
    const closing = state.events.closingEstimate;
    if (!closing) return;

    const isRefi = state.loanPurpose && state.loanPurpose.toLowerCase().includes('refinance');
    if (isRefi) {
      // 3 business days rescission after closing
      const funding = addBusinessDays(closing, 3);
      setEventDate('fundingEstimate', toISO(funding));
    } else {
      // Purchase: funding = closing day (or next business day)
      const dow = closing.getDay();
      let funding = new Date(closing);
      if (dow === 0) funding = addDays(closing, 1); // Sunday → Monday
      else if (dow === 6) funding = addDays(closing, 2); // Saturday → Monday
      setEventDate('fundingEstimate', toISO(funding));
    }
  }

  function onDatesChanged() {
    deriveFundingDate();
    centerCalendar();
    render();
    sendTally();
  }

  // ---- Calendar Centering ----
  function centerCalendar() {
    const app = state.events.applicationTaken;
    const closing = state.events.closingEstimate;
    if (app) {
      state.currentMonth = new Date(app.getFullYear(), app.getMonth(), 1);
    } else if (closing) {
      state.currentMonth = new Date(closing.getFullYear(), closing.getMonth(), 1);
    }
  }

  // ---- Render Everything ----
  function render() {
    renderCalendar();
    renderTimeline();
    renderAlerts();
  }

  // ---- Calendar Rendering ----
  function renderCalendar() {
    const grid = el('ltCalGrid');
    const titleEl = el('ltCalTitle');
    const year = state.currentMonth.getFullYear();
    const month = state.currentMonth.getMonth();

    titleEl.textContent = `${MONTHS[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay(); // 0=Su
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const visibleEvents = getVisibleEvents();

    let html = '';

    // Empty cells before 1st
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="lt-day lt-day--empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isToday = sameDay(date, today);

      // Find visible events on this day
      const dayEvents = visibleEvents.filter(ev => sameDay(ev.date, date));

      const classes = ['lt-day'];
      if (isPast && !isToday) classes.push('lt-day--past');
      if (isToday) classes.push('lt-day--today');
      if (dayEvents.length) classes.push('lt-day--has-event');

      html += `<div class="${classes.join(' ')}" data-date="${toISO(date)}">`;
      html += `<span class="lt-day__num">${d}</span>`;

      if (dayEvents.length) {
        html += '<div class="lt-day__events">';
        dayEvents.forEach(ev => {
          html += `<span class="lt-dot lt-dot--${ev.category}" title="${MSFG.escHtml(ev.label)}"></span>`;
        });
        html += '</div>';
      }

      html += '</div>';
    }

    grid.innerHTML = html;

    // Click handler for day cells
    grid.querySelectorAll('.lt-day--has-event').forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.dataset.date;
        // Find matching event input and scroll to it
        const allEvents = EVENT_DEFS.concat(state.customDates.map(cd => ({ id: cd.id })));
        EVENT_DEFS.forEach(ev => {
          if (state.events[ev.id] && toISO(state.events[ev.id]) === dateStr) {
            const inp = qs(`[data-event="${ev.id}"]`);
            if (inp) {
              inp.focus();
              inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        });
      });
    });
  }

  // ---- Timeline Rendering ----
  function renderTimeline() {
    const dotsContainer = el('ltTimelineDots');
    const progressBar = el('ltTimelineProgress');

    const appDate = state.events.applicationTaken;
    const fundDate = state.events.fundingEstimate;

    if (!appDate || !fundDate) {
      dotsContainer.innerHTML = '';
      progressBar.style.width = '0%';
      return;
    }

    const totalDays = daysBetween(appDate, fundDate);
    if (totalDays <= 0) {
      dotsContainer.innerHTML = '';
      progressBar.style.width = '0%';
      return;
    }

    // Progress based on today
    const today = new Date();
    const elapsed = daysBetween(appDate, today);
    const pct = Math.max(0, Math.min(100, (elapsed / totalDays) * 100));
    progressBar.style.width = pct + '%';

    // Dots — only visible events
    const visibleEvents = getVisibleEvents();
    let dotsHtml = '';
    visibleEvents.forEach(ev => {
      const offset = daysBetween(appDate, ev.date);
      const pos = Math.max(0, Math.min(100, (offset / totalDays) * 100));
      dotsHtml += `<div class="lt-timeline__dot lt-timeline__dot--${ev.category}" style="left:${pos}%">`;
      dotsHtml += `<div class="lt-timeline__tooltip">${MSFG.escHtml(ev.label)}: ${fmtDate(ev.date)}</div>`;
      dotsHtml += '</div>';
    });

    dotsContainer.innerHTML = dotsHtml;
  }

  // ---- TRID Compliance Alerts ----
  function renderAlerts() {
    const container = el('ltAlerts');
    const alerts = [];
    const closing = state.events.closingEstimate;
    const app = state.events.applicationTaken;
    const le = state.events.leDelivered;
    const funding = state.events.fundingEstimate;
    const lockDate = state.events.lockDate;
    const lockExp = state.events.lockExpiration;
    const appraisalCont = state.events.appraisalContingency;
    const isRefi = state.loanPurpose && state.loanPurpose.toLowerCase().includes('refinance');
    const today = new Date();

    // Only show alerts for visible events
    const vis = state.visibility;

    // 1. LE Timing — must be delivered within 3 business days of application
    if (vis.applicationTaken !== false && vis.leDelivered !== false) {
      if (app && le) {
        const leDeadline = addBusinessDays(app, 3);
        if (le > leDeadline) {
          alerts.push({ level: 'danger', icon: '🚨', text: `LE delivered ${fmtDate(le)} — exceeds 3 business day requirement after application (deadline: ${fmtDate(leDeadline)})` });
        } else {
          alerts.push({ level: 'ok', icon: '✅', text: `LE delivered within 3 business days of application` });
        }
      } else if (app && !le) {
        const leDeadline = addBusinessDays(app, 3);
        const remaining = daysBetween(today, leDeadline);
        if (remaining !== null && remaining >= 0) {
          alerts.push({ level: 'warn', icon: '⏰', text: `LE must be delivered by ${fmtDate(leDeadline)} (${remaining} day${remaining !== 1 ? 's' : ''} remaining)` });
        } else if (remaining !== null) {
          alerts.push({ level: 'danger', icon: '🚨', text: `LE delivery deadline passed (${fmtDate(leDeadline)}) — still not delivered` });
        }
      }
    }

    // 2. Appraisal 3-day rule — must be received ≥3 calendar days before closing
    if (vis.closingEstimate !== false && vis.appraisalContingency !== false && closing) {
      const appraisalDeadline = addDays(closing, -3);
      if (appraisalCont) {
        if (appraisalCont > appraisalDeadline) {
          alerts.push({ level: 'danger', icon: '🚨', text: `Appraisal contingency ${fmtDate(appraisalCont)} is within 3 days of closing — TRID violation risk. Must be received by ${fmtDate(appraisalDeadline)}` });
        } else {
          alerts.push({ level: 'ok', icon: '✅', text: `Appraisal contingency satisfies 3-day delivery rule (deadline: ${fmtDate(appraisalDeadline)})` });
        }
      } else {
        alerts.push({ level: 'info', icon: '📋', text: `Appraisal must be received by ${fmtDate(appraisalDeadline)} (3 days before closing)` });
      }
    }

    // 3. VOE 10-business-day rule
    if (vis.closingEstimate !== false && closing) {
      const voeDeadline = addBusinessDays(closing, -10);
      const voeRemaining = daysBetween(today, voeDeadline);
      if (voeRemaining !== null && voeRemaining > 0) {
        alerts.push({ level: 'info', icon: '📞', text: `Verbal VOE window opens ${fmtDate(voeDeadline)} (10 business days before closing)` });
      } else if (voeRemaining !== null && voeRemaining <= 0) {
        const daysToClosing = daysBetween(today, closing);
        if (daysToClosing !== null && daysToClosing >= 0) {
          alerts.push({ level: 'warn', icon: '📞', text: `Verbal VOE window is OPEN — complete within 10 business days of closing (${fmtDate(closing)})` });
        }
      }
    }

    // 4. Rescission (refi only)
    if (isRefi && vis.closingEstimate !== false && closing) {
      const rescissionEnd = addBusinessDays(closing, 3);
      if (funding && funding < rescissionEnd) {
        alerts.push({ level: 'danger', icon: '🚨', text: `Funding date ${fmtDate(funding)} is before rescission period ends ${fmtDate(rescissionEnd)}. Refinances require 3 business day waiting period.` });
      } else if (funding) {
        alerts.push({ level: 'ok', icon: '✅', text: `Funding date respects 3-business-day right of rescission (earliest: ${fmtDate(rescissionEnd)})` });
      } else {
        alerts.push({ level: 'info', icon: '📋', text: `Refinance: 3 business day rescission period. Earliest funding: ${fmtDate(rescissionEnd)}` });
      }
    }

    // 5. Lock monitoring
    if (vis.lockDate !== false && vis.closingEstimate !== false && closing) {
      const daysToClosing = daysBetween(today, closing);
      if (!lockDate && daysToClosing !== null && daysToClosing <= 45) {
        alerts.push({ level: 'warn', icon: '🔒', text: `No rate lock — closing is ${daysToClosing} day${daysToClosing !== 1 ? 's' : ''} away. Consider locking.` });
      } else if (!lockDate && daysToClosing !== null && daysToClosing > 45) {
        alerts.push({ level: 'info', icon: '🔓', text: `No rate lock — closing is ${daysToClosing} days away` });
      }
    }

    if (vis.lockExpiration !== false && vis.closingEstimate !== false && lockExp && closing) {
      if (lockExp < closing) {
        const gap = daysBetween(lockExp, closing);
        alerts.push({ level: 'danger', icon: '🚨', text: `Lock expires ${fmtDate(lockExp)} — ${gap} day${gap !== 1 ? 's' : ''} BEFORE closing. Extension or relock required.` });
      } else {
        const buffer = daysBetween(closing, lockExp);
        if (buffer <= 3) {
          alerts.push({ level: 'warn', icon: '⚠️', text: `Lock expires ${fmtDate(lockExp)} — only ${buffer} day${buffer !== 1 ? 's' : ''} of buffer after closing` });
        } else {
          alerts.push({ level: 'ok', icon: '✅', text: `Lock valid through ${fmtDate(lockExp)} (${buffer} days after closing)` });
        }
      }
    }

    // Render alerts
    if (alerts.length === 0) {
      container.innerHTML = '<div class="lt-alert lt-alert--info"><span class="lt-alert__icon">📋</span><span>Enter dates to see TRID compliance alerts</span></div>';
      return;
    }

    container.innerHTML = alerts.map(a =>
      `<div class="lt-alert lt-alert--${a.level}"><span class="lt-alert__icon">${a.icon}</span><span>${a.text}</span></div>`
    ).join('');
  }

  // ---- Workspace postMessage Tally ----
  function sendTally() {
    if (window.parent === window) return; // not in iframe
    const closing = state.events.closingEstimate;
    const funding = state.events.fundingEstimate;
    window.parent.postMessage({
      type: 'msfg-tally-update',
      slug: 'loan-timeline',
      closingDate: closing ? toISO(closing) : '',
      fundingDate: funding ? toISO(funding) : '',
      monthlyPayment: 0,
      loanAmount: 0,
      cashToClose: 0
    }, '*');
  }

  // ---- Boot ----
  document.addEventListener('DOMContentLoaded', init);

})();
