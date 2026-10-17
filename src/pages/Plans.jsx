import React from "react";
import { useNavigate } from "react-router-dom";
import Subscriptions from "@/components/Subscriptions";

export default function Plans() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden">
      <Subscriptions
        onFree={() => navigate("/chat")}
        onPro={() => navigate("/billing", { state: { productId: "pro", billing: new URLSearchParams(window.location.search).get("billing") || undefined } })}
        onTeam={() => navigate("/billing", { state: { productId: "team", billing: new URLSearchParams(window.location.search).get("billing") || undefined } })}
      />
    </div>
  );
}