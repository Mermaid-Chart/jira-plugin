const MAX_REDIRECTS = 3;
const MERMAID_HOST = /(^|\.)(mermaidchart\.com|mermaid\.ai)$/;

/**
 * fetch for Mermaid Chart calls that carry the user's token.
 *
 * mermaidchart.com routes 301 to mermaid.ai, and fetch drops the Authorization header when it
 * follows a redirect to another host. Follow redirects here instead, resending the same request
 * only to https Mermaid Chart hosts. Any other redirect is returned to the caller unfollowed.
 */
export async function mcFetch(url, init = {}, fetchImpl = fetch) {
  let current = url;
  let response = await fetchImpl(current, { ...init, redirect: 'manual' });

  for (let hops = 0; hops < MAX_REDIRECTS; hops++) {
    const location = response.status >= 300 && response.status < 400 && response.headers.get('location');
    if (!location) {
      return response;
    }
    const target = new URL(location, current);
    if (target.protocol !== 'https:' || !MERMAID_HOST.test(target.hostname)) {
      return response;
    }
    current = target.href;
    response = await fetchImpl(current, { ...init, redirect: 'manual' });
  }
  return response;
}
