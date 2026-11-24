import { bad, missing, type Body, type Viewer } from "../http";
import { shoutCount } from "../shouts/repo";
import { clean } from "../util";
import * as repo from "./repo";
import type { EventPage } from "../../shared/events";
import { countryName } from "../../shared/countries";

/** Adds the event with `creator` marked as going. Returns its id. */
export async function addEvent(b: Body, creator: Viewer): Promise<number> {
  const title = clean(b.title, 120);
  const venue = clean(b.venue, 120);
  const city = clean(b.city, 80);
  const givenCountry = clean(b.country, 80);
  const country = givenCountry && (countryName(givenCountry) || bad("pickCountryFromList"));
  const startsAt = Math.floor(Number(b.startsAt));
  const given: unknown[] = Array.isArray(b.artists) ? b.artists : String(b.artists || "").split(",");
  const artists = given
    .map((a) => clean(a))
    .filter(Boolean)
    .slice(0, 20);
  if (!venue || !city || !startsAt) bad("venueCityDateRequired");
  const headliner = artists[0] ?? bad("addLeastOneArtistLine");
  const url = clean(b.url, 300);
  if (url && !/^https?:\/\//i.test(url)) bad("linkMustStartHttpHttps");
  const description = String(b.description || "")
    .trim()
    .slice(0, 3000);
  const event = { title: title || `${headliner} at ${venue}`, venue, city, country, startsAt, description, url };
  return repo.createEvent(event, artists, creator.id);
}

export async function eventPage(id: number, viewer: Viewer | null): Promise<EventPage> {
  const [e] = await repo.listEvents({ id }, viewer?.id, "asc", 1);
  if (!e) return missing("eventNotFound");
  const going = await repo.attendees(e.id, "going");
  const interested = await repo.attendees(e.id, "interested");
  return {
    ...e,
    attendees: { going, interested },
    mine: !!viewer && viewer.username === e.creator,
    shoutCount: await shoutCount("event", e.id),
  };
}
