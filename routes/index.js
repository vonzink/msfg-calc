const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const ver = res.locals.v;
  res.render('hub', {
    title: 'Calculator Hub',
    bodyClass: 'hub-page',
    extraHead: `<link rel="stylesheet" href="/css/page-hub.css?v=${ver}">`,
    extraScripts: `<script src="/js/hub.js?v=${ver}"></script>`
  });
});

module.exports = router;
