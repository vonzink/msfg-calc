const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('workspace', {
    title: 'Calculator Workspace',
    extraHead: '<link rel="stylesheet" href="/css/workspace.css?v=20260217e">',
    extraScripts: '<script src="/js/shared/mismo-parser.js?v=20260217e"></script>' +
                  '<script src="/js/workspace.js?v=20260217e"></script>'
  });
});

module.exports = router;
