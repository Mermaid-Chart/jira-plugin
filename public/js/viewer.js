import { h, render } from "https://esm.sh/preact";
import { useEffect, useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
const html = htm.bind(h);

function App() {
  const [image, setImage] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    window.AP.dialog.getButton("submit").hide();
    AP.dialog.getCustomData(function (customData) {
      console.log("customData");
      console.log(customData);
      // log.info("customData: ", customData);

      setImage(customData.image);
      setInitialized(true);
    });
  }, []);

  // return html`<img
  //   src="data:image/x-png;base64, ${diagramImage}"
  //   alt="${title}"
  // /> `;

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

  //   <img
  //         src="data:image/x-png;base64, ${image.diagramImage}"
  //         src="${image.url}"
  //         alt="${image.title}"
  //     />
  //src="data:image/x-png;base64, ${image.diagramImage}"
  return html`
    <div
      class="image-container"
      style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center"
    >
      <img
        src=" ${image.diagramUrl}"
        alt=""
        style="width: 100%; max-height: 100vh; object-fit: contain;"
      />
    </div>
  `;
}

render(html` <${App} />`, document.getElementById("selector-content"));
