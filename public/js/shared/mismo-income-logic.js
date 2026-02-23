'use strict';
/**
 * Income Documentation Logic
 * Decision tree to determine required income documentation
 * based on MISMO borrower employment and income data.
 *
 * Namespace: MSFG.MISMOIncomeLogic
 * API: determineIncomeDocumentation(borrower)
 */
(function () {

  function determineIncomeDocumentation(borrower) {
    var docs = [];
    var tag = '[' + borrower.name + ']';

    var isSelfEmployed = checkSelfEmployed(borrower);
    var hasAlimony = checkAlimony(borrower);
    var hasBaseIncome = checkBaseIncome(borrower);
    var isRetired = checkRetired(borrower);
    var otherIncomeTypes = checkOtherIncome(borrower);

    if (isSelfEmployed) processSelfEmployed(borrower, docs, tag);
    if (hasAlimony) processAlimony(borrower, docs, tag);
    if (hasBaseIncome && !isSelfEmployed) processBaseIncome(borrower, docs, tag);
    if (isRetired) processRetired(borrower, docs, tag);
    if (otherIncomeTypes.length > 0) processOtherIncome(borrower, otherIncomeTypes, docs, tag);

    return docs;
  }

  function checkSelfEmployed(borrower) {
    var hasFlag = borrower.employments.some(function (emp) { return emp.isSelfEmployed; });
    var hasIncomeType = borrower.incomes.some(function (inc) {
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
      return ['Base', 'Hourly', 'Salary'].indexOf(inc.type) !== -1;
    });
  }

  function checkRetired(borrower) {
    var hasRetiredClass = borrower.employments.some(function (emp) {
      return (emp.classificationType || '').match(/retired/i);
    });
    var hasRetirementIncome = borrower.incomes.some(function (inc) {
      return (inc.type || '').match(/social\s*security|pension|retirement|disability/i);
    });
    return hasRetiredClass || (borrower.employments.length === 0 && hasRetirementIncome);
  }

  function checkOtherIncome(borrower) {
    var otherTypes = [];
    borrower.incomes.forEach(function (inc) {
      var type = inc.type || '';
      if (type.match(/capital\s*gain|dividend|interest/i)) otherTypes.push({ category: 'capitalGains', type: type, amount: inc.monthlyAmount });
      if (type.match(/foster\s*care/i)) otherTypes.push({ category: 'fosterCare', type: type, amount: inc.monthlyAmount });
      if (type.match(/foreign/i)) otherTypes.push({ category: 'foreign', type: type, amount: inc.monthlyAmount });
      if (type.match(/unemployment/i)) otherTypes.push({ category: 'unemployment', type: type, amount: inc.monthlyAmount });
      if (type.match(/royalt/i)) otherTypes.push({ category: 'royalties', type: type, amount: inc.monthlyAmount });
      if (type.match(/trust/i)) otherTypes.push({ category: 'trust', type: type, amount: inc.monthlyAmount });
    });
    return otherTypes;
  }

  /* ---- Self-Employment ---- */
  function processSelfEmployed(borrower, docs, tag) {
    var oldestEmployment = borrower.employments
      .filter(function (emp) { return emp.isSelfEmployed; })
      .sort(function (a, b) { return (a.startDate || new Date()) - (b.startDate || new Date()); })[0];

    var yearsInBusiness = oldestEmployment && oldestEmployment.monthsEmployed
      ? oldestEmployment.monthsEmployed / 12
      : 0;

    if (yearsInBusiness > 5) {
      docs.push({ name: tag + ' Personal tax returns (1040s) - 1 year', status: 'required',
        reason: 'Self-employed for ' + Math.floor(yearsInBusiness) + ' years (>5 years). Only 1 year required.' });
    } else {
      docs.push({ name: tag + ' Personal tax returns (1040s) - 2 years', status: 'required',
        reason: 'Self-employed for ' + Math.floor(yearsInBusiness) + ' years (\u22645 years). 2 years required.' });
    }

    docs.push({ name: tag + ' Year-to-date Profit & Loss (P&L) statement', status: 'required',
      reason: 'Self-employment income requires current year performance documentation.' });

    var hasBusinessReturns = borrower.employments.some(function (emp) {
      return emp.is1120 || emp.isSCorp || emp.is1065 || emp.isPartnership;
    });

    if (hasBusinessReturns) {
      var has1120 = borrower.employments.some(function (emp) { return emp.is1120 || emp.isSCorp; });
      if (has1120) {
        docs.push({ name: tag + ' Business W-2s', status: 'required',
          reason: 'S-Corporation or C-Corporation entity type.' });
        docs.push({ name: tag + ' 1120 and/or 1120S business tax returns - 2 years', status: 'required',
          reason: 'Corporate entity requires business returns.' });
      } else {
        var has1065 = borrower.employments.some(function (emp) { return emp.is1065 || emp.isPartnership; });
        if (has1065) {
          docs.push({ name: tag + ' 1065 partnership tax returns - 2 years', status: 'required',
            reason: 'Partnership entity requires 1065 returns.' });
        }
      }
    } else {
      docs.push({ name: tag + ' Business bank statements - 3 months', status: 'required',
        reason: 'Self-employed without separate business entity.' });
      docs.push({ name: tag + ' K-1 tax form', status: 'conditional',
        reason: 'May be required if receiving K-1 income.' });
      docs.push({ name: tag + ' Paycheck stubs (if generated)', status: 'conditional',
        reason: 'Provide if self-employed business generates paychecks.' });
    }

    var hasLessThan25 = borrower.employments.some(function (emp) {
      return emp.isSelfEmployed && emp.ownershipPercent !== null && emp.ownershipPercent < 25;
    });
    if (hasLessThan25) {
      docs.push({ name: tag + ' K-1 tax form (ownership < 25%)', status: 'required',
        reason: 'Ownership interest is less than 25% of the business.' });
    }
  }

  /* ---- Alimony / Child Support ---- */
  function processAlimony(borrower, docs, tag) {
    docs.push({ name: tag + ' Divorce decree or separation agreement', status: 'required',
      reason: 'Alimony or child support income requires legal documentation.' });
    docs.push({ name: tag + ' Bank statements - 6 months showing alimony/child support receipt', status: 'required',
      reason: 'Verify consistent receipt of alimony or child support payments.' });
  }

  /* ---- Base Income (W-2) ---- */
  function processBaseIncome(borrower, docs, tag) {
    docs.push({ name: tag + ' Paycheck stubs - 30 days (most recent)', status: 'required',
      reason: 'Standard documentation for W-2 employment income.' });
    docs.push({ name: tag + ' W-2 forms - 2 years', status: 'required',
      reason: 'Verify 2-year employment income history.' });

    var now = new Date();
    var hasNewJob = borrower.employments.some(function (emp) {
      if (!emp.startDate) return false;
      return (now - emp.startDate) / (1000 * 60 * 60 * 24) <= 30;
    });
    if (hasNewJob) {
      docs.push({ name: tag + ' Offer letter for new employment', status: 'required',
        reason: 'Employment started within the last 30 days.' });
    }

    var hasVariable = borrower.incomes.some(function (inc) { return (inc.type || '').match(/bonus/i); }) ||
                      borrower.incomes.some(function (inc) { return (inc.type || '').match(/tips/i); }) ||
                      borrower.incomes.some(function (inc) { return (inc.type || '').match(/overtime/i); }) ||
                      borrower.incomes.some(function (inc) { return (inc.type || '').match(/commission/i); });
    var isPartTime = borrower.employments.some(function (emp) {
      return (emp.classificationType || '').match(/part[-\s]?time/i);
    });
    if (hasVariable || isPartTime) {
      docs.push({ name: tag + ' Last paycheck from prior calendar year and/or each job over last 2 years', status: 'required',
        reason: 'Variable income (bonus/tips/overtime/commission) or part-time employment requires extended history.' });
    }
  }

  /* ---- Retirement ---- */
  function processRetired(borrower, docs, tag) {
    var hasSS = borrower.incomes.some(function (inc) { return (inc.type || '').match(/social\s*security/i); });
    if (hasSS) {
      docs.push({ name: tag + ' Social Security award letter OR bank statements showing current receipt', status: 'required',
        reason: 'Social Security income requires verification of award and receipt.' });
      docs.push({ name: tag + ' Proof of 3 years continuance (if not borrower\'s own Social Security)', status: 'conditional',
        reason: 'Required if receiving Social Security on behalf of another person.' });
    }

    var hasPension = borrower.incomes.some(function (inc) { return (inc.type || '').match(/pension/i); });
    var hasDisability = borrower.incomes.some(function (inc) { return (inc.type || '').match(/disability/i); });
    if (hasPension || hasDisability) {
      var incomeType = hasPension ? 'Pension' : 'Disability';
      docs.push({ name: tag + ' ' + incomeType + ' benefit statement or award letter', status: 'required',
        reason: incomeType + ' income requires documentation of benefit amount.' });
      docs.push({ name: tag + ' Bank statements showing 3 years continuance of ' + incomeType.toLowerCase(), status: 'required',
        reason: 'Verify ongoing receipt of ' + incomeType.toLowerCase() + ' benefits.' });
    }

    var hasRetDist = borrower.incomes.some(function (inc) {
      return (inc.type || '').match(/retirement|distribution|ira|401k|403b/i) &&
             !(inc.type || '').match(/social\s*security|pension/i);
    });
    if (hasRetDist) {
      docs.push({ name: tag + ' Bank statements - 3 months showing retirement distribution receipt', status: 'required',
        reason: 'Regular retirement account distributions require proof of consistent receipt.' });
    }
  }

  /* ---- Other Income ---- */
  function processOtherIncome(borrower, otherIncomeTypes, docs, tag) {
    var seen = {};
    otherIncomeTypes.forEach(function (ot) { seen[ot.category] = true; });

    if (seen.capitalGains) {
      docs.push({ name: tag + ' Personal tax returns (1040s) with Schedule D - 2 years (signed)', status: 'required',
        reason: 'Capital gains, dividend, or interest income requires Schedule D.' });
      docs.push({ name: tag + ' Current asset statement showing investment holdings', status: 'required',
        reason: 'Verify source and continuance of investment income.' });
    }
    if (seen.fosterCare) {
      docs.push({ name: tag + ' Verification letter from foster care organization', status: 'required',
        reason: 'Foster care income requires official verification.' });
      docs.push({ name: tag + ' Bank statements - 12 months showing foster care payment receipt', status: 'required',
        reason: 'Verify consistent receipt of foster care payments.' });
    }
    if (seen.foreign) {
      docs.push({ name: tag + ' Personal tax returns (1040s) with Schedule B - 2 years (signed)', status: 'required',
        reason: 'Foreign income reported on US tax returns requires Schedule B.' });
      docs.push({ name: tag + ' Documentation of foreign income source and amount', status: 'conditional',
        reason: 'May require additional documentation if not reported on US returns.' });
    }
    if (seen.unemployment) {
      docs.push({ name: tag + ' Personal tax returns (1040s) - 2 years', status: 'conditional',
        reason: 'Unemployment income requires tax returns if employment is seasonal (recurring annually).' });
      docs.push({ name: tag + ' Unemployment benefit statements', status: 'required',
        reason: 'Verify unemployment benefit amount and duration.' });
    }
    if (seen.royalties) {
      docs.push({ name: tag + ' Personal tax returns (1040s) with Schedule E - 2 years (signed)', status: 'required',
        reason: 'Royalty income requires Schedule E documentation.' });
      docs.push({ name: tag + ' Royalty contract, agreement, or statement', status: 'required',
        reason: 'Confirm royalty amount, payment frequency, and duration.' });
    }
    if (seen.trust) {
      docs.push({ name: tag + ' Full trust document', status: 'required',
        reason: 'Trust income requires complete trust documentation.' });
      docs.push({ name: tag + ' Trust bank statements - 2 months showing distribution', status: 'required',
        reason: 'Verify continuance of trust distributions.' });
    }
  }

  window.MSFG = window.MSFG || {};
  window.MSFG.MISMOIncomeLogic = {
    determineIncomeDocumentation: determineIncomeDocumentation
  };
})();
