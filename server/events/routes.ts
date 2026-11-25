import { requireItem } from "../catalog/service";
import { confirmed, need, poster } from "../guards";
import { fail, oneOf, paging, Router, throttle } from "../http";
import { requireVisibleUser } from "../users/service";
import { norm, now } from "../util";
import * as repo from "./repo";
import { whereFrom } from "./where";
import { addEvent, eventPage } from "./service";
import type {
  AttendResult,
  EventCreated,
  EventList,
  EventOk,
  EventPage,
  EventPlaces,
  UserEvents,
} from "../../shared/events";

export const router = new Router();

const ANSWERS = ["going", "interested"] as const;

router.get<UserEvents>("/api/user/events", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  return { items: await repo.listEvents({ attendee: u.id }, c.user?.id, "desc", 100) };
});

/** Within 150 km, else 400 km, else anywhere in the same country. */
async function nearFilter(f: repo.Filter, headers: Headers): Promise<{ filter: repo.Filter; near: EventList["near"] }> {
  const at = whereFrom(headers);
  if (!at) return { filter: { ...f, id: -1 }, near: null };
  const tries: repo.Filter[] = [];
  if (at.lat !== null && at.lon !== null) {
    tries.push({ ...f, near: { lat: at.lat, lon: at.lon, km: 150 } });
    tries.push({ ...f, near: { lat: at.lat, lon: at.lon, km: 400 } });
  }
  tries.push({ ...f, country: at.country });
  let pick = tries.length - 1;
  for (let i = 0; i < pick; i++) {
    if (await repo.countEvents(tries[i]!)) {
      pick = i;
      break;
    }
  }
  return { filter: tries[pick]!, near: { city: at.city, country: at.country, wide: pick > 0 } };
}

router.get<EventList>("/api/events", async (c) => {
  const pg = paging(c.q, 30);
  const when = c.q.get("when");
  const past = when === "past";
  // upcoming lists keep an event for six hours after it starts
  let f: repo.Filter = past ? { before: now() } : { from: now() - 6 * 3600 };
  f.text = norm(c.q.get("q") || "");
  if (c.q.get("mine") && c.user) f.fanOf = c.user.id;
  let near: EventList["near"];
  if (when === "near") ({ filter: f, near } = await nearFilter(f, c.req.headers));
  const items = await repo.listEvents(f, c.user?.id, past ? "desc" : "asc", pg.limit, pg.offset);
  return { items, total: await repo.countEvents(f), near, ...pg };
});

router.get<EventPlaces>("/api/events/places", async (c) => {
  const field = oneOf(c.q.get("field"), ["venue", "city", "country"] as const) ?? fail(400, "unknownField");
  return { items: await repo.places(field, norm(c.q.get("q") || "").slice(0, 80)) };
});

router.get<EventPage>("/api/event/:id", (c) => eventPage(Number(c.params[0]), c.user));

router.post<EventCreated>("/api/events", async (c) => {
  const u = confirmed(poster(c));
  await throttle(`event:${u.id}`, 10, 86_400, "tooManyEventsToday");
  return { id: await addEvent(c.body, u) };
});

router.delete<EventOk>("/api/event/:id", async (c) => {
  const deleted = await repo.deleteOwnEvent(Number(c.params[0]), need(c).id);
  if (!deleted) fail(403, "onlyCreatorDeleteEvent");
  return { ok: true };
});

router.post<AttendResult>("/api/event/:id/attend", async (c) => {
  const u = confirmed(poster(c));
  const e = (await requireItem("event", c.params[0], ["event"])).row;
  const status = oneOf(c.body.status, ANSWERS);
  await repo.setAttendance(e.id, u.id, status);
  return { status };
});
