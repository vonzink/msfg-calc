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
    return el ? (el.value !== undefined && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') ? el.value : el.textContent || '').trim() : '';
  }
  function fmt(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }
  function fmt0(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  }
  function pct(n) { return n.toFixed(2) + '%'; }
  function ratePct(n) { return parseFloat(n).toFixed(3) + '%'; }

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
    // Check if cost-of-waiting / double-refi sections are visible
    var cowSection = doc.getElementById('costOfWaitingResults');
    var cowVisible = cowSection && cowSection.style.display !== 'none';
    var drSection = doc.getElementById('doubleRefiResults');
    var drVisible = drSection && drSection.style.display !== 'none';

    var data = {
      inputs: {
        currentBalance: val(doc,'currentBalance'), currentRate: val(doc,'currentRate'),
        remainingTerm: val(doc,'currentTermRemaining'), propertyValue: val(doc,'currentPropertyValue'),
        currentLoanType: txt(doc,'currentLoanType'),
        newAmount: val(doc,'refiLoanAmount'), newRate: val(doc,'refiRate'), newTerm: val(doc,'refiTerm'),
        refiLoanType: txt(doc,'refiLoanType'),
        futureRate: val(doc,'futureRate'), monthsToWait: val(doc,'monthsToWait'),
        planToStay: val(doc,'planToStayMonths'), targetBreakeven: val(doc,'targetBreakeven')
      },
      refiNow: {
        currentPayment: txt(doc,'compareCurrentPayment'), newPayment: txt(doc,'compareNewPayment'),
        monthlySavings: txt(doc,'resultMonthlySavings'), breakeven: txt(doc,'resultBreakevenNow'),
        totalClosingCosts: txt(doc,'resultTotalClosingCost'), netSavings: txt(doc,'resultNetSavings')
      },
      recommendation: txt(doc,'adviceHeadline'),
      adviceDetail: txt(doc,'adviceDetail')
    };

    // Cost of Waiting
    if (cowVisible) {
      data.costOfWaiting = {
        extraInterest: txt(doc,'resultExtraInterest'),
        futurePayment: txt(doc,'resultFuturePayment'),
        futureSavings: txt(doc,'resultFutureSavings'),
        breakevenWait: txt(doc,'resultBreakevenWait'),
        // Breakdown comparison
        nowCosts: txt(doc,'breakdownNowCosts'),
        nowSavings: txt(doc,'breakdownNowSavings'),
        nowBreakeven: txt(doc,'breakdownNowBreakeven'),
        nowNet: txt(doc,'breakdownNowNet'),
        waitCosts: txt(doc,'breakdownWaitCosts'),
        waitExtra: txt(doc,'breakdownWaitExtra'),
        waitEffective: txt(doc,'breakdownWaitEffective'),
        waitSavings: txt(doc,'breakdownWaitSavings'),
        waitBreakeven: txt(doc,'breakdownWaitBreakeven'),
        waitNet: txt(doc,'breakdownWaitNet'),
        difference: txt(doc,'resultDifference'),
        differenceExplain: txt(doc,'differenceExplain')
      };
    }

    // Double Refi
    if (drVisible) {
      data.doubleRefi = {
        phase1Savings: txt(doc,'resultDoubleRefiPhase1Savings'),
        phase1Detail: txt(doc,'resultDoubleRefiPhase1Detail'),
        phase2Payment: txt(doc,'resultDoubleRefiPhase2Payment'),
        phase2Detail: txt(doc,'resultDoubleRefiPhase2Detail'),
        totalCosts: txt(doc,'resultDoubleRefiTotalCosts'),
        breakeven: txt(doc,'resultDoubleRefiBreakeven'),
        // 3-way comparison
        compare3NowCosts: txt(doc,'compare3NowCosts'),
        compare3NowSavings: txt(doc,'compare3NowSavings'),
        compare3NowNet: txt(doc,'compare3NowNet'),
        compare3DoubleCosts: txt(doc,'compare3DoubleCosts'),
        compare3DoublePhase1: txt(doc,'compare3DoublePhase1'),
        compare3DoublePhase2: txt(doc,'compare3DoublePhase2'),
        compare3DoubleNet: txt(doc,'compare3DoubleNet'),
        compare3WaitCosts: txt(doc,'compare3WaitCosts'),
        compare3WaitSavings: txt(doc,'compare3WaitSavings'),
        compare3WaitNet: txt(doc,'compare3WaitNet'),
        bestStrategy: txt(doc,'doubleRefiBestLabel'),
        bestExplain: txt(doc,'doubleRefiBestExplain')
      };
    }

    // Advice bullets
    var bullets = [];
    var bulletEls = doc.querySelectorAll('#adviceBullets li');
    bulletEls.forEach(function (li) {
      bullets.push({ text: li.textContent.trim(), type: li.classList.contains('con') ? 'con' : li.classList.contains('neutral-point') ? 'neutral' : 'pro' });
    });
    data.adviceBullets = bullets;

    // Backward compat aliases
    data.results = {
      currentPayment: data.refiNow.currentPayment, newPayment: data.refiNow.newPayment,
      monthlySavings: data.refiNow.monthlySavings, breakeven: data.refiNow.breakeven,
      totalClosingCosts: data.refiNow.totalClosingCosts, netSavings: data.refiNow.netSavings,
      recommendation: data.recommendation
    };

    return data;
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
    // Read year-by-year breakdown from rendered cards
    var years = [];
    var yearCards = doc.querySelectorAll('.year-card');
    yearCards.forEach(function (card) {
      var yearObj = {};
      var heading = card.querySelector('h4, h3, .year-header');
      if (heading) {
        var badge = heading.querySelector('.rate-badge');
        yearObj.rate = badge ? badge.textContent.trim() : '';
        var headClone = heading.cloneNode(true);
        var badgeInClone = headClone.querySelector('.rate-badge');
        if (badgeInClone) badgeInClone.remove();
        yearObj.label = headClone.textContent.trim();
      }
      var items = card.querySelectorAll('.year-item');
      items.forEach(function (item) {
        var lbl = item.querySelector('.label');
        var value = item.querySelector('.value');
        if (lbl && value) {
          var key = lbl.textContent.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
          yearObj[key] = value.textContent.trim();
        }
      });
      years.push(yearObj);
    });

    return {
      inputs: {
        loanAmount: val(doc,'loanAmount'), noteRate: val(doc,'noteRate'),
        loanTerm: txt(doc,'loanTerm'), buydownType: txt(doc,'buydownType')
      },
      results: {
        basePayment: txt(doc,'basePayment'), year1Payment: txt(doc,'year1Payment'),
        year1Savings: txt(doc,'year1Savings'), totalCost: txt(doc,'totalCost')
      },
      years: years
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
    html += '<div class="rpt-param"><span>Interest Rate</span><span>' + ratePct(inp.rate) + '</span></div>';
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
    html += '<div class="rpt-param"><span>Interest Rate</span><span>' + ratePct(inp.rate) + '</span></div>';
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
    html += '<div class="rpt-param"><span>Note Rate</span><span>' + ratePct(inp.rate) + '</span></div>';
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
    var inp = data.inputs;
    var now = data.refiNow || data.results || {};
    var html = '';

    /* Loan comparison header */
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Comparison</h4>';
    html += '<div class="rpt-comparison"><div class="rpt-compare-col"><h4>Current Loan</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Balance</span><span>' + fmt0(inp.currentBalance) + '</span></div>';
    html += '<div class="rpt-param"><span>Rate</span><span>' + ratePct(inp.currentRate) + '</span></div>';
    if (inp.currentLoanType) html += '<div class="rpt-param"><span>Loan Type</span><span>' + inp.currentLoanType + '</span></div>';
    if (inp.remainingTerm) html += '<div class="rpt-param"><span>Remaining Term</span><span>' + inp.remainingTerm + ' mo</span></div>';
    if (inp.propertyValue) html += '<div class="rpt-param"><span>Property Value</span><span>' + fmt0(inp.propertyValue) + '</span></div>';
    html += '<div class="rpt-param" style="font-weight:600"><span>Monthly P&I</span><span>' + (now.currentPayment || '') + '</span></div>';
    html += '</div></div>';
    html += '<div class="rpt-compare-col"><h4>Refinance Offer</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>New Amount</span><span>' + fmt0(inp.newAmount) + '</span></div>';
    html += '<div class="rpt-param"><span>New Rate</span><span>' + ratePct(inp.newRate) + '</span></div>';
    if (inp.refiLoanType) html += '<div class="rpt-param"><span>Loan Type</span><span>' + inp.refiLoanType + '</span></div>';
    if (inp.newTerm) html += '<div class="rpt-param"><span>New Term</span><span>' + inp.newTerm + ' mo</span></div>';
    html += '<div class="rpt-param" style="font-weight:600"><span>New Monthly P&I</span><span>' + (now.newPayment || '') + '</span></div>';
    html += '</div></div></div></div>';

    /* Refinance Now */
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Refinance Now</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Metric</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    html += '<tr><td>Monthly Savings</td><td class="rpt-num">' + (now.monthlySavings || '') + '</td></tr>';
    html += '<tr><td>Total Closing Costs</td><td class="rpt-num">' + (now.totalClosingCosts || '') + '</td></tr>';
    html += '<tr><td>Breakeven Point</td><td class="rpt-num">' + (now.breakeven || '') + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Net Savings (Stay Period)</span><span>' + (now.netSavings || '') + '</span></div>';
    html += '</div>';

    /* Cost of Waiting */
    if (data.costOfWaiting) {
      var cow = data.costOfWaiting;
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Cost of Waiting</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Metric</th><th class="rpt-num">Value</th></tr></thead><tbody>';
      html += '<tr><td>Extra Interest While Waiting</td><td class="rpt-num">' + cow.extraInterest + '</td></tr>';
      html += '<tr><td>Future Monthly Payment</td><td class="rpt-num">' + cow.futurePayment + '</td></tr>';
      html += '<tr><td>Future Monthly Savings</td><td class="rpt-num">' + cow.futureSavings + '</td></tr>';
      html += '<tr><td>Breakeven (If You Wait)</td><td class="rpt-num">' + cow.breakevenWait + '</td></tr>';
      html += '</tbody></table>';

      /* Refi Now vs Wait comparison */
      html += '<div class="rpt-comparison" style="margin-top:0.75rem;">';
      html += '<div class="rpt-compare-col"><h4>Refi Now</h4>';
      html += '<div class="rpt-params">';
      if (cow.nowCosts) html += '<div class="rpt-param"><span>Closing Costs</span><span>' + cow.nowCosts + '</span></div>';
      if (cow.nowSavings) html += '<div class="rpt-param"><span>Monthly Savings</span><span>' + cow.nowSavings + '</span></div>';
      if (cow.nowBreakeven) html += '<div class="rpt-param"><span>Breakeven</span><span>' + cow.nowBreakeven + '</span></div>';
      if (cow.nowNet) html += '<div class="rpt-param" style="font-weight:600"><span>Net Savings</span><span>' + cow.nowNet + '</span></div>';
      html += '</div></div>';
      html += '<div class="rpt-compare-col"><h4>Wait & Refi Later</h4>';
      html += '<div class="rpt-params">';
      if (cow.waitCosts) html += '<div class="rpt-param"><span>Closing Costs</span><span>' + cow.waitCosts + '</span></div>';
      if (cow.waitExtra) html += '<div class="rpt-param"><span>Extra Interest</span><span>' + cow.waitExtra + '</span></div>';
      if (cow.waitEffective) html += '<div class="rpt-param"><span>Effective Cost</span><span>' + cow.waitEffective + '</span></div>';
      if (cow.waitSavings) html += '<div class="rpt-param"><span>Monthly Savings</span><span>' + cow.waitSavings + '</span></div>';
      if (cow.waitBreakeven) html += '<div class="rpt-param"><span>Breakeven</span><span>' + cow.waitBreakeven + '</span></div>';
      if (cow.waitNet) html += '<div class="rpt-param" style="font-weight:600"><span>Net Savings</span><span>' + cow.waitNet + '</span></div>';
      html += '</div></div></div>';

      if (cow.difference) {
        html += '<div class="rpt-grand-total"><span>Net Difference</span><span>' + cow.difference + '</span></div>';
      }
      html += '</div>';
    }

    /* Double Refi */
    if (data.doubleRefi) {
      var dr = data.doubleRefi;
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Refi Twice Strategy</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Metric</th><th class="rpt-num">Value</th></tr></thead><tbody>';
      html += '<tr><td>Phase 1 Savings</td><td class="rpt-num">' + dr.phase1Savings + '</td></tr>';
      if (dr.phase1Detail) html += '<tr><td colspan="2" style="font-size:0.85em;color:#666;padding-left:1.5rem">' + dr.phase1Detail + '</td></tr>';
      html += '<tr><td>Phase 2 Payment</td><td class="rpt-num">' + dr.phase2Payment + '</td></tr>';
      if (dr.phase2Detail) html += '<tr><td colspan="2" style="font-size:0.85em;color:#666;padding-left:1.5rem">' + dr.phase2Detail + '</td></tr>';
      html += '<tr><td>Total Costs (2 Refis)</td><td class="rpt-num">' + dr.totalCosts + '</td></tr>';
      html += '<tr><td>Combined Breakeven</td><td class="rpt-num">' + dr.breakeven + '</td></tr>';
      html += '</tbody></table>';

      /* 3-way comparison */
      html += '<div class="rpt-comparison" style="margin-top:0.75rem;">';
      html += '<div class="rpt-compare-col"><h4>Refi Now Only</h4><div class="rpt-params">';
      if (dr.compare3NowCosts) html += '<div class="rpt-param"><span>Costs</span><span>' + dr.compare3NowCosts + '</span></div>';
      if (dr.compare3NowSavings) html += '<div class="rpt-param"><span>Savings</span><span>' + dr.compare3NowSavings + '</span></div>';
      if (dr.compare3NowNet) html += '<div class="rpt-param" style="font-weight:600"><span>Net</span><span>' + dr.compare3NowNet + '</span></div>';
      html += '</div></div>';
      html += '<div class="rpt-compare-col"><h4>Refi Twice</h4><div class="rpt-params">';
      if (dr.compare3DoubleCosts) html += '<div class="rpt-param"><span>Total Costs</span><span>' + dr.compare3DoubleCosts + '</span></div>';
      if (dr.compare3DoublePhase1) html += '<div class="rpt-param"><span>Phase 1 Svgs</span><span>' + dr.compare3DoublePhase1 + '</span></div>';
      if (dr.compare3DoublePhase2) html += '<div class="rpt-param"><span>Phase 2 Svgs</span><span>' + dr.compare3DoublePhase2 + '</span></div>';
      if (dr.compare3DoubleNet) html += '<div class="rpt-param" style="font-weight:600"><span>Net</span><span>' + dr.compare3DoubleNet + '</span></div>';
      html += '</div></div>';
      html += '<div class="rpt-compare-col"><h4>Wait & Refi Once</h4><div class="rpt-params">';
      if (dr.compare3WaitCosts) html += '<div class="rpt-param"><span>Eff. Cost</span><span>' + dr.compare3WaitCosts + '</span></div>';
      if (dr.compare3WaitSavings) html += '<div class="rpt-param"><span>Savings</span><span>' + dr.compare3WaitSavings + '</span></div>';
      if (dr.compare3WaitNet) html += '<div class="rpt-param" style="font-weight:600"><span>Net</span><span>' + dr.compare3WaitNet + '</span></div>';
      html += '</div></div></div>';

      if (dr.bestStrategy) {
        html += '<div class="rpt-grand-total"><span>Best Strategy</span><span>' + dr.bestStrategy + '</span></div>';
      }
      html += '</div>';
    }

    /* Recommendation */
    if (data.recommendation) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Recommendation</h4>';
      html += '<div class="rpt-recommendation"><span>' + data.recommendation + '</span></div>';
      if (data.adviceDetail) html += '<p style="margin:0.25rem 0 0;font-size:0.85em;color:#555">' + data.adviceDetail + '</p>';
      if (data.adviceBullets && data.adviceBullets.length) {
        html += '<ul style="margin:0.5rem 0 0;padding-left:1.25rem;font-size:0.85em">';
        data.adviceBullets.forEach(function (b) {
          var icon = b.type === 'pro' ? '✓' : b.type === 'con' ? '✗' : '•';
          var color = b.type === 'pro' ? '#2d6a4f' : b.type === 'con' ? '#c0392b' : '#666';
          html += '<li style="color:' + color + '">' + icon + ' ' + b.text + '</li>';
        });
        html += '</ul>';
      }
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
    html += '<div class="rpt-param"><span>Note Rate</span><span>' + ratePct(inp.noteRate) + '</span></div>';
    html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.loanTerm + '</span></div>';
    html += '<div class="rpt-param"><span>Buydown Type</span><span>' + inp.buydownType + '</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Payment Summary</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Full Note-Rate Payment</span><span>' + res.basePayment + '</span></div>';
    html += '<div class="rpt-param"><span>Year 1 Reduced Payment</span><span>' + res.year1Payment + '</span></div>';
    html += '<div class="rpt-param"><span>Year 1 Monthly Savings</span><span>' + res.year1Savings + '</span></div>';
    html += '</div>';
    html += '<div class="rpt-grand-total"><span>Total Buydown Cost</span><span>' + res.totalCost + '</span></div>';
    html += '</div>';

    // Year-by-Year Breakdown
    if (data.years && data.years.length) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Year-by-Year Breakdown</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Period</th><th class="rpt-num">Rate</th><th class="rpt-num">P&I Payment</th><th class="rpt-num">Total Payment</th><th class="rpt-num">Monthly Savings</th></tr></thead><tbody>';
      data.years.forEach(function (yr) {
        var piVal = yr.p_i_payment || '';
        var totalVal = yr.total_payment || '';
        var savVal = yr.monthly_savings || '';
        html += '<tr><td>' + (yr.label || '') + '</td>';
        html += '<td class="rpt-num">' + (yr.rate || '') + '</td>';
        html += '<td class="rpt-num">' + piVal + '</td>';
        html += '<td class="rpt-num">' + totalVal + '</td>';
        html += '<td class="rpt-num">' + savVal + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
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
    html += '<div class="rpt-param"><span>Current Interest Rate</span><span>' + ratePct(inp.oldRate) + '</span></div>';
    html += '<div class="rpt-param"><span>New Interest Rate</span><span>' + ratePct(inp.newRate) + '</span></div>';
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
    html += '<div class="rpt-param"><span>Interest Rate</span><span>' + ratePct(inp.rate) + '</span></div>';
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
      [['Purchase Price', fmt0(inp.price)], ['Down Payment', pct(inp.downPct)], ['Rate', ratePct(inp.rate)], ['Term', inp.term + ' yrs'], ['Investment Return', pct(inp.investReturn)], ['Appreciation', pct(inp.appreciation)], ['Period', inp.period + ' yrs']],
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
      [['Loan Amount', fmt0(inp.loanAmount)], ['Note Rate', ratePct(inp.rate)], ['Term', inp.term], ['Points', pct(inp.discountPoints)]],
      [['Monthly P&I', res.monthlyPayment], ['Amount Financed', res.amountFinanced], ['Finance Charges', res.financeCharges], ['APR Spread', res.aprSpread], ['APR', res.apr]]
    );
  };

  pdfGenerators['refi'] = function (data) {
    var inp = data.inputs;
    var now = data.refiNow || data.results || {};
    var content = [];

    /* Loan comparison side by side */
    var loanParams = [
      ['', 'Current Loan', 'Refinance Offer'],
      ['Balance / Amount', fmt0(inp.currentBalance), fmt0(inp.newAmount)],
      ['Rate', ratePct(inp.currentRate), ratePct(inp.newRate)]
    ];
    if (inp.currentLoanType || inp.refiLoanType) loanParams.push(['Loan Type', inp.currentLoanType || '—', inp.refiLoanType || '—']);
    if (inp.remainingTerm || inp.newTerm) loanParams.push(['Term', (inp.remainingTerm || '—') + ' mo', (inp.newTerm || '—') + ' mo']);
    loanParams.push(['Monthly P&I', now.currentPayment || '—', now.newPayment || '—']);

    var loanBody = loanParams.map(function (r, i) {
      if (i === 0) return [{ text: r[0], style: 'tableHeader' }, { text: r[1], style: 'tableHeader', alignment: 'center' }, { text: r[2], style: 'tableHeader', alignment: 'center' }];
      return [r[0], { text: r[1], alignment: 'right' }, { text: r[2], alignment: 'right' }];
    });
    content.push({ table: { headerRows: 1, widths: ['*', 120, 120], body: loanBody }, layout: 'lightHorizontalLines' });

    /* Refi Now */
    content.push({ text: 'Refinance Now', style: 'sectionTitle', margin: [0, 10, 0, 4] });
    var nowBody = [
      [{ text: 'Metric', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }],
      ['Monthly Savings', { text: now.monthlySavings || '', alignment: 'right' }],
      ['Total Closing Costs', { text: now.totalClosingCosts || '', alignment: 'right' }],
      ['Breakeven Point', { text: now.breakeven || '', alignment: 'right' }],
      [{ text: 'Net Savings (Stay Period)', bold: true }, { text: now.netSavings || '', alignment: 'right', bold: true }]
    ];
    content.push({ table: { headerRows: 1, widths: ['*', 120], body: nowBody }, layout: 'lightHorizontalLines' });

    /* Cost of Waiting */
    if (data.costOfWaiting) {
      var cow = data.costOfWaiting;
      content.push({ text: 'Cost of Waiting', style: 'sectionTitle', margin: [0, 10, 0, 4] });
      var cowBody = [
        [{ text: 'Metric', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }],
        ['Extra Interest While Waiting', { text: cow.extraInterest, alignment: 'right' }],
        ['Future Monthly Payment', { text: cow.futurePayment, alignment: 'right' }],
        ['Future Monthly Savings', { text: cow.futureSavings, alignment: 'right' }],
        ['Breakeven (If You Wait)', { text: cow.breakevenWait, alignment: 'right' }]
      ];
      content.push({ table: { headerRows: 1, widths: ['*', 120], body: cowBody }, layout: 'lightHorizontalLines' });

      /* Comparison */
      var cmpBody = [
        [{ text: '', style: 'tableHeader' }, { text: 'Refi Now', style: 'tableHeader', alignment: 'center' }, { text: 'Wait & Refi', style: 'tableHeader', alignment: 'center' }]
      ];
      if (cow.nowCosts || cow.waitCosts) cmpBody.push(['Closing Costs', { text: cow.nowCosts || '—', alignment: 'right' }, { text: cow.waitEffective || cow.waitCosts || '—', alignment: 'right' }]);
      if (cow.nowSavings || cow.waitSavings) cmpBody.push(['Monthly Savings', { text: cow.nowSavings || '—', alignment: 'right' }, { text: cow.waitSavings || '—', alignment: 'right' }]);
      if (cow.nowBreakeven || cow.waitBreakeven) cmpBody.push(['Breakeven', { text: cow.nowBreakeven || '—', alignment: 'right' }, { text: cow.waitBreakeven || '—', alignment: 'right' }]);
      if (cow.nowNet || cow.waitNet) cmpBody.push([{ text: 'Net Savings', bold: true }, { text: cow.nowNet || '—', alignment: 'right', bold: true }, { text: cow.waitNet || '—', alignment: 'right', bold: true }]);
      if (cmpBody.length > 1) content.push({ table: { headerRows: 1, widths: ['*', 110, 110], body: cmpBody }, layout: 'lightHorizontalLines', margin: [0, 6, 0, 0] });

      if (cow.difference) {
        content.push({ columns: [{ text: 'Net Difference', bold: true, fontSize: 11, color: '#2d6a4f' }, { text: cow.difference, alignment: 'right', bold: true, fontSize: 11, color: '#2d6a4f' }], margin: [0, 6, 0, 0] });
      }
    }

    /* Double Refi */
    if (data.doubleRefi) {
      var dr = data.doubleRefi;
      content.push({ text: 'Refi Twice Strategy', style: 'sectionTitle', margin: [0, 10, 0, 4] });
      var drBody = [
        [{ text: 'Metric', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader', alignment: 'right' }],
        ['Phase 1 Savings', { text: dr.phase1Savings, alignment: 'right' }],
        ['Phase 2 Payment', { text: dr.phase2Payment, alignment: 'right' }],
        ['Total Costs (2 Refis)', { text: dr.totalCosts, alignment: 'right' }],
        ['Combined Breakeven', { text: dr.breakeven, alignment: 'right' }]
      ];
      content.push({ table: { headerRows: 1, widths: ['*', 120], body: drBody }, layout: 'lightHorizontalLines' });

      /* 3-way comparison */
      var triBody = [
        [{ text: '', style: 'tableHeader' }, { text: 'Refi Now', style: 'tableHeader', alignment: 'center' }, { text: 'Refi Twice', style: 'tableHeader', alignment: 'center' }, { text: 'Wait & Refi', style: 'tableHeader', alignment: 'center' }]
      ];
      triBody.push(['Costs', { text: dr.compare3NowCosts || '—', alignment: 'right' }, { text: dr.compare3DoubleCosts || '—', alignment: 'right' }, { text: dr.compare3WaitCosts || '—', alignment: 'right' }]);
      triBody.push([{ text: 'Net Savings', bold: true }, { text: dr.compare3NowNet || '—', alignment: 'right', bold: true }, { text: dr.compare3DoubleNet || '—', alignment: 'right', bold: true }, { text: dr.compare3WaitNet || '—', alignment: 'right', bold: true }]);
      content.push({ table: { headerRows: 1, widths: ['*', 90, 90, 90], body: triBody }, layout: 'lightHorizontalLines', margin: [0, 6, 0, 0] });

      if (dr.bestStrategy) {
        content.push({ columns: [{ text: 'Best Strategy', bold: true, fontSize: 11, color: '#2d6a4f' }, { text: dr.bestStrategy, alignment: 'right', bold: true, fontSize: 11, color: '#2d6a4f' }], margin: [0, 6, 0, 0] });
      }
    }

    /* Recommendation */
    if (data.recommendation) {
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#2d6a4f' }], margin: [0, 10, 0, 4] });
      content.push({ text: data.recommendation, bold: true, fontSize: 11, color: '#2d6a4f', margin: [0, 4, 0, 0] });
      if (data.adviceDetail) content.push({ text: data.adviceDetail, fontSize: 9, color: '#555', margin: [0, 2, 0, 0] });
      if (data.adviceBullets && data.adviceBullets.length) {
        var bulletList = data.adviceBullets.map(function (b) {
          var icon = b.type === 'pro' ? '✓ ' : b.type === 'con' ? '✗ ' : '• ';
          return { text: icon + b.text, fontSize: 9, color: b.type === 'pro' ? '#2d6a4f' : b.type === 'con' ? '#c0392b' : '#555' };
        });
        content.push({ ul: bulletList, margin: [0, 4, 0, 0] });
      }
    }
    return content;
  };

  pdfGenerators['buy-vs-rent'] = function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Purchase Price', fmt0(inp.price)], ['Down Payment', pct(inp.downPct)], ['Rate', ratePct(inp.rate)], ['Rent', fmt0(inp.rent) + '/mo'], ['Period', inp.period + ' yrs']],
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
    var content = pdfKeyValue(data,
      [['Loan Amount', fmt0(inp.loanAmount)], ['Note Rate', ratePct(inp.noteRate)], ['Term', inp.loanTerm], ['Buydown Type', inp.buydownType]],
      [['Full Rate Payment', res.basePayment], ['Year 1 Payment', res.year1Payment], ['Year 1 Savings', res.year1Savings], ['Total Buydown Cost', res.totalCost]]
    );
    // Year-by-year table
    if (data.years && data.years.length) {
      var body = [[
        { text: 'Period', style: 'tableHeader' },
        { text: 'Rate', style: 'tableHeader', alignment: 'right' },
        { text: 'P&I', style: 'tableHeader', alignment: 'right' },
        { text: 'Total', style: 'tableHeader', alignment: 'right' },
        { text: 'Savings', style: 'tableHeader', alignment: 'right' }
      ]];
      data.years.forEach(function (yr) {
        body.push([
          yr.label || '',
          { text: yr.rate || '', alignment: 'right' },
          { text: yr.p_i_payment || '', alignment: 'right' },
          { text: yr.total_payment || '', alignment: 'right' },
          { text: yr.monthly_savings || '', alignment: 'right' }
        ]);
      });
      content.push({ text: 'Year-by-Year Breakdown', style: 'sectionTitle', margin: [0, 10, 0, 4] });
      content.push({ table: { headerRows: 1, widths: ['*', 60, 80, 80, 80], body: body }, layout: 'lightHorizontalLines' });
    }
    return content;
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
      [['Borrower', inp.borrower || '—'], ['Current UPB', fmt0(inp.currentUpb)], ['Original Loan', fmt0(inp.originalLoan)], ['Current Rate', ratePct(inp.oldRate)], ['New Rate', ratePct(inp.newRate)]],
      [['Closing Costs', res.totalClosingCosts], ['Base Loan', res.baseLoan], ['New UFMIP', res.newUfmip], ['UFMIP Refund', res.ufmipRefund], ['Max Streamline Mortgage', res.finalMortgage]]
    );
  };

  pdfGenerators['reo'] = function (data) {
    var inp = data.inputs; var res = data.results;
    return pdfKeyValue(data,
      [['Property', inp.address || '—'], ['Purchase Price', fmt0(inp.purchasePrice)], ['Down Payment', pct(inp.downPct)], ['Rate', ratePct(inp.rate)], ['Gross Rents', fmt0(inp.grossRents) + '/mo']],
      [['Renovation Total', res.renoTotal], ['Cash Invested', res.cashInvested], ['Monthly NOI', res.noiMonthly], ['Year 1 Cap Rate', res.year1CapRate], ['Year 1 Cash Flow', res.year1CashFlow], ['Year 1 Cash-on-Cash', res.year1CoC]]
    );
  };

  /* ---- General: Amortization ---- */
  extractors['amortization'] = function (doc) {
    var homeValue = val(doc, 'homePrice');
    var downDollar = val(doc, 'downPaymentDollar');
    var downPct = val(doc, 'downPaymentPercent');
    var loanAmount = homeValue - downDollar;
    var rate = val(doc, 'interestRate');
    var termBtn = doc.querySelector('#termToggle .amort-term-btn.active');
    var term = termBtn ? parseInt(termBtn.dataset.years, 10) : 30;

    // Taxes & insurance — read raw value and period
    var taxInput = doc.getElementById('propertyTax');
    var taxVal = taxInput ? parseFloat(taxInput.value) || 0 : 0;
    var taxPeriod = taxInput ? taxInput.dataset.period : 'annual';
    var taxYr = taxPeriod === 'monthly' ? taxVal * 12 : taxVal;

    var insInput = doc.getElementById('homeInsurance');
    var insVal = insInput ? parseFloat(insInput.value) || 0 : 0;
    var insPeriod = insInput ? insInput.dataset.period : 'annual';
    var insYr = insPeriod === 'monthly' ? insVal * 12 : insVal;

    var monthlyPMI = val(doc, 'pmi');

    // Extra payments
    var extraAmount = val(doc, 'extraPayment');
    var freqBtn = doc.querySelector('#extraFreqToggle .amort-term-btn.active');
    var extraFreq = freqBtn ? freqBtn.dataset.freq : 'monthly';
    var startMonthSel = doc.getElementById('extraStartMonth');
    var startYearSel = doc.getElementById('extraStartYear');
    var extraStartMonth = startMonthSel ? parseInt(startMonthSel.value, 10) : 0;
    var extraStartYear = startYearSel ? parseInt(startYearSel.value, 10) : new Date().getFullYear();

    // Read results from DOM
    var totalPayment = txt(doc, 'resultMonthlyPI');
    var totalMonthly = txt(doc, 'resultTotalMonthly');
    var totalInterestText = txt(doc, 'resultTotalInterest');
    var totalCostText = txt(doc, 'resultTotalCost');
    var payoffDate = txt(doc, 'resultPayoffDate');
    var interestSaved = txt(doc, 'resultInterestSaved');
    var timeSaved = txt(doc, 'resultTimeSaved');
    var monthlyDetail = txt(doc, 'resultMonthlyDetail');

    // Capture chart as base64 image
    var chartImage = '';
    var canvas = doc.getElementById('amortChart');
    if (canvas) {
      try { chartImage = canvas.toDataURL('image/png'); } catch (e) { /* cross-origin */ }
    }

    // Extract full schedule from table rows (including collapsed month rows)
    var schedule = [];
    var totalInterest = 0;
    var totalPrincipal = 0;
    var totalExtra = 0;
    var monthRows = doc.querySelectorAll('.amort-month-row');
    monthRows.forEach(function (row) {
      var cells = row.querySelectorAll('td');
      if (cells.length < 7) return;
      var pmtNum = parseInt(cells[0].textContent.trim(), 10);
      if (isNaN(pmtNum)) return;
      var principal = parseFloat((cells[3].textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
      var interest = parseFloat((cells[4].textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
      var extra = parseFloat((cells[5].textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
      var balance = parseFloat((cells[6].textContent || '').replace(/[^0-9.\-]/g, '')) || 0;
      totalPrincipal += principal;
      totalInterest += interest;
      totalExtra += extra;
      schedule.push({
        num: pmtNum,
        date: cells[1].textContent.trim(),
        payment: parseFloat((cells[2].textContent || '').replace(/[^0-9.\-]/g, '')) || 0,
        principal: principal,
        interest: interest,
        extra: extra,
        balance: balance
      });
    });

    // Build yearly summaries
    var yearlyMap = {};
    schedule.forEach(function (pmt) {
      var yr = pmt.date ? pmt.date.split(' ').pop() : '';
      if (!yr) return;
      if (!yearlyMap[yr]) yearlyMap[yr] = { year: yr, interest: 0, principal: 0, extra: 0, payments: 0, count: 0 };
      yearlyMap[yr].interest += pmt.interest;
      yearlyMap[yr].principal += pmt.principal;
      yearlyMap[yr].extra += pmt.extra;
      yearlyMap[yr].payments += pmt.payment;
      yearlyMap[yr].count++;
    });
    var yearlySummary = [];
    Object.keys(yearlyMap).sort().forEach(function (yr) { yearlySummary.push(yearlyMap[yr]); });

    return {
      inputs: {
        homeValue: homeValue, downPct: downPct, downPayment: downDollar,
        loanAmount: loanAmount, rate: rate, term: term,
        taxYr: taxYr, insYr: insYr, monthlyPMI: monthlyPMI,
        extraAmount: extraAmount, extraFreq: extraFreq,
        extraStartMonth: extraStartMonth, extraStartYear: extraStartYear
      },
      results: {
        monthlyPI: totalPayment,
        totalMonthly: totalMonthly,
        monthlyDetail: monthlyDetail,
        totalInterest: totalInterest,
        totalPrincipal: totalPrincipal,
        totalExtra: totalExtra,
        totalCost: totalCostText,
        payoffDate: payoffDate,
        interestSaved: interestSaved,
        timeSaved: timeSaved
      },
      chartImage: chartImage,
      schedule: schedule,
      yearlySummary: yearlySummary
    };
  };

  renderers['amortization'] = function (data) {
    var inp = data.inputs; var res = data.results;
    var html = '';

    // Parameters
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Mortgage Parameters</h4>';
    html += '<div class="rpt-params">';
    html += '<div class="rpt-param"><span>Home Value</span><span>' + fmt0(inp.homeValue) + '</span></div>';
    html += '<div class="rpt-param"><span>Down Payment</span><span>' + pct(inp.downPct) + ' (' + fmt0(inp.downPayment) + ')</span></div>';
    html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt0(inp.loanAmount) + '</span></div>';
    html += '<div class="rpt-param"><span>Interest Rate</span><span>' + ratePct(inp.rate) + '</span></div>';
    html += '<div class="rpt-param"><span>Loan Term</span><span>' + inp.term + ' years</span></div>';
    if (inp.taxYr) html += '<div class="rpt-param"><span>Annual Property Tax</span><span>' + fmt0(inp.taxYr) + '</span></div>';
    if (inp.insYr) html += '<div class="rpt-param"><span>Annual Insurance</span><span>' + fmt0(inp.insYr) + '</span></div>';
    if (inp.monthlyPMI) html += '<div class="rpt-param"><span>Monthly PMI</span><span>' + fmt(inp.monthlyPMI) + '</span></div>';
    html += '</div></div>';

    // Payment summary
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Payment Summary</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
    if (res.monthlyPI) html += '<tr><td>Monthly P&I</td><td class="rpt-num">' + res.monthlyPI + '</td></tr>';
    if (res.totalMonthly) html += '<tr><td>Total Monthly Payment</td><td class="rpt-num">' + res.totalMonthly + '</td></tr>';
    if (res.monthlyDetail) html += '<tr><td colspan="2" style="font-size:0.78rem;color:#6c757d;">' + res.monthlyDetail + '</td></tr>';
    if (res.totalPrincipal) html += '<tr><td>Total Principal</td><td class="rpt-num">' + fmt(res.totalPrincipal) + '</td></tr>';
    if (res.totalInterest) html += '<tr><td>Total Interest Paid</td><td class="rpt-num">' + fmt(res.totalInterest) + '</td></tr>';
    if (res.totalExtra) html += '<tr><td>Total Extra Payments</td><td class="rpt-num">' + fmt(res.totalExtra) + '</td></tr>';
    html += '</tbody></table>';
    if (res.totalCost) {
      html += '<div class="rpt-grand-total"><span>Total Cost of Loan</span><span>' + res.totalCost + '</span></div>';
    }
    if (res.payoffDate) {
      html += '<div class="rpt-grand-total" style="margin-top:4px"><span>Payoff Date</span><span>' + res.payoffDate + '</span></div>';
    }
    html += '</div>';

    // Extra payment info & savings
    if (inp.extraAmount && inp.extraAmount > 0) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Extra Payment Impact</h4>';
      html += '<div class="rpt-params">';
      html += '<div class="rpt-param"><span>Extra Payment</span><span>' + fmt(inp.extraAmount) + ' (' + inp.extraFreq + ')</span></div>';
      if (res.interestSaved) html += '<div class="rpt-param"><span>Interest Saved</span><span style="color:#28a745;font-weight:700">' + res.interestSaved + '</span></div>';
      if (res.timeSaved && res.timeSaved !== '--') html += '<div class="rpt-param"><span>Time Saved</span><span style="color:#28a745;font-weight:700">' + res.timeSaved + '</span></div>';
      html += '</div></div>';
    }

    // Chart image
    if (data.chartImage) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Amortization Chart</h4>';
      html += '<img src="' + data.chartImage + '" style="width:100%;max-width:700px;border-radius:6px;margin:4px 0;" alt="Amortization Chart">';
      html += '</div>';
    }

    // Yearly summary
    if (data.yearlySummary && data.yearlySummary.length) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Annual Breakdown</h4>';
      html += '<table class="rpt-table"><thead><tr><th>Year</th><th class="rpt-num">Principal</th><th class="rpt-num">Interest</th><th class="rpt-num">Extra</th><th class="rpt-num">Total Paid</th></tr></thead><tbody>';
      data.yearlySummary.forEach(function (yr) {
        html += '<tr><td>' + yr.year + '</td>';
        html += '<td class="rpt-num">' + fmt(yr.principal) + '</td>';
        html += '<td class="rpt-num">' + fmt(yr.interest) + '</td>';
        html += '<td class="rpt-num">' + (yr.extra ? fmt(yr.extra) : '—') + '</td>';
        html += '<td class="rpt-num">' + fmt(yr.payments) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    // Full payment schedule
    if (data.schedule && data.schedule.length) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Full Amortization Schedule (' + data.schedule.length + ' payments)</h4>';
      html += '<table class="rpt-table" style="font-size:0.78rem"><thead><tr>';
      html += '<th>#</th><th>Date</th><th class="rpt-num">Payment</th>';
      html += '<th class="rpt-num">Principal</th><th class="rpt-num">Interest</th><th class="rpt-num">Extra</th><th class="rpt-num">Balance</th>';
      html += '</tr></thead><tbody>';
      data.schedule.forEach(function (pmt) {
        html += '<tr><td>' + pmt.num + '</td><td>' + pmt.date + '</td>';
        html += '<td class="rpt-num">' + fmt(pmt.payment) + '</td>';
        html += '<td class="rpt-num">' + fmt(pmt.principal) + '</td>';
        html += '<td class="rpt-num">' + fmt(pmt.interest) + '</td>';
        html += '<td class="rpt-num">' + (pmt.extra ? fmt(pmt.extra) : '—') + '</td>';
        html += '<td class="rpt-num">' + fmt(pmt.balance) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    return html;
  };

  pdfGenerators['amortization'] = function (data) {
    var inp = data.inputs; var res = data.results;
    var params = [
      ['Home Value', fmt0(inp.homeValue)], ['Down Payment', pct(inp.downPct) + ' (' + fmt0(inp.downPayment) + ')'],
      ['Loan Amount', fmt0(inp.loanAmount)], ['Interest Rate', ratePct(inp.rate)],
      ['Loan Term', inp.term + ' years']
    ];
    if (inp.taxYr) params.push(['Annual Property Tax', fmt0(inp.taxYr)]);
    if (inp.insYr) params.push(['Annual Insurance', fmt0(inp.insYr)]);
    if (inp.monthlyPMI) params.push(['Monthly PMI', fmt(inp.monthlyPMI)]);
    if (inp.extraAmount) params.push(['Extra Payment', fmt(inp.extraAmount) + ' (' + inp.extraFreq + ')']);
    var results = [];
    if (res.monthlyPI) results.push(['Monthly P&I', res.monthlyPI]);
    if (res.totalMonthly) results.push(['Total Monthly', res.totalMonthly]);
    if (res.totalPrincipal) results.push(['Total Principal', fmt(res.totalPrincipal)]);
    if (res.totalInterest) results.push(['Total Interest Paid', fmt(res.totalInterest)]);
    if (res.totalCost) results.push(['Total Cost of Loan', res.totalCost]);
    if (res.payoffDate) results.push(['Payoff Date', res.payoffDate]);
    if (res.interestSaved) results.push(['Interest Saved', res.interestSaved]);
    if (res.timeSaved && res.timeSaved !== '--') results.push(['Time Saved', res.timeSaved]);
    var content = pdfKeyValue(data, params, results);

    // Yearly summary
    if (data.yearlySummary && data.yearlySummary.length) {
      content.push({ text: 'Annual Breakdown', style: 'sectionTitle', margin: [0, 10, 0, 4] });
      var yrBody = [[
        { text: 'Year', style: 'tableHeader' },
        { text: 'Principal', style: 'tableHeader', alignment: 'right' },
        { text: 'Interest', style: 'tableHeader', alignment: 'right' },
        { text: 'Extra', style: 'tableHeader', alignment: 'right' },
        { text: 'Total Paid', style: 'tableHeader', alignment: 'right' }
      ]];
      data.yearlySummary.forEach(function (yr) {
        yrBody.push([yr.year,
          { text: fmt(yr.principal), alignment: 'right' },
          { text: fmt(yr.interest), alignment: 'right' },
          { text: yr.extra ? fmt(yr.extra) : '—', alignment: 'right' },
          { text: fmt(yr.payments), alignment: 'right' }
        ]);
      });
      content.push({ table: { headerRows: 1, widths: ['*', 80, 80, 60, 80], body: yrBody }, layout: 'lightHorizontalLines' });
    }

    // Full schedule
    if (data.schedule && data.schedule.length) {
      content.push({ text: 'Full Amortization Schedule', style: 'sectionTitle', margin: [0, 10, 0, 4], pageBreak: 'before' });
      var sBody = [[
        { text: '#', style: 'tableHeader' }, { text: 'Date', style: 'tableHeader' },
        { text: 'Payment', style: 'tableHeader', alignment: 'right' },
        { text: 'Principal', style: 'tableHeader', alignment: 'right' },
        { text: 'Interest', style: 'tableHeader', alignment: 'right' },
        { text: 'Extra', style: 'tableHeader', alignment: 'right' },
        { text: 'Balance', style: 'tableHeader', alignment: 'right' }
      ]];
      data.schedule.forEach(function (pmt) {
        sBody.push([
          String(pmt.num), pmt.date,
          { text: fmt(pmt.payment), alignment: 'right' },
          { text: fmt(pmt.principal), alignment: 'right' },
          { text: fmt(pmt.interest), alignment: 'right' },
          { text: pmt.extra ? fmt(pmt.extra) : '—', alignment: 'right' },
          { text: fmt(pmt.balance), alignment: 'right' }
        ]);
      });
      content.push({ table: { headerRows: 1, widths: [22, 55, 65, 65, 65, 50, 75], body: sBody }, layout: 'lightHorizontalLines', fontSize: 7 });
    }
    return content;
  };

  /* ---- Variable Income Analyzer ---- */
  extractors['var-income'] = function (doc) {
    // Extract per-employment data from the panels
    var employments = [];
    var panels = doc.querySelectorAll('.employment-panel');
    panels.forEach(function (panel) {
      var empName = (panel.querySelector('.emp-employer-name') || {}).value || '';
      var position = (panel.querySelector('.emp-position') || {}).value || '';
      var payType = (panel.querySelector('.emp-pay-type') || {}).value || '';
      var payFreq = (panel.querySelector('.emp-pay-frequency') || {}).value || '';
      var baseRate = parseFloat((panel.querySelector('.emp-base-rate') || {}).value) || 0;
      var startDate = (panel.querySelector('.emp-start-date') || {}).value || '';
      var asOfDate = (panel.querySelector('.emp-as-of-date') || {}).value || '';
      var payPeriods = parseFloat((panel.querySelector('.emp-pay-periods-ytd') || {}).value) || 0;
      var ytdBase = parseFloat((panel.querySelector('.emp-ytd-base') || {}).value) || 0;
      var ytdOT = parseFloat((panel.querySelector('.emp-ytd-overtime') || {}).value) || 0;
      var ytdBonus = parseFloat((panel.querySelector('.emp-ytd-bonus') || {}).value) || 0;
      var ytdComm = parseFloat((panel.querySelector('.emp-ytd-commission') || {}).value) || 0;
      var ytdOther = parseFloat((panel.querySelector('.emp-ytd-other') || {}).value) || 0;
      var prior1Base = parseFloat((panel.querySelector('.emp-prior1-base') || {}).value) || 0;
      var prior1OT = parseFloat((panel.querySelector('.emp-prior1-overtime') || {}).value) || 0;
      var prior1Bonus = parseFloat((panel.querySelector('.emp-prior1-bonus') || {}).value) || 0;
      var prior1Comm = parseFloat((panel.querySelector('.emp-prior1-commission') || {}).value) || 0;
      var prior2Base = parseFloat((panel.querySelector('.emp-prior2-base') || {}).value) || 0;
      var prior2OT = parseFloat((panel.querySelector('.emp-prior2-overtime') || {}).value) || 0;
      var prior2Bonus = parseFloat((panel.querySelector('.emp-prior2-bonus') || {}).value) || 0;
      var prior2Comm = parseFloat((panel.querySelector('.emp-prior2-commission') || {}).value) || 0;
      if (empName || ytdBase || prior1Base) {
        employments.push({
          employer: empName, position: position, payType: payType, payFreq: payFreq,
          baseRate: baseRate, startDate: startDate, asOfDate: asOfDate, payPeriods: payPeriods,
          ytd: { base: ytdBase, overtime: ytdOT, bonus: ytdBonus, commission: ytdComm, other: ytdOther },
          prior1: { base: prior1Base, overtime: prior1OT, bonus: prior1Bonus, commission: prior1Comm },
          prior2: { base: prior2Base, overtime: prior2OT, bonus: prior2Bonus, commission: prior2Comm }
        });
      }
    });

    // Read results
    var monthlyBase = txt(doc,'resultMonthlyBase');
    var monthlyVariable = txt(doc,'resultMonthlyVariable');
    var monthlyTotal = txt(doc,'resultMonthlyTotal');
    var qualifyingIncome = txt(doc,'resultQualifyingIncome');

    // Read flags
    var flags = [];
    var flagEls = doc.querySelectorAll('#flagsContainer .flag-item, #flagsContainer li');
    flagEls.forEach(function (el) { flags.push(el.textContent.trim()); });

    // Read docs required
    var docs = [];
    var docEls = doc.querySelectorAll('#docsContainer .doc-item, #docsContainer li');
    docEls.forEach(function (el) { docs.push(el.textContent.trim()); });

    // Read per-employment breakdown tables from results
    var breakdowns = [];
    var breakdownEls = doc.querySelectorAll('#empBreakdownContainer .calc-section');
    breakdownEls.forEach(function (sec) {
      var title = sec.querySelector('h2, h3');
      var rows = [];
      sec.querySelectorAll('tr').forEach(function (tr) {
        var cells = tr.querySelectorAll('td');
        if (cells.length >= 2) {
          rows.push({ label: cells[0].textContent.trim(), value: cells[cells.length - 1].textContent.trim() });
        }
      });
      breakdowns.push({ title: title ? title.textContent.trim() : '', rows: rows });
    });

    return {
      employments: employments,
      results: {
        monthlyBase: monthlyBase, monthlyVariable: monthlyVariable,
        monthlyTotal: monthlyTotal, qualifyingIncome: qualifyingIncome
      },
      flags: flags,
      docs: docs,
      breakdowns: breakdowns
    };
  };

  renderers['var-income'] = function (data) {
    var res = data.results;
    var html = '';

    // Employment details
    if (data.employments && data.employments.length) {
      data.employments.forEach(function (emp, i) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">Employment ' + (i + 1) + (emp.employer ? ' — ' + emp.employer : '') + '</h4>';
        html += '<div class="rpt-params">';
        if (emp.employer) html += '<div class="rpt-param"><span>Employer</span><span>' + emp.employer + '</span></div>';
        if (emp.position) html += '<div class="rpt-param"><span>Position</span><span>' + emp.position + '</span></div>';
        html += '<div class="rpt-param"><span>Pay Type</span><span>' + emp.payType + '</span></div>';
        if (emp.baseRate) html += '<div class="rpt-param"><span>' + (emp.payType === 'HOURLY' ? 'Hourly Rate' : 'Annual Salary') + '</span><span>' + (emp.payType === 'HOURLY' ? fmt(emp.baseRate) + '/hr' : fmt0(emp.baseRate)) + '</span></div>';
        if (emp.startDate) html += '<div class="rpt-param"><span>Start Date</span><span>' + emp.startDate + '</span></div>';
        html += '</div>';

        // YTD earnings
        html += '<table class="rpt-table"><thead><tr><th>Earnings Type</th><th class="rpt-num">YTD</th><th class="rpt-num">Prior Year 1</th><th class="rpt-num">Prior Year 2</th></tr></thead><tbody>';
        html += '<tr><td>Base</td><td class="rpt-num">' + fmt(emp.ytd.base) + '</td><td class="rpt-num">' + fmt(emp.prior1.base) + '</td><td class="rpt-num">' + fmt(emp.prior2.base) + '</td></tr>';
        if (emp.ytd.overtime || emp.prior1.overtime || emp.prior2.overtime) html += '<tr><td>Overtime</td><td class="rpt-num">' + fmt(emp.ytd.overtime) + '</td><td class="rpt-num">' + fmt(emp.prior1.overtime) + '</td><td class="rpt-num">' + fmt(emp.prior2.overtime) + '</td></tr>';
        if (emp.ytd.bonus || emp.prior1.bonus || emp.prior2.bonus) html += '<tr><td>Bonus</td><td class="rpt-num">' + fmt(emp.ytd.bonus) + '</td><td class="rpt-num">' + fmt(emp.prior1.bonus) + '</td><td class="rpt-num">' + fmt(emp.prior2.bonus) + '</td></tr>';
        if (emp.ytd.commission || emp.prior1.commission || emp.prior2.commission) html += '<tr><td>Commission</td><td class="rpt-num">' + fmt(emp.ytd.commission) + '</td><td class="rpt-num">' + fmt(emp.prior1.commission) + '</td><td class="rpt-num">' + fmt(emp.prior2.commission) + '</td></tr>';
        if (emp.ytd.other) html += '<tr><td>Other</td><td class="rpt-num">' + fmt(emp.ytd.other) + '</td><td class="rpt-num">—</td><td class="rpt-num">—</td></tr>';
        html += '</tbody></table></div>';
      });
    }

    // Breakdowns from computed results
    if (data.breakdowns && data.breakdowns.length) {
      data.breakdowns.forEach(function (bd) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">' + bd.title + '</h4>';
        if (bd.rows.length) {
          html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Value</th></tr></thead><tbody>';
          bd.rows.forEach(function (r) {
            html += '<tr><td>' + r.label + '</td><td class="rpt-num">' + r.value + '</td></tr>';
          });
          html += '</tbody></table>';
        }
        html += '</div>';
      });
    }

    // Income summary
    html += '<div class="rpt-section"><h4 class="rpt-section-title">Income Summary</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Category</th><th class="rpt-num">Monthly</th></tr></thead><tbody>';
    html += '<tr><td>Monthly Base Income</td><td class="rpt-num">' + res.monthlyBase + '</td></tr>';
    html += '<tr><td>Monthly Variable Income</td><td class="rpt-num">' + res.monthlyVariable + '</td></tr>';
    html += '<tr><td>Total Monthly Usable</td><td class="rpt-num">' + res.monthlyTotal + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Qualifying Monthly Income</span><span>' + res.qualifyingIncome + '</span></div>';
    html += '</div>';

    // Flags
    if (data.flags && data.flags.length) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Flags & Observations</h4>';
      html += '<ul style="margin:0;padding-left:1.25rem;font-size:0.85em">';
      data.flags.forEach(function (f) { html += '<li>' + f + '</li>'; });
      html += '</ul></div>';
    }

    // Required docs
    if (data.docs && data.docs.length) {
      html += '<div class="rpt-section"><h4 class="rpt-section-title">Required Documentation</h4>';
      html += '<ul style="margin:0;padding-left:1.25rem;font-size:0.85em">';
      data.docs.forEach(function (d) { html += '<li>' + d + '</li>'; });
      html += '</ul></div>';
    }
    return html;
  };

  pdfGenerators['var-income'] = function (data) {
    var res = data.results;
    var content = [];

    // Employment details
    if (data.employments && data.employments.length) {
      data.employments.forEach(function (emp, i) {
        content.push({ text: 'Employment ' + (i + 1) + (emp.employer ? ' — ' + emp.employer : ''), style: 'sectionTitle', margin: [0, 8, 0, 4] });
        var body = [
          [{ text: 'Earnings', style: 'tableHeader' }, { text: 'YTD', style: 'tableHeader', alignment: 'right' }, { text: 'Prior Yr 1', style: 'tableHeader', alignment: 'right' }, { text: 'Prior Yr 2', style: 'tableHeader', alignment: 'right' }],
          ['Base', { text: fmt(emp.ytd.base), alignment: 'right' }, { text: fmt(emp.prior1.base), alignment: 'right' }, { text: fmt(emp.prior2.base), alignment: 'right' }]
        ];
        if (emp.ytd.overtime || emp.prior1.overtime) body.push(['Overtime', { text: fmt(emp.ytd.overtime), alignment: 'right' }, { text: fmt(emp.prior1.overtime), alignment: 'right' }, { text: fmt(emp.prior2.overtime), alignment: 'right' }]);
        if (emp.ytd.bonus || emp.prior1.bonus) body.push(['Bonus', { text: fmt(emp.ytd.bonus), alignment: 'right' }, { text: fmt(emp.prior1.bonus), alignment: 'right' }, { text: fmt(emp.prior2.bonus), alignment: 'right' }]);
        if (emp.ytd.commission || emp.prior1.commission) body.push(['Commission', { text: fmt(emp.ytd.commission), alignment: 'right' }, { text: fmt(emp.prior1.commission), alignment: 'right' }, { text: fmt(emp.prior2.commission), alignment: 'right' }]);
        content.push({ table: { headerRows: 1, widths: ['*', 80, 80, 80], body: body }, layout: 'lightHorizontalLines' });
      });
    }

    // Results
    content.push({ text: 'Income Summary', style: 'sectionTitle', margin: [0, 10, 0, 4] });
    var rBody = [
      [{ text: 'Category', style: 'tableHeader' }, { text: 'Monthly', style: 'tableHeader', alignment: 'right' }],
      ['Monthly Base', { text: res.monthlyBase, alignment: 'right' }],
      ['Monthly Variable', { text: res.monthlyVariable, alignment: 'right' }],
      ['Total Usable', { text: res.monthlyTotal, alignment: 'right' }]
    ];
    content.push({ table: { headerRows: 1, widths: ['*', 120], body: rBody }, layout: 'lightHorizontalLines' });
    content.push({ columns: [{ text: 'Qualifying Monthly Income', bold: true, fontSize: 12, color: '#2d6a4f' }, { text: res.qualifyingIncome, alignment: 'right', bold: true, fontSize: 12, color: '#2d6a4f' }], margin: [0, 8, 0, 0] });

    // Flags
    if (data.flags && data.flags.length) {
      content.push({ text: 'Flags & Observations', style: 'sectionTitle', margin: [0, 10, 0, 4] });
      content.push({ ul: data.flags.map(function (f) { return { text: f, fontSize: 9 }; }) });
    }
    return content;
  };

  /* ---- Fee Worksheet ---- */
  extractors['fee-worksheet'] = function (doc) {
    return {
      borrower: txt(doc,'fwBorrowerName'),
      fileNumber: txt(doc,'fwFileNumber'),
      propertyValue: val(doc,'fwPropertyValue'),
      loanAmount: val(doc,'fwLoanAmount'),
      rate: val(doc,'fwRate'),
      termMonths: val(doc,'fwTermMonths'),
      product: txt(doc,'fwProduct'),
      purpose: txt(doc,'fwLoanPurpose'),
      origTotal: txt(doc,'fwOrigTotal'),
      cannotShopTotal: txt(doc,'fwCannotShopTotal'),
      canShopTotal: txt(doc,'fwCanShopTotal'),
      govTotal: txt(doc,'fwGovTotal'),
      prepaidsTotal: txt(doc,'fwPrepaidsTotal'),
      escrowTotal: txt(doc,'fwEscrowTotal'),
      otherTotal: txt(doc,'fwOtherTotal'),
      fundsFromYou: txt(doc,'fwFundsFromYou'),
      monthlyPI: txt(doc,'fwMonthlyPI'),
      monthlyIns: txt(doc,'fwMonthlyIns'),
      monthlyTax: txt(doc,'fwMonthlyTax'),
      monthlyMI: val(doc,'fwMonthlyMI'),
      monthlyHOA: val(doc,'fwMonthlyHOA'),
      totalMonthly: txt(doc,'fwTotalMonthly')
    };
  };

  renderers['fee-worksheet'] = function (data) {
    var html = '';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Summary</h4>';
    html += '<div class="rpt-params">';
    if (data.borrower) html += '<div class="rpt-param"><span>Borrower(s)</span><span>' + data.borrower + '</span></div>';
    if (data.fileNumber) html += '<div class="rpt-param"><span>File #</span><span>' + data.fileNumber + '</span></div>';
    html += '<div class="rpt-param"><span>Property Value</span><span>' + fmt(data.propertyValue) + '</span></div>';
    html += '<div class="rpt-param"><span>Loan Amount</span><span>' + fmt(data.loanAmount) + '</span></div>';
    html += '<div class="rpt-param"><span>Rate</span><span>' + ratePct(data.rate) + '</span></div>';
    if (data.product) html += '<div class="rpt-param"><span>Product</span><span>' + data.product + '</span></div>';
    if (data.purpose) html += '<div class="rpt-param"><span>Purpose</span><span>' + data.purpose + '</span></div>';
    html += '</div></div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Closing Costs</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Section</th><th class="rpt-num">Amount</th></tr></thead><tbody>';
    html += '<tr><td>Origination Charges</td><td class="rpt-num">' + data.origTotal + '</td></tr>';
    html += '<tr><td>Services Borrower Cannot Shop</td><td class="rpt-num">' + data.cannotShopTotal + '</td></tr>';
    html += '<tr><td>Services Borrower Can Shop For</td><td class="rpt-num">' + data.canShopTotal + '</td></tr>';
    html += '<tr><td>Taxes & Government Fees</td><td class="rpt-num">' + data.govTotal + '</td></tr>';
    html += '<tr><td>Prepaids</td><td class="rpt-num">' + data.prepaidsTotal + '</td></tr>';
    html += '<tr><td>Initial Escrow</td><td class="rpt-num">' + data.escrowTotal + '</td></tr>';
    html += '<tr><td>Other</td><td class="rpt-num">' + data.otherTotal + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Estimated Funds From You</span><span>' + data.fundsFromYou + '</span></div>';
    html += '</div>';

    html += '<div class="rpt-section"><h4 class="rpt-section-title">Monthly Housing Payment</h4>';
    html += '<table class="rpt-table"><thead><tr><th>Item</th><th class="rpt-num">Amount</th></tr></thead><tbody>';
    html += '<tr><td>First Mortgage (P&I)</td><td class="rpt-num">' + data.monthlyPI + '</td></tr>';
    html += '<tr><td>Hazard Insurance</td><td class="rpt-num">' + data.monthlyIns + '</td></tr>';
    html += '<tr><td>Property Tax</td><td class="rpt-num">' + data.monthlyTax + '</td></tr>';
    if (data.monthlyMI) html += '<tr><td>MI</td><td class="rpt-num">' + fmt(data.monthlyMI) + '</td></tr>';
    if (data.monthlyHOA) html += '<tr><td>HOA</td><td class="rpt-num">' + fmt(data.monthlyHOA) + '</td></tr>';
    html += '</tbody></table>';
    html += '<div class="rpt-grand-total"><span>Total Monthly Payment</span><span>' + data.totalMonthly + '</span></div>';
    html += '</div>';

    return html;
  };

  /* ---- Loan Analysis (Cover Letter) ---- */
  extractors['loan-analysis'] = function (doc) {
    // Capture the generated letter HTML directly — this is the actual letter the user sees
    var letterEl = doc.getElementById('laLetterContent');
    var letterHtml = letterEl ? letterEl.innerHTML.trim() : '';

    if (!letterHtml) return null; // letter not generated yet

    return {
      letterHtml: letterHtml
    };
  };

  renderers['loan-analysis'] = function (data) {
    // Render the captured letter directly — it already contains the full formatted letter
    if (data.letterHtml) {
      return '<style>.rpt-cover-letter .la-letter__header-logo{max-width:120px;height:auto;display:block;}.rpt-cover-letter .la-letter__header{padding:0 0 8px;}</style>' +
        '<div class="rpt-cover-letter" style="line-height:1.7;font-size:0.95rem">' + data.letterHtml + '</div>';
    }
    return '<p class="rpt-no-template">No cover letter generated.</p>';
  };

  pdfGenerators['loan-analysis'] = function (data) {
    // Cover letter PDF: extract plain text from the stored HTML
    if (!data.letterHtml) return [{ text: 'No cover letter generated.', italics: true, color: '#888' }];

    // Parse the HTML to extract text segments
    var temp = document.createElement('div');
    temp.innerHTML = data.letterHtml;
    var content = [];

    // Extract text from each section by class
    var date = temp.querySelector('.la-letter__date');
    if (date) content.push({ text: date.textContent.trim(), color: '#888', margin: [0, 0, 0, 8] });

    var addr = temp.querySelector('.la-letter__address');
    if (addr) content.push({ text: addr.textContent.trim(), margin: [0, 0, 0, 8] });

    var greet = temp.querySelector('.la-letter__greeting');
    if (greet) content.push({ text: greet.textContent.trim(), margin: [0, 0, 0, 8] });

    var bodyPs = temp.querySelectorAll('.la-letter__body p');
    for (var i = 0; i < bodyPs.length; i++) {
      content.push({ text: bodyPs[i].textContent.trim(), margin: [0, 0, 0, 8] });
    }

    var sigEl = temp.querySelector('.la-letter__signature');
    if (sigEl) {
      content.push({ text: '', margin: [0, 8, 0, 0] });
      var sigLines = sigEl.querySelectorAll('p');
      for (var j = 0; j < sigLines.length; j++) {
        var line = sigLines[j].textContent.trim();
        if (!line) continue;
        var isBold = sigLines[j].classList.contains('la-sig-name');
        content.push({ text: line, bold: isBold, fontSize: isBold ? 11 : 9, color: isBold ? '#2d6a4f' : '#666', margin: [0, 1, 0, 1] });
      }
    }

    var attSection = temp.querySelector('.la-letter__attachments');
    if (attSection) {
      content.push({ text: 'Enclosed Reports', style: 'sectionTitle', margin: [0, 12, 0, 4] });
      var lis = attSection.querySelectorAll('li');
      var items = [];
      for (var k = 0; k < lis.length; k++) {
        items.push({ text: lis[k].textContent.trim(), margin: [0, 2, 0, 2] });
      }
      if (items.length) content.push({ ul: items });
    }

    return content;
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
