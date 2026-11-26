import * as jose from 'jose';

// Must match app.id in manifest.yml (utils/forgeAuth.test.js checks this).
export const APP_ID = 'ari:cloud:ecosystem::app/b4c24b0d-2782-4ef2-8f9c-60fae57db5b3';
const JWKS_URL = 'https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json';

/**
 * Express middleware that verifies the Forge Invocation Token and attaches the forge context
 * on the request. 401 is reserved for FIT failures. `keys` is a jose key or key set.
 */
export function createForgeInvocationGuard({ keys, audience = APP_ID }) {
  return async function requireForgeInvocation(req, res, next) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'Missing Forge Invocation Token' });
    }

    try {
      const { payload } = await jose.jwtVerify(match[1], keys, {
        audience,
        issuer: 'forge/invocation-token',
      });

      // Calls from the resolver function (src/index.js) name the user in a header instead.
      const accountId = payload.principal || req.headers['x-forge-account-id'];
      const apiBaseUrl = payload.app?.apiBaseUrl;
      const userToken = req.headers['x-forge-oauth-user'];

      if (!accountId || !apiBaseUrl) {
        return res.status(401).json({ error: 'FIT missing principal or apiBaseUrl' });
      }
      if (!userToken) {
        return res.status(401).json({ error: 'Missing x-forge-oauth-user' });
      }

      req.forge = { accountId, apiBaseUrl, userToken, payload };
      return next();
    } catch (err) {
      console.error({ err: err.message }, 'FIT verification failed');
      return res.status(401).json({ error: 'Invalid Forge Invocation Token' });
    }
  };
}

export const requireForgeInvocation = createForgeInvocationGuard({
  keys: jose.createRemoteJWKSet(new URL(JWKS_URL)),
});
