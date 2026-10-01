// Offline test: "Set up automatically" (Domain Connect) in functions/.../custom-domain.js — finding
// the domain's company, and the signed link to its Allow page. Run: node scripts/test-domain-connect.mjs
import { generateKeyPairSync, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { dcProvider, dcApplyUrl, DC } from "../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/custom-domain.js";

const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};

// A company (like GoDaddy) whose DNS answers Domain Connect, with our template switched on or not.
let templateOn = true;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.startsWith("https://cloudflare-dns.com/dns-query")) {
    const name = new URL(u).searchParams.get("name");
    const answers = name === "_domainconnect.mybakery.com" ? [{ type: 16, data: '"api.example-registrar.com/domainconnect"' }] : [];
    return new Response(JSON.stringify({ Answer: answers }));
  }
  if (u === "https://api.example-registrar.com/domainconnect/v2/mybakery.com/settings")
    return new Response(JSON.stringify({ providerName: "ExampleReg", providerDisplayName: "Example Registrar", urlSyncUX: "https://dcc.example-registrar.com/manage", urlAPI: "https://api.example-registrar.com/domainconnect" }));
  if (u === `https://api.example-registrar.com/domainconnect/v2/domainTemplates/providers/${DC.provider}/services/${DC.service}`)
    return new Response("{}", { status: templateOn ? 200 : 404 });
  return new Response("not found", { status: 404 });
};

let p = await dcProvider("mybakery.com");
assert(p && p.name === "Example Registrar" && p.urlSyncUX === "https://dcc.example-registrar.com/manage", "finds the company the domain is with");
templateOn = false;
p = await dcProvider("mybakery.com");
assert(p && p.unsupported, "says so when the company hasn't switched on our template yet");
assert((await dcProvider("nodc.com")) === null, "a company without automatic setup: manual records instead");

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const url = new URL(await dcApplyUrl({ urlSyncUX: "https://dcc.example-registrar.com/manage", hostname: "www.mybakery.com", token: "abc123", cfValue: "cf-999", site: "nova", pem: privateKey }));
assert(url.pathname === `/manage/v2/domainTemplates/providers/${DC.provider}/services/${DC.service}/apply`, "opens the template's Allow page");
const q = url.searchParams;
assert(q.get("domain") === "mybakery.com" && q.get("host") === "www", "the main domain and the www part are sent separately");
assert(q.get("token") === "abc123" && q.get("cfvalue") === "cf-999", "carries the values for both TXT records");
assert(q.get("redirect_uri") === "https://nebuluxai.com/chat?domainconnect=nova" && q.get("key") === "_dck1", "comes back to Nebulux, and names the key");
const signed = url.search.slice(1).split("&sig=")[0];
const v = createVerify("RSA-SHA256");
v.update(signed);
assert(v.verify(publicKey, q.get("sig"), "base64"), "the signature checks out with the public key (so the company trusts it)");

const apex = new URL(await dcApplyUrl({ urlSyncUX: "https://x.test", hostname: "mybakery.com", token: "t", cfValue: "", site: "nova", pem: privateKey }));
assert(!apex.searchParams.has("host"), "a main domain (no www) sends no host part");

const tpl = JSON.parse(readFileSync(new URL("../domainconnect/nebuluxai.com.website.json", import.meta.url), "utf8"));
assert(tpl.providerId === DC.provider && tpl.serviceId === DC.service && tpl.syncPubKeyDomain === "nebuluxai.com", "the template file matches the code");
const recs = tpl.records.map((r) => `${r.type} ${r.host} ${r.pointsTo || r.data}`);
assert(recs.includes("CNAME @ customers.nebuluxai.com") && recs.includes("TXT _nebulux-verify nebulux-verify=%token%") && recs.includes("TXT _cf-custom-hostname %cfvalue%"), "the template adds the CNAME and both TXT records");
