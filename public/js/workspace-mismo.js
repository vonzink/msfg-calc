(function() {
  'use strict';

  let mismoData = null;
  let onDataLoadedCallback = null;

  function initMISMODropZone() {
    const dropZone = document.getElementById('mismoDropZone');
    const fileInput = document.getElementById('mismoFileInput');
    const clearBtn = document.getElementById('mismoClear');

    ['dragenter', 'dragover'].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) handleMISMOFile(files[0]);
    });

    fileInput.addEventListener('change', function() {
      if (this.files.length > 0) handleMISMOFile(this.files[0]);
      this.value = '';
    });

    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearMISMOData();
    });
  }

  // A fee-bearing MISMO (Closing Disclosure / Loan Estimate) carries itemized
  // fees, prepaids, or escrow. URLA/1003 application exports do not — detect so a
  // fee-less file doesn't fail silently in the Fee Worksheet / Loan Comparison.
  function mismoHasFeeData(data) {
    if (!data) return false;
    var fees = data.fees || {};
    var hasFees = Object.keys(fees).some(function (k) { return k.charAt(0) !== '_'; });
    if (hasFees) return true;
    if (data.prepaids && Object.keys(data.prepaids).length > 0) return true;
    if (data.escrow && Object.keys(data.escrow).length > 0) return true;
    return false;
  }

  function handleMISMOFile(file) {
    if (!file.name.match(/\.(xml|mismo)$/i)) {
      MSFG.WS.showToast('Please drop a MISMO XML file (.xml)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = MSFG.MISMOParser.parse(e.target.result);
        mismoData = parsed;
        sessionStorage.setItem('msfg-mismo-data', JSON.stringify(parsed));
        sessionStorage.setItem('msfg-mismo-filename', file.name);
        sessionStorage.setItem('msfg-mismo-xml', e.target.result);
        updateMISMOUI(parsed, file.name);
        if (typeof onDataLoadedCallback === 'function') onDataLoadedCallback();
        broadcastMISMOToIframes(e.target.result);
        if (mismoHasFeeData(parsed)) {
          MSFG.WS.showToast('MISMO data loaded — ' + (parsed.borrowerName || 'borrower'), 'success');
        } else {
          MSFG.WS.showToast(
            'Loaded ' + (parsed.borrowerName || 'borrower') + ', but this file has no fee or closing-cost data — ' +
            'it looks like a URLA/1003 application export. Drop the Closing Disclosure MISMO to populate fees.',
            'warning', 8000);
        }
      } catch (err) {
        console.error('MISMO parse error:', err);
        MSFG.WS.showToast('Failed to parse MISMO file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function broadcastMISMOToIframes(xmlString) {
    try {
      const iframes = document.querySelectorAll('.ws-panel__iframe');
      iframes.forEach((iframe) => {
        try {
          iframe.contentWindow.postMessage(
            { type: 'msfg-mismo-data', xml: xmlString },
            window.location.origin
          );
        } catch (e) { /* cross-origin or not ready */ }
      });
    } catch (e) { /* ignore */ }
  }

  function restoreMISMOData() {
    const stored = sessionStorage.getItem('msfg-mismo-data');
    const filename = sessionStorage.getItem('msfg-mismo-filename');
    if (stored) {
      try {
        mismoData = JSON.parse(stored);
        updateMISMOUI(mismoData, filename || 'MISMO File');
      } catch (e) { /* corrupted */ }
    }
  }

  function updateMISMOUI(data, filename) {
    const dropZone = document.getElementById('mismoDropZone');
    const inner = dropZone.querySelector('.mismo-drop__inner');
    const active = document.getElementById('mismoActive');
    const borrowerEl = document.getElementById('mismoBorrower');
    const metaEl = document.getElementById('mismoMeta');

    dropZone.classList.add('has-data');
    inner.classList.add('u-hidden');
    active.classList.remove('u-hidden');
    borrowerEl.textContent = data.borrowerName || 'Borrower';

    const parts = [];
    if (data.loan.amount) parts.push('Loan: $' + MSFG.WS.formatNum(data.loan.amount));
    if (data.loan.rate) parts.push('Rate: ' + data.loan.rate + '%');
    if (data.loan.termMonths) parts.push('Term: ' + (data.loan.termMonths / 12) + 'yr');
    if (data.property.value) parts.push('Value: $' + MSFG.WS.formatNum(data.property.value));
    if (data.loan.purpose) parts.push(data.loan.purpose);
    metaEl.textContent = parts.join('  •  ');

    // Persistent warning when the file carries no fee/closing data.
    var warnEl = document.getElementById('mismoFeeWarn');
    if (!mismoHasFeeData(data)) {
      if (!warnEl) {
        warnEl = document.createElement('div');
        warnEl.id = 'mismoFeeWarn';
        warnEl.style.cssText = 'margin-top:6px;font-size:.76rem;line-height:1.35;color:#b45309;font-weight:500;';
        active.appendChild(warnEl);
      }
      warnEl.textContent = '⚠ No fee/closing data in this file (URLA/1003 application export). Drop the Closing Disclosure MISMO to populate fees.';
      warnEl.style.display = '';
    } else if (warnEl) {
      warnEl.style.display = 'none';
    }
  }

  function clearMISMOData() {
    mismoData = null;
    sessionStorage.removeItem('msfg-mismo-data');
    sessionStorage.removeItem('msfg-mismo-filename');
    sessionStorage.removeItem('msfg-mismo-xml');

    const dropZone = document.getElementById('mismoDropZone');
    const inner = dropZone.querySelector('.mismo-drop__inner');
    const active = document.getElementById('mismoActive');

    dropZone.classList.remove('has-data');
    inner.classList.remove('u-hidden');
    active.classList.add('u-hidden');

    MSFG.WS.showToast('MISMO data cleared', 'success');
  }

  function schedulePopulate(iframe, slug, instanceId) {
    if (!mismoData) return;

    function tryPopulate(attempt) {
      if (attempt > 10) return;
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const nested = doc ? doc.querySelector('iframe') : null;
        if (nested) {
          let nestedDoc = null;
          try { nestedDoc = nested.contentDocument || nested.contentWindow.document; } catch (_e) { /* cross-origin */ }
          if (!nestedDoc || !nestedDoc.body || !nestedDoc.body.innerHTML) {
            nested.addEventListener('load', () => {
              setTimeout(() => { populatePanel(slug, instanceId); }, 200);
            });
            return;
          }
        }
      } catch (e) { /* skip */ }
      const count = populatePanel(slug, instanceId);
      if (count === 0 && attempt < 10) {
        setTimeout(() => { tryPopulate(attempt + 1); }, 300);
      }
    }

    setTimeout(() => { tryPopulate(0); }, 400);
  }

  function populateAllPanels(panels) {
    if (!mismoData) return;
    panels.forEach((panel) => {
      populatePanel(panel.slug, panel.instanceId);
    });
  }

  function populatePanel(slug, instanceId) {
    if (!mismoData || !MSFG.MISMOParser) return 0;

    const mapFn = MSFG.MISMOParser.getCalcMap(slug);
    if (!mapFn) return 0;

    const fieldMap = mapFn(mismoData);
    if (!fieldMap || Object.keys(fieldMap).length === 0) return 0;

    // Panels are keyed by instanceId (ws-panel-<instanceId>), not slug — the workspace
    // supports multiple instances of one calculator. Prefer the instanceId; fall back to
    // the first open panel matching this slug.
    let panelEl = instanceId ? document.getElementById('ws-panel-' + instanceId) : null;
    if (!panelEl) {
      const hdr = document.querySelector('.ws-panel__header[data-slug="' + slug + '"]');
      if (hdr) panelEl = hdr.closest('.ws-panel');
    }
    if (!panelEl) return 0;

    const iframe = panelEl.querySelector('.ws-panel__iframe');
    if (!iframe) return 0;

    return populateIframeFields(iframe, slug, fieldMap, instanceId);
  }

  function populateIframeFields(iframe, slug, fieldMap, instanceId) {
    let outerDoc;
    try {
      outerDoc = iframe.contentDocument || iframe.contentWindow.document;
    } catch (e) { return 0; }
    if (!outerDoc) return 0;

    // Special handling: MISMO Document Analyzer — inject raw XML
    if (fieldMap.__mismo_xml_inject) {
      const storedXml = sessionStorage.getItem('msfg-mismo-xml');
      if (storedXml) {
        try {
          const iframeWin = iframe.contentWindow;
          if (iframeWin && typeof iframeWin.__mismoProcessXmlString === 'function') {
            iframeWin.__mismoProcessXmlString(storedXml);
            MSFG.WS.highlightPanel(slug, 1, instanceId);
            return 1;
          }
        } catch (e) { /* cross-origin or not ready */ }
      }
      return 0;
    }

    const reactKeys = {};
    const domKeys = {};
    const amortKeys = {};
    const radioKeys = {};

    Object.keys(fieldMap).forEach((key) => {
      if (key.indexOf('__react_') === 0) {
        reactKeys[key.replace('__react_', '')] = fieldMap[key];
      } else if (key.indexOf('__amort_') === 0) {
        amortKeys[key.replace('__amort_', '')] = fieldMap[key];
      } else if (key.indexOf('__radio_') === 0) {
        radioKeys[key.replace('__radio_', '')] = fieldMap[key];
      } else if (key === '__custom_items' || key === '__mismo_xml_inject' || key === '__budget_data') {
        // Handled separately
      } else {
        domKeys[key] = fieldMap[key];
      }
    });

    // Find the target document (may be a nested iframe for legacy calcs)
    let targetDoc = outerDoc;
    const nestedIframe = outerDoc.querySelector('iframe');
    if (nestedIframe) {
      try {
        const nd = nestedIframe.contentDocument || nestedIframe.contentWindow.document;
        if (nd && nd.body) targetDoc = nd;
      } catch (e) { /* cross-origin */ }
    }

    // Populate standard DOM inputs
    let populated = 0;
    Object.keys(domKeys).forEach((elId) => {
      const el = targetDoc.getElementById(elId);
      if (!el) return;

      const val = domKeys[elId];
      if (el.tagName === 'SELECT') {
        MSFG.WS.setSelectValue(el, val);
      } else if (el.type === 'checkbox') {
        el.checked = !!val;
        MSFG.WS.triggerEvent(el, 'change');
      } else {
        MSFG.WS.setInputValue(el, val);
      }
      el.classList.remove('is-default');
      el.classList.add('mismo-populated');
      populated++;
    });

    // Handle React SPA (legacy amortization)
    if (Object.keys(reactKeys).length > 0) {
      const reactCount = populateReactApp(nestedIframe || iframe, reactKeys);
      populated += reactCount;
    }

    // Handle amortization native EJS special keys (term toggle buttons)
    if (Object.keys(amortKeys).length > 0) {
      Object.keys(amortKeys).forEach((key) => {
        if (key === 'term') {
          const termYears = String(Math.round(amortKeys[key]));
          const termBtn = targetDoc.querySelector('.amort-term-btn[data-years="' + termYears + '"]');
          if (termBtn) {
            targetDoc.querySelectorAll('.amort-term-btn[data-years]').forEach((b) => { b.classList.remove('active'); });
            termBtn.classList.add('active');
            MSFG.WS.triggerEvent(termBtn, 'click');
            populated++;
          }
        }
      });
    }

    // Handle radio button inputs
    if (Object.keys(radioKeys).length > 0) {
      Object.keys(radioKeys).forEach((name) => {
        const val = radioKeys[name];
        const radio = targetDoc.querySelector('input[type="radio"][name="' + name + '"][value="' + val + '"]');
        if (radio) {
          radio.checked = true;
          MSFG.WS.triggerEvent(radio, 'change');
          populated++;
        }
      });
    }

    // Handle custom line items (fee-worksheet MISMO unmapped fees)
    if (fieldMap.__custom_items && Array.isArray(fieldMap.__custom_items)) {
      let targetWin = null;
      try {
        if (nestedIframe) {
          targetWin = nestedIframe.contentWindow;
        } else {
          targetWin = iframe.contentWindow;
        }
      } catch (e) { /* cross-origin */ }

      if (targetWin && typeof targetWin.MSFG_FW_addCustomItem === 'function') {
        fieldMap.__custom_items.forEach((item) => {
          targetWin.MSFG_FW_addCustomItem(item.section, item.name, item.amount);
          populated++;
        });
      }
    }

    // Handle budget calculator structured data
    if (fieldMap.__budget_data) {
      let budgetWin = null;
      try {
        if (nestedIframe) {
          budgetWin = nestedIframe.contentWindow;
        } else {
          budgetWin = iframe.contentWindow;
        }
      } catch (e) { /* cross-origin */ }

      if (budgetWin && typeof budgetWin.MSFG_BG_populateMISMO === 'function') {
        budgetWin.MSFG_BG_populateMISMO(fieldMap.__budget_data);
        populated++;
      } else if (budgetWin) {
        // Script may not have executed yet — retry with backoff
        (function retryBudget(attempts) {
          if (attempts > 15) return;
          setTimeout(() => {
            if (typeof budgetWin.MSFG_BG_populateMISMO === 'function') {
              budgetWin.MSFG_BG_populateMISMO(fieldMap.__budget_data);
              MSFG.WS.highlightPanel(slug, 1, instanceId);
            } else {
              retryBudget(attempts + 1);
            }
          }, 300);
        })(0);
      }
    }

    if (populated > 0) {
      MSFG.WS.highlightPanel(slug, populated, instanceId);
    }
    return populated;
  }

  function populateReactApp(iframe, fields) {
    let doc;
    try {
      doc = iframe.contentDocument || iframe.contentWindow.document;
    } catch (e) { return 0; }
    if (!doc) return 0;

    const labelMap = {
      'homeValue': 'Home Value',
      'downPct': 'Down Payment',
      'rate': 'Interest Rate',
      'term': 'Loan Term',
      'taxYr': 'Annual Tax',
      'insYr': 'Annual Insurance',
      'hoaMo': 'Monthly HOA',
      'pmiMo': 'Monthly PMI'
    };

    let count = 0;
    Object.keys(fields).forEach((key) => {
      const label = labelMap[key];
      if (!label) return;

      const val = fields[key];
      const labels = doc.querySelectorAll('label');
      for (let i = 0; i < labels.length; i++) {
        const lbl = labels[i];
        if (lbl.textContent.trim().indexOf(label) !== -1) {
          let input = lbl.querySelector('input') ||
                      lbl.parentElement.querySelector('input') ||
                      (lbl.nextElementSibling && lbl.nextElementSibling.querySelector ? lbl.nextElementSibling.querySelector('input') : null);
          if (!input) {
            const container = lbl.closest('div');
            if (container) input = container.querySelector('input');
          }
          if (input) {
            const win = iframe.contentWindow;
            const nativeSetter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value');
            if (nativeSetter && nativeSetter.set) {
              nativeSetter.set.call(input, String(val));
            } else {
              input.value = String(val);
            }
            input.dispatchEvent(new win.Event('input', { bubbles: true }));
            input.dispatchEvent(new win.Event('change', { bubbles: true }));
            count++;
          }
          break;
        }
      }
    });
    return count;
  }

  MSFG.WorkspaceMISMO = {
    init: (opts) => {
      if (opts && typeof opts.onDataLoaded === 'function') {
        onDataLoadedCallback = opts.onDataLoaded;
      }
      initMISMODropZone();
    },
    restore: restoreMISMOData,
    getData: () => mismoData,
    populateAll: populateAllPanels,
    schedulePopulate: schedulePopulate,
    populatePanel: populatePanel,
    clear: clearMISMOData
  };

})();
