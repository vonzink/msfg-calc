/* =====================================================
   MISMO XML Parser
   Extracts financial fields from MISMO 3.4 XML files
   and maps them to calculator input fields.
   ===================================================== */
(function () {
  'use strict';

  window.MSFG = window.MSFG || {};

  /* ---- Namespace-aware element selector ---- */
  var NS = 'http://www.mismo.org/residential/2009/schemas';

  function qn(parent, path) {
    var parts = path.split('/');
    var node = parent;
    for (var i = 0; i < parts.length; i++) {
      if (!node) return null;
      var children = node.children || node.childNodes;
      var found = null;
      for (var j = 0; j < children.length; j++) {
        var child = children[j];
        if (child.localName === parts[i]) { found = child; break; }
      }
      node = found;
    }
    return node;
  }

  function qnAll(parent, localName) {
    var results = [];
    var children = parent.children || parent.childNodes;
    for (var i = 0; i < children.length; i++) {
      if (children[i].localName === localName) results.push(children[i]);
    }
    return results;
  }

  function txt(parent, path) {
    var el = qn(parent, path);
    return el ? (el.textContent || '').trim() : '';
  }

  function num(parent, path) {
    var v = parseFloat(txt(parent, path));
    return isNaN(v) ? 0 : v;
  }

  /* ---- Find DEAL node ---- */
  function findDeal(xmlDoc) {
    var root = xmlDoc.documentElement;
    var ds = qn(root, 'DEAL_SETS/DEAL_SET/DEALS');
    if (!ds) return null;
    return qn(ds, 'DEAL');
  }

  /* ---- Parse MISMO XML string → structured data ---- */
  function parseMISMO(xmlString) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    if (xmlDoc.querySelector('parsererror')) {
      throw new Error('Invalid XML file');
    }

    var deal = findDeal(xmlDoc);
    if (!deal) throw new Error('No DEAL element found in MISMO file');

    var data = {
      borrowers: [],
      property: {},
      loan: {},
      existingMortgage: {},
      fees: {},
      escrow: {},
      housing: {},
      qualification: {},
      liabilities: []
    };

    /* ---- Borrowers ---- */
    var parties = qn(deal, 'PARTIES');
    if (parties) {
      var partyList = qnAll(parties, 'PARTY');
      partyList.forEach(function (party) {
        var roles = qn(party, 'ROLES');
        if (!roles) return;
        var roleList = qnAll(roles, 'ROLE');
        roleList.forEach(function (role) {
          var borrower = qn(role, 'BORROWER');
          if (!borrower) return;
          var detail = qn(borrower, 'BORROWER_DETAIL');
          var nameNode = qn(party, 'INDIVIDUAL/NAME');
          var b = {
            firstName: nameNode ? txt(nameNode, 'FirstName') : '',
            middleName: nameNode ? txt(nameNode, 'MiddleName') : '',
            lastName: nameNode ? txt(nameNode, 'LastName') : '',
            income: detail ? num(detail, 'BorrowerQualifyingIncomeAmount') : 0,
            classification: detail ? txt(detail, 'BorrowerClassificationType') : ''
          };
          if (b.firstName || b.lastName) data.borrowers.push(b);
        });
      });
    }

    /* ---- Property ---- */
    var subProp = qn(deal, 'COLLATERALS/COLLATERAL/SUBJECT_PROPERTY');
    if (subProp) {
      var addr = qn(subProp, 'ADDRESS');
      if (addr) {
        data.property.address = txt(addr, 'AddressLineText');
        data.property.city = txt(addr, 'CityName');
        data.property.state = txt(addr, 'StateCode');
        data.property.zip = txt(addr, 'PostalCode');
        data.property.county = txt(addr, 'CountyName');
      }
      var pd = qn(subProp, 'PROPERTY_DETAIL');
      if (pd) {
        data.property.value = num(pd, 'PropertyEstimatedValueAmount');
        data.property.usage = txt(pd, 'PropertyUsageType');
        data.property.type = txt(pd, 'AttachmentType');
        data.property.units = num(pd, 'FinancedUnitCount') || 1;
      }
    }

    /* ---- Loan ---- */
    var loan = qn(deal, 'LOANS/LOAN');
    if (loan) {
      var terms = qn(loan, 'TERMS_OF_LOAN');
      if (terms) {
        data.loan.amount = num(terms, 'BaseLoanAmount');
        data.loan.noteAmount = num(terms, 'NoteAmount');
        data.loan.rate = num(terms, 'NoteRatePercent');
        data.loan.purpose = txt(terms, 'LoanPurposeType');
        data.loan.mortgageType = txt(terms, 'MortgageType');
        data.loan.lienPriority = txt(terms, 'LienPriorityType');
      }

      var maturity = qn(loan, 'MATURITY/MATURITY_RULE');
      if (maturity) {
        data.loan.termMonths = num(maturity, 'LoanMaturityPeriodCount');
      }

      var amort = qn(loan, 'AMORTIZATION/AMORTIZATION_RULE');
      if (amort) {
        data.loan.amortType = txt(amort, 'AmortizationType');
      }

      var product = qn(loan, 'LOAN_PRODUCT/LOAN_PRODUCT_DETAIL');
      if (product) {
        data.loan.productName = txt(product, 'ProductName');
        data.loan.discountPoints = num(product, 'DiscountPointsTotalAmount');
      }

      var ltv = qn(loan, 'LTV');
      if (ltv) {
        data.loan.ltv = num(ltv, 'LTVRatioPercent');
      }

      /* ---- Fee Summary ---- */
      var feeSummary = qn(loan, 'FEE_INFORMATION/FEES_SUMMARY/FEE_SUMMARY_DETAIL');
      if (feeSummary) {
        data.loan.apr = num(feeSummary, 'APRPercent');
        data.loan.amountFinanced = num(feeSummary, 'FeeSummaryTotalAmountFinancedAmount');
        data.loan.totalFinanceCharge = num(feeSummary, 'FeeSummaryTotalFinanceChargeAmount');
        data.loan.totalOfPayments = num(feeSummary, 'FeeSummaryTotalOfAllPaymentsAmount');
      }

      /* ---- Individual Fees ---- */
      var feesNode = qn(loan, 'FEE_INFORMATION/FEES');
      if (feesNode) {
        var feeList = qnAll(feesNode, 'FEE');
        var feeMap = {};
        feeList.forEach(function (fee) {
          var detail = qn(fee, 'FEE_DETAIL');
          if (!detail) return;
          var feeType = txt(detail, 'FeeType');
          var otherDesc = txt(detail, 'FeeTypeOtherDescription');
          var amount = num(detail, 'FeeActualTotalAmount') || num(detail, 'FeeTotalPercent');
          var section = txt(detail, 'IntegratedDisclosureSectionType');
          var key = otherDesc || feeType;
          if (key) feeMap[key] = { amount: amount, section: section, type: feeType };
        });
        data.fees = feeMap;
      }

      /* ---- Closing Cost Sections ---- */
      var docSets = qn(loan, 'DOCUMENT_SPECIFIC_DATA_SETS');
      if (docSets) {
        var dsList = qnAll(docSets, 'DOCUMENT_SPECIFIC_DATA_SET');
        dsList.forEach(function (ds) {
          var id = qn(ds, 'INTEGRATED_DISCLOSURE');
          if (!id) return;

          /* Section summaries */
          var summaries = qn(id, 'INTEGRATED_DISCLOSURE_SECTION_SUMMARIES');
          if (summaries) {
            var sumList = qnAll(summaries, 'INTEGRATED_DISCLOSURE_SECTION_SUMMARY');
            sumList.forEach(function (s) {
              var sType = s.getAttribute('IntegratedDisclosureSectionType');
              var sd = qn(s, 'INTEGRATED_DISCLOSURE_SECTION_SUMMARY_DETAIL');
              if (sType && sd) {
                data.fees['_section_' + sType] = num(sd, 'IntegratedDisclosureSectionTotalAmount');
              }
            });
          }

          /* Projected payments */
          var projected = qn(id, 'PROJECTED_PAYMENTS');
          if (projected) {
            var ppList = qnAll(projected, 'PROJECTED_PAYMENT');
            if (ppList.length > 0) {
              var pp = ppList[0];
              data.loan.piPayment = num(pp, 'ProjectedPaymentPrincipalAndInterestMaximumPaymentAmount');
              data.loan.miPayment = num(pp, 'ProjectedPaymentMIPaymentAmount');
              data.loan.escrowPayment = num(pp, 'ProjectedPaymentEstimatedEscrowPaymentAmount');
              data.loan.totalPayment = num(pp, 'ProjectedPaymentEstimatedTotalMaximumPaymentAmount');
            }
          }
        });
      }

      /* ---- Housing Expenses ---- */
      var housingNode = qn(loan, 'HOUSING_EXPENSES');
      if (housingNode) {
        var heList = qnAll(housingNode, 'HOUSING_EXPENSE');
        heList.forEach(function (he) {
          var heType = he.getAttribute('HousingExpenseType');
          var amt = num(he, 'HousingExpensePaymentAmount');
          if (heType === 'FirstMortgagePrincipalAndInterest') data.housing.pi = amt;
          else if (heType === 'HomeownersInsurance') data.housing.insuranceMo = amt;
          else if (heType === 'RealEstateTax') data.housing.taxMo = amt;
          else if (heType === 'MIPremium') data.housing.mi = amt;
          else if (heType === 'HomeownersAssociationDuesAndCondominiumFees') data.housing.hoa = amt;
        });
      }

      /* ---- Escrow ---- */
      var escrowNode = qn(loan, 'ESCROW');
      if (escrowNode) {
        var escrowItems = qn(escrowNode, 'ESCROW_ITEMS');
        if (escrowItems) {
          var eiList = qnAll(escrowItems, 'ESCROW_ITEM');
          eiList.forEach(function (ei) {
            var eiType = ei.getAttribute('EscrowItemType');
            var eid = qn(ei, 'ESCROW_ITEM_DETAIL');
            if (!eid) return;
            var annual = num(eid, 'EscrowAnnualPaymentAmount');
            var monthly = num(eid, 'EscrowMonthlyPaymentAmount');
            var months = num(eid, 'EscrowCollectedNumberOfMonthsCount');
            if (eiType === 'CountyPropertyTax') {
              data.escrow.taxAnnual = annual;
              data.escrow.taxMonthly = monthly;
              data.escrow.taxMonths = months;
            } else if (eiType === 'HazardInsurance') {
              data.escrow.insAnnual = annual;
              data.escrow.insMonthly = monthly;
              data.escrow.insMonths = months;
            }
          });
        }
      }

      /* ---- Qualification ---- */
      var qual = qn(loan, 'QUALIFICATION');
      if (qual) {
        data.qualification.totalMonthlyIncome = num(qual, 'TotalMonthlyIncomeAmount');
        data.qualification.housingRatio = num(qual, 'HousingExpenseRatioPercent');
        data.qualification.debtRatio = num(qual, 'TotalDebtExpenseRatioPercent');
        data.qualification.totalHousingExpense = num(qual, 'TotalMonthlyProposedHousingExpenseAmount');
        data.qualification.totalLiabilities = num(qual, 'TotalLiabilitiesMonthlyPaymentAmount');
      }
    }

    /* ---- Liabilities ---- */
    var liabs = qn(deal, 'LIABILITIES');
    if (liabs) {
      var liabList = qnAll(liabs, 'LIABILITY');
      liabList.forEach(function (l) {
        var ld = qn(l, 'LIABILITY_DETAIL');
        if (!ld) return;
        var type = txt(ld, 'LiabilityType');
        var balance = num(ld, 'LiabilityUnpaidBalanceAmount');
        var payment = num(ld, 'LiabilityMonthlyPaymentAmount');
        var remaining = num(ld, 'LiabilityRemainingTermMonthsCount');
        var payoff = txt(ld, 'LiabilityPayoffStatusIndicator') === 'true';
        var holder = '';
        var lh = qn(l, 'LIABILITY_HOLDER/NAME');
        if (lh) holder = txt(lh, 'FullName');
        var entry = { type: type, balance: balance, payment: payment, remaining: remaining, payoff: payoff, holder: holder };

        if (type === 'MortgageLoan' && payoff) {
          data.existingMortgage = {
            balance: balance,
            payment: payment,
            remainingMonths: remaining,
            holder: holder
          };
        }
        data.liabilities.push(entry);
      });
    }

    /* ---- Computed helpers ---- */
    data.borrowerName = data.borrowers.map(function (b) {
      return [b.firstName, b.lastName].filter(Boolean).join(' ');
    }).join(' & ');

    data.propertyAddress = [
      data.property.address,
      data.property.city,
      data.property.state,
      data.property.zip
    ].filter(Boolean).join(', ');

    data.loan.downPayment = Math.max(0, (data.property.value || 0) - (data.loan.amount || 0));
    data.loan.downPct = data.property.value ? (data.loan.downPayment / data.property.value * 100) : 0;

    data.totalNonMortgageDebts = 0;
    data.liabilities.forEach(function (l) {
      if (l.type !== 'MortgageLoan' && !l.payoff) {
        data.totalNonMortgageDebts += l.payment;
      }
    });

    return data;
  }

  /* ================================================
     CALCULATOR FIELD MAPPINGS
     Maps MISMO data → calculator DOM element IDs
     ================================================ */

  var CALC_MAPS = {};

  /* ---- Refinance Calculator (refi) ---- */
  CALC_MAPS['refi'] = function (data) {
    var m = {};
    if (data.existingMortgage.balance) m['currentBalance'] = data.existingMortgage.balance;
    if (data.existingMortgage.remainingMonths) m['currentTermRemaining'] = data.existingMortgage.remainingMonths;
    if (data.property.value) m['currentPropertyValue'] = data.property.value;
    if (data.loan.amount) m['refiLoanAmount'] = data.loan.amount;
    if (data.loan.rate) m['refiRate'] = data.loan.rate;
    if (data.loan.termMonths) m['refiTerm'] = data.loan.termMonths;

    // Individual fees
    var fees = data.fees || {};
    if (fees['OriginationFee']) m['feeOrigination'] = fees['OriginationFee'].amount;
    if (fees['UnderwritingFee'] || fees['Processing Fee']) m['feeUnderwriting'] = (fees['UnderwritingFee'] || fees['Processing Fee']).amount;
    if (fees['AppraisalFee']) m['feeAppraisal'] = fees['AppraisalFee'].amount;
    if (fees['CreditReportFee']) m['feeCreditReport'] = fees['CreditReportFee'].amount;
    if (fees['FloodCertification']) m['feeFloodCert'] = fees['FloodCertification'].amount;
    if (fees['Technology Fee']) m['feeTechnology'] = fees['Technology Fee'].amount;
    if (fees['VerificationOfEmploymentFee']) m['feeVOE'] = fees['VerificationOfEmploymentFee'].amount;
    if (fees['TitleLendersCoveragePremium']) m['feeTitleLenders'] = fees['TitleLendersCoveragePremium'].amount;
    if (fees['SettlementFee']) m['feeTitleSettlement'] = fees['SettlementFee'].amount;
    if (fees['TitleClosingProtectionLetterFee']) m['feeTitleCPL'] = fees['TitleClosingProtectionLetterFee'].amount;
    if (fees['RecordingFeeForDeed']) m['feeRecording'] = fees['RecordingFeeForDeed'].amount;
    if (fees['E-Recording Fee']) m['feeERecording'] = fees['E-Recording Fee'].amount;
    if (fees['Title - Tax Cert Fee']) m['feeTitleTaxCert'] = fees['Title - Tax Cert Fee'].amount;
    if (fees['MERSRegistrationFee']) m['feeMERS'] = fees['MERSRegistrationFee'].amount;
    if (fees['TaxRelatedServiceFee'] || fees['Tax Related Service Fee']) m['feeTaxService'] = (fees['TaxRelatedServiceFee'] || fees['Tax Related Service Fee']).amount;
    if (fees['VerificationOfTaxReturnFee'] || fees['Verification Of Tax Return Fee']) m['feeVOT'] = (fees['VerificationOfTaxReturnFee'] || fees['Verification Of Tax Return Fee']).amount;

    // Escrow prepaids
    if (data.escrow.taxMonthly) m['feeEscrowTax'] = data.escrow.taxMonthly;
    if (data.escrow.insMonthly) m['feeEscrowInsurance'] = data.escrow.insMonthly;

    return m;
  };

  /* ---- APR Calculator ---- */
  CALC_MAPS['apr'] = function (data) {
    var m = {};
    if (data.loan.amount) m['loanAmount'] = data.loan.amount;
    if (data.loan.rate) m['interestRate'] = data.loan.rate;
    if (data.loan.discountPoints) m['discountPoints'] = data.loan.discountPoints;
    // Fees
    var fees = data.fees || {};
    if (fees['OriginationFee']) m['originationFee'] = fees['OriginationFee'].amount;
    if (fees['CreditReportFee']) m['creditReportFee'] = fees['CreditReportFee'].amount;
    if (fees['FloodCertification']) m['floodCertFee'] = fees['FloodCertification'].amount;
    if (fees['TitleLendersCoveragePremium']) m['titleInsurance'] = fees['TitleLendersCoveragePremium'].amount;
    if (fees['RecordingFeeForDeed']) m['recordingFees'] = fees['RecordingFeeForDeed'].amount;
    return m;
  };

  /* ---- Cash vs Mortgage ---- */
  CALC_MAPS['cash-vs-mortgage'] = function (data) {
    var m = {};
    if (data.property.value) m['priceCash'] = data.property.value;
    if (data.loan.rate) m['mortRate'] = data.loan.rate;
    if (data.loan.downPct) m['downPct'] = data.loan.downPct;
    return m;
  };

  /* ---- Buy vs Rent ---- */
  CALC_MAPS['buy-vs-rent'] = function (data) {
    var m = {};
    if (data.property.value) m['purchasePrice'] = data.property.value;
    if (data.loan.rate) m['rateBuy'] = data.loan.rate;
    if (data.loan.downPct) m['downPercent'] = data.loan.downPct;
    if (data.escrow.taxAnnual && data.property.value) m['taxRate'] = +(data.escrow.taxAnnual / data.property.value * 100).toFixed(3);
    if (data.escrow.insAnnual) m['insurance'] = data.escrow.insAnnual;
    return m;
  };

  /* ---- FHA Calculator ---- */
  CALC_MAPS['fha'] = function (data) {
    var m = {};
    if (data.property.value) {
      m['purchasePrice'] = data.property.value;
      m['appraisedValue'] = data.property.value;
    }
    return m;
  };

  /* ---- FHA Refi ---- */
  CALC_MAPS['fha-refi'] = function (data) {
    var m = {};
    if (data.existingMortgage.balance) m['sl_upb'] = data.existingMortgage.balance;
    if (data.loan.amount) m['sl_originalLoanAmount'] = data.loan.amount;
    if (data.loan.rate) m['ntb_newRate'] = data.loan.rate;
    if (data.borrowerName) m['borrowerName'] = data.borrowerName;
    return m;
  };

  /* ---- VA Pre-Qual ---- */
  CALC_MAPS['va-prequal'] = function (data) {
    var m = {};
    if (data.loan.amount) m['mortgageAmount'] = data.loan.amount;
    if (data.qualification.totalMonthlyIncome) m['grossIncome'] = data.qualification.totalMonthlyIncome;
    if (data.borrowerName) m['borrowerName'] = data.borrowerName;
    if (data.escrow.taxMonthly) m['propertyTaxes'] = data.escrow.taxMonthly;
    if (data.escrow.insMonthly) m['homeInsurance'] = data.escrow.insMonthly;
    if (data.housing.hoa) m['hoaDues'] = data.housing.hoa;
    return m;
  };

  /* ---- Escrow Calculator ---- */
  CALC_MAPS['escrow'] = function (data) {
    var m = {};
    if (data.escrow.taxAnnual) m['annualTax'] = data.escrow.taxAnnual;
    if (data.escrow.insAnnual) m['annualIns'] = data.escrow.insAnnual;
    return m;
  };

  /* ---- Blended Rate ---- */
  CALC_MAPS['blended-rate'] = function (data) {
    var m = {};
    var debts = data.liabilities.filter(function (l) { return !l.payoff && l.balance > 0; });
    for (var i = 0; i < Math.min(debts.length, 5); i++) {
      m['d' + (i + 1) + '_bal'] = debts[i].balance;
      m['d' + (i + 1) + '_pay'] = debts[i].payment;
    }
    return m;
  };

  /* ---- Buydown ---- */
  CALC_MAPS['buydown'] = function (data) {
    var m = {};
    if (data.loan.amount) m['loanAmount'] = data.loan.amount;
    if (data.loan.rate) m['noteRate'] = data.loan.rate;
    if (data.escrow.taxAnnual) m['propertyTaxes'] = data.escrow.taxAnnual;
    if (data.escrow.insAnnual) m['insurance'] = data.escrow.insAnnual;
    if (data.housing.hoa) m['hoa'] = data.housing.hoa;
    return m;
  };

  /* ---- REO ---- */
  CALC_MAPS['reo'] = function (data) {
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
  };

  /* ---- Amortization (React SPA) ---- */
  CALC_MAPS['amortization'] = function (data) {
    var m = {};
    if (data.property.value) m['__react_homeValue'] = data.property.value;
    if (data.loan.downPct) m['__react_downPct'] = data.loan.downPct;
    if (data.loan.rate) m['__react_rate'] = data.loan.rate;
    if (data.loan.termMonths) m['__react_term'] = data.loan.termMonths / 12;
    if (data.escrow.taxAnnual) m['__react_taxYr'] = data.escrow.taxAnnual;
    if (data.escrow.insAnnual) m['__react_insYr'] = data.escrow.insAnnual;
    if (data.housing.hoa) m['__react_hoaMo'] = data.housing.hoa;
    if (data.housing.mi) m['__react_pmiMo'] = data.housing.mi;
    return m;
  };

  /* ================================================
     PUBLIC API
     ================================================ */
  MSFG.MISMOParser = {
    parse: parseMISMO,
    getCalcMap: function (slug) { return CALC_MAPS[slug] || null; },
    calcMapKeys: Object.keys(CALC_MAPS)
  };

})();
