import { test } from 'node:test';
import assert from 'node:assert/strict';

import { interpretMessage, buildFrameUrl, isMermaidOrigin } from './messages.js';

test('messages are accepted only from Mermaid Chart pages', () => {
  assert.equal(isMermaidOrigin('https://mermaid.ai', 'https://test.mermaid.ai'), true);
  assert.equal(isMermaidOrigin('https://test.mermaid.ai', 'https://test.mermaid.ai'), true);
  assert.equal(isMermaidOrigin('https://www.mermaidchart.com', 'https://test.mermaid.ai'), true);
  // Local dev: the configured Mermaid Chart origin is trusted too.
  assert.equal(isMermaidOrigin('http://localhost:3000', 'http://localhost:3000'), true);

  assert.equal(isMermaidOrigin('https://evil.example', 'https://test.mermaid.ai'), false);
  assert.equal(isMermaidOrigin('https://mermaid.ai.evil.example', 'https://test.mermaid.ai'), false);
  assert.equal(isMermaidOrigin('http://mermaid.ai', 'https://test.mermaid.ai'), false);
  assert.equal(isMermaidOrigin('null', 'https://test.mermaid.ai'), false);
});

test('a save from the Mermaid Chart page carries the chart', () => {
  const data = { documentID: 'd', projectID: 'p', major: '0', minor: '1', diagramImage: 'AQID' };
  assert.deepEqual(interpretMessage({ action: 'save', data }), { type: 'save', chart: data });
});

test('the back button from the Mermaid Chart page closes the dialog', () => {
  assert.deepEqual(interpretMessage({ type: 'mermaid-chart-jira-back', action: 'navigateBack' }), { type: 'back' });
});

test('cancel, logout and anything unknown are ignored, as in the Connect version', () => {
  for (const data of [{ action: 'cancel' }, { action: 'logout' }, { action: 'save' }, { foo: 1 }, 'text', null, undefined]) {
    assert.deepEqual(interpretMessage(data), { type: 'ignore' }, JSON.stringify(data));
  }
});

test('the select frame opens the Mermaid Chart select page for Jira', () => {
  assert.equal(
    buildFrameUrl('https://test.mermaid.ai', 'tok', 'select'),
    'https://test.mermaid.ai/oauth/frame/?token=tok&redirect=/app/plugins/confluence/select?pluginSource=jira',
  );
});

test('the edit frame opens the diagram at its saved version', () => {
  assert.equal(
    buildFrameUrl('https://test.mermaid.ai', 'tok', 'edit', { projectID: 'p', documentID: 'd', major: '1', minor: '2' }),
    'https://test.mermaid.ai/oauth/frame/?token=tok&redirect=/app/projects/p/diagrams/d/version/v1.2/edit?pluginSource=jira',
  );
});
