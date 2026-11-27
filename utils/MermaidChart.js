import { createHash, randomUUID } from 'node:crypto';
import { mcFetch } from './mcFetch.js';

const defaultBaseURL = 'https://test.mermaid.ai';

const CLIENT_KEY = 'all';

// Cleanup timers must not keep a process (tests, local server shutdown) alive.
const later = (fn, ms) => setTimeout(fn, ms).unref?.();

class MermaidChart {
  store;
  clientID;
  baseURL;
  redirectURI;
  fetchImpl;
  URLS = {
    oauth: {
      authorize: (params) => `/oauth/authorize?${new URLSearchParams(Object.entries(params)).toString()}`,
      token: `/oauth/token`,
    },
    rest: {
      users: {
        self: `/rest-api/users/me`,
      },
    },
  };

  constructor({ clientID, baseURL, redirectURI, store, fetchImpl = fetch }) {
    this.store = store;
    this.clientID = clientID;
    this.fetchImpl = fetchImpl;
    this.setBaseURL(baseURL || defaultBaseURL);
    if (redirectURI) {
      this.setRedirectURI(redirectURI);
    }
  }

  setRedirectURI(redirectURI) {
    this.redirectURI = redirectURI;
  }

  setBaseURL(baseURL = defaultBaseURL) {
    this.baseURL = baseURL;
  }

  async getAuthorizationData({ state, scope, trackingParams } = {}) {
    if (!this.redirectURI) {
      throw new Error('redirectURI is not set');
    }

    const stateID = state ?? randomUUID();
    const codeVerifier = randomUUID();

    await this.setCodeVerifier(stateID, codeVerifier);

    const params = {
      client_id: this.clientID,
      redirect_uri: this.redirectURI,
      response_type: 'code',
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
      state: stateID,
      scope: scope ?? 'email',
      utm_source: trackingParams?.utm_source || 'mermaid_chart_jira_plugin',
      utm_medium: trackingParams?.utm_medium || 'jira',
      utm_campaign: trackingParams?.utm_campaign || 'jira_plugin',
    };

    later(async () => {
      await this.delCodeVerifier(stateID);
    }, 5 * 60 * 1000);

    return {
      url: `${this.baseURL}${this.URLS.oauth.authorize(params)}`,
      state: stateID,
      scope: params.scope,
    };
  }

  async handleAuthorizationResponse(query) {
    const authorizationToken = query.code;
    const state = query.state;

    if (!authorizationToken) {
      throw new RequiredParameterMissingError('token');
    }
    if (!state) {
      throw new RequiredParameterMissingError('state');
    }

    const codeVerifier = await this.getCodeVerifier(state);
    // Check that this server started the sign-in.
    if (!codeVerifier) {
      throw new OAuthError('invalid_state');
    }

    // Through mcFetch: a mermaidchart.com MC_BASE_URL redirects to mermaid.ai, and a plain fetch
    // would turn the POST into a GET there and lose the code.
    const tokenResponse = await mcFetch(
      this.baseURL + this.URLS.oauth.token,
      {
        method: 'post',
        body: JSON.stringify({
          client_id: this.clientID,
          redirect_uri: this.redirectURI,
          code_verifier: codeVerifier,
          code: authorizationToken,
        }),
        headers: {
          'Content-type': 'application/json',
        },
      },
      this.fetchImpl,
    );

    if (!tokenResponse.ok) {
      throw new OAuthError(`invalid_token ${tokenResponse.status} ${tokenResponse.statusText}`);
    }

    await this.setToken(state, (await tokenResponse.json()).access_token);
    later(async () => {
      await this.delToken(state);
    }, 30 * 60 * 1000);
  }

  async getUser(accessToken) {
    const response = await mcFetch(
      `${this.baseURL}${this.URLS.rest.users.self}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      this.fetchImpl,
    );
    if (!response.ok) {
      throw new OAuthError('Invalid token to get user info');
    }
    return await response.json();
  }

  async getCodeVerifier(state) {
    return await this.store.get(`state:${state}:code`, CLIENT_KEY);
  }

  async setCodeVerifier(state, code) {
    return await this.store.set(`state:${state}:code`, code, CLIENT_KEY);
  }

  async delCodeVerifier(state) {
    return await this.store.del(`state:${state}:code`, CLIENT_KEY);
  }

  async getToken(state) {
    return await this.store.get(`state:${state}:token`, CLIENT_KEY);
  }

  async setToken(state, code) {
    return await this.store.set(`state:${state}:token`, code, CLIENT_KEY);
  }

  async delToken(state) {
    return await this.store.del(`state:${state}:token`, CLIENT_KEY);
  }
}

class RequiredParameterMissingError extends Error {
  constructor(parameterName) {
    super(`Required parameter ${parameterName} is missing`);
  }
}

class OAuthError extends Error {
  constructor(message) {
    super(message);
  }
}

export { MermaidChart };
