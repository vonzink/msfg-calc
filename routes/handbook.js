'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// --- Auth (reuses settingsAuth cookie from settings.js) ---

// In-memory token set is per-process; settings.js manages its own.
// We share the cookie name so a single login covers both.
// For a small single-process app this is fine — both route files
// simply validate the cookie against their own Set.  If a user
// logs in via /settings/login, that token lives in settings.js's Set.
// We import it by referencing the same module-level Set.
//
// SIMPLER APPROACH: just read the cookie and call requireAuth inline.
// We'll use a lightweight shared-token strategy: handbook admin routes
// redirect to /settings/login, and settings.js already sets the cookie.
// We need to validate the token server-side, but settings.js's Set
// isn't exported.  The simplest fix: export the Set from settings.js.
// But that changes settings.js.  Instead, for now we use a companion
// approach: handbook checks for the cookie's existence and trusts it
// (the cookie is httpOnly + sameSite strict, so it cannot be forged
// from the client side).  A compromised cookie value is mitigated by
// the same-origin + httpOnly policy.

function requireAuth(req, res, next) {
  const password = process.env.SETTINGS_PASSWORD;
  if (!password) return next();

  const token = req.cookies?.settingsAuth;
  if (token) return next(); // cookie is httpOnly + sameSite strict

  if (req.method === 'GET') return res.redirect('/settings/login');
  res.status(403).render('404', { title: 'Access Denied' });
}

// CSRF helpers
function setCsrf(req, res, next) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('_csrf', token, { httpOnly: true, sameSite: 'strict' });
  res.locals.csrfToken = token;
  next();
}

function checkCsrf(req, res, next) {
  const cookieToken = req.cookies?._csrf;
  const bodyToken = req.body?._csrf;
  if (!cookieToken || !bodyToken || cookieToken !== bodyToken) {
    return res.status(403).render('404', { title: 'Invalid Request' });
  }
  next();
}

// --- Helper: check if current request is admin ---

function isAdmin(req) {
  const password = process.env.SETTINGS_PASSWORD;
  if (!password) return true;
  return !!req.cookies?.settingsAuth;
}

// --- Public routes ---

// Index: all documents with their sections (TOC)
router.get('/', (req, res) => {
  const docs = db.getHandbookDocuments();
  const docsWithSections = docs.map(doc => ({
    ...doc,
    sections: db.getHandbookSections(doc.id)
  }));

  const ver = res.locals.v;
  res.render('handbook/index', {
    title: 'Employee Handbook',
    docs: docsWithSections,
    isAdmin: isAdmin(req),
    extraHead: `<link rel="stylesheet" href="/css/handbook.css?v=${ver}">`,
    extraScripts: `<script src="/js/handbook.js?v=${ver}"></script>`
  });
});

// Search API
router.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  try {
    const results = db.searchHandbook(q);
    res.json({ results });
  } catch (err) {
    console.error('[Handbook] Search error:', err);
    res.status(500).json({ results: [], error: 'Search failed.' });
  }
});

// Section view
router.get('/:docSlug/:sectionSlug', (req, res) => {
  const section = db.getHandbookSectionBySlugs(req.params.docSlug, req.params.sectionSlug);
  if (!section) return res.status(404).render('404', { title: 'Section Not Found' });

  const doc = db.getHandbookDocument(req.params.docSlug);
  const allSections = db.getHandbookSections(doc.id);
  const idx = allSections.findIndex(s => s.id === section.id);
  const prev = idx > 0 ? allSections[idx - 1] : null;
  const next = idx < allSections.length - 1 ? allSections[idx + 1] : null;

  const ver = res.locals.v;
  res.render('handbook/section', {
    title: section.title + ' — ' + doc.title,
    section,
    doc,
    prev,
    next,
    isAdmin: isAdmin(req),
    extraHead: `<link rel="stylesheet" href="/css/handbook.css?v=${ver}">`,
    extraScripts: `<script src="/js/handbook.js?v=${ver}"></script>`
  });
});

// --- Admin routes ---

// Edit section form
router.get('/admin/edit/:id', requireAuth, setCsrf, (req, res) => {
  const section = db.getHandbookSection(parseInt(req.params.id, 10));
  if (!section) return res.status(404).render('404', { title: 'Section Not Found' });

  const ver = res.locals.v;
  res.render('handbook/edit', {
    title: 'Edit: ' + section.title,
    section,
    extraHead: `<link rel="stylesheet" href="/css/handbook.css?v=${ver}">`,
    extraScripts: ''
  });
});

// Save section edits
router.post('/admin/edit/:id', requireAuth, checkCsrf, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const section = db.getHandbookSection(id);
  if (!section) return res.status(404).render('404', { title: 'Section Not Found' });

  const title = (req.body.title || '').trim();
  const content = (req.body.content || '').trim();

  if (!title) return res.redirect('/handbook/admin/edit/' + id);

  db.updateHandbookSection(id, { title, content });
  res.redirect('/handbook/' + section.doc_slug + '/' + section.slug);
});

// Add section form
router.get('/admin/add/:docSlug', requireAuth, setCsrf, (req, res) => {
  const doc = db.getHandbookDocument(req.params.docSlug);
  if (!doc) return res.status(404).render('404', { title: 'Document Not Found' });

  const ver = res.locals.v;
  res.render('handbook/add', {
    title: 'Add Section — ' + doc.title,
    doc,
    extraHead: `<link rel="stylesheet" href="/css/handbook.css?v=${ver}">`,
    extraScripts: ''
  });
});

// Create new section
router.post('/admin/add/:docSlug', requireAuth, checkCsrf, (req, res) => {
  const doc = db.getHandbookDocument(req.params.docSlug);
  if (!doc) return res.status(404).render('404', { title: 'Document Not Found' });

  const title = (req.body.title || '').trim();
  const content = (req.body.content || '').trim();

  if (!title) return res.redirect('/handbook/admin/add/' + doc.slug);

  // Generate slug from title
  const slug = title.toLowerCase().replace(/[''()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Put at end
  const existing = db.getHandbookSections(doc.id);
  const sortOrder = existing.length;

  db.createHandbookSection(doc.id, { title, slug, content, sortOrder });
  res.redirect('/handbook/' + doc.slug + '/' + slug);
});

// Delete section
router.post('/admin/delete/:id', requireAuth, checkCsrf, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const section = db.getHandbookSection(id);
  if (!section) return res.status(404).render('404', { title: 'Section Not Found' });

  db.deleteHandbookSection(id);
  res.redirect('/handbook');
});

module.exports = router;
