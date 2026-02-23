import { h, render, Fragment } from "https://esm.sh/preact";
import { useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
import analytics from "./analytics.js";

const html = htm.bind(h);
let timeout;

function App() {
  const [accessToken, setAccessToken] = useState(mcAccessToken);
  const [user, setUser] = useState(loggedUser);
  const [charts, setCharts] = useState(savedCharts);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loadingText, setLoadingText] = useState("Inserting Diagram...");

  const onLogin = (token, user) => {
    setAccessToken(token);
    setUser(user);
    window.location.reload();
  };

  const onLogout = async () => {
    showLoadingAnimation("Disconnecting...");
    await fetch("/logout", {
      method: "post",
      headers: {
        Authorization: `JWT ${JWTToken}`,
      },
    });
    setAccessToken(undefined);
    setUser(null);
    analytics.trackLogout();
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
     analytics.trackConnectToMermaidChart();

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
      chrome: false,
      customData: {
        image: chart,
        baseUrl: MC_BASE_URL,
        accessToken: accessToken,
      },
    });
  };

  const editDiagramClick = (image, e) => {
    if (e) e.stopPropagation(); // Prevent card click
    if (!accessToken) {
      connectToMermaidClick();
      return;
    }
   analytics.trackPluginDiagramEdit();
   console.log("editDiagramClick", image);
    AP.dialog.create({
      key: "dialog-module-edit",
      chrome: false,
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
      chrome: false,
      customData: {
        baseUrl: MC_BASE_URL,
        accessToken: accessToken,
      },
      buttons: [],
    });
  };

  const showLoadingAnimation = (text = "Inserting Diagram...") => {
    setLoadingText(text);
    setIsLoading(true);
    setIsSuccess(false);
  };
  const hideLoadingAnimation = () => {
    setIsLoading(false);
    setIsSuccess(false);
  };
  const showSuccessAndRefresh = (successText = "Operation Completed Successfully!") => {
    setLoadingText(successText);
    setIsLoading(false);
    setIsSuccess(true);
    // Show success message for 1.5 seconds before refreshing
    setTimeout(() => {
      location.reload();
    }, 1500);
  };

  const deleteDiagram = (chart, e) => {
    if (e) e.stopPropagation(); // Prevent card click
    showLoadingAnimation("Deleting Diagram...");

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
      showSuccessAndRefresh("Diagram Deleted Successfully!");
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
        showSuccessAndRefresh("Diagram Inserted Successfully!");
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
      i.style.display = "block";
    });
    load.forEach((l) => {
      l.style.display = "none";
    });
  };

  return html`
    <div class="header-block">
      <div class="header-left">
        ${accessToken &&
        html`<button class="add-diagram-btn" onclick="${addChartClick}">
          Add New Diagram
        </button>`}
        ${!accessToken &&
        html`<button
          class="connect-btn"
          onclick="${(e) => connectToMermaidClick()}"
        >
          Connect to Mermaid
        </button>`}
      </div>
      <div class="header-right">
        ${accessToken &&
        html`<button class="disconnect-btn" onclick="${(e) => onLogout()}">
          Disconnect Mermaid
        </button>`}
      </div>
    </div>
    <div class="diagrams-grid">
      <!-- Loading or Success overlay for diagram operations -->
      ${(isLoading || isSuccess) &&
      html`<div class="loading-overlay">
        <div class="loading-card">
          ${isLoading && html`<div class="spinner"></div>`}
          ${isSuccess && html`<div class="success-icon">✓</div>`}
          <div class="loading-text">${loadingText}</div>
        </div>
      </div>`}

      <!-- No diagrams state when connected to Mermaid but no charts exist -->
      ${accessToken && charts.length === 0 && !isLoading && !isSuccess &&
      html`<div class="no-diagrams-container">
        <h3 class="no-diagrams-title">No diagrams yet</h3>
        <p class="no-diagrams-description">
          Connected to Mermaid, but no diagrams yet.<br/>
          Add a <button class="new-diagram-link" onclick="${addChartClick}">New diagram</button> to get started.
        </p>
      </div>`}
      
      ${charts.map((image) => {
        return html` <div class="diagram-card">
          <div class="card-content" onclick="${(e) => viewDiagramClick(image)}">
            <img
              style="display: none;"
              class="tile-image"
              src="${image.diagramUrl}"
              alt="${image.title || 'Diagram'}"
            />
            <div class="load" style="display: flex">
              <div class="spinner"></div>
            </div>
            <div class="diagram-placeholder" style="display: flex">
              <img src="../no-image-placeholder.png" alt="Loading diagram" />
            </div>
            
            <!-- Button frame container -->
            <div class="button-frame ${!accessToken ? 'delete-only' : ''}">
            ${accessToken &&
            html`<button
              class="edit-overlay"
              onclick="${(e) => editDiagramClick(image, e)}"
              title="Edit diagram"
            >
              <!-- <img src="../pencil-icon.svg" alt="Edit" /> -->
              Edit
            </button>`}
            <button
              class="delete-overlay"
              onclick="${(e) => deleteDiagram(image, e)}"
              title="Delete diagram"
            >
              <img src="../trash-icon.svg" alt="Delete" />
            </button>
            </div>
          </div>
        </div>`;
      })}
    </div>
  `;
}

render(html` <${App} />`, document.getElementById("editor-content"));
