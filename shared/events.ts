import type { Paging, PublicUser } from "./users";

export type Attendance = "going" | "interested";
export type EventArtist = { name: string; image: string | null };
export type EventSummary = {
  id: number;
  title: string;
  venue: string;
  city: string;
  country: string;
  startsAt: number;
  description: string;
  url: string;
  creator: string | null;
  source: string;
  going: number;
  interested: number;
  status: Attendance | null;
  artists: EventArtist[];
};
export type EventList = {
  items: EventSummary[];
  total: number;
  near?: { city: string; country: string; wide: boolean } | null;
} & Paging;
export type UserEvents = { items: EventSummary[] };
export type EventPage = EventSummary & {
  attendees: Record<Attendance, PublicUser[]>;
  mine: boolean;
  shoutCount: number;
};

export type EventCreated = { id: number };
export type EventOk = { ok: true };
export type AttendResult = { status: Attendance | null };
export type EventPlace = { name: string; count: number; city?: string; country?: string };
export type EventPlaces = { items: EventPlace[] };
