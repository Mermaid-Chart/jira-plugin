import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import forgeRoutes from './forge.js';

const FORGE = { accountId: 'acc-1', apiBaseUrl: 'https://api.atlassian.com/ex/jira/c1', userToken: 'ut' };
const USER = { id: 'u1', emailAddress: 'someone@example.com' };

// In-memory stand-in for utils/forgeJira.js, recording every call.
function fakeJira({ charts = {}, token = '', failUpload = false, failSaveToken = false } = {}) {
  const calls = [];
  let nextAttachment = 20000;
  const state = { charts: structuredClone(charts), token };
  return {
    calls,
    state,
    fetchUserToken: async (ctx) => {
      calls.push(['fetchUserToken', ctx.accountId]);
      return state.token;
    },
    saveUserToken: async (ctx, t) => {
      calls.push(['saveUserToken', ctx.accountId, t]);
      if (failSaveToken) {
        const err = new Error('save failed');
        err.status = 500;
        throw err;
      }
      state.token = t;
      return t;
    },
    getIssueCharts: async (ctx, issueKey) => {
      calls.push(['getIssueCharts', issueKey]);
      return structuredClone(state.charts[issueKey] ?? []);
    },
    setIssueCharts: async (ctx, issueKey, list) => {
      calls.push(['setIssueCharts', issueKey, structuredClone(list)]);
      state.charts[issueKey] = structuredClone(list);
    },
    addAttachment: async (ctx, issueKey, png) => {
      calls.push(['addAttachment', issueKey, [...png]]);
      if (failUpload) {
        const err = new Error('upload failed');
        err.status = 413;
        throw err;
      }
      const id = String(nextAttachment++);
      return { id, content: `https://site.atlassian.net/rest/api/2/attachment/content/${id}` };
    },
    deleteAttachment: async (ctx, attachmentId) => {
      calls.push(['deleteAttachment', attachmentId]);
      return true;
    },
    base64ToBuffer: (b64) => Buffer.from(b64, 'base64'),
  };
}

function fakeMermaid({ tokens = {}, validToken = 'good' } = {}) {
  const deleted = [];
  return {
    deleted,
    getUser: async (t) => {
      if (t !== validToken) throw new Error('Invalid token to get user info');
      return USER;
    },
    getAuthorizationData: async () => ({ url: 'https://test.mermaid.ai/oauth/authorize?state=s1', state: 's1' }),
    getToken: async (state) => tokens[state] ?? null,
    delToken: async (state) => {
      deleted.push(state);
    },
  };
}

async function startServer({ jira, mermaidAPI, log }) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  forgeRoutes(app, {
    jira,
    mermaidAPI,
    log,
    mcBaseUrl: 'https://test.mermaid.ai',
    requireInvocation: (req, _res, next) => {
      req.forge = { ...FORGE };
      next();
    },
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };
  return { call, close: () => new Promise((r) => server.close(r)) };
}

const chartA = { documentID: 'doc-a', projectID: 'p', major: '0', minor: '1', attachmentId: '10001', diagramUrl: 'u-a', diagramImage: '' };
const chartB = { documentID: 'doc-b', projectID: 'p', major: '0', minor: '2', attachmentId: '10002', diagramUrl: 'u-b', diagramImage: '' };

test('panel-init for a signed-out user on an issue with no diagrams property', async (t) => {
  const jira = fakeJira();
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid() });
  t.after(srv.close);

  const res = await srv.call('/forge/panel-init?issueKey=ABC-1');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    MC_BASE_URL: 'https://test.mermaid.ai',
    mcAccessToken: '',
    loginURL: 'https://test.mermaid.ai/oauth/authorize?state=s1',
    loginState: 's1',
    user: null,
    charts: [],
  });
});

test('panel-init for a signed-in user returns the token, user and charts and no login URL', async (t) => {
  const jira = fakeJira({ token: 'good', charts: { 'ABC-1': [chartA] } });
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid() });
  t.after(srv.close);

  const res = await srv.call('/forge/panel-init?issueKey=ABC-1');
  assert.deepEqual(res.body, {
    MC_BASE_URL: 'https://test.mermaid.ai',
    mcAccessToken: 'good',
    loginURL: '',
    loginState: '',
    user: USER,
    charts: [chartA],
  });
});

test('panel-init treats a stored token Mermaid Chart rejects as signed out', async (t) => {
  const jira = fakeJira({ token: 'expired' });
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid() });
  t.after(srv.close);

  const res = await srv.call('/forge/panel-init?issueKey=ABC-1');
  assert.equal(res.body.mcAccessToken, '');
  assert.equal(res.body.user, null);
  assert.equal(res.body.loginState, 's1');
});

test('panel-init without an issue key is a 400', async (t) => {
  const srv = await startServer({ jira: fakeJira(), mermaidAPI: fakeMermaid() });
  t.after(srv.close);
  assert.equal((await srv.call('/forge/panel-init')).status, 400);
});

test('add-chart uploads the image, stores the chart without it, and returns the charts', async (t) => {
  const jira = fakeJira({ charts: { 'ABC-1': [chartA] } });
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid() });
  t.after(srv.close);

  const res = await srv.call('/forge/add-chart', {
    method: 'POST',
    body: { issueKey: 'ABC-1', replace: false, chart: { documentID: 'doc-new', projectID: 'p', major: '1', minor: '0', diagramImage: 'AQID' } },
  });

  const added = { documentID: 'doc-new', projectID: 'p', major: '1', minor: '0', diagramImage: '', attachmentId: '20000', diagramUrl: 'https://site.atlassian.net/rest/api/2/attachment/content/20000' };
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { charts: [chartA, added] });
  assert.deepEqual(jira.calls.find((c) => c[0] === 'addAttachment'), ['addAttachment', 'ABC-1', [1, 2, 3]]);
  assert.deepEqual(jira.state.charts['ABC-1'], [chartA, added]);
  assert.equal(jira.calls.some((c) => c[0] === 'deleteAttachment'), false);
});

test('add-chart for a diagram already on the issue is a 400 and uploads nothing', async (t) => {
  const jira = fakeJira({ charts: { 'ABC-1': [chartA] } });
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid() });
  t.after(srv.close);

  const res = await srv.call('/forge/add-chart', {
    method: 'POST',
    body: { issueKey: 'ABC-1', replace: false, chart: { ...chartA, diagramImage: 'AQID' } },
  });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { message: 'Chart already added' });
  assert.equal(jira.calls.some((c) => c[0] === 'addAttachment' || c[0] === 'setIssueCharts'), false);
});

test('add-chart with replace swaps the chart in place and deletes the old attachment', async (t) => {
  const jira = fakeJira({ charts: { 'ABC-1': [chartA, chartB] } });
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid() });
  t.after(srv.close);

  const res = await srv.call('/forge/add-chart', {
    method: 'POST',
    body: { issueKey: 'ABC-1', replace: true, chart: { ...chartA, minor: '5', diagramImage: 'AQID' } },
  });
  const replaced = { ...chartA, minor: '5', diagramImage: '', attachmentId: '20000', diagramUrl: 'https://site.atlassian.net/rest/api/2/attachment/content/20000' };
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.charts, [replaced, chartB]);
  assert.deepEqual(jira.state.charts['ABC-1'], [replaced, chartB]);
  // The old attachment goes only after the new list is saved.
  const order = jira.calls.map((c) => c[0]);
  assert.ok(order.indexOf('deleteAttachment') > order.indexOf('setIssueCharts'));
  assert.deepEqual(jira.calls.find((c) => c[0] === 'deleteAttachment'), ['deleteAttachment', '10001']);
});

test('add-chart when the upload fails is a 502 and leaves the diagrams property alone', async (t) => {
  const jira = fakeJira({ charts: { 'ABC-1': [chartA] }, failUpload: true });
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid() });
  t.after(srv.close);

  const res = await srv.call('/forge/add-chart', {
    method: 'POST',
    body: { issueKey: 'ABC-1', replace: false, chart: { documentID: 'doc-new', diagramImage: 'AQID' } },
  });
  assert.equal(res.status, 502);
  assert.equal(jira.calls.some((c) => c[0] === 'setIssueCharts'), false);
  assert.deepEqual(jira.state.charts['ABC-1'], [chartA]);
});

test('add-chart does not overwrite the charts when they cannot be read', async (t) => {
  const jira = fakeJira({ charts: { 'ABC-1': [chartA] } });
  jira.getIssueCharts = async () => {
    const err = new Error('forbidden');
    err.status = 403;
    throw err;
  };
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid() });
  t.after(srv.close);

  const res = await srv.call('/forge/add-chart', {
    method: 'POST',
    body: { issueKey: 'ABC-1', replace: false, chart: { documentID: 'doc-new', diagramImage: 'AQID' } },
  });
  assert.equal(res.status, 502);
  assert.equal(jira.calls.some((c) => c[0] === 'addAttachment' || c[0] === 'setIssueCharts'), false);
});

test('delete-chart removes the chart and its attachment', async (t) => {
  const jira = fakeJira({ charts: { 'ABC-1': [chartA, chartB] } });
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid() });
  t.after(srv.close);

  const res = await srv.call('/forge/delete-chart', { method: 'POST', body: { issueKey: 'ABC-1', documentID: 'doc-a' } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { charts: [chartB] });
  assert.deepEqual(jira.state.charts['ABC-1'], [chartB]);
  assert.deepEqual(jira.calls.find((c) => c[0] === 'deleteAttachment'), ['deleteAttachment', '10001']);
});

test('delete-chart for a chart with no attachment deletes no attachment', async (t) => {
  const { attachmentId, ...noAttachment } = chartA;
  const jira = fakeJira({ charts: { 'ABC-1': [noAttachment] } });
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid() });
  t.after(srv.close);

  const res = await srv.call('/forge/delete-chart', { method: 'POST', body: { issueKey: 'ABC-1', documentID: 'doc-a' } });
  assert.deepEqual(res.body, { charts: [] });
  assert.equal(jira.calls.some((c) => c[0] === 'deleteAttachment'), false);
});

// Attachments created by the Connect version belong to the app user; a user without
// "Delete all attachments" cannot remove them. The chart change must still go through, and the
// leftover attachment must be logged rather than dropped silently.
function recordingLog() {
  const errors = [];
  return { errors, error: (...args) => errors.push(args), info: () => {} };
}

test('replacing a chart whose old attachment cannot be deleted still saves, and logs the leftover', async (t) => {
  const jira = fakeJira({ charts: { 'ABC-1': [chartA] } });
  jira.deleteAttachment = async () => false;
  const log = recordingLog();
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid(), log });
  t.after(srv.close);

  const res = await srv.call('/forge/add-chart', {
    method: 'POST',
    body: { issueKey: 'ABC-1', replace: true, chart: { ...chartA, minor: '5', diagramImage: 'AQID' } },
  });
  assert.equal(res.status, 200);
  assert.equal(jira.state.charts['ABC-1'][0].attachmentId, '20000');
  assert.equal(log.errors.length, 1);
  assert.deepEqual(log.errors[0][0], { issueKey: 'ABC-1', attachmentId: '10001' });
});

test('deleting a chart whose attachment cannot be deleted still removes the chart, and logs the leftover', async (t) => {
  const jira = fakeJira({ charts: { 'ABC-1': [chartA, chartB] } });
  jira.deleteAttachment = async () => false;
  const log = recordingLog();
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid(), log });
  t.after(srv.close);

  const res = await srv.call('/forge/delete-chart', { method: 'POST', body: { issueKey: 'ABC-1', documentID: 'doc-a' } });
  assert.deepEqual(res.body, { charts: [chartB] });
  assert.equal(log.errors.length, 1);
  assert.deepEqual(log.errors[0][0], { issueKey: 'ABC-1', attachmentId: '10001' });
});

test('check_token without a state, or before sign-in finishes, is a 404', async (t) => {
  const srv = await startServer({ jira: fakeJira(), mermaidAPI: fakeMermaid() });
  t.after(srv.close);
  assert.equal((await srv.call('/forge/check_token')).status, 404);
  assert.equal((await srv.call('/forge/check_token?state=s1')).status, 404);
});

test('check_token saves the token on the user and then drops the sign-in state', async (t) => {
  const jira = fakeJira();
  const mermaidAPI = fakeMermaid({ tokens: { s1: 'good' } });
  const srv = await startServer({ jira, mermaidAPI });
  t.after(srv.close);

  const res = await srv.call('/forge/check_token?state=s1');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { token: 'good', user: USER });
  assert.equal(jira.state.token, 'good');
  assert.deepEqual(mermaidAPI.deleted, ['s1']);
});

test('check_token keeps the sign-in state when saving the token fails, so the poll can retry', async (t) => {
  const jira = fakeJira({ failSaveToken: true });
  const mermaidAPI = fakeMermaid({ tokens: { s1: 'good' } });
  const srv = await startServer({ jira, mermaidAPI });
  t.after(srv.close);

  const res = await srv.call('/forge/check_token?state=s1');
  assert.equal(res.status, 503);
  assert.deepEqual(mermaidAPI.deleted, []);
});

test('logout clears the token stored on the user', async (t) => {
  const jira = fakeJira({ token: 'good' });
  const srv = await startServer({ jira, mermaidAPI: fakeMermaid() });
  t.after(srv.close);

  const res = await srv.call('/forge/logout', { method: 'POST' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(jira.state.token, '');
});
