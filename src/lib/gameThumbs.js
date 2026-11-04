// Games with a real screenshot in public/game-thumbs/<name>.jpg (480x360); the rest show
// their genre's picture. Shared link previews use the same list (cloudflare-lib/playmeta.js).
export const GAME_THUMBS = new Set(["fruit-seas", "sky-obby", "bed-brawl", "brawl-blitz", "storm-royale", "villain-battlegrounds", "midnight-manor", "block-factory-tycoon", "block-tower-defense", "gem-mine-simulator", "disaster-island", "block-kart-racers", "hide-and-seek-town", "color-drop-party", "reel-rush-fishing", "parry-arena", "block-league-soccer", "burger-rush-diner", "block-school-escape"]);
export const gameThumb = (name) => (GAME_THUMBS.has(name) ? `/game-thumbs/${name}.jpg` : "");
