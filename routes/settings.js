'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const configPath = path.join(__dirname, '..', 'config', 'site.json');

// --- Helpers ---

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    console.error('Failed to read site config:', err);
    return null;
  }
}

function writeConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (err) {
    console.error('Failed to write site config:', err);
    return false;
  }
}

function maskKey(key) {
  if (!key || key.length < 8) return key ? '••••••••' : '';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

// --- Auth: token-based session (POST login, no URL passwords) ---

const validTokens = new Set();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Login form — must be registered BEFORE requireAuth middleware
router.get('/login', (req, res) => {
  const password = process.env.SETTINGS_PASSWORD;
  if (!password) return res.redirect('/settings');
  res.render('settings-login', { title: 'Settings Login', error: false });
});

router.post('/login', (req, res) => {
  const password = process.env.SETTINGS_PASSWORD;
  if (!password) return res.redirect('/settings');

  const input = String(req.body.password || '');
  const inputBuf = Buffer.from(input);
  const passBuf = Buffer.from(password);

  // Timing-safe comparison (must be same length for timingSafeEqual)
  const match = inputBuf.length === passBuf.length &&
    crypto.timingSafeEqual(inputBuf, passBuf);

  if (match) {
    const token = generateToken();
    validTokens.add(token);
    res.cookie('settingsAuth', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    return res.redirect('/settings');
  }

  res.render('settings-login', { title: 'Settings Login', error: true });
});

// Auth middleware — everything below requires auth
function requireAuth(req, res, next) {
  const password = process.env.SETTINGS_PASSWORD;
  if (!password) return next();

  const token = req.cookies?.settingsAuth;
  if (token && validTokens.has(token)) return next();

  // Redirect GET requests to login page, deny others
  if (req.method === 'GET') return res.redirect('/settings/login');
  res.status(403).render('404', { title: 'Access Denied' });
}

router.use(requireAuth);

// --- CSRF protection (double-submit cookie) ---

router.use((req, res, next) => {
  if (req.method === 'GET') {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie('_csrf', token, { httpOnly: true, sameSite: 'strict' });
    res.locals.csrfToken = token;
  }
  next();
});

router.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  // Exempt JSON-body endpoints (no form, no CSRF cookie flow)
  if (req.path === '/ai/test') return next();

  const cookieToken = req.cookies?._csrf;
  const bodyToken = req.body?._csrf;

  if (!cookieToken || !bodyToken || cookieToken !== bodyToken) {
    return res.status(403).render('404', { title: 'Invalid Request' });
  }
  next();
});

// --- File upload config ---

const upload = multer({
  dest: path.join(__dirname, '..', 'public', 'images'),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // No SVG — it can contain embedded JavaScript (XSS vector)
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// --- Routes ---

router.get('/', (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).render('404', { title: 'Configuration Error' });

  const ai = config.ai || { provider: '', apiKey: '' };
  const maskedAi = {
    provider: ai.provider || '',
    apiKeyMasked: maskKey(ai.apiKey),
    hasKey: !!(ai.apiKey)
  };

  res.render('settings', {
    title: 'Site Settings',
    config,
    maskedAi,
    extraScripts: `<script src="/js/settings.js?v=${res.locals.v}"></script>`,
    saved: req.query.saved === '1'
  });
});

router.post('/logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.redirect('/settings?saved=0');

  // Validate extension (defense in depth — MIME already checked by multer)
  const ext = path.extname(req.file.originalname).toLowerCase();
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp'];
  if (!allowedExts.includes(ext)) {
    try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
    return res.redirect('/settings?saved=0');
  }

  // Force consistent filename regardless of upload extension
  const newName = 'msfg-logo.png';
  const newPath = path.join(__dirname, '..', 'public', 'images', newName);

  try {
    fs.renameSync(req.file.path, newPath);
  } catch (err) {
    console.error('Failed to move uploaded logo:', err);
    return res.redirect('/settings?saved=0');
  }

  const config = readConfig();
  if (!config) return res.redirect('/settings?saved=0');

  config.logo.src = '/images/' + newName;
  writeConfig(config);

  res.redirect('/settings?saved=1');
});

router.post('/update', (req, res) => {
  const config = readConfig();
  if (!config) return res.redirect('/settings?saved=0');

  if (req.body.siteName && typeof req.body.siteName === 'string') {
    config.siteName = req.body.siteName.trim().slice(0, 100);
  }
  if (req.body.companyName && typeof req.body.companyName === 'string') {
    config.companyName = req.body.companyName.trim().slice(0, 100);
  }
  if (req.body.logoWidth) {
    const width = parseInt(req.body.logoWidth, 10);
    config.logo.width = (width > 0 && width <= 500) ? width : 160;
  }

  writeConfig(config);
  res.redirect('/settings?saved=1');
});

// --- Email Signature ---

router.post('/email-signature', (req, res) => {
  const config = readConfig();
  if (!config) return res.redirect('/settings?saved=0');

  if (!config.emailSignature) {
    config.emailSignature = { name: '', title: '', phone: '', email: '', nmls: '', company: '' };
  }

  const fields = ['name', 'title', 'phone', 'email', 'nmls', 'company'];
  fields.forEach(field => {
    if (typeof req.body['sig_' + field] === 'string') {
      config.emailSignature[field] = req.body['sig_' + field].trim().slice(0, 200);
    }
  });

  writeConfig(config);
  res.redirect('/settings?saved=1');
});

// --- AI Configuration ---

router.post('/ai', (req, res) => {
  const config = readConfig();
  if (!config) return res.redirect('/settings?saved=0');

  if (!config.ai) config.ai = { provider: '', apiKey: '' };

  const allowedProviders = ['openai', 'anthropic', ''];
  const provider = (req.body.aiProvider || '').trim().toLowerCase();
  config.ai.provider = allowedProviders.includes(provider) ? provider : '';

  const newKey = (req.body.aiApiKey || '').trim();
  if (newKey && !newKey.includes('••')) {
    config.ai.apiKey = newKey;
  }

  writeConfig(config);
  res.redirect('/settings?saved=1');
});

router.post('/ai/clear', (req, res) => {
  const config = readConfig();
  if (!config) return res.redirect('/settings?saved=0');

  config.ai = { provider: '', apiKey: '' };
  writeConfig(config);
  res.redirect('/settings?saved=1');
});

const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many test requests. Wait a minute.' }
});

router.post('/ai/test', testLimiter, express.json(), (req, res) => {
  const config = readConfig();
  if (!config || !config.ai || !config.ai.apiKey) {
    return res.json({ success: false, message: 'No API key configured.' });
  }

  const provider = config.ai.provider;
  const apiKey = config.ai.apiKey;

  if (provider === 'openai') {
    const https = require('https');
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/models',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + apiKey }
    };
    const req2 = https.request(options, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        if (resp.statusCode === 200) {
          res.json({ success: true, message: 'OpenAI API key is valid.' });
        } else {
          // Sanitize: don't expose raw API error details to client
          const status = resp.statusCode;
          const msg = status === 401 ? 'Invalid API key.' :
                      status === 429 ? 'Rate limited. Try again later.' :
                      'API returned HTTP ' + status;
          res.json({ success: false, message: msg });
        }
      });
    });
    req2.on('error', (err) => {
      console.error('[Settings] OpenAI test connection error:', err);
      res.json({ success: false, message: 'Connection error. Please try again.' });
    });
    req2.end();

  } else if (provider === 'anthropic') {
    const https = require('https');
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }]
    });
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    };
    const req2 = https.request(options, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        if (resp.statusCode === 200) {
          res.json({ success: true, message: 'Anthropic API key is valid.' });
        } else {
          const status = resp.statusCode;
          const msg = status === 401 ? 'Invalid API key.' :
                      status === 429 ? 'Rate limited. Try again later.' :
                      'API returned HTTP ' + status;
          res.json({ success: false, message: msg });
        }
      });
    });
    req2.on('error', (err) => {
      console.error('[Settings] Anthropic test connection error:', err);
      res.json({ success: false, message: 'Connection error. Please try again.' });
    });
    req2.write(body);
    req2.end();

  } else {
    res.json({ success: false, message: 'No AI provider selected.' });
  }
});

module.exports = router;
