'use strict';
/**
 * MISMO Document Analyzer — Enhanced
 * Parses MISMO 3.4 XML and generates borrower-specific, time-specific,
 * employer/property-specific editable document checklists.
 *
 * Features:
 * - Employer-specific W-2/paystub requests
 * - FHA/VA/USDA/conventional program-aware documentation
 * - Property type & occupancy-specific requirements
 * - Employment gap detection
 * - REO property-specific mortgage/insurance statements
 * - Portfolio complexity awareness
 * - LTV-based requirements (PMI, appraisal)
 *
 * Dependencies: MSFG.MISMODocParser, MSFG.MISMOIncomeLogic (loaded as preScripts)
 */
(function () {

  /* ---- State ---- */
  let parsedData = null;
  let checklistState = { income: [], general: [], assets: [], credit: [] };
  let itemCounter = 0;

  const SECTION_MAP = {
    income:  'incomeChecklist',
    general: 'generalChecklist',
    assets:  'assetChecklist',
    credit:  'creditChecklist'
  };

  /* ---- Helpers ---- */
  function el(id) { return document.getElementById(id); }

  function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(num);
  }

  function setChip(id, label, state) {
    const chip = el(id);
    if (!chip) return;
    chip.className = 'mismo-chip';
    chip.textContent = label;
    if (state) chip.classList.add('mismo-chip--' + state);
  }

  function setKV(id, value) {
    const node = el(id);
    if (node) node.textContent = value || '\u2014';
  }

  /* ======================================================
     File Upload
     ====================================================== */

  function initUpload() {
    const dropzone = el('mismoDropzone');
    const fileInput = el('mismoFileInput');
    const chooseBtn = el('mismoChooseFile');

    chooseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      fileInput.click();
    });
    dropzone.addEventListener('click', function () { fileInput.click(); });

    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function () {
      if (this.files.length > 0) handleFile(this.files[0]);
      this.value = '';
    });
  }

  function handleFile(file) {
    if (!file.name.match(/\.(xml|mismo)$/i)) {
      alert('Please upload a valid MISMO XML file (.xml)');
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(e.target.result, 'text/xml');
        if (xmlDoc.querySelector('parsererror')) {
          alert('Error parsing XML file. Please ensure it is a valid MISMO 3.4 file.');
          return;
        }
        processXML(xmlDoc);
      } catch (err) {
        console.error('Error processing XML:', err);
        alert('Error processing XML file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  /* ======================================================
     Core Processing
     ====================================================== */

  function processXML(xmlDoc) {
    parsedData = MSFG.MISMODocParser.parseMISMO(xmlDoc);

    // Income docs per borrower — now pass loan-level data
    let incomeDocs = [];
    parsedData.borrowers.forEach(function (b) {
      const docs = MSFG.MISMOIncomeLogic.determineIncomeDocumentation(b, parsedData);
      incomeDocs = incomeDocs.concat(docs);
    });

    // Other docs (general, assets, credit) — enhanced with program awareness
    const otherDocs = generateOtherDocumentation(parsedData);

    // Build state
    checklistState.income  = incomeDocs.map(docToItem);
    checklistState.general = otherDocs.general.map(docToItem);
    checklistState.assets  = otherDocs.assets.map(docToItem);
    checklistState.credit  = otherDocs.credit.map(docToItem);

    // Render
    updateLoanSummary(parsedData);
    updateStatusChips(parsedData);
    renderAllChecklists();

    // Informational sections (not printed/reported)
    renderEmploymentTimeline(parsedData);
    renderIncomeRiskScore(parsedData);
    renderAttentionFlags(parsedData);

    el('mismoResults').style.display = '';
    el('mismoEmpty').style.display = 'none';
    el('mismoActionBar').style.display = '';
  }

  function docToItem(doc) {
    itemCounter++;
    return { id: itemCounter, name: doc.name, status: doc.status, reason: doc.reason };
  }

  /* ======================================================
     Loan Summary + Status Chips
     ====================================================== */

  function updateLoanSummary(data) {
    const names = data.borrowers.map(function (b) { return b.name; }).join(', ');
    setKV('kvBorrower', names);
    setKV('kvPurpose', data.loanPurpose);
    setKV('kvType', data.mortgageType);
    setKV('kvAmount', data.baseLoanAmount ? formatCurrency(data.baseLoanAmount) : null);

    // Enhanced fields
    setKV('kvPropertyType', data.propertyType);
    setKV('kvOccupancy', formatOccupancy(data.occupancyType));
    setKV('kvLTV', data.ltv ? data.ltv.toFixed(1) + '%' : null);

    const propAddr = data.subjectProperty;
    if (propAddr && propAddr.address) {
      const parts = [propAddr.address];
      if (propAddr.city || propAddr.state) {
        parts.push((propAddr.city && propAddr.state) ? propAddr.city + ', ' + propAddr.state : (propAddr.city || propAddr.state));
      }
      setKV('kvProperty', parts.join(' '));
    } else {
      setKV('kvProperty', null);
    }

    // Complexity flags
    const flagsEl = el('mismoComplexity');
    if (flagsEl) {
      if (data.complexityFlags.length > 0) {
        flagsEl.innerHTML = data.complexityFlags.map(function (f) {
          return '<span class="mismo-complexity-flag">' + MSFG.escHtml(f) + '</span>';
        }).join('');
        flagsEl.style.display = '';
      } else {
        flagsEl.style.display = 'none';
      }
    }
  }

  function formatOccupancy(type) {
    if (!type) return null;
    const map = {
      'PrimaryResidence': 'Primary Residence',
      'SecondHome': 'Second Home',
      'Investment': 'Investment Property',
      'Investor': 'Investment Property'
    };
    return map[type] || type;
  }

  function updateStatusChips(data) {
    // Employment coverage
    const empCoverages = data.borrowers.map(function (b) {
      return MSFG.MISMODocParser.calculateEmploymentCoverage(b);
    });
    const worstEmp = empCoverages.reduce(function (w, c) {
      return c.monthsNeeded > w.monthsNeeded ? c : w;
    }, { monthsNeeded: 0, totalMonths: 0 });

    if (worstEmp.monthsNeeded > 0) {
      setChip('chipEmp', 'Employment: need +' + worstEmp.monthsNeeded + ' mo', 'need');
    } else {
      setChip('chipEmp', 'Employment: 24 mo \u2713', 'ok');
    }

    // Residence coverage
    const resCoverages = data.borrowers.map(function (b) {
      return MSFG.MISMODocParser.calculateResidenceCoverage(b);
    });
    const worstRes = resCoverages.reduce(function (w, c) {
      return c.monthsNeeded > w.monthsNeeded ? c : w;
    }, { monthsNeeded: 0, totalMonths: 0 });

    if (worstRes.monthsNeeded > 0) {
      setChip('chipRes', 'Residence: need +' + worstRes.monthsNeeded + ' mo', 'need');
    } else {
      setChip('chipRes', 'Residence: 24 mo \u2713', 'ok');
    }

    // REO
    const reoCount = data.reoProperties.length;
    setChip('chipREO', reoCount > 0 ? 'REO: ' + reoCount + ' properties' : 'REO: none', reoCount > 0 ? 'warn' : 'ok');

    // Declarations
    const anyFlags = data.borrowers.some(function (b) {
      return b.declarations.bankruptcy || b.declarations.foreclosure ||
             b.declarations.judgments || b.declarations.usCitizen === false;
    });
    setChip('chipDec', anyFlags ? 'Declarations: flags present' : 'Declarations: clear', anyFlags ? 'warn' : 'ok');

    // Loan program chip
    let programLabel = 'Conventional';
    let programState = 'ok';
    if (data.isFHA) { programLabel = 'FHA'; programState = 'warn'; }
    else if (data.isVA) { programLabel = 'VA'; programState = 'warn'; }
    else if (data.isUSDA) { programLabel = 'USDA'; programState = 'warn'; }
    setChip('chipProgram', 'Program: ' + programLabel, programState);

    // Employment gaps chip
    let totalGaps = 0;
    data.borrowers.forEach(function (b) {
      if (MSFG.MISMODocParser.detectEmploymentGaps) {
        totalGaps += MSFG.MISMODocParser.detectEmploymentGaps(b).length;
      }
    });
    if (totalGaps > 0) {
      setChip('chipGaps', 'Emp Gaps: ' + totalGaps, 'need');
    } else {
      setChip('chipGaps', 'Emp Gaps: none', 'ok');
    }
  }

  /* ======================================================
     Generate Other Documentation (general, assets, credit)
     ====================================================== */

  function generateOtherDocumentation(data) {
    const general = [];
    const assets = [];
    const credit = [];
    const isPurchase = (data.loanPurpose || '').toLowerCase() === 'purchase';
    const isRefi = data.isRefinance;

    // ──────────── GENERAL ────────────

    // Universal requirements
    general.push({
      name: 'IRS Form 4506-C (transcript authorization)',
      status: 'required',
      reason: 'Standard for all loans — allows lender to obtain tax transcripts.'
    });

    // Purchase-specific
    if (isPurchase) {
      general.push({ name: 'Executed purchase contract (all pages with addenda)', status: 'required',
        reason: 'Loan purpose is Purchase.' });
      general.push({ name: 'Earnest money proof (canceled check / bank statement showing withdrawal)', status: 'required',
        reason: 'Shows source of earnest money deposit.' });
    }

    // Refinance-specific
    if (isRefi) {
      general.push({ name: 'Current mortgage statement (subject property)', status: 'required',
        reason: 'Refinance — verify current loan balance and payment status.' });
      general.push({ name: 'Copy of current Note', status: 'required',
        reason: 'Refinance — verify terms of existing mortgage.' });
      if (data.isCashOut) {
        general.push({ name: 'Letter of explanation — purpose of cash-out proceeds', status: 'required',
          reason: 'Cash-out refinance requires documentation of intended use of proceeds.' });
      }
    }

    // Per-borrower documentation
    data.borrowers.forEach(function (b) {
      const tag = '[' + b.name + ']';

      general.push({ name: tag + ' Government-issued photo ID (unexpired)', status: 'required',
        reason: 'Required per borrower for identity verification.' });

      // Citizenship / residency status
      if (b.declarations.usCitizen === false) {
        if (b.declarations.permResident) {
          general.push({ name: tag + ' I-551 (Green Card) — front & back', status: 'required',
            reason: 'Non-US citizen (permanent resident alien).' });
        } else if (b.declarations.nonPermResident) {
          general.push({ name: tag + ' Valid EAD card (I-766) or visa with work authorization', status: 'required',
            reason: 'Non-permanent resident alien — work authorization required.' });
          general.push({ name: tag + ' I-94 (Arrival/Departure Record)', status: 'required',
            reason: 'Non-permanent resident alien — verify legal entry and status.' });
          general.push({ name: tag + ' Valid passport', status: 'required',
            reason: 'Non-permanent resident alien — country of citizenship verification.' });
        }
      }

      // Alimony/child support obligation (paying out, not receiving)
      if (b.declarations.alimonyObligation) {
        general.push({ name: tag + ' Divorce decree showing alimony/support obligation', status: 'required',
          reason: 'Borrower has alimony or child support obligation per declarations.' });
      }

      // Credit-specific per-borrower
      if (b.declarations.bankruptcy) {
        credit.push({ name: tag + ' Bankruptcy documents (petition, schedules, discharge order)', status: 'required',
          reason: 'Bankruptcy indicated on declarations.' });
        credit.push({ name: tag + ' Letter of explanation — bankruptcy circumstances', status: 'required',
          reason: 'LOE required for derogatory credit event.' });
      }
      if (b.declarations.foreclosure) {
        credit.push({ name: tag + ' Foreclosure / short sale documentation + LOE', status: 'required',
          reason: 'History of foreclosure or short sale per declarations.' });
      }
      if (b.declarations.judgments) {
        credit.push({ name: tag + ' Payoff or release for outstanding judgments', status: 'required',
          reason: 'Outstanding judgments must be paid or satisfactorily arranged.' });
      }
    });

    // ──────────── PROGRAM-SPECIFIC ────────────

    if (data.isFHA) {
      generateFHADocs(data, general, credit);
    } else if (data.isVA) {
      generateVADocs(data, general, credit);
    } else if (data.isUSDA) {
      generateUSDADocs(data, general);
    }

    // Conventional high-LTV (PMI)
    if (data.isConventional && data.ltv && data.ltv > 80) {
      general.push({ name: 'Private Mortgage Insurance (PMI) application / commitment', status: 'conditional',
        reason: 'LTV is ' + data.ltv.toFixed(1) + '% (>80%). PMI typically required.' });
    }

    // ──────────── PROPERTY-SPECIFIC ────────────

    generatePropertyDocs(data, general);

    // ──────────── ASSETS ────────────

    if (data.assets.length > 0) {
      data.assets.forEach(function (asset) {
        const label = asset.holderName || asset.accountIdentifier || 'Account';
        const assetType = (asset.type || 'Asset').replace(/([A-Z])/g, ' $1').trim();
        assets.push({
          name: 'Account statements (2 months, all pages) — ' + assetType + ' at ' + label,
          status: 'required',
          reason: 'Verify funds to close & reserves. Include all pages even if blank.'
        });
      });
    } else if (isPurchase) {
      assets.push({ name: 'Proof of funds for down payment & closing costs', status: 'required',
        reason: 'No assets listed in MISMO file. Bank/investment statements needed.' });
    }

    // Gift funds
    const giftAssets = data.assets.filter(function (a) { return (a.type || '').match(/gift/i); });
    if (giftAssets.length > 0) {
      giftAssets.forEach(function (asset) {
        const giftLabel = (asset.type || 'Gift').replace(/([A-Z])/g, ' $1').trim();
        assets.push({ name: 'Gift letter — ' + giftLabel, status: 'required',
          reason: 'Gift funds require donor letter confirming no repayment obligation.' });
        assets.push({ name: 'Gift source documentation (donor bank statement showing transfer)', status: 'required',
          reason: 'Verify donor\'s ability to provide ' + giftLabel.toLowerCase() + '.' });
        assets.push({ name: 'Borrower bank statement showing gift deposit', status: 'required',
          reason: 'Verify receipt of gift funds into borrower\'s account.' });
      });
    }

    // Large deposit LOE
    assets.push({ name: 'Large deposit letter of explanation (LOE)', status: 'conditional',
      reason: 'Required if bank statements show deposits exceeding 50% of qualifying monthly income.' });

    // ──────────── REO PROPERTIES ────────────

    data.reoProperties.forEach(function (prop, idx) {
      const label = prop.address || ('REO Property #' + (idx + 1));
      credit.push({
        name: 'Current mortgage/HELOC statement — ' + label,
        status: 'required',
        reason: 'REO property: verify loan balance, payment, and status for ' + label + '.'
      });
      credit.push({
        name: 'Hazard insurance declaration page — ' + label,
        status: 'required',
        reason: 'Verify current insurance coverage for ' + label + '.'
      });
      if (prop.isInvestment || (prop.usage || '').match(/invest|rental/i)) {
        credit.push({
          name: 'Current lease agreement — ' + label,
          status: 'required',
          reason: 'Investment/rental property requires lease to verify rental income for ' + label + '.'
        });
      }
      // Tax return with Schedule E for rental properties
      if (prop.isInvestment && idx === 0) {
        credit.push({
          name: 'Personal tax returns with Schedule E (all REO rental properties)',
          status: 'required',
          reason: data.reoProperties.length + ' REO properties — Schedule E needed to verify net rental income.'
        });
      }
    });

    // ──────────── HOMEOWNER'S INSURANCE ────────────

    general.push({ name: 'Homeowner\'s insurance declaration page (subject property)', status: 'required',
      reason: 'Required for all mortgage transactions — evidence of coverage.' });

    // Flood insurance
    general.push({ name: 'Flood insurance declaration page (if in flood zone)', status: 'conditional',
      reason: 'Required if subject property is in a FEMA-designated flood zone.' });

    // ──────────── HOA ────────────

    if (data.hasHOA) {
      general.push({ name: 'HOA contact information / management company details', status: 'required',
        reason: 'Condo or PUD — HOA identified. Lender will order HOA certification.' });
      general.push({ name: 'HOA budget, financial statements, and meeting minutes', status: 'conditional',
        reason: 'May be required for condo project approval / review.' });
      general.push({ name: 'Condo/PUD master insurance policy', status: 'conditional',
        reason: 'Required for condo/PUD projects — verify HOA master policy coverage.' });
    }

    // ──────────── PAYOFF LETTERS ────────────

    data.liabilities.forEach(function (liability) {
      if (liability.toBePaidAtClosing) {
        let label = liability.type || 'Account';
        if (liability.holderName) label += ' (' + liability.holderName + ')';
        else if (liability.accountIdentifier) label += ' (' + liability.accountIdentifier + ')';
        const reasonParts = ['Liability to be paid off at closing. Need current payoff amount and good-through date.'];
        if (liability.unpaidBalance) {
          reasonParts.push('Balance: ' + formatCurrency(liability.unpaidBalance) + '.');
        }
        if (liability.monthlyPaymentAmount) {
          reasonParts.push('Monthly payment: ' + formatCurrency(liability.monthlyPaymentAmount) + '.');
        }
        credit.push({ name: 'Payoff letter — ' + label, status: 'required',
          reason: reasonParts.join(' ') });
      }
    });

    // Credit inquiry LOE
    credit.push({ name: 'Credit inquiry letter of explanation (LOE)', status: 'conditional',
      reason: 'Required if recent hard inquiries appear on credit report within 120 days.' });

    // Rental verification for current renters
    const hasRenter = data.borrowers.some(function (b) {
      return b.residences.some(function (r) {
        return (r.residencyType || '').match(/rent/i) || (r.residencyBasis || '').match(/rent/i);
      });
    });
    if (hasRenter) {
      general.push({ name: 'Rental verification (VOR) or 12 months canceled checks/bank statements', status: 'conditional',
        reason: 'Borrower currently rents — may be required to verify housing payment history.' });
    }

    return { general: general, assets: assets, credit: credit };
  }

  /* ---- FHA-Specific Documentation ---- */
  function generateFHADocs(data, general, credit) {
    general.push({
      name: 'FHA Case Number Assignment',
      status: 'required',
      reason: 'FHA loan requires case number prior to appraisal order.'
    });
    general.push({
      name: 'FHA Amendatory Clause (purchase only)',
      status: data.loanPurpose && data.loanPurpose.toLowerCase() === 'purchase' ? 'required' : 'conditional',
      reason: 'FHA requires signed Amendatory Clause on all purchase transactions.'
    });
    general.push({
      name: 'FHA Real Estate Certification (purchase only)',
      status: data.loanPurpose && data.loanPurpose.toLowerCase() === 'purchase' ? 'required' : 'conditional',
      reason: 'Identity of Interest certification required on FHA purchases.'
    });

    // FHA anti-flipping
    if (data.loanPurpose && data.loanPurpose.toLowerCase() === 'purchase') {
      general.push({
        name: 'Seller\'s acquisition history / prior deed (FHA anti-flipping)',
        status: 'conditional',
        reason: 'FHA: if seller owned property <90 days, transaction is ineligible. 91-180 days requires second appraisal if price increase >100%.'
      });
    }

    // FHA refinance specifics
    if (data.isRefinance) {
      general.push({
        name: 'FHA Streamline documentation (if applicable)',
        status: 'conditional',
        reason: 'FHA Streamline refinance requires net tangible benefit calculation and existing FHA case number.'
      });
    }

    // FHA CAIVRS check
    general.push({
      name: 'CAIVRS authorization (per borrower)',
      status: 'required',
      reason: 'FHA requires CAIVRS (Credit Alert Verification Reporting System) clearance for all borrowers.'
    });

    // FHA collection accounts
    credit.push({
      name: 'Collection account documentation / payment arrangement',
      status: 'conditional',
      reason: 'FHA: medical collections >$2,000 require payment plan. Non-medical collections >$2,000 require payoff or payment plan with 3 months of payments.'
    });
  }

  /* ---- VA-Specific Documentation ---- */
  function generateVADocs(data, general, _credit) {
    general.push({
      name: 'Certificate of Eligibility (COE)',
      status: 'required',
      reason: 'VA loan requires valid Certificate of Eligibility to establish entitlement.'
    });

    // DD-214 for veterans (not active duty)
    const hasActiveDuty = data.borrowers.some(function (b) {
      return b.employments.some(function (emp) {
        return (emp.classificationType || '').match(/active\s*duty/i) ||
               (emp.employerName || '').match(/military|army|navy|air\s*force|marine|coast\s*guard/i);
      });
    });

    if (!hasActiveDuty) {
      general.push({
        name: 'DD-214 (Member 4 copy) for veteran borrower(s)',
        status: 'required',
        reason: 'VA loan — DD-214 required for discharged veterans to verify service dates and character of discharge.'
      });
    } else {
      general.push({
        name: 'Statement of Service (active duty borrower)',
        status: 'required',
        reason: 'VA loan — active duty service member requires current Statement of Service.'
      });
    }

    general.push({
      name: 'VA Funding Fee payment or exemption documentation',
      status: 'required',
      reason: 'VA funding fee is required unless exempt (10%+ disability, surviving spouse, Purple Heart).'
    });

    // VA termite inspection
    general.push({
      name: 'Termite/pest inspection report (state-dependent)',
      status: 'conditional',
      reason: 'VA requires Wood Destroying Insect (WDI) report in most states.'
    });
  }

  /* ---- USDA-Specific Documentation ---- */
  function generateUSDADocs(data, general) {
    general.push({
      name: 'USDA Property Eligibility verification',
      status: 'required',
      reason: 'USDA loan — property must be in eligible rural area.'
    });
    general.push({
      name: 'USDA Income Eligibility verification (household income)',
      status: 'required',
      reason: 'USDA loan — total household income cannot exceed 115% of area median income.'
    });
    general.push({
      name: 'USDA Guarantee Fee documentation',
      status: 'required',
      reason: 'USDA loans require upfront and annual guarantee fees.'
    });
    general.push({
      name: 'Income documentation for all household members (even non-borrowers)',
      status: 'required',
      reason: 'USDA counts all household income for eligibility, not just borrowers.'
    });
  }

  /* ---- Property-Specific Documentation ---- */
  function generatePropertyDocs(data, general) {
    const pt = (data.propertyType || '').toLowerCase();
    const occ = (data.occupancyType || '').toLowerCase();

    // Condo
    if (pt.match(/condo/i)) {
      general.push({
        name: 'Condo project questionnaire (full or limited review)',
        status: 'required',
        reason: 'Condominium property requires project eligibility review.'
      });
      if (data.isFHA) {
        general.push({
          name: 'FHA Condo Project Approval verification (HUD DELRAP/HRAP)',
          status: 'required',
          reason: 'FHA condo loans require approved or spot-approved project.'
        });
      }
    }

    // Manufactured / Mobile Home
    if (pt.match(/manufactured|mobile|modular/i)) {
      general.push({
        name: 'HUD Data Plate / Certification Label numbers',
        status: 'required',
        reason: 'Manufactured home requires HUD certification labels for eligibility.'
      });
      general.push({
        name: 'Foundation certification (engineer\'s report)',
        status: 'required',
        reason: 'Manufactured home requires permanent foundation certification.'
      });
      general.push({
        name: 'Proof of real property classification (not personal property)',
        status: 'required',
        reason: 'Manufactured home must be classified as real property, not chattel.'
      });
    }

    // Multi-unit (2-4 units)
    if (data.numberOfUnits && data.numberOfUnits > 1) {
      general.push({
        name: 'Current lease agreements for all rental units',
        status: 'required',
        reason: data.numberOfUnits + '-unit property — verify current rental income for non-owner-occupied units.'
      });
      if (data.numberOfUnits >= 3) {
        general.push({
          name: 'Operating income statement for multi-unit property',
          status: 'conditional',
          reason: data.numberOfUnits + '-unit property — income/expense history may be required.'
        });
      }
    }

    // Investment property
    if (occ.match(/invest/i)) {
      general.push({
        name: 'Signed lease agreement(s) for subject property',
        status: 'required',
        reason: 'Investment property — lease required to support rental income.'
      });
      general.push({
        name: 'Personal tax returns with Schedule E for subject property',
        status: 'required',
        reason: 'Investment property — Schedule E needed if property was previously owned.'
      });
      // Higher reserve requirements
      general.push({
        name: 'Proof of 6 months PITIA reserves for subject property',
        status: 'required',
        reason: 'Investment property typically requires 6 months reserves.'
      });
    }

    // Second home
    if (occ.match(/second\s*home/i)) {
      general.push({
        name: 'Second home occupancy affidavit',
        status: 'conditional',
        reason: 'Second home — borrower must certify property will be occupied part-time and not rented.'
      });
    }

    // Solar panels / PACE
    general.push({
      name: 'Solar panel lease/loan payoff or subordination (if applicable)',
      status: 'conditional',
      reason: 'Required if property has solar panels with PACE lien, lease, or PPA.'
    });
  }

  /* ======================================================
     Editable Checklist Rendering
     ====================================================== */

  function renderAllChecklists() {
    Object.keys(SECTION_MAP).forEach(function (key) {
      renderChecklist(SECTION_MAP[key], key);
    });
    updateSectionCounts();
  }

  function renderChecklist(containerId, sectionKey) {
    const container = el(containerId);
    const items = checklistState[sectionKey];

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="mismo-empty-section">No documents required in this category</div>';
      return;
    }

    container.innerHTML = '';
    items.forEach(function (item) {
      container.appendChild(createItemRow(item, sectionKey));
    });
  }

  function updateSectionCounts() {
    Object.keys(SECTION_MAP).forEach(function (key) {
      const countEl = el(SECTION_MAP[key] + 'Count');
      if (!countEl) return;
      const items = checklistState[key];
      const required = items.filter(function (i) { return i.status === 'required'; }).length;
      const conditional = items.filter(function (i) { return i.status === 'conditional'; }).length;
      const parts = [];
      if (required > 0) parts.push(required + ' required');
      if (conditional > 0) parts.push(conditional + ' conditional');
      countEl.textContent = parts.length > 0 ? '(' + parts.join(', ') + ')' : '';
    });
  }

  function createItemRow(item, sectionKey) {
    const row = document.createElement('div');
    row.className = 'mismo-doc-item mismo-doc-item--' + item.status;
    row.dataset.itemId = String(item.id);

    // Status select
    const statusSelect = document.createElement('select');
    statusSelect.className = 'mismo-doc-item__status';
    ['required', 'conditional', 'ok'].forEach(function (s) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
      if (s === item.status) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusSelect.addEventListener('change', function () {
      item.status = this.value;
      row.className = 'mismo-doc-item mismo-doc-item--' + item.status;
      updateSectionCounts();
    });

    // Name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'mismo-doc-item__name';
    nameInput.value = item.name;
    nameInput.addEventListener('input', function () { item.name = this.value; });

    // Reason input
    const reasonInput = document.createElement('input');
    reasonInput.type = 'text';
    reasonInput.className = 'mismo-doc-item__reason';
    reasonInput.value = item.reason;
    reasonInput.addEventListener('input', function () { item.reason = this.value; });

    // Delete button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'mismo-doc-item__remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', function () {
      checklistState[sectionKey] = checklistState[sectionKey].filter(function (i) {
        return i.id !== item.id;
      });
      row.remove();
      updateSectionCounts();
      // Show empty message if section is now empty
      const container = el(SECTION_MAP[sectionKey]);
      if (checklistState[sectionKey].length === 0) {
        container.innerHTML = '<div class="mismo-empty-section">No documents required in this category</div>';
      }
    });

    row.appendChild(statusSelect);
    row.appendChild(nameInput);
    row.appendChild(reasonInput);
    row.appendChild(removeBtn);
    return row;
  }

  /* ======================================================
     Add Item
     ====================================================== */

  function addItem(sectionKey) {
    itemCounter++;
    const newItem = { id: itemCounter, name: '', status: 'required', reason: '' };
    checklistState[sectionKey].push(newItem);

    const container = el(SECTION_MAP[sectionKey]);

    // Remove "no documents" message
    const emptyMsg = container.querySelector('.mismo-empty-section');
    if (emptyMsg) emptyMsg.remove();

    const row = createItemRow(newItem, sectionKey);
    container.appendChild(row);
    updateSectionCounts();

    // Focus the name input
    const nameInput = row.querySelector('.mismo-doc-item__name');
    if (nameInput) nameInput.focus();
  }

  /* ======================================================
     Clear All
     ====================================================== */

  function clearAll() {
    parsedData = null;
    checklistState = { income: [], general: [], assets: [], credit: [] };
    itemCounter = 0;

    // Reset summary
    ['kvBorrower', 'kvPurpose', 'kvType', 'kvAmount', 'kvPropertyType', 'kvOccupancy', 'kvLTV', 'kvProperty'].forEach(function (id) {
      setKV(id, null);
    });

    // Reset chips
    ['chipEmp', 'chipRes', 'chipREO', 'chipDec', 'chipProgram', 'chipGaps'].forEach(function (id) {
      const chip = el(id);
      if (!chip) return;
      chip.className = 'mismo-chip';
    });
    setKV('chipEmp', 'Employment: Pending');
    setKV('chipRes', 'Residence: Pending');
    setKV('chipREO', 'REO: Pending');
    setKV('chipDec', 'Declarations: Pending');
    setKV('chipProgram', 'Program: Pending');
    setKV('chipGaps', 'Emp Gaps: Pending');

    // Hide complexity
    const flagsEl = el('mismoComplexity');
    if (flagsEl) flagsEl.style.display = 'none';

    // Clear checklists
    Object.keys(SECTION_MAP).forEach(function (key) {
      el(SECTION_MAP[key]).innerHTML = '';
      const countEl = el(SECTION_MAP[key] + 'Count');
      if (countEl) countEl.textContent = '';
    });

    // Clear informational sections
    ['mismoEmploymentTimeline', 'mismoRiskScore', 'mismoAttentionFlags'].forEach(function (id) {
      const section = el(id);
      if (section) { section.innerHTML = ''; section.style.display = 'none'; }
    });

    el('mismoResults').style.display = 'none';
    el('mismoEmpty').style.display = '';
    el('mismoActionBar').style.display = 'none';
  }

  /* ======================================================
     Informational Sections (not printed / not in reports)
     ====================================================== */

  const esc = MSFG.escHtml;

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

  /* ======================================================
     Workspace MISMO Auto-Populate Hook
     ====================================================== */

  window.__mismoProcessXmlString = function (xmlString) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      if (xmlDoc.querySelector('parsererror')) return;
      processXML(xmlDoc);
    } catch (e) {
      console.warn('MISMO auto-populate failed:', e);
    }
  };

  /* ======================================================
     Init
     ====================================================== */

  document.addEventListener('DOMContentLoaded', function () {
    initUpload();

    // Add-item buttons
    document.querySelectorAll('.mismo-add-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        addItem(this.dataset.section);
      });
    });

    // Action buttons
    el('mismoPrintBtn').addEventListener('click', function () { window.print(); });
    el('mismoClearBtn').addEventListener('click', clearAll);

    // Auto-populate from workspace sessionStorage
    const storedXml = sessionStorage.getItem('msfg-mismo-xml');
    if (storedXml) {
      window.__mismoProcessXmlString(storedXml);
    }
  });

})();
