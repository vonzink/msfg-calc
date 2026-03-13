// LLPM Adjustment Matrix
// All values are in points (1.000 = 1 point = 1%)
// Positive = cost to borrower (price down), negative = credit to borrower (price up)

// Loan program-specific adjustment matrices
export const ADJUSTMENTS = {
  // Conventional Loan Adjustments
  Conventional: {
    creditScore: {
      ">=780": 0.000,
      "760-779": 0.125,
      "740-759": 0.250,
      "720-739": 0.375,
      "700-719": 0.500,
      "680-699": 0.625,
      "660-679": 0.750,
      "640-659": 1.000,
      "<640": 1.500
    },
    ltv: {
      "<=60": 0.000,
      "60.01-70": 0.125,
      "70.01-75": 0.250,
      "75.01-80": 0.375,
      "80.01-85": 0.500,
      "85.01-90": 0.750,
      "90.01-95": 1.000,
      "95.01-97": 1.250,
      ">97": 1.500
    },
    productType: { 
      "Fixed": 0.000, 
      "ARM": 0.250 
    },
    highBalance: { 
      enabled: 0.375 
    },
    occupancy: { 
      "Primary": 0.000, 
      "SecondHome": 0.750, 
      "Investment": 1.250 
    },
    propertyType: { 
      "Condo": 0.375, 
      "ManufacturedHome": 1.000 
    },
    units: { 
      "1": 0.000, 
      "2": 0.375, 
      "3": 0.625, 
      "4": 0.875 
    },
    subordinateFinancing: { 
      enabled: 0.500 
    },
    lowModIncome: { 
      enabled: -0.250 
    },
    refinanceType: {
      "RateTerm": 0.000,
      "CashOut": 0.375,
      "Purchase": 0.000
    },
    llpaWaivers: {
      "VeryLowIncome": { threshold: 50, credit: -0.750, reason: "Very Low Income (≤50% AMI)" },
      "LowIncome": { threshold: 80, credit: -0.500, reason: "Low Income (≤80% AMI)" },
      "ModerateIncome": { threshold: 120, credit: -0.250, reason: "Moderate Income (≤120% AMI)" }
    },
    mmi: {
      enabled: true,
      rate: 0.250,
      reason: "Minimum Mortgage Insurance (LTV > 80%)"
    },
    combos: [
      {
        when: { highBalance: true, productType: "ARM" },
        add: 0.125,
        reason: "High-Balance ARM combo"
      },
      {
        when: { occupancy: "Investment", ltv: ">97" },
        add: 0.250,
        reason: "Investment Property High LTV"
      },
      {
        when: { refinanceType: "CashOut", ltv: ">90" },
        add: 0.250,
        reason: "High LTV Cash-Out Refinance"
      }
    ]
  },

  // FHA Loan Adjustments
  FHA: {
    creditScore: {
      ">=780": 0.000,
      "760-779": 0.250,
      "740-759": 0.500,
      "720-739": 0.750,
      "700-719": 1.000,
      "680-699": 1.250,
      "660-679": 1.500,
      "640-659": 1.750,
      "<640": 2.000
    },
    ltv: {
      "<=60": 0.000,
      "60.01-70": 0.250,
      "70.01-75": 0.500,
      "75.01-80": 0.750,
      "80.01-85": 1.000,
      "85.01-90": 1.250,
      "90.01-95": 1.500,
      "95.01-97": 1.750,
      ">97": 2.000
    },
    productType: { 
      "Fixed": 0.000, 
      "ARM": 0.375 
    },
    highBalance: { 
      enabled: 0.500 
    },
    occupancy: { 
      "Primary": 0.000, 
      "SecondHome": 1.000, 
      "Investment": 1.500 
    },
    propertyType: { 
      "Condo": 0.500, 
      "ManufacturedHome": 1.250 
    },
    units: { 
      "1": 0.000, 
      "2": 0.500, 
      "3": 0.750, 
      "4": 1.000 
    },
    subordinateFinancing: { 
      enabled: 0.750 
    },
    lowModIncome: { 
      enabled: -0.375 
    },
    refinanceType: {
      "RateTerm": 0.000,
      "CashOut": 0.500,
      "Purchase": 0.000
    },
    llpaWaivers: {
      "VeryLowIncome": { threshold: 50, credit: -1.000, reason: "Very Low Income (≤50% AMI)" },
      "LowIncome": { threshold: 80, credit: -0.750, reason: "Low Income (≤80% AMI)" },
      "ModerateIncome": { threshold: 120, credit: -0.500, reason: "Moderate Income (≤120% AMI)" }
    },
    mmi: {
      enabled: false, // FHA has upfront MIP instead
      rate: 0.000,
      reason: "FHA Upfront MIP (1.75%)"
    },
    combos: [
      {
        when: { highBalance: true, productType: "ARM" },
        add: 0.125,
        reason: "High-Balance ARM combo"
      },
      {
        when: { occupancy: "Investment", ltv: ">97" },
        add: 0.375,
        reason: "Investment Property High LTV"
      }
    ]
  },

  // VA Loan Adjustments
  VA: {
    creditScore: {
      ">=780": 0.000,
      "760-779": 0.125,
      "740-759": 0.250,
      "720-739": 0.375,
      "700-719": 0.500,
      "680-699": 0.625,
      "660-679": 0.750,
      "640-659": 1.000,
      "<640": 1.250
    },
    ltv: {
      "<=60": 0.000,
      "60.01-70": 0.125,
      "70.01-75": 0.250,
      "75.01-80": 0.375,
      "80.01-85": 0.500,
      "85.01-90": 0.750,
      "90.01-95": 1.000,
      "95.01-97": 1.250,
      ">97": 1.500
    },
    productType: { 
      "Fixed": 0.000, 
      "ARM": 0.250 
    },
    highBalance: { 
      enabled: 0.500 
    },
    occupancy: { 
      "Primary": 0.000, 
      "SecondHome": 0.750, 
      "Investment": 1.500 
    },
    propertyType: { 
      "Condo": 0.375, 
      "ManufacturedHome": 1.000 
    },
    units: { 
      "1": 0.000, 
      "2": 0.375, 
      "3": 0.625, 
      "4": 0.875 
    },
    subordinateFinancing: { 
      enabled: 0.500 
    },
    lowModIncome: { 
      enabled: -0.250 
    },
    refinanceType: {
      "RateTerm": 0.000,
      "CashOut": 0.375,
      "Purchase": 0.000
    },
    llpaWaivers: {
      "VeryLowIncome": { threshold: 50, credit: -0.750, reason: "Very Low Income (≤50% AMI)" },
      "LowIncome": { threshold: 80, credit: -0.500, reason: "Low Income (≤80% AMI)" },
      "ModerateIncome": { threshold: 120, credit: -0.250, reason: "Moderate Income (≤120% AMI)" }
    },
    mmi: {
      enabled: false, // VA has funding fee instead
      rate: 0.000,
      reason: "VA Funding Fee (varies by down payment)"
    },
    combos: [
      {
        when: { highBalance: true, productType: "ARM" },
        add: 0.125,
        reason: "High-Balance ARM combo"
      },
      {
        when: { occupancy: "Investment", ltv: ">97" },
        add: 0.250,
        reason: "Investment Property High LTV"
      }
    ]
  },

  // USDA Loan Adjustments
  USDA: {
    creditScore: {
      ">=780": 0.000,
      "760-779": 0.250,
      "740-759": 0.500,
      "720-739": 0.750,
      "700-719": 1.000,
      "680-699": 1.250,
      "660-679": 1.500,
      "640-659": 1.750,
      "<640": 2.000
    },
    ltv: {
      "<=60": 0.000,
      "60.01-70": 0.250,
      "70.01-75": 0.500,
      "75.01-80": 0.750,
      "80.01-85": 1.000,
      "85.01-90": 1.250,
      "90.01-95": 1.500,
      "95.01-97": 1.750,
      ">97": 2.000
    },
    productType: { 
      "Fixed": 0.000, 
      "ARM": 0.375 
    },
    highBalance: { 
      enabled: 0.000 // USDA has loan limits
    },
    occupancy: { 
      "Primary": 0.000, 
      "SecondHome": 1.000, 
      "Investment": 1.500 
    },
    propertyType: { 
      "Condo": 0.500, 
      "ManufacturedHome": 1.250 
    },
    units: { 
      "1": 0.000, 
      "2": 0.500, 
      "3": 0.750, 
      "4": 1.000 
    },
    subordinateFinancing: { 
      enabled: 0.750 
    },
    lowModIncome: { 
      enabled: -0.500 
    },
    refinanceType: {
      "RateTerm": 0.000,
      "CashOut": 0.500,
      "Purchase": 0.000
    },
    llpaWaivers: {
      "VeryLowIncome": { threshold: 50, credit: -1.000, reason: "Very Low Income (≤50% AMI)" },
      "LowIncome": { threshold: 80, credit: -0.750, reason: "Low Income (≤80% AMI)" },
      "ModerateIncome": { threshold: 120, credit: -0.500, reason: "Moderate Income (≤120% AMI)" }
    },
    mmi: {
      enabled: false, // USDA has guarantee fee instead
      rate: 0.000,
      reason: "USDA Guarantee Fee (1.0%)"
    },
    combos: [
      {
        when: { highBalance: true, productType: "ARM" },
        add: 0.125,
        reason: "High-Balance ARM combo"
      },
      {
        when: { occupancy: "Investment", ltv: ">97" },
        add: 0.250,
        reason: "Investment Property High LTV"
      }
    ]
  }
};

// Default state for the application
export const DEFAULT_STATE = {
  baseRate: 0,
  startingPoints: 0,
  loanAmount: 0,
  propertyValue: 0, // For LTV calculation
  creditScore: ">=780",
  loanProgram: "Conventional", // Added loan program
  productType: "Fixed",
  highBalance: false,
  occupancy: "Primary",
  propertyType: {
    condo: false,
    manufacturedHome: false
  },
  units: "1",
  subordinateFinancing: false,
  lowModIncome: false,
  minimumMI: false,
  llpaWaiver: false,
  refinanceType: "RateTerm",
  borrowerIncome: 0,
  areaMedianIncome: 0,
  zipCode: ""
};

// Helper functions for determining tiers
export function getLTVTier(ltv) {
  if (ltv <= 60) return "<=60";
  if (ltv <= 70) return "60.01-70";
  if (ltv <= 75) return "70.01-75";
  if (ltv <= 80) return "75.01-80";
  if (ltv <= 85) return "80.01-85";
  if (ltv <= 90) return "85.01-90";
  if (ltv <= 95) return "90.01-95";
  if (ltv <= 97) return "95.01-97";
  return ">97";
}

export function getIncomeWaiverTier(borrowerIncome, areaMedianIncome) {
  const ratio = (borrowerIncome / areaMedianIncome) * 100;
  if (ratio <= 50) return "VeryLowIncome";
  if (ratio <= 80) return "LowIncome";
  if (ratio <= 120) return "ModerateIncome";
  return null;
}
