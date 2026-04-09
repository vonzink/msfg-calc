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
    const el = doc.getElementById(id);
    if (!el) return 0;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return parseFloat(el.value) || 0;
    return parseFloat((el.textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
  }
  function txt(doc, id) {
    const el = doc.getElementById(id);
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
    let html = '';
    let hasData = false;
    (data.sections || []).forEach(function (sec) {
      const sectionHasData = sec.rows && sec.rows.some(function (r) { return r.y1 || r.y2; });
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

  /* Shared ultra-tight table layout — 1pt padding, minimal lines */
  const TIGHT = {
    hLineWidth: function(i, node) { return (i === 0 || i === node.table.body.length) ? 0 : 0.4; },
    vLineWidth: function() { return 0; },
    hLineColor: function() { return '#dee2e6'; },
    paddingLeft: function() { return 3; },
    paddingRight: function() { return 3; },
    paddingTop: function() { return 1; },
    paddingBottom: function() { return 1; }
  };

  function pdfIncomeTable(data) {
    const content = [];
    (data.sections || []).forEach(function (sec) {
      const sectionHasData = sec.rows && sec.rows.some(function (r) { return r.y1 || r.y2; });
      if (!sectionHasData && !sec.monthly) return;
      content.push({ text: sec.title + (sec.ownership ? ' (' + sec.ownership + '% ownership)' : ''), style: 'sectionTitle', margin: [0, 3, 0, 1] });
      const body = [
        [{ text: 'Line Item', style: 'tableHeader' }, { text: 'Year 1', style: 'tableHeader', alignment: 'right' }, { text: 'Year 2', style: 'tableHeader', alignment: 'right' }]
      ];
      sec.rows.forEach(function (r) {
        if (!r.y1 && !r.y2) return;
        body.push([{ text: r.label, fontSize: 7.5 }, { text: fmt(r.y1), fontSize: 7.5, alignment: 'right' }, { text: fmt(r.y2), fontSize: 7.5, alignment: 'right' }]);
      });
      content.push({ table: { headerRows: 1, widths: ['auto', 65, 65], body: body }, layout: TIGHT, margin: [0, 0, 0, 1] });
      if (sec.monthly !== undefined) {
        content.push({ columns: [{ text: 'Monthly Income', bold: true, fontSize: 8 }, { text: fmt(sec.monthly), alignment: 'right', bold: true, fontSize: 8 }], margin: [0, 1, 0, 0] });
      }
    });
    if (data.totalMonthly !== undefined) {
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 532, y2: 0, lineWidth: 0.75, lineColor: '#2d6a4f' }], margin: [0, 2, 0, 1] });
      content.push({ columns: [{ text: 'TOTAL MONTHLY INCOME', bold: true, fontSize: 8.5, color: '#2d6a4f' }, { text: fmt(data.totalMonthly), alignment: 'right', bold: true, fontSize: 8.5, color: '#2d6a4f' }] });
    }
    return content;
  }

  function pdfKeyValue(data, paramsList, resultsList, grandTotalLabel, grandTotalKey) {
    const content = [];
    if (paramsList && paramsList.length && resultsList && resultsList.length) {
      /* Side-by-side 2-column layout — auto label width keeps values close */
      const pBody = paramsList.map(function (p) {
        return [{ text: p[0], fontSize: 7.5, color: '#6c757d' }, { text: String(p[1]), fontSize: 7.5, alignment: 'right' }];
      });
      const rBody = [[{ text: 'Result', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }]];
      resultsList.forEach(function (r) { rBody.push([{ text: r[0], fontSize: 7.5 }, { text: String(r[1]), fontSize: 7.5, alignment: 'right' }]); });
      content.push({
        columns: [
          {
            width: '48%',
            stack: [
              { text: 'Parameters', style: 'sectionTitle', margin: [0, 0, 0, 1] },
              { table: { widths: ['auto', '*'], body: pBody }, layout: TIGHT }
            ]
          },
          { width: '4%', text: '' },
          {
            width: '48%',
            stack: [
              { text: 'Results', style: 'sectionTitle', margin: [0, 0, 0, 1] },
              { table: { headerRows: 1, widths: ['auto', '*'], body: rBody }, layout: TIGHT }
            ]
          }
        ],
        columnGap: 0,
        margin: [0, 0, 0, 3]
      });
    } else {
      if (paramsList && paramsList.length) {
        const pBody = paramsList.map(function (p) {
          return [{ text: p[0], fontSize: 7.5, color: '#6c757d' }, { text: String(p[1]), fontSize: 7.5, alignment: 'right' }];
        });
        content.push({ text: 'Parameters', style: 'sectionTitle', margin: [0, 1, 0, 1] });
        content.push({ table: { widths: ['auto', '*'], body: pBody }, layout: TIGHT, margin: [0, 0, 0, 3] });
      }
      if (resultsList && resultsList.length) {
        const rBody = [[{ text: 'Result', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }]];
        resultsList.forEach(function (r) { rBody.push([{ text: r[0], fontSize: 7.5 }, { text: String(r[1]), fontSize: 7.5, alignment: 'right' }]); });
        content.push({ text: 'Results', style: 'sectionTitle', margin: [0, 2, 0, 1] });
        content.push({ table: { headerRows: 1, widths: ['auto', '*'], body: rBody }, layout: TIGHT, margin: [0, 0, 0, 3] });
      }
    }
    return content;
  }

  /* ---- registry ---- */
  const extractors = {};
  const renderers = {};
  const pdfGenerators = {};

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
      const fn = extractors[slug];
      return fn ? fn(doc) : null;
    },
    render: function (slug, data) {
      const fn = renderers[slug];
      return fn ? fn(data) : '<p class="rpt-no-template">No report template available for this calculator.</p>';
    },
    pdfContent: function (slug, data) {
      const fn = pdfGenerators[slug];
      return fn ? fn(data) : [{ text: 'No PDF template available.', italics: true }];
    },
    register: register,
    registerIncomeType: registerIncomeType,
    helpers: {
      val: val, txt: txt, fmt: fmt, fmt0: fmt0,
      pct: pct, ratePct: ratePct, methodLabel: methodLabel,
      renderIncomeTable: renderIncomeTable,
      pdfIncomeTable: pdfIncomeTable,
      pdfKeyValue: pdfKeyValue,
      TIGHT: TIGHT
    }
  };
})();
