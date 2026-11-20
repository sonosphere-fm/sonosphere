import { Ico } from "../icons";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Input, Textarea } from "../kit";
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

// ---------- events ----------
export function EventsPage() {
  const [sp] = useSearchParams(), { me } = useAuth();
  const [when, setWhen] = useParam("when", "upcoming"), [mine, setMine] = useParam("mine"), [term, setTerm] = useParam("q");
  const [text, setText] = useState(term);
  const q = useApi<Events>(`/events${qs({ when: when === "past" ? "past" : undefined, mine, q: term, page: sp.get("page") })}`);
  useTitle("Events");
  return (
    <div className="wrap page">
      <div className="toolbar"><h1 className="page-title">Events</h1><Button kind="btn" href="/events/add"><Ico.Plus /> Add event</Button></div>
      <div className="toolbar">
        <nav className="tabs sub">
          <Button kind={when !== "past" ? "active" : ""} onClick={() => setWhen("upcoming")}>Upcoming</Button>
          <Button kind={when === "past" ? "active" : ""} onClick={() => setWhen("past")}>Past</Button>
        </nav>
        <form className="inline-form" onSubmit={e => { e.preventDefault(); setTerm(text.trim()); }}>
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="City, country or venue" aria-label="Filter events by place" />
          <Button kind="btn ghost small">Filter</Button>
          {me && <label className="check"><Input type="checkbox" checked={!!mine} onChange={e => setMine(e.target.checked ? "1" : "")} /> Artists I listen to</label>}
        </form>
      </div>
      <Async q={q}>{d => <><EventList items={d.items} /><Pager total={d.total} limit={d.limit} /></>}</Async>
    </div>
  );
}
export function EventPage() {
  const id = useParams().id, q = useApi<EventData>(`/event/${id}`), { me } = useAuth(), nav = useNavigate();
  useTitle(q.data?.title);
  const attend = (status: Attendance | null) => { if (!me) return nav("/login"); api<AttendResult>(`/event/${id}/attend`, { body: { status } }).then(q.reload); };
  return (
    <Async q={q}>{e => (
      <>
        <Hero kicker="Event" title={e.title} sub={<>{dateTime(e.startsAt)} · {e.venue}, {e.city}{e.country && `, ${e.country}`}</>}
          stats={<><Stat label="Going" value={num(e.going)} /><Stat label="Interested" value={num(e.interested)} /></>}
          actions={<>
            <Button kind={e.status === "going" ? "btn" : "btn ghost"} onClick={() => attend(e.status === "going" ? null : "going")}>{e.status === "going" ? <><Ico.Check /> Going</> : "I'm going"}</Button>
            <Button kind={e.status === "interested" ? "btn" : "btn ghost"} onClick={() => attend(e.status === "interested" ? null : "interested")}>{e.status === "interested" ? <><Ico.Check /> Interested</> : "Interested"}</Button>
            {e.mine && <Button kind="btn ghost" onClick={() => { if (window.confirm("Delete this event?")) api<EventOk>(`/event/${id}`, { method: "DELETE" }).then(() => nav("/events")); }}>Delete event</Button>}
          </>} />
        <div className="wrap page">
          <div className="cols">
            <div className="main">
              <Section title="Line-up"><Grid kind="artist" cols={4} items={e.artists} /></Section>
              {e.description && <Section title="Details"><Markdown text={e.description} /></Section>}
              {e.url && <p><a href={e.url} target="_blank" rel="nofollow noopener noreferrer">Tickets and information <Ico.External /></a></p>}
              <Section title="Wall"><Shoutbox type="event" id={e.id} /></Section>
            </div>
            <aside className="side">
              <Section title={`Going (${e.going})`}>{e.attendees.going.length ? <UserList items={e.attendees.going} /> : <p className="muted">Nobody yet.</p>}</Section>
              <Section title={`Interested (${e.interested})`}>{e.attendees.interested.length ? <UserList items={e.attendees.interested} /> : <p className="muted">Nobody yet.</p>}</Section>
              {e.creator && <p className="muted small">Added by <Link to={userUrl(e.creator)}>{e.creator}</Link></p>}
            </aside>
          </div>
        </div>
      </>
    )}</Async>
  );
}
export function EventAdd() {
  const [f, setF] = useState({ artists: "", title: "", venue: "", city: "", country: "", when: "", url: "", description: "" }), act = useAction(), nav = useNavigate();
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  useTitle("Add an event");
  const submit = (e: FormEvent) => { e.preventDefault(); act.run(async () => { if (!f.when) throw new Error("Pick a date and time for the event."); const r = await api<EventCreated>("/events", { body: { ...f, startsAt: Math.floor(new Date(f.when).getTime() / 1000) } }); nav(`/event/${r.id}`); }); };
  return (
    <div className="wrap page narrow">
      <h1 className="page-title">Add an event</h1>
      <form className="form card" onSubmit={submit}>
        <label>Line-up (comma separated, headliner first)<Input value={f.artists} onChange={set("artists")} required placeholder="Glass Harbor, Paper Lanterns" /></label>
        <label>Title (optional)<Input value={f.title} onChange={set("title")} maxLength={120} placeholder="Defaults to “Headliner at Venue”" /></label>
        <label>Venue<Input value={f.venue} onChange={set("venue")} required maxLength={120} /></label>
        <div className="row"><label className="grow">City<Input value={f.city} onChange={set("city")} required maxLength={80} /></label><label className="grow">Country<Input value={f.country} onChange={set("country")} maxLength={80} /></label></div>
        <label>Date and time<DatePicker time label="Date and time" value={f.when} onChange={v => setF({ ...f, when: v })} defaultTime="20:00" /></label>
        <label>Link (optional)<Input type="url" value={f.url} onChange={set("url")} placeholder="https://" /></label>
        <label>Description (optional)<Textarea rows={4} value={f.description} onChange={set("description")} maxLength={3000} /></label>
        {act.note}
        <Button kind="btn" loading={act.busy}>Add event</Button>
      </form>
    </div>
  );
}
