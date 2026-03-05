'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'processing.db');

let db;

function getDb() {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS processing_records (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      type          TEXT    NOT NULL,
      borrower      TEXT    NOT NULL,
      loan_number   TEXT,
      address       TEXT,
      vendor        TEXT,
      status        TEXT    NOT NULL DEFAULT 'ordered',
      ordered_date  TEXT,
      reference     TEXT,
      notes         TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_proc_type   ON processing_records(type);
    CREATE INDEX IF NOT EXISTS idx_proc_status ON processing_records(type, status);
  `);
}

/* ---- Query helpers ---- */

/**
 * Search processing records by type, with optional text query and status filter.
 */
function searchRecords({ type, query, status, sort, page, limit }) {
  const db = getDb();
  const conditions = ['type = @type'];
  const params = { type };

  if (query) {
    conditions.push(
      "(borrower LIKE @q OR loan_number LIKE @q OR address LIKE @q OR vendor LIKE @q OR reference LIKE @q)"
    );
    params.q = '%' + query + '%';
  }

  if (status) {
    conditions.push('status = @status');
    params.status = status;
  }

  const where = conditions.join(' AND ');

  let orderBy;
  switch (sort) {
    case 'oldest':   orderBy = 'created_at ASC'; break;
    case 'borrower': orderBy = 'borrower ASC'; break;
    case 'status':   orderBy = 'status ASC, created_at DESC'; break;
    default:         orderBy = 'created_at DESC';
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const offset = (pageNum - 1) * perPage;

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM processing_records WHERE ${where}`).get(params);
  const rows = db.prepare(
    `SELECT * FROM processing_records WHERE ${where} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`
  ).all({ ...params, limit: perPage, offset });

  return {
    results: rows,
    total: countRow.total,
    page: pageNum,
    perPage,
    totalPages: Math.ceil(countRow.total / perPage)
  };
}

/**
 * Get a single record by ID.
 */
function getRecord(id) {
  return getDb().prepare('SELECT * FROM processing_records WHERE id = ?').get(id);
}

/**
 * Insert a new processing record. Returns the new record.
 */
function createRecord({ type, borrower, loanNumber, address, vendor, status, orderedDate, reference, notes }) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO processing_records (type, borrower, loan_number, address, vendor, status, ordered_date, reference, notes)
    VALUES (@type, @borrower, @loanNumber, @address, @vendor, @status, @orderedDate, @reference, @notes)
  `).run({
    type,
    borrower,
    loanNumber: loanNumber || null,
    address: address || null,
    vendor: vendor || null,
    status: status || 'ordered',
    orderedDate: orderedDate || null,
    reference: reference || null,
    notes: notes || null
  });

  return getRecord(result.lastInsertRowid);
}

/**
 * Update an existing record. Returns the updated record.
 */
function updateRecord(id, fields) {
  const db = getDb();
  const allowed = ['borrower', 'loan_number', 'address', 'vendor', 'status', 'ordered_date', 'reference', 'notes'];
  const sets = [];
  const params = { id };

  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      sets.push(`${key} = @${key}`);
      params[key] = val;
    }
  }

  if (sets.length === 0) return getRecord(id);

  sets.push("updated_at = datetime('now')");

  db.prepare(`UPDATE processing_records SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return getRecord(id);
}

/**
 * Delete a record by ID. Returns true if a row was deleted.
 */
function deleteRecord(id) {
  const result = getDb().prepare('DELETE FROM processing_records WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  getDb,
  searchRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord
};
