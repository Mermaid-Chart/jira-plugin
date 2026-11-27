const MERMAID_HOST = /(^|\.)(mermaidchart\.com|mermaid\.ai)$/;

/**
 * Only Mermaid Chart pages may post a diagram to the dialog: https mermaidchart.com / mermaid.ai
 * hosts, or the configured Mermaid Chart origin (local dev).
 */
export function isMermaidOrigin(origin, baseUrl) {
  try {
    if (baseUrl && origin === new URL(baseUrl).origin) {
      return true;
    }
    const url = new URL(origin);
    return url.protocol === 'https:' && MERMAID_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * What a message from the Mermaid Chart iframe asks the dialog to do (same messages as Connect:
 * plugin.js posts `{action: 'save', data}`; the Jira back button posts `mermaid-chart-jira-back`).
 */
export function interpretMessage(data) {
  if (!data || typeof data !== 'object') {
    return { type: 'ignore' };
  }
  if (data.type === 'mermaid-chart-jira-back' && data.action === 'navigateBack') {
    return { type: 'back' };
  }
  if (data.action === 'save' && data.data && typeof data.data === 'object') {
    return { type: 'save', chart: data.data };
  }
  // 'cancel' did nothing in the Connect dialogs, and 'logout' called an undefined handler.
  return { type: 'ignore' };
}

/** The Mermaid Chart page shown in the dialog, signed in through /oauth/frame (same URLs as Connect). */
export function buildFrameUrl(baseUrl, accessToken, mode, image) {
  const redirect =
    mode === 'edit'
      ? `/app/projects/${image.projectID}/diagrams/${image.documentID}/version/v${image.major}.${image.minor}/edit?pluginSource=jira`
      : `/app/plugins/confluence/select?pluginSource=jira`;
  return `${baseUrl}/oauth/frame/?token=${accessToken}&redirect=${redirect}`;
}
