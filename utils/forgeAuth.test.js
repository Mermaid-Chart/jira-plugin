import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as jose from 'jose';

import { APP_ID, createForgeInvocationGuard } from './forgeAuth.js';

const AUDIENCE = 'ari:cloud:ecosystem::app/test-app';

async function makeKeys() {
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
  return { keys: publicKey, privateKey };
}

function sign(privateKey, claims, { audience = AUDIENCE, issuer = 'forge/invocation-token' } = {}) {
  return new jose.SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

// Runs the guard like Express would and reports what it did.
async function run(guard, headers) {
  const req = { headers };
  const result = { status: 200, body: undefined, nextCalled: false };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  await guard(req, res, () => {
    result.nextCalled = true;
  });
  return { ...result, forge: req.forge };
}

test('APP_ID is the app id in manifest.yml, so tokens Forge signs for this app are accepted', () => {
  const manifest = readFileSync(new URL('../manifest.yml', import.meta.url), 'utf8');
  const match = manifest.match(/^\s*id:\s*(ari:\S+)/m);
  assert.ok(match, 'manifest.yml has app.id');
  assert.equal(APP_ID, match[1]);
});

test('a request without a bearer token is rejected with 401', async () => {
  const { keys } = await makeKeys();
  const guard = createForgeInvocationGuard({ keys, audience: AUDIENCE });
  const out = await run(guard, {});
  assert.equal(out.status, 401);
  assert.equal(out.nextCalled, false);
});

test('a token for another app is rejected with 401', async () => {
  const { keys, privateKey } = await makeKeys();
  const guard = createForgeInvocationGuard({ keys, audience: AUDIENCE });
  const token = await sign(
    privateKey,
    { principal: 'acc-1', app: { apiBaseUrl: 'https://api.example/ex/jira/c1' } },
    { audience: 'ari:cloud:ecosystem::app/other' },
  );
  const out = await run(guard, { authorization: `Bearer ${token}`, 'x-forge-oauth-user': 'ut' });
  assert.equal(out.status, 401);
  assert.equal(out.nextCalled, false);
});

test('a call from the resolver function names the user in x-forge-account-id', async () => {
  const { keys, privateKey } = await makeKeys();
  const guard = createForgeInvocationGuard({ keys, audience: AUDIENCE });
  const token = await sign(privateKey, { app: { apiBaseUrl: 'https://api.example/ex/jira/c1' } });
  const out = await run(guard, {
    authorization: `Bearer ${token}`,
    'x-forge-account-id': 'acc-from-function',
    'x-forge-oauth-user': 'user-token',
  });
  assert.equal(out.nextCalled, true);
  assert.equal(out.forge.accountId, 'acc-from-function');
  assert.equal(out.forge.apiBaseUrl, 'https://api.example/ex/jira/c1');
  assert.equal(out.forge.userToken, 'user-token');
});

test('a token with no principal and no account header is rejected with 401', async () => {
  const { keys, privateKey } = await makeKeys();
  const guard = createForgeInvocationGuard({ keys, audience: AUDIENCE });
  const token = await sign(privateKey, { app: { apiBaseUrl: 'https://api.example/ex/jira/c1' } });
  const out = await run(guard, { authorization: `Bearer ${token}`, 'x-forge-oauth-user': 'ut' });
  assert.equal(out.status, 401);
  assert.equal(out.nextCalled, false);
});

test('a request without the Forge user token is rejected with 401', async () => {
  const { keys, privateKey } = await makeKeys();
  const guard = createForgeInvocationGuard({ keys, audience: AUDIENCE });
  const token = await sign(privateKey, {
    principal: 'acc-1',
    app: { apiBaseUrl: 'https://api.example/ex/jira/c1' },
  });
  const out = await run(guard, { authorization: `Bearer ${token}` });
  assert.equal(out.status, 401);
  assert.equal(out.nextCalled, false);
});
