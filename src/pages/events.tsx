import { Ico } from "../icons";
import { lazy, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Input, Textarea, useConfirm } from "../kit";
import { Markdown } from "../md";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, dateTime, num, qs, useApi, useAuth, useParam, userUrl, useTitle } from "../lib";
import type { Attendance, AttendResult, EventCreated, EventList as Events, EventOk, EventPage as EventData } from "../../shared/events";
import { Async, Pager, Section, Stat, useAction } from "../ui/base";
import { EventList } from "../ui/events";
import { Grid, UserList } from "../ui/lists";
import { Shoutbox } from "../ui/shoutbox";
import { DatePicker } from "../datepicker";
import { Hero } from "./music/shared";

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
const PlaceInput = lazy(() => import("../ui/country").then(m => ({ default: m.PlaceInput })));
const CountryInput = lazy(() => import("../ui/country").then(m => ({ default: m.CountryInput })));

function NearNote({ near }: { near: Events["near"] }) {
  if (!near) return <p className="text-muted text-[13px]">We couldn't tell where you are from your connection.</p>;
  return (
    <p className="text-muted text-[13px]">
      Roughly {near.city ? `${near.city}, ${near.country}` : near.country}, going by your connection
      {near.wide && ". Nothing close by yet, so these are a bit further out"}.
    </p>
  );
}

export function EventsPage() {
  const [sp] = useSearchParams();
  const { me } = useAuth();
  const [when, setWhen] = useParam("when", "upcoming");
  const [mine, setMine] = useParam("mine");
  const [term, setTerm] = useParam("q");
  const [text, setText] = useState(term);
  const q = useApi<Events>(`/events${qs({ when: when === "upcoming" ? undefined : when, mine, q: term, page: sp.get("page") })}`);
  useTitle("Events");

  const filter = (e: FormEvent) => {
    e.preventDefault();
    setTerm(text.trim());
  };

  return (
    <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8 [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
      <div className="toolbar flex items-center justify-between gap-3.5 flex-wrap mb-3.5 max-sm:items-stretch max-sm:flex-col [&_.page-title]:mb-0 [&_.tabs]:mb-0 [&_.tabs]:flex-1">
        <h1 className="page-title mb-[18px] font-display font-bold text-[36px] tracking-[-.025em] max-sm:text-[26px]">Events</h1>
        <Button kind="btn" href="/events/add"><Ico.Plus /> Add event</Button>
      </div>
      <div className="toolbar flex items-center justify-between gap-3.5 flex-wrap mb-3.5 max-sm:items-stretch max-sm:flex-col [&_.page-title]:mb-0 [&_.tabs]:mb-0 [&_.tabs]:flex-1">
        <nav className="tabs sub flex flex-wrap mb-6 *:hover:no-underline *:current:font-medium gap-1 *:m-0 *:h-auto *:rounded-none *:border-0 *:bg-fill *:px-[11px] *:py-[5px] *:text-[11px] *:font-medium *:uppercase *:tracking-[.05em] *:text-ink *:hover:bg-fill-hover *:hover:text-ink *:current:bg-ink *:current:text-bg max-md:toolbar:max-w-full">
          <Button kind={when !== "past" && when !== "near" ? "active" : ""} onClick={() => setWhen("upcoming")}>Upcoming</Button>
          <Button kind={when === "near" ? "active" : ""} onClick={() => setWhen("near")}>Near you</Button>
          <Button kind={when === "past" ? "active" : ""} onClick={() => setWhen("past")}>Past</Button>
        </nav>
        <form className="inline-form flex gap-2 items-center flex-wrap my-2.5 max-sm:[&>.field]:flex-[1_1_180px] max-sm:[&>.field]:min-w-0 max-sm:[&>.astryx-text-input]:flex-[1_1_180px] max-sm:[&>.astryx-text-input]:min-w-0 max-sm:[&>div:has(>.astryx-text-input)]:flex-[1_1_180px] max-sm:[&>div:has(>.astryx-text-input)]:min-w-0 coarse:[&>.astryx-button]:min-h-10 [&:has(.astryx-text-input)>.astryx-button]:min-h-10 [&:has(.astryx-text-input)>.astryx-button]:px-4 [&>.check]:items-center [&>.check]:gap-2 [&>.check]:ml-2.5 [&>.check]:leading-6 max-[641px]:[&>.check]:ml-0 max-sm:[&>.check]:basis-full max-sm:[&>.check]:min-h-10" onSubmit={filter}>
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="City, country or venue" aria-label="Filter events by place" />
          <Button kind="btn ghost small">Filter</Button>
          {me && (
            <label className="check flex! flex-row! items-start gap-2.5 font-normal! text-[15px] [&_input]:w-4! [&_input]:mt-[3px] [&_input]:flex-none [&_input[type=checkbox]]:h-4! [&_input[type=checkbox]]:min-h-0! [&_input[type=checkbox]]:p-0!">
              <Input type="checkbox" checked={!!mine} onChange={e => setMine(e.target.checked ? "1" : "")} /> Artists I listen to
            </label>
          )}
        </form>
      </div>
      <Async q={q}>
        {d => (
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
  if (e.source === "musicbrainz") return <>Listed on MusicBrainz</>;
  if (e.source === "ticketmaster") return <>Listed on Ticketmaster</>;
  return <>Added by {e.creator ? <Link to={userUrl(e.creator)}>{e.creator}</Link> : "a deleted user"}</>;
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

  const askDelete = () => c.ask({
    title: "Delete this event?",
    action: "Delete event",
    danger: true,
    run: () => api<EventOk>(`/event/${id}`, { method: "DELETE" }).then(() => nav("/events")),
  });

  return (
    <Async q={q}>{e => {
      const going = e.status === "going";
      const interested = e.status === "interested";
      return (
        <>
          {c.dialog}
          <Hero
            kicker="Event"
            title={e.title}
            sub={<>{dateTime(e.startsAt)} · {e.venue}, {e.city}{e.country && `, ${e.country}`}</>}
            stats={<><Stat label="Going" value={num(e.going)} /><Stat label="Interested" value={num(e.interested)} /></>}
            actions={
              <>
                <Button kind={going ? "btn" : "btn ghost"} onClick={() => attend(going ? null : "going")}>
                  {going ? <><Ico.Check /> Going</> : "I'm going"}
                </Button>
                <Button kind={interested ? "btn" : "btn ghost"} onClick={() => attend(interested ? null : "interested")}>
                  {interested ? <><Ico.Check /> Interested</> : "Interested"}
                </Button>
                {e.mine && <Button kind="btn ghost" onClick={askDelete}>Delete event</Button>}
              </>
            }
          />
          <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8 [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
            <div className="cols grid grid-cols-[minmax(0,1fr)_320px] gap-10 items-start max-xl:grid-cols-[minmax(0,1fr)_280px] max-xl:gap-7 max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-2">
              <div className="main min-w-0">
                <Section title="Line-up"><Grid kind="artist" cols={4} items={e.artists} /></Section>
                {e.description && <Section title="Details"><Markdown text={e.description} /></Section>}
                {e.url && (
                  <p>
                    <a href={e.url} target="_blank" rel="nofollow noopener noreferrer">
                      {e.source === "musicbrainz" ? "More on MusicBrainz" : "Tickets and information"} <Ico.External />
                    </a>
                  </p>
                )}
                <Section title="Wall"><Shoutbox type="event" id={e.id} /></Section>
              </div>
              <aside className="side min-w-0 max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-7 max-lg:items-start max-lg:[&>:not(section)]:col-span-full max-lg:[&>section]:mb-6 max-lg:[&>section]:min-w-0 max-sm:block">
                <Section title={`Going (${e.going})`}>
                  {e.attendees.going.length ? <UserList items={e.attendees.going} /> : <p className="text-muted">Nobody yet.</p>}
                </Section>
                <Section title={`Interested (${e.interested})`}>
                  {e.attendees.interested.length ? <UserList items={e.attendees.interested} /> : <p className="text-muted">Nobody yet.</p>}
                </Section>
                <p className="text-muted text-[13px]"><Listed e={e} /></p>
              </aside>
            </div>
          </div>
        </>
      );
    }}</Async>
  );
}

export function EventAdd() {
  const [f, setF] = useState({ artists: "", title: "", venue: "", city: "", country: "", when: "", url: "", description: "" });
  const act = useAction();
  const nav = useNavigate();
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  useTitle("Add an event");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      if (!f.when) throw new Error("Pick a date and time for the event.");
      const startsAt = Math.floor(new Date(f.when).getTime() / 1000);
      const r = await api<EventCreated>("/events", { body: { ...f, startsAt } });
      nav(`/event/${r.id}`);
    });
  };

  return (
    <div className="w-full mx-auto px-5 max-sm:px-4 pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8 max-w-[560px] [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
      <h1 className="page-title mb-[18px] font-display font-bold text-[36px] tracking-[-.025em] max-sm:text-[26px]">Add an event</h1>
      <form className="form flex flex-col gap-3.5 items-start [&>label]:flex [&>label]:flex-col [&>label]:gap-1 [&>label]:font-semibold [&>label]:text-sm [&>label]:w-full [&_.row]:w-full [&_.row>label]:flex [&_.row>label]:flex-col [&_.row>label]:gap-1 [&_.row>label]:font-semibold [&_.row>label]:text-sm [&_.row>label]:w-full [&_label_:is(input,textarea)]:font-normal [&_label_:is(input,textarea)]:text-base [&_label_:is(input,textarea)]:w-full p-[18px] mb-4 bg-card" onSubmit={submit}>
        <label>Line-up (comma separated, headliner first)<Input value={f.artists} onChange={set("artists")} required placeholder={LINEUP_HINT} /></label>
        <label>Title (optional)<Input value={f.title} onChange={set("title")} maxLength={120} placeholder="Defaults to “Headliner at Venue”" /></label>
        <label>
          Venue
          <PlaceInput
            field="venue"
            value={f.venue}
            onChange={v => setF(p => ({ ...p, venue: v }))}
            required
            maxLength={120}
            onPick={pl => setF(p => ({ ...p, city: p.city || pl.city || "", country: p.country || pl.country || "" }))}
          />
        </label>
        <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
          <label className="flex-1 min-w-0">
            City
            <PlaceInput
              field="city"
              value={f.city}
              onChange={v => setF(p => ({ ...p, city: v }))}
              required
              maxLength={80}
              onPick={pl => setF(p => ({ ...p, country: p.country || pl.country || "" }))}
            />
          </label>
          <label className="flex-1 min-w-0">Country<CountryInput value={f.country} onChange={v => setF(p => ({ ...p, country: v }))} /></label>
        </div>
        <label>Date and time<DatePicker time label="Date and time" value={f.when} onChange={v => setF({ ...f, when: v })} defaultTime="20:00" /></label>
        <label>Link (optional)<Input type="url" value={f.url} onChange={set("url")} placeholder="https://" /></label>
        <label>Description (optional)<Textarea rows={4} value={f.description} onChange={set("description")} maxLength={3000} /></label>
        {act.note}
        <Button kind="btn" loading={act.busy}>Add event</Button>
      </form>
    </div>
  );
}
