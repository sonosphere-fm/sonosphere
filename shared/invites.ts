import type { PublicUser } from "./users";

export type InviteLeader = PublicUser & { invited: number };
export type InviteBoard = { items: InviteLeader[]; mine: { link: string; invited: number } | null };
export type InviteFrom = { inviter: PublicUser };

// Discord role names the bot creates; renaming them in Discord afterwards is fine.
export const LINKED_ROLE = "Scrobbler";
export const INVITE_TIERS = [
  { invited: 1, role: "Inviter" },
  { invited: 5, role: "Recruiter" },
  { invited: 25, role: "Ambassador" },
] as const;
