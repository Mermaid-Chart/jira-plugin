import { h, render } from "https://esm.sh/preact";
import { useEffect, useRef, useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
const html = htm.bind(h);

function App() {
  const [accessToken, setAccessToken] = useState(null);
  // const [user, setUser] = useState(loggedUser);
  const [image, setImage] = useState(null);

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    AP.dialog.getCustomData(function (customData) {
      console.log("customData");
      console.log(customData);
      // log.info("customData: ",customData);

      setImage(customData.image);
      setAccessToken(customData.accessToken);
      setInitialized(true);
    });
  }, []);

  useEffect(() => {
    window.AP.dialog.getButton("submit").hide();
    // window.AP.dialog.disableCloseOnSubmit();

    window.onmessage = function (e) {
      const action = e.data.action;
      switch (action) {
        case "cancel":
          break;

        case "logout":
          onLogout();
          break;

        case "save":
          console.log("save");
          AP.dialog.close({ chart: e.data.data, replace: true });
          break;
      }
    };
  }, []);

  window.onload = function () {
    document.body.style.margin = "0";
  };

  if (!initialized) {
    return html`
      <div id="page-spinner">
        <img src="/spinner.svg" alt="Loading" />
      </div>
    `;
  }

  const buildUrl = (pathname) => {
    return `${MC_BASE_URL}/oauth/frame/?token=${accessToken}&redirect=${pathname}`;
  };

  const iframeURL = buildUrl(
    `/app/projects/${image.projectID}/diagrams/${image.documentID}/version/v.${image.major}.${image.minor}/edit`
  );

  if (iframeURL) {
    return html` <iframe src="${iframeURL}" name="" /> `;
  }
}

render(html` <${App} />`, document.getElementById("editor-content"));
