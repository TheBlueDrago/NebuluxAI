// Offline test for the newer 3D games (games/src + scripts/build-games.mjs): each built games/<name>.html
// is up to date with its source and the shared kit, and its code compiles (a broken script means the
// Play button does nothing: see the Villain Battlegrounds slip of 2026-10-17). Run: node scripts/test-games-build.mjs
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const src = new URL("../games/src/", import.meta.url), dir = new URL("../games/", import.meta.url);
const kit = readFileSync(new URL("kit.js", src), "utf8"), css = readFileSync(new URL("kit.css", src), "utf8");
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
}
