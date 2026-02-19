const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const ver = res.locals.v;
  res.render('workspace', {
    title: 'Calculator Workspace',
    extraHead: `<link rel="stylesheet" href="/css/workspace.css?v=${ver}">`,
    extraScripts: `<script src="/js/shared/mismo-parser.js?v=${ver}"></script>` +
                  `<script src="/js/workspace.js?v=${ver}"></script>`
  });
});

module.exports = router;
