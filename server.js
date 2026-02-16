require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

const siteConfig = require('./config/site.json');
const calcConfig = require('./config/calculators.json');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Make config available to all templates
app.use((req, res, next) => {
  res.locals.site = siteConfig;
  res.locals.calculators = calcConfig.calculators;
  res.locals.categories = calcConfig.categories;
  res.locals.currentPath = req.path;
  next();
});

// Static files — new assets first, then legacy CSS/JS fallback
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount standalone apps BEFORE the calculator router
app.use('/calculators/amortization', express.static(path.join(__dirname, 'amort-calc')));

app.get('/calculators/llpm', (req, res) => {
  res.sendFile(path.join(__dirname, 'llpm-calc', 'LLPMTool.html'));
});
app.use('/calculators/llpm', express.static(path.join(__dirname, 'llpm-calc')));

app.use('/calculators/batch-llpm', express.static(path.join(__dirname, 'batch-llpm')));

app.get('/calculators/mismo', (req, res) => {
  res.sendFile(path.join(__dirname, 'gen-calc', 'mismo-calc', 'MISMO_Document_Analyzer.html'));
});
app.use('/calculators/mismo', express.static(path.join(__dirname, 'gen-calc', 'mismo-calc')));

// Routes
app.use('/', require('./routes/index'));
app.use('/calculators', require('./routes/calculators'));
app.use('/workspace', require('./routes/workspace'));
app.use('/settings', require('./routes/settings'));

// Serve legacy calculator files (for iframe stubs during migration)
app.use('/legacy', express.static(path.join(__dirname)));

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

app.listen(PORT, () => {
  console.log(`MSFG Calculator Suite running at http://localhost:${PORT}`);
});
