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

router.get('/', (req, res) => {
  const config = readConfig();
  if (!config) return res.status(500).render('404', { title: 'Configuration Error' });

  res.render('settings', {
    title: 'Site Settings',
    config,
    extraScripts: '<script src="/js/settings.js"></script>',
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

module.exports = router;
