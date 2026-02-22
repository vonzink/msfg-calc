/* =====================================================
   MSFG Report Templates — Core
   Helpers, shared renderers, registration API.
   Per-calculator templates live in report-templates/*.js
   ===================================================== */
(function () {
  'use strict';
  window.MSFG = window.MSFG || {};

  /* ---- helpers ---- */
  function val(doc, id) {
    var el = doc.getElementById(id);
    if (!el) return 0;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return parseFloat(el.value) || 0;
    return parseFloat((el.textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
  }
  function txt(doc, id) {
    var el = doc.getElementById(id);
    return el ? (el.value !== undefined && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') ? el.value : el.textContent || '').trim() : '';
  }
  function fmt(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }
  function fmt0(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  }
  function pct(n) { return n.toFixed(2) + '%'; }
  function ratePct(n) { return parseFloat(n).toFixed(3) + '%'; }

  /* ---- income averaging policy label ---- */
  function methodLabel(y1, y2) {
    if (y2 !== 0 && y1 > y2) return '24-mo avg';
    return 'Recent ÷ 12';
  }

  /* ---- shared income renderers ---- */
  function renderIncomeTable(data, calcName) {
    var html = '';
    var hasData = false;
    (data.sections || []).forEach(function (sec) {
      var sectionHasData = sec.rows && sec.rows.some(function (r) { return r.y1 || r.y2; });
      if (!sectionHasData && !sec.monthly) return;
      hasData = true;
      html += '<div class="rpt-section">';
      html += '<h4 class="rpt-section-title">' + sec.title;
      if (sec.ownership) html += ' <span class="rpt-ownership">(' + sec.ownership + '% ownership)</span>';
      html += '</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Line Item</th><th class="rpt-num">Year 1</th><th class="rpt-num">Year 2</th></tr></thead><tbody>';
      sec.rows.forEach(function (r) {
        if (!r.y1 && !r.y2) return;
        html += '<tr><td>' + r.label + '</td><td class="rpt-num">' + fmt(r.y1) + '</td><td class="rpt-num">' + fmt(r.y2) + '</td></tr>';
      });
      html += '</tbody></table>';
      if (sec.monthly !== undefined) {
        html += '<div class="rpt-subtotal"><span>Monthly Income</span><span>' + fmt(sec.monthly) + '</span></div>';
      }
      html += '</div>';
    });
    if (data.totalMonthly !== undefined) {
      html += '<div class="rpt-grand-total"><span>Total Monthly Income</span><span>' + fmt(data.totalMonthly) + '</span></div>';
    }
    return html;
  }

  function pdfIncomeTable(data) {
    var content = [];
    (data.sections || []).forEach(function (sec) {
      var sectionHasData = sec.rows && sec.rows.some(function (r) { return r.y1 || r.y2; });
      if (!sectionHasData && !sec.monthly) return;
      content.push({ text: sec.title + (sec.ownership ? ' (' + sec.ownership + '% ownership)' : ''), style: 'sectionTitle', margin: [0, 8, 0, 4] });
      var body = [
        [{ text: 'Line Item', style: 'tableHeader' }, { text: 'Year 1', style: 'tableHeader', alignment: 'right' }, { text: 'Year 2', style: 'tableHeader', alignment: 'right' }]
      ];
      sec.rows.forEach(function (r) {
        if (!r.y1 && !r.y2) return;
        body.push([r.label, { text: fmt(r.y1), alignment: 'right' }, { text: fmt(r.y2), alignment: 'right' }]);
      });
      content.push({ table: { headerRows: 1, widths: ['*', 90, 90], body: body }, layout: 'lightHorizontalLines' });
      if (sec.monthly !== undefined) {
        content.push({ columns: [{ text: 'Monthly Income', bold: true }, { text: fmt(sec.monthly), alignment: 'right', bold: true }], margin: [0, 4, 0, 0] });
      }
    });
    if (data.totalMonthly !== undefined) {
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#2d6a4f' }], margin: [0, 10, 0, 4] });
      content.push({ columns: [{ text: 'TOTAL MONTHLY INCOME', bold: true, fontSize: 12, color: '#2d6a4f' }, { text: fmt(data.totalMonthly), alignment: 'right', bold: true, fontSize: 12, color: '#2d6a4f' }] });
    }
    return content;
  }

  function pdfKeyValue(data, paramsList, resultsList, grandTotalLabel, grandTotalKey) {
    var content = [];
    if (paramsList && paramsList.length) {
      var pBody = paramsList.map(function (p) { return [p[0], { text: String(p[1]), alignment: 'right' }]; });
      content.push({ text: 'Parameters', style: 'sectionTitle', margin: [0, 4, 0, 4] });
      content.push({ table: { widths: ['*', 120], body: pBody }, layout: 'noBorders' });
    }
    if (resultsList && resultsList.length) {
      var rBody = [[{ text: 'Result', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }]];
      resultsList.forEach(function (r) { rBody.push([r[0], { text: String(r[1]), alignment: 'right' }]); });
      content.push({ text: 'Results', style: 'sectionTitle', margin: [0, 10, 0, 4] });
      content.push({ table: { headerRows: 1, widths: ['*', 120], body: rBody }, layout: 'lightHorizontalLines' });
    }
    return content;
  }

  /* ---- registry ---- */
  var extractors = {};
  var renderers = {};
  var pdfGenerators = {};

  function register(slug, ext, rend, pdf) {
    if (ext) extractors[slug] = ext;
    if (rend) renderers[slug] = rend;
    if (pdf) pdfGenerators[slug] = pdf;
  }

  function registerIncomeType(slug, extractor) {
    extractors[slug] = extractor;
    renderers[slug] = function (data) { return renderIncomeTable(data, slug); };
    pdfGenerators[slug] = pdfIncomeTable;
  }

  /* ---- Public API ---- */
  MSFG.ReportTemplates = {
    extractors: extractors,
    renderers: renderers,
    pdfGenerators: pdfGenerators,
    extract: function (slug, doc) {
      var fn = extractors[slug];
      return fn ? fn(doc) : null;
    },
    render: function (slug, data) {
      var fn = renderers[slug];
      return fn ? fn(data) : '<p class="rpt-no-template">No report template available for this calculator.</p>';
    },
    pdfContent: function (slug, data) {
      var fn = pdfGenerators[slug];
      return fn ? fn(data) : [{ text: 'No PDF template available.', italics: true }];
    },
    register: register,
    registerIncomeType: registerIncomeType,
    helpers: {
      val: val, txt: txt, fmt: fmt, fmt0: fmt0,
      pct: pct, ratePct: ratePct, methodLabel: methodLabel,
      renderIncomeTable: renderIncomeTable,
      pdfIncomeTable: pdfIncomeTable,
      pdfKeyValue: pdfKeyValue
    }
  };
})();
