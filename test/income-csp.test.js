'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const incomeViewsDir = path.join(__dirname, '..', 'views', 'calculators', 'income');
const workspaceJsPath = path.join(__dirname, '..', 'public', 'js', 'workspace.js');

describe('Income calculator CSP compatibility', () => {
  it('does not rely on inline JavaScript event attributes', () => {
    const offenders = [];

    fs.readdirSync(incomeViewsDir)
      .filter(file => file.endsWith('.ejs'))
      .forEach(file => {
        const fullPath = path.join(incomeViewsDir, file);
        const contents = fs.readFileSync(fullPath, 'utf8');
        const matches = contents.match(/\son[a-z]+\s*=/gi) || [];

        matches.forEach(match => {
          offenders.push(`${file}: ${match.trim()}`);
        });
      });

    assert.deepStrictEqual(offenders, []);
  });

  it('workspace result element map points to real income template IDs', () => {
    const workspaceJs = fs.readFileSync(workspaceJsPath, 'utf8');
    const mapMatch = workspaceJs.match(/const INCOME_ELEMENT_MAP = \{([\s\S]*?)\n  \};/);

    assert.ok(mapMatch, 'INCOME_ELEMENT_MAP should exist in workspace.js');

    const missing = [];
    const entryPattern = /'income\/([^']+)':\s*'([^']+)'/g;
    let entryMatch = entryPattern.exec(mapMatch[1]);

    while (entryMatch) {
      const slug = entryMatch[1];
      const elementId = entryMatch[2];
      const templatePath = path.join(incomeViewsDir, `${slug}.ejs`);
      const template = fs.readFileSync(templatePath, 'utf8');

      if (!template.includes(`id="${elementId}"`)) {
        missing.push(`income/${slug}: #${elementId}`);
      }

      entryMatch = entryPattern.exec(mapMatch[1]);
    }

    assert.deepStrictEqual(missing, []);
  });
});
