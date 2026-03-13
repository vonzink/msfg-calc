/* =====================================================
   Calculator Workspace — Core Orchestrator
   Dependencies: MSFG.WS (workspace-helpers.js),
                 MSFG.WorkspaceMISMO (workspace-mismo.js),
                 MSFG.MISMOParser (mismo-parser.js)
   ===================================================== */
(function() {
  'use strict';

  var activePanels = [];
  var DEFAULT_ZOOM = 85;

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

    MSFG.WorkspaceMISMO.init({
      onDataLoaded: function() {
        MSFG.WorkspaceMISMO.populateAll(activePanels);
      }
    });

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
    MSFG.WorkspaceMISMO.restore();
  });

  /* ---- Panel management ---- */

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
      MSFG.WS.applyZoomToIframe(iframe, val);
    });

    // Apply embed mode + default zoom when iframe loads, then populate MISMO data + restore inputs
    iframe.addEventListener('load', function() {
      MSFG.WS.applyZoomToIframe(iframe, panel.zoom);
      MSFG.WorkspaceMISMO.schedulePopulate(iframe, slug);
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
        MSFG.WS.showToast('Could not access calculator', 'error');
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
        MSFG.WS.showToast('Capture failed', 'error');
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
        var innerWin = nestedIframe.contentWindow;
        var innerDoc = nestedIframe.contentDocument || innerWin.document;

        if (innerWin && innerWin.RefiUI && typeof innerWin.RefiUI.readAllInputs === 'function') {
          return { _api: 'RefiUI', data: innerWin.RefiUI.readAllInputs() };
        }

        if (innerDoc && innerDoc.body) {
          return { _api: 'dom', data: MSFG.WS.scrapeInputs(innerDoc) };
        }
        return null;
      }

      return { _api: 'dom', data: MSFG.WS.scrapeInputs(outerDoc) };
    } catch (e) {
      return null;
    }
  }

  function scheduleRestore(iframe, slug) {
    var stored = sessionStorage.getItem('msfg-workspace-inputs');
    if (!stored) return;
    try {
      var allData = JSON.parse(stored);
      if (!allData[slug]) return;
    } catch (e) { return; }

    function tryRestore(attempt) {
      if (attempt > 15) return;
      try {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        var nested = doc ? doc.querySelector('iframe') : null;
        if (nested) {
          var nestedDoc = null;
          try { nestedDoc = nested.contentDocument || nested.contentWindow.document; } catch (e) {}
          if (!nestedDoc || !nestedDoc.body || !nestedDoc.body.innerHTML) {
            nested.addEventListener('load', function() {
              setTimeout(function() { restorePanelInputs(slug); }, 600);
            });
            return;
          }
        }
      } catch (e) { /* skip */ }
      restorePanelInputs(slug);
    }

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
          MSFG.WS.triggerEvent(el, 'change');
        } else if (el.tagName === 'SELECT') {
          MSFG.WS.setSelectValue(el, info.v);
        } else {
          MSFG.WS.setInputValue(el, info.v);
        }
      }
    } catch (e) { /* cross-origin or not loaded */ }
  }

  /* ---- Tally ---- */

  function updateTallyFromMessage(data) {
    var panel = activePanels.find(function(p) { return p.slug === data.slug; });
    if (!panel) return;
    if (typeof data.monthlyPayment === 'number' && isFinite(data.monthlyPayment)) panel.tally.monthlyPayment = data.monthlyPayment;
    if (typeof data.loanAmount === 'number' && isFinite(data.loanAmount)) panel.tally.loanAmount = data.loanAmount;
    if (typeof data.cashToClose === 'number' && isFinite(data.cashToClose)) panel.tally.cashToClose = data.cashToClose;
    if (typeof data.monthlyIncome === 'number' && isFinite(data.monthlyIncome)) panel.tally.monthlyIncome = data.monthlyIncome;
    updateTally();
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

})();
