// Replaces Base44's get-game-html (which, like every Base44 function, stopped working
// once the Base44 integration allowance ran out). Same contract:
// { name } -> { html, id, title, genre, plays }. Runs the same checks as get-site-html
// (admin take-down, forms that send passwords/cards elsewhere) and counts the play.
import { json, base44 } from "../../../../../cloudflare-lib/published.js";
import { isBlocked } from "../../../../../cloudflare-lib/reports.js";
import { pageFor } from "../../../../../cloudflare-lib/pagesource.js";
import { removedPage, rebrand } from "../../../../../cloudflare-lib/pageserve.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { countPlay, totalPlays } from "../../../../../cloudflare-lib/plays.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.PUBLISHED_HTML;
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "");
    if (!name) return json({ error: "name required" }, 400);
    // The right copy and record for this name (copycat records are ignored; see pagesource.js).
    const page = await pageFor(request, kv, "game", name);
    if (!page) return json({ error: "not found" }, 404);
    const game = page.rec;
    // Base44's frozen count plus the players counted here (the record's own plays field can be
    // edited by its owner, so it isn't used; see totalPlays).
    const plays = (await totalPlays(kv, () => base44(request, "GET", "entities/PublishedGame?limit=1000")))[name] || 0;
    const reply = (html) => json({ html, id: game.id, title: game.title || game.name, genre: game.genre, plays });

    if (kv && (await isBlocked(kv, "game", name))) return reply(removedPage("game"));
    if (page.removed) return reply(removedPage("game", page.removed));
    let html = page.html;
    // Fix kept from the Base44 version: the player's 3D mesh was never moved in this game's loop.
    if (name === "shooting-io") {
      html = html.replace(
        "player.g.position.y=player.y;",
        "player.g.position.y=player.y;player.g.position.x=player.x;player.g.position.z=player.z;player.g.rotation.y=yaw;"
      );
    }
    const user = await currentUser(request);
    if (user) await countPlay(kv, name, user.id);
    return reply(rebrand(html));
  } catch (err) {
    return json({ error: (err && err.message) || "Could not load the game." }, 500);
  }
}
