// `subject` never changes for a person; `name` is their current handle.
export type Profile = { subject: string; name: string; email: string | null; emailVerified: boolean };

export type Provider = {
  id: string;
  label: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  pkce: boolean;
  profile: (accessToken: string) => Promise<Profile>;
};

const env = process.env;

const getJson = async (url: string, accessToken: string) => {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return (await r.json()) as Record<string, unknown>;
};

const ALL: Provider[] = [
  {
    id: "discord",
    label: "Discord",
    clientId: env.DISCORD_CLIENT_ID || "",
    clientSecret: env.DISCORD_CLIENT_SECRET || "",
    authorizeUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    scope: "identify email",
    pkce: false,
    async profile(token) {
      const u = await getJson("https://discord.com/api/users/@me", token);
      return {
        subject: String(u.id),
        name: String(u.username ?? ""),
        email: typeof u.email === "string" ? u.email.toLowerCase() : null,
        // Discord accounts can have an unconfirmed email (a phone number confirmed instead): only `true` counts
        emailVerified: u.verified === true,
      };
    },
  },
  {
    id: "google",
    label: "Google",
    clientId: env.GOOGLE_CLIENT_ID || "",
    clientSecret: env.GOOGLE_CLIENT_SECRET || "",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email",
    pkce: true,
    async profile(token) {
      const u = await getJson("https://openidconnect.googleapis.com/v1/userinfo", token);
      const email = typeof u.email === "string" ? u.email.toLowerCase() : null;
      return {
        subject: String(u.sub),
        name: email ?? "",
        email,
        emailVerified: u.email_verified === true,
      };
    },
  },
];

export const PROVIDERS = ALL.filter((p) => p.clientId && p.clientSecret);
export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id) ?? null;
// Looks in ALL so accounts still linked to a provider since turned off get its label.
export const providerLabel = (id: string) => ALL.find((p) => p.id === id)?.label ?? id;
