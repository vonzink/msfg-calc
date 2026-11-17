// calc-reo/reo.js
// Page wiring for the REO Investment ROI calculator. The numbers come from ReoMath
// (reo-math.js); this file only reads inputs, fills the page and draws the charts.

(function () {
  const $ = (id) => document.getElementById(id);
  const SVG_NS = "http://www.w3.org/2000/svg";

  const ids = [
    "street","city",
    "purchasePrice","downPct","rate","termYears","amortType","acqCosts",
    "renoPaint","renoFloor","renoAppl","renoFireplace","renoRoof","renoPest","renoOther",
    "renoMonths","renoValue","sellCostPct",
    "grossRents","hoa","adv","autoTravel","ins","landscape","propMaint","mgmt","otherExp","propTaxRate",
    "appreciation","rentIncrease","expIncrease","vacancy",
    "improvePct","taxBracket","deprYears"
  ];

  function n(v) {
    const x = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(x) ? x : 0;
  }
  const val = (id) => n($(id).value);
  const pct = (id) => val(id) / 100;

  function money(x) {
    if (!Number.isFinite(x)) return "—";
    return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function percent(x) {
    if (!Number.isFinite(x)) return "—";
    return (x * 100).toFixed(2) + "%";
  }

  function compactMoney(x) {
    const a = Math.abs(x);
    const sign = x < 0 ? "-" : "";
    if (a >= 1e6) return sign + "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (a >= 1e3) return sign + "$" + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
    return sign + "$" + Math.round(a);
  }

  function readInputs() {
    return {
      purchasePrice: val("purchasePrice"),
      downPct: pct("downPct"),
      rate: pct("rate"),
      termYears: val("termYears"),
      amortType: $("amortType").value,
      acqCosts: val("acqCosts"),
      renoTotal: val("renoPaint") + val("renoFloor") + val("renoAppl") + val("renoFireplace") +
        val("renoRoof") + val("renoPest") + val("renoOther"),
      renoMonths: val("renoMonths"),
      renoValue: val("renoValue"),
      sellCostPct: pct("sellCostPct"),
      grossRents: val("grossRents"),
      vacancy: pct("vacancy"),
      // Owed every month, rented or not
      carryMonthly: val("ins") + val("hoa"),
      // Only while the property is rented
      operatingMonthly: val("adv") + val("autoTravel") + val("landscape") + val("propMaint") +
        val("mgmt") + val("otherExp"),
      propTaxRate: pct("propTaxRate"),
      appreciation: pct("appreciation"),
      rentIncrease: pct("rentIncrease"),
      expIncrease: pct("expIncrease"),
      improvePct: pct("improvePct"),
      taxBracket: pct("taxBracket"),
      deprYears: val("deprYears")
    };
  }

  // ---------- Output helpers ----------

  function setText(id, text, value) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("neg", Number.isFinite(value) && value < -0.005);
  }

  function writeRow(prefix, arr, formatter) {
    for (let i = 0; i < arr.length; i++) setText(prefix + (i + 1), formatter(arr[i]), arr[i]);
  }

  // ---------- Charts (inline SVG, no library) ----------

  const SERIES = [
    { key: "a", color: "#2a78d6" },
    { key: "b", color: "#eb6834" }
  ];
  const W = 520, H = 280;
  const PAD = { top: 16, right: 16, bottom: 30, left: 54 };

  function svgEl(name, attrs, text) {
    const el = document.createElementNS(SVG_NS, name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (text !== undefined) el.textContent = text;
    return el;
  }

  // Round tick values covering [min, max] and always including zero.
  function ticksFor(min, max) {
    min = Math.min(0, min);
    max = Math.max(0, max);
    if (max - min < 1) max = min + 1;
    const rough = (max - min) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough);
    const ticks = [];
    for (let t = Math.floor(min / step) * step; t <= max + step * 0.999; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
    return ticks;
  }

  function frame(svg, values) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    const ticks = ticksFor(Math.min.apply(null, values), Math.max.apply(null, values));
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    const y = (v) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (v - lo) / (hi - lo));
    ticks.forEach((t) => {
      svg.appendChild(svgEl("line", {
        x1: PAD.left, x2: W - PAD.right, y1: y(t), y2: y(t),
        class: t === 0 ? "chart-zero" : "chart-grid"
      }));
      svg.appendChild(svgEl("text", { x: PAD.left - 8, y: y(t) + 4, "text-anchor": "end", class: "chart-tick" }, compactMoney(t)));
    });
    const band = (W - PAD.left - PAD.right) / 5;
    for (let i = 0; i < 5; i++) {
      svg.appendChild(svgEl("text", {
        x: PAD.left + band * (i + 0.5), y: H - 8, "text-anchor": "middle", class: "chart-tick"
      }, "Yr " + (i + 1)));
    }
    return { y: y, band: band };
  }

  // A bar with rounded data-end, anchored square on the zero baseline.
  function barPath(x, w, y0, y1) {
    const r = Math.min(4, w / 2, Math.abs(y1 - y0));
    const d = y1 < y0 ? 1 : -1; // 1 = bar goes up
    return "M" + x + "," + y0 +
      "V" + (y1 + d * r) +
      "Q" + x + "," + y1 + " " + (x + r) + "," + y1 +
      "H" + (x + w - r) +
      "Q" + (x + w) + "," + y1 + " " + (x + w) + "," + (y1 + d * r) +
      "V" + y0 + "Z";
  }

  function showTip(wrap, svg, xView, year, rows) {
    const tip = wrap.querySelector(".chart-tip");
    while (tip.firstChild) tip.removeChild(tip.firstChild);
    const head = document.createElement("div");
    head.className = "chart-tip__head";
    head.textContent = "Year " + year;
    tip.appendChild(head);
    rows.forEach((row) => {
      const line = document.createElement("div");
      line.className = "chart-tip__row";
      const sw = document.createElement("span");
      sw.className = "chart-swatch";
      sw.style.background = row.color;
      const label = document.createElement("span");
      label.textContent = row.label;
      const value = document.createElement("strong");
      value.textContent = money(row.value);
      line.appendChild(sw);
      line.appendChild(label);
      line.appendChild(value);
      tip.appendChild(line);
    });
    tip.hidden = false;
    const box = svg.getBoundingClientRect();
    const wrapBox = wrap.getBoundingClientRect();
    const px = box.left - wrapBox.left + (xView / W) * box.width;
    const half = tip.offsetWidth / 2;
    tip.style.left = Math.max(half, Math.min(wrapBox.width - half, px)) + "px";
    tip.style.top = (box.top - wrapBox.top + 4) + "px";
  }

  function hideTip(wrap) {
    wrap.querySelector(".chart-tip").hidden = true;
  }

  // One hover column per year, wider than the marks, driving the tooltip.
  function addHover(svg, wrap, f, rowsFor, onEnter, onLeave) {
    for (let i = 0; i < 5; i++) {
      const hit = svgEl("rect", {
        x: PAD.left + f.band * i, y: PAD.top, width: f.band, height: H - PAD.top - PAD.bottom,
        class: "chart-hit", tabindex: 0, "aria-label": "Year " + (i + 1)
      });
      const enter = () => { showTip(wrap, svg, PAD.left + f.band * (i + 0.5), i + 1, rowsFor(i)); if (onEnter) onEnter(i); };
      const leave = () => { hideTip(wrap); if (onLeave) onLeave(i); };
      hit.addEventListener("mouseenter", enter);
      hit.addEventListener("focus", enter);
      hit.addEventListener("mouseleave", leave);
      hit.addEventListener("blur", leave);
      svg.appendChild(hit);
    }
  }

  function drawBars(svgId, a, b, labels) {
    const svg = $(svgId);
    if (!svg) return;
    const wrap = svg.parentNode;
    const f = frame(svg, a.concat(b));
    const barW = Math.min(24, f.band * 0.3);
    const gap = 2;
    [a, b].forEach((arr, s) => {
      arr.forEach((v, i) => {
        const cx = PAD.left + f.band * (i + 0.5);
        const x = s === 0 ? cx - gap / 2 - barW : cx + gap / 2;
        svg.appendChild(svgEl("path", { d: barPath(x, barW, f.y(0), f.y(v)), fill: SERIES[s].color }));
      });
    });
    addHover(svg, wrap, f, (i) => [
      { label: labels[0], value: a[i], color: SERIES[0].color },
      { label: labels[1], value: b[i], color: SERIES[1].color }
    ]);
  }

  function drawLines(svgId, a, b, labels) {
    const svg = $(svgId);
    if (!svg) return;
    const wrap = svg.parentNode;
    const f = frame(svg, a.concat(b));
    const x = (i) => PAD.left + f.band * (i + 0.5);
    const guide = svgEl("line", { y1: PAD.top, y2: H - PAD.bottom, class: "chart-guide", visibility: "hidden" });
    svg.appendChild(guide);
    [a, b].forEach((arr, s) => {
      const pts = arr.map((v, i) => x(i) + "," + f.y(v)).join(" ");
      svg.appendChild(svgEl("polyline", { points: pts, fill: "none", stroke: SERIES[s].color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      arr.forEach((v, i) => {
        svg.appendChild(svgEl("circle", { cx: x(i), cy: f.y(v), r: 4, fill: SERIES[s].color, stroke: "#fff", "stroke-width": 2 }));
      });
    });
    addHover(svg, wrap, f, (i) => [
      { label: labels[0], value: a[i], color: SERIES[0].color },
      { label: labels[1], value: b[i], color: SERIES[1].color }
    ], (i) => {
      guide.setAttribute("x1", x(i));
      guide.setAttribute("x2", x(i));
      guide.setAttribute("visibility", "visible");
    }, () => guide.setAttribute("visibility", "hidden"));
  }

  // ---------- Calculate and render ----------

  function calc() {
    const r = window.ReoMath.project(readInputs());
    const hasData = r.cashInvested > 0 || r.incomeMonthly > 0;

    // Headline figures
    setText("cashInvested", money(r.cashInvested));
    setText("cfYr1", money(r.cashFlow[0]), r.cashFlow[0]);
    setText("cocYr1", percent(r.cashOnCash[0]), r.cashOnCash[0]);
    setText("carYr5", money(r.cumulativeReturn[4]), r.cumulativeReturn[4]);
    setText("roiYr5", percent(r.roi[4]), r.roi[4]);
    setText("noiMonthly", money(r.noiMonthly), r.noiMonthly);

    // Deal facts
    setText("r2p", percent(r.rentToPrice));
    setText("renoTotal", money(r.renoTotal));
    setText("renValueOut", money(r.renValue));
    setText("loanAmountOut", money(r.loanAmount));
    setText("paymentOut", money(r.monthlyPayment));
    setText("deprOut", money(r.annualDepreciation));

    // Projection table
    writeRow("pv", r.propValue, money);
    writeRow("gi", r.grossIncome, money);
    writeRow("ex", r.expenses, money);
    writeRow("noi", r.noi, money);
    writeRow("cap", r.capRate, percent);
    writeRow("ds", r.debtService, money);
    writeRow("dcr", r.dcr, (x) => (Number.isFinite(x) ? x.toFixed(2) : "N/A"));
    writeRow("cf", r.cashFlow, money);
    writeRow("coc", r.cashOnCash, percent);
    // A negative tax is a saving, so it is not flagged red.
    for (let i = 0; i < 5; i++) setText("tax" + (i + 1), money(r.incomeTax[i]));
    writeRow("at", r.afterTaxCashFlow, money);
    writeRow("bal", r.loanBalance, money);
    writeRow("eq", r.netEquity, money);
    writeRow("car", r.cumulativeReturn, money);
    writeRow("roi", r.roi, percent);

    // Charts
    const charts = $("reoCharts");
    if (charts) charts.classList.toggle("is-empty", !hasData);
    drawBars("chartCashFlow", r.cashFlow, r.afterTaxCashFlow, ["Before taxes", "After taxes"]);
    drawLines("chartEquity", r.netEquity, r.cumulativeReturn, ["Net equity", "Cumulative after-tax return"]);
  }

  function bind() {
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", calc);
      el.addEventListener("change", calc);
    });

    $("btnRecalc").addEventListener("click", calc);
    $("btnPrint").addEventListener("click", () => window.print());
  }

  bind();
  calc();
})();
