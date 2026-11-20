import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib";

/** Wraps pages that need a logged-in user. */
export function Private({ children }: { children: ReactNode }) {
  const { me } = useAuth(), loc = useLocation();
  return me ? <>{children}</> : <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
}
