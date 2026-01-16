import httpClient from './httpClient.js';

class Analytics {

    constructor() {
    this.analyticsID = getAnalyticsID();
  }

  sendEvent(eventName, eventID,diagramType, userLoginState = false, diagramID) {
    const payload = {
      analyticsID: this.analyticsID,
      eventName,
      eventID,
      diagramType,
      userLoginState: userLoginState,
      diagramID,
      pluginSource: 'jira'
    };

    httpClient.post('/rest-api/plugins/pulse', payload).catch((error) => {
      console.error('Failed to send analytics event:', error);
    });
  }

     trackConnectToMermaidChart() {
    this.sendEvent(
      'Jira Plugin User Logged In',
      'JIRA_PLUGIN_LOGIN',
      undefined,
      true,
      undefined
    );
  }

  trackLogout() {
    this.sendEvent(
      'Jira Plugin User Logged Out',
      'JIRA_PLUGIN_LOGOUT',
      undefined,
      false,
      undefined
    );
  }


  trackPluginDiagramEdit() {
    this.sendEvent(
      'Plugin diagram edit',
      'PLUGIN_DIAGRAM_EDIT',
      "unknown",
      true,
      "unknown"
    );
  }

}

function getAnalyticsID() {
  const STORAGE_KEY = 'MERMAID_ANALYTICS_ID';

  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
export default new Analytics();