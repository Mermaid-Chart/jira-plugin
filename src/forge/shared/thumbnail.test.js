import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadThumbnail } from './thumbnail.js';

test('the attachment bytes are fetched as the user and turned into an object URL', async () => {
  const paths = [];
  const blobs = [];
  const url = await loadThumbnail('10001', {
    requestJira: async (path) => {
      paths.push(path);
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/png' } });
    },
    createObjectURL: (blob) => {
      blobs.push(blob);
      return 'blob:panel/1';
    },
  });
  assert.equal(url, 'blob:panel/1');
  assert.deepEqual(paths, ['/rest/api/2/attachment/content/10001?redirect=false']);
  assert.deepEqual([...new Uint8Array(await blobs[0].arrayBuffer())], [1, 2, 3]);
});

test('a failed download rejects with the status', async () => {
  await assert.rejects(
    loadThumbnail('10001', {
      requestJira: async () => new Response('gone', { status: 404 }),
      createObjectURL: () => assert.fail('must not create a URL'),
    }),
    (err) => err.status === 404,
  );
});

test('a chart saved without an attachment gets no thumbnail and makes no request', async () => {
  const url = await loadThumbnail(undefined, {
    requestJira: () => assert.fail('must not request'),
    createObjectURL: () => assert.fail('must not create a URL'),
  });
  assert.equal(url, null);
});
