// calc-reo/reo-math.js
// Pure projection model for the REO Investment ROI calculator. No DOM access, so it
// can be unit-tested in Node (test/reo-math.test.js) and reused by the page (reo.js).
//
// Conventions
//   - All rates are decimals (0.06 = 6%).
//   - Renovation is paid in cash at purchase, so it is part of cash invested.
//   - Year-end figures: property value, loan balance and equity are as of the end of each year.
//   - Taxes: tax = (NOI - mortgage interest - depreciation) x bracket. A negative result is a
//     tax saving, which assumes the loss can be used against other income.
//   - Cap rate = a fully rented year's NOI / that year's property value (not the purchase-time value).
//   - Tax on a sale (optional, saleTax): gain = sale price - selling costs - adjusted basis, where
//     adjusted basis = price + closing costs + renovation - depreciation taken. 'long' taxes the
//     depreciation part of the gain at the bracket capped at 25% (unrecaptured section 1250) and the
//     rest at capGainsRate; 'short' taxes the whole gain at the bracket. A loss on sale gets no tax
//     benefit. State tax and the 3.8% net investment income tax are not modelled.
//   - Opportunity cost (optional, altReturn): the gain from investing the cash invested, as a lump
//     sum on day one, at that yearly rate with annual compounding.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ReoMath = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var YEARS = 5;
  // Unrecaptured section 1250 gain (depreciation taken) is taxed at the ordinary rate, capped at 25%.
  var RECAPTURE_RATE_CAP = 0.25;

  function num(x) {
    var v = Number(x);
    return Number.isFinite(v) ? v : 0;
  }

  function sum(arr) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += arr[i];
    return t;
  }

  // Level monthly payment (positive number).
  function payment(principal, monthlyRate, nper) {
    if (principal <= 0 || nper <= 0) return 0;
    if (monthlyRate === 0) return principal / nper;
    return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -nper));
  }

  // Month-by-month amortization: [{ interest, principal, payment, balance }]
  function buildSchedule(principal, rateAnnual, termYears) {
    var r = rateAnnual / 12;
    var nper = Math.round(termYears * 12);
    var pay = payment(principal, r, nper);
    var bal = principal;
    var months = [];
    for (var m = 1; m <= nper && bal > 0.005; m++) {
      var interest = bal * r;
      var princ = Math.min(bal, pay - interest);
      bal = Math.max(0, bal - princ);
      months.push({ interest: interest, principal: princ, payment: interest + princ, balance: bal });
    }
    return { payment: pay, months: months };
  }

  /**
   * @param {object} input
   *   purchasePrice, downPct, rate, termYears, amortType ('pi' | 'io' | 'cash'), acqCosts,
   *   renoTotal, renoMonths, renoValue (0 = purchase price), sellCostPct,
   *   grossRents (monthly), vacancy,
   *   carryMonthly  - insurance + HOA: paid every month, including during renovation
   *   operatingMonthly - advertising, travel, landscape, maintenance, management, other: only while rented
   *   propTaxRate (annual, on purchase price),
   *   appreciation, rentIncrease, expIncrease,
   *   improvePct (building share of price; land is not depreciable), taxBracket, deprYears,
   *   saleTax ('none' default | 'long' | 'short'), capGainsRate (long-term rate),
   *   altReturn (yearly return available elsewhere; 0 = no comparison)
   */
  function project(input) {
    var price = num(input.purchasePrice);
    var downPct = num(input.downPct);
    var rate = num(input.rate);
    var termYears = num(input.termYears);
    var amortType = input.amortType || 'pi';
    var acqCosts = num(input.acqCosts);
    var reno = num(input.renoTotal);
    var renoMonths = Math.max(0, Math.min(12, Math.round(num(input.renoMonths))));
    var renValue = num(input.renoValue) > 0 ? num(input.renoValue) : price;
    var sellCostPct = num(input.sellCostPct);
    var rents = num(input.grossRents);
    var vacancy = num(input.vacancy);
    var appreciation = num(input.appreciation);
    var rentIncrease = num(input.rentIncrease);
    var expIncrease = num(input.expIncrease);
    var improvePct = num(input.improvePct);
    var taxBracket = num(input.taxBracket);
    var deprYears = num(input.deprYears);
    var saleTaxMode = input.saleTax || 'none';
    var capGainsRate = num(input.capGainsRate);
    var altReturn = num(input.altReturn);

    var propTaxMonthly = (price * num(input.propTaxRate)) / 12;
    var carryMonthly = num(input.carryMonthly) + propTaxMonthly;
    var operatingMonthly = num(input.operatingMonthly);
    var incomeMonthly = rents * (1 - vacancy);
    var expensesMonthly = carryMonthly + operatingMonthly;
    var noiMonthly = incomeMonthly - expensesMonthly;

    // Financing
    var isCash = amortType === 'cash';
    var loanAmount = isCash ? 0 : Math.max(0, price * (1 - downPct));
    var downAmount = price - loanAmount;
    var schedule = (loanAmount > 0 && amortType === 'pi' && termYears > 0)
      ? buildSchedule(loanAmount, rate, termYears) : null;

    // Everything paid out of pocket to get the property rent-ready.
    var cashInvested = downAmount + acqCosts + reno;

    // Depreciation: building share of the acquisition cost plus the renovation, straight line.
    var depreciableBasis = (price + acqCosts) * improvePct + reno;
    var annualDepreciation = deprYears > 0 ? depreciableBasis / deprYears : 0;

    var monthsRentedYr1 = 12 - renoMonths;

    var out = {
      loanAmount: loanAmount,
      downAmount: downAmount,
      cashInvested: cashInvested,
      renoTotal: reno,
      renValue: renValue,
      monthlyPayment: schedule ? schedule.payment : (amortType === 'io' ? (loanAmount * rate) / 12 : 0),
      incomeMonthly: incomeMonthly,
      expensesMonthly: expensesMonthly,
      noiMonthly: noiMonthly,
      rentToPrice: price > 0 ? rents / price : 0,
      depreciableBasis: depreciableBasis,
      annualDepreciation: annualDepreciation,
      years: [],
      propValue: [], grossIncome: [], expenses: [], noi: [], capRate: [],
      debtService: [], interest: [], principalPaid: [], loanBalance: [], dcr: [],
      cashFlow: [], taxableIncome: [], incomeTax: [], afterTaxCashFlow: [], cashOnCash: [],
      netEquity: [], accumulatedDepreciation: [], gainOnSale: [], saleTax: [],
      cumAfterTaxCashFlow: [], cumulativeReturn: [], roi: [], altGain: [], vsAlt: []
    };

    var value = renValue;
    var cumAT = 0;

    for (var i = 0; i < YEARS; i++) {
      var year = i + 1;
      var rentGrowth = Math.pow(1 + rentIncrease, i);
      var expGrowth = Math.pow(1 + expIncrease, i);
      var monthsRented = year === 1 ? monthsRentedYr1 : 12;

      // Operations. Taxes, insurance and HOA are owed for all 12 months even while renovating.
      var gi = incomeMonthly * monthsRented * rentGrowth;
      var ex = (carryMonthly * 12 + operatingMonthly * monthsRented) * expGrowth;
      var noi = gi - ex;
      // A full, fully rented year at this year's rents and costs: the basis for the cap rate,
      // so renovation months in year 1 do not understate it.
      var stabilizedNoi = incomeMonthly * 12 * rentGrowth - expensesMonthly * 12 * expGrowth;

      // Debt
      var ds = 0, interest = 0, principalPaid = 0, balance = loanAmount;
      if (loanAmount > 0 && amortType === 'io') {
        interest = loanAmount * rate;
        ds = interest;
      } else if (schedule) {
        var months = schedule.months.slice(i * 12, i * 12 + 12);
        interest = sum(months.map(function (m) { return m.interest; }));
        principalPaid = sum(months.map(function (m) { return m.principal; }));
        ds = interest + principalPaid;
        var last = schedule.months[Math.min(schedule.months.length, year * 12) - 1];
        balance = last ? last.balance : loanAmount;
      }

      // Cash flow before and after income tax
      var cf = noi - ds;
      var taxable = noi - interest - annualDepreciation;
      var tax = taxable * taxBracket;
      var at = cf - tax;
      cumAT += at;

      // Position if sold at the end of the year
      value = value * (1 + appreciation);
      var realized = value * (1 - sellCostPct);
      var equity = realized - balance;

      // Tax on that sale
      var accDep = Math.min(depreciableBasis, annualDepreciation * year);
      var gain = realized - (price + acqCosts + reno - accDep);
      var saleTax = 0;
      if (gain > 0 && saleTaxMode === 'short') {
        saleTax = gain * taxBracket;
      } else if (gain > 0 && saleTaxMode === 'long') {
        var recapture = Math.min(accDep, gain);
        saleTax = recapture * Math.min(taxBracket, RECAPTURE_RATE_CAP) + (gain - recapture) * capGainsRate;
      }

      var totalReturn = cumAT + equity - saleTax - cashInvested;
      var altGain = cashInvested * (Math.pow(1 + altReturn, year) - 1);

      out.years.push(year);
      out.propValue.push(value);
      out.grossIncome.push(gi);
      out.expenses.push(ex);
      out.noi.push(noi);
      out.capRate.push(value > 0 ? stabilizedNoi / value : 0);
      out.debtService.push(ds);
      out.interest.push(interest);
      out.principalPaid.push(principalPaid);
      out.loanBalance.push(balance);
      out.dcr.push(ds > 0 ? noi / ds : NaN);
      out.cashFlow.push(cf);
      out.taxableIncome.push(taxable);
      out.incomeTax.push(tax);
      out.afterTaxCashFlow.push(at);
      out.cashOnCash.push(cashInvested > 0 ? cf / cashInvested : 0);
      out.netEquity.push(equity);
      out.accumulatedDepreciation.push(accDep);
      out.gainOnSale.push(gain);
      out.saleTax.push(saleTax);
      out.altGain.push(altGain);
      out.vsAlt.push(totalReturn - altGain);
      out.cumAfterTaxCashFlow.push(cumAT);
      out.cumulativeReturn.push(totalReturn);
      out.roi.push(cashInvested > 0 ? totalReturn / cashInvested : 0);
    }

    return out;
  }

  return { project: project, buildSchedule: buildSchedule, payment: payment, YEARS: YEARS };
});
