import { base44 } from "@/api/base44Client";

// Products a generated site sells are declared in its HTML as:
// <script type="application/json" id="nebulux-products">[{"id":"basic","name":"Basic","price":"9.99"}]</script>
// On publish we mirror them into SiteProduct so checkout prices come from the server, never the buyer.
export function parseProducts(html) {
  const m = (html || "").match(/<script[^>]*id=["'](?:nebulux|blackhole)-products["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[1]);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((p) => ({
        productId: String(p.id || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""),
        name: String(p.name || p.id || "Item"),
        price: String(p.price ?? ""),
        currency: String(p.currency || "USD"),
      }))
      .filter((p) => p.productId && parseFloat(p.price) >= 0.5);
  } catch {
    return [];
  }
}

export async function syncSiteProducts(siteName, html, user) {
  const wanted = parseProducts(html);
  const existing = await base44.entities.SiteProduct.filter({ siteName });
  const mine = (existing || []).filter((p) => p.created_by_id === user?.id);
  for (const p of wanted) {
    const cur = mine.find((x) => x.productId === p.productId);
    if (cur) await base44.entities.SiteProduct.update(cur.id, { ...p, siteName });
    else await base44.entities.SiteProduct.create({ ...p, siteName, creatorEmail: user?.email || "" });
  }
  for (const cur of mine) {
    if (!wanted.some((p) => p.productId === cur.productId)) await base44.entities.SiteProduct.delete(cur.id);
  }
  return wanted.length;
}