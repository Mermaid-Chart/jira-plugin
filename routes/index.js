import {
  fetchToken,
  saveToken,
  getJiraIssueProperty,
  setJiraIssueProperty,
  setJiraIssueAttachment,
  base64ToArrayBuffer,
  getJiraIssueAttachment,
  deleteJiraIssueAttachment,
} from "../utils/index.js";
import { MermaidChart } from "../utils/MermaidChart.js";
import log from "../utils/logger.js";
import logger from "../utils/logger.js";

const MC_BASE_URL = process.env.MC_BASE_URL;
const MC_CLIENT_ID = process.env.MC_CLIENT_ID;

const diagramsPropertyName = "diagrams";
//const diagramsPropertyName = "mermaid-charts-diagrams";

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

    try {
      charts = await getJiraIssueProperty(
        req.context.http,
        issueKey,
        diagramsPropertyName
      );

      log.info("issue-content getJiraIssueProperty");
      log.info(charts);
    } catch (e) {
      charts = [];
      //console.log(e);
      log.error("error_charts: ", e);
    }

    try {
      for (let index = 0; index < charts.length; ++index) {
        const chart = charts[index];
        // chart.diagramImage = await mermaidAPI.getDocumentAsPng(
        //   chart,
        //   access_token
        // );

        chart.diagramUrl = mermaidAPI.getDocumentAsPngUrl(chart);
      }
    } catch (e) {
      log.error("error getting pngs: ", e);
    }

    const auth = user ? {} : await mermaidAPI.getAuthorizationData();
    // const auth = { url: "", state: "" };
    // log.info("issue-content issue auth: ", auth);

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

    const data = req.body;
    const issueKey = data.issueKey;
    const chart = data.chart;
    const isReplace = data.replace;

    let charts;
    try {
      charts = await getJiraIssueProperty(
        req.context.http,
        issueKey,
        diagramsPropertyName
      );
    } catch (e) {
      charts = [];
      log.error(e);
    }

    let index = charts.findIndex((i) => i.documentID === chart.documentID);
    if (index != -1) {
      log.info(`chart alreadey added: ${chart.documentID}`);
      return res.status(400).json({ message: "Chart already added" }).end();
    }

    if (chart.attachmentId && isReplace) {
      // const attachment = await getJiraIssueAttachment(
      //   req.context.http,
      //   issueKey,
      //   chart.attachmentId
      // );

      await deleteJiraIssueAttachment(
        req.context.http,
        issueKey,
        chart.attachmentId
      );
    }

    const attachmentInfo = (
      await setJiraIssueAttachment(
        req.context.http,
        issueKey,
        base64ToArrayBuffer(chart.diagramImage)
      )
    )[0];

    chart.diagramImage = "";
    chart.attachmentId = attachmentInfo.id;
    chart.diagramUrl = attachmentInfo.content;

    log.info("attachmentInfo");
    log.info(attachmentInfo);

    if (isReplace && index > -1) {
      charts[index] = chart;
    } else if (index != -1) {
      log.info(`chart alreadey added: ${chart.documentID}`);
      return res.status(400).json({ message: "Chart already added" }).end();
    } else {
      charts.push(chart);
    }

    log.info("Add chart charts:");
    log.info(charts);

    let charts_updated = await setJiraIssueProperty(
      req.context.http,
      issueKey,
      diagramsPropertyName,
      charts
    );

    log.info("add-chart charts_updated");
    log.info(charts_updated);

    res.status(200).json({ charts }).end();
  });

  app.post("/delete-chart", addon.checkValidToken(), async (req, res) => {
    log.info("delete-chart begin:");
    log.info(req.body);

    const data = req.body; //JSON.parse(req.body);
    const chartId = data.documentID;
    const issueKey = data.issueKey;

    log.info("delete-chart chartId:");
    log.info(chartId);
    log.info(issueKey);

    // return res.status(200).json({ chartId: chartId, issueKey: issueKey }).end();
    let charts;
    try {
      charts = await getJiraIssueProperty(
        req.context.http,
        issueKey,
        diagramsPropertyName
      );
    } catch (e) {
      charts = [];
      log.error("Failed to get charts: ", e);
    }

    // return res.status(200).json({ chartId, issueKey }).end();
    let index = charts.findIndex((i) => i.documentID === chartId);
    log.info("delete-chart index: ");
    log.info(index);
    if (index != -1) charts.splice(index, 1);

    try {
      let charts_updated = await setJiraIssueProperty(
        req.context.http,
        issueKey,
        diagramsPropertyName,
        charts
      );

      log.info("delete-chart charts_updated");
      log.info(charts_updated);
    } catch (e) {
      // charts = [];
      log.error("add-chart set charts error: ", e);
      log.error(e);
    }

    res.status(200).json({ charts }).end();
  });

  app.get("/alert", addon.authenticate(), async (req, res) => {
    res.render("alert.hbs");
  });
}
