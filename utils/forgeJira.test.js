import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseChartsProperty,
  serializeChartsProperty,
  fetchUserToken,
  saveUserToken,
  getIssueCharts,
  setIssueCharts,
  addAttachment,
  deleteAttachment,
  base64ToBuffer,
} from './forgeJira.js';

const ctx = {
  apiBaseUrl: 'https://api.atlassian.com/ex/jira/cloud-1',
  accountId: '712020:abc',
  userToken: 'user-token',
};

// Records each call and answers from a queue of real Response objects.
function fakeFetch(...responses) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected fetch ${init.method || 'GET'} ${url}`);
    return next;
  };
  return { fetchImpl, calls };
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// What Jira returns today for an issue the Connect app saved charts on: the property value is a
// JSON string, because the Connect server sent an already-stringified body with json: true.
const connectChart = {
  documentID: 'doc-1',
  projectID: 'proj-1',
  major: '0',
  minor: '3',
  title: 'Flow',
  diagramImage: '',
  attachmentId: '10001',
  diagramUrl: 'https://site.atlassian.net/rest/api/2/attachment/content/10001',
};

test('parseChartsProperty reads the string the Connect app stored', () => {
  assert.deepEqual(parseChartsProperty(`{"value":[${JSON.stringify(connectChart)}]}`), [connectChart]);
});

test('parseChartsProperty also reads an object or a plain array', () => {
  assert.deepEqual(parseChartsProperty({ value: [{ documentID: 'a' }] }), [{ documentID: 'a' }]);
  assert.deepEqual(parseChartsProperty([{ documentID: 'a' }]), [{ documentID: 'a' }]);
});

test('parseChartsProperty returns [] for missing or corrupt values', () => {
  assert.deepEqual(parseChartsProperty(undefined), []);
  assert.deepEqual(parseChartsProperty('not json'), []);
  assert.deepEqual(parseChartsProperty('{"value":"nope"}'), []);
});

test('serializeChartsProperty produces the Connect-era string', () => {
  assert.equal(serializeChartsProperty([{ documentID: 'a' }]), '{"value":[{"documentID":"a"}]}');
});

test('getIssueCharts reads the diagrams property with the user token', async () => {
  const { fetchImpl, calls } = fakeFetch(
    json({ key: 'diagrams', value: `{"value":[${JSON.stringify(connectChart)}]}` }),
  );
  const charts = await getIssueCharts(ctx, 'ABC-1', fetchImpl);
  assert.deepEqual(charts, [connectChart]);
  assert.equal(calls[0].url, 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/2/issue/ABC-1/properties/diagrams');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer user-token');
});

test('getIssueCharts returns [] when the issue has no diagrams property', async () => {
  const { fetchImpl } = fakeFetch(json({ errorMessages: ['The property with key diagrams does not exist'] }, 404));
  assert.deepEqual(await getIssueCharts(ctx, 'ABC-1', fetchImpl), []);
});

test('getIssueCharts throws with the status on other errors', async () => {
  const { fetchImpl } = fakeFetch(json({ errorMessages: ['nope'] }, 403));
  await assert.rejects(getIssueCharts(ctx, 'ABC-1', fetchImpl), (err) => err.status === 403);
});

test('setIssueCharts writes the property in the same shape the Connect app did', async () => {
  const { fetchImpl, calls } = fakeFetch(new Response(null, { status: 200 }));
  await setIssueCharts(ctx, 'ABC-1', [{ documentID: 'a' }], fetchImpl);
  assert.equal(calls[0].url, 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/2/issue/ABC-1/properties/diagrams');
  assert.equal(calls[0].init.method, 'PUT');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer user-token');
  // The body is a JSON string literal, so Jira stores a string, as before.
  assert.equal(calls[0].init.body, '"{\\"value\\":[{\\"documentID\\":\\"a\\"}]}"');
  // Round trip: what Jira stores is what parseChartsProperty reads back.
  assert.deepEqual(parseChartsProperty(JSON.parse(calls[0].init.body)), [{ documentID: 'a' }]);
});

test('setIssueCharts throws with the status when Jira refuses', async () => {
  const { fetchImpl } = fakeFetch(json({ errorMessages: ['nope'] }, 403));
  await assert.rejects(setIssueCharts(ctx, 'ABC-1', [], fetchImpl), (err) => err.status === 403);
});

test('fetchUserToken reads the token the Connect app saved on the user', async () => {
  const { fetchImpl, calls } = fakeFetch(json({ key: 'token', value: { value: { token: 'mc-token' } } }));
  assert.equal(await fetchUserToken(ctx, fetchImpl), 'mc-token');
  assert.equal(
    calls[0].url,
    'https://api.atlassian.com/ex/jira/cloud-1/rest/api/2/user/properties/token?accountId=712020%3Aabc',
  );
  assert.equal(calls[0].init.headers.Authorization, 'Bearer user-token');
});

test('fetchUserToken returns an empty string when the user has no token', async () => {
  const { fetchImpl } = fakeFetch(json({ errorMessages: ['not found'] }, 404));
  assert.equal(await fetchUserToken(ctx, fetchImpl), '');
});

test('saveUserToken PUTs the Connect-era shape', async () => {
  const { fetchImpl, calls } = fakeFetch(new Response(null, { status: 200 }));
  assert.equal(await saveUserToken(ctx, 'mc-token', fetchImpl), 'mc-token');
  assert.equal(calls[0].init.method, 'PUT');
  assert.equal(calls[0].init.body, '{"value":{"token":"mc-token"}}');
});

test('saveUserToken falls back to POST when PUT fails, and throws when both fail', async () => {
  const ok = fakeFetch(new Response(null, { status: 405 }), new Response(null, { status: 201 }));
  assert.equal(await saveUserToken(ctx, '', ok.fetchImpl), '');
  assert.deepEqual(ok.calls.map((c) => c.init.method), ['PUT', 'POST']);

  const bad = fakeFetch(new Response(null, { status: 405 }), new Response('no', { status: 500 }));
  await assert.rejects(saveUserToken(ctx, 't', bad.fetchImpl), (err) => err.status === 500);
});

test('addAttachment uploads the PNG as multipart and returns id and content', async () => {
  const attachment = {
    self: 'https://site.atlassian.net/rest/api/2/attachment/10002',
    id: '10002',
    filename: 'ABC-1-attachment.png',
    author: { accountId: '712020:abc', displayName: 'Someone' },
    created: '2026-11-26T10:00:00.000+0000',
    size: 3,
    mimeType: 'image/png',
    content: 'https://site.atlassian.net/rest/api/2/attachment/content/10002',
    thumbnail: 'https://site.atlassian.net/rest/api/2/attachment/thumbnail/10002',
  };
  const { fetchImpl, calls } = fakeFetch(json([attachment]));
  const result = await addAttachment(ctx, 'ABC-1', Buffer.from([1, 2, 3]), fetchImpl);

  assert.deepEqual(result, { id: '10002', content: attachment.content });
  assert.equal(calls[0].url, 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/2/issue/ABC-1/attachments');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['X-Atlassian-Token'], 'no-check');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer user-token');
  const file = calls[0].init.body.get('file');
  assert.equal(file.name, 'ABC-1-attachment.png');
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [1, 2, 3]);
});

test('addAttachment throws with the status when the upload fails', async () => {
  const { fetchImpl } = fakeFetch(json({ errorMessages: ['too large'] }, 413));
  await assert.rejects(addAttachment(ctx, 'ABC-1', Buffer.from([1]), fetchImpl), (err) => err.status === 413);
});

test('deleteAttachment deletes by id and reports success', async () => {
  const { fetchImpl, calls } = fakeFetch(new Response(null, { status: 204 }));
  assert.equal(await deleteAttachment(ctx, '10001', fetchImpl), true);
  assert.equal(calls[0].url, 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/2/attachment/10001');
  assert.equal(calls[0].init.method, 'DELETE');
});

test('deleteAttachment reports false instead of throwing when Jira refuses', async () => {
  const { fetchImpl } = fakeFetch(new Response(null, { status: 404 }));
  assert.equal(await deleteAttachment(ctx, '10001', fetchImpl), false);
});

test('base64ToBuffer decodes the image the select page sends', () => {
  assert.deepEqual([...base64ToBuffer('AQID')], [1, 2, 3]);
});
