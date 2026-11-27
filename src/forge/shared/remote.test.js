import { test } from 'node:test';
import assert from 'node:assert/strict';

import { remoteInvoke } from './remote.js';

function fakeInvoke(result) {
  const calls = [];
  const invoke = async (key, payload) => {
    calls.push({ key, payload });
    return result;
  };
  return { invoke, calls };
}

test('a GET goes to the remote resolver and returns the parsed JSON body', async () => {
  const { invoke, calls } = fakeInvoke({ status: 200, body: '{"charts":[{"documentID":"a"}]}' });
  const body = await remoteInvoke('/forge/panel-init?issueKey=ABC-1', {}, invoke);
  assert.deepEqual(body, { charts: [{ documentID: 'a' }] });
  assert.deepEqual(calls, [{ key: 'remote', payload: { path: '/forge/panel-init?issueKey=ABC-1', method: 'GET' } }]);
});

test('a body is sent as a JSON string', async () => {
  const { invoke, calls } = fakeInvoke({ status: 200, body: '{"ok":true}' });
  await remoteInvoke('/forge/delete-chart', { method: 'POST', body: { issueKey: 'ABC-1', documentID: 'd' } }, invoke);
  assert.deepEqual(calls[0].payload, {
    path: '/forge/delete-chart',
    method: 'POST',
    body: '{"issueKey":"ABC-1","documentID":"d"}',
  });
});

test('a non-2xx status throws with the status and the server message', async () => {
  const { invoke } = fakeInvoke({ status: 400, body: '{"message":"Chart already added"}' });
  await assert.rejects(remoteInvoke('/forge/add-chart', { method: 'POST', body: {} }, invoke), (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.message, 'Chart already added');
    return true;
  });
});

test('a non-2xx status with a non-JSON body still throws with the status', async () => {
  const { invoke } = fakeInvoke({ status: 494, body: 'REQUEST_HEADER_TOO_LARGE' });
  await assert.rejects(remoteInvoke('/forge/panel-init?issueKey=A', {}, invoke), (err) => err.status === 494);
});
