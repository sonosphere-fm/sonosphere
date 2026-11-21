// Signing in with another site (server/auth/oauth): the buttons on the log-in and join pages, and what the round trip
// reports back in ?oauth= when it could not finish. Providers come from the server, so a new one needs nothing here.
import { Button } from "../kit";
import type { OAuthProvider } from "../../shared/auth";

const start = (id: string, intent: "login" | "link", next?: string) =>
  `/api/auth/oauth/${id}/start?${new URLSearchParams({ intent, ...(next && next !== "/" ? { next } : {}) })}`;
export const oauthStart = start;
export { Mark as OAuthMark };

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

/** How each site's button looks: its own colour and mark. A site missing here gets a plain button. */
const BRAND: Record<string, { icon: string }> = {
  discord: { icon: "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" },
};
const Mark = ({ id }: { id: string }) => BRAND[id] ? <svg className="oauth-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d={BRAND[id]!.icon} /></svg> : null;

/** "Continue with Discord" and the like, for the log-in and join pages. Nothing when no provider is set up. */
export function OAuthButtons({ providers, next }: { providers: OAuthProvider[]; next: string }) {
  if (!providers.length) return null;
  return (
    <div className="oauth">
      {providers.map(p => <Button key={p.id} kind={`btn ghost oauth-btn oauth-${p.id}`} href={start(p.id, "login", next)}><Mark id={p.id} />Continue with {p.label}</Button>)}
      <p className="oauth-or muted small"><span>or</span></p>
    </div>
  );
}
