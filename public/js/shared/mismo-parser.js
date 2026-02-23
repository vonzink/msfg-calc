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
      prepaids: {},
      housing: {},
      qualification: {},
      liabilities: [],
      closingCostFunds: { sellerCredits: 0, lenderCredits: 0 }
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
              var sd = qn(s, 'INTEGRATED_DISCLOSURE_SECTION_SUMMARY_DETAIL');
              if (!sd) return;
              var sType = txt(sd, 'IntegratedDisclosureSectionType');
              if (sType) {
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
          var heType = txt(he, 'HousingExpenseType');
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
        /* Escrow detail (cushion, initial balance) */
        var escrowDetail = qn(escrowNode, 'ESCROW_DETAIL');
        if (escrowDetail) {
          data.escrow.cushionMonths = num(escrowDetail, 'EscrowCushionNumberOfMonthsCount');
          data.escrow.initialBalance = num(escrowDetail, 'EscrowAccountInitialBalanceAmount');
          data.escrow.aggregateAdjustment = num(escrowDetail, 'EscrowAggregateAccountingAdjustmentAmount');
        }

        /* Escrow items (tax, insurance deposits) */
        var escrowItems = qn(escrowNode, 'ESCROW_ITEMS');
        if (escrowItems) {
          var eiList = qnAll(escrowItems, 'ESCROW_ITEM');
          eiList.forEach(function (ei) {
            var eid = qn(ei, 'ESCROW_ITEM_DETAIL');
            if (!eid) return;
            var eiType = txt(eid, 'EscrowItemType');
            var annual = num(eid, 'EscrowAnnualPaymentAmount');
            var monthly = num(eid, 'EscrowMonthlyPaymentAmount');
            var months = num(eid, 'EscrowCollectedNumberOfMonthsCount');
            var estimated = num(eid, 'EscrowItemEstimatedTotalAmount');
            if (eiType === 'CountyPropertyTax') {
              data.escrow.taxAnnual = annual;
              data.escrow.taxMonthly = monthly;
              data.escrow.taxMonths = months;
              data.escrow.taxDeposit = estimated;
            } else if (eiType === 'HazardInsurance') {
              data.escrow.insAnnual = annual;
              data.escrow.insMonthly = monthly;
              data.escrow.insMonths = months;
              data.escrow.insDeposit = estimated;
            }
          });
        }
      }

      /* ---- Closing Cost Funds (Seller/Lender Credits) ---- */
      data.closingCostFunds = { sellerCredits: 0, lenderCredits: 0 };
      var closingInfoNode = qn(loan, 'CLOSING_INFORMATION');
      if (closingInfoNode) {
        var fundsNode = qn(closingInfoNode, 'CLOSING_COST_FUNDS');
        if (fundsNode) {
          var fundList = qnAll(fundsNode, 'CLOSING_COST_FUND');
          fundList.forEach(function (fund) {
            var fd = qn(fund, 'CLOSING_COST_FUND_DETAIL');
            if (!fd) return;
            var fundType = txt(fd, 'FundsType');
            var amt = num(fd, 'ClosingCostFundAmount');
            if (fundType === 'SellerCredit' || fundType === 'SellerPaidClosingCosts') {
              data.closingCostFunds.sellerCredits += amt;
            } else if (fundType === 'LenderCredit' || fundType === 'LenderPaidClosingCosts') {
              data.closingCostFunds.lenderCredits += amt;
            }
          });
        }
      }

      /* ---- Prepaid Items ---- */
      /* PREPAID_ITEMS lives under CLOSING_INFORMATION in MISMO 3.4 */
      var closingInfo = qn(loan, 'CLOSING_INFORMATION');
      var prepaidNode = closingInfo ? qn(closingInfo, 'PREPAID_ITEMS') : null;
      if (!prepaidNode) prepaidNode = qn(loan, 'PREPAID_ITEMS');
      if (!prepaidNode && escrowNode) prepaidNode = qn(escrowNode, 'PREPAID_ITEMS');
      if (prepaidNode) {
        data.prepaids = {};
        var piList = qnAll(prepaidNode, 'PREPAID_ITEM');
        piList.forEach(function (pi) {
          var pid = qn(pi, 'PREPAID_ITEM_DETAIL');
          if (!pid) return;
          var piType = txt(pid, 'PrepaidItemType');
          if (piType === 'HazardInsurancePremium') {
            data.prepaids.hazardInsurance = num(pid, 'PrepaidItemMonthsPaidCount') > 0
              ? num(pid, 'PrepaidItemMonthsPaidCount') * (num(pid, 'PrepaidItemPerDiemAmount') || 0)
              : 0;
            /* Check payment amount for actual total */
            var payments = qn(pi, 'PREPAID_ITEM_PAYMENTS');
            if (payments) {
              var payList = qnAll(payments, 'PREPAID_ITEM_PAYMENT');
              payList.forEach(function (pay) {
                var amt = num(pay, 'PrepaidItemActualPaymentAmount');
                if (amt > 0) data.prepaids.hazardInsurance = amt;
              });
            }
            data.prepaids.hazardInsuranceMonths = num(pid, 'PrepaidItemMonthsPaidCount');
          } else if (piType === 'PrepaidInterest') {
            data.prepaids.interestPerDiem = num(pid, 'PrepaidItemPerDiemAmount');
            data.prepaids.interestDays = num(pid, 'PrepaidItemPaidFromDate') || 0;
            /* Check payment amount for actual prepaid interest */
            var payments2 = qn(pi, 'PREPAID_ITEM_PAYMENTS');
            if (payments2) {
              var payList2 = qnAll(payments2, 'PREPAID_ITEM_PAYMENT');
              payList2.forEach(function (pay) {
                var amt = num(pay, 'PrepaidItemActualPaymentAmount');
                if (amt > 0) data.prepaids.interestTotal = amt;
              });
            }
          }
        });
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

    /* ---- Loan Originator + Company ---- */
    data.loanOriginator = {};
    data.loanOriginationCompany = {};
    if (parties) {
      var partyList2 = qnAll(parties, 'PARTY');
      partyList2.forEach(function (party) {
        var roles = qn(party, 'ROLES');
        if (!roles) return;
        var roleList = qnAll(roles, 'ROLE');
        roleList.forEach(function (role) {
          var roleType = txt(qn(role, 'ROLE_DETAIL') || role, 'PartyRoleType');

          if (roleType === 'LoanOriginator') {
            var indiv = qn(party, 'INDIVIDUAL');
            if (indiv) {
              var nameNode = qn(indiv, 'NAME');
              data.loanOriginator.firstName = nameNode ? txt(nameNode, 'FirstName') : '';
              data.loanOriginator.lastName = nameNode ? txt(nameNode, 'LastName') : '';
              data.loanOriginator.fullName = nameNode ? txt(nameNode, 'FullName') : '';
              if (!data.loanOriginator.fullName) {
                data.loanOriginator.fullName = [data.loanOriginator.firstName, data.loanOriginator.lastName].filter(Boolean).join(' ');
              }
              // Contact info
              var contacts = qn(indiv, 'CONTACT_POINTS');
              if (contacts) {
                var cpList = qnAll(contacts, 'CONTACT_POINT');
                cpList.forEach(function (cp) {
                  var phone = qn(cp, 'CONTACT_POINT_TELEPHONE');
                  if (phone) data.loanOriginator.phone = txt(phone, 'ContactPointTelephoneValue');
                  var email = qn(cp, 'CONTACT_POINT_EMAIL');
                  if (email) data.loanOriginator.email = txt(email, 'ContactPointEmailValue');
                });
              }
            }
            // NMLS from LICENSE
            var licenses = qn(role, 'LICENSES');
            if (licenses) {
              var licList = qnAll(licenses, 'LICENSE');
              licList.forEach(function (lic) {
                var ld = qn(lic, 'LICENSE_DETAIL');
                if (ld && txt(ld, 'LicenseIssuingAuthorityName') === 'NationwideMortgageLicensingSystemAndRegistry') {
                  data.loanOriginator.nmls = txt(ld, 'LicenseIdentifier');
                }
              });
            }
          }

          if (roleType === 'LoanOriginationCompany') {
            var entity = qn(party, 'LEGAL_ENTITY');
            if (entity) {
              var ed = qn(entity, 'LEGAL_ENTITY_DETAIL');
              if (ed) data.loanOriginationCompany.name = txt(ed, 'FullName');
            }
            var licenses2 = qn(role, 'LICENSES');
            if (licenses2) {
              var licList2 = qnAll(licenses2, 'LICENSE');
              licList2.forEach(function (lic) {
                var ld = qn(lic, 'LICENSE_DETAIL');
                if (ld && txt(ld, 'LicenseIssuingAuthorityName') === 'NationwideMortgageLicensingSystemAndRegistry') {
                  data.loanOriginationCompany.nmls = txt(ld, 'LicenseIdentifier');
                }
              });
            }
          }
        });
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

  /* ---- Helper: find a fee by checking multiple possible keys ---- */
  function feeAmt(fees) {
    var keys = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < keys.length; i++) {
      if (fees[keys[i]]) return fees[keys[i]].amount;
    }
    return 0;
  }

  /* ---- Refinance Calculator (refi) ---- */
  CALC_MAPS['refi'] = function (data) {
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
  };

  /* ---- APR Calculator ---- */
  CALC_MAPS['apr'] = function (data) {
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

  /* ---- FHA (Unified: purchase, refi, streamline) ---- */
  CALC_MAPS['fha'] = function (data) {
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

    // Prepaids & escrow deposits — sum all available components
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
    if (typeof data.escrow.cushionMonths === 'number') m['cushionMonths'] = data.escrow.cushionMonths;

    // Loan type mapping for escrow calculator
    if (data.loan.purpose) {
      var purposeMap = { 'Refinance': 'Refinance', 'Purchase': 'Purchase' };
      if (purposeMap[data.loan.purpose]) m['loanType'] = purposeMap[data.loan.purpose];
    }

    // Property state
    if (data.property.state) m['state'] = data.property.state;

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

  /* ---- Amortization Calculator (native EJS) ---- */
  CALC_MAPS['amortization'] = function (data) {
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
  };

  /* ---- Fee Worksheet ---- */
  CALC_MAPS['fee-worksheet'] = function (data) {
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

    // Loan purpose
    if (data.loan.purpose) {
      var purposeMap = { 'Refinance': 'Refinance', 'Purchase': 'Purchase' };
      if (purposeMap[data.loan.purpose]) m['fwLoanPurpose'] = purposeMap[data.loan.purpose];
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
    var wireAmt = feeAmt(fees, 'WireTransferFee', 'Wire Transfer Fee');
    if (wireAmt) m['fwWireFee'] = wireAmt;

    // Government fees
    var recordingAmt = feeAmt(fees, 'RecordingFeeForDeed', 'Recording Fee For Deed');
    if (recordingAmt) m['fwRecordingFee'] = recordingAmt;

    // Prepaids — hazard insurance
    if (data.escrow.insMonthly) m['fwHazInsAmt'] = data.escrow.insMonthly;
    if (prepaids.hazardInsuranceMonths) m['fwHazInsMonths'] = prepaids.hazardInsuranceMonths;
    else if (prepaids.hazardInsurance && data.escrow.insMonthly && data.escrow.insMonthly > 0) {
      m['fwHazInsMonths'] = Math.round(prepaids.hazardInsurance / data.escrow.insMonthly);
    }

    // Prepaids — prepaid interest
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

    return m;
  };

  /* ---- Loan Comparison ---- */
  CALC_MAPS['compare'] = function (data, colIdx) {
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

    // Purpose
    if (data.loan.purpose) {
      var purposeMap = { 'Refinance': 'Refinance', 'Purchase': 'Purchase' };
      if (purposeMap[data.loan.purpose]) m['cmpPurpose_' + idx] = purposeMap[data.loan.purpose];
    }

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

    // Title & settlement combined
    var titleTotal = 0;
    titleTotal += feeAmt(fees, 'TitleLendersCoveragePremium', 'Title - Lenders Coverage Premium');
    titleTotal += feeAmt(fees, 'SettlementFee', 'Settlement Fee', 'Title - Settlement Fee');
    titleTotal += feeAmt(fees, 'TitleClosingProtectionLetterFee', 'Title - Closing Protection Letter Fee');
    titleTotal += feeAmt(fees, 'Title - Tax Cert Fee', 'TitleTaxCertFee');
    titleTotal += feeAmt(fees, 'TitleOwnersCoveragePremium', 'Title - Owners Coverage Premium');
    if (titleTotal) m['cmpTitleFees_' + idx] = titleTotal;

    // Other third-party (tech, VOE, flood, tax service, MERS, wire, e-recording)
    var otherTP = 0;
    otherTP += feeAmt(fees, 'Technology Fee', 'TechnologyFee');
    otherTP += feeAmt(fees, 'VerificationOfEmploymentFee', 'Verification Of Employment Fee');
    otherTP += feeAmt(fees, 'FloodCertification', 'FloodCertificationFee', 'Flood Certification');
    otherTP += feeAmt(fees, 'TaxRelatedServiceFee', 'Tax Related Service Fee', 'TaxServiceFee');
    otherTP += feeAmt(fees, 'MERSRegistrationFee', 'MERS Registration Fee');
    otherTP += feeAmt(fees, 'WireTransferFee', 'Wire Transfer Fee');
    otherTP += feeAmt(fees, 'E-Recording Fee', 'ERecordingFee');
    if (otherTP) m['cmpOtherThirdParty_' + idx] = otherTP;

    // Government fees
    var recordingAmt = feeAmt(fees, 'RecordingFeeForDeed', 'Recording Fee For Deed');
    if (recordingAmt) m['cmpRecordingFee_' + idx] = recordingAmt;
    var transferTaxAmt = feeAmt(fees, 'TransferTax', 'Transfer Tax', 'StateRecordingTax', 'State Recording Tax');
    if (transferTaxAmt) m['cmpTransferTax_' + idx] = transferTaxAmt;

    // Seller / Lender credits
    if (data.closingCostFunds) {
      if (data.closingCostFunds.sellerCredits) m['cmpSellerCredits_' + idx] = data.closingCostFunds.sellerCredits;
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

    return m;
  };

  /* ---- Cover Letter / Loan Analysis ---- */
  CALC_MAPS['loan-analysis'] = function (data) {
    var m = {};

    // Borrower info
    if (data.borrowers.length > 0) {
      var b1 = data.borrowers[0];
      m['laBorrowerName'] = [b1.firstName, b1.middleName, b1.lastName].filter(Boolean).join(' ');
    }
    if (data.borrowers.length > 1) {
      var b2 = data.borrowers[1];
      m['laCoBorrowerName'] = [b2.firstName, b2.middleName, b2.lastName].filter(Boolean).join(' ');
    }

    // Property address
    if (data.property.address) m['laStreet'] = data.property.address;
    if (data.property.city) m['laCity'] = data.property.city;
    if (data.property.state) m['laState'] = data.property.state;
    if (data.property.zip) m['laZip'] = data.property.zip;

    // Loan officer info (populates hidden fields for signature)
    var lo = data.loanOriginator || {};
    if (lo.fullName) m['laLoName'] = lo.fullName;
    if (lo.nmls) m['laLoNmls'] = lo.nmls;
    if (lo.phone) m['laLoPhone'] = lo.phone;
    if (lo.email) m['laLoEmail'] = lo.email;
    if (data.loanOriginationCompany && data.loanOriginationCompany.name) {
      m['laLoCompany'] = data.loanOriginationCompany.name;
    }

    return m;
  };

  /* ---- MISMO Document Analyzer (special: XML injection) ---- */
  CALC_MAPS['mismo'] = function () { return { '__mismo_xml_inject': true }; };

  /* ================================================
     PUBLIC API
     ================================================ */
  MSFG.MISMOParser = {
    parse: parseMISMO,
    getCalcMap: function (slug) { return CALC_MAPS[slug] || null; },
    calcMapKeys: Object.keys(CALC_MAPS)
  };

})();
