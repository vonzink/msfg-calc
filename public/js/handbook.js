(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    // ── Sidebar doc group expand/collapse ──
    const toggles = document.querySelectorAll('.hb-sidebar__doc-toggle');
    toggles.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const targetId = btn.getAttribute('data-target');
        const section = document.getElementById(targetId);
        if (!section) return;

        const isOpen = btn.classList.contains('open');
        btn.classList.toggle('open', !isOpen);
        section.classList.toggle('open', !isOpen);
      });
    });

    // ── Mobile sidebar toggle ──
    const sidebarToggle = document.getElementById('hbSidebarToggle');
    const sidebar = document.getElementById('hbSidebar');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('open');
      });
    }

    // ── Search ──
    const searchInput = document.getElementById('hbSearchInput');
    const searchResults = document.getElementById('hbSearchResults');
    const searchResultsList = document.getElementById('hbSearchResultsList');
    const toc = document.getElementById('hbToc');
    const sidebarLinks = document.querySelectorAll('.hb-sidebar__link:not(.hb-sidebar__add)');

    if (!searchInput) return;

    let debounceTimer;

    searchInput.addEventListener('input', function() {
      const q = searchInput.value.trim();
      clearTimeout(debounceTimer);

      if (!q) {
        // Reset: show TOC, clear search results, show all sidebar links
        if (searchResults) searchResults.style.display = 'none';
        if (toc) toc.style.display = '';
        sidebarLinks.forEach(function(link) { link.style.display = ''; });
        return;
      }

      // Client-side sidebar filtering (immediate)
      const lower = q.toLowerCase();
      sidebarLinks.forEach(function(link) {
        const title = link.getAttribute('data-title') || link.textContent.toLowerCase();
        link.style.display = title.indexOf(lower) !== -1 ? '' : 'none';
      });

      // Expand all groups when searching
      toggles.forEach(function(btn) {
        btn.classList.add('open');
        const targetId = btn.getAttribute('data-target');
        const section = document.getElementById(targetId);
        if (section) section.classList.add('open');
      });

      // API search for content matches (debounced)
      debounceTimer = setTimeout(function() {
        if (q.length < 2) return;

        fetch('/handbook/api/search?q=' + encodeURIComponent(q))
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (!data.results || !data.results.length) {
              if (searchResults) searchResults.style.display = 'none';
              if (toc) toc.style.display = '';
              return;
            }

            if (toc) toc.style.display = 'none';
            if (searchResults) searchResults.style.display = '';

            searchResultsList.innerHTML = data.results.map(function(r) {
              // Extract a snippet around the match
              var snippet = getSnippet(r.content, q, 120);
              return '<a href="/handbook/' + escHtml(r.doc_slug) + '/' + escHtml(r.slug) +
                '" class="hb-search-result">' +
                '<div class="hb-search-result__title">' + escHtml(r.title) + '</div>' +
                '<div class="hb-search-result__doc">' + escHtml(r.doc_title) + '</div>' +
                (snippet ? '<div class="hb-search-result__snippet">' + snippet + '</div>' : '') +
                '</a>';
            }).join('');
          })
          .catch(function() { /* ignore */ });
      }, 300);
    });

    // Keyboard shortcut: / to focus search
    document.addEventListener('keydown', function(e) {
      if (e.key === '/' && document.activeElement !== searchInput &&
          document.activeElement.tagName !== 'INPUT' &&
          document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInput.focus();
      }
    });

    // ── Helpers ──

    function escHtml(str) {
      if (window.MSFG && window.MSFG.escHtml) return window.MSFG.escHtml(str);
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function getSnippet(content, query, maxLen) {
      if (!content) return '';
      var lower = content.toLowerCase();
      var qLower = query.toLowerCase();
      var idx = lower.indexOf(qLower);
      if (idx === -1) return '';

      var start = Math.max(0, idx - 60);
      var end = Math.min(content.length, idx + query.length + maxLen - 60);
      var snippet = content.substring(start, end).replace(/\n/g, ' ');

      if (start > 0) snippet = '...' + snippet;
      if (end < content.length) snippet = snippet + '...';

      // Highlight match
      var escaped = qLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      snippet = escHtml(snippet).replace(
        new RegExp('(' + escaped + ')', 'gi'),
        '<mark>$1</mark>'
      );

      return snippet;
    }
  });
})();
