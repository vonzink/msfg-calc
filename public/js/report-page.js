/* =====================================================
   MSFG Report Page
   Branded report cards, income grouping, drag-to-reorder,
   pdfmake PDF.
   ===================================================== */
(function() {
  'use strict';

  var itemsContainer = document.getElementById('reportItems');
  var emptyState = document.getElementById('reportEmpty');
  var actionsBar = document.getElementById('reportActions');
  var countEl = document.getElementById('reportCount');

  var reportPageEl = document.getElementById('reportPage');
  var cfg = {};
  try { cfg = JSON.parse(reportPageEl.dataset.siteConfig || '{}'); } catch (e) { /* ignore */ }
  var COMPANY_NAME = cfg.companyName || 'Mountain State Financial Group LLC';
  var COMPANY = COMPANY_NAME + (cfg.nmls ? ', NMLS# ' + cfg.nmls : '');
  // Detect base path for subpath deployments (e.g. /calc/ on dashboard.msfgco.com)
  var basePath = '';
  var rpScript = document.querySelector('script[src*="report-page"]');
  if (rpScript && rpScript.src) {
    var m = rpScript.src.match(/^https?:\/\/[^/]+(\/.*?)\/js\/report-page/);
    if (m && m[1]) basePath = m[1];
  }
  var rawLogo = cfg.logo || '/images/msfg-logo.png';
  var LOGO_URL = rawLogo.charAt(0) === '/' ? basePath + rawLogo : rawLogo;
  var DOMAIN = cfg.domain || 'msfginfo.com';
  var EHL_URL = cfg.equalHousingLogo || '';

  var DRAG_HANDLE_SVG =
    '<svg class="report-item__drag-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">' +
      '<circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/>' +
      '<circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>' +
      '<circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/>' +
    '</svg>';

  function formatTime(iso) {
    var d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
           ' — ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function isIncome(slug) { return slug && slug.indexOf('income/') === 0; }

  /* ---- Branded card wrapper ---- */
  function brandedHeader(name, icon) {
    return '<div class="rpt-brand-bar">' +
      '<img src="' + LOGO_URL + '" class="rpt-brand-logo" alt="MSFG">' +
      '<div class="rpt-brand-calc">' + icon + ' ' + name + '</div>' +
    '</div>';
  }
  function brandedFooter(timestamp) {
    var ehlHtml = EHL_URL
      ? '<div class="rpt-brand-ehl"><img src="' + EHL_URL + '" alt="Equal Housing Lender" class="rpt-brand-ehl-img" onerror="this.parentElement.innerHTML=\'Equal Housing Lender\'"></div>'
      : '';
    return '<div class="rpt-brand-footer-divider"></div>' +
      ehlHtml +
      '<div class="rpt-brand-footer">' +
        '<span>' + COMPANY + '</span>' +
        '<span>' + formatDate(timestamp) + '</span>' +
        '<span>' + DOMAIN + '</span>' +
      '</div>';
  }

  /* ---- Build a report card element ---- */
  function buildCard(item, bodyContent) {
    var div = document.createElement('div');
    div.className = 'report-item';
    div.setAttribute('data-id', item.id);
    div.setAttribute('draggable', 'true');
    div.innerHTML =
      '<div class="report-item__header">' +
        '<div class="report-item__drag-handle" title="Drag to reorder">' + DRAG_HANDLE_SVG + '</div>' +
        '<div class="report-item__info">' +
          '<span class="report-item__icon">' + item.icon + '</span>' +
          '<span class="report-item__name">' + item.name + '</span>' +
          '<span class="report-item__time">' + formatTime(item.timestamp) + '</span>' +
        '</div>' +
        '<button class="report-item__remove" data-id="' + item.id + '">Remove</button>' +
      '</div>' +
      '<div class="report-item__body">' +
        brandedHeader(item.name, item.icon) +
        bodyContent +
        brandedFooter(item.timestamp) +
      '</div>';
    return div;
  }

  /* ================================================
     Drag & Drop Reordering
     ================================================ */
  var dragSrcEl = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    this.classList.add('report-item--dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    var target = findCardParent(e.target);
    if (!target || target === dragSrcEl) return;

    // Remove existing indicators
    clearDropIndicators();

    // Determine if we should insert before or after
    var rect = target.getBoundingClientRect();
    var midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      target.classList.add('report-item--drag-over-top');
    } else {
      target.classList.add('report-item--drag-over-bottom');
    }
  }

  function handleDragLeave(e) {
    var target = findCardParent(e.target);
    if (target) {
      target.classList.remove('report-item--drag-over-top', 'report-item--drag-over-bottom');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    var target = findCardParent(e.target);
    if (!target || !dragSrcEl || target === dragSrcEl) return;

    var rect = target.getBoundingClientRect();
    var midY = rect.top + rect.height / 2;
    var insertBefore = e.clientY < midY;

    if (insertBefore) {
      itemsContainer.insertBefore(dragSrcEl, target);
    } else {
      itemsContainer.insertBefore(dragSrcEl, target.nextSibling);
    }

    clearDropIndicators();
    persistOrder();
  }

  function handleDragEnd() {
    if (dragSrcEl) dragSrcEl.classList.remove('report-item--dragging');
    dragSrcEl = null;
    clearDropIndicators();
  }

  function clearDropIndicators() {
    var items = itemsContainer.querySelectorAll('.report-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('report-item--drag-over-top', 'report-item--drag-over-bottom');
    }
  }

  function findCardParent(el) {
    while (el && el !== itemsContainer) {
      if (el.classList && el.classList.contains('report-item')) return el;
      el = el.parentElement;
    }
    return null;
  }

  function persistOrder() {
    var cards = itemsContainer.querySelectorAll('.report-item');
    var orderedIds = [];
    for (var i = 0; i < cards.length; i++) {
      var rawId = cards[i].getAttribute('data-id');
      // Income group has comma-separated ids
      if (rawId && rawId.indexOf(',') !== -1) {
        rawId.split(',').forEach(function(id) { orderedIds.push(id); });
      } else if (rawId) {
        orderedIds.push(rawId);
      }
    }
    MSFG.Report.reorderItems(orderedIds);
  }

  function wireUpDragAndDrop() {
    var cards = itemsContainer.querySelectorAll('.report-item');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('dragstart', handleDragStart);
      cards[i].addEventListener('dragover', handleDragOver);
      cards[i].addEventListener('dragleave', handleDragLeave);
      cards[i].addEventListener('drop', handleDrop);
      cards[i].addEventListener('dragend', handleDragEnd);
    }
  }

  /* ---- Render ---- */
  function render() {
    MSFG.Report.getItems().then(function(items) {
      itemsContainer.innerHTML = '';

      if (items.length === 0) {
        emptyState.classList.remove('u-hidden');
        actionsBar.classList.add('u-hidden');
        countEl.textContent = '';
        return;
      }

      emptyState.classList.add('u-hidden');
      actionsBar.classList.remove('u-hidden');
      countEl.textContent = '(' + items.length + ' item' + (items.length !== 1 ? 's' : '') + ')';

      var incomeItems = [];
      var otherItems = [];
      items.forEach(function(item) {
        if (item.version === 2 && item.slug && isIncome(item.slug)) {
          incomeItems.push(item);
        } else {
          otherItems.push(item);
        }
      });

      // Render non-income items (each gets its own branded card)
      otherItems.forEach(function(item) {
        var body = '';
        if (item.version === 2 && item.data && item.slug && MSFG.ReportTemplates) {
          body = MSFG.ReportTemplates.render(item.slug, item.data);
        } else if (item.imageData) {
          body = '<img class="report-item__image" src="' + item.imageData + '" alt="' + item.name + ' snapshot">';
        } else {
          body = '<p class="rpt-no-template">No data available.</p>';
        }
        itemsContainer.appendChild(buildCard(item, body));
      });

      // Render all income items grouped into one card
      if (incomeItems.length > 0) {
        var incDiv = document.createElement('div');
        incDiv.className = 'report-item report-item--income-group';
        incDiv.setAttribute('data-id', incomeItems.map(function(i) { return i.id; }).join(','));
        incDiv.setAttribute('draggable', 'true');

        var bodyHTML = '<div class="rpt-brand-bar">' +
          '<img src="' + LOGO_URL + '" class="rpt-brand-logo" alt="MSFG">' +
          '<div class="rpt-brand-calc">Income Analysis</div>' +
        '</div>';

        var combinedMonthly = 0;
        incomeItems.forEach(function(item) {
          bodyHTML += '<div class="rpt-income-block">';
          bodyHTML += '<div class="rpt-income-block-title">' + item.icon + ' ' + item.name + '</div>';
          if (item.data && MSFG.ReportTemplates) {
            bodyHTML += MSFG.ReportTemplates.render(item.slug, item.data);
          }
          bodyHTML += '</div>';
          if (item.data && typeof item.data.totalMonthly === 'number') {
            combinedMonthly += item.data.totalMonthly;
          }
        });

        if (incomeItems.length > 1) {
          var fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(combinedMonthly);
          bodyHTML += '<div class="rpt-income-combined">' +
            '<span>Combined Monthly Income</span><span>' + fmt + '</span>' +
          '</div>';
        }

        bodyHTML += brandedFooter(incomeItems[0].timestamp);

        // Header shows item count with drag handle
        incDiv.innerHTML =
          '<div class="report-item__header">' +
            '<div class="report-item__drag-handle" title="Drag to reorder">' + DRAG_HANDLE_SVG + '</div>' +
            '<div class="report-item__info">' +
              '<span class="report-item__icon">' + String.fromCodePoint(0x1F4DD) + '</span>' +
              '<span class="report-item__name">Income Calculators (' + incomeItems.length + ')</span>' +
            '</div>' +
            '<button class="report-item__remove report-item__remove--all" data-ids="' +
              incomeItems.map(function(i) { return i.id; }).join(',') + '">Remove All</button>' +
          '</div>' +
          '<div class="report-item__body">' + bodyHTML + '</div>';

        itemsContainer.appendChild(incDiv);
      }

      // Wire up remove buttons
      itemsContainer.querySelectorAll('.report-item__remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var ids = this.getAttribute('data-ids');
          if (ids) {
            Promise.all(ids.split(',').map(function(id) { return MSFG.Report.removeItem(id); })).then(render);
          } else {
            MSFG.Report.removeItem(this.getAttribute('data-id')).then(render);
          }
        });
      });

      // Wire up drag-and-drop
      wireUpDragAndDrop();
    });
  }

  /* ---- Print ---- */
  document.getElementById('btnPrintReport').addEventListener('click', function() { window.print(); });

  /* ---- Load images as base64 for PDF ---- */
  function loadImageBase64(url) {
    return new Promise(function(resolve) {
      if (!url) { resolve(null); return; }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = function() { resolve(null); };
      img.src = url;
    });
  }

  function loadLogoBase64() { return loadImageBase64(LOGO_URL); }
  function loadEHLBase64() { return loadImageBase64(EHL_URL); }

  /* ---- PDF Export ---- */
  document.getElementById('btnPdfReport').addEventListener('click', function() {
    Promise.all([MSFG.Report.getItems(), loadLogoBase64(), loadEHLBase64()]).then(function(results) {
      var items = results[0];
      var logoData = results[1];
      var ehlData = results[2];
      if (items.length === 0) return;

      var incomeItems = [];
      var otherItems = [];
      items.forEach(function(item) {
        if (item.version === 2 && item.slug && isIncome(item.slug)) incomeItems.push(item);
        else otherItems.push(item);
      });

      var content = [];
      var fmt = function(n) { return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n); };
      var PW = 572; // usable width: 612 - 20*2

      /* ============================================================
         Section header — page break before each calc, compact bar
         ============================================================ */
      var isFirstCalc = true;
      function pdfSectionHeader(name, icon) {
        var header = [];
        if (!isFirstCalc) {
          header.push({ text: '', pageBreak: 'before' });
        }
        isFirstCalc = false;
        header.push({
          table: {
            widths: [logoData ? 'auto' : 0, '*'],
            body: [[
              logoData ? { image: logoData, width: 48, margin: [0, 0, 0, 0] } : { text: '' },
              { text: icon + '  ' + name, bold: true, fontSize: 8, color: '#1b4332', alignment: 'right', margin: [0, 2, 0, 0] }
            ]]
          },
          layout: {
            hLineWidth: function(i, node) { return i === node.table.body.length ? 1 : 0; },
            vLineWidth: function() { return 0; },
            hLineColor: function() { return '#2d6a4f'; },
            paddingLeft: function() { return 0; },
            paddingRight: function() { return 0; },
            paddingTop: function() { return 0; },
            paddingBottom: function() { return 2; }
          },
          margin: [0, 0, 0, 5]
        });
        return header;
      }

      /* ============================================================
         Each calculator = its own page
         ============================================================ */
      otherItems.forEach(function(item) {
        pdfSectionHeader(item.name, item.icon).forEach(function(n) { content.push(n); });

        if (item.version === 2 && item.data && item.slug && MSFG.ReportTemplates) {
          var pc = MSFG.ReportTemplates.pdfContent(item.slug, item.data);
          if (Array.isArray(pc)) pc.forEach(function(n) { content.push(n); });
        } else {
          content.push({ text: 'Legacy item — view in browser.', italics: true, color: '#888' });
        }
      });

      /* ============================================================
         Income — consolidated on its own page
         ============================================================ */
      if (incomeItems.length > 0) {
        pdfSectionHeader('Income Analysis', '\uD83D\uDCDD').forEach(function(n) { content.push(n); });

        var combinedMonthly = 0;
        incomeItems.forEach(function(item, idx) {
          if (idx > 0) content.push({ text: '', margin: [0, 2, 0, 0] });
          content.push({ text: item.icon + '  ' + item.name, style: 'incomeSubTitle', margin: [0, 1, 0, 1] });
          if (item.version === 2 && item.data && MSFG.ReportTemplates) {
            var pc = MSFG.ReportTemplates.pdfContent(item.slug, item.data);
            if (Array.isArray(pc)) pc.forEach(function(n) { content.push(n); });
          }
          if (item.data && typeof item.data.totalMonthly === 'number') combinedMonthly += item.data.totalMonthly;
        });

        if (incomeItems.length > 1) {
          content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: PW, y2: 0, lineWidth: 1, lineColor: '#2d6a4f' }], margin: [0, 4, 0, 2] });
          content.push({ columns: [
            { text: 'COMBINED MONTHLY INCOME', bold: true, fontSize: 8, color: '#2d6a4f' },
            { text: fmt(combinedMonthly), alignment: 'right', bold: true, fontSize: 8, color: '#2d6a4f' }
          ] });
        }
      }

      /* ============================================================
         Document definition — ultra-tight for print
         ============================================================ */
      var docDef = {
        pageSize: 'LETTER',
        pageMargins: [20, 20, 20, 24],
        content: content,
        styles: {
          sectionTitle: { fontSize: 7, bold: true, color: '#1b4332' },
          incomeSubTitle: { fontSize: 7, bold: true, color: '#2d6a4f' },
          tableHeader: { bold: true, fontSize: 6, color: '#ffffff', fillColor: '#2d6a4f' }
        },
        defaultStyle: { fontSize: 6.5, color: '#333333' },
        footer: function(pg, total) {
          var parts = [
            { text: COMPANY, fontSize: 5.5, color: '#adb5bd' }
          ];
          if (ehlData) {
            // EHL in footer instead of body
            return {
              columns: [
                { image: ehlData, width: 14, margin: [20, -2, 0, 0] },
                { text: COMPANY + '  |  ' + DOMAIN, fontSize: 5.5, color: '#adb5bd', margin: [4, 2, 0, 0] },
                { text: 'Page ' + pg + ' of ' + total, alignment: 'right', fontSize: 5.5, color: '#adb5bd', margin: [0, 2, 20, 0] }
              ],
              margin: [0, 2, 0, 0]
            };
          }
          return {
            columns: [
              { text: COMPANY + '  |  ' + DOMAIN, fontSize: 5.5, color: '#adb5bd', margin: [20, 0, 0, 0] },
              { text: 'Page ' + pg + ' of ' + total, alignment: 'right', fontSize: 5.5, color: '#adb5bd', margin: [0, 0, 20, 0] }
            ],
            margin: [0, 2, 0, 0]
          };
        }
      };

      pdfMake.createPdf(docDef).download('MSFG-Report-' + new Date().toISOString().slice(0, 10) + '.pdf');
    });
  });

  /* ---- Clear All ---- */
  document.getElementById('btnClearReport').addEventListener('click', function() {
    if (confirm('Remove all items from your report?')) {
      MSFG.Report.clear().then(render);
    }
  });

  render();
})();
