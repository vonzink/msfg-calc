(function() {
  'use strict';

  var mismoData = null;
  var onDataLoadedCallback = null;

  function initMISMODropZone() {
    var dropZone = document.getElementById('mismoDropZone');
    var fileInput = document.getElementById('mismoFileInput');
    var clearBtn = document.getElementById('mismoClear');

    ['dragenter', 'dragover'].forEach(function(evt) {
      dropZone.addEventListener(evt, function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(function(evt) {
      dropZone.addEventListener(evt, function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', function(e) {
      var files = e.dataTransfer.files;
      if (files.length > 0) handleMISMOFile(files[0]);
    });

    fileInput.addEventListener('change', function() {
      if (this.files.length > 0) handleMISMOFile(this.files[0]);
      this.value = '';
    });

    clearBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      clearMISMOData();
    });
  }

  function handleMISMOFile(file) {
    if (!file.name.match(/\.(xml|mismo)$/i)) {
      MSFG.WS.showToast('Please drop a MISMO XML file (.xml)', 'error');
      return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var parsed = MSFG.MISMOParser.parse(e.target.result);
        mismoData = parsed;
        sessionStorage.setItem('msfg-mismo-data', JSON.stringify(parsed));
        sessionStorage.setItem('msfg-mismo-filename', file.name);
        sessionStorage.setItem('msfg-mismo-xml', e.target.result);
        updateMISMOUI(parsed, file.name);
        if (typeof onDataLoadedCallback === 'function') onDataLoadedCallback();
        MSFG.WS.showToast('MISMO data loaded — ' + parsed.borrowerName, 'success');
      } catch (err) {
        console.error('MISMO parse error:', err);
        MSFG.WS.showToast('Failed to parse MISMO file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function restoreMISMOData() {
    var stored = sessionStorage.getItem('msfg-mismo-data');
    var filename = sessionStorage.getItem('msfg-mismo-filename');
    if (stored) {
      try {
        mismoData = JSON.parse(stored);
        updateMISMOUI(mismoData, filename || 'MISMO File');
      } catch (e) { /* corrupted */ }
    }
  }

  function updateMISMOUI(data, filename) {
    var dropZone = document.getElementById('mismoDropZone');
    var inner = dropZone.querySelector('.mismo-drop__inner');
    var active = document.getElementById('mismoActive');
    var borrowerEl = document.getElementById('mismoBorrower');
    var metaEl = document.getElementById('mismoMeta');

    dropZone.classList.add('has-data');
    inner.style.display = 'none';
    active.style.display = 'flex';
    borrowerEl.textContent = data.borrowerName || 'Borrower';

    var parts = [];
    if (data.loan.amount) parts.push('Loan: $' + MSFG.WS.formatNum(data.loan.amount));
    if (data.loan.rate) parts.push('Rate: ' + data.loan.rate + '%');
    if (data.loan.termMonths) parts.push('Term: ' + (data.loan.termMonths / 12) + 'yr');
    if (data.property.value) parts.push('Value: $' + MSFG.WS.formatNum(data.property.value));
    if (data.loan.purpose) parts.push(data.loan.purpose);
    metaEl.textContent = parts.join('  •  ');
  }

  function clearMISMOData() {
    mismoData = null;
    sessionStorage.removeItem('msfg-mismo-data');
    sessionStorage.removeItem('msfg-mismo-filename');
    sessionStorage.removeItem('msfg-mismo-xml');

    var dropZone = document.getElementById('mismoDropZone');
    var inner = dropZone.querySelector('.mismo-drop__inner');
    var active = document.getElementById('mismoActive');

    dropZone.classList.remove('has-data');
    inner.style.display = 'flex';
    active.style.display = 'none';

    MSFG.WS.showToast('MISMO data cleared', 'success');
  }

  function schedulePopulate(iframe, slug) {
    if (!mismoData) return;

    function tryPopulate(attempt) {
      if (attempt > 10) return;
      try {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        var nested = doc ? doc.querySelector('iframe') : null;
        if (nested) {
          var nestedDoc = null;
          try { nestedDoc = nested.contentDocument || nested.contentWindow.document; } catch (e) {}
          if (!nestedDoc || !nestedDoc.body || !nestedDoc.body.innerHTML) {
            nested.addEventListener('load', function() {
              setTimeout(function() { populatePanel(slug); }, 200);
            });
            return;
          }
        }
      } catch (e) { /* skip */ }
      var count = populatePanel(slug);
      if (count === 0 && attempt < 10) {
        setTimeout(function() { tryPopulate(attempt + 1); }, 300);
      }
    }

    setTimeout(function() { tryPopulate(0); }, 400);
  }

  function populateAllPanels(panels) {
    if (!mismoData) return;
    panels.forEach(function(panel) {
      populatePanel(panel.slug);
    });
  }

  function populatePanel(slug) {
    if (!mismoData || !MSFG.MISMOParser) return 0;

    var mapFn = MSFG.MISMOParser.getCalcMap(slug);
    if (!mapFn) return 0;

    var fieldMap = mapFn(mismoData);
    if (!fieldMap || Object.keys(fieldMap).length === 0) return 0;

    var panelEl = document.getElementById('ws-panel-' + slug);
    if (!panelEl) return 0;

    var iframe = panelEl.querySelector('.ws-panel__iframe');
    if (!iframe) return 0;

    return populateIframeFields(iframe, slug, fieldMap);
  }

  function populateIframeFields(iframe, slug, fieldMap) {
    var outerDoc;
    try {
      outerDoc = iframe.contentDocument || iframe.contentWindow.document;
    } catch (e) { return 0; }
    if (!outerDoc) return 0;

    // Special handling: MISMO Document Analyzer — inject raw XML
    if (fieldMap.__mismo_xml_inject) {
      var storedXml = sessionStorage.getItem('msfg-mismo-xml');
      if (storedXml) {
        try {
          var iframeWin = iframe.contentWindow;
          if (iframeWin && typeof iframeWin.__mismoProcessXmlString === 'function') {
            iframeWin.__mismoProcessXmlString(storedXml);
            MSFG.WS.highlightPanel(slug, 1);
            return 1;
          }
        } catch (e) { /* cross-origin or not ready */ }
      }
      return 0;
    }

    var reactKeys = {};
    var domKeys = {};
    var amortKeys = {};
    var radioKeys = {};

    Object.keys(fieldMap).forEach(function(key) {
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
    var targetDoc = outerDoc;
    var nestedIframe = outerDoc.querySelector('iframe');
    if (nestedIframe) {
      try {
        var nd = nestedIframe.contentDocument || nestedIframe.contentWindow.document;
        if (nd && nd.body) targetDoc = nd;
      } catch (e) { /* cross-origin */ }
    }

    // Populate standard DOM inputs
    var populated = 0;
    Object.keys(domKeys).forEach(function(elId) {
      var el = targetDoc.getElementById(elId);
      if (!el) return;

      var val = domKeys[elId];
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
      var reactCount = populateReactApp(nestedIframe || iframe, reactKeys);
      populated += reactCount;
    }

    // Handle amortization native EJS special keys (term toggle buttons)
    if (Object.keys(amortKeys).length > 0) {
      Object.keys(amortKeys).forEach(function(key) {
        if (key === 'term') {
          var termYears = String(Math.round(amortKeys[key]));
          var termBtn = targetDoc.querySelector('.amort-term-btn[data-years="' + termYears + '"]');
          if (termBtn) {
            targetDoc.querySelectorAll('.amort-term-btn[data-years]').forEach(function(b) { b.classList.remove('active'); });
            termBtn.classList.add('active');
            MSFG.WS.triggerEvent(termBtn, 'click');
            populated++;
          }
        }
      });
    }

    // Handle radio button inputs
    if (Object.keys(radioKeys).length > 0) {
      Object.keys(radioKeys).forEach(function(name) {
        var val = radioKeys[name];
        var radio = targetDoc.querySelector('input[type="radio"][name="' + name + '"][value="' + val + '"]');
        if (radio) {
          radio.checked = true;
          MSFG.WS.triggerEvent(radio, 'change');
          populated++;
        }
      });
    }

    // Handle custom line items (fee-worksheet MISMO unmapped fees)
    if (fieldMap.__custom_items && Array.isArray(fieldMap.__custom_items)) {
      var targetWin = null;
      try {
        if (nestedIframe) {
          targetWin = nestedIframe.contentWindow;
        } else {
          targetWin = iframe.contentWindow;
        }
      } catch (e) { /* cross-origin */ }

      if (targetWin && typeof targetWin.MSFG_FW_addCustomItem === 'function') {
        fieldMap.__custom_items.forEach(function (item) {
          targetWin.MSFG_FW_addCustomItem(item.section, item.name, item.amount);
          populated++;
        });
      }
    }

    // Handle budget calculator structured data
    if (fieldMap.__budget_data) {
      var budgetWin = null;
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
      }
    }

    if (populated > 0) {
      MSFG.WS.highlightPanel(slug, populated);
    }
    return populated;
  }

  function populateReactApp(iframe, fields) {
    var doc;
    try {
      doc = iframe.contentDocument || iframe.contentWindow.document;
    } catch (e) { return 0; }
    if (!doc) return 0;

    var labelMap = {
      'homeValue': 'Home Value',
      'downPct': 'Down Payment',
      'rate': 'Interest Rate',
      'term': 'Loan Term',
      'taxYr': 'Annual Tax',
      'insYr': 'Annual Insurance',
      'hoaMo': 'Monthly HOA',
      'pmiMo': 'Monthly PMI'
    };

    var count = 0;
    Object.keys(fields).forEach(function(key) {
      var label = labelMap[key];
      if (!label) return;

      var val = fields[key];
      var labels = doc.querySelectorAll('label');
      for (var i = 0; i < labels.length; i++) {
        var lbl = labels[i];
        if (lbl.textContent.trim().indexOf(label) !== -1) {
          var input = lbl.querySelector('input') ||
                      lbl.parentElement.querySelector('input') ||
                      (lbl.nextElementSibling && lbl.nextElementSibling.querySelector ? lbl.nextElementSibling.querySelector('input') : null);
          if (!input) {
            var container = lbl.closest('div');
            if (container) input = container.querySelector('input');
          }
          if (input) {
            var win = iframe.contentWindow;
            var nativeSetter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value');
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
    init: function(opts) {
      if (opts && typeof opts.onDataLoaded === 'function') {
        onDataLoadedCallback = opts.onDataLoaded;
      }
      initMISMODropZone();
    },
    restore: restoreMISMOData,
    getData: function() { return mismoData; },
    populateAll: populateAllPanels,
    schedulePopulate: schedulePopulate,
    populatePanel: populatePanel,
    clear: clearMISMOData
  };

})();
