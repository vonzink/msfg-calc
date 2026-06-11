/* =====================================================
   APR Fee Catalog
   Reg Z fee classification for Conventional, FHA, VA.
   Source: mortgage_apr_fee_catalog.md
   ===================================================== */
(function () {
  'use strict';

  /* ---- Fee Definitions ----
     aprFlagDefault: 'APR_YES' | 'APR_NO' | 'APR_CONDITIONAL'
     appliesTo: ['CONV','FHA','VA'] subset
     conditionCodes: drive resolver branches
     mismoAliases: MISMO FeeType / FeeTypeOtherDescription strings
  */
  const FEES = {
    // ----- Lender Charges -----
    origination_fee: {
      displayName: 'Origination Fee',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['LoanOriginationFee','OriginationFee','Origination Fee']
    },
    discount_points: {
      displayName: 'Discount Points',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['LoanDiscountPoints','Loan Discount Points','DiscountPoints']
    },
    underwriting_fee: {
      displayName: 'Underwriting Fee',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 1195,
      mismoAliases: ['Underwriting Fee','UnderwritingFee']
    },
    processing_fee: {
      displayName: 'Processing Fee',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['Processing Fee','ProcessingFee']
    },
    admin_fee: {
      displayName: 'Administrative Fee',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['AdminFee','Administrative Fee']
    },
    application_fee_conditional: {
      displayName: 'Application Fee',
      aprFlagDefault: 'APR_CONDITIONAL',
      appliesTo: ['CONV','FHA','VA'],
      conditionCodes: ['CHARGED_TO_ALL_APPLICANTS'],
      mismoAliases: ['ApplicationFee','Application Fee']
    },
    rate_lock_fee: {
      displayName: 'Rate Lock / Float-Down Fee',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['RateLockFee','Rate Lock Fee','LockFee','FloatDownFee']
    },
    tax_service_fee: {
      displayName: 'Tax Service Fee',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 85,
      mismoAliases: ['TaxRelatedServiceFee','Tax Related Service Fee','TaxServiceFee','Tax Service Fee']
    },
    flood_monitoring_fee: {
      displayName: 'Life-of-Loan Flood Monitoring',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['FloodMonitoringFee','Flood Monitoring Fee']
    },
    electronic_doc_fee: {
      displayName: 'Technology / E-Doc Fee',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 100,
      mismoAliases: ['Technology Fee','TechnologyFee','ElectronicDocumentFee','E-Doc Fee']
    },
    mers_registration_fee: {
      displayName: 'MERS Registration Fee',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 24.95,
      mismoAliases: ['MERSRegistrationFee','MERS Registration Fee']
    },
    courier_fee: {
      displayName: 'Courier Fee',
      aprFlagDefault: 'APR_CONDITIONAL',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 210,
      mismoAliases: ['CourierFee','Courier Fee','OvernightFee']
    },
    other_lender_fees: {
      displayName: 'Other Lender Fees',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: []
    },

    // ----- Mortgage Insurance / Guaranty -----
    monthly_borrower_paid_pmi: {
      displayName: 'Monthly PMI',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV'],
      mismoAliases: ['MonthlyMI','MortgageInsurancePremium']
    },
    single_premium_pmi: {
      displayName: 'Single-Premium PMI',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV'],
      mismoAliases: ['SinglePremiumPMI']
    },
    lender_paid_mi: {
      displayName: 'Lender-Paid MI',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV'],
      mismoAliases: ['LenderPaidMI']
    },
    fha_ufmip: {
      displayName: 'FHA Upfront MIP (UFMIP)',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['FHA'],
      mismoAliases: ['UFMIPFinancedAmount','UpfrontMIPAmount','FHA Upfront MIP','MIPFinancedAmount']
    },
    fha_annual_mip: {
      displayName: 'FHA Monthly MIP',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['FHA'],
      mismoAliases: ['MonthlyMIP','FHAMonthlyMIP']
    },
    va_funding_fee: {
      displayName: 'VA Funding Fee',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['VA'],
      mismoAliases: ['VAFundingFee','FundingFee','VA Funding Fee']
    },

    // ----- Title & Settlement -----
    lenders_title_insurance: {
      displayName: "Lender's Title Insurance",
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 650,
      mismoAliases: ['TitleLendersCoveragePremium','Title - Lenders Coverage Premium']
    },
    owners_title_insurance: {
      displayName: "Owner's Title Insurance",
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['TitleOwnersCoveragePremium','Title - Owners Coverage Premium',"Title - Owner's Coverage Premium"]
    },
    settlement_closing_fee: {
      displayName: 'Settlement / Closing Fee',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 250,
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: ['SettlementFee','Settlement Fee','Title - Settlement Fee']
    },
    title_search_fee: {
      displayName: 'Title Search Fee',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 250,
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: ['TitleSearchFee','Title Search Fee','Title - Title Search Fee']
    },
    title_examination_fee: {
      displayName: 'Title Examination Fee',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 150,
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: ['TitleExamFee','TitleExaminationFee','Title - Examination Fee','Title Examination Fee']
    },
    title_location_report: {
      displayName: 'Title Location Report',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 150,
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: ['TitleLocationReport','Title - Location Report']
    },
    attorney_closing_fee: {
      displayName: 'Attorney / Doc Prep',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: ['AttorneyFee','Attorney Fee']
    },
    closing_protection_letter: {
      displayName: 'CPL / Closing Protection Letter',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 0,
      mismoAliases: ['TitleClosingProtectionLetterFee','Title - Closing Protection Letter Fee']
    },
    title_endorsements: {
      displayName: 'Title Endorsements / Tax Cert',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['Title - Tax Cert Fee','TitleTaxCertFee','TitleEndorsementsFee']
    },
    notary_fee: {
      displayName: 'Notary Fee',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: ['NotaryFee','Notary Fee']
    },
    title_wire_fee: {
      displayName: 'Wire Transfer Fee',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 60,
      mismoAliases: ['WireTransferFee','Wire Transfer Fee']
    },
    other_title_fees: {
      displayName: 'Other Title / Settlement',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: []
    },

    // ----- Third-Party Services -----
    appraisal_fee: {
      displayName: 'Appraisal Fee',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 700,
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: ['AppraisalFee','Appraisal Fee']
    },
    credit_report_fee: {
      displayName: 'Credit Report',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 136,
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: ['CreditReportFee','Credit Report Fee']
    },
    initial_flood_cert: {
      displayName: 'Initial Flood Determination',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 8,
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: ['FloodCertification','FloodCertificationFee','Flood Certification']
    },
    voe_fee: {
      displayName: 'Verification of Employment',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 105,
      mismoAliases: ['VerificationOfEmploymentFee','Verification Of Employment Fee']
    },
    aus_fee: {
      displayName: 'AUS Fee (DU / LPA)',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['AUSFee','AutomatedUnderwritingFee']
    },
    pest_inspection_fee: {
      displayName: 'Pest / Well / Septic Inspection',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: ['PestInspectionFee','WellInspectionFee','SepticInspectionFee']
    },
    other_third_party_fees: {
      displayName: 'Other Third-Party Fees',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      conditionCodes: ['BONA_FIDE_REASONABLE'],
      mismoAliases: []
    },

    // ----- Government Recording & Taxes -----
    recording_fee_mortgage: {
      displayName: 'Recording Fee (Deed of Trust)',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 100,
      conditionCodes: ['PUBLIC_OFFICIAL_FEE'],
      mismoAliases: ['RecordingFeeForDeed','Recording Fee For Deed','RecordingFee','DeedOfTrustRecordingFee']
    },
    transfer_tax_deed: {
      displayName: 'Transfer Tax',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      conditionCodes: ['PUBLIC_OFFICIAL_FEE'],
      mismoAliases: ['TransferTax','Transfer Tax','StateRecordingTax','State Recording Tax']
    },
    mortgage_recording_tax: {
      displayName: 'Mortgage Recording Tax',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      conditionCodes: ['PUBLIC_OFFICIAL_FEE'],
      mismoAliases: ['MortgageRecordingTax','IntangibleTax']
    },
    e_recording_fee: {
      displayName: 'E-Recording Fee',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      defaultAmount: 20,
      mismoAliases: ['E-Recording Fee','ERecordingFee']
    },

    // ----- Prepaids & Escrow Reserves -----
    prepaid_interest: {
      displayName: 'Prepaid Interest (Per Diem)',
      aprFlagDefault: 'APR_YES',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['PrepaidInterest','Prepaid Interest']
    },
    hazard_insurance_premium: {
      displayName: 'Hazard Insurance Premium',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      conditionCodes: ['BORROWER_CAN_CHOOSE_INSURER'],
      mismoAliases: ['HazardInsurancePremium','HomeownersInsurance']
    },
    initial_escrow_taxes: {
      displayName: 'Initial Escrow — Taxes',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['InitialEscrowTaxes','EscrowTaxDeposit']
    },
    initial_escrow_hazard_insurance: {
      displayName: 'Initial Escrow — Insurance',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['InitialEscrowHazard','EscrowInsuranceDeposit']
    },
    hoa_dues_prepaid: {
      displayName: 'HOA Dues Prepaid',
      aprFlagDefault: 'APR_NO',
      appliesTo: ['CONV','FHA','VA'],
      mismoAliases: ['HOAPrepaid','HOADuesPrepaid']
    }
  };

  /* ---- UI Groups ----
     Each group lists ordered fee IDs to render.
     Loan-type filtering is enforced per-fee via appliesTo.
  */
  const UI_GROUPS = [
    {
      id: 'lender',
      label: 'Lender Charges',
      feeIds: [
        'origination_fee','underwriting_fee','processing_fee','admin_fee',
        'application_fee_conditional','rate_lock_fee','tax_service_fee',
        'flood_monitoring_fee','electronic_doc_fee','mers_registration_fee',
        'courier_fee','other_lender_fees'
      ]
    },
    {
      id: 'mi',
      label: 'Mortgage Insurance / Guaranty',
      feeIds: [
        'monthly_borrower_paid_pmi','single_premium_pmi','lender_paid_mi',
        'fha_ufmip','fha_annual_mip','va_funding_fee'
      ]
    },
    {
      id: 'title',
      label: 'Title & Settlement',
      feeIds: [
        'lenders_title_insurance','owners_title_insurance','settlement_closing_fee',
        'title_search_fee','title_examination_fee','title_location_report',
        'attorney_closing_fee','closing_protection_letter',
        'title_endorsements','notary_fee','title_wire_fee','other_title_fees'
      ]
    },
    {
      id: 'thirdparty',
      label: 'Third-Party Services',
      feeIds: [
        'appraisal_fee','credit_report_fee','initial_flood_cert','voe_fee',
        'aus_fee','pest_inspection_fee','other_third_party_fees'
      ]
    },
    {
      id: 'government',
      label: 'Government Recording & Taxes',
      feeIds: [
        'recording_fee_mortgage','transfer_tax_deed','mortgage_recording_tax',
        'e_recording_fee'
      ]
    },
    {
      id: 'prepaids',
      label: 'Prepaids & Escrow Reserves',
      feeIds: [
        'prepaid_interest','hazard_insurance_premium','initial_escrow_taxes',
        'initial_escrow_hazard_insurance','hoa_dues_prepaid'
      ]
    }
  ];

  /* ---- MISMO Alias Index (built once) ---- */
  const MISMO_ALIAS_INDEX = (function () {
    const idx = {};
    Object.keys(FEES).forEach(function (id) {
      (FEES[id].mismoAliases || []).forEach(function (alias) {
        idx[alias.toLowerCase()] = id;
      });
    });
    return idx;
  })();

  function mismoKeyToFeeId(key) {
    if (!key) return null;
    return MISMO_ALIAS_INDEX[String(key).toLowerCase()] || null;
  }

  /* ---- Resolver ----
     Returns { includeInApr, aprFlagUsed, reason }
     ctx: { loanType, amount, paidBy, borrowerLegallyBound, chargedToAllApplicants,
            bonaFideAndReasonable, borrowerCanChooseInsurer, isOptionalProduct,
            productDisclosuresSatisfied, isFinanced, manualOverride }
  */
  function resolveAprTreatment(feeId, ctx) {
    const def = FEES[feeId];
    if (!def) return { includeInApr: false, aprFlagUsed: 'APR_NO', reason: 'Unknown fee.' };
    ctx = ctx || {};

    // Manual override takes precedence
    if (ctx.manualOverride === 'APR_YES') {
      return { includeInApr: true, aprFlagUsed: 'APR_YES', reason: 'Manual override: included in APR.' };
    }
    if (ctx.manualOverride === 'APR_NO') {
      return { includeInApr: false, aprFlagUsed: 'APR_NO', reason: 'Manual override: excluded from APR.' };
    }

    // Zero / negative
    if (!ctx.amount || ctx.amount <= 0) {
      return { includeInApr: false, aprFlagUsed: def.aprFlagDefault, reason: 'No positive amount.' };
    }

    // Seller-paid + not legally bound
    if ((ctx.paidBy === 'SELLER' || ctx.isSellerPaid) && ctx.borrowerLegallyBound === false) {
      return { includeInApr: false, aprFlagUsed: 'APR_NO', reason: 'Seller-paid where borrower is not legally bound.' };
    }

    const codes = def.conditionCodes || [];

    // Application fee branch
    if (feeId === 'application_fee_conditional') {
      if (ctx.chargedToAllApplicants) {
        return { includeInApr: false, aprFlagUsed: 'APR_NO', reason: 'Application fee charged to all applicants.' };
      }
      return { includeInApr: true, aprFlagUsed: 'APR_YES', reason: 'Application fee not charged to all applicants.' };
    }

    // Public official fee
    if (codes.indexOf('PUBLIC_OFFICIAL_FEE') !== -1) {
      return { includeInApr: false, aprFlagUsed: 'APR_NO', reason: 'Paid to public official.' };
    }

    // Life-of-loan monitoring
    if (codes.indexOf('LIFE_OF_LOAN_MONITORING') !== -1) {
      return { includeInApr: true, aprFlagUsed: 'APR_YES', reason: 'Life-of-loan monitoring fee.' };
    }

    // Borrower-choice insurance
    if (codes.indexOf('BORROWER_CAN_CHOOSE_INSURER') !== -1) {
      if (ctx.borrowerCanChooseInsurer !== false) {
        return { includeInApr: false, aprFlagUsed: 'APR_NO', reason: 'Property insurance; borrower can choose insurer.' };
      }
      return { includeInApr: true, aprFlagUsed: 'APR_YES', reason: 'Required insurance without borrower choice.' };
    }

    // Optional product
    if (codes.indexOf('OPTIONAL_PRODUCT') !== -1) {
      if (ctx.isOptionalProduct && ctx.productDisclosuresSatisfied) {
        return { includeInApr: false, aprFlagUsed: 'APR_NO', reason: 'Optional product with required disclosures.' };
      }
      return { includeInApr: true, aprFlagUsed: 'APR_YES', reason: 'Required/improperly disclosed credit product.' };
    }

    // Bona fide and reasonable real-estate service
    if (codes.indexOf('BONA_FIDE_REASONABLE') !== -1) {
      if (ctx.bonaFideAndReasonable !== false) {
        return { includeInApr: false, aprFlagUsed: 'APR_NO', reason: 'Real-estate service; bona fide and reasonable.' };
      }
      return { includeInApr: true, aprFlagUsed: 'APR_YES', reason: 'Real-estate service not confirmed bona fide; conservatively included.' };
    }

    // Default
    if (def.aprFlagDefault === 'APR_YES') {
      return { includeInApr: true, aprFlagUsed: 'APR_YES', reason: 'Default classification: APR_YES.' };
    }
    if (def.aprFlagDefault === 'APR_NO') {
      return { includeInApr: false, aprFlagUsed: 'APR_NO', reason: 'Default classification: APR_NO.' };
    }
    return { includeInApr: true, aprFlagUsed: 'APR_CONDITIONAL', reason: 'Conditional fee; included conservatively.' };
  }

  /* ---- Public API ---- */
  const api = {
    FEES: FEES,
    UI_GROUPS: UI_GROUPS,
    resolveAprTreatment: resolveAprTreatment,
    mismoKeyToFeeId: mismoKeyToFeeId,
    getFee: function (id) { return FEES[id] || null; },
    feesForLoanType: function (loanType) {
      const out = {};
      Object.keys(FEES).forEach(function (id) {
        if (FEES[id].appliesTo.indexOf(loanType) !== -1) out[id] = FEES[id];
      });
      return out;
    }
  };

  if (typeof window !== 'undefined') {
    window.MSFG = window.MSFG || {};
    window.MSFG.AprFeeCatalog = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
