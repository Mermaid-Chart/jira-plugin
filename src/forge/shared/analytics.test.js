import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAnalytics } from './analytics.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), data };
}

function capture() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(null, { status: 204 });
  };
  return { calls, fetchImpl };
}

test('events go to the pulse endpoint with the Jira event names and a stable analytics id', async () => {
  const { calls, fetchImpl } = capture();
  const storage = memoryStorage();
  const analytics = createAnalytics({ getBaseUrl: () => 'https://test.mermaid.ai', fetchImpl, storage });

  analytics.trackConnectToMermaidChart();
  analytics.trackLogout();
  analytics.trackPluginDiagramEdit();
  await new Promise((r) => setImmediate(r));

  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.url, 'https://test.mermaid.ai/rest-api/plugins/pulse');
    assert.equal(call.init.method, 'POST');
    assert.equal(call.body.pluginSource, 'jira');
    assert.equal(call.body.analyticsID, storage.data.get('MERMAID_ANALYTICS_ID'));
  }
  assert.deepEqual(
    calls.map((c) => [c.body.eventName, c.body.eventID, c.body.userLoginState, c.body.diagramType, c.body.diagramID]),
    [
      ['Jira Plugin User Logged In', 'JIRA_PLUGIN_LOGIN', true, undefined, undefined],
      ['Jira Plugin User Logged Out', 'JIRA_PLUGIN_LOGOUT', false, undefined, undefined],
      ['Plugin diagram edit', 'PLUGIN_DIAGRAM_EDIT', true, 'unknown', 'unknown'],
    ],
  );
});

test('nothing is sent before the Mermaid Chart URL is known', async () => {
  const { calls, fetchImpl } = capture();
  const analytics = createAnalytics({ getBaseUrl: () => '', fetchImpl, storage: memoryStorage() });
  analytics.trackLogout();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 0);
});

test('analytics still sends when storage is blocked', async () => {
  const { calls, fetchImpl } = capture();
  const blocked = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('SecurityError');
    },
  };
  const analytics = createAnalytics({ getBaseUrl: () => 'https://mermaid.ai', fetchImpl, storage: blocked });
  analytics.trackLogout();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0].body.analyticsID, 'string');
});
