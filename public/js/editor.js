import { h, render } from "https://esm.sh/preact";
import { useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";

const html = htm.bind(h);

function App() {
  const [accessToken, setAccessToken] = useState(mcAccessToken);
  const [user, setUser] = useState(loggedUser);
  const [image, setImage] = useState(null);

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    AP.dialog.getCustomData(function (customData) {
      console.log("customData");
      console.log(customData);
      setImage(customData.image);
      setInitialized(true);
    });
  }, []);

  console.log("accessToken");
  console.log(accessToken);

  if (!initialized) {
    return html`
      <div id="page-spinner">
        <img src="/spinner.svg" alt="Loading" />
      </div>
    `;
  }

  // const buildUrl = (pathname) => {
  //   return `${MC_BASE_URL}/oauth/frame/?token=${accessToken}&redirect=${pathname}`;
  // };

  const iframeURL = buildUrl(
    `/app/projects/${image.projectID}/diagrams/${image.documentID}/version/v.${image.major}.${image.minor}/edit`
  );

  // const iframeURL = buildUrl(`/app/plugins/confluence/select`);
  console.log("buildUrl:", iframeURL);

  if (iframeURL) {
    return html` <iframe src="${iframeURL}" name="" /> `;
  }
}

render(html` <${App} />`, document.getElementById("editor-content"));
