'use strict';

(function() {
  var MSFG = window.MSFG || {};
  if (!window.MSFG) window.MSFG = MSFG;

  function triggerEvent(el, eventName) {
    var evt = new Event(eventName, { bubbles: true, cancelable: true });
    el.dispatchEvent(evt);
  }

  function setInputValue(el, val) {
    var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (nativeSetter && nativeSetter.set) {
      nativeSetter.set.call(el, String(val));
    } else {
      el.value = String(val);
    }
    triggerEvent(el, 'input');
    triggerEvent(el, 'change');
  }

  function setSelectValue(el, val) {
    var strVal = String(val);
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].value === strVal || el.options[i].text === strVal) {
        el.selectedIndex = i;
        triggerEvent(el, 'change');
        return;
      }
    }
    var numVal = parseFloat(val);
    for (var j = 0; j < el.options.length; j++) {
      if (parseFloat(el.options[j].value) === numVal) {
        el.selectedIndex = j;
        triggerEvent(el, 'change');
        return;
      }
    }
  }

  function scrapeInputs(doc) {
    var data = {};
    var elements = doc.querySelectorAll('input[id], select[id], textarea[id]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (el.type === 'hidden' || el.type === 'file') continue;
      if (el.type === 'checkbox' || el.type === 'radio') {
        data[el.id] = { t: el.type, c: el.checked, v: el.value };
      } else {
        data[el.id] = { t: el.tagName.toLowerCase(), v: el.value };
      }
    }
    return data;
  }

  function applyZoomToNestedIframe(nested, zoomDecimal) {
    try {
      var nestedDoc = nested.contentDocument || nested.contentWindow.document;
      if (nestedDoc && nestedDoc.body) {
        nestedDoc.body.classList.add('embed-mode');
        var existing = nestedDoc.getElementById('ws-embed-zoom');
        if (existing) {
          existing.textContent = 'body.embed-mode { zoom: ' + zoomDecimal + '; }';
        } else {
          var style = nestedDoc.createElement('style');
          style.id = 'ws-embed-zoom';
          style.textContent = 'body.embed-mode { zoom: ' + zoomDecimal + '; }';
          nestedDoc.head.appendChild(style);
        }
      }
    } catch (e) { /* cross-origin nested, skip */ }
  }

  function applyZoomToIframe(iframe, zoomValue) {
    var zoomDecimal = zoomValue / 100;
    try {
      var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (!iframeDoc || !iframeDoc.body) return;
      iframeDoc.body.classList.add('embed-mode');
      var existing = iframeDoc.getElementById('ws-embed-zoom');
      if (existing) {
        existing.textContent = 'body.embed-mode { zoom: ' + zoomDecimal + '; }';
      } else {
        var style = iframeDoc.createElement('style');
        style.id = 'ws-embed-zoom';
        style.textContent = 'body.embed-mode { zoom: ' + zoomDecimal + '; }';
        iframeDoc.head.appendChild(style);
      }
      var nestedIframes = iframeDoc.querySelectorAll('iframe');
      nestedIframes.forEach(function(nested) {
        applyZoomToNestedIframe(nested, zoomDecimal);
        nested.removeEventListener('load', nested._wsZoomHandler);
        nested._wsZoomHandler = function() { applyZoomToNestedIframe(nested, zoomDecimal); };
        nested.addEventListener('load', nested._wsZoomHandler);
      });
    } catch (e) { /* cross-origin, skip */ }
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

  function highlightPanel(slug, count) {
    var panelEl = document.getElementById('ws-panel-' + slug);
    if (!panelEl) return;
    var header = panelEl.querySelector('.ws-panel__header');
    if (!header) return;
    var existing = header.querySelector('.mismo-populated-badge');
    if (existing) existing.remove();
    var badge = document.createElement('span');
    badge.className = 'mismo-populated-badge';
    badge.innerHTML =
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
      '<polyline points="20 6 9 17 4 12"/></svg> ' +
      count + ' fields populated';
    header.insertBefore(badge, header.querySelector('.ws-panel__zoom'));
  }

  function formatNum(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  MSFG.WS = {
    setInputValue: setInputValue,
    setSelectValue: setSelectValue,
    triggerEvent: triggerEvent,
    scrapeInputs: scrapeInputs,
    applyZoomToIframe: applyZoomToIframe,
    showToast: showToast,
    highlightPanel: highlightPanel,
    formatNum: formatNum
  };
})();
