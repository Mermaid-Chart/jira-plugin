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

    const windowObjectReference = window.open(loginURL, "loginWindow", options);
    windowObjectReference.focus();

    const onLogin = (token, user) => {
      setAccessToken(token);
      setUser(user);
    };

    const callback = async () => {
      console.log("login callback");
      const res = await fetch(`/check_token?state=${loginState}`, {
        headers: {
          Authorization: `JWT ${JWTToken}`,
        },
      });
      if (res.ok) {
        const body = await res.json();
        console.log("login token");
        console.log(body);
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

    AP.dialog
      .create({
        key: "dialog-module-view",
        width: "700px",
        height: "400px",
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
      })
      .on("close", closeCallback);
  };

  const editDiagramClick = (url) => {
    AP.dialog
      .create({
        key: "dialog-module-edit",
        width: "700px",
        height: "400px",
        chrome: true,
        customData: {
          baseUrl: MC_BASE_URL,
          accessToken: accessToken,
        },
      })
      .on("close", closeCallback);
  };

  function closeCallback() {}

  const addChartClick = () => {
    AP.dialog
      .create({
        key: "dialog-module-select",
        width: "700px",
        height: "400px",
        chrome: true,
        customData: {
          baseUrl: MC_BASE_URL,
          accessToken: accessToken,
        },
        buttons: [
          /*{
            text: 'Close',
            identifier: 'mc-close-button'
          }*/
        ],
      })
      .on("close", closeCallback);
  };

  function deleteDiagram(issueKey, diagramId) {
    fetch("/delete-chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueKey, diagramId }),
    }).then(() => {
      location.reload();
    });
  }

  //   <img
  //         src="data:image/x-png;base64, ${image.diagramImage}"
  //         alt="${image.title}"
  //     />
  if (accessToken) {
    //  if (true) {
    return html`
      <div id="images" style="display: flex; overflow-x: scroll;">
        ${charts.map(
          (image) => html` <div style="position: relative; margin: 5px;">
            <img
              src="${image.url}"
              alt="${image.title}"
              style="width: 150px; height: 150px;  border: 1px solid grey;"
            />

            <button
              onclick="${(e) => viewDiagramClick(image)}"
              style="position: absolute; bottom: 10px; left: 5px; background: none; border: none;"
            >
              <img
                style="width: 20px; height: 20px;"
                src="../eye-icon.svg"
                alt="view"
              />
            </button>
            <button
              onclick="${(e) => deleteDiagram()}"
              style="position: absolute; top: 5px; right: 5px; background: none; border: none;"
            >
              <input type="hidden" name="issueKey" value="${issueKey}" />
              <input type="hidden" name="diagramId" value="${image.id}" />
              <button type="submit" style="background: none; border: none;">
                <img
                  style="width: 15px; height: 15px;"
                  src="../close-line-icon.svg"
                  alt="close"
                />
              </button>
            </button>
            <button
              onclick="${(e) => editDiagramClick()}"
              type="submit"
              style="position: absolute; bottom: 10px; right: 5px; background: none; border: none;"
            >
              <img
                style="width: 15px; height: 15px;"
                src="../pencil-icon.svg"
                alt="view"
              />
            </button>
          </div>`
        )}
        <button
          onclick="${addChartClick}"
          style="width: 150px; height: 150px; margin: 5px; border: 1px solid grey; background: none; display: flex; align-items: center; justify-content: center"
        >
          <img
            style="width: 40px; height: 40px;"
            src="../plus-line-icon.svg"
            alt="add"
          />
        </button>
      </div>

      <button onclick="${addChartClick}">Add Chart</button>
    `;
  } else {
    return html`
      <div>
        <p>Visualize your task with diagrams</p>
      </div>
      <button onclick="${(e) => connectToMermaidClick()}">Connect</button>
      <button onclick="${(e) => viewDiagramClick("")}">View</button>
    `;
  }
}

render(html` <${App} />`, document.getElementById("editor-content"));
