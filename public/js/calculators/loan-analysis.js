/* =====================================================
   Loan Analysis — Cover Page Generator
   ===================================================== */
(function() {
  'use strict';

  var P = MSFG.parseNum;
  var fmt = MSFG.formatCurrency;
  var pct = MSFG.formatPercent;

  /* ---- Helpers ---- */
  function el(id) { return document.getElementById(id); }

  function totalInterest(principal, annualRate, termYears) {
    if (principal <= 0 || annualRate <= 0 || termYears <= 0) return 0;
    var n = termYears * 12;
    var pmt = MSFG.calcMonthlyPayment(principal, annualRate, termYears);
    return (pmt * n) - principal;
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
      borrower: {
        name: el('laBorrowerName').value.trim(),
        coBorrower: el('laCoBorrowerName').value.trim(),
        street: el('laStreet').value.trim(),
        city: el('laCity').value.trim(),
        state: el('laState').value.trim(),
        zip: el('laZip').value.trim()
      },
      oldLoan: {
        lender: el('laOldLender').value.trim(),
        type: el('laOldLoanType').value,
        amount: oldAmount,
        rate: oldRate,
        term: oldTerm,
        pi: oldPI,
        mi: oldMI,
        escrow: oldEscrow,
        total: oldPI + oldMI + oldEscrow
      },
      newLoan: {
        lender: el('laNewLender').value.trim(),
        type: el('laNewLoanType').value,
        amount: newAmount,
        rate: newRate,
        term: newTerm,
        pi: newPI,
        mi: newMI,
        escrow: newEscrow,
        total: newPI + newMI + newEscrow
      },
      closingCosts: P(el('laClosingCosts').value),
      credits: P(el('laCredits').value),
      loanOfficer: {
        name: el('laLoName').value.trim(),
        nmls: el('laLoNmls').value.trim(),
        phone: el('laLoPhone').value.trim(),
        email: el('laLoEmail').value.trim(),
        company: el('laLoCompany').value.trim()
      }
    };
  }

  /* ---- Generate / Calculate ---- */
  function generate() {
    var s = getState();
    var resultsEl = el('laResults');

    var monthlySavings = s.oldLoan.total - s.newLoan.total;
    var netCosts = s.closingCosts - s.credits;
    var breakeven = monthlySavings > 0 ? Math.ceil(netCosts / monthlySavings) : 0;

    var oldInterest = totalInterest(s.oldLoan.amount, s.oldLoan.rate, s.oldLoan.term);
    var newInterest = totalInterest(s.newLoan.amount, s.newLoan.rate, s.newLoan.term);
    var lifetimeSavings = oldInterest - newInterest;

    // Summary cards
    el('laResMonthlySavings').textContent = fmt(monthlySavings);
    el('laResNetCosts').textContent = fmt(netCosts);
    el('laResBreakeven').textContent = breakeven > 0 ? breakeven + ' months' : '--';
    el('laResLifetimeSavings').textContent = fmt(lifetimeSavings);

    // Color-code savings
    el('laResMonthlySavings').style.color = monthlySavings > 0 ? 'var(--brand-primary, #2d6a4f)' : 'var(--color-danger, #dc3545)';
    el('laResLifetimeSavings').style.color = lifetimeSavings > 0 ? 'var(--brand-primary, #2d6a4f)' : 'var(--color-danger, #dc3545)';

    // Comparison table
    el('laResOldLender').textContent  = s.oldLoan.lender || '--';
    el('laResNewLender').textContent  = s.newLoan.lender || '--';
    el('laResOldType').textContent    = s.oldLoan.type;
    el('laResNewType').textContent    = s.newLoan.type;
    el('laResOldAmount').textContent  = fmt(s.oldLoan.amount);
    el('laResNewAmount').textContent  = fmt(s.newLoan.amount);
    el('laResOldRate').textContent    = pct(s.oldLoan.rate * 100);
    el('laResNewRate').textContent    = pct(s.newLoan.rate * 100);
    el('laResOldTerm').textContent    = s.oldLoan.term + ' years';
    el('laResNewTerm').textContent    = s.newLoan.term + ' years';
    el('laResOldPI').textContent      = fmt(s.oldLoan.pi);
    el('laResNewPI').textContent      = fmt(s.newLoan.pi);
    el('laResOldMI').textContent      = fmt(s.oldLoan.mi);
    el('laResNewMI').textContent      = fmt(s.newLoan.mi);
    el('laResOldEscrow').textContent  = fmt(s.oldLoan.escrow);
    el('laResNewEscrow').textContent  = fmt(s.newLoan.escrow);
    el('laResOldTotal').innerHTML     = '<strong>' + fmt(s.oldLoan.total) + '</strong>';
    el('laResNewTotal').innerHTML     = '<strong>' + fmt(s.newLoan.total) + '</strong>';

    resultsEl.style.display = '';
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---- Reset ---- */
  function resetForm() {
    var inputs = document.querySelectorAll('.calc-page input[type="text"], .calc-page input[type="number"], .calc-page input[type="tel"], .calc-page input[type="email"]');
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].id === 'laLoCompany') continue;
      inputs[i].value = '';
    }
    // Reset selects to defaults
    el('laOldLoanType').value = 'Conventional';
    el('laNewLoanType').value = 'Conventional';
    el('laOldTerm').value = '30';
    el('laNewTerm').value = '30';
    el('laResults').style.display = 'none';
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', function() {
    el('laGenerateBtn').addEventListener('click', generate);
    el('laResetBtn').addEventListener('click', resetForm);
  });
})();
