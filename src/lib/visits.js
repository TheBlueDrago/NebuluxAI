// Counts page visits and a few steps (functions/visit.js). Numbers only: no cookie, no id, nothing about
// the person. Honors "Do Not Track" and Global Privacy Control: those browsers aren't counted at all.
import { appParams } from "@/lib/app-params";

const off = () => {
  try {
    return navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true || navigator.webdriver === true || /[?&](test|mute)\b/.test(location.search);
  } catch {
    return true;
  }
};
const send = (body) => {
  if (off()) return;
  try {
    fetch(`/api/apps/${appParams.appId}/functions/visit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
  } catch { /* counting must never break a page */ }
};
let last = "";
// A page was opened. The first page of a visit is marked in this tab's own storage.
export function hit(path) {
  if (path === last) return;
  last = path;
  let first = false;
  try {
    first = !sessionStorage.getItem("nx_visit");
    if (first) sessionStorage.setItem("nx_visit", "1");
  } catch { /* private mode */ }
  send({ p: path, f: first });
}
// A step was taken ("signup-open", "play:neon-drift"). `once` counts it one time per browser.
export function mark(step, once = false) {
  if (once) {
    try {
      if (localStorage.getItem("nx_step_" + step)) return;
      localStorage.setItem("nx_step_" + step, "1");
    } catch { /* private mode */ }
  }
  send({ p: "@" + step });
}
