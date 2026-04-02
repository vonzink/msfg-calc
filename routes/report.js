const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const ver = res.locals.v;
  const ext = res.locals.jsExt;
  res.render('report', {
    title: 'Session Report',
    extraHead: `<link rel="stylesheet" href="/css/report.css?v=${ver}">`,
    extraScripts:
      `<script src="/js/shared/report-templates${ext}?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/income-standard${ext}?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/income-special${ext}?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/general-analysis${ext}?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/general-simple${ext}?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/government${ext}?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/tools${ext}?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/tools-compare${ext}?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/tools-pricing${ext}?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/tools-timeline${ext}?v=${ver}"></script>\n` +
      `<script src="/js/shared/report-templates/mismo${ext}?v=${ver}"></script>\n` +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js"></script>\n' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js"></script>\n' +
      `<script src="/js/report-page${ext}?v=${ver}"></script>`
  });
});

module.exports = router;
