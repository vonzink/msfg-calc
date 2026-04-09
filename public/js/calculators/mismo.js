'use strict';
/**
 * MISMO Document Analyzer — Orchestrator
 * Handles file upload, state management, checklist rendering, and coordination.
 *
 * Dependencies: MSFG.MISMODocParser, MSFG.MISMOIncomeLogic, MSFG.MISMODocs, MSFG.MISMOUI (loaded as preScripts)
 */
(function () {

  /* ---- State ---- */
  let parsedData = null;
  let checklistState = { income: [], general: [], assets: [], credit: [] };
  let itemCounter = 0;

  const SECTION_MAP = {
    income:  'incomeChecklist',
    general: 'generalChecklist',
    assets:  'assetChecklist',
    credit:  'creditChecklist'
  };

  /* ---- Helpers ---- */
  function el(id) { return document.getElementById(id); }

  function setChip(id, label, state) {
    const chip = el(id);
    if (!chip) return;
    chip.className = 'mismo-chip';
    chip.textContent = label;
    if (state) chip.classList.add('mismo-chip--' + state);
  }

  function setKV(id, value) {
    const node = el(id);
    if (node) node.textContent = value || '\u2014';
  }

  /* ======================================================
     File Upload
     ====================================================== */

  function initUpload() {
    const dropzone = el('mismoDropzone');
    const fileInput = el('mismoFileInput');
    const chooseBtn = el('mismoChooseFile');

    chooseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      fileInput.click();
    });
    dropzone.addEventListener('click', function () { fileInput.click(); });

    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function () {
      if (this.files.length > 0) handleFile(this.files[0]);
      this.value = '';
    });
  }

  function handleFile(file) {
    if (!file.name.match(/\.(xml|mismo)$/i)) {
      alert('Please upload a valid MISMO XML file (.xml)');
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(e.target.result, 'text/xml');
        if (xmlDoc.querySelector('parsererror')) {
          alert('Error parsing XML file. Please ensure it is a valid MISMO 3.4 file.');
          return;
        }
        processXML(xmlDoc);
      } catch (err) {
        console.error('Error processing XML:', err);
        alert('Error processing XML file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  /* ======================================================
     Core Processing
     ====================================================== */

  function processXML(xmlDoc) {
    parsedData = MSFG.MISMODocParser.parseMISMO(xmlDoc);

    // Income docs per borrower — now pass loan-level data
    let incomeDocs = [];
    parsedData.borrowers.forEach(function (b) {
      const docs = MSFG.MISMOIncomeLogic.determineIncomeDocumentation(b, parsedData);
      incomeDocs = incomeDocs.concat(docs);
    });

    // Other docs (general, assets, credit) — enhanced with program awareness
    const otherDocs = MSFG.MISMODocs.generateOtherDocumentation(parsedData);

    // Build state
    checklistState.income  = incomeDocs.map(docToItem);
    checklistState.general = otherDocs.general.map(docToItem);
    checklistState.assets  = otherDocs.assets.map(docToItem);
    checklistState.credit  = otherDocs.credit.map(docToItem);

    // Render
    updateLoanSummary(parsedData);
    updateStatusChips(parsedData);
    renderAllChecklists();

    // Informational sections (not printed/reported)
    MSFG.MISMOUI.renderEmploymentTimeline(parsedData);
    MSFG.MISMOUI.renderIncomeRiskScore(parsedData);
    MSFG.MISMOUI.renderAttentionFlags(parsedData);

    el('mismoResults').classList.remove('u-hidden');
    el('mismoEmpty').classList.add('u-hidden');
    el('mismoActionBar').classList.remove('u-hidden');
  }

  function docToItem(doc) {
    itemCounter++;
    return { id: itemCounter, name: doc.name, status: doc.status, reason: doc.reason };
  }

  /* ======================================================
     Loan Summary + Status Chips
     ====================================================== */

  function updateLoanSummary(data) {
    const names = data.borrowers.map(function (b) { return b.name; }).join(', ');
    setKV('kvBorrower', names);
    setKV('kvPurpose', data.loanPurpose);
    setKV('kvType', data.mortgageType);
    setKV('kvAmount', data.baseLoanAmount ? MSFG.formatCurrency(data.baseLoanAmount, 0) : null);

    // Enhanced fields
    setKV('kvPropertyType', data.propertyType);
    setKV('kvOccupancy', formatOccupancy(data.occupancyType));
    setKV('kvLTV', data.ltv ? data.ltv.toFixed(1) + '%' : null);

    const propAddr = data.subjectProperty;
    if (propAddr && propAddr.address) {
      const parts = [propAddr.address];
      if (propAddr.city || propAddr.state) {
        parts.push((propAddr.city && propAddr.state) ? propAddr.city + ', ' + propAddr.state : (propAddr.city || propAddr.state));
      }
      setKV('kvProperty', parts.join(' '));
    } else {
      setKV('kvProperty', null);
    }

    // Complexity flags
    const flagsEl = el('mismoComplexity');
    if (flagsEl) {
      if (data.complexityFlags.length > 0) {
        flagsEl.innerHTML = data.complexityFlags.map(function (f) {
          return '<span class="mismo-complexity-flag">' + MSFG.escHtml(f) + '</span>';
        }).join('');
        flagsEl.classList.remove('u-hidden');
      } else {
        flagsEl.classList.add('u-hidden');
      }
    }
  }

  function formatOccupancy(type) {
    if (!type) return null;
    const map = {
      'PrimaryResidence': 'Primary Residence',
      'SecondHome': 'Second Home',
      'Investment': 'Investment Property',
      'Investor': 'Investment Property'
    };
    return map[type] || type;
  }

  function updateStatusChips(data) {
    // Employment coverage
    const empCoverages = data.borrowers.map(function (b) {
      return MSFG.MISMODocParser.calculateEmploymentCoverage(b);
    });
    const worstEmp = empCoverages.reduce(function (w, c) {
      return c.monthsNeeded > w.monthsNeeded ? c : w;
    }, { monthsNeeded: 0, totalMonths: 0 });

    if (worstEmp.monthsNeeded > 0) {
      setChip('chipEmp', 'Employment: need +' + worstEmp.monthsNeeded + ' mo', 'need');
    } else {
      setChip('chipEmp', 'Employment: 24 mo \u2713', 'ok');
    }

    // Residence coverage
    const resCoverages = data.borrowers.map(function (b) {
      return MSFG.MISMODocParser.calculateResidenceCoverage(b);
    });
    const worstRes = resCoverages.reduce(function (w, c) {
      return c.monthsNeeded > w.monthsNeeded ? c : w;
    }, { monthsNeeded: 0, totalMonths: 0 });

    if (worstRes.monthsNeeded > 0) {
      setChip('chipRes', 'Residence: need +' + worstRes.monthsNeeded + ' mo', 'need');
    } else {
      setChip('chipRes', 'Residence: 24 mo \u2713', 'ok');
    }

    // REO
    const reoCount = data.reoProperties.length;
    setChip('chipREO', reoCount > 0 ? 'REO: ' + reoCount + ' properties' : 'REO: none', reoCount > 0 ? 'warn' : 'ok');

    // Declarations
    const anyFlags = data.borrowers.some(function (b) {
      return b.declarations.bankruptcy || b.declarations.foreclosure ||
             b.declarations.judgments || b.declarations.usCitizen === false;
    });
    setChip('chipDec', anyFlags ? 'Declarations: flags present' : 'Declarations: clear', anyFlags ? 'warn' : 'ok');

    // Loan program chip
    let programLabel = 'Conventional';
    let programState = 'ok';
    if (data.isFHA) { programLabel = 'FHA'; programState = 'warn'; }
    else if (data.isVA) { programLabel = 'VA'; programState = 'warn'; }
    else if (data.isUSDA) { programLabel = 'USDA'; programState = 'warn'; }
    setChip('chipProgram', 'Program: ' + programLabel, programState);

    // Employment gaps chip
    let totalGaps = 0;
    data.borrowers.forEach(function (b) {
      if (MSFG.MISMODocParser.detectEmploymentGaps) {
        totalGaps += MSFG.MISMODocParser.detectEmploymentGaps(b).length;
      }
    });
    if (totalGaps > 0) {
      setChip('chipGaps', 'Emp Gaps: ' + totalGaps, 'need');
    } else {
      setChip('chipGaps', 'Emp Gaps: none', 'ok');
    }
  }

  /* ======================================================
     Editable Checklist Rendering
     ====================================================== */

  function renderAllChecklists() {
    Object.keys(SECTION_MAP).forEach(function (key) {
      renderChecklist(SECTION_MAP[key], key);
    });
    updateSectionCounts();
  }

  function renderChecklist(containerId, sectionKey) {
    const container = el(containerId);
    const items = checklistState[sectionKey];

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="mismo-empty-section">No documents required in this category</div>';
      return;
    }

    container.innerHTML = '';
    items.forEach(function (item) {
      container.appendChild(createItemRow(item, sectionKey));
    });
  }

  function updateSectionCounts() {
    Object.keys(SECTION_MAP).forEach(function (key) {
      const countEl = el(SECTION_MAP[key] + 'Count');
      if (!countEl) return;
      const items = checklistState[key];
      const required = items.filter(function (i) { return i.status === 'required'; }).length;
      const conditional = items.filter(function (i) { return i.status === 'conditional'; }).length;
      const incomplete = items.filter(function (i) { return i.status === 'incomplete'; }).length;
      const parts = [];
      if (required > 0) parts.push(required + ' required');
      if (conditional > 0) parts.push(conditional + ' conditional');
      if (incomplete > 0) parts.push(incomplete + ' incomplete');
      countEl.textContent = parts.length > 0 ? '(' + parts.join(', ') + ')' : '';
    });
  }

  function createItemRow(item, sectionKey) {
    const row = document.createElement('div');
    row.className = 'mismo-doc-item mismo-doc-item--' + item.status;
    row.dataset.itemId = String(item.id);

    // Status select
    const statusSelect = document.createElement('select');
    statusSelect.className = 'mismo-doc-item__status';
    var statusLabels = { required: 'Required', conditional: 'Conditional', incomplete: 'Incomplete', ok: 'Cleared' };
    ['required', 'conditional', 'incomplete', 'ok'].forEach(function (s) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = statusLabels[s];
      if (s === item.status) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusSelect.addEventListener('change', function () {
      item.status = this.value;
      row.className = 'mismo-doc-item mismo-doc-item--' + item.status;
      updateSectionCounts();
    });

    // Name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'mismo-doc-item__name';
    nameInput.value = item.name;
    nameInput.addEventListener('input', function () { item.name = this.value; });

    // Reason input
    const reasonInput = document.createElement('input');
    reasonInput.type = 'text';
    reasonInput.className = 'mismo-doc-item__reason';
    reasonInput.value = item.reason;
    reasonInput.addEventListener('input', function () { item.reason = this.value; });

    // Delete button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'mismo-doc-item__remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', function () {
      checklistState[sectionKey] = checklistState[sectionKey].filter(function (i) {
        return i.id !== item.id;
      });
      row.remove();
      updateSectionCounts();
      // Show empty message if section is now empty
      const container = el(SECTION_MAP[sectionKey]);
      if (checklistState[sectionKey].length === 0) {
        container.innerHTML = '<div class="mismo-empty-section">No documents required in this category</div>';
      }
    });

    row.appendChild(statusSelect);
    row.appendChild(nameInput);
    row.appendChild(reasonInput);
    row.appendChild(removeBtn);
    return row;
  }

  /* ======================================================
     Add Item
     ====================================================== */

  function addItem(sectionKey) {
    itemCounter++;
    const newItem = { id: itemCounter, name: '', status: 'required', reason: '' };
    checklistState[sectionKey].push(newItem);

    const container = el(SECTION_MAP[sectionKey]);

    // Remove "no documents" message
    const emptyMsg = container.querySelector('.mismo-empty-section');
    if (emptyMsg) emptyMsg.remove();

    const row = createItemRow(newItem, sectionKey);
    container.appendChild(row);
    updateSectionCounts();

    // Focus the name input
    const nameInput = row.querySelector('.mismo-doc-item__name');
    if (nameInput) nameInput.focus();
  }

  /* ======================================================
     Clear All
     ====================================================== */

  function clearAll() {
    parsedData = null;
    checklistState = { income: [], general: [], assets: [], credit: [] };
    itemCounter = 0;

    // Reset summary
    ['kvBorrower', 'kvPurpose', 'kvType', 'kvAmount', 'kvPropertyType', 'kvOccupancy', 'kvLTV', 'kvProperty'].forEach(function (id) {
      setKV(id, null);
    });

    // Reset chips
    ['chipEmp', 'chipRes', 'chipREO', 'chipDec', 'chipProgram', 'chipGaps'].forEach(function (id) {
      const chip = el(id);
      if (!chip) return;
      chip.className = 'mismo-chip';
    });
    setKV('chipEmp', 'Employment: Pending');
    setKV('chipRes', 'Residence: Pending');
    setKV('chipREO', 'REO: Pending');
    setKV('chipDec', 'Declarations: Pending');
    setKV('chipProgram', 'Program: Pending');
    setKV('chipGaps', 'Emp Gaps: Pending');

    // Hide complexity
    const flagsEl = el('mismoComplexity');
    if (flagsEl) flagsEl.classList.add('u-hidden');

    // Clear checklists
    Object.keys(SECTION_MAP).forEach(function (key) {
      el(SECTION_MAP[key]).innerHTML = '';
      const countEl = el(SECTION_MAP[key] + 'Count');
      if (countEl) countEl.textContent = '';
    });

    // Clear informational sections
    ['mismoEmploymentTimeline', 'mismoRiskScore', 'mismoAttentionFlags'].forEach(function (id) {
      const section = el(id);
      if (section) { section.innerHTML = ''; section.classList.add('u-hidden'); }
    });

    el('mismoResults').classList.add('u-hidden');
    el('mismoEmpty').classList.remove('u-hidden');
    el('mismoActionBar').classList.add('u-hidden');
  }

  /* ======================================================
     Workspace MISMO Auto-Populate Hook
     ====================================================== */

  window.__mismoProcessXmlString = function (xmlString) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      if (xmlDoc.querySelector('parsererror')) return;
      processXML(xmlDoc);
    } catch (e) {
      console.warn('MISMO auto-populate failed:', e);
    }
  };

  /* ======================================================
     Init
     ====================================================== */

  document.addEventListener('DOMContentLoaded', function () {
    initUpload();

    // Add-item buttons
    document.querySelectorAll('.mismo-add-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        addItem(this.dataset.section);
      });
    });

    // Action buttons
    el('mismoClearBtn').addEventListener('click', clearAll);

    // Auto-populate from workspace sessionStorage
    const storedXml = sessionStorage.getItem('msfg-mismo-xml');
    if (storedXml) {
      window.__mismoProcessXmlString(storedXml);
    }

    /* ---- Register email data provider ---- */
    if (MSFG.CalcActions) {
      MSFG.CalcActions.register(function () {
        const sections = [];

        // Loan summary section (compact — combine related fields)
        const summaryRows = [];
        function kv(id) {
          const node = el(id);
          const val = node ? node.textContent.trim() : '';
          return (val && val !== '\u2014' && val !== '--') ? val : '';
        }
        const borrower = kv('kvBorrower');
        if (borrower) summaryRows.push({ label: 'Borrower(s)', value: borrower, bold: true });
        const property = kv('kvProperty');
        if (property) summaryRows.push({ label: 'Property', value: property });
        // Combine purpose / type / occupancy into one line
        const purposeParts = [kv('kvPurpose'), kv('kvType'), kv('kvOccupancy')].filter(Boolean);
        if (purposeParts.length) summaryRows.push({ label: 'Purpose / Type / Occupancy', value: purposeParts.join('  \u00B7  ') });
        // Combine amount / LTV / property type into one line
        const amtParts = [];
        const amt = kv('kvAmount');
        const ltv = kv('kvLTV');
        const propType = kv('kvPropertyType');
        if (amt) amtParts.push(amt);
        if (ltv) amtParts.push(ltv + ' LTV');
        if (propType) amtParts.push(propType);
        if (amtParts.length) summaryRows.push({ label: 'Amount / LTV / Property', value: amtParts.join('  \u00B7  ') });
        if (summaryRows.length > 0) {
          sections.push({ heading: 'Loan Summary', rows: summaryRows });
        }

        // Helper to build section from checklist state
        function buildSection(heading, sectionKey) {
          const items = checklistState[sectionKey];
          if (!items || items.length === 0) return;
          const rows = [];
          // Count summary as first row
          const required = items.filter(function (i) { return i.status === 'required'; }).length;
          const conditional = items.filter(function (i) { return i.status === 'conditional'; }).length;
          const ok = items.filter(function (i) { return i.status === 'ok'; }).length;
          const countParts = [];
          if (required > 0) countParts.push(required + ' required');
          if (conditional > 0) countParts.push(conditional + ' conditional');
          if (ok > 0) countParts.push(ok + ' received');
          rows.push({ label: heading, value: countParts.join('  \u00B7  ') || 'None', isTotal: true });
          items.forEach(function (item) {
            rows.push({
              label: item.name,
              value: item.reason ? '\u2014 ' + item.reason : '',
              stacked: true,
              bulletColor: item.status === 'required' ? '#c62828' :
                           item.status === 'conditional' ? '#b8960c' :
                           item.status === 'ok' ? '#2e7d32' :
                           item.status === 'incomplete' ? '#1565c0' : '#666'
            });
          });
          sections.push({ heading: heading, rows: rows });
        }

        buildSection('Income Documentation', 'income');
        buildSection('General Documentation', 'general');
        buildSection('Asset Documentation', 'assets');
        buildSection('Credit Documentation', 'credit');

        return {
          title: 'Conditions & Documents Checklist',
          sections: sections
        };
      });
    }
  });

})();
