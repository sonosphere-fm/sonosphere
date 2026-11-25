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
