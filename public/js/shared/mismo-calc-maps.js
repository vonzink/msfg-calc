/* =====================================================
   MISMO Calculator Field Mappings
   Maps parsed MISMO data → calculator DOM element IDs.
   Requires mismo-parser.js to be loaded first.
   ===================================================== */
(function () {
  'use strict';

  var reg = MSFG.MISMOParser.registerCalcMap;

  /* ---- Helper: find a fee by checking multiple possible keys ---- */
  function feeAmt(fees) {
    var keys = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < keys.length; i++) {
      if (fees[keys[i]]) return fees[keys[i]].amount;
    }
    return 0;
  }

  /* ---- Refinance Calculator (refi) ---- */
  reg('refi', function (data) {
    var m = {};
    if (data.existingMortgage.balance) m['currentBalance'] = data.existingMortgage.balance;
    if (data.existingMortgage.remainingMonths) m['currentTermRemaining'] = data.existingMortgage.remainingMonths;
    if (data.property.value) m['currentPropertyValue'] = data.property.value;
    if (data.loan.amount) m['refiLoanAmount'] = data.loan.amount;
    if (data.loan.rate) m['refiRate'] = data.loan.rate;
    if (data.loan.termMonths) m['refiTerm'] = data.loan.termMonths;

    // MI from projected payments or housing expenses
    if (data.loan.miPayment) m['refiMIMonthlyInput'] = data.loan.miPayment;
    else if (data.housing.mi) m['refiMIMonthlyInput'] = data.housing.mi;

    // Monthly escrow
    if (data.escrow.taxMonthly || data.escrow.insMonthly) {
      m['monthlyEscrow'] = (data.escrow.taxMonthly || 0) + (data.escrow.insMonthly || 0);
    }

    // Loan type mapping
    if (data.loan.mortgageType) {
      var typeMap = { 'Conventional': 'Conventional', 'FHA': 'FHA', 'VA': 'VA', 'USDA': 'USDA',
                      'FederalHousingAdministration': 'FHA', 'VeteransAffairs': 'VA', 'USDARuralHousing': 'USDA' };
      var loanType = typeMap[data.loan.mortgageType] || 'Conventional';
      m['refiLoanType'] = loanType;
    }

    // Individual fees — check both FeeType and FeeTypeOtherDescription variants
    var fees = data.fees || {};

    // Origination charges
    var origAmt = feeAmt(fees, 'LoanOriginationFee', 'OriginationFee', 'Origination Fee');
    if (origAmt) m['feeOrigination'] = origAmt;

    var uwAmt = feeAmt(fees, 'Underwriting Fee', 'UnderwritingFee', 'Processing Fee', 'ProcessingFee');
    if (uwAmt) m['feeUnderwriting'] = uwAmt;

    var discAmt = feeAmt(fees, 'LoanDiscountPoints', 'Loan Discount Points', 'DiscountPoints');
    if (discAmt) m['feeDiscount'] = discAmt;

    // Services borrower cannot shop for
    var appraisalAmt = feeAmt(fees, 'AppraisalFee', 'Appraisal Fee');
    if (appraisalAmt) m['feeAppraisal'] = appraisalAmt;

    var creditAmt = feeAmt(fees, 'CreditReportFee', 'Credit Report Fee');
    if (creditAmt) m['feeCreditReport'] = creditAmt;

    var floodAmt = feeAmt(fees, 'FloodCertification', 'FloodCertificationFee', 'Flood Certification');
    if (floodAmt) m['feeFloodCert'] = floodAmt;

    var techAmt = feeAmt(fees, 'Technology Fee', 'TechnologyFee');
    if (techAmt) m['feeTechnology'] = techAmt;

    var voeAmt = feeAmt(fees, 'VerificationOfEmploymentFee', 'Verification Of Employment Fee');
    if (voeAmt) m['feeVOE'] = voeAmt;

    var votAmt = feeAmt(fees, 'VerificationOfTaxReturnFee', 'Verification Of Tax Return Fee');
    if (votAmt) m['feeVOT'] = votAmt;

    var taxSvcAmt = feeAmt(fees, 'TaxRelatedServiceFee', 'Tax Related Service Fee', 'TaxServiceFee');
    if (taxSvcAmt) m['feeTaxService'] = taxSvcAmt;

    var mersAmt = feeAmt(fees, 'MERSRegistrationFee', 'MERS Registration Fee');
    if (mersAmt) m['feeMERS'] = mersAmt;

    // Services borrower can shop for
    var titleLendersAmt = feeAmt(fees, 'TitleLendersCoveragePremium', 'Title - Lenders Coverage Premium');
    if (titleLendersAmt) m['feeTitleLenders'] = titleLendersAmt;

    var settlementAmt = feeAmt(fees, 'SettlementFee', 'Settlement Fee');
    if (settlementAmt) m['feeTitleSettlement'] = settlementAmt;

    var cplAmt = feeAmt(fees, 'TitleClosingProtectionLetterFee', 'Title - Closing Protection Letter Fee');
    if (cplAmt) m['feeTitleCPL'] = cplAmt;

    var recordingAmt = feeAmt(fees, 'RecordingFeeForDeed', 'Recording Fee For Deed');
    if (recordingAmt) m['feeRecording'] = recordingAmt;

    var eRecAmt = feeAmt(fees, 'E-Recording Fee', 'ERecordingFee');
    if (eRecAmt) m['feeERecording'] = eRecAmt;

    var taxCertAmt = feeAmt(fees, 'Title - Tax Cert Fee', 'TitleTaxCertFee');
    if (taxCertAmt) m['feeTitleTaxCert'] = taxCertAmt;

    var wireAmt = feeAmt(fees, 'WireTransferFee', 'Wire Transfer Fee');
    if (wireAmt) m['feeOther'] = (m['feeOther'] || 0) + wireAmt;

    // Prepaids & Escrow deposits
    var prepaids = data.prepaids || {};
    if (prepaids.interestTotal || prepaids.interestPerDiem) {
      m['feePrepaidInterest'] = prepaids.interestTotal || prepaids.interestPerDiem;
    }
    if (data.escrow.taxMonthly) m['feeEscrowTax'] = data.escrow.taxMonthly;
    if (data.escrow.insMonthly) m['feeEscrowInsurance'] = data.escrow.insMonthly;

    return m;
  });

  /* ---- APR Calculator ---- */
  reg('apr', function (data) {
    var m = {};
    if (data.loan.amount) m['loanAmount'] = data.loan.amount;
    if (data.loan.rate) m['interestRate'] = data.loan.rate;
    if (data.loan.termMonths) m['loanTerm'] = data.loan.termMonths / 12;
    if (data.loan.discountPoints) m['discountPoints'] = data.loan.discountPoints;

    var fees = data.fees || {};

    // Financed fees
    var origAmt = feeAmt(fees, 'LoanOriginationFee', 'OriginationFee', 'Origination Fee');
    if (origAmt) m['originationFee'] = origAmt;

    var uwAmt = feeAmt(fees, 'Underwriting Fee', 'UnderwritingFee');
    if (uwAmt) m['underwritingFee'] = uwAmt;

    var procAmt = feeAmt(fees, 'Processing Fee', 'ProcessingFee');
    if (procAmt) m['processingFee'] = procAmt;

    var creditAmt = feeAmt(fees, 'CreditReportFee', 'Credit Report Fee');
    if (creditAmt) m['creditReportFee'] = creditAmt;

    var floodAmt = feeAmt(fees, 'FloodCertification', 'FloodCertificationFee', 'Flood Certification');
    if (floodAmt) m['floodCertFee'] = floodAmt;

    var taxSvcAmt = feeAmt(fees, 'TaxRelatedServiceFee', 'Tax Related Service Fee', 'TaxServiceFee');
    if (taxSvcAmt) m['taxServiceFee'] = taxSvcAmt;

    // Compute other financed fees (technology, VOE, wire transfer, MERS, etc.)
    var otherFinanced = 0;
    var techAmt = feeAmt(fees, 'Technology Fee', 'TechnologyFee');
    if (techAmt) otherFinanced += techAmt;
    var voeAmt = feeAmt(fees, 'VerificationOfEmploymentFee', 'Verification Of Employment Fee');
    if (voeAmt) otherFinanced += voeAmt;
    var wireAmt = feeAmt(fees, 'WireTransferFee', 'Wire Transfer Fee');
    if (wireAmt) otherFinanced += wireAmt;
    var mersAmt = feeAmt(fees, 'MERSRegistrationFee', 'MERS Registration Fee');
    if (mersAmt) otherFinanced += mersAmt;
    if (otherFinanced > 0) m['otherFinancedFees'] = otherFinanced;

    // Prepaid fees
    var prepaids = data.prepaids || {};
    if (prepaids.interestTotal || prepaids.interestPerDiem) {
      m['prepaidInterest'] = prepaids.interestTotal || prepaids.interestPerDiem;
    }

    // MI
    if (data.loan.miPayment) m['monthlyMI'] = data.loan.miPayment;
    else if (data.housing.mi) m['monthlyMI'] = data.housing.mi;

    // Escrow reserves
    if (data.escrow.initialBalance) m['escrowReserves'] = data.escrow.initialBalance;

    // Title & Recording
    var titleAmt = feeAmt(fees, 'TitleLendersCoveragePremium', 'Title - Lenders Coverage Premium');
    var settlementAmt = feeAmt(fees, 'SettlementFee', 'Settlement Fee');
    var cplAmt = feeAmt(fees, 'TitleClosingProtectionLetterFee', 'Title - Closing Protection Letter Fee');
    var taxCertAmt = feeAmt(fees, 'Title - Tax Cert Fee', 'TitleTaxCertFee');
    var totalTitle = titleAmt + settlementAmt + cplAmt + taxCertAmt;
    if (totalTitle > 0) m['titleInsurance'] = totalTitle;

    var recordingAmt = feeAmt(fees, 'RecordingFeeForDeed', 'Recording Fee For Deed');
    var eRecAmt = feeAmt(fees, 'E-Recording Fee', 'ERecordingFee');
    var totalRecording = recordingAmt + eRecAmt;
    if (totalRecording > 0) m['recordingFees'] = totalRecording;

    // Prepaid hazard insurance
    if (prepaids.hazardInsurance) {
      m['otherPrepaidFees'] = (m['otherPrepaidFees'] || 0) + prepaids.hazardInsurance;
    }

    return m;
  });

  /* ---- Cash vs Mortgage ---- */
  reg('cash-vs-mortgage', function (data) {
    var m = {};
    if (data.property.value) m['priceCash'] = data.property.value;
    if (data.loan.rate) m['mortRate'] = data.loan.rate;
    if (data.loan.downPct) m['downPct'] = data.loan.downPct;
    if (data.loan.termMonths) m['mortTerm'] = Math.round(data.loan.termMonths / 12);
    return m;
  });

  /* ---- Buy vs Rent ---- */
  reg('buy-vs-rent', function (data) {
    var m = {};
    if (data.property.value) m['purchasePrice'] = data.property.value;
    if (data.loan.rate) m['rateBuy'] = data.loan.rate;
    if (data.loan.downPct) m['downPercent'] = data.loan.downPct;
    if (data.escrow.taxAnnual && data.property.value) m['taxRate'] = +(data.escrow.taxAnnual / data.property.value * 100).toFixed(3);
    if (data.escrow.insAnnual) m['insurance'] = data.escrow.insAnnual;
    if (data.loan.termMonths) m['termBuy'] = Math.round(data.loan.termMonths / 12);
    return m;
  });

  /* ---- FHA (Unified: purchase, refi, streamline) ---- */
  reg('fha', function (data) {
    var m = {};
    var fees = data.fees || {};

    // Borrower
    if (data.borrowerName) m['fhaBorrowerName'] = data.borrowerName;

    // Property
    if (data.property.value) {
      m['fhaAppraisedValue'] = data.property.value;
      m['fhaPurchasePrice'] = data.property.value;
    }

    // Current loan
    if (data.existingMortgage.balance) m['fhaCurrentUpb'] = data.existingMortgage.balance;
    if (data.existingMortgage.payment) m['fhaCurrentPayment'] = data.existingMortgage.payment;
    if (data.existingMortgage.remainingMonths) m['fhaRemainingTerm'] = data.existingMortgage.remainingMonths;
    if (data.loan.amount) m['fhaOriginalLoanAmount'] = data.loan.amount;

    // Requested / actual loan amount
    if (data.loan.amount) m['fhaRequestedLoanAmount'] = data.loan.amount;

    // New loan
    if (data.loan.rate) m['fhaNewRate'] = data.loan.rate;
    if (data.loan.termMonths) {
      var termYears = Math.round(data.loan.termMonths / 12);
      if ([15, 20, 25, 30].indexOf(termYears) !== -1) m['fhaNewTerm'] = termYears;
    }

    // Is existing FHA
    if (data.loan.mortgageType) {
      var isFha = data.loan.mortgageType === 'FHA' || data.loan.mortgageType === 'FederalHousingAdministration';
      if (isFha) m['fhaIsExistingFha'] = true;
    }

    // Loan type (Fixed/ARM)
    if (data.loan.amortType) {
      var typeMap = { 'Fixed': 'fixed', 'AdjustableRate': 'arm' };
      if (typeMap[data.loan.amortType]) {
        m['fhaCurrentLoanType'] = typeMap[data.loan.amortType];
        m['fhaNewLoanType'] = typeMap[data.loan.amortType];
      }
    }

    // Itemized fees
    var origAmt = feeAmt(fees, 'LoanOriginationFee', 'OriginationFee', 'Origination Fee');
    if (origAmt) m['fhaCostOrigination'] = origAmt;
    var procAmt = feeAmt(fees, 'Processing Fee', 'ProcessingFee');
    if (procAmt) m['fhaCostProcessing'] = procAmt;
    var uwAmt = feeAmt(fees, 'Underwriting Fee', 'UnderwritingFee');
    if (uwAmt) m['fhaCostUnderwriting'] = uwAmt;
    var discAmt = feeAmt(fees, 'LoanDiscountPoints', 'Loan Discount Points', 'DiscountPoints');
    if (discAmt) m['fhaCostPoints'] = discAmt;
    var creditAmt = feeAmt(fees, 'CreditReportFee', 'Credit Report Fee');
    if (creditAmt) m['fhaCostCredit'] = creditAmt;
    var floodAmt = feeAmt(fees, 'FloodCertification', 'FloodCertificationFee', 'Flood Certification');
    if (floodAmt) m['fhaCostFlood'] = floodAmt;
    var titleAmt = feeAmt(fees, 'TitleLendersCoveragePremium', 'Title - Lenders Coverage Premium', 'TitleSearchFee');
    if (titleAmt) m['fhaCostTitleSearch'] = titleAmt;
    var settlementAmt = feeAmt(fees, 'SettlementFee', 'Settlement Fee', 'TitleInsurance');
    if (settlementAmt) m['fhaCostTitleInsurance'] = settlementAmt;
    var recordingAmt = feeAmt(fees, 'RecordingFeeForDeed', 'Recording Fee For Deed', 'RecordingFee');
    if (recordingAmt) m['fhaCostRecording'] = recordingAmt;
    var cplAmt = feeAmt(fees, 'TitleClosingProtectionLetterFee', 'Title - Closing Protection Letter Fee', 'AttorneyFee');
    if (cplAmt) m['fhaCostAttorney'] = cplAmt;

    // Prepaids & escrow deposits
    var prepaids = data.prepaids || {};
    var escrow = data.escrow || {};
    var prepaidTotal = 0;
    if (prepaids.hazardInsurance) prepaidTotal += prepaids.hazardInsurance;
    if (prepaids.interestTotal) prepaidTotal += prepaids.interestTotal;
    if (escrow.taxDeposit) prepaidTotal += escrow.taxDeposit;
    else if (escrow.taxMonthly && escrow.taxMonths) prepaidTotal += escrow.taxMonthly * escrow.taxMonths;
    if (escrow.insDeposit) prepaidTotal += escrow.insDeposit;
    else if (escrow.insMonthly && escrow.insMonths) prepaidTotal += escrow.insMonthly * escrow.insMonths;
    if (prepaidTotal > 0) m['fhaPrepaidsCash'] = prepaidTotal;

    // Escrow refund from current loan (refi scenarios)
    if (escrow.initialBalance) m['fhaEscrowRefund'] = escrow.initialBalance;

    // Monthly escrow items (new fields)
    if (escrow.taxMonthly) m['fhaMonthlyTax'] = escrow.taxMonthly;
    if (escrow.insMonthly) m['fhaMonthlyInsurance'] = escrow.insMonthly;
    if (data.housing && data.housing.hoa) m['fhaMonthlyHoa'] = data.housing.hoa;

    // County loan limit (new field)
    if (data.property.countyLimit) m['fhaCountyLimit'] = data.property.countyLimit;

    return m;
  });

  /* ---- VA Pre-Qual ---- */
  reg('va-prequal', function (data) {
    var m = {};
    if (data.loan.amount) m['mortgageAmount'] = data.loan.amount;
    if (data.qualification.totalMonthlyIncome) m['grossIncome'] = data.qualification.totalMonthlyIncome;
    if (data.borrowerName) m['borrowerName'] = data.borrowerName;
    if (data.escrow.taxMonthly) m['propertyTaxes'] = data.escrow.taxMonthly;
    if (data.escrow.insMonthly) m['homeInsurance'] = data.escrow.insMonthly;
    if (data.housing.hoa) m['hoaDues'] = data.housing.hoa;
    return m;
  });

  /* ---- Escrow Calculator ---- */
  reg('escrow', function (data) {
    var m = {};
    if (data.escrow.taxAnnual) m['annualTax'] = data.escrow.taxAnnual;
    if (data.escrow.insAnnual) m['annualIns'] = data.escrow.insAnnual;
    if (typeof data.escrow.cushionMonths === 'number') m['cushionMonths'] = data.escrow.cushionMonths;

    if (data.loan.purpose) {
      var purposeMap = { 'Refinance': 'Refinance', 'Purchase': 'Purchase' };
      if (purposeMap[data.loan.purpose]) m['loanType'] = purposeMap[data.loan.purpose];
    }

    if (data.property.state) m['state'] = data.property.state;

    return m;
  });

  /* ---- Blended Rate ---- */
  reg('blended-rate', function (data) {
    var m = {};
    var debts = data.liabilities.filter(function (l) { return !l.payoff && l.balance > 0; });
    for (var i = 0; i < Math.min(debts.length, 5); i++) {
      m['d' + (i + 1) + '_bal'] = debts[i].balance;
      m['d' + (i + 1) + '_pay'] = debts[i].payment;
    }
    return m;
  });

  /* ---- Buydown ---- */
  reg('buydown', function (data) {
    var m = {};
    if (data.loan.amount) m['loanAmount'] = data.loan.amount;
    if (data.loan.rate) m['noteRate'] = data.loan.rate;
    if (data.escrow.taxAnnual) m['propertyTaxes'] = data.escrow.taxAnnual;
    if (data.escrow.insAnnual) m['insurance'] = data.escrow.insAnnual;
    if (data.housing.hoa) m['hoa'] = data.housing.hoa;
    if (data.loan.termMonths) m['loanTerm'] = Math.round(data.loan.termMonths / 12);
    return m;
  });

  /* ---- REO ---- */
  reg('reo', function (data) {
    var m = {};
    if (data.property.value) m['purchasePrice'] = data.property.value;
    if (data.loan.rate) m['rate'] = data.loan.rate;
    if (data.loan.downPct) m['downPct'] = data.loan.downPct;
    if (data.property.address) m['street'] = data.property.address;
    if (data.property.city) m['city'] = data.property.city;
    if (data.escrow.taxAnnual && data.property.value) m['propTaxRate'] = +(data.escrow.taxAnnual / data.property.value * 100).toFixed(3);
    if (data.escrow.insAnnual) m['ins'] = data.escrow.insAnnual;
    if (data.housing.hoa) m['hoa'] = data.housing.hoa;
    return m;
  });

  /* ---- Amortization Calculator (native EJS) ---- */
  reg('amortization', function (data) {
    var m = {};
    if (data.property.value) m['homePrice'] = data.property.value;
    if (data.loan.downPayment) m['downPaymentDollar'] = data.loan.downPayment;
    if (data.loan.downPct) m['downPaymentPercent'] = data.loan.downPct;
    if (data.loan.rate) m['interestRate'] = data.loan.rate;
    if (data.loan.termMonths) m['__amort_term'] = data.loan.termMonths / 12;
    if (data.escrow.taxAnnual) m['propertyTax'] = data.escrow.taxAnnual;
    if (data.escrow.insAnnual) m['homeInsurance'] = data.escrow.insAnnual;
    if (data.housing.mi) m['pmi'] = data.housing.mi;
    return m;
  });

  /* ---- Fee Worksheet ---- */
  reg('fee-worksheet', function (data) {
    var m = {};
    var fees = data.fees || {};
    var prepaids = data.prepaids || {};

    // Borrower & Loan info
    if (data.borrowerName) m['fwBorrowerName'] = data.borrowerName;
    if (data.property.value) m['fwPropertyValue'] = data.property.value;
    if (data.loan.amount) m['fwLoanAmount'] = data.loan.amount;
    if (data.loan.noteAmount) m['fwTotalLoanAmt'] = data.loan.noteAmount;
    else if (data.loan.amount) m['fwTotalLoanAmt'] = data.loan.amount;
    if (data.loan.rate) m['fwRate'] = data.loan.rate;
    if (data.loan.termMonths) m['fwTermMonths'] = data.loan.termMonths;
    if (data.loan.apr) m['fwAPR'] = data.loan.apr;
    if (data.loan.downPayment) m['fwDownPayment'] = data.loan.downPayment;

    // File number from MISMO loan identifier
    if (data.loan.loanIdentifier) m['fwFileNumber'] = data.loan.loanIdentifier;

    // Loan purpose
    if (data.loan.purpose) {
      var purposeMap = {
        'Refinance': 'Refinance', 'Purchase': 'Purchase',
        'NoCash-OutRefinance': 'NoCashOutRefinance', 'NoCashOutRefinance': 'NoCashOutRefinance',
        'CashOutRefinance': 'CashOutRefinance', 'Cash-OutRefinance': 'CashOutRefinance',
        'Construction': 'Construction', 'ConstructionToPermanent': 'ConstructionPerm', 'ConstructionPerm': 'ConstructionPerm'
      };
      if (purposeMap[data.loan.purpose]) m['fwLoanPurpose'] = purposeMap[data.loan.purpose];
    }

    // Refinance: populate purchase price with existing mortgage balance
    var isRefiPurpose = data.loan.purpose && data.loan.purpose.indexOf('Refinance') !== -1;
    if (isRefiPurpose && data.existingMortgage && data.existingMortgage.balance) {
      m['fwPurchasePrice'] = data.existingMortgage.balance;
    }

    // Occupancy
    if (data.property.usage) {
      var usageMap = { 'PrimaryResidence': 'Primary Residence', 'SecondHome': 'Second Home', 'Investment': 'Investment' };
      if (usageMap[data.property.usage]) m['fwOccupancy'] = usageMap[data.property.usage];
    }

    // Property type
    if (data.property.type) {
      var typeMap = { 'Detached': 'Detached', 'Attached': 'Attached', 'Condominium': 'Condo', 'PUD': 'Townhome' };
      if (typeMap[data.property.type]) m['fwPropertyType'] = typeMap[data.property.type];
    }

    // Product name
    if (data.loan.productName) m['fwProduct'] = data.loan.productName;
    else {
      var prodParts = [];
      if (data.loan.mortgageType) {
        var mtMap = { 'Conventional': 'Conv', 'FHA': 'FHA', 'VA': 'VA', 'USDA': 'USDA',
                      'FederalHousingAdministration': 'FHA', 'VeteransAffairs': 'VA' };
        prodParts.push(mtMap[data.loan.mortgageType] || data.loan.mortgageType);
      }
      if (data.loan.termMonths) prodParts.push(Math.round(data.loan.termMonths / 12) + ' Year');
      if (data.loan.amortType) {
        var atMap = { 'Fixed': 'Fixed', 'AdjustableRate': 'ARM' };
        prodParts.push(atMap[data.loan.amortType] || data.loan.amortType);
      }
      if (prodParts.length) m['fwProduct'] = prodParts.join(' ');
    }

    // Origination charges
    var origAmt = feeAmt(fees, 'LoanOriginationFee', 'OriginationFee', 'Origination Fee');
    if (origAmt) m['fwOrigFee'] = origAmt;
    var discAmt = feeAmt(fees, 'LoanDiscountPoints', 'Loan Discount Points', 'DiscountPoints');
    if (discAmt) m['fwDiscountPts'] = discAmt;
    var procAmt = feeAmt(fees, 'Processing Fee', 'ProcessingFee');
    if (procAmt) m['fwProcessingFee'] = procAmt;
    var uwAmt = feeAmt(fees, 'Underwriting Fee', 'UnderwritingFee');
    if (uwAmt) m['fwUnderwritingFee'] = uwAmt;

    // Services borrower cannot shop
    var appraisalAmt = feeAmt(fees, 'AppraisalFee', 'Appraisal Fee');
    if (appraisalAmt) m['fwAppraisalFee'] = appraisalAmt;
    var creditAmt = feeAmt(fees, 'CreditReportFee', 'Credit Report Fee');
    if (creditAmt) m['fwCreditReportFee'] = creditAmt;
    var techAmt = feeAmt(fees, 'Technology Fee', 'TechnologyFee');
    if (techAmt) m['fwTechFee'] = techAmt;
    var voeAmt = feeAmt(fees, 'VerificationOfEmploymentFee', 'Verification Of Employment Fee');
    if (voeAmt) m['fwVOEFee'] = voeAmt;
    var floodAmt = feeAmt(fees, 'FloodCertification', 'FloodCertificationFee', 'Flood Certification');
    if (floodAmt) m['fwFloodFee'] = floodAmt;
    var taxSvcAmt = feeAmt(fees, 'TaxRelatedServiceFee', 'Tax Related Service Fee', 'TaxServiceFee');
    if (taxSvcAmt) m['fwTaxServiceFee'] = taxSvcAmt;
    var mersAmt = feeAmt(fees, 'MERSRegistrationFee', 'MERS Registration Fee');
    if (mersAmt) m['fwMERSFee'] = mersAmt;

    // Services borrower can shop for
    var eRecAmt = feeAmt(fees, 'E-Recording Fee', 'ERecordingFee');
    if (eRecAmt) m['fwERecordingFee'] = eRecAmt;
    var cplAmt = feeAmt(fees, 'TitleClosingProtectionLetterFee', 'Title - Closing Protection Letter Fee');
    if (cplAmt) m['fwTitleCPL'] = cplAmt;
    var titleLendersAmt = feeAmt(fees, 'TitleLendersCoveragePremium', 'Title - Lenders Coverage Premium');
    if (titleLendersAmt) m['fwTitleLenders'] = titleLendersAmt;
    var settlementAmt = feeAmt(fees, 'SettlementFee', 'Settlement Fee', 'Title - Settlement Fee');
    if (settlementAmt) m['fwTitleSettlement'] = settlementAmt;
    var taxCertAmt = feeAmt(fees, 'Title - Tax Cert Fee', 'TitleTaxCertFee');
    if (taxCertAmt) m['fwTitleTaxCert'] = taxCertAmt;
    var titleOwnersAmt = feeAmt(fees, 'TitleOwnersCoveragePremium', 'Title - Owners Coverage Premium', "Title - Owner's Coverage Premium");
    if (titleOwnersAmt) m['fwTitleOwners'] = titleOwnersAmt;
    var wireAmt = feeAmt(fees, 'WireTransferFee', 'Wire Transfer Fee');
    if (wireAmt) m['fwWireFee'] = wireAmt;

    // Government fees
    var recordingAmt = feeAmt(fees, 'RecordingFeeForDeed', 'Recording Fee For Deed');
    if (recordingAmt) m['fwRecordingFee'] = recordingAmt;
    var transferTaxAmt = feeAmt(fees, 'TransferTax', 'Transfer Tax', 'StateRecordingTax', 'State Recording Tax');
    if (transferTaxAmt) m['fwTransferTax'] = transferTaxAmt;

    // Prepaids
    if (data.escrow.insMonthly) m['fwHazInsAmt'] = data.escrow.insMonthly;
    if (prepaids.hazardInsuranceMonths) m['fwHazInsMonths'] = prepaids.hazardInsuranceMonths;
    else if (prepaids.hazardInsurance && data.escrow.insMonthly && data.escrow.insMonthly > 0) {
      m['fwHazInsMonths'] = Math.round(prepaids.hazardInsurance / data.escrow.insMonthly);
    }
    if (prepaids.interestPerDiem) m['fwPrepaidIntPerDiem'] = prepaids.interestPerDiem;

    // Escrow deposits
    if (data.escrow.taxMonthly) m['fwEscTaxAmt'] = data.escrow.taxMonthly;
    if (data.escrow.taxMonths) m['fwEscTaxMonths'] = data.escrow.taxMonths;
    if (data.escrow.insMonthly) m['fwEscInsAmt'] = data.escrow.insMonthly;
    if (data.escrow.insMonths) m['fwEscInsMonths'] = data.escrow.insMonths;

    // Seller / Lender credits
    if (data.closingCostFunds) {
      if (data.closingCostFunds.sellerCredits) m['fwSellerCredits'] = data.closingCostFunds.sellerCredits;
      if (data.closingCostFunds.lenderCredits) m['fwLenderCredits'] = data.closingCostFunds.lenderCredits;
    }

    // Monthly housing
    if (data.housing.mi) m['fwMonthlyMI'] = data.housing.mi;
    if (data.housing.hoa) m['fwMonthlyHOA'] = data.housing.hoa;

    // Collect unmapped fees into __custom_items
    var mappedFeeKeys = {};
    [
      'LoanOriginationFee', 'OriginationFee', 'Origination Fee',
      'LoanDiscountPoints', 'Loan Discount Points', 'DiscountPoints',
      'Processing Fee', 'ProcessingFee', 'Underwriting Fee', 'UnderwritingFee',
      'AppraisalFee', 'Appraisal Fee', 'CreditReportFee', 'Credit Report Fee',
      'Technology Fee', 'TechnologyFee', 'VerificationOfEmploymentFee', 'Verification Of Employment Fee',
      'FloodCertification', 'FloodCertificationFee', 'Flood Certification',
      'TaxRelatedServiceFee', 'Tax Related Service Fee', 'TaxServiceFee',
      'MERSRegistrationFee', 'MERS Registration Fee', 'E-Recording Fee', 'ERecordingFee',
      'TitleClosingProtectionLetterFee', 'Title - Closing Protection Letter Fee',
      'TitleLendersCoveragePremium', 'Title - Lenders Coverage Premium',
      'SettlementFee', 'Settlement Fee', 'Title - Settlement Fee',
      'Title - Tax Cert Fee', 'TitleTaxCertFee',
      'TitleOwnersCoveragePremium', 'Title - Owners Coverage Premium', "Title - Owner's Coverage Premium",
      'WireTransferFee', 'Wire Transfer Fee',
      'RecordingFeeForDeed', 'Recording Fee For Deed',
      'TransferTax', 'Transfer Tax', 'StateRecordingTax', 'State Recording Tax'
    ].forEach(function (k) { mappedFeeKeys[k] = true; });

    var unmappedItems = [];
    var feeKeys = Object.keys(fees);
    feeKeys.forEach(function (key) {
      if (mappedFeeKeys[key]) return;
      var fee = fees[key];
      if (!fee || !fee.amount) return;

      var section = 'other';
      var sType = fee.section || '';
      if (sType === 'OriginationCharges') section = 'origination';
      else if (sType === 'ServicesYouCannotShopFor' || sType === 'ServicesBorrowerDidNotShop') section = 'cannotShop';
      else if (sType === 'ServicesYouCanShopFor' || sType === 'ServicesBorrowerDidShop') section = 'canShop';
      else if (sType === 'TaxesAndOtherGovernmentFees') section = 'government';
      else if (sType === 'Prepaids') section = 'prepaids';
      else if (sType === 'InitialEscrowPaymentAtClosing') section = 'escrow';

      unmappedItems.push({ section: section, name: key, amount: fee.amount });
    });

    if (unmappedItems.length > 0) {
      m['__custom_items'] = unmappedItems;
    }

    return m;
  });

  /* ---- Loan Comparison ---- */
  reg('compare', function (data, colIdx) {
    var idx = colIdx || 1;
    var m = {};
    var fees = data.fees || {};
    var prepaids = data.prepaids || {};

    // Core loan fields
    if (data.loan.amount) m['cmpLoanAmount_' + idx] = data.loan.amount;
    if (data.property.value) m['cmpPropertyValue_' + idx] = data.property.value;
    if (data.loan.rate) m['cmpRate_' + idx] = data.loan.rate;
    if (data.loan.termMonths) m['cmpTerm_' + idx] = data.loan.termMonths;
    if (data.loan.apr) m['cmpAPR_' + idx] = data.loan.apr;
    if (data.loan.downPayment) m['cmpDownPayment_' + idx] = data.loan.downPayment;

    // Shared fields (only for first loan column)
    if (idx === 1) {
      if (data.borrowerName) m['cmpBorrower'] = data.borrowerName;
      if (data.propertyAddress) m['cmpProperty'] = data.propertyAddress;
      if (data.loan.loanIdentifier) m['cmpFileNumber'] = data.loan.loanIdentifier;
    }

    // Purpose — no longer per-loan; set on the global toggle via JS if needed

    // Product
    if (data.loan.productName) {
      m['cmpProduct_' + idx] = data.loan.productName;
    } else {
      var prodParts = [];
      if (data.loan.mortgageType) {
        var mtMap = { 'Conventional': 'Conv', 'FHA': 'FHA', 'VA': 'VA', 'USDA': 'USDA',
                      'FederalHousingAdministration': 'FHA', 'VeteransAffairs': 'VA' };
        prodParts.push(mtMap[data.loan.mortgageType] || data.loan.mortgageType);
      }
      if (data.loan.termMonths) prodParts.push(Math.round(data.loan.termMonths / 12) + 'yr');
      if (data.loan.amortType) {
        var atMap = { 'Fixed': 'Fixed', 'AdjustableRate': 'ARM' };
        prodParts.push(atMap[data.loan.amortType] || data.loan.amortType);
      }
      if (prodParts.length) m['cmpProduct_' + idx] = prodParts.join(' ');
    }

    // Origination charges
    var origAmt = feeAmt(fees, 'LoanOriginationFee', 'OriginationFee', 'Origination Fee');
    if (origAmt) m['cmpOrigFee_' + idx] = origAmt;
    var discAmt = feeAmt(fees, 'LoanDiscountPoints', 'Loan Discount Points', 'DiscountPoints');
    if (discAmt) m['cmpDiscountPts_' + idx] = discAmt;
    var procAmt = feeAmt(fees, 'Processing Fee', 'ProcessingFee');
    if (procAmt) m['cmpProcessingFee_' + idx] = procAmt;
    var uwAmt = feeAmt(fees, 'Underwriting Fee', 'UnderwritingFee');
    if (uwAmt) m['cmpUnderwritingFee_' + idx] = uwAmt;

    // Third-party fees
    var appraisalAmt = feeAmt(fees, 'AppraisalFee', 'Appraisal Fee');
    if (appraisalAmt) m['cmpAppraisalFee_' + idx] = appraisalAmt;
    var creditAmt = feeAmt(fees, 'CreditReportFee', 'Credit Report Fee');
    if (creditAmt) m['cmpCreditReportFee_' + idx] = creditAmt;

    // Services you cannot shop for — flood cert & tax service
    var floodAmt = feeAmt(fees, 'FloodCertification', 'FloodCertificationFee', 'Flood Certification');
    if (floodAmt) m['cmpFloodCert_' + idx] = floodAmt;
    var taxSvcAmt = feeAmt(fees, 'TaxRelatedServiceFee', 'Tax Related Service Fee', 'TaxServiceFee');
    if (taxSvcAmt) m['cmpTaxService_' + idx] = taxSvcAmt;

    // Services you can shop for — title & settlement
    var titleSearchAmt = 0;
    titleSearchAmt += feeAmt(fees, 'TitleClosingProtectionLetterFee', 'Title - Closing Protection Letter Fee');
    titleSearchAmt += feeAmt(fees, 'Title - Tax Cert Fee', 'TitleTaxCertFee');
    if (titleSearchAmt) m['cmpTitleSearch_' + idx] = titleSearchAmt;

    var titleInsAmt = 0;
    titleInsAmt += feeAmt(fees, 'TitleLendersCoveragePremium', 'Title - Lenders Coverage Premium');
    titleInsAmt += feeAmt(fees, 'TitleOwnersCoveragePremium', 'Title - Owners Coverage Premium');
    if (titleInsAmt) m['cmpTitleInsurance_' + idx] = titleInsAmt;

    var settlementAmt = feeAmt(fees, 'SettlementFee', 'Settlement Fee', 'Title - Settlement Fee');
    if (settlementAmt) m['cmpSettlementFee_' + idx] = settlementAmt;

    // Government fees
    var recordingAmt = feeAmt(fees, 'RecordingFeeForDeed', 'Recording Fee For Deed');
    if (recordingAmt) m['cmpRecordingFee_' + idx] = recordingAmt;
    var transferTaxAmt = feeAmt(fees, 'TransferTax', 'Transfer Tax', 'StateRecordingTax', 'State Recording Tax');
    if (transferTaxAmt) m['cmpTransferTax_' + idx] = transferTaxAmt;

    // Seller / Lender credits
    if (data.closingCostFunds) {
      if (data.closingCostFunds.sellerCredits) m['cmpSellerConcessions_' + idx] = data.closingCostFunds.sellerCredits;
      if (data.closingCostFunds.lenderCredits) m['cmpLenderCredits_' + idx] = data.closingCostFunds.lenderCredits;
    }

    // Prepaids
    if (prepaids.hazardInsurance) m['cmpPrepaidInsurance_' + idx] = prepaids.hazardInsurance;
    if (prepaids.interestTotal || prepaids.interestPerDiem) {
      m['cmpPrepaidInterest_' + idx] = prepaids.interestTotal || prepaids.interestPerDiem;
    }

    // Escrow
    if (data.escrow.taxDeposit) m['cmpEscrowTax_' + idx] = data.escrow.taxDeposit;
    else if (data.escrow.taxMonthly && data.escrow.taxMonths) {
      m['cmpEscrowTax_' + idx] = data.escrow.taxMonthly * data.escrow.taxMonths;
    }
    if (data.escrow.insDeposit) m['cmpEscrowInsurance_' + idx] = data.escrow.insDeposit;
    else if (data.escrow.insMonthly && data.escrow.insMonths) {
      m['cmpEscrowInsurance_' + idx] = data.escrow.insMonthly * data.escrow.insMonths;
    }

    // Monthly housing
    if (data.housing.taxMo || data.escrow.taxMonthly) m['cmpMonthlyTax_' + idx] = data.housing.taxMo || data.escrow.taxMonthly;
    if (data.housing.insuranceMo || data.escrow.insMonthly) m['cmpMonthlyInsurance_' + idx] = data.housing.insuranceMo || data.escrow.insMonthly;
    if (data.housing.mi || data.loan.miPayment) m['cmpMonthlyMI_' + idx] = data.housing.mi || data.loan.miPayment;
    if (data.housing.hoa) m['cmpMonthlyHOA_' + idx] = data.housing.hoa;

    // Payoffs
    var mortgagePayoffs = [];
    var otherPayoffs = 0;
    data.liabilities.forEach(function (l) {
      if (l.payoff && l.balance > 0) {
        if (l.type === 'MortgageLoan') mortgagePayoffs.push(l.balance);
        else otherPayoffs += l.balance;
      }
    });
    if (mortgagePayoffs.length >= 1) m['cmpPayoff1st_' + idx] = mortgagePayoffs[0];
    if (mortgagePayoffs.length >= 2) m['cmpPayoff2nd_' + idx] = mortgagePayoffs[1];
    if (otherPayoffs > 0) m['cmpPayoffOther_' + idx] = otherPayoffs;

    return m;
  });

  /* ---- Cover Letter / Loan Analysis ---- */
  reg('loan-analysis', function (data) {
    var m = {};

    if (data.borrowers.length > 0) {
      var b1 = data.borrowers[0];
      m['laBorrowerName'] = [b1.firstName, b1.middleName, b1.lastName].filter(Boolean).join(' ');
    }
    if (data.borrowers.length > 1) {
      var b2 = data.borrowers[1];
      m['laCoBorrowerName'] = [b2.firstName, b2.middleName, b2.lastName].filter(Boolean).join(' ');
    }

    if (data.property.address) m['laStreet'] = data.property.address;
    if (data.property.city) m['laCity'] = data.property.city;
    if (data.property.state) m['laState'] = data.property.state;
    if (data.property.zip) m['laZip'] = data.property.zip;

    var lo = data.loanOriginator || {};
    if (lo.fullName) m['laLoName'] = lo.fullName;
    if (lo.nmls) m['laLoNmls'] = lo.nmls;
    if (lo.phone) m['laLoPhone'] = lo.phone;
    if (lo.email) m['laLoEmail'] = lo.email;
    if (data.loanOriginationCompany && data.loanOriginationCompany.name) {
      m['laLoCompany'] = data.loanOriginationCompany.name;
    }

    return m;
  });

  /* ---- LLPM Tool ---- */
  reg('llpm', function (data) {
    var m = {};

    if (data.loan.amount) m['loanAmount'] = data.loan.amount;
    if (data.property.value) m['propertyValue'] = data.property.value;
    if (data.loan.rate) m['baseRate'] = data.loan.rate;

    if (data.borrowers.length > 0 && data.borrowers[0].creditScore) {
      m['creditScore'] = data.borrowers[0].creditScore;
    }

    if (data.loan.termMonths) {
      var termYears = Math.round(data.loan.termMonths / 12);
      var validTerms = [10, 15, 20, 25, 30];
      if (validTerms.indexOf(termYears) !== -1) m['termYears'] = String(termYears);
    }

    if (data.property.units) m['units'] = String(data.property.units);

    var purposeMap = {
      'Purchase': 'Purchase', 'Refinance': 'LimitedCashOut',
      'NoCash-OutRefinance': 'LimitedCashOut', 'NoCashOutRefinance': 'LimitedCashOut',
      'CashOutRefinance': 'CashOut', 'Cash-OutRefinance': 'CashOut'
    };
    if (data.loan.purpose && purposeMap[data.loan.purpose]) {
      m['__radio_purpose'] = purposeMap[data.loan.purpose];
    }

    if (data.loan.amortType) {
      var prodMap = { 'Fixed': 'Fixed', 'AdjustableRate': 'ARM' };
      if (prodMap[data.loan.amortType]) m['__radio_productType'] = prodMap[data.loan.amortType];
    }

    if (data.property.usage) {
      var occMap = { 'PrimaryResidence': 'Primary', 'SecondHome': 'SecondHome', 'Investment': 'Investment', 'Investor': 'Investment' };
      if (occMap[data.property.usage]) m['__radio_occupancy'] = occMap[data.property.usage];
    }

    if (data.property.type === 'Condominium') m['isCondo'] = true;
    if (data.property.type === 'ManufacturedHousing' || data.property.type === 'Manufactured') {
      m['isManufacturedHome'] = true;
    }

    return m;
  });

  /* ---- Budgeting Calculator ---- */
  reg('budget', function (data) {
    var m = {};

    /* Borrower & loan info */
    if (data.borrowerName) m['bgBorrowerName'] = data.borrowerName;
    if (data.loan.loanIdentifier) m['bgFileNumber'] = data.loan.loanIdentifier;
    if (data.loan.amount) m['bgLoanAmount'] = data.loan.amount;
    if (data.loan.rate) m['bgRate'] = data.loan.rate;
    if (data.loan.termMonths) m['bgTermMonths'] = data.loan.termMonths;
    if (data.property.value) m['bgPropertyValue'] = data.property.value;
    if (data.borrowers.length > 0 && data.borrowers[0].creditScore) m['bgCreditScore'] = data.borrowers[0].creditScore;

    /* Loan purpose */
    if (data.loan.purpose) {
      var purposeMap = { 'Purchase': 'Purchase', 'Refinance': 'Refinance',
        'NoCash-OutRefinance': 'NoCashOutRefinance', 'NoCashOutRefinance': 'NoCashOutRefinance',
        'CashOutRefinance': 'CashOutRefinance', 'Cash-OutRefinance': 'CashOutRefinance' };
      if (purposeMap[data.loan.purpose]) m['bgLoanPurpose'] = purposeMap[data.loan.purpose];
    }

    /* Product */
    if (data.loan.productName) m['bgProduct'] = data.loan.productName;
    else {
      var pp = [];
      if (data.loan.mortgageType) {
        var mt = { 'Conventional': 'Conv', 'FHA': 'FHA', 'VA': 'VA', 'USDA': 'USDA',
                   'FederalHousingAdministration': 'FHA', 'VeteransAffairs': 'VA' };
        pp.push(mt[data.loan.mortgageType] || data.loan.mortgageType);
      }
      if (data.loan.termMonths) pp.push(Math.round(data.loan.termMonths / 12) + ' Year');
      if (data.loan.amortType) {
        var at = { 'Fixed': 'Fixed', 'AdjustableRate': 'ARM' };
        pp.push(at[data.loan.amortType] || data.loan.amortType);
      }
      if (pp.length) m['bgProduct'] = pp.join(' ');
    }

    /* Housing expenses */
    if (data.housing.pi) m['bgPI'] = data.housing.pi;
    else if (data.loan.piPayment) m['bgPI'] = data.loan.piPayment;
    if (data.housing.taxMo) m['bgPropertyTax'] = data.housing.taxMo;
    else if (data.escrow.taxMonthly) m['bgPropertyTax'] = data.escrow.taxMonthly;
    if (data.housing.insuranceMo) m['bgHomeInsurance'] = data.housing.insuranceMo;
    else if (data.escrow.insMonthly) m['bgHomeInsurance'] = data.escrow.insMonthly;
    if (data.housing.mi) m['bgMI'] = data.housing.mi;
    else if (data.loan.miPayment) m['bgMI'] = data.loan.miPayment;
    if (data.housing.hoa) m['bgHOA'] = data.housing.hoa;

    /* Pass structured data via __budget_data for the calculator to process dynamically */
    m['__budget_data'] = {
      borrowers: data.borrowers,
      liabilities: data.liabilities,
      qualification: data.qualification,
      existingMortgage: data.existingMortgage
    };

    return m;
  });

  /* ---- MISMO Document Analyzer (special: XML injection) ---- */
  reg('mismo', function () { return { '__mismo_xml_inject': true }; });

})();
