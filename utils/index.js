import { Buffer } from "buffer";
import crypto from "crypto";
import log from "./logger.js";

const fetchToken = async (httpClient, atlassianAccountId) => {
  return new Promise((resolve, reject) => {
    httpClient.asUserByAccountId(atlassianAccountId).get(
      {
        url: `/rest/api/user/${atlassianAccountId}/property/token?jsonValue=true`,
        headers: {
          Accept: "application/json",
        },
      },
      function (err, _, body) {
        if (err) {
          log.error("Failed on reading user property 'token'", err);
          //console.error('Failed on reading user property "token"');
          reject(err);
          return;
        }
        const response = JSON.parse(body);
        const token = (response.value || {}).token || "";
        resolve(token);
      }
    );
  });
};
const saveToken = async (httpClient, atlassianAccountId, token) => {
  return new Promise((resolve, reject) => {
    const requestOpt = {
      url: `/rest/api/user/${atlassianAccountId}/property/token`,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: { token } }),
    };

    log.info("Save token for: ", atlassianAccountId, requestOpt);

    httpClient
      .asUserByAccountId(atlassianAccountId)
      .put(requestOpt, (err, res, body) => {
        log.error(
          "first attemt to save token, put: ",
          err,
          ", body: ",
          body,
          ", res: ",
          res
        );

        if (err || res.statusCode > 399) {
          httpClient
            .asUserByAccountId(atlassianAccountId)
            .post(requestOpt, (err2, res2, body2) => {
              //console.log("post", err2, body2);
              // log.info("post: ", err2, ", body: ", body2, res2);
              if (err2 || res2.statusCode !== 200) {
                // console.error(
                //   'Failed on saving user property "token"',
                //   err2,
                //   res2.statusCode
                // );
                log.error("Failed on saving user property token: ", err2);
                log.error("status code: ", res2.statusCode);
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

const setJiraIssueProperty = async (
  httpClient,
  issueKey,
  propertyKey,
  value
) => {
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

export {
  fetchToken,
  saveToken,
  getEncodedSHA256Hash,
  getJiraIssueProperty,
  setJiraIssueProperty,
};
