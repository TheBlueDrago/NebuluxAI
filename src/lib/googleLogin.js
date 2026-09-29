// "Continue with Google": Nebulux's own Google sign-in (cloudflare-lib/auth.js googleStart /
// googleCallback). Google sends people back to this site, signed in, then on to `returnTo`.
export function googleLogin(returnTo = "/") {
  window.location.href = `/api/apps/auth/google/start?to=${encodeURIComponent(returnTo)}`;
}
