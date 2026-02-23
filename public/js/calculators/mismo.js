'use strict';
/**
 * MISMO Document Analyzer
 * Parses MISMO 3.4 XML and generates editable document checklists.
 *
 * Dependencies: MSFG.MISMODocParser, MSFG.MISMOIncomeLogic (loaded as preScripts)
 */
(function () {

  /* ---- State ---- */
  var parsedData = null;
  var checklistState = { income: [], general: [], assets: [], credit: [] };
  var itemCounter = 0;

  var SECTION_MAP = {
    income:  'incomeChecklist',
    general: 'generalChecklist',
    assets:  'assetChecklist',
    credit:  'creditChecklist'
  };

  /* ---- Helpers ---- */
  function el(id) { return document.getElementById(id); }

  function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(num);
  }

  function setChip(id, label, state) {
    var chip = el(id);
    if (!chip) return;
    chip.className = 'mismo-chip';
    chip.textContent = label;
    if (state) chip.classList.add('mismo-chip--' + state);
  }

  /* ======================================================
     File Upload
     ====================================================== */

  function initUpload() {
    var dropzone = el('mismoDropzone');
    var fileInput = el('mismoFileInput');
    var chooseBtn = el('mismoChooseFile');

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
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(e.target.result, 'text/xml');
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

    // Income docs per borrower
    var incomeDocs = [];
    parsedData.borrowers.forEach(function (b) {
      var docs = MSFG.MISMOIncomeLogic.determineIncomeDocumentation(b);
      incomeDocs = incomeDocs.concat(docs);
    });

    // Other docs
    var otherDocs = generateOtherDocumentation(parsedData);

    // Build state
    checklistState.income  = incomeDocs.map(docToItem);
    checklistState.general = otherDocs.general.map(docToItem);
    checklistState.assets  = otherDocs.assets.map(docToItem);
    checklistState.credit  = otherDocs.credit.map(docToItem);

    // Render
    updateLoanSummary(parsedData);
    updateStatusChips(parsedData);
    renderAllChecklists();

    el('mismoResults').style.display = '';
    el('mismoEmpty').style.display = 'none';
    el('mismoActionBar').style.display = '';
  }

  function docToItem(doc) {
    itemCounter++;
    return { id: itemCounter, name: doc.name, status: doc.status, reason: doc.reason };
  }

  /* ======================================================
     Loan Summary + Status Chips
     ====================================================== */

  function updateLoanSummary(data) {
    var names = data.borrowers.map(function (b) { return b.name; }).join(', ');
    el('kvBorrower').textContent = names || '\u2014';
    el('kvPurpose').textContent  = data.loanPurpose || '\u2014';
    el('kvType').textContent     = data.mortgageType || '\u2014';
    el('kvAmount').textContent   = data.baseLoanAmount ? formatCurrency(data.baseLoanAmount) : '\u2014';
  }

  function updateStatusChips(data) {
    // Employment coverage
    var empCoverages = data.borrowers.map(function (b) {
      return MSFG.MISMODocParser.calculateEmploymentCoverage(b);
    });
    var worstEmp = empCoverages.reduce(function (w, c) {
      return c.monthsNeeded > w.monthsNeeded ? c : w;
    }, { monthsNeeded: 0, totalMonths: 0 });

    if (worstEmp.monthsNeeded > 0) {
      setChip('chipEmp', 'Employment: need +' + worstEmp.monthsNeeded + ' mo', 'need');
    } else {
      setChip('chipEmp', 'Employment: 24 mo \u2713', 'ok');
    }

    // Residence coverage
    var resCoverages = data.borrowers.map(function (b) {
      return MSFG.MISMODocParser.calculateResidenceCoverage(b);
    });
    var worstRes = resCoverages.reduce(function (w, c) {
      return c.monthsNeeded > w.monthsNeeded ? c : w;
    }, { monthsNeeded: 0, totalMonths: 0 });

    if (worstRes.monthsNeeded > 0) {
      setChip('chipRes', 'Residence: need +' + worstRes.monthsNeeded + ' mo', 'need');
    } else {
      setChip('chipRes', 'Residence: 24 mo \u2713', 'ok');
    }

    // REO
    var reoCount = data.reoProperties.length;
    setChip('chipREO', reoCount > 0 ? 'REO: ' + reoCount : 'REO: none', reoCount > 0 ? 'warn' : 'ok');

    // Declarations
    var anyFlags = data.borrowers.some(function (b) {
      return b.declarations.bankruptcy || b.declarations.foreclosure ||
             b.declarations.judgments || b.declarations.usCitizen === false;
    });
    setChip('chipDec', anyFlags ? 'Declarations: flags present' : 'Declarations: clear', anyFlags ? 'warn' : 'ok');
  }

  /* ======================================================
     Generate Other Documentation (general, assets, credit)
     ====================================================== */

  function generateOtherDocumentation(data) {
    var general = [];
    var assets = [];
    var credit = [];

    // General
    general.push({ name: 'IRS Form 4506-C (transcript authorization)', status: 'required',
      reason: 'Standard for income verification.' });

    if ((data.loanPurpose || '').toLowerCase() === 'purchase') {
      general.push({ name: 'Executed purchase contract', status: 'required',
        reason: 'Loan purpose is Purchase.' });
      general.push({ name: 'Earnest money proof (canceled check / statement)', status: 'required',
        reason: 'Shows source of EMD.' });
    } else if ((data.loanPurpose || '').toLowerCase() === 'refinance') {
      general.push({ name: 'Current mortgage statement (subject property)', status: 'required',
        reason: 'Refinance transaction.' });
      general.push({ name: 'Promissory Note (copy)', status: 'required',
        reason: 'Refinance transaction.' });
    }

    // Per-borrower
    data.borrowers.forEach(function (b) {
      var tag = '[' + b.name + ']';
      general.push({ name: tag + ' Government-issued photo ID', status: 'required',
        reason: 'Always required per borrower.' });

      if (b.declarations.usCitizen === false) {
        if (b.declarations.permResident) {
          general.push({ name: tag + ' I-551 (Green Card) \u2013 front & back', status: 'required',
            reason: 'Non-US citizen (permanent resident).' });
        } else if (b.declarations.nonPermResident) {
          general.push({ name: tag + ' Valid EAD card (I-766) or visa with work authorization + I-94', status: 'required',
            reason: 'Non-permanent resident alien.' });
        }
      }

      if (b.declarations.bankruptcy) {
        credit.push({ name: tag + ' Bankruptcy documents (petition, schedules, discharge)', status: 'required',
          reason: 'Bankruptcy indicated on declarations.' });
      }
      if (b.declarations.foreclosure) {
        credit.push({ name: tag + ' Foreclosure / short sale documents + LOE', status: 'required',
          reason: 'History of foreclosure/short sale.' });
      }
      if (b.declarations.judgments) {
        credit.push({ name: tag + ' Court payoff / release for outstanding judgments', status: 'required',
          reason: 'Outstanding judgments indicated.' });
      }
    });

    // Assets
    if (data.assets.length > 0) {
      data.assets.forEach(function (asset) {
        var label = asset.holderName || asset.accountIdentifier || 'Account';
        assets.push({ name: 'Account statements (2 months) \u2013 ' + (asset.type || 'Asset') + ' at ' + label,
          status: 'required', reason: 'Verify funds to close & reserves.' });
      });
    } else if ((data.loanPurpose || '').toLowerCase() === 'purchase') {
      assets.push({ name: 'Proof of funds for down payment & closing', status: 'required',
        reason: 'No assets listed in XML.' });
    }

    // REO properties
    data.reoProperties.forEach(function (prop, idx) {
      var label = prop.address || ('Property #' + (idx + 1));
      credit.push({ name: 'Mortgage/HELOC statement \u2013 ' + label, status: 'required',
        reason: 'REO property identified.' });
      credit.push({ name: 'Hazard insurance declaration \u2013 ' + label, status: 'required',
        reason: 'Verify coverage.' });
    });

    return { general: general, assets: assets, credit: credit };
  }

  /* ======================================================
     Editable Checklist Rendering
     ====================================================== */

  function renderAllChecklists() {
    Object.keys(SECTION_MAP).forEach(function (key) {
      renderChecklist(SECTION_MAP[key], key);
    });
  }

  function renderChecklist(containerId, sectionKey) {
    var container = el(containerId);
    var items = checklistState[sectionKey];

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="mismo-empty-section">No documents required in this category</div>';
      return;
    }

    container.innerHTML = '';
    items.forEach(function (item) {
      container.appendChild(createItemRow(item, sectionKey));
    });
  }

  function createItemRow(item, sectionKey) {
    var row = document.createElement('div');
    row.className = 'mismo-doc-item mismo-doc-item--' + item.status;
    row.dataset.itemId = String(item.id);

    // Status select
    var statusSelect = document.createElement('select');
    statusSelect.className = 'mismo-doc-item__status';
    ['required', 'conditional', 'ok'].forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
      if (s === item.status) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusSelect.addEventListener('change', function () {
      item.status = this.value;
      row.className = 'mismo-doc-item mismo-doc-item--' + item.status;
    });

    // Name input
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'mismo-doc-item__name';
    nameInput.value = item.name;
    nameInput.addEventListener('input', function () { item.name = this.value; });

    // Reason input
    var reasonInput = document.createElement('input');
    reasonInput.type = 'text';
    reasonInput.className = 'mismo-doc-item__reason';
    reasonInput.value = item.reason;
    reasonInput.addEventListener('input', function () { item.reason = this.value; });

    // Delete button
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'mismo-doc-item__remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', function () {
      checklistState[sectionKey] = checklistState[sectionKey].filter(function (i) {
        return i.id !== item.id;
      });
      row.remove();
      // Show empty message if section is now empty
      var container = el(SECTION_MAP[sectionKey]);
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
    var newItem = { id: itemCounter, name: '', status: 'required', reason: '' };
    checklistState[sectionKey].push(newItem);

    var container = el(SECTION_MAP[sectionKey]);

    // Remove "no documents" message
    var emptyMsg = container.querySelector('.mismo-empty-section');
    if (emptyMsg) emptyMsg.remove();

    var row = createItemRow(newItem, sectionKey);
    container.appendChild(row);

    // Focus the name input
    var nameInput = row.querySelector('.mismo-doc-item__name');
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
    el('kvBorrower').textContent = '\u2014';
    el('kvPurpose').textContent  = '\u2014';
    el('kvType').textContent     = '\u2014';
    el('kvAmount').textContent   = '\u2014';

    // Reset chips
    ['chipEmp', 'chipRes', 'chipREO', 'chipDec'].forEach(function (id) {
      var chip = el(id);
      if (!chip) return;
      chip.className = 'mismo-chip';
    });
    el('chipEmp').textContent = 'Employment: Pending';
    el('chipRes').textContent = 'Residence: Pending';
    el('chipREO').textContent = 'REO: Pending';
    el('chipDec').textContent = 'Declarations: Pending';

    // Clear checklists
    Object.keys(SECTION_MAP).forEach(function (key) {
      el(SECTION_MAP[key]).innerHTML = '';
    });

    el('mismoResults').style.display = 'none';
    el('mismoEmpty').style.display = '';
    el('mismoActionBar').style.display = 'none';
  }

  /* ======================================================
     Workspace MISMO Auto-Populate Hook
     ====================================================== */

  window.__mismoProcessXmlString = function (xmlString) {
    try {
      var parser = new DOMParser();
      var xmlDoc = parser.parseFromString(xmlString, 'text/xml');
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
    el('mismoPrintBtn').addEventListener('click', function () { window.print(); });
    el('mismoClearBtn').addEventListener('click', clearAll);

    // Auto-populate from workspace sessionStorage
    var storedXml = sessionStorage.getItem('msfg-mismo-xml');
    if (storedXml) {
      window.__mismoProcessXmlString(storedXml);
    }
  });

})();
