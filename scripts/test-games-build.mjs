// Offline test for the newer 3D games (games/src + scripts/build-games.mjs): each built games/<name>.html
// is up to date with its source and the shared kit, and its code compiles (a broken script means the
// Play button does nothing: see the Villain Battlegrounds slip of 2026-10-17). Run: node scripts/test-games-build.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import vm from "node:vm";

const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const src = new URL("../games/src/", import.meta.url), dir = new URL("../games/", import.meta.url);
const kit = readFileSync(new URL("kit.js", src), "utf8"), css = readFileSync(new URL("kit.css", src), "utf8");
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const boardJs = read("../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/game-board.js"), boardsJsx = read("../src/components/GameBoards.jsx");
const thumbsApp = read("../src/lib/gameThumbs.js"), thumbsMeta = read("../cloudflare-lib/playmeta.js");
const names = readdirSync(src).filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5));
assert(names.length > 0, `there are games to build (${names.join(", ")})`);
for (const n of names) {
  const source = readFileSync(new URL(n + ".html", src), "utf8");
  const built = readFileSync(new URL(n + ".html", dir), "utf8");
  assert(built === source.replace("/*KIT_CSS*/", () => css).replace("/*KIT*/", () => kit), `${n}: games/${n}.html is built from its source and the current kit (run node scripts/build-games.mjs)`);
  const code = [...built.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let ok = code.length > 0;
  for (const c of code) {
    try { new vm.Script(c); } catch (e) { ok = false; console.error(`   ${n}: ${e.message}`); }
  }
  assert(ok, `${n}: its code compiles`);
  assert(/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js/.test(built) && !/<script src="(?!https:\/\/cdnjs\.cloudflare\.com)/.test(built), `${n}: loads only three.js from cdnjs (nothing else from outside)`);
  assert(/name="viewport"/.test(built) && /id="touch"/.test(built), `${n}: works on phones (viewport and touch controls)`);
  assert(/<\/script>\s*<\/body>\s*<\/html>\s*$/.test(source), `${n}: the page is whole (it ends with </script></body></html>)`);
  // its leaderboards are known to the server and the app, and it has an Arcade screenshot
  const sent = [...new Set([...source.matchAll(/sendScore\("([a-z]+)"/g)].map((m) => m[1]))];
  const boardsLine = (boardJs.match(new RegExp(`"${n}": \\[([^\\]]*)\\]`)) || [])[1] || "";
  assert(sent.every((b) => boardsLine.includes(`"${b}"`)), `${n}: its leaderboards (${sent.join(", ") || "none"}) are in game-board.js BOARDS`);
  assert(sent.every((b) => new RegExp(`"${n}": \\[[^\\n]*\\["${b}"`).test(boardsJsx)), `${n}: and in GameBoards.jsx`);
  assert(existsSync(new URL(`../public/game-thumbs/${n}.jpg`, import.meta.url)) && thumbsApp.includes(`"${n}"`) && thumbsMeta.includes(`"${n}"`), `${n}: has a screenshot in public/game-thumbs and both GAME_THUMBS lists`);
}
