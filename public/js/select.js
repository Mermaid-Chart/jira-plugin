import { h, render } from "https://esm.sh/preact";
import { useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";

const html = htm.bind(h);

function App() {
  const [accessToken, setAccessToken] = useState(mcAccessToken);
  const [user, setUser] = useState(loggedUser);

  AP.dialog.getCustomData(function (customData) {
    console.log("customData");
    console.log(customData);
  });

  // if (!accessToken) {
  //   return html` <${Login} onLogin="${onLogin}" /> `;
  // }

  const buildUrl = (pathname) => {
    return `${MC_BASE_URL}/oauth/frame/?token=${accessToken}&redirect=${pathname}`;
  };

  // buildUrl(
  //   `/app/projects/${document.projectID}/diagrams/${document.documentID}/version/v.${document.major}.${document.minor}/edit`
  // )

  const iframeURL = buildUrl(`/app/plugins/confluence/select`);
  console.log("buildUrl:", buildUrl);

  if (iframeURL) {
    //<iframe src="${iframeURL}" name="${JSON.stringify(iframeData)}" />
    return html` <iframe src="${iframeURL}" name="" /> `;
  }

  // return html`
  //   <${Form}
  //     user="${user}"
  //     onLogout="${onLogout}"
  //     mcAccessToken="${accessToken}"
  //   />
  // `;
}

render(html` <${App} />`, document.getElementById("selector-content"));
