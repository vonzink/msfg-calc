/**
 * Income Documentation Logic
 * Implements decision tree to determine required income documentation
 * based on MISMO data and employment/income types
 * 
 * File: income-logic.js
 * Used by: MISMO_Document_Analyzer.html
 * Requires: mismo-parser.js
 */

/**
 * Main function to determine income documentation requirements
 * @param {Object} borrower - Borrower object from MISMO parser
 * @returns {Array} Array of required documents with status and reasons
 */
function determineIncomeDocumentation(borrower) {
    const docs = [];
    const tag = `[${borrower.name}]`;

    // Check each income type and employment situation
    const isSelfEmployed = checkSelfEmployed(borrower);
    const hasAlimony = checkAlimony(borrower);
    const hasBaseIncome = checkBaseIncome(borrower);
    const isRetired = checkRetired(borrower);
    const otherIncomeTypes = checkOtherIncome(borrower);

    // 1) SELF-EMPLOYED
    if (isSelfEmployed) {
        processSelfEmployed(borrower, docs, tag);
    }

    // 2) ALIMONY OR CHILD SUPPORT
    if (hasAlimony) {
        processAlimony(borrower, docs, tag);
    }

    // 3) SALARY OR HOURLY (BASE INCOME)
    if (hasBaseIncome && !isSelfEmployed) {
        processBaseIncome(borrower, docs, tag);
    }

    // 4) RETIRED
    if (isRetired) {
        processRetired(borrower, docs, tag);
    }

    // 5) OTHER INCOME
    if (otherIncomeTypes.length > 0) {
        processOtherIncome(borrower, otherIncomeTypes, docs, tag);
    }

    return docs;
}

/**
 * Check if borrower is self-employed
 */
function checkSelfEmployed(borrower) {
    // Check employment indicator
    const hasSelEmployedFlag = borrower.employments.some(emp => emp.isSelfEmployed);
    
    // Check income types that indicate self-employment
    const selfEmployedIncomeTypes = borrower.incomes.filter(inc => 
        (inc.type || '').match(/self|business|partnership|s-?corp|s\s*corporation|schedule\s*c|1099/i)
    );

    return hasSelEmployedFlag || selfEmployedIncomeTypes.length > 0;
}

/**
 * Check for alimony or child support income
 */
function checkAlimony(borrower) {
    return borrower.incomes.some(inc => 
        (inc.type || '').match(/alimony|child\s*support/i)
    );
}

/**
 * Check for base/salary/hourly income
 */
function checkBaseIncome(borrower) {
    return borrower.incomes.some(inc => 
        ['Base', 'Hourly', 'Salary'].includes(inc.type)
    );
}

/**
 * Check if borrower is retired
 */
function checkRetired(borrower) {
    // Check employment classification
    const hasRetiredClassification = borrower.employments.some(emp => 
        (emp.classificationType || '').match(/retired/i)
    );
    
    // Check for retirement income types
    const hasRetirementIncome = borrower.incomes.some(inc => 
        (inc.type || '').match(/social\s*security|pension|retirement|disability/i)
    );

    // If no employments but has retirement income, assume retired
    const noEmploymentButRetirementIncome = borrower.employments.length === 0 && hasRetirementIncome;

    return hasRetiredClassification || noEmploymentButRetirementIncome;
}

/**
 * Identify other income types
 */
function checkOtherIncome(borrower) {
    const otherTypes = [];
    
    borrower.incomes.forEach(inc => {
        const type = inc.type || '';
        
        if (type.match(/capital\s*gain|dividend|interest/i)) {
            otherTypes.push({ category: 'capitalGains', type: type, amount: inc.monthlyAmount });
        }
        if (type.match(/foster\s*care/i)) {
            otherTypes.push({ category: 'fosterCare', type: type, amount: inc.monthlyAmount });
        }
        if (type.match(/foreign/i)) {
            otherTypes.push({ category: 'foreign', type: type, amount: inc.monthlyAmount });
        }
        if (type.match(/unemployment/i)) {
            otherTypes.push({ category: 'unemployment', type: type, amount: inc.monthlyAmount });
        }
        if (type.match(/royalt/i)) {
            otherTypes.push({ category: 'royalties', type: type, amount: inc.monthlyAmount });
        }
        if (type.match(/trust/i)) {
            otherTypes.push({ category: 'trust', type: type, amount: inc.monthlyAmount });
        }
    });

    return otherTypes;
}

/**
 * Process self-employment documentation
 */
function processSelfEmployed(borrower, docs, tag) {
    // Calculate years in business
    const oldestEmployment = borrower.employments
        .filter(emp => emp.isSelfEmployed)
        .sort((a, b) => (a.startDate || new Date()) - (b.startDate || new Date()))[0];
    
    const yearsInBusiness = oldestEmployment && oldestEmployment.monthsEmployed 
        ? oldestEmployment.monthsEmployed / 12 
        : 0;

    // 1.1 Been in business > 5 years?
    if (yearsInBusiness > 5) {
        docs.push({
            name: `${tag} Personal tax returns (1040s) - 1 year`,
            status: 'required',
            reason: `Self-employed for ${Math.floor(yearsInBusiness)} years (>5 years). Only 1 year required.`
        });
    } else {
        docs.push({
            name: `${tag} Personal tax returns (1040s) - 2 years`,
            status: 'required',
            reason: `Self-employed for ${Math.floor(yearsInBusiness)} years (≤5 years). 2 years required.`
        });
    }

    // Always get YTD P&L for self-employed
    docs.push({
        name: `${tag} Year-to-date Profit & Loss (P&L) statement`,
        status: 'required',
        reason: 'Self-employment income requires current year performance documentation.'
    });

    // 1.3 Separate business tax returns?
    const hasBusinessReturns = borrower.employments.some(emp => 
        emp.is1120 || emp.isSCorp || emp.is1065 || emp.isPartnership
    );

    if (hasBusinessReturns) {
        // 1.3.a Check for 1120/1120S
        const has1120 = borrower.employments.some(emp => emp.is1120 || emp.isSCorp);
        if (has1120) {
            docs.push({
                name: `${tag} Business W-2s`,
                status: 'required',
                reason: 'S-Corporation or C-Corporation entity type.'
            });
            docs.push({
                name: `${tag} 1120 and/or 1120S business tax returns - 2 years`,
                status: 'required',
                reason: 'Corporate entity requires business returns.'
            });
        } else {
            // 1.3.b Check for 1065
            const has1065 = borrower.employments.some(emp => emp.is1065 || emp.isPartnership);
            if (has1065) {
                docs.push({
                    name: `${tag} 1065 partnership tax returns - 2 years`,
                    status: 'required',
                    reason: 'Partnership entity requires 1065 returns.'
                });
            }
        }
    } else {
        // No separate business returns
        docs.push({
            name: `${tag} Business bank statements - 3 months`,
            status: 'required',
            reason: 'Self-employed without separate business entity.'
        });
        docs.push({
            name: `${tag} K-1 tax form`,
            status: 'conditional',
            reason: 'May be required if receiving K-1 income.'
        });
        docs.push({
            name: `${tag} Paycheck stubs (if generated)`,
            status: 'conditional',
            reason: 'Provide if self-employed business generates paychecks.'
        });
    }

    // 1.4 Ownership < 25%?
    const hasLessThan25Ownership = borrower.employments.some(emp => 
        emp.isSelfEmployed && emp.ownershipPercent !== null && emp.ownershipPercent < 25
    );

    if (hasLessThan25Ownership) {
        docs.push({
            name: `${tag} K-1 tax form (ownership < 25%)`,
            status: 'required',
            reason: 'Ownership interest is less than 25% of the business.'
        });
    }
}

/**
 * Process alimony/child support documentation
 */
function processAlimony(borrower, docs, tag) {
    docs.push({
        name: `${tag} Divorce decree or separation agreement`,
        status: 'required',
        reason: 'Alimony or child support income requires legal documentation.'
    });
    docs.push({
        name: `${tag} Bank statements - 6 months showing alimony/child support receipt`,
        status: 'required',
        reason: 'Verify consistent receipt of alimony or child support payments.'
    });
}

/**
 * Process base income (W-2 employment) documentation
 */
function processBaseIncome(borrower, docs, tag) {
    // Standard W-2 documents
    docs.push({
        name: `${tag} Paycheck stubs - 30 days (most recent)`,
        status: 'required',
        reason: 'Standard documentation for W-2 employment income.'
    });
    docs.push({
        name: `${tag} W-2 forms - 2 years`,
        status: 'required',
        reason: 'Verify 2-year employment income history.'
    });

    // Check if starting a new job (employment started within last 30 days)
    const now = new Date();
    const hasNewJob = borrower.employments.some(emp => {
        if (!emp.startDate) return false;
        const daysSinceStart = (now - emp.startDate) / (1000 * 60 * 60 * 24);
        return daysSinceStart <= 30;
    });

    if (hasNewJob) {
        docs.push({
            name: `${tag} Offer letter for new employment`,
            status: 'required',
            reason: 'Employment started within the last 30 days.'
        });
    }

    // Check for bonuses, tips, overtime, commission
    const hasBonus = borrower.incomes.some(inc => (inc.type || '').match(/bonus/i));
    const hasTips = borrower.incomes.some(inc => (inc.type || '').match(/tips/i));
    const hasOvertime = borrower.incomes.some(inc => (inc.type || '').match(/overtime/i));
    const hasCommission = borrower.incomes.some(inc => (inc.type || '').match(/commission/i));

    // Check for part-time employment
    const isPartTime = borrower.employments.some(emp => 
        (emp.classificationType || '').match(/part[-\s]?time/i)
    );

    if (hasBonus || hasTips || hasOvertime || hasCommission || isPartTime) {
        docs.push({
            name: `${tag} Last paycheck from prior calendar year and/or each job over last 2 years`,
            status: 'required',
            reason: 'Variable income (bonus/tips/overtime/commission) or part-time employment requires extended history.'
        });
    }
}

/**
 * Process retirement income documentation
 */
function processRetired(borrower, docs, tag) {
    // 4.1 Social Security
    const hasSocialSecurity = borrower.incomes.some(inc => 
        (inc.type || '').match(/social\s*security/i)
    );

    if (hasSocialSecurity) {
        docs.push({
            name: `${tag} Social Security award letter OR bank statements showing current receipt`,
            status: 'required',
            reason: 'Social Security income requires verification of award and receipt.'
        });
        
        // Note: We can't determine from MISMO if it's their own Social Security
        // This would require manual verification
        docs.push({
            name: `${tag} Proof of 3 years continuance (if not borrower's own Social Security)`,
            status: 'conditional',
            reason: 'Required if receiving Social Security on behalf of another person.'
        });
    }

    // 4.2 Pension or Disability
    const hasPension = borrower.incomes.some(inc => 
        (inc.type || '').match(/pension/i)
    );
    const hasDisability = borrower.incomes.some(inc => 
        (inc.type || '').match(/disability/i)
    );

    if (hasPension || hasDisability) {
        const incomeType = hasPension ? 'Pension' : 'Disability';
        docs.push({
            name: `${tag} ${incomeType} benefit statement or award letter`,
            status: 'required',
            reason: `${incomeType} income requires documentation of benefit amount.`
        });
        docs.push({
            name: `${tag} Bank statements showing 3 years continuance of ${incomeType.toLowerCase()}`,
            status: 'required',
            reason: `Verify ongoing receipt of ${incomeType.toLowerCase()} benefits.`
        });
    }

    // 4.3 Regular distribution from retirement account
    const hasRetirementDistribution = borrower.incomes.some(inc => 
        (inc.type || '').match(/retirement|distribution|ira|401k|403b/i) &&
        !(inc.type || '').match(/social\s*security|pension/i) // Exclude SS and pension
    );

    if (hasRetirementDistribution) {
        docs.push({
            name: `${tag} Bank statements - 3 months showing retirement distribution receipt`,
            status: 'required',
            reason: 'Regular retirement account distributions require proof of consistent receipt.'
        });
    }
}

/**
 * Process other income types documentation
 */
function processOtherIncome(borrower, otherIncomeTypes, docs, tag) {
    // Group by category to avoid duplicates
    const categories = new Set(otherIncomeTypes.map(ot => ot.category));

    categories.forEach(category => {
        switch (category) {
            case 'capitalGains':
                docs.push({
                    name: `${tag} Personal tax returns (1040s) with Schedule D - 2 years (signed)`,
                    status: 'required',
                    reason: 'Capital gains, dividend, or interest income requires Schedule D.'
                });
                docs.push({
                    name: `${tag} Current asset statement showing investment holdings`,
                    status: 'required',
                    reason: 'Verify source and continuance of investment income.'
                });
                break;

            case 'fosterCare':
                docs.push({
                    name: `${tag} Verification letter from foster care organization`,
                    status: 'required',
                    reason: 'Foster care income requires official verification.'
                });
                docs.push({
                    name: `${tag} Bank statements - 12 months showing foster care payment receipt`,
                    status: 'required',
                    reason: 'Verify consistent receipt of foster care payments.'
                });
                break;

            case 'foreign':
                docs.push({
                    name: `${tag} Personal tax returns (1040s) with Schedule B - 2 years (signed)`,
                    status: 'required',
                    reason: 'Foreign income reported on US tax returns requires Schedule B.'
                });
                docs.push({
                    name: `${tag} Documentation of foreign income source and amount`,
                    status: 'conditional',
                    reason: 'May require additional documentation if not reported on US returns.'
                });
                break;

            case 'unemployment':
                docs.push({
                    name: `${tag} Personal tax returns (1040s) - 2 years`,
                    status: 'conditional',
                    reason: 'Unemployment income requires tax returns if employment is seasonal (recurring annually).'
                });
                docs.push({
                    name: `${tag} Unemployment benefit statements`,
                    status: 'required',
                    reason: 'Verify unemployment benefit amount and duration.'
                });
                break;

            case 'royalties':
                docs.push({
                    name: `${tag} Personal tax returns (1040s) with Schedule E - 2 years (signed)`,
                    status: 'required',
                    reason: 'Royalty income requires Schedule E documentation.'
                });
                docs.push({
                    name: `${tag} Royalty contract, agreement, or statement`,
                    status: 'required',
                    reason: 'Confirm royalty amount, payment frequency, and duration.'
                });
                break;

            case 'trust':
                docs.push({
                    name: `${tag} Full trust document`,
                    status: 'required',
                    reason: 'Trust income requires complete trust documentation.'
                });
                docs.push({
                    name: `${tag} Trust bank statements - 2 months showing distribution`,
                    status: 'required',
                    reason: 'Verify continuance of trust distributions.'
                });
                break;
        }
    });
}

// Export for use in HTML
if (typeof window !== 'undefined') {
    window.IncomeLogic = {
        determineIncomeDocumentation
    };
}
