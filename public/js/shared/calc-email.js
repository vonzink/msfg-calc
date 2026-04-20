'use strict';

/**
 * Shared calculator email + print module.
 *
 * Each calculator registers an email-data provider via:
 *   MSFG.CalcActions.register(getEmailData)
 *
 * getEmailData() should return:
 *   { title: 'Calculator Name', sections: [ { heading, rows: [{label, value}] } ] }
 */
(function () {
  'use strict';

  let _getEmailData = null;

  /* ---- Print ---- */
  function handlePrint() {
    window.print();
  }

  /* ---- Email modal ---- */
  const overlay = document.getElementById('emailModalOverlay');
  const closeBtn = document.getElementById('emailModalClose');
  const cancelBtn = document.getElementById('emailModalCancel');
  const sendBtn = document.getElementById('emailSendBtn');
  const previewToggle = document.getElementById('emailPreviewToggle');
  const previewWrap = document.getElementById('emailPreview');
  const previewContent = document.getElementById('emailPreviewContent');
  const statusEl = document.getElementById('emailStatus');
  const toInput = document.getElementById('emailTo');
  const subjectInput = document.getElementById('emailSubject');
  const messageInput = document.getElementById('emailMessage');

  /* ---- Formatting controls ---- */
  const fontFamilyInput = document.getElementById('emailFontFamily');
  const fontSizeInput = document.getElementById('emailFontSize');
  const fontSizeVal = document.getElementById('emailFontSizeVal');
  const rowSpacingInput = document.getElementById('emailRowSpacing');
  const rowSpacingVal = document.getElementById('emailRowSpacingVal');
  const boldLabelsInput = document.getElementById('emailBoldLabels');
  const blackDetailsInput = document.getElementById('emailBlackDetails');
  const includeSigInput = document.getElementById('emailIncludeSignature');

  const FORMAT_STORAGE_KEY = 'msfg-email-format-v1';

  function loadFormatPrefs() {
    try {
      const raw = localStorage.getItem(FORMAT_STORAGE_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (fontFamilyInput && prefs.fontFamily) fontFamilyInput.value = prefs.fontFamily;
      if (fontSizeInput && prefs.fontSize) fontSizeInput.value = prefs.fontSize;
      if (rowSpacingInput && prefs.rowSpacing != null) rowSpacingInput.value = prefs.rowSpacing;
      if (boldLabelsInput && typeof prefs.boldLabels === 'boolean') boldLabelsInput.checked = prefs.boldLabels;
      if (blackDetailsInput && typeof prefs.blackDetails === 'boolean') blackDetailsInput.checked = prefs.blackDetails;
      if (includeSigInput && typeof prefs.includeSignature === 'boolean') includeSigInput.checked = prefs.includeSignature;
    } catch (e) { /* ignore */ }
  }

  function saveFormatPrefs() {
    try {
      localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify(getFormatOpts()));
    } catch (e) { /* ignore */ }
  }

  function getFormatOpts() {
    return {
      fontFamily: fontFamilyInput ? fontFamilyInput.value : 'Arial, Helvetica, sans-serif',
      fontSize: fontSizeInput ? parseInt(fontSizeInput.value, 10) || 14 : 14,
      rowSpacing: rowSpacingInput ? parseInt(rowSpacingInput.value, 10) : 6,
      boldLabels: boldLabelsInput ? boldLabelsInput.checked : true,
      blackDetails: blackDetailsInput ? blackDetailsInput.checked : true,
      includeSignature: includeSigInput ? includeSigInput.checked : true
    };
  }

  function updateFormatDisplays() {
    if (fontSizeInput && fontSizeVal) fontSizeVal.textContent = fontSizeInput.value + 'px';
    if (rowSpacingInput && rowSpacingVal) rowSpacingVal.textContent = rowSpacingInput.value + 'px';
  }

  function onFormatChange() {
    updateFormatDisplays();
    saveFormatPrefs();
    // Refresh preview live if it's visible
    if (previewWrap && !previewWrap.classList.contains('u-hidden') && _getEmailData) {
      const data = _getEmailData();
      if (previewContent) previewContent.innerHTML = buildPreviewHTML(data, getFormatOpts());
    }
  }

  [fontFamilyInput, fontSizeInput, rowSpacingInput, boldLabelsInput, blackDetailsInput, includeSigInput]
    .forEach(function (inp) { if (inp) inp.addEventListener('input', onFormatChange); });

  loadFormatPrefs();
  updateFormatDisplays();

  /* ---- Dashboard user signature (when calc is served from dashboard.msfgco.com/calc/) ---- */
  let _userSignatureHtml = null;
  let _userSignatureFetched = false;

  function getAuthToken() {
    try {
      const fromStorage = localStorage.getItem('auth_token');
      if (fromStorage) return fromStorage;
      const m = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }

  async function loadUserSignature() {
    if (_userSignatureFetched) return _userSignatureHtml;
    _userSignatureFetched = true;
    const token = getAuthToken();
    if (!token) return null;

    // Build URL dynamically so nginx sub_filter doesn't rewrite the path to /calc/api/...
    const apiPath = ['', 'api', 'me', 'profile'].join('/');
    const url = window.location.origin + apiPath;

    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
        credentials: 'include'
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      _userSignatureHtml = data && data.email_signature ? String(data.email_signature) : null;
      return _userSignatureHtml;
    } catch (e) {
      return null;
    }
  }

  function openModal() {
    if (!overlay) return;

    /* Pre-fill subject from page title */
    const calcTitle = document.querySelector('.calc-page__header h1');
    if (calcTitle && subjectInput && !subjectInput.value) {
      subjectInput.value = calcTitle.textContent.trim() + ' — Results';
    }

    window.scrollTo(0, 0);
    overlay.classList.remove('u-hidden');
    if (statusEl) statusEl.textContent = '';
    if (previewWrap) previewWrap.classList.add('u-hidden');
    if (toInput) toInput.focus();

    // Fire-and-forget: try to load the logged-in user's HTML signature
    loadUserSignature().then(function (sig) {
      // If preview is showing, refresh it so the signature appears
      if (sig && previewWrap && !previewWrap.classList.contains('u-hidden') && _getEmailData) {
        const data = _getEmailData();
        if (previewContent) previewContent.innerHTML = buildPreviewHTML(data, getFormatOpts());
      }
    });
  }

  function closeModal() {
    if (overlay) overlay.classList.add('u-hidden');
  }

  function buildPreviewHTML(data, opts) {
    if (!data || !data.sections) return '<p>No calculator data available.</p>';
    opts = opts || getFormatOpts();
    const ff = opts.fontFamily || 'Arial, Helvetica, sans-serif';
    const fs = opts.fontSize || 14;
    const pad = opts.rowSpacing != null ? opts.rowSpacing : 6;
    const labelColor = opts.boldLabels ? '#111' : '#555';
    const labelWeight = opts.boldLabels ? '700' : '500';
    const detailColor = opts.blackDetails ? '#000' : '#222';
    const detailSmall = Math.max(10, fs - 2);

    let html = '<div style="font-family:' + ff + ';font-size:' + fs + 'px;color:' + detailColor + ';">';
    html += '<h3 style="color:#2d6a4f;margin:0 0 12px;font-size:' + (fs + 4) + 'px;">' + MSFG.escHtml(data.title) + '</h3>';
    data.sections.forEach(function (sec) {
      html += '<h4 style="color:#333;margin:' + (pad * 2) + 'px 0 ' + pad + 'px;font-size:' + (fs + 1) + 'px;"><span style="border-bottom:1px solid #e0e0e0;padding-bottom:4px;">' + MSFG.escHtml(sec.heading) + '</span></h4>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:' + fs + 'px;">';
      sec.rows.forEach(function (row) {
        var valueLong = row.value && row.value.length > 60;
        if (row.stacked) {
          var bullet = row.bulletColor
            ? '<span style="color:' + row.bulletColor + ';">&#9679;</span>&nbsp;&nbsp;'
            : '';
          html += '<tr><td colspan="2" style="padding:' + pad + 'px 8px ' + (row.value ? '0' : pad + 'px') + ' 0;color:' + labelColor + ';font-weight:' + labelWeight + ';font-size:' + fs + 'px;">' + bullet + MSFG.escHtml(row.label) + '</td></tr>';
          if (row.value) {
            html += '<tr><td colspan="2" style="padding:0 8px ' + pad + 'px ' + (row.bulletColor ? '22px' : '16px') + ';color:' + detailColor + ';font-size:' + detailSmall + 'px;line-height:1.35;">' + MSFG.escHtml(row.value) + '</td></tr>';
          }
        } else if (valueLong) {
          html += '<tr><td colspan="2" style="padding:' + pad + 'px 8px 0 0;color:' + labelColor + ';font-weight:' + labelWeight + ';font-size:' + fs + 'px;">' + MSFG.escHtml(row.label) + '</td></tr>';
          html += '<tr><td colspan="2" style="padding:0 8px ' + pad + 'px 0;color:' + detailColor + ';line-height:1.4;font-size:' + fs + 'px;">' + MSFG.escHtml(row.value) + '</td></tr>';
        } else {
          var boldStyle = row.bold ? 'font-weight:700;font-size:' + (fs + 1) + 'px;' : '';
          html += '<tr><td style="padding:' + pad + 'px 8px ' + pad + 'px 0;color:' + labelColor + ';font-weight:' + labelWeight + ';">' + MSFG.escHtml(row.label) + '</td>';
          html += '<td style="padding:' + pad + 'px 0;font-weight:600;text-align:right;color:' + detailColor + ';' + boldStyle + '">' + MSFG.escHtml(row.value) + '</td></tr>';
        }
      });
      html += '</table>';
    });

    // Append signature HTML if available and toggle is on
    if (opts.includeSignature && _userSignatureHtml) {
      html += '<div style="margin-top:' + (pad * 3) + 'px;padding-top:' + (pad * 2) + 'px;border-top:1px solid #e0e0e0;font-family:' + ff + ';font-size:' + fs + 'px;color:' + detailColor + ';">';
      html += _userSignatureHtml;
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function togglePreview() {
    if (!previewWrap) return;
    const visible = !previewWrap.classList.contains('u-hidden');
    if (visible) {
      previewWrap.classList.add('u-hidden');
      if (previewToggle) previewToggle.textContent = 'Preview Email';
    } else {
      const data = _getEmailData ? _getEmailData() : null;
      if (previewContent) previewContent.innerHTML = buildPreviewHTML(data, getFormatOpts());
      previewWrap.classList.remove('u-hidden');
      if (previewToggle) previewToggle.textContent = 'Hide Preview';
    }
  }

  const copyBtn = document.getElementById('emailCopyBtn');

  async function copyPreview() {
    const data = _getEmailData ? _getEmailData() : null;
    if (!data) {
      setStatus('No calculator data to copy.', 'error');
      return;
    }
    const html = buildPreviewHTML(data, getFormatOpts());
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([previewToPlainText(data)], { type: 'text/plain' })
        })
      ]);
      setStatus('Copied to clipboard!', 'success');
      setTimeout(function () { if (statusEl) statusEl.textContent = ''; }, 2000);
    } catch (err) {
      // Fallback: copy plain text
      try {
        await navigator.clipboard.writeText(previewToPlainText(data));
        setStatus('Copied as plain text.', 'success');
        setTimeout(function () { if (statusEl) statusEl.textContent = ''; }, 2000);
      } catch (e) {
        setStatus('Copy failed — check browser permissions.', 'error');
      }
    }
  }

  function previewToPlainText(data) {
    let text = data.title + '\n' + '='.repeat(data.title.length) + '\n\n';
    data.sections.forEach(function (sec) {
      text += sec.heading + '\n' + '-'.repeat(sec.heading.length) + '\n';
      sec.rows.forEach(function (row) {
        if (row.stacked) {
          text += '  ' + row.label + (row.value ? '\n    ' + row.value : '') + '\n';
        } else if (row.isTotal) {
          text += row.label + ':  ' + row.value + '\n';
        } else {
          text += '  ' + row.label + ':  ' + row.value + '\n';
        }
      });
      text += '\n';
    });
    return text.trim();
  }

  function setStatus(msg, type) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'email-modal__status' + (type ? ' email-modal__status--' + type : '');
  }

  async function sendEmail() {
    const to = toInput ? toInput.value.trim() : '';
    const subject = subjectInput ? subjectInput.value.trim() : '';
    const message = messageInput ? messageInput.value.trim() : '';

    if (!to) {
      setStatus('Please enter a recipient email.', 'error');
      toInput.focus();
      return;
    }

    if (!subject) {
      setStatus('Please enter a subject.', 'error');
      subjectInput.focus();
      return;
    }

    const data = _getEmailData ? _getEmailData() : null;
    if (!data) {
      setStatus('No calculator data to send.', 'error');
      return;
    }

    sendBtn.disabled = true;
    setStatus('Sending...', '');

    try {
      const resp = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to, subject: subject, message: message, calcData: data,
          format: getFormatOpts(),
          signatureHtml: _userSignatureHtml || null
        })
      });
      const result = await resp.json();

      if (result.success) {
        setStatus('Email sent successfully!', 'success');
        setTimeout(closeModal, 1500);
      } else {
        setStatus(result.message || 'Failed to send email.', 'error');
      }
    } catch (err) {
      setStatus('Network error. Please try again.', 'error');
    } finally {
      sendBtn.disabled = false;
    }
  }

  /* ---- Wire up buttons ---- */
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (sendBtn) sendBtn.addEventListener('click', sendEmail);
  if (previewToggle) previewToggle.addEventListener('click', togglePreview);
  if (copyBtn) copyBtn.addEventListener('click', copyPreview);

  /* Close on overlay click */
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
  }

  /* Close on Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay && !overlay.classList.contains('u-hidden')) {
      closeModal();
    }
  });

  /* ---- Bind data-action buttons (Print + Email) ---- */
  function bindActionButtons() {
    document.querySelectorAll('[data-action="calc-print"]').forEach(function (el) {
      el.addEventListener('click', handlePrint);
    });
    document.querySelectorAll('[data-action="calc-email"]').forEach(function (el) {
      el.addEventListener('click', openModal);
    });
  }

  // Script loads at end of body — DOMContentLoaded may have already fired
  // (especially inside workspace iframes). Run immediately if DOM is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindActionButtons);
  } else {
    bindActionButtons();
  }

  /* ---- Public API ---- */
  window.MSFG = window.MSFG || {};
  window.MSFG.CalcActions = {
    register: function (getEmailDataFn) {
      _getEmailData = getEmailDataFn;
    },
    openEmail: openModal,
    print: handlePrint
  };

})();
