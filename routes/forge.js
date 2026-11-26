import * as forgeJira from '../utils/forgeJira.js';
import { requireForgeInvocation } from '../utils/forgeAuth.js';

const TRACKING = {
  utm_source: 'mermaid_chart_jira_plugin',
  utm_medium: 'jira',
  utm_campaign: 'jira_plugin',
};

/**
 * Forge Remote routes, called from the issue panel through the resolver function (src/index.js).
 * These replace the Connect routes /issue-content, /check_token, /logout, /add-chart and /delete-chart.
 */
export default function forgeRoutes(
  app,
  { mermaidAPI, jira = forgeJira, requireInvocation = requireForgeInvocation, mcBaseUrl, log = console },
) {
  // Attachments the Connect version created belong to the app user, and Jira only lets a user
  // delete them with "Delete all attachments". The chart change stands either way; log the leftover.
  const removeAttachment = async (forge, issueKey, attachmentId) => {
    if (!(await jira.deleteAttachment(forge, attachmentId))) {
      log.error({ issueKey, attachmentId }, 'attachment left on issue: delete was refused');
    }
  };

  // Everything the panel needs to render: the issue's charts and the user's sign-in state.
  app.get('/forge/panel-init', requireInvocation, async (req, res) => {
    const issueKey = String(req.query.issueKey ?? '');
    if (!issueKey) {
      return res.status(400).json({ error: 'Missing issueKey' });
    }
    try {
      let accessToken = '';
      let user = null;
      try {
        accessToken = await jira.fetchUserToken(req.forge);
        user = accessToken ? await mermaidAPI.getUser(accessToken) : null;
      } catch (e) {
        log.error({ err: e.message }, 'panel-init: stored token check failed');
        accessToken = '';
        user = null;
      }

      let charts = [];
      try {
        charts = await jira.getIssueCharts(req.forge, issueKey);
      } catch (e) {
        log.error({ err: e.message, status: e.status }, 'panel-init: reading charts failed');
      }

      const auth = user ? {} : await mermaidAPI.getAuthorizationData({ trackingParams: TRACKING });

      return res.json({
        MC_BASE_URL: mcBaseUrl,
        mcAccessToken: user ? accessToken : '',
        loginURL: auth.url || '',
        loginState: auth.state || '',
        user,
        charts,
      });
    } catch (e) {
      log.error({ err: e.message }, 'panel-init failed');
      return res.status(500).json({ error: 'panel-init failed' });
    }
  });

  app.get('/forge/check_token', requireInvocation, async (req, res) => {
    try {
      const state = req.query.state;
      if (!state) {
        return res.status(404).json({ error: 'Missing state' });
      }
      const token = await mermaidAPI.getToken(state);
      if (!token) {
        return res.status(404).json({ error: 'Token not ready' });
      }
      const user = await mermaidAPI.getUser(token);
      try {
        await jira.saveUserToken(req.forge, token);
      } catch (e) {
        log.error({ err: e.message, status: e.status }, 'check_token: saving token failed');
        return res.status(503).json({ error: 'Failed to save token' });
      }
      // Drop the sign-in state only once the token is saved, so a failed save can be retried.
      await mermaidAPI.delToken(state);
      return res.json({ token, user });
    } catch (e) {
      log.error({ err: e.message }, 'check_token failed');
      return res.status(500).json({ error: 'check_token failed' });
    }
  });

  app.post('/forge/logout', requireInvocation, async (req, res) => {
    try {
      await jira.saveUserToken(req.forge, '');
      return res.json({ ok: true });
    } catch (e) {
      log.error({ err: e.message, status: e.status }, 'logout failed');
      return res.status(500).json({ error: 'logout failed' });
    }
  });

  app.post('/forge/add-chart', requireInvocation, async (req, res) => {
    const { issueKey, chart, replace } = req.body ?? {};
    if (!issueKey || !chart?.documentID) {
      return res.status(400).json({ message: 'Missing issueKey or chart' });
    }

    let charts;
    try {
      charts = await jira.getIssueCharts(req.forge, issueKey);
    } catch (e) {
      // Never write a list we could not read: that would drop the issue's other charts.
      log.error({ err: e.message, status: e.status }, 'add-chart: reading charts failed');
      return res.status(502).json({ message: 'Could not read the diagrams on this issue' });
    }

    const index = charts.findIndex((c) => c.documentID === chart.documentID);
    if (index !== -1 && !replace) {
      return res.status(400).json({ message: 'Chart already added' });
    }

    let attachment;
    try {
      attachment = await jira.addAttachment(req.forge, issueKey, jira.base64ToBuffer(chart.diagramImage ?? ''));
    } catch (e) {
      log.error({ err: e.message, status: e.status }, 'add-chart: upload failed');
      return res.status(502).json({ message: 'Could not attach the diagram image' });
    }

    const saved = { ...chart, diagramImage: '', attachmentId: attachment.id, diagramUrl: attachment.content };
    const oldAttachmentId = index !== -1 ? charts[index].attachmentId : undefined;
    if (index !== -1) {
      charts[index] = saved;
    } else {
      charts.push(saved);
    }

    try {
      await jira.setIssueCharts(req.forge, issueKey, charts);
    } catch (e) {
      log.error({ err: e.message, status: e.status }, 'add-chart: saving charts failed');
      await jira.deleteAttachment(req.forge, attachment.id);
      return res.status(502).json({ message: 'Could not save the diagram on this issue' });
    }

    if (oldAttachmentId) {
      await removeAttachment(req.forge, issueKey, oldAttachmentId);
    }
    return res.json({ charts });
  });

  app.post('/forge/delete-chart', requireInvocation, async (req, res) => {
    const { issueKey, documentID } = req.body ?? {};
    if (!issueKey || !documentID) {
      return res.status(400).json({ message: 'Missing issueKey or documentID' });
    }
    try {
      const charts = await jira.getIssueCharts(req.forge, issueKey);
      const index = charts.findIndex((c) => c.documentID === documentID);
      let attachmentId;
      if (index !== -1) {
        attachmentId = charts[index].attachmentId;
        charts.splice(index, 1);
      }
      await jira.setIssueCharts(req.forge, issueKey, charts);
      if (attachmentId) {
        await removeAttachment(req.forge, issueKey, attachmentId);
      }
      return res.json({ charts });
    } catch (e) {
      log.error({ err: e.message, status: e.status }, 'delete-chart failed');
      return res.status(502).json({ message: 'Could not delete the diagram' });
    }
  });
}
