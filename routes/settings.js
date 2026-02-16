const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const configPath = path.join(__dirname, '..', 'config', 'site.json');

const upload = multer({
  dest: path.join(__dirname, '..', 'public', 'images'),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.get('/', (req, res) => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
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

  fs.renameSync(req.file.path, newPath);

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  config.logo.src = '/images/' + newName;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  res.redirect('/settings?saved=1');
});

router.post('/update', express.urlencoded({ extended: true }), (req, res) => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  if (req.body.siteName) config.siteName = req.body.siteName;
  if (req.body.companyName) config.companyName = req.body.companyName;
  if (req.body.logoWidth) config.logo.width = parseInt(req.body.logoWidth) || 160;

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  res.redirect('/settings?saved=1');
});

module.exports = router;
