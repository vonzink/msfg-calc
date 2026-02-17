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
            '<img class="report-item__image" src="' + item.imageData + '" alt="' + item.name + ' snapshot">' +
          '</div>';
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

  document.getElementById('btnPrintReport').addEventListener('click', function() {
    window.print();
  });

  document.getElementById('btnPdfReport').addEventListener('click', function() {
    MSFG.Report.getItems().then(function(items) {
      if (items.length === 0) return;

      var jsPDF = window.jspdf.jsPDF;
      var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      var pageW = pdf.internal.pageSize.getWidth();
      var pageH = pdf.internal.pageSize.getHeight();
      var margin = 15;
      var usableW = pageW - margin * 2;
      var yPos = margin;

      pdf.setFontSize(18);
      pdf.setFont(undefined, 'bold');
      pdf.text('MSFG Session Report', margin, yPos + 6);
      yPos += 14;
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(120);
      pdf.text('Generated ' + new Date().toLocaleString(), margin, yPos);
      pdf.setTextColor(0);
      yPos += 10;

      var pending = items.length;
      var loaded = 0;

      items.forEach(function(item) {
        var img = new Image();
        img.onload = function() {
          item._img = img;
          item._w = img.naturalWidth;
          item._h = img.naturalHeight;
          loaded++;
          if (loaded === pending) buildPdf();
        };
        img.onerror = function() {
          item._img = null;
          loaded++;
          if (loaded === pending) buildPdf();
        };
        img.src = item.imageData;
      });

      function buildPdf() {
        items.forEach(function(item, idx) {
          if (idx > 0) { pdf.addPage(); yPos = margin; }

          pdf.setFontSize(12);
          pdf.setFont(undefined, 'bold');
          pdf.text(item.icon + '  ' + item.name, margin, yPos + 4);
          yPos += 7;
          pdf.setFontSize(8);
          pdf.setFont(undefined, 'normal');
          pdf.setTextColor(100);
          pdf.text(formatTime(item.timestamp), margin, yPos + 2);
          pdf.setTextColor(0);
          yPos += 8;

          if (item._img) {
            var ratio = item._w / item._h;
            var imgW = usableW;
            var imgH = imgW / ratio;
            var maxH = pageH - yPos - margin;
            if (imgH > maxH) {
              imgH = maxH;
              imgW = imgH * ratio;
            }
            pdf.addImage(item._img, 'JPEG', margin, yPos, imgW, imgH);
          }
        });

        pdf.save('MSFG-Report-' + new Date().toISOString().slice(0, 10) + '.pdf');
      }
    });
  });

  document.getElementById('btnClearReport').addEventListener('click', function() {
    if (confirm('Remove all items from your report?')) {
      MSFG.Report.clear().then(function() {
        render();
      });
    }
  });

  render();
})();
