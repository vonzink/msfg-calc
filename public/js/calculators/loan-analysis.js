/* =====================================================
   Cover Letter — Professional Letter Generator
   ===================================================== */
(function() {
  'use strict';

  var P = MSFG.parseNum;
  var fmt = MSFG.formatCurrency;
  var pct = MSFG.formatPercent;

  var STORAGE_KEY = 'msfg-la-toggles';
  var DEFAULT_INTRO = 'Thank you for the opportunity to work with you on your home financing needs. Below is a summary of the loan options we discussed.';

  /* ---- Helpers ---- */
  function el(id) { return document.getElementById(id); }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function totalInterest(principal, annualRate, termYears) {
    if (principal <= 0 || annualRate <= 0 || termYears <= 0) return 0;
    var n = termYears * 12;
    var pmt = MSFG.calcMonthlyPayment(principal, annualRate, termYears);
    return (pmt * n) - principal;
  }

  /* ---- Section Toggle Logic ---- */
  function getToggleState() {
    var state = {};
    var toggles = document.querySelectorAll('.la-section-toggles input[data-toggle]');
    for (var i = 0; i < toggles.length; i++) {
      state[toggles[i].getAttribute('data-toggle')] = toggles[i].checked;
    }
    return state;
  }

  function applyToggles() {
    var state = getToggleState();
    var sections = document.querySelectorAll('[data-section]');
    for (var i = 0; i < sections.length; i++) {
      var key = sections[i].getAttribute('data-section');
      if (typeof state[key] !== 'undefined') {
        sections[i].style.display = state[key] ? '' : 'none';
      }
    }
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function restoreToggles() {
    try {
      var stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      var state = JSON.parse(stored);
      // Migrate old key names
      if (typeof state['notes'] !== 'undefined' && typeof state['summary'] === 'undefined') {
        state['summary'] = state['notes'];
        delete state['notes'];
      }
      if (typeof state['lo'] !== 'undefined') {
        delete state['lo'];
      }
      var toggles = document.querySelectorAll('.la-section-toggles input[data-toggle]');
      for (var i = 0; i < toggles.length; i++) {
        var key = toggles[i].getAttribute('data-toggle');
        if (typeof state[key] !== 'undefined') {
          toggles[i].checked = state[key];
        }
      }
    } catch (e) { /* ignore */ }
  }

  function isSectionEnabled(sectionName) {
    var cb = document.querySelector('input[data-toggle="' + sectionName + '"]');
    return cb ? cb.checked : true;
  }

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

  /* ---- Read form state ---- */
  function getState() {
    var oldAmount = P(el('laOldAmount').value);
    var oldRate   = P(el('laOldRate').value) / 100;
    var oldTerm   = P(el('laOldTerm').value);
    var oldPIInput = P(el('laOldPayment').value);
    var oldPI     = oldPIInput > 0 ? oldPIInput : MSFG.calcMonthlyPayment(oldAmount, oldRate, oldTerm);
    var oldMI     = P(el('laOldMI').value);
    var oldEscrow = P(el('laOldEscrow').value);

    var newAmount = P(el('laNewAmount').value);
    var newRate   = P(el('laNewRate').value) / 100;
    var newTerm   = P(el('laNewTerm').value);
    var newPIInput = P(el('laNewPayment').value);
    var newPI     = newPIInput > 0 ? newPIInput : MSFG.calcMonthlyPayment(newAmount, newRate, newTerm);
    var newMI     = P(el('laNewMI').value);
    var newEscrow = P(el('laNewEscrow').value);

    return {
      intro: el('laIntro').value.trim(),
      borrower: isSectionEnabled('borrower') ? {
        name: el('laBorrowerName').value.trim(),
        coBorrower: el('laCoBorrowerName').value.trim(),
        street: el('laStreet').value.trim(),
        city: el('laCity').value.trim(),
        state: el('laState').value.trim(),
        zip: el('laZip').value.trim()
      } : null,
      oldLoan: isSectionEnabled('old-loan') ? {
        lender: el('laOldLender').value.trim(),
        type: el('laOldLoanType').value,
        amount: oldAmount,
        rate: oldRate,
        term: oldTerm,
        pi: oldPI,
        mi: oldMI,
        escrow: oldEscrow,
        total: oldPI + oldMI + oldEscrow
      } : null,
      newLoan: isSectionEnabled('new-loan') ? {
        lender: el('laNewLender').value.trim(),
        type: el('laNewLoanType').value,
        amount: newAmount,
        rate: newRate,
        term: newTerm,
        pi: newPI,
        mi: newMI,
        escrow: newEscrow,
        total: newPI + newMI + newEscrow
      } : null,
      closingCosts: isSectionEnabled('closing') ? P(el('laClosingCosts').value) : 0,
      credits: isSectionEnabled('closing') ? P(el('laCredits').value) : 0,
      showClosing: isSectionEnabled('closing'),
      summary: isSectionEnabled('summary') ? el('laSummary').value.trim() : ''
    };
  }

  /* ---- Build single-loan detail rows ---- */
  function loanRows(loan) {
    var html = '';
    if (loan.lender) html += '<tr><td>Lender</td><td>' + escHtml(loan.lender) + '</td></tr>';
    html += '<tr><td>Loan Type</td><td>' + escHtml(loan.type) + '</td></tr>';
    html += '<tr><td>Loan Amount</td><td>' + fmt(loan.amount) + '</td></tr>';
    html += '<tr><td>Interest Rate</td><td>' + pct(loan.rate * 100) + '</td></tr>';
    html += '<tr><td>Term</td><td>' + loan.term + ' years</td></tr>';
    html += '<tr><td>Monthly P&amp;I</td><td>' + fmt(loan.pi) + '</td></tr>';
    if (loan.mi) html += '<tr><td>Monthly MI</td><td>' + fmt(loan.mi) + '</td></tr>';
    if (loan.escrow) html += '<tr><td>Monthly Escrow</td><td>' + fmt(loan.escrow) + '</td></tr>';
    html += '<tr class="la-table-total"><td><strong>Total Payment</strong></td><td><strong>' + fmt(loan.total) + '</strong></td></tr>';
    return html;
  }

  /* ---- Generate Cover Letter ---- */
  function generate() {
    var s = getState();
    var sig = getSignature();
    var resultsEl = el('laResults');
    var letterEl = el('laLetterContent');

    // Calculations
    var oldTotal = s.oldLoan ? s.oldLoan.total : 0;
    var newTotal = s.newLoan ? s.newLoan.total : 0;
    var monthlySavings = oldTotal - newTotal;
    var netCosts = s.closingCosts - s.credits;
    var breakeven = monthlySavings > 0 ? Math.ceil(netCosts / monthlySavings) : 0;
    var oldInterest = s.oldLoan ? totalInterest(s.oldLoan.amount, s.oldLoan.rate, s.oldLoan.term) : 0;
    var newInterest = s.newLoan ? totalInterest(s.newLoan.amount, s.newLoan.rate, s.newLoan.term) : 0;
    var lifetimeSavings = oldInterest - newInterest;

    // Expose computed values for report extractor
    window.__laComputedState = {
      monthlySavings: fmt(monthlySavings),
      netCosts: fmt(netCosts),
      breakeven: breakeven > 0 ? breakeven + ' months' : '--',
      lifetimeSavings: fmt(lifetimeSavings)
    };

    var html = '';

    // Logo
    var logoSrc = window.__companyLogo || '/images/msfg-logo.png';
    html += '<div class="la-letter__logo"><img src="' + escHtml(logoSrc) + '" alt="' + escHtml(window.__companyName || '') + '"></div>';

    // Date
    var now = new Date();
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var dateStr = months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
    html += '<div class="la-letter__date">' + dateStr + '</div>';

    // Borrower address block
    if (s.borrower) {
      var addrLines = [];
      var names = [s.borrower.name, s.borrower.coBorrower].filter(Boolean);
      if (names.length) addrLines.push(escHtml(names.join(' & ')));
      if (s.borrower.street) addrLines.push(escHtml(s.borrower.street));
      var cityStateZip = [s.borrower.city, s.borrower.state].filter(Boolean).join(', ');
      if (s.borrower.zip) cityStateZip += ' ' + s.borrower.zip;
      if (cityStateZip.trim()) addrLines.push(escHtml(cityStateZip.trim()));
      if (addrLines.length) {
        html += '<div class="la-letter__address">' + addrLines.join('<br>') + '</div>';
      }
    }

    // Greeting
    var borrowerFirst = s.borrower && s.borrower.name ? s.borrower.name.split(' ')[0] : '';
    var greeting = borrowerFirst ? 'Dear ' + escHtml(borrowerFirst) + ',' : 'Dear Valued Client,';
    html += '<div class="la-letter__greeting">' + greeting + '</div>';

    // Intro
    if (s.intro) {
      html += '<div class="la-letter__intro">' + escHtml(s.intro) + '</div>';
    }

    // Loan sections
    var ol = s.oldLoan;
    var nl = s.newLoan;

    if (ol && nl) {
      // Side-by-side comparison
      html += '<div class="la-letter__section">';
      html += '<h3>Loan Comparison</h3>';
      html += '<table class="la-letter-table"><thead><tr><th></th><th>Current Loan</th><th>Proposed Loan</th></tr></thead><tbody>';
      var cmpRows = [
        { label: 'Lender', oVal: escHtml(ol.lender || '--'), nVal: escHtml(nl.lender || '--') },
        { label: 'Loan Type', oVal: escHtml(ol.type), nVal: escHtml(nl.type) },
        { label: 'Loan Amount', oVal: fmt(ol.amount), nVal: fmt(nl.amount) },
        { label: 'Interest Rate', oVal: pct(ol.rate * 100), nVal: pct(nl.rate * 100) },
        { label: 'Term', oVal: ol.term + ' years', nVal: nl.term + ' years' },
        { label: 'Monthly P&amp;I', oVal: fmt(ol.pi), nVal: fmt(nl.pi) }
      ];
      if (ol.mi || nl.mi) cmpRows.push({ label: 'Monthly MI', oVal: fmt(ol.mi), nVal: fmt(nl.mi) });
      if (ol.escrow || nl.escrow) cmpRows.push({ label: 'Monthly Escrow', oVal: fmt(ol.escrow), nVal: fmt(nl.escrow) });
      cmpRows.push({ label: '<strong>Total Payment</strong>', oVal: '<strong>' + fmt(ol.total) + '</strong>', nVal: '<strong>' + fmt(nl.total) + '</strong>', total: true });
      for (var i = 0; i < cmpRows.length; i++) {
        var cls = cmpRows[i].total ? ' class="la-table-total"' : '';
        html += '<tr' + cls + '><td>' + cmpRows[i].label + '</td><td>' + cmpRows[i].oVal + '</td><td>' + cmpRows[i].nVal + '</td></tr>';
      }
      html += '</tbody></table></div>';
    } else if (nl) {
      html += '<div class="la-letter__section">';
      html += '<h3>Proposed Loan Details</h3>';
      html += '<table class="la-letter-table"><tbody>' + loanRows(nl) + '</tbody></table></div>';
    } else if (ol) {
      html += '<div class="la-letter__section">';
      html += '<h3>Current Loan Details</h3>';
      html += '<table class="la-letter-table"><tbody>' + loanRows(ol) + '</tbody></table></div>';
    }

    // Closing costs
    if (s.showClosing && (s.closingCosts || s.credits)) {
      html += '<div class="la-letter__section">';
      html += '<h3>Closing Costs</h3>';
      html += '<table class="la-letter-table"><tbody>';
      html += '<tr><td>Estimated Closing Costs</td><td>' + fmt(s.closingCosts) + '</td></tr>';
      if (s.credits) html += '<tr><td>Lender Credits</td><td>(' + fmt(s.credits) + ')</td></tr>';
      html += '<tr class="la-table-total"><td><strong>Net Closing Costs</strong></td><td><strong>' + fmt(netCosts) + '</strong></td></tr>';
      html += '</tbody></table></div>';
    }

    // Savings summary (only if both loans present)
    if (ol && nl && s.showClosing) {
      html += '<div class="la-letter__section la-letter__savings">';
      html += '<h3>Savings Summary</h3>';
      html += '<div class="la-savings-grid">';
      html += '<div class="la-savings-item"><span class="la-savings-label">Monthly Savings</span><span class="la-savings-value' + (monthlySavings > 0 ? ' la-positive' : '') + '">' + fmt(monthlySavings) + '</span></div>';
      html += '<div class="la-savings-item"><span class="la-savings-label">Net Closing Costs</span><span class="la-savings-value">' + fmt(netCosts) + '</span></div>';
      html += '<div class="la-savings-item"><span class="la-savings-label">Breakeven</span><span class="la-savings-value">' + (breakeven > 0 ? breakeven + ' months' : '--') + '</span></div>';
      html += '</div>';
      html += '<div class="la-savings-highlight"><span>Lifetime Interest Savings</span><span class="' + (lifetimeSavings > 0 ? 'la-positive' : '') + '">' + fmt(lifetimeSavings) + '</span></div>';
      html += '</div>';
    }

    // Summary
    if (s.summary) {
      html += '<div class="la-letter__section">';
      html += '<h3>Summary</h3>';
      html += '<p style="white-space:pre-wrap;margin:0">' + escHtml(s.summary) + '</p>';
      html += '</div>';
    }

    // Signature
    if (sig.name) {
      html += '<div class="la-letter__signature">';
      html += '<p class="la-sig-closing">Sincerely,</p>';
      html += '<p class="la-sig-name">' + escHtml(sig.name) + '</p>';
      if (sig.title) html += '<p class="la-sig-line">' + escHtml(sig.title) + '</p>';
      if (sig.company) html += '<p class="la-sig-line">' + escHtml(sig.company) + '</p>';
      if (sig.phone) html += '<p class="la-sig-line">' + escHtml(sig.phone) + '</p>';
      if (sig.email) html += '<p class="la-sig-line">' + escHtml(sig.email) + '</p>';
      if (sig.nmls) html += '<p class="la-sig-line">NMLS# ' + escHtml(sig.nmls) + '</p>';
      html += '</div>';
    }

    // Disclaimer
    html += '<div class="la-letter__disclaimer">';
    html += 'This is a preliminary analysis for discussion purposes only. Actual rates, terms, and closing costs may vary. Not a commitment to lend. Subject to underwriting approval. NMLS Consumer Access: nmlsconsumeraccess.org';
    html += '</div>';

    letterEl.innerHTML = html;
    resultsEl.style.display = '';
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---- Reset ---- */
  function resetForm() {
    var inputs = document.querySelectorAll('.calc-page input[type="text"], .calc-page input[type="number"], .calc-page input[type="tel"], .calc-page input[type="email"]');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].value = '';
    }
    el('laSummary').value = '';
    el('laIntro').value = DEFAULT_INTRO;
    // Reset selects to defaults
    el('laOldLoanType').value = 'Conventional';
    el('laNewLoanType').value = 'Conventional';
    el('laOldTerm').value = '30';
    el('laNewTerm').value = '30';
    el('laResults').style.display = 'none';
    // Restore all toggles to checked
    var toggles = document.querySelectorAll('.la-section-toggles input[data-toggle]');
    for (var j = 0; j < toggles.length; j++) {
      toggles[j].checked = true;
    }
    applyToggles();
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', function() {
    el('laGenerateBtn').addEventListener('click', generate);
    el('laResetBtn').addEventListener('click', resetForm);

    // Section toggle listeners
    var toggles = document.querySelectorAll('.la-section-toggles input[data-toggle]');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('change', applyToggles);
    }

    // Restore saved toggle state
    restoreToggles();
    applyToggles();
  });

  // Expose for report template extractor
  window.__laSectionEnabled = isSectionEnabled;
})();
