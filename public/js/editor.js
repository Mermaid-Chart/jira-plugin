import { h, render } from "https://esm.sh/preact";
import { useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";

const html = htm.bind(h);

function App() {
  const [accessToken, setAccessToken] = useState(mcAccessToken);
  const [user, setUser] = useState(loggedUser);
  const [image, setImage] = useState(savedCharts);

  AP.dialog.getCustomData(function (customData) {
    console.log("customData");
    console.log(customData);
    setImage(image);
  });

  console.log("accessToken");
  console.log(accessToken);

  // const buildUrl = (pathname) => {
  //   return `${MC_BASE_URL}/oauth/frame/?token=${accessToken}&redirect=${pathname}`;
  // };

  const iframeUrl = buildUrl(
    `/app/projects/${image.projectID}/diagrams/${image.documentID}/version/v.${image.major}.${image.minor}/edit`
  );

  // const iframeURL = buildUrl(`/app/plugins/confluence/select`);
  console.log("buildUrl:", iframeURL);

  if (iframeURL) {
    return html` <iframe src="${iframeURL}" name="" /> `;
  }
}

render(html` <${App} />`, document.getElementById("selector-content"));
