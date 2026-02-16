const express = require('express');
const router = express.Router();
const path = require('path');

const calcConfig = require('../config/calculators.json');

function findCalc(slug) {
  return calcConfig.calculators.find(c => c.slug === slug);
}

/* ---- General Calculators ---- */

router.get('/apr', (req, res) => {
  res.render('calculators/apr', {
    title: 'APR Calculator',
    calc: findCalc('apr'),
    extraHead: '<link rel="stylesheet" href="/css/calculators/apr.css">',
    extraScripts: '<script src="/js/calculators/apr.js"></script>'
  });
});

router.get('/fha', (req, res) => {
  res.render('calculators/fha', {
    title: 'FHA Loan Calculator',
    calc: findCalc('fha'),
    extraHead: '<link rel="stylesheet" href="/css/calculators/fha.css">',
    extraScripts: '<script src="/js/calculators/fha.js"></script>'
  });
});

router.get('/va-prequal', (req, res) => {
  res.render('calculators/va-prequal', {
    title: 'VA Pre-Qualification Worksheet',
    calc: findCalc('va-prequal'),
    extraHead: '<link rel="stylesheet" href="/css/calculators/va-prequal.css">',
    extraScripts: '<script src="/js/calculators/va-prequal.js"></script>'
  });
});

router.get('/blended-rate', (req, res) => {
  res.render('calculators/blended-rate', {
    title: 'Blended Rate Calculator',
    calc: findCalc('blended-rate'),
    extraScripts: '<script src="/js/calculators/blended-rate.js"></script>'
  });
});

router.get('/buydown', (req, res) => {
  res.render('calculators/buydown', {
    title: 'Buydown Calculator',
    calc: findCalc('buydown'),
    extraScripts: '<script src="/js/calculators/buydown.js"></script>'
  });
});

router.get('/buy-vs-rent', (req, res) => {
  res.render('calculators/buy-vs-rent', {
    title: 'Buy vs Rent Calculator',
    calc: findCalc('buy-vs-rent'),
    extraScripts: '<script src="/js/calculators/buy-vs-rent.js"></script>'
  });
});

router.get('/cash-vs-mortgage', (req, res) => {
  res.render('calculators/cash-vs-mortgage', {
    title: 'Cash vs Mortgage Comparison',
    calc: findCalc('cash-vs-mortgage'),
    extraScripts: '<script src="/js/calculators/cash-vs-mortgage.js"></script>'
  });
});

router.get('/refi', (req, res) => {
  res.render('calculators/refi', {
    title: 'Refinance Analysis Tool',
    calc: findCalc('refi'),
    extraHead: '<link rel="stylesheet" href="/css/calculators/refi.css"><script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>',
    extraScripts: '<script src="/js/calculators/refi.js"></script>'
  });
});

router.get('/reo', (req, res) => {
  res.render('calculators/reo', {
    title: 'REO Investment ROI',
    calc: findCalc('reo'),
    extraScripts: '<script src="/js/calculators/reo.js"></script>'
  });
});

router.get('/escrow', (req, res) => {
  res.render('calculators/escrow', {
    title: 'Escrow Prepaids Calculator',
    calc: findCalc('escrow'),
    extraScripts: '<script src="/js/calculators/escrow.js"></script>'
  });
});

router.get('/fha-refi', (req, res) => {
  res.render('calculators/fha-refi', {
    title: 'FHA Refinance Calculator',
    calc: findCalc('fha-refi'),
    extraScripts: '<script src="/js/calculators/fha-refi.js"></script>'
  });
});

/* ---- Income Calculators ---- */

router.get('/income-questionnaire', (req, res) => {
  res.render('calculators/income/questionnaire', {
    title: 'Income Questionnaire',
    calc: findCalc('income-questionnaire'),
    extraScripts: '<script src="/js/calculators/income/questionnaire.js"></script>'
  });
});

const incomeCalcs = [
  { slug: '1040', view: 'income/1040', title: 'Form 1040 Income Calculator' },
  { slug: '1065', view: 'income/1065', title: 'Form 1065 Income Calculator' },
  { slug: '1120', view: 'income/1120', title: 'Form 1120 Income Calculator' },
  { slug: '1120s', view: 'income/1120s', title: 'Form 1120S Income Calculator' },
  { slug: '1120s-k1', view: 'income/1120s-k1', title: '1120S K-1 Income Calculator' },
  { slug: 'k1', view: 'income/k1', title: 'Schedule K-1 Income Calculator' },
  { slug: 'rental-1038', view: 'income/rental-1038', title: 'Rental Property Income (1038)' },
  { slug: 'schedule-b', view: 'income/schedule-b', title: 'Schedule B Income Calculator' },
  { slug: 'schedule-c', view: 'income/schedule-c', title: 'Schedule C Income Calculator' },
  { slug: 'schedule-d', view: 'income/schedule-d', title: 'Schedule D Income Calculator' },
  { slug: 'schedule-e', view: 'income/schedule-e', title: 'Schedule E Income Calculator' },
  { slug: 'schedule-e-subject', view: 'income/schedule-e-subject', title: 'Schedule E (Subject Property)' },
  { slug: 'schedule-f', view: 'income/schedule-f', title: 'Schedule F Income Calculator' }
];

incomeCalcs.forEach(ic => {
  router.get(`/income/${ic.slug}`, (req, res) => {
    res.render(`calculators/${ic.view}`, {
      title: ic.title,
      calc: findCalc(`income/${ic.slug}`),
      extraHead: '<link rel="stylesheet" href="/css/calculators/income.css">',
      extraScripts: `<script src="/js/calculators/${ic.view}.js"></script>`
    });
  });
});

module.exports = router;
