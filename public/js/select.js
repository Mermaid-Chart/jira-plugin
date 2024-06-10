import { h, render } from "https://esm.sh/preact";
import { useEffect, useRef, useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
const html = htm.bind(h);

function App() {
  const [accessToken, setAccessToken] = useState(null);
  // const [user, setUser] = useState(loggedUser);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    AP.dialog.getCustomData(function (customData) {
      console.log("customData");
      console.log(customData);
      // log.info("customData: ", customData);
      setAccessToken(customData.accessToken);
      setInitialized(true);
    });
  }, []);

  useEffect(() => {
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
          // log.info("save: ", e.data.data);
          //setData((prev) => ({ ...prev, ...e.data.data }));
          AP.dialog.close({ chart: e.data.data, replace: false });

          break;
      }
    };
  }, []);
  // if (!accessToken) {
  //   return html` <${Login} onLogin="${onLogin}" /> `;
  // }

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

  // const iframeUrl = buildUrl(
  //   `/app/projects/${document.projectID}/diagrams/${document.documentID}/version/v.${document.major}.${document.minor}/edit`
  // );

  const iframeURL = buildUrl(`/app/plugins/confluence/select`);
  console.log("buildUrl:", iframeURL);
  // log.info("buildUrl: ", iframeURL);

  if (iframeURL) {
    //<iframe src="${iframeURL}" name="${JSON.stringify(iframeData)}" />
    return html` <iframe src="${iframeURL}" name="" /> `;
  }
}

render(html` <${App} />`, document.getElementById("selector-content"));
