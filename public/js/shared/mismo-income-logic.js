'use strict';
/**
 * Income Documentation Logic — Enhanced
 * Decision tree to determine required income documentation
 * based on MISMO borrower employment and income data.
 *
 * Features:
 * - Employer-specific W-2/paystub requests (names the employer)
 * - Time-specific tax year references (calculates which years needed)
 * - Employment gap detection with LOE requirements
 * - Variable income detection (bonus, OT, commission, tips)
 * - Loan-program-aware requirements (FHA/VA/conventional)
 *
 * Namespace: MSFG.MISMOIncomeLogic
 * API: determineIncomeDocumentation(borrower, loanData)
 */
(function () {

  /**
   * Get the tax years needed based on how many years required.
   * E.g. if today is Feb 2026 and 2 years needed → "2024 & 2025"
   * If today is before April 15 of current year, prior year may not be filed yet.
   */
  function getTaxYears(yearsNeeded) {
    const now = new Date();
    const currentYear = now.getFullYear();
    // If before April 15, most recent filed year is 2 years ago
    const isBeforeTaxDeadline = now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 15);
    const latestFiledYear = isBeforeTaxDeadline ? currentYear - 2 : currentYear - 1;

    const years = [];
    for (let i = 0; i < yearsNeeded; i++) {
      years.push(latestFiledYear - i);
    }
    years.reverse();
    return years;
  }

  function formatTaxYears(yearsNeeded) {
    const years = getTaxYears(yearsNeeded);
    return years.join(' & ');
  }

  /**
   * @param {Object} borrower — parsed borrower data
   * @param {Object} [loanData] — optional loan-level data (isFHA, isVA, etc.)
   * @returns {Array} documentation items
   */
  function determineIncomeDocumentation(borrower, loanData) {
    const docs = [];
    const tag = '[' + borrower.name + ']';
    const loan = loanData || {};

    const isSelfEmployed = checkSelfEmployed(borrower);
    const hasAlimony = checkAlimony(borrower);
    const hasBaseIncome = checkBaseIncome(borrower);
    const isRetired = checkRetired(borrower);
    const otherIncomeTypes = checkOtherIncome(borrower);

    if (isSelfEmployed) processSelfEmployed(borrower, docs, tag, loan);
    if (hasAlimony) processAlimony(borrower, docs, tag);
    if (hasBaseIncome) processBaseIncome(borrower, docs, tag, loan);
    if (isRetired) processRetired(borrower, docs, tag);
    if (otherIncomeTypes.length > 0) processOtherIncome(borrower, otherIncomeTypes, docs, tag);

    // Employment gap detection
    if (typeof MSFG !== 'undefined' && MSFG.MISMODocParser && MSFG.MISMODocParser.detectEmploymentGaps) {
      const gaps = MSFG.MISMODocParser.detectEmploymentGaps(borrower);
      gaps.forEach(function (gap) {
        const fromLabel = gap.fromEmployer || 'prior employer';
        const toLabel = gap.toEmployer === '(current)' ? 'current date' : (gap.toEmployer || 'next employer');
        docs.push({
          name: tag + ' Letter of explanation — employment gap (' + gap.gapMonths + ' months: ' + fromLabel + ' → ' + toLabel + ')',
          status: 'required',
          reason: gap.gapMonths + '-month gap detected between ' + fromLabel + ' and ' + toLabel + '. LOE required for any gap >30 days.'
        });
      });
    }

    return docs;
  }

  function checkSelfEmployed(borrower) {
    const hasFlag = borrower.employments.some(function (emp) { return emp.isSelfEmployed; });
    const hasIncomeType = borrower.incomes.some(function (inc) {
      return (inc.type || '').match(/self|business|partnership|s-?corp|s\s*corporation|schedule\s*c|1099/i);
    });
    return hasFlag || hasIncomeType;
  }

  function checkAlimony(borrower) {
    return borrower.incomes.some(function (inc) {
      return (inc.type || '').match(/alimony|child\s*support/i);
    });
  }

  function checkBaseIncome(borrower) {
    return borrower.incomes.some(function (inc) {
      const type = inc.type || '';
      if (['Base', 'Hourly', 'Salary'].indexOf(type) !== -1) return true;
      return !!type.match(/military|contract\s*basis|wages/i);
    });
  }

  function checkRetired(borrower) {
    const hasRetiredClass = borrower.employments.some(function (emp) {
      return (emp.classificationType || '').match(/retired/i);
    });
    const hasRetirementIncome = borrower.incomes.some(function (inc) {
      return (inc.type || '').match(/social\s*security|pension|retirement|disability/i);
    });
    return hasRetiredClass || (borrower.employments.length === 0 && hasRetirementIncome);
  }

  function checkOtherIncome(borrower) {
    const otherTypes = [];
    borrower.incomes.forEach(function (inc) {
      const type = inc.type || '';
      if (type.match(/capital\s*gain/i)) otherTypes.push({ category: 'capitalGains', type: type, amount: inc.monthlyAmount });
      if (type.match(/dividend|interest/i) && !type.match(/capital/i)) otherTypes.push({ category: 'dividendInterest', type: type, amount: inc.monthlyAmount });
      if (type.match(/foster\s*care/i)) otherTypes.push({ category: 'fosterCare', type: type, amount: inc.monthlyAmount });
      if (type.match(/foreign/i)) otherTypes.push({ category: 'foreign', type: type, amount: inc.monthlyAmount });
      if (type.match(/unemployment/i)) otherTypes.push({ category: 'unemployment', type: type, amount: inc.monthlyAmount });
      if (type.match(/royalt/i)) otherTypes.push({ category: 'royalties', type: type, amount: inc.monthlyAmount });
      if (type.match(/trust/i)) otherTypes.push({ category: 'trust', type: type, amount: inc.monthlyAmount });
      if (type.match(/note\s*receivable|notes?\s*income/i)) otherTypes.push({ category: 'noteReceivable', type: type, amount: inc.monthlyAmount });
      if (type.match(/boarder|rental/i) && !type.match(/rent.*income/i)) otherTypes.push({ category: 'boarderIncome', type: type, amount: inc.monthlyAmount });
    });
    return otherTypes;
  }

  /* ---- Get employer label for specificity ---- */
  function employerLabel(emp) {
    if (!emp.employerName || emp.employerName === 'Employer') return '';
    return ' from ' + emp.employerName;
  }

  /* ---- Self-Employment ---- */
  function processSelfEmployed(borrower, docs, tag, loan) {
    const seEmployments = borrower.employments.filter(function (emp) { return emp.isSelfEmployed; });
    const oldestSE = seEmployments.sort(function (a, b) {
      return (a.startDate || new Date()) - (b.startDate || new Date());
    })[0];

    const yearsInBusiness = oldestSE && oldestSE.monthsEmployed
      ? oldestSE.monthsEmployed / 12
      : 0;

    const businessName = (oldestSE && oldestSE.employerName && oldestSE.employerName !== 'Employer')
      ? oldestSE.employerName : 'self-employed business';

    // Tax returns — years based on time in business
    const taxYearsNeeded = yearsInBusiness > 5 ? 1 : 2;
    const taxYearStr = formatTaxYears(taxYearsNeeded);

    docs.push({
      name: tag + ' Personal tax returns (1040s) — ' + taxYearStr,
      status: 'required',
      reason: 'Self-employed (' + businessName + ') for ' + Math.floor(yearsInBusiness) + ' years. ' +
              (taxYearsNeeded === 1 ? '>5 years: only 1 year required.' : '≤5 years: 2 years required.')
    });

    docs.push({
      name: tag + ' Year-to-date Profit & Loss (P&L) for ' + businessName,
      status: 'required',
      reason: 'Self-employment income requires current year performance documentation.'
    });

    // Business returns based on entity type
    seEmployments.forEach(function (emp) {
      const name = (emp.employerName && emp.employerName !== 'Employer') ? emp.employerName : 'Business';
      if (emp.is1120 || emp.isSCorp) {
        docs.push({
          name: tag + ' W-2' + employerLabel(emp),
          status: 'required',
          reason: name + ' is an S-Corporation or C-Corporation entity.'
        });
        docs.push({
          name: tag + ' 1120/1120S business tax returns — ' + taxYearStr + ' (' + name + ')',
          status: 'required',
          reason: 'Corporate entity requires business returns.'
        });
      } else if (emp.is1065 || emp.isPartnership) {
        docs.push({
          name: tag + ' 1065 partnership tax returns — ' + taxYearStr + ' (' + name + ')',
          status: 'required',
          reason: name + ' is a partnership entity.'
        });
      }
    });

    // Sole proprietor without entity flags
    const hasEntityFlags = seEmployments.some(function (e) {
      return e.is1120 || e.isSCorp || e.is1065 || e.isPartnership;
    });
    if (!hasEntityFlags) {
      docs.push({
        name: tag + ' Business bank statements — 3 months (' + businessName + ')',
        status: 'required',
        reason: 'Sole proprietor without separate business entity.'
      });
      docs.push({
        name: tag + ' Paycheck stubs from ' + businessName + ' (if generated)',
        status: 'conditional',
        reason: 'Provide if self-employed business generates paychecks.'
      });
    }

    // K-1 for <25% ownership
    seEmployments.forEach(function (emp) {
      if (emp.ownershipPercent !== null && emp.ownershipPercent < 25) {
        const name = (emp.employerName && emp.employerName !== 'Employer') ? emp.employerName : 'Business';
        docs.push({
          name: tag + ' K-1 tax form — ' + name + ' (ownership ' + emp.ownershipPercent + '%)',
          status: 'required',
          reason: 'Ownership interest is less than 25% of ' + name + '.'
        });
      }
    });

    // FHA: Business verification letter
    if (loan.isFHA) {
      docs.push({
        name: tag + ' Business verification letter or CPA letter (' + businessName + ')',
        status: 'required',
        reason: 'FHA requires verification that self-employed business is currently operational.'
      });
    }
  }

  /* ---- Alimony / Child Support ---- */
  function processAlimony(borrower, docs, tag) {
    docs.push({
      name: tag + ' Divorce decree or separation agreement',
      status: 'required',
      reason: 'Alimony or child support income requires legal documentation showing terms and amount.'
    });
    docs.push({
      name: tag + ' Bank statements — 6 months showing alimony/child support receipt',
      status: 'required',
      reason: 'Verify consistent receipt of alimony or child support payments.'
    });
    docs.push({
      name: tag + ' Proof of 3-year continuance of alimony/child support',
      status: 'required',
      reason: 'Income must continue for at least 3 years from closing to be qualifying.'
    });
  }

  /* ---- Base Income (W-2) ---- */
  function processBaseIncome(borrower, docs, tag, _loan) {
    const now = new Date();
    const w2Years = formatTaxYears(2);

    // Get all current W-2 employers for specific requests
    const currentW2Employers = borrower.employments.filter(function (emp) {
      return !emp.isSelfEmployed && emp.isCurrent;
    });
    const priorW2Employers = borrower.employments.filter(function (emp) {
      return !emp.isSelfEmployed && !emp.isCurrent;
    });

    // Paycheck stubs — employer-specific
    if (currentW2Employers.length > 0) {
      currentW2Employers.forEach(function (emp) {
        docs.push({
          name: tag + ' Paycheck stubs — 30 days most recent' + employerLabel(emp),
          status: 'required',
          reason: 'Standard documentation for W-2 employment income' +
                  (emp.employerName !== 'Employer' ? ' at ' + emp.employerName : '') + '.'
        });
      });
    } else {
      docs.push({
        name: tag + ' Paycheck stubs — 30 days (most recent)',
        status: 'required',
        reason: 'Standard documentation for W-2 employment income.'
      });
    }

    // W-2s — employer-specific with years
    const allW2Employers = borrower.employments.filter(function (emp) { return !emp.isSelfEmployed; });
    if (allW2Employers.length > 0) {
      const employerNames = [];
      allW2Employers.forEach(function (emp) {
        if (emp.employerName && emp.employerName !== 'Employer' && employerNames.indexOf(emp.employerName) === -1) {
          employerNames.push(emp.employerName);
        }
      });

      if (employerNames.length > 0) {
        docs.push({
          name: tag + ' W-2 forms — ' + w2Years + ' (from: ' + employerNames.join(', ') + ')',
          status: 'required',
          reason: 'Verify 2-year employment income history. Need W-2 from each employer during this period.'
        });
      } else {
        docs.push({
          name: tag + ' W-2 forms — ' + w2Years,
          status: 'required',
          reason: 'Verify 2-year employment income history.'
        });
      }
    }

    // New job (hired within 30 days) — employer-specific offer letter
    currentW2Employers.forEach(function (emp) {
      if (!emp.startDate) return;
      const daysEmployed = (now - emp.startDate) / (1000 * 60 * 60 * 24);
      if (daysEmployed <= 30) {
        docs.push({
          name: tag + ' Offer letter' + employerLabel(emp),
          status: 'required',
          reason: 'Employment at ' + (emp.employerName || 'new employer') + ' started within the last 30 days.'
        });
      }
    });

    // Recent job change (within 6 months) — need prior employer docs
    currentW2Employers.forEach(function (emp) {
      if (!emp.startDate) return;
      const daysEmployed = (now - emp.startDate) / (1000 * 60 * 60 * 24);
      if (daysEmployed > 30 && daysEmployed <= 180 && priorW2Employers.length > 0) {
        docs.push({
          name: tag + ' Final paystub from prior employer(s)',
          status: 'conditional',
          reason: 'Recent job change (within 6 months). Prior employer income may need verification.'
        });
      }
    });

    // Variable income detection
    const hasBonus = borrower.incomes.some(function (inc) { return (inc.type || '').match(/bonus/i); });
    const hasTips = borrower.incomes.some(function (inc) { return (inc.type || '').match(/tips/i); });
    const hasOT = borrower.incomes.some(function (inc) { return (inc.type || '').match(/overtime/i); });
    const hasCommission = borrower.incomes.some(function (inc) { return (inc.type || '').match(/commission/i); });
    const isPartTime = borrower.employments.some(function (emp) {
      return (emp.classificationType || '').match(/part[-\s]?time/i);
    });

    const variableTypes = [];
    if (hasBonus) variableTypes.push('bonus');
    if (hasTips) variableTypes.push('tips');
    if (hasOT) variableTypes.push('overtime');
    if (hasCommission) variableTypes.push('commission');
    if (isPartTime) variableTypes.push('part-time');

    if (variableTypes.length > 0) {
      const taxYearStr = formatTaxYears(2);
      docs.push({
        name: tag + ' Personal tax returns (1040s) — ' + taxYearStr,
        status: 'required',
        reason: 'Variable income (' + variableTypes.join(', ') + ') requires tax returns to establish 2-year average.'
      });
      docs.push({
        name: tag + ' Final paystub from each prior calendar year (2-year history)',
        status: 'required',
        reason: 'Variable income (' + variableTypes.join(', ') + ') requires year-end earnings verification.'
      });
    }

    // Military — LES instead of paystubs
    const hasMilitary = borrower.incomes.some(function (inc) { return (inc.type || '').match(/military/i); });
    if (hasMilitary) {
      docs.push({
        name: tag + ' Leave & Earnings Statement (LES) — most recent',
        status: 'required',
        reason: 'Military income uses LES in lieu of standard paystubs.'
      });
    }
  }

  /* ---- Retirement ---- */
  function processRetired(borrower, docs, tag) {
    const hasSS = borrower.incomes.some(function (inc) { return (inc.type || '').match(/social\s*security/i); });
    if (hasSS) {
      docs.push({
        name: tag + ' Social Security award letter OR bank statements showing current receipt',
        status: 'required',
        reason: 'Social Security income requires verification of award and receipt.'
      });
      docs.push({
        name: tag + ' Proof of 3-year continuance (if not borrower\'s own Social Security)',
        status: 'conditional',
        reason: 'Required if receiving Social Security on behalf of another person.'
      });
    }

    const hasPension = borrower.incomes.some(function (inc) { return (inc.type || '').match(/pension/i); });
    const hasDisability = borrower.incomes.some(function (inc) { return (inc.type || '').match(/disability/i); });
    if (hasPension || hasDisability) {
      const incomeType = hasPension ? 'Pension' : 'Disability';
      docs.push({
        name: tag + ' ' + incomeType + ' benefit statement or award letter',
        status: 'required',
        reason: incomeType + ' income requires documentation of benefit amount and continuance.'
      });
      docs.push({
        name: tag + ' Bank statements — 2 months showing ' + incomeType.toLowerCase() + ' deposit',
        status: 'required',
        reason: 'Verify ongoing receipt of ' + incomeType.toLowerCase() + ' benefits.'
      });
      docs.push({
        name: tag + ' Proof of 3-year continuance for ' + incomeType.toLowerCase(),
        status: 'conditional',
        reason: 'Required if ' + incomeType.toLowerCase() + ' benefit has an expiration date or is subject to review.'
      });
    }

    const hasRetDist = borrower.incomes.some(function (inc) {
      return (inc.type || '').match(/retirement|distribution|ira|401k|403b/i) &&
             !(inc.type || '').match(/social\s*security|pension/i);
    });
    if (hasRetDist) {
      docs.push({
        name: tag + ' Bank statements — 3 months showing retirement distribution receipt',
        status: 'required',
        reason: 'Regular retirement account distributions require proof of consistent receipt.'
      });
      docs.push({
        name: tag + ' Most recent retirement/investment account statement showing balance',
        status: 'required',
        reason: 'Verify sufficient assets to sustain 3-year continuance of distributions.'
      });
    }
  }

  /* ---- Other Income ---- */
  function processOtherIncome(borrower, otherIncomeTypes, docs, tag) {
    const seen = {};
    otherIncomeTypes.forEach(function (ot) { seen[ot.category] = true; });
    const taxYearStr = formatTaxYears(2);

    if (seen.capitalGains) {
      docs.push({
        name: tag + ' Personal tax returns (1040s) with Schedule D — ' + taxYearStr + ' (signed)',
        status: 'required',
        reason: 'Capital gains income requires Schedule D.'
      });
      docs.push({
        name: tag + ' Current asset/brokerage statement showing investment holdings',
        status: 'required',
        reason: 'Verify source and sufficient assets to sustain capital gains income for 3 years.'
      });
    }
    if (seen.dividendInterest) {
      docs.push({
        name: tag + ' Personal tax returns (1040s) with Schedule B — ' + taxYearStr + ' (signed)',
        status: 'required',
        reason: 'Dividend or interest income requires Schedule B.'
      });
      docs.push({
        name: tag + ' Current asset statement showing investment holdings',
        status: 'required',
        reason: 'Verify source and continuance of dividend/interest income.'
      });
    }
    if (seen.fosterCare) {
      docs.push({
        name: tag + ' Verification letter from foster care organization',
        status: 'required',
        reason: 'Foster care income requires official verification.'
      });
      docs.push({
        name: tag + ' Bank statements — 12 months showing foster care payment receipt',
        status: 'required',
        reason: 'Verify consistent receipt of foster care payments.'
      });
    }
    if (seen.foreign) {
      docs.push({
        name: tag + ' Personal tax returns (1040s) with Schedule B — ' + taxYearStr + ' (signed)',
        status: 'required',
        reason: 'Foreign income reported on US tax returns requires Schedule B.'
      });
      docs.push({
        name: tag + ' Documentation of foreign income source and amount',
        status: 'conditional',
        reason: 'May require additional documentation if not fully reported on US returns.'
      });
    }
    if (seen.unemployment) {
      docs.push({
        name: tag + ' Personal tax returns (1040s) — ' + taxYearStr,
        status: 'conditional',
        reason: 'Unemployment income requires tax returns if employment is seasonal (recurring annually).'
      });
      docs.push({
        name: tag + ' Unemployment benefit statements',
        status: 'required',
        reason: 'Verify unemployment benefit amount and duration.'
      });
    }
    if (seen.royalties) {
      docs.push({
        name: tag + ' Personal tax returns (1040s) with Schedule E — ' + taxYearStr + ' (signed)',
        status: 'required',
        reason: 'Royalty income requires Schedule E documentation.'
      });
      docs.push({
        name: tag + ' Royalty contract, agreement, or statement',
        status: 'required',
        reason: 'Confirm royalty amount, payment frequency, and duration.'
      });
    }
    if (seen.trust) {
      docs.push({
        name: tag + ' Full trust document',
        status: 'required',
        reason: 'Trust income requires complete trust documentation.'
      });
      docs.push({
        name: tag + ' Trust bank statements — 2 months showing distribution',
        status: 'required',
        reason: 'Verify continuance of trust distributions.'
      });
    }
    if (seen.noteReceivable) {
      docs.push({
        name: tag + ' Copy of note receivable with terms',
        status: 'required',
        reason: 'Note receivable income requires documentation of note terms.'
      });
      docs.push({
        name: tag + ' Bank statements — 12 months showing note payments received',
        status: 'required',
        reason: 'Verify consistent receipt of note payments.'
      });
    }
    if (seen.boarderIncome) {
      docs.push({
        name: tag + ' Personal tax returns (1040s) — ' + taxYearStr + ' (signed)',
        status: 'required',
        reason: 'Boarder income requires tax return verification.'
      });
      docs.push({
        name: tag + ' Bank statements — 12 months showing boarder payment receipt',
        status: 'required',
        reason: 'Verify consistent receipt of boarder income.'
      });
    }
  }

  window.MSFG = window.MSFG || {};
  window.MSFG.MISMOIncomeLogic = {
    determineIncomeDocumentation: determineIncomeDocumentation
  };
})();
