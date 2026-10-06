// GitHub sends the person back here after they log in and authorize. The code is swapped for an
// access token (with the secret, which never leaves the server), the token is saved in this
// browser for Nebulux Code, and the window closes (or goes back to Code).
const page = (script, msg) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GitHub</title><body style="background:#0d0b1a;color:#e8e4ff;font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0"><p>${msg}</p><script>${script}</script>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": "gh_state=; Path=/github; Max-Age=0" } }
  );

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)gh_state=([^;]+)/);
  if (!code || !state || !cookie || cookie[1] !== state) return page("", "GitHub sign-in didn't finish. Close this and try again.");
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "Nebulux" },
    body: JSON.stringify({ client_id: String(env.GITHUB_CLIENT_ID || "").trim(), client_secret: String(env.GITHUB_CLIENT_SECRET || "").trim(), code, redirect_uri: new URL("/github/callback", request.url).toString() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) {
    // GitHub's own reason, so a setup mistake can be fixed (e.g. a wrong client secret).
    const why = {
      incorrect_client_credentials: "The GitHub client ID or secret saved in Cloudflare is wrong. Generate a new client secret on GitHub and save it again.",
      redirect_uri_mismatch: "The callback URL in your GitHub app settings must be exactly " + new URL("/github/callback", request.url).toString(),
      bad_verification_code: "That sign-in link expired. Close this and try again.",
    }[data.error] || (data.error_description || data.error || "No answer from GitHub (" + res.status + ")");
    return page("", "GitHub didn't give access: " + String(why).replace(/[<>&]/g, "") + "");
  }
  const t = JSON.stringify(data.access_token);
  return page(
    `try{localStorage.setItem("bh-github-token",${t})}catch(e){}try{window.opener&&window.opener.postMessage({type:"nx-github",token:${t}},location.origin)}catch(e){}setTimeout(function(){if(window.opener)window.close();else location.replace("/code")},400);`,
    "Connected to GitHub. You can close this window."
  );
}
