'use strict';

(function() {

  /* ── Local helpers ── */

  function el(id) { return document.getElementById(id); }

  const esc = MSFG.escHtml;

  function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(num);
  }

  function daysBetween(d1, d2) {
    if (!d1 || !d2) return null;
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  function fmtDate(d) {
    if (!d) return 'N/A';
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  }

  /* ---- Employment Continuity Timeline ---- */

  function renderEmploymentTimeline(data) {
    const container = el('mismoEmploymentTimeline');
    if (!container || !data.borrowers.length) return;

    let html = '<h3>24-Month Employment Continuity (Underwriter View) <span class="mismo-info-label">Informational</span></h3>';

    data.borrowers.forEach(function (borrower) {
      html += '<div class="mismo-info-borrower-title">' + esc(borrower.name) + '</div>';

      const sorted = borrower.employments.slice().sort(function (a, b) {
        return (a.startDate || new Date(0)) - (b.startDate || new Date(0));
      });

      if (sorted.length === 0) {
        html += '<div class="mismo-timeline-verdict mismo-timeline-verdict--unknown">Unable to Determine — no employment data in MISMO file</div>';
        return;
      }

      // Check for missing critical dates
      const hasMissingDates = sorted.some(function (emp) { return !emp.startDate; });

      // Build table
      html += '<table class="mismo-timeline-table"><thead><tr>';
      html += '<th>Employer</th><th>Start</th><th>End</th><th>Type</th><th>Position</th><th>Status</th>';
      html += '</tr></thead><tbody>';

      const gaps = [];

      sorted.forEach(function (emp, idx) {
        // Check for gap before this employment (if not the first)
        if (idx > 0) {
          const prev = sorted[idx - 1];
          if (prev.endDate && emp.startDate) {
            const gapDays = daysBetween(prev.endDate, emp.startDate);
            if (gapDays !== null && gapDays > 30) {
              const gapMonths = Math.round(gapDays / 30.44);
              gaps.push({
                fromEmployer: prev.employerName,
                toEmployer: emp.employerName,
                days: gapDays,
                months: gapMonths,
                fromDate: prev.endDate,
                toDate: emp.startDate
              });
              html += '<tr class="mismo-timeline-row--gap">';
              html += '<td colspan="6">\u26A0 GAP: ' + gapDays + ' days (' + gapMonths + ' mo) — ' +
                      fmtDate(prev.endDate) + ' to ' + fmtDate(emp.startDate) +
                      ' (between ' + esc(prev.employerName) + ' and ' + esc(emp.employerName) + ')</td>';
              html += '</tr>';
            }
          }
        }

        // Employment type
        let empType = 'W-2';
        if (emp.isSelfEmployed) empType = 'Self-Employed';
        else if ((emp.classificationType || '').match(/military|active/i)) empType = 'Military';

        // Status
        const status = emp.isCurrent ? 'Current' : 'Prior';

        html += '<tr>';
        html += '<td><strong>' + esc(emp.employerName) + '</strong></td>';
        html += '<td>' + fmtDate(emp.startDate) + '</td>';
        html += '<td>' + (emp.isCurrent ? '<strong>Present</strong>' : fmtDate(emp.endDate)) + '</td>';
        html += '<td>' + esc(empType) + '</td>';
        html += '<td>' + esc(emp.positionDescription || '\u2014') + '</td>';
        html += '<td>' + esc(status) + '</td>';
        html += '</tr>';
      });

      // Check gap from last employment to now
      const last = sorted[sorted.length - 1];
      if (!last.isCurrent && last.endDate) {
        const now = new Date();
        const gapDays = daysBetween(last.endDate, now);
        if (gapDays !== null && gapDays > 30) {
          const gapMonths = Math.round(gapDays / 30.44);
          gaps.push({
            fromEmployer: last.employerName,
            toEmployer: '(current date)',
            days: gapDays,
            months: gapMonths,
            fromDate: last.endDate,
            toDate: now
          });
          html += '<tr class="mismo-timeline-row--gap">';
          html += '<td colspan="6">\u26A0 GAP: ' + gapDays + ' days (' + gapMonths + ' mo) — ' +
                  fmtDate(last.endDate) + ' to present' +
                  ' (after ' + esc(last.employerName) + ')</td>';
          html += '</tr>';
        }
      }

      html += '</tbody></table>';

      // Verdict
      if (hasMissingDates) {
        html += '<div class="mismo-timeline-verdict mismo-timeline-verdict--unknown">' +
                'Unable to Determine — missing employment start/end dates. Request verification.</div>';
      } else if (gaps.length > 0) {
        html += '<div class="mismo-timeline-verdict mismo-timeline-verdict--gaps">' +
                'Gap(s) Found — ' + gaps.length + ' gap' + (gaps.length > 1 ? 's' : '') + ' detected exceeding 30 days</div>';
      } else {
        html += '<div class="mismo-timeline-verdict mismo-timeline-verdict--continuous">' +
                '\u2713 Continuous Employment — no gaps exceeding 30 days</div>';
      }

      // Required follow-ups
      if (gaps.length > 0) {
        html += '<ul class="mismo-timeline-followups">';
        gaps.forEach(function (gap) {
          html += '<li><strong>Employment Gap Letter required:</strong> ' +
                  fmtDate(gap.fromDate) + ' \u2013 ' + fmtDate(gap.toDate) +
                  ' (' + gap.days + ' days) between ' + esc(gap.fromEmployer) + ' and ' + esc(gap.toEmployer) + '</li>';
        });
        html += '</ul>';
      }
    });

    container.innerHTML = html;
    container.style.display = '';
  }

  /* ---- Income Stability Risk Score ---- */

  function renderIncomeRiskScore(data) {
    const container = el('mismoRiskScore');
    if (!container || !data.borrowers.length) return;

    let html = '<h3>Income Stability Risk Score <span class="mismo-info-label">Informational</span></h3>';

    data.borrowers.forEach(function (borrower) {
      let score = 0;
      const drivers = [];

      // 1. Employment gap >30 days: +20
      const sorted = borrower.employments.slice().sort(function (a, b) {
        return (a.startDate || new Date(0)) - (b.startDate || new Date(0));
      });
      let hasGap = false;
      let gapDetail = '';
      for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i];
        const next = sorted[i + 1];
        if (curr.endDate && next.startDate) {
          const gapDays = daysBetween(curr.endDate, next.startDate);
          if (gapDays !== null && gapDays > 30) {
            hasGap = true;
            gapDetail = gapDays + '-day gap between ' + curr.employerName + ' and ' + next.employerName;
            break;
          }
        }
      }
      // Also check gap to now
      if (!hasGap && sorted.length > 0) {
        const last = sorted[sorted.length - 1];
        if (!last.isCurrent && last.endDate) {
          const gapDays = daysBetween(last.endDate, new Date());
          if (gapDays !== null && gapDays > 30) {
            hasGap = true;
            gapDetail = gapDays + '-day gap after ' + last.employerName + ' to current date';
          }
        }
      }
      if (hasGap) {
        score += 20;
        drivers.push({ label: 'Employment gap >30 days', points: 20, detail: gapDetail });
      }

      // 2. Current job tenure <6 months: +15
      const currentEmps = borrower.employments.filter(function (e) { return e.isCurrent; });
      if (currentEmps.length > 0) {
        const shortTenure = currentEmps.some(function (e) { return e.monthsEmployed < 6; });
        if (shortTenure) {
          const emp = currentEmps.find(function (e) { return e.monthsEmployed < 6; });
          score += 15;
          drivers.push({
            label: 'Current job tenure <6 months',
            points: 15,
            detail: emp.employerName + ': ' + emp.monthsEmployed + ' months'
          });
        }
      }

      // 3. Multiple job changes in 24 months (>=2 non-current): +10
      const now = new Date();
      const twentyFourMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 24, now.getDate());
      const recentChanges = borrower.employments.filter(function (e) {
        return e.endDate && e.endDate > twentyFourMonthsAgo && !e.isCurrent;
      });
      if (recentChanges.length >= 2) {
        score += 10;
        const empNames = recentChanges.map(function (e) { return e.employerName; }).join(', ');
        drivers.push({
          label: 'Multiple job changes in 24 months',
          points: 10,
          detail: recentChanges.length + ' changes: ' + empNames
        });
      }

      // 4. Variable income present: +10
      const variableTypes = /bonus|overtime|commission|tips/i;
      const variableIncomes = borrower.incomes.filter(function (inc) {
        return variableTypes.test(inc.type || '');
      });
      if (variableIncomes.length > 0) {
        const typeList = variableIncomes.map(function (v) { return v.type; }).join(', ');
        score += 10;
        drivers.push({
          label: 'Variable income present',
          points: 10,
          detail: 'Types: ' + typeList
        });
      }

      // 5. Self-employed: +15
      const selfEmps = borrower.employments.filter(function (e) { return e.isSelfEmployed; });
      if (selfEmps.length > 0) {
        score += 15;
        drivers.push({
          label: 'Self-employment income',
          points: 15,
          detail: selfEmps.map(function (e) { return e.employerName; }).join(', ')
        });
      }

      // 6. Missing key fields: +10
      const missingFields = borrower.employments.filter(function (e) {
        return !e.startDate || e.employerName === 'Employer' || !e.employerName;
      });
      if (missingFields.length > 0) {
        score += 10;
        drivers.push({
          label: 'Missing key employment fields',
          points: 10,
          detail: missingFields.length + ' employment record(s) with missing data'
        });
      }

      // 7. REO count >= 2: +10 (loan-level, applied per borrower)
      if (data.reoProperties.length >= 2) {
        score += 10;
        drivers.push({
          label: 'Multiple REO properties',
          points: 10,
          detail: data.reoProperties.length + ' REO properties on file'
        });
      }

      // 8. Large/gift deposits: +10
      const giftAssets = data.assets.filter(function (a) { return (a.type || '').match(/gift/i); });
      if (giftAssets.length > 0) {
        score += 10;
        const giftLabels = giftAssets.map(function (a) {
          return (a.type || 'Gift').replace(/([A-Z])/g, ' $1').trim() +
                 (a.holderName ? ' from ' + a.holderName : '');
        }).join('; ');
        drivers.push({
          label: 'Gift/large deposits flagged',
          points: 10,
          detail: giftLabels
        });
      }

      // 9. Credit derog flags: +10
      if (borrower.declarations.bankruptcy || borrower.declarations.foreclosure || borrower.declarations.judgments) {
        const derogItems = [];
        if (borrower.declarations.bankruptcy) derogItems.push('Bankruptcy');
        if (borrower.declarations.foreclosure) derogItems.push('Foreclosure');
        if (borrower.declarations.judgments) derogItems.push('Judgments');
        score += 10;
        drivers.push({
          label: 'Credit derogatory flags',
          points: 10,
          detail: derogItems.join(', ') + ' declared'
        });
      }

      // Cap at 100
      score = Math.min(score, 100);

      // Band
      let band, bandClass;
      if (score <= 25) { band = 'Low Risk'; bandClass = 'low'; }
      else if (score <= 55) { band = 'Moderate Risk'; bandClass = 'moderate'; }
      else { band = 'High Risk'; bandClass = 'high'; }

      // Sort drivers by points descending
      drivers.sort(function (a, b) { return b.points - a.points; });
      const topDrivers = drivers.slice(0, 3);

      // Documentation impact
      const docImpact = [];
      if (hasGap) docImpact.push('Employment Gap Letter of Explanation');
      if (currentEmps.length > 0 && currentEmps.some(function (e) { return e.monthsEmployed < 6; })) {
        docImpact.push('Verbal VOE + additional paystubs covering 60 days');
      }
      if (selfEmps.length > 0) docImpact.push('YTD Profit & Loss + Balance Sheet + business bank statements');
      if (variableIncomes.length > 0) docImpact.push('2-year tax returns to establish income average');
      if (giftAssets.length > 0) docImpact.push('Gift letter + donor & borrower bank statements');
      if (borrower.declarations.bankruptcy || borrower.declarations.foreclosure) {
        docImpact.push('LOE + seasoning documentation for derogatory credit');
      }

      // Render
      html += '<div class="mismo-risk-card">';
      html += '<div class="mismo-risk-header">';
      html += '<span class="mismo-risk-score-num mismo-risk-score-num--' + bandClass + '">' + score + '</span>';
      html += '<span class="mismo-risk-band mismo-risk-band--' + bandClass + '">' + esc(band) + '</span>';
      html += '<span style="font-weight:600">' + esc(borrower.name) + '</span>';
      html += '</div>';

      if (topDrivers.length > 0) {
        html += '<div class="mismo-risk-drivers">';
        html += '<table><thead><tr><th>Risk Factor</th><th style="width:60px;text-align:center">Points</th><th>Detail (MISMO Source)</th></tr></thead><tbody>';
        topDrivers.forEach(function (d) {
          html += '<tr><td>' + esc(d.label) + '</td>';
          html += '<td style="text-align:center;font-weight:700">+' + d.points + '</td>';
          html += '<td style="color:#666">' + esc(d.detail) + '</td></tr>';
        });
        html += '</tbody></table>';
        html += '</div>';
      } else {
        html += '<div style="font-size:0.82rem;color:#666;font-style:italic">No risk factors detected from MISMO data.</div>';
      }

      if (docImpact.length > 0) {
        html += '<div class="mismo-risk-docs"><strong>Documentation impact:</strong> ' + docImpact.map(esc).join(' &bull; ') + '</div>';
      }

      html += '</div>';
    });

    container.innerHTML = html;
    container.style.display = '';
  }

  /* ---- Underwriter Attention Flags ---- */

  function renderAttentionFlags(data) {
    const container = el('mismoAttentionFlags');
    if (!container) return;

    const flags = [];
    const isPurchase = (data.loanPurpose || '').toLowerCase() === 'purchase';

    // ── LOAN-LEVEL FLAGS ──

    if (data.isFHA && isPurchase) {
      flags.push({
        level: 'loan', severity: 'high',
        title: 'FHA Purchase Package Required',
        trigger: 'MortgageType = FHA, LoanPurposeType = Purchase',
        why: 'FHA purchase transactions require a specific addendum package including the Amendatory Clause.',
        docs: 'FHA Amendatory Clause, Real Estate Certification, CAIVRS authorization per borrower.'
      });
    }
    if (data.isVA) {
      flags.push({
        level: 'loan', severity: 'high',
        title: 'VA Entitlement Verification Required',
        trigger: 'MortgageType = VA',
        why: 'VA loans require entitlement verification and service documentation.',
        docs: 'Certificate of Eligibility (COE), DD-214 or Statement of Service, VA Funding Fee documentation.'
      });
    }
    if (data.isUSDA) {
      flags.push({
        level: 'loan', severity: 'high',
        title: 'USDA Eligibility Verification Required',
        trigger: 'MortgageType = USDA',
        why: 'USDA loans require property and income eligibility verification.',
        docs: 'USDA property eligibility check, household income verification (all members).'
      });
    }
    if (data.reoProperties.length >= 3) {
      flags.push({
        level: 'loan', severity: 'moderate',
        title: 'Portfolio Complexity (' + data.reoProperties.length + ' REO Properties)',
        trigger: 'REO_PROPERTIES count = ' + data.reoProperties.length,
        why: 'Multiple REO properties increase reserve requirements and documentation complexity.',
        docs: 'Lease agreements + proof of receipt per rental property, property-specific mortgage statements, Schedule E.'
      });
    }
    if ((data.occupancyType || '').match(/invest/i)) {
      flags.push({
        level: 'loan', severity: 'moderate',
        title: 'Investment Property',
        trigger: 'PropertyUsageType = ' + esc(data.occupancyType),
        why: 'Investment properties require additional reserves and rental income documentation.',
        docs: 'Signed lease agreements, Schedule E, 6 months PITIA reserves documentation.'
      });
    }
    if ((data.propertyType || '').match(/condo/i)) {
      flags.push({
        level: 'loan', severity: 'moderate',
        title: 'Condo Project Review Required',
        trigger: 'PropertyEstateType = ' + esc(data.propertyType),
        why: 'Condo projects require eligibility review. FHA condos need HUD project approval.',
        docs: 'Condo questionnaire (full or limited review)' + (data.isFHA ? ', FHA Condo Project Approval (DELRAP/HRAP)' : '') + ', HOA financials.'
      });
    }
    if (data.ltv && data.ltv > 95) {
      flags.push({
        level: 'loan', severity: 'high',
        title: 'Very High LTV (' + data.ltv.toFixed(1) + '%)',
        trigger: 'LTVRatioPercent = ' + data.ltv.toFixed(1) + '%',
        why: 'LTV exceeds 95%. Additional MI documentation and appraisal scrutiny may apply.',
        docs: 'MI commitment/certificate, additional appraisal conditions review.'
      });
    } else if (data.ltv && data.ltv > 80) {
      flags.push({
        level: 'loan', severity: 'info',
        title: 'Elevated LTV (' + data.ltv.toFixed(1) + '%)',
        trigger: 'LTVRatioPercent = ' + data.ltv.toFixed(1) + '%',
        why: 'LTV exceeds 80%. Private mortgage insurance typically required for conventional loans.',
        docs: 'PMI application/commitment (if conventional).'
      });
    }
    if (data.isCashOut) {
      flags.push({
        level: 'loan', severity: 'moderate',
        title: 'Cash-Out Refinance',
        trigger: 'RefinanceCashOutDeterminationType indicates cash-out',
        why: 'Cash-out refinances require additional documentation of purpose and may have seasoning requirements.',
        docs: 'Letter of explanation for cash-out purpose, seasoning documentation.'
      });
    }

    // Debts being paid at closing
    const payoffLiabilities = data.liabilities.filter(function (l) { return l.toBePaidAtClosing; });
    if (payoffLiabilities.length > 0) {
      const payoffLabels = payoffLiabilities.map(function (l) {
        let lbl = l.type || 'Account';
        if (l.holderName) lbl += ' (' + l.holderName + ')';
        if (l.unpaidBalance) lbl += ' — $' + l.unpaidBalance.toLocaleString();
        return lbl;
      }).join('; ');
      flags.push({
        level: 'loan', severity: 'info',
        title: 'Debt(s) Being Paid at Closing (' + payoffLiabilities.length + ')',
        trigger: 'PayoffIncludedInClosingIndicator = true on ' + payoffLiabilities.length + ' liability(ies)',
        why: 'Verify payoff amounts are current and that these debts are excluded from DTI calculation.',
        docs: 'Current payoff letters with good-through dates: ' + payoffLabels + '.'
      });
    }

    // ── BORROWER-LEVEL FLAGS ──

    data.borrowers.forEach(function (borrower) {
      const tag = borrower.name;
      const sorted = borrower.employments.slice().sort(function (a, b) {
        return (a.startDate || new Date(0)) - (b.startDate || new Date(0));
      });

      // Employment gaps >30 days
      const borrowerGaps = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i];
        const next = sorted[i + 1];
        if (curr.endDate && next.startDate) {
          const gapDays = daysBetween(curr.endDate, next.startDate);
          if (gapDays !== null && gapDays > 30) {
            borrowerGaps.push({
              from: curr.employerName, to: next.employerName,
              days: gapDays, fromDate: curr.endDate, toDate: next.startDate
            });
          }
        }
      }
      if (sorted.length > 0) {
        const last = sorted[sorted.length - 1];
        if (!last.isCurrent && last.endDate) {
          const gapDays = daysBetween(last.endDate, new Date());
          if (gapDays !== null && gapDays > 30) {
            borrowerGaps.push({
              from: last.employerName, to: '(current date)',
              days: gapDays, fromDate: last.endDate, toDate: new Date()
            });
          }
        }
      }
      if (borrowerGaps.length > 0) {
        const gapDescs = borrowerGaps.map(function (g) {
          return g.days + ' days (' + fmtDate(g.fromDate) + ' – ' + fmtDate(g.toDate) + '): ' + g.from + ' → ' + g.to;
        }).join('; ');
        flags.push({
          level: 'borrower', borrower: tag, severity: 'high',
          title: 'Employment Gap(s) Detected',
          trigger: borrowerGaps.length + ' gap(s) >30 days in employment history',
          why: 'Employment gaps require explanation and may affect income qualification.',
          docs: 'Employment Gap Letter of Explanation for: ' + gapDescs + '.'
        });
      }

      // Short current tenure
      const currentEmps = borrower.employments.filter(function (e) { return e.isCurrent; });
      const shortTenure = currentEmps.filter(function (e) { return e.monthsEmployed < 6; });
      if (shortTenure.length > 0) {
        flags.push({
          level: 'borrower', borrower: tag, severity: 'moderate',
          title: 'Short Current Tenure (<6 months)',
          trigger: shortTenure.map(function (e) { return e.employerName + ': ' + e.monthsEmployed + ' mo'; }).join(', '),
          why: 'Recent job start requires additional verification of employment stability.',
          docs: 'Verbal VOE, offer letter, prior employer final paystub, additional 30 days paystubs.'
        });
      }

      // Self-employment
      const selfEmps = borrower.employments.filter(function (e) { return e.isSelfEmployed; });
      if (selfEmps.length > 0) {
        flags.push({
          level: 'borrower', borrower: tag, severity: 'moderate',
          title: 'Self-Employment Income',
          trigger: selfEmps.map(function (e) { return e.employerName; }).join(', ') + ' (SelfEmployedIndicator = true)',
          why: 'Self-employment income requires additional documentation to verify stability and continuity.',
          docs: 'YTD Profit & Loss statement, Balance Sheet, 2-year business tax returns, business bank statements (3 months)' +
                (data.isFHA ? ', FHA Business Verification Letter.' : '.')
        });
      }

      // Non-US citizen
      if (borrower.declarations.usCitizen === false) {
        let residencyStatus = 'Non-US citizen';
        if (borrower.declarations.permResident) residencyStatus = 'Permanent resident alien';
        else if (borrower.declarations.nonPermResident) residencyStatus = 'Non-permanent resident alien';
        flags.push({
          level: 'borrower', borrower: tag, severity: 'high',
          title: 'Non-US Citizen (' + residencyStatus + ')',
          trigger: 'USCitizenIndicator = false' +
                   (borrower.declarations.permResident ? ', PermanentResidentAlienIndicator = true' : '') +
                   (borrower.declarations.nonPermResident ? ', NonPermanentResidentAlienIndicator = true' : ''),
          why: 'Immigration status documentation required. Residency type determines which documents are needed.',
          docs: borrower.declarations.permResident
            ? 'I-551 (Green Card) — front & back.'
            : 'Valid EAD card (I-766), I-94 Arrival/Departure Record, valid passport, visa documentation.'
        });
      }

      // Bankruptcy
      if (borrower.declarations.bankruptcy) {
        flags.push({
          level: 'borrower', borrower: tag, severity: 'high',
          title: 'Bankruptcy History',
          trigger: 'BankruptcyIndicator = true',
          why: 'Bankruptcy requires discharge documentation and seasoning verification per program guidelines.',
          docs: 'Bankruptcy petition, schedules, discharge order, LOE, seasoning verification (2-4 years depending on program/chapter).'
        });
      }

      // Foreclosure
      if (borrower.declarations.foreclosure) {
        flags.push({
          level: 'borrower', borrower: tag, severity: 'high',
          title: 'Foreclosure / Short Sale History',
          trigger: 'PropertyForeclosureIndicator = true',
          why: 'Prior foreclosure or short sale requires seasoning and documentation per program guidelines.',
          docs: 'Foreclosure/short sale documentation, LOE, seasoning verification (3-7 years depending on program).'
        });
      }

      // Outstanding judgments
      if (borrower.declarations.judgments) {
        flags.push({
          level: 'borrower', borrower: tag, severity: 'high',
          title: 'Outstanding Judgments',
          trigger: 'OutstandingJudgmentsIndicator = true',
          why: 'Outstanding judgments must be paid or satisfactorily arranged before closing.',
          docs: 'Payoff or payment arrangement documentation, satisfaction of judgment if paid.'
        });
      }

      // Alimony obligation
      if (borrower.declarations.alimonyObligation) {
        flags.push({
          level: 'borrower', borrower: tag, severity: 'info',
          title: 'Alimony/Child Support Obligation',
          trigger: 'AlimonyChildSupportObligationIndicator = true',
          why: 'Alimony or child support payments are included in DTI calculation.',
          docs: 'Divorce decree showing obligation amount, evidence of payment history.'
        });
      }

      // Missing employment data
      const missingData = borrower.employments.filter(function (e) {
        return !e.startDate || e.employerName === 'Employer' || !e.employerName;
      });
      if (missingData.length > 0) {
        flags.push({
          level: 'borrower', borrower: tag, severity: 'moderate',
          title: 'Missing Employment Data',
          trigger: missingData.length + ' employment record(s) with incomplete data (missing dates or employer name)',
          why: 'Incomplete employment data prevents full continuity analysis. Verification needed.',
          docs: 'Written VOE from employer(s), employment verification with dates and position.'
        });
      }
    });

    // ── RENDER ──

    if (flags.length === 0) {
      container.innerHTML = '<h3>Underwriter Attention Flags <span class="mismo-info-label">Informational</span></h3>' +
                            '<p style="color:var(--text-muted,#999);font-style:italic;font-size:0.85rem">No attention flags detected.</p>';
      container.style.display = '';
      return;
    }

    let html = '<h3>Underwriter Attention Flags <span class="mismo-info-label">Informational</span></h3>';

    // Loan-level
    const loanFlags = flags.filter(function (f) { return f.level === 'loan'; });
    if (loanFlags.length > 0) {
      html += '<div class="mismo-flag-group-title">Loan-Level Flags (' + loanFlags.length + ')</div>';
      loanFlags.forEach(function (f) {
        html += renderFlagCard(f);
      });
    }

    // Borrower-level
    const borrowerNames = [];
    flags.forEach(function (f) {
      if (f.level === 'borrower' && f.borrower && borrowerNames.indexOf(f.borrower) === -1) {
        borrowerNames.push(f.borrower);
      }
    });
    borrowerNames.forEach(function (name) {
      const bFlags = flags.filter(function (f) { return f.level === 'borrower' && f.borrower === name; });
      if (bFlags.length > 0) {
        html += '<div class="mismo-flag-group-title">' + esc(name) + ' — Borrower-Level Flags (' + bFlags.length + ')</div>';
        bFlags.forEach(function (f) {
          html += renderFlagCard(f);
        });
      }
    });

    container.innerHTML = html;
    container.style.display = '';
  }

  function renderFlagCard(flag) {
    let html = '<div class="mismo-flag-card mismo-flag-card--' + flag.severity + '">';
    html += '<span class="mismo-flag-severity mismo-flag-severity--' + flag.severity + '">' + flag.severity.toUpperCase() + '</span>';
    html += '<div class="mismo-flag-body">';
    html += '<div class="mismo-flag-title">' + esc(flag.title) + '</div>';
    html += '<div class="mismo-flag-trigger">Trigger: ' + esc(flag.trigger) + '</div>';
    html += '<div class="mismo-flag-why">' + esc(flag.why) + '</div>';
    html += '<div class="mismo-flag-docs">\u2192 ' + esc(flag.docs) + '</div>';
    html += '</div></div>';
    return html;
  }

  /* ── Expose public API ── */

  window.MSFG = window.MSFG || {};
  window.MSFG.MISMOUI = {
    renderEmploymentTimeline: renderEmploymentTimeline,
    renderIncomeRiskScore: renderIncomeRiskScore,
    renderAttentionFlags: renderAttentionFlags
  };

})();
