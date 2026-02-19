/* =====================================================
   REFI CHARTS — Chart.js Visualizations
   Mountain State Financial Group

   Renders all charts using Chart.js.
   ===================================================== */

const RefiCharts = (() => {
    'use strict';

    // Chart instances for cleanup
    let chartBreakeven = null;
    let chartComparison = null;
    let chartCostBreakdown = null;
    let chartAmortization = null;

    // MSFG brand colors
    const colors = {
        primary: '#2d6a4f',
        secondary: '#1b4332',
        accent: '#40916c',
        success: '#28a745',
        warning: '#ffc107',
        danger: '#dc3545',
        blue: '#2196F3',
        orange: '#FF9800',
        purple: '#9C27B0',
        gray: '#6c757d',
        lightGreen: 'rgba(45, 106, 79, 0.15)',
        lightBlue: 'rgba(33, 150, 243, 0.15)',
        lightOrange: 'rgba(255, 152, 0, 0.15)',
    };

    // Common chart options
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 16,
                    font: { size: 13, family: "'Segoe UI', Tahoma, sans-serif" }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleFont: { size: 13 },
                bodyFont: { size: 12 },
                padding: 12,
                cornerRadius: 6
            }
        }
    };

    // -------------------------------------------------
    // RENDER ALL CHARTS
    // -------------------------------------------------

    function renderAll(results) {
        destroyAll();
        renderBreakevenTimeline(results);
        renderPaymentComparison(results);
        renderCostBreakdown(results);
        renderAmortizationComparison(results);
    }

    // -------------------------------------------------
    // 1. BREAKEVEN TIMELINE
    // -------------------------------------------------

    function renderBreakevenTimeline(results) {
        const ctx = document.getElementById('canvasBreakeven');
        if (!ctx) return;

        const t = results.timeline;
        const a = results.analysis;
        const costOfWaitingEnabled = results.inputs.costOfWaitingEnabled !== false;

        const datasets = [
            {
                label: 'Refinance Now — Cumulative Savings',
                data: t.refiNowCumulative,
                borderColor: colors.blue,
                backgroundColor: colors.lightBlue,
                borderWidth: 3,
                fill: false,
                tension: 0.1,
                pointRadius: 0,
                pointHitRadius: 8,
                pointStyle: 'circle'
            }
        ];

        if (costOfWaitingEnabled) {
            datasets.push({
                label: 'Wait & Refinance — Cumulative Savings',
                data: t.waitCumulative,
                borderColor: colors.orange,
                backgroundColor: colors.lightOrange,
                borderWidth: 3,
                fill: false,
                tension: 0.1,
                pointRadius: 0,
                pointHitRadius: 8,
                borderDash: [8, 4],
                pointStyle: 'rect'
            });
        }

        // Double Refi timeline (refi now + refi again)
        if (results.doubleRefiTimeline) {
            datasets.push({
                label: 'Refi Now + Refi Again — Cumulative Savings',
                data: results.doubleRefiTimeline,
                borderColor: colors.purple,
                backgroundColor: 'rgba(156, 39, 176, 0.15)',
                borderWidth: 3,
                fill: false,
                tension: 0.1,
                pointRadius: 0,
                pointHitRadius: 8,
                borderDash: [4, 2],
                pointStyle: 'triangle'
            });
        }

        datasets.push({
            label: 'Break-even Line ($0)',
            data: t.labels.map(() => 0),
            borderColor: colors.gray,
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false
        });

        chartBreakeven = new Chart(ctx, {
            type: 'line',
            data: {
                labels: t.labels,
                datasets: datasets
            },
            options: {
                ...baseOptions,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Months',
                            font: { size: 14, weight: 'bold' }
                        },
                        ticks: {
                            callback: val => val % 12 === 0 ? val : '',
                            font: { size: 11 }
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Cumulative Net Savings ($)',
                            font: { size: 14, weight: 'bold' }
                        },
                        ticks: {
                            callback: val => '$' + val.toLocaleString(),
                            font: { size: 11 }
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                },
                plugins: {
                    ...baseOptions.plugins,
                    tooltip: {
                        ...baseOptions.plugins.tooltip,
                        callbacks: {
                            title: (items) => `Month ${items[0].label}`,
                            label: (item) => {
                                const val = item.parsed.y;
                                // Hide the break-even $0 line in tooltips
                                if (item.dataset.label.startsWith('Break-even')) return '';
                                return `${item.dataset.label.split('—')[0].trim()}: $${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    },
                    annotation: undefined
                }
            },
            plugins: [{
                id: 'breakevenAnnotation',
                afterDraw(chart) {
                    const ctx = chart.ctx;
                    const xScale = chart.scales.x;
                    const yScale = chart.scales.y;

                    // Draw breakeven point for "Refinance Now"
                    if (a.breakevenNow !== Infinity && a.breakevenNow <= t.labels[t.labels.length - 1]) {
                        const x = xScale.getPixelForValue(a.breakevenNow);
                        const y = yScale.getPixelForValue(0);

                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(x, y, 8, 0, Math.PI * 2);
                        ctx.fillStyle = colors.blue;
                        ctx.fill();
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        ctx.fillStyle = colors.blue;
                        ctx.font = 'bold 12px Segoe UI';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${a.breakevenNow} mo`, x, y - 16);
                        ctx.restore();
                    }

                    // Draw breakeven point for "Wait" (only if Cost of Waiting enabled)
                    if (costOfWaitingEnabled && a.breakevenWait !== Infinity && a.breakevenWait <= t.labels[t.labels.length - 1]) {
                        const totalMonthsWait = a.monthsToWait + a.breakevenWait;
                        if (totalMonthsWait <= t.labels[t.labels.length - 1]) {
                            const x = xScale.getPixelForValue(totalMonthsWait);
                            const y = yScale.getPixelForValue(0);

                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(x, y, 8, 0, Math.PI * 2);
                            ctx.fillStyle = colors.orange;
                            ctx.fill();
                            ctx.strokeStyle = '#fff';
                            ctx.lineWidth = 2;
                            ctx.stroke();

                            ctx.fillStyle = colors.orange;
                            ctx.font = 'bold 12px Segoe UI';
                            ctx.textAlign = 'center';
                            ctx.fillText(`${totalMonthsWait} mo`, x, y - 16);
                            ctx.restore();
                        }
                    }

                    // Draw breakeven point for "Double Refi"
                    if (results.doubleRefi && results.doubleRefi.breakevenMonth !== Infinity &&
                        results.doubleRefi.breakevenMonth <= t.labels[t.labels.length - 1]) {
                        const drBE = results.doubleRefi.breakevenMonth;
                        const x = xScale.getPixelForValue(drBE);
                        const y = yScale.getPixelForValue(0);

                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(x, y, 8, 0, Math.PI * 2);
                        ctx.fillStyle = colors.purple;
                        ctx.fill();
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        ctx.fillStyle = colors.purple;
                        ctx.font = 'bold 12px Segoe UI';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${drBE} mo`, x, y + 24);
                        ctx.restore();
                    }

                    // Draw second refi vertical marker
                    if (results.doubleRefi && costOfWaitingEnabled && a.monthsToWait > 0) {
                        const xSecondRefi = xScale.getPixelForValue(a.monthsToWait);
                        const yTop = yScale.top;
                        const yBottom = yScale.bottom;

                        ctx.save();
                        ctx.strokeStyle = 'rgba(156, 39, 176, 0.35)';
                        ctx.setLineDash([3, 3]);
                        ctx.beginPath();
                        ctx.moveTo(xSecondRefi, yTop);
                        ctx.lineTo(xSecondRefi, yBottom);
                        ctx.stroke();

                        ctx.fillStyle = colors.purple;
                        ctx.font = '10px Segoe UI';
                        ctx.textAlign = 'center';
                        ctx.fillText('2nd Refi', xSecondRefi, yBottom - 6);
                        ctx.restore();
                    }

                    // Draw waiting period shading (only if Cost of Waiting enabled)
                    if (costOfWaitingEnabled && a.monthsToWait > 0) {
                        const xStart = xScale.getPixelForValue(0);
                        const xEnd = xScale.getPixelForValue(a.monthsToWait);
                        const yTop = yScale.top;
                        const yBottom = yScale.bottom;

                        ctx.save();
                        ctx.fillStyle = 'rgba(255, 152, 0, 0.08)';
                        ctx.fillRect(xStart, yTop, xEnd - xStart, yBottom - yTop);

                        ctx.strokeStyle = 'rgba(255, 152, 0, 0.3)';
                        ctx.setLineDash([4, 4]);
                        ctx.beginPath();
                        ctx.moveTo(xEnd, yTop);
                        ctx.lineTo(xEnd, yBottom);
                        ctx.stroke();

                        ctx.fillStyle = colors.orange;
                        ctx.font = '11px Segoe UI';
                        ctx.textAlign = 'center';
                        ctx.fillText('Waiting Period', (xStart + xEnd) / 2, yTop + 16);
                        ctx.restore();
                    }
                }
            }]
        });
    }

    // -------------------------------------------------
    // 2. PAYMENT COMPARISON (Bar Chart)
    // -------------------------------------------------

    function renderPaymentComparison(results) {
        const ctx = document.getElementById('canvasComparison');
        if (!ctx) return;

        const costOfWaitingEnabled = results.inputs.costOfWaitingEnabled !== false;

        const labels = [
            'Current Payment',
            `Refinance Now (${results.inputs.refiRate}%)`
        ];
        const data = [results.currentPayment, results.refiPayment];
        const bgColors = [colors.danger + 'CC', colors.primary + 'CC'];
        const borderColors = [colors.danger, colors.primary];

        if (costOfWaitingEnabled) {
            labels.push(`Future Rate (${results.inputs.futureRate}%)`);
            data.push(results.futurePayment);
            bgColors.push(colors.orange + 'CC');
            borderColors.push(colors.orange);
        }

        // Double refi: show the Phase 2 payment after second refinance
        if (results.doubleRefi) {
            labels.push(`Double Refi Phase 2 (${results.inputs.futureRate}%)`);
            data.push(results.doubleRefi.secondRefiPayment);
            bgColors.push(colors.purple + 'CC');
            borderColors.push(colors.purple);
        }

        chartComparison = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly P&I Payment',
                    data: data,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 2,
                    borderRadius: 6,
                    barPercentage: 0.6
                }]
            },
            options: {
                ...baseOptions,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Monthly P&I ($)',
                            font: { size: 14, weight: 'bold' }
                        },
                        ticks: {
                            callback: val => '$' + val.toLocaleString(),
                            font: { size: 11 }
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    x: {
                        ticks: { font: { size: 12 } },
                        grid: { display: false }
                    }
                },
                plugins: {
                    ...baseOptions.plugins,
                    tooltip: {
                        ...baseOptions.plugins.tooltip,
                        callbacks: {
                            label: (item) => `$${item.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        }
                    }
                }
            },
            plugins: [{
                id: 'barLabels',
                afterDraw(chart) {
                    const ctx = chart.ctx;
                    chart.data.datasets[0].data.forEach((value, index) => {
                        const meta = chart.getDatasetMeta(0);
                        const bar = meta.data[index];
                        ctx.save();
                        ctx.fillStyle = '#333';
                        ctx.font = 'bold 13px Segoe UI';
                        ctx.textAlign = 'center';
                        ctx.fillText(
                            '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2 }),
                            bar.x,
                            bar.y - 8
                        );
                        ctx.restore();
                    });
                }
            }]
        });
    }

    // -------------------------------------------------
    // 3. CLOSING COST BREAKDOWN (Doughnut)
    // -------------------------------------------------

    function renderCostBreakdown(results) {
        const ctx = document.getElementById('canvasCostBreakdown');
        if (!ctx) return;

        const c = results.costs;

        // Filter out zero categories
        const categories = [];
        const values = [];
        const bgColors = [];

        const items = [
            { label: 'Origination', value: c.origination, color: colors.primary },
            { label: 'Cannot Shop', value: c.cannotShop, color: colors.blue },
            { label: 'Can Shop', value: c.canShop, color: colors.accent },
            { label: 'Government Fees', value: c.govFees, color: colors.purple },
            { label: 'Upfront MI/FF', value: c.upfrontMI || 0, color: '#e65100' },
            { label: 'Other', value: c.other, color: colors.gray },
            { label: 'Prepaids (excluded)', value: c.prepaids, color: colors.warning + '80' },
            { label: 'Escrow (excluded)', value: c.escrow, color: colors.orange + '80' },
        ];

        items.forEach(item => {
            if (item.value > 0) {
                categories.push(item.label);
                values.push(item.value);
                bgColors.push(item.color);
            }
        });

        chartCostBreakdown = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: values,
                    backgroundColor: bgColors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                ...baseOptions,
                cutout: '55%',
                plugins: {
                    ...baseOptions.plugins,
                    tooltip: {
                        ...baseOptions.plugins.tooltip,
                        callbacks: {
                            label: (item) => {
                                const total = item.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((item.parsed / total) * 100).toFixed(1);
                                return `${item.label}: $${item.parsed.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${pct}%)`;
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: 'centerText',
                beforeDraw(chart) {
                    const { width, height, ctx } = chart;
                    ctx.save();
                    ctx.font = 'bold 16px Segoe UI';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = colors.primary;
                    ctx.fillText(
                        '$' + c.totalAll.toLocaleString('en-US', { minimumFractionDigits: 2 }),
                        width / 2,
                        height / 2 - 8
                    );
                    ctx.font = '12px Segoe UI';
                    ctx.fillStyle = colors.gray;
                    ctx.fillText('Total All Costs', width / 2, height / 2 + 12);
                    ctx.restore();
                }
            }]
        });
    }

    // -------------------------------------------------
    // 4. AMORTIZATION COMPARISON (Stacked Area)
    // -------------------------------------------------

    function renderAmortizationComparison(results) {
        const ctx = document.getElementById('canvasAmortization');
        if (!ctx) return;

        const costOfWaitingEnabled = results.inputs.costOfWaitingEnabled !== false;
        const months = results.amortization.current.map(a => a.month);

        // Cumulative interest for each scenario
        let cumCurrentInterest = 0, cumRefiInterest = 0, cumFutureInterest = 0;
        const currentCumInt = results.amortization.current.map(a => { cumCurrentInterest += a.interest; return RefiEngine.round2(cumCurrentInterest); });
        const refiCumInt = results.amortization.refi.map(a => { cumRefiInterest += a.interest; return RefiEngine.round2(cumRefiInterest); });
        const futureCumInt = results.amortization.future.map(a => { cumFutureInterest += a.interest; return RefiEngine.round2(cumFutureInterest); });

        const datasets = [
            {
                label: `Current (${results.inputs.currentRate}%) — Cumulative Interest`,
                data: currentCumInt,
                borderColor: colors.danger,
                backgroundColor: 'rgba(220, 53, 69, 0.08)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.2,
                pointRadius: 0,
                pointHitRadius: 6,
                pointStyle: 'circle'
            },
            {
                label: `Refi Now (${results.inputs.refiRate}%) — Cumulative Interest`,
                data: refiCumInt,
                borderColor: colors.primary,
                backgroundColor: colors.lightGreen,
                borderWidth: 2.5,
                fill: true,
                tension: 0.2,
                pointRadius: 0,
                pointHitRadius: 6,
                pointStyle: 'rect'
            }
        ];

        if (costOfWaitingEnabled) {
            datasets.push({
                label: `Future (${results.inputs.futureRate}%) — Cumulative Interest`,
                data: futureCumInt,
                borderColor: colors.orange,
                backgroundColor: colors.lightOrange,
                borderWidth: 2.5,
                fill: true,
                tension: 0.2,
                pointRadius: 0,
                pointHitRadius: 6,
                borderDash: [6, 3],
                pointStyle: 'triangle'
            });
        }

        chartAmortization = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: datasets
            },
            options: {
                ...baseOptions,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Month',
                            font: { size: 14, weight: 'bold' }
                        },
                        ticks: {
                            callback: val => val % 12 === 0 ? `Yr ${val / 12}` : '',
                            font: { size: 11 }
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Cumulative Interest Paid ($)',
                            font: { size: 14, weight: 'bold' }
                        },
                        ticks: {
                            callback: val => '$' + val.toLocaleString(),
                            font: { size: 11 }
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                },
                plugins: {
                    ...baseOptions.plugins,
                    tooltip: {
                        ...baseOptions.plugins.tooltip,
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: (items) => `Month ${items[0].label}`,
                            label: (item) => {
                                return `${item.dataset.label.split('—')[0].trim()}: $${item.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // -------------------------------------------------
    // DESTROY ALL CHARTS
    // -------------------------------------------------

    function destroyAll() {
        [chartBreakeven, chartComparison, chartCostBreakdown, chartAmortization].forEach(c => {
            if (c) c.destroy();
        });
        chartBreakeven = null;
        chartComparison = null;
        chartCostBreakdown = null;
        chartAmortization = null;
    }

    // -------------------------------------------------
    // PUBLIC API
    // -------------------------------------------------

    return {
        renderAll,
        destroyAll
    };

})();
