/* =====================================================
   Hub Page — Search filtering
   ===================================================== */
document.addEventListener('DOMContentLoaded', function() {
  var searchInput = document.getElementById('hubSearch');
  if (!searchInput) return;

  searchInput.addEventListener('input', function() {
    var query = this.value.toLowerCase().trim();
    var cards = document.querySelectorAll('.hub-card');
    var categories = document.querySelectorAll('.hub-category');

    cards.forEach(function(card) {
      var name = card.getAttribute('data-name') || '';
      card.classList.toggle('hidden', query && name.indexOf(query) === -1);
    });

    categories.forEach(function(cat) {
      var visible = cat.querySelectorAll('.hub-card:not(.hidden)');
      cat.classList.toggle('hidden', visible.length === 0);
    });
  });
});
