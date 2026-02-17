/* Settings page — logo preview on file select */
'use strict';

document.addEventListener('DOMContentLoaded', function() {
  var input = document.querySelector('input[name="logo"]');
  if (!input) return;

  input.addEventListener('change', function() {
    if (!this.files || !this.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var preview = document.querySelector('.calc-section img');
      if (preview) preview.src = e.target.result;
    };
    reader.readAsDataURL(this.files[0]);
  });
});
