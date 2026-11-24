import { Ico } from "../icons";
import { lazy, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Input, Textarea, useConfirm } from "../kit";
import { Markdown } from "../md";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, dateTime, num, qs, TITLES, useApi, useAuth, useParam, userUrl, useTitle } from "../lib";
import type {
  Attendance,
  AttendResult,
  EventCreated,
  EventList as Events,
  EventOk,
  EventPage as EventData,
} from "../../shared/events";
import { Async, Pager, Section, Stat, useAction } from "../ui/base";
import { EventList } from "../ui/events";
import { Grid, UserList } from "../ui/lists";
import { Shoutbox } from "../ui/shoutbox";
import { DatePicker } from "../datepicker";
import { Hero } from "./music/shared";
import { t, tx } from "../i18n";

// Acts that would plausibly share a bill, one picked per page load for the placeholder.
const LINEUPS = [
  "Jane Remover, underscores",
  "SpaceGhostPurrp, Metro Zu",
  "Ruben Slikk, Lofty305",
  "Nell, Ruben Slikk",
  "Lana Del Rey, Frank Ocean",
  "Ariana Grande, Lana Del Rey",
];
const LINEUP_HINT = LINEUPS[Math.floor(Math.random() * LINEUPS.length)];

// The place fields carry every flag, so only the add form loads them.
const PlaceInput = lazy(() => import("../ui/country").then((m) => ({ default: m.PlaceInput })));
const CountryInput = lazy(() => import("../ui/country").then((m) => ({ default: m.CountryInput })));

function NearNote({ near }: { near: Events["near"] }) {
  if (!near) return <p className="muted small">{t("events.nearUnknown")}</p>;
  const place = near.city ? `${near.city}, ${near.country}` : near.country;
  return <p className="muted small">{t(near.wide ? "events.nearWide" : "events.near", { place })}</p>;
}

export function EventsPage() {
  const [sp] = useSearchParams();
  const { me } = useAuth();
  const [when, setWhen] = useParam("when", "upcoming");
  const [mine, setMine] = useParam("mine");
  const [term, setTerm] = useParam("q");
  const [text, setText] = useState(term);
  const q = useApi<Events>(
    `/events${qs({ when: when === "upcoming" ? undefined : when, mine, q: term, page: sp.get("page") })}`
  );
  useTitle(TITLES.events);

  const filter = (e: FormEvent) => {
    e.preventDefault();
    setTerm(text.trim());
  };

  return (
    <div className="wrap page">
      <div className="toolbar">
        <h1 className="page-title">{t("events.title")}</h1>
        <Button kind="btn" href="/events/add">
          <Ico.Plus /> {t("events.addEvent")}
        </Button>
      </div>
      <div className="toolbar">
        <nav className="tabs sub">
          <Button kind={when !== "past" && when !== "near" ? "active" : ""} onClick={() => setWhen("upcoming")}>
            {t("events.upcoming")}
          </Button>
          <Button kind={when === "near" ? "active" : ""} onClick={() => setWhen("near")}>
            {t("events.nearYou")}
          </Button>
          <Button kind={when === "past" ? "active" : ""} onClick={() => setWhen("past")}>
            {t("events.past")}
          </Button>
        </nav>
        <form className="inline-form" onSubmit={filter}>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("events.filterPlaceholder")}
            aria-label={t("events.filterLabel")}
          />
          <Button kind="btn ghost small">{t("events.filter")}</Button>
          {me && (
            <label className="check">
              <Input type="checkbox" checked={!!mine} onChange={(e) => setMine(e.target.checked ? "1" : "")} />{" "}
              {t("events.artistsIListenTo")}
            </label>
          )}
        </form>
      </div>
      <Async q={q}>
        {(d) => (
          <>
            {when === "near" && <NearNote near={d.near} />}
            <EventList items={d.items} />
            <Pager total={d.total} limit={d.limit} />
          </>
        )}
      </Async>
    </div>
  );
}

function Listed({ e }: { e: EventData }) {
  if (e.source === "musicbrainz") return <>{t("events.listedOn", { source: "MusicBrainz" })}</>;
  if (e.source === "ticketmaster") return <>{t("events.listedOn", { source: "Ticketmaster" })}</>;
  const user = e.creator ? (
    <Link to={userUrl(e.creator)}>
      <Username name={e.creator} />
    </Link>
  ) : (
    t("events.deletedUser")
  );
  return <>{tx("events.addedBy", { user })}</>;
}

export function EventPage() {
  const id = useParams().id;
  const q = useApi<EventData>(`/event/${id}`);
  const { me } = useAuth();
  const nav = useNavigate();
  const c = useConfirm();
  useTitle(q.data?.title);

  const attend = (status: Attendance | null) => {
    if (!me) return nav("/login");
    api<AttendResult>(`/event/${id}/attend`, { body: { status } }).then(q.reload);
  };

  const askDelete = () =>
    c.ask({
      title: t("events.deleteConfirm"),
      action: t("events.deleteEvent"),
      danger: true,
      run: () => api<EventOk>(`/event/${id}`, { method: "DELETE" }).then(() => nav("/events")),
    });

  return (
    <Async q={q}>
      {(e) => {
        const going = e.status === "going";
        const interested = e.status === "interested";
        return (
          <>
            {c.dialog}
            <Hero
              kicker={t("events.event")}
              title={e.title}
              sub={
                <>
                  {dateTime(e.startsAt)} · {e.venue}, {e.city}
                  {e.country && `, ${e.country}`}
                </>
              }
              stats={
                <>
                  <Stat label={t("events.going")} value={num(e.going)} />
                  <Stat label={t("events.interested")} value={num(e.interested)} />
                </>
              }
              actions={
                <>
                  <Button kind={going ? "btn" : "btn ghost"} onClick={() => attend(going ? null : "going")}>
                    {going ? (
                      <>
                        <Ico.Check /> {t("events.going")}
                      </>
                    ) : (
                      t("events.imGoing")
                    )}
                  </Button>
                  <Button
                    kind={interested ? "btn" : "btn ghost"}
                    onClick={() => attend(interested ? null : "interested")}
                  >
                    {interested ? (
                      <>
                        <Ico.Check /> {t("events.interested")}
                      </>
                    ) : (
                      t("events.interested")
                    )}
                  </Button>
                  {e.mine && (
                    <Button kind="btn ghost" onClick={askDelete}>
                      {t("events.deleteEvent")}
                    </Button>
                  )}
                </>
              }
            />
            <div className="wrap page">
              <div className="cols">
                <div className="main">
                  <Section title={t("events.lineup")}>
                    <Grid kind="artist" cols={4} items={e.artists} />
                  </Section>
                  {e.description && (
                    <Section title={t("events.details")}>
                      <Markdown text={e.description} />
                    </Section>
                  )}
                  {e.url && (
                    <p>
                      <a href={e.url} target="_blank" rel="nofollow noopener noreferrer">
                        {e.source === "musicbrainz" ? t("events.moreOnMusicBrainz") : t("events.tickets")}{" "}
                        <Ico.External />
                      </a>
                    </p>
                  )}
                  <Section title={t("events.wall")}>
                    <Shoutbox type="event" id={e.id} />
                  </Section>
                </div>
                <aside className="side">
                  <Section title={t("events.goingCount", { count: e.going })}>
                    {e.attendees.going.length ? (
                      <UserList items={e.attendees.going} avatar={40} />
                    ) : (
                      <p className="muted">{t("events.nobodyYet")}</p>
                    )}
                  </Section>
                  <Section title={t("events.interestedCount", { count: e.interested })}>
                    {e.attendees.interested.length ? (
                      <UserList items={e.attendees.interested} avatar={40} />
                    ) : (
                      <p className="muted">{t("events.nobodyYet")}</p>
                    )}
                  </Section>
                  <p className="muted small">
                    <Listed e={e} />
                  </p>
                </aside>
              </div>
            </div>
          </>
        );
      }}
    </Async>
  );
}

export function EventAdd() {
  const [f, setF] = useState({
    artists: "",
    title: "",
    venue: "",
    city: "",
    country: "",
    when: "",
    url: "",
    description: "",
  });
  const act = useAction();
  const nav = useNavigate();
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });
  useTitle(TITLES.addEvent);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      if (!f.when) throw new Error(t("events.pickDate"));
      const startsAt = Math.floor(new Date(f.when).getTime() / 1000);
      const r = await api<EventCreated>("/events", { body: { ...f, startsAt } });
      nav(`/event/${r.id}`);
    });
  };

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{t("events.addAnEvent")}</h1>
      <form className="form card" onSubmit={submit}>
        <label>
          {t("events.lineupLabel")}
          <Input value={f.artists} onChange={set("artists")} required placeholder={LINEUP_HINT} />
        </label>
        <label>
          {t("events.titleOptional")}
          <Input value={f.title} onChange={set("title")} maxLength={120} placeholder={t("events.titlePlaceholder")} />
        </label>
        <label>
          {t("events.venue")}
          <PlaceInput
            field="venue"
            value={f.venue}
            onChange={(v) => setF((p) => ({ ...p, venue: v }))}
            required
            maxLength={120}
            onPick={(pl) =>
              setF((p) => ({ ...p, city: p.city || pl.city || "", country: p.country || pl.country || "" }))
            }
          />
        </label>
        <div className="row">
          <label className="grow">
            {t("events.city")}
            <PlaceInput
              field="city"
              value={f.city}
              onChange={(v) => setF((p) => ({ ...p, city: v }))}
              required
              maxLength={80}
              onPick={(pl) => setF((p) => ({ ...p, country: p.country || pl.country || "" }))}
            />
          </label>
          <label className="grow">
            {t("events.country")}
            <CountryInput value={f.country} onChange={(v) => setF((p) => ({ ...p, country: v }))} />
          </label>
        </div>
        <label>
          {t("events.dateTime")}
          <DatePicker
            time
            label={t("events.dateTime")}
            value={f.when}
            onChange={(v) => setF({ ...f, when: v })}
            defaultTime="20:00"
          />
        </label>
        <label>
          {t("events.linkOptional")}
          <Input type="url" value={f.url} onChange={set("url")} placeholder="https://" />
        </label>
        <label>
          {t("events.descriptionOptional")}
          <Textarea rows={4} value={f.description} onChange={set("description")} maxLength={3000} />
        </label>
        {act.note}
        <Button kind="btn" loading={act.busy}>
          {t("events.addEvent")}
        </Button>
      </form>
    </div>
  );
}
import { Username } from "../ui/username";
