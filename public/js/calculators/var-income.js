/* =====================================================
   Variable Income Analyzer
   — Multi-paystub upload, W-2 upload, Fannie Mae B3-3.1
   ===================================================== */
'use strict';

(function () {
  var fmt = MSFG.formatCurrency;
  var pn = MSFG.parseNum;

  // ---- Helpers (engine) ----

  var PAY_PERIODS_PER_YEAR = { WEEKLY: 52, BIWEEKLY: 26, SEMIMONTHLY: 24, MONTHLY: 12 };

  function safeDiv(n, d) { return d ? n / d : 0; }
  function annualToMonthly(a) { return a / 12; }

  function monthsElapsedInYear(asOfISO) {
    var d = new Date(asOfISO + 'T00:00:00');
    return d.getMonth() + 1;
  }

  function ytdToMonthly(ytd, asOfISO) {
    return safeDiv(ytd, monthsElapsedInYear(asOfISO));
  }

  function evaluateTrend(currentMonthly, prior1Monthly, prior2Monthly) {
    var twoYrAvg = prior2Monthly != null ? (prior1Monthly + prior2Monthly) / 2 : prior1Monthly;
    var stableOrUp = currentMonthly >= twoYrAvg - 0.01;

    if (stableOrUp) return { status: 'STABLE_OR_UP', recommendedMonthly: twoYrAvg, note: 'Stable/increasing: use average.' };
    var stabilized = currentMonthly >= prior1Monthly - 0.01;
    if (stabilized) return { status: 'DECLINED_THEN_STABLE', recommendedMonthly: currentMonthly, note: 'Declined then stabilized: use current lower.' };
    return { status: 'DECLINING', recommendedMonthly: currentMonthly, note: 'Declining: manual analysis; do not average over decline.' };
  }

  function addFlag(flags, severity, code, message) {
    flags.push({ severity: severity, code: code, message: message });
  }

  function addDoc(docs, item) {
    if (docs.indexOf(item) === -1) docs.push(item);
  }

  // ---- Fannie Mae Engine (inlined from var-calc.js) ----

  function underwriteVariableIncome(input) {
    var flags = [];
    var docs = [];
    var notes = [];

    addDoc(docs, 'Most recent paystub (\u2264 30 days old) showing YTD earnings');
    addDoc(docs, 'W-2s (most recent 1\u20132 years depending on income type)');

    if (input.employerCount > 1) {
      addDoc(docs, 'Paystubs/W-2s for each employer used to qualify');
      addDoc(docs, 'Verbal VOE for each employer');
      addFlag(flags, 'info', 'MULTIPLE_EMPLOYERS', 'Multiple jobs/employers: separate verification required.');
    }

    if (input.hasEmploymentGap) {
      addDoc(docs, 'Letter of explanation for employment gap(s)');
      addFlag(flags, 'warn', 'GAP', 'Employment gap indicated: underwriter will require explanation and may request additional history.');
    }

    if (input.jobChangedOrNewRole) {
      addDoc(docs, 'Written explanation of job/role change (and impact to OT/bonus/commission)');
      addFlag(flags, 'warn', 'COMP_CHANGE', 'Recent job/role/comp change can affect variable income continuance.');
    }

    var monthlyBase = 0;

    if (input.basePayType === 'SALARY') {
      monthlyBase = annualToMonthly(input.baseRateAnnualOrHourly);
    } else {
      if (input.hoursFluctuate) {
        var current = ytdToMonthly(input.ytd.base, input.asOfDateISO);
        var p1 = input.priorYears[0] ? input.priorYears[0].base / 12 : null;
        var p2 = input.priorYears[1] ? input.priorYears[1].base / 12 : null;

        var tr = evaluateTrend(current, p1 != null ? p1 : current, p2);
        monthlyBase = tr.recommendedMonthly;
        notes.push('Base hourly (fluctuating): ' + tr.note);

        if (tr.status === 'DECLINING') {
          addFlag(flags, 'warn', 'BASE_DECLINING', 'Hourly base appears declining; manual UW analysis likely required.');
        }
      } else {
        if (!input.expectedHoursPerWeek) {
          addFlag(flags, 'stop', 'MISSING_HOURS', 'Hourly base requires expected hours/week when hours are stable.');
        } else {
          monthlyBase = (input.baseRateAnnualOrHourly * input.expectedHoursPerWeek * 52) / 12;
        }
      }
    }

    // YTD sanity check
    var periods = PAY_PERIODS_PER_YEAR[input.payFrequency];
    if (periods && input.payPeriodsYTD > 0) {
      var expectedBaseYTD = null;

      if (input.basePayType === 'SALARY') {
        expectedBaseYTD = (input.baseRateAnnualOrHourly / periods) * input.payPeriodsYTD;
      } else if (!input.hoursFluctuate && input.expectedHoursPerWeek) {
        var weekly = input.baseRateAnnualOrHourly * input.expectedHoursPerWeek;
        var perPeriod =
          input.payFrequency === 'WEEKLY' ? weekly :
          input.payFrequency === 'BIWEEKLY' ? weekly * 2 :
          input.payFrequency === 'SEMIMONTHLY' ? weekly * (52 / 24) :
          weekly * (52 / 12);
        expectedBaseYTD = perPeriod * input.payPeriodsYTD;
      }

      if (expectedBaseYTD != null && expectedBaseYTD > 0 && input.ytd.base > 0) {
        var variance = (input.ytd.base - expectedBaseYTD) / expectedBaseYTD;
        if (Math.abs(variance) >= 0.05) {
          addFlag(flags, 'warn', 'YTD_MISMATCH', 'Base YTD differs from expected by ' + (variance * 100).toFixed(1) + '% (possible gap/unpaid leave/comp change).');
          addDoc(docs, 'Explanation for YTD variance (unpaid leave, schedule change, comp change, etc.)');
        }
      }
    }

    // Variable components
    function handleVar(type, ytdAmount, priorSelector, minMonthsHistory, label) {
      if (ytdAmount <= 0) return 0;

      var cur = ytdToMonthly(ytdAmount, input.asOfDateISO);
      var py1 = input.priorYears[0] ? priorSelector(input.priorYears[0]) / 12 : null;
      var py2 = input.priorYears[1] ? priorSelector(input.priorYears[1]) / 12 : null;

      var monthsAvailableProxy = input.priorYears.length >= 1 ? 24 : 0;
      if (minMonthsHistory && monthsAvailableProxy < minMonthsHistory) {
        addFlag(flags, 'warn', type + '_HISTORY', label + ' history may be insufficient; underwriting may require \u2265' + minMonthsHistory + ' months.');
        addDoc(docs, 'Prior year(s) evidence of ' + label + ' (W-2, VOE, or pay history)');
      }

      var trend = evaluateTrend(cur, py1 != null ? py1 : cur, py2);
      notes.push(label + ': ' + trend.note);

      if (trend.status === 'DECLINING') {
        addFlag(flags, 'warn', type + '_DECLINING', label + ' appears declining; do not average over decline period without analysis.');
      }

      return trend.recommendedMonthly;
    }

    var monthlyOT = handleVar('OT', input.ytd.overtime, function (y) { return y.overtime; }, 12, 'Overtime');
    var monthlyBonus = handleVar('BONUS', input.ytd.bonus, function (y) { return y.bonus; }, 12, 'Bonus');
    var monthlyComm = handleVar('COMM', input.ytd.commission, function (y) { return y.commission; }, 12, 'Commission');

    var monthlyByType = {
      base: monthlyBase,
      overtime: monthlyOT,
      bonus: monthlyBonus,
      commission: monthlyComm
    };

    var monthlyUsable = 0;
    for (var k in monthlyByType) {
      if (monthlyByType.hasOwnProperty(k)) monthlyUsable += (monthlyByType[k] || 0);
    }

    return { monthlyUsable: monthlyUsable, monthlyByType: monthlyByType, docsRequired: docs, flags: flags, notes: notes };
  }

  // ---- DOM Utilities ----

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function valStr(el) { return el ? el.value.trim() : ''; }
  function valNum(el) { return el ? parseFloat(el.value) || 0 : 0; }

  var escHtml = MSFG.escHtml;

  function genId() {
    return 'stub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  function formatDateShort(isoDate) {
    if (!isoDate) return '?';
    var parts = isoDate.split('-');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
  }

  function amountSpan(label, value) {
    var display = (value != null && value > 0) ? fmt(value) : '--';
    return '<span class="stub-card__amount"><strong>' + label + ':</strong> ' + display + '</span>';
  }

  // ---- Data Stores ----

  // stubStore: Map<empIndex, Array<StubData>>
  var stubStore = new Map();
  // w2Store: Map<empIndex, Array<W2Data>>
  var w2Store = new Map();

  function getStubs(empIndex) {
    if (!stubStore.has(empIndex)) stubStore.set(empIndex, []);
    return stubStore.get(empIndex);
  }

  function getW2s(empIndex) {
    if (!w2Store.has(empIndex)) w2Store.set(empIndex, []);
    return w2Store.get(empIndex);
  }

  // ---- Employment Panel Management ----

  var container = document.getElementById('employmentsContainer');
  var addBtn = document.getElementById('addEmploymentBtn');
  var calcBtn = document.getElementById('calculateBtn');
  var resetBtn = document.getElementById('resetBtn');
  var resultsSection = document.getElementById('resultsSection');

  function getPanels() { return $$('.employment-panel', container); }

  function reindexPanels() {
    // Rebuild stores with new indices
    var newStubStore = new Map();
    var newW2Store = new Map();

    getPanels().forEach(function (panel, i) {
      var oldIndex = parseInt(panel.getAttribute('data-emp-index'), 10);
      if (stubStore.has(oldIndex)) newStubStore.set(i, stubStore.get(oldIndex));
      if (w2Store.has(oldIndex)) newW2Store.set(i, w2Store.get(oldIndex));

      panel.setAttribute('data-emp-index', i);
      $('.emp-panel-title', panel).textContent = 'Employment ' + (i + 1);
      var removeBtn = $('.remove-emp-btn', panel);
      if (removeBtn) removeBtn.style.display = i === 0 ? 'none' : '';

      // Update all data-emp-index attributes within the panel
      $$('[data-emp-index]', panel).forEach(function (el) {
        el.setAttribute('data-emp-index', i);
      });
    });

    stubStore = newStubStore;
    w2Store = newW2Store;
    updatePriorYearLabels();
  }

  function updatePriorYearLabels() {
    var currentYear = new Date().getFullYear();
    $$('.emp-prior-year-label-1').forEach(function (el) { el.textContent = currentYear - 1; });
    $$('.emp-prior-year-label-2').forEach(function (el) { el.textContent = currentYear - 2; });
  }

  function initPayTypeToggle(panel) {
    var payTypeSelect = $('.emp-pay-type', panel);
    var hourlyFields = $('.emp-hourly-fields', panel);
    var rateLabel = $('.emp-rate-label', panel);

    function toggle() {
      var isHourly = payTypeSelect.value === 'HOURLY';
      hourlyFields.style.display = isHourly ? '' : 'none';
      rateLabel.textContent = isHourly ? 'Hourly Rate' : 'Annual Salary';
    }

    payTypeSelect.addEventListener('change', toggle);
    toggle();
  }

  // ---- Upload Zone Logic (Paystubs + W-2) ----

  function initUploadZone(panel) {
    var validateFile = MSFG.FileUpload.validateFile;
    $$('.upload-zone', panel).forEach(function (zone) {
      var fileInput = $('.upload-zone__input', zone);
      var statusEl = $('.upload-zone__status', zone);
      var uploadType = zone.getAttribute('data-upload-type') || 'paystub';

      MSFG.FileUpload.initDropZone(zone, fileInput, function(file) {
        if (uploadType === 'w2') {
          processW2File(file, panel, zone, statusEl);
        } else {
          processStubFile(file, panel, zone, statusEl);
        }
      });
    });
  }

  var setZoneStatus = MSFG.FileUpload.setZoneStatus;
  var validateFile = MSFG.FileUpload.validateFile;

  // ---- Paystub Upload ----

  function processStubFile(file, panel, zone, statusEl) {
    if (!validateFile(file)) {
      setZoneStatus(zone, statusEl, 'error', 'Unsupported file type. Use PNG, JPG, WebP, or PDF.');
      return;
    }

    setZoneStatus(zone, statusEl, 'loading', '<span class="spinner"></span> Analyzing paystub...');
    zone.classList.add('processing');
    zone.classList.remove('has-error');

    var formData = new FormData();
    formData.append('file', file);
    formData.append('slug', 'var-income');

    fetch('/api/ai/extract', { method: 'POST', body: formData })
      .then(function (resp) { return resp.json(); })
      .then(function (result) {
        zone.classList.remove('processing');
        if (result.success && result.data) {
          var empIndex = parseInt(panel.getAttribute('data-emp-index'), 10);
          var stubData = result.data;
          stubData.id = genId();

          var stubs = getStubs(empIndex);
          stubs.push(stubData);

          // Sort by payPeriodEnd ascending
          stubs.sort(function (a, b) {
            return (a.payPeriodEnd || '').localeCompare(b.payPeriodEnd || '');
          });

          renderStubCards(panel, empIndex);
          syncPanelFromStubs(panel, empIndex);
          updateCoverageIndicator(panel, empIndex);

          setZoneStatus(zone, statusEl, 'success', stubs.length + ' stub(s) uploaded. Add more for 30-day coverage.');
          zone.classList.add('has-data');

          // Reset file input so same file can be re-selected
          var fileInput = $('.upload-zone__input', zone);
          if (fileInput) fileInput.value = '';
        } else {
          setZoneStatus(zone, statusEl, 'error', result.message || 'AI extraction failed.');
          zone.classList.add('has-error');
        }
      })
      .catch(function (err) {
        zone.classList.remove('processing');
        setZoneStatus(zone, statusEl, 'error', 'Network error: ' + err.message);
        zone.classList.add('has-error');
      });
  }

  // ---- W-2 Upload ----

  function processW2File(file, panel, zone, statusEl) {
    if (!validateFile(file)) {
      setZoneStatus(zone, statusEl, 'error', 'Unsupported file type. Use PNG, JPG, WebP, or PDF.');
      return;
    }

    setZoneStatus(zone, statusEl, 'loading', '<span class="spinner"></span> Analyzing W-2...');
    zone.classList.add('processing');
    zone.classList.remove('has-error');

    var formData = new FormData();
    formData.append('file', file);
    formData.append('slug', 'var-income-w2');

    fetch('/api/ai/extract', { method: 'POST', body: formData })
      .then(function (resp) { return resp.json(); })
      .then(function (result) {
        zone.classList.remove('processing');
        if (result.success && result.data) {
          var empIndex = parseInt(panel.getAttribute('data-emp-index'), 10);
          var w2Data = result.data;
          w2Data.id = genId();

          var w2s = getW2s(empIndex);
          w2s.push(w2Data);

          // Sort by taxYear descending (most recent first)
          w2s.sort(function (a, b) { return (b.taxYear || 0) - (a.taxYear || 0); });

          renderW2Cards(panel, empIndex);
          syncW2ToTable(panel, empIndex);

          setZoneStatus(zone, statusEl, 'success', w2s.length + ' W-2(s) uploaded.');
          zone.classList.add('has-data');

          var fileInput = $('.upload-zone__input', zone);
          if (fileInput) fileInput.value = '';
        } else {
          setZoneStatus(zone, statusEl, 'error', result.message || 'W-2 extraction failed.');
          zone.classList.add('has-error');
        }
      })
      .catch(function (err) {
        zone.classList.remove('processing');
        setZoneStatus(zone, statusEl, 'error', 'Network error: ' + err.message);
        zone.classList.add('has-error');
      });
  }

  // ---- Stub Card Rendering ----

  function renderStubCards(panel, empIndex) {
    var cardsContainer = $('.stub-cards', panel);
    if (!cardsContainer) return;

    var stubs = getStubs(empIndex);
    cardsContainer.innerHTML = '';

    if (stubs.length === 0) return;

    stubs.forEach(function (stub, i) {
      var card = document.createElement('div');
      card.className = 'stub-card';
      card.setAttribute('data-stub-id', stub.id);

      var startStr = formatDateShort(stub.payPeriodStart);
      var endStr = formatDateShort(stub.payPeriodEnd);
      var checkStr = stub.checkDate ? formatDateShort(stub.checkDate) : '';
      var isMostRecent = (i === stubs.length - 1);

      var html = '<div class="stub-card__header">';
      html += '<span class="stub-card__dates">' + startStr + ' &mdash; ' + endStr + '</span>';
      if (checkStr) html += '<span class="stub-card__check-date">Paid: ' + checkStr + '</span>';
      html += '<button class="stub-card__remove" type="button" title="Remove stub" data-stub-id="' + stub.id + '">&times;</button>';
      html += '</div>';

      html += '<div class="stub-card__amounts">';
      html += amountSpan('Base', stub.currentBase);
      html += amountSpan('OT', stub.currentOvertime);
      html += amountSpan('Bonus', stub.currentBonus);
      html += amountSpan('Comm', stub.currentCommission);
      if (stub.currentOther > 0) html += amountSpan('Other', stub.currentOther);
      html += '</div>';

      if (isMostRecent) {
        html += '<div class="stub-card__badge">Most Recent (YTD source)</div>';
      }

      card.innerHTML = html;
      cardsContainer.appendChild(card);
    });

    // Bind remove buttons
    $$('.stub-card__remove', cardsContainer).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var stubId = btn.getAttribute('data-stub-id');
        removeStub(panel, empIndex, stubId);
      });
    });
  }

  // ---- W-2 Card Rendering ----

  function renderW2Cards(panel, empIndex) {
    var cardsContainer = $('.w2-cards', panel);
    if (!cardsContainer) return;

    var w2s = getW2s(empIndex);
    cardsContainer.innerHTML = '';

    if (w2s.length === 0) return;

    w2s.forEach(function (w2) {
      var card = document.createElement('div');
      card.className = 'w2-card';
      card.setAttribute('data-w2-id', w2.id);

      var html = '<span class="w2-card__year">' + (w2.taxYear || '?') + '</span>';
      if (w2.employerName) html += '<span class="w2-card__employer">' + escHtml(w2.employerName) + '</span>';
      html += '<span class="w2-card__total">W&amp;T: ' + fmt(w2.wagesTipsComp || 0) + '</span>';
      html += '<button class="w2-card__remove" type="button" title="Remove W-2" data-w2-id="' + w2.id + '">&times;</button>';

      card.innerHTML = html;
      cardsContainer.appendChild(card);
    });

    // Bind remove buttons
    $$('.w2-card__remove', cardsContainer).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var w2Id = btn.getAttribute('data-w2-id');
        removeW2(panel, empIndex, w2Id);
      });
    });
  }

  // ---- Sync Paystub Data to Form Fields ----

  function syncPanelFromStubs(panel, empIndex) {
    var stubs = getStubs(empIndex);
    if (stubs.length === 0) return;

    // First stub: employer details (only if fields are empty)
    var first = stubs[0];
    var nameField = $('.emp-employer-name', panel);
    if (first.employerName && !nameField.value) nameField.value = first.employerName;

    var posField = $('.emp-position', panel);
    if (first.position && !posField.value) posField.value = first.position;

    if (first.payType) {
      var payTypeSelect = $('.emp-pay-type', panel);
      payTypeSelect.value = first.payType;
      payTypeSelect.dispatchEvent(new Event('change'));
    }

    if (first.payFrequency) $('.emp-pay-frequency', panel).value = first.payFrequency;
    if (first.baseRate != null) $('.emp-base-rate', panel).value = first.baseRate;
    if (first.hoursPerWeek != null) $('.emp-hours-per-week', panel).value = first.hoursPerWeek;

    // Most recent stub: YTD data (always overwrite with latest)
    var latest = stubs[stubs.length - 1];
    if (latest.payPeriodEnd) $('.emp-as-of-date', panel).value = latest.payPeriodEnd;
    if (latest.payPeriodsYTD != null) $('.emp-pay-periods-ytd', panel).value = latest.payPeriodsYTD;
    if (latest.ytdBase != null) $('.emp-ytd-base', panel).value = latest.ytdBase;
    if (latest.ytdOvertime != null) $('.emp-ytd-overtime', panel).value = latest.ytdOvertime;
    if (latest.ytdBonus != null) $('.emp-ytd-bonus', panel).value = latest.ytdBonus;
    if (latest.ytdCommission != null) $('.emp-ytd-commission', panel).value = latest.ytdCommission;
    if (latest.ytdOther != null) $('.emp-ytd-other', panel).value = latest.ytdOther;
  }

  // ---- Sync W-2 Data to Prior Year Table ----

  function syncW2ToTable(panel, empIndex) {
    var w2s = getW2s(empIndex);
    if (w2s.length === 0) return;

    var currentYear = new Date().getFullYear();

    // Map W-2s to prior year rows by year
    w2s.forEach(function (w2) {
      if (!w2.taxYear) return;

      var rowNum = null;
      if (w2.taxYear === currentYear - 1) rowNum = 1;
      else if (w2.taxYear === currentYear - 2) rowNum = 2;

      if (rowNum) {
        var baseField = $('.emp-prior' + rowNum + '-base', panel);
        var otField = $('.emp-prior' + rowNum + '-overtime', panel);
        var bonusField = $('.emp-prior' + rowNum + '-bonus', panel);
        var commField = $('.emp-prior' + rowNum + '-commission', panel);

        if (baseField) baseField.value = w2.base || 0;
        if (otField) otField.value = w2.overtime || 0;
        if (bonusField) bonusField.value = w2.bonus || 0;
        if (commField) commField.value = w2.commission || 0;
      }
    });
  }

  // ---- Remove Stub / W-2 ----

  function removeStub(panel, empIndex, stubId) {
    var stubs = getStubs(empIndex);
    var filtered = stubs.filter(function (s) { return s.id !== stubId; });
    stubStore.set(empIndex, filtered);

    renderStubCards(panel, empIndex);
    updateCoverageIndicator(panel, empIndex);

    if (filtered.length > 0) {
      syncPanelFromStubs(panel, empIndex);
    }

    // Update paystub upload zone status
    var zone = $('[data-upload-type="paystub"].upload-zone', panel);
    if (zone) {
      var statusEl = $('.upload-zone__status', zone);
      if (filtered.length === 0) {
        zone.classList.remove('has-data');
        setZoneStatus(zone, statusEl, '', '');
      } else {
        setZoneStatus(zone, statusEl, 'success', filtered.length + ' stub(s) uploaded. Add more for 30-day coverage.');
      }
    }
  }

  function removeW2(panel, empIndex, w2Id) {
    var w2s = getW2s(empIndex);
    var filtered = w2s.filter(function (w) { return w.id !== w2Id; });
    w2Store.set(empIndex, filtered);

    renderW2Cards(panel, empIndex);

    // Update W-2 upload zone status
    var zone = $('[data-upload-type="w2"].upload-zone', panel);
    if (zone) {
      var statusEl = $('.upload-zone__status', zone);
      if (filtered.length === 0) {
        zone.classList.remove('has-data');
        setZoneStatus(zone, statusEl, '', '');
      } else {
        setZoneStatus(zone, statusEl, 'success', filtered.length + ' W-2(s) uploaded.');
      }
    }
  }

  // ---- Coverage Calculation ----

  function calculateCoverage(stubs) {
    var dated = stubs.filter(function (s) { return s.payPeriodStart && s.payPeriodEnd; });

    if (dated.length === 0) {
      return { totalDays: 0, rangeLabel: 'No date range available', gaps: [] };
    }

    dated.sort(function (a, b) { return a.payPeriodStart.localeCompare(b.payPeriodStart); });

    var earliest = dated[0].payPeriodStart;
    var latest = dated[dated.length - 1].payPeriodEnd;

    var startDate = new Date(earliest + 'T00:00:00');
    var endDate = new Date(latest + 'T00:00:00');
    var totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Detect gaps
    var gaps = [];
    for (var i = 1; i < dated.length; i++) {
      var prevEnd = new Date(dated[i - 1].payPeriodEnd + 'T00:00:00');
      var currStart = new Date(dated[i].payPeriodStart + 'T00:00:00');
      var gapDays = Math.round((currStart - prevEnd) / (1000 * 60 * 60 * 24)) - 1;
      if (gapDays > 1) {
        gaps.push({
          days: gapDays,
          label: formatDateShort(dated[i - 1].payPeriodEnd) + ' to ' + formatDateShort(dated[i].payPeriodStart)
        });
      }
    }

    var rangeLabel = formatDateShort(earliest) + ' &mdash; ' + formatDateShort(latest);

    return { totalDays: totalDays, rangeLabel: rangeLabel, gaps: gaps };
  }

  function updateCoverageIndicator(panel, empIndex) {
    var indicator = $('.coverage-indicator', panel);
    if (!indicator) return;

    var stubs = getStubs(empIndex);

    if (stubs.length === 0) {
      indicator.style.display = 'none';
      return;
    }

    indicator.style.display = '';

    var coverage = calculateCoverage(stubs);

    var html = '<div class="coverage-indicator__bar">';

    if (coverage.totalDays >= 30) {
      html += '<span class="coverage-indicator__icon coverage-indicator__icon--ok">&#10003;</span>';
      html += '<span>Coverage: ' + coverage.rangeLabel + ' (' + coverage.totalDays + ' days)</span>';
    } else if (coverage.totalDays > 0) {
      html += '<span class="coverage-indicator__icon coverage-indicator__icon--warn">&#9888;</span>';
      html += '<span>Coverage: ' + coverage.rangeLabel + ' (' + coverage.totalDays + ' days) &mdash; need 30 days</span>';
    } else {
      html += '<span class="coverage-indicator__icon coverage-indicator__icon--warn">&#9888;</span>';
      html += '<span>Could not determine coverage dates from stubs</span>';
    }

    html += '</div>';

    // Gaps warning
    if (coverage.gaps.length > 0) {
      html += '<div class="coverage-indicator__gaps">';
      html += '<strong>Gaps:</strong> ';
      coverage.gaps.forEach(function (gap, i) {
        if (i > 0) html += '; ';
        html += gap.label + ' (' + gap.days + ' day' + (gap.days > 1 ? 's' : '') + ')';
      });
      html += '</div>';
    }

    // Current-period base variance warning
    if (stubs.length >= 2) {
      var baseAmounts = stubs.map(function (s) { return s.currentBase || 0; }).filter(function (b) { return b > 0; });
      if (baseAmounts.length >= 2) {
        var minBase = Math.min.apply(null, baseAmounts);
        var maxBase = Math.max.apply(null, baseAmounts);
        if (minBase > 0) {
          var baseVar = (maxBase - minBase) / minBase;
          if (baseVar > 0.10) {
            html += '<div class="coverage-indicator__warn">';
            html += 'Current-period base varies ' + (baseVar * 100).toFixed(0) + '% across stubs &mdash; verify hours or comp change.';
            html += '</div>';
          }
        }
      }
    }

    indicator.innerHTML = html;
  }

  // ---- Clone / Reset ----

  function clonePanel() {
    var template = getPanels()[0];
    var clone = template.cloneNode(true);

    // Clear all input values
    $$('input[type="text"], input[type="number"], input[type="date"]', clone).forEach(function (inp) { inp.value = ''; });
    $$('select', clone).forEach(function (sel) { sel.selectedIndex = 0; });
    $$('input[type="checkbox"]', clone).forEach(function (cb) { cb.checked = false; });

    // Reset upload zones
    $$('.upload-zone', clone).forEach(function (zone) {
      zone.classList.remove('has-data', 'has-error', 'processing');
      var status = $('.upload-zone__status', zone);
      if (status) { status.className = 'upload-zone__status'; status.innerHTML = ''; }
    });

    // Clear stub cards, W-2 cards, coverage
    var stubCards = $('.stub-cards', clone);
    if (stubCards) stubCards.innerHTML = '';
    var w2Cards = $('.w2-cards', clone);
    if (w2Cards) w2Cards.innerHTML = '';
    var coverage = $('.coverage-indicator', clone);
    if (coverage) { coverage.style.display = 'none'; coverage.innerHTML = ''; }

    // Reset hourly fields
    var hourlyFields = $('.emp-hourly-fields', clone);
    if (hourlyFields) hourlyFields.style.display = 'none';
    var rateLabel = $('.emp-rate-label', clone);
    if (rateLabel) rateLabel.textContent = 'Annual Salary';

    container.appendChild(clone);
    reindexPanels();
    initPayTypeToggle(clone);
    initUploadZone(clone);

    // Bind remove button
    var removeBtn = $('.remove-emp-btn', clone);
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        var idx = parseInt(clone.getAttribute('data-emp-index'), 10);
        stubStore.delete(idx);
        w2Store.delete(idx);
        clone.remove();
        reindexPanels();
      });
    }
  }

  function resetAll() {
    // Remove extra panels
    var panels = getPanels();
    for (var i = panels.length - 1; i > 0; i--) {
      panels[i].remove();
    }

    // Clear stores
    stubStore.clear();
    w2Store.clear();

    // Clear first panel
    var first = getPanels()[0];
    $$('input[type="text"], input[type="number"], input[type="date"]', first).forEach(function (inp) { inp.value = ''; });
    $$('select', first).forEach(function (sel) { sel.selectedIndex = 0; });
    $$('input[type="checkbox"]', first).forEach(function (cb) { cb.checked = false; });

    // Reset upload zones
    $$('.upload-zone', first).forEach(function (zone) {
      zone.classList.remove('has-data', 'has-error', 'processing');
      var status = $('.upload-zone__status', zone);
      if (status) { status.className = 'upload-zone__status'; status.innerHTML = ''; }
    });

    // Clear stub cards, W-2 cards, coverage
    var stubCards = $('.stub-cards', first);
    if (stubCards) stubCards.innerHTML = '';
    var w2Cards = $('.w2-cards', first);
    if (w2Cards) w2Cards.innerHTML = '';
    var coverage = $('.coverage-indicator', first);
    if (coverage) { coverage.style.display = 'none'; coverage.innerHTML = ''; }

    // Reset hourly fields display
    var hourlyFields = $('.emp-hourly-fields', first);
    if (hourlyFields) hourlyFields.style.display = 'none';
    var rateLabel = $('.emp-rate-label', first);
    if (rateLabel) rateLabel.textContent = 'Annual Salary';

    resultsSection.style.display = 'none';
    reindexPanels();
  }

  // ---- Gather Input from Panel ----

  function gatherPanelInput(panel) {
    var payType = valStr($('.emp-pay-type', panel));
    var payFreq = valStr($('.emp-pay-frequency', panel));
    var baseRate = valNum($('.emp-base-rate', panel));
    var hoursPerWeek = valNum($('.emp-hours-per-week', panel)) || null;
    var hoursFluctuate = $('.emp-hours-fluctuate', panel).checked;
    var asOfDate = valStr($('.emp-as-of-date', panel));
    var payPeriodsYTD = valNum($('.emp-pay-periods-ytd', panel));
    var compChange = $('.emp-comp-change', panel).checked;

    // Use today if no as-of date entered
    if (!asOfDate) {
      var today = new Date();
      asOfDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    }

    var priorYears = [];
    var currentYear = new Date().getFullYear();

    var p1Base = valNum($('.emp-prior1-base', panel));
    var p1OT = valNum($('.emp-prior1-overtime', panel));
    var p1Bonus = valNum($('.emp-prior1-bonus', panel));
    var p1Comm = valNum($('.emp-prior1-commission', panel));
    if (p1Base > 0 || p1OT > 0 || p1Bonus > 0 || p1Comm > 0) {
      priorYears.push({ year: currentYear - 1, base: p1Base, overtime: p1OT, bonus: p1Bonus, commission: p1Comm });
    }

    var p2Base = valNum($('.emp-prior2-base', panel));
    var p2OT = valNum($('.emp-prior2-overtime', panel));
    var p2Bonus = valNum($('.emp-prior2-bonus', panel));
    var p2Comm = valNum($('.emp-prior2-commission', panel));
    if (p2Base > 0 || p2OT > 0 || p2Bonus > 0 || p2Comm > 0) {
      priorYears.push({ year: currentYear - 2, base: p2Base, overtime: p2OT, bonus: p2Bonus, commission: p2Comm });
    }

    return {
      employerName: valStr($('.emp-employer-name', panel)),
      asOfDateISO: asOfDate,
      basePayType: payType,
      payFrequency: payFreq,
      baseRateAnnualOrHourly: baseRate,
      expectedHoursPerWeek: hoursPerWeek,
      hoursFluctuate: hoursFluctuate,
      payPeriodsYTD: payPeriodsYTD,
      ytd: {
        base: valNum($('.emp-ytd-base', panel)),
        overtime: valNum($('.emp-ytd-overtime', panel)),
        bonus: valNum($('.emp-ytd-bonus', panel)),
        commission: valNum($('.emp-ytd-commission', panel))
      },
      priorYears: priorYears,
      employerCount: 1,
      jobChangedOrNewRole: compChange,
      hasEmploymentGap: false
    };
  }

  // ---- Calculate & Render Results ----

  function calculate() {
    var panels = getPanels();
    var allResults = [];
    var totalBase = 0, totalOT = 0, totalBonus = 0, totalComm = 0;
    var allFlags = [];
    var allDocs = [];
    var allNotes = [];
    var calcSteps = [];

    panels.forEach(function (panel, i) {
      var input = gatherPanelInput(panel);
      input.employerCount = panels.length;

      var result = underwriteVariableIncome(input);
      result.employerName = input.employerName || ('Employment ' + (i + 1));
      allResults.push(result);

      totalBase += result.monthlyByType.base;
      totalOT += result.monthlyByType.overtime;
      totalBonus += result.monthlyByType.bonus;
      totalComm += result.monthlyByType.commission;

      // Stub-based flags
      var empIndex = parseInt(panel.getAttribute('data-emp-index'), 10);
      var stubs = getStubs(empIndex);

      if (stubs.length > 0) {
        var coverage = calculateCoverage(stubs);

        if (coverage.totalDays > 0 && coverage.totalDays < 30) {
          addFlag(result.flags, 'warn', 'COVERAGE_SHORT',
            'Paystub coverage is ' + coverage.totalDays + ' days for ' + result.employerName + '; Fannie Mae B3-3.1-02 requires at least 30 days.');
        }

        if (coverage.gaps.length > 0) {
          addFlag(result.flags, 'info', 'STUB_GAPS',
            'Gaps detected between paystub periods for ' + result.employerName + '. Verify continuous employment.');
        }

        // Current-period base variance
        if (stubs.length >= 2) {
          var baseAmounts = stubs.map(function (s) { return s.currentBase || 0; }).filter(function (b) { return b > 0; });
          if (baseAmounts.length >= 2) {
            var minB = Math.min.apply(null, baseAmounts);
            var maxB = Math.max.apply(null, baseAmounts);
            if (minB > 0 && (maxB - minB) / minB > 0.10) {
              addFlag(result.flags, 'warn', 'STUB_BASE_VARIANCE',
                'Current-period base varies >10% across stubs for ' + result.employerName + '. Possible hours fluctuation or comp change.');
            }
          }
        }
      }

      // Merge flags and docs
      result.flags.forEach(function (f) {
        var dup = allFlags.some(function (ef) { return ef.code === f.code && ef.message === f.message; });
        if (!dup) allFlags.push(f);
      });
      result.docsRequired.forEach(function (d) {
        if (allDocs.indexOf(d) === -1) allDocs.push(d);
      });
      result.notes.forEach(function (n) {
        allNotes.push('[' + result.employerName + '] ' + n);
      });

      // Build calc steps
      calcSteps.push('<strong>' + escHtml(result.employerName) + '</strong>');
      calcSteps.push('  Base: ' + fmt(result.monthlyByType.base) + '/mo');
      if (result.monthlyByType.overtime > 0) calcSteps.push('  Overtime: ' + fmt(result.monthlyByType.overtime) + '/mo');
      if (result.monthlyByType.bonus > 0) calcSteps.push('  Bonus: ' + fmt(result.monthlyByType.bonus) + '/mo');
      if (result.monthlyByType.commission > 0) calcSteps.push('  Commission: ' + fmt(result.monthlyByType.commission) + '/mo');
      calcSteps.push('  Subtotal: ' + fmt(result.monthlyUsable) + '/mo');
      calcSteps.push('');
    });

    var totalVariable = totalOT + totalBonus + totalComm;
    var totalMonthly = totalBase + totalVariable;

    // Summary cards
    document.getElementById('resultMonthlyBase').textContent = fmt(totalBase);
    document.getElementById('resultMonthlyVariable').textContent = fmt(totalVariable);
    document.getElementById('resultMonthlyTotal').textContent = fmt(totalMonthly);
    document.getElementById('resultQualifyingIncome').textContent = fmt(totalMonthly);

    // Per-employment breakdown tables
    var breakdownContainer = document.getElementById('empBreakdownContainer');
    breakdownContainer.innerHTML = '';

    allResults.forEach(function (r) {
      var div = document.createElement('div');
      div.className = 'calc-section emp-breakdown';

      var html = '<h3>' + escHtml(r.employerName) + ' — Income Breakdown</h3>';
      html += '<table class="breakdown-table">';
      html += '<thead><tr><th>Type</th><th>Monthly</th><th>Annual</th><th>Trend</th></tr></thead>';
      html += '<tbody>';

      var types = [
        { key: 'base', label: 'Base' },
        { key: 'overtime', label: 'Overtime' },
        { key: 'bonus', label: 'Bonus' },
        { key: 'commission', label: 'Commission' }
      ];

      types.forEach(function (t) {
        var monthly = r.monthlyByType[t.key] || 0;
        if (monthly > 0 || t.key === 'base') {
          var trendNote = '';
          r.notes.forEach(function (n) {
            if (n.indexOf(t.label) === 0) {
              if (n.indexOf('Stable') !== -1 || n.indexOf('increasing') !== -1) trendNote = '<span class="trend-stable">Stable/Up</span>';
              else if (n.indexOf('Declining') !== -1) trendNote = '<span class="trend-declining">Declining</span>';
              else if (n.indexOf('stabilized') !== -1) trendNote = '<span class="trend-stable">Stabilized</span>';
            }
          });
          html += '<tr><td>' + t.label + '</td><td>' + fmt(monthly) + '</td><td>' + fmt(monthly * 12) + '</td><td>' + (trendNote || '\u2014') + '</td></tr>';
        }
      });

      html += '<tr><td><strong>Total</strong></td><td><strong>' + fmt(r.monthlyUsable) + '</strong></td><td><strong>' + fmt(r.monthlyUsable * 12) + '</strong></td><td></td></tr>';
      html += '</tbody></table>';
      div.innerHTML = html;
      breakdownContainer.appendChild(div);
    });

    // Flags
    var flagsContainer = document.getElementById('flagsContainer');
    if (allFlags.length === 0) {
      flagsContainer.innerHTML = '<p style="font-size: 0.85rem; color: var(--color-gray-500);">No flags or observations.</p>';
    } else {
      var flagHtml = '<ul class="flag-list">';
      allFlags.forEach(function (f) {
        flagHtml += '<li class="flag-item flag-item--' + f.severity + '">';
        flagHtml += '<span class="flag-badge">' + f.severity + '</span>';
        flagHtml += '<span>' + escHtml(f.message) + '</span>';
        flagHtml += '</li>';
      });
      flagHtml += '</ul>';
      flagsContainer.innerHTML = flagHtml;
    }

    // Documentation
    var docsContainer = document.getElementById('docsContainer');
    if (allDocs.length === 0) {
      docsContainer.innerHTML = '<p style="font-size: 0.85rem; color: var(--color-gray-500);">No additional documentation required.</p>';
    } else {
      var docHtml = '<ul class="doc-list">';
      allDocs.forEach(function (d) {
        docHtml += '<li>' + escHtml(d) + '</li>';
      });
      docHtml += '</ul>';
      docsContainer.innerHTML = docHtml;
    }

    // Calc steps
    var stepsEl = document.getElementById('calcSteps-var-income');
    if (stepsEl) {
      var stepsHtml = '<pre style="white-space: pre-wrap; font-size: 0.85rem; line-height: 1.6;">';
      calcSteps.forEach(function (line) { stepsHtml += line + '\n'; });
      if (allNotes.length > 0) {
        stepsHtml += '\nTrending Notes:\n';
        allNotes.forEach(function (n) { stepsHtml += '  \u2022 ' + escHtml(n) + '\n'; });
      }
      stepsHtml += '</pre>';
      stepsEl.innerHTML = stepsHtml;
    }

    resultsSection.style.display = '';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Initialize ----

  var firstPanel = getPanels()[0];
  initPayTypeToggle(firstPanel);
  initUploadZone(firstPanel);
  updatePriorYearLabels();

  // Bind first panel's remove button (hidden for index 0)
  var firstRemoveBtn = $('.remove-emp-btn', firstPanel);
  if (firstRemoveBtn) {
    firstRemoveBtn.addEventListener('click', function () {
      // Should never fire for index 0
    });
  }

  addBtn.addEventListener('click', clonePanel);
  calcBtn.addEventListener('click', calculate);
  resetBtn.addEventListener('click', resetAll);

})();
