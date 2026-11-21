// Events API: browse upcoming and past events, one event's page, adding and deleting events, and saying you will go.
import { requireItem } from "../catalog/service";
import { confirmed, need } from "../guards";
import { fail, oneOf, paging, Router, throttle } from "../http";
import { requireUser } from "../users/service";
import { norm, now } from "../util";
import * as repo from "./repo";
import { whereFrom } from "./where";
import { addEvent, eventPage } from "./service";
import type { AttendResult, EventCreated, EventList, EventOk, EventPage, EventPlaces, UserEvents } from "../../shared/events";

export const router = new Router();

const ANSWERS = ["going", "interested"] as const;

router.get<UserEvents>("/api/user/events", async c => {
  const u = await requireUser(c.q.get("name"));
  return { items: await repo.listEvents({ attendee: u.id }, c.user?.id, "desc", 100) };
});

router.get<EventList>("/api/events", async c => {
  const pg = paging(c.q, 30), when = c.q.get("when"), past = when === "past";
  // upcoming lists keep an event for six hours after it starts
  let f: repo.Filter = past ? { before: now() } : { from: now() - 6 * 3600 };
  f.text = norm(c.q.get("q") || "");
  if (c.q.get("mine") && c.user) f.fanOf = c.user.id;
  let near: EventList["near"];
  if (when === "near") {
    // within 150 km, else 400 km, else anywhere in the same country
    const at = whereFrom(c.req.headers);
    if (at) {
      const tries: repo.Filter[] = at.lat !== null && at.lon !== null
        ? [{ ...f, near: { lat: at.lat, lon: at.lon, km: 150 } }, { ...f, near: { lat: at.lat, lon: at.lon, km: 400 } }] : [];
      tries.push({ ...f, country: at.country });
      let pick = tries.length - 1;
      for (let i = 0; i < pick; i++) if (await repo.countEvents(tries[i]!)) { pick = i; break; }
      f = tries[pick]!;
      near = { city: at.city, country: at.country, wide: pick > 0 };
    } else { f = { ...f, id: -1 }; near = null; } // nowhere known: nothing near
  }
  return { items: await repo.listEvents(f, c.user?.id, past ? "desc" : "asc", pg.limit, pg.offset), total: await repo.countEvents(f), near, ...pg };
});

router.get<EventPlaces>("/api/events/places", async c => {
  const field = oneOf(c.q.get("field"), ["venue", "city", "country"] as const) ?? fail(400, "Unknown field");
  return { items: await repo.places(field, norm(c.q.get("q") || "").slice(0, 80)) };
});
router.get<EventPage>("/api/event/:id", c => eventPage(Number(c.params[0]), c.user));

router.post<EventCreated>("/api/events", async c => {
  const u = confirmed(need(c));
  await throttle(`event:${u.id}`, 10, 86_400, "You can add up to 10 events a day.");
  return { id: await addEvent(c.body, u) };
});

router.delete<EventOk>("/api/event/:id", async c => {
  if (!(await repo.deleteOwnEvent(Number(c.params[0]), need(c).id))) fail(403, "Only the creator can delete an event");
  return { ok: true };
});

router.post<AttendResult>("/api/event/:id/attend", async c => {
  const u = confirmed(need(c)), e = (await requireItem("event", c.params[0], ["event"])).row;
  const status = oneOf(c.body.status, ANSWERS);
  await repo.setAttendance(e.id, u.id, status);
  return { status };
});
