/**
 * Jira REST calls made as the signed-in user, with the Forge app user token (x-forge-oauth-user).
 *
 * The data formats are the ones the Connect version wrote, kept so existing issues and users
 * still read correctly:
 * - issue property `diagrams`: a JSON *string* holding `{"value":[...charts]}` (the Connect server
 *   sent an already-stringified body with `json: true`, so Jira stored a string).
 * - user property `token`: `{"value":{"token":"..."}}`.
 */

const DIAGRAMS_PROPERTY = 'diagrams';
const TOKEN_PROPERTY = 'token';

function jiraError(message, status) {
  const err = new Error(`${message} (${status})`);
  err.status = status;
  return err;
}

function authHeaders(userToken, extra = {}) {
  return { Accept: 'application/json', Authorization: `Bearer ${userToken}`, ...extra };
}

export function parseChartsProperty(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value;
  }
  return Array.isArray(value?.value) ? value.value : [];
}

export function serializeChartsProperty(charts) {
  return JSON.stringify({ value: charts });
}

const issuePropertyUrl = (apiBaseUrl, issueKey) =>
  `${apiBaseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/properties/${DIAGRAMS_PROPERTY}`;

const userPropertyUrl = (apiBaseUrl, accountId) =>
  `${apiBaseUrl}/rest/api/2/user/properties/${TOKEN_PROPERTY}?accountId=${encodeURIComponent(accountId)}`;

export async function getIssueCharts({ apiBaseUrl, userToken }, issueKey, fetchImpl = fetch) {
  const res = await fetchImpl(issuePropertyUrl(apiBaseUrl, issueKey), {
    headers: authHeaders(userToken),
  });
  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    throw jiraError('Failed to read issue property diagrams', res.status);
  }
  const body = await res.json();
  return parseChartsProperty(body.value);
}

export async function setIssueCharts({ apiBaseUrl, userToken }, issueKey, charts, fetchImpl = fetch) {
  const res = await fetchImpl(issuePropertyUrl(apiBaseUrl, issueKey), {
    method: 'PUT',
    headers: authHeaders(userToken, { 'Content-Type': 'application/json' }),
    // Stringify twice so Jira stores the same JSON string the Connect version stored.
    body: JSON.stringify(serializeChartsProperty(charts)),
  });
  if (!res.ok) {
    throw jiraError('Failed to save issue property diagrams', res.status);
  }
}

export async function fetchUserToken({ apiBaseUrl, accountId, userToken }, fetchImpl = fetch) {
  const res = await fetchImpl(userPropertyUrl(apiBaseUrl, accountId), {
    headers: authHeaders(userToken),
  });
  if (res.status === 404) {
    return '';
  }
  if (!res.ok) {
    throw jiraError('Failed to read user property token', res.status);
  }
  const body = await res.json();
  return body.value?.value?.token || '';
}

export async function saveUserToken({ apiBaseUrl, accountId, userToken }, token, fetchImpl = fetch) {
  const request = (method) =>
    fetchImpl(userPropertyUrl(apiBaseUrl, accountId), {
      method,
      headers: authHeaders(userToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ value: { token } }),
    });

  const putRes = await request('PUT');
  if (putRes.ok) {
    return token;
  }
  const postRes = await request('POST');
  if (postRes.ok) {
    return token;
  }
  throw jiraError('Failed to save user property token', postRes.status);
}

export async function addAttachment({ apiBaseUrl, userToken }, issueKey, png, fetchImpl = fetch) {
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), `${issueKey}-attachment.png`);

  const res = await fetchImpl(`${apiBaseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/attachments`, {
    method: 'POST',
    headers: authHeaders(userToken, { 'X-Atlassian-Token': 'no-check' }),
    body: form,
  });
  if (!res.ok) {
    throw jiraError('Failed to add attachment', res.status);
  }
  const [attachment] = await res.json();
  return { id: attachment.id, content: attachment.content };
}

export async function deleteAttachment({ apiBaseUrl, userToken }, attachmentId, fetchImpl = fetch) {
  const res = await fetchImpl(`${apiBaseUrl}/rest/api/2/attachment/${encodeURIComponent(attachmentId)}`, {
    method: 'DELETE',
    headers: authHeaders(userToken, { 'X-Atlassian-Token': 'no-check' }),
  });
  return res.ok;
}

export function base64ToBuffer(b64) {
  return Buffer.from(b64, 'base64');
}
