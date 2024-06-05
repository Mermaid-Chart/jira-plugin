import { h, render } from "https://esm.sh/preact";
import { useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";

const html = htm.bind(h);

function App() {
  // const [diagramImage, setDiagramImage] = useState(null);
  // const [title, setTitle] = useState(null);
  // const [url, setUrl] = useState(null);

  const [image, setImage] = useState(savedCharts);

  AP.dialog.getCustomData(function (customData) {
    console.log("customData");
    console.log(customData);
setImage(image);
    // setDiagramImage(customData.diagramImage);
    // setTitle(customData.title);
    // setUrl(customData.url);
  });

  // return html`<img
  //   src="data:image/x-png;base64, ${diagramImage}"
  //   alt="${title}"
  // /> `;

  return html`
    <img
      src="${image.url}"
      alt="${image.title}"
      style="width: 100%; height: 100%;  border: 1px solid grey;"
    />
  `;
}

render(html` <${App} />`, document.getElementById("selector-content"));
