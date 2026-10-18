// Games with a real screenshot in public/game-thumbs/<name>.jpg (480x360); the rest show
// their genre's picture. Shared link previews use the same list (cloudflare-lib/playmeta.js).
export const GAME_THUMBS = new Set(["fruit-seas", "sky-obby", "bed-brawl", "brawl-blitz", "storm-royale", "villain-battlegrounds"]);
export const gameThumb = (name) => (GAME_THUMBS.has(name) ? `/game-thumbs/${name}.jpg` : "");
