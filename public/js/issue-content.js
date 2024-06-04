import { h, render } from "https://esm.sh/preact";
import { useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";

const html = htm.bind(h);
let timeout;

function App() {
  const [accessToken, setAccessToken] = useState(mcAccessToken);
  const [user, setUser] = useState(loggedUser);

  const onLogin = (token, user) => {
    setAccessToken(token);
    setUser(user);
  };

  console.log("loginURL", loginURL);

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

  const viewDiagramClick = (url) => {
    //window.open(url, '_blank');

    AP.dialog
      .create({
        key: "dialog-module-select",
        width: "700px",
        height: "400px",
        chrome: true,
        customData: {
          baseUrl: MC_BASE_URL,
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

  function closeCallback() {}

  const addChartClick = () => {};

  function deleteDiagram(issueKey, diagramId) {
    fetch("/delete-chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueKey, diagramId }),
    }).then(() => {
      location.reload();
    });
  }

  /// Event and dialog emmiting
  window.AP.events.on("loginEvent", function () {
    console.log("Log in");
  });
let imgs=[{url:'https://img.freepik.com/free-photo/view-of-3d-adorable-cat-with-fluffy-clouds_23-2151113419.jpg', name:'img'}, {url:'https://img.freepik.com/free-photo/view-of-3d-adorable-cat-with-fluffy-clouds_23-2151113419.jpg', name:'img'}]
  //if (accessToken) {
  if (true) {
    return html`
      <div id="images" style="display: flex; overflow-x: scroll;">
        ${imgs.map(
          (image) => html` <div style="position: relative; margin: 5px;">
            <img
              src="${image.url}"
              alt="${image.name}"
              style="width: 150px; height: 150px;  border: 1px solid grey;"
            />
            <button
              onclick="${(e) => viewDiagramClick(image.url)}"
              style="position: absolute; bottom: 10px; left: 5px; background: none; border: none;"
            >
              <img style="width: 20px; height: 20px;" src="../eye-icon.svg" alt="view"/>
            </button>
            <form
              action="/delete-diagram"
              method="POST"
              style="position: absolute; top: 5px; right: 5px;"
            >
              <input type="hidden" name="issueKey" value="${issueKey}" />
              <input type="hidden" name="diagramId" value="${image.id}" />
              <button type="submit" style="background: none; border: none;">
                <img style="width: 15px; height: 15px;" src="../close-line-icon.svg" alt="view"/>
              </button>
            </form>
            <button type="submit" style="position: absolute; bottom: 10px; right: 5px; background: none; border: none;">
              <img style="width: 15px; height: 15px;" src="../pencil-icon.svg" alt="view"/>
            </button>
          </div>`
        )}
        <div></div>
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
