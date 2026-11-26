import { invokeRemote as forgeInvokeRemote } from '@forge/api';
import resolverModule from '@forge/resolver';

// @forge/resolver is CommonJS; under "type": "module" the default import is its exports object.
const Resolver = resolverModule.default ?? resolverModule;

const ORIGIN = 'https://remote.invalid';

// Only the server's /forge/* routes may be called from the browser.
function isForgeRoute(path) {
  if (typeof path !== 'string' || !path.startsWith('/forge/')) {
    return false;
  }
  const url = new URL(path, ORIGIN);
  return url.origin === ORIGIN && url.pathname.startsWith('/forge/');
}

/**
 * Forward a call from the Custom UI to the `connect` remote (the Vercel server).
 *
 * Calls from the browser straight to the remote carry the whole module context in their token
 * header, which Vercel refuses as too large (494). Calls from this function carry only the app
 * context, so the user is named in x-forge-account-id instead (never sent as undefined).
 */
export async function forwardToRemote({ payload, context }, invokeRemote = forgeInvokeRemote) {
  const { path, method = 'GET', body } = payload ?? {};
  if (!isForgeRoute(path)) {
    return { status: 400, body: JSON.stringify({ error: 'Unsupported path' }) };
  }

  const headers = context?.accountId ? { 'x-forge-account-id': context.accountId } : {};
  const options = { path, method, headers };
  if (body !== undefined) {
    options.body = body;
    headers['Content-Type'] = 'application/json';
  }

  const response = await invokeRemote('connect', options);
  return { status: response.status, body: await response.text() };
}

const resolver = new Resolver();
resolver.define('remote', (request) => forwardToRemote(request));

export const handler = resolver.getDefinitions();
