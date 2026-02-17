const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('workspace', {
    title: 'Calculator Workspace',
    extraHead: '<link rel="stylesheet" href="/css/workspace.css">',
    extraScripts: '<script src="/js/workspace.js?v=20260217c"></script>'
  });
});

module.exports = router;
