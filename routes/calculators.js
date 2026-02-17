const express = require('express');
const router = express.Router();

const calcConfig = require('../config/calculators.json');

function findCalc(slug) {
  return calcConfig.calculators.find(c => c.slug === slug);
}

/* ---- General & Government Calculators ---- */

const generalCalcs = [
  { slug: 'apr',             view: 'calculators/apr',             title: 'APR Calculator',                css: 'apr' },
  { slug: 'fha',             view: 'calculators/fha',             title: 'FHA Loan Calculator',           css: 'fha' },
  { slug: 'va-prequal',      view: 'calculators/va-prequal',      title: 'VA Pre-Qualification Worksheet', css: 'va-prequal' },
  { slug: 'blended-rate',    view: 'calculators/blended-rate',    title: 'Blended Rate Calculator' },
  { slug: 'buydown',         view: 'calculators/buydown',         title: 'Buydown Calculator' },
  { slug: 'buy-vs-rent',     view: 'calculators/buy-vs-rent',     title: 'Buy vs Rent Calculator' },
  { slug: 'cash-vs-mortgage', view: 'calculators/cash-vs-mortgage', title: 'Cash vs Mortgage Comparison' },
  {
    slug: 'refi',
    view: 'calculators/refi',
    title: 'Refinance Analysis Tool',
    css: 'refi',
    cdnScripts: [
      '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js"></script>',
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" integrity="sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk" crossorigin="anonymous"></script>'
    ]
  },
  { slug: 'reo',             view: 'calculators/reo',             title: 'REO Investment ROI' },
  { slug: 'escrow',          view: 'calculators/escrow',          title: 'Escrow Prepaids Calculator' },
  { slug: 'fha-refi',        view: 'calculators/fha-refi',        title: 'FHA Refinance Calculator' },
  { slug: 'amortization',    view: 'calculators/amortization',    title: 'Amortization Calculator' },
  { slug: 'var-income',      view: 'calculators/var-income',      title: 'Variable Income Analyzer', css: 'var-income' }
];

generalCalcs.forEach(gc => {
  router.get(`/${gc.slug}`, (req, res) => {
    const extraHeadParts = [];
    if (gc.css) extraHeadParts.push(`<link rel="stylesheet" href="/css/calculators/${gc.css}.css">`);
    if (gc.cdnScripts) extraHeadParts.push(...gc.cdnScripts);

    res.render(gc.view, {
      title: gc.title,
      calc: findCalc(gc.slug),
      extraHead: extraHeadParts.length ? extraHeadParts.join('') : undefined,
      extraScripts: `<script src="/js/calculators/${gc.slug}.js"></script>`
    });
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
  { slug: '1040',              view: 'income/1040',              title: 'Form 1040 Income Calculator' },
  { slug: '1065',              view: 'income/1065',              title: 'Form 1065 Income Calculator' },
  { slug: '1120',              view: 'income/1120',              title: 'Form 1120 Income Calculator' },
  { slug: '1120s',             view: 'income/1120s',             title: 'Form 1120S Income Calculator' },
  { slug: '1120s-k1',          view: 'income/1120s-k1',          title: '1120S K-1 Income Calculator' },
  { slug: 'k1',                view: 'income/k1',                title: 'Schedule K-1 Income Calculator' },
  { slug: 'rental-1038',       view: 'income/rental-1038',       title: 'Rental Property Income (1038)' },
  { slug: 'schedule-b',        view: 'income/schedule-b',        title: 'Schedule B Income Calculator' },
  { slug: 'schedule-c',        view: 'income/schedule-c',        title: 'Schedule C Income Calculator' },
  { slug: 'schedule-d',        view: 'income/schedule-d',        title: 'Schedule D Income Calculator' },
  { slug: 'schedule-e',        view: 'income/schedule-e',        title: 'Schedule E Income Calculator' },
  { slug: 'schedule-e-subject', view: 'income/schedule-e-subject', title: 'Schedule E (Subject Property)' },
  { slug: 'schedule-f',        view: 'income/schedule-f',        title: 'Schedule F Income Calculator' }
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
