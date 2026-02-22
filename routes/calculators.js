const express = require('express');
const router = express.Router();

const calcConfig = require('../config/calculators.json');

function findCalc(slug) {
  return calcConfig.calculators.find(c => c.slug === slug);
}

/* ---- General & Government Calculators ---- */

const generalCalcs = [
  { slug: 'apr',             view: 'calculators/apr',             title: 'APR Calculator',                css: 'apr' },
  { slug: 'fha',             view: 'calculators/fha',             title: 'FHA Loan Calculator', css: 'fha', preScripts: ['/js/shared/mismo-parser.js'] },
  { slug: 'va-prequal',      view: 'calculators/va-prequal',      title: 'VA Pre-Qualification Worksheet', css: 'va-prequal' },
  { slug: 'blended-rate',    view: 'calculators/blended-rate',    title: 'Blended Rate Calculator',  noScript: true },
  { slug: 'buydown',         view: 'calculators/buydown',         title: 'Buydown Calculator',       noScript: true },
  { slug: 'buy-vs-rent',     view: 'calculators/buy-vs-rent',     title: 'Buy vs Rent Calculator',   noScript: true },
  { slug: 'cash-vs-mortgage', view: 'calculators/cash-vs-mortgage', title: 'Cash vs Mortgage Comparison', noScript: true },
  { slug: 'refi',            view: 'calculators/refi',            title: 'Refinance Analysis Tool',   noScript: true },
  { slug: 'reo',             view: 'calculators/reo',             title: 'REO Investment ROI',        noScript: true },
  { slug: 'escrow',          view: 'calculators/escrow',          title: 'Escrow Prepaids Calculator', noScript: true },
  {
    slug: 'amortization',
    view: 'calculators/amortization',
    title: 'Amortization Calculator',
    css: 'amortization',
    cdnScripts: [
      '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js"></script>'
    ]
  },
  { slug: 'var-income',      view: 'calculators/var-income',      title: 'Variable Income Analyzer', css: 'var-income' },
  { slug: 'fee-worksheet',  view: 'calculators/fee-worksheet',  title: 'Fee Worksheet',              css: 'fee-worksheet' },
  { slug: 'compare',        view: 'calculators/compare',        title: 'Loan Comparison',            css: 'compare' },
  { slug: 'loan-analysis',  view: 'calculators/loan-analysis',  title: 'Cover Letter',               css: 'loan-analysis' }
];

generalCalcs.forEach(gc => {
  router.get(`/${gc.slug}`, (req, res) => {
    const ver = res.locals.v;
    const extraHeadParts = [];
    if (gc.css) extraHeadParts.push(`<link rel="stylesheet" href="/css/calculators/${gc.css}.css?v=${ver}">`);
    if (gc.cdnScripts) extraHeadParts.push(...gc.cdnScripts);

    res.render(gc.view, {
      title: gc.title,
      calc: findCalc(gc.slug),
      extraHead: extraHeadParts.length ? extraHeadParts.join('') : undefined,
      extraScripts: gc.noScript ? undefined :
        (gc.preScripts ? gc.preScripts.map(s => `<script src="${s}?v=${ver}"></script>`).join('') : '') +
        `<script src="/js/calculators/${gc.slug}.js?v=${ver}"></script>`
    });
  });
});

/* ---- Income Calculators ---- */

router.get('/income-questionnaire', (req, res) => {
  res.render('calculators/income/questionnaire', {
    title: 'Income Questionnaire',
    calc: findCalc('income-questionnaire')
  });
});

const incomeCalcs = [
  { slug: '1040',              view: 'income/1040',              title: 'Form 1040 Income Calculator', css: 'income-1040' },
  { slug: '1065',              view: 'income/1065',              title: 'Form 1065 Income Calculator', css: 'income-1065' },
  { slug: '1120',              view: 'income/1120',              title: 'Form 1120 Income Calculator', css: 'income-1120' },
  { slug: '1120s',             view: 'income/1120s',             title: 'Form 1120S Income Calculator', css: 'income-1120s' },
  { slug: '1120s-k1',          view: 'income/1120s-k1',          title: '1120S K-1 Income Calculator', css: 'income-1120s-k1' },
  { slug: 'k1',                view: 'income/k1',                title: 'Schedule K-1 Income Calculator', css: 'income-k1' },
  { slug: 'rental-1038',       view: 'income/rental-1038',       title: 'Rental Property Income (1038)', css: 'income-rental-1038' },
  { slug: 'schedule-b',        view: 'income/schedule-b',        title: 'Schedule B Income Calculator', css: 'income-schedule-b' },
  { slug: 'schedule-c',        view: 'income/schedule-c',        title: 'Schedule C Income Calculator', css: 'income-schedule-c' },
  { slug: 'schedule-d',        view: 'income/schedule-d',        title: 'Schedule D Income Calculator', css: 'income-schedule-d' },
  { slug: 'schedule-e',        view: 'income/schedule-e',        title: 'Schedule E Income Calculator', css: 'income-schedule-e' },
  { slug: 'schedule-e-subject', view: 'income/schedule-e-subject', title: 'Schedule E (Subject Property)', css: 'income-schedule-e-subject' },
  { slug: 'schedule-f',        view: 'income/schedule-f',        title: 'Schedule F Income Calculator', css: 'income-schedule-f' }
];

incomeCalcs.forEach(ic => {
  router.get(`/income/${ic.slug}`, (req, res) => {
    const ver = res.locals.v;
    const extraHeadParts = [
      `<link rel="stylesheet" href="/css/calculators/income-base.css?v=${ver}">`
    ];
    if (ic.css) extraHeadParts.push(`<link rel="stylesheet" href="/css/calculators/${ic.css}.css?v=${ver}">`);
    if (ic.cdnScripts) extraHeadParts.push(...ic.cdnScripts);

    res.render(`calculators/${ic.view}`, {
      title: ic.title,
      calc: findCalc(`income/${ic.slug}`),
      extraHead: extraHeadParts.join(''),
      extraScripts: `<script src="/js/shared/income-upload.js?v=${ver}"></script>` +
                    `<script src="/js/calculators/${ic.view}.js?v=${ver}"></script>`
    });
  });
});

module.exports = router;
