'use strict';

/* =====================================================
   Shared Income Upload Module
   — Upload zone, doc store, doc cards, file processing
   — Used by all income calculators
   ===================================================== */

var IncomeUpload = (function () {

  // ---- state ----
  var docStore = [];
  var _cfg = {};

  // ---- public: init ----
  function init(config) {
    /*  config = {
          slug:            'income-1040',           // API slug
          label:           '1040',                  // shown in "Analyzing <label>..."
          maxDocs:         2,                       // 1 for rental-1038
          buildCardBody:   function (doc, i) {},    // returns inner HTML for card
          onProcessed:     function (data) {},       // called after successful extract (before render)
          onAfterSync:     function () {},           // called after renderDocCards + field sync
          onRemove:        function () {}            // called after doc removed
        }
    */
    _cfg = config || {};
    if (!_cfg.maxDocs) _cfg.maxDocs = 2;
    initUploadZone();
  }

  // ---- upload zone ----
  var validateFile = MSFG.FileUpload.validateFile;
  var setZoneStatus = MSFG.FileUpload.setZoneStatus;

  function initUploadZone() {
    var zone = document.querySelector('.upload-zone');
    if (!zone) return;

    var fileInput = zone.querySelector('.upload-zone__input');
    var statusEl  = zone.querySelector('.upload-zone__status');

    MSFG.FileUpload.initDropZone(zone, fileInput, function(file) {
      processFile(file, zone, statusEl);
    });
  }

  // ---- file processing ----
  function processFile(file, zone, statusEl) {
    if (!validateFile(file)) {
      setZoneStatus(zone, statusEl, 'error', 'Unsupported file type. Use PNG, JPG, WebP, or PDF.');
      zone.classList.add('has-error');
      return;
    }

    if (docStore.length >= _cfg.maxDocs) {
      var maxMsg = _cfg.maxDocs === 1
        ? 'Maximum 1 upload. Remove the existing one first.'
        : 'Maximum ' + _cfg.maxDocs + ' returns (one per year). Remove one first.';
      setZoneStatus(zone, statusEl, 'error', maxMsg);
      zone.classList.add('has-error');
      return;
    }

    var label = _cfg.label || 'document';
    setZoneStatus(zone, statusEl, 'loading', '<span class="spinner"></span> Analyzing ' + label + '...');
    zone.classList.add('processing');
    zone.classList.remove('has-error');

    var formData = new FormData();
    formData.append('file', file);
    formData.append('slug', _cfg.slug);

    var fileInput = zone.querySelector('.upload-zone__input');

    fetch('/api/ai/extract', { method: 'POST', body: formData })
      .then(function (resp) { return resp.json(); })
      .then(function (result) {
        zone.classList.remove('processing');

        if (!result.success || !result.data) {
          setZoneStatus(zone, statusEl, 'error', result.message || 'AI extraction failed.');
          zone.classList.add('has-error');
          return;
        }

        var data = result.data;
        data.id = 'doc_' + Date.now();

        // Let calculator do custom pre-processing if needed
        if (_cfg.onProcessed) _cfg.onProcessed(data);

        if (_cfg.maxDocs === 1) {
          // Single-doc mode (e.g. rental-1038)
          docStore = [data];
        } else {
          // Multi-doc mode: replace same tax year, sort descending
          docStore = docStore.filter(function (d) { return d.taxYear !== data.taxYear; });
          docStore.push(data);
          docStore.sort(function (a, b) { return (b.taxYear || 0) - (a.taxYear || 0); });
        }

        renderDocCards();
        if (_cfg.onAfterSync) _cfg.onAfterSync();

        var msg;
        if (_cfg.maxDocs === 1) {
          msg = label + ' data loaded successfully.';
        } else {
          msg = docStore.length + ' return(s) loaded.';
          if (docStore.length < _cfg.maxDocs) msg += ' Upload another year for 2-year analysis.';
        }
        setZoneStatus(zone, statusEl, 'success', msg);
        zone.classList.add('has-data');
        zone.classList.remove('has-error');

        if (fileInput) fileInput.value = '';
      })
      .catch(function (err) {
        zone.classList.remove('processing');
        setZoneStatus(zone, statusEl, 'error', 'Network error: ' + err.message);
        zone.classList.add('has-error');
      });
  }

  // ---- document cards ----
  function renderDocCards() {
    var container = document.getElementById('docCards');
    if (!container) return;
    container.innerHTML = '';

    if (docStore.length === 0) return;

    docStore.forEach(function (doc, i) {
      var card = document.createElement('div');
      card.className = 'doc-card';

      var html = '';

      if (_cfg.buildCardBody) {
        html = _cfg.buildCardBody(doc, i);
      } else {
        // Fallback: simple year + remove
        html += '<div class="doc-card__header">';
        html += '<span class="doc-card__year">' + (doc.taxYear || '?') + '</span>';
        html += '<button class="doc-card__remove" type="button" title="Remove" data-doc-id="' + doc.id + '">&times;</button>';
        html += '</div>';
      }

      card.innerHTML = html;
      container.appendChild(card);
    });

    // Bind remove buttons
    container.querySelectorAll('.doc-card__remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeDoc(btn.getAttribute('data-doc-id'));
      });
    });
  }

  function removeDoc(docId) {
    docStore = docStore.filter(function (d) { return d.id !== docId; });
    renderDocCards();
    if (_cfg.onRemove) _cfg.onRemove();

    // Update upload zone
    var zone = document.querySelector('.upload-zone');
    var statusEl = zone ? zone.querySelector('.upload-zone__status') : null;
    if (zone && statusEl) {
      if (docStore.length === 0) {
        zone.classList.remove('has-data', 'has-error');
        setZoneStatus(zone, statusEl, '', '');
      } else {
        setZoneStatus(zone, statusEl, 'success', docStore.length + ' return(s) loaded.');
      }
    }
  }

  // ---- utilities ----
  var escHtml = MSFG.escHtml;

  /** Helper: build the year-badge HTML for multi-doc cards */
  function yearBadge(i) {
    if (docStore.length <= 1) return '';
    if (i === 0) {
      return '<span class="doc-card__badge">Year 1 (Most Recent)</span>';
    }
    return '<span class="doc-card__badge doc-card__badge--secondary">Year 2 (Prior)</span>';
  }

  /** Reset the upload zone UI (used by clearAll in each calculator) */
  function resetZone() {
    var zone = document.querySelector('.upload-zone');
    if (!zone) return;
    zone.classList.remove('has-data', 'has-error');
    var statusEl = zone.querySelector('.upload-zone__status');
    if (statusEl) {
      statusEl.className = 'upload-zone__status';
      statusEl.innerHTML = '';
    }
    var fileInput = zone.querySelector('.upload-zone__input');
    if (fileInput) fileInput.value = '';
  }

  // ---- public API ----
  return {
    init:           init,
    getDocStore:    function () { return docStore; },
    setDocStore:    function (arr) { docStore = arr; },
    renderDocCards: renderDocCards,
    resetZone:      resetZone,
    escHtml:        escHtml,
    yearBadge:      yearBadge
  };

})();
