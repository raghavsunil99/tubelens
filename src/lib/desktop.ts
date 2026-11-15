// Settings for running inside the TubeLens desktop app (Electron shell).
// Plain functions only, so middleware (Edge runtime) can use them too.

/** True when the server was started by the desktop app, which serves http://localhost only. */
export const desktopMode = () => process.env.TUBELENS_DESKTOP === "1";

/**
 * Whether cookies carry the Secure flag. Production web deployments are
 * https; the desktop app is plain http on localhost, where a Secure cookie
 * would never be sent back.
 */
export const cookieSecure = () => process.env.NODE_ENV === "production" && !desktopMode();

/** Cookie that carries the desktop app's one-time code through Google's redirect. */
export const DESKTOP_NONCE_COOKIE = "tl_desktop_nonce";
