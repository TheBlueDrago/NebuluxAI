// /play/<name>: the app's public game page, with the game's name in the link preview.
import { findByName } from "../../cloudflare-lib/published.js";
import { withGameMeta } from "../../cloudflare-lib/playmeta.js";
import { withAppHeaders } from "../../cloudflare-lib/pagemeta.js";

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const page = await env.ASSETS.fetch(new URL("/", request.url));
  const name = String(params.name || "").toLowerCase();
  if (!page.ok || !/^[a-z0-9.-]{1,63}$/.test(name)) return page;
  let game = null;
  try {
    // The oldest row: a copycat row with the same name (written straight into the database)
    // always comes later, and mustn't set this game's link preview.
    const rows = (await findByName(null, "game", name)).slice();
    rows.sort((a, b) => String(a.created_date || "").localeCompare(String(b.created_date || "")));
    game = rows[0] || null;
  } catch {
    // Base44 unreachable: the page still works, just with the plain preview.
  }
  if (!game) return page;
  const html = withGameMeta(await page.text(), { title: game.title || game.name, genre: game.genre, name: game.name });
  return new Response(html, { status: 200, headers: withAppHeaders(page.headers) });
}
