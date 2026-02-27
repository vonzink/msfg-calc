'use strict';
/**
 * MISMO 3.4 XML Parser — Document Analyzer edition
 * Extracts borrower, employment, income, declarations, assets,
 * liabilities, REO, property, and loan program data from MISMO XML
 * for document-checklist generation.
 *
 * Namespace: MSFG.MISMODocParser
 * API: parseMISMO(xmlDoc), calculateEmploymentCoverage(borrower),
 *      calculateResidenceCoverage(borrower), detectEmploymentGaps(borrower)
 */
(function () {
  const NS = 'http://www.mismo.org/residential/2009/schemas';

  function first(el, name) {
    const items = el.getElementsByTagNameNS(NS, name);
    return items.length > 0 ? items[0] : null;
  }

  function all(el, name) {
    return Array.from(el.getElementsByTagNameNS(NS, name));
  }

  function textOf(el) {
    return el ? (el.textContent || '').trim() : '';
  }

  function numOf(el) {
    const val = parseFloat(textOf(el));
    return isNaN(val) ? null : val;
  }

  function parseDate(str) {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function monthsBetween(start, end) {
    if (!start || !end) return null;
    const years = end.getFullYear() - start.getFullYear();
    const months = end.getMonth() - start.getMonth();
    return years * 12 + months;
  }

  /**
   * @param {Document} doc — parsed XML document
   * @returns {Object} structured MISMO data
   */
  function parseMISMO(doc) {
    const now = new Date();

    const data = {
      borrowers: [],
      loanPurpose: null,
      mortgageType: null,       // FHA, VA, Conventional, USDA
      baseLoanAmount: null,
      // Enhanced fields
      propertyValue: null,      // Appraised or estimated value
      purchasePrice: null,
      ltv: null,                // Loan-to-value ratio
      cltv: null,               // Combined LTV
      propertyType: null,       // SingleFamily, Condominium, Townhouse, etc.
      occupancyType: null,      // PrimaryResidence, SecondHome, Investment
      numberOfUnits: null,
      subjectProperty: null,    // { address, city, state, zip, county }
      isFHA: false,
      isVA: false,
      isUSDA: false,
      isConventional: false,
      fhaDetails: {             // FHA-specific
        caseNumber: null,
        ufmipAmount: null,
        miTerminationType: null
      },
      vaDetails: {              // VA-specific
        fundingFeeAmount: null,
        entitlementAmount: null,
        isFirstUse: null
      },
      isRefinance: false,
      isCashOut: false,
      assets: [],
      liabilities: [],
      reoProperties: [],
      hasHOA: false,
      borrowerCount: 0,
      totalIncomeTypes: 0,
      complexityFlags: []       // Portfolio/complexity indicators
    };

    // ---- Loan terms ----
    const terms = first(doc, 'TERMS_OF_LOAN');
    if (terms) {
      data.baseLoanAmount = numOf(first(terms, 'BaseLoanAmount'));
      data.loanPurpose = textOf(first(terms, 'LoanPurposeType')) || null;
      data.mortgageType = textOf(first(terms, 'MortgageType')) || null;
    }

    // Classify loan type
    const mt = (data.mortgageType || '').toLowerCase();
    data.isFHA = mt === 'fha' || !!mt.match(/federal\s*housing/i);
    data.isVA = mt === 'va' || !!mt.match(/veterans?\s*affairs|veteran/i);
    data.isUSDA = mt === 'usda' || !!mt.match(/rural\s*development|rural\s*housing/i);
    data.isConventional = !data.isFHA && !data.isVA && !data.isUSDA;

    // Loan purpose flags
    const lp = (data.loanPurpose || '').toLowerCase();
    data.isRefinance = lp === 'refinance' || !!lp.match(/refi/i);
    data.isCashOut = !!lp.match(/cash[-\s]?out/i);

    // ---- Property ----
    const propertyEl = first(doc, 'SUBJECT_PROPERTY') || first(doc, 'PROPERTY');
    if (propertyEl) {
      // Address
      const addr = first(propertyEl, 'ADDRESS');
      if (addr) {
        data.subjectProperty = {
          address: textOf(first(addr, 'AddressLineText')) || textOf(first(addr, 'AddressLine1Text')) || '',
          city: textOf(first(addr, 'CityName')) || '',
          state: textOf(first(addr, 'StateCode')) || '',
          zip: textOf(first(addr, 'PostalCode')) || '',
          county: textOf(first(addr, 'CountyName')) || ''
        };
      }

      // Property detail
      const propDetail = first(propertyEl, 'PROPERTY_DETAIL');
      if (propDetail) {
        data.propertyType = textOf(first(propDetail, 'PropertyEstateType')) ||
                            textOf(first(propDetail, 'PropertyType')) || null;
        data.numberOfUnits = parseInt(textOf(first(propDetail, 'FinancedUnitCount'))) ||
                             parseInt(textOf(first(propDetail, 'PropertyUnitCount'))) || null;
        if (textOf(first(propDetail, 'PUDIndicator')) === 'true') data.hasHOA = true;
        // Property usage / occupancy
        data.occupancyType = textOf(first(propDetail, 'PropertyUsageType')) || null;
      }

      // Property valuation
      const valuation = first(propertyEl, 'PROPERTY_VALUATIONS') || first(propertyEl, 'PROPERTY_VALUATION');
      if (valuation) {
        const valDetail = first(valuation, 'PROPERTY_VALUATION_DETAIL');
        if (valDetail) {
          data.propertyValue = numOf(first(valDetail, 'PropertyValuationAmount'));
        }
      }
    }

    // Fallback property detail search at document level
    if (!data.propertyType) {
      const rootPropDetail = first(doc, 'PROPERTY_DETAIL');
      if (rootPropDetail) {
        data.propertyType = data.propertyType || textOf(first(rootPropDetail, 'PropertyEstateType')) ||
                            textOf(first(rootPropDetail, 'PropertyType')) || null;
        data.occupancyType = data.occupancyType || textOf(first(rootPropDetail, 'PropertyUsageType')) || null;
        data.numberOfUnits = data.numberOfUnits ||
                             parseInt(textOf(first(rootPropDetail, 'FinancedUnitCount'))) ||
                             parseInt(textOf(first(rootPropDetail, 'PropertyUnitCount'))) || null;
        if (textOf(first(rootPropDetail, 'PUDIndicator')) === 'true') data.hasHOA = true;
      }
    }

    // Purchase price
    const salesContract = first(doc, 'SALES_CONTRACT') || first(doc, 'PURCHASE_CREDIT');
    if (salesContract) {
      data.purchasePrice = numOf(first(salesContract, 'SalesContractAmount')) ||
                           numOf(first(salesContract, 'RealPropertyAmount')) || null;
    }
    if (!data.purchasePrice && data.propertyValue) {
      data.purchasePrice = data.propertyValue;
    }

    // LTV calculation
    const ltvEl = first(doc, 'LTV');
    if (ltvEl) {
      data.ltv = numOf(first(ltvEl, 'LTVRatioPercent'));
      data.cltv = numOf(first(ltvEl, 'CombinedLTVRatioPercent'));
    }
    if (!data.ltv && data.baseLoanAmount && data.propertyValue) {
      data.ltv = Math.round((data.baseLoanAmount / data.propertyValue) * 10000) / 100;
    }

    // ---- FHA-specific ----
    if (data.isFHA) {
      const fhaLoan = first(doc, 'FHA_LOAN');
      if (fhaLoan) {
        data.fhaDetails.caseNumber = textOf(first(fhaLoan, 'FHACaseIdentifier')) || null;
        data.fhaDetails.ufmipAmount = numOf(first(fhaLoan, 'FHAUpfrontMIPremiumAmount'));
      }
      const miData = first(doc, 'MI_DATA') || first(doc, 'MORTGAGE_INSURANCE');
      if (miData) {
        data.fhaDetails.ufmipAmount = data.fhaDetails.ufmipAmount || numOf(first(miData, 'MIInitialPremiumAmount'));
      }
    }

    // ---- VA-specific ----
    if (data.isVA) {
      const vaLoan = first(doc, 'VA_LOAN');
      if (vaLoan) {
        data.vaDetails.fundingFeeAmount = numOf(first(vaLoan, 'FundingFeeAmount'));
        data.vaDetails.entitlementAmount = numOf(first(vaLoan, 'EntitlementAmount'));
        const firstUse = textOf(first(vaLoan, 'FirstTimeUseIndicator'));
        data.vaDetails.isFirstUse = firstUse === 'true' ? true : firstUse === 'false' ? false : null;
      }
    }

    // ---- Borrower names from INDIVIDUAL elements ----
    const individuals = all(doc, 'INDIVIDUAL');
    const individualNames = individuals.map(function (ind) {
      const nm = first(ind, 'NAME');
      if (!nm) return 'Borrower';
      const fullName = textOf(first(nm, 'FullName'));
      if (fullName) return fullName;
      const firstName = textOf(first(nm, 'FirstName'));
      const lastName = textOf(first(nm, 'LastName'));
      return (firstName + ' ' + lastName).trim() || 'Borrower';
    });

    // ---- Borrowers ----
    const borrowerElements = all(doc, 'BORROWER');
    borrowerElements.forEach(function (bEl, index) {
      const borrower = {
        name: individualNames[index] || ('Borrower #' + (index + 1)),
        incomes: [],
        employments: [],
        residences: [],
        declarations: {
          usCitizen: null,
          permResident: null,
          nonPermResident: null,
          bankruptcy: false,
          foreclosure: false,
          judgments: false,
          // Enhanced declarations
          alimonyObligation: false,
          childSupportObligation: false,
          ownershipInterest: false,
          priorPropertyUsage: null,
          priorPropertyTitle: null
        }
      };

      // Income
      const currentIncome = first(bEl, 'CURRENT_INCOME');
      if (currentIncome) {
        const incomeItems = first(currentIncome, 'CURRENT_INCOME_ITEMS');
        if (incomeItems) {
          all(incomeItems, 'CURRENT_INCOME_ITEM').forEach(function (item) {
            const detail = first(item, 'CURRENT_INCOME_ITEM_DETAIL');
            if (!detail) return;
            const incomeType = textOf(first(detail, 'IncomeType'));
            const monthlyAmount = textOf(first(detail, 'CurrentIncomeMonthlyTotalAmount'));
            const isEmploymentIncome = textOf(first(detail, 'EmploymentIncomeIndicator')) === 'true';
            borrower.incomes.push({
              type: incomeType,
              monthlyAmount: monthlyAmount ? parseFloat(monthlyAmount) : 0,
              isEmploymentIncome: isEmploymentIncome
            });
          });
        }
      }

      // Employment
      const employers = first(bEl, 'EMPLOYERS');
      if (employers) {
        all(employers, 'EMPLOYER').forEach(function (emp) {
          const empNode = first(emp, 'EMPLOYMENT');
          if (!empNode) return;
          const startDate = parseDate(textOf(first(empNode, 'EmploymentStartDate')));
          const endDateText = textOf(first(empNode, 'EmploymentEndDate'));
          const endDate = endDateText ? parseDate(endDateText) : now;
          const employedMonths = monthsBetween(startDate, endDate);
          const isSelfEmployed = textOf(first(empNode, 'EmploymentBorrowerSelfEmployedIndicator')) === 'true';
          const classificationType = textOf(first(empNode, 'EmploymentClassificationType'));
          const statusType = textOf(first(empNode, 'EmploymentStatusType'));
          const isCurrent = !endDateText || (statusType || '').match(/current/i) !== null;

          let ownershipPercent = null;
          const ownershipFields = [
            'EmploymentOwnershipInterestPercent',
            'OwnershipInterestPercent',
            'OwnershipPercent',
            'OwnershipPercentage'
          ];
          for (let f = 0; f < ownershipFields.length; f++) {
            const value = textOf(first(empNode, ownershipFields[f]));
            if (value) {
              ownershipPercent = parseFloat(value);
              if (!isNaN(ownershipPercent)) break;
            }
          }

          // Enhanced: employer details
          const employerName = textOf(first(empNode, 'EmployerName')) ||
                               textOf(first(emp, 'Name')) ||
                               textOf(first(emp, 'LegalEntityName')) ||
                               'Employer';

          const empAddr = first(emp, 'ADDRESS') || first(empNode, 'ADDRESS');
          const employerPhone = textOf(first(emp, 'ContactPointTelephoneValue')) ||
                                textOf(first(empNode, 'EmployerTelephoneNumber')) || '';
          const positionDescription = textOf(first(empNode, 'EmploymentPositionDescription')) ||
                                      textOf(first(empNode, 'PositionDescription')) || '';

          borrower.employments.push({
            employerName: employerName,
            employerPhone: employerPhone,
            positionDescription: positionDescription,
            employerCity: empAddr ? textOf(first(empAddr, 'CityName')) : '',
            employerState: empAddr ? textOf(first(empAddr, 'StateCode')) : '',
            startDate: startDate,
            endDate: endDate,
            isCurrent: isCurrent,
            monthsEmployed: employedMonths,
            isSelfEmployed: isSelfEmployed,
            classificationType: classificationType,
            statusType: statusType,
            ownershipPercent: ownershipPercent,
            isSCorp: (classificationType || '').match(/s-?corp|s\s*corporation/i) !== null,
            isPartnership: (classificationType || '').match(/partnership/i) !== null,
            is1120: (classificationType || '').match(/1120/i) !== null,
            is1065: (classificationType || '').match(/1065/i) !== null
          });
        });
      }

      // Residences — enhanced with address
      const residences = first(bEl, 'RESIDENCES');
      if (residences) {
        all(residences, 'RESIDENCE').forEach(function (res) {
          const detail = first(res, 'RESIDENCE_DETAIL');
          if (!detail) return;
          const monthsAtResidence = parseInt(textOf(first(detail, 'BorrowerResidencyDurationMonthsCount'))) || 0;
          const residencyType = textOf(first(detail, 'BorrowerResidencyType'));
          const residencyBasis = textOf(first(detail, 'BorrowerResidencyBasisType'));

          const resAddr = first(res, 'ADDRESS');
          borrower.residences.push({
            monthsAtResidence: monthsAtResidence,
            residencyType: residencyType,
            residencyBasis: residencyBasis, // Own, Rent, LivingRentFree
            address: resAddr ? textOf(first(resAddr, 'AddressLineText')) || textOf(first(resAddr, 'AddressLine1Text')) : '',
            city: resAddr ? textOf(first(resAddr, 'CityName')) : '',
            state: resAddr ? textOf(first(resAddr, 'StateCode')) : ''
          });
        });
      }

      // Declarations — enhanced
      const decl = first(bEl, 'DECLARATION') || bEl;
      const declDetail = first(decl, 'DECLARATION_DETAIL') || decl;
      const getBool = function (fieldName) {
        const val = textOf(first(declDetail, fieldName));
        if (val === '') return null;
        return val === 'true';
      };
      borrower.declarations.usCitizen = getBool('USCitizenIndicator');
      borrower.declarations.permResident = getBool('PermanentResidentAlienIndicator');
      borrower.declarations.nonPermResident = getBool('NonPermanentResidentAlienIndicator');
      borrower.declarations.bankruptcy = getBool('BankruptcyIndicator') || getBool('BorrowerHadBankruptcyIndicator') || false;
      borrower.declarations.foreclosure = getBool('PropertyForeclosureIndicator') || getBool('BorrowerHadPropertyForeclosedIndicator') || false;
      borrower.declarations.judgments = getBool('OutstandingJudgmentsIndicator') || false;
      borrower.declarations.alimonyObligation = getBool('AlimonyChildSupportObligationIndicator') || false;
      borrower.declarations.childSupportObligation = getBool('ChildSupportObligationIndicator') || false;
      borrower.declarations.ownershipInterest = getBool('PropertyOwnershipInterestIndicator') || false;
      borrower.declarations.priorPropertyUsage = textOf(first(declDetail, 'PriorPropertyUsageType')) || null;
      borrower.declarations.priorPropertyTitle = textOf(first(declDetail, 'PriorPropertyTitleType')) || null;

      data.borrowers.push(borrower);
    });

    data.borrowerCount = data.borrowers.length;

    // Count distinct income types across all borrowers
    const incomeTypeSet = {};
    data.borrowers.forEach(function (b) {
      b.incomes.forEach(function (inc) {
        if (inc.type) incomeTypeSet[inc.type] = true;
      });
    });
    data.totalIncomeTypes = Object.keys(incomeTypeSet).length;

    // ---- Assets ----
    all(doc, 'ASSET').forEach(function (asset) {
      const detail = first(asset, 'ASSET_DETAIL');
      if (!detail) return;
      data.assets.push({
        type: textOf(first(detail, 'AssetType')),
        holderName: textOf(first(detail, 'HolderName')),
        accountIdentifier: textOf(first(detail, 'AccountIdentifier')),
        amount: textOf(first(detail, 'AssetCashOrMarketValueAmount'))
      });
    });

    // ---- Liabilities — enhanced with holder/payment info ----
    all(doc, 'LIABILITY').forEach(function (liability) {
      const detail = first(liability, 'LIABILITY_DETAIL');
      if (!detail) return;
      data.liabilities.push({
        type: textOf(first(detail, 'LiabilityType')),
        toBePaidAtClosing: textOf(first(detail, 'PayoffIncludedInClosingIndicator')) === 'true',
        accountIdentifier: textOf(first(detail, 'AccountIdentifier')),
        holderName: textOf(first(detail, 'HolderName')) || textOf(first(detail, 'CompanyName')) || '',
        monthlyPaymentAmount: numOf(first(detail, 'LiabilityMonthlyPaymentAmount')),
        unpaidBalance: numOf(first(detail, 'LiabilityUnpaidBalanceAmount'))
      });
    });

    // ---- REO properties — enhanced with mortgage/rental details ----
    all(doc, 'REO_PROPERTY').forEach(function (reo) {
      const propNode = first(reo, 'PROPERTY');
      const addr = (propNode && first(propNode, 'ADDRESS')) || first(reo, 'ADDRESS');
      const addressLine = addr ? (textOf(first(addr, 'AddressLineText')) || textOf(first(addr, 'AddressLine1Text'))) : '';
      const city = addr ? textOf(first(addr, 'CityName')) : '';
      const state = addr ? textOf(first(addr, 'StateCode')) : '';
      const usageNode = first(reo, 'PropertyUsageType') || (propNode && first(propNode, 'PropertyUsageType'));
      const usage = usageNode ? textOf(usageNode) : '';
      const disposition = textOf(first(reo, 'PropertyDispositionStatusType'));

      // Try to get rental income from REO
      const rentalIncome = numOf(first(reo, 'GrossRentalIncomeAmount')) ||
                           numOf(first(reo, 'NetRentalIncomeAmount'));

      data.reoProperties.push({
        address: [addressLine, city && state ? (city + ', ' + state) : (city || state)].filter(Boolean).join(' '),
        addressLine: addressLine,
        city: city,
        state: state,
        usage: usage,
        disposition: disposition,
        rentalIncome: rentalIncome,
        isPrimaryResidence: (usage || '').match(/primary|principal/i) !== null,
        isInvestment: (usage || '').match(/invest|rental/i) !== null
      });
    });

    // ---- HOA ----
    all(doc, 'HOUSING_EXPENSE').forEach(function (expense) {
      const expenseType = textOf(first(expense, 'HousingExpenseType'));
      if ((expenseType || '').match(/association|hoa/i)) data.hasHOA = true;
    });

    // Classify property type for complexity
    const pt = (data.propertyType || '').toLowerCase();
    if (pt.match(/condo/i)) data.hasHOA = true;

    // ---- Complexity flags ----
    if (data.borrowerCount > 1) {
      data.complexityFlags.push('Multiple borrowers (' + data.borrowerCount + ')');
    }
    if (data.reoProperties.length >= 3) {
      data.complexityFlags.push('Portfolio borrower (' + data.reoProperties.length + ' REO properties)');
    }
    if (data.totalIncomeTypes >= 3) {
      data.complexityFlags.push('Mixed income types (' + data.totalIncomeTypes + ' types)');
    }
    const hasSE = data.borrowers.some(function (b) {
      return b.employments.some(function (e) { return e.isSelfEmployed; });
    });
    if (hasSE) {
      data.complexityFlags.push('Self-employment income');
    }
    if (data.numberOfUnits && data.numberOfUnits > 1) {
      data.complexityFlags.push('Multi-unit property (' + data.numberOfUnits + ' units)');
    }
    if (data.isCashOut) {
      data.complexityFlags.push('Cash-out refinance');
    }

    return data;
  }

  // ---- Employment coverage ----
  function calculateEmploymentCoverage(borrower) {
    const totalMonths = borrower.employments.reduce(function (sum, emp) {
      return sum + (emp.monthsEmployed || 0);
    }, 0);
    return {
      totalMonths: totalMonths,
      monthsNeeded: Math.max(0, 24 - totalMonths),
      isSufficient: totalMonths >= 24
    };
  }

  // ---- Residence coverage ----
  function calculateResidenceCoverage(borrower) {
    const totalMonths = borrower.residences.reduce(function (sum, res) {
      return sum + (res.monthsAtResidence || 0);
    }, 0);
    return {
      totalMonths: totalMonths,
      monthsNeeded: Math.max(0, 24 - totalMonths),
      isSufficient: totalMonths >= 24
    };
  }

  /**
   * Detect gaps in employment history.
   * Returns array of { fromEmployer, toEmployer, gapMonths, fromDate, toDate }
   */
  function detectEmploymentGaps(borrower) {
    const gaps = [];
    const sorted = borrower.employments.slice().sort(function (a, b) {
      return (a.startDate || new Date(0)) - (b.startDate || new Date(0));
    });

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!current.endDate || !next.startDate) continue;

      const gapMonths = monthsBetween(current.endDate, next.startDate);
      if (gapMonths !== null && gapMonths > 1) { // > 1 month gap
        gaps.push({
          fromEmployer: current.employerName,
          toEmployer: next.employerName,
          gapMonths: gapMonths,
          fromDate: current.endDate,
          toDate: next.startDate
        });
      }
    }

    // Check gap from last employment to now (if not current)
    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1];
      if (!last.isCurrent && last.endDate) {
        const now = new Date();
        const gapMonths = monthsBetween(last.endDate, now);
        if (gapMonths !== null && gapMonths > 1) {
          gaps.push({
            fromEmployer: last.employerName,
            toEmployer: '(current)',
            gapMonths: gapMonths,
            fromDate: last.endDate,
            toDate: now
          });
        }
      }
    }

    return gaps;
  }

  window.MSFG = window.MSFG || {};
  window.MSFG.MISMODocParser = {
    parseMISMO: parseMISMO,
    calculateEmploymentCoverage: calculateEmploymentCoverage,
    calculateResidenceCoverage: calculateResidenceCoverage,
    detectEmploymentGaps: detectEmploymentGaps
  };
})();
