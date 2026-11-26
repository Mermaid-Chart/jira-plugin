import { h, render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import htm from 'htm';
import { requestJira, view } from '@forge/bridge';

import '../../../public/css/general.css';
import '../../../public/css/editor.css';

import { buildFrameUrl, interpretMessage, isMermaidOrigin } from './messages.js';
import { loadThumbnail } from '../shared/thumbnail.js';

const html = htm.bind(h);

/** Mermaid Chart select or edit page; a saved diagram closes the modal with it (replaces the Connect select/editor dialogs). */
function MermaidFrame({ mode, baseUrl, accessToken, image }) {
  useEffect(() => {
    const onMessage = (event) => {
      if (!isMermaidOrigin(event.origin, baseUrl)) {
        return;
      }
      const message = interpretMessage(event.data);
      if (message.type === 'save') {
        view.close({ chart: message.chart, replace: mode === 'edit' });
      } else if (message.type === 'back') {
        view.close();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [mode, baseUrl]);

  return html`<iframe src=${buildFrameUrl(baseUrl, accessToken, mode, image)} name="" />`;
}

/** Full-size diagram image (replaces the Connect viewer dialog). */
function DiagramView({ image }) {
  const [src, setSrc] = useState(undefined);

  useEffect(() => {
    let url = null;
    loadThumbnail(image?.attachmentId, {
      requestJira,
      createObjectURL: (blob) => URL.createObjectURL(blob),
    })
      .then((result) => {
        url = result;
        setSrc(result);
      })
      .catch(() => setSrc(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [image?.attachmentId]);

  if (src === undefined) {
    return html`<div id="page-spinner"><img src="./spinner.svg" alt="Loading" /></div>`;
  }
  return html`
    <div
      class="image-container"
      style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center"
    >
      <img
        src=${src || './no-image-placeholder.png'}
        alt=${image?.title || ''}
        style="width: 100%; max-height: 100vh; object-fit: contain;"
      />
    </div>
  `;
}

/** Short message, e.g. "Chart already added." (replaces the Connect alert dialog). */
function Alert({ message }) {
  return html`
    <div style="padding: 16px; display: flex; flex-direction: column; gap: 16px; align-items: flex-start">
      <p>${message}</p>
      <button class="add-diagram-btn" onClick=${() => view.close()}>Close</button>
    </div>
  `;
}

function Dialog({ modal }) {
  switch (modal?.mode) {
    case 'select':
    case 'edit':
      return html`<${MermaidFrame} ...${modal} />`;
    case 'view':
      return html`<${DiagramView} image=${modal.image} />`;
    case 'alert':
      return html`<${Alert} message=${modal.message} />`;
    default:
      return null;
  }
}

view.getContext().then((context) => {
  document.body.style.margin = '0';
  render(html`<${Dialog} modal=${context?.extension?.modal} />`, document.getElementById('dialog-content'));
});
