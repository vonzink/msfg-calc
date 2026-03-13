/**
 * Extended route tests for MSFG Calculator Suite
 *
 * Covers routes not in smoke.test.js: remaining general calculators,
 * all income calculators, health endpoint, content verification.
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const app = require('../server');

let server;
let baseURL;

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(baseURL + urlPath, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    }).on('error', reject);
  });
}

before(() => {
  return new Promise((resolve, reject) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseURL = `http://127.0.0.1:${port}`;
      resolve();
    });
    server.on('error', reject);
  });
});

after(() => {
  return new Promise(resolve => {
    server.close(resolve);
  });
});

// ---- General calculators not already in smoke tests ----

describe('Additional general calculators', () => {
  const slugs = [
    'amortization', 'var-income', 'fee-worksheet',
    'compare', 'loan-analysis', 'loan-timeline'
  ];

  for (const slug of slugs) {
    it(`GET /calculators/${slug} returns 200`, async () => {
      const res = await get(`/calculators/${slug}`);
      assert.strictEqual(res.statusCode, 200);
    });
  }
});

// ---- All income calculators (complete coverage) ----

describe('All income calculators', () => {
  const slugs = [
    '1040', '1065', '1120', '1120s', '1120s-k1', 'k1',
    'rental-1038', 'schedule-b', 'schedule-c', 'schedule-d',
    'schedule-e', 'schedule-e-subject', 'schedule-f'
  ];

  for (const slug of slugs) {
    it(`GET /calculators/income/${slug} returns 200`, async () => {
      const res = await get(`/calculators/income/${slug}`);
      assert.strictEqual(res.statusCode, 200);
    });
  }
});

// ---- Income questionnaire ----

describe('Income questionnaire', () => {
  it('GET /calculators/income-questionnaire returns 200', async () => {
    const res = await get('/calculators/income-questionnaire');
    assert.strictEqual(res.statusCode, 200);
  });
});

// ---- Health endpoint ----

describe('Health endpoint', () => {
  it('GET /health returns JSON with status ok', async () => {
    const res = await get('/health');
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.status, 'ok');
    assert.ok(typeof data.uptime === 'number');
    assert.ok(typeof data.version === 'string');
  });
});

// ---- Content verification ----

describe('Page content verification', () => {
  it('hub page contains calculator cards', async () => {
    const res = await get('/');
    assert.ok(res.body.includes('calc-card') || res.body.includes('calculator'),
      'Hub should contain calculator references');
  });

  it('workspace page loads workspace scripts', async () => {
    const res = await get('/workspace');
    assert.ok(res.body.includes('workspace'), 'workspace page should reference workspace scripts');
  });

  it('report page loads report templates', async () => {
    const res = await get('/report');
    assert.ok(res.body.includes('report-templates'), 'report page should load report templates');
  });

  it('calculator pages include utils.js', async () => {
    const res = await get('/calculators/apr');
    assert.ok(res.body.includes('utils'), 'calculator page should load utils.js');
  });

  it('income calculators include income-upload script', async () => {
    const res = await get('/calculators/income/1040');
    assert.ok(res.body.includes('income-upload'),
      'income calculator should include income-upload.js');
  });

  it('MISMO calculator loads pre-scripts', async () => {
    const res = await get('/calculators/mismo');
    assert.ok(res.body.includes('mismo-doc-parser'), 'MISMO page should load doc parser');
    assert.ok(res.body.includes('mismo-ui'), 'MISMO page should load UI module');
  });

  it('amortization page loads Chart.js CDN', async () => {
    const res = await get('/calculators/amortization');
    assert.ok(res.body.includes('chart.js') || res.body.includes('chart.umd'),
      'amortization page should load Chart.js');
  });
});

// ---- Legacy routes ----

describe('Legacy routes', () => {
  it('GET /calculators/batch-llpm returns 200', async () => {
    const res = await get('/calculators/batch-llpm');
    assert.strictEqual(res.statusCode, 200);
  });
});

// ---- Cache busting ----

describe('Cache busting', () => {
  it('pages include version query parameter on assets', async () => {
    const res = await get('/');
    // Should have ?v= on CSS/JS references
    assert.ok(res.body.includes('?v='), 'assets should have cache-busting version');
  });

  it('data-ver attribute is set on main element', async () => {
    const res = await get('/calculators/apr');
    assert.ok(res.body.includes('data-ver='), 'main should have data-ver attribute');
  });

  it('data-js-ext attribute is set on main element', async () => {
    const res = await get('/calculators/apr');
    assert.ok(res.body.includes('data-js-ext='), 'main should have data-js-ext attribute');
  });
});
