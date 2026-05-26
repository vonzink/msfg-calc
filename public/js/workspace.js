/* =====================================================
   Calculator Workspace — Core Orchestrator
   Dependencies: MSFG.WS (workspace-helpers.js),
                 MSFG.WorkspaceMISMO (workspace-mismo.js),
                 MSFG.MISMOParser (mismo-parser.js)
   ===================================================== */
(function() {
  'use strict';

  let activePanels = [];
  const DEFAULT_ZOOM = 85;

  function genInstanceId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return 'wsi-' + window.crypto.randomUUID();
    }
    return 'wsi-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function updateSelectorCounts() {
    const counts = {};
    activePanels.forEach((p) => { counts[p.slug] = (counts[p.slug] || 0) + 1; });
    document.querySelectorAll('.workspace__selector-btn').forEach((btn) => {
      const slug = btn.getAttribute('data-slug');
      const n = counts[slug] || 0;
      let badge = btn.querySelector('.workspace__selector-count');
      if (n > 1) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'workspace__selector-count';
          btn.appendChild(badge);
        }
        badge.textContent = '×' + n;
      } else if (badge) {
        badge.remove();
      }
      btn.classList.toggle('active', n >= 1);
    });
  }

  // Map income calculator slugs to their total monthly income element IDs
  const INCOME_ELEMENT_MAP = {
    'income/1040': 'combined1040',
    'income/1065': 'combined1065',
    'income/1120': 'monthly_income',
    'income/1120s': 'combined1120s',
    'income/1120s-k1': 'combinedK1',
    'income/k1': 'combinedK1',
    'income/schedule-b': 'incomeToUse',
    'income/schedule-c': 'combined_c',
    'income/schedule-d': 'd_monthly',
    'income/schedule-e': 'prop1_result',
    'income/schedule-e-subject': 'sr_avg',
    'income/schedule-f': 'f_monthly',
    'income/rental-1038': 'methodA_result'
  };

  let panelsContainer, emptyState, tallyBar, countBadge, selectorDrawer;

  document.addEventListener('DOMContentLoaded', () => {
    panelsContainer = document.getElementById('wsPanels');
    emptyState = document.getElementById('wsEmpty');
    tallyBar = document.getElementById('wsTally');
    countBadge = document.getElementById('wsCount');
    selectorDrawer = document.getElementById('wsSelector');

    MSFG.WorkspaceMISMO.init({
      onDataLoaded: () => {
        MSFG.WorkspaceMISMO.populateAll(activePanels);
      }
    });

    // Toggle selector
    document.getElementById('wsToggleSelector').addEventListener('click', () => {
      selectorDrawer.classList.toggle('u-hidden');
    });

    // Selector search
    document.getElementById('wsSelectorSearch').addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll('.workspace__selector-btn').forEach((btn) => {
        const name = btn.getAttribute('data-name') || '';
        btn.classList.toggle('hidden', q && name.indexOf(q) === -1);
      });
    });

    // Selector buttons — each click adds a new instance
    document.querySelectorAll('.workspace__selector-btn').forEach((btn) => {
      btn.addEventListener('click', function() {
        const slug = this.getAttribute('data-slug');
        const nameEl = this.querySelector('.workspace__selector-name');
        const iconEl = this.querySelector('.workspace__selector-icon');
        const name = nameEl ? nameEl.textContent : slug;
        const icon = iconEl ? iconEl.textContent : '\u{1F4DD}';
        addPanel(slug, name, icon);
        this.classList.add('active');
      });
    });

    // Collapse all
    document.getElementById('wsCollapseAll').addEventListener('click', () => {
      document.querySelectorAll('.ws-panel__body').forEach((b) => { b.classList.add('collapsed'); });
    });

    // Clear all
    document.getElementById('wsClearAll').addEventListener('click', () => {
      activePanels = [];
      panelsContainer.querySelectorAll('.ws-panel').forEach((p) => { p.remove(); });
      document.querySelectorAll('.workspace__selector-btn.active').forEach((b) => { b.classList.remove('active'); });
      sessionStorage.removeItem('msfg-workspace-panels');
      sessionStorage.removeItem('msfg-workspace-inputs');
      updateState();
    });

    // Save calculator inputs before navigating away
    window.addEventListener('beforeunload', () => {
      saveAllInputs();
    });

    // Listen for tally updates from iframes (same-origin only)
    window.addEventListener('message', (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === 'msfg-tally-update') {
        updateTallyFromMessage(e.data);
      }
    });

    // Restore saved panels from sessionStorage (persists across navigation)
    restorePanels();

    // Auto-add calculators from URL query params (e.g., ?add=income/1040,income/schedule-c)
    const urlParams = new URLSearchParams(window.location.search);
    const addParam = urlParams.get('add');
    if (addParam) {
      const slugsToAdd = addParam.split(',').map((s) => s.trim()).filter(Boolean);
      slugsToAdd.forEach((slug) => {
        const btn = document.querySelector('.workspace__selector-btn[data-slug="' + slug + '"]');
        if (!btn) return;
        const nameEl = btn.querySelector('.workspace__selector-name');
        const iconEl = btn.querySelector('.workspace__selector-icon');
        const name = nameEl ? nameEl.textContent : slug;
        const icon = iconEl ? iconEl.textContent : '\u{1F4DD}';
        addPanel(slug, name, icon);
        btn.classList.add('active');
      });
      if (window.history.replaceState) {
        window.history.replaceState({}, '', '/workspace');
      }
    }

    // Restore MISMO data from sessionStorage
    MSFG.WorkspaceMISMO.restore();
  });

  /* ---- Panel management ---- */

  function addPanel(slug, name, icon, opts) {
    opts = opts || {};
    const instanceId = opts.instanceId || genInstanceId();
    const panelLabel = (opts.label != null && opts.label !== '') ? opts.label : name;
    const zoom = opts.zoom || DEFAULT_ZOOM;

    const panel = {
      instanceId: instanceId,
      slug: slug,
      name: name,
      label: panelLabel,
      icon: icon,
      zoom: zoom,
      tally: { monthlyPayment: 0, loanAmount: 0, cashToClose: 0, monthlyIncome: 0 }
    };
    activePanels.push(panel);

    const el = document.createElement('div');
    el.className = 'ws-panel';
    el.id = 'ws-panel-' + instanceId;

    el.innerHTML =
      '<div class="ws-panel__header" data-slug="' + slug + '" data-instance="' + instanceId + '">' +
        '<span class="ws-panel__icon">' + icon + '</span>' +
        '<span class="ws-panel__label" contenteditable="true" spellcheck="false" data-default="' + escAttr(name) + '">' + escAttr(panelLabel) + '</span>' +
        '<div class="ws-panel__zoom">' +
          '<svg class="ws-panel__zoom-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
            '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
          '</svg>' +
          '<input type="range" class="ws-panel__zoom-slider" min="50" max="100" value="' + zoom + '" step="5" />' +
          '<span class="ws-panel__zoom-label">' + zoom + '%</span>' +
        '</div>' +
        '<div class="ws-panel__actions">' +
          '<button class="ws-panel__btn ws-panel__btn--report" title="Add to Report">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>' +
          '</button>' +
          '<a href="/calculators/' + slug + '" target="_blank" class="ws-panel__standalone" title="Open standalone">↗</a>' +
          '<button class="ws-panel__btn ws-panel__btn--collapse" title="Collapse">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</button>' +
          '<button class="ws-panel__btn ws-panel__btn--remove" title="Remove" data-instance="' + instanceId + '">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="ws-panel__body" id="ws-body-' + instanceId + '">' +
        '<iframe class="ws-panel__iframe" src="/calculators/' + slug + '?embed=1" loading="lazy"></iframe>' +
      '</div>';

    // Prevent zoom slider clicks from toggling panel collapse
    const zoomContainer = el.querySelector('.ws-panel__zoom');
    zoomContainer.addEventListener('click', (e) => { e.stopPropagation(); });

    // Zoom slider handler
    const slider = el.querySelector('.ws-panel__zoom-slider');
    const label = el.querySelector('.ws-panel__zoom-label');
    const iframe = el.querySelector('.ws-panel__iframe');

    slider.addEventListener('input', function() {
      const val = parseInt(this.value, 10);
      label.textContent = val + '%';
      panel.zoom = val;
      MSFG.WS.applyZoomToIframe(iframe, val);
    });

    // Apply embed mode + default zoom when iframe loads, then populate MISMO data + restore inputs
    iframe.addEventListener('load', () => {
      MSFG.WS.applyZoomToIframe(iframe, panel.zoom);
      MSFG.WorkspaceMISMO.schedulePopulate(iframe, slug);
      scheduleRestore(iframe, panel.instanceId);
    });

    // Collapse toggle
    el.querySelector('.ws-panel__btn--collapse').addEventListener('click', (e) => {
      e.stopPropagation();
      const body = el.querySelector('.ws-panel__body');
      body.classList.toggle('collapsed');
    });

    // Header click also toggles collapse (but not clicks on the editable label or its buttons)
    el.querySelector('.ws-panel__header').addEventListener('click', (e) => {
      if (e.target.closest('.ws-panel__label') ||
          e.target.closest('.ws-panel__zoom') ||
          e.target.closest('.ws-panel__actions')) {
        return;
      }
      const body = el.querySelector('.ws-panel__body');
      body.classList.toggle('collapsed');
    });

    // Editable label handlers
    const labelEl = el.querySelector('.ws-panel__label');
    if (labelEl) {
      labelEl.addEventListener('click', (e) => { e.stopPropagation(); });
      labelEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          labelEl.blur();
        }
      });
      labelEl.addEventListener('blur', () => {
        let val = (labelEl.textContent || '').trim();
        if (val.length > 80) val = val.slice(0, 80);
        if (!val) val = labelEl.getAttribute('data-default') || panel.name;
        labelEl.textContent = val;
        panel.label = val;
        savePanels();
      });
      labelEl.addEventListener('input', () => {
        if ((labelEl.textContent || '').length > 80) {
          labelEl.textContent = labelEl.textContent.slice(0, 80);
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(labelEl);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    }

    // Report capture (structured data extraction)
    const reportBtn = el.querySelector('.ws-panel__btn--report');
    reportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      reportBtn.disabled = true;
      reportBtn.style.opacity = '0.5';

      let baseDoc = null;
      try {
        baseDoc = iframe.contentDocument || iframe.contentWindow.document;
      } catch (err) { /* cross-origin */ }

      if (!baseDoc) {
        MSFG.WS.showToast('Could not access calculator', 'error');
        reportBtn.disabled = false;
        reportBtn.style.opacity = '';
        return;
      }

      MSFG.Report.captureStructured(slug, name, icon, baseDoc).then(() => {
        reportBtn.disabled = false;
        reportBtn.style.opacity = '';
        reportBtn.style.color = 'var(--brand-primary)';
        setTimeout(() => { reportBtn.style.color = ''; }, 1500);
      }).catch((err) => {
        console.error('Workspace report capture failed:', err);
        reportBtn.disabled = false;
        reportBtn.style.opacity = '';
        MSFG.WS.showToast('Capture failed', 'error');
      });
    });

    // Remove
    el.querySelector('.ws-panel__btn--remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removePanel(panel.instanceId);
    });

    panelsContainer.appendChild(el);
    updateState();
  }

  function removePanel(instanceId) {
    const panel = activePanels.find((p) => p.instanceId === instanceId);
    activePanels = activePanels.filter((p) => p.instanceId !== instanceId);
    const el = document.getElementById('ws-panel-' + instanceId);
    if (el) el.remove();
    // Un-active selector button only if no other instances of this slug remain
    if (panel) {
      const stillHasSlug = activePanels.some((p) => p.slug === panel.slug);
      if (!stillHasSlug) {
        const selectorBtn = document.querySelector('.workspace__selector-btn[data-slug="' + panel.slug + '"]');
        if (selectorBtn) selectorBtn.classList.remove('active');
      }
    }
    // Also drop input data for this instance
    try {
      const stored = sessionStorage.getItem('msfg-workspace-inputs');
      if (stored) {
        const all = JSON.parse(stored);
        if (all && all[instanceId] !== undefined) {
          delete all[instanceId];
          sessionStorage.setItem('msfg-workspace-inputs', JSON.stringify(all));
        }
      }
    } catch (e) { /* skip */ }
    updateState();
  }

  function updateState() {
    const count = activePanels.length;
    countBadge.textContent = count + ' active';
    emptyState.classList.toggle('u-hidden', count !== 0);
    tallyBar.classList.toggle('u-hidden', count === 0);
    savePanels();
    updateSelectorCounts();
    updateTally();
  }

  /* ---- Persist/restore active panels across navigation ---- */

  function savePanels() {
    const data = activePanels.map((p) => ({
      instanceId: p.instanceId,
      slug: p.slug,
      name: p.name,
      label: p.label,
      icon: p.icon,
      zoom: p.zoom
    }));
    try {
      sessionStorage.setItem('msfg-workspace-panels', JSON.stringify(data));
    } catch (e) { /* quota */ }
  }

  function restorePanels() {
    const stored = sessionStorage.getItem('msfg-workspace-panels');
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      if (!Array.isArray(data) || data.length === 0) return;
      data.forEach((p) => {
        if (!p.slug) return;
        // Migrate old slug-keyed entries (no instanceId): use slug as instanceId, name as label
        const instanceId = p.instanceId || p.slug;
        const label = p.label || p.name;
        addPanel(p.slug, p.name, p.icon, { instanceId, label, zoom: p.zoom });
        const btn = document.querySelector('.workspace__selector-btn[data-slug="' + p.slug + '"]');
        if (btn) btn.classList.add('active');
      });
      // Persist back under the new shape so any migrated entries get rewritten
      savePanels();
    } catch (e) { /* corrupted data, skip */ }
  }

  /* ---- Persist/restore calculator input values across navigation ---- */

  function saveAllInputs() {
    const data = {};
    activePanels.forEach((panel) => {
      const inputs = extractPanelInputs(panel.instanceId);
      if (inputs) data[panel.instanceId] = inputs;
    });
    try {
      sessionStorage.setItem('msfg-workspace-inputs', JSON.stringify(data));
    } catch (e) { /* quota exceeded or private mode */ }
  }

  function extractPanelInputs(instanceId) {
    const panelEl = document.getElementById('ws-panel-' + instanceId);
    if (!panelEl) return null;
    const iframe = panelEl.querySelector('.ws-panel__iframe');
    if (!iframe) return null;

    try {
      const outerWin = iframe.contentWindow;
      const outerDoc = iframe.contentDocument || outerWin.document;
      if (!outerDoc) return null;

      // Generic state hook — any calculator can implement window.__calcState
      if (outerWin && outerWin.__calcState && typeof outerWin.__calcState.save === 'function') {
        return { _api: 'calcState', data: outerWin.__calcState.save() };
      }

      const nestedIframe = outerDoc.querySelector('iframe');

      if (nestedIframe) {
        const innerWin = nestedIframe.contentWindow;
        const innerDoc = nestedIframe.contentDocument || innerWin.document;

        if (innerWin && innerWin.RefiUI && typeof innerWin.RefiUI.readAllInputs === 'function') {
          return { _api: 'RefiUI', data: innerWin.RefiUI.readAllInputs() };
        }

        // Check nested iframe for __calcState too
        if (innerWin && innerWin.__calcState && typeof innerWin.__calcState.save === 'function') {
          return { _api: 'calcState', data: innerWin.__calcState.save() };
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

  function scheduleRestore(iframe, instanceId) {
    const stored = sessionStorage.getItem('msfg-workspace-inputs');
    if (!stored) return;
    try {
      const allData = JSON.parse(stored);
      if (!allData[instanceId]) return;
    } catch (e) { return; }

    function tryRestore(attempt) {
      if (attempt > 15) return;
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const nested = doc ? doc.querySelector('iframe') : null;
        if (nested) {
          let nestedDoc = null;
          try { nestedDoc = nested.contentDocument || nested.contentWindow.document; } catch (_e) { /* cross-origin */ }
          if (!nestedDoc || !nestedDoc.body || !nestedDoc.body.innerHTML) {
            nested.addEventListener('load', () => {
              setTimeout(() => { restorePanelInputs(instanceId); }, 600);
            });
            return;
          }
        }
      } catch (e) { /* skip */ }
      restorePanelInputs(instanceId);
    }

    setTimeout(() => { tryRestore(0); }, 1200);
  }

  function restorePanelInputs(instanceId) {
    const stored = sessionStorage.getItem('msfg-workspace-inputs');
    if (!stored) return;
    try {
      const allData = JSON.parse(stored);
      const panelData = allData[instanceId];
      if (!panelData) return;
      applyPanelInputs(instanceId, panelData);
    } catch (e) { /* corrupted */ }
  }

  function applyPanelInputs(instanceId, panelData) {
    const panelEl = document.getElementById('ws-panel-' + instanceId);
    if (!panelEl) return;
    const iframe = panelEl.querySelector('.ws-panel__iframe');
    if (!iframe) return;

    try {
      const outerWin = iframe.contentWindow;
      const outerDoc = iframe.contentDocument || outerWin.document;
      if (!outerDoc) return;

      // Generic state hook — restore via __calcState
      if (panelData._api === 'calcState') {
        const targetWin = outerWin;
        // Try outer window first, then nested iframe
        if (targetWin && targetWin.__calcState && typeof targetWin.__calcState.restore === 'function') {
          targetWin.__calcState.restore(panelData.data);
          return;
        }
        const nested = outerDoc.querySelector('iframe');
        if (nested) {
          const nw = nested.contentWindow;
          if (nw && nw.__calcState && typeof nw.__calcState.restore === 'function') {
            nw.__calcState.restore(panelData.data);
            return;
          }
        }
      }

      const nestedIframe = outerDoc.querySelector('iframe');

      if (panelData._api === 'RefiUI' && nestedIframe) {
        const innerWin = nestedIframe.contentWindow;
        if (innerWin && innerWin.RefiUI && typeof innerWin.RefiUI.writeAllInputs === 'function') {
          innerWin.RefiUI.writeAllInputs(panelData.data);
          return;
        }
      }

      let targetDoc = outerDoc;
      if (nestedIframe) {
        try {
          const nd = nestedIframe.contentDocument || nestedIframe.contentWindow.document;
          if (nd && nd.body) targetDoc = nd;
        } catch (e) { /* cross-origin */ }
      }

      const fields = panelData.data;
      if (!fields) return;
      const keys = Object.keys(fields);
      for (let i = 0; i < keys.length; i++) {
        const id = keys[i];
        const el = targetDoc.getElementById(id);
        if (!el) continue;
        const info = fields[id];
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
    const panel = activePanels.find((p) => p.slug === data.slug);
    if (!panel) return;
    if (typeof data.monthlyPayment === 'number' && isFinite(data.monthlyPayment)) panel.tally.monthlyPayment = data.monthlyPayment;
    if (typeof data.loanAmount === 'number' && isFinite(data.loanAmount)) panel.tally.loanAmount = data.loanAmount;
    if (typeof data.cashToClose === 'number' && isFinite(data.cashToClose)) panel.tally.cashToClose = data.cashToClose;
    if (typeof data.monthlyIncome === 'number' && isFinite(data.monthlyIncome)) panel.tally.monthlyIncome = data.monthlyIncome;
    updateTally();
  }

  function pollIncomePanels() {
    let changed = false;
    activePanels.forEach((panel) => {
      const elementId = INCOME_ELEMENT_MAP[panel.slug];
      if (!elementId) return;

      const panelEl = document.getElementById('ws-panel-' + panel.instanceId);
      if (!panelEl) return;

      const iframe = panelEl.querySelector('.ws-panel__iframe');
      if (!iframe) return;

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        let targetDoc = iframeDoc;

        const nestedIframe = iframeDoc.querySelector('iframe');
        if (nestedIframe) {
          try {
            targetDoc = nestedIframe.contentDocument || nestedIframe.contentWindow.document;
          } catch (e) { return; }
        }

        const el = targetDoc.getElementById(elementId);
        if (el) {
          const text = el.textContent || '';
          let val = parseFloat(text.replace(/[^0-9.-]/g, ''));
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
    const totals = { monthlyPayment: 0, loanAmount: 0, cashToClose: 0, monthlyIncome: 0 };
    activePanels.forEach((p) => {
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
