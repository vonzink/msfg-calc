#!/usr/bin/env node
'use strict';

/**
 * Build script — minifies all client-side JS files using esbuild.
 *
 * Creates `.min.js` siblings next to each source file so the server
 * can reference them in production while keeping the originals for
 * development/debugging.
 *
 * Usage:
 *   node scripts/build.js          # minify all
 *   node scripts/build.js --clean  # remove all .min.js files
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PUBLIC_JS = path.join(__dirname, '..', 'public', 'js');

// Recursively find all .js files, excluding .min.js
function findJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.min.js')) {
      results.push(full);
    }
  }
  return results;
}

// Clean mode — remove all .min.js files
if (process.argv.includes('--clean')) {
  const minFiles = findJsFiles(PUBLIC_JS)
    .map(f => f.replace(/\.js$/, '.min.js'))
    .filter(f => fs.existsSync(f));
  minFiles.forEach(f => fs.unlinkSync(f));
  console.log(`Cleaned ${minFiles.length} .min.js files`);
  process.exit(0);
}

// Build mode — minify all JS files
const files = findJsFiles(PUBLIC_JS);
let totalSaved = 0;
let count = 0;

for (const src of files) {
  const out = src.replace(/\.js$/, '.min.js');
  try {
    execSync(
      `npx esbuild "${src}" --outfile="${out}" --minify --target=es2020 --charset=utf8`,
      { stdio: 'pipe' }
    );
    const origSize = fs.statSync(src).size;
    const minSize = fs.statSync(out).size;
    const saved = origSize - minSize;
    totalSaved += saved;
    count++;
  } catch (err) {
    console.error(`Failed to minify ${path.relative(PUBLIC_JS, src)}:`, err.stderr?.toString() || err.message);
    process.exitCode = 1;
  }
}

const savedKB = (totalSaved / 1024).toFixed(1);
console.log(`Minified ${count}/${files.length} files — saved ${savedKB} KB total`);
