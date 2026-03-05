/* =====================================================
   Processing — Client-side search, CRUD, table logic
   ===================================================== */
(function () {
  'use strict';

  var procType = window.__processingType;
  var debounceTimer = null;
  var currentPage = 1;
  var totalPages = 1;
  var editingId = null;

  var searchInput, statusFilter, sortSelect;
  var tableBody, emptyState, loadingState;
  var modalOverlay, paginationWrap;
  var pageInfo, prevBtn, nextBtn;
  var modalTitle, saveBtn;

  document.addEventListener('DOMContentLoaded', function () {
    searchInput    = document.getElementById('procSearchInput');
    statusFilter   = document.getElementById('procStatusFilter');
    sortSelect     = document.getElementById('procSortBy');
    tableBody      = document.getElementById('procTableBody');
    emptyState     = document.getElementById('procEmpty');
    loadingState   = document.getElementById('procLoading');
    modalOverlay   = document.getElementById('procModalOverlay');
    paginationWrap = document.getElementById('procPagination');
    pageInfo       = document.getElementById('procPageInfo');
    prevBtn        = document.getElementById('procPrevPage');
    nextBtn        = document.getElementById('procNextPage');
    modalTitle     = document.querySelector('.proc-modal__header h2');
    saveBtn        = document.getElementById('procModalSave');

    // Search — debounced
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () { currentPage = 1; runSearch(); }, 300);
    });

    statusFilter.addEventListener('change', function () { currentPage = 1; runSearch(); });
    sortSelect.addEventListener('change', function () { currentPage = 1; runSearch(); });

    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        clearTimeout(debounceTimer);
        currentPage = 1;
        runSearch();
      }
    });

    // Modal
    document.getElementById('procAddNew').addEventListener('click', function () { openModal(); });
    document.getElementById('procModalClose').addEventListener('click', closeModal);
    document.getElementById('procModalCancel').addEventListener('click', closeModal);
    saveBtn.addEventListener('click', saveRecord);

    modalOverlay.addEventListener('click', function (e) {
      if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalOverlay.style.display !== 'none') closeModal();
    });

    // Pagination
    prevBtn.addEventListener('click', function () {
      if (currentPage > 1) { currentPage--; runSearch(); }
    });
    nextBtn.addEventListener('click', function () {
      if (currentPage < totalPages) { currentPage++; runSearch(); }
    });

    // Set default date
    var dateField = document.getElementById('procFieldDate');
    if (dateField) dateField.value = todayISO();

    // Load all records on page load
    runSearch();
  });

  /* ---- Search ---- */

  function runSearch() {
    showLoading();

    var params = new URLSearchParams({
      q: (searchInput.value || '').trim(),
      status: statusFilter.value,
      sort: sortSelect.value,
      page: currentPage
    });

    fetch('/processing/api/' + procType + '/search?' + params.toString())
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.success) {
          showEmpty('Search failed — please try again.');
          return;
        }
        totalPages = data.totalPages || 1;
        currentPage = data.page || 1;
        updatePagination(data.total);
        renderResults(data.results);
      })
      .catch(function () {
        showEmpty('Connection error — please try again.');
      });
  }

  /* ---- Render ---- */

  function renderResults(results) {
    hideLoading();

    if (!results || results.length === 0) {
      showEmpty();
      return;
    }

    emptyState.style.display = 'none';
    tableBody.innerHTML = '';

    results.forEach(function (rec) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-id', rec.id);

      tr.innerHTML =
        '<td data-label="Borrower">' + esc(rec.borrower) + '</td>' +
        '<td data-label="Loan #">' + esc(rec.loan_number) + '</td>' +
        '<td data-label="Property">' + esc(rec.address) + '</td>' +
        '<td data-label="Status">' + statusBadge(rec.status) + '</td>' +
        '<td data-label="Ordered">' + formatDate(rec.ordered_date) + '</td>' +
        '<td data-label="Updated">' + formatDate(rec.updated_at) + '</td>' +
        '<td class="proc-row-actions">' +
          '<button class="proc-row-action proc-edit-btn" title="Edit">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
          '</button>' +
          '<button class="proc-row-action proc-delete-btn" title="Delete">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
          '</button>' +
        '</td>';

      // Edit button
      tr.querySelector('.proc-edit-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        openModal(rec);
      });

      // Delete button
      tr.querySelector('.proc-delete-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        deleteRecord(rec.id, rec.borrower);
      });

      tableBody.appendChild(tr);
    });
  }

  function statusBadge(status) {
    var slug = (status || '').toLowerCase().replace(/\s+/g, '-');
    var label = status ? status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ') : 'Unknown';
    return '<span class="proc-status proc-status--' + esc(slug) + '">' + esc(label) + '</span>';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      var d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function esc(str) {
    if (str == null) return '';
    var el = document.createElement('span');
    el.textContent = String(str);
    return el.innerHTML;
  }

  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  /* ---- Pagination ---- */

  function updatePagination(total) {
    if (total <= 25 && currentPage === 1) {
      paginationWrap.style.display = 'none';
      return;
    }
    paginationWrap.style.display = '';
    pageInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages + ' (' + total + ' records)';
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }

  /* ---- State helpers ---- */

  function showEmpty(msg) {
    hideLoading();
    tableBody.innerHTML = '';
    paginationWrap.style.display = 'none';
    emptyState.style.display = '';
    var p = emptyState.querySelector('p');
    if (msg) {
      p.innerHTML = msg;
    } else {
      p.innerHTML = 'Search for existing records or click <strong>New Record</strong> to add one.';
    }
  }

  function showLoading() {
    emptyState.style.display = 'none';
    tableBody.innerHTML = '';
    loadingState.style.display = '';
  }

  function hideLoading() {
    loadingState.style.display = 'none';
  }

  /* ---- Modal ---- */

  function openModal(record) {
    editingId = record ? record.id : null;

    var icon = document.querySelector('.proc-header__icon');
    var iconText = icon ? icon.textContent : '';

    if (record) {
      modalTitle.textContent = iconText + ' Edit Record';
      saveBtn.textContent = 'Update Record';
      document.getElementById('procFieldBorrower').value = record.borrower || '';
      document.getElementById('procFieldLoan').value = record.loan_number || '';
      document.getElementById('procFieldAddress').value = record.address || '';
      document.getElementById('procFieldVendor').value = record.vendor || '';
      document.getElementById('procFieldStatus').value = record.status || 'ordered';
      document.getElementById('procFieldDate').value = record.ordered_date || '';
      document.getElementById('procFieldRef').value = record.reference || '';
      document.getElementById('procFieldNotes').value = record.notes || '';
    } else {
      modalTitle.textContent = iconText + ' New Record';
      saveBtn.textContent = 'Save Record';
      resetForm();
    }

    modalOverlay.style.display = '';
    document.body.style.overflow = 'hidden';
    setTimeout(function () { document.getElementById('procFieldBorrower').focus(); }, 100);
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
    document.body.style.overflow = '';
    editingId = null;
  }

  function resetForm() {
    ['procFieldBorrower', 'procFieldLoan', 'procFieldAddress',
     'procFieldVendor', 'procFieldRef', 'procFieldNotes'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('procFieldStatus').value = 'ordered';
    document.getElementById('procFieldDate').value = todayISO();
  }

  /* ---- Save (create or update) ---- */

  function saveRecord() {
    var borrower = (document.getElementById('procFieldBorrower').value || '').trim();
    if (!borrower) {
      document.getElementById('procFieldBorrower').focus();
      return;
    }

    var payload = {
      borrower:    borrower,
      loanNumber:  (document.getElementById('procFieldLoan').value || '').trim(),
      address:     (document.getElementById('procFieldAddress').value || '').trim(),
      vendor:      (document.getElementById('procFieldVendor').value || '').trim(),
      status:      document.getElementById('procFieldStatus').value,
      orderedDate: document.getElementById('procFieldDate').value,
      reference:   (document.getElementById('procFieldRef').value || '').trim(),
      notes:       (document.getElementById('procFieldNotes').value || '').trim()
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    var url, method;
    if (editingId) {
      url = '/processing/api/' + procType + '/' + editingId;
      method = 'PUT';
    } else {
      url = '/processing/api/' + procType;
      method = 'POST';
    }

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        saveBtn.disabled = false;
        if (!data.success) {
          alert(data.message || 'Failed to save record.');
          return;
        }
        closeModal();
        runSearch();
      })
      .catch(function () {
        saveBtn.disabled = false;
        alert('Connection error — please try again.');
      });
  }

  /* ---- Delete ---- */

  function deleteRecord(id, borrowerName) {
    if (!confirm('Delete record for "' + borrowerName + '"? This cannot be undone.')) return;

    fetch('/processing/api/' + procType + '/' + id, { method: 'DELETE' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.success) {
          alert(data.message || 'Failed to delete record.');
          return;
        }
        runSearch();
      })
      .catch(function () {
        alert('Connection error — please try again.');
      });
  }
})();
