/* =====================================================
   Cover Letter — Clean Professional Letter Generator
   ===================================================== */
(function() {
  'use strict';

  var DEFAULT_BODY =
    'Enclosed you will find a comprehensive analysis of your current mortgage situation and potential refinancing options. ' +
    'This report is designed to provide you with the information you need to make informed decisions about your financial future.\n\n' +
    'We have carefully reviewed your loan details and market conditions to present a range of scenarios tailored to your specific needs and goals. ' +
    'Please take your time to review the findings, and do not hesitate to contact us with any questions you may have.\n\n' +
    'We are committed to helping you achieve your financial objectives. Thank you for choosing us as your trusted mortgage advisor.';

  /* ---- Helpers ---- */
  function el(id) { return document.getElementById(id); }

  var escHtml = MSFG.escHtml;

  /* ---- Get signature (MISMO override > settings) ---- */
  function getSignature() {
    var base = window.__emailSignature || {};
    var sig = {
      name: base.name || '',
      title: base.title || '',
      phone: base.phone || '',
      email: base.email || '',
      nmls: base.nmls || '',
      company: base.company || ''
    };
    // Override with MISMO-populated hidden fields if present
    var mismoName = el('laLoName') ? el('laLoName').value.trim() : '';
    if (mismoName) {
      sig.name = mismoName;
      if (el('laLoNmls') && el('laLoNmls').value.trim()) sig.nmls = el('laLoNmls').value.trim();
      if (el('laLoPhone') && el('laLoPhone').value.trim()) sig.phone = el('laLoPhone').value.trim();
      if (el('laLoEmail') && el('laLoEmail').value.trim()) sig.email = el('laLoEmail').value.trim();
      if (el('laLoCompany') && el('laLoCompany').value.trim()) sig.company = el('laLoCompany').value.trim();
    }
    return sig;
  }

  /* ---- Load session report items for attachment picker ---- */
  function loadAttachments() {
    var container = el('laAttachList');
    if (!container) return;

    // Access IndexedDB to get session report items
    if (!window.indexedDB) {
      container.innerHTML = '<p class="la-attach-empty">Session storage not available.</p>';
      return;
    }

    var req = indexedDB.open('msfg-report', 1);
    req.onerror = function() {
      container.innerHTML = '<p class="la-attach-empty">Could not load session items.</p>';
    };
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('items')) {
        db.createObjectStore('items', { keyPath: 'id' });
      }
    };
    req.onsuccess = function(e) {
      var db = e.target.result;
      var tx = db.transaction('items', 'readonly');
      var store = tx.objectStore('items');
      var getAll = store.getAll();
      getAll.onsuccess = function() {
        var items = getAll.result || [];
        if (items.length === 0) {
          container.innerHTML = '<p class="la-attach-empty">No items in session report yet. Add calculators to your session from the workspace first.</p>';
          return;
        }
        // Sort by order or timestamp
        items.sort(function(a, b) {
          return (a.order || 0) - (b.order || 0);
        });
        // Filter out the cover letter itself
        items = items.filter(function(it) { return it.slug !== 'loan-analysis'; });
        if (items.length === 0) {
          container.innerHTML = '<p class="la-attach-empty">No calculator items in session (only cover letters found).</p>';
          return;
        }
        var html = '';
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          html += '<label class="la-attach-item">';
          html += '<input type="checkbox" value="' + escHtml(it.id) + '" data-name="' + escHtml(it.name) + '" data-icon="' + escHtml(it.icon || '') + '">';
          html += '<span class="la-attach-icon">' + escHtml(it.icon || '📊') + '</span>';
          html += '<span class="la-attach-name">' + escHtml(it.name) + '</span>';
          html += '</label>';
        }
        container.innerHTML = html;
      };
    };
  }

  /* ---- Get selected attachments ---- */
  function getSelectedAttachments() {
    var checks = document.querySelectorAll('#laAttachList input[type="checkbox"]:checked');
    var list = [];
    for (var i = 0; i < checks.length; i++) {
      list.push({
        name: checks[i].getAttribute('data-name') || '',
        icon: checks[i].getAttribute('data-icon') || ''
      });
    }
    return list;
  }

  /* ---- Generate Cover Letter ---- */
  function generate() {
    var sig = getSignature();
    var resultsEl = el('laResults');
    var letterEl = el('laLetterContent');

    var borrowerName = el('laBorrowerName').value.trim();
    var coBorrower = el('laCoBorrowerName').value.trim();
    var street = el('laStreet').value.trim();
    var city = el('laCity').value.trim();
    var state = el('laState').value.trim();
    var zip = el('laZip').value.trim();
    var body = el('laBody').value.trim();
    var attachments = getSelectedAttachments();

    var html = '';

    // --- Logo Header ---
    var logoSrc = window.__companyLogo || '/images/msfg-logo.png';
    var companyName = window.__companyName || '';
    html += '<div class="la-letter__header">';
    html += '<img src="' + escHtml(logoSrc) + '" alt="' + escHtml(companyName) + '" class="la-letter__header-logo">';
    html += '</div>';

    // --- Date ---
    var now = new Date();
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var dateStr = months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
    html += '<div class="la-letter__date">' + dateStr + '</div>';

    // --- Address block ---
    if (borrowerName) {
      var addrLines = [];
      var names = [borrowerName, coBorrower].filter(Boolean);
      if (names.length) addrLines.push(escHtml(names.join(' & ')));
      if (street) addrLines.push(escHtml(street));
      var cityStateZip = [city, state].filter(Boolean).join(', ');
      if (zip) cityStateZip += ' ' + zip;
      if (cityStateZip.trim()) addrLines.push(escHtml(cityStateZip.trim()));
      html += '<div class="la-letter__address">' + addrLines.join('<br>') + '</div>';
    }

    // --- Greeting ---
    var borrowerFirst = borrowerName ? borrowerName.split(' ')[0] : '';
    var greeting = borrowerFirst ? 'Dear ' + escHtml(borrowerFirst) + ',' : 'Dear Valued Client,';
    html += '<div class="la-letter__greeting">' + greeting + '</div>';

    // --- Body ---
    if (body) {
      // Convert line breaks to paragraphs
      var paragraphs = body.split(/\n\n+/);
      html += '<div class="la-letter__body">';
      for (var i = 0; i < paragraphs.length; i++) {
        var p = paragraphs[i].trim();
        if (p) {
          html += '<p>' + escHtml(p).replace(/\n/g, '<br>') + '</p>';
        }
      }
      html += '</div>';
    }

    // --- Signature ---
    html += '<div class="la-letter__signature">';
    html += '<p class="la-sig-closing">Sincerely,</p>';
    if (sig.name) {
      html += '<p class="la-sig-name">' + escHtml(sig.name) + '</p>';
      if (sig.title) html += '<p class="la-sig-line">' + escHtml(sig.title) + '</p>';
      if (sig.company) html += '<p class="la-sig-line">' + escHtml(sig.company) + '</p>';
      if (sig.phone) html += '<p class="la-sig-line">' + escHtml(sig.phone) + '</p>';
      if (sig.email) html += '<p class="la-sig-line">' + escHtml(sig.email) + '</p>';
      if (sig.nmls) html += '<p class="la-sig-line">NMLS# ' + escHtml(sig.nmls) + '</p>';
    } else {
      html += '<p class="la-sig-name">[Your Name]</p>';
      html += '<p class="la-sig-line">[Contact Information]</p>';
    }
    html += '</div>';

    // --- Attached Reports (optional) ---
    if (attachments.length > 0) {
      html += '<div class="la-letter__attachments">';
      html += '<h3>Enclosed Reports</h3>';
      html += '<ul>';
      for (var j = 0; j < attachments.length; j++) {
        var a = attachments[j];
        html += '<li>';
        if (a.icon) html += '<span class="la-attach-li-icon">' + escHtml(a.icon) + '</span> ';
        html += escHtml(a.name);
        html += '</li>';
      }
      html += '</ul>';
      html += '</div>';
    }

    // --- Disclaimer ---
    html += '<div class="la-letter__disclaimer">';
    html += 'This is a preliminary analysis for discussion purposes only. Actual rates, terms, and closing costs may vary. Not a commitment to lend. Subject to underwriting approval. NMLS Consumer Access: nmlsconsumeraccess.org';
    html += '</div>';

    letterEl.innerHTML = html;
    resultsEl.style.display = '';
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---- Reset ---- */
  function resetForm() {
    var inputs = document.querySelectorAll('.calc-page input[type="text"]');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].value = '';
    }
    el('laBody').value = DEFAULT_BODY;
    el('laResults').style.display = 'none';
    // Uncheck all attachment checkboxes
    var checks = document.querySelectorAll('#laAttachList input[type="checkbox"]');
    for (var j = 0; j < checks.length; j++) {
      checks[j].checked = false;
    }
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', function() {
    // Set default body text
    el('laBody').value = DEFAULT_BODY;

    el('laGenerateBtn').addEventListener('click', generate);
    el('laResetBtn').addEventListener('click', resetForm);

    // Load session report items for attachment picker
    loadAttachments();
  });
})();
