// Rules for events: what a new event must have, and how one event's page is put together.
import { bad, missing, type Body, type Viewer } from "../http";
import { shoutCount } from "../shouts/repo";
import { clean } from "../util";
import * as repo from "./repo";
import type { EventPage } from "../../shared/events";

/** Checks a submitted event and adds it, with `creator` marked as going. Returns its id. */
export async function addEvent(b: Body, creator: Viewer): Promise<number> {
  const title = clean(b.title, 120), venue = clean(b.venue, 120), city = clean(b.city, 80), country = clean(b.country, 80), startsAt = Math.floor(Number(b.startsAt));
  const given: unknown[] = Array.isArray(b.artists) ? b.artists : String(b.artists || "").split(",");
  const artists = given.map(a => clean(a)).filter(Boolean).slice(0, 20);
  if (!venue || !city || !startsAt) bad("Venue, city and date are required");
  const headliner = artists[0] ?? bad("Add at least one artist to the line-up");
  const url = clean(b.url, 300);
  if (url && !/^https?:\/\//i.test(url)) bad("Link must start with http:// or https://");
  const description = String(b.description || "").trim().slice(0, 3000);
  return repo.createEvent({ title: title || `${headliner} at ${venue}`, venue, city, country, startsAt, description, url }, artists, creator.id);
}

/** Everything on one event's page, or a 404. */
export async function eventPage(id: number, viewer: Viewer | null): Promise<EventPage> {
  const [e] = await repo.listEvents({ id }, viewer?.id, "asc", 1);
  if (!e) return missing("Event");
  return {
    ...e, attendees: { going: await repo.attendees(e.id, "going"), interested: await repo.attendees(e.id, "interested") },
    mine: !!viewer && viewer.username === e.creator, shoutCount: await shoutCount("event", e.id),
  };
}
