import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { lazyRetry as lazy } from "@/lib/lazyRetry";

// Loaded only for signed-out visitors, so the app starts faster for everyone else.
const Landing = lazy(() => import("@/pages/Landing"));

// Signed-in people go straight to the chat; everyone else sees what Nebulux AI is.
export default function Home() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/chat" replace />;
  return <Landing />;
}
