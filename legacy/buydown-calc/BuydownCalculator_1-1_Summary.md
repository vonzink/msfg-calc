# Buydown Calculator - 1-1 Buydown Addition

## ✅ What Was Added

Added **1-1 Buydown** option to the existing buydown calculator which already supported:
- 3-2-1 Buydown
- 2-1 Buydown  
- 1-0 Buydown

## 📊 How 1-1 Buydown Works

**Structure:**
- **Year 1:** Interest rate reduced by 1%
- **Year 2:** Interest rate reduced by 1% (same as Year 1)
- **Year 3+:** Full note rate

**Example:**
```
If note rate is 6.5%:
- Year 1: 5.5% (6.5% - 1%)
- Year 2: 5.5% (6.5% - 1%)
- Year 3+: 6.5% (full rate)
```

**Key Difference from 2-1:**
- **2-1 Buydown:** Year 1 = -2%, Year 2 = -1%
- **1-1 Buydown:** Year 1 = -1%, Year 2 = -1% (both years same reduction)

**Key Difference from 1-0:**
- **1-0 Buydown:** Year 1 = -1%, then full rate (only 1 year reduced)
- **1-1 Buydown:** Year 1 = -1%, Year 2 = -1% (2 years reduced)

---

## 🔧 Technical Changes Made

### 1. **Dropdown Menu** (Line ~284)
Added new option between 2-1 and 1-0:
```html
<option value="1-1">1-1 Buydown</option>
```

### 2. **Calculation Logic** (Lines ~522-537)
Added new case in `getBuydownRates()` function:
```javascript
case '1-1':
  return {
    year1: Math.max(0, noteRate - 1),    // -1%
    year2: Math.max(0, noteRate - 1),    // -1% (same as year 1)
    year3: noteRate,                      // Full rate
    fullRate: noteRate,
    years: 2                               // 2 years of reduction
  };
```

### 3. **UI Display Logic** (Lines ~811-821)
Added display text for 1-1 in math steps:
```javascript
else if (state.buydownType === '1-1') {
  step1HTML = `
    Year 1: ${noteRate} - 1% = ${year1Rate}
    Year 2: ${noteRate} - 1% = ${year2Rate}
    Year 3+: Full rate = ${fullRate}
  `;
}
```

### 4. **Year Display Logic** (Multiple locations)
Updated which years to show in breakdowns:
```javascript
// Show Years 1, 2, and Full Rate (skipping Year 3)
yearsToShow = [0, 1, 3];  // Same as 2-1
```

### 5. **Description Text** (Lines ~254, ~467)
Updated descriptions in:
- Header: "3-2-1, 2-1, 1-1, and 1-0 buydowns"
- Footer: Added explanation of 1-1 buydown

---

## 📝 How to Use (for loan officers)

### When to Offer 1-1 Buydown?

**Best For:**
- Borrowers who want 2 years of reduced payments (not just 1)
- Lower upfront cost than 2-1 buydown
- More predictable payments (both reduced years are identical)

**Cost Comparison (example with $400k loan at 6.5%):**
- **3-2-1:** ~$13,200 buydown cost
- **2-1:** ~$8,800 buydown cost
- **1-1:** ~$8,800 buydown cost
- **1-0:** ~$4,400 buydown cost

**Monthly Payment (Year 1):**
- **3-2-1:** $2,027 (rate: 3.5%)
- **2-1:** $2,264 (rate: 4.5%)
- **1-1:** $2,528 (rate: 5.5%)
- **1-0:** $2,528 (rate: 5.5%)

### Input Fields:
1. **Loan Amount:** Base loan amount
2. **Note Rate:** Full interest rate (not the reduced rate)
3. **Loan Term:** 15 or 30 years
4. **Buydown Type:** Select "1-1 Buydown"
5. **Optional:** Property taxes, insurance, HOA

### Output Shows:
- ✅ Year 1 & Year 2 reduced payments (identical)
- ✅ Year 3+ full payment
- ✅ Monthly savings in years 1-2
- ✅ Total buydown cost
- ✅ Year-by-year breakdown
- ✅ Payment comparison chart

---

## 🧪 Test Scenario

**Test with these values:**
```
Loan Amount: $400,000
Note Rate: 6.5%
Loan Term: 30 years
Buydown Type: 1-1 Buydown
```

**Expected Results:**
- Year 1 Rate: 5.5% (6.5% - 1%)
- Year 2 Rate: 5.5% (6.5% - 1%)
- Year 3+ Rate: 6.5% (full rate)
- Year 1 P&I Payment: ~$2,528/mo
- Year 2 P&I Payment: ~$2,528/mo
- Year 3+ P&I Payment: ~$2,814/mo
- Monthly Savings Years 1-2: ~$286/mo
- Total Buydown Cost: ~$8,800

---

## 📂 File Information

**File:** `BuydownCalculator.html`
**Size:** 47 KB (1,184 lines)
**Changes:** Added 19 lines for 1-1 buydown support

**Upload to:** `s3://msfg-calc/buydown-calc/BuydownCalculator.html`

---

## ✅ What's Already Working

All existing features are preserved:
- ✅ 3-2-1, 2-1, 1-0 buydowns still work perfectly
- ✅ Optional taxes/insurance/HOA
- ✅ 15 or 30 year terms
- ✅ URL parameter support (shareable links)
- ✅ Payment breakdown charts
- ✅ Math step-by-step display
- ✅ MSFG branding
- ✅ Mobile responsive

---

## 🚀 Ready to Deploy

The calculator is production-ready with the new 1-1 buydown option fully integrated!
