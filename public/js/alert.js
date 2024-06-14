import { h, render } from "https://esm.sh/preact";
import { useEffect, useRef, useState } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
const html = htm.bind(h);

function App() {
  const [message, setMessage] = useState("");
  // const [user, setUser] = useState(loggedUser);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    window.AP.dialog.getButton("submit").hide();
    AP.dialog.getCustomData(function (customData) {
      setMessage(customData.message);
      setInitialized(true);
    });
  }, []);

  if (!initialized) {
    return html`
      <div id="page-spinner">
        <img src="/spinner.svg" alt="Loading" />
      </div>
    `;
  }

  return html` <p>${message}</p>`;
}

render(html` <${App} />`, document.getElementById("selector-content"));
