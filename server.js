require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');

const fs = require('fs');
const { execSync } = require('child_process');

// Asset version — computed once at startup for cache-busting.
// Uses short git hash so deploys automatically bust CloudFront cache.
let ASSET_VERSION;
try {
  ASSET_VERSION = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (e) {
  ASSET_VERSION = Date.now().toString(36);
}

// Calculator config is static — loaded once at startup
const calcConfig = require('./config/calculators.json');

// Site config is mutable (settings page can update it) — read fresh each request
const siteConfigPath = path.join(__dirname, 'config', 'site.json');
function getSiteConfig() {
  try {
    return JSON.parse(fs.readFileSync(siteConfigPath, 'utf-8'));
  } catch (err) {
    console.error('Failed to read site config:', err);
    return { siteName: 'MSFG', companyName: 'MSFG', favicon: '', logo: {} };
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net"
      ],
      // TODO: Remove after migrating remaining inline handlers (income calcs, amortization)
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com"
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://msfg-media.s3.us-west-2.amazonaws.com"],
      frameSrc: ["'self'"],
      connectSrc: ["'self'", "https://cdnjs.cloudflare.com"]
    }
  },
  // Allow iframes from same origin (workspace uses them)
  frameguard: { action: 'sameorigin' }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Make config available to all templates
app.use((req, res, next) => {
  const cfg = getSiteConfig();
  // Strip sensitive fields before exposing to templates
  const safeCfg = Object.assign({}, cfg);
  delete safeCfg.ai;
  res.locals.site = safeCfg;
  res.locals.calculators = calcConfig.calculators;
  res.locals.categories = calcConfig.categories;
  res.locals.currentPath = req.path;
  res.locals.v = ASSET_VERSION;
  next();
});

// Gzip/Brotli compression
app.use(compression());

// Static files — new assets first, then legacy CSS/JS fallback
const staticOpts = process.env.NODE_ENV === 'production' ? { maxAge: '30d' } : {};
app.use(express.static(path.join(__dirname, 'public'), staticOpts));
app.use('/css', express.static(path.join(__dirname, 'css'), staticOpts));
app.use('/js', express.static(path.join(__dirname, 'js'), staticOpts));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Legacy standalone apps (served via iframe from EJS wrappers)

// Helper: serve a static HTML file with cache-busting ?v= injected on local JS/CSS tags
// In development, re-reads the file on each request so changes take effect without restart.
function serveLegacyHtml(filePath) {
  const isDev = process.env.NODE_ENV !== 'production';
  const cached = isDev ? null : fs.readFileSync(filePath, 'utf-8');
  return (req, res) => {
    const template = isDev ? fs.readFileSync(filePath, 'utf-8') : cached;
    const html = template
      .replace(/(src|href)="((?:js|css)\/[^"]+\.(?:js|css))"/g, `$1="$2?v=${ASSET_VERSION}"`)
      .replace(/(src|href)="(\/js\/[^"]+\.(?:js|css))"/g, `$1="$2?v=${ASSET_VERSION}"`);
    res.type('html').send(html);
  };
}

app.get('/legacy/refi-calc/index.html', serveLegacyHtml(path.join(__dirname, 'refi-calc', 'index.html')));
app.use('/legacy/amort-calc', express.static(path.join(__dirname, 'amort-calc')));

app.get('/calculators/llpm', serveLegacyHtml(path.join(__dirname, 'llpm-calc', 'LLPMTool.html')));
app.use('/calculators/llpm', express.static(path.join(__dirname, 'llpm-calc')));

app.get('/calculators/batch-llpm', serveLegacyHtml(path.join(__dirname, 'batch-llpm', 'index.html')));
app.use('/calculators/batch-llpm', express.static(path.join(__dirname, 'batch-llpm')));

// Routes
app.use('/', require('./routes/index'));
app.use('/calculators', require('./routes/calculators'));
app.use('/workspace', require('./routes/workspace'));
app.use('/report', require('./routes/report'));
app.use('/settings', require('./routes/settings'));
app.use('/api', require('./routes/api'));

// Serve legacy calculator files (for iframe stubs during migration)
// Only expose the specific directories that legacy iframes actually need
app.use('/legacy/income', express.static(path.join(__dirname, 'income')));
app.use('/legacy/refi-calc', express.static(path.join(__dirname, 'refi-calc')));
app.use('/legacy/fha-calc', express.static(path.join(__dirname, 'fha-calc')));
app.use('/legacy/gen-calc', express.static(path.join(__dirname, 'gen-calc')));
app.use('/legacy/calc-reo', express.static(path.join(__dirname, 'calc-reo')));
app.use('/legacy/buydown-calc', express.static(path.join(__dirname, 'buydown-calc')));

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Global error handler — prevents stack traces from leaking to clients
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).render('404', {
    title: 'Something went wrong'
  });
});

// Start server when run directly; export app for testing
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`MSFG Calculator Suite running at http://localhost:${PORT}`);
  });
}

module.exports = app;
