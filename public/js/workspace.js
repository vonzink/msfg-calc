/* =====================================================
   Calculator Workspace
   Multi-calculator panels with cross-calc tallying
   ===================================================== */
(function() {
  var activePanels = [];
  var DEFAULT_ZOOM = 85;

  var panelsContainer, emptyState, tallyBar, countBadge, selectorDrawer;

  document.addEventListener('DOMContentLoaded', function() {
    panelsContainer = document.getElementById('wsPanels');
    emptyState = document.getElementById('wsEmpty');
    tallyBar = document.getElementById('wsTally');
    countBadge = document.getElementById('wsCount');
    selectorDrawer = document.getElementById('wsSelector');

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
      updateState();
    });

    // Listen for tally updates from iframes
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'msfg-tally-update') {
        updateTallyFromMessage(e.data);
      }
    });

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

    // Apply embed mode + default zoom when iframe loads
    iframe.addEventListener('load', function() {
      applyZoomToIframe(iframe, panel.zoom);
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

    // Report capture
    var reportBtn = el.querySelector('.ws-panel__btn--report');
    reportBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      reportBtn.disabled = true;
      reportBtn.style.opacity = '0.5';

      var target = null;
      try {
        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc && iframeDoc.body) target = iframeDoc.body;
      } catch (err) { /* cross-origin */ }

      if (!target) {
        showWsToast('Could not capture — try opening standalone', 'error');
        reportBtn.disabled = false;
        reportBtn.style.opacity = '';
        return;
      }

      if (typeof html2canvas === 'undefined') {
        showWsToast('Capture library not loaded', 'error');
        reportBtn.disabled = false;
        reportBtn.style.opacity = '';
        return;
      }

      html2canvas(target, {
        useCORS: true, allowTaint: true, scale: 1,
        backgroundColor: '#ffffff', logging: false
      }).then(function(canvas) {
        var imageData = canvas.toDataURL('image/jpeg', 0.5);
        return MSFG.Report.addItem({ name: name, icon: icon, imageData: imageData });
      }).then(function() {
        reportBtn.disabled = false;
        reportBtn.style.opacity = '';
        reportBtn.style.color = 'var(--brand-primary)';
        showWsToast('Added to report');
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
    updateTally();
  }

  function updateTallyFromMessage(data) {
    var panel = activePanels.find(function(p) { return p.slug === data.slug; });
    if (!panel) return;
    if (data.monthlyPayment !== undefined) panel.tally.monthlyPayment = data.monthlyPayment;
    if (data.loanAmount !== undefined) panel.tally.loanAmount = data.loanAmount;
    if (data.cashToClose !== undefined) panel.tally.cashToClose = data.cashToClose;
    if (data.monthlyIncome !== undefined) panel.tally.monthlyIncome = data.monthlyIncome;
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
})();
