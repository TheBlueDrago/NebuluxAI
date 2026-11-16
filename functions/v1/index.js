// The Nebulux API's front door: GET https://nebuluxai.com/v1/ says what the API has and where the docs are.
// No key needed and nothing private in it. (It answers during maintenance too, like the rest of /v1/.)
const INFO = {
  name: "Nebulux AI API",
  version: "v1",
  docs: "https://nebuluxai.com/api?tab=docs",
  auth: "Authorization: Bearer nx-sk-... (make a key at https://nebuluxai.com/api)",
  endpoints: [
    { method: "POST", path: "/v1/chat", about: "Send messages and get a reply. Body: { model?, messages: [{ role, content }], effort?, stream? }" },
  ],
  models: ["nebulux-ai", "galaxy", "space", "nebula"],
  limits: { requests_per_minute_per_key: 20, billing: "prepaid; each request is charged to that AI's balance" },
};
const H = { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "public, max-age=300" };
export const onRequestGet = () => new Response(JSON.stringify(INFO, null, 2), { headers: H });
export const onRequestOptions = () => new Response(null, { status: 204, headers: { ...H, "access-control-allow-methods": "GET, OPTIONS" } });
