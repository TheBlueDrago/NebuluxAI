import JSZip from "jszip";

// "Upload a ZIP" in the Website Designer: turns a website's ZIP (index.html plus its CSS, scripts
// and pictures) into the one HTML page the designer edits and publishes. Linked files are put
// inside the page (styles and scripts inline, pictures and fonts as data URLs).
const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", svg: "image/svg+xml", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", json: "application/json" };
const MAX_ZIP = 25 * 1024 * 1024;
const MAX_FILE = 4 * 1024 * 1024;

const isLocal = (u) => u && !/^(?:[a-z]+:|\/\/|#|data:)/i.test(u.trim());
const clean = (u) => u.trim().split(/[?#]/)[0];

function resolve(base, ref) {
  const parts = (ref.startsWith("/") ? ref.slice(1) : base + ref).split("/");
  const out = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
}

export async function zipToSite(file) {
  if (file.size > MAX_ZIP) throw new Error("That ZIP is too big (25 MB max).");
  const zip = await JSZip.loadAsync(file).catch(() => {
    throw new Error("That file isn't a ZIP we can open.");
  });
  const files = {};
  zip.forEach((path, f) => {
    if (!f.dir && !/(^|\/)(__MACOSX|\.)/.test(path)) files[path] = f;
  });
  const pages = Object.keys(files).filter((p) => /\.html?$/i.test(p));
  if (!pages.length) throw new Error("There's no HTML page in that ZIP.");
  const entry = pages.filter((p) => /(^|\/)index\.html?$/i.test(p)).sort((a, b) => a.length - b.length)[0] || pages.sort((a, b) => a.length - b.length)[0];
  const base = entry.includes("/") ? entry.slice(0, entry.lastIndexOf("/") + 1) : "";

  const find = (from, ref) => {
    const p = resolve(from, clean(ref));
    return files[p] ? p : null;
  };
  const dataUrl = async (path) => {
    const f = files[path];
    const ext = (path.split(".").pop() || "").toLowerCase();
    const bytes = await f.async("uint8array");
    if (bytes.length > MAX_FILE) return null;
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return `data:${TYPES[ext] || "application/octet-stream"};base64,${btoa(bin)}`;
  };
  // url(...) inside CSS, relative to the CSS file
  const inlineCssUrls = async (css, from) => {
    const refs = [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)];
    for (const m of refs) {
      if (!isLocal(m[2])) continue;
      const p = find(from, m[2]);
      const d = p && (await dataUrl(p));
      if (d) css = css.split(m[0]).join(`url("${d}")`);
    }
    return css;
  };

  let html = await files[entry].async("string");
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const l of [...doc.querySelectorAll('link[rel~="stylesheet"][href]')]) {
    const p = isLocal(l.getAttribute("href")) && find(base, l.getAttribute("href"));
    if (!p) continue;
    const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "";
    const st = doc.createElement("style");
    st.textContent = await inlineCssUrls(await files[p].async("string"), dir);
    l.replaceWith(st);
  }
  for (const s of [...doc.querySelectorAll("script[src]")]) {
    const p = isLocal(s.getAttribute("src")) && find(base, s.getAttribute("src"));
    if (!p) continue;
    s.removeAttribute("src");
    s.textContent = (await files[p].async("string")).replace(/<\/script/gi, "<\\/script");
  }
  for (const st of [...doc.querySelectorAll("style")]) st.textContent = await inlineCssUrls(st.textContent, base);
  for (const el of [...doc.querySelectorAll("[src],[poster],link[rel~='icon'][href],[style]")]) {
    for (const attr of ["src", "poster", "href"]) {
      const v = el.getAttribute(attr);
      if (!v || !isLocal(v) || (attr === "href" && el.tagName !== "LINK")) continue;
      const p = find(base, v);
      const d = p && !/\.html?$/i.test(p) && (await dataUrl(p));
      if (d) el.setAttribute(attr, d);
    }
    if (el.hasAttribute("style")) el.setAttribute("style", await inlineCssUrls(el.getAttribute("style"), base));
  }
  html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  const name = file.name.replace(/\.zip$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "my-website";
  return { name, html, otherPages: pages.length - 1 };
}
