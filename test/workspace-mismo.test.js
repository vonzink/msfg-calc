/**
 * Workspace MISMO auto-fill contract tests
 *
 * Regression guard for the bug where dropping a MISMO file in the workspace
 * populated no calculator. The multi-instance refactor keyed panel DOM ids by
 * instanceId (`ws-panel-<instanceId>`), but workspace-mismo.js still resolved
 * panels by slug (`ws-panel-<slug>`), so getElementById() always returned null
 * and populatePanel() bailed for every calculator.
 *
 * These are source-invariant checks (no DOM harness in this project) that keep
 * the panel-id contract between workspace.js (writer) and workspace-mismo.js
 * (reader) in sync.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_JS = path.join(__dirname, '..', 'public', 'js');
const WS = fs.readFileSync(path.join(PUBLIC_JS, 'workspace.js'), 'utf8');
const WSM = fs.readFileSync(path.join(PUBLIC_JS, 'workspace-mismo.js'), 'utf8');
const WSH = fs.readFileSync(path.join(PUBLIC_JS, 'workspace-helpers.js'), 'utf8');

describe('Workspace MISMO auto-fill panel-id contract', () => {
  it('workspace.js creates panel DOM ids from instanceId', () => {
    assert.match(
      WS,
      /\.id\s*=\s*'ws-panel-'\s*\+\s*instanceId/,
      'panels must be created as ws-panel-<instanceId>'
    );
  });

  it('workspace-mismo.js resolves panels by instanceId', () => {
    assert.match(
      WSM,
      /getElementById\('ws-panel-'\s*\+\s*instanceId\)/,
      'populatePanel must resolve the panel container by instanceId'
    );
  });

  it('workspace-mismo.js does NOT resolve panels by slug (the original bug)', () => {
    assert.doesNotMatch(
      WSM,
      /getElementById\('ws-panel-'\s*\+\s*slug\)/,
      'slug-based panel lookup silently fails — panels are keyed by instanceId'
    );
  });

  it('populateAllPanels threads each panel.instanceId', () => {
    assert.match(
      WSM,
      /populatePanel\(panel\.slug,\s*panel\.instanceId\)/,
      'populateAllPanels must pass panel.instanceId so the right instance is found'
    );
  });

  it('workspace.js passes instanceId into schedulePopulate', () => {
    assert.match(
      WS,
      /schedulePopulate\(iframe,\s*slug,\s*panel\.instanceId\)/,
      'schedulePopulate must receive the panel instanceId on iframe load'
    );
  });

  it('highlightPanel (workspace-helpers.js) does NOT resolve panels by slug', () => {
    assert.doesNotMatch(
      WSH,
      /getElementById\('ws-panel-'\s*\+\s*slug\)/,
      'the populated-fields badge must not resolve its panel by slug'
    );
  });

  it('highlightPanel accepts and prefers instanceId', () => {
    assert.match(
      WSH,
      /function highlightPanel\(slug,\s*count,\s*instanceId\)/,
      'highlightPanel must accept instanceId'
    );
    assert.match(
      WSH,
      /getElementById\('ws-panel-'\s*\+\s*instanceId\)/,
      'highlightPanel must resolve the panel by instanceId'
    );
  });
});
