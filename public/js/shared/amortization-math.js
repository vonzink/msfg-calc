'use strict';

(function () {
  const cents = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // HUD ML 2023-05, Appendix 1.0. Base loan excludes financed UFMIP.
  // https://www.hud.gov/sites/dfiles/OCHCO/documents/2023-05hsgml.pdf
  const fhaPremium = (base, ltv, years) => {
    let rate;
    if (years > 15) rate = (base <= 726200 ? 0.005 : 0.007) + (ltv > 95 ? 0.0005 : 0);
    else if (base <= 726200) rate = ltv <= 90 ? 0.0015 : 0.004;
    else rate = ltv <= 78 ? 0.0015 : (ltv <= 90 ? 0.004 : 0.0065);
    return { rate, months: ltv <= 90 ? Math.min(132, years * 12) : years * 12 };
  };

  // VA fee chart effective April 7, 2023; verified November 3, 2026.
  // https://www.va.gov/housing-assistance/home-loans/funding-fee-and-closing-costs/
  const vaFeeRate = inputs => {
    if (inputs.vaExempt) return 0;
    if (inputs.mode === 'refinance') {
      if (inputs.vaRefiType === 'irrrl') return 0.005;
      return inputs.vaUse === 'subsequent' ? 0.033 : 0.0215;
    }
    const downPct = inputs.downPayment / inputs.homePrice * 100;
    if (downPct >= 10) return 0.0125;
    if (downPct >= 5) return 0.015;
    return inputs.vaUse === 'subsequent' ? 0.033 : 0.0215;
  };

  const loanDetails = inputs => {
    const basePrincipal = inputs.mode === 'refinance'
      ? inputs.refiLoanAmount + inputs.cashOut
      : inputs.homePrice - inputs.downPayment;
    const propertyValue = inputs.mode === 'refinance' ? inputs.appraisedValue : inputs.homePrice;
    const ltv = basePrincipal / propertyValue * 100;
    const feeRate = inputs.program === 'fha' ? 0.0175 : (inputs.program === 'va' ? vaFeeRate(inputs) : 0);
    const upfrontFee = cents(basePrincipal * feeRate);
    return {
      basePrincipal, propertyValue, ltv, feeRate, upfrontFee,
      principal: cents(basePrincipal + upfrontFee),
      mip: fhaPremium(basePrincipal, ltv, inputs.termYears)
    };
  };

  // Scheduled payments use cents; the last payment absorbs rounding and is capped at payoff.
  const schedule = (inputs, loan, extras) => {
    const rows = [];
    const months = inputs.termYears * 12;
    const monthlyPI = cents(MSFG.calcMonthlyPayment(loan.principal, inputs.annualRate, inputs.termYears));
    const extraStart = (inputs.extraStartYear - inputs.startYear) * 12 + inputs.extraStartMonth - inputs.startMonth;
    let balance = loan.principal;
    for (let index = 0; index < months && balance > 0; index++) {
      const interest = cents(balance * inputs.annualRate / 12);
      const principal = index === months - 1 ? balance : Math.min(balance, Math.max(0, cents(monthlyPI - interest)));
      const elapsed = index - extraStart;
      const extraDue = elapsed >= 0 && (inputs.extraFreq === 'monthly' ||
        (inputs.extraFreq === 'annually' && elapsed % 12 === 0) ||
        (inputs.extraFreq === 'one-time' && elapsed === 0));
      const extra = extras && extraDue ? Math.min(cents(inputs.extraAmount), cents(balance - principal)) : 0;
      const openingBalance = balance;
      balance = Math.max(0, cents(balance - principal - extra));
      const month = (inputs.startMonth + index) % 12;
      const year = inputs.startYear + Math.floor((inputs.startMonth + index) / 12);
      rows.push({
        paymentNum: index + 1, month, year, schedYear: Math.floor(index / 12) + 1,
        date: `${MONTHS[month]} ${year}`, openingBalance, principal, interest, extra, balance,
        payment: cents(principal + interest + extra),
        monthlyTax: cents(inputs.monthlyTax), monthlyIns: cents(inputs.monthlyIns),
        monthlyHOA: cents(inputs.monthlyHOA), pmiThisMonth: 0,
        ltv: balance / loan.propertyValue * 100
      });
    }
    return rows;
  };

  const calculate = inputs => {
    const loan = loanDetails(inputs);
    if (!Number.isFinite(loan.principal) || loan.principal <= 0 || loan.propertyValue <= 0 ||
        !Number.isFinite(inputs.annualRate) || inputs.annualRate < 0 || inputs.annualRate > 0.25 ||
        !Number.isInteger(inputs.termYears) || inputs.termYears < 1 || inputs.termYears > 40) return null;
    const baseSchedule = schedule(inputs, loan, false);
    const currentSchedule = schedule(inputs, loan, true);

    // Conventional PMI ends on the original scheduled 78% date, or after the midpoint.
    // Extra payments alone do not automatically trigger an earlier cancellation.
    // https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/
    const cutoff = baseSchedule.find(row => row.balance <= loan.propertyValue * 0.78);
    const pmiEnd = Math.min(cutoff ? cutoff.paymentNum : baseSchedule.length, inputs.termYears * 6 + 1);
    const mipByYear = {};
    if (inputs.program === 'fha') {
      // HUD periodic premium: average original scheduled opening balances, remove financed UFMIP.
      // https://www.hud.gov/hud-partners/housing-premium-calculation
      baseSchedule.forEach(row => {
        mipByYear[row.schedYear] = (mipByYear[row.schedYear] || 0) + row.openingBalance / 12;
      });
      Object.keys(mipByYear).forEach(year => {
        mipByYear[year] = cents(cents(cents(mipByYear[year] * loan.mip.rate) / 1.0175) / 12);
      });
    }
    [baseSchedule, currentSchedule].forEach(rows => rows.forEach(row => {
      if (inputs.program === 'fha' && row.paymentNum <= loan.mip.months) row.pmiThisMonth = mipByYear[row.schedYear];
      if (inputs.program === 'conventional' && loan.ltv > 80 && row.paymentNum < pmiEnd) row.pmiThisMonth = cents(inputs.monthlyPMI);
      row.totalMonthly = cents(row.payment + row.monthlyTax + row.monthlyIns + row.monthlyHOA + row.pmiThisMonth);
    }));
    const sum = (rows, key) => cents(rows.reduce((total, row) => total + row[key], 0));
    return {
      loan, schedule: currentSchedule, baseSchedule,
      monthlyPI: cents(MSFG.calcMonthlyPayment(loan.principal, inputs.annualRate, inputs.termYears)),
      totalInterest: sum(currentSchedule, 'interest'), totalExtra: sum(currentSchedule, 'extra'),
      totalCost: sum(currentSchedule, 'totalMonthly'),
      interestSaved: cents(sum(baseSchedule, 'interest') - sum(currentSchedule, 'interest')),
      monthsSaved: baseSchedule.length - currentSchedule.length, pmiEnd
    };
  };

  MSFG.AmortizationMath = { calculate, fhaPremium, vaFeeRate };
})();
