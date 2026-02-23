/* =====================================================
   Calculator Workspace
   Multi-calculator panels with cross-calc tallying
   ===================================================== */
(function() {
  'use strict';

  var activePanels = [];
  var DEFAULT_ZOOM = 85;
  var mismoData = null;

  // Map income calculator slugs to their total monthly income element IDs
  var INCOME_ELEMENT_MAP = {
    'income/1040': 'combined1040',
    'income/1065': 'combined1065',
    'income/1120': 'monthly_income',
    'income/1120s': 'combined_s',
    'income/1120s-k1': 'combinedK1',
    'income/k1': 'combinedK1',
    'income/schedule-b': 'incomeToUse',
    'income/schedule-c': 'combined_c',
    'income/schedule-d': 'd_monthly',
    'income/schedule-e': 'totalMonthly',
    'income/schedule-e-subject': 'sr_avg',
    'income/schedule-f': 'f_monthly',
    'income/rental-1038': 'methodA_result'
  };

  var panelsContainer, emptyState, tallyBar, countBadge, selectorDrawer;

  document.addEventListener('DOMContentLoaded', function() {
    panelsContainer = document.getElementById('wsPanels');
    emptyState = document.getElementById('wsEmpty');
    tallyBar = document.getElementById('wsTally');
    countBadge = document.getElementById('wsCount');
    selectorDrawer = document.getElementById('wsSelector');

    initMISMODropZone();

    // Toggle selector
    document.getElementById('wsToggleSelector').addEventListener('click', function() {
      selectorDrawer.style.display = selectorDrawer.style.display === 'none' ? 'block' : 'none';
    });

    // Selector search
    document.getElementById('wsSelectorSearch').addEventListener('input', function() {
      var q = this.value.toLowerCase().trim();
      document.querySelectorAll('.workspace__selector-btn').forEach(function(btn) {
        var name = btn.getAttribute('data-name') || '';
        btn.classList.toggle('hidden', q && name.indexOf(q) === -1);
      });
    });

    // Selector buttons
    document.querySelectorAll('.workspace__selector-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var slug = this.getAttribute('data-slug');
        if (this.classList.contains('active')) {
          removePanel(slug);
          this.classList.remove('active');
        } else {
          addPanel(slug, this.querySelector('.workspace__selector-name').textContent,
                   this.querySelector('.workspace__selector-icon').textContent);
          this.classList.add('active');
        }
      });
    });

    // Collapse all
    document.getElementById('wsCollapseAll').addEventListener('click', function() {
      document.querySelectorAll('.ws-panel__body').forEach(function(b) { b.classList.add('collapsed'); });
    });

    // Clear all
    document.getElementById('wsClearAll').addEventListener('click', function() {
      activePanels = [];
      panelsContainer.querySelectorAll('.ws-panel').forEach(function(p) { p.remove(); });
      document.querySelectorAll('.workspace__selector-btn.active').forEach(function(b) { b.classList.remove('active'); });
      sessionStorage.removeItem('msfg-workspace-panels');
      sessionStorage.removeItem('msfg-workspace-inputs');
      updateState();
    });

    // Save calculator inputs before navigating away
    window.addEventListener('beforeunload', function() {
      saveAllInputs();
    });

    // Listen for tally updates from iframes (same-origin only)
    window.addEventListener('message', function(e) {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === 'msfg-tally-update') {
        updateTallyFromMessage(e.data);
      }
    });

    // Restore saved panels from sessionStorage (persists across navigation)
    restorePanels();

    // Auto-add calculators from URL query params (e.g., ?add=income/1040,income/schedule-c)
    var urlParams = new URLSearchParams(window.location.search);
    var addParam = urlParams.get('add');
    if (addParam) {
      var slugsToAdd = addParam.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      slugsToAdd.forEach(function(slug) {
        var btn = document.querySelector('.workspace__selector-btn[data-slug="' + slug + '"]');
        if (btn && !btn.classList.contains('active')) {
          var nameEl = btn.querySelector('.workspace__selector-name');
          var iconEl = btn.querySelector('.workspace__selector-icon');
          var name = nameEl ? nameEl.textContent : slug;
          var icon = iconEl ? iconEl.textContent : '📝';
          addPanel(slug, name, icon);
          btn.classList.add('active');
        }
      });
      if (window.history.replaceState) {
        window.history.replaceState({}, '', '/workspace');
      }
    }

    // Restore MISMO data from sessionStorage
    restoreMISMOData();
  });

  /* ---- Apply zoom to all iframe layers within a panel ---- */
  function applyZoomToIframe(iframe, zoomValue) {
    var zoomDecimal = zoomValue / 100;
    try {
      var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (!iframeDoc || !iframeDoc.body) return;
      iframeDoc.body.classList.add('embed-mode');

      // Set or update the embed-mode zoom style
      var existing = iframeDoc.getElementById('ws-embed-zoom');
      if (existing) {
        existing.textContent = 'body.embed-mode { zoom: ' + zoomDecimal + '; }';
      } else {
        var style = iframeDoc.createElement('style');
        style.id = 'ws-embed-zoom';
        style.textContent = 'body.embed-mode { zoom: ' + zoomDecimal + '; }';
        iframeDoc.head.appendChild(style);
      }

      // Handle nested iframes (legacy calculator stubs)
      var nestedIframes = iframeDoc.querySelectorAll('iframe');
      nestedIframes.forEach(function(nested) {
        applyZoomToNestedIframe(nested, zoomDecimal);
        // Re-apply on future loads
        nested.removeEventListener('load', nested._wsZoomHandler);
        nested._wsZoomHandler = function() { applyZoomToNestedIframe(nested, zoomDecimal); };
        nested.addEventListener('load', nested._wsZoomHandler);
      });
    } catch (e) { /* cross-origin, skip */ }
  }

  function applyZoomToNestedIframe(nested, zoomDecimal) {
    try {
      var nestedDoc = nested.contentDocument || nested.contentWindow.document;
      if (nestedDoc && nestedDoc.body) {
        nestedDoc.body.classList.add('embed-mode');
        var existing = nestedDoc.getElementById('ws-embed-zoom');
        if (existing) {
          existing.textContent = 'body.embed-mode { zoom: ' + zoomDecimal + '; }';
        } else {
          var style = nestedDoc.createElement('style');
          style.id = 'ws-embed-zoom';
          style.textContent = 'body.embed-mode { zoom: ' + zoomDecimal + '; }';
          nestedDoc.head.appendChild(style);
        }
      }
    } catch (e) { /* cross-origin nested, skip */ }
  }

  function addPanel(slug, name, icon) {
    if (activePanels.find(function(p) { return p.slug === slug; })) return;

    var panel = {
      slug: slug,
      name: name,
      icon: icon,
      zoom: DEFAULT_ZOOM,
      tally: { monthlyPayment: 0, loanAmount: 0, cashToClose: 0, monthlyIncome: 0 }
    };
    activePanels.push(panel);

    var el = document.createElement('div');
    el.className = 'ws-panel';
    el.id = 'ws-panel-' + slug;

    el.innerHTML =
      '<div class="ws-panel__header" data-slug="' + slug + '">' +
        '<span class="ws-panel__icon">' + icon + '</span>' +
        '<h3 class="ws-panel__title">' + name + '</h3>' +
        '<div class="ws-panel__zoom">' +
          '<svg class="ws-panel__zoom-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
            '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
          '</svg>' +
          '<input type="range" class="ws-panel__zoom-slider" min="50" max="100" value="' + DEFAULT_ZOOM + '" step="5" />' +
          '<span class="ws-panel__zoom-label">' + DEFAULT_ZOOM + '%</span>' +
        '</div>' +
        '<div class="ws-panel__actions">' +
          '<button class="ws-panel__btn ws-panel__btn--report" title="Add to Report">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>' +
          '</button>' +
          '<a href="/calculators/' + slug + '" target="_blank" class="ws-panel__standalone" title="Open standalone">↗</a>' +
          '<button class="ws-panel__btn ws-panel__btn--collapse" title="Collapse">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</button>' +
          '<button class="ws-panel__btn ws-panel__btn--remove" title="Remove" data-slug="' + slug + '">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="ws-panel__body" id="ws-body-' + slug + '">' +
        '<iframe class="ws-panel__iframe" src="/calculators/' + slug + '?embed=1" loading="lazy"></iframe>' +
      '</div>';

    // Prevent zoom slider clicks from toggling panel collapse
    var zoomContainer = el.querySelector('.ws-panel__zoom');
    zoomContainer.addEventListener('click', function(e) { e.stopPropagation(); });

    // Zoom slider handler
    var slider = el.querySelector('.ws-panel__zoom-slider');
    var label = el.querySelector('.ws-panel__zoom-label');
    var iframe = el.querySelector('.ws-panel__iframe');

    slider.addEventListener('input', function() {
      var val = parseInt(this.value, 10);
      label.textContent = val + '%';
      panel.zoom = val;
      applyZoomToIframe(iframe, val);
    });

    // Apply embed mode + default zoom when iframe loads, then populate MISMO data + restore inputs
    iframe.addEventListener('load', function() {
      applyZoomToIframe(iframe, panel.zoom);
      // Wait for iframe + nested iframes to load, then populate MISMO
      schedulePopulate(iframe, slug);
      // Restore saved user inputs AFTER MISMO population
      scheduleRestore(iframe, slug);
    });

    // Collapse toggle
    el.querySelector('.ws-panel__btn--collapse').addEventListener('click', function(e) {
      e.stopPropagation();
      var body = el.querySelector('.ws-panel__body');
      body.classList.toggle('collapsed');
    });

    // Header click also toggles collapse
    el.querySelector('.ws-panel__header').addEventListener('click', function() {
      var body = el.querySelector('.ws-panel__body');
      body.classList.toggle('collapsed');
    });

    // Report capture (structured data extraction)
    var reportBtn = el.querySelector('.ws-panel__btn--report');
    reportBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      reportBtn.disabled = true;
      reportBtn.style.opacity = '0.5';

      var baseDoc = null;
      try {
        baseDoc = iframe.contentDocument || iframe.contentWindow.document;
      } catch (err) { /* cross-origin */ }

      if (!baseDoc) {
        showWsToast('Could not access calculator', 'error');
        reportBtn.disabled = false;
        reportBtn.style.opacity = '';
        return;
      }

      MSFG.Report.captureStructured(slug, name, icon, baseDoc).then(function() {
        reportBtn.disabled = false;
        reportBtn.style.opacity = '';
        reportBtn.style.color = 'var(--brand-primary)';
        setTimeout(function() { reportBtn.style.color = ''; }, 1500);
      }).catch(function(err) {
        console.error('Workspace report capture failed:', err);
        reportBtn.disabled = false;
        reportBtn.style.opacity = '';
        showWsToast('Capture failed', 'error');
      });
    });

    // Remove
    el.querySelector('.ws-panel__btn--remove').addEventListener('click', function(e) {
      e.stopPropagation();
      removePanel(slug);
      var selectorBtn = document.querySelector('.workspace__selector-btn[data-slug="' + slug + '"]');
      if (selectorBtn) selectorBtn.classList.remove('active');
    });

    panelsContainer.appendChild(el);
    updateState();
  }

  function removePanel(slug) {
    activePanels = activePanels.filter(function(p) { return p.slug !== slug; });
    var el = document.getElementById('ws-panel-' + slug);
    if (el) el.remove();
    updateState();
  }

  function updateState() {
    var count = activePanels.length;
    countBadge.textContent = count + ' active';
    emptyState.style.display = count === 0 ? 'block' : 'none';
    tallyBar.style.display = count > 0 ? 'block' : 'none';
    savePanels();
    updateTally();
  }

  /* ---- Persist/restore active panels across navigation ---- */
  function savePanels() {
    var data = activePanels.map(function(p) {
      return { slug: p.slug, name: p.name, icon: p.icon, zoom: p.zoom };
    });
    sessionStorage.setItem('msfg-workspace-panels', JSON.stringify(data));
  }

  function restorePanels() {
    var stored = sessionStorage.getItem('msfg-workspace-panels');
    if (!stored) return;
    try {
      var data = JSON.parse(stored);
      if (!Array.isArray(data) || data.length === 0) return;
      data.forEach(function(p) {
        if (!p.slug) return;
        addPanel(p.slug, p.name, p.icon);
        // Restore zoom if different from default
        if (p.zoom && p.zoom !== DEFAULT_ZOOM) {
          var panelEl = document.getElementById('ws-panel-' + p.slug);
          if (panelEl) {
            var slider = panelEl.querySelector('.ws-panel__zoom-slider');
            var label = panelEl.querySelector('.ws-panel__zoom-label');
            if (slider) {
              slider.value = p.zoom;
              label.textContent = p.zoom + '%';
              var panel = activePanels.find(function(ap) { return ap.slug === p.slug; });
              if (panel) panel.zoom = p.zoom;
            }
          }
        }
        // Mark selector button as active
        var btn = document.querySelector('.workspace__selector-btn[data-slug="' + p.slug + '"]');
        if (btn) btn.classList.add('active');
      });
    } catch (e) { /* corrupted data, skip */ }
  }

  /* ---- Persist/restore calculator input values across navigation ---- */
  function saveAllInputs() {
    var data = {};
    activePanels.forEach(function(panel) {
      var inputs = extractPanelInputs(panel.slug);
      if (inputs) data[panel.slug] = inputs;
    });
    try {
      sessionStorage.setItem('msfg-workspace-inputs', JSON.stringify(data));
    } catch (e) { /* quota exceeded or private mode */ }
  }

  function extractPanelInputs(slug) {
    var panelEl = document.getElementById('ws-panel-' + slug);
    if (!panelEl) return null;
    var iframe = panelEl.querySelector('.ws-panel__iframe');
    if (!iframe) return null;

    try {
      var outerDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (!outerDoc) return null;
      var nestedIframe = outerDoc.querySelector('iframe');

      if (nestedIframe) {
        // Legacy calc with nested iframe (refi, fha-refi, income, etc.)
        var innerWin = nestedIframe.contentWindow;
        var innerDoc = nestedIframe.contentDocument || innerWin.document;

        // Check for known API (refi-calc has RefiUI.readAllInputs)
        if (innerWin && innerWin.RefiUI && typeof innerWin.RefiUI.readAllInputs === 'function') {
          return { _api: 'RefiUI', data: innerWin.RefiUI.readAllInputs() };
        }

        // Generic DOM scrape for nested legacy calcs
        if (innerDoc && innerDoc.body) {
          return { _api: 'dom', data: scrapeInputs(innerDoc) };
        }
        return null;
      }

      // Direct EJS calculator (single iframe)
      return { _api: 'dom', data: scrapeInputs(outerDoc) };
    } catch (e) {
      return null; // cross-origin or not loaded
    }
  }

  function scrapeInputs(doc) {
    var data = {};
    var elements = doc.querySelectorAll('input[id], select[id], textarea[id]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      // Skip hidden fields that are computed, and skip file inputs
      if (el.type === 'hidden' || el.type === 'file') continue;
      if (el.type === 'checkbox' || el.type === 'radio') {
        data[el.id] = { t: el.type, c: el.checked, v: el.value };
      } else {
        data[el.id] = { t: el.tagName.toLowerCase(), v: el.value };
      }
    }
    return data;
  }

  function scheduleRestore(iframe, slug) {
    var stored = sessionStorage.getItem('msfg-workspace-inputs');
    if (!stored) return;
    try {
      var allData = JSON.parse(stored);
      if (!allData[slug]) return;
    } catch (e) { return; }

    // Run after MISMO population completes (MISMO starts at 400ms with retries)
    function tryRestore(attempt) {
      if (attempt > 15) return;
      try {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        var nested = doc ? doc.querySelector('iframe') : null;
        if (nested) {
          var nestedDoc = null;
          try { nestedDoc = nested.contentDocument || nested.contentWindow.document; } catch (e) {}
          if (!nestedDoc || !nestedDoc.body || !nestedDoc.body.innerHTML) {
            // Nested iframe not ready yet, wait for it
            nested.addEventListener('load', function() {
              setTimeout(function() { restorePanelInputs(slug); }, 600);
            });
            return;
          }
        }
      } catch (e) { /* skip */ }
      restorePanelInputs(slug);
    }

    // Delay to run after MISMO population (400ms start + retries)
    setTimeout(function() { tryRestore(0); }, 1200);
  }

  function restorePanelInputs(slug) {
    var stored = sessionStorage.getItem('msfg-workspace-inputs');
    if (!stored) return;
    try {
      var allData = JSON.parse(stored);
      var panelData = allData[slug];
      if (!panelData) return;
      applyPanelInputs(slug, panelData);
    } catch (e) { /* corrupted */ }
  }

  function applyPanelInputs(slug, panelData) {
    var panelEl = document.getElementById('ws-panel-' + slug);
    if (!panelEl) return;
    var iframe = panelEl.querySelector('.ws-panel__iframe');
    if (!iframe) return;

    try {
      var outerDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (!outerDoc) return;
      var nestedIframe = outerDoc.querySelector('iframe');

      if (panelData._api === 'RefiUI' && nestedIframe) {
        var innerWin = nestedIframe.contentWindow;
        if (innerWin && innerWin.RefiUI && typeof innerWin.RefiUI.writeAllInputs === 'function') {
          innerWin.RefiUI.writeAllInputs(panelData.data);
          return;
        }
      }

      // Generic DOM restore
      var targetDoc = outerDoc;
      if (nestedIframe) {
        try {
          var nd = nestedIframe.contentDocument || nestedIframe.contentWindow.document;
          if (nd && nd.body) targetDoc = nd;
        } catch (e) { /* cross-origin */ }
      }

      var fields = panelData.data;
      if (!fields) return;
      var keys = Object.keys(fields);
      for (var i = 0; i < keys.length; i++) {
        var id = keys[i];
        var el = targetDoc.getElementById(id);
        if (!el) continue;
        var info = fields[id];
        if (info.t === 'checkbox' || info.t === 'radio') {
          el.checked = info.c;
          triggerEvent(el, 'change');
        } else if (el.tagName === 'SELECT') {
          setSelectValue(el, info.v);
        } else {
          setInputValue(el, info.v);
        }
      }
    } catch (e) { /* cross-origin or not loaded */ }
  }

  function updateTallyFromMessage(data) {
    var panel = activePanels.find(function(p) { return p.slug === data.slug; });
    if (!panel) return;
    if (typeof data.monthlyPayment === 'number' && isFinite(data.monthlyPayment)) panel.tally.monthlyPayment = data.monthlyPayment;
    if (typeof data.loanAmount === 'number' && isFinite(data.loanAmount)) panel.tally.loanAmount = data.loanAmount;
    if (typeof data.cashToClose === 'number' && isFinite(data.cashToClose)) panel.tally.cashToClose = data.cashToClose;
    if (typeof data.monthlyIncome === 'number' && isFinite(data.monthlyIncome)) panel.tally.monthlyIncome = data.monthlyIncome;
    updateTally();
  }

  function showWsToast(msg, type) {
    var t = document.createElement('div');
    t.style.cssText =
      'position:fixed;bottom:24px;right:24px;display:flex;align-items:center;gap:8px;' +
      'padding:12px 20px;background:' + (type === 'error' ? '#dc3545' : '#2d6a4f') + ';color:#fff;' +
      'font-size:.88rem;font-weight:500;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);' +
      'z-index:10000;transform:translateY(20px);opacity:0;transition:all .3s ease;pointer-events:none;';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function() { t.style.transform = 'translateY(0)'; t.style.opacity = '1'; });
    setTimeout(function() {
      t.style.transform = 'translateY(20px)'; t.style.opacity = '0';
      setTimeout(function() { t.remove(); }, 300);
    }, 2500);
  }

  function pollIncomePanels() {
    var changed = false;
    activePanels.forEach(function(panel) {
      var elementId = INCOME_ELEMENT_MAP[panel.slug];
      if (!elementId) return;

      var panelEl = document.getElementById('ws-panel-' + panel.slug);
      if (!panelEl) return;

      var iframe = panelEl.querySelector('.ws-panel__iframe');
      if (!iframe) return;

      try {
        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        var targetDoc = iframeDoc;

        // Income calculators are nested: EJS wrapper iframe → legacy HTML iframe
        var nestedIframe = iframeDoc.querySelector('iframe');
        if (nestedIframe) {
          try {
            targetDoc = nestedIframe.contentDocument || nestedIframe.contentWindow.document;
          } catch (e) { return; }
        }

        var el = targetDoc.getElementById(elementId);
        if (el) {
          var text = el.textContent || '';
          var val = parseFloat(text.replace(/[^0-9.-]/g, ''));
          if (isNaN(val)) val = 0;
          if (val !== panel.tally.monthlyIncome) {
            panel.tally.monthlyIncome = val;
            changed = true;
          }
        }
      } catch (e) { /* cross-origin, skip */ }
    });
    if (changed) updateTally();
  }

  function updateTally() {
    var totals = { monthlyPayment: 0, loanAmount: 0, cashToClose: 0, monthlyIncome: 0 };
    activePanels.forEach(function(p) {
      totals.monthlyPayment += p.tally.monthlyPayment || 0;
      totals.loanAmount += p.tally.loanAmount || 0;
      totals.cashToClose += p.tally.cashToClose || 0;
      totals.monthlyIncome += p.tally.monthlyIncome || 0;
    });
    document.getElementById('tallyMonthlyPayment').textContent = MSFG.formatCurrency(totals.monthlyPayment, 0);
    document.getElementById('tallyLoanAmount').textContent = MSFG.formatCurrency(totals.loanAmount, 0);
    document.getElementById('tallyCashToClose').textContent = MSFG.formatCurrency(totals.cashToClose, 0);
    document.getElementById('tallyMonthlyIncome').textContent = MSFG.formatCurrency(totals.monthlyIncome, 0);
  }

  setInterval(pollIncomePanels, 1500);

  /* ===================================================
     MISMO XML Import
     =================================================== */

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
      showWsToast('Please drop a MISMO XML file (.xml)', 'error');
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
        populateAllPanels();
        showWsToast('MISMO data loaded — ' + parsed.borrowerName, 'success');
      } catch (err) {
        console.error('MISMO parse error:', err);
        showWsToast('Failed to parse MISMO file: ' + err.message, 'error');
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
    if (data.loan.amount) parts.push('Loan: $' + formatNum(data.loan.amount));
    if (data.loan.rate) parts.push('Rate: ' + data.loan.rate + '%');
    if (data.loan.termMonths) parts.push('Term: ' + (data.loan.termMonths / 12) + 'yr');
    if (data.property.value) parts.push('Value: $' + formatNum(data.property.value));
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

    showWsToast('MISMO data cleared', 'success');
  }

  function formatNum(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  /* ---- Schedule population after iframe + nested iframes load ---- */
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
      // Try to populate; retry with backoff if 0 fields were set
      var count = populatePanel(slug);
      if (count === 0 && attempt < 10) {
        setTimeout(function() { tryPopulate(attempt + 1); }, 300);
      }
    }

    setTimeout(function() { tryPopulate(0); }, 400);
  }

  /* ---- Populate all active panels with MISMO data ---- */
  function populateAllPanels() {
    if (!mismoData) return;
    activePanels.forEach(function(panel) {
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
            highlightPanel(slug, 1);
            return 1;
          }
        } catch (e) { /* cross-origin or not ready */ }
      }
      return 0;
    }

    var reactKeys = {};
    var domKeys = {};
    var amortKeys = {};

    Object.keys(fieldMap).forEach(function(key) {
      if (key.indexOf('__react_') === 0) {
        reactKeys[key.replace('__react_', '')] = fieldMap[key];
      } else if (key.indexOf('__amort_') === 0) {
        amortKeys[key.replace('__amort_', '')] = fieldMap[key];
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
        setSelectValue(el, val);
      } else if (el.type === 'checkbox') {
        el.checked = !!val;
        triggerEvent(el, 'change');
      } else {
        setInputValue(el, val);
      }
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
            triggerEvent(termBtn, 'click');
            populated++;
          }
        }
      });
    }

    if (populated > 0) {
      highlightPanel(slug, populated);
    }
    return populated;
  }

  function setInputValue(el, val) {
    var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (nativeSetter && nativeSetter.set) {
      nativeSetter.set.call(el, String(val));
    } else {
      el.value = String(val);
    }
    triggerEvent(el, 'input');
    triggerEvent(el, 'change');
  }

  function setSelectValue(el, val) {
    var strVal = String(val);
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].value === strVal || el.options[i].text === strVal) {
        el.selectedIndex = i;
        triggerEvent(el, 'change');
        return;
      }
    }
    // Try matching numeric value (for term selects like 360)
    var numVal = parseFloat(val);
    for (var j = 0; j < el.options.length; j++) {
      if (parseFloat(el.options[j].value) === numVal) {
        el.selectedIndex = j;
        triggerEvent(el, 'change');
        return;
      }
    }
  }

  function triggerEvent(el, eventName) {
    var evt = new Event(eventName, { bubbles: true, cancelable: true });
    el.dispatchEvent(evt);
  }

  /* ---- React app population (amortization calculator) ---- */
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

  /* ---- Visual feedback on populated panels ---- */
  function highlightPanel(slug, count) {
    var panelEl = document.getElementById('ws-panel-' + slug);
    if (!panelEl) return;

    var header = panelEl.querySelector('.ws-panel__header');
    if (!header) return;

    var existing = header.querySelector('.mismo-populated-badge');
    if (existing) existing.remove();

    var badge = document.createElement('span');
    badge.className = 'mismo-populated-badge';
    badge.innerHTML =
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
      '<polyline points="20 6 9 17 4 12"/></svg> ' +
      count + ' fields populated';
    header.insertBefore(badge, header.querySelector('.ws-panel__zoom'));
  }

  setInterval(pollIncomePanels, 1500);
})();
