/* =====================================================
   REFI PDF — PDF Report Generator
   Mountain State Financial Group

   Uses jsPDF to build a professional PDF report
   with all analysis results, tables, and chart images.
   ===================================================== */

const RefiPDF = (() => {
    'use strict';

    const { jsPDF } = window.jspdf;

    // Brand colors (RGB arrays for jsPDF)
    const COLORS = {
        primary: [45, 106, 79],
        secondary: [27, 67, 50],
        accent: [64, 145, 108],
        dark: [44, 62, 80],
        gray: [108, 117, 125],
        lightGray: [248, 249, 250],
        white: [255, 255, 255],
        success: [40, 167, 69],
        warning: [255, 193, 7],
        danger: [220, 53, 69],
        tableBorder: [222, 226, 230],
        tableHeader: [45, 106, 79],
        tableStripe: [245, 247, 245]
    };

    // Page dimensions (Letter size)
    const PAGE = {
        width: 215.9,
        height: 279.4,
        marginLeft: 15,
        marginRight: 15,
        marginTop: 15,
        marginBottom: 20,
        get contentWidth() { return this.width - this.marginLeft - this.marginRight; }
    };

    // -------------------------------------------------
    // MAIN EXPORT FUNCTION
    // -------------------------------------------------

    async function exportPDF(results) {
        // Show loading overlay
        showLoadingOverlay();

        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'letter'
            });

            let y = PAGE.marginTop;

            // ---- PAGE 1: Header + Summary ----
            y = drawHeader(doc, y);
            y = drawLoanSummary(doc, y, results);
            y = drawBreakevenResults(doc, y, results);

            // Only include Cost of Waiting if enabled
            if (results.inputs.costOfWaitingEnabled !== false) {
                y = drawCostOfWaitingResults(doc, y, results);
            }

            // ---- PAGE 2: Recommendation + Closing Costs ----
            doc.addPage();
            y = PAGE.marginTop;
            y = drawPageHeader(doc, y, 'Refinance Recommendation');
            y = drawRecommendation(doc, y, results);
            y = drawClosingCostTable(doc, y, results);

            // ---- PAGE 3: Charts ----
            doc.addPage();
            y = PAGE.marginTop;
            y = drawPageHeader(doc, y, 'Visual Analysis');
            y = await drawChartImages(doc, y);

            // ---- PAGE 4: Calculation Details ----
            doc.addPage();
            y = PAGE.marginTop;
            y = drawPageHeader(doc, y, 'Calculation Details');
            y = drawCalculationDetails(doc, y, results);

            // Footer on all pages
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                drawFooter(doc, i, totalPages);
            }

            // Generate filename
            const date = new Date().toISOString().split('T')[0];
            const filename = `Refinance_Analysis_${date}.pdf`;

            doc.save(filename);

        } catch (err) {
            console.error('PDF generation error:', err);
            alert('Error generating PDF. Please try again.');
        } finally {
            hideLoadingOverlay();
        }
    }

    // -------------------------------------------------
    // HEADER
    // -------------------------------------------------

    function drawHeader(doc, y) {
        // Green header bar
        doc.setFillColor(...COLORS.primary);
        doc.rect(0, 0, PAGE.width, 35, 'F');

        // Title
        doc.setTextColor(...COLORS.white);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Should I Refinance?', PAGE.width / 2, 15, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Breakeven & Cost of Waiting Analysis', PAGE.width / 2, 22, { align: 'center' });

        // Company info
        doc.setFontSize(8);
        doc.text('Mountain State Financial Group, LLC | NMLS: 1314257', PAGE.width / 2, 30, { align: 'center' });

        // Date
        doc.setTextColor(...COLORS.gray);
        doc.setFontSize(8);
        y = 42;
        doc.text(`Report Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, PAGE.marginLeft, y);

        return y + 6;
    }

    function drawPageHeader(doc, y, title) {
        doc.setFillColor(...COLORS.primary);
        doc.rect(PAGE.marginLeft, y, PAGE.contentWidth, 8, 'F');
        doc.setTextColor(...COLORS.white);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title, PAGE.marginLeft + 4, y + 5.5);
        return y + 14;
    }

    // -------------------------------------------------
    // LOAN SUMMARY
    // -------------------------------------------------

    function drawLoanSummary(doc, y, r) {
        y = drawSectionTitle(doc, y, 'Loan Summary');

        const costOfWaitingEnabled = r.inputs.costOfWaitingEnabled !== false;

        let data;
        let colWidths;

        const currentLoanType = r.inputs.currentLoanType || 'Conventional';
        const refiLoanType = r.inputs.refiLoanType || 'Conventional';
        const currentMIStr = r.currentMI && r.currentMI.monthlyMI > 0 ? ' + ' + fmt(r.currentMI.monthlyMI) + ' MI' : '';
        const refiMIStr = r.refiMI && r.refiMI.monthlyMI > 0 ? ' + ' + fmt(r.refiMI.monthlyMI) + ' MI' : '';

        if (costOfWaitingEnabled) {
            data = [
                ['', 'Current Loan', 'Refi Offer', 'Future (Wait)'],
                ['Loan Type', currentLoanType, refiLoanType, refiLoanType],
                ['Balance / Amount', fmt(r.inputs.currentBalance), fmt(r.inputs.refiLoanAmount), fmt(r.analysis.balanceAfterWait)],
                ['Interest Rate', r.inputs.currentRate + '%', r.inputs.refiRate + '%', r.inputs.futureRate + '%'],
                ['Term', r.inputs.currentTermRemaining + ' mo remaining', r.inputs.refiTerm + ' mo', r.inputs.refiTerm + ' mo'],
                ['Monthly Payment', fmt(r.currentPayment) + currentMIStr, fmt(r.refiPayment) + refiMIStr, fmt(r.futurePayment)],
            ];
            colWidths = [35, 45, 45, 45];
        } else {
            data = [
                ['', 'Current Loan', 'Refi Offer'],
                ['Loan Type', currentLoanType, refiLoanType],
                ['Balance / Amount', fmt(r.inputs.currentBalance), fmt(r.inputs.refiLoanAmount)],
                ['Interest Rate', r.inputs.currentRate + '%', r.inputs.refiRate + '%'],
                ['Term', r.inputs.currentTermRemaining + ' mo remaining', r.inputs.refiTerm + ' mo'],
                ['Monthly Payment', fmt(r.currentPayment) + currentMIStr, fmt(r.refiPayment) + refiMIStr],
            ];
            colWidths = [50, 60, 60];
        }

        y = drawTable(doc, y, data, {
            headerRow: true,
            colWidths: colWidths
        });

        // Cash-out debt detail (if enabled)
        if (r.cashOut && r.cashOut.enabled && r.cashOut.debtPayments > 0) {
            y += 4;
            y = drawSectionTitle(doc, y, 'Cash Out — Debt Consolidation');
            const debtData = [
                ['Description', 'Balance', 'Monthly Pmt', 'Rate'],
            ];
            if (r.cashOut.debts && r.cashOut.debts.length > 0) {
                r.cashOut.debts.forEach(d => {
                    if (d.balance > 0 || d.payment > 0) {
                        debtData.push([d.name || '—', fmt(d.balance), fmt(d.payment), d.rate + '%']);
                    }
                });
            }
            debtData.push(['Cash Out Amount', fmt(r.cashOut.amount), '', '']);
            debtData.push(['Total Debt Payments Eliminated', '', fmt(r.cashOut.debtPayments) + '/mo', '']);

            y = drawTable(doc, y, debtData, {
                headerRow: true,
                colWidths: [55, 40, 40, 30]
            });
        }

        return y + 4;
    }

    // -------------------------------------------------
    // BREAKEVEN RESULTS
    // -------------------------------------------------

    function drawBreakevenResults(doc, y, r) {
        const a = r.analysis;

        y = drawSectionTitle(doc, y, 'Refinance Now (' + r.inputs.refiRate + '%) — Breakeven');

        const data = [
            ['Metric', 'Value'],
            ['Payment Savings', fmt(a.piSavingsNow)],
        ];

        // If cash-out is active, add debt savings row
        if (r.cashOut && r.cashOut.enabled && r.cashOut.debtPayments > 0) {
            data.push(['Debt Payments Eliminated', fmt(r.cashOut.debtPayments)]);
            data.push(['Total Adjusted Monthly Savings', fmt(a.monthlySavingsNow)]);
        }

        data.push(
            ['Total Closing Costs (Breakeven)', fmt(a.closingCosts)],
            ['Breakeven Point', a.breakevenNow === Infinity ? 'N/A' : a.breakevenNow + ' months'],
            ['Target Breakeven Threshold', r.inputs.targetBreakeven + ' months'],
            ['Meets Target?', (a.breakevenNow !== Infinity && a.breakevenNow <= r.inputs.targetBreakeven) ? 'YES' : 'NO'],
            ['Net Savings (over ' + r.inputs.planToStayMonths + ' months)', fmt(a.refiNowNetSavings)]
        );

        y = drawTable(doc, y, data, {
            headerRow: true,
            colWidths: [90, 80]
        });

        return y + 4;
    }

    // -------------------------------------------------
    // COST OF WAITING RESULTS
    // -------------------------------------------------

    function drawCostOfWaitingResults(doc, y, r) {
        const a = r.analysis;

        // Check if we need a new page
        if (y > 200) {
            doc.addPage();
            y = PAGE.marginTop;
        }

        y = drawSectionTitle(doc, y, 'Cost of Waiting Analysis');

        const waitLabel = 'Wait ' + a.monthsToWait + ' mo (' + r.inputs.futureRate + '%)';
        const data = [
            ['Metric', 'Refi Now (' + r.inputs.refiRate + '%)', waitLabel],
            ['Closing Costs', fmt(a.closingCosts), fmt(a.closingCosts)],
            ['Extra Interest (Waiting)', '—', fmt(a.extraInterest)],
            ['Effective Total Cost', fmt(a.closingCosts), fmt(a.effectiveTotalCost)],
            ['Monthly Savings', fmt(a.monthlySavingsNow), fmt(a.futureMonthlySavings)],
            ['Breakeven', a.breakevenNow === Infinity ? 'N/A' : a.breakevenNow + ' mo', a.breakevenWait === Infinity ? 'N/A' : a.breakevenWait + ' mo'],
            ['Net Savings (' + r.inputs.planToStayMonths + ' mo)', fmt(a.refiNowNetSavings), fmt(a.waitNetSavings)],
            ['Difference', a.netDifference > 0 ? '+' + fmt(a.netDifference) + ' (Now better)' : a.netDifference < 0 ? fmt(a.netDifference) + ' (Wait better)' : 'Equal', ''],
        ];

        y = drawTable(doc, y, data, {
            headerRow: true,
            colWidths: [60, 55, 55]
        });

        return y + 4;
    }

    // -------------------------------------------------
    // RECOMMENDATION
    // -------------------------------------------------

    function drawRecommendation(doc, y, r) {
        const advice = RefiAdvice.analyzeScenarios(r);

        // Recommendation box
        let boxColor;
        if (advice.cssClass === 'advice-now') boxColor = COLORS.success;
        else if (advice.cssClass === 'advice-wait') boxColor = COLORS.warning;
        else boxColor = COLORS.danger;

        // Use a light tint for the box background (jsPDF doesn't support alpha)
        const tintColor = [
            Math.round(boxColor[0] + (255 - boxColor[0]) * 0.88),
            Math.round(boxColor[1] + (255 - boxColor[1]) * 0.88),
            Math.round(boxColor[2] + (255 - boxColor[2]) * 0.88)
        ];
        doc.setFillColor(...tintColor);
        doc.setDrawColor(...boxColor);
        doc.setLineWidth(0.5);

        // Pre-calculate actual box height by measuring all text wrapping
        const detailLinesForHeight = doc.splitTextToSize(advice.detail, PAGE.contentWidth - 20);
        let estimatedHeight = 16 + detailLinesForHeight.length * 4 + 4;
        doc.setFontSize(8);
        [...advice.pros, ...advice.cons, ...advice.neutralPoints].forEach(text => {
            const lines = doc.splitTextToSize(text, PAGE.contentWidth - 30);
            estimatedHeight += lines.length * 4 + 1;
        });
        estimatedHeight += 6;

        const boxHeight = estimatedHeight;
        const availableHeight = PAGE.height - PAGE.marginBottom - y;

        if (boxHeight > availableHeight) {
            doc.addPage();
            y = PAGE.marginTop;
        }

        doc.roundedRect(PAGE.marginLeft, y, PAGE.contentWidth, boxHeight, 2, 2, 'FD');

        // Headline
        doc.setTextColor(...boxColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(advice.headline, PAGE.width / 2, y + 8, { align: 'center' });

        // Detail
        doc.setTextColor(...COLORS.dark);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const detailLines = doc.splitTextToSize(advice.detail, PAGE.contentWidth - 20);
        doc.text(detailLines, PAGE.marginLeft + 10, y + 15);

        let bulletY = y + 15 + detailLines.length * 4 + 3;

        // Pros
        doc.setFontSize(8);
        advice.pros.forEach(pro => {
            doc.setTextColor(...COLORS.success);
            doc.text('✓', PAGE.marginLeft + 10, bulletY);
            doc.setTextColor(...COLORS.dark);
            const lines = doc.splitTextToSize(pro, PAGE.contentWidth - 30);
            doc.text(lines, PAGE.marginLeft + 17, bulletY);
            bulletY += lines.length * 4 + 1;
        });

        // Cons
        advice.cons.forEach(con => {
            doc.setTextColor(...COLORS.danger);
            doc.text('✗', PAGE.marginLeft + 10, bulletY);
            doc.setTextColor(...COLORS.dark);
            const lines = doc.splitTextToSize(con, PAGE.contentWidth - 30);
            doc.text(lines, PAGE.marginLeft + 17, bulletY);
            bulletY += lines.length * 4 + 1;
        });

        // Neutral
        advice.neutralPoints.forEach(point => {
            doc.setTextColor(...COLORS.gray);
            doc.text('○', PAGE.marginLeft + 10, bulletY);
            doc.setTextColor(...COLORS.dark);
            const lines = doc.splitTextToSize(point, PAGE.contentWidth - 30);
            doc.text(lines, PAGE.marginLeft + 17, bulletY);
            bulletY += lines.length * 4 + 1;
        });

        return y + boxHeight + 8;
    }

    // -------------------------------------------------
    // CLOSING COST TABLE
    // -------------------------------------------------

    function drawClosingCostTable(doc, y, r) {
        const fees = r.inputs.fees;
        const c = r.costs;

        if (y > 160) {
            doc.addPage();
            y = PAGE.marginTop;
        }

        y = drawSectionTitle(doc, y, 'Closing Cost Summary');

        const data = [
            ['Fee Description', 'Amount'],
            ['— ORIGINATION CHARGES —', ''],
            ['Origination Fee / Points', fmt(fees.feeOrigination)],
            ['Underwriting / Processing Fee', fmt(fees.feeUnderwriting)],
            ['Discount Points', fmt(fees.feeDiscount)],
            ['Lender Credit', fmt(fees.feeLenderCredit)],
            ['Origination Total', fmt(c.origination)],
            ['— SERVICES CANNOT SHOP —', ''],
            ['Appraisal Fee', fmt(fees.feeAppraisal)],
            ['Credit Report Fee', fmt(fees.feeCreditReport)],
            ['Flood Certification', fmt(fees.feeFloodCert)],
            ['MERS Registration Fee', fmt(fees.feeMERS)],
            ['Tax Related Service Fee', fmt(fees.feeTaxService)],
            ['Technology Fee', fmt(fees.feeTechnology)],
            ['Verification of Employment', fmt(fees.feeVOE)],
            ['Verification of Tax Return', fmt(fees.feeVOT)],
            ['Cannot Shop Total', fmt(c.cannotShop)],
            ['— SERVICES CAN SHOP —', ''],
            ['E-Recording Fee', fmt(fees.feeERecording)],
            ['Title - Closing Protection Letter', fmt(fees.feeTitleCPL)],
            ['Title - Lenders Coverage Premium', fmt(fees.feeTitleLenders)],
            ['Title - Settlement Fee', fmt(fees.feeTitleSettlement)],
            ['Title - Tax Cert Fee', fmt(fees.feeTitleTaxCert)],
            ['Can Shop Total', fmt(c.canShop)],
            ['— GOVERNMENT FEES —', ''],
            ['Recording Fee for Deed', fmt(fees.feeRecording)],
            ['Government Fees Total', fmt(c.govFees)],
            ['— MI / FUNDING FEES —', ''],
            ['Upfront MI / Funding Fee', fmt(fees.feeUpfrontMI || 0)],
            ['Monthly MI', fmt(fees.feeMonthlyMI || 0) + '/mo'],
            ['Other Fees', fmt(fees.feeOther || 0)],
            ['TOTAL FOR BREAKEVEN', fmt(c.totalBreakeven)],
            ['— EXCLUDED (Prepaids & Escrow) —', ''],
            ['Prepaid Interest', fmt(c.prepaids)],
            ['Escrow - Property Tax', fmt(fees.feeEscrowTax)],
            ['Escrow - Hazard Insurance', fmt(fees.feeEscrowInsurance)],
            ['Total Prepaids & Escrow', fmt(RefiEngine.round2(c.prepaids + c.escrow))],
            ['TOTAL ALL COSTS', fmt(c.totalAll)],
        ];

        y = drawTable(doc, y, data, {
            headerRow: true,
            colWidths: [120, 50],
            fontSize: 7.5,
            rowHeight: 4.5
        });

        return y + 4;
    }

    // -------------------------------------------------
    // CHART IMAGES
    // -------------------------------------------------

    async function drawChartImages(doc, y) {
        // Temporarily open all chart sections so canvases are visible for capture
        const chartSections = document.querySelectorAll('.chart-content');
        const wasOpen = [];
        chartSections.forEach(section => {
            wasOpen.push(section.classList.contains('open'));
            section.classList.add('open');
        });

        // Give the browser a tick to repaint
        await new Promise(resolve => setTimeout(resolve, 100));

        const charts = [
            { id: 'canvasBreakeven', title: 'Breakeven Timeline' },
            { id: 'canvasComparison', title: 'Payment Comparison' },
            { id: 'canvasCostBreakdown', title: 'Closing Cost Breakdown' },
            { id: 'canvasAmortization', title: 'Amortization Comparison' }
        ];

        for (const chart of charts) {
            const canvas = document.getElementById(chart.id);
            if (!canvas || canvas.width === 0 || canvas.height === 0) continue;

            // Check if we need new page (each chart ~90mm tall)
            if (y > 170) {
                doc.addPage();
                y = PAGE.marginTop;
            }

            // Chart title
            doc.setTextColor(...COLORS.primary);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(chart.title, PAGE.marginLeft, y);
            y += 4;

            // Convert canvas to image
            try {
                const imgData = canvas.toDataURL('image/png', 1.0);
                const imgWidth = PAGE.contentWidth;
                const imgHeight = (canvas.height / canvas.width) * imgWidth;
                const finalHeight = Math.min(imgHeight, 85);

                doc.addImage(imgData, 'PNG', PAGE.marginLeft, y, imgWidth, finalHeight);
                y += finalHeight + 8;
            } catch (err) {
                doc.setTextColor(...COLORS.gray);
                doc.setFontSize(8);
                doc.text('[Chart image unavailable]', PAGE.marginLeft, y);
                y += 8;
            }
        }

        // Restore collapsed state
        chartSections.forEach((section, i) => {
            if (!wasOpen[i]) {
                section.classList.remove('open');
            }
        });

        return y;
    }

    // -------------------------------------------------
    // CALCULATION DETAILS
    // -------------------------------------------------

    function drawCalculationDetails(doc, y, r) {
        const a = r.analysis;
        doc.setFontSize(8);

        const steps = [
            {
                title: 'Current Monthly Payment',
                formula: `M = P × [r(1+r)^n] / [(1+r)^n - 1]`,
                values: `P=${fmt(r.inputs.currentBalance)}, r=${r.inputs.currentRate}%/12, n=${r.inputs.currentTermRemaining}`,
                result: fmt(r.currentPaymentComputed) + (r.inputs.useManualPayment ? ' (overridden: ' + fmt(r.currentPayment) + ')' : '')
            },
            {
                title: 'New Monthly Payment',
                formula: `P=${fmt(r.inputs.refiLoanAmount)}, r=${r.inputs.refiRate}%/12, n=${r.inputs.refiTerm}`,
                result: fmt(r.refiPayment)
            },
            {
                title: 'Monthly Savings',
                formula: `${fmt(r.currentPayment)} - ${fmt(r.refiPayment)}`,
                result: fmt(a.monthlySavingsNow) + '/mo'
            },
            {
                title: 'Breakeven (Now)',
                formula: `${fmt(a.closingCosts)} / ${fmt(a.monthlySavingsNow)}`,
                result: a.breakevenNow === Infinity ? 'N/A' : a.breakevenNow + ' months'
            },
            {
                title: 'Extra Interest While Waiting',
                formula: `${fmt(a.monthlySavingsNow)} × ${a.monthsToWait} months`,
                result: fmt(a.extraInterest)
            },
            {
                title: 'Balance After Waiting',
                formula: `Remaining balance after ${a.monthsToWait} payments on current loan`,
                result: fmt(a.balanceAfterWait)
            },
            {
                title: 'Future Monthly Payment',
                formula: `${fmt(a.balanceAfterWait)} at ${r.inputs.futureRate}% for ${r.inputs.refiTerm} months`,
                result: fmt(r.futurePayment)
            },
            {
                title: 'Effective Cost If Waiting',
                formula: `${fmt(a.closingCosts)} + ${fmt(a.extraInterest)}`,
                result: fmt(a.effectiveTotalCost)
            },
            {
                title: 'Breakeven (Wait)',
                formula: `${fmt(a.effectiveTotalCost)} / ${fmt(a.futureMonthlySavings)}`,
                result: a.breakevenWait === Infinity ? 'N/A' : a.breakevenWait + ' months'
            },
            {
                title: 'Net Savings Difference',
                formula: `Now: ${fmt(a.refiNowNetSavings)} - Wait: ${fmt(a.waitNetSavings)}`,
                result: fmt(a.netDifference) + (a.netDifference > 0 ? ' (Now better)' : a.netDifference < 0 ? ' (Wait better)' : ' (Equal)')
            }
        ];

        steps.forEach(step => {
            if (y > PAGE.height - PAGE.marginBottom - 18) {
                doc.addPage();
                y = PAGE.marginTop;
            }

            // Step title
            doc.setTextColor(...COLORS.primary);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(step.title, PAGE.marginLeft, y);
            y += 4;

            // Formula
            if (step.formula) {
                doc.setTextColor(...COLORS.gray);
                doc.setFont('courier', 'normal');
                doc.setFontSize(7.5);
                doc.text(step.formula, PAGE.marginLeft + 4, y);
                y += 3.5;
            }

            if (step.values) {
                doc.text(step.values, PAGE.marginLeft + 4, y);
                y += 3.5;
            }

            // Result
            doc.setTextColor(...COLORS.dark);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text('= ' + step.result, PAGE.marginLeft + 4, y);
            y += 6;
        });

        return y;
    }

    // -------------------------------------------------
    // TABLE DRAWING HELPER
    // -------------------------------------------------

    function drawTable(doc, startY, data, options = {}) {
        const {
            headerRow = false,
            colWidths = [],
            fontSize = 8.5,
            rowHeight = 5.5
        } = options;

        const tableWidth = PAGE.contentWidth;
        let y = startY;

        // Auto-calculate column widths if not provided
        const cols = data[0].length;
        const widths = colWidths.length === cols
            ? colWidths.map(w => (w / colWidths.reduce((a, b) => a + b, 0)) * tableWidth)
            : Array(cols).fill(tableWidth / cols);

        data.forEach((row, rowIdx) => {
            // Check page break
            if (y > PAGE.height - PAGE.marginBottom - 10) {
                doc.addPage();
                y = PAGE.marginTop;
            }

            const isHeader = headerRow && rowIdx === 0;
            const isSectionHeader = !isHeader && row[0].startsWith('—');
            const isTotal = !isHeader && (row[0].startsWith('TOTAL') || row[0].endsWith('Total'));
            const isGrandTotal = row[0] === 'TOTAL FOR BREAKEVEN' || row[0] === 'TOTAL ALL COSTS';

            // Row background
            if (isHeader) {
                doc.setFillColor(...COLORS.tableHeader);
                doc.rect(PAGE.marginLeft, y, tableWidth, rowHeight + 1, 'F');
            } else if (isSectionHeader) {
                doc.setFillColor(232, 245, 233);
                doc.rect(PAGE.marginLeft, y, tableWidth, rowHeight, 'F');
            } else if (isGrandTotal) {
                doc.setFillColor(232, 245, 232);
                doc.rect(PAGE.marginLeft, y, tableWidth, rowHeight + 0.5, 'F');
            } else if (isTotal) {
                doc.setFillColor(248, 249, 250);
                doc.rect(PAGE.marginLeft, y, tableWidth, rowHeight, 'F');
            } else if (rowIdx % 2 === 0) {
                doc.setFillColor(...COLORS.tableStripe);
                doc.rect(PAGE.marginLeft, y, tableWidth, rowHeight, 'F');
            }

            // Draw cells
            let x = PAGE.marginLeft;
            row.forEach((cell, colIdx) => {
                if (isHeader) {
                    doc.setTextColor(...COLORS.white);
                    doc.setFont('helvetica', 'bold');
                } else if (isSectionHeader) {
                    doc.setTextColor(...COLORS.primary);
                    doc.setFont('helvetica', 'bold');
                } else if (isGrandTotal || isTotal) {
                    doc.setTextColor(...COLORS.primary);
                    doc.setFont('helvetica', 'bold');
                } else {
                    doc.setTextColor(...COLORS.dark);
                    doc.setFont('helvetica', 'normal');
                }

                doc.setFontSize(fontSize);
                const align = colIdx > 0 ? 'right' : 'left';
                const textX = colIdx > 0 ? x + widths[colIdx] - 2 : x + 2;
                doc.text(String(cell), textX, y + rowHeight - 1.5, { align });
                x += widths[colIdx];
            });

            // Row border
            doc.setDrawColor(...COLORS.tableBorder);
            doc.setLineWidth(0.1);
            doc.line(PAGE.marginLeft, y + rowHeight, PAGE.marginLeft + tableWidth, y + rowHeight);

            y += isHeader ? rowHeight + 1 : rowHeight;
        });

        return y;
    }

    // -------------------------------------------------
    // SECTION TITLE
    // -------------------------------------------------

    function drawSectionTitle(doc, y, title) {
        doc.setFillColor(...COLORS.accent);
        doc.rect(PAGE.marginLeft, y, 2, 6, 'F');
        doc.setTextColor(...COLORS.primary);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title, PAGE.marginLeft + 5, y + 4.5);
        return y + 10;
    }

    // -------------------------------------------------
    // FOOTER
    // -------------------------------------------------

    function drawFooter(doc, pageNum, totalPages) {
        const y = PAGE.height - 10;

        doc.setDrawColor(...COLORS.tableBorder);
        doc.setLineWidth(0.2);
        doc.line(PAGE.marginLeft, y - 3, PAGE.width - PAGE.marginRight, y - 3);

        doc.setTextColor(...COLORS.gray);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('Mountain State Financial Group, LLC | NMLS: 1314257 | For informational purposes only', PAGE.marginLeft, y);
        doc.text(`Page ${pageNum} of ${totalPages}`, PAGE.width - PAGE.marginRight, y, { align: 'right' });
    }

    // -------------------------------------------------
    // LOADING OVERLAY
    // -------------------------------------------------

    function showLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'pdfLoadingOverlay';
        overlay.className = 'pdf-generating';
        overlay.innerHTML = `
            <div class="pdf-generating-content">
                <div class="pdf-spinner"></div>
                <h3>Generating PDF Report</h3>
                <p>Please wait...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    function hideLoadingOverlay() {
        const overlay = document.getElementById('pdfLoadingOverlay');
        if (overlay) overlay.remove();
    }

    // -------------------------------------------------
    // UTILITY
    // -------------------------------------------------

    function fmt(val) {
        if (val === undefined || val === null || isNaN(val)) return '—';
        if (val === Infinity || val === -Infinity) return 'N/A';
        const abs = Math.abs(val);
        const formatted = '$' + abs.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return val < 0 ? '-' + formatted : formatted;
    }

    // -------------------------------------------------
    // PUBLIC API
    // -------------------------------------------------

    return {
        exportPDF
    };

})();
