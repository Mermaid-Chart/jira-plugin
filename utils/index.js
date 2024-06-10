import { Buffer } from "buffer";
import crypto from "crypto";
import log from "./logger.js";

const tokenPropertyKey = "token";

const fetchToken = async (httpClient, atlassianAccountId) => {
  return new Promise((resolve, reject) => {
    log.info(`fetchToken for: ${atlassianAccountId}`);

    httpClient.asUserByAccountId(atlassianAccountId).get(
      {
        url: `/rest/api/2/user/properties/${tokenPropertyKey}?accountId=${atlassianAccountId}`,
        headers: {
          Accept: "application/json",
        },
      },
      function (err, _, body) {
        if (err) {
          log.error("Failed on reading user property 'token'", err);
          log.error(err);
          //console.error('Failed on reading user property "token"');
          reject(err);
          return;
        }

        const response = JSON.parse(body);
        log.info("fetchToken response: ");
        log.info(response);
        const token = (response.value.value || {}).token || "";
        resolve(token);
      }
    );
  });
};
const saveToken = async (httpClient, atlassianAccountId, token) => {
  log.info(`fetchToken for: ${atlassianAccountId}`);

  return new Promise((resolve, reject) => {
    const requestOpt = {
      url: `/rest/api/2/user/properties/${tokenPropertyKey}?accountId=${atlassianAccountId}`,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: { token } }),
    };

    log.info(`Save token for: ${atlassianAccountId}`);
    log.info(requestOpt);

    httpClient
      .asUserByAccountId(atlassianAccountId)
      .put(requestOpt, (err, res, body) => {
        log.info("first attemt to save token, body: ");
        log.info(body);
        log.info("first attemt to save token, res: ");
        log.info(res);

        if (err || res.statusCode > 399) {
          log.error(`error of first attemt to save token: ${res.statusCode}`);
          log.error(err);

          log.info("second attemt to save token: ");
          httpClient
            .asUserByAccountId(atlassianAccountId)
            .post(requestOpt, (err2, res2, body2) => {
              if (err2 || res2.statusCode !== 200) {
                // console.error(
                //   'Failed on saving user property "token"',
                //   err2,
                //   res2.statusCode
                // );
                log.error("Failed on saving user property token: ", err2);
                log.error(err2);
                log.error("status code: ", res2.statusCode);
                log.error(res2);
                return reject(err);
              }
            });
        }
        resolve(token);
      });
  });
};

const getEncodedSHA256Hash = async (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Buffer.from(hash)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

//////////// JIRA
const getJiraIssueProperty = async (httpClient, issueKey, propertyKey) => {
  return new Promise((resolve, reject) => {
    const requestOpt = {
      url: `/rest/api/2/issue/${issueKey}/properties/${propertyKey}`,
      headers: {
        Accept: "application/json",
      },
    };

    httpClient.get(requestOpt, (err, res, body) => {
      if (err) {
        return reject(err);
      }
      resolve(body.value || []);
    });
  });
};

const setJiraIssueProperty = async (
  httpClient,
  issueKey,
  propertyKey,
  value
) => {
  return new Promise((resolve, reject) => {
    const requestOpt = {
      url: `/rest/api/2/issue/${issueKey}/properties/${propertyKey}`,
      json: true,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    };

    httpClient.put(requestOpt, (err, res, body) => {
      if (err) {
        return reject(err);
      }
      resolve(body);
    });
  });
};

export {
  fetchToken,
  saveToken,
  getEncodedSHA256Hash,
  getJiraIssueProperty,
  setJiraIssueProperty,
};
