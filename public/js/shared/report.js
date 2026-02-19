/* =====================================================
   MSFG Report Manager
   Captures structured calculator data for session reports.
   Uses IndexedDB for storage.

   Data format (v2):
     { id, name, icon, slug, timestamp, data: {...}, version: 2 }

   Legacy format (v1) still supported for backward compat:
     { id, name, icon, timestamp, imageData }
   ===================================================== */

(function() {
  'use strict';

  var DB_NAME = 'msfg-report';
  var STORE_NAME = 'items';
  var DB_VERSION = 1;
  var MAX_ITEMS = 30;
  var _db = null;
  var _ready = null;

  window.MSFG = window.MSFG || {};

  /* ---- IndexedDB setup ---- */
  function openDB() {
    if (_ready) return _ready;
    _ready = new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = function(e) {
        _db = e.target.result;
        resolve(_db);
      };
      req.onerror = function() {
        console.warn('IndexedDB unavailable, report will not persist.');
        reject(req.error);
      };
    });
    return _ready;
  }

  function dbGetAll() {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.getAll();
        req.onsuccess = function() {
          var items = req.result || [];
          items.sort(function(a, b) {
            var aOrd = typeof a.order === 'number' ? a.order : Infinity;
            var bOrd = typeof b.order === 'number' ? b.order : Infinity;
            if (aOrd !== bOrd) return aOrd - bOrd;
            return new Date(a.timestamp) - new Date(b.timestamp);
          });
          resolve(items);
        };
        req.onerror = function() { reject(req.error); };
      });
    }).catch(function() { return []; });
  }

  function dbPut(item) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        store.put(item);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }

  function dbDelete(id) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }

  function dbClear() {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }

  function dbCount() {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.count();
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      });
    }).catch(function() { return 0; });
  }

  function enforceMax() {
    return dbGetAll().then(function(items) {
      if (items.length <= MAX_ITEMS) return;
      var toRemove = items.slice(0, items.length - MAX_ITEMS);
      var promises = toRemove.map(function(item) { return dbDelete(item.id); });
      return Promise.all(promises);
    });
  }

  function generateId() {
    return 'rpt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  }

  /* ---- Shared toast notification ---- */
  function showToast(message, type) {
    var hasToastCSS = !!document.querySelector('link[href*="components.css"]');
    var toast = document.createElement('div');

    if (hasToastCSS) {
      toast.className = 'report-toast report-toast--' + (type || 'success');
      toast.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
        '<span>' + message + '</span>';
      document.body.appendChild(toast);
      requestAnimationFrame(function() { toast.classList.add('show'); });
      setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 300);
      }, 2500);
    } else {
      toast.style.cssText =
        'position:fixed;bottom:24px;right:24px;display:flex;align-items:center;gap:8px;' +
        'padding:12px 20px;background:' + (type === 'error' ? '#dc3545' : '#2d6a4f') + ';color:#fff;' +
        'font-size:.88rem;font-weight:500;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);' +
        'z-index:10000;transform:translateY(20px);opacity:0;transition:all .3s ease;pointer-events:none;';
      toast.textContent = message;
      document.body.appendChild(toast);
      requestAnimationFrame(function() { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; });
      setTimeout(function() {
        toast.style.transform = 'translateY(20px)'; toast.style.opacity = '0';
        setTimeout(function() { toast.remove(); }, 300);
      }, 2500);
    }
  }

  /* ---- Resolve the deepest calculator document from a base document ---- */
  function resolveCalcDocument(baseDoc) {
    var iframe = baseDoc.querySelector('.calc-page__body iframe') || baseDoc.querySelector('iframe');
    if (iframe) {
      try {
        var nested = iframe.contentDocument || iframe.contentWindow.document;
        if (nested && nested.body) return nested;
      } catch (e) { /* cross-origin */ }
    }
    return baseDoc;
  }

  /* ---- Public API ---- */
  MSFG.Report = {

    getItems: function() {
      return dbGetAll();
    },

    addItem: function(item) {
      var self = this;
      return dbGetAll().then(function(items) {
        var maxOrder = 0;
        items.forEach(function(it) {
          if (typeof it.order === 'number' && it.order > maxOrder) maxOrder = it.order;
        });

        var isCoverLetter = (item.slug === 'loan-analysis');
        var newOrder;
        var bumpPromises = [];

        if (isCoverLetter) {
          // Cover letter always goes to position 0 (first)
          newOrder = 0;
          // Bump all existing items' order up by 1 so nothing collides
          items.forEach(function(it) {
            if (typeof it.order === 'number') {
              it.order = it.order + 1;
            } else {
              it.order = maxOrder + 2;
            }
            bumpPromises.push(dbPut(it));
          });
        } else {
          newOrder = maxOrder + 1;
        }

        var newItem = {
          id: generateId(),
          name: item.name || 'Calculator',
          icon: item.icon || '',
          slug: item.slug || '',
          timestamp: new Date().toISOString(),
          data: item.data || null,
          imageData: item.imageData || null,
          version: item.data ? 2 : 1,
          order: newOrder
        };

        return Promise.all(bumpPromises).then(function() {
          return dbPut(newItem);
        }).then(function() {
          return enforceMax();
        }).then(function() {
          self._updateBadge();
          return newItem.id;
        });
      });
    },

    removeItem: function(id) {
      var self = this;
      return dbDelete(id).then(function() {
        self._updateBadge();
      });
    },

    clear: function() {
      var self = this;
      return dbClear().then(function() {
        self._updateBadge();
      });
    },

    getCount: function() {
      return dbCount();
    },

    reorderItems: function(orderedIds) {
      return dbGetAll().then(function(items) {
        var byId = {};
        items.forEach(function(item) { byId[item.id] = item; });
        var promises = [];
        orderedIds.forEach(function(id, idx) {
          if (byId[id]) {
            byId[id].order = idx + 1;
            promises.push(dbPut(byId[id]));
          }
        });
        return Promise.all(promises);
      });
    },

    _updateBadge: function() {
      var badge = document.getElementById('reportBadge');
      if (!badge) return;
      dbCount().then(function(count) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      });
    },

    _showToast: showToast,

    /**
     * Capture structured data from a calculator and add to report.
     * @param {string} slug - calculator slug (e.g. "income/1040")
     * @param {string} calcName - display name
     * @param {string} calcIcon - emoji icon
     * @param {Document} baseDoc - document containing the calculator (page doc or iframe doc)
     */
    captureStructured: function(slug, calcName, calcIcon, baseDoc) {
      var self = this;

      if (!MSFG.ReportTemplates || !MSFG.ReportTemplates.extractors[slug]) {
        showToast('No report template for this calculator', 'error');
        return Promise.reject(new Error('No extractor for: ' + slug));
      }

      var calcDoc = resolveCalcDocument(baseDoc);
      var data = MSFG.ReportTemplates.extract(slug, calcDoc);

      if (!data) {
        showToast('Could not extract data', 'error');
        return Promise.reject(new Error('Extraction returned null'));
      }

      return self.addItem({
        name: calcName,
        icon: calcIcon,
        slug: slug,
        data: data
      }).then(function() {
        showToast('Added to report');
      }).catch(function(err) {
        console.error('Report save failed:', err);
        showToast('Failed to save — try again', 'error');
        throw err;
      });
    },

    /**
     * Capture from the current standalone page.
     */
    captureCurrentCalculator: function(calcName, calcIcon) {
      var slug = window.__calcSlug || '';

      if (slug && MSFG.ReportTemplates && MSFG.ReportTemplates.extractors[slug]) {
        var baseDoc = document;
        return this.captureStructured(slug, calcName, calcIcon, baseDoc);
      }

      showToast('No report template available', 'error');
      return Promise.reject(new Error('No extractor available for slug: ' + slug));
    }
  };

  /* ---- SVG icons ---- */
  var SVG_ADD =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
      '<polyline points="14 2 14 8 20 8"/>' +
      '<line x1="12" y1="18" x2="12" y2="12"/>' +
      '<line x1="9" y1="15" x2="15" y2="15"/>' +
    '</svg>';

  var SVG_CHECK =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
      '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' +
    '</svg>';

  var SVG_SPINNER =
    '<svg class="report-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
      '<circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" stroke-dashoffset="0"/>' +
    '</svg>';

  /* ---- Shared click handler ---- */
  function handleReportClick(btn, calcName, calcIcon, defaultContent, isStandalone) {
    btn.disabled = true;
    if (isStandalone) {
      btn.style.opacity = '0.7';
      btn.innerHTML = 'Capturing...';
    } else {
      btn.innerHTML = SVG_SPINNER;
    }

    MSFG.Report.captureCurrentCalculator(calcName, calcIcon).then(function() {
      btn.disabled = false;
      if (isStandalone) {
        btn.style.opacity = '1';
        btn.innerHTML = SVG_CHECK.replace('width="16"', 'width="14"').replace('height="16"', 'height="14"') + ' Added!';
      } else {
        btn.innerHTML = SVG_CHECK;
        btn.style.color = 'var(--brand-primary)';
        btn.style.borderColor = 'var(--brand-primary)';
      }
      setTimeout(function() {
        btn.innerHTML = defaultContent;
        if (!isStandalone) {
          btn.style.color = '';
          btn.style.borderColor = '';
        }
      }, 1500);
    }).catch(function() {
      btn.disabled = false;
      if (isStandalone) btn.style.opacity = '1';
      btn.innerHTML = defaultContent;
    });
  }

  /* ---- Auto-inject button on DOMContentLoaded ---- */
  document.addEventListener('DOMContentLoaded', function() {
    MSFG.Report._updateBadge();

    if (window.location.search.indexOf('embed=1') !== -1) return;
    if (window.top !== window && !document.querySelector('.calc-page__header')) return;

    var calcHeader = document.querySelector('.calc-page__header');

    if (calcHeader) {
      var h1 = calcHeader.querySelector('h1');
      var calcName = h1 ? h1.textContent.trim() : document.title;
      var calcIcon = (typeof window.__calcIcon !== 'undefined') ? window.__calcIcon : '';

      var btn = document.createElement('button');
      btn.className = 'report-add-btn';
      btn.title = 'Add to Report';
      var defaultContent = SVG_ADD;
      btn.innerHTML = defaultContent;

      btn.addEventListener('click', function() {
        handleReportClick(btn, calcName, calcIcon, defaultContent, false);
      });

      var headerWrapper = document.createElement('div');
      headerWrapper.className = 'calc-page__header-actions';
      headerWrapper.appendChild(btn);
      calcHeader.appendChild(headerWrapper);

    } else if (window.top === window && !document.querySelector('.workspace') && window.__calcSlug) {
      var name = document.title.replace(/\s*[-|].*$/, '').trim() || 'Tool';
      var iconMeta = document.querySelector('meta[name="calc-icon"]');
      var icon = iconMeta ? iconMeta.getAttribute('content') : '';

      var sBtn = document.createElement('button');
      sBtn.id = 'reportAddBtnStandalone';
      sBtn.title = 'Add to Report';
      sBtn.style.cssText =
        'position:fixed;bottom:24px;left:24px;display:inline-flex;align-items:center;gap:6px;' +
        'padding:10px 18px;background:#2d6a4f;color:#fff;border:none;border-radius:10px;' +
        'font-size:.85rem;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.15);' +
        'z-index:9999;transition:all .2s ease;font-family:Inter,system-ui,sans-serif;';
      var sDefault = SVG_ADD.replace('width="16"', 'width="14"').replace('height="16"', 'height="14"') + ' Add to Report';
      sBtn.innerHTML = sDefault;

      sBtn.addEventListener('mouseenter', function() { sBtn.style.background = '#245a40'; });
      sBtn.addEventListener('mouseleave', function() { sBtn.style.background = '#2d6a4f'; });

      sBtn.addEventListener('click', function() {
        handleReportClick(sBtn, name, icon, sDefault, true);
      });

      document.body.appendChild(sBtn);
    }
  });
})();
