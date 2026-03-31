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
            classification: detail ? txt(detail, 'BorrowerClassificationType') : '',
            creditScore: 0
          };

          /* Credit score — check multiple MISMO paths */
          var creditScores = qn(borrower, 'CREDIT_SCORES');
          if (creditScores) {
            var csList = qnAll(creditScores, 'CREDIT_SCORE');
            csList.forEach(function (cs) {
              var csDetail = qn(cs, 'CREDIT_SCORE_DETAIL');
              if (csDetail) {
                var val = num(csDetail, 'CreditScoreValue');
                if (val > 0 && !b.creditScore) b.creditScore = val;
              }
            });
          }
          /* Fallback: CREDIT_PROFILE path (alternate MISMO layout) */
          if (!b.creditScore) {
            var creditProfile = qn(borrower, 'CREDIT_PROFILE');
            if (creditProfile) {
              var cpScore = qn(creditProfile, 'CREDIT_SCORE');
              if (cpScore) {
                var cpVal = num(cpScore, 'CreditScoreValue');
                if (cpVal > 0) b.creditScore = cpVal;
              }
            }
          }

          /* Employers & per-employer income */
          b.employers = [];
          b.incomeItems = [];
          var employersNode = qn(borrower, 'EMPLOYERS');
          if (employersNode) {
            var empList = qnAll(employersNode, 'EMPLOYER');
            empList.forEach(function (emp) {
              var ed = qn(emp, 'EMPLOYER_DETAIL');
              var le = qn(emp, 'LEGAL_ENTITY/LEGAL_ENTITY_DETAIL');
              var empName = '';
              if (le) empName = txt(le, 'FullName');
              if (!empName && ed) empName = txt(ed, 'EmployerName');
              var empStatus = ed ? txt(ed, 'EmploymentStatusType') : '';
              var empMonthly = ed ? num(ed, 'EmploymentMonthlyIncomeAmount') : 0;
              var empEntry = { name: empName, status: empStatus, monthlyIncome: empMonthly, incomeItems: [] };

              /* Income items under employer */
              var incomeNode = qn(emp, 'INCOME/CURRENT_INCOME/CURRENT_INCOME_ITEMS');
              if (incomeNode) {
                var ciList = qnAll(incomeNode, 'CURRENT_INCOME_ITEM');
                ciList.forEach(function (ci) {
                  var cid = qn(ci, 'CURRENT_INCOME_ITEM_DETAIL');
                  if (!cid) return;
                  var iType = txt(cid, 'IncomeType');
                  var iAmt = num(cid, 'CurrentIncomeMonthlyTotalAmount');
                  if (iType || iAmt) {
                    empEntry.incomeItems.push({ type: iType, monthly: iAmt });
                    b.incomeItems.push({ type: iType, monthly: iAmt, employer: empName });
                  }
                });
              }
              b.employers.push(empEntry);
            });
          }

          /* Direct income items on borrower (not under employer) */
          var directIncome = qn(borrower, 'CURRENT_INCOME/CURRENT_INCOME_ITEMS');
          if (!directIncome) directIncome = qn(borrower, 'CURRENT_INCOME_ITEMS');
          if (directIncome) {
            var diList = qnAll(directIncome, 'CURRENT_INCOME_ITEM');
            diList.forEach(function (di) {
              var did = qn(di, 'CURRENT_INCOME_ITEM_DETAIL');
              if (!did) return;
              var diType = txt(did, 'IncomeType');
              var diAmt = num(did, 'CurrentIncomeMonthlyTotalAmount');
              if (diType || diAmt) {
                b.incomeItems.push({ type: diType, monthly: diAmt, employer: '' });
              }
            });
          }

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

      /* ---- Loan Identifiers (File Number) ---- */
      var loanIds = qn(loan, 'LOAN_IDENTIFIERS');
      if (loanIds) {
        var idList = qnAll(loanIds, 'LOAN_IDENTIFIER');
        idList.forEach(function (lid) {
          var idType = txt(lid, 'LoanIdentifierType');
          var idVal = txt(lid, 'LoanIdentifier');
          if (!data.loan.loanIdentifier && idVal) {
            if (idType === 'LenderLoan' || idType === 'AgencyCase' || idType === 'LenderCase') {
              data.loan.loanIdentifier = idVal;
            }
          }
        });
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
        var exclusion = txt(ld, 'LiabilityExclusionIndicator') === 'true';
        var account = txt(ld, 'LiabilityAccountIdentifier');
        var holder = '';
        var lh = qn(l, 'LIABILITY_HOLDER/NAME');
        if (lh) holder = txt(lh, 'FullName');
        var entry = { type: type, balance: balance, payment: payment, remaining: remaining, payoff: payoff, exclusion: exclusion, account: account, holder: holder };

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

  /* ================================================
     PUBLIC API
     ================================================ */
  MSFG.MISMOParser = {
    parse: parseMISMO,
    registerCalcMap: function (slug, fn) { CALC_MAPS[slug] = fn; },
    getCalcMap: function (slug) { return CALC_MAPS[slug] || null; },
    get calcMapKeys() { return Object.keys(CALC_MAPS); }
  };

})();

/* NOTE: Calculator-specific field mappings (CALC_MAPS) are in mismo-calc-maps.js */
