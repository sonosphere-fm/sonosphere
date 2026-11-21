// Types shared by the server and the browser for events (concerts and festivals).
import type { Paging, PublicUser } from "./users";

export type Attendance = "going" | "interested";
export type EventArtist = { name: string; image: string | null };
/**
 * An event in a list. `creator` is a username, or null once that account is gone; `going` and `interested` are
 * head counts; `status` is what the person looking has said about it.
 */
export type EventSummary = {
  id: number; title: string; venue: string; city: string; country: string; startsAt: number; description: string; url: string;
  creator: string | null; going: number; interested: number; status: Attendance | null; artists: EventArtist[];
};
export type EventList = { items: EventSummary[]; total: number } & Paging;
export type UserEvents = { items: EventSummary[] };
/** GET /api/event/:id. `mine` is true for the person who added the event. */
export type EventPage = EventSummary & { attendees: Record<Attendance, PublicUser[]>; mine: boolean; shoutCount: number };

export type EventCreated = { id: number };
export type EventOk = { ok: true };
export type AttendResult = { status: Attendance | null };
