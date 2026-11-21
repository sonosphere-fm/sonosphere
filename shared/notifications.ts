export type Notification = {
  id: number; type: string; data: Record<string, unknown>; read: boolean; createdAt: number;
  actor: { username: string | null; image: string | null };
};
export type Notifications = { items: Notification[] };
export const EMAIL_KINDS = [
  ["follow", "Someone follows you"],
  ["shout", "Someone writes on your wall"],
  ["comment", "Someone comments on your journal"],
  ["message", "Someone sends you a message"],
] as const;
export type EmailKind = typeof EMAIL_KINDS[number][0];
export const EMAIL_MODES = [
  ["instant", "As it happens"],
  ["daily", "Daily digest"],
  ["weekly", "Weekly digest"],
  ["off", "Never"],
] as const;
export type NotificationsRead = { ok: true };
