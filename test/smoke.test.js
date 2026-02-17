/**
 * Smoke tests for MSFG Calculator Suite
 *
 * Verifies that the server starts, all routes respond,
 * and key static assets are accessible.
 *
 * Run: npm test
 * Uses Node's built-in test runner (no external framework needed).
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const app = require('../server');

let server;
let baseURL;

/**
 * Make an HTTP GET request and return { statusCode, headers, body }.
 */
function get(path) {
  return new Promise((resolve, reject) => {
    http.get(baseURL + path, res => {
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

// ---- Route tests ----

describe('Hub', () => {
  it('GET / returns 200', async () => {
    const res = await get('/');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.includes('MSFG'), 'page should contain MSFG branding');
  });
});

describe('General calculators', () => {
  const slugs = [
    'apr', 'fha', 'va-prequal', 'blended-rate', 'buydown',
    'buy-vs-rent', 'cash-vs-mortgage', 'refi', 'reo', 'escrow', 'fha-refi'
  ];

  for (const slug of slugs) {
    it(`GET /calculators/${slug} returns 200`, async () => {
      const res = await get(`/calculators/${slug}`);
      assert.strictEqual(res.statusCode, 200);
    });
  }
});

describe('Income calculators', () => {
  const slugs = ['1040', '1065', '1120', '1120s', 'schedule-c', 'schedule-e'];

  for (const slug of slugs) {
    it(`GET /calculators/income/${slug} returns 200`, async () => {
      const res = await get(`/calculators/income/${slug}`);
      assert.strictEqual(res.statusCode, 200);
    });
  }
});

describe('Standalone tools', () => {
  it('GET /calculators/llpm returns 200', async () => {
    const res = await get('/calculators/llpm');
    assert.strictEqual(res.statusCode, 200);
  });

  it('GET /calculators/mismo returns 200', async () => {
    const res = await get('/calculators/mismo');
    assert.strictEqual(res.statusCode, 200);
  });
});

describe('App pages', () => {
  it('GET /workspace returns 200', async () => {
    const res = await get('/workspace');
    assert.strictEqual(res.statusCode, 200);
  });

  it('GET /report returns 200', async () => {
    const res = await get('/report');
    assert.strictEqual(res.statusCode, 200);
  });

  it('GET /settings returns 200 (no password set)', async () => {
    const res = await get('/settings');
    // 200 when SETTINGS_PASSWORD is empty, 403 when set
    assert.ok(res.statusCode === 200 || res.statusCode === 403);
  });
});

describe('404 handling', () => {
  it('GET /nonexistent returns 404', async () => {
    const res = await get('/does-not-exist');
    assert.strictEqual(res.statusCode, 404);
  });
});

// ---- Static asset tests ----

describe('Static assets', () => {
  it('serves utils.js', async () => {
    const res = await get('/js/shared/utils.js');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.includes('MSFG'));
  });

  it('serves report.js', async () => {
    const res = await get('/js/shared/report.js');
    assert.strictEqual(res.statusCode, 200);
  });

  it('serves components.css', async () => {
    const res = await get('/css/components.css');
    assert.strictEqual(res.statusCode, 200);
  });
});

// ---- Security header tests ----

describe('Security headers', () => {
  it('includes Content-Security-Policy', async () => {
    const res = await get('/');
    assert.ok(res.headers['content-security-policy'], 'CSP header should be present');
  });

  it('includes X-Content-Type-Options', async () => {
    const res = await get('/');
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
  });

  it('includes X-Frame-Options', async () => {
    const res = await get('/');
    assert.ok(res.headers['x-frame-options'], 'X-Frame-Options should be present');
  });
});
