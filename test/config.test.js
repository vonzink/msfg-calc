/**
 * Configuration validation tests
 *
 * Verifies calculator config integrity, site config structure,
 * and route/config alignment.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const calcConfig = require('../config/calculators.json');

describe('calculators.json structure', () => {
  it('has a calculators array', () => {
    assert.ok(Array.isArray(calcConfig.calculators));
    assert.ok(calcConfig.calculators.length > 0, 'should have at least one calculator');
  });

  it('has a categories array', () => {
    assert.ok(Array.isArray(calcConfig.categories));
    assert.ok(calcConfig.categories.length > 0, 'should have at least one category');
  });

  it('every calculator has required fields', () => {
    for (const calc of calcConfig.calculators) {
      assert.ok(calc.slug, `calculator missing slug: ${JSON.stringify(calc)}`);
      assert.ok(calc.name, `calculator ${calc.slug} missing name`);
      assert.ok(calc.category, `calculator ${calc.slug} missing category`);
    }
  });

  it('all slugs are unique', () => {
    const slugs = calcConfig.calculators.map(c => c.slug);
    const unique = new Set(slugs);
    assert.strictEqual(slugs.length, unique.size, 'duplicate slugs found');
  });

  it('all calculator categories reference valid categories', () => {
    const validCategories = new Set(calcConfig.categories.map(c => c.id));
    for (const calc of calcConfig.calculators) {
      assert.ok(validCategories.has(calc.category),
        `calculator ${calc.slug} references unknown category "${calc.category}"`);
    }
  });

  it('every category has required fields', () => {
    for (const cat of calcConfig.categories) {
      assert.ok(cat.id, `category missing id: ${JSON.stringify(cat)}`);
      assert.ok(cat.label, `category ${cat.id} missing label`);
    }
  });
});

describe('site.json structure', () => {
  it('exists and is valid JSON', () => {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'config', 'site.json'), 'utf-8');
    const config = JSON.parse(raw);
    assert.ok(typeof config === 'object');
  });

  it('has required branding fields', () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'config', 'site.json'), 'utf-8')
    );
    assert.ok(typeof config.siteName === 'string', 'missing siteName');
    assert.ok(typeof config.companyName === 'string', 'missing companyName');
  });
});

describe('Route/config alignment', () => {
  it('generalCalcs in routes matches config slugs', () => {
    // Read routes file to extract slug list
    const routesSrc = fs.readFileSync(
      path.join(__dirname, '..', 'routes', 'calculators.js'), 'utf-8'
    );

    // Extract slugs from generalCalcs array
    const slugMatches = [...routesSrc.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);
    assert.ok(slugMatches.length > 0, 'should find slugs in routes file');

    // Each route slug should have a matching config entry
    for (const slug of slugMatches) {
      // Income slugs are prefixed with income/ in config
      const configSlug = slug;
      const found = calcConfig.calculators.some(c =>
        c.slug === configSlug || c.slug === `income/${configSlug}`
      );
      assert.ok(found, `route slug "${slug}" has no matching calculators.json entry`);
    }
  });
});

describe('View files exist for configured calculators', () => {
  const viewsDir = path.join(__dirname, '..', 'views', 'calculators');

  // Only check calculators that have EJS views (not legacy iframe stubs)
  const ejsCalcs = calcConfig.calculators.filter(c =>
    !['llpm', 'batch-llpm', 'income-questionnaire'].includes(c.slug) &&
    !c.slug.startsWith('income/')
  );

  for (const calc of ejsCalcs) {
    it(`view exists for ${calc.slug}`, () => {
      const viewPath = path.join(viewsDir, calc.slug + '.ejs');
      assert.ok(fs.existsSync(viewPath), `missing view file: ${viewPath}`);
    });
  }
});
