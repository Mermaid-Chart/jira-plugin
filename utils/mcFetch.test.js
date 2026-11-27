import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mcFetch } from './mcFetch.js';

const redirect = (location, status = 301) => new Response(null, { status, headers: { location } });
const ok = (body = 'ok') => new Response(body, { status: 200 });

function fakeFetch(...responses) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected fetch ${url}`);
    return next;
  };
  return { fetchImpl, calls };
}

const init = { headers: { Authorization: 'Bearer mc-token' } };

test('a redirect to mermaid.ai is followed with the same Authorization header', async () => {
  const { fetchImpl, calls } = fakeFetch(redirect('https://mermaid.ai/rest-api/users/me'), ok('{"id":"u"}'));
  const res = await mcFetch('https://www.mermaidchart.com/rest-api/users/me', init, fetchImpl);

  assert.equal(res.status, 200);
  assert.equal(await res.text(), '{"id":"u"}');
  assert.deepEqual(calls.map((c) => c.url), [
    'https://www.mermaidchart.com/rest-api/users/me',
    'https://mermaid.ai/rest-api/users/me',
  ]);
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer mc-token');
});

test('a relative redirect is resolved against the current URL', async () => {
  const { fetchImpl, calls } = fakeFetch(redirect('/rest-api/users/me2', 308), ok());
  await mcFetch('https://test.mermaid.ai/rest-api/users/me', init, fetchImpl);
  assert.equal(calls[1].url, 'https://test.mermaid.ai/rest-api/users/me2');
});

test('the token is not sent to another host or over http', async () => {
  for (const target of ['https://evil.example/x', 'http://mermaid.ai/x', 'https://mermaid.ai.evil.example/x']) {
    const { fetchImpl, calls } = fakeFetch(redirect(target));
    const res = await mcFetch('https://mermaidchart.com/x', init, fetchImpl);
    assert.equal(res.status, 301, target);
    assert.equal(calls.length, 1, target);
  }
});

test('more than 3 redirects stops and returns the last redirect', async () => {
  const { fetchImpl, calls } = fakeFetch(
    redirect('https://mermaid.ai/1'),
    redirect('https://mermaid.ai/2'),
    redirect('https://mermaid.ai/3'),
    redirect('https://mermaid.ai/4'),
  );
  const res = await mcFetch('https://mermaid.ai/0', init, fetchImpl);
  assert.equal(res.status, 301);
  assert.equal(calls.length, 4);
});

test('a response that is not a redirect is returned as is', async () => {
  const { fetchImpl, calls } = fakeFetch(new Response('no', { status: 401 }));
  const res = await mcFetch('https://mermaid.ai/rest-api/users/me', init, fetchImpl);
  assert.equal(res.status, 401);
  assert.equal(calls.length, 1);
});
