import React from "react";
import { PACK_SIZES, PACK_PRICES } from "../../../cloudflare-lib/creditPacks.js";

const TIERS = [
  ["ai", "Nebulux AI"],
  ["aiCode", "Nebulux Code"],
  ["galaxy5", "Space"],
  ["space5", "Nebula"],
];
const money = (p) => `$${Number(p) % 1 ? Number(p).toFixed(2) : Number(p)}`;

// One-time credit packs for the public pages, from the same prices checkout uses
// (cloudflare-lib/creditPacks.js). Bought in the app's Shop.
export default function CreditPacksTable() {
  return (
    <div className="rounded-3xl bg-slate-900/60 border border-slate-700/50 p-5 sm:p-6">
      <h3 className="text-xl font-bold text-white">Credit packs</h3>
      <p className="mt-1 text-sm text-slate-400">
        Need a few more credits without a plan? Buy a one-time pack for any AI. They don't reset at the end of the month, and get used before your monthly credits.
      </p>
      {/* On narrow phones the table scrolls sideways; focusable so keyboards can scroll it too. */}
      <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Credit pack prices">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="py-2 pr-3 font-medium">AI</th>
              {PACK_SIZES.map((n) => (
                <th key={n} className="py-2 px-2 font-medium text-right">{n} credits</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIERS.map(([tier, name]) => (
              <tr key={tier} className="border-t border-slate-800">
                <td className="py-2 pr-3 text-slate-200">{name}</td>
                {PACK_SIZES.map((n) => (
                  <td key={n} className="py-2 px-2 text-right text-white font-medium">{money(PACK_PRICES[tier][n])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
