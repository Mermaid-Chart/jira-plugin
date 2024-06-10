import {
  fetchToken,
  saveToken,
  getJiraIssueProperty,
  setJiraIssueProperty,
} from "../utils/index.js";
import { MermaidChart } from "../utils/MermaidChart.js";
import log from "../utils/logger.js";

const MC_BASE_URL = process.env.MC_BASE_URL || "https://test.mermaidchart.com";
const MC_CLIENT_ID =
  process.env.MC_CLIENT_ID || "6643413f-36fe-41f5-83b6-18674ec599f0";

const diagramsPropertyName = "diagrams";

export default function routes(app, addon) {
  const mermaidAPI = new MermaidChart({
    baseURL: MC_BASE_URL,
    clientID: MC_CLIENT_ID,
    redirectURI: `${addon.config.localBaseUrl()}/callback`,
    addon,
  });

  app.get("/", (req, res) => {
    res.redirect("/atlassian-connect.json");
  });

  app.get("/viewer", addon.authenticate(), (req, res) => {
    res.render("viewer.hbs");
  });

  app.get("/issue-content", addon.authenticate(), async (req, res) => {
    const issueKey = req.query.issueKey;
    let charts;

    try {
      charts = await getJiraIssueProperty(
        req.context.http,
        issueKey,
        diagramsPropertyName
      );

      log.info("issue-content getJiraIssueProperty");
      log.info(charts);
    } catch (e) {
      //console.log(e);
      log.error("error_charts: ", e);
    }

    let access_token, user, error;
    try {
      access_token = await fetchToken(
        req.context.http,
        req.context.userAccountId
      );

      log.info(`Token ${access_token}`);

      user = access_token ? await mermaidAPI.getUser(access_token) : undefined;
    } catch (e) {
      //console.log(e);
      log.error("issue-content fetchToken error: ");
      log.error(e);
    }

    const auth = user ? {} : await mermaidAPI.getAuthorizationData();
    // const auth = { url: "", state: "" };

    log.info("issue-content issue auth: ", auth);

    res.render("issue-content.hbs", {
      issueKey,
      charts: charts ? JSON.stringify(charts) : "[]",
      MC_BASE_URL: MC_BASE_URL,
      loginURL: auth.url,
      loginState: auth.state,
      mcAccessToken: user ? access_token : "",
      user: user ? JSON.stringify(user) : "null",
      other: JSON.stringify({}),
    });
  });

  app.get("/editor", addon.authenticate(), async (req, res) => {
    res.render("editor.hbs", {
      MC_BASE_URL: MC_BASE_URL,
    });
  });

  app.get("/select", addon.authenticate(), async (req, res) => {
    res.render("select.hbs", {
      MC_BASE_URL: MC_BASE_URL,
    });
  });

  app.get("/check_token", addon.checkValidToken(), async (req, res) => {
    if (!req.query.state) {
      log.error("check_token no req.query.state: ", req.query);
      return res.status(404).end();
    }
    const token = await mermaidAPI.getToken(req.query.state);
    if (!token) {
      log.error("check_token no token: ", req.query);
      return res.status(404).end();
    }
    await mermaidAPI.delToken(req.query.state);

    const user = await mermaidAPI.getUser(token);
    try {
      await saveToken(req.context.http, req.context.userAccountId, token);
      return res.json({ token, user }).end();
    } catch (e) {
      //console.error(e);
      log.error("check_token error: ", e);
      res.status(503).end();
    }
  });

  app.post("/logout", addon.checkValidToken(), async (req, res) => {
    await saveToken(req.context.http, req.context.userAccountId, "");
    res.end();
  });

  app.get("/callback", async (req, res) => {
    let errorMessage;
    try {
      await mermaidAPI.handleAuthorizationResponse(req.query);
    } catch (e) {
      errorMessage = e.message;
    }

    res.render("authCallback.hbs", {
      errorMessage,
    });
  });

  app.post("/add-chart", addon.checkValidToken(), async (req, res) => {
    log.info("add-chart begin:");
    log.info(req.body);
    const issueKey = req.body.issueKey;

    let charts;
    try {
      charts = await getJiraIssueProperty(
        req.context.http,
        issueKey,
        diagramsPropertyName
      );
    } catch (e) {
      charts = [];
      console.log(e);
    }

    if (req.body.chart) charts.push(req.body.chart);

    log.info("Add chart charts:");
    log.info(charts);

    try {
      charts = await setJiraIssueProperty(
        req.context.http,
        issueKey,
        diagramsPropertyName,
        charts
      );
    } catch (e) {
      charts = [];
      log.error("add-chart set charts error:");
      log.error(e);
    }

    return res.json({ charts }).end();
  });

  app.post("/delete-chart", addon.checkValidToken(), async (req, res) => {
    const chartId = req.body.documentID;
    const issueKey = req.body.issueKey;
    const charts = await getJiraIssueProperty(
      req.context.http,
      issueKey,
      diagramsPropertyName
    );

    const index = charts.findIndex((i) => i.documentID > chartId);
    if (index) charts.splice(index, 1);

    let charts_upated = await setJiraIssueProperty(
      req.context.http,
      issueKey,
      diagramsPropertyName,
      charts
    );

    return res.json({ charts: charts_upated }).end();
  });
}
