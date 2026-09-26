// Stars: Nebulux Chat's rewards. Earned from quests (or bought), spent on looks in the Star shop.
export const DAILY_ORBS = 20;
export const ORBS_PER_MESSAGE = 1;
export const MAX_MESSAGE_ORBS_PER_DAY = 25;

// id -> { kind, name, price, value }
export const SHOP = {
  "color-gold": { kind: "name_color", name: "Gold name", price: 60, value: "#fbbf24" },
  "color-pink": { kind: "name_color", name: "Neon pink name", price: 60, value: "#f472b6" },
  "color-cyan": { kind: "name_color", name: "Cyan name", price: 60, value: "#22d3ee" },
  "color-green": { kind: "name_color", name: "Mint name", price: 60, value: "#4ade80" },
  "color-purple": { kind: "name_color", name: "Nebula purple name", price: 60, value: "#c084fc" },
  "color-red": { kind: "name_color", name: "Crimson name", price: 60, value: "#f87171" },
  "frame-glow": { kind: "frame", name: "Glow frame", price: 120, value: "glow" },
  "frame-stars": { kind: "frame", name: "Starry frame", price: 180, value: "stars" },
  "frame-fire": { kind: "frame", name: "Flame frame", price: 250, value: "fire" },
  "badge-star": { kind: "badge", name: "⭐ Star badge", price: 80, value: "⭐" },
  "badge-rocket": { kind: "badge", name: "🚀 Builder badge", price: 150, value: "🚀" },
  "badge-brain": { kind: "badge", name: "🧠 Brainy badge", price: 150, value: "🧠" },
  "badge-crown": { kind: "badge", name: "👑 Legend badge", price: 500, value: "👑" },
  "frame-rainbow": { kind: "frame", name: "Rainbow frame", price: 300, value: "rainbow" },
  "frame-ice": { kind: "frame", name: "Frost frame", price: 200, value: "ice" },
  "badge-game": { kind: "badge", name: "🎮 Gamer badge", price: 120, value: "🎮" },
  "badge-art": { kind: "badge", name: "🎨 Artist badge", price: 120, value: "🎨" },
  "badge-dragon": { kind: "badge", name: "🐉 Dragon badge", price: 250, value: "🐉" },
  "badge-unicorn": { kind: "badge", name: "🦄 Unicorn badge", price: 250, value: "🦄" },
  "badge-comet": { kind: "badge", name: "☄️ Comet badge", price: 400, value: "☄️" },
  // Profile banners: the strip at the top of your profile card.
  "banner-aurora": { kind: "banner", name: "Aurora banner", price: 150, value: "aurora" },
  "banner-sunset": { kind: "banner", name: "Sunset banner", price: 150, value: "sunset" },
  "banner-ocean": { kind: "banner", name: "Ocean banner", price: 150, value: "ocean" },
  "banner-space": { kind: "banner", name: "Deep space banner", price: 220, value: "space" },
  "banner-candy": { kind: "banner", name: "Candy banner", price: 220, value: "candy" },
  "banner-lava": { kind: "banner", name: "Lava banner", price: 300, value: "lava" },
  // Avatar decorations: a little something sitting on your avatar.
  "deco-crown": { kind: "deco", name: "Tiny crown", price: 350, value: "👑" },
  "deco-halo": { kind: "deco", name: "Halo", price: 250, value: "😇" },
  "deco-moon": { kind: "deco", name: "Orbiting moon", price: 200, value: "🌙" },
  "deco-sparkle": { kind: "deco", name: "Sparkles", price: 150, value: "✨" },
  "deco-cat": { kind: "deco", name: "Cat buddy", price: 200, value: "🐱" },
  "deco-rocket": { kind: "deco", name: "Rocket ride", price: 300, value: "🚀" },
  // Name effects: how your name looks in messages.
  "effect-shimmer": { kind: "effect", name: "Shimmer name", price: 400, value: "shimmer" },
  "effect-rainbow": { kind: "effect", name: "Rainbow name", price: 500, value: "rainbow" },
  "effect-glow": { kind: "effect", name: "Glowing name", price: 300, value: "glow" },
  "badge-plus": { kind: "badge", name: "💎 Plus badge (Pro and up)", price: 0, value: "💎", plusOnly: true },
};

export const FREE_COLORS = ["#e2e8f0", "#a5b4fc", "#93c5fd", "#fda4af", "#fde68a", "#a7f3d0"];
export const AVATAR_EMOJI = ["🌌", "🪐", "🚀", "⭐", "🌙", "☄️", "👾", "🤖", "🐱", "🐶", "🦊", "🐼", "🐸", "🦄", "🐉", "🎮", "🎨", "🎧", "⚽", "🏀", "🍕", "🌈", "🔥", "💎"];
export const AVATAR_BG = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#0ea5e9", "#334155"];

// Like Discord Nitro: Pro and up get these free, and more stars from quests.
export const PLUS_FREE = [...Object.keys(SHOP).filter((id) => SHOP[id].kind === "name_color"), "frame-glow", "badge-plus", "banner-aurora", "effect-glow"];
export const STAR_MULTIPLIER = { pro: 1.5, team: 2, enterprise: 2, secret: 2, admin: 2 };

// Stars for money (bought through the site's checkout, product ids credits-stars-<key>).
// Prices live in base44/functions/create-checkout; keep these in step.
export const STAR_PACKS = { 100: { stars: 100, price: "0.99" }, 300: { stars: 300, price: "1.99" }, 800: { stars: 800, price: "4.99" } };
