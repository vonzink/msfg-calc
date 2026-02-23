'use strict';
/**
 * MISMO 3.4 XML Parser — Document Analyzer edition
 * Extracts borrower, employment, income, declarations, assets,
 * liabilities, and REO data from MISMO XML for document-checklist generation.
 *
 * Namespace: MSFG.MISMODocParser
 * API: parseMISMO(xmlDoc), calculateEmploymentCoverage(borrower), calculateResidenceCoverage(borrower)
 */
(function () {
  var NS = 'http://www.mismo.org/residential/2009/schemas';

  function first(el, name) {
    var items = el.getElementsByTagNameNS(NS, name);
    return items.length > 0 ? items[0] : null;
  }

  function all(el, name) {
    return Array.from(el.getElementsByTagNameNS(NS, name));
  }

  function textOf(el) {
    return el ? (el.textContent || '').trim() : '';
  }

  function parseDate(str) {
    if (!str) return null;
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function monthsBetween(start, end) {
    if (!start || !end) return null;
    var years = end.getFullYear() - start.getFullYear();
    var months = end.getMonth() - start.getMonth();
    return years * 12 + months;
  }

  /**
   * @param {Document} doc — parsed XML document
   * @returns {Object} structured MISMO data
   */
  function parseMISMO(doc) {
    var data = {
      borrowers: [],
      loanPurpose: null,
      mortgageType: null,
      baseLoanAmount: null,
      assets: [],
      liabilities: [],
      reoProperties: [],
      hasHOA: false
    };

    // Loan terms
    var terms = first(doc, 'TERMS_OF_LOAN');
    if (terms) {
      data.baseLoanAmount = textOf(first(terms, 'BaseLoanAmount')) || null;
      data.loanPurpose = textOf(first(terms, 'LoanPurposeType')) || null;
      data.mortgageType = textOf(first(terms, 'MortgageType')) || null;
    }

    // Borrower names from INDIVIDUAL elements
    var individuals = all(doc, 'INDIVIDUAL');
    var individualNames = individuals.map(function (ind) {
      var nm = first(ind, 'NAME');
      if (!nm) return 'Borrower';
      var fullName = textOf(first(nm, 'FullName'));
      if (fullName) return fullName;
      var firstName = textOf(first(nm, 'FirstName'));
      var lastName = textOf(first(nm, 'LastName'));
      return (firstName + ' ' + lastName).trim() || 'Borrower';
    });

    // Borrowers
    var borrowerElements = all(doc, 'BORROWER');
    borrowerElements.forEach(function (bEl, index) {
      var borrower = {
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
          judgments: false
        }
      };

      // Income
      var currentIncome = first(bEl, 'CURRENT_INCOME');
      if (currentIncome) {
        var incomeItems = first(currentIncome, 'CURRENT_INCOME_ITEMS');
        if (incomeItems) {
          all(incomeItems, 'CURRENT_INCOME_ITEM').forEach(function (item) {
            var detail = first(item, 'CURRENT_INCOME_ITEM_DETAIL');
            if (!detail) return;
            var incomeType = textOf(first(detail, 'IncomeType'));
            var monthlyAmount = textOf(first(detail, 'CurrentIncomeMonthlyTotalAmount'));
            var isEmploymentIncome = textOf(first(detail, 'EmploymentIncomeIndicator')) === 'true';
            borrower.incomes.push({
              type: incomeType,
              monthlyAmount: monthlyAmount ? parseFloat(monthlyAmount) : 0,
              isEmploymentIncome: isEmploymentIncome
            });
          });
        }
      }

      // Employment
      var employers = first(bEl, 'EMPLOYERS');
      if (employers) {
        var now = new Date();
        all(employers, 'EMPLOYER').forEach(function (emp) {
          var empNode = first(emp, 'EMPLOYMENT');
          if (!empNode) return;
          var startDate = parseDate(textOf(first(empNode, 'EmploymentStartDate')));
          var endDateText = textOf(first(empNode, 'EmploymentEndDate'));
          var endDate = endDateText ? parseDate(endDateText) : now;
          var monthsEmployed = monthsBetween(startDate, endDate);
          var isSelfEmployed = textOf(first(empNode, 'EmploymentBorrowerSelfEmployedIndicator')) === 'true';
          var classificationType = textOf(first(empNode, 'EmploymentClassificationType'));

          var ownershipPercent = null;
          var ownershipFields = [
            'EmploymentOwnershipInterestPercent',
            'OwnershipInterestPercent',
            'OwnershipPercent',
            'OwnershipPercentage'
          ];
          for (var f = 0; f < ownershipFields.length; f++) {
            var value = textOf(first(empNode, ownershipFields[f]));
            if (value) {
              ownershipPercent = parseFloat(value);
              if (!isNaN(ownershipPercent)) break;
            }
          }

          var employerName = textOf(first(empNode, 'EmployerName')) ||
                             textOf(first(emp, 'Name')) ||
                             textOf(first(emp, 'LegalEntityName')) ||
                             'Employer';

          borrower.employments.push({
            employerName: employerName,
            startDate: startDate,
            endDate: endDate,
            monthsEmployed: monthsEmployed,
            isSelfEmployed: isSelfEmployed,
            classificationType: classificationType,
            ownershipPercent: ownershipPercent,
            isSCorp: (classificationType || '').match(/s-?corp|s\s*corporation/i) !== null,
            isPartnership: (classificationType || '').match(/partnership/i) !== null,
            is1120: (classificationType || '').match(/1120/i) !== null,
            is1065: (classificationType || '').match(/1065/i) !== null
          });
        });
      }

      // Residences
      var residences = first(bEl, 'RESIDENCES');
      if (residences) {
        all(residences, 'RESIDENCE').forEach(function (res) {
          var detail = first(res, 'RESIDENCE_DETAIL');
          if (!detail) return;
          var monthsAtResidence = parseInt(textOf(first(detail, 'BorrowerResidencyDurationMonthsCount'))) || 0;
          var residencyType = textOf(first(detail, 'BorrowerResidencyType'));
          borrower.residences.push({
            monthsAtResidence: monthsAtResidence,
            residencyType: residencyType
          });
        });
      }

      // Declarations
      var decl = first(bEl, 'DECLARATION') || bEl;
      var declDetail = first(decl, 'DECLARATION_DETAIL') || decl;
      var getBool = function (fieldName) {
        var val = textOf(first(declDetail, fieldName));
        if (val === '') return null;
        return val === 'true';
      };
      borrower.declarations.usCitizen = getBool('USCitizenIndicator');
      borrower.declarations.permResident = getBool('PermanentResidentAlienIndicator');
      borrower.declarations.nonPermResident = getBool('NonPermanentResidentAlienIndicator');
      borrower.declarations.bankruptcy = getBool('BankruptcyIndicator') || getBool('BorrowerHadBankruptcyIndicator') || false;
      borrower.declarations.foreclosure = getBool('PropertyForeclosureIndicator') || getBool('BorrowerHadPropertyForeclosedIndicator') || false;
      borrower.declarations.judgments = getBool('OutstandingJudgmentsIndicator') || false;

      data.borrowers.push(borrower);
    });

    // Assets
    all(doc, 'ASSET').forEach(function (asset) {
      var detail = first(asset, 'ASSET_DETAIL');
      if (!detail) return;
      data.assets.push({
        type: textOf(first(detail, 'AssetType')),
        holderName: textOf(first(detail, 'HolderName')),
        accountIdentifier: textOf(first(detail, 'AccountIdentifier')),
        amount: textOf(first(detail, 'AssetCashOrMarketValueAmount'))
      });
    });

    // Liabilities
    all(doc, 'LIABILITY').forEach(function (liability) {
      var detail = first(liability, 'LIABILITY_DETAIL');
      if (!detail) return;
      data.liabilities.push({
        type: textOf(first(detail, 'LiabilityType')),
        toBePaidAtClosing: textOf(first(detail, 'PayoffIncludedInClosingIndicator')) === 'true',
        accountIdentifier: textOf(first(detail, 'AccountIdentifier'))
      });
    });

    // REO properties
    all(doc, 'REO_PROPERTY').forEach(function (reo) {
      var propNode = first(reo, 'PROPERTY');
      var addr = (propNode && first(propNode, 'ADDRESS')) || first(reo, 'ADDRESS');
      var addressLine = addr ? (textOf(first(addr, 'AddressLineText')) || textOf(first(addr, 'AddressLine1Text'))) : '';
      var city = addr ? textOf(first(addr, 'CityName')) : '';
      var state = addr ? textOf(first(addr, 'StateCode')) : '';
      var usageNode = first(reo, 'PropertyUsageType') || (propNode && first(propNode, 'PropertyUsageType'));
      var usage = usageNode ? textOf(usageNode) : '';
      data.reoProperties.push({
        address: [addressLine, city && state ? (city + ', ' + state) : (city || state)].filter(Boolean).join(' '),
        usage: usage
      });
    });

    // HOA
    all(doc, 'HOUSING_EXPENSE').forEach(function (expense) {
      var expenseType = textOf(first(expense, 'HousingExpenseType'));
      if ((expenseType || '').match(/association|hoa/i)) data.hasHOA = true;
    });
    var propDetail = first(doc, 'PROPERTY_DETAIL');
    if (propDetail) {
      if (textOf(first(propDetail, 'PUDIndicator')) === 'true') data.hasHOA = true;
    }

    return data;
  }

  function calculateEmploymentCoverage(borrower) {
    var totalMonths = borrower.employments.reduce(function (sum, emp) {
      return sum + (emp.monthsEmployed || 0);
    }, 0);
    return {
      totalMonths: totalMonths,
      monthsNeeded: Math.max(0, 24 - totalMonths),
      isSufficient: totalMonths >= 24
    };
  }

  function calculateResidenceCoverage(borrower) {
    var totalMonths = borrower.residences.reduce(function (sum, res) {
      return sum + (res.monthsAtResidence || 0);
    }, 0);
    return {
      totalMonths: totalMonths,
      monthsNeeded: Math.max(0, 24 - totalMonths),
      isSufficient: totalMonths >= 24
    };
  }

  window.MSFG = window.MSFG || {};
  window.MSFG.MISMODocParser = {
    parseMISMO: parseMISMO,
    calculateEmploymentCoverage: calculateEmploymentCoverage,
    calculateResidenceCoverage: calculateResidenceCoverage
  };
})();
