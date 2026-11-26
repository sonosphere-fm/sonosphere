export const DISCORD_INVITE = "https://discord.gg/sonosphere";

export type DiscordStatus =
  | { enabled: false }
  | {
      enabled: true;
      linked: boolean;
      inServer: boolean;
      on: boolean;
      lastPlayAt: number | null;
    };
export type DiscordToggle = { on: boolean };

export type PresenceImage = "album" | "logo";
export const PRESENCE_DETAILS = ["trackArtist", "track", "artist"] as const;
export const PRESENCE_LAYOUTS = ["stacked", "inline"] as const;
export type PresenceDetails = (typeof PRESENCE_DETAILS)[number];
export type PresenceLayout = (typeof PRESENCE_LAYOUTS)[number];
export type PresencePreferences = {
  image: PresenceImage;
  details: PresenceDetails;
  layout: PresenceLayout;
  branding: boolean;
};
export type PresenceLink = PresencePreferences & { name: string; on: boolean; broken: boolean; since: number };
export type PresenceStatus = { enabled: false } | { enabled: true; linked: boolean; link: PresenceLink | null };
export type PresenceToggle = { on: boolean };
export type PresencePreferencesPatch = Partial<PresencePreferences>;
