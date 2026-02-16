/* =====================================================
   Calculator Workspace
   Multi-calculator panels with cross-calc tallying
   ===================================================== */
(function() {
  var activePanels = [];

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
  });

  function addPanel(slug, name, icon) {
    if (activePanels.find(function(p) { return p.slug === slug; })) return;

    var panel = {
      slug: slug,
      name: name,
      icon: icon,
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
        '<div class="ws-panel__actions">' +
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

    // Inject embed mode into iframe once loaded (hides footer/header chrome)
    var iframe = el.querySelector('.ws-panel__iframe');
    iframe.addEventListener('load', function() {
      try {
        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.body.classList.add('embed-mode');
      } catch (e) { /* cross-origin, skip */ }
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
