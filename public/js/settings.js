/* Settings page — logo preview + AI configuration */
'use strict';

document.addEventListener('DOMContentLoaded', function() {

  // --- Logo preview on file select ---
  var logoInput = document.querySelector('input[name="logo"]');
  if (logoInput) {
    logoInput.addEventListener('change', function() {
      if (!this.files || !this.files[0]) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        var preview = document.querySelector('.calc-section img');
        if (preview) preview.src = e.target.result;
      };
      reader.readAsDataURL(this.files[0]);
    });
  }

  // --- AI Settings ---

  var aiKeyInput = document.getElementById('aiApiKey');
  var aiToggleBtn = document.getElementById('aiToggleKey');
  var aiTestBtn = document.getElementById('aiTestBtn');
  var aiClearBtn = document.getElementById('aiClearBtn');
  var aiTestResult = document.getElementById('aiTestResult');

  // Toggle API key visibility
  if (aiToggleBtn && aiKeyInput) {
    aiToggleBtn.addEventListener('click', function() {
      var isPassword = aiKeyInput.type === 'password';
      aiKeyInput.type = isPassword ? 'text' : 'password';
      aiToggleBtn.textContent = isPassword ? '🙈' : '👁';
    });
  }

  // Clear the masked value on focus so user can type a fresh key
  if (aiKeyInput) {
    var originalValue = aiKeyInput.value;
    aiKeyInput.addEventListener('focus', function() {
      if (this.value && this.value.indexOf('••') !== -1) {
        this.value = '';
        this.type = 'text'; // show what they're typing
        if (aiToggleBtn) aiToggleBtn.textContent = '🙈';
      }
    });
    aiKeyInput.addEventListener('blur', function() {
      if (this.value === '' && originalValue) {
        this.value = originalValue;
        this.type = 'password';
        if (aiToggleBtn) aiToggleBtn.textContent = '👁';
      }
    });
  }

  // Test connection button
  if (aiTestBtn) {
    aiTestBtn.addEventListener('click', function() {
      if (aiTestResult) {
        aiTestResult.textContent = 'Testing…';
        aiTestResult.style.color = 'var(--color-gray-500)';
      }
      aiTestBtn.disabled = true;

      fetch('/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        if (aiTestResult) {
          if (data.success) {
            aiTestResult.textContent = '✓ ' + data.message;
            aiTestResult.style.color = '#2d6a4f';
          } else {
            aiTestResult.textContent = '✗ ' + data.message;
            aiTestResult.style.color = 'var(--color-danger, #dc3545)';
          }
        }
      })
      .catch(function() {
        if (aiTestResult) {
          aiTestResult.textContent = '✗ Network error — could not reach server.';
          aiTestResult.style.color = 'var(--color-danger, #dc3545)';
        }
      })
      .finally(function() {
        aiTestBtn.disabled = false;
      });
    });
  }

  // Clear API key button
  if (aiClearBtn) {
    aiClearBtn.addEventListener('click', function() {
      if (!confirm('Remove the saved API key? This cannot be undone.')) return;

      var form = document.createElement('form');
      form.method = 'POST';
      form.action = '/settings/ai/clear';
      // Include CSRF token from cookie
      var csrfMatch = document.cookie.match(/(?:^|;\s*)_csrf=([^;]+)/);
      if (csrfMatch) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = '_csrf';
        input.value = csrfMatch[1];
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    });
  }
});
