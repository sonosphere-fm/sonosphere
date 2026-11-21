// The other sites people can sign in with. Each one is an entry here and nothing else: the routes, the account linking
// and the settings page all work from this list. A provider is on when its client id and secret are set:
//   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET   from an application at discord.com/developers, with the redirect
//                                              <SITE_URL>/api/auth/oauth/discord/callback
// To add one (Google, GitHub, ...): register an app there with the matching redirect, add an entry below that turns
// its user info into a Profile, and set its two variables. Only providers that report whether the email is verified
// belong here: sign-in is refused without a verified address.

/** Who someone is at the provider. `subject` never changes for a person there; `name` is their current handle. */
export type Profile = { subject: string; name: string; email: string | null; emailVerified: boolean };

export type Provider = {
  id: string;
  /** As people know it, for buttons: "Continue with Discord". */
  label: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Sends a PKCE challenge with the request (providers that support it). */
  pkce: boolean;
  /** The person behind an access token. */
  profile: (accessToken: string) => Promise<Profile>;
};

const env = process.env;

const getJson = async (url: string, accessToken: string) => {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return (await r.json()) as Record<string, unknown>;
};

const ALL: Provider[] = [
  {
    id: "discord", label: "Discord",
    clientId: env.DISCORD_CLIENT_ID || "", clientSecret: env.DISCORD_CLIENT_SECRET || "",
    authorizeUrl: "https://discord.com/oauth2/authorize", tokenUrl: "https://discord.com/api/oauth2/token",
    scope: "identify email", pkce: false,
    async profile(token) {
      const u = await getJson("https://discord.com/api/users/@me", token);
      return {
        subject: String(u.id), name: String(u.username ?? ""),
        email: typeof u.email === "string" ? u.email.toLowerCase() : null,
        // Discord accounts can have an unconfirmed email (a phone number confirmed instead): only `true` counts
        emailVerified: u.verified === true,
      };
    },
  },
];

/** The providers that are set up on this server. */
export const PROVIDERS = ALL.filter(p => p.clientId && p.clientSecret);
export const providerById = (id: string) => PROVIDERS.find(p => p.id === id) ?? null;
/** The label for a provider id, even one since turned off (for accounts still linked to it). */
export const providerLabel = (id: string) => ALL.find(p => p.id === id)?.label ?? id;
