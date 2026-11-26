import { test } from 'node:test';
import assert from 'node:assert/strict';

import { startSignIn } from './login.js';

const notReady = () => Object.assign(new Error('Token not ready'), { status: 404 });

test('sign-in opens the login URL and polls check_token until the token is ready', async () => {
  const opened = [];
  const paths = [];
  let answers = 0;
  const done = new Promise((resolve) => {
    startSignIn({
      loginURL: 'https://test.mermaid.ai/oauth/authorize?state=s 1',
      loginState: 's 1',
      openUrl: (u) => opened.push(u),
      remote: async (path) => {
        paths.push(path);
        answers += 1;
        if (answers < 3) throw notReady();
        return { token: 'mc-token', user: { id: 'u1' } };
      },
      onLogin: (token, user) => resolve({ token, user }),
      intervalMs: 1,
    });
  });

  assert.deepEqual(await done, { token: 'mc-token', user: { id: 'u1' } });
  assert.deepEqual(opened, ['https://test.mermaid.ai/oauth/authorize?state=s 1']);
  assert.equal(paths.length, 3);
  assert.equal(paths[0], '/forge/check_token?state=s%201');
});

test('polling stops after the time limit when sign-in is abandoned', async () => {
  let clock = 0;
  let calls = 0;
  startSignIn({
    loginURL: 'u',
    loginState: 's',
    openUrl: () => {},
    remote: async () => {
      calls += 1;
      clock += 1000;
      throw notReady();
    },
    onLogin: () => assert.fail('must not sign in'),
    intervalMs: 1,
    timeoutMs: 2500,
    now: () => clock,
  });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(calls, 3);
});

test('starting sign-in again stops the earlier poll', async () => {
  let firstCalls = 0;
  const stopFirst = startSignIn({
    loginURL: 'u1',
    loginState: 's1',
    openUrl: () => {},
    remote: async () => {
      firstCalls += 1;
      throw notReady();
    },
    onLogin: () => assert.fail('first sign-in must not finish'),
    intervalMs: 1,
  });
  const second = new Promise((resolve) => {
    startSignIn({
      loginURL: 'u2',
      loginState: 's2',
      openUrl: () => {},
      remote: async () => ({ token: 't2', user: null }),
      onLogin: (token) => resolve(token),
      intervalMs: 1,
    });
  });
  assert.equal(await second, 't2');
  const before = firstCalls;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(firstCalls, before);
  stopFirst();
});
