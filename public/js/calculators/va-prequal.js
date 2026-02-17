/* =====================================================
   VA Pre-Qualification Worksheet
   ===================================================== */
'use strict';

var piFactors = {
  '4.000':{15:7.40,20:6.06,30:4.77},'4.125':{15:7.46,20:6.13,30:4.85},'4.250':{15:7.52,20:6.19,30:4.92},
  '4.375':{15:7.59,20:6.26,30:4.99},'4.500':{15:7.65,20:6.33,30:5.07},'4.625':{15:7.71,20:6.39,30:5.14},
  '4.750':{15:7.78,20:6.46,30:5.22},'4.875':{15:7.84,20:6.53,30:5.29},'5.000':{15:7.91,20:6.60,30:5.37},
  '5.125':{15:7.97,20:6.67,30:5.44},'5.250':{15:8.04,20:6.74,30:5.52},'5.375':{15:8.10,20:6.81,30:5.60},
  '5.500':{15:8.17,20:6.88,30:5.68},'5.625':{15:8.24,20:6.95,30:5.76},'5.750':{15:8.30,20:7.02,30:5.84},
  '5.875':{15:8.37,20:7.09,30:5.92},'6.000':{15:8.44,20:7.16,30:6.00},'6.125':{15:8.51,20:7.24,30:6.08},
  '6.250':{15:8.57,20:7.31,30:6.16},'6.375':{15:8.64,20:7.38,30:6.24},'6.500':{15:8.71,20:7.46,30:6.32},
  '6.625':{15:8.78,20:7.53,30:6.40},'6.750':{15:8.85,20:7.60,30:6.49},'6.875':{15:8.92,20:7.68,30:6.57},
  '7.000':{15:8.99,20:7.75,30:6.65},'7.125':{15:9.06,20:7.83,30:6.74},'7.250':{15:9.13,20:7.90,30:6.82},
  '7.375':{15:9.20,20:7.98,30:6.91},'7.500':{15:9.27,20:8.06,30:6.99},'7.625':{15:9.34,20:8.13,30:7.08},
  '7.750':{15:9.41,20:8.21,30:7.16},'7.875':{15:9.48,20:8.29,30:7.25},'8.000':{15:9.56,20:8.36,30:7.34},
  '8.125':{15:9.63,20:8.44,30:7.42},'8.250':{15:9.70,20:8.52,30:7.51},'8.375':{15:9.77,20:8.60,30:7.60},
  '8.500':{15:9.85,20:8.68,30:7.69},'8.625':{15:9.92,20:8.76,30:7.78},'8.750':{15:9.99,20:8.84,30:7.87},
  '8.875':{15:10.07,20:8.92,30:7.96},'9.000':{15:10.14,20:9.00,30:8.05},'9.125':{15:10.22,20:9.08,30:8.14},
  '9.250':{15:10.29,20:9.16,30:8.23},'9.375':{15:10.37,20:9.24,30:8.32},'9.500':{15:10.44,20:9.32,30:8.41}
};

var residualData = {
  under80k: {
    Northeast:{1:390,2:654,3:788,4:888,5:921}, Midwest:{1:382,2:641,3:772,4:868,5:902},
    South:{1:382,2:641,3:772,4:868,5:902}, West:{1:425,2:713,3:859,4:967,5:1004}
  },
  over80k: {
    Northeast:{1:450,2:755,3:909,4:1025,5:1062}, Midwest:{1:441,2:738,3:889,4:1003,5:1039},
    South:{1:441,2:738,3:889,4:1003,5:1039}, West:{1:491,2:823,3:990,4:1117,5:1158}
  },
  additionalUnder80k: 75,
  additionalOver80k: 80
};

function pn(id) { return MSFG.parseNumById(id); }
var fmt = MSFG.formatCurrency;

function getPaymentFactor(rate, term) {
  var key = parseFloat(rate).toFixed(3);
  return (piFactors[key] && piFactors[key][term]) || 0;
}

function getRequiredResidual(loanAmt, region, familySize) {
  var table = loanAmt >= 80000 ? 'over80k' : 'under80k';
  var add = loanAmt >= 80000 ? residualData.additionalOver80k : residualData.additionalUnder80k;
  var size = Math.min(familySize, 5);
  var base = residualData[table][region][size];
  if (familySize > 5) base += (familySize - 5) * add;
  return base;
}

function calculate() {
  var mortAmt = pn('mortgageAmount');
  var rate = document.getElementById('interestRate').value;
  var term = parseInt(document.getElementById('loanTerm').value);
  var gross = pn('grossIncome');
  var fam = parseInt(document.getElementById('familySize').value);
  var region = document.getElementById('region').value;

  var factor = getPaymentFactor(rate, term);
  var pi = (mortAmt / 1000) * factor;
  document.getElementById('paymentFactor').value = factor.toFixed(2);
  document.getElementById('piPayment').value = pi.toFixed(2);

  var taxes = pn('propertyTaxes'), ins = pn('homeInsurance'), hoa = pn('hoaDues');
  var housing = pi + taxes + ins + hoa;
  document.getElementById('totalHousing').textContent = fmt(housing, 0);

  var car = pn('carPayments'), rev = pn('revolvingAccounts'), inst = pn('installmentLoans');
  var child = pn('childCare'), other = pn('otherDebts');
  var debts = car + rev + inst + child + other;
  document.getElementById('totalDebts').textContent = fmt(debts, 0);

  var sqft = pn('squareFootage');
  var maint = sqft * 0.14;
  document.getElementById('maintenanceCost').value = maint.toFixed(2);
  document.getElementById('totalMaintenance').textContent = fmt(maint, 0);

  var fedTax = pn('federalTax'), stateTax = pn('stateTax'), ss = pn('socialSecurity');
  var totalTax = fedTax + stateTax + ss;
  document.getElementById('totalTaxes').textContent = fmt(totalTax, 0);

  var reqRes = getRequiredResidual(mortAmt, region, fam);
  var actRes = gross - housing - debts - maint - totalTax;
  document.getElementById('requiredResidual').textContent = fmt(reqRes, 0);
  document.getElementById('actualResidual').textContent = fmt(actRes, 0);

  var resEl = document.getElementById('residualStatus');
  if (actRes >= reqRes) {
    resEl.className = 'residual-status pass';
    resEl.innerHTML = '\u2713 PASSES (' + fmt(actRes - reqRes, 0) + ' above requirement)';
  } else {
    resEl.className = 'residual-status fail';
    resEl.innerHTML = '\u2717 SHORT by ' + fmt(reqRes - actRes, 0);
  }

  var dti = gross > 0 ? ((housing + debts) / gross) * 100 : 0;
  var dtiEl = document.getElementById('dtiRatio');
  dtiEl.textContent = dti.toFixed(1) + '%';
  dtiEl.style.color = dti <= 41 ? 'var(--color-success)' : dti <= 50 ? 'var(--color-warning)' : 'var(--color-danger)';

  document.getElementById('summaryPI').textContent = fmt(pi, 0);
  document.getElementById('summaryHousing').textContent = fmt(housing, 0);
  document.getElementById('summaryDebts').textContent = fmt(debts, 0);
  document.getElementById('summaryIncome').textContent = fmt(gross, 0);

  renderCalcSteps(pi, housing, debts, maint, totalTax, gross, actRes, reqRes, dti, factor, mortAmt, term);
}

function renderCalcSteps(pi, housing, debts, maint, tax, gross, actRes, reqRes, dti, factor, mortAmt, _term) {
  var c = document.getElementById('calcSteps-vaprequal');
  if (!c) return;
  var html = '';
  html += '<div class="calc-step"><h4>Step 1: P&I Payment</h4><div class="calc-step__formula">P&I = (Mortgage ÷ 1,000) × Payment Factor<br><span class="calc-step__values">= (' + fmt(mortAmt,0) + ' ÷ 1,000) × ' + factor.toFixed(2) + ' = <strong>' + fmt(pi,0) + '</strong></span></div></div>';
  html += '<div class="calc-step"><h4>Step 2: Total Housing (PITI)</h4><div class="calc-step__formula">Housing = P&I + Taxes + Insurance + HOA<br><span class="calc-step__values">= <strong>' + fmt(housing,0) + '</strong></span></div></div>';
  html += '<div class="calc-step"><h4>Step 3: DTI Ratio</h4><div class="calc-step__formula">DTI = (Housing + Debts) ÷ Gross Income<br><span class="calc-step__values">= (' + fmt(housing,0) + ' + ' + fmt(debts,0) + ') ÷ ' + fmt(gross,0) + ' = <strong>' + dti.toFixed(1) + '%</strong></span></div></div>';
  html += '<div class="calc-step"><h4>Step 4: Residual Income</h4><div class="calc-step__formula">Residual = Gross - Housing - Debts - Maintenance - Taxes<br><span class="calc-step__values">= ' + fmt(gross,0) + ' - ' + fmt(housing,0) + ' - ' + fmt(debts,0) + ' - ' + fmt(maint,0) + ' - ' + fmt(tax,0) + ' = <strong>' + fmt(actRes,0) + '</strong></span></div></div>';
  html += '<div class="calc-step highlight"><h4>Result</h4><div class="calc-step__formula"><span class="calc-step__values">Required: ' + fmt(reqRes,0) + ' | Actual: <strong>' + fmt(actRes,0) + '</strong></span></div></div>';
  c.innerHTML = html;
}

function buildResidualTables() {
  var regions = ['Northeast','Midwest','South','West'];
  ['under80k','over80k'].forEach(function(key) {
    var body = document.getElementById('residual' + (key === 'under80k' ? 'Under80k' : 'Over80k') + 'Body');
    body.innerHTML = '';
    for (var s = 1; s <= 5; s++) {
      var row = '<tr><td>' + s + '</td>';
      regions.forEach(function(r) { row += '<td>$' + residualData[key][r][s] + '</td>'; });
      row += '</tr>';
      body.innerHTML += row;
    }
  });
}

window.toggleRefTables = function() {
  var el = document.getElementById('refTables');
  var btn = document.getElementById('refTableToggle');
  if (el.style.display === 'none') { el.style.display = 'block'; btn.textContent = 'Hide Reference Tables'; }
  else { el.style.display = 'none'; btn.textContent = 'Show Reference Tables'; }
};

document.addEventListener('DOMContentLoaded', function() {
  var sel = document.getElementById('interestRate');
  Object.keys(piFactors).sort(function(a,b){return parseFloat(a)-parseFloat(b);}).forEach(function(rate) {
    var opt = document.createElement('option');
    opt.value = rate;
    opt.textContent = parseFloat(rate).toFixed(3) + '%';
    if (rate === '6.500') opt.selected = true;
    sel.appendChild(opt);
  });
  buildResidualTables();
  calculate();
});
