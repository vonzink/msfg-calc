/**
 * Build pipeline tests
 *
 * Verifies the esbuild minification pipeline produces valid output.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_JS = path.join(__dirname, '..', 'public', 'js');

// Recursively find files by extension
function findFiles(dir, ext) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext) && !entry.name.endsWith('.min' + ext)) {
      results.push(full);
    }
  }
  return results;
}

describe('Build script', () => {
  it('scripts/build.js exists', () => {
    assert.ok(
      fs.existsSync(path.join(__dirname, '..', 'scripts', 'build.js')),
      'build script should exist'
    );
  });
});

describe('Minified files', () => {
  const jsFiles = findFiles(PUBLIC_JS, '.js');

  it('found JS source files to verify', () => {
    assert.ok(jsFiles.length > 40, `expected 40+ JS files, found ${jsFiles.length}`);
  });

  for (const src of jsFiles) {
    const rel = path.relative(PUBLIC_JS, src);
    const minPath = src.replace(/\.js$/, '.min.js');

    it(`${rel} has .min.js companion`, () => {
      assert.ok(fs.existsSync(minPath), `missing minified file for ${rel}`);
    });

    it(`${rel}.min.js is smaller than source`, () => {
      if (!fs.existsSync(minPath)) return; // skip if no min file
      const srcSize = fs.statSync(src).size;
      const minSize = fs.statSync(minPath).size;
      assert.ok(minSize < srcSize,
        `minified (${minSize}B) should be smaller than source (${srcSize}B)`);
    });
  }
});
