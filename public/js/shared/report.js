/* =====================================================
   MSFG Report Manager
   Captures calculator snapshots and manages session report.
   Uses IndexedDB for storage (much larger capacity than localStorage).

   Works in two modes:
   - EJS pages: auto-injects "Add to Report" button into .calc-page__header
   - Standalone pages: adds fixed-position floating button (LLPM, MISMO, etc.)
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

  /* ---- Enforce max items ---- */
  function enforceMax() {
    return dbGetAll().then(function(items) {
      if (items.length <= MAX_ITEMS) return;
      var toRemove = items.slice(0, items.length - MAX_ITEMS);
      var promises = toRemove.map(function(item) { return dbDelete(item.id); });
      return Promise.all(promises);
    });
  }

  /* ---- Generate unique ID ---- */
  function generateId() {
    return 'rpt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  }

  /* ---- Shared toast notification ---- */
  function showToast(message, type) {
    // If CSS-based toast class exists (EJS pages), use it
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
      // Inline-styled toast for standalone pages
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

  /* ---- Lazy-load html2canvas if needed ---- */
  function ensureHtml2Canvas() {
    if (typeof html2canvas !== 'undefined') return Promise.resolve();
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.integrity = 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H';
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = function() { reject(new Error('Failed to load html2canvas')); };
      document.head.appendChild(s);
    });
  }

  /* ---- Public API ---- */
  MSFG.Report = {

    getItems: function() {
      return dbGetAll();
    },

    addItem: function(item) {
      var newItem = {
        id: generateId(),
        name: item.name || 'Calculator',
        icon: item.icon || '',
        timestamp: new Date().toISOString(),
        imageData: item.imageData || ''
      };
      var self = this;
      return dbPut(newItem).then(function() {
        return enforceMax();
      }).then(function() {
        self._updateBadge();
        return newItem.id;
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

    _updateBadge: function() {
      var badge = document.getElementById('reportBadge');
      if (!badge) return;
      dbCount().then(function(count) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      });
    },

    _showToast: showToast,

    captureElement: function(element, options) {
      options = options || {};
      return ensureHtml2Canvas().then(function() {
        return html2canvas(element, {
          useCORS: true,
          allowTaint: true,
          scale: options.scale || 1,
          backgroundColor: '#ffffff',
          logging: false
        });
      }).then(function(canvas) {
        return canvas.toDataURL('image/jpeg', options.quality || 0.5);
      });
    },

    captureCurrentCalculator: function(calcName, calcIcon) {
      var self = this;
      var target = null;
      var iframe = document.querySelector('.calc-page__body iframe');

      if (iframe) {
        try {
          var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          if (iframeDoc && iframeDoc.body) {
            target = iframeDoc.body;
          }
        } catch (e) { /* cross-origin fallback */ }
      }

      if (!target) {
        target = document.querySelector('.calc-page__body') ||
                 document.querySelector('.calc-page') ||
                 document.querySelector('.container, .main-container, main') ||
                 document.querySelector('.site-main');
      }

      if (!target) {
        return Promise.reject(new Error('No capturable content found'));
      }

      return self.captureElement(target).then(function(imageData) {
        return self.addItem({ name: calcName, icon: calcIcon, imageData: imageData });
      }).then(function() {
        showToast('Added to report');
      }).catch(function(err) {
        console.error('Report save failed:', err);
        showToast('Failed to save — try again', 'error');
        throw err;
      });
    }
  };

  /* ---- SVG icons (shared between button modes) ---- */
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

    // Skip in embed mode or when inside a workspace iframe
    if (window.location.search.indexOf('embed=1') !== -1) return;
    if (window.top !== window && !document.querySelector('.calc-page__header')) return;

    var calcHeader = document.querySelector('.calc-page__header');

    if (calcHeader) {
      // ---- EJS page mode ----
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

    } else if (window.top === window && !document.querySelector('.workspace')) {
      // ---- Standalone page mode (LLPM, Batch LLPM, MISMO) ----
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
