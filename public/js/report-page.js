/* =====================================================
   MSFG Report Page
   Branded report cards, income grouping, pdfmake PDF.
   ===================================================== */
(function() {
  'use strict';

  var itemsContainer = document.getElementById('reportItems');
  var emptyState = document.getElementById('reportEmpty');
  var actionsBar = document.getElementById('reportActions');
  var countEl = document.getElementById('reportCount');

  var COMPANY = 'Mountain States Financial Group';
  var LOGO_URL = '/images/msfg-logo.png';
  var DOMAIN = 'msfginfo.com';

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
    return '<div class="rpt-brand-footer">' +
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
    div.innerHTML =
      '<div class="report-item__header">' +
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

  /* ---- Render ---- */
  function render() {
    MSFG.Report.getItems().then(function(items) {
      itemsContainer.innerHTML = '';

      if (items.length === 0) {
        emptyState.style.display = '';
        actionsBar.style.display = 'none';
        countEl.textContent = '';
        return;
      }

      emptyState.style.display = 'none';
      actionsBar.style.display = 'flex';
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

        // Header shows item count
        incDiv.innerHTML =
          '<div class="report-item__header">' +
            '<div class="report-item__info">' +
              '<span class="report-item__icon">📝</span>' +
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
    });
  }

  /* ---- Print ---- */
  document.getElementById('btnPrintReport').addEventListener('click', function() { window.print(); });

  /* ---- Load logo as base64 for PDF ---- */
  function loadLogoBase64() {
    return new Promise(function(resolve) {
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
      img.src = LOGO_URL;
    });
  }

  /* ---- PDF Export ---- */
  document.getElementById('btnPdfReport').addEventListener('click', function() {
    Promise.all([MSFG.Report.getItems(), loadLogoBase64()]).then(function(results) {
      var items = results[0];
      var logoData = results[1];
      if (items.length === 0) return;

      var incomeItems = [];
      var otherItems = [];
      items.forEach(function(item) {
        if (item.version === 2 && item.slug && isIncome(item.slug)) incomeItems.push(item);
        else otherItems.push(item);
      });

      var content = [];
      var fmt = function(n) { return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n); };

      /* -- Cover page -- */
      if (logoData) {
        content.push({ image: logoData, width: 180, margin: [0, 20, 0, 12] });
      }
      content.push({ text: 'Session Report', style: 'title', margin: [0, 0, 0, 4] });
      content.push({ text: COMPANY, style: 'companyName' });
      content.push({ text: 'Generated ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), style: 'subtitle', margin: [0, 4, 0, 20] });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#2d6a4f' }], margin: [0, 0, 0, 16] });

      if (items.length > 1) {
        content.push({ text: 'Contents', style: 'tocTitle', margin: [0, 8, 0, 6] });
        var tocIdx = 1;
        otherItems.forEach(function(item) {
          content.push({ text: tocIdx++ + '. ' + item.icon + '  ' + item.name, style: 'tocItem', margin: [8, 2, 0, 2] });
        });
        if (incomeItems.length > 0) {
          content.push({ text: tocIdx + '. Income Analysis (' + incomeItems.length + ' calculators)', style: 'tocItem', margin: [8, 2, 0, 2] });
        }
      }

      /* -- General / Government pages (one per calc) -- */
      otherItems.forEach(function(item) {
        content.push({ text: '', pageBreak: 'before' });
        if (logoData) {
          content.push({ columns: [
            { image: logoData, width: 120 },
            { text: item.icon + '  ' + item.name, style: 'calcTitle', alignment: 'right', margin: [0, 10, 0, 0] }
          ], margin: [0, 0, 0, 6] });
        } else {
          content.push({ text: item.icon + '  ' + item.name, style: 'calcTitle' });
        }
        content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#2d6a4f' }], margin: [0, 2, 0, 10] });

        if (item.version === 2 && item.data && item.slug && MSFG.ReportTemplates) {
          var pc = MSFG.ReportTemplates.pdfContent(item.slug, item.data);
          if (Array.isArray(pc)) pc.forEach(function(n) { content.push(n); });
        } else {
          content.push({ text: 'Legacy item — view in browser.', italics: true, color: '#888' });
        }
        content.push({ text: COMPANY + '  |  ' + DOMAIN, alignment: 'center', fontSize: 8, color: '#aaaaaa', margin: [0, 20, 0, 0] });
      });

      /* -- Income consolidated page(s) -- */
      if (incomeItems.length > 0) {
        content.push({ text: '', pageBreak: 'before' });
        if (logoData) {
          content.push({ columns: [
            { image: logoData, width: 120 },
            { text: 'Income Analysis', style: 'calcTitle', alignment: 'right', margin: [0, 10, 0, 0] }
          ], margin: [0, 0, 0, 6] });
        } else {
          content.push({ text: 'Income Analysis', style: 'calcTitle' });
        }
        content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#2d6a4f' }], margin: [0, 2, 0, 8] });

        var combinedMonthly = 0;
        incomeItems.forEach(function(item, idx) {
          if (idx > 0) content.push({ text: '', margin: [0, 4, 0, 0] });
          content.push({ text: item.icon + '  ' + item.name, style: 'incomeSubTitle', margin: [0, 4, 0, 4] });
          if (item.version === 2 && item.data && MSFG.ReportTemplates) {
            var pc = MSFG.ReportTemplates.pdfContent(item.slug, item.data);
            if (Array.isArray(pc)) pc.forEach(function(n) { content.push(n); });
          }
          if (item.data && typeof item.data.totalMonthly === 'number') combinedMonthly += item.data.totalMonthly;
        });

        if (incomeItems.length > 1) {
          content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#2d6a4f' }], margin: [0, 12, 0, 6] });
          content.push({ columns: [
            { text: 'COMBINED MONTHLY INCOME', bold: true, fontSize: 13, color: '#2d6a4f' },
            { text: fmt(combinedMonthly), alignment: 'right', bold: true, fontSize: 13, color: '#2d6a4f' }
          ] });
        }
        content.push({ text: COMPANY + '  |  ' + DOMAIN, alignment: 'center', fontSize: 8, color: '#aaaaaa', margin: [0, 16, 0, 0] });
      }

      var docDef = {
        pageSize: 'LETTER',
        pageMargins: [40, 40, 40, 50],
        content: content,
        styles: {
          title: { fontSize: 24, bold: true, color: '#1a1a1a' },
          companyName: { fontSize: 12, color: '#2d6a4f', bold: true },
          subtitle: { fontSize: 10, color: '#888888' },
          tocTitle: { fontSize: 14, bold: true, color: '#333333' },
          tocItem: { fontSize: 10, color: '#555555' },
          calcTitle: { fontSize: 16, bold: true, color: '#1a1a1a' },
          calcDate: { fontSize: 9, color: '#999999' },
          sectionTitle: { fontSize: 12, bold: true, color: '#333333' },
          incomeSubTitle: { fontSize: 11, bold: true, color: '#444444' },
          tableHeader: { bold: true, fontSize: 9, color: '#666666', fillColor: '#f8f9fa' }
        },
        defaultStyle: { fontSize: 10, color: '#333333' },
        footer: function(pg, total) {
          return { columns: [
            { text: COMPANY, fontSize: 7, color: '#bbbbbb', margin: [40, 0, 0, 0] },
            { text: 'Page ' + pg + ' of ' + total, alignment: 'right', fontSize: 7, color: '#bbbbbb', margin: [0, 0, 40, 0] }
          ], margin: [0, 20, 0, 0] };
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
