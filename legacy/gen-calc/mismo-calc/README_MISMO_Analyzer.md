# MISMO Document Analyzer - Deployment Guide

## 📁 File Structure

This analyzer consists of 3 files that work together:

```
├── MISMO_Document_Analyzer.html  (Frontend UI)
├── mismo-parser.js                (XML parsing module)
└── income-logic.js                (Income documentation logic)
```

## 🚀 Deployment to S3

### Option 1: All files in same directory
Upload all 3 files to the same S3 location:
```
s3://msfg-calc/
├── MISMO_Document_Analyzer.html
├── mismo-parser.js
└── income-logic.js
```

Access at: `https://msfg-calc.s3.us-west-1.amazonaws.com/MISMO_Document_Analyzer.html`

### Option 2: Organized structure
```
s3://msfg-calc/
├── MISMO_Document_Analyzer.html
└── js/
    ├── mismo-parser.js
    └── income-logic.js
```

If using Option 2, update the script src paths in the HTML file:
```html
<script src="js/mismo-parser.js"></script>
<script src="js/income-logic.js"></script>
```

## 📋 What Was Built

### ✅ Income Documentation Logic (NEW)
Implements your complete logic tree:

1. **Self-Employed Detection**
   - Checks business age (>5 years = 1 year returns, ≤5 years = 2 years)
   - Detects entity types (S-Corp, Partnership, 1065, 1120)
   - Handles ownership percentage (<25% vs ≥25%)
   - Requires YTD P&L, business returns, K-1s as appropriate

2. **Alimony/Child Support**
   - Divorce decree + 6 months bank statements

3. **W-2 Employment (Base Income)**
   - 30 days pay stubs + 2 years W-2s
   - New job detection (offer letter if started <30 days ago)
   - Variable income handling (bonus/tips/overtime/commission)
   - Part-time employment documentation

4. **Retirement Income**
   - Social Security: Award letter + continuance proof
   - Pension/Disability: Benefit statement + 3 years bank statements
   - Retirement distributions: 3 months bank statements

5. **Other Income Types**
   - Capital Gains/Dividends: 1040s with Schedule D + asset statements
   - Foster Care: Verification letter + 12 months bank statements
   - Foreign Income: 1040s with Schedule B
   - Unemployment: 1040s (if seasonal) + benefit statements
   - Royalties: 1040s with Schedule E + contracts
   - Trust Income: Full trust document + 2 months statements

### ✅ Preserved Features
- General documentation (ID, 4506-C, purchase contracts, etc.)
- Asset documentation
- Credit documentation
- Employment/residence coverage tracking
- Declarations handling (bankruptcy, foreclosure, citizenship)

## 🎯 Key Features

### Clean Architecture
- **Separation of Concerns**: UI, parsing, and logic are in separate files
- **Modular**: Easy to update logic without touching UI
- **Maintainable**: Clear code structure with comments

### Professional UI
- MSFG branded with company colors
- Drag & drop file upload
- Real-time status indicators
- Color-coded document categories:
  - 🔴 Red = Required
  - 🟠 Orange = Conditional
  - 🟢 Green = Sufficient/OK

### Smart Detection
- Automatically detects income types from MISMO fields
- Calculates employment/business duration
- Identifies entity types (S-Corp, Partnership, etc.)
- Detects new jobs, part-time status, etc.

## 🔍 MISMO Field Mappings

The parser looks for these MISMO 3.4 fields:

**Income:**
- `IncomeType`: "Base", "Hourly", "Bonus", "Commission", "Overtime", "Alimony", "Social Security", "Pension", etc.
- `CurrentIncomeMonthlyTotalAmount`: Monthly income amount
- `EmploymentIncomeIndicator`: true/false

**Employment:**
- `EmploymentBorrowerSelfEmployedIndicator`: true/false
- `EmploymentClassificationType`: "Self-Employed", "S-Corporation", "Partnership", "Retired", "Part-Time", etc.
- `EmploymentStartDate`: Calculate business age
- `OwnershipInterestPercent`: Ownership percentage for entity docs

**Other:**
- `BorrowerResidencyDurationMonthsCount`: Residence history
- `USCitizenIndicator`, `PermanentResidentAlienIndicator`: Citizenship
- `BankruptcyIndicator`, `PropertyForeclosureIndicator`: Declarations

## 📝 Logic Removed

Per your request, we removed:
- ❌ "Have you filed returns for the prior year?" question
- ❌ "Do we need to set up a regular distribution?" question

## 🔄 Next Steps

### To Add More Logic:
1. Edit `income-logic.js` to add new income types or rules
2. No changes needed to HTML or parser

### To Change UI:
1. Edit `MISMO_Document_Analyzer.html` 
2. CSS is in `<style>` section
3. JavaScript is in `<script>` section at bottom

### To Parse New MISMO Fields:
1. Edit `mismo-parser.js`
2. Add field extraction in `parseMISMO()` function
3. Data becomes available to income logic automatically

## 🐛 Testing Checklist

Test with MISMO files that have:
- [ ] Self-employed borrower (with/without separate business returns)
- [ ] W-2 employee with bonuses/commission
- [ ] Retired borrower with Social Security + pension
- [ ] Multiple income types per borrower
- [ ] New job (started <30 days ago)
- [ ] Part-time employment
- [ ] Various "other income" types
- [ ] Non-US citizen borrowers
- [ ] Bankruptcy/foreclosure declarations

## 📞 Support

If you need to modify the logic tree or add new features, the code is well-commented and modular. Each function in `income-logic.js` corresponds to a section of your logic tree document.

---

**Version:** 1.0  
**Last Updated:** February 2026  
**Maintained By:** MSFG Technology Team
