'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

const PROCESSING_TYPES = [
  { slug: 'title',     name: 'Title',     icon: '📋', description: 'Title company orders, commitments, and status tracking' },
  { slug: 'insurance', name: 'Insurance',  icon: '🛡️', description: 'Homeowner insurance policies, binders, and verification' },
  { slug: 'voe',       name: 'VOE',        icon: '✅', description: 'Verification of Employment requests and results' },
  { slug: 'taxes',     name: 'Taxes',      icon: '🧾', description: 'Tax transcript requests and property tax records' },
  { slug: 'amc',       name: 'AMC',        icon: '🏠', description: 'Appraisal management company orders and reports' },
  { slug: 'payoffs',   name: 'Payoffs',    icon: '💳', description: 'Payoff statement requests and lien tracking' },
  { slug: 'other',     name: 'Other',      icon: '📁', description: 'Miscellaneous processing items and documents' }
];

function validType(slug) {
  return PROCESSING_TYPES.find(t => t.slug === slug);
}

/* ---- API routes (before /:type wildcard) ---- */

// Search records
router.get('/api/:type/search', (req, res) => {
  const type = validType(req.params.type);
  if (!type) return res.status(404).json({ success: false, message: 'Unknown processing type.' });

  try {
    const data = db.searchRecords({
      type: type.slug,
      query: req.query.q,
      status: req.query.status,
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit
    });

    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[Processing] Search error:', err);
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// Get single record
router.get('/api/:type/:id', (req, res) => {
  const type = validType(req.params.type);
  if (!type) return res.status(404).json({ success: false, message: 'Unknown processing type.' });

  const record = db.getRecord(parseInt(req.params.id, 10));
  if (!record || record.type !== type.slug) {
    return res.status(404).json({ success: false, message: 'Record not found.' });
  }

  res.json({ success: true, record });
});

// Create record
router.post('/api/:type', express.json(), (req, res) => {
  const type = validType(req.params.type);
  if (!type) return res.status(404).json({ success: false, message: 'Unknown processing type.' });

  const { borrower, loanNumber, address, vendor, status, orderedDate, reference, notes } = req.body;

  if (!borrower || !borrower.trim()) {
    return res.status(400).json({ success: false, message: 'Borrower name is required.' });
  }

  try {
    const record = db.createRecord({
      type: type.slug,
      borrower: borrower.trim(),
      loanNumber: (loanNumber || '').trim(),
      address: (address || '').trim(),
      vendor: (vendor || '').trim(),
      status: status || 'ordered',
      orderedDate: orderedDate || null,
      reference: (reference || '').trim(),
      notes: (notes || '').trim()
    });

    res.status(201).json({ success: true, record });
  } catch (err) {
    console.error('[Processing] Create error:', err);
    res.status(500).json({ success: false, message: 'Failed to create record.' });
  }
});

// Update record
router.put('/api/:type/:id', express.json(), (req, res) => {
  const type = validType(req.params.type);
  if (!type) return res.status(404).json({ success: false, message: 'Unknown processing type.' });

  const id = parseInt(req.params.id, 10);
  const existing = db.getRecord(id);
  if (!existing || existing.type !== type.slug) {
    return res.status(404).json({ success: false, message: 'Record not found.' });
  }

  const updates = {};
  const fields = {
    borrower: 'borrower',
    loanNumber: 'loan_number',
    address: 'address',
    vendor: 'vendor',
    status: 'status',
    orderedDate: 'ordered_date',
    reference: 'reference',
    notes: 'notes'
  };

  for (const [bodyKey, dbKey] of Object.entries(fields)) {
    if (req.body[bodyKey] !== undefined) {
      updates[dbKey] = typeof req.body[bodyKey] === 'string' ? req.body[bodyKey].trim() : req.body[bodyKey];
    }
  }

  try {
    const record = db.updateRecord(id, updates);
    res.json({ success: true, record });
  } catch (err) {
    console.error('[Processing] Update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update record.' });
  }
});

// Delete record
router.delete('/api/:type/:id', (req, res) => {
  const type = validType(req.params.type);
  if (!type) return res.status(404).json({ success: false, message: 'Unknown processing type.' });

  const id = parseInt(req.params.id, 10);
  const existing = db.getRecord(id);
  if (!existing || existing.type !== type.slug) {
    return res.status(404).json({ success: false, message: 'Record not found.' });
  }

  try {
    db.deleteRecord(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Processing] Delete error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete record.' });
  }
});

/* ---- Page routes ---- */

// Landing — redirect to first type
router.get('/', (req, res) => {
  res.redirect('/processing/title');
});

// Search page for each processing type
router.get('/:type', (req, res) => {
  const type = validType(req.params.type);
  if (!type) return res.status(404).render('404', { title: 'Not Found' });

  const ver = res.locals.v;
  res.render('processing/search', {
    title: type.name + ' — Processing',
    processingType: type,
    processingTypes: PROCESSING_TYPES,
    extraHead: `<link rel="stylesheet" href="/css/processing.css?v=${ver}">`,
    extraScripts: `<script src="/js/processing.js?v=${ver}"></script>`
  });
});

module.exports = router;
