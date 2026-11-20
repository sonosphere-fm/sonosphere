// Types shared by the server and the browser for site-wide things. Files in shared/ hold types only.
export type Role = "user" | "moderator" | "admin";
/** Site-wide switches an admin can change. */
export type Settings = { registrationsOpen: boolean; announcement: string; announcementTone: "info" | "warning"; announcementId: number; maxShoutLength: number };
