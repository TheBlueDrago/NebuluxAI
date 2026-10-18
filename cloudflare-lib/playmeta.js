// Link previews for shared games: /play/<name> is the app's page, so without this every
// shared game shows up in chat apps as plain "Nebulux AI". Rewrites the app's
// index.html title and share tags to name the game (see functions/play/[name].js).
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Games with a screenshot in public/game-thumbs/<name>.jpg (480x360) show it as the preview picture.
export const GAME_THUMBS = new Set(["fruit-seas", "sky-obby", "bed-brawl", "brawl-blitz", "storm-royale", "villain-battlegrounds"]);

export function withGameMeta(html, { title, genre, name: slug }) {
  const name = String(title || "").trim().slice(0, 80);
  if (!name) return html;
  const heading = `Play ${name}`;
  const text = `${genre ? `A ${String(genre).slice(0, 30)} game` : "A game"} made with Nebulux AI. Play it free in your browser, then make your own.`;
  // Function replacements: in a replacement string, "$1" in a name like "Win $100" means a matched part.
  const setMeta = (out, attr, key, value) =>
    out.replace(new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, "i"), (_, a, b) => a + esc(value) + b);
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${esc(`${name} · Nebulux AI`)}</title>`);
  out = setMeta(out, "property", "og:title", heading);
  out = setMeta(out, "property", "og:description", text);
  out = setMeta(out, "name", "description", text);
  if (GAME_THUMBS.has(slug)) {
    out = setMeta(out, "property", "og:image", `https://nebuluxai.com/game-thumbs/${slug}.jpg`);
    out = setMeta(out, "property", "og:image:width", "480");
    out = setMeta(out, "property", "og:image:height", "360");
    out = setMeta(out, "property", "og:image:alt", name);
  }
  return out;
}
