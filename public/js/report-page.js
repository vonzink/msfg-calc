/* =====================================================
   MSFG Report Page
   Renders structured calculator data + pdfmake PDF export.
   ===================================================== */
(function() {
  'use strict';

  var itemsContainer = document.getElementById('reportItems');
  var emptyState = document.getElementById('reportEmpty');
  var actionsBar = document.getElementById('reportActions');
  var countEl = document.getElementById('reportCount');

  function formatTime(isoString) {
    var d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
           ' — ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateShort(isoString) {
    var d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ---- Render report items ---- */
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

      items.forEach(function(item) {
        var div = document.createElement('div');
        div.className = 'report-item';
        div.setAttribute('data-id', item.id);

        var bodyContent = '';
        if (item.version === 2 && item.data && item.slug && MSFG.ReportTemplates) {
          bodyContent = MSFG.ReportTemplates.render(item.slug, item.data);
        } else if (item.imageData) {
          bodyContent = '<img class="report-item__image" src="' + item.imageData + '" alt="' + item.name + ' snapshot">';
        } else {
          bodyContent = '<p class="rpt-no-template">No data available for this item.</p>';
        }

        div.innerHTML =
          '<div class="report-item__header">' +
            '<div class="report-item__info">' +
              '<span class="report-item__icon">' + item.icon + '</span>' +
              '<span class="report-item__name">' + item.name + '</span>' +
              '<span class="report-item__time">' + formatTime(item.timestamp) + '</span>' +
            '</div>' +
            '<button class="report-item__remove" data-id="' + item.id + '">Remove</button>' +
          '</div>' +
          '<div class="report-item__body">' + bodyContent + '</div>';

        itemsContainer.appendChild(div);
      });

      itemsContainer.querySelectorAll('.report-item__remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
          MSFG.Report.removeItem(this.getAttribute('data-id')).then(function() {
            render();
          });
        });
      });
    });
  }

  /* ---- Print ---- */
  document.getElementById('btnPrintReport').addEventListener('click', function() {
    window.print();
  });

  /* ---- PDF Export via pdfmake ---- */
  document.getElementById('btnPdfReport').addEventListener('click', function() {
    MSFG.Report.getItems().then(function(items) {
      if (items.length === 0) return;

      var content = [];

      // Title page header
      content.push({ text: 'MSFG Session Report', style: 'title' });
      content.push({ text: 'Generated ' + new Date().toLocaleString(), style: 'subtitle', margin: [0, 0, 0, 20] });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#2d6a4f' }], margin: [0, 0, 0, 10] });

      // Table of contents
      if (items.length > 1) {
        content.push({ text: 'Contents', style: 'tocTitle', margin: [0, 10, 0, 6] });
        var tocItems = items.map(function(item, idx) {
          return { text: (idx + 1) + '. ' + item.icon + '  ' + item.name, style: 'tocItem', margin: [0, 2, 0, 2] };
        });
        content.push({ ul: tocItems.map(function(t) { return t; }), margin: [0, 0, 0, 10] });
      }

      // Each calculator as a separate page
      items.forEach(function(item, idx) {
        content.push({ text: '', pageBreak: 'before' });
        content.push({ text: item.icon + '  ' + item.name, style: 'calcTitle' });
        content.push({ text: formatTime(item.timestamp), style: 'calcDate', margin: [0, 0, 0, 12] });
        content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 0, 0, 12] });

        if (item.version === 2 && item.data && item.slug && MSFG.ReportTemplates) {
          var pageContent = MSFG.ReportTemplates.pdfContent(item.slug, item.data);
          if (Array.isArray(pageContent)) {
            pageContent.forEach(function(node) { content.push(node); });
          }
        } else {
          content.push({ text: 'Legacy screenshot item — view in browser for best results.', italics: true, color: '#888888' });
        }
      });

      var docDefinition = {
        pageSize: 'LETTER',
        pageMargins: [40, 50, 40, 50],
        content: content,
        styles: {
          title: { fontSize: 22, bold: true, color: '#1a1a1a', font: 'Helvetica' },
          subtitle: { fontSize: 10, color: '#888888' },
          tocTitle: { fontSize: 14, bold: true, color: '#333333' },
          tocItem: { fontSize: 10, color: '#555555' },
          calcTitle: { fontSize: 16, bold: true, color: '#1a1a1a' },
          calcDate: { fontSize: 9, color: '#999999' },
          sectionTitle: { fontSize: 12, bold: true, color: '#333333' },
          tableHeader: { bold: true, fontSize: 9, color: '#666666', fillColor: '#f8f9fa' }
        },
        defaultStyle: { fontSize: 10, color: '#333333' },
        header: function(currentPage, pageCount) {
          if (currentPage === 1) return null;
          return { text: 'MSFG Session Report', alignment: 'right', fontSize: 8, color: '#bbbbbb', margin: [0, 20, 40, 0] };
        },
        footer: function(currentPage, pageCount) {
          return {
            columns: [
              { text: 'Confidential', fontSize: 8, color: '#bbbbbb', margin: [40, 0, 0, 0] },
              { text: 'Page ' + currentPage + ' of ' + pageCount, alignment: 'right', fontSize: 8, color: '#bbbbbb', margin: [0, 0, 40, 0] }
            ],
            margin: [0, 20, 0, 0]
          };
        }
      };

      pdfMake.createPdf(docDefinition).download('MSFG-Report-' + new Date().toISOString().slice(0, 10) + '.pdf');
    });
  });

  /* ---- Clear All ---- */
  document.getElementById('btnClearReport').addEventListener('click', function() {
    if (confirm('Remove all items from your report?')) {
      MSFG.Report.clear().then(function() {
        render();
      });
    }
  });

  render();
})();
