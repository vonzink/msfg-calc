(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;
  var h = RT.helpers;
  var val = h.val, txt = h.txt;

  /* ---- Income: 1040 ---- */
  RT.registerIncomeType('income/1040', function (doc) {
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
  });

  /* ---- Income: Schedule C ---- */
  RT.registerIncomeType('income/schedule-c', function (doc) {
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
  });

  /* ---- Income: 1065 ---- */
  RT.registerIncomeType('income/1065', function (doc) {
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
  });

  /* ---- Income: 1120 ---- */
  RT.registerIncomeType('income/1120', function (doc) {
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
  });

  /* ---- Income: 1120S ---- */
  RT.registerIncomeType('income/1120s', function (doc) {
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
  });

  /* ---- Income: K-1 (1065) ---- */
  RT.registerIncomeType('income/k1', function (doc) {
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
  });

  /* ---- Income: 1120S K-1 ---- */
  RT.registerIncomeType('income/1120s-k1', function (doc) {
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
  });

  /* ---- Income: Schedule B ---- */
  RT.registerIncomeType('income/schedule-b', function (doc) {
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
  });

  /* ---- Income: Schedule D ---- */
  RT.registerIncomeType('income/schedule-d', function (doc) {
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
  });

  /* ---- Income: Schedule E ---- */
  RT.registerIncomeType('income/schedule-e', function (doc) {
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
  });

  /* ---- Income: Schedule E Subject ---- */
  RT.registerIncomeType('income/schedule-e-subject', function (doc) {
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
  });

  /* ---- Income: Schedule F ---- */
  RT.registerIncomeType('income/schedule-f', function (doc) {
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
  });
})();
