# Mermaid Chart for Jira

Forge app for Jira. It is the same Marketplace app as the old Connect app, not a second app: `app.connect.key` in `manifest.yml` keeps the Connect key (`mermaid-chart-app-for-jira`), so existing installs and saved diagrams carry over.

| Part | Runs on | Does |
| --- | --- | --- |
| Issue panel (`src/forge/panel`) | Forge Custom UI, hosted by Atlassian | Lists the issue's diagrams, Add / Edit / Delete, Connect / Disconnect Mermaid. |
| Dialog (`src/forge/dialog`) | Forge Custom UI, opened as a `Modal` from the panel | Mermaid Chart select or edit page in an iframe, the full-size diagram, or a short alert. |
| Resolver function (`src/index.js`) | Forge | Forwards panel calls to the server. |
| Server (`api/index.js`, `routes/forge.js`) | Vercel, as the Forge Remote `connect` | Mermaid Chart sign-in, reads and writes the issue's diagrams. |

## How it works

- The panel calls the resolver function (`invoke('remote', { path, method, body })`), which forwards to the `connect` remote with `invokeRemote` from `@forge/api`. A call from the browser straight to the remote would carry the whole module context in its token header, which Vercel refuses as too large (494).
- Forge signs every call with a Forge Invocation Token (FIT). The server verifies it (`utils/forgeAuth.js`, audience = `app.id`) and, because `remotes[connect].auth.appUserToken` is enabled, calls Jira as the user with the token in `x-forge-oauth-user`.
- Data stays where the Connect version kept it:
  - issue property `diagrams`: the issue's charts (a JSON string holding `{"value":[...]}`),
  - one PNG attachment per chart (`attachmentId`),
  - user property `token`: the user's Mermaid Chart token (`{"value":{"token":"..."}}`),
  - Redis: short-lived sign-in state only.
- Sign-in: the Custom UI sandbox blocks popups, so the panel opens the Mermaid Chart login with `router.open` and polls `/forge/check_token`. Mermaid Chart redirects to `<server>/callback`, which must be a redirect URI of the Jira OAuth client in collab (`src/lib/oauth.ts`).
- Thumbnails are loaded with `requestJira` (the Custom UI iframe does not carry the Jira session cookie).

## Environment (Vercel)

See `.env.example`.

- `MC_BASE_URL`: a `mermaid.ai` host (`https://test.mermaid.ai`, `https://mermaid.ai`), not `www.mermaid.ai` and not `mermaidchart.com`, whose routes redirect.
- `LOCAL_BASE_URL`: public URL of this server (the OAuth redirect is `<LOCAL_BASE_URL>/callback`).
- `MC_CLIENT_ID`: the Jira OAuth client id.
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `DB_URL` / `DB_TOKEN`): Upstash Redis for sign-in state.

## Commands

```
npm install
npm test               # unit tests (node:test)
npm run build          # builds static/panel and static/dialog
npm run build:forge    # build, then forge lint
```

## What deploys where

| Change | Deploy |
| --- | --- |
| `api/`, `routes/`, `utils/` | Vercel |
| `src/`, `manifest.yml` | `npm run build:forge`, then `forge deploy` |

Deploy the server first, then the Forge app. Check on the Forge **development** environment before staging or production:

```
npm run build:forge
forge deploy -e development
forge install --upgrade -e development -p jira -s <site>.atlassian.net
```

A scope or egress change makes a major version: site admins approve it on the next upgrade.

## Local development

Use your own Forge app for local testing. Locally, and never committed, point `manifest.yml` at it: your `app.id`, your tunnel domain as `remotes[connect].baseUrl`, and your local Mermaid Chart host in `permissions.external.frames`. Set the same app id as `APP_ID` in `utils/forgeAuth.js` and `LOCAL_BASE_URL` in `.env`. Start the server with `npm start`.

## Diagram selection page (collab)

The Mermaid Chart pages shown in the dialog load `public/js/plugin.js` and post the chosen diagram to the parent window with `window.CP.saveData(data)`. See [`example/index.html`](example/index.html).
