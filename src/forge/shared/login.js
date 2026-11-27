let stopActive = null;

/**
 * Start Mermaid Chart sign-in: open the login page and poll /forge/check_token until the
 * server has the token (the /callback route stores it), then call onLogin(token, user).
 *
 * Custom UI iframes are sandboxed without allow-popups, so window.open is blocked; `openUrl`
 * is @forge/bridge's router.open. Polling stops after `timeoutMs` if sign-in is abandoned,
 * and starting sign-in again stops the earlier poll. Returns a function that stops polling.
 */
export function startSignIn({
  loginURL,
  loginState,
  openUrl,
  remote,
  onLogin,
  intervalMs = 500,
  timeoutMs = 10 * 60 * 1000,
  now = Date.now,
}) {
  if (stopActive) {
    stopActive();
  }

  let timer = null;
  let stopped = false;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    if (stopActive === stop) {
      stopActive = null;
    }
  };
  stopActive = stop;

  openUrl(loginURL);

  const deadline = now() + timeoutMs;
  const poll = async () => {
    if (stopped) {
      return;
    }
    try {
      const body = await remote(`/forge/check_token?state=${encodeURIComponent(loginState)}`);
      if (stopped) {
        return;
      }
      stop();
      onLogin(body.token, body.user);
    } catch {
      if (!stopped && now() < deadline) {
        timer = setTimeout(poll, intervalMs);
      } else {
        stop();
      }
    }
  };
  timer = setTimeout(poll, intervalMs);
  return stop;
}
