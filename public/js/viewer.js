import { h, render } from "https://esm.sh/preact";
import { useEffect, useRef, useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";

const html = htm.bind(h);

function App() {
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

  // return html`<img
  //   src="data:image/x-png;base64, ${diagramImage}"
  //   alt="${title}"
  // /> `;

  if (!initialized) {
    return html`
      <div id="page-spinner">
        <img src="/spinner.svg" alt="Loading" />
      </div>
    `;
  }

  return html`
    <img
      src="${image.url}"
      alt="${image.title}"
      style="width: 100%; height: 100%;  border: 1px solid grey;"
    />
  `;
}

render(html` <${App} />`, document.getElementById("selector-content"));
