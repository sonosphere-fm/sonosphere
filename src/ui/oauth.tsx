// Signing in with another site (server/auth/oauth): the buttons on the log-in and join pages, and what the round trip
// reports back in ?oauth= when it could not finish. Providers come from the server, so a new one needs nothing here.
import { Button } from "../kit";
import type { OAuthProvider } from "../../shared/auth";

const start = (id: string, intent: "login" | "link", next?: string) =>
  `/api/auth/oauth/${id}/start?${new URLSearchParams({ intent, ...(next && next !== "/" ? { next } : {}) })}`;
export const oauthStart = start;

/** Why a round trip failed, by the code in ?oauth=. */
export const OAUTH_ERRORS: Record<string, string> = {
  off: "Signing in with that site isn't available right now.",
  expired: "That sign-in took too long, or was started in another browser. Try again.",
  cancelled: "Sign-in was cancelled.",
  failed: "Something went wrong talking to the other site. Try again in a moment.",
  unverified: "The email address on that account isn't verified. Verify it there first, then try again.",
  taken: "That account is already connected to a different account here.",
  already: "You already have an account from that site connected. Disconnect it first.",
  email: "An account here already uses that email address. Log in with your password, then connect it from Settings → Account.",
  banned: "This account has been banned.",
};

/** "Continue with Discord" and the like, for the log-in and join pages. Nothing when no provider is set up. */
export function OAuthButtons({ providers, next }: { providers: OAuthProvider[]; next: string }) {
  if (!providers.length) return null;
  return (
    <div className="oauth">
      {providers.map(p => <Button key={p.id} kind="btn ghost oauth-btn" href={start(p.id, "login", next)}>Continue with {p.label}</Button>)}
      <p className="oauth-or muted small"><span>or</span></p>
    </div>
  );
}
