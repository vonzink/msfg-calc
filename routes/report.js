const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('report', {
    title: 'Session Report',
    extraHead: '<link rel="stylesheet" href="/css/report.css">',
    extraScripts:
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js"></script>\n' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js"></script>\n' +
      '<script src="/js/shared/report-templates.js"></script>\n' +
      '<script src="/js/report-page.js"></script>'
  });
});

module.exports = router;
