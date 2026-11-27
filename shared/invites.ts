import type { PublicUser } from "./users";

export type InviteLeader = PublicUser & { invited: number };
export type InviteBoard = { items: InviteLeader[]; mine: { link: string; invited: number } | null };
export type InviteFrom = { inviter: PublicUser };

// Discord role names the bot creates; renaming them in Discord afterwards is fine.
export const LINKED_ROLE = { role: "Scrobbler", color: "#ffd257" } as const;
export const INVITE_TIERS = [
  { invited: 1, role: "Inviter", color: "#57d9a3", cosmetics: ["frame.vinyl", "scrob.notes"], earlyAccess: false },
  { invited: 5, role: "Recruiter", color: "#5468ff", cosmetics: ["name.shimmer", "fx.fireflies"], earlyAccess: true },
  { invited: 25, role: "Ambassador", color: "#ff7a59", cosmetics: ["acc.crown", "name.halo"], earlyAccess: true },
] as const;

export const tierFor = (invited: number) => INVITE_TIERS.filter((t) => invited >= t.invited).length - 1;
