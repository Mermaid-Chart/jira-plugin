import { test } from 'node:test';
import assert from 'node:assert/strict';

import { forwardToRemote } from './index.js';

function fakeInvokeRemote(status = 200, text = '{"ok":true}') {
  const calls = [];
  const invokeRemote = async (remoteKey, options) => {
    calls.push({ remoteKey, options });
    return new Response(text, { status });
  };
  return { invokeRemote, calls };
}

test('a GET is forwarded to the connect remote with the user named in a header', async () => {
  const { invokeRemote, calls } = fakeInvokeRemote(200, '{"charts":[]}');
  const result = await forwardToRemote(
    { payload: { path: '/forge/panel-init?issueKey=ABC-1', method: 'GET' }, context: { accountId: 'acc-1' } },
    invokeRemote,
  );
  assert.deepEqual(result, { status: 200, body: '{"charts":[]}' });
  assert.deepEqual(calls, [
    {
      remoteKey: 'connect',
      options: { path: '/forge/panel-init?issueKey=ABC-1', method: 'GET', headers: { 'x-forge-account-id': 'acc-1' } },
    },
  ]);
});

test('a POST body is forwarded as JSON', async () => {
  const { invokeRemote, calls } = fakeInvokeRemote();
  await forwardToRemote(
    {
      payload: { path: '/forge/delete-chart', method: 'POST', body: '{"issueKey":"ABC-1","documentID":"d"}' },
      context: { accountId: 'acc-1' },
    },
    invokeRemote,
  );
  assert.deepEqual(calls[0].options, {
    path: '/forge/delete-chart',
    method: 'POST',
    body: '{"issueKey":"ABC-1","documentID":"d"}',
    headers: { 'x-forge-account-id': 'acc-1', 'Content-Type': 'application/json' },
  });
});

test('without an account id no account header is sent at all', async () => {
  const { invokeRemote, calls } = fakeInvokeRemote();
  await forwardToRemote({ payload: { path: '/forge/logout', method: 'POST' }, context: {} }, invokeRemote);
  assert.deepEqual(calls[0].options.headers, {});
});

test('the method defaults to GET', async () => {
  const { invokeRemote, calls } = fakeInvokeRemote();
  await forwardToRemote({ payload: { path: '/forge/check_token?state=s' }, context: { accountId: 'a' } }, invokeRemote);
  assert.equal(calls[0].options.method, 'GET');
});

test('error statuses from the server are passed back to the UI', async () => {
  const { invokeRemote } = fakeInvokeRemote(400, '{"message":"Chart already added"}');
  const result = await forwardToRemote(
    { payload: { path: '/forge/add-chart', method: 'POST', body: '{}' }, context: { accountId: 'a' } },
    invokeRemote,
  );
  assert.deepEqual(result, { status: 400, body: '{"message":"Chart already added"}' });
});

test('paths outside /forge/ are refused without calling the server', async () => {
  for (const path of ['/callback?code=x', '/', 'https://evil.example/forge/x', '/forge/../callback', undefined]) {
    const { invokeRemote, calls } = fakeInvokeRemote();
    const result = await forwardToRemote({ payload: { path, method: 'GET' }, context: { accountId: 'a' } }, invokeRemote);
    assert.equal(result.status, 400, String(path));
    assert.equal(calls.length, 0, String(path));
  }
});
