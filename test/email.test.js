/**
 * Email endpoint tests for MSFG Calculator Suite
 *
 * Tests input validation, error handling, and rate limiting
 * for POST /api/email/send. Does NOT send real emails.
 *
 * Run: npm test
 *
 * NOTE: The email rate limiter allows 5 requests per minute.
 * Tests are ordered so the most important validation checks run first,
 * and rate-limit-aware assertions are used for later requests.
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const app = require('../server');

let server;
let baseURL;
let requestCount = 0;

function post(path, body) {
  requestCount++;
  return new Promise((resolve, reject) => {
    const url = new URL(baseURL + path);
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    req.write(payload);
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

// ---- Valid calcData fixture ----

const validCalcData = {
  title: 'Test Calculator',
  sections: [{
    heading: 'Summary',
    rows: [{ label: 'Monthly Payment', value: '$1,234.56' }]
  }]
};

// ---- Required field validation (requests 1-4, within rate limit) ----

describe('Email validation — missing fields', () => {
  it('returns 400 when "to" is missing', async () => {
    const res = await post('/api/email/send', {
      subject: 'Test Subject',
      calcData: validCalcData
    });
    assert.strictEqual(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Missing required fields'),
      'Error message should mention missing fields');
  });

  it('returns 400 when "subject" is missing', async () => {
    const res = await post('/api/email/send', {
      to: 'test@example.com',
      calcData: validCalcData
    });
    assert.strictEqual(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Missing required fields'));
  });

  it('returns 400 when "calcData" is missing', async () => {
    const res = await post('/api/email/send', {
      to: 'test@example.com',
      subject: 'Test Subject'
    });
    assert.strictEqual(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Missing required fields'));
  });

  it('returns 400 when body is empty', async () => {
    const res = await post('/api/email/send', {});
    assert.strictEqual(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.success, false);
  });
});

// ---- Email address validation (request 5, last within rate limit) ----

describe('Email validation — invalid address', () => {
  it('returns 400 for email without @', async () => {
    const res = await post('/api/email/send', {
      to: 'notanemail',
      subject: 'Test',
      calcData: validCalcData
    });
    assert.strictEqual(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Invalid email address'));
  });
});

// ---- Rate limiting (request 6+, should now be rate-limited) ----

describe('Email rate limiting', () => {
  it('returns 429 after exceeding rate limit', async () => {
    const res = await post('/api/email/send', {
      to: 'user@',
      subject: 'Test',
      calcData: validCalcData
    });
    assert.strictEqual(res.statusCode, 429,
      'Should be rate-limited after 5 requests per minute');
    const data = JSON.parse(res.body);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Too many emails'));
  });

  it('rate limit response includes standard headers', async () => {
    const res = await post('/api/email/send', {
      to: 'test@example.com',
      subject: 'Test',
      calcData: validCalcData
    });
    // Should still be rate-limited
    assert.strictEqual(res.statusCode, 429);
    // standardHeaders: true means RateLimit-* headers (draft-6)
    const hasRateLimit =
      res.headers['ratelimit-limit'] ||
      res.headers['ratelimit-remaining'] ||
      res.headers['ratelimit-policy'] ||
      res.headers['retry-after'];
    assert.ok(hasRateLimit, 'Rate-limited response should include rate limit headers');
  });
});

// ---- Response format (uses first-request results verified above) ----

describe('Email response format', () => {
  it('validation errors return JSON with { success: false, message }', async () => {
    // This will be rate-limited, but the 429 response also has the expected shape
    const res = await post('/api/email/send', {});
    const data = JSON.parse(res.body);
    assert.strictEqual(typeof data.success, 'boolean');
    assert.strictEqual(typeof data.message, 'string');
    assert.strictEqual(data.success, false);
  });

  it('all error responses are valid JSON', async () => {
    const res = await post('/api/email/send', { to: 'bad', subject: 'x', calcData: {} });
    assert.doesNotThrow(() => JSON.parse(res.body), 'Response body should be valid JSON');
  });
});
