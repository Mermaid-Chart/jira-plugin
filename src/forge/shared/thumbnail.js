/**
 * Load a diagram's PNG attachment as the signed-in Jira user and return an object URL for <img>.
 *
 * The Connect panel used the attachment URL directly, which relied on the Jira session cookie.
 * A Forge Custom UI iframe runs on another origin, so fetch it with requestJira instead.
 * `redirect=false` returns the bytes rather than a redirect to the media host.
 * Returns null for a chart saved without an attachment.
 */
export async function loadThumbnail(attachmentId, { requestJira, createObjectURL }) {
  if (!attachmentId) {
    return null;
  }
  const res = await requestJira(`/rest/api/2/attachment/content/${encodeURIComponent(attachmentId)}?redirect=false`);
  if (!res.ok) {
    const err = new Error(`Failed to load attachment ${attachmentId} (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return createObjectURL(await res.blob());
}
