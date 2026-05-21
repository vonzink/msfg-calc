/**
 * APR Fee Catalog tests
 * Verifies resolver decision tree and MISMO alias coverage.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Load the catalog (it exports via module.exports in Node)
const Catalog = require('../public/js/shared/apr-fee-catalog.js');

describe('AprFeeCatalog: structure', () => {
  it('exposes FEES, UI_GROUPS, resolveAprTreatment, mismoKeyToFeeId', () => {
    assert.ok(Catalog.FEES);
    assert.ok(Array.isArray(Catalog.UI_GROUPS));
    assert.strictEqual(typeof Catalog.resolveAprTreatment, 'function');
    assert.strictEqual(typeof Catalog.mismoKeyToFeeId, 'function');
  });

  it('UI_GROUPS reference only defined fee IDs', () => {
    Catalog.UI_GROUPS.forEach((g) => {
      g.feeIds.forEach((id) => {
        assert.ok(Catalog.FEES[id], 'Missing fee def for ' + id);
      });
    });
  });

  it('every fee has appliesTo and aprFlagDefault', () => {
    Object.keys(Catalog.FEES).forEach((id) => {
      const def = Catalog.FEES[id];
      assert.ok(Array.isArray(def.appliesTo) && def.appliesTo.length > 0, id + ' missing appliesTo');
      assert.ok(['APR_YES','APR_NO','APR_CONDITIONAL'].indexOf(def.aprFlagDefault) !== -1, id + ' invalid flag');
    });
  });
});

describe('AprFeeCatalog: resolver decision tree', () => {
  const r = Catalog.resolveAprTreatment;

  it('zero amount → excluded', () => {
    const res = r('origination_fee', { amount: 0, loanType: 'CONV' });
    assert.strictEqual(res.includeInApr, false);
  });

  it('origination fee with amount → APR_YES', () => {
    const res = r('origination_fee', { amount: 1500, loanType: 'CONV' });
    assert.strictEqual(res.includeInApr, true);
    assert.strictEqual(res.aprFlagUsed, 'APR_YES');
  });

  it('discount points → APR_YES', () => {
    const res = r('discount_points', { amount: 3000, loanType: 'CONV' });
    assert.strictEqual(res.includeInApr, true);
  });

  it('appraisal bona-fide-and-reasonable → APR_NO', () => {
    const res = r('appraisal_fee', { amount: 650, loanType: 'CONV', bonaFideAndReasonable: true });
    assert.strictEqual(res.includeInApr, false);
  });

  it('appraisal NOT bona-fide → conservatively included', () => {
    const res = r('appraisal_fee', { amount: 650, loanType: 'CONV', bonaFideAndReasonable: false });
    assert.strictEqual(res.includeInApr, true);
  });

  it('credit report bona-fide → APR_NO', () => {
    const res = r('credit_report_fee', { amount: 75, loanType: 'CONV', bonaFideAndReasonable: true });
    assert.strictEqual(res.includeInApr, false);
  });

  it('tax service fee = APR_YES (life of loan)', () => {
    const res = r('tax_service_fee', { amount: 89, loanType: 'CONV' });
    assert.strictEqual(res.includeInApr, true);
  });

  it('initial flood cert bona-fide → APR_NO', () => {
    const res = r('initial_flood_cert', { amount: 15, loanType: 'CONV', bonaFideAndReasonable: true });
    assert.strictEqual(res.includeInApr, false);
  });

  it('life-of-loan flood monitoring → APR_YES', () => {
    const res = r('flood_monitoring_fee', { amount: 20, loanType: 'CONV' });
    assert.strictEqual(res.includeInApr, true);
  });

  it('FHA UFMIP cash → APR_YES', () => {
    const res = r('fha_ufmip', { amount: 5250, loanType: 'FHA' });
    assert.strictEqual(res.includeInApr, true);
  });

  it('FHA UFMIP financed → still APR_YES', () => {
    const res = r('fha_ufmip', { amount: 5250, loanType: 'FHA', isFinanced: true });
    assert.strictEqual(res.includeInApr, true);
  });

  it('FHA monthly MIP → APR_YES', () => {
    const res = r('fha_annual_mip', { amount: 137.50, loanType: 'FHA' });
    assert.strictEqual(res.includeInApr, true);
  });

  it('VA Funding Fee → APR_YES', () => {
    const res = r('va_funding_fee', { amount: 4600, loanType: 'VA' });
    assert.strictEqual(res.includeInApr, true);
  });

  it('seller-paid + borrower not legally bound → APR_NO', () => {
    const res = r('origination_fee', { amount: 1500, loanType: 'CONV', isSellerPaid: true, borrowerLegallyBound: false });
    assert.strictEqual(res.includeInApr, false);
  });

  it('seller-paid + borrower legally bound → preserves classification', () => {
    const res = r('origination_fee', { amount: 1500, loanType: 'CONV', isSellerPaid: true, borrowerLegallyBound: true });
    assert.strictEqual(res.includeInApr, true);
  });

  it('application fee charged to all → APR_NO', () => {
    const res = r('application_fee_conditional', { amount: 250, loanType: 'CONV', chargedToAllApplicants: true });
    assert.strictEqual(res.includeInApr, false);
  });

  it('application fee NOT charged to all → APR_YES', () => {
    const res = r('application_fee_conditional', { amount: 250, loanType: 'CONV', chargedToAllApplicants: false });
    assert.strictEqual(res.includeInApr, true);
  });

  it('recording fee (public official) → APR_NO', () => {
    const res = r('recording_fee_mortgage', { amount: 125, loanType: 'CONV' });
    assert.strictEqual(res.includeInApr, false);
  });

  it('transfer tax → APR_NO', () => {
    const res = r('transfer_tax_deed', { amount: 600, loanType: 'CONV' });
    assert.strictEqual(res.includeInApr, false);
  });

  it('hazard insurance with borrower choice → APR_NO', () => {
    const res = r('hazard_insurance_premium', { amount: 900, loanType: 'CONV', borrowerCanChooseInsurer: true });
    assert.strictEqual(res.includeInApr, false);
  });

  it('hazard insurance no choice → APR_YES', () => {
    const res = r('hazard_insurance_premium', { amount: 900, loanType: 'CONV', borrowerCanChooseInsurer: false });
    assert.strictEqual(res.includeInApr, true);
  });

  it('lender-paid MI → APR_NO (not counted)', () => {
    const res = r('lender_paid_mi', { amount: 0, loanType: 'CONV' });
    assert.strictEqual(res.includeInApr, false);
  });

  it('manual override APR_YES wins', () => {
    const res = r('appraisal_fee', { amount: 650, loanType: 'CONV', bonaFideAndReasonable: true, manualOverride: 'APR_YES' });
    assert.strictEqual(res.includeInApr, true);
  });

  it('manual override APR_NO wins', () => {
    const res = r('origination_fee', { amount: 1500, loanType: 'CONV', manualOverride: 'APR_NO' });
    assert.strictEqual(res.includeInApr, false);
  });

  it('unknown fee → safe excluded', () => {
    const res = r('nonexistent_fee', { amount: 100, loanType: 'CONV' });
    assert.strictEqual(res.includeInApr, false);
  });
});

describe('AprFeeCatalog: MISMO alias map', () => {
  it('maps LoanOriginationFee → origination_fee', () => {
    assert.strictEqual(Catalog.mismoKeyToFeeId('LoanOriginationFee'), 'origination_fee');
  });

  it('maps Origination Fee (space variant) → origination_fee', () => {
    assert.strictEqual(Catalog.mismoKeyToFeeId('Origination Fee'), 'origination_fee');
  });

  it('case-insensitive lookup', () => {
    assert.strictEqual(Catalog.mismoKeyToFeeId('CREDITREPORTFEE'), 'credit_report_fee');
  });

  it('maps TaxRelatedServiceFee → tax_service_fee', () => {
    assert.strictEqual(Catalog.mismoKeyToFeeId('TaxRelatedServiceFee'), 'tax_service_fee');
  });

  it('maps TitleLendersCoveragePremium → lenders_title_insurance', () => {
    assert.strictEqual(Catalog.mismoKeyToFeeId('TitleLendersCoveragePremium'), 'lenders_title_insurance');
  });

  it('maps RecordingFeeForDeed → recording_fee_mortgage', () => {
    assert.strictEqual(Catalog.mismoKeyToFeeId('RecordingFeeForDeed'), 'recording_fee_mortgage');
  });

  it('maps TransferTax → transfer_tax_deed', () => {
    assert.strictEqual(Catalog.mismoKeyToFeeId('TransferTax'), 'transfer_tax_deed');
  });

  it('maps VAFundingFee → va_funding_fee', () => {
    assert.strictEqual(Catalog.mismoKeyToFeeId('VAFundingFee'), 'va_funding_fee');
  });

  it('unknown key returns null', () => {
    assert.strictEqual(Catalog.mismoKeyToFeeId('TotallyMadeUpFee'), null);
  });
});

describe('AprFeeCatalog: feesForLoanType filter', () => {
  it('FHA fees include fha_ufmip', () => {
    const fhaFees = Catalog.feesForLoanType('FHA');
    assert.ok(fhaFees.fha_ufmip);
  });

  it('FHA fees exclude monthly_borrower_paid_pmi', () => {
    const fhaFees = Catalog.feesForLoanType('FHA');
    assert.strictEqual(fhaFees.monthly_borrower_paid_pmi, undefined);
  });

  it('VA fees include va_funding_fee', () => {
    const vaFees = Catalog.feesForLoanType('VA');
    assert.ok(vaFees.va_funding_fee);
  });

  it('CONV fees include monthly_borrower_paid_pmi', () => {
    const convFees = Catalog.feesForLoanType('CONV');
    assert.ok(convFees.monthly_borrower_paid_pmi);
  });
});
