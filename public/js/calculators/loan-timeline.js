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
  const daysBetween = MSFG.daysBetween;

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

    // Restore saved state before MISMO check (MISMO will overwrite if present)
    const restored = restoreState();

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
        saveState();
      });
    });

    // Loan purpose
    el('ltLoanPurpose').addEventListener('change', (e) => {
      state.loanPurpose = e.target.value;
      deriveFundingDate();
      render();
      saveState();
    });

    // Calendar nav
    qs('[data-action="prev-month"]').addEventListener('click', () => {
      state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
      renderCalendar();
      saveState();
    });
    qs('[data-action="next-month"]').addEventListener('click', () => {
      state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
      renderCalendar();
      saveState();
    });

    // Custom dates — Add button
    el('ltAddCustomDate').addEventListener('click', addCustomDate);

    // Custom date popup
    initCustomDatePopup();

    // Notes
    el('ltNotes').addEventListener('input', (e) => {
      state.notes = e.target.value;
      saveState();
    });

    // Print (legacy button — now handled by calc-actions partial)
    const printBtn = el('ltPrintBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    // Clear (legacy button — removed with calc-actions partial)
    const clearBtn = el('ltClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
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
    sessionStorage.removeItem(STORAGE_KEY);
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
      saveState();
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
      saveState();
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
      saveState();
    });

    row.appendChild(labelInput);
    row.appendChild(dateInput);
    row.appendChild(catSelect);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  // ---- Custom Date Popup (click calendar day) ----
  function initCustomDatePopup() {
    const overlay = el('ltPopupOverlay');
    const popupDate = el('ltPopupDate');
    const popupLabel = el('ltPopupLabel');
    const popupCategory = el('ltPopupCategory');
    if (!overlay) return;

    function openPopup(dateStr) {
      popupDate.value = dateStr || '';
      popupLabel.value = '';
      popupCategory.value = 'milestone';
      overlay.style.display = 'flex';
      setTimeout(() => popupLabel.focus(), 50);
    }

    function closePopup() {
      overlay.style.display = 'none';
    }

    function addFromPopup() {
      const label = popupLabel.value.trim();
      const date = popupDate.value;
      const category = popupCategory.value;
      if (!label || !date) return;

      const id = 'custom-' + Date.now();
      const cd = { id: id, label: label, date: toDate(date), category: category };
      state.customDates.push(cd);
      renderCustomDateRow(cd);
      render();
      sendTally();
      saveState();
      closePopup();
    }

    el('ltPopupClose').addEventListener('click', closePopup);
    el('ltPopupCancel').addEventListener('click', closePopup);
    el('ltPopupAdd').addEventListener('click', addFromPopup);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePopup();
    });

    // Enter key submits
    popupLabel.addEventListener('keydown', (e) => { if (e.key === 'Enter') addFromPopup(); });
    popupDate.addEventListener('keydown', (e) => { if (e.key === 'Enter') addFromPopup(); });

    // Expose for calendar click handler
    state._openPopup = openPopup;
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

    // Check sessionStorage for existing MISMO data (skip if state was already restored)
    if (!state.mismoLoaded) {
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
      if (appDate) setEventDate('applicationTaken', appDate, true);

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
        if (closingDate) setEventDate('closingEstimate', closingDate, true);
      }
    }

    // Lock info — MISMO uses LockDatetime / LockExpirationDatetime (full ISO)
    const locks = qnAll(root, 'LOCK');
    for (const lock of locks) {
      const lockDate = txt(lock, 'LockDate') || txt(lock, 'LOCK_DETAIL/LockDate') ||
                       txt(lock, 'LockDatetime') || txt(lock, 'LOCK_DETAIL/LockDatetime');
      const lockExp = txt(lock, 'LockExpirationDate') || txt(lock, 'LOCK_DETAIL/LockExpirationDate') ||
                      txt(lock, 'LockExpirationDatetime') || txt(lock, 'LOCK_DETAIL/LockExpirationDatetime');
      // Strip time portion from datetime values (e.g. "2026-03-02T14:14:05-07:00" → "2026-03-02")
      if (lockDate) setEventDate('lockDate', lockDate.substring(0, 10), true);
      if (lockExp) setEventDate('lockExpiration', lockExp.substring(0, 10), true);
    }

    // Also check CLOSING_INFORMATION_DETAIL for CurrentRateSetDate as fallback lock date
    if (!state.events.lockDate) {
      const closingDetails = qnAll(root, 'CLOSING_INFORMATION_DETAIL');
      for (const cd of closingDetails) {
        const rateSetDate = txt(cd, 'CurrentRateSetDate');
        if (rateSetDate) { setEventDate('lockDate', rateSetDate, true); break; }
      }
    }

    // LE Delivered & CD Issued — from INTEGRATED_DISCLOSURE documents
    const documents = qnAll(root, 'DOCUMENT');
    for (const doc of documents) {
      const docType = txt(doc, 'DOCUMENT_CLASSES/DOCUMENT_CLASS/DocumentType');
      const issuedDate = txt(doc, 'INTEGRATED_DISCLOSURE/INTEGRATED_DISCLOSURE_DETAIL/IntegratedDisclosureIssuedDate');
      if (docType === 'LoanEstimate' && issuedDate && !state.events.leDelivered) {
        setEventDate('leDelivered', issuedDate, true);
      }
      if (docType === 'ClosingDisclosure' && issuedDate && !state.events.cdIssued) {
        setEventDate('cdIssued', issuedDate, true);
      }
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
    saveState();
  }

  function setEventDate(evId, dateStr, fromMISMO) {
    const d = toDate(dateStr);
    state.events[evId] = d;
    const inp = qs(`[data-event="${evId}"]`);
    if (inp && d) {
      inp.value = toISO(d);
      if (fromMISMO) {
        inp.classList.remove('is-default');
        inp.classList.add('mismo-populated');
      }
    }
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
    saveState();
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

    // Click handler for day cells — open custom date popup
    grid.querySelectorAll('.lt-day:not(.lt-day--empty)').forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.dataset.date;
        if (state._openPopup) state._openPopup(dateStr);
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

  // ---- Session Persistence ----
  const STORAGE_KEY = 'msfg-loan-timeline-state';

  function saveState() {
    try {
      const data = {
        events: {},
        visibility: state.visibility,
        customDates: state.customDates.map(cd => ({
          id: cd.id,
          label: cd.label,
          date: cd.date ? toISO(cd.date) : null,
          category: cd.category
        })),
        loanPurpose: state.loanPurpose,
        notes: state.notes,
        mismoLoaded: state.mismoLoaded,
        currentMonth: toISO(state.currentMonth),
        loanInfo: {
          borrower: el('ltBorrower') ? el('ltBorrower').textContent : '--',
          fileNum: el('ltFileNum') ? el('ltFileNum').textContent : '--',
          purpose: el('ltPurpose') ? el('ltPurpose').textContent : '--',
          program: el('ltProgram') ? el('ltProgram').textContent : '--'
        },
        mismoDropText: (el('ltMismoDrop') && el('ltMismoDrop').classList.contains('loaded'))
          ? el('ltMismoDrop').textContent.trim() : ''
      };
      EVENT_DEFS.forEach(ev => {
        data.events[ev.id] = state.events[ev.id] ? toISO(state.events[ev.id]) : null;
      });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) { /* quota exceeded or private browsing */ }
  }

  function restoreState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);

      // Restore events
      EVENT_DEFS.forEach(ev => {
        if (data.events && data.events[ev.id]) {
          state.events[ev.id] = toDate(data.events[ev.id]);
          const inp = qs(`[data-event="${ev.id}"]`);
          if (inp) inp.value = data.events[ev.id];
        }
      });

      // Restore visibility (toggle checkboxes)
      if (data.visibility) {
        Object.keys(data.visibility).forEach(evId => {
          state.visibility[evId] = data.visibility[evId];
          const cb = qs(`[data-toggle="${evId}"]`);
          if (cb) cb.checked = data.visibility[evId];
          if (!data.visibility[evId]) {
            const row = cb ? cb.closest('.lt-date-row') : null;
            if (row) row.classList.add('lt-row--hidden');
          }
        });
      }

      // Restore custom dates
      if (data.customDates && data.customDates.length) {
        data.customDates.forEach(cd => {
          const restored = {
            id: cd.id,
            label: cd.label || '',
            date: cd.date ? toDate(cd.date) : null,
            category: cd.category || 'milestone'
          };
          state.customDates.push(restored);
          renderCustomDateRow(restored);
        });
      }

      // Restore loan purpose
      if (data.loanPurpose) {
        state.loanPurpose = data.loanPurpose;
        el('ltLoanPurpose').value = data.loanPurpose;
      }

      // Restore notes
      if (data.notes) {
        state.notes = data.notes;
        el('ltNotes').value = data.notes;
      }

      // Restore current month
      if (data.currentMonth) {
        const cm = toDate(data.currentMonth);
        if (cm) state.currentMonth = new Date(cm.getFullYear(), cm.getMonth(), 1);
      }

      // Restore loan info bar
      if (data.mismoLoaded) {
        state.mismoLoaded = true;
        el('ltLoanInfo').style.display = 'flex';
        if (data.loanInfo) {
          if (data.loanInfo.borrower && data.loanInfo.borrower !== '--') el('ltBorrower').textContent = data.loanInfo.borrower;
          if (data.loanInfo.fileNum && data.loanInfo.fileNum !== '--') el('ltFileNum').textContent = data.loanInfo.fileNum;
          if (data.loanInfo.purpose && data.loanInfo.purpose !== '--') el('ltPurpose').textContent = data.loanInfo.purpose;
          if (data.loanInfo.program && data.loanInfo.program !== '--') el('ltProgram').textContent = data.loanInfo.program;
        }
        const dropZone = el('ltMismoDrop');
        if (dropZone) {
          dropZone.classList.add('loaded');
          dropZone.textContent = data.mismoDropText || 'MISMO data loaded from session';
          // Re-append hidden file input
          const fi = el('ltMismoFile');
          if (fi) dropZone.appendChild(fi);
        }
      }

      return true;
    } catch (_) { return false; }
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
  document.addEventListener('DOMContentLoaded', function () {
    init();

    if (MSFG.CalcActions) {
      MSFG.CalcActions.register(function () {
        const sections = [];

        // Loan information
        const borrower = el('ltBorrower') ? el('ltBorrower').textContent : '';
        const fileNum = el('ltFileNum') ? el('ltFileNum').textContent : '';
        const purpose = el('ltPurpose') ? el('ltPurpose').textContent : '';
        const program = el('ltProgram') ? el('ltProgram').textContent : '';
        const infoRows = [];
        if (borrower && borrower !== '--') infoRows.push({ label: 'Borrower', value: borrower });
        if (fileNum && fileNum !== '--') infoRows.push({ label: 'File #', value: fileNum });
        infoRows.push({ label: 'Loan Purpose', value: state.loanPurpose || 'Purchase' });
        if (purpose && purpose !== '--') infoRows.push({ label: 'Purpose', value: purpose });
        if (program && program !== '--') infoRows.push({ label: 'Program', value: program });

        // Add days to closing
        const closing = state.events.closingEstimate;
        const funding = state.events.fundingEstimate;
        const today = new Date();
        if (closing) {
          const daysToClose = Math.round((closing - today) / (1000 * 60 * 60 * 24));
          infoRows.push({ label: 'Days to Closing', value: daysToClose >= 0 ? daysToClose + ' days' : 'PAST DUE', isTotal: daysToClose < 0 });
        }
        if (infoRows.length > 0) {
          sections.push({ heading: 'Loan Information', rows: infoRows });
        }

        // Group events by category
        const categoryLabels = {
          milestone: 'Key Milestones',
          deadline: 'Critical Deadlines',
          lock: 'Rate Lock',
          contingency: 'Contingencies',
          condition: 'Conditions',
          turntime: 'Underwriting Turn Times'
        };
        const grouped = {};
        EVENT_DEFS.forEach(function (ev) {
          const d = state.events[ev.id];
          if (d && state.visibility[ev.id] !== false) {
            if (!grouped[ev.category]) grouped[ev.category] = [];
            const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            grouped[ev.category].push({ label: ev.label, value: dateStr });
          }
        });

        // Add grouped sections in order
        ['milestone', 'deadline', 'lock', 'contingency', 'condition', 'turntime'].forEach(function (cat) {
          if (grouped[cat] && grouped[cat].length > 0) {
            sections.push({ heading: categoryLabels[cat], rows: grouped[cat] });
          }
        });

        // Custom dates
        if (state.customDates.length > 0) {
          const customRows = [];
          state.customDates.forEach(function (cd) {
            if (cd.date) {
              const dateStr = cd.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              customRows.push({ label: cd.label, value: dateStr });
            }
          });
          if (customRows.length > 0) {
            sections.push({ heading: 'Custom Dates', rows: customRows });
          }
        }

        // Key dates calculation — lock days remaining, days app to close, etc.
        const summaryRows = [];
        const app = state.events.applicationTaken;
        if (app && closing) {
          summaryRows.push({ label: 'Application to Closing', value: Math.round((closing - app) / (1000 * 60 * 60 * 24)) + ' days' });
        }
        if (closing && funding) {
          summaryRows.push({ label: 'Closing to Funding', value: Math.round((funding - closing) / (1000 * 60 * 60 * 24)) + ' days' });
        }
        const lockDate = state.events.lockDate;
        const lockExp = state.events.lockExpiration;
        if (lockDate && lockExp) {
          const lockDays = Math.round((lockExp - lockDate) / (1000 * 60 * 60 * 24));
          const lockRemaining = Math.round((lockExp - today) / (1000 * 60 * 60 * 24));
          summaryRows.push({ label: 'Lock Period', value: lockDays + ' days' });
          summaryRows.push({ label: 'Lock Days Remaining', value: lockRemaining >= 0 ? lockRemaining + ' days' : 'EXPIRED', isTotal: lockRemaining < 0 });
        }
        if (summaryRows.length > 0) {
          sections.push({ heading: 'Timeline Summary', rows: summaryRows });
        }

        // Notes
        const notes = el('ltNotes') ? el('ltNotes').value.trim() : '';
        if (notes) {
          sections.push({ heading: 'Notes', rows: [{ label: 'Notes', value: notes }] });
        }

        return {
          title: 'Loan Timeline',
          sections: sections
        };
      });
    }
  });

})();
