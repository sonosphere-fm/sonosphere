export type Role = "user" | "moderator" | "admin";
export type Settings = {
  registrationsOpen: boolean;
  announcement: string;
  announcementTone: "info" | "warning";
  announcementId: number;
  maxShoutLength: number;
};
