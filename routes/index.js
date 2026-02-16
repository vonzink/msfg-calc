const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('hub', {
    title: 'Calculator Hub',
    bodyClass: 'hub-page',
    extraHead: '<link rel="stylesheet" href="/css/page-hub.css">',
    extraScripts: '<script src="/js/hub.js"></script>'
  });
});

module.exports = router;
