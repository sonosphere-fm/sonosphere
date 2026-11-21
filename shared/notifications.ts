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
/** POST /api/notifications/read */
export type NotificationsRead = { ok: true };
