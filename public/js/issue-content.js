import { h, render } from "https://esm.sh/preact";
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
  };

  console.log("loginURL", loginURL);
  console.log(charts);
  console.log(accessToken);
  console.log(user);
  console.log(other);

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

    const onLogin = (token, user) => {
      setAccessToken(token);
      setUser(user);
    };

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

  function deleteDiagram(issueKey, documentID) {
    fetch("/delete-chart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${JWTToken}`,
      },
      body: JSON.stringify({ issueKey, documentID }),
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
      data.chart.diagramImage = "";

      console.log(data);
      fetch("/add-chart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${JWTToken}`,
        },
        body: JSON.stringify({ issueKey, chart: data.chart }),
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

  //   <img
  //         src="data:image/x-png;base64, ${image.diagramImage}"
  //         alt="${image.title}"
  //     />
  if (accessToken) {
    //if (true) {
    return html`
      <div id="images" style="display: flex; overflow-x: scroll;">
        ${charts.map(
          (image) => html` <div class="tile">
            <img
              class="tile-image"
              src="data:image/x-png;base64, ${image.diagramImage}"
              alt="${image.title}"
            />
            <div class="background"></div>
            <button
              class="view-btn"
              onclick="${(e) => viewDiagramClick(image)}"
            >
              <img
                style="width: 20px; height: 20px;"
                src="../eye-icon.svg"
                alt="view"
              />
            </button>
            <button
              class="delete-btn"
              onclick="${(e) => deleteDiagram()}"
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
          </div>`
        )}
        <button class="add-chart-btn" onclick="${addChartClick}">
          <img src="../plus-line-icon.svg" alt="add" />
        </button>
      </div>
    `;
  } else {
    return html` <div>
        <p>Visualize your task with diagrams</p>
      </div>
      <button class="connect-btn" onclick="${(e) => connectToMermaidClick()}">
        Connect
      </button>`;
  }
}

render(html` <${App} />`, document.getElementById("editor-content"));
