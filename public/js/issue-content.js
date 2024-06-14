import { h, render, Fragment } from "https://esm.sh/preact";
import { useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
import { Header } from "./editor/header.js";
const html = htm.bind(h);
let timeout;

function App() {
  const [accessToken, setAccessToken] = useState(mcAccessToken);
  const [user, setUser] = useState(loggedUser);
  const [charts, setCharts] = useState(savedCharts);

  const onLogin = (token, user) => {
    setAccessToken(token);
    setUser(user);
  };

  console.log("loginURL", loginURL);
  console.log(charts);

  const onLogout = async () => {
    await fetch("/logout", {
      method: "post",
      headers: {
        Authorization: `JWT ${JWTToken}`,
      },
    });
    setAccessToken(undefined);
    setUser(null);
    window.location.reload();
  };

  const connectToMermaidClick = () => {
    const width = 500;
    const height = 650;
    const left = screen.width / 2 - width / 2;
    const top = screen.height / 2 - height / 2;
    let options = "width=" + width;
    options += ",height=" + height;
    options += ",top=" + top;
    options += ",left=" + left;

    console.log("loginURL: ", loginURL);
    // log.info("loginURL: ", loginURL);

    const windowObjectReference = window.open(loginURL, "loginWindow", options);
    windowObjectReference.focus();

    const callback = async () => {
      console.log("login callback");
      // log.info("login callback");
      const res = await fetch(`/check_token?state=${loginState}`, {
        headers: {
          Authorization: `JWT ${JWTToken}`,
        },
      });
      if (res.ok) {
        const body = await res.json();
        console.log("login token");
        console.log(body);
        // log.info("login token: ", body);
        onLogin(body.token, body.user);
      } else {
        timeout = setTimeout(callback, 500);
      }
    };
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(callback, 500);

    return false;
  };

  const viewDiagramClick = (image) => {
    //window.open(url, '_blank');

    AP.dialog.create({
      key: "dialog-module-view",
      width: "1100px",
      height: "500px",
      chrome: true,
      customData: {
        image,
        baseUrl: MC_BASE_URL,
        accessToken: accessToken,
      },
      buttons: [
        /*{
            text: 'Close',
            identifier: 'mc-close-button'
          }*/
      ],
    });
  };

  const editDiagramClick = (image) => {
    if (!accessToken) {
      connectToMermaidClick();
      return;
    }

    AP.dialog.create({
      key: "dialog-module-edit",
      width: "1100px",
      height: "500px",
      chrome: true,
      customData: {
        image,
        baseUrl: MC_BASE_URL,
        accessToken: accessToken,
      },
    });
  };

  const addChartClick = () => {
    if (!accessToken) {
      connectToMermaidClick();
      return;
    }

    AP.dialog.create({
      key: "dialog-module-select",
      width: "1100px",
      height: "500px",
      chrome: true,
      customData: {
        baseUrl: MC_BASE_URL,
        accessToken: accessToken,
      },
      buttons: [],
    });
  };

  function deleteDiagram(image) {
    fetch("/delete-chart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${JWTToken}`,
      },
      body: JSON.stringify({ issueKey, documentID: image.documentID }),
    }).then(() => {
      location.reload();
    });
  }

  window.AP.events.on("dialog.close", async (data) => {
    console.log("dialog.close:");
    console.log(data);
    // log.info("dialog.close: ", data);

    if (data && data.chart) {
      data.chart.diagramCode = "";
      // data.chart.diagramImage = "";

      const existingChart = charts.findIndex(
        (e) => e.documentID === data.chart.documentID
      );

      if (data.replace == false && existingChart > -1) {
        //alert("This chart already added.");

        AP.dialog.create({
          key: "dialog-module-alert",
          chrome: true,
          customData: {
            message: "Chart already added.",
          },
          buttons: [],
        });

        return;
      }

      console.log(data);
      fetch("/add-chart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${JWTToken}`,
        },
        body: JSON.stringify({
          issueKey,
          chart: data.chart,
          replace: data.replace,
        }),
      }).then((result) => {
        console.log("/add-chart result: ");
        console.log(result);
        // log.info("/add-chart: ", result);
        location.reload();
      });
    }
  });

  window.AP.events.on("dialog.submit", async (data) => {
    console.log("dialog.submit", data);
    // log.info("dialog.submit: ", data);
  });

  window.onload = function () {
    let img = document.querySelectorAll(".tile-image");
    let load = document.querySelectorAll(".load");

    img.forEach((i) => {
      i.style.display = "flex";
    });
    load.forEach((l) => {
      l.style.display = "none";
    });
  };
  //   <img
  //         src="data:image/x-png;base64, ${image.diagramImage}"
  //         alt="${image.title}"
  //     />

  // return html` <div>
  //       <p>Visualize your task with diagrams</p>
  //     </div>
  //     <button class="connect-btn" onclick="${(e) => connectToMermaidClick()}">
  //       Connect
  //     </button>`;

  return html`
      <div class="header-block">
      <div class="subheader">
        <p>Visualize your task with diagrams</p>
      </div>
      <${Fragment}>
          <${Header} user="${user}" onLogout="${onLogout}"/>
        </Fragment>
      </div>
      <div
        id="images"
        style="display: flex; overflow-x: scroll; flex-wrap: wrap;"
      >
        <button class="add-chart-btn" onclick="${addChartClick}">
          <img src="../plus-line-icon.svg" alt="add" />
        </button>
        ${charts.map((image) => {
          // src="${image.diagramUrl}"
          return html` <div class="tile">
            <img
              style="display: none;"
              class="tile-image"
              src="${image.diagramUrl}"
              alt="${image.title}"
            />
            <div class="load" style="display: flex">
              <div class="spinner"></div>
            </div>
            <div
              class="background"
              onclick="${(e) => viewDiagramClick(image)}"
            ></div>
            <div class="title-text">${image.title}</div>

            <button
              class="delete-btn"
              onclick="${(e) => deleteDiagram(image)}"
              type="submit"
            >
              <input type="hidden" name="issueKey" value="${issueKey}" />
              <input type="hidden" name="diagramId" value="${image.id}" />
              <img
                style="width: 15px; height: 15px;"
                src="../close-line-icon.svg"
                alt="close"
              />
            </button>
            <button
              class="edit-btn"
              onclick="${(e) => editDiagramClick(image)}"
              type="submit"
            >
              <img
                style="width: 15px; height: 15px;"
                src="../pencil-icon.svg"
                alt="view"
              />
            </button>
          </div>`;
        })}
      </div>
    `;
}

render(html` <${App} />`, document.getElementById("editor-content"));
