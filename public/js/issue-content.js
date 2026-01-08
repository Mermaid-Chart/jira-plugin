import { h, render, Fragment } from "https://esm.sh/preact";
import { useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
const html = htm.bind(h);
let timeout;

function App() {
  const [accessToken, setAccessToken] = useState(mcAccessToken);
  const [user, setUser] = useState(loggedUser);
  const [charts, setCharts] = useState(savedCharts);

  const onLogin = (token, user) => {
    setAccessToken(token);
    setUser(user);
    window.location.reload();
  };

  const onLogout = async () => {
    showLoadingAnimation();
    await fetch("/logout", {
      method: "post",
      headers: {
        Authorization: `JWT ${JWTToken}`,
      },
    });
    setAccessToken(undefined);
    setUser(null);
    hideLoadingAnimation();
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

    const windowObjectReference = window.open(loginURL, "loginWindow", options);
    windowObjectReference.focus();

    const callback = async () => {
      const res = await fetch(`/check_token?state=${loginState}`, {
        headers: {
          Authorization: `JWT ${JWTToken}`,
        },
      });

      if (res.ok) {
        const body = await res.json();
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

  const viewDiagramClick = (chart) => {
    AP.dialog.create({
      key: "dialog-module-view",
      chrome: true,
      customData: {
        image: chart,
        baseUrl: MC_BASE_URL,
        accessToken: accessToken,
      },
    });
  };

  const editDiagramClick = (image) => {
    if (!accessToken) {
      connectToMermaidClick();
      return;
    }

    AP.dialog.create({
      key: "dialog-module-edit",
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
      chrome: true,
      customData: {
        baseUrl: MC_BASE_URL,
        accessToken: accessToken,
      },
      buttons: [],
    });
  };

  const showLoadingAnimation = () => {
    let loading = document.querySelector("#loading-spinner");
    loading.style.display = "inline-block";
  };
  const hideLoadingAnimation = () => {
    let loading = document.querySelector("#loading-spinner");
    loading.style.display = "none";
  };

  const deleteDiagram = (chart) => {
    showLoadingAnimation();

    const chartIndex = charts.findIndex(
      (e) => e.documentID === chart.documentID
    );

    if (chartIndex > -1) {
      charts.splice(chartIndex, 1);
      setCharts(charts);
    }

    fetch("/delete-chart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${JWTToken}`,
      },
      body: JSON.stringify({ issueKey, documentID: chart.documentID }),
    }).then(() => {
      hideLoadingAnimation();
      location.reload();
    });
  };

  window.AP.events.on("dialog.close", async (data) => {
    if (data && data.chart) {
      data.chart.diagramCode = "";
      // data.chart.diagramImage = "";

      const chartIndex = charts.findIndex(
        (e) => e.documentID === data.chart.documentID
      );

      if (data.replace == false && chartIndex > -1) {
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

      showLoadingAnimation();
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
        hideLoadingAnimation();
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

  return html`
    <div class="header-block">
      <div class="subheader">
        ${!accessToken &&
        html`<button
          class="connect-btn"
          onclick="${(e) => connectToMermaidClick()}"
        >
          Connect
        </button>`}
        ${accessToken &&
        html`<button class="connect-btn" onclick="${(e) => onLogout()}">
          Disconnect
        </button>`}
        <div class="loading-spinner" id="loading-spinner" style="display: none">
          <div class="spinner"></div>
        </div>
      </div>
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
        const titleText = image.title ? "title-text" : "non-show";
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
            title="view"
          ></div>

          <div class="${titleText}">${image.title}</div>
          <button
            class="delete-btn"
            onclick="${(e) => deleteDiagram(image)}"
            type="submit"
            title="Delete chart from issue"
          >
            <input type="hidden" name="issueKey" value="${issueKey}" />
            <input type="hidden" name="diagramId" value="${image.id}" />
            <img
              style="width: 20px; height: 20px;"
              src="../trash-icon.svg"
              alt="close"
            />
          </button>
          ${accessToken &&
          html`<button
            class="edit-btn"
            onclick="${(e) => editDiagramClick(image)}"
            type="submit"
            title="Edit chart"
          >
            <img
              style="width: 20px; height: 20px;"
              src="../pencil-icon.svg"
              alt="view"
            />
          </button>`}
        </div>`;
      })}
    </div>
  `;
}

render(html` <${App} />`, document.getElementById("editor-content"));
