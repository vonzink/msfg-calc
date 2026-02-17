/* =====================================================
   MSFG Report Manager
   Captures calculator snapshots and manages session report
   Uses IndexedDB for storage (much larger capacity than localStorage)
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

  /* ---- Public API ---- */
  MSFG.Report = {

    getItems: function() {
      return dbGetAll();
    },

    addItem: function(item) {
      var newItem = {
        id: 'rpt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
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

    captureElement: function(element, options) {
      options = options || {};
      if (typeof html2canvas === 'undefined') {
        return Promise.reject(new Error('html2canvas not loaded'));
      }
      return html2canvas(element, {
        useCORS: true,
        allowTaint: true,
        scale: options.scale || 1,
        backgroundColor: '#ffffff',
        logging: false
      }).then(function(canvas) {
        return canvas.toDataURL('image/jpeg', options.quality || 0.5);
      });
    },

    _showToast: function(message, type) {
      var toast = document.createElement('div');
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
                 document.querySelector('.site-main');
      }

      if (!target) {
        return Promise.reject(new Error('No capturable content found'));
      }

      return self.captureElement(target).then(function(imageData) {
        return self.addItem({ name: calcName, icon: calcIcon, imageData: imageData });
      }).then(function() {
        self._showToast('Added to report');
      }).catch(function(err) {
        console.error('Report save failed:', err);
        self._showToast('Failed to save — try again', 'error');
        throw err;
      });
    }
  };

  /* ---- Auto-inject "Add to Report" button on calculator pages ---- */
  document.addEventListener('DOMContentLoaded', function() {
    MSFG.Report._updateBadge();

    var calcHeader = document.querySelector('.calc-page__header');
    if (!calcHeader) return;

    var h1 = calcHeader.querySelector('h1');
    var calcName = h1 ? h1.textContent.trim() : document.title;

    var calcIcon = '';
    if (typeof window.__calcIcon !== 'undefined') {
      calcIcon = window.__calcIcon;
    }

    var btn = document.createElement('button');
    btn.className = 'report-add-btn';
    btn.title = 'Add to Report';
    var defaultSvg =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
        '<polyline points="14 2 14 8 20 8"/>' +
        '<line x1="12" y1="18" x2="12" y2="12"/>' +
        '<line x1="9" y1="15" x2="15" y2="15"/>' +
      '</svg>';
    btn.innerHTML = defaultSvg;

    btn.addEventListener('click', function() {
      btn.disabled = true;
      btn.innerHTML =
        '<svg class="report-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" stroke-dashoffset="0"/></svg>';

      MSFG.Report.captureCurrentCalculator(calcName, calcIcon).then(function() {
        btn.disabled = false;
        btn.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
        btn.style.color = 'var(--brand-primary)';
        btn.style.borderColor = 'var(--brand-primary)';
        setTimeout(function() {
          btn.innerHTML = defaultSvg;
          btn.style.color = '';
          btn.style.borderColor = '';
        }, 1500);
      }).catch(function() {
        btn.disabled = false;
        btn.innerHTML = defaultSvg;
      });
    });

    var headerWrapper = document.createElement('div');
    headerWrapper.className = 'calc-page__header-actions';
    headerWrapper.appendChild(btn);
    calcHeader.appendChild(headerWrapper);
  });
})();
