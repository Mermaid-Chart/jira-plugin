import { h, render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import htm from 'htm';
import { invoke, Modal, requestJira, router, view } from '@forge/bridge';

import '../../../public/css/general.css';
import '../../../public/css/issue-content.css';
import '../../../public/css/editor.css';
import '../../../public/css/diagram-styles.css';

import { remoteInvoke } from '../shared/remote.js';
import { loadThumbnail } from '../shared/thumbnail.js';
import { startSignIn } from '../shared/login.js';
import { createAnalytics } from '../shared/analytics.js';
import { clearMermaidChartSession } from '../shared/clearSession.js';

const html = htm.bind(h);

const remote = (path, options) => remoteInvoke(path, options, invoke);
const analytics = createAnalytics({
  getBaseUrl: () => window.MC_BASE_URL,
  fetchImpl: (...args) => fetch(...args),
  storage: window.localStorage,
});

// Same delay the Connect panel waited before reloading after a change.
const SUCCESS_DELAY_MS = 1500;

function Thumbnail({ chart }) {
  const [src, setSrc] = useState(undefined);

  useEffect(() => {
    let url = null;
    let cancelled = false;
    loadThumbnail(chart.attachmentId, {
      requestJira,
      createObjectURL: (blob) => URL.createObjectURL(blob),
    })
      .then((result) => {
        url = result;
        if (!cancelled) setSrc(result);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [chart.attachmentId]);

  if (src === undefined) {
    return html`<div class="load" style="display: flex"><div class="spinner"></div></div>`;
  }
  if (src === null) {
    return html`<div class="diagram-placeholder" style="display: flex">
      <img src="./no-image-placeholder.png" alt="Diagram" />
    </div>`;
  }
  return html`<img class="tile-image" style="display: block" src=${src} alt=${chart.title || 'Diagram'} />`;
}

function App({ issueKey }) {
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loadingText, setLoadingText] = useState('Inserting Diagram...');
  const [errorText, setErrorText] = useState('');

  const load = async () => {
    try {
      const data = await remote(`/forge/panel-init?issueKey=${encodeURIComponent(issueKey)}`);
      window.MC_BASE_URL = data.MC_BASE_URL;
      setState(data);
      setLoadError('');
    } catch (e) {
      setLoadError('Could not load Mermaid diagrams. Please reload the page.');
    }
  };

  useEffect(() => {
    load();
  }, [issueKey]);

  if (loadError) {
    return html`<p class="no-diagrams-description">${loadError}</p>`;
  }
  if (!state) {
    return html`<div id="page-spinner"><img src="./spinner.svg" alt="Loading" /></div>`;
  }

  const accessToken = state.mcAccessToken;
  const charts = state.charts;

  const showLoadingAnimation = (text = 'Inserting Diagram...') => {
    setLoadingText(text);
    setIsLoading(true);
    setIsSuccess(false);
  };
  const hideLoadingAnimation = () => {
    setIsLoading(false);
    setIsSuccess(false);
  };
  const showSuccessAndRefresh = (successText) => {
    setLoadingText(successText);
    setIsLoading(false);
    setIsSuccess(true);
    setTimeout(async () => {
      await load();
      hideLoadingAnimation();
    }, SUCCESS_DELAY_MS);
  };
  // The Connect panel reported success even when the server call failed; say what went wrong instead.
  const showErrorAndRefresh = (message) => {
    setIsLoading(false);
    setIsSuccess(false);
    setErrorText(message || 'Something went wrong. Please try again.');
    setTimeout(async () => {
      await load();
      setErrorText('');
    }, SUCCESS_DELAY_MS * 2);
  };

  const connectToMermaidClick = () => {
    if (!state.loginURL) {
      load();
      return;
    }
    analytics.trackConnectToMermaidChart();
    startSignIn({
      loginURL: state.loginURL,
      loginState: state.loginState,
      openUrl: (url) => router.open(url),
      remote: (path) => remote(path),
      onLogin: () => load(),
    });
  };

  const onLogout = async () => {
    showLoadingAnimation('Disconnecting...');
    try {
      await remote('/forge/logout', { method: 'POST' });
      await clearMermaidChartSession(state.MC_BASE_URL);
      analytics.trackLogout();
    } finally {
      await load();
      hideLoadingAnimation();
    }
  };

  const openModal = (context, size = 'max', onClose) => {
    new Modal({
      resource: 'dialog',
      size,
      context: { baseUrl: state.MC_BASE_URL, accessToken, ...context },
      onClose,
    }).open();
  };

  const showAlert = (message) => openModal({ mode: 'alert', message }, 'small');

  const saveChart = async (payload) => {
    if (!payload || !payload.chart) {
      return;
    }
    const chart = { ...payload.chart, diagramCode: '' };
    const exists = charts.some((c) => c.documentID === chart.documentID);
    if (payload.replace === false && exists) {
      showAlert('Chart already added.');
      return;
    }
    showLoadingAnimation();
    try {
      await remote('/forge/add-chart', {
        method: 'POST',
        body: { issueKey, chart, replace: payload.replace },
      });
      showSuccessAndRefresh('Diagram Inserted Successfully!');
    } catch (e) {
      if (e.status === 400 && e.message === 'Chart already added') {
        hideLoadingAnimation();
        showAlert('Chart already added.');
        return;
      }
      showErrorAndRefresh(e.message);
    }
  };

  const viewDiagramClick = (chart) => {
    openModal({ mode: 'view', image: chart });
  };

  const editDiagramClick = (chart, e) => {
    if (e) e.stopPropagation();
    if (!accessToken) {
      connectToMermaidClick();
      return;
    }
    analytics.trackPluginDiagramEdit();
    openModal({ mode: 'edit', image: chart }, 'max', saveChart);
  };

  const addChartClick = () => {
    if (!accessToken) {
      connectToMermaidClick();
      return;
    }
    openModal({ mode: 'select' }, 'max', saveChart);
  };

  const deleteDiagram = async (chart, e) => {
    if (e) e.stopPropagation();
    showLoadingAnimation('Deleting Diagram...');
    setState({ ...state, charts: charts.filter((c) => c.documentID !== chart.documentID) });
    try {
      await remote('/forge/delete-chart', {
        method: 'POST',
        body: { issueKey, documentID: chart.documentID },
      });
      showSuccessAndRefresh('Diagram Deleted Successfully!');
    } catch (err) {
      showErrorAndRefresh(err.message);
    }
  };

  const showOverlay = isLoading || isSuccess || Boolean(errorText);

  return html`
    <div class="header-block">
      <div class="header-left">
        ${accessToken &&
        html`<button class="add-diagram-btn" onClick=${addChartClick}>Add New Diagram</button>`}
        ${!accessToken &&
        html`<button class="connect-btn" onClick=${() => connectToMermaidClick()}>Connect to Mermaid</button>`}
      </div>
      <div class="header-right">
        ${accessToken &&
        html`<button class="disconnect-btn" onClick=${() => onLogout()}>Disconnect Mermaid</button>`}
      </div>
    </div>
    <div class="diagrams-grid">
      ${showOverlay &&
      html`<div class="loading-overlay">
        <div class="loading-card">
          ${isLoading && html`<div class="spinner"></div>`}
          ${isSuccess && html`<div class="success-icon">✓</div>`}
          <div class="loading-text">${errorText || loadingText}</div>
        </div>
      </div>`}

      ${accessToken &&
      charts.length === 0 &&
      !isLoading &&
      !isSuccess &&
      html`<div class="no-diagrams-container">
        <h3 class="no-diagrams-title">No diagrams yet</h3>
        <p class="no-diagrams-description">
          Connected to Mermaid, but no diagrams yet.<br />
          Add a <button class="new-diagram-link" onClick=${addChartClick}>New diagram</button> to get started.
        </p>
      </div>`}

      ${charts.map(
        (chart) => html`<div class="diagram-card" key=${chart.documentID}>
          <div class="card-content" onClick=${() => viewDiagramClick(chart)}>
            <${Thumbnail} chart=${chart} />
            <div class="button-frame ${!accessToken ? 'delete-only' : ''}">
              ${accessToken &&
              html`<button class="edit-overlay" onClick=${(e) => editDiagramClick(chart, e)} title="Edit diagram">
                Edit
              </button>`}
              <button class="delete-overlay" onClick=${(e) => deleteDiagram(chart, e)} title="Delete diagram">
                <img src="./trash-icon.svg" alt="Delete" />
              </button>
            </div>
          </div>
        </div>`,
      )}
    </div>
  `;
}

view.getContext().then((context) => {
  const issueKey = context?.extension?.issue?.key;
  render(html`<${App} issueKey=${issueKey} />`, document.getElementById('editor-content'));
});
