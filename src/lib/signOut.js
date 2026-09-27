// Signing out on this site. Base44's own logout (base44.auth.logout) sends the browser to
// blackhole-ai.base44.app to clear its cookies, and Base44 then ignores where to come back to
// and leaves people on its old copy of the app. This site signs in with a token saved in the
// browser (no cookies: the /api proxy passes none), so removing that token is signing out.
// "bh-me" is who was signed in (lib/AuthContext.jsx), kept to open the app faster.
const TOKEN_KEYS = ["base44_access_token", "token", "bh-me"];

export function clearSignIn() {
  for (const key of TOKEN_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked: nothing saved.
    }
  }
}

// A full page load (not a router move) so nothing from the old session stays in memory. Signing
// out lands on the homepage.
export function signOut(to = "/") {
  clearSignIn();
  window.location.replace(to);
}

// The saved sign-in stopped working (expired or revoked): go to this site's sign-in page and
// come back here afterwards. On a sign-in page already, just reload without the old token.
export function signInAgain() {
  clearSignIn();
  const { pathname, search } = window.location;
  if (/^\/(login|register|forgot-password|reset-password)(\/|$)/.test(pathname)) window.location.replace(pathname + search);
  else window.location.replace("/login?returnTo=" + encodeURIComponent(pathname + search));
}
