const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('report', {
    title: 'Session Report',
    extraHead: '<link rel="stylesheet" href="/css/report.css">',
    extraScripts: '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>\n<script src="/js/report-page.js"></script>'
  });
});

module.exports = router;
