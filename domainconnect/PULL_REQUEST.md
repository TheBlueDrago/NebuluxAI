# Add Nebulux AI website template (nebuluxai.com.website)

Nebulux AI (https://nebuluxai.com) lets people build websites with AI and publish them. This template
connects a customer's own domain (apex or a subdomain via the standard `host` parameter) to their
Nebulux AI website, served through Cloudflare for SaaS.

Records:
- CNAME `@` -> `customers.nebuluxai.com` (relative to `host`)
- TXT `_nebulux-verify` -> `nebulux-verify=%token%` (our ownership check; fixed prefix, txtConflictMatchingMode All)
- TXT `_cf-custom-hostname` -> `%cfvalue%` (Cloudflare for SaaS custom hostname ownership value)

Checklist notes:
- syncPubKeyDomain is set (`nebuluxai.com`, key `_dck1`); warnPhishing is not set.
- syncRedirectDomain is set (`nebuluxai.com`) because the sync flow uses redirect_uri.
- No variables in any host field; no %host%; no SPF.
- Bare variable `%cfvalue%`: justified. The `_cf-custom-hostname` TXT value is issued by Cloudflare
  for SaaS and must match exactly (a UUID with no prefix), so it can't carry a service-specific prefix.
  The host label is fixed, so the variable can only set that one Cloudflare-defined record.
