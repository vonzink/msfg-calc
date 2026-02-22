/* =====================================================
   MSFG Calculator Hub — Application Logic
   Multi-calculator stacking, favorites, dropdown
   ===================================================== */

(function () {
  'use strict';

  /* =====================================================
     CALCULATOR REGISTRY
     ===================================================== */
  var CALCS = {
    amort:        { name: 'Amortization Calculator',      icon: '\u{1F4C8}', cat: 'General',    href: 'amort-calc/index.html',                           desc: 'Generate interactive amortization schedules with visual charts, detailed payment breakdowns, and side-by-side loan comparisons. See exactly how principal and interest shift over the life of a loan, and model the impact of extra payments or different terms.',                              features: ['Visual amortization charts with principal vs. interest breakdown','Side-by-side comparison of up to three loan scenarios','Extra payment modeling with payoff acceleration analysis','Exportable payment schedules for client presentations'] },
    apr:          { name: 'APR Calculator',                icon: '\u{1F4AF}', cat: 'General',    href: 'apr-calc/APRCalculator.html',                      desc: 'Calculate the Annual Percentage Rate (APR) for a mortgage including all applicable fees and charges. Provides a true cost-of-borrowing figure that accounts for origination fees, discount points, and third-party charges per Regulation Z methodology.',                                      features: ['Reg Z-compliant APR calculation methodology','Itemized fee input for origination, points, and third-party costs','Comparison of nominal rate vs. effective APR','Finance charge breakdown and total cost of loan'] },
    blended:      { name: 'Blended Rate Calculator',       icon: '\u{1F4CA}', cat: 'General',    href: 'gen-calc/blended_rate_calculator.html',             desc: 'Calculate weighted average interest rates across multiple loans or mixed-rate structures. Ideal for analyzing blended rates on first and second mortgages, or combining fixed and adjustable segments into one effective rate.',                                                               features: ['Weighted average rate across unlimited loan tranches','Support for mixed fixed and adjustable rate structures','Real-time blended rate recalculation as inputs change','Clear visual breakdown of rate contribution per loan'] },
    buydown:      { name: 'Buydown Calculator',            icon: '\u{1F4B2}', cat: 'General',    href: 'buydown-calc/BuydownCalculator.html',               desc: 'Analyze temporary and permanent interest rate buydown scenarios. Calculate the cost of 1-0, 2-1, or 3-2-1 buydown structures and compare monthly payment savings against the upfront buydown fee to determine if it makes financial sense.',                                                  features: ['Temporary buydown modeling (3-2-1, 2-1, 1-0 structures)','Monthly payment comparison across buydown periods','Buydown cost vs. savings break-even analysis','Seller concession and lender credit allocation'] },
    buyvsrent:    { name: 'Buy vs Rent Calculator',        icon: '\u{1F3E0}', cat: 'General',    href: 'gen-calc/buy_vs_rent_calculator.html',              desc: 'Compare the long-term financial impact of buying versus renting a property. Factor in appreciation, tax benefits, maintenance costs, and opportunity cost of the down payment to deliver a clear recommendation.',                                                                            features: ['Net worth comparison over a customizable time horizon','Home appreciation and rental increase projections','Tax benefit modeling (mortgage interest, property tax deductions)','Break-even analysis showing when buying surpasses renting'] },
    cashvmort:    { name: 'Cash vs Mortgage Comparison',   icon: '\u{1F4B0}', cat: 'General',    href: 'gen-calc/cashvmortcomp.html',                       desc: 'Analyze the financial trade-offs between paying cash versus financing a purchase. Compare opportunity cost of tying up capital against interest paid on a mortgage, factoring in investment returns and tax implications.',                                                                      features: ['Investment opportunity cost vs. mortgage interest analysis','After-tax comparison of both strategies over time','Customizable investment return assumptions','Visual wealth trajectory comparison chart'] },
    llpm:         { name: 'LLPM Tool',                     icon: '\u{1F4CB}', cat: 'General',    href: 'llpm-calc/LLPMTool.html',                           desc: 'Loan-Level Price Matrix (LLPM) analysis tool for evaluating price adjustments across multiple risk factors. Quickly look up hit-based pricing adjustments for LTV, FICO, loan type, and property type combinations.',                                                                          features: ['Multi-factor pricing adjustment lookup','LTV, FICO, and property type risk layering','Cumulative price adjustment calculation','Side-by-side scenario comparison'] },
    mismo:        { name: 'MISMO Document Analyzer',       icon: '\u{1F4C4}', cat: 'General',    href: 'gen-calc/mismo-calc/MISMO_Document_Analyzer.html',  desc: 'Upload a MISMO 3.4 XML file to automatically generate income summaries and documentation checklists. Parses complex XML structures to extract borrower data, employment history, and asset information in seconds.',                                                                           features: ['Drag-and-drop MISMO 3.4 XML file upload','Automated income and employment data extraction','Generated documentation checklist based on loan type','Borrower profile summary with asset breakdown'] },
    reo:          { name: 'REO Investment ROI',            icon: '\u{1F3DA}', cat: 'General',    href: 'calc-reo/index.html',                               desc: 'Comprehensive REO and investment property worksheet featuring NOI, cap rate, DCR, cash-on-cash return, equity buildup, and 5-year financial projections. Built for investors evaluating rental property acquisitions.',                                                                         features: ['Net Operating Income (NOI) and Cap Rate calculations','Debt Coverage Ratio (DCR) analysis','Cash-on-cash return with equity buildup tracking','5-year investment projection with appreciation modeling'] },
    refi:         { name: 'Refinance Analysis Tool',       icon: '\u{1F501}', cat: 'General',    href: 'refi-calc/index.html',                              desc: 'Compare current versus new loan terms, evaluate cash-out options, and calculate long-term savings with detailed break-even insights. Understand exactly when a refinance pays for itself and how much you save over the remaining term.',                                                        features: ['Current vs. proposed loan side-by-side comparison','Cash-out refinance scenario modeling','Break-even timeline with monthly savings projection','Total interest savings over remaining loan life'] },

    escrow:       { name: 'Escrow Prepaids Calculator',    icon: '\u{1F9FE}', cat: 'Government', href: 'fha-calc/Escrow_Calculator.html',                   desc: 'Calculate initial escrow deposits, aggregate adjustment, and Loan Estimate Section F vs. Section G escrow figures. Ensures accurate prepaid and escrow disclosures for government-backed loans.',                                                                                              features: ['Initial escrow deposit calculation with cushion analysis','Aggregate escrow adjustment computation','LE Section F (prepaids) vs. Section G (escrow) breakdown','Monthly escrow payment projection'] },
    fha:          { name: 'FHA Loan Calculator',           icon: '\u{1F3E6}', cat: 'Government', href: '/calculators/fha',                                  desc: 'FHA purchase, refinance, and streamline comparison with UFMIP, NTB, and MISMO auto-fill. Compare all three scenarios side by side to determine the best strategy for your borrower.',                                                                                                         features: ['Purchase, Rate/Term, Cash-Out, and Streamline side-by-side comparison','UFMIP refund calculation with HUD 37-month schedule','Net Tangible Benefit (NTB) analysis for all loan type transitions','MISMO XML auto-population of 25+ fields'] },
    vaprequal:    { name: 'VA Pre-Qualification Calculator',icon: '\u{1F396}',cat: 'Government', href: 'va-calc/va-prequal-calculator.html',                desc: 'VA loan pre-qualification tool including entitlement usage tracking, funding fee scenarios, and veteran-specific income and residual income calculations. Handles first-use, subsequent-use, and disabled veteran exemptions.',                                                                  features: ['VA entitlement and guaranty calculation','Funding fee computation with exemption handling','Residual income analysis by region and family size','DTI and compensating factors evaluation'] },

    incomeq:      { name: 'Income Questionnaire',          icon: '\u{2753}',  cat: 'Income',     href: 'income/IncomeCalculatorQuestionnaire.html',         desc: "Guided questionnaire that walks you through a series of questions about the borrower's income sources, then recommends the correct income calculator(s) to use. Eliminates guesswork for complex income scenarios.",                                                                            features: ['Step-by-step income source identification','Intelligent routing to the correct calculator','Support for multiple simultaneous income types','Clear explanation of why each calculator applies'] },
    income1040:   { name: 'Form 1040 Income Calculator',   icon: '\u{1F4DD}', cat: 'Income',     href: 'income/IncomeCalculator1040.html',                  desc: 'Analyze the individual tax return (Form 1040) to determine qualifying income. Extracts wages, salary, tips, and other income sources with applicable adjustments per agency underwriting guidelines.',                                                                                         features: ['Wages, salary, and tip income extraction','Adjusted Gross Income (AGI) reconciliation','Other income sources and deduction analysis','Two-year income trending and stability assessment'] },
    income1065:   { name: 'Form 1065 Income Calculator',   icon: '\u{1F4DD}', cat: 'Income',     href: 'income/IncomeCalculator1065.html',                  desc: 'Calculate qualifying income from partnership tax returns (Form 1065). Extracts ordinary business income, guaranteed payments, and applicable add-backs following Fannie Mae and Freddie Mac guidelines.',                                                                                       features: ['Ordinary business income extraction from Form 1065','Guaranteed payments and distributions analysis','Depreciation and other add-back adjustments','Two-year trending and averaging calculation'] },
    income1120:   { name: 'Form 1120 Income Calculator',   icon: '\u{1F3E2}', cat: 'Income',     href: 'income/IncomeCalculator1120.html',                  desc: 'Determine qualifying income from C-Corporation returns (Form 1120). Analyzes corporate earnings, officer compensation, and applicable adjustments per agency underwriting guidelines.',                                                                                                        features: ['Taxable income extraction with adjustments','Officer compensation and W-2 wage reconciliation','Corporate tax and depreciation add-backs','Cash flow analysis for business stability'] },
    income1120s:  { name: 'Form 1120S Income Calculator',  icon: '\u{1F3DB}', cat: 'Income',     href: 'income/IncomeCalculator1120S.html',                 desc: 'Calculate qualifying income from S-Corporation returns (Form 1120S). Handles pass-through income, W-2 compensation, and distribution analysis with agency-compliant add-back calculations.',                                                                                                   features: ['S-Corp pass-through income extraction','W-2 wages plus K-1 distribution reconciliation','Depreciation, depletion, and amortization add-backs','Business liquidity and stability assessment'] },
    income1120sk1:{ name: '1120S K-1 Income Calculator',   icon: '\u{1F4C3}', cat: 'Income',     href: 'income/IncomeCalculator1120SK1.html',               desc: 'Specialized calculator for analyzing Schedule K-1 income from S-Corporations (Form 1120S). Extracts and qualifies shareholder distributions, ordinary income, and pass-through items with proper add-backs.',                                                                                  features: ['S-Corp K-1 ordinary income extraction','Shareholder distribution and basis tracking','Pass-through deduction and loss handling','Reconciliation with personal tax return'] },
    incomek1:     { name: 'Schedule K-1 Income Calculator',icon: '\u{1F4CB}', cat: 'Income',     href: 'income/IncomeCalculatorK1.html',                    desc: 'Analyze partner or shareholder income from Schedule K-1 forms. Calculates qualifying income from partnership or S-Corp distributions including ordinary income, rental income, and guaranteed payments.',                                                                                        features: ['K-1 ordinary business income extraction','Rental income from K-1 passthrough','Guaranteed payment and distribution tracking','Multi-entity K-1 consolidation'] },
    incomerental: { name: 'Rental Property Income (1038)', icon: '\u{1F3D8}', cat: 'Income',     href: 'income/IncomeCalculatorRental1038.html',            desc: 'Calculate qualifying rental income for investment properties. Applies PITIA offset methodology to determine net rental income or loss for DTI qualification.',                                                                                                                                  features: ['Gross rental income vs. PITIA offset calculation','Vacancy factor and maintenance reserve adjustments','Net rental income for DTI qualification','Multi-property rental income aggregation'] },
    incomeb:      { name: 'Schedule B Income Calculator',  icon: '\u{1F4B5}', cat: 'Income',     href: 'income/IncomeCalculatorScheduleB.html',             desc: 'Calculate qualifying interest and ordinary dividend income from Schedule B. Verifies continuity and stability of investment income sources for mortgage qualification purposes.',                                                                                                                features: ['Interest income from savings, CDs, and bonds','Ordinary dividend income extraction','Two-year history continuity verification','Asset sufficiency analysis for income sustainability'] },
    incomec:      { name: 'Schedule C Income Calculator',  icon: '\u{1F454}', cat: 'Income',     href: 'income/IncomeCalculatorScheduleC.html',             desc: 'Determine qualifying self-employment income from Schedule C (Sole Proprietorship). Calculates net business income with all applicable add-backs including depreciation, home office deduction, and meal expenses.',                                                                              features: ['Net profit/loss extraction from Schedule C','Depreciation, depletion, and amortization add-backs','Home office and business use of home adjustments','Mileage and vehicle expense add-back computation'] },
    incomed:      { name: 'Schedule D Income Calculator',  icon: '\u{1F4C8}', cat: 'Income',     href: 'income/IncomeCalculatorScheduleD.html',             desc: 'Calculate qualifying capital gains and losses from Schedule D. Evaluates recurring vs. non-recurring gains, determines two-year trends, and applies appropriate averaging for loan qualification.',                                                                                              features: ['Short-term vs. long-term capital gains separation','Recurring gain identification and trending','Two-year average calculation per guidelines','Non-recurring gain exclusion analysis'] },
    incomee:      { name: 'Schedule E Income Calculator',  icon: '\u{1F3D7}', cat: 'Income',     href: 'income/IncomeCalculatorScheduleE.html',             desc: 'Calculate rental real estate, royalty, partnership, S-Corp, estate, and trust income from Schedule E. Handles multi-property analysis with proper depreciation and amortization add-backs.',                                                                                                     features: ['Multi-property rental income analysis','Royalty income extraction and trending','Depreciation and insurance add-back calculations','Supplemental income reconciliation (Page 2)'] },
    incomeesub:   { name: 'Schedule E (Subject Property)', icon: '\u{1F3DA}', cat: 'Income',     href: 'income/IncomeCalculatorScheduleESubject.html',      desc: 'Specialized analysis of Schedule E income for the subject property being financed. Separates subject property rental income from other properties to properly offset against the proposed PITIA payment.',                                                                                      features: ['Subject property income isolation from Schedule E','PITIA offset against subject property rental income','Vacancy factor application per guideline requirements','Net subject property income for DTI calculation'] },
    incomef:      { name: 'Schedule F Income Calculator',  icon: '\u{1F33E}', cat: 'Income',     href: 'income/IncomeCalculatorScheduleF.html',             desc: 'Calculate qualifying farm income and expenses from Schedule F. Handles agricultural income including crop sales, livestock, cooperative distributions, and CCC loans with appropriate add-backs.',                                                                                               features: ['Gross farm income and expense analysis','Depreciation and conservation expense add-backs','Two-year farm income averaging','Co-op distribution and CCC loan handling'] },
  };

  /* Counts per category */
  var COUNTS = {};
  Object.values(CALCS).forEach(function (c) { COUNTS[c.cat] = (COUNTS[c.cat] || 0) + 1; });

  /* =====================================================
     FAVORITES (localStorage)
     ===================================================== */
  var FAV_KEY = 'msfg-hub-favorites';

  function loadFavs()   { try { var r = localStorage.getItem(FAV_KEY); return r ? JSON.parse(r) : []; } catch(e) { return []; } }
  function saveFavs(a)  { try { localStorage.setItem(FAV_KEY, JSON.stringify(a)); } catch(e) {} }
  function isFav(key)   { return loadFavs().indexOf(key) !== -1; }
  function toggleFav(key) {
    var favs = loadFavs(), idx = favs.indexOf(key);
    if (idx === -1) favs.push(key); else favs.splice(idx, 1);
    saveFavs(favs);
    return favs.indexOf(key) !== -1;
  }

  /* =====================================================
     DOM READY
     ===================================================== */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    var trigger     = el('hubTrigger');
    var triggerIcon = el('hubTriggerIcon');
    var triggerLbl  = el('hubTriggerLabel');
    var dropdown    = el('hubDropdown');
    var searchInput = el('hubSearch');
    var noResults   = el('hubNoResults');
    var emptyState  = el('hubEmpty');
    var stack       = el('hubStack');
    var pillsWrap   = el('hubPills');

    var options  = document.querySelectorAll('.hub-opt');
    var isOpen   = false;
    var openKeys = [];                 // keys currently open in the stack

    /* Counters */
    setText('hubCountGeneral', COUNTS.General || 0);
    setText('hubCountGov',     COUNTS.Government || 0);
    setText('hubCountIncome',  COUNTS.Income || 0);

    /* =====================================================
       FAVORITES RENDERING
       ===================================================== */
    function renderFavs() {
      var favs = loadFavs();
      pillsWrap.innerHTML = '';

      if (favs.length === 0) {
        pillsWrap.innerHTML = '<span class="hub-favorites-empty">Star a calculator to add it here</span>';
        return;
      }

      favs.forEach(function (key) {
        var c = CALCS[key];
        if (!c) return;

        var pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'hub-pill' + (openKeys.indexOf(key) !== -1 ? ' is-open' : '');
        pill.innerHTML =
          '<span class="hub-pill-icon">' + c.icon + '</span>' +
          '<span>' + esc(c.name) + '</span>' +
          '<span class="hub-pill-remove" data-key="' + key + '" title="Remove from favorites">&times;</span>';

        pill.addEventListener('click', function (e) {
          if (e.target.closest('.hub-pill-remove')) {
            e.stopPropagation();
            toggleFav(key);
            renderFavs();
            refreshFavButtons();
            return;
          }
          openCalc(key);
        });

        pillsWrap.appendChild(pill);
      });
    }

    renderFavs();

    /* =====================================================
       DROPDOWN
       ===================================================== */
    function openDrop() {
      isOpen = true;
      trigger.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      dropdown.classList.add('show');
      searchInput.value = '';
      filterOpts('');
      setTimeout(function () { searchInput.focus(); }, 40);
    }

    function closeDrop() {
      isOpen = false;
      trigger.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      dropdown.classList.remove('show');
    }

    trigger.addEventListener('click', function () { isOpen ? closeDrop() : openDrop(); });
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isOpen ? closeDrop() : openDrop(); }
      if (e.key === 'Escape') closeDrop();
    });

    document.addEventListener('click', function (e) {
      if (!trigger.closest('.hub-select-wrap').contains(e.target)) closeDrop();
    });

    /* Search */
    function filterOpts(q) {
      q = q.toLowerCase().trim();
      var vis = 0;
      options.forEach(function (opt) {
        var match = !q || opt.querySelector('.hub-opt-label').textContent.toLowerCase().indexOf(q) !== -1;
        opt.classList.toggle('hidden', !match);
        if (match) vis++;
      });
      document.querySelectorAll('.hub-opt-group').forEach(function (g) {
        g.style.display = g.querySelector('.hub-opt:not(.hidden)') ? '' : 'none';
      });
      noResults.style.display = vis === 0 ? 'block' : 'none';
    }

    searchInput.addEventListener('input', function (e) { filterOpts(e.target.value); });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDrop(); trigger.focus(); }
    });

    /* Option click */
    options.forEach(function (opt) {
      opt.addEventListener('click', function () { openCalc(opt.dataset.value); });
    });

    /* Mark dropdown items that are already open */
    function syncDropdownState() {
      options.forEach(function (opt) {
        opt.classList.toggle('is-open', openKeys.indexOf(opt.dataset.value) !== -1);
      });
    }

    /* =====================================================
       OPEN A CALCULATOR (add to stack)
       ===================================================== */
    function openCalc(key) {
      var calc = CALCS[key];
      if (!calc) return;

      /* If already open, scroll to it */
      if (openKeys.indexOf(key) !== -1) {
        var existing = stack.querySelector('[data-key="' + key + '"]');
        if (existing) existing.scrollIntoView({ behavior: 'smooth', block: 'start' });
        closeDrop();
        return;
      }

      openKeys.push(key);
      closeDrop();

      /* Reset trigger to placeholder */
      triggerIcon.textContent = '';
      triggerLbl.textContent = 'Select a calculator...';
      triggerLbl.classList.add('placeholder');

      /* Hide empty state */
      emptyState.style.display = 'none';

      /* Build card */
      var card = buildCard(key, calc);
      stack.appendChild(card);

      /* Scroll to the new card */
      setTimeout(function () {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);

      syncDropdownState();
      renderFavs();
    }

    /* =====================================================
       CLOSE A CALCULATOR (remove from stack)
       ===================================================== */
    function closeCalc(key) {
      var idx = openKeys.indexOf(key);
      if (idx !== -1) openKeys.splice(idx, 1);

      var card = stack.querySelector('[data-key="' + key + '"]');
      if (card) {
        card.classList.add('removing');
        setTimeout(function () {
          card.remove();
          if (openKeys.length === 0) emptyState.style.display = '';
        }, 250);
      }

      syncDropdownState();
      renderFavs();
    }

    /* =====================================================
       BUILD CARD DOM
       ===================================================== */
    function buildCard(key, calc) {
      var card = document.createElement('div');
      card.className = 'hub-card';
      card.dataset.key = key;

      /* SVG templates */
      var starSvg = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
      var extSvg  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

      /* Features HTML */
      var featHtml = '';
      calc.features.forEach(function (f) {
        featHtml += '<li><span class="check">\u2713</span> ' + esc(f) + '</li>';
      });

      var isFaved = isFav(key);

      card.innerHTML =
        /* Header */
        '<div class="hub-card-header">' +
          '<span class="hub-card-icon">' + calc.icon + '</span>' +
          '<div class="hub-card-title-group">' +
            '<h3 class="hub-card-name">' + esc(calc.name) + '</h3>' +
            '<span class="hub-card-badge">' + esc(calc.cat) + '</span>' +
          '</div>' +
          '<div class="hub-card-actions">' +
            '<button type="button" class="hub-card-fav' + (isFaved ? ' is-fav' : '') + '" title="' + (isFaved ? 'Remove from favorites' : 'Add to favorites') + '">' + starSvg + '</button>' +
            '<a class="hub-card-open" href="' + calc.href + '">Open <span>&rarr;</span></a>' +
            '<button type="button" class="hub-card-close" title="Close calculator">&times;</button>' +
          '</div>' +
        '</div>' +
        /* Body */
        '<div class="hub-card-body">' +
          '<p class="hub-card-desc">' + esc(calc.desc) + '</p>' +
          '<div>' +
            '<div class="hub-card-features-heading">Key Features</div>' +
            '<ul class="hub-card-features">' + featHtml + '</ul>' +
          '</div>' +
        '</div>' +
        /* Preview */
        '<div class="hub-card-preview">' +
          '<div class="hub-card-toolbar">' +
            '<div class="hub-card-dots"><span></span><span></span><span></span></div>' +
            '<div class="hub-card-url">' + esc(calc.href) + '</div>' +
            '<a class="hub-card-toolbar-open" href="' + calc.href + '" target="_blank" rel="noopener">Open ' + extSvg + '</a>' +
          '</div>' +
          '<div class="hub-card-frame">' +
            '<div class="hub-card-loading"><div class="hub-spinner"></div><span>Loading preview\u2026</span></div>' +
            '<iframe title="' + esc(calc.name) + ' Preview" src="' + calc.href + '"></iframe>' +
            '<div class="hub-card-overlay"><div class="hub-card-overlay-hint">Click to open in new tab</div></div>' +
          '</div>' +
        '</div>';

      /* --- Wire events --- */

      /* Close button */
      card.querySelector('.hub-card-close').addEventListener('click', function () {
        closeCalc(key);
      });

      /* Favorite toggle */
      var favBtn = card.querySelector('.hub-card-fav');
      favBtn.addEventListener('click', function () {
        toggleFav(key);
        var faved = isFav(key);
        favBtn.classList.toggle('is-fav', faved);
        favBtn.title = faved ? 'Remove from favorites' : 'Add to favorites';
        renderFavs();
        refreshFavButtons();
      });

      /* Iframe load / timeout */
      var loading = card.querySelector('.hub-card-loading');
      var iframe  = card.querySelector('iframe');

      iframe.addEventListener('load', function () {
        setTimeout(function () { loading.classList.add('loaded'); }, 200);
      });

      /* Safety timeout for file:// or blocked iframes */
      setTimeout(function () {
        if (!loading.classList.contains('loaded')) loading.classList.add('loaded');
      }, 4000);

      /* Overlay click → open in new tab */
      card.querySelector('.hub-card-overlay').addEventListener('click', function () {
        window.open(calc.href, '_blank');
      });

      return card;
    }

    /* Keep all fav buttons in sync across cards */
    function refreshFavButtons() {
      stack.querySelectorAll('.hub-card').forEach(function (card) {
        var k = card.dataset.key;
        var btn = card.querySelector('.hub-card-fav');
        if (btn) {
          var f = isFav(k);
          btn.classList.toggle('is-fav', f);
          btn.title = f ? 'Remove from favorites' : 'Add to favorites';
        }
      });
    }

    /* Expose globally */
    window.hubOpenCalc  = openCalc;
    window.hubCloseCalc = closeCalc;
  }

  /* =====================================================
     HELPERS
     ===================================================== */
  function el(id) { return document.getElementById(id); }
  function setText(id, val) { var e = el(id); if (e) e.textContent = val; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

})();
