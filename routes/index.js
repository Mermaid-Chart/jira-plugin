import { fetchToken, saveToken } from "../utils/index.js";
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

  //////////// JIRA
  const getJiraIssueProperty = async (req, issueKey, propertyKey) => {
    const httpClient = addon.httpClient(req);
    const url = `/rest/api/3/issue/${issueKey}/properties/${propertyKey}`;

    return new Promise((resolve, reject) => {
      httpClient.get(
        {
          url,
          json: true,
        },
        (err, res, body) => {
          if (err) {
            return reject(err);
          }
          resolve(body.value || []);
        }
      );
    });
  };

  const setJiraIssueProperty = async (req, issueKey, propertyKey, value) => {
    const httpClient = addon.httpClient(req);
    const url = `/rest/api/3/issue/${issueKey}/properties/${propertyKey}`;

    return new Promise((resolve, reject) => {
      httpClient.put(
        {
          url,
          json: true,
          body: value,
        },
        (err, res, body) => {
          if (err) {
            return reject(err);
          }
          resolve(body);
        }
      );
    });
  };

  ////
  app.get("/issue-content", addon.authenticate(), async (req, res) => {
    const issueKey = req.query.issueKey;
    const charts = [
      {
        id: 1,
        title: "name",
        projectID: 1,
        documentID: 1,
        major: 1,
        minor: 1,
        url: "https://images.adsttc.com/media/images/5a0a/1feb/b22e/3847/6300/02a5/newsletter/2.jpg",
      },
    ];

    // const images = await getJiraIssueProperty(
    //   req,
    //   req.query.issueKey,
    //   "diagrams"
    // );

    // const auth = user ? {} : await mermaidAPI.getAuthorizationData();
    await mermaidAPI.getAuthorizationData();
    console.log("auth");
    console.log(auth);

    //await getJiraIssueProperty(issueKey, "diagrams");
    res.render("issue-content.hbs", {
      issueKey,
      charts,
      MC_BASE_URL: MC_BASE_URL,
      loginURL: auth.url,
      loginState: auth.state,
    });
  });

  app.get("/editor", async (req, res) => {
    let access_token, user;
    try {
      access_token = await fetchToken(
        req.context.http,
        req.context.userAccountId
      );
      user = access_token ? await mermaidAPI.getUser(access_token) : undefined;
    } catch (e) {}

    const auth = user ? {} : await mermaidAPI.getAuthorizationData();

    res.render("editor.hbs", {
      MC_BASE_URL: MC_BASE_URL,
      mcAccessToken: user ? access_token : "",
      loginURL: auth.url,
      loginState: auth.state,
      user: user ? JSON.stringify(user) : "null",
    });
  });

  app.get("/select", async (req, res) => {
    let access_token, user;
    try {
      access_token = await fetchToken(
        req.context.http,
        req.context.userAccountId
      );
      user = access_token ? await mermaidAPI.getUser(access_token) : undefined;
    } catch (e) {}

    res.render("select.hbs", {
      MC_BASE_URL: MC_BASE_URL,
      mcAccessToken: user ? access_token : "",
      user: user ? JSON.stringify(user) : "null",
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
}
