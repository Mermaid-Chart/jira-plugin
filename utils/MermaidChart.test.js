import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { MermaidChart } from './MermaidChart.js';

// Same get/set/del(key, clientKey) contract as utils/redisStore.js.
function memoryStore() {
  const data = new Map();
  const k = (key, clientKey) => (clientKey ? `${clientKey}:${key}` : key);
  return {
    data,
    get: async (key, clientKey) => data.get(k(key, clientKey)) ?? null,
    set: async (key, val, clientKey) => {
      data.set(k(key, clientKey), val);
      return 'OK';
    },
    del: async (key, clientKey) => {
      data.delete(k(key, clientKey));
      return 1;
    },
  };
}

function makeClient(fetchImpl) {
  const store = memoryStore();
  const client = new MermaidChart({
    clientID: 'client-1',
    baseURL: 'https://test.mermaid.ai',
    redirectURI: 'https://jira.mermaidchart.com/callback',
    store,
    fetchImpl,
  });
  return { client, store };
}

test('getAuthorizationData starts a PKCE sign-in and remembers the verifier for the callback', async () => {
  const { client, store } = makeClient();
  const auth = await client.getAuthorizationData();

  const verifier = store.data.get(`all:state:${auth.state}:code`);
  assert.ok(verifier, 'verifier stored under the shared client key');

  const url = new URL(auth.url);
  assert.equal(url.origin + url.pathname, 'https://test.mermaid.ai/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), 'client-1');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://jira.mermaidchart.com/callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(
    url.searchParams.get('code_challenge'),
    createHash('sha256').update(verifier).digest('base64url'),
  );
  assert.equal(url.searchParams.get('state'), auth.state);
  assert.equal(url.searchParams.get('scope'), 'email');
  assert.equal(url.searchParams.get('utm_source'), 'mermaid_chart_jira_plugin');
  assert.equal(url.searchParams.get('utm_medium'), 'jira');
  assert.equal(url.searchParams.get('utm_campaign'), 'jira_plugin');
});

test('handleAuthorizationResponse rejects a state this server did not start', async () => {
  const { client } = makeClient(async () => {
    throw new Error('must not call Mermaid Chart');
  });
  await assert.rejects(client.handleAuthorizationResponse({ code: 'c', state: 'unknown' }), /invalid_state/);
});

test('handleAuthorizationResponse exchanges the code and keeps the token for check_token', async () => {
  const calls = [];
  const { client, store } = makeClient(async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ access_token: 'mc-token' }), { status: 200 });
  });
  const auth = await client.getAuthorizationData();
  const verifier = store.data.get(`all:state:${auth.state}:code`);

  await client.handleAuthorizationResponse({ code: 'auth-code', state: auth.state });

  assert.equal(calls[0].url, 'https://test.mermaid.ai/oauth/token');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    client_id: 'client-1',
    redirect_uri: 'https://jira.mermaidchart.com/callback',
    code_verifier: verifier,
    code: 'auth-code',
  });
  assert.equal(await client.getToken(auth.state), 'mc-token');
  await client.delToken(auth.state);
  assert.equal(await client.getToken(auth.state), null);
});

test('the token exchange follows a mermaidchart.com redirect to mermaid.ai and still POSTs the code', async () => {
  const calls = [];
  const responses = [
    new Response(null, { status: 301, headers: { location: 'https://mermaid.ai/oauth/token' } }),
    new Response(JSON.stringify({ access_token: 'mc-token' }), { status: 200 }),
  ];
  const store = memoryStore();
  const client = new MermaidChart({
    clientID: 'client-1',
    baseURL: 'https://www.mermaidchart.com',
    redirectURI: 'https://jira.mermaidchart.com/callback',
    store,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return responses.shift();
    },
  });
  const auth = await client.getAuthorizationData();

  await client.handleAuthorizationResponse({ code: 'auth-code', state: auth.state });

  assert.deepEqual(calls.map((c) => c.url), ['https://www.mermaidchart.com/oauth/token', 'https://mermaid.ai/oauth/token']);
  assert.equal(calls[1].init.method, 'post');
  assert.equal(JSON.parse(calls[1].init.body).code, 'auth-code');
  assert.equal(await client.getToken(auth.state), 'mc-token');
});

test('getUser follows a redirect to mermaid.ai with the token', async () => {
  const calls = [];
  const responses = [
    new Response(null, { status: 301, headers: { location: 'https://mermaid.ai/rest-api/users/me' } }),
    new Response(JSON.stringify({ id: 'u1', emailAddress: 'a@b.c' }), { status: 200 }),
  ];
  const { client } = makeClient(async (url, init) => {
    calls.push({ url, init });
    return responses.shift();
  });
  assert.deepEqual(await client.getUser('mc-token'), { id: 'u1', emailAddress: 'a@b.c' });
  assert.equal(calls[1].init.headers.Authorization, 'Bearer mc-token');
});

test('getUser throws when the token is not valid', async () => {
  const { client } = makeClient(async () => new Response('no', { status: 401 }));
  await assert.rejects(client.getUser('bad'), /Invalid token/);
});
