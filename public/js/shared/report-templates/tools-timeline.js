/* Report template: Loan Timeline */
(function () {
  'use strict';
  var RT = MSFG.ReportTemplates;
  var h = RT.helpers;
  var txt = h.txt;

  var LT_CATEGORY_COLORS = {
    milestone: '#22c55e', deadline: '#f59e0b', lock: '#3b82f6',
    contingency: '#f87171', condition: '#8b5cf6', turntime: '#06b6d4'
  };
  var LT_CATEGORY_LABELS = {
    milestone: 'Milestones', deadline: 'Deadlines', lock: 'Rate Lock',
    contingency: 'Contingencies', condition: 'Conditions', turntime: 'Turntimes'
  };

  RT.register('loan-timeline',
    /* ---- Extractor ---- */
    function (doc) {
      /* Loan info bar */
      var borrower = txt(doc, 'ltBorrower');
      var fileNum = txt(doc, 'ltFileNum');
      var purpose = txt(doc, 'ltPurpose');
      var program = txt(doc, 'ltProgram');
      var loanPurpose = '';
      var lpSel = doc.getElementById('ltLoanPurpose');
      if (lpSel) loanPurpose = lpSel.value;

      /* Standard dates + visibility */
      var dateRows = doc.querySelectorAll('.lt-date-row');
      var dates = [];
      dateRows.forEach(function (row) {
        var input = row.querySelector('input[type="date"]');
        var toggle = row.querySelector('.lt-toggle');
        var label = row.querySelector('label');
        if (!input || !input.dataset.event) return;
        var cat = '';
        var group = row.closest('[data-category]');
        if (group) cat = group.getAttribute('data-category');
        dates.push({
          id: input.dataset.event,
          label: label ? label.textContent.trim() : input.dataset.event,
          date: input.value || '',
          category: cat,
          visible: toggle ? toggle.checked : true
        });
      });

      /* Custom dates */
      var customDates = [];
      var customRows = doc.querySelectorAll('.lt-custom-row');
      customRows.forEach(function (row) {
        var nameInput = row.querySelector('input[type="text"]');
        var dateInput = row.querySelector('input[type="date"]');
        var catSelect = row.querySelector('select');
        if (nameInput && dateInput && dateInput.value) {
          customDates.push({
            label: nameInput.value || 'Custom',
            date: dateInput.value,
            category: catSelect ? catSelect.value : 'milestone'
          });
        }
      });

      /* TRID alerts */
      var alerts = [];
      var alertEls = doc.querySelectorAll('.lt-alert');
      alertEls.forEach(function (a) {
        var icon = a.querySelector('.lt-alert__icon');
        var msg = a.querySelector('.lt-alert__msg, span:last-child');
        var type = 'info';
        if (a.classList.contains('lt-alert--ok')) type = 'ok';
        else if (a.classList.contains('lt-alert--warn')) type = 'warn';
        else if (a.classList.contains('lt-alert--danger')) type = 'danger';
        alerts.push({
          type: type,
          icon: icon ? icon.textContent.trim() : '',
          text: msg ? msg.textContent.trim() : a.textContent.trim()
        });
      });

      /* Notes */
      var notesEl = doc.getElementById('ltNotes');
      var notes = notesEl ? notesEl.value : '';

      /* Extract application and funding dates for timeline bar */
      var applicationDate = '';
      var fundingDate = '';
      dates.forEach(function (d) {
        if (d.id === 'applicationTaken' && d.date) applicationDate = d.date;
        if (d.id === 'fundingEstimate' && d.date) fundingDate = d.date;
      });

      /* Collect all visible events for timeline dots */
      var timelineEvents = [];
      dates.forEach(function (d) {
        if (d.date && d.visible) {
          timelineEvents.push({ date: d.date, category: d.category, label: d.label });
        }
      });
      customDates.forEach(function (d) {
        if (d.date) {
          timelineEvents.push({ date: d.date, category: d.category, label: d.label });
        }
      });

      return {
        borrower: borrower, fileNum: fileNum, purpose: purpose, program: program,
        loanPurpose: loanPurpose, dates: dates, customDates: customDates,
        alerts: alerts, notes: notes,
        applicationDate: applicationDate, fundingDate: fundingDate,
        timelineEvents: timelineEvents
      };
    },

    /* ---- HTML Renderer ---- */
    function (data) {
      var html = '';
      var dates = data.dates || [];
      var customDates = data.customDates || [];
      var alerts = data.alerts || [];

      /* Dot helper */
      function dot(color) {
        return '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + color + ';margin-right:6px;vertical-align:middle"></span>';
      }
      function formatDate(iso) {
        if (!iso) return '\u2014';
        var parts = iso.split('-');
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
      }

      /* Loan Info */
      if (data.borrower || data.fileNum || data.purpose || data.program) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">Loan Information</h4>';
        html += '<div class="rpt-params">';
        if (data.borrower) html += '<div class="rpt-param"><span>Borrower</span><span>' + MSFG.escHtml(data.borrower) + '</span></div>';
        if (data.fileNum) html += '<div class="rpt-param"><span>File #</span><span>' + MSFG.escHtml(data.fileNum) + '</span></div>';
        if (data.purpose) html += '<div class="rpt-param"><span>Purpose</span><span>' + MSFG.escHtml(data.purpose) + '</span></div>';
        if (data.program) html += '<div class="rpt-param"><span>Program</span><span>' + MSFG.escHtml(data.program) + '</span></div>';
        if (data.loanPurpose) html += '<div class="rpt-param"><span>TRID Purpose</span><span>' + MSFG.escHtml(data.loanPurpose) + '</span></div>';
        html += '</div></div>';
      }

      /* Timeline Progress Bar */
      var appDate = data.applicationDate || '';
      var fundDate = data.fundingDate || '';
      var tlEvents = data.timelineEvents || [];

      if (appDate && fundDate) {
        var appMs = new Date(appDate + 'T00:00:00').getTime();
        var fundMs = new Date(fundDate + 'T00:00:00').getTime();
        var nowMs = Date.now();
        var totalSpan = fundMs - appMs;
        var progressPct = totalSpan > 0 ? Math.max(0, Math.min(100, ((nowMs - appMs) / totalSpan) * 100)) : 0;

        html += '<div class="rpt-section">';
        html += '<h4 class="rpt-section-title">Timeline Progress</h4>';
        html += '<div style="padding:16px 20px;background:#fafafa;border:1px solid #e5e7eb;border-radius:8px">';

        /* Labels row */
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
        html += '<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e"></span><span style="font-size:0.8rem;font-weight:700;color:#333">APPLICATION</span><span style="font-size:0.72rem;color:#888">' + formatDate(appDate) + '</span></div>';
        html += '<div style="display:flex;align-items:center;gap:6px"><span style="font-size:0.72rem;color:#888">' + formatDate(fundDate) + '</span><span style="font-size:0.8rem;font-weight:700;color:#333">FUNDED</span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f59e0b"></span></div>';
        html += '</div>';

        /* Track */
        html += '<div style="position:relative;height:12px;background:#e5e7eb;border-radius:6px;overflow:visible">';

        /* Green fill */
        html += '<div style="position:absolute;top:0;left:0;height:100%;width:' + progressPct.toFixed(1) + '%;background:linear-gradient(90deg,#22c55e,#16a34a);border-radius:6px;transition:width 0.3s"></div>';

        /* Today marker */
        if (progressPct > 0 && progressPct < 100) {
          html += '<div style="position:absolute;top:-3px;left:' + progressPct.toFixed(1) + '%;transform:translateX(-50%);width:18px;height:18px;background:#fff;border:2px solid #16a34a;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div>';
        }

        /* Event dots */
        if (totalSpan > 0) {
          tlEvents.forEach(function (ev) {
            var evMs = new Date(ev.date + 'T00:00:00').getTime();
            var evPct = Math.max(0, Math.min(100, ((evMs - appMs) / totalSpan) * 100));
            var evColor = LT_CATEGORY_COLORS[ev.category] || '#888';
            html += '<div style="position:absolute;top:50%;left:' + evPct.toFixed(1) + '%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:' + evColor + ';border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,0.15);cursor:default" title="' + MSFG.escHtml(ev.label) + ' \u2014 ' + formatDate(ev.date) + '"></div>';
          });
        }

        html += '</div>'; /* end track */

        /* Progress text */
        var daysElapsed = Math.floor((Math.min(nowMs, fundMs) - appMs) / 86400000);
        var daysTotal = Math.floor(totalSpan / 86400000);
        var daysRemaining = Math.max(0, daysTotal - daysElapsed);
        html += '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:0.72rem;color:#888">';
        html += '<span>Day ' + Math.max(0, daysElapsed) + ' of ' + daysTotal + '</span>';
        if (nowMs < fundMs) {
          html += '<span>' + daysRemaining + ' day' + (daysRemaining !== 1 ? 's' : '') + ' remaining</span>';
        } else if (nowMs >= fundMs) {
          html += '<span style="color:#22c55e;font-weight:600">Complete</span>';
        }
        html += '</div>';

        html += '</div>'; /* end container */
        html += '</div>'; /* end rpt-section */
      }

      /* Calendar */
      var allDates = [];
      dates.forEach(function (d) { if (d.date && d.visible) allDates.push({ date: d.date, cat: d.category, label: d.label }); });
      customDates.forEach(function (d) { if (d.date) allDates.push({ date: d.date, cat: d.category, label: d.label }); });

      if (allDates.length) {
        /* Figure out which months to render */
        var monthSet = {};
        allDates.forEach(function (d) {
          var key = d.date.substring(0, 7); // YYYY-MM
          monthSet[key] = true;
        });
        var monthKeys = Object.keys(monthSet).sort();

        html += '<div class="rpt-section"><h4 class="rpt-section-title">Calendar</h4>';
        html += '<div style="display:flex;flex-direction:column;gap:24px;align-items:center">';

        monthKeys.forEach(function (mk) {
          var parts = mk.split('-');
          var year = parseInt(parts[0], 10);
          var month = parseInt(parts[1], 10) - 1;
          var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          var firstDay = new Date(year, month, 1).getDay();
          var daysInMonth = new Date(year, month + 1, 0).getDate();
          var today = new Date();

          /* Events for this month */
          var eventsInMonth = {};
          allDates.forEach(function (d) {
            if (d.date.substring(0, 7) === mk) {
              var day = parseInt(d.date.substring(8, 10), 10);
              if (!eventsInMonth[day]) eventsInMonth[day] = [];
              eventsInMonth[day].push(d);
            }
          });

          html += '<div style="width:100%;max-width:540px;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden;background:#fff">';
          html += '<div style="font-weight:800;font-size:1.05rem;padding:10px 0;text-align:center;background:#f8fafc;border-bottom:1px solid #e5e7eb;color:#1e293b;letter-spacing:0.02em">' + months[month] + ' ' + year + '</div>';
          html += '<table style="border-collapse:collapse;font-size:0.72rem;width:100%">';
          html += '<thead><tr>';
          ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function (d) {
            html += '<th style="padding:6px 4px;text-align:center;color:#64748b;font-weight:700;font-size:0.7rem;background:#f1f5f9;border-bottom:2px solid #e2e8f0">' + d + '</th>';
          });
          html += '</tr></thead><tbody><tr>';

          /* Leading empty cells */
          for (var e = 0; e < firstDay; e++) {
            html += '<td style="padding:5px 4px;border:1px solid #f0f0f0"></td>';
          }

          for (var d = 1; d <= daysInMonth; d++) {
            var cellIdx = (firstDay + d - 1) % 7;
            var isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            var hasEvents = !!eventsInMonth[d];
            var bg = isToday ? '#f0fdf4' : (hasEvents ? '#fefce8' : '');
            html += '<td style="padding:5px 4px;text-align:left;vertical-align:top;min-width:36px;min-height:44px;border:1px solid #f0f0f0;' + (bg ? 'background:' + bg + ';' : '') + '">';
            html += '<div style="font-size:0.72rem;margin-bottom:2px;' + (isToday ? 'font-weight:700;color:#22c55e' : 'color:#555') + '">' + d + '</div>';
            if (eventsInMonth[d]) {
              eventsInMonth[d].forEach(function (ev) {
                var color = LT_CATEGORY_COLORS[ev.cat] || '#888';
                html += '<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px;line-height:1.2">';
                html += '<span style="width:6px;height:6px;min-width:6px;border-radius:50%;background:' + color + ';display:inline-block"></span>';
                html += '<span style="font-size:0.65rem;color:' + color + ';font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">' + MSFG.escHtml(ev.label) + '</span>';
                html += '</div>';
              });
            }
            html += '</td>';
            if (cellIdx === 6 && d < daysInMonth) html += '</tr><tr>';
          }

          /* Trailing empty cells */
          var lastCellIdx = (firstDay + daysInMonth - 1) % 7;
          for (var t = lastCellIdx + 1; t < 7; t++) {
            html += '<td style="padding:5px 4px;border:1px solid #f0f0f0"></td>';
          }
          html += '</tr></tbody></table></div>';
        });

        html += '</div>';

        /* Legend */
        html += '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:0.72rem;color:#666;justify-content:center">';
        var cats = ['milestone', 'deadline', 'lock', 'contingency', 'condition', 'turntime'];
        cats.forEach(function (c) {
          html += '<span>' + dot(LT_CATEGORY_COLORS[c]) + LT_CATEGORY_LABELS[c] + '</span>';
        });
        html += '</div>';
        html += '</div>';
      }

      /* TRID Alerts */
      if (alerts.length) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">TRID Compliance</h4>';
        alerts.forEach(function (a) {
          var bg = '#e3f2fd', border = '#90caf9', color = '#1565c0';
          if (a.type === 'ok') { bg = '#e8f5e9'; border = '#a5d6a7'; color = '#2e7d32'; }
          else if (a.type === 'warn') { bg = '#fff8e1'; border = '#ffcc80'; color = '#e65100'; }
          else if (a.type === 'danger') { bg = '#ffebee'; border = '#ef9a9a'; color = '#c62828'; }
          html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 10px;border-radius:6px;margin-bottom:6px;font-size:0.8rem;line-height:1.4;background:' + bg + ';border:1px solid ' + border + ';color:' + color + '">';
          html += '<span style="flex-shrink:0">' + (a.icon || '') + '</span>';
          html += '<span>' + MSFG.escHtml(a.text) + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      /* Notes */
      if (data.notes) {
        html += '<div class="rpt-section"><h4 class="rpt-section-title">Notes</h4>';
        html += '<div style="white-space:pre-wrap;font-size:0.85rem;line-height:1.5;color:#333">' + MSFG.escHtml(data.notes) + '</div>';
        html += '</div>';
      }

      return html;
    },

    /* ---- PDF Generator ---- */
    function (data) {
      var dates = data.dates || [];
      var customDates = data.customDates || [];
      var alerts = data.alerts || [];
      var content = [];

      var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      function formatDate(iso) {
        if (!iso) return '\u2014';
        var parts = iso.split('-');
        return monthNamesShort[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
      }

      /* Loan Info */
      var infoRows = [];
      if (data.borrower) infoRows.push(['Borrower', data.borrower]);
      if (data.fileNum) infoRows.push(['File #', data.fileNum]);
      if (data.purpose) infoRows.push(['Purpose', data.purpose]);
      if (data.program) infoRows.push(['Program', data.program]);
      if (data.loanPurpose) infoRows.push(['TRID Purpose', data.loanPurpose]);
      if (infoRows.length) {
        var infoBody = [[{ text: 'Loan Information', style: 'tableHeader' }, { text: '', style: 'tableHeader' }]];
        infoRows.forEach(function (r) { infoBody.push([r[0], { text: r[1], alignment: 'right' }]); });
        content.push({ table: { headerRows: 1, widths: ['*', 160], body: infoBody }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 8] });
      }

      /* Timeline Progress Summary */
      var appDate = data.applicationDate || '';
      var fundDate = data.fundingDate || '';
      var tlEvents = data.timelineEvents || [];

      if (appDate && fundDate) {
        var appMs = new Date(appDate + 'T00:00:00').getTime();
        var fundMs = new Date(fundDate + 'T00:00:00').getTime();
        var nowMs = Date.now();
        var totalSpan = fundMs - appMs;
        var daysElapsed = Math.floor((Math.min(nowMs, fundMs) - appMs) / 86400000);
        var daysTotal = Math.floor(totalSpan / 86400000);
        var daysRemaining = Math.max(0, daysTotal - Math.max(0, daysElapsed));
        var progressPct = totalSpan > 0 ? Math.max(0, Math.min(100, ((nowMs - appMs) / totalSpan) * 100)) : 0;

        content.push({ text: 'Timeline Progress', style: 'sectionHeader', margin: [0, 10, 0, 4] });
        content.push({ text: 'Day ' + Math.max(0, daysElapsed) + ' of ' + daysTotal + '  \u2014  Application: ' + formatDate(appDate) + '  \u2192  Funding: ' + formatDate(fundDate), fontSize: 9, color: '#333', margin: [0, 0, 0, 4] });

        /* Text-based progress bar */
        var barLen = 40;
        var filledLen = Math.round((progressPct / 100) * barLen);
        var emptyLen = barLen - filledLen;
        var barFilled = '';
        var barEmpty = '';
        for (var bi = 0; bi < filledLen; bi++) barFilled += '\u2588';
        for (var bj = 0; bj < emptyLen; bj++) barEmpty += '\u2591';
        content.push({
          text: [
            { text: barFilled, color: '#22c55e', fontSize: 10 },
            { text: barEmpty, color: '#e5e7eb', fontSize: 10 },
            { text: '  ' + Math.round(progressPct) + '%', fontSize: 8, color: '#666' }
          ],
          margin: [0, 0, 0, 2]
        });

        if (nowMs >= fundMs) {
          content.push({ text: 'Status: Complete', fontSize: 8, color: '#22c55e', bold: true, margin: [0, 0, 0, 4] });
        } else {
          content.push({ text: daysRemaining + ' day' + (daysRemaining !== 1 ? 's' : '') + ' remaining', fontSize: 8, color: '#888', margin: [0, 0, 0, 4] });
        }

        /* Event list on timeline */
        if (tlEvents.length) {
          var evBody = [[
            { text: 'Date', style: 'tableHeader' },
            { text: 'Event', style: 'tableHeader' },
            { text: 'Category', style: 'tableHeader' },
            { text: 'Day', style: 'tableHeader', alignment: 'right' }
          ]];
          var sortedEvents = tlEvents.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
          sortedEvents.forEach(function (ev) {
            var evMs = new Date(ev.date + 'T00:00:00').getTime();
            var evDay = totalSpan > 0 ? Math.floor((evMs - appMs) / 86400000) : 0;
            var catColor = LT_CATEGORY_COLORS[ev.category] || '#888';
            var catLabel = LT_CATEGORY_LABELS[ev.category] || ev.category || '';
            evBody.push([
              { text: formatDate(ev.date), fontSize: 7 },
              { text: ev.label, fontSize: 7 },
              { text: '\u25CF ' + catLabel, fontSize: 7, color: catColor },
              { text: String(evDay), fontSize: 7, alignment: 'right' }
            ]);
          });
          content.push({ table: { headerRows: 1, widths: [70, '*', 80, 30], body: evBody }, layout: 'lightHorizontalLines', margin: [0, 4, 0, 8] });
        }
      }

      /* Calendar Months */
      var allDates = [];
      dates.forEach(function (d) { if (d.date && d.visible) allDates.push({ date: d.date, cat: d.category, label: d.label }); });
      customDates.forEach(function (d) { if (d.date) allDates.push({ date: d.date, cat: d.category, label: d.label }); });

      if (allDates.length) {
        /* Determine which months to render */
        var monthSet = {};
        allDates.forEach(function (d) {
          var key = d.date.substring(0, 7);
          monthSet[key] = true;
        });
        var monthKeys = Object.keys(monthSet).sort();

        content.push({ text: 'Calendar', style: 'sectionHeader', margin: [0, 10, 0, 6] });

        monthKeys.forEach(function (mk) {
          var parts = mk.split('-');
          var year = parseInt(parts[0], 10);
          var month = parseInt(parts[1], 10) - 1;
          var firstDay = new Date(year, month, 1).getDay();
          var daysInMonth = new Date(year, month + 1, 0).getDate();
          var today = new Date();

          /* Events for this month indexed by day */
          var eventsInMonth = {};
          allDates.forEach(function (d) {
            if (d.date.substring(0, 7) === mk) {
              var day = parseInt(d.date.substring(8, 10), 10);
              if (!eventsInMonth[day]) eventsInMonth[day] = [];
              eventsInMonth[day].push(d);
            }
          });

          /* Month title */
          content.push({ text: monthNames[month] + ' ' + year, fontSize: 10, bold: true, color: '#1e293b', alignment: 'center', margin: [0, 6, 0, 4] });

          /* Build calendar grid as pdfmake table */
          var dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
          var calBody = [];

          /* Header row */
          var headerRow = dayHeaders.map(function (dh) {
            return { text: dh, bold: true, fontSize: 7, alignment: 'center', color: '#64748b', fillColor: '#f1f5f9', margin: [0, 3, 0, 3] };
          });
          calBody.push(headerRow);

          /* Build weeks */
          var cells = [];
          /* Leading empty cells */
          for (var e = 0; e < firstDay; e++) {
            cells.push({ text: '', fillColor: '#fafafa', margin: [0, 2, 0, 2] });
          }

          for (var d = 1; d <= daysInMonth; d++) {
            var isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            var hasEvents = !!eventsInMonth[d];
            var fillColor = isToday ? '#f0fdf4' : (hasEvents ? '#fefce8' : '#ffffff');

            var cellContent = [];
            /* Day number */
            cellContent.push({ text: String(d), fontSize: 7, bold: isToday, color: isToday ? '#22c55e' : '#555' });
            /* Event dots */
            if (eventsInMonth[d]) {
              eventsInMonth[d].forEach(function (ev) {
                var color = LT_CATEGORY_COLORS[ev.cat] || '#888';
                cellContent.push({ text: '\u25CF ' + ev.label, fontSize: 5, color: color, margin: [0, 1, 0, 0] });
              });
            }

            cells.push({
              stack: cellContent,
              fillColor: fillColor,
              margin: [1, 2, 1, 2]
            });
          }

          /* Trailing empty cells to complete the last week */
          var remainder = cells.length % 7;
          if (remainder > 0) {
            for (var t = remainder; t < 7; t++) {
              cells.push({ text: '', fillColor: '#fafafa', margin: [0, 2, 0, 2] });
            }
          }

          /* Split cells into rows of 7 */
          for (var ri = 0; ri < cells.length; ri += 7) {
            calBody.push(cells.slice(ri, ri + 7));
          }

          var colW = (515 - 14) / 7; // page width ~515pt, slight margin
          content.push({
            table: {
              headerRows: 1,
              widths: [colW, colW, colW, colW, colW, colW, colW],
              body: calBody
            },
            layout: {
              hLineWidth: function () { return 0.5; },
              vLineWidth: function () { return 0.5; },
              hLineColor: function () { return '#e5e7eb'; },
              vLineColor: function () { return '#e5e7eb'; },
              paddingLeft: function () { return 2; },
              paddingRight: function () { return 2; },
              paddingTop: function () { return 1; },
              paddingBottom: function () { return 1; }
            },
            margin: [0, 0, 0, 4]
          });
        });

        /* Legend */
        var cats = ['milestone', 'deadline', 'lock', 'contingency', 'condition', 'turntime'];
        var legendItems = cats.map(function (c) {
          return { text: [{ text: '\u25CF ', color: LT_CATEGORY_COLORS[c], fontSize: 9 }, { text: LT_CATEGORY_LABELS[c], fontSize: 7, color: '#666' }] };
        });
        content.push({ columns: legendItems, margin: [0, 6, 0, 8] });
      }

      /* TRID Alerts */
      if (alerts.length) {
        content.push({ text: 'TRID Compliance', style: 'sectionHeader', margin: [0, 10, 0, 4] });
        alerts.forEach(function (a) {
          var color = '#1565c0';
          var bgColor = '#e3f2fd';
          if (a.type === 'ok') { color = '#2e7d32'; bgColor = '#e8f5e9'; }
          else if (a.type === 'warn') { color = '#e65100'; bgColor = '#fff8e1'; }
          else if (a.type === 'danger') { color = '#c62828'; bgColor = '#ffebee'; }
          content.push({
            table: {
              widths: ['*'],
              body: [[{ text: (a.icon ? a.icon + ' ' : '') + a.text, fontSize: 8, color: color, fillColor: bgColor, margin: [4, 3, 4, 3] }]]
            },
            layout: {
              hLineWidth: function () { return 0.5; },
              vLineWidth: function () { return 0.5; },
              hLineColor: function () { return '#e0e0e0'; },
              vLineColor: function () { return '#e0e0e0'; }
            },
            margin: [0, 1, 0, 1]
          });
        });
      }

      /* Notes */
      if (data.notes) {
        content.push({ text: 'Notes', style: 'sectionHeader', margin: [0, 10, 0, 4] });
        content.push({ text: data.notes, fontSize: 8, color: '#333', margin: [0, 0, 0, 4] });
      }

      return content;
    }
  );
})();
