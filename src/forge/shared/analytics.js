const STORAGE_KEY = 'MERMAID_ANALYTICS_ID';

/**
 * Plugin usage events, sent from the browser to Mermaid Chart (/rest-api/plugins/pulse) with the
 * same names and fields as the Connect version. Failures are logged and never break the panel.
 */
export function createAnalytics({ getBaseUrl, fetchImpl, storage }) {
  let analyticsID;
  const getAnalyticsID = () => {
    if (analyticsID) {
      return analyticsID;
    }
    try {
      analyticsID = storage.getItem(STORAGE_KEY);
      if (!analyticsID) {
        analyticsID = crypto.randomUUID();
        storage.setItem(STORAGE_KEY, analyticsID);
      }
    } catch {
      // Storage can be blocked in the iframe; fall back to an id for this page only.
      analyticsID = analyticsID || crypto.randomUUID();
    }
    return analyticsID;
  };

  const sendEvent = (eventName, eventID, diagramType, userLoginState = false, diagramID) => {
    const base = getBaseUrl();
    if (!base) {
      return;
    }
    const payload = {
      analyticsID: getAnalyticsID(),
      eventName,
      eventID,
      diagramType,
      userLoginState,
      diagramID,
      pluginSource: 'jira',
    };
    fetchImpl(`${base}/rest-api/plugins/pulse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((error) => {
      console.error('Failed to send analytics event:', error);
    });
  };

  return {
    trackConnectToMermaidChart() {
      sendEvent('Jira Plugin User Logged In', 'JIRA_PLUGIN_LOGIN', undefined, true, undefined);
    },
    trackLogout() {
      sendEvent('Jira Plugin User Logged Out', 'JIRA_PLUGIN_LOGOUT', undefined, false, undefined);
    },
    trackPluginDiagramEdit() {
      sendEvent('Plugin diagram edit', 'PLUGIN_DIAGRAM_EDIT', 'unknown', true, 'unknown');
    },
  };
}
