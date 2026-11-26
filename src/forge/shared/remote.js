/**
 * Call the Vercel server through the panel's resolver function (src/index.js).
 * `invoke` is @forge/bridge's invoke; it is passed in so this module runs under plain Node tests.
 * Returns the parsed JSON body on 2xx, otherwise throws an Error with .status and the server message.
 */
export async function remoteInvoke(path, { method = 'GET', body } = {}, invoke) {
  const payload = { path, method };
  if (body !== undefined) {
    payload.body = JSON.stringify(body);
  }
  const result = await invoke('remote', payload);
  const status = result?.status;
  const parsed = parseBody(result?.body);

  if (typeof status !== 'number' || status < 200 || status >= 300) {
    const err = new Error(parsed?.message || parsed?.error || `Remote ${method} ${path} failed (${status})`);
    err.status = status;
    err.body = result?.body;
    throw err;
  }
  return parsed ?? {};
}

function parseBody(body) {
  if (typeof body !== 'string') {
    return body;
  }
  if (!body) {
    return undefined;
  }
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}
