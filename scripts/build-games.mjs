// Builds the newer 3D games: games/src/<name>.html + the shared kit (games/src/kit.js, kit.css) ->
// games/<name>.html, one self-contained file per game (that's what gets published to the Arcade).
// In a game's source, /*KIT_CSS*/ inside <style> and /*KIT*/ inside <script> are replaced by the kit.
// Run: node scripts/build-games.mjs            (all of them)
//      node scripts/build-games.mjs <name>     (one)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const dir = new URL("../games/", import.meta.url);
const src = new URL("../games/src/", import.meta.url);
const kit = readFileSync(new URL("kit.js", src), "utf8");
const css = readFileSync(new URL("kit.css", src), "utf8");
const only = process.argv[2];
const names = readdirSync(src).filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5)).filter((n) => !only || n === only);
if (!names.length) { console.error("No game named", only); process.exit(1); }
for (const n of names) {
  const html = readFileSync(new URL(n + ".html", src), "utf8");
  if (!html.includes("/*KIT*/") || !html.includes("/*KIT_CSS*/")) { console.error(`${n}: needs /*KIT*/ and /*KIT_CSS*/`); process.exitCode = 1; continue; }
  // function replacements: the kit's own text has $ signs that a replacement string would read as codes
  const out = html.replace("/*KIT_CSS*/", () => css).replace("/*KIT*/", () => kit);
  writeFileSync(new URL(n + ".html", dir), out);
  console.log(`games/${n}.html  ${(out.length / 1024).toFixed(1)} KB`);
}
