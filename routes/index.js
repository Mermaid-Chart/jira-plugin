import {
  fetchToken,
  saveToken,
  getJiraIssueProperty,
  setJiraIssueProperty,
} from "../utils/index.js";
import { MermaidChart } from "../utils/MermaidChart.js";

const MC_BASE_URL = process.env.MC_BASE_URL || "https://test.mermaidchart.com";
const MC_CLIENT_ID =
  process.env.MC_CLIENT_ID || "6643413f-36fe-41f5-83b6-18674ec599f0";

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
    let charts, error_charts;

    try {
      charts = await getJiraIssueProperty(req, req.query.issueKey, "diagrams");
    } catch (e) {
      console.log(e);
      error_charts = e;
    }

    let access_token, user, error;
    try {
      access_token = await fetchToken(
        req.context.http,
        req.context.userAccountId
      );
      user = access_token ? await mermaidAPI.getUser(access_token) : undefined;
    } catch (e) {
      console.log(e);
      error = e;
    }

    const auth = user ? {} : await mermaidAPI.getAuthorizationData();
    // const auth = { url: "", state: "" };

    console.log("issue auth");
    console.log(auth);

    res.render("issue-content.hbs", {
      issueKey,
      charts: charts ? JSON.stringify(charts) : "[]",
      MC_BASE_URL: MC_BASE_URL,
      loginURL: auth.url,
      loginState: auth.state,
      mcAccessToken: user ? access_token : "",
      user: user ? JSON.stringify(user) : "null",
      other: JSON.stringify({
        http: req.context.http,
        userAccountId: req.context.userAccountId,
        error,
        error_charts,
      }),
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
      return res.status(404).end();
    }
    const token = await mermaidAPI.getToken(req.query.state);
    if (!token) {
      return res.status(404).end();
    }
    await mermaidAPI.delToken(req.query.state);

    const user = await mermaidAPI.getUser(token);
    console.log("save token ");
    console.log(req.context.http);
    console.log(req.context.userAccountId);
    console.log(token);
    console.log(user);
    try {
      await saveToken(req.context.http, req.context.userAccountId, token);
      return res.json({ token, user }).end();
    } catch (e) {
      console.error(e);
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
    let charts, error_get_charts, error_set_charts, error_push_charts;
    let result;
    try {
      charts = await getJiraIssueProperty(req, req.query.issueKey, "diagrams");
    } catch (e) {
      charts = [];
      console.log(e);
      error_get_charts = e;
    }
    try {
      charts.push(res.chart);
    } catch (e) {
      error_push_charts = e;
    }
    try {
      result = await setJiraIssueProperty(
        req,
        req.query.issueKey,
        "diagrams",
        charts
      );
    } catch (e) {
      charts = [];
      console.log(e);
      error_set_charts = e;
    }

    return res
      .json({
        result,
        charts,
        chart: res.chart,
        error_get_charts,
        error_set_charts,
        error_push_charts,
      })
      .end();
  });

  app.post("/delete-chart", addon.checkValidToken(), async (req, res) => {
    const charts = await getJiraIssueProperty(
      req,
      req.query.issueKey,
      "diagrams"
    );

    const chart = res.chart;
    const index = charts.findIndex((i) => i.documentID > chart.documentID);
    if (index) charts.splice(index, 1);

    let result = await setJiraIssueProperty(
      req,
      req.query.issueKey,
      "diagrams",
      charts
    );

    return res.json({ result }).end();
  });
}
