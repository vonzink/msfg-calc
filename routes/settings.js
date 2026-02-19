const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

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

// --- Auth middleware ---
// Set SETTINGS_PASSWORD in .env to protect this route.
// Access via /settings?key=YOUR_PASSWORD or session cookie after first auth.

function requireAuth(req, res, next) {
  const password = process.env.SETTINGS_PASSWORD;

  // If no password is configured, allow access (dev mode)
  if (!password) return next();

  // Check query param (first visit) or cookie (subsequent visits)
  if (req.query.key === password || req.cookies?.settingsAuth === password) {
    // Set a session cookie so the key doesn't need to stay in the URL
    res.cookie('settingsAuth', password, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    return next();
  }

  res.status(403).render('404', { title: 'Access Denied' });
}

// --- File upload config ---

const upload = multer({
  dest: path.join(__dirname, '..', 'public', 'images'),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// --- Routes (all protected) ---

router.use(requireAuth);

function maskKey(key) {
  if (!key || key.length < 8) return key ? '••••••••' : '';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

router.get('/', (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).render('404', { title: 'Configuration Error' });

  // Never send the full API key to the browser
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

  const ext = path.extname(req.file.originalname);
  const newName = 'msfg-logo' + ext;
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

  // Validate and sanitize inputs
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

  // Provider
  const allowedProviders = ['openai', 'anthropic', ''];
  const provider = (req.body.aiProvider || '').trim().toLowerCase();
  config.ai.provider = allowedProviders.includes(provider) ? provider : '';

  // API key — only update if a new key is submitted (not the masked placeholder)
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

router.post('/ai/test', express.json(), (req, res) => {
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
          const body = JSON.parse(data || '{}');
          res.json({ success: false, message: body.error?.message || ('HTTP ' + resp.statusCode) });
        }
      });
    });
    req2.on('error', (err) => {
      res.json({ success: false, message: 'Connection error: ' + err.message });
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
          const parsed = JSON.parse(data || '{}');
          res.json({ success: false, message: parsed.error?.message || ('HTTP ' + resp.statusCode) });
        }
      });
    });
    req2.on('error', (err) => {
      res.json({ success: false, message: 'Connection error: ' + err.message });
    });
    req2.write(body);
    req2.end();

  } else {
    res.json({ success: false, message: 'No AI provider selected.' });
  }
});

module.exports = router;
