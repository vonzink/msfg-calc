const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const ver = res.locals.v;
  res.render('report', {
    title: 'Session Report',
    extraHead: `<link rel="stylesheet" href="/css/report.css?v=${ver}">`,
    extraScripts:
      `<script src="/js/shared/report-templates.js?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/income-standard.js?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/income-special.js?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/general-analysis.js?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/general-simple.js?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/government.js?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/tools.js?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/mismo.js?v=${ver}"></script>\n` +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js"></script>\n' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js"></script>\n' +
      `<script src="/js/report-page.js?v=${ver}"></script>`
  });
});

module.exports = router;
