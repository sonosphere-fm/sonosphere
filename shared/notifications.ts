// Types shared by the server and the browser for notifications.
/**
 * Something that happened to the signed-in user. `data` holds the details for its `type`; `actor` is who did it
 * (both fields are null once that account is gone).
 */
export type Notification = {
  id: number; type: string; data: Record<string, unknown>; read: boolean; createdAt: number;
  actor: { username: string | null; image: string | null };
};
/** GET /api/notifications */
export type Notifications = { items: Notification[] };
/** What notification emails can be about, with how settings name them. */
export const EMAIL_KINDS = [
  ["follow", "Someone follows you"],
  ["shout", "Someone writes on your wall"],
  ["comment", "Someone comments on your journal"],
  ["message", "Someone sends you a message"],
] as const;
export type EmailKind = typeof EMAIL_KINDS[number][0];
/** How often notification emails go out. */
export const EMAIL_MODES = [["instant", "As it happens"], ["daily", "Daily digest"], ["weekly", "Weekly digest"], ["off", "Never"]] as const;
export type EmailMode = typeof EMAIL_MODES[number][0];
/** POST /api/notifications/read */
export type NotificationsRead = { ok: true };
