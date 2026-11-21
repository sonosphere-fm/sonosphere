// Types shared by the server and the browser for events (concerts and festivals).
import type { Paging, PublicUser } from "./users";

export type Attendance = "going" | "interested";
export type EventArtist = { name: string; image: string | null };
/**
 * An event in a list. `creator` is a username, or null once that account is gone; `going` and `interested` are
 * head counts; `status` is what the person looking has said about it. `source` is "user" for events added here, else
 * where it was listed ("musicbrainz", "ticketmaster").
 */
export type EventSummary = {
  id: number; title: string; venue: string; city: string; country: string; startsAt: number; description: string; url: string;
  creator: string | null; source: string; going: number; interested: number; status: Attendance | null; artists: EventArtist[];
};
/** `near` is where the person looking seems to be (from their connection), for the events near them; null if unknown. */
export type EventList = { items: EventSummary[]; total: number; near?: { city: string; country: string; wide: boolean } | null } & Paging;
export type UserEvents = { items: EventSummary[] };
/** GET /api/event/:id. `mine` is true for the person who added the event. */
export type EventPage = EventSummary & { attendees: Record<Attendance, PublicUser[]>; mine: boolean; shoutCount: number };

export type EventCreated = { id: number };
export type EventOk = { ok: true };
export type AttendResult = { status: Attendance | null };
