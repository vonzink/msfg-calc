/* =====================================================
   MSFG File Upload Utilities
   Shared validation, drag/drop init, and status helpers
   for upload zones across calculators.
   ===================================================== */
'use strict';

window.MSFG = window.MSFG || {};

MSFG.FileUpload = {

  /** Validate file MIME type against allowed upload types */
  validateFile: function(file) {
    var allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    return allowed.indexOf(file.type) !== -1;
  },

  /** Update upload zone status indicator */
  setZoneStatus: function(zone, statusEl, type, html) {
    statusEl.className = 'upload-zone__status';
    if (type === 'loading') statusEl.className += ' status--loading';
    else if (type === 'success') statusEl.className += ' status--success';
    else if (type === 'error') statusEl.className += ' status--error';
    statusEl.innerHTML = html;
  },

  /**
   * Initialize drag/drop and click-to-upload on a zone element.
   * @param {Element} zone - The .upload-zone element
   * @param {Element} fileInput - The file input inside the zone
   * @param {Function} onFile - Callback(file) when a file is selected or dropped
   */
  initDropZone: function(zone, fileInput, onFile) {
    zone.addEventListener('click', function(e) {
      if (e.target === fileInput || zone.classList.contains('processing')) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', function() {
      if (fileInput.files.length > 0) onFile(fileInput.files[0]);
    });

    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', function() {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) onFile(e.dataTransfer.files[0]);
    });
  }
};
