import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib";

export function Private({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const loc = useLocation();
  if (me) return <>{children}</>;
  return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
}
