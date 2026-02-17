/* =====================================================
   MSFG Report — Standalone Page Integration
   For pages that don't use the EJS layout (LLPM, Batch LLPM, MISMO).
   Uses IndexedDB (same DB as report.js) for storage.
   ===================================================== */

(function() {
  'use strict';

  var DB_NAME = 'msfg-report';
  var STORE_NAME = 'items';
  var DB_VERSION = 1;
  var _db = null;

  function openDB() {
    return new Promise(function(resolve, reject) {
      if (_db) return resolve(_db);
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
      req.onerror = function() { reject(req.error); };
    });
  }

  function addItem(item) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }

  function showToast(msg, type) {
    var t = document.createElement('div');
    t.style.cssText =
      'position:fixed;bottom:24px;right:24px;display:flex;align-items:center;gap:8px;' +
      'padding:12px 20px;background:' + (type === 'error' ? '#dc3545' : '#2d6a4f') + ';color:#fff;' +
      'font-size:.88rem;font-weight:500;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);' +
      'z-index:10000;transform:translateY(20px);opacity:0;transition:all .3s ease;pointer-events:none;';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function() { t.style.transform = 'translateY(0)'; t.style.opacity = '1'; });
    setTimeout(function() {
      t.style.transform = 'translateY(20px)'; t.style.opacity = '0';
      setTimeout(function() { t.remove(); }, 300);
    }, 2500);
  }

  function ensureHtml2Canvas(cb) {
    if (typeof html2canvas !== 'undefined') return cb();
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = cb;
    s.onerror = function() { showToast('Failed to load capture library', 'error'); };
    document.head.appendChild(s);
  }

  function createButton(calcName, calcIcon) {
    var btn = document.createElement('button');
    btn.id = 'reportAddBtnStandalone';
    btn.title = 'Add to Report';
    btn.style.cssText =
      'position:fixed;bottom:24px;left:24px;display:inline-flex;align-items:center;gap:6px;' +
      'padding:10px 18px;background:#2d6a4f;color:#fff;border:none;border-radius:10px;' +
      'font-size:.85rem;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.15);' +
      'z-index:9999;transition:all .2s ease;font-family:Inter,system-ui,sans-serif;';
    btn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
        '<polyline points="14 2 14 8 20 8"/>' +
        '<line x1="12" y1="18" x2="12" y2="12"/>' +
        '<line x1="9" y1="15" x2="15" y2="15"/>' +
      '</svg> Add to Report';

    btn.addEventListener('mouseenter', function() { btn.style.background = '#245a40'; });
    btn.addEventListener('mouseleave', function() { btn.style.background = '#2d6a4f'; });

    btn.addEventListener('click', function() {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.innerHTML = 'Capturing...';

      ensureHtml2Canvas(function() {
        var target = document.querySelector('.container, .main-container, main, body');
        html2canvas(target || document.body, {
          useCORS: true, allowTaint: true, scale: 1,
          backgroundColor: '#ffffff', logging: false
        }).then(function(canvas) {
          var imageData = canvas.toDataURL('image/jpeg', 0.5);
          var item = {
            id: 'rpt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            name: calcName,
            icon: calcIcon,
            timestamp: new Date().toISOString(),
            imageData: imageData
          };
          return addItem(item);
        }).then(function() {
          showToast('Added to report');
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
              '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Added!';
          setTimeout(function() {
            btn.innerHTML =
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
                '<polyline points="14 2 14 8 20 8"/>' +
                '<line x1="12" y1="18" x2="12" y2="12"/>' +
                '<line x1="9" y1="15" x2="15" y2="15"/>' +
              '</svg> Add to Report';
          }, 1500);
        }).catch(function(err) {
          console.error('Report capture failed:', err);
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
              '<polyline points="14 2 14 8 20 8"/>' +
              '<line x1="12" y1="18" x2="12" y2="12"/>' +
              '<line x1="9" y1="15" x2="15" y2="15"/>' +
            '</svg> Add to Report';
          showToast('Capture failed — try again', 'error');
        });
      });
    });

    if (window.location.search.indexOf('embed=1') !== -1) return;
    if (window.top !== window) return;
    document.body.appendChild(btn);
  }

  document.addEventListener('DOMContentLoaded', function() {
    var name = document.title.replace(/\s*[-|].*$/, '').trim() || 'Tool';
    var icon = document.querySelector('meta[name="calc-icon"]');
    createButton(name, icon ? icon.getAttribute('content') : '');
  });
})();
