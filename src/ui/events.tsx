import { Link } from "react-router-dom";
import { num } from "../lib";
import { Empty } from "./base";
import type { EventSummary } from "../../shared/events";
import type { EventSummary as ArtistEvent } from "../../shared/catalog";

export function EventList({ items }: { items: (EventSummary | ArtistEvent)[] }) {
  if (!items.length) return <Empty>No events found.</Empty>;
  return (
    <ul className="events">
      {items.map(e => {
        const d = new Date(e.startsAt * 1000);
        return (
          <li key={e.id}>
            <div className="cal">
              <span>{d.toLocaleDateString("en-GB", { month: "short" })}</span>
              <b>{d.getDate()}</b>
              {d.getFullYear() !== new Date().getFullYear() && <span className="cal-year">{d.getFullYear()}</span>}
            </div>
            <div className="grow">
              <Link className="strong" to={`/event/${e.id}`}>{e.title}</Link>
              <span className="muted">{e.artists.map(a => a.name).join(", ")}</span>
              <span className="muted small">{e.venue} · {e.city}{e.country ? `, ${e.country}` : ""}</span>
            </div>
            <div className="muted small nowrap right">
              {e.status && <span className="badge">{e.status === "going" ? "Going" : "Interested"}</span>}
              <br />
              {num(e.going)} going
            </div>
          </li>
        );
      })}
    </ul>
  );
}
