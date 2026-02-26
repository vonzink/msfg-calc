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

function post(path, data, contentType) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseURL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': contentType || 'application/json' }
    };
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.write(data || '');
    req.end();
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
    'buy-vs-rent', 'cash-vs-mortgage', 'refi', 'reo', 'escrow'
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

  it('CSP script-src does not contain unsafe-inline', async () => {
    const res = await get('/');
    const csp = res.headers['content-security-policy'];
    const scriptSrc = csp.match(/script-src ([^;]+)/);
    if (scriptSrc) {
      assert.ok(!scriptSrc[1].includes("'unsafe-inline'"), 'script-src should not contain unsafe-inline');
    }
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

// ---- Integration tests ----

describe('Settings auth', () => {
  it('settings login page renders', async () => {
    // When SETTINGS_PASSWORD is not set in test env, /settings is accessible directly
    // and /settings/login redirects to /settings
    const res = await get('/settings/login');
    // Should redirect (302) when no password set
    assert.ok(res.statusCode === 200 || res.statusCode === 302,
      'Login page should return 200 or redirect');
  });
});

describe('API validation', () => {
  it('POST /api/ai/extract without file returns error', async () => {
    const res = await post('/api/ai/extract', '');
    assert.ok(res.statusCode === 400 || res.statusCode === 500,
      'Missing file should return error status');
  });
});

describe('Error sanitization', () => {
  it('404 page does not contain stack traces', async () => {
    const res = await get('/this-route-does-not-exist');
    assert.strictEqual(res.statusCode, 404);
    assert.ok(!res.body.includes('Error:'), 'Should not contain raw error messages');
    assert.ok(!res.body.includes('at '), 'Should not contain stack traces');
  });
});

describe('Compression', () => {
  it('gzip response when Accept-Encoding includes gzip', async () => {
    const res = await new Promise((resolve, reject) => {
      const req = http.get(baseURL + '/js/shared/utils.js', {
        headers: { 'Accept-Encoding': 'gzip' }
      }, resp => {
        let body = '';
        resp.on('data', chunk => { body += chunk; });
        resp.on('end', () => {
          resolve({ statusCode: resp.statusCode, headers: resp.headers, body });
        });
      });
      req.on('error', reject);
    });
    assert.strictEqual(res.statusCode, 200);
    // Compression middleware should set content-encoding or vary header
    const encoding = res.headers['content-encoding'] || '';
    const vary = res.headers['vary'] || '';
    assert.ok(encoding.includes('gzip') || vary.includes('Accept-Encoding'),
      'Response should indicate compression support');
  });
});
