/* =====================================================
   MSFG Report Templates
   Data extractors + HTML renderers for each calculator.
   ===================================================== */
(function () {
  'use strict';
  window.MSFG = window.MSFG || {};

  /* ---- helpers ---- */
  function val(doc, id) {
    var el = doc.getElementById(id);
    if (!el) return 0;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return parseFloat(el.value) || 0;
    return parseFloat((el.textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
  }
  function txt(doc, id) {
    var el = doc.getElementById(id);
    return el ? (el.value !== undefined && (el.tagName === 'INPUT' || el.tagName === 'SELECT') ? el.value : el.textContent || '').trim() : '';
  }
  function fmt(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }
  function fmt0(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  }
  function pct(n) { return n.toFixed(2) + '%'; }

  /* ---- income averaging policy label ---- */
  function methodLabel(y1, y2) {
    if (y2 !== 0 && y1 > y2) return '24-mo avg';
    return 'Recent ÷ 12';
  }

  /* ================================================
     EXTRACTORS — read calculator DOM → data object
     ================================================ */
  var extractors = {};

  /* ---- Income: 1040 ---- */
  extractors['income/1040'] = function (doc) {
    return {
      sections: [
        { title: 'W-2 Wage Income', rows: [
          { label: 'Employer 1', y1: val(doc,'w2_1_y1'), y2: val(doc,'w2_1_y2') },
          { label: 'Employer 2', y1: val(doc,'w2_2_y1'), y2: val(doc,'w2_2_y2') },
          { label: 'Employer 3', y1: val(doc,'w2_3_y1'), y2: val(doc,'w2_3_y2') },
          { label: 'Employer 4', y1: val(doc,'w2_4_y1'), y2: val(doc,'w2_4_y2') }
        ], monthly: val(doc,'w2_month') },
        { title: 'Alimony Received', rows: [
          { label: 'Alimony', y1: val(doc,'alimony1'), y2: val(doc,'alimony2') }
        ], monthly: val(doc,'alimony_month') },
        { title: 'Pension / Annuity', rows: [
          { label: 'IRA Distributions 1', y1: val(doc,'pen1_15_y1'), y2: val(doc,'pen1_15_y2') },
          { label: 'Pensions 1',          y1: val(doc,'pen1_16_y1'), y2: val(doc,'pen1_16_y2') },
          { label: 'IRA Distributions 2', y1: val(doc,'pen2_15_y1'), y2: val(doc,'pen2_15_y2') },
          { label: 'Pensions 2',          y1: val(doc,'pen2_16_y1'), y2: val(doc,'pen2_16_y2') },
          { label: 'IRA Distributions 3', y1: val(doc,'pen3_15_y1'), y2: val(doc,'pen3_15_y2') },
          { label: 'Pensions 3',          y1: val(doc,'pen3_16_y1'), y2: val(doc,'pen3_16_y2') }
        ], monthly: val(doc,'pension_month') },
        { title: 'Unemployment', rows: [
          { label: 'Unemployment', y1: val(doc,'unemp1'), y2: val(doc,'unemp2') }
        ], monthly: val(doc,'unemp_month') },
        { title: 'Social Security', rows: [
          { label: 'Social Security', y1: val(doc,'ss1'), y2: val(doc,'ss2') }
        ], monthly: val(doc,'ss_month') }
      ],
      totalMonthly: val(doc,'combined1040')
    };
  };

  /* ---- Income: Schedule C ---- */
  extractors['income/schedule-c'] = function (doc) {
    function biz(pfx) {
      return {
        rows: [
          { label: 'Net Profit/Loss',     y1: val(doc,pfx+'_np1'),    y2: val(doc,pfx+'_np2') },
          { label: 'Other Income',         y1: val(doc,pfx+'_oth1'),   y2: val(doc,pfx+'_oth2') },
          { label: 'Depletion',            y1: val(doc,pfx+'_depl1'),  y2: val(doc,pfx+'_depl2') },
          { label: 'Depreciation',         y1: val(doc,pfx+'_depr1'),  y2: val(doc,pfx+'_depr2') },
          { label: 'Meals Exclusion',      y1: val(doc,pfx+'_meals1'), y2: val(doc,pfx+'_meals2') },
          { label: 'Business Use of Home', y1: val(doc,pfx+'_home1'),  y2: val(doc,pfx+'_home2') },
          { label: 'Mileage Depreciation', y1: val(doc,pfx+'_mile1'),  y2: val(doc,pfx+'_mile2') },
          { label: 'Amortization',         y1: val(doc,pfx+'_amort1'), y2: val(doc,pfx+'_amort2') }
        ],
        year1: val(doc,pfx+'_year1'), year2: val(doc,pfx+'_year2'), monthly: val(doc,pfx+'_final')
      };
    }
    return {
      sections: [
        Object.assign({ title: 'Business 1' }, biz('b1')),
        Object.assign({ title: 'Business 2' }, biz('b2'))
      ],
      totalMonthly: val(doc,'combined_c')
    };
  };

  /* ---- Income: 1065 ---- */
  extractors['income/1065'] = function (doc) {
    function part(pfx) {
      return {
        rows: [
          { label: 'Ordinary Income',   y1: val(doc,pfx+'_ord1'),   y2: val(doc,pfx+'_ord2') },
          { label: 'Farm Profit/Loss',   y1: val(doc,pfx+'_farm1'),  y2: val(doc,pfx+'_farm2') },
          { label: 'Net Gain/Loss',      y1: val(doc,pfx+'_gain1'),  y2: val(doc,pfx+'_gain2') },
          { label: 'Other Income',       y1: val(doc,pfx+'_oth1'),   y2: val(doc,pfx+'_oth2') },
          { label: 'Depreciation',       y1: val(doc,pfx+'_dep1'),   y2: val(doc,pfx+'_dep2') },
          { label: 'Depletion',          y1: val(doc,pfx+'_depl1'),  y2: val(doc,pfx+'_depl2') },
          { label: 'Amortization',       y1: val(doc,pfx+'_amort1'), y2: val(doc,pfx+'_amort2') },
          { label: 'Mortgages Payable',  y1: val(doc,pfx+'_mort1'),  y2: val(doc,pfx+'_mort2') },
          { label: 'Meals Exclusion',    y1: val(doc,pfx+'_meals1'), y2: val(doc,pfx+'_meals2') }
        ],
        ownership: val(doc,pfx+'_owner'),
        year1: val(doc,pfx+'_year1'), year2: val(doc,pfx+'_year2'), monthly: val(doc,pfx+'_month')
      };
    }
    return {
      sections: [
        Object.assign({ title: 'Partnership 1' }, part('p1')),
        Object.assign({ title: 'Partnership 2' }, part('p2'))
      ],
      totalMonthly: val(doc,'combined1065')
    };
  };

  /* ---- Income: 1120 ---- */
  extractors['income/1120'] = function (doc) {
    return {
      sections: [{
        title: 'Form 1120 C-Corporation',
        rows: [
          { label: 'Capital Gain Net Income', y1: val(doc,'cap1'),      y2: val(doc,'cap2') },
          { label: 'Net Gain/Loss',           y1: val(doc,'net1'),      y2: val(doc,'net2') },
          { label: 'Other Income',            y1: val(doc,'oth1'),      y2: val(doc,'oth2') },
          { label: 'Depreciation',            y1: val(doc,'dep1'),      y2: val(doc,'dep2') },
          { label: 'Depletion',               y1: val(doc,'depl1'),     y2: val(doc,'depl2') },
          { label: 'DPA Deduction',           y1: val(doc,'dpd1'),      y2: val(doc,'dpd2') },
          { label: 'Amortization',            y1: val(doc,'amort1'),    y2: val(doc,'amort2') },
          { label: 'Net Operating Loss',      y1: val(doc,'nol1'),      y2: val(doc,'nol2') },
          { label: 'Taxable Income',          y1: val(doc,'taxable1'),  y2: val(doc,'taxable2') },
          { label: 'Total Tax',               y1: val(doc,'totaltax1'), y2: val(doc,'totaltax2') },
          { label: 'Mortgages Payable',       y1: val(doc,'mort1'),     y2: val(doc,'mort2') },
          { label: 'Meals Exclusion',         y1: val(doc,'meals1'),    y2: val(doc,'meals2') },
          { label: 'Dividends Paid',          y1: val(doc,'dividend1'), y2: val(doc,'dividend2') }
        ],
        ownership: val(doc,'ownership'),
        year1: val(doc,'yr1_total'), year2: val(doc,'yr2_total'), monthly: val(doc,'monthly_income')
      }],
      totalMonthly: val(doc,'monthly_income')
    };
  };

  /* ---- Income: 1120S ---- */
  extractors['income/1120s'] = function (doc) {
    function corp(pfx) {
      return {
        rows: [
          { label: 'Net Gain/Loss',      y1: val(doc,pfx+'_net1'),   y2: val(doc,pfx+'_net2') },
          { label: 'Other Income',       y1: val(doc,pfx+'_oth1'),   y2: val(doc,pfx+'_oth2') },
          { label: 'Depreciation',       y1: val(doc,pfx+'_dep1'),   y2: val(doc,pfx+'_dep2') },
          { label: 'Depletion',          y1: val(doc,pfx+'_depl1'),  y2: val(doc,pfx+'_depl2') },
          { label: 'Amortization',       y1: val(doc,pfx+'_amort1'), y2: val(doc,pfx+'_amort2') },
          { label: 'Mortgages Payable',  y1: val(doc,pfx+'_mort1'),  y2: val(doc,pfx+'_mort2') },
          { label: 'Meals Exclusion',    y1: val(doc,pfx+'_meals1'), y2: val(doc,pfx+'_meals2') }
        ],
        ownership: val(doc,pfx+'_owner'),
        year1: val(doc,pfx+'_year1'), year2: val(doc,pfx+'_year2'), monthly: val(doc,pfx+'_month')
      };
    }
    return {
      sections: [
        Object.assign({ title: 'S-Corporation 1' }, corp('c1')),
        Object.assign({ title: 'S-Corporation 2' }, corp('c2'))
      ],
      totalMonthly: val(doc,'combined_s')
    };
  };

  /* ---- Income: K-1 (1065) ---- */
  extractors['income/k1'] = function (doc) {
    function k(pfx) {
      return {
        rows: [
          { label: 'Ordinary Income',     y1: val(doc,pfx+'_ord1'),   y2: val(doc,pfx+'_ord2') },
          { label: 'Net Rental RE',       y1: val(doc,pfx+'_rent1'),  y2: val(doc,pfx+'_rent2') },
          { label: 'Other Rental',        y1: val(doc,pfx+'_other1'), y2: val(doc,pfx+'_other2') },
          { label: 'Guaranteed Payments', y1: val(doc,pfx+'_guar1'),  y2: val(doc,pfx+'_guar2') }
        ],
        year1: val(doc,pfx+'_yr1'), year2: val(doc,pfx+'_yr2'), monthly: val(doc,pfx+'_month')
      };
    }
    return {
      sections: [
        Object.assign({ title: 'K-1 #1' }, k('k1')),
        Object.assign({ title: 'K-1 #2' }, k('k2')),
        Object.assign({ title: 'K-1 #3' }, k('k3')),
        Object.assign({ title: 'K-1 #4' }, k('k4'))
      ],
      totalMonthly: val(doc,'combinedK1')
    };
  };

  /* ---- Income: 1120S K-1 ---- */
  extractors['income/1120s-k1'] = function (doc) {
    function k(pfx) {
      return {
        rows: [
          { label: 'Ordinary Income', y1: val(doc,pfx+'_ord1'),   y2: val(doc,pfx+'_ord2') },
          { label: 'Net Rental RE',   y1: val(doc,pfx+'_rent1'),  y2: val(doc,pfx+'_rent2') },
          { label: 'Other Rental',    y1: val(doc,pfx+'_other1'), y2: val(doc,pfx+'_other2') }
        ],
        year1: val(doc,pfx+'_yr1'), year2: val(doc,pfx+'_yr2'), monthly: val(doc,pfx+'_month')
      };
    }
    return {
      sections: [
        Object.assign({ title: 'K-1 #1' }, k('k1')),
        Object.assign({ title: 'K-1 #2' }, k('k2')),
        Object.assign({ title: 'K-1 #3' }, k('k3')),
        Object.assign({ title: 'K-1 #4' }, k('k4'))
      ],
      totalMonthly: val(doc,'combinedK1')
    };
  };

  /* ---- Income: Schedule B ---- */
  extractors['income/schedule-b'] = function (doc) {
    function inst(pfx) {
      return {
        name: txt(doc, pfx + '_name'),
        rows: [
          { label: 'Interest Income',     y1: val(doc,pfx+'_interest_y1'),   y2: val(doc,pfx+'_interest_y2') },
          { label: 'Tax-Exempt Interest',  y1: val(doc,pfx+'_taxexempt_y1'),  y2: val(doc,pfx+'_taxexempt_y2') },
          { label: 'Dividend Income',      y1: val(doc,pfx+'_dividend_y1'),   y2: val(doc,pfx+'_dividend_y2') }
        ]
      };
    }
    return {
      borrower: txt(doc,'borrowerName'),
      sections: [
        Object.assign({ title: 'Institution 1' }, inst('inst1')),
        Object.assign({ title: 'Institution 2' }, inst('inst2')),
        Object.assign({ title: 'Institution 3' }, inst('inst3'))
      ],
      totalYear1: val(doc,'totalYear1'), totalYear2: val(doc,'totalYear2'),
      totalMonthly: val(doc,'incomeToUse')
    };
  };

  /* ---- Income: Schedule D ---- */
  extractors['income/schedule-d'] = function (doc) {
    return {
      sections: [{
        title: 'Capital Gains / Losses',
        rows: [
          { label: 'Short-Term Capital Gain/Loss', y1: val(doc,'d_stcg1'), y2: val(doc,'d_stcg2') },
          { label: 'Long-Term Capital Gain/Loss',  y1: val(doc,'d_ltcg1'), y2: val(doc,'d_ltcg2') }
        ],
        year1: val(doc,'d_total1'), year2: val(doc,'d_total2'), monthly: val(doc,'d_monthly')
      }],
      totalMonthly: val(doc,'d_monthly')
    };
  };

  /* ---- Income: Schedule E ---- */
  extractors['income/schedule-e'] = function (doc) {
    return {
      borrower: txt(doc,'borrowerName'),
      sections: [{
        title: txt(doc,'prop1_address') || 'Property 1',
        rows: [
          { label: 'Rents Received',    y1: val(doc,'prop1_rents_y1'),     y2: val(doc,'prop1_rents_y2') },
          { label: 'Royalties',         y1: val(doc,'prop1_royalties_y1'), y2: val(doc,'prop1_royalties_y2') },
          { label: 'Amortization',      y1: val(doc,'prop1_amort_y1'),     y2: val(doc,'prop1_amort_y2') },
          { label: 'Total Expenses',    y1: val(doc,'prop1_expenses_y1'),  y2: val(doc,'prop1_expenses_y2') },
          { label: 'Depreciation',      y1: val(doc,'prop1_deprec_y1'),    y2: val(doc,'prop1_deprec_y2') },
          { label: 'Insurance',         y1: val(doc,'prop1_insurance_y1'), y2: val(doc,'prop1_insurance_y2') },
          { label: 'Mortgage Interest', y1: val(doc,'prop1_mortint_y1'),   y2: val(doc,'prop1_mortint_y2') },
          { label: 'Taxes',             y1: val(doc,'prop1_taxes_y1'),     y2: val(doc,'prop1_taxes_y2') }
        ],
        monthlyPayment: val(doc,'prop1_monthly_pmt'),
        monthly: val(doc,'prop1_result')
      }],
      totalMonthly: val(doc,'totalMonthly')
    };
  };

  /* ---- Income: Schedule E Subject ---- */
  extractors['income/schedule-e-subject'] = function (doc) {
    return {
      sections: [{
        title: 'Subject Property',
        rows: [
          { label: 'Rents Received',    y1: val(doc,'sr1_rents'), y2: val(doc,'sr2_rents') },
          { label: 'Royalties',         y1: val(doc,'sr1_roy'),   y2: val(doc,'sr2_roy') },
          { label: 'Amortization',      y1: val(doc,'sr1_cas'),   y2: val(doc,'sr2_cas') },
          { label: 'Total Expenses',    y1: val(doc,'sr1_exp'),   y2: val(doc,'sr2_exp') },
          { label: 'Depreciation',      y1: val(doc,'sr1_dep'),   y2: val(doc,'sr2_dep') },
          { label: 'Insurance',         y1: val(doc,'sr1_ins'),   y2: val(doc,'sr2_ins') },
          { label: 'Mortgage Interest', y1: val(doc,'sr1_int'),   y2: val(doc,'sr2_int') },
          { label: 'Taxes',             y1: val(doc,'sr1_tax'),   y2: val(doc,'sr2_tax') }
        ],
        year1: val(doc,'sr_total1'), year2: val(doc,'sr_total2'), monthly: val(doc,'sr_avg')
      }],
      totalMonthly: val(doc,'sr_avg')
    };
  };

  /* ---- Income: Schedule F ---- */
  extractors['income/schedule-f'] = function (doc) {
    return {
      sections: [{
        title: 'Farm Income',
        rows: [
          { label: 'Net Profit/Loss',       y1: val(doc,'f_np1'),    y2: val(doc,'f_np2') },
          { label: 'Coop & CCC Payments',   y1: val(doc,'f_coop1'),  y2: val(doc,'f_coop2') },
          { label: 'Other Income/Loss',      y1: val(doc,'f_other1'), y2: val(doc,'f_other2') },
          { label: 'Depreciation',           y1: val(doc,'f_dep1'),   y2: val(doc,'f_dep2') },
          { label: 'Amortization/Depletion', y1: val(doc,'f_amort1'), y2: val(doc,'f_amort2') },
          { label: 'Business Use of Home',   y1: val(doc,'f_home1'),  y2: val(doc,'f_home2') },
          { label: 'Meals Exclusion',        y1: val(doc,'f_meals1'), y2: val(doc,'f_meals2') }
        ],
        year1: val(doc,'f_total1'), year2: val(doc,'f_total2'), monthly: val(doc,'f_monthly')
      }],
      totalMonthly: val(doc,'f_monthly')
    };
  };

  /* ---- Income: Rental 1038 ---- */
  extractors['income/rental-1038'] = function (doc) {
    return {
      methodA: {
        address: txt(doc,'methodA_address'),
        months: val(doc,'methodA_months'),
        rents: val(doc,'methodA_rents'),
        expenses: val(doc,'methodA_expenses'),
        insurance: val(doc,'methodA_insurance'),
        mortgageInterest: val(doc,'methodA_mortint'),
        taxes: val(doc,'methodA_taxes'),
        hoa: val(doc,'methodA_hoa'),
        depreciation: val(doc,'methodA_deprec'),
        oneTime: val(doc,'methodA_onetime'),
        pitia: val(doc,'methodA_pitia'),
        adjusted: val(doc,'methodA_adjusted'),
        result: val(doc,'methodA_result')
      },
      methodB: {
        address: txt(doc,'methodB_address'),
        grossRent: val(doc,'methodB_grossrent'),
        pitia: val(doc,'methodB_pitia'),
        adjusted: val(doc,'methodB_adjusted'),
        result: val(doc,'methodB_result')
      },
      totalMonthly: val(doc,'methodA_result')
    };
  };

  /* ---- General: Cash vs Mortgage ---- */
  extractors['cash-vs-mortgage'] = function (doc) {
    return {
      inputs: {
        price: val(doc,'priceCash'), closingCash: val(doc,'closingCash'),
        closingMort: val(doc,'closingMortgage'), downPct: val(doc,'downPct'),
        rate: val(doc,'mortRate'), term: val(doc,'mortTerm'),
        investReturn: val(doc,'investReturn'), appreciation: val(doc,'appreciation'),
        period: val(doc,'periodCash')
      },
      results: {
        costCash: txt(doc,'costCash'), costMortgage: txt(doc,'costMortgage'),
        difference: txt(doc,'diffCashMort'),
        recommendation: txt(doc,'recommendation')
      },
      breakdown: {
        cash: {
          purchasePrice: txt(doc,'cashPurchasePrice'), closingCosts: txt(doc,'cashClosingCosts'),
          appreciation: txt(doc,'cashAppreciation'), total: txt(doc,'cashTotal')
        },
        mortgage: {
          downPayment: txt(doc,'mortDownPayment'), closingCosts: txt(doc,'mortClosingCosts'),
          payments: txt(doc,'mortPayments'), investmentBalance: txt(doc,'mortInvestmentBalance'),
          remainingBalance: txt(doc,'mortRemainingBalance'), investmentGrowth: txt(doc,'mortInvestmentGrowth'),
          appreciation: txt(doc,'mortAppreciation'), total: txt(doc,'mortTotal')
        }
      }
    };
  };

  /* ---- General: Buy vs Rent ---- */
  extractors['buy-vs-rent'] = function (doc) {
    return {
      inputs: {
        price: val(doc,'purchasePrice'), downPct: val(doc,'downPercent'),
        rate: val(doc,'rateBuy'), term: val(doc,'termBuy'),
        taxRate: val(doc,'taxRate'), insurance: val(doc,'insurance'),
        maintenance: val(doc,'maintenance'), appreciation: val(doc,'appreciation'),
        rent: val(doc,'rent'), rentIncrease: val(doc,'rentIncrease'),
        period: val(doc,'period'), investReturn: val(doc,'investmentReturn')
      },
      results: {
        monthlyPayment: txt(doc,'mortgagePay'), ownCost: txt(doc,'ownCost'),
        rentCost: txt(doc,'rentCost'), equity: txt(doc,'equity'),
        difference: txt(doc,'difference'), recommendation: txt(doc,'recommendationText')
      }
    };
  };

  /* ---- Government: FHA ---- */
  extractors['fha'] = function (doc) {
    return {
      inputs: {
        loanPurpose: txt(doc,'loanPurpose'), propertyType: txt(doc,'propertyType'),
        purchasePrice: val(doc,'purchasePrice'), appraisedValue: val(doc,'appraisedValue'),
        currentUpb: val(doc,'currentUpb'), closingCosts: val(doc,'closingCosts'),
        closingCostsCash: val(doc,'closingCostsCash'), prepaidsCash: val(doc,'prepaidsCash'),
        totalCredits: val(doc,'totalCredits'), escrowRefund: val(doc,'escrowRefund')
      },
      results: {
        baseLoan: txt(doc,'resultBaseLoan'), totalLoan: txt(doc,'resultTotalLoan'),
        ltv: txt(doc,'resultLtv'), ntb: txt(doc,'resultNtb'),
        cashToClose: txt(doc,'resultCashToClose')
      }
    };
  };

  /* ---- Government: VA Pre-Qual ---- */
  extractors['va-prequal'] = function (doc) {
    return {
      inputs: {
        borrower: txt(doc,'borrowerName'), familySize: txt(doc,'familySize'),
        region: txt(doc,'region'), mortgageAmount: val(doc,'mortgageAmount'),
        rate: txt(doc,'interestRate'), term: txt(doc,'loanTerm'),
        grossIncome: val(doc,'grossIncome'), squareFootage: val(doc,'squareFootage')
      },
      debts: {
        propertyTaxes: val(doc,'propertyTaxes'), homeInsurance: val(doc,'homeInsurance'),
        hoa: val(doc,'hoaDues'), carPayments: val(doc,'carPayments'),
        revolving: val(doc,'revolvingAccounts'), installment: val(doc,'installmentLoans'),
        childCare: val(doc,'childCare'), other: val(doc,'otherDebts')
      },
      results: {
        piPayment: txt(doc,'piPayment'), totalHousing: txt(doc,'totalHousing'),
        totalDebts: txt(doc,'totalDebts'), dtiRatio: txt(doc,'dtiRatio'),
        requiredResidual: txt(doc,'requiredResidual'), actualResidual: txt(doc,'actualResidual'),
        residualStatus: txt(doc,'residualStatus')
      }
    };
  };

  /* ---- General: APR ---- */
  extractors['apr'] = function (doc) {
    return {
      inputs: {
        loanAmount: val(doc,'loanAmount'), rate: val(doc,'interestRate'),
        term: txt(doc,'loanTerm'), discountPoints: val(doc,'discountPoints'),
        financedFees: val(doc,'financedFees'), prepaidFees: val(doc,'prepaidFees')
      },
      results: {
        monthlyPayment: txt(doc,'monthlyPayment'), amountFinanced: txt(doc,'amountFinanced'),
        financeCharges: txt(doc,'financeCharges'), apr: txt(doc,'aprResult'),
        noteRate: txt(doc,'noteRateDisplay'), aprDisplay: txt(doc,'aprDisplay'),
        aprSpread: txt(doc,'aprSpread')
      }
    };
  };

  /* ---- General: Refi ---- */
  extractors['refi'] = function (doc) {
    return {
      inputs: {
        currentBalance: val(doc,'currentBalance'), currentRate: val(doc,'currentRate'),
        remainingTerm: val(doc,'currentTermRemaining'), propertyValue: val(doc,'currentPropertyValue'),
        newAmount: val(doc,'refiLoanAmount'), newRate: val(doc,'refiRate'), newTerm: val(doc,'refiTerm')
      },
      results: {
        currentPayment: txt(doc,'currentPaymentDisplay'), newPayment: txt(doc,'refiPaymentDisplay'),
        monthlySavings: txt(doc,'resultMonthlySavings'), breakeven: txt(doc,'resultBreakevenNow'),
        totalClosingCosts: txt(doc,'resultTotalClosingCost'), netSavings: txt(doc,'resultNetSavings'),
        recommendation: txt(doc,'adviceHeadline')
      }
    };
  };


  /* ---- General: Blended Rate ---- */
  extractors['blended-rate'] = function (doc) {
    var debts = [];
    for (var i = 1; i <= 5; i++) {
      var b = val(doc,'d'+i+'_bal'), r = val(doc,'d'+i+'_rate'), p = val(doc,'d'+i+'_pay');
      if (b || r || p) debts.push({ label: 'Debt ' + i, balance: b, rate: r, payment: p });
    }
    return {
      debts: debts,
      results: {
        totalBalance: txt(doc,'totalBal'), totalPayment: txt(doc,'totalPay'),
        blendedRate: txt(doc,'blendedRate')
      }
    };
  };

  /* ---- General: Buydown ---- */
  extractors['buydown'] = function (doc) {
    return {
      inputs: {
        loanAmount: val(doc,'loanAmount'), noteRate: val(doc,'noteRate'),
        loanTerm: txt(doc,'loanTerm'), buydownType: txt(doc,'buydownType')
      },
      results: {
        basePayment: txt(doc,'basePayment'), year1Payment: txt(doc,'year1Payment'),
        year1Savings: txt(doc,'year1Savings'), totalCost: txt(doc,'totalCost')
      }
    };
  };

  /* ---- Government: Escrow Prepaids ---- */
  extractors['escrow'] = function (doc) {
    return {
      inputs: {
        loanType: txt(doc,'loanType'), state: txt(doc,'state'),
        closingDate: txt(doc,'closingDate'), annualTax: val(doc,'annualTax'),
        annualIns: val(doc,'annualIns'), cushionMonths: val(doc,'cushionMonths')
      },
      results: {
        taxDeposit: txt(doc,'resultTaxDeposit'), insDeposit: txt(doc,'resultInsDeposit'),
        totalDeposit: txt(doc,'resultTotalDeposit'), aggregateAdj: txt(doc,'resultAggregateAdj')
      }
    };
  };

  /* ---- Government: FHA Refinance ---- */
  extractors['fha-refi'] = function (doc) {
    return {
      inputs: {
        borrower: txt(doc,'borrowerName'), currentUpb: val(doc,'sl_upb'),
        originalLoan: val(doc,'sl_originalLoanAmount'),
        oldRate: val(doc,'ntb_oldRate'), newRate: val(doc,'ntb_newRate')
      },
      results: {
        totalClosingCosts: txt(doc,'sl_totalClosingCosts'), baseLoan: txt(doc,'sl_baseAmount'),
        newUfmip: txt(doc,'sl_newUFMIP'), finalMortgage: txt(doc,'sl_finalResult'),
        ufmipRefund: txt(doc,'sl_ufmipRefund')
      }
    };
  };

  /* ---- General: REO Investment ---- */
  extractors['reo'] = function (doc) {
    return {
      inputs: {
        address: (txt(doc,'street') + ' ' + txt(doc,'city')).trim(),
        purchasePrice: val(doc,'purchasePrice'), downPct: val(doc,'downPct'),
        rate: val(doc,'rate'), term: val(doc,'termYears'),
        grossRents: val(doc,'grossRents'), appreciation: val(doc,'appreciation')
      },
      results: {
        renoTotal: txt(doc,'renoTotal'), cashInvested: txt(doc,'cashInvested'),
        noiMonthly: txt(doc,'noiMonthly'), r2p: txt(doc,'r2p'),
        year1CapRate: txt(doc,'cap1'), year1CashFlow: txt(doc,'cf1'),
        year1CoC: txt(doc,'coc1')
      }
    };
  };


  /* ================================================
     RENDERERS — data object → clean report HTML
     ================================================ */
  var renderers = {};

  /* Shared: income table renderer */
  function renderIncomeTable(data, calcName) {
    var html = '';
    var hasData = false;
    (data.sections || []).forEach(function (sec) {
      var sectionHasData = sec.rows && sec.rows.some(function (r) { return r.y1 || r.y2; });
      if (!sectionHasData && !sec.monthly) return;
      hasData = true;
      html += '<div class="rpt-section">';
      html += '<h4 class="rpt-section-title">' + sec.title;
      if (sec.ownership) html += ' <span class="rpt-ownership">(' + sec.ownership + '% ownership)</span>';
      html += '</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Line Item</th><th class="rpt-num">Year 1</th><th class="rpt-num">Year 2</th></tr></thead><tbody>';
      sec.rows.forEach(function (r) {
        if (!r.y1 && !r.y2) return;
        html += '<tr><td>' + r.label + '</td><td class="rpt-num">' + fmt(r.y1) + '</td><td class="rpt-num">' + fmt(r.y2) + '</td></tr>';
      });
      html += '</tbody></table>';
      if (sec.monthly !== undefined) {
        html += '<div class="rpt-subtotal"><span>Monthly Income</span><span>' + fmt(sec.monthly) + '</span></div>';
      }
      html += '</div>';
    });
    if (data.totalMonthly !== undefined) {
      html += '<div class="rpt-grand-total"><span>Total Monthly Income</span><span>' + fmt(data.totalMonthly) + '</span></div>';
    }
    return html;
  }

  /* Income renderers (all use shared table) */
  var incomeTypes = [
    'income/1040','income/schedule-c','income/1065','income/1120','income/1120s',
    'income/k1','income/1120s-k1','income/schedule-b','income/schedule-d',
    'income/schedule-e','income/schedule-e-subject','income/schedule-f'
  ];
  incomeTypes.forEach(function (type) {
    renderers[type] = function (data) { return renderIncomeTable(data, type); };
  });

  /* Income: Rental 1038 (unique layout) */
  renderers['income/rental-1038'] = function (data) {
    var a = data.methodA;
    var html = '<div class="rpt-section"><h4 class="rpt-section-title">Method A — Schedule E Analysis</h4>';
    if (a.address) html += '<p class="rpt-address">' + a.address + '</p>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    html += '<tr><td>Months in Service</td><td class="rpt-num">' + a.months + '</td></tr>';
    html += '<tr><td>Total Rents Received</td><td class="rpt-num">' + fmt(a.rents) + '</td></tr>';
    html += '<tr><td>Total Expenses</td><td class="rpt-num">' + fmt(a.expenses) + '</td></tr>';
    html += '<tr><td>Depreciation</td><td class="rpt-num">' + fmt(a.depreciation) + '</td></tr>';
    html += '<tr><td>Insurance</td><td class="rpt-num">' + fmt(a.insurance) + '</td></tr>';
    html += '<tr><td>Mortgage Interest</td><td class="rpt-num">' + fmt(a.mortgageInterest) + '</td></tr>';
    html += '<tr><td>Taxes</td><td class="rpt-num">' + fmt(a.taxes) + '</td></tr>';
    html += '<tr><td>HOA Dues</td><td class="rpt-num">' + fmt(a.hoa) + '</td></tr>';
    html += '<tr><td>PITIA Payment</td><td class="rpt-num">' + fmt(a.pitia) + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Monthly Qualifying Income</span><span>' + fmt(a.result) + '</span></div>';
    html += '</div>';
    return html;
  };

  /* General: Cash vs Mortgage */
  renderers['cash-vs-mortgage'] = function (data) {
    var inp = data.inputs;
    var brk = data.breakdown;
    var down = inp.price * inp.downPct / 100;
    var loan = inp.price - down;
    var html = '';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Scenario Parameters</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Purchase Price</span><span>' + fmt0(inp.price) + '</span></div>';
    html += '<div class="rpt-param"><span>Down Payment</span><span>' + pct(inp.downPct) + ' (' + fmt0(down) + ')</span></div>';
    html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt0(loan) + '</span></div>';
    html += '<div class="rpt-param"><span>Interest Rate</span><span>' + pct(inp.rate) + '</span></div>';
    html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.term + ' years</span></div>';
    html += '<div class="rpt-param"><span>Expected Investment Return</span><span>' + pct(inp.investReturn) + '</span></div>';
    html += '<div class="rpt-param"><span>Annual Property Appreciation</span><span>' + pct(inp.appreciation) + '</span></div>';
    html += '<div class="rpt-param"><span>Analysis Period</span><span>' + inp.period + ' years</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Cost Comparison</h4>';
    html += '<div class="rpt-comparison">';
    html += '<div class="rpt-compare-col"><h4>Cash Purchase</h4>';
    html += '<table class="rpt-table"><tbody>';
    html += '<tr><td>Purchase Price</td><td class="rpt-num">' + brk.cash.purchasePrice + '</td></tr>';
    html += '<tr><td>Closing Costs</td><td class="rpt-num">' + brk.cash.closingCosts + '</td></tr>';
    html += '<tr><td>Property Appreciation</td><td class="rpt-num">' + brk.cash.appreciation + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Net Cost</span><span>' + brk.cash.total + '</span></div>';
    html += '</div>';

    html += '<div class="rpt-compare-col"><h4>Mortgage Purchase</h4>';
    html += '<table class="rpt-table"><tbody>';
    html += '<tr><td>Down Payment</td><td class="rpt-num">' + brk.mortgage.downPayment + '</td></tr>';
    html += '<tr><td>Closing Costs</td><td class="rpt-num">' + brk.mortgage.closingCosts + '</td></tr>';
    html += '<tr><td>Total Mortgage Payments</td><td class="rpt-num">' + brk.mortgage.payments + '</td></tr>';
    html += '<tr><td>Investment Balance (end of term)</td><td class="rpt-num">' + brk.mortgage.investmentBalance + '</td></tr>';
    html += '<tr><td>Remaining Mortgage Balance</td><td class="rpt-num">' + brk.mortgage.remainingBalance + '</td></tr>';
    html += '<tr><td>Net Investment Benefit</td><td class="rpt-num">' + brk.mortgage.investmentGrowth + '</td></tr>';
    html += '<tr><td>Property Appreciation</td><td class="rpt-num">' + brk.mortgage.appreciation + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Net Cost</span><span>' + brk.mortgage.total + '</span></div>';
    html += '</div></div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Analysis</h4>';
    html += '<div class="rpt-recommendation"><span>Recommendation:</span> ' + data.results.recommendation + '</div>';
    html += '<div class="rpt-difference">Net Savings: ' + data.results.difference + '</div>';
    html += '</div>';
    return html;
  };

  /* General: Buy vs Rent */
  renderers['buy-vs-rent'] = function (data) {
    var inp = data.inputs; var res = data.results;
    var down = inp.price * inp.downPct / 100;
    var html = '';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Scenario Parameters</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Purchase Price</span><span>' + fmt0(inp.price) + '</span></div>';
    html += '<div class="rpt-param"><span>Down Payment</span><span>' + pct(inp.downPct) + ' (' + fmt0(down) + ')</span></div>';
    html += '<div class="rpt-param"><span>Interest Rate</span><span>' + pct(inp.rate) + '</span></div>';
    html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.term + ' years</span></div>';
    html += '<div class="rpt-param"><span>Property Tax Rate</span><span>' + pct(inp.taxRate) + '</span></div>';
    html += '<div class="rpt-param"><span>Home Appreciation</span><span>' + pct(inp.appreciation) + '</span></div>';
    html += '<div class="rpt-param"><span>Current Monthly Rent</span><span>' + fmt0(inp.rent) + '</span></div>';
    html += '<div class="rpt-param"><span>Rent Increase Rate</span><span>' + pct(inp.rentIncrease) + '</span></div>';
    html += '<div class="rpt-param"><span>Analysis Period</span><span>' + inp.period + ' years</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Cost Comparison</h4>';
    html += '<div class="rpt-comparison"><div class="rpt-compare-col">';
    html += '<h4>Buying</h4>';
    html += '<table class="rpt-table"><tbody>';
    html += '<tr><td>Monthly Mortgage Payment</td><td class="rpt-num">' + res.monthlyPayment + '</td></tr>';
    html += '<tr><td>Total Ownership Cost</td><td class="rpt-num">' + res.ownCost + '</td></tr>';
    html += '<tr><td>Net Equity at Sale</td><td class="rpt-num">' + res.equity + '</td></tr>';
    html += '</tbody></table>';
    html += '</div><div class="rpt-compare-col">';
    html += '<h4>Renting</h4>';
    html += '<table class="rpt-table"><tbody>';
    html += '<tr><td>Total Rent Paid</td><td class="rpt-num">' + res.rentCost + '</td></tr>';
    html += '</tbody></table>';
    html += '</div></div>';
    html += '<div class="rpt-grand-total"><span>Financial Impact</span><span>' + res.difference + '</span></div>';
    html += '</div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Analysis</h4>';
    html += '<div class="rpt-recommendation"><span>Recommendation:</span> ' + (res.recommendation || '') + '</div>';
    html += '</div>';
    return html;
  };

  /* Government: FHA */
  renderers['fha'] = function (data) {
    var inp = data.inputs; var res = data.results;
    var html = '';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Scenario</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Loan Purpose</span><span>' + inp.loanPurpose + '</span></div>';
    html += '<div class="rpt-param"><span>Property Type</span><span>' + inp.propertyType + '</span></div>';
    html += '<div class="rpt-param"><span>Purchase Price</span><span>' + fmt0(inp.purchasePrice) + '</span></div>';
    html += '<div class="rpt-param"><span>Appraised Value</span><span>' + fmt0(inp.appraisedValue) + '</span></div>';
    if (inp.closingCosts) html += '<div class="rpt-param"><span>Financed Closing Costs</span><span>' + fmt0(inp.closingCosts) + '</span></div>';
    if (inp.closingCostsCash) html += '<div class="rpt-param"><span>Cash Closing Costs</span><span>' + fmt0(inp.closingCostsCash) + '</span></div>';
    if (inp.prepaidsCash) html += '<div class="rpt-param"><span>Prepaids / Escrows</span><span>' + fmt0(inp.prepaidsCash) + '</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">FHA Loan Results</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    html += '<tr><td>Maximum Base FHA Loan</td><td class="rpt-num">' + res.baseLoan + '</td></tr>';
    html += '<tr><td>Total Loan Amount (w/ UFMIP)</td><td class="rpt-num">' + res.totalLoan + '</td></tr>';
    html += '<tr><td>Implied LTV</td><td class="rpt-num">' + res.ltv + '</td></tr>';
    html += '<tr><td>Net Tangible Benefit</td><td class="rpt-num">' + res.ntb + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Estimated Cash to Close</span><span>' + res.cashToClose + '</span></div>';
    html += '</div>';
    return html;
  };

  /* Government: VA Pre-Qual */
  renderers['va-prequal'] = function (data) {
    var inp = data.inputs; var dbt = data.debts; var res = data.results;
    var html = '';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Borrower Information</h4>';
    html += '<div class="rpt-params">';
    if (inp.borrower) html += '<div class="rpt-param"><span>Borrower</span><span>' + inp.borrower + '</span></div>';
    html += '<div class="rpt-param"><span>Family Size</span><span>' + inp.familySize + '</span></div>';
    html += '<div class="rpt-param"><span>Region</span><span>' + inp.region + '</span></div>';
    html += '<div class="rpt-param"><span>Gross Monthly Income</span><span>' + fmt0(inp.grossIncome) + '</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Details</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Mortgage Amount</span><span>' + fmt0(inp.mortgageAmount) + '</span></div>';
    html += '<div class="rpt-param"><span>Interest Rate</span><span>' + inp.rate + '</span></div>';
    html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.term + '</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Qualification Results</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    html += '<tr><td>Principal & Interest Payment</td><td class="rpt-num">' + res.piPayment + '</td></tr>';
    html += '<tr><td>Total Monthly Housing</td><td class="rpt-num">' + res.totalHousing + '</td></tr>';
    html += '<tr><td>Total Monthly Debts</td><td class="rpt-num">' + res.totalDebts + '</td></tr>';
    html += '<tr><td>Debt-to-Income Ratio</td><td class="rpt-num">' + res.dtiRatio + '</td></tr>';
    html += '</tbody></table></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Residual Income Analysis</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    html += '<tr><td>Required Residual Income</td><td class="rpt-num">' + res.requiredResidual + '</td></tr>';
    html += '<tr><td>Actual Residual Income</td><td class="rpt-num">' + res.actualResidual + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Residual Income Status</span><span>' + res.residualStatus + '</span></div>';
    html += '</div>';
    return html;
  };

  /* General: APR */
  renderers['apr'] = function (data) {
    var inp = data.inputs; var res = data.results;
    var html = '';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Parameters</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt0(inp.loanAmount) + '</span></div>';
    html += '<div class="rpt-param"><span>Note Rate</span><span>' + pct(inp.rate) + '</span></div>';
    html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.term + '</span></div>';
    html += '<div class="rpt-param"><span>Discount Points</span><span>' + pct(inp.discountPoints) + '</span></div>';
    if (inp.financedFees) html += '<div class="rpt-param"><span>Total Financed Fees</span><span>' + fmt0(inp.financedFees) + '</span></div>';
    if (inp.prepaidFees) html += '<div class="rpt-param"><span>Total Prepaid Fees</span><span>' + fmt0(inp.prepaidFees) + '</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">APR Disclosure</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    html += '<tr><td>Monthly Payment (P&I)</td><td class="rpt-num">' + res.monthlyPayment + '</td></tr>';
    html += '<tr><td>Amount Financed</td><td class="rpt-num">' + res.amountFinanced + '</td></tr>';
    html += '<tr><td>Total Finance Charges</td><td class="rpt-num">' + res.financeCharges + '</td></tr>';
    html += '<tr><td>Note Rate</td><td class="rpt-num">' + res.noteRate + '</td></tr>';
    html += '<tr><td>APR Spread</td><td class="rpt-num">' + res.aprSpread + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Annual Percentage Rate (APR)</span><span>' + res.apr + '</span></div>';
    html += '</div>';
    return html;
  };

  /* General: Refi */
  renderers['refi'] = function (data) {
    var inp = data.inputs; var res = data.results;
    var html = '';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Current Loan</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Current Balance</span><span>' + fmt0(inp.currentBalance) + '</span></div>';
    html += '<div class="rpt-param"><span>Current Rate</span><span>' + pct(inp.currentRate) + '</span></div>';
    if (inp.remainingTerm) html += '<div class="rpt-param"><span>Remaining Term</span><span>' + inp.remainingTerm + ' months</span></div>';
    if (inp.propertyValue) html += '<div class="rpt-param"><span>Property Value</span><span>' + fmt0(inp.propertyValue) + '</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Proposed Refinance</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>New Loan Amount</span><span>' + fmt0(inp.newAmount) + '</span></div>';
    html += '<div class="rpt-param"><span>New Rate</span><span>' + pct(inp.newRate) + '</span></div>';
    if (inp.newTerm) html += '<div class="rpt-param"><span>New Term</span><span>' + inp.newTerm + ' months</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Refinance Analysis</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    html += '<tr><td>Current Monthly P&I</td><td class="rpt-num">' + res.currentPayment + '</td></tr>';
    html += '<tr><td>New Monthly P&I</td><td class="rpt-num">' + res.newPayment + '</td></tr>';
    html += '<tr><td>Monthly Savings</td><td class="rpt-num">' + res.monthlySavings + '</td></tr>';
    html += '<tr><td>Total Closing Costs</td><td class="rpt-num">' + res.totalClosingCosts + '</td></tr>';
    html += '<tr><td>Breakeven Point</td><td class="rpt-num">' + res.breakeven + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Net Savings (Stay Period)</span><span>' + res.netSavings + '</span></div>';
    html += '</div>';

    if (res.recommendation) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Recommendation</h4>';
      html += '<div class="rpt-recommendation"><span>Recommendation:</span> ' + res.recommendation + '</div>';
      html += '</div>';
    }
    return html;
  };


  /* General: Blended Rate */
  renderers['blended-rate'] = function (data) {
    var html = '';
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Debt Summary</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Debt</th><th class="rpt-num">Balance</th><th class="rpt-num">Rate</th><th class="rpt-num">Payment</th></tr></thead><tbody>';
    (data.debts || []).forEach(function (d) {
      html += '<tr><td>' + d.label + '</td><td class="rpt-num">' + fmt(d.balance) + '</td><td class="rpt-num">' + pct(d.rate) + '</td><td class="rpt-num">' + fmt(d.payment) + '</td></tr>';
    });
    html += '</tbody></table>';
    var r = data.results;
    html += '<div class="rpt-subtotal"><span>Total Balance</span><span>' + r.totalBalance + '</span></div>';
    html += '<div class="rpt-subtotal"><span>Total Payment</span><span>' + r.totalPayment + '</span></div>';
    html += '</div>';
    html += '<div class="rpt-grand-total"><span>Blended Rate</span><span>' + r.blendedRate + '</span></div>';
    return html;
  };

  /* General: Buydown */
  renderers['buydown'] = function (data) {
    var inp = data.inputs; var res = data.results;
    var html = '';
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Parameters</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt0(inp.loanAmount) + '</span></div>';
    html += '<div class="rpt-param"><span>Note Rate</span><span>' + pct(inp.noteRate) + '</span></div>';
    html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.loanTerm + '</span></div>';
    html += '<div class="rpt-param"><span>Buydown Type</span><span>' + inp.buydownType + '</span></div>';
    html += '</div></div>';
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Payment Analysis</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    html += '<tr><td>Full Note-Rate Payment</td><td class="rpt-num">' + res.basePayment + '</td></tr>';
    html += '<tr><td>Year 1 Reduced Payment</td><td class="rpt-num">' + res.year1Payment + '</td></tr>';
    html += '<tr><td>Year 1 Monthly Savings</td><td class="rpt-num">' + res.year1Savings + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Total Buydown Cost</span><span>' + res.totalCost + '</span></div>';
    html += '</div>';
    return html;
  };

  /* Government: Escrow */
  renderers['escrow'] = function (data) {
    var inp = data.inputs; var res = data.results;
    var html = '';
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Escrow Scenario</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Loan Type</span><span>' + inp.loanType + '</span></div>';
    html += '<div class="rpt-param"><span>State</span><span>' + inp.state + '</span></div>';
    html += '<div class="rpt-param"><span>Closing Date</span><span>' + inp.closingDate + '</span></div>';
    html += '<div class="rpt-param"><span>Annual Property Tax</span><span>' + fmt0(inp.annualTax) + '</span></div>';
    html += '<div class="rpt-param"><span>Annual Homeowners Insurance</span><span>' + fmt0(inp.annualIns) + '</span></div>';
    html += '</div></div>';
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Escrow Deposit Breakdown</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Amount</th></tr></thead><tbody>';
    html += '<tr><td>Tax Escrow Deposit</td><td class="rpt-num">' + res.taxDeposit + '</td></tr>';
    html += '<tr><td>Insurance Escrow Deposit</td><td class="rpt-num">' + res.insDeposit + '</td></tr>';
    html += '<tr><td>Aggregate Adjustment</td><td class="rpt-num">' + res.aggregateAdj + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Total Initial Escrow Deposit</span><span>' + res.totalDeposit + '</span></div>';
    html += '</div>';
    return html;
  };

  /* Government: FHA Refi */
  renderers['fha-refi'] = function (data) {
    var inp = data.inputs; var res = data.results;
    var html = '';
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Current Loan Details</h4>';
    html += '<div class="rpt-params">';
    if (inp.borrower) html += '<div class="rpt-param"><span>Borrower</span><span>' + inp.borrower + '</span></div>';
    html += '<div class="rpt-param"><span>Current Unpaid Balance</span><span>' + fmt0(inp.currentUpb) + '</span></div>';
    html += '<div class="rpt-param"><span>Original Loan Amount</span><span>' + fmt0(inp.originalLoan) + '</span></div>';
    html += '<div class="rpt-param"><span>Current Interest Rate</span><span>' + pct(inp.oldRate) + '</span></div>';
    html += '<div class="rpt-param"><span>New Interest Rate</span><span>' + pct(inp.newRate) + '</span></div>';
    html += '</div></div>';
    html += '<div class="rpt-section"><h4 class="rpt-section-title">FHA Streamline Results</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Amount</th></tr></thead><tbody>';
    html += '<tr><td>Total Closing Costs</td><td class="rpt-num">' + res.totalClosingCosts + '</td></tr>';
    html += '<tr><td>Base Loan Amount</td><td class="rpt-num">' + res.baseLoan + '</td></tr>';
    html += '<tr><td>New UFMIP (1.75%)</td><td class="rpt-num">' + res.newUfmip + '</td></tr>';
    html += '<tr><td>UFMIP Refund</td><td class="rpt-num">' + res.ufmipRefund + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Maximum Streamline Mortgage</span><span>' + res.finalMortgage + '</span></div>';
    html += '</div>';
    return html;
  };

  /* General: REO */
  renderers['reo'] = function (data) {
    var inp = data.inputs; var res = data.results;
    var html = '';
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Property Details</h4>';
    html += '<div class="rpt-params">';
    if (inp.address) html += '<div class="rpt-param"><span>Property Address</span><span>' + inp.address + '</span></div>';
    html += '<div class="rpt-param"><span>Purchase Price</span><span>' + fmt0(inp.purchasePrice) + '</span></div>';
    html += '<div class="rpt-param"><span>Down Payment</span><span>' + pct(inp.downPct) + '</span></div>';
    html += '<div class="rpt-param"><span>Interest Rate</span><span>' + pct(inp.rate) + '</span></div>';
    html += '<div class="rpt-param"><span>Gross Monthly Rents</span><span>' + fmt0(inp.grossRents) + '</span></div>';
    html += '</div></div>';
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Investment Analysis</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    html += '<tr><td>Renovation Total</td><td class="rpt-num">' + res.renoTotal + '</td></tr>';
    html += '<tr><td>Total Cash Invested</td><td class="rpt-num">' + res.cashInvested + '</td></tr>';
    html += '<tr><td>Monthly Net Operating Income</td><td class="rpt-num">' + res.noiMonthly + '</td></tr>';
    html += '<tr><td>Rent-to-Price Ratio</td><td class="rpt-num">' + res.r2p + '</td></tr>';
    html += '<tr><td>Year 1 Cap Rate</td><td class="rpt-num">' + res.year1CapRate + '</td></tr>';
    html += '<tr><td>Year 1 Cash Flow</td><td class="rpt-num">' + res.year1CashFlow + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Year 1 Cash-on-Cash Return</span><span>' + res.year1CoC + '</span></div>';
    html += '</div>';
    return html;
  };


  /* ================================================
     PDFMAKE CONTENT GENERATORS
     ================================================ */
  var pdfGenerators = {};

  function pdfIncomeTable(data) {
    var content = [];
    (data.sections || []).forEach(function (sec) {
      var sectionHasData = sec.rows && sec.rows.some(function (r) { return r.y1 || r.y2; });
      if (!sectionHasData && !sec.monthly) return;
      content.push({ text: sec.title + (sec.ownership ? ' (' + sec.ownership + '% ownership)' : ''), style: 'sectionTitle', margin: [0, 8, 0, 4] });
      var body = [
        [{ text: 'Line Item', style: 'tableHeader' }, { text: 'Year 1', style: 'tableHeader', alignment: 'right' }, { text: 'Year 2', style: 'tableHeader', alignment: 'right' }]
      ];
      sec.rows.forEach(function (r) {
        if (!r.y1 && !r.y2) return;
        body.push([r.label, { text: fmt(r.y1), alignment: 'right' }, { text: fmt(r.y2), alignment: 'right' }]);
      });
      content.push({ table: { headerRows: 1, widths: ['*', 90, 90], body: body }, layout: 'lightHorizontalLines' });
      if (sec.monthly !== undefined) {
        content.push({ columns: [{ text: 'Monthly Income', bold: true }, { text: fmt(sec.monthly), alignment: 'right', bold: true }], margin: [0, 4, 0, 0] });
      }
    });
    if (data.totalMonthly !== undefined) {
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#2d6a4f' }], margin: [0, 10, 0, 4] });
      content.push({ columns: [{ text: 'TOTAL MONTHLY INCOME', bold: true, fontSize: 12, color: '#2d6a4f' }, { text: fmt(data.totalMonthly), alignment: 'right', bold: true, fontSize: 12, color: '#2d6a4f' }] });
    }
    return content;
  }

  incomeTypes.forEach(function (type) { pdfGenerators[type] = pdfIncomeTable; });
  pdfGenerators['income/rental-1038'] = function (data) {
    var a = data.methodA;
    var body = [
      [{ text: 'Item', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }],
      ['Months in Service', { text: String(a.months), alignment: 'right' }],
      ['Total Rents', { text: fmt(a.rents), alignment: 'right' }],
      ['Total Expenses', { text: fmt(a.expenses), alignment: 'right' }],
      ['Depreciation', { text: fmt(a.depreciation), alignment: 'right' }],
      ['PITIA Payment', { text: fmt(a.pitia), alignment: 'right' }]
    ];
    return [
      a.address ? { text: a.address, italics: true, margin: [0, 4, 0, 4] } : null,
      { table: { headerRows: 1, widths: ['*', 100], body: body }, layout: 'lightHorizontalLines' },
      { columns: [{ text: 'Monthly Qualifying Income', bold: true, fontSize: 12, color: '#2d6a4f' }, { text: fmt(a.result), alignment: 'right', bold: true, fontSize: 12, color: '#2d6a4f' }], margin: [0, 8, 0, 0] }
    ].filter(Boolean);
  };

  function pdfKeyValue(data, paramsList, resultsList, grandTotalLabel, grandTotalKey) {
    var content = [];
    if (paramsList && paramsList.length) {
      var pBody = paramsList.map(function (p) { return [p[0], { text: String(p[1]), alignment: 'right' }]; });
      content.push({ text: 'Parameters', style: 'sectionTitle', margin: [0, 4, 0, 4] });
      content.push({ table: { widths: ['*', 120], body: pBody }, layout: 'noBorders' });
    }
    if (resultsList && resultsList.length) {
      var rBody = [[{ text: 'Result', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }]];
      resultsList.forEach(function (r) { rBody.push([r[0], { text: String(r[1]), alignment: 'right' }]); });
      content.push({ text: 'Results', style: 'sectionTitle', margin: [0, 10, 0, 4] });
      content.push({ table: { headerRows: 1, widths: ['*', 120], body: rBody }, layout: 'lightHorizontalLines' });
    }
    return content;
  }

  pdfGenerators['cash-vs-mortgage'] = function (data) {
    var inp = data.inputs; var brk = data.breakdown; var res = data.results;
    return pdfKeyValue(data,
      [['Purchase Price', fmt0(inp.price)], ['Down Payment', pct(inp.downPct)], ['Rate', pct(inp.rate)], ['Term', inp.term + ' yrs'], ['Investment Return', pct(inp.investReturn)], ['Appreciation', pct(inp.appreciation)], ['Period', inp.period + ' yrs']],
      [['Cash Net Cost', brk.cash.total], ['Mortgage Net Cost', brk.mortgage.total], ['Difference', res.difference]],
      'Recommendation', null
    ).concat([{ text: res.recommendation, bold: true, fontSize: 11, color: '#2d6a4f', margin: [0, 8, 0, 0] }]);
  };

  pdfGenerators['fha'] = function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Purpose', inp.loanPurpose], ['Purchase Price', fmt0(inp.purchasePrice)], ['Appraised Value', fmt0(inp.appraisedValue)]],
      [['Base FHA Loan', res.baseLoan], ['Total Loan (w/ UFMIP)', res.totalLoan], ['LTV', res.ltv], ['Net Tangible Benefit', res.ntb], ['Cash to Close', res.cashToClose]]
    );
  };

  pdfGenerators['va-prequal'] = function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Borrower', inp.borrower || '—'], ['Mortgage', fmt0(inp.mortgageAmount)], ['Rate', inp.rate], ['Term', inp.term], ['Income', fmt0(inp.grossIncome) + '/mo']],
      [['P&I Payment', res.piPayment], ['Total Housing', res.totalHousing], ['Total Debts', res.totalDebts], ['DTI', res.dtiRatio], ['Required Residual', res.requiredResidual], ['Actual Residual', res.actualResidual], ['Status', res.residualStatus]]
    );
  };

  pdfGenerators['apr'] = function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Loan Amount', fmt0(inp.loanAmount)], ['Note Rate', pct(inp.rate)], ['Term', inp.term], ['Points', pct(inp.discountPoints)]],
      [['Monthly P&I', res.monthlyPayment], ['Amount Financed', res.amountFinanced], ['Finance Charges', res.financeCharges], ['APR Spread', res.aprSpread], ['APR', res.apr]]
    );
  };

  pdfGenerators['refi'] = function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Current Balance', fmt0(inp.currentBalance)], ['Current Rate', pct(inp.currentRate)], ['New Amount', fmt0(inp.newAmount)], ['New Rate', pct(inp.newRate)]],
      [['Current Payment', res.currentPayment], ['New Payment', res.newPayment], ['Monthly Savings', res.monthlySavings], ['Closing Costs', res.totalClosingCosts], ['Breakeven', res.breakeven], ['Net Savings', res.netSavings]]
    ).concat(res.recommendation ? [{ text: res.recommendation, bold: true, fontSize: 11, color: '#2d6a4f', margin: [0, 8, 0, 0] }] : []);
  };

  pdfGenerators['buy-vs-rent'] = function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Purchase Price', fmt0(inp.price)], ['Down Payment', pct(inp.downPct)], ['Rate', pct(inp.rate)], ['Rent', fmt0(inp.rent) + '/mo'], ['Period', inp.period + ' yrs']],
      [['Monthly Payment', res.monthlyPayment], ['Total Own Cost', res.ownCost], ['Total Rent Cost', res.rentCost], ['Net Equity', res.equity], ['Difference', res.difference]]
    ).concat(res.recommendation ? [{ text: res.recommendation, bold: true, fontSize: 11, color: '#2d6a4f', margin: [0, 8, 0, 0] }] : []);
  };

  pdfGenerators['blended-rate'] = function (data) {
    var body = [[{ text: 'Debt', style: 'tableHeader' }, { text: 'Balance', style: 'tableHeader', alignment: 'right' }, { text: 'Rate', style: 'tableHeader', alignment: 'right' }, { text: 'Payment', style: 'tableHeader', alignment: 'right' }]];
    (data.debts || []).forEach(function (d) { body.push([d.label, { text: fmt(d.balance), alignment: 'right' }, { text: pct(d.rate), alignment: 'right' }, { text: fmt(d.payment), alignment: 'right' }]); });
    var r = data.results;
    return [
      { table: { headerRows: 1, widths: ['*', 80, 60, 80], body: body }, layout: 'lightHorizontalLines' },
      { columns: [{ text: 'Blended Rate', bold: true, fontSize: 12, color: '#2d6a4f' }, { text: r.blendedRate, alignment: 'right', bold: true, fontSize: 12, color: '#2d6a4f' }], margin: [0, 8, 0, 0] }
    ];
  };

  pdfGenerators['buydown'] = function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Loan Amount', fmt0(inp.loanAmount)], ['Note Rate', pct(inp.noteRate)], ['Term', inp.loanTerm], ['Buydown Type', inp.buydownType]],
      [['Full Rate Payment', res.basePayment], ['Year 1 Payment', res.year1Payment], ['Year 1 Savings', res.year1Savings], ['Total Buydown Cost', res.totalCost]]
    );
  };

  pdfGenerators['escrow'] = function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Loan Type', inp.loanType], ['State', inp.state], ['Closing Date', inp.closingDate], ['Annual Tax', fmt0(inp.annualTax)], ['Annual Insurance', fmt0(inp.annualIns)]],
      [['Tax Escrow Deposit', res.taxDeposit], ['Insurance Escrow Deposit', res.insDeposit], ['Aggregate Adjustment', res.aggregateAdj], ['Total Initial Escrow', res.totalDeposit]]
    );
  };

  pdfGenerators['fha-refi'] = function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Borrower', inp.borrower || '—'], ['Current UPB', fmt0(inp.currentUpb)], ['Original Loan', fmt0(inp.originalLoan)], ['Current Rate', pct(inp.oldRate)], ['New Rate', pct(inp.newRate)]],
      [['Closing Costs', res.totalClosingCosts], ['Base Loan', res.baseLoan], ['New UFMIP', res.newUfmip], ['UFMIP Refund', res.ufmipRefund], ['Max Streamline Mortgage', res.finalMortgage]]
    );
  };

  pdfGenerators['reo'] = function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Property', inp.address || '—'], ['Purchase Price', fmt0(inp.purchasePrice)], ['Down Payment', pct(inp.downPct)], ['Rate', pct(inp.rate)], ['Gross Rents', fmt0(inp.grossRents) + '/mo']],
      [['Renovation Total', res.renoTotal], ['Cash Invested', res.cashInvested], ['Monthly NOI', res.noiMonthly], ['Year 1 Cap Rate', res.year1CapRate], ['Year 1 Cash Flow', res.year1CashFlow], ['Year 1 Cash-on-Cash', res.year1CoC]]
    );
  };

  /* ---- Public API ---- */
  MSFG.ReportTemplates = {
    extractors: extractors,
    renderers: renderers,
    pdfGenerators: pdfGenerators,
    extract: function (slug, doc) {
      var fn = extractors[slug];
      return fn ? fn(doc) : null;
    },
    render: function (slug, data) {
      var fn = renderers[slug];
      return fn ? fn(data) : '<p class="rpt-no-template">No report template available for this calculator.</p>';
    },
    pdfContent: function (slug, data) {
      var fn = pdfGenerators[slug];
      return fn ? fn(data) : [{ text: 'No PDF template available.', italics: true }];
    }
  };
})();
