// calc-reo/reo.js

(function () {
  const $ = (id) => document.getElementById(id);

  const ids = [
    "street","city",
    "purchasePrice","downPct","rate","termYears","amortType","acqCosts",
    "renoPaint","renoFloor","renoAppl","renoFireplace","renoRoof","renoPest","renoOther",
    "renoMonths","renoValue","sellCostPct",
    "grossRents","hoa","adv","autoTravel","ins","landscape","propMaint","mgmt","otherExp","propTaxRate",
    "appreciation","rentIncrease","expIncrease","vacancy",
    "improvePct","taxBracket","deprYears"
  ];

  function n(v) {
    const x = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(x) ? x : 0;
  }

  function pct(v) { return n(v) / 100; }

  function money(x) {
    if (!Number.isFinite(x)) return "—";
    return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function money2(x) {
    if (!Number.isFinite(x)) return "—";
    return x.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function percent(x) {
    if (!Number.isFinite(x)) return "—";
    return (x * 100).toFixed(2) + "%";
  }

  // Excel-like PMT for monthly payments
  function pmt(ratePerPeriod, nper, pv) {
    if (ratePerPeriod === 0) return -(pv / nper);
    const r = ratePerPeriod;
    return -(pv * r) / (1 - Math.pow(1 + r, -nper));
  }

  function buildSchedule(principal, rateAnnual, termYears) {
    const r = rateAnnual / 12;
    const nper = Math.round(termYears * 12);
    const payment = pmt(r, nper, principal);

    let bal = principal;
    const months = [];

    for (let m = 1; m <= nper; m++) {
      const interest = bal * r;
      let princ = payment - interest;
      if (princ > bal) princ = bal;
      bal = Math.max(0, bal - princ);
      months.push({ interest, principal: princ, payment });
      if (bal <= 0.00001) break;
    }
    return { payment, months };
  }

  function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

  function calc() {
    // Inputs
    const purchasePrice = n($("purchasePrice").value);
    const downPct = pct($("downPct").value);
    const rate = pct($("rate").value);
    const termYears = n($("termYears").value);
    const amortType = $("amortType").value;
    const acqCosts = n($("acqCosts").value);

    const reno = sum([
      n($("renoPaint").value),
      n($("renoFloor").value),
      n($("renoAppl").value),
      n($("renoFireplace").value),
      n($("renoRoof").value),
      n($("renoPest").value),
      n($("renoOther").value),
    ]);

    const renoMonths = Math.max(0, Math.min(12, Math.round(n($("renoMonths").value))));
    const renoValueIn = n($("renoValue").value);
    const renValue = renoValueIn > 0 ? renoValueIn : purchasePrice;
    const sellCostPct = pct($("sellCostPct").value);

    const grossRents = n($("grossRents").value);
    const hoa = n($("hoa").value);

    const adv = n($("adv").value);
    const autoTravel = n($("autoTravel").value);
    const ins = n($("ins").value);
    const landscape = n($("landscape").value);
    const propMaint = n($("propMaint").value);
    const mgmt = n($("mgmt").value);
    const otherExp = n($("otherExp").value);

    const propTaxRate = pct($("propTaxRate").value); // annual rate
    const propTaxesMonthly = (purchasePrice * propTaxRate) / 12;

    const appreciation = pct($("appreciation").value);
    const rentIncrease = pct($("rentIncrease").value);
    const expIncrease = pct($("expIncrease").value);
    const vacancy = pct($("vacancy").value);

    const improvePct = pct($("improvePct").value);
    const deprYears = n($("deprYears").value);

    // Monthly NOI (as in sheet)
    const vacancyExpense = -(grossRents * vacancy);
    const grossIncomeMonthly = grossRents + vacancyExpense;

    const expensesMonthly =
      adv + autoTravel + hoa + ins + landscape + propMaint + mgmt + otherExp + propTaxesMonthly;

    const noiMonthly = grossIncomeMonthly - expensesMonthly;

    // Rent-to-Price ratio (monthly rent / purchase price)
    const r2p = purchasePrice > 0 ? (grossRents / purchasePrice) : 0;

    // Financing
    let loanAmount = 0;
    let schedule = null;

    if (amortType === "cash") {
      loanAmount = 0;
    } else {
      loanAmount = Math.max(0, purchasePrice * (1 - downPct));
      if (loanAmount > 0 && amortType === "pi") {
        schedule = buildSchedule(loanAmount, rate, termYears);
      }
    }

    // Cash invested (downpayment + acquisition costs)
    const downAmt = purchasePrice * downPct;
    const cashInvested = downAmt + acqCosts;

    // Depreciation approximation (sheet logic)
    // (purchasePrice + (renoTotal * improvePct)) / deprYears
    const annualDepreciation = deprYears > 0 ? (purchasePrice + (reno * improvePct)) / deprYears : 0;

    // 5-year projections
    const years = [1, 2, 3, 4, 5];

    const propValue = [];
    const grossIncomeAnnual = [];
    const expensesAnnual = [];
    const noiAnnual = [];
    const capRate = [];
    const debtService = [];
    const dcr = [];
    const cashFlow = [];
    const afterTaxCashFlow = [];
    const cashOnCash = [];
    const netEquity = [];
    const cumulativeAfterTaxReturn = [];

    // Property values: Year 1 starts from renovated value and appreciates
    let v = renValue;
    for (let i = 0; i < 5; i++) {
      v = v * (1 + appreciation);
      propValue.push(v);
    }

    // Annual income/expense base (monthly)
    // Year 1 reduced by renovation months: (12 - renoMonths)
    const monthsRentedYr1 = Math.max(0, 12 - renoMonths);

    // Base year (stabilized) monthly values
    const baseGrossIncomeMonthly = grossIncomeMonthly;
    const baseExpensesMonthly = expensesMonthly;

    for (let i = 0; i < 5; i++) {
      const yearIndex = i + 1;

      // Income
      let gi;
      if (yearIndex === 1) {
        gi = baseGrossIncomeMonthly * monthsRentedYr1;
      } else {
        gi = baseGrossIncomeMonthly * 12 * Math.pow(1 + rentIncrease, yearIndex - 1);
      }

      // Expenses
      let ex;
      if (yearIndex === 1) {
        ex = baseExpensesMonthly * monthsRentedYr1;
      } else {
        ex = baseExpensesMonthly * 12 * Math.pow(1 + expIncrease, yearIndex - 1);
      }

      const noi = gi - ex;

      grossIncomeAnnual.push(gi);
      expensesAnnual.push(ex);
      noiAnnual.push(noi);

      capRate.push(renValue > 0 ? noi / renValue : 0);

      // Debt service
      let ds = 0;
      let principalPaid = 0;

      if (loanAmount <= 0 || amortType === "cash") {
        ds = 0;
        principalPaid = 0;
      } else if (amortType === "io") {
        ds = loanAmount * rate; // annual interest-only
        principalPaid = 0;
      } else {
        // P&I: sum 12 months for that year
        const startMonth = (yearIndex - 1) * 12;
        const months = schedule ? schedule.months.slice(startMonth, startMonth + 12) : [];
        ds = sum(months.map(m => m.payment));
        principalPaid = sum(months.map(m => m.principal));
      }

      debtService.push(ds);

      // DCR
      dcr.push(ds > 0 ? (noi / ds) : NaN);

      // Cash flow
      const cf = noi - ds;
      cashFlow.push(cf);

      // After-tax cash flow (approx per legacy worksheet)
      const at = cf + annualDepreciation;
      afterTaxCashFlow.push(at);

      // Cash-on-cash (before-tax)
      cashOnCash.push(cashInvested > 0 ? (cf / cashInvested) : 0);

      // Equity and cumulative return
      // Appreciation vs purchase price (matches sheet: value - purchase price)
      const appreciationAmt = propValue[i] - purchasePrice;

      // Sell costs
      const sellCost = -(propValue[i] * sellCostPct);

      // Net equity = principal paid (cumulative) + appreciation + sellCost
      // For principal cumulative, we sum principal paid up to that year
      const paidPrincipalCum = sum(
        years.slice(0, yearIndex).map((_, idx) => {
          if (loanAmount <= 0 || amortType !== "pi") return 0;
          const sm = idx * 12;
          const ms = schedule ? schedule.months.slice(sm, sm + 12) : [];
          return sum(ms.map(m => m.principal));
        })
      );

      const eq = paidPrincipalCum + appreciationAmt + sellCost;
      netEquity.push(eq);

      const cumAT = sum(afterTaxCashFlow.slice(0, yearIndex));
      const car = cumAT + eq;
      cumulativeAfterTaxReturn.push(car);
    }

    // Summary outputs
    $("r2p").textContent = percent(r2p);
    $("renoTotal").textContent = money2(reno);
    $("renValueOut").textContent = money2(renValue);
    $("cashInvested").textContent = money2(cashInvested);
    $("noiMonthly").textContent = money2(noiMonthly);

    // Table fill
    const writeRow = (prefix, arr, formatter) => {
      for (let i = 0; i < 5; i++) {
        $(prefix + (i + 1)).textContent = formatter(arr[i]);
      }
    };

    writeRow("pv", propValue, money);
    writeRow("gi", grossIncomeAnnual, money);
    writeRow("ex", expensesAnnual, money);
    writeRow("noi", noiAnnual, money);
    writeRow("cap", capRate, percent);
    writeRow("ds", debtService, money);
    writeRow("dcr", dcr, (x) => (Number.isFinite(x) ? x.toFixed(2) : "N/A"));
    writeRow("cf", cashFlow, money);
    writeRow("at", afterTaxCashFlow, money);
    writeRow("coc", cashOnCash, percent);
    writeRow("eq", netEquity, money);
    writeRow("car", cumulativeAfterTaxReturn, money);
  }

  function bind() {
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", calc);
      el.addEventListener("change", calc);
    });

    $("btnRecalc").addEventListener("click", calc);
    $("btnPrint").addEventListener("click", () => window.print());
  }

  bind();
  calc();
})();