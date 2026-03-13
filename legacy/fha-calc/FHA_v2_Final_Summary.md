# FHA Refinance Calculator v2 - Final Version

## ✅ All Updates Complete!

### 1. **Exact HUD UFMIP Refund Table** ✓
**Your Data:**
```
Month 1:  80%    Month 13: 56%    Month 25: 32%
Month 2:  78%    Month 14: 54%    Month 26: 30%
Month 3:  76%    Month 15: 52%    Month 27: 28%
Month 4:  74%    Month 16: 50%    Month 28: 26%
Month 5:  72%    Month 17: 48%    Month 29: 24%
Month 6:  70%    Month 18: 46%    Month 30: 22%
Month 7:  68%    Month 19: 44%    Month 31: 20%
Month 8:  66%    Month 20: 42%    Month 32: 18%
Month 9:  64%    Month 21: 40%    Month 33: 16%
Month 10: 62%    Month 22: 38%    Month 34: 14%
Month 11: 60%    Month 23: 36%    Month 35: 12%
Month 12: 58%    Month 24: 34%    Month 36: 10%
Month 37+: 0%
```

**Implemented:**
- ✅ Exact month-by-month refund schedule
- ✅ All percentages match your table
- ✅ 37+ months = 0% refund
- ✅ Fully editable (can adjust any percentage)
- ✅ "Reset to Default" button

---

### 2. **Original Loan Amount → Auto-Calculate UFMIP** ✓
**Changed From:**
- Enter "Original UFMIP Amount" manually

**Changed To:**
- Enter "Original FHA Loan Amount" (base loan, not including UFMIP)
- Calculator automatically computes: Original UFMIP = Loan Amount × 1.75%
- Then applies refund %: UFMIP Refund = Original UFMIP × Refund %

**Why This Works:**
- UFMIP is always 1.75% (doesn't vary by credit score ✓)
- Users just need to know original loan amount
- More intuitive and accurate

---

### 3. **Itemized Streamline-Allowed Closing Costs** ✓

**New Section with Individual Inputs:**

**Lender Fees:**
- Origination Fee
- Processing Fee
- Underwriting Fee
- Discount Points (if any)

**Third Party Fees:**
- Credit Report Fee
- Flood Certification
- Inspection Fee (if required)

**Title & Recording:**
- Title Search / Exam
- Title Insurance
- Recording Fees
- Attorney / Settlement Fee

**Other Allowed Costs:**
- Survey (if required)
- Pest Inspection (if required)
- Other Streamline-Allowed Costs

**Features:**
- ✅ Auto-sums all costs in real-time
- ✅ Shows total in green box
- ✅ Each item labeled clearly
- ✅ Warning about what CANNOT be financed

**What's NOT Allowed (clearly stated):**
- ❌ Late fees
- ❌ Escrows
- ❌ Prepaids (property taxes, insurance, interest)
- ❌ Payoffs other than existing FHA loan

---

## 📊 How It Works Now:

### **Step 1: Enter Loan Dates**
- FHA endorsement/closing date
- First payment due date
- Current date (auto-filled)
→ Seasoning auto-validates (6 payments + 210 days)

### **Step 2: Enter UPB & Original Loan**
- Current UPB from payoff statement
- Original FHA loan amount (base, not including UFMIP)
→ Calculator finds refund % from table based on months
→ Computes: Original UFMIP = Loan × 1.75%
→ Applies refund: UFMIP Refund = Original UFMIP × Refund %

### **Step 3: Add Accrued Interest** (if applicable)
- Only if payoff is on/after payment due date
- No per diem beyond payoff

### **Step 4: Add Closing Costs**
- Enter each streamline-allowed cost individually
- See total auto-calculate
- Visual warning of what's NOT allowed

### **Final Calculation:**
```
Base Loan = UPB - UFMIP Refund + Accrued Interest + Closing Costs
New UFMIP = Base Loan × 1.75%
────────────────────────────────────────────────────────────────
Maximum Mortgage = Base Loan + New UFMIP
```

---

## 🎯 Key Features:

✅ **Exact HUD refund schedule** (your data, editable)
✅ **Auto-calculate original UFMIP** from loan amount
✅ **Itemized closing costs** with real-time total
✅ **Seasoning validation** (6 payments + 210 days)
✅ **NTB test** with pass/fail logic
✅ **Color-coded status** (green=pass, red=fail)
✅ **Investment property warnings**
✅ **Professional MSFG branding**
✅ **Mobile responsive**

---

## 🧪 Test Scenarios:

### Scenario 1: Simple Streamline
```
Original Loan: $200,000
→ Original UFMIP: $3,500 (auto-calculated)
Loan Age: 12 months
→ Refund %: 58%
→ UFMIP Refund: $2,030

Current UPB: $195,000
Accrued Interest: $800
Closing Costs: $2,500
────────────────────────
Base Loan: $195,000 - $2,030 + $800 + $2,500 = $196,270
New UFMIP: $196,270 × 1.75% = $3,435
Max Mortgage: $199,705
```

### Scenario 2: No Refund (Old Loan)
```
Original Loan: $150,000
Endorsement Date: 1982-05-15 (before 9/1/1983)
→ UFMIP Refund: $0 (not eligible)
```

### Scenario 3: No Refund (Loan Too Old)
```
Original Loan: $180,000
→ Original UFMIP: $3,150
Loan Age: 40 months
→ Refund %: 0% (past 36 months)
→ UFMIP Refund: $0
```

---

## 📋 What to Upload:

**File:** `FHA_Refinance_Calculator_v2.html` (46 KB, 995 lines)
**Location:** `s3://msfg-calc/fha-calc/`
**URL:** `https://msfg-calc.s3.us-west-1.amazonaws.com/fha-calc/FHA_Refinance_Calculator_v2.html`

**Options:**
1. **Replace old version:** Rename to `FHA_Refinance_Calculator.html`
2. **Keep both:** Upload as v2, update index.html link later

---

## 🔍 Verification Checklist:

Before going live, verify:
- [ ] UFMIP refund table shows correct percentages (1-36 months)
- [ ] Original loan amount × 1.75% = correct UFMIP
- [ ] All closing cost items sum properly
- [ ] Seasoning alerts work (try 5 payments, try 200 days)
- [ ] NTB test validates correctly
- [ ] Investment property shows warnings
- [ ] Mobile responsive (test on phone)

---

## 💡 Future Enhancements (Optional):

Want to add:
- 📄 Print/Export to PDF
- 💾 Save/Load calculations
- 📊 Side-by-side comparison (Rate & Term vs Cash-Out vs Streamline)
- 📧 Email results to borrower
- 🔗 Deep link to share a calculation

Let me know!

---

**Status:** ✅ **COMPLETE & READY TO DEPLOY**
**Version:** 2.0 Final
**Date:** February 2026
