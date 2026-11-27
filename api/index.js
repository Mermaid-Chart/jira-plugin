// Entry point for the Vercel server, which Forge calls as the `connect` remote (see manifest.yml).
import express from 'express';
import compression from 'compression';
import errorHandler from 'errorhandler';
import morgan from 'morgan';
import path from 'path';
import helmet from 'helmet';
import nocache from 'nocache';

import { MermaidChart } from '../utils/MermaidChart.js';
import { createRedisStore } from '../utils/redisStore.js';
import log from '../utils/logger.js';
import forgeRoutes from '../routes/forge.js';

const MC_BASE_URL = process.env.MC_BASE_URL || 'https://collab-git-temp-confluence-testing-mc-prod.vercel.app';
// Mermaid Chart redirects here after sign-in; must be one of the Jira client's redirect URIs in collab.
const LOCAL_BASE_URL = process.env.LOCAL_BASE_URL || 'https://jira-mermaid-chart-plugin-git-plug-162-jira-move-0c9df4-mc-prod.vercel.app';
const PORT = process.env.PORT || 3000;

const app = express();
app.set('port', PORT);

export const devEnv = app.get('env') === 'development';
app.use(morgan(devEnv ? 'dev' : 'combined'));

// Atlassian security requirements: HSTS for at least a year, origin-only referrer.
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: false }));
app.use(helmet.referrerPolicy({ policy: ['origin'] }));

// add-chart carries the diagram PNG as base64. Vercel caps request bodies at about 4.5 MB.
app.use(express.json({ limit: '5mb' }));
app.use(compression());
app.use(nocache());

// plugin.js and icons stay available at their old URLs.
app.use(express.static(path.join(process.cwd(), 'public')));

if (devEnv) {
  app.use(errorHandler());
}

const mermaidAPI = new MermaidChart({
  baseURL: MC_BASE_URL,
  clientID: process.env.MC_CLIENT_ID || '6643413f-36fe-41f5-83b6-18674ec599f0',
  redirectURI: `${LOCAL_BASE_URL}/callback`,
  store: createRedisStore(),
});

forgeRoutes(app, { mermaidAPI, mcBaseUrl: MC_BASE_URL, log });

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const page = (content) =>
  `<!doctype html><html><body style="display:flex;height:100%;align-items:center;justify-content:center;font-size:24px;font-family:sans-serif">${content}</body></html>`;

// Mermaid Chart sign-in redirect. The tab was opened with router.open; the panel polls /forge/check_token.
app.get('/callback', async (req, res) => {
  try {
    await mermaidAPI.handleAuthorizationResponse(req.query);
  } catch (e) {
    res
      .status(400)
      .type('html')
      .send(page(`Authentication failed.<br/>${escapeHtml(e.message)}<br/>Please try again later`));
    return;
  }
  res.type('html').send(page('Redirecting...<script>window.close();</script>'));
});

app.get('/', (_req, res) => {
  res.json({ ok: true, app: 'mermaid-chart-for-jira' });
});

export default app;
